.PHONY: dev build clean install lint format test typecheck build-app

# Développement
dev: node_modules
	npm run dev

# Installation des dépendances
install:
	npm install

node_modules: package.json
	npm install
	@touch node_modules

# Build
build: node_modules
	npm run build

build-app: node_modules
	npm run build:app

# Qualité
lint: node_modules
	npm run lint

lint-fix: node_modules
	npm run lint:fix

format: node_modules
	npm run format

typecheck: node_modules
	npm run typecheck

# Tests
test: node_modules
	npm run test

test-watch: node_modules
	npm run test:watch

test-coverage: node_modules
	npm run test:coverage

# Nettoyage
clean:
	rm -rf dist node_modules .vite
