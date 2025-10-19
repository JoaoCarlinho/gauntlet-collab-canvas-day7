#!/bin/bash

# ⚡ CollabCanvas Performance Optimizer
# Optimizes test execution speed, parallel processing, and resource consumption

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
OPTIMIZATION_DIR="$PROJECT_ROOT/optimization"
LOG_DIR="$PROJECT_ROOT/logs"

# Create directories if they don't exist
mkdir -p "$OPTIMIZATION_DIR" "$LOG_DIR"

# Performance configuration
MAX_PARALLEL_TESTS=4
MAX_PARALLEL_WORKERS=8
TEST_TIMEOUT=300
MEMORY_LIMIT="2G"
CPU_LIMIT="4"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/performance-optimizer.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/performance-optimizer.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/performance-optimizer.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/performance-optimizer.log"
}

# Function to optimize Playwright configuration
optimize_playwright_config() {
    log_info "Optimizing Playwright configuration for performance..."
    
    local config_file="$FRONTEND_DIR/playwright.config.ts"
    
    # Create optimized Playwright configuration
    cat > "$config_file" << 'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 8,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  globalSetup: require.resolve('./playwright-tests/global-setup.ts'),
  globalTeardown: require.resolve('./playwright-tests/global-teardown.ts'),
  timeout: 300000,
  expect: {
    timeout: 10000,
  },
});
EOF

    log_success "Playwright configuration optimized"
}

# Function to optimize pytest configuration
optimize_pytest_config() {
    log_info "Optimizing pytest configuration for performance..."
    
    local config_file="$BACKEND_DIR/pytest.ini"
    
    # Create optimized pytest configuration
    cat > "$config_file" << 'EOF'
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v 
    --tb=short 
    --strict-markers 
    --cov=app 
    --cov-report=html 
    --cov-report=term-missing
    --cov-report=xml
    --junitxml=test-results/results.xml
    --maxfail=5
    --durations=10
    --cache-clear
    -x
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    api: marks tests as API tests
    websocket: marks tests as WebSocket tests
    performance: marks tests as performance tests
    security: marks tests as security tests
    comprehensive: marks tests as comprehensive test suites
    phase2: marks tests as Phase 2 implementation tests
    phase4: marks tests as Phase 4 optimization tests
    parallel: marks tests as parallel-safe tests
    fast: marks tests as fast tests (run first)
    critical: marks tests as critical tests (run in parallel)
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
    ignore::UserWarning
minversion = 6.0
testmon = true
EOF

    log_success "Pytest configuration optimized"
}

# Function to create parallel test execution script
create_parallel_test_runner() {
    log_info "Creating parallel test execution system..."
    
    local script_file="$OPTIMIZATION_DIR/parallel-test-runner.sh"
    
    cat > "$script_file" << 'EOF'
#!/bin/bash

# Parallel Test Runner for CollabCanvas
# Executes tests in parallel for maximum performance

set -e

# Configuration
MAX_PARALLEL_TESTS=${MAX_PARALLEL_TESTS:-4}
MAX_PARALLEL_WORKERS=${MAX_PARALLEL_WORKERS:-8}
TEST_TIMEOUT=${TEST_TIMEOUT:-300}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run frontend tests in parallel
run_frontend_tests_parallel() {
    log_info "Running frontend tests in parallel..."
    
    local test_suites=(
        "playwright-tests/auth/"
        "playwright-tests/canvas/"
        "playwright-tests/collaboration/"
        "playwright-tests/cross-browser/"
        "playwright-tests/mobile/"
    )
    
    local pids=()
    local results=()
    
    # Start parallel test execution
    for suite in "${test_suites[@]}"; do
        (
            log_info "Starting test suite: $suite"
            cd frontend
            npx playwright test "$suite" --project=chromium --workers=2 --timeout=300000
            echo $? > "/tmp/test_result_${suite//\//_}"
        ) &
        pids+=($!)
        
        # Limit parallel execution
        if [ ${#pids[@]} -ge $MAX_PARALLEL_TESTS ]; then
            wait ${pids[0]}
            pids=("${pids[@]:1}")
        fi
    done
    
    # Wait for all tests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Collect results
    local failed_tests=0
    for suite in "${test_suites[@]}"; do
        local result_file="/tmp/test_result_${suite//\//_}"
        if [ -f "$result_file" ]; then
            local result=$(cat "$result_file")
            if [ "$result" -ne 0 ]; then
                failed_tests=$((failed_tests + 1))
                log_error "Test suite failed: $suite"
            else
                log_success "Test suite passed: $suite"
            fi
            rm -f "$result_file"
        fi
    done
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All frontend tests passed"
        return 0
    else
        log_error "$failed_tests frontend test suites failed"
        return 1
    fi
}

# Function to run backend tests in parallel
run_backend_tests_parallel() {
    log_info "Running backend tests in parallel..."
    
    local test_categories=(
        "unit"
        "api"
        "websocket"
        "performance"
        "security"
    )
    
    local pids=()
    
    # Start parallel test execution
    for category in "${test_categories[@]}"; do
        (
            log_info "Starting backend test category: $category"
            cd backend
            python -m pytest tests/ -m "$category" --workers=2 --timeout=300
            echo $? > "/tmp/backend_test_result_$category"
        ) &
        pids+=($!)
        
        # Limit parallel execution
        if [ ${#pids[@]} -ge $MAX_PARALLEL_TESTS ]; then
            wait ${pids[0]}
            pids=("${pids[@]:1}")
        fi
    done
    
    # Wait for all tests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Collect results
    local failed_tests=0
    for category in "${test_categories[@]}"; do
        local result_file="/tmp/backend_test_result_$category"
        if [ -f "$result_file" ]; then
            local result=$(cat "$result_file")
            if [ "$result" -ne 0 ]; then
                failed_tests=$((failed_tests + 1))
                log_error "Backend test category failed: $category"
            else
                log_success "Backend test category passed: $category"
            fi
            rm -f "$result_file"
        fi
    done
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All backend tests passed"
        return 0
    else
        log_error "$failed_tests backend test categories failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    cd frontend
    npx cypress run --spec 'cypress/e2e/authenticated-object-tests.cy.ts,cypress/e2e/multi-user-collaboration.cy.ts' --config-file cypress.config.auth.ts --headless --parallel --record --key $CYPRESS_RECORD_KEY || {
        log_error "Integration tests failed"
        return 1
    }
    
    log_success "Integration tests passed"
}

# Main execution
main() {
    local test_type=${1:-"all"}
    
    log_info "Starting parallel test execution: $test_type"
    
    case $test_type in
        "frontend")
            run_frontend_tests_parallel
            ;;
        "backend")
            run_backend_tests_parallel
            ;;
        "integration")
            run_integration_tests
            ;;
        "all")
            run_frontend_tests_parallel &
            local frontend_pid=$!
            
            run_backend_tests_parallel &
            local backend_pid=$!
            
            wait $frontend_pid
            local frontend_result=$?
            
            wait $backend_pid
            local backend_result=$?
            
            run_integration_tests
            local integration_result=$?
            
            if [ $frontend_result -eq 0 ] && [ $backend_result -eq 0 ] && [ $integration_result -eq 0 ]; then
                log_success "All tests passed"
                exit 0
            else
                log_error "Some tests failed"
                exit 1
            fi
            ;;
        *)
            log_error "Invalid test type: $test_type"
            exit 1
            ;;
    esac
}

main "$@"
EOF

    chmod +x "$script_file"
    log_success "Parallel test runner created: $script_file"
}

# Function to create test caching system
create_test_caching_system() {
    log_info "Creating test caching system..."
    
    local cache_script="$OPTIMIZATION_DIR/test-cache-manager.sh"
    
    cat > "$cache_script" << 'EOF'
#!/bin/bash

# Test Cache Manager for CollabCanvas
# Manages test result caching for faster execution

set -e

# Configuration
CACHE_DIR="./test-cache"
CACHE_EXPIRY=3600  # 1 hour in seconds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to create cache directory
init_cache() {
    mkdir -p "$CACHE_DIR"
    log_info "Test cache initialized: $CACHE_DIR"
}

# Function to get cache key for test
get_cache_key() {
    local test_file=$1
    local test_hash=$(md5sum "$test_file" | cut -d' ' -f1)
    local deps_hash=""
    
    # Include dependency hashes if available
    if [ -f "package-lock.json" ]; then
        deps_hash=$(md5sum package-lock.json | cut -d' ' -f1)
    fi
    
    echo "${test_hash}_${deps_hash}"
}

# Function to check if test result is cached
is_cached() {
    local test_file=$1
    local cache_key=$(get_cache_key "$test_file")
    local cache_file="$CACHE_DIR/${cache_key}.json"
    
    if [ -f "$cache_file" ]; then
        local cache_time=$(stat -c %Y "$cache_file")
        local current_time=$(date +%s)
        local age=$((current_time - cache_time))
        
        if [ $age -lt $CACHE_EXPIRY ]; then
            return 0  # Cache is valid
        else
            rm -f "$cache_file"
            return 1  # Cache is expired
        fi
    else
        return 1  # No cache
    fi
}

# Function to get cached test result
get_cached_result() {
    local test_file=$1
    local cache_key=$(get_cache_key "$test_file")
    local cache_file="$CACHE_DIR/${cache_key}.json"
    
    if [ -f "$cache_file" ]; then
        cat "$cache_file"
    fi
}

# Function to cache test result
cache_test_result() {
    local test_file=$1
    local result=$2
    local cache_key=$(get_cache_key "$test_file")
    local cache_file="$CACHE_DIR/${cache_key}.json"
    
    cat > "$cache_file" << EOF
{
  "test_file": "$test_file",
  "result": $result,
  "timestamp": $(date +%s),
  "cache_key": "$cache_key"
}
EOF

    log_info "Test result cached: $test_file"
}

# Function to clear cache
clear_cache() {
    rm -rf "$CACHE_DIR"
    log_info "Test cache cleared"
}

# Function to show cache statistics
show_cache_stats() {
    if [ -d "$CACHE_DIR" ]; then
        local cache_count=$(find "$CACHE_DIR" -name "*.json" | wc -l)
        local cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
        log_info "Cache statistics: $cache_count files, $cache_size total size"
    else
        log_info "No cache directory found"
    fi
}

# Main function
main() {
    local action=$1
    local test_file=$2
    local result=$3
    
    case $action in
        "init")
            init_cache
            ;;
        "check")
            if is_cached "$test_file"; then
                echo "cached"
            else
                echo "not_cached"
            fi
            ;;
        "get")
            get_cached_result "$test_file"
            ;;
        "set")
            cache_test_result "$test_file" "$result"
            ;;
        "clear")
            clear_cache
            ;;
        "stats")
            show_cache_stats
            ;;
        *)
            log_error "Invalid action: $action"
            exit 1
            ;;
    esac
}

main "$@"
EOF

    chmod +x "$cache_script"
    log_success "Test cache manager created: $cache_script"
}

# Function to create resource optimization script
create_resource_optimizer() {
    log_info "Creating resource optimization system..."
    
    local optimizer_script="$OPTIMIZATION_DIR/resource-optimizer.sh"
    
    cat > "$optimizer_script" << 'EOF'
#!/bin/bash

# Resource Optimizer for CollabCanvas
# Optimizes resource consumption during test execution

set -e

# Configuration
MEMORY_LIMIT=${MEMORY_LIMIT:-"2G"}
CPU_LIMIT=${CPU_LIMIT:-"4"}
DISK_LIMIT=${DISK_LIMIT:-"10G"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to optimize Docker resources
optimize_docker_resources() {
    log_info "Optimizing Docker resources..."
    
    # Create optimized docker-compose configuration
    cat > "docker-compose.optimized.yml" << EOF
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    deploy:
      resources:
        limits:
          memory: $MEMORY_LIMIT
          cpus: '$CPU_LIMIT'
        reservations:
          memory: 512M
          cpus: '1'
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=1024
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    deploy:
      resources:
        limits:
          memory: $MEMORY_LIMIT
          cpus: '$CPU_LIMIT'
        reservations:
          memory: 512M
          cpus: '1'
    environment:
      - FLASK_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
        reservations:
          memory: 128M
          cpus: '0.25'
    volumes:
      - redis_data:/data

volumes:
  redis_data:
EOF

    log_success "Docker resources optimized"
}

# Function to optimize Node.js performance
optimize_nodejs_performance() {
    log_info "Optimizing Node.js performance..."
    
    # Create optimized package.json scripts
    cat > "frontend/package.optimized.json" << EOF
{
  "scripts": {
    "test:optimized": "NODE_OPTIONS='--max-old-space-size=1024' npm test",
    "build:optimized": "NODE_OPTIONS='--max-old-space-size=1024' npm run build",
    "dev:optimized": "NODE_OPTIONS='--max-old-space-size=512' npm run dev"
  }
}
EOF

    log_success "Node.js performance optimized"
}

# Function to optimize Python performance
optimize_python_performance() {
    log_info "Optimizing Python performance..."
    
    # Create optimized requirements file
    cat > "backend/requirements.optimized.txt" << EOF
# Core dependencies
Flask==2.3.3
Flask-SocketIO==5.3.6
Flask-SQLAlchemy==3.0.5
Flask-CORS==4.0.0
Flask-Limiter==3.5.0

# Database
SQLAlchemy==2.0.21
psycopg2-binary==2.9.7

# Redis
redis==4.6.0

# Testing (optimized)
pytest==7.4.3
pytest-flask==1.3.0
pytest-mock==3.12.0
pytest-cov==4.1.0
pytest-xdist==3.3.1
pytest-cache==1.0

# Performance
gunicorn==21.2.0
gevent==23.7.0
EOF

    log_success "Python performance optimized"
}

# Function to monitor resource usage
monitor_resources() {
    log_info "Monitoring resource usage..."
    
    local monitor_script="resource-monitor.sh"
    
    cat > "$monitor_script" << 'EOF'
#!/bin/bash

# Resource Monitor
while true; do
    echo "=== Resource Usage $(date) ==="
    echo "Memory:"
    free -h
    echo "CPU:"
    top -bn1 | grep "Cpu(s)"
    echo "Disk:"
    df -h
    echo "Docker:"
    docker stats --no-stream
    echo "================================"
    sleep 30
done
EOF

    chmod +x "$monitor_script"
    log_success "Resource monitor created: $monitor_script"
}

# Function to create cleanup script
create_cleanup_script() {
    log_info "Creating cleanup script..."
    
    local cleanup_script="$OPTIMIZATION_DIR/cleanup-resources.sh"
    
    cat > "$cleanup_script" << 'EOF'
#!/bin/bash

# Resource Cleanup Script
# Cleans up temporary files and optimizes system resources

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to clean Docker resources
cleanup_docker() {
    log_info "Cleaning up Docker resources..."
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Docker cleanup completed"
}

# Function to clean temporary files
cleanup_temp_files() {
    log_info "Cleaning up temporary files..."
    
    # Clean test artifacts
    find . -name "*.log" -mtime +7 -delete
    find . -name "test-results" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name "node_modules/.cache" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Clean Python cache
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    
    log_success "Temporary files cleanup completed"
}

# Function to optimize system resources
optimize_system() {
    log_info "Optimizing system resources..."
    
    # Clear system cache (if available)
    if command -v sync >/dev/null 2>&1; then
        sync
    fi
    
    # Clear DNS cache (if available)
    if command -v dscacheutil >/dev/null 2>&1; then
        dscacheutil -flushcache
    fi
    
    log_success "System optimization completed"
}

# Main function
main() {
    log_info "Starting resource cleanup..."
    
    cleanup_docker
    cleanup_temp_files
    optimize_system
    
    log_success "Resource cleanup completed"
}

main "$@"
EOF

    chmod +x "$cleanup_script"
    log_success "Cleanup script created: $cleanup_script"
}

# Function to create performance benchmark
create_performance_benchmark() {
    log_info "Creating performance benchmark system..."
    
    local benchmark_script="$OPTIMIZATION_DIR/performance-benchmark.sh"
    
    cat > "$benchmark_script" << 'EOF'
#!/bin/bash

# Performance Benchmark for CollabCanvas
# Measures and tracks performance improvements

set -e

# Configuration
BENCHMARK_DIR="./benchmarks"
BENCHMARK_RESULTS="$BENCHMARK_DIR/results.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to initialize benchmark
init_benchmark() {
    mkdir -p "$BENCHMARK_DIR"
    
    if [ ! -f "$BENCHMARK_RESULTS" ]; then
        echo '{"benchmarks": []}' > "$BENCHMARK_RESULTS"
    fi
    
    log_info "Benchmark system initialized"
}

# Function to run benchmark
run_benchmark() {
    local test_type=$1
    local start_time=$(date +%s)
    
    log_info "Running benchmark: $test_type"
    
    case $test_type in
        "frontend")
            cd frontend
            time npm test >/dev/null 2>&1
            ;;
        "backend")
            cd backend
            time python -m pytest tests/ >/dev/null 2>&1
            ;;
        "integration")
            cd frontend
            time npx cypress run --headless >/dev/null 2>&1
            ;;
        *)
            log_error "Invalid benchmark type: $test_type"
            return 1
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Record benchmark result
    local result=$(cat "$BENCHMARK_RESULTS")
    local new_result=$(echo "$result" | jq --arg type "$test_type" --arg duration "$duration" --arg timestamp "$(date -Iseconds)" '.benchmarks += [{"type": $type, "duration": ($duration | tonumber), "timestamp": $timestamp}]')
    echo "$new_result" > "$BENCHMARK_RESULTS"
    
    log_success "Benchmark completed: $test_type took ${duration}s"
}

# Function to show benchmark results
show_benchmarks() {
    if [ -f "$BENCHMARK_RESULTS" ]; then
        log_info "Benchmark Results:"
        cat "$BENCHMARK_RESULTS" | jq '.benchmarks[] | "\(.type): \(.duration)s (\(.timestamp))"'
    else
        log_info "No benchmark results found"
    fi
}

# Function to compare benchmarks
compare_benchmarks() {
    log_info "Comparing benchmark results..."
    
    if [ -f "$BENCHMARK_RESULTS" ]; then
        cat "$BENCHMARK_RESULTS" | jq -r '.benchmarks | group_by(.type) | .[] | "\(.[0].type): \(length) runs, avg: \(map(.duration) | add / length | floor)s"'
    else
        log_info "No benchmark results to compare"
    fi
}

# Main function
main() {
    local action=$1
    local test_type=$2
    
    init_benchmark
    
    case $action in
        "run")
            run_benchmark "$test_type"
            ;;
        "show")
            show_benchmarks
            ;;
        "compare")
            compare_benchmarks
            ;;
        *)
            log_error "Invalid action: $action"
            exit 1
            ;;
    esac
}

main "$@"
EOF

    chmod +x "$benchmark_script"
    log_success "Performance benchmark created: $benchmark_script"
}

# Main function
main() {
    local action=${1:-"all"}
    
    log_info "⚡ Starting Performance Optimization"
    log_info "Action: $action"
    log_info "Timestamp: $(date)"
    
    case $action in
        "playwright")
            optimize_playwright_config
            ;;
        "pytest")
            optimize_pytest_config
            ;;
        "parallel")
            create_parallel_test_runner
            ;;
        "cache")
            create_test_caching_system
            ;;
        "resources")
            create_resource_optimizer
            ;;
        "benchmark")
            create_performance_benchmark
            ;;
        "all")
            optimize_playwright_config
            optimize_pytest_config
            create_parallel_test_runner
            create_test_caching_system
            create_resource_optimizer
            create_performance_benchmark
            ;;
        *)
            log_error "Invalid action: $action"
            log_info "Valid actions: playwright, pytest, parallel, cache, resources, benchmark, all"
            exit 1
            ;;
    esac
    
    log_success "🎉 Performance optimization completed"
    log_info "Optimization files created in: $OPTIMIZATION_DIR"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
