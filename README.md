# README Bot 🤖

GitHub App webhook server that automatically maintains README.md files by analyzing pull request changes with Claude AI.

## How it works

1. **Install the GitHub App** on your repositories
2. **Server receives webhook** when PRs are opened/updated
3. **Claude AI analyzes** the changes for documentation needs
4. **Bot commits** README updates directly to the PR branch

## Setup

### 1. Create GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Set webhook URL to your server: `https://yourserver.com/webhook`
4. Enable these permissions:
   - **Contents**: Read & Write (to read/update README)
   - **Pull requests**: Read (to analyze PRs)
5. Subscribe to **Pull request** events

### 2. Deploy to Digital Ocean Functions

```bash
# Clone and setup
git clone https://github.com/your-username/readme-bot
cd readme-bot

# Set environment variables in Digital Ocean Functions
# Configure in project.yml or Digital Ocean dashboard

# Deploy function
doctl serverless deploy .
```

### 3. Environment Variables

Configure these in your Digital Ocean Functions environment:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key
GH_APP_ID=your-github-app-id
GH_PRIVATE_KEY=your-github-app-private-key

# Optional  
WEBHOOK_SECRET=your-webhook-secret
```

## What it detects

- **Environment variables** - New `process.env.*` usage
- **Dependencies** - `package.json` changes  
- **Features** - New API endpoints, CLI commands
- **Setup changes** - Docker, build scripts, installation steps
- **Architecture** - New services, database changes

## Development

```bash
# Install dependencies in function directory
cd packages/readme-bot/webhook
npm install

# Build TypeScript
npm run build

# Deploy to Digital Ocean Functions
cd ../../../
doctl serverless deploy .
```

## Deployment Commands

```bash
# Deploy function
doctl serverless deploy .

# Get function URL
doctl sls fn get readme-bot/webhook --url

# Invoke function for testing
doctl serverless functions invoke readme-bot/webhook
```
