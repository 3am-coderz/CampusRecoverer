.PHONY: all dev test e2e down clean help

help:
	@echo "Campus Recoverer - Available Targets:"
	@echo "  make dev    - Run the entire stack locally in dev mode"
	@echo "  make test   - Run unit/module tests across API, Web, Matching"
	@echo "  make e2e    - Run end-to-end integration and security invariant tests"
	@echo "  make down   - Stop background containers / services"
	@echo "  make clean  - Remove build artifacts"

dev:
	@echo "Starting Campus Recoverer development services..."
	@if [ -f infra/docker-compose.yml ] && docker compose version >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then \
		docker compose -f infra/docker-compose.yml up; \
	else \
		echo "Starting local Node and Python services concurrently..."; \
		(source .venv/bin/activate && cd services/matching && uvicorn main:app --host 0.0.0.0 --port 8000 &) ; \
		npm run dev; \
	fi

test:
	@echo "Running all tests..."
	npm run test:api
	npm run test:matching

e2e:
	@echo "Running E2E and security invariant tests..."
	npm run test:e2e

down:
	@echo "Stopping any running services..."
	@-pkill -f "uvicorn main:app" || true
	@-if [ -f infra/docker-compose.yml ] && docker ps >/dev/null 2>&1; then \
		docker compose -f infra/docker-compose.yml down; \
	fi

clean:
	rm -rf dist apps/*/dist .pytest_cache
