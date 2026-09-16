DOCKER_COMPOSE ?= docker compose
DEV_COMPOSE_FILE ?= dev-docker-compose.yml
PROD_COMPOSE_FILE ?= docker-compose.yml
INT_COMPOSE_FILE ?= integration-docker-compose.yml
APP_COMPOSE_FILE ?= app-docker-compose.yml
COMPOSE_DEV  := $(DOCKER_COMPOSE) -f $(DEV_COMPOSE_FILE)
COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)
COMPOSE_INT  := $(DOCKER_COMPOSE) -f $(INT_COMPOSE_FILE)
COMPOSE_APP  := $(DOCKER_COMPOSE) -f $(APP_COMPOSE_FILE)

# Shared test DB URL
TEST_DB_URL := postgresql+psycopg2://postgres:postgres@localhost:5433/MobileToServer-POS_test

.PHONY: help \
    dev-up dev-down dev-restart dev-restart-web dev-restart-api \
    prod-up prod-down prod-restart \
    app app-tunnel \
    test test-unit test-unit-backend test-unit-tablet test-unit-web \
    test-integration test-integration-db-only test-integration-down \
    test-concurrency test-concurrency-db-only test-concurrency-down \
    test-security test-security-db-only test-security-down \
    test-load test-load-verify \
    test-all clean-test-results

############################
# Help
############################
help:
	@echo "MobileToServer-POS — Make targets"
	@echo ""
	@echo "  DEV"
	@echo "    dev-up / dev-down / dev-restart"
	@echo ""
	@echo "  TABLET APP"
	@echo "    app / app-tunnel"
	@echo ""
	@echo "  UNIT TESTS"
	@echo "    test-unit            all three apps"
	@echo "    test-unit-backend    backend only"
	@echo "    test-unit-tablet     tablet only"
	@echo "    test-unit-web        web only"
	@echo ""
	@echo "  INTEGRATION TESTS"
	@echo "    test-integration     full cycle (db up → pytest → db down)"
	@echo "    test-integration-db-only"
	@echo "    test-integration-down"
	@echo ""
	@echo "  CONCURRENCY TESTS"
	@echo "    test-concurrency     race-condition tests (CON-01..05)"
	@echo "    test-concurrency-db-only"
	@echo "    test-concurrency-down"
	@echo ""
	@echo "  SECURITY TESTS"
	@echo "    test-security        authorization & exposure tests (SEC-01..11)"
	@echo "    test-security-db-only"
	@echo "    test-security-down"
	@echo ""
	@echo "  LOAD TESTS"
	@echo "    test-load            k6 sustained load"
	@echo "    test-load-verify     post-load integrity checks"
	@echo ""
	@echo "  EVERYTHING"
	@echo "    test-all             unit + integration + concurrency + security"
	@echo "    clean-test-results"

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
# Tablet app
############################
app:
	@cd app && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
	if [ -f package-lock.json ]; then npm ci; else npm install; fi && \
	npx expo start --clear

app-tunnel:
	@cd app && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
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

############################
# Integration tests
############################
test-integration-db-only:
	$(COMPOSE_INT) up -d db
	@echo "Waiting for Postgres…"
	@sleep 3

test-integration-down:
	$(COMPOSE_INT) down -v

test-integration: test-integration-db-only
	@mkdir -p test-results
	DATABASE_URL="$(TEST_DB_URL)" \
	DEFAULT_MANAGER_NAME="Test Admin" \
	DEFAULT_MANAGER_PIN="1234" \
	python -m pytest backend/tests/integration -m integration -v --tb=short \
		--junitxml=test-results/backend-integration.xml
	@$(MAKE) test-integration-down

############################
# Concurrency tests
############################
test-concurrency-db-only:
	$(COMPOSE_INT) up -d db
	@echo "Waiting for Postgres…"
	@sleep 3

test-concurrency-down:
	$(COMPOSE_INT) down -v

test-concurrency: test-concurrency-db-only
	@mkdir -p test-results
	DATABASE_URL="$(TEST_DB_URL)" \
	DEFAULT_MANAGER_NAME="Concurrency Admin" \
	DEFAULT_MANAGER_PIN="1234" \
	python -m pytest backend/tests/concurrency -v --tb=short -x \
		--junitxml=test-results/backend-concurrency.xml
	@$(MAKE) test-concurrency-down

############################
# Security tests
############################
test-security-db-only:
	$(COMPOSE_INT) up -d db
	@echo "Waiting for Postgres…"
	@sleep 3

test-security-down:
	$(COMPOSE_INT) down -v

test-security: test-security-db-only
	@mkdir -p test-results
	DATABASE_URL="$(TEST_DB_URL)" \
	DEFAULT_MANAGER_NAME="Security Admin" \
	DEFAULT_MANAGER_PIN="1234" \
	python -m pytest backend/tests/security -m security -v --tb=short \
		--junitxml=test-results/backend-security.xml
	@$(MAKE) test-security-down

############################
# Load tests
############################
test-load:
	@mkdir -p test-results/load
	BASE_URL="${BASE_URL:-http://localhost:8000}" \
	TEST_MANAGER_PIN="${TEST_MANAGER_PIN:-1234}" \
	DEVICE_PREFIX="${DEVICE_PREFIX:-LT}" \
	SUMMARY_PATH="test-results/load/load-summary" \
	bash tests/load/run-load-test.sh

test-load-verify:
	python tests/load/verify-integrity.py \
		--db-url "$(TEST_DB_URL)"

############################
# Run everything
############################
test-all: test-unit test-integration test-concurrency test-security
	@echo ""
	@echo "═══ All test suites passed ═══"

test: test-unit

clean-test-results:
	rm -rf test-results