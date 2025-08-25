#!/bin/bash

# Local Testing Script for README Bot
echo "🤖 README Bot Local Testing Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo "❌ Please run this script from the readme-bot directory"
    exit 1
fi

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  Missing required environment variables!"
    echo "Please set:"
    echo "export ANTHROPIC_API_KEY='your_claude_api_key_here'"
    echo "export GITHUB_TOKEN='your_github_token_here'"
    echo ""
    echo "Or create a .env file with these variables"
    exit 1
fi

echo "✅ Environment variables found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Setting up local testing..."

# Create a symlink for easier testing
npm link

echo "✅ Setup complete!"
echo ""
echo "🚀 Test commands you can try:"
echo ""
echo "# Test with a real GitHub PR (replace with actual repo/PR):"
echo "readme-bot analyze -r microsoft/vscode -p 200000 --format cli"
echo ""
echo "# Test with your own repository:"
echo "readme-bot analyze -r yourusername/yourrepo -p 123 --format cli --verbose"
echo ""
echo "# Test configuration:"
echo "readme-bot validate"
echo ""
echo "# Create sample config:"
echo "readme-bot init"
echo ""
echo "🎯 Pro tip: Start with a public repository PR to avoid token issues"