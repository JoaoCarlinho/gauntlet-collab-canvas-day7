#!/bin/bash

# Health Check Testing Script
# Tests all health check endpoints to ensure they're working properly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${1:-"http://localhost:5000"}
TIMEOUT=10

echo -e "${BLUE}🔍 Testing Health Check Endpoints${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo -n "Testing $endpoint... "
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$BASE_URL$endpoint" --max-time $TIMEOUT 2>/dev/null); then
        status_code="${response: -3}"
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
            if [ -f /tmp/health_response.json ]; then
                echo "  Response: $(cat /tmp/health_response.json)"
            fi
        else
            echo -e "${RED}❌ FAIL${NC} (Expected HTTP $expected_status, got HTTP $status_code)"
            if [ -f /tmp/health_response.json ]; then
                echo "  Response: $(cat /tmp/health_response.json)"
            fi
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Connection error)"
    fi
    echo ""
}

# Test all health endpoints
echo -e "${YELLOW}Basic Health Checks${NC}"
test_endpoint "/health" 200 "Basic health check"
test_endpoint "/health/" 200 "Basic health check with trailing slash"

echo -e "${YELLOW}Advanced Health Checks${NC}"
test_endpoint "/health/ready" 200 "Readiness check"
test_endpoint "/health/live" 200 "Liveness check"
test_endpoint "/health/startup" 200 "Startup check"

echo -e "${YELLOW}Legacy Health Checks${NC}"
test_endpoint "/api/health" 200 "API health check"

echo -e "${YELLOW}Root Endpoint${NC}"
test_endpoint "/" 200 "Root endpoint"

echo -e "${BLUE}Health check testing completed!${NC}"

# Cleanup
rm -f /tmp/health_response.json
