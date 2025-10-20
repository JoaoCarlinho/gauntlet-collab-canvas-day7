#!/bin/bash

# Deploy Async AI Implementation to Railway
# This script deploys the Railway-compatible asynchronous AI processing system

echo "🚀 Deploying Async AI Implementation to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

# Check if we're logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Railway CLI is ready"

# Set environment variables for Railway deployment
echo "🔧 Setting up environment variables..."

# Job processing configuration
railway variables set MAX_CONCURRENT_JOBS=3
railway variables set JOB_PROCESSING_INTERVAL=5
railway variables set MAX_JOB_RETRIES=3
railway variables set JOB_CLEANUP_DAYS=7

# Flask configuration
railway variables set FLASK_ENV=production
railway variables set FLASK_DEBUG=False

# CORS configuration (update with your actual frontend URL)
railway variables set CORS_ORIGINS="https://gauntlet-collab-canvas-day7.vercel.app,https://collabcanvas-mvp-day7.vercel.app"

echo "✅ Environment variables configured"

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "1. Monitor the deployment in Railway dashboard"
echo "2. Check the logs for any errors"
echo "3. Test the new async endpoints:"
echo "   - POST /api/ai-agent/create-canvas (returns job_id)"
echo "   - GET /api/ai-agent/job/{job_id}/status"
echo "   - GET /api/ai-agent/job/{job_id}/result"
echo "   - GET /api/ai-agent/health (includes job processor status)"
echo ""
echo "🎯 The new async system provides:"
echo "   - Immediate response with job ID (HTTP 202)"
echo "   - Background job processing"
echo "   - Real-time status updates via polling"
echo "   - Automatic retry with exponential backoff"
echo "   - Job management (cancel, retry, statistics)"
echo "   - Railway-compatible (no Redis required)"
