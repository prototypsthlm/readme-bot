#!/bin/bash

# Script to update the v1 tag for GitHub Action releases
# Usage: ./update-tag.sh [tag-name]

set -e

TAG=${1:-v1}

echo "🏷️  Updating tag: $TAG"

# Check if there are uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Force update the tag to current HEAD
echo "📝 Creating/updating tag $TAG..."
git tag -f "$TAG"

# Push the tag
echo "🚀 Pushing tag $TAG to remote..."
git push origin "$TAG" --force

echo "✅ Tag $TAG updated successfully!"
echo "🔗 Users can now reference: prototypsthlm/readme-bot@$TAG"