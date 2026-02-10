#!/bin/bash

# Code Generation Pipeline for HelioJS
# Generates API manifest and Swift wrapper from TypeScript source

set -e

echo "🚀 Starting HelioJS Code Generation Pipeline..."

# Check if we're in the right directory
if [ ! -f "ts/main.ts" ]; then
    echo "❌ Error: ts/main.ts not found. Run this script from the project root."
    exit 1
fi

# Step 1: Generate Translation Table
echo "🌐 Step 1: Generating Translation Table..."
pnpm run generate-translationTable

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate translation table"
    exit 1
fi

# Step 2: Generate API Manifest
echo "📋 Step 2: Generating API Manifest..."
node scripts/codegen/generate-api-manifest.mjs

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate API manifest"
    exit 1
fi

# Step 3: Generate Swift API
echo "🏗️  Step 3: Generating Swift API..."
node scripts/codegen/generate-swift-api.mjs

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Swift API"
    exit 1
fi

# Step 4: Build JavaScript Bundle
echo "📦 Step 4: Building JavaScript Bundle..."
pnpm build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build JavaScript bundle"
    exit 1
fi

# Step 5: Copy to iOS Assets
echo "📱 Step 5: Copying to iOS Assets..."
./scripts/ios/copy-js-bundle.sh

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy bundle to iOS"
    exit 1
fi

echo ""
echo "✅ Code Generation Pipeline Completed Successfully!"
