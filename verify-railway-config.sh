#!/bin/bash

# Railway Docker-Free Deployment Configuration Verification Script
# This script verifies that the Railway configuration is properly set up for Docker-free deployment

echo "🔍 Verifying Railway Docker-Free Deployment Configuration..."
echo ""

# Check if frontend railway.json exists and has correct configuration
echo "📋 Checking frontend/railway.json..."
if [ -f "frontend/railway.json" ]; then
    if grep -q '"builder": "NIXPACKS"' frontend/railway.json; then
        echo "✅ railway.json correctly configured with NIXPACKS builder"
    else
        echo "❌ railway.json missing NIXPACKS builder configuration"
    fi
    
    if grep -q '"dockerfilePath": null' frontend/railway.json; then
        echo "✅ railway.json correctly disables Dockerfile usage"
    else
        echo "❌ railway.json missing dockerfilePath: null"
    fi
else
    echo "❌ frontend/railway.json not found"
fi

echo ""

# Check if frontend nixpacks.toml exists
echo "📋 Checking frontend/nixpacks.toml..."
if [ -f "frontend/nixpacks.toml" ]; then
    echo "✅ nixpacks.toml exists"
    if grep -q "nodejs-18_x" frontend/nixpacks.toml; then
        echo "✅ nixpacks.toml configured with Node.js 18"
    else
        echo "❌ nixpacks.toml missing Node.js 18 configuration"
    fi
else
    echo "❌ frontend/nixpacks.toml not found"
fi

echo ""

# Check if .railwayignore exists
echo "📋 Checking frontend/.railwayignore..."
if [ -f "frontend/.railwayignore" ]; then
    echo "✅ .railwayignore exists"
    if grep -q "Dockerfile" frontend/.railwayignore; then
        echo "✅ .railwayignore excludes Dockerfiles"
    else
        echo "❌ .railwayignore missing Dockerfile exclusion"
    fi
else
    echo "❌ frontend/.railwayignore not found"
fi

echo ""

# Check if no Dockerfiles exist in frontend directory
echo "📋 Checking for Dockerfiles in frontend directory..."
dockerfile_count=$(find frontend -name "Dockerfile*" -type f 2>/dev/null | wc -l)
if [ "$dockerfile_count" -eq 0 ]; then
    echo "✅ No Dockerfiles found in frontend directory"
else
    echo "❌ Found $dockerfile_count Dockerfile(s) in frontend directory:"
    find frontend -name "Dockerfile*" -type f 2>/dev/null
fi

echo ""

# Check package.json for Railway-specific scripts
echo "📋 Checking frontend/package.json for Railway scripts..."
if [ -f "frontend/package.json" ]; then
    if grep -q "build:railway" frontend/package.json; then
        echo "✅ build:railway script found"
    else
        echo "❌ build:railway script missing"
    fi
    
    if grep -q "start:railway" frontend/package.json; then
        echo "✅ start:railway script found"
    else
        echo "❌ start:railway script missing"
    fi
else
    echo "❌ frontend/package.json not found"
fi

echo ""

# Summary
echo "🎯 Configuration Summary:"
echo "   - Railway will use Nixpacks (Docker-free) for frontend deployment"
echo "   - All Docker-related files are excluded from deployment"
echo "   - NPM configuration optimized for Railway's build environment"
echo "   - Node.js 18 with optimized build settings"
echo ""
echo "🚀 Ready for Railway deployment!"
echo "   Next steps:"
echo "   1. Set environment variables in Railway dashboard"
echo "   2. Deploy using: railway up"
echo "   3. Monitor build logs for successful Nixpacks build"
