DOCKER_COMPOSE ?= docker compose
DEV_COMPOSE_FILE ?= dev-docker-compose.yml
PROD_COMPOSE_FILE ?= docker-compose.yml
INT_COMPOSE_FILE ?= integration-docker-compose.yml
APP_COMPOSE_FILE ?= app-docker-compose.yml
COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DEV_COMPOSE_FILE)
COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)
COMPOSE_INT := $(DOCKER_COMPOSE) -f $(INT_COMPOSE_FILE)
COMPOSE_APP := $(DOCKER_COMPOSE) -f $(APP_COMPOSE_FILE)
WAIT_FLAG ?= --wait

.PHONY: help \
	dev-up dev-down dev-restart dev-restart-web dev-restart-api \
	prod-up prod-down prod-restart \
	app app-tunnel \
	test test-unit test-unit-backend test-unit-tablet test-unit-web \
	test-integration test-integration-up test-integration-down \
	test-integration-db-only \
	clean-test-results

############################
# Dev
############################
dev-up:
	$(COMPOSE_DEV) up -d --build

dev-down:
	$(COMPOSE_DEV) down

dev-restart:
	$(COMPOSE_DEV) restart api web

dev-restart-web:
	$(COMPOSE_DEV) restart web

dev-restart-api:
	$(COMPOSE_DEV) restart api

############################
# Tablet app (Expo, via nvm)
############################
app:
	@cd app && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
	node --version && \
	if [ -f package-lock.json ]; then npm ci; else npm install; fi && \
	npx expo start --clear

app-tunnel:
	@cd app && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
	node --version && \
	if [ -f package-lock.json ]; then npm ci; else npm install; fi && \
	npx expo start --tunnel --clear

############################
# Unit tests
############################
test-unit-backend:
	@mkdir -p test-results
	python -m pytest backend/tests/unit -q --junitxml=test-results/backend-unit.xml

test-unit-tablet:
	@mkdir -p test-results
	@cd app && npm run test -- --reporter=junit --outputFile=../test-results/tablet-unit.xml

test-unit-web:
	@mkdir -p test-results
	@cd web && npm run test -- --reporter=junit --outputFile=../test-results/web-unit.xml

test-unit: test-unit-backend test-unit-tablet test-unit-web

test: test-unit

clean-test-results:
	rm -rf test-results

############################
# Integration tests (Local pytest against containerized DB)
############################

# Just start the test DB (useful if you want to run pytest manually)
test-integration-db-only:
	$(COMPOSE_INT) up -d db

# Tear down integration environment and destroy volumes
test-integration-down:
	$(COMPOSE_INT) down -v

# Full cycle: spin up DB, run local pytest, tear down DB
test-integration: test-integration-db-only
	@echo "Waiting for Postgres to initialize..."
	@sleep 2
	@mkdir -p test-results
	DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5433/MobileToServer-POS_test" \
	DEFAULT_MANAGER_NAME="Test Admin" \
	DEFAULT_MANAGER_PIN="1234" \
	python -m pytest backend/tests -m integration -v --tb=short --junitxml=test-results/backend-integration.xml
	@$(MAKE) test-integration-down

############################
# Prod
############################
prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-restart:
	$(COMPOSE_PROD) restart api web