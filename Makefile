DOCKER_COMPOSE ?= docker compose

DEV_COMPOSE_FILE ?= dev-docker-compose.yml
PROD_COMPOSE_FILE ?= prod-docker-compose.yml
APP_COMPOSE_FILE ?= app-docker-compose.yml

COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DEV_COMPOSE_FILE)
COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)
COMPOSE_APP := $(DOCKER_COMPOSE) -f $(APP_COMPOSE_FILE)

# If your Docker Compose version does not support --wait, use:
# make WAIT_FLAG= dev-deploy-api
WAIT_FLAG ?= --wait

.PHONY: help \
	dev-up dev-down dev-restart dev-restart-web dev-restart-api \
	prod-up prod-down prod-restart \
	app app-tunnel \
	test test-unit test-unit-backend test-unit-tablet test-unit-web \
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
	test-unit-backend:
	python -m pytest backend/tests -q

# Tablet: vitest via nvm (node 22), same setup as `make app`.
test-unit-tablet:
	@cd app && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
	npm run test

# Web: vitest via nvm (node 22).
test-unit-web:
	@cd web && \
	export NVM_DIR="$$HOME/.nvm" && \
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && \
	(nvm use 22 >/dev/null 2>&1 || nvm install 22) && \
	npm run test

test-unit: test-unit-backend test-unit-tablet test-unit-web

test: test-unit

clean-test-results:
	rm -rf test-results


############################
# Prod
############################

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-restart:
	$(COMPOSE_PROD) restart api web