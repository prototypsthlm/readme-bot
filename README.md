# README Bot 🤖

GitHub App webhook server that automatically maintains README.md files by analyzing pull request changes with Claude AI.

## I'm TESTING THINGS! 

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

### 2. Deploy Server

```bash
# Clone and install
git clone https://github.com/your-username/readme-bot
cd readme-bot
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start
```

### 3. Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key
GH_CLIENT_ID=your-github-app-client-id
GH_CLIENT_SECRET=your-github-app-client-secret

# Optional  
WEBHOOK_SECRET=your-webhook-secret
PORT=3000
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

## What it detects

- **Environment variables** - New `process.env.*` usage
- **Dependencies** - `package.json` changes  
- **Features** - New API endpoints, CLI commands
- **Setup changes** - Docker, build scripts, installation steps
- **Architecture** - New services, database changes

## Development

```bash
npm install
npm start
# Server runs on http://localhost:3000
```

**Endpoints:**
- `POST /webhook` - GitHub webhook handler
- `GET /health` - Health check

## License

MIT