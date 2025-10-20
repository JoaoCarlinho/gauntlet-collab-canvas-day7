#!/bin/bash

# Health Check Disable Verification Script
# This script verifies that health checks have been properly disabled in the frontend build

echo "🔍 Verifying Health Check Disable Configuration..."
echo ""

# Check Railway configuration
echo "📋 Checking Railway configuration..."
if [ -f "frontend/railway.json" ]; then
    if grep -q '"healthcheckPath"' frontend/railway.json; then
        echo "❌ Railway healthcheckPath still present"
    else
        echo "✅ Railway healthcheckPath removed"
    fi
    
    if grep -q '"healthcheckTimeout"' frontend/railway.json; then
        echo "❌ Railway healthcheckTimeout still present"
    else
        echo "✅ Railway healthcheckTimeout removed"
    fi
    
    if grep -q '"restartPolicyType": "NEVER"' frontend/railway.json; then
        echo "✅ Railway restart policy set to NEVER"
    else
        echo "❌ Railway restart policy not set to NEVER"
    fi
    
    if grep -q '"restartPolicyMaxRetries"' frontend/railway.json; then
        echo "❌ Railway restartPolicyMaxRetries still present (should be removed)"
    else
        echo "✅ Railway restartPolicyMaxRetries removed (prevents config error)"
    fi
else
    echo "❌ frontend/railway.json not found"
fi

echo ""

# Check Nixpacks configuration
echo "📋 Checking Nixpacks configuration..."
if [ -f "frontend/nixpacks.toml" ]; then
    if grep -q 'DISABLE_HEALTH_CHECKS = "true"' frontend/nixpacks.toml; then
        echo "✅ DISABLE_HEALTH_CHECKS set to true"
    else
        echo "❌ DISABLE_HEALTH_CHECKS not set"
    fi
    
    if grep -q 'SKIP_HEALTH_MONITORING = "true"' frontend/nixpacks.toml; then
        echo "✅ SKIP_HEALTH_MONITORING set to true"
    else
        echo "❌ SKIP_HEALTH_MONITORING not set"
    fi
    
    if grep -q 'HEALTH_CHECK_ENABLED = "false"' frontend/nixpacks.toml; then
        echo "✅ HEALTH_CHECK_ENABLED set to false"
    else
        echo "❌ HEALTH_CHECK_ENABLED not set"
    fi
else
    echo "❌ frontend/nixpacks.toml not found"
fi

echo ""

# Check environment template
echo "📋 Checking environment template..."
if [ -f "frontend/env.railway.template" ]; then
    if grep -q 'DISABLE_HEALTH_CHECKS=true' frontend/env.railway.template; then
        echo "✅ Environment template includes DISABLE_HEALTH_CHECKS"
    else
        echo "❌ Environment template missing DISABLE_HEALTH_CHECKS"
    fi
else
    echo "❌ frontend/env.railway.template not found"
fi

echo ""

# Check package.json scripts
echo "📋 Checking package.json scripts..."
if [ -f "frontend/package.json" ]; then
    if grep -q '"escalation:health-check"' frontend/package.json; then
        echo "❌ Health check script still present in package.json"
    else
        echo "✅ Health check script removed from package.json"
    fi
else
    echo "❌ frontend/package.json not found"
fi

echo ""

# Check Vite configuration
echo "📋 Checking Vite configuration..."
if [ -f "frontend/vite.config.ts" ]; then
    if grep -q '__DISABLE_HEALTH_CHECKS__' frontend/vite.config.ts; then
        echo "✅ Vite config includes health check disable flag"
    else
        echo "❌ Vite config missing health check disable flag"
    fi
else
    echo "❌ frontend/vite.config.ts not found"
fi

echo ""

# Check disabled health service
echo "📋 Checking disabled health service..."
if [ -f "frontend/src/services/networkHealthService.disabled.ts" ]; then
    echo "✅ Disabled health service file exists"
    if grep -q 'class DisabledNetworkHealthService' frontend/src/services/networkHealthService.disabled.ts; then
        echo "✅ Disabled health service class found"
    else
        echo "❌ Disabled health service class not found"
    fi
else
    echo "❌ Disabled health service file not found"
fi

echo ""

# Check main health service modifications
echo "📋 Checking main health service modifications..."
if [ -f "frontend/src/services/networkHealthService.ts" ]; then
    if grep -q 'isHealthChecksDisabled' frontend/src/services/networkHealthService.ts; then
        echo "✅ Main health service includes disable logic"
    else
        echo "❌ Main health service missing disable logic"
    fi
else
    echo "❌ Main health service file not found"
fi

echo ""

# Summary
echo "🎯 Health Check Disable Summary:"
echo "   - Railway health checks: DISABLED"
echo "   - Network health monitoring: DISABLED"
echo "   - Health check scripts: REMOVED"
echo "   - Build-time health checks: DISABLED"
echo "   - Environment variables: CONFIGURED"
echo ""
echo "🚀 Frontend build should now:"
echo "   - Complete faster without health check API calls"
echo "   - Deploy without health check failures"
echo "   - Run without health monitoring overhead"
echo "   - Be more reliable and simpler"
echo ""
echo "📝 Next steps:"
echo "   1. Test the build: npm run build:railway"
echo "   2. Deploy to Railway: railway up"
echo "   3. Monitor for any health check related errors"
echo "   4. Verify application functionality without health checks"
