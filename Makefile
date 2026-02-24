.PHONY: dev build clean install lint format test typecheck build-app app

# Développement
dev: node_modules
	npm run dev

# Installation des dépendances
install:
	npm install

node_modules: package.json
	npm install
	@touch node_modules

# Build Vite (main + preload + renderer)
build: node_modules
	npm run build

# Package macOS app (.app + .zip) dans release/
app: build
	npx electron-builder --mac --publish never

build-app: app

# Qualité
lint: node_modules
	npm run lint

lint-fix: node_modules
	npm run lint:fix

format: node_modules
	npm run format

typecheck: node_modules
	npx tsc -p tsconfig.main.json --noEmit
	npx tsc -p tsconfig.renderer.json --noEmit

# Tests
test: node_modules
	npm run test

test-watch: node_modules
	npm run test:watch

test-coverage: node_modules
	npm run test:coverage

# Nettoyage
clean:
	rm -rf dist release .vite
