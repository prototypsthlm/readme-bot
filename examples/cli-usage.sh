#!/bin/bash

# README Bot CLI Examples
# Make sure you have your environment variables set:
# export ANTHROPIC_API_KEY="your_claude_api_key_here"  
# export GITHUB_TOKEN="your_github_token_here"

echo "🤖 README Bot CLI Examples"
echo "=========================="

# Basic PR analysis
echo -e "\n📋 Basic PR Analysis:"
echo "readme-bot analyze -r microsoft/vscode -p 12345"

# Analysis with CLI output format
echo -e "\n🖥️  CLI Format Output:"
echo "readme-bot analyze -r facebook/react -p 67890 --format cli"

# Analysis with JSON output (useful for automation)
echo -e "\n📄 JSON Format Output:"
echo "readme-bot analyze -r nodejs/node -p 54321 --format json"

# Post suggestions as PR comment
echo -e "\n💬 Post Comment to PR:"
echo "readme-bot analyze -r your-org/your-repo -p 123 --post-comment"

# Update existing comment instead of creating new ones
echo -e "\n🔄 Update Existing Comment:"
echo "readme-bot analyze -r your-org/your-repo -p 123 --post-comment --update-comment"

# Verbose output for debugging
echo -e "\n🔍 Verbose Analysis:"
echo "readme-bot analyze -r your-org/your-repo -p 123 --format cli --verbose"

# Configuration management
echo -e "\n⚙️  Configuration Commands:"
echo "readme-bot init                    # Create default config file"
echo "readme-bot validate                # Check current configuration"

# GitHub Action mode (used in CI/CD)
echo -e "\n🚀 GitHub Action Mode:"
echo "readme-bot action                  # Run in GitHub Actions environment"

# Real example commands you can run:
echo -e "\n🎯 Try These Real Examples:"
echo "# Analyze a recent TypeScript PR"
echo "readme-bot analyze -r microsoft/TypeScript -p 58000 --format cli"
echo ""
echo "# Analyze a React PR with JSON output"  
echo "readme-bot analyze -r facebook/react -p 28000 --format json"
echo ""
echo "# Check a Node.js enhancement PR"
echo "readme-bot analyze -r nodejs/node -p 50000 --format cli --verbose"

# Automation examples
echo -e "\n🔧 Automation Examples:"
cat << 'EOF'

# Batch analyze multiple PRs
for pr in 100 101 102; do
  echo "Analyzing PR #$pr"
  readme-bot analyze -r your-org/repo -p $pr --format json > "analysis-$pr.json"
done

# Check if README needs updates (useful in scripts)
if readme-bot analyze -r your-org/repo -p 123 --format json | jq -r '.needsUpdate' | grep -q true; then
  echo "README needs updates!"
  # Run additional automation
fi

# Monitor multiple repositories
repos=("org/repo1" "org/repo2" "org/repo3")
for repo in "${repos[@]}"; do
  echo "Checking $repo..."
  # Get latest PR number (requires GitHub CLI)
  latest_pr=$(gh pr list -R "$repo" --limit 1 --json number -q '.[0].number')
  if [ ! -z "$latest_pr" ]; then
    readme-bot analyze -r "$repo" -p "$latest_pr" --format cli
  fi
done

EOF

echo -e "\n💡 Pro Tips:"
echo "• Use --format json for automation and scripting"
echo "• Add --verbose for debugging API issues" 
echo "• Set up aliases for frequently used commands"
echo "• Use --update-comment to keep PR comments clean"
echo "• Check exit codes: 0 = no updates needed, 1 = updates needed or error"

echo -e "\n📁 Config File Locations (checked in order):"
echo "1. ./readme-bot.config.json"
echo "2. ./.readme-bot.json" 
echo "3. ./config/readme-bot.json"
echo "4. (built-in defaults)"

echo -e "\n🔑 Environment Variables:"
echo "ANTHROPIC_API_KEY    - Required: Your Claude API key"
echo "GITHUB_TOKEN         - Required: GitHub personal access token"
echo "CLAUDE_MODEL         - Optional: Override default Claude model"