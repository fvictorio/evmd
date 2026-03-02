#!/bin/bash
set -e

# Build all packages
pnpm build

# Create combined dist directory
rm -rf dist
mkdir -p dist/tutorial

# Copy playground to root
cp -r packages/playground/dist/* dist/

# Copy tutorial to /tutorial
cp -r packages/evm-tutorial/dist/* dist/tutorial/

# Deploy using gh-pages
echo "Deploying to GitHub Pages..."
pnpm exec gh-pages -d dist
