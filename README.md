# README Bot 🤖📚

[![npm version](https://badge.fury.io/js/readme-bot.svg)](https://badge.fury.io/js/readme-bot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered README maintenance tool that automatically analyzes your pull requests and suggests relevant documentation updates. Powered by Claude AI for intelligent change detection and context-aware suggestions.

## ✨ Features

- **🧠 Intelligent Analysis**: Uses Claude AI to understand the semantic meaning of your code changes
- **📝 Smart Suggestions**: Detects when README updates are needed for:
  - New environment variables
  - Package/dependency changes  
  - New features and functionality
  - Setup and installation changes
  - API modifications
  - Architecture updates
- **🔄 GitHub Integration**: Works as both a CLI tool and GitHub Action
- **💬 Non-blocking**: Provides suggestions without blocking PR merges
- **⚙️ Configurable**: Customizable rules and output formats
- **🎯 Context-aware**: Understands your project structure and existing documentation

## 🚀 Quick Start

### As a GitHub Action

Add to your `.github/workflows/readme-bot.yml`:

```yaml
name: README Bot
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  readme-bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/readme-bot@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### As a CLI Tool

```bash
# Install globally
npm install -g readme-bot

# Or use with npx
npx readme-bot analyze -r owner/repo -p 123

# Analyze local repository
npx readme-bot analyze -r . -p 123 --format cli
```

## 📋 Requirements

- **Node.js** 18 or higher
- **Anthropic API Key** - Get one at [console.anthropic.com](https://console.anthropic.com)
- **GitHub Token** - For repository access

## ⚙️ Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=your_claude_api_key_here
GITHUB_TOKEN=your_github_token_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Optional
```

### Configuration File

Create `readme-bot.config.json` in your project root:

```json
{
  "claude": {
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4000,
    "temperature": 0.1
  },
  "github": {
    "updateExistingComment": true,
    "createReview": false
  },
  "analysis": {
    "priorityRules": {
      "env": "high",
      "dependency": "medium",
      "feature": "medium",
      "setup": "high",
      "api": "high"
    }
  },
  "output": {
    "format": "github",
    "groupBySeverity": true
  }
}
```

Generate a default config:
```bash
npx readme-bot init
```

## 🛠️ CLI Usage

### Analyze a Pull Request

```bash
# Basic analysis
readme-bot analyze -r owner/repo -p 123

# With comment posting
readme-bot analyze -r owner/repo -p 123 --post-comment

# Different output formats
readme-bot analyze -r owner/repo -p 123 --format json
readme-bot analyze -r owner/repo -p 123 --format cli --verbose
```

### GitHub Action Mode

```bash
# Run in GitHub Actions environment
readme-bot action
```

### Configuration Commands

```bash
# Create default configuration
readme-bot init

# Validate current configuration
readme-bot validate
```

## 🔧 GitHub Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `anthropic-api-key` | Claude API key | Yes | - |
| `github-token` | GitHub token | No | `${{ github.token }}` |
| `format` | Output format (github/cli/json) | No | `github` |
| `post-comment` | Post suggestions as PR comment | No | `true` |
| `update-existing` | Update existing comments | No | `true` |
| `config-path` | Path to config file | No | - |
| `verbose` | Enable verbose output | No | `false` |

## 📤 GitHub Action Outputs

| Output | Description |
|--------|-------------|
| `needs-update` | Whether README needs updates |
| `suggestion-count` | Number of suggestions |
| `comment-url` | URL of posted comment |
| `error` | Error message if failed |

## 🎯 What It Detects

README Bot intelligently analyzes your changes for:

### Environment Variables
- New `process.env.*` references
- Docker ENV statements  
- Config file environment references

### Dependencies
- `package.json` changes
- New package installations
- Version updates
- Security updates

### Features & APIs
- New routes or endpoints
- New CLI commands
- Public API changes
- New functionality

### Setup & Installation
- Build script changes
- Installation requirements
- Docker configuration
- CI/CD updates

### Architecture
- Project structure changes
- New directories or modules
- Database schema changes
- Service additions

## 💡 Example Output

### CLI Format
```
📚 README Update Suggestions
──────────────────────────────────────────────────

🔴 High Priority:

1. 🔐 Environment Variable Update
   Section: Environment Variables
   New environment variable DATABASE_URL detected in config/database.js
   
2. ⚙️ Setup Update  
   Section: Installation
   Docker configuration added - update setup instructions

🟡 Medium Priority:

3. 📦 Dependency Update
   Section: Dependencies
   Added @stripe/stripe-js - document payment integration
```

### GitHub Comment
The bot posts formatted suggestions directly on your PR with:
- Grouped suggestions by priority
- Expandable code sections
- Direct links to relevant files
- Non-intrusive, informative tone

## 🔄 Advanced Usage

### Custom Prompts

Extend the analysis with custom detection rules:

```javascript
// In your config file
{
  "analysis": {
    "customRules": [
      {
        "pattern": "new.*Service",
        "type": "architecture", 
        "priority": "high",
        "section": "Services"
      }
    ]
  }
}
```

### Multiple Repositories

```bash
# Analyze multiple PRs
for repo in repo1 repo2 repo3; do
  readme-bot analyze -r myorg/$repo -p $PR_NUMBER --format json >> results.json
done
```

### Integration with Other Tools

```yaml
# GitHub Actions workflow
- name: Check README
  uses: readme-bot@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
  
- name: Process Results
  if: steps.readme-bot.outputs.needs-update == 'true'
  run: |
    echo "README needs ${{ steps.readme-bot.outputs.suggestion-count }} updates"
```

## 🧪 Development

### Setup

```bash
git clone https://github.com/your-username/readme-bot
cd readme-bot
npm install
```

### Running Tests

```bash
npm test
npm run test:watch
```

### Local Development

```bash
# Link for global use
npm link

# Test with local changes
readme-bot analyze -r . -p 123 --format cli
```

### Publishing GitHub Action Releases

When ready to release a new version:

```bash
# Create and push a new tag
git tag v1.1.0
git push origin v1.1.0

# Update major version tag (so users can use @v1)
git tag -f v1
git push origin v1 --force
```

**Important**: GitHub Actions users reference tags like `@v1`, `@v1.1.0`. Always update the major version tag when releasing.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Powered by [Anthropic's Claude AI](https://www.anthropic.com)
- Built with [Octokit](https://github.com/octokit/octokit.js) for GitHub integration
- Inspired by the need for better documentation maintenance

---

<sub>🤖 Keep your docs fresh with README Bot!</sub>
