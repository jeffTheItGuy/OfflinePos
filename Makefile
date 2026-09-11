DOCKER_COMPOSE ?= docker compose

DEV_COMPOSE_FILE ?= dev-docker-compose.yml
PROD_COMPOSE_FILE ?= prod-docker-compose.yml

COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DEV_COMPOSE_FILE)
COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)

# If your Docker Compose version does not support --wait, use:
# make WAIT_FLAG= dev-deploy-api
WAIT_FLAG ?= --wait

.PHONY: help \
	dev-up dev-down dev-restart dev-restart-web dev-restart-api \
	prod-up prod-down prod-restart \
	app app-tunnel


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
# Tablet app (Expo)
############################

# Metro bundler — long-lived interactive process with the QR code.
# Stop with Ctrl+C. Requires the api container (make dev-up) to be running.
app:
	@# Determine host IP for REACT_NATIVE_PACKAGER_HOSTNAME
	@if [ "$$(uname -s)" = "Linux" ]; then \
		HOST_IP=$$(hostname -I | awk '{print $$1}'); \
	elif [ "$$(uname -s)" = "Darwin" ]; then \
		HOST_IP="host.docker.internal"; \
	else \
		HOST_IP="host.docker.internal"; \
	fi; \
	echo "Using host IP: $$HOST_IP for REACT_NATIVE_PACKAGER_HOSTNAME"; \
	REACT_NATIVE_PACKAGER_HOSTNAME=$$HOST_IP docker-compose up --build

# Fallback for networks that block phone<->computer traffic (routes via Expo's servers).
app-tunnel:
	cd app && npx expo start --tunnel


############################
# Prod
############################

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-restart:
	$(COMPOSE_PROD) restart api web