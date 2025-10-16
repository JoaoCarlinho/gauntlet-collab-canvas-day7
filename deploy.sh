#!/bin/bash

# 🚀 CollabCanvas MVP Day 7 - Deployment Script
# This script helps with the deployment process

echo "🚀 CollabCanvas MVP Day 7 - Deployment Helper"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "fix_object_drop_delete.md" ]; then
    echo "❌ Error: Please run this script from the repository root directory"
    exit 1
fi

echo "✅ Repository structure verified"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo ""
echo "🔍 Checking deployment prerequisites..."

if command_exists git; then
    echo "✅ Git is installed"
else
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

if command_exists node; then
    echo "✅ Node.js is installed: $(node --version)"
else
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if command_exists python3; then
    echo "✅ Python is installed: $(python3 --version)"
else
    echo "❌ Python is not installed. Please install Python first."
    exit 1
fi

echo ""
echo "📋 Deployment Steps:"
echo "==================="
echo ""
echo "1. 🌐 VERCEL (Frontend) Setup:"
echo "   - Go to https://vercel.com"
echo "   - Click 'New Project'"
echo "   - Import from GitHub: JoaoCarlinho/gauntlet-collab-canvas-day7"
echo "   - Configure:"
echo "     • Framework: Vite"
echo "     • Root Directory: frontend"
echo "     • Build Command: npm run build"
echo "     • Output Directory: dist"
echo ""
echo "2. 🚂 RAILWAY (Backend) Setup:"
echo "   - Go to https://railway.app"
echo "   - Click 'New Project'"
echo "   - Deploy from GitHub: JoaoCarlinho/gauntlet-collab-canvas-day7"
echo "   - Add Services:"
echo "     • PostgreSQL Database"
echo "     • Redis Cache"
echo "   - Configure:"
echo "     • Root Directory: backend"
echo "     • Start Command: python run.py"
echo ""
echo "3. 🔧 Environment Variables:"
echo "   - See DEPLOYMENT_CONFIGURATION.md for detailed setup"
echo "   - Copy env.production.template files and fill in values"
echo ""
echo "4. 🚀 Deploy:"
echo "   git add ."
echo "   git commit -m 'Configure deployment'"
echo "   git push origin master"
echo ""

# Check if deployment files exist
echo "📁 Checking deployment configuration files..."

if [ -f "DEPLOYMENT_CONFIGURATION.md" ]; then
    echo "✅ DEPLOYMENT_CONFIGURATION.md exists"
else
    echo "❌ DEPLOYMENT_CONFIGURATION.md missing"
fi

if [ -f "backend/railway.json" ]; then
    echo "✅ backend/railway.json exists"
else
    echo "❌ backend/railway.json missing"
fi

if [ -f "frontend/vercel.json" ]; then
    echo "✅ frontend/vercel.json exists"
else
    echo "❌ frontend/vercel.json missing"
fi

if [ -f "frontend/env.production.template" ]; then
    echo "✅ frontend/env.production.template exists"
else
    echo "❌ frontend/env.production.template missing"
fi

if [ -f "backend/env.production.template" ]; then
    echo "✅ backend/env.production.template exists"
else
    echo "❌ backend/env.production.template missing"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Follow the Vercel and Railway setup steps above"
echo "2. Configure environment variables in both platforms"
echo "3. Deploy backend first, then frontend"
echo "4. Test the deployment thoroughly"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_CONFIGURATION.md"
echo ""
echo "🚀 Happy deploying!"
