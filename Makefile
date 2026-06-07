# ─────────────────────────────────────────────────────────────────────────────
# Three Musketeers — Make + Docker + Compose.    https://3musketeers.io
#
# Every target runs inside a container via Compose, so `make test` (and friends)
# behave identically on a laptop and in CI — "all for one, one for all".
# The only host requirements are Docker and Make; no local Node toolchain.
#
#   make            list targets
#   make ci         what CI runs, from a clean checkout
#   make test       run the suite
#   make cli ARGS="--quantity 4 --date 2026-06-08 --seats 10"
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE := docker compose
RUN     := $(COMPOSE) run --rm node
PORT    ?= 3000

.DEFAULT_GOAL := help

.PHONY: help deps typecheck lint audit test build fmt fmt-check ci \
        cli server server-dynamo up setup down clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ── Toolchain (containerised) ────────────────────────────────────────────────

deps: ## Install dependencies (npm ci) into the node_modules volume
	$(RUN) npm ci

typecheck: ## Type-check with tsc
	$(RUN) npm run typecheck

lint: ## Lint with eslint
	$(RUN) npm run lint

audit: ## Audit make*/compose* factory naming
	$(RUN) npm run audit

test: ## Run the test suite with coverage
	$(RUN) npm test

build: ## Bundle cli + server with tsup
	$(RUN) npm run build

fmt: ## Format the codebase with prettier (writes)
	$(RUN) npm run format

fmt-check: ## Verify formatting without writing
	$(RUN) npm run format:check

ci: deps typecheck lint audit test build ## Everything CI runs, from a clean checkout

# ── Run the app (containerised) ──────────────────────────────────────────────

cli: ## Run the CLI — e.g. make cli ARGS="--quantity 4 --date 2026-06-08 --seats 10"
	$(RUN) node src/cli/index.ts $(ARGS)

server: ## Run the HTTP server (in-memory DB), port 3000 (override with PORT=)
	$(COMPOSE) run --rm -p $(PORT):$(PORT) -e PORT=$(PORT) node npm start

server-dynamo: up setup ## Run the server against LocalStack DynamoDB
	$(COMPOSE) run --rm -p $(PORT):$(PORT) -e PORT=$(PORT) \
		-e DYNAMODB_TABLE=reservations \
		-e DYNAMODB_ENDPOINT=http://localstack:4566 \
		-e AWS_REGION=us-east-1 \
		node npm start

# ── LocalStack (DynamoDB) ────────────────────────────────────────────────────

up: ## Start LocalStack (DynamoDB) in the background
	$(COMPOSE) up -d localstack

setup: ## Create the reservations table in LocalStack (needs aws CLI on host)
	bash scripts/setup-local.sh

down: ## Stop and remove all containers
	$(COMPOSE) down

clean: ## Stop everything; remove volumes + build output
	$(COMPOSE) down -v
	rm -rf dist coverage
