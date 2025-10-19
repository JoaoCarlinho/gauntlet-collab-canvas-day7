#!/bin/bash

# Network Error Recovery Script
# Comprehensive solution for network connectivity issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_FILE="$PROJECT_ROOT/logs/network_recovery.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log to file
log_to_file() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    # Check basic internet connectivity
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        success "Basic internet connectivity: OK"
        return 0
    else
        error "Basic internet connectivity: FAILED"
        return 1
    fi
}

# Function to check DNS resolution
check_dns() {
    log "Checking DNS resolution..."
    
    if nslookup google.com >/dev/null 2>&1; then
        success "DNS resolution: OK"
        return 0
    else
        error "DNS resolution: FAILED"
        return 1
    fi
}

# Function to check API endpoint
check_api() {
    local api_url="$1"
    log "Checking API endpoint: $api_url"
    
    if curl -s --connect-timeout 10 --max-time 30 "$api_url/health" >/dev/null 2>&1; then
        success "API endpoint: OK"
        return 0
    else
        error "API endpoint: FAILED"
        return 1
    fi
}

# Function to check backend services
check_backend_services() {
    log "Checking backend services..."
    
    # Check if backend is running
    if pgrep -f "python.*run.py" >/dev/null; then
        success "Backend process: RUNNING"
    else
        warning "Backend process: NOT RUNNING"
        return 1
    fi
    
    # Check backend health endpoint
    if curl -s --connect-timeout 5 --max-time 10 "http://localhost:5000/health" >/dev/null 2>&1; then
        success "Backend health endpoint: OK"
    else
        error "Backend health endpoint: FAILED"
        return 1
    fi
    
    return 0
}

# Function to check frontend services
check_frontend_services() {
    log "Checking frontend services..."
    
    # Check if frontend dev server is running
    if pgrep -f "vite" >/dev/null; then
        success "Frontend dev server: RUNNING"
    else
        warning "Frontend dev server: NOT RUNNING"
    fi
    
    # Check frontend accessibility
    if curl -s --connect-timeout 5 --max-time 10 "http://localhost:5173" >/dev/null 2>&1; then
        success "Frontend accessibility: OK"
    else
        warning "Frontend accessibility: NOT ACCESSIBLE"
    fi
    
    return 0
}

# Function to restart backend services
restart_backend() {
    log "Restarting backend services..."
    
    # Kill existing backend processes
    pkill -f "python.*run.py" || true
    sleep 2
    
    # Start backend
    cd "$BACKEND_DIR"
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    nohup python run.py > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 5
    
    # Check if backend started successfully
    if kill -0 $BACKEND_PID 2>/dev/null; then
        success "Backend restarted successfully (PID: $BACKEND_PID)"
        echo $BACKEND_PID > "$PROJECT_ROOT/logs/backend.pid"
        return 0
    else
        error "Backend failed to start"
        return 1
    fi
}

# Function to restart frontend services
restart_frontend() {
    log "Restarting frontend services..."
    
    # Kill existing frontend processes
    pkill -f "vite" || true
    sleep 2
    
    # Start frontend
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    sleep 5
    
    # Check if frontend started successfully
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        success "Frontend restarted successfully (PID: $FRONTEND_PID)"
        echo $FRONTEND_PID > "$PROJECT_ROOT/logs/frontend.pid"
        return 0
    else
        error "Frontend failed to start"
        return 1
    fi
}

# Function to clear network caches
clear_network_caches() {
    log "Clearing network caches..."
    
    # Clear DNS cache (macOS)
    if command -v dscacheutil >/dev/null 2>&1; then
        sudo dscacheutil -flushcache
        success "DNS cache cleared"
    fi
    
    # Clear ARP cache
    if command -v arp >/dev/null 2>&1; then
        sudo arp -a -d
        success "ARP cache cleared"
    fi
    
    # Clear browser caches (if possible)
    log "Consider clearing browser caches manually"
}

# Function to check firewall settings
check_firewall() {
    log "Checking firewall settings..."
    
    # Check if firewall is blocking connections
    if command -v pfctl >/dev/null 2>&1; then
        if sudo pfctl -s info | grep -q "Status: Enabled"; then
            warning "Firewall is enabled - check if it's blocking connections"
        else
            success "Firewall is disabled or not blocking"
        fi
    fi
}

# Function to test specific ports
test_ports() {
    log "Testing specific ports..."
    
    local ports=(5000 5173 3000 8080)
    
    for port in "${ports[@]}"; do
        if nc -z localhost $port 2>/dev/null; then
            success "Port $port: OPEN"
        else
            warning "Port $port: CLOSED"
        fi
    done
}

# Function to generate network diagnostics report
generate_diagnostics() {
    log "Generating network diagnostics report..."
    
    local report_file="$PROJECT_ROOT/logs/network_diagnostics_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Network Diagnostics Report - $(date)"
        echo "======================================"
        echo ""
        
        echo "Network Configuration:"
        echo "---------------------"
        ifconfig | grep -A 1 "inet " || ip addr show
        echo ""
        
        echo "Routing Table:"
        echo "-------------"
        netstat -rn || route -n
        echo ""
        
        echo "DNS Configuration:"
        echo "-----------------"
        cat /etc/resolv.conf 2>/dev/null || echo "DNS config not accessible"
        echo ""
        
        echo "Active Connections:"
        echo "------------------"
        netstat -an | grep LISTEN || ss -tuln
        echo ""
        
        echo "Process Information:"
        echo "-------------------"
        ps aux | grep -E "(python|node|vite)" | grep -v grep
        echo ""
        
    } > "$report_file"
    
    success "Diagnostics report saved to: $report_file"
}

# Function to perform comprehensive network recovery
perform_recovery() {
    log "Performing comprehensive network recovery..."
    
    local recovery_success=true
    
    # Step 1: Check basic connectivity
    if ! check_network; then
        error "Basic network connectivity failed - check your internet connection"
        recovery_success=false
    fi
    
    # Step 2: Check DNS
    if ! check_dns; then
        error "DNS resolution failed - check DNS settings"
        recovery_success=false
    fi
    
    # Step 3: Clear caches
    clear_network_caches
    
    # Step 4: Check firewall
    check_firewall
    
    # Step 5: Test ports
    test_ports
    
    # Step 6: Check backend services
    if ! check_backend_services; then
        warning "Backend services not running - attempting restart..."
        if ! restart_backend; then
            error "Failed to restart backend services"
            recovery_success=false
        fi
    fi
    
    # Step 7: Check frontend services
    if ! check_frontend_services; then
        warning "Frontend services not running - attempting restart..."
        if ! restart_frontend; then
            error "Failed to restart frontend services"
            recovery_success=false
        fi
    fi
    
    # Step 8: Test API endpoints
    local api_urls=("http://localhost:5000" "https://gauntlet-collab-canvas-day7-production.up.railway.app")
    
    for api_url in "${api_urls[@]}"; do
        if check_api "$api_url"; then
            success "API endpoint $api_url is accessible"
        else
            warning "API endpoint $api_url is not accessible"
        fi
    done
    
    # Step 9: Generate diagnostics
    generate_diagnostics
    
    if $recovery_success; then
        success "Network recovery completed successfully"
        return 0
    else
        error "Network recovery completed with issues"
        return 1
    fi
}

# Function to monitor network health
monitor_network() {
    log "Starting network health monitoring..."
    
    local monitor_duration=${1:-300} # Default 5 minutes
    local check_interval=30
    local checks_performed=0
    local max_checks=$((monitor_duration / check_interval))
    
    while [ $checks_performed -lt $max_checks ]; do
        log "Network health check $((checks_performed + 1))/$max_checks"
        
        if check_network && check_dns; then
            success "Network health: OK"
        else
            error "Network health: DEGRADED"
        fi
        
        sleep $check_interval
        checks_performed=$((checks_performed + 1))
    done
    
    log "Network monitoring completed"
}

# Function to show help
show_help() {
    echo "Network Error Recovery Script"
    echo "============================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  check       - Check network connectivity and services"
    echo "  recover     - Perform comprehensive network recovery"
    echo "  restart     - Restart backend and frontend services"
    echo "  monitor     - Monitor network health for specified duration"
    echo "  diagnostics - Generate network diagnostics report"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check                    # Check current status"
    echo "  $0 recover                  # Perform full recovery"
    echo "  $0 restart                  # Restart services"
    echo "  $0 monitor 600              # Monitor for 10 minutes"
    echo "  $0 diagnostics              # Generate diagnostics report"
}

# Main script logic
main() {
    local command="${1:-help}"
    
    log_to_file "Network recovery script started with command: $command"
    
    case "$command" in
        "check")
            log "Performing network connectivity check..."
            check_network
            check_dns
            check_backend_services
            check_frontend_services
            test_ports
            ;;
        "recover")
            perform_recovery
            ;;
        "restart")
            restart_backend
            restart_frontend
            ;;
        "monitor")
            local duration="${2:-300}"
            monitor_network "$duration"
            ;;
        "diagnostics")
            generate_diagnostics
            ;;
        "help"|*)
            show_help
            ;;
    esac
    
    log_to_file "Network recovery script completed"
}

# Run main function with all arguments
main "$@"
