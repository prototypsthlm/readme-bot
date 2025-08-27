# README Bot - Digital Ocean Functions Makefile

.PHONY: help build deploy status invoke url logs clean

help: ## Show this help message
	@echo "README Bot - Digital Ocean Functions"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build TypeScript code
	@echo "Building TypeScript..."
	cd packages/readme-bot/webhook && npm run build

deploy: ## Deploy function to Digital Ocean
	@echo "Deploying to Digital Ocean Functions..."
	doctl serverless deploy .

status: ## Check deployment status
	@echo "Checking deployment status..."
	doctl serverless status

invoke: ## Invoke the webhook function for testing
	@echo "Invoking webhook function..."
	doctl serverless functions invoke readme-bot/webhook

url: ## Get the function URL
	@echo "Getting function URL..."
	doctl sls fn get readme-bot/webhook --url

logs: ## View function logs
	@echo "Viewing function logs..."
	doctl sls activations logs --function readme-bot/webhook

clean: ## Clean built files
	@echo "Cleaning built files..."
	rm -rf packages/readme-bot/webhook/dist
	rm -f .deployed

install: ## Install dependencies
	@echo "Installing dependencies..."
	cd packages/readme-bot/webhook && npm install

redeploy: build deploy ## Build and deploy in one command

dev-setup: install build ## Setup for development (install + build)

# Default target
.DEFAULT_GOAL := help