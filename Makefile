DOCKER_COMPOSE ?= docker compose

DEV_COMPOSE_FILE ?= dev-docker-compose.yml
PROD_COMPOSE_FILE ?= prod-docker-compose.yml

COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DEV_COMPOSE_FILE)
COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)

# If your Docker Compose version does not support --wait, use:
# make WAIT_FLAG= dev-deploy-api
WAIT_FLAG ?= --wait

.PHONY: help \
	dev-up dev-down dev-restart \
	prod-up prod-down prod-restart \



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
# Prod
############################

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-restart:
	$(COMPOSE_PROD) restart api web