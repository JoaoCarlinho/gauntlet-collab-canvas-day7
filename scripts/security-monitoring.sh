#!/bin/bash

# Security Monitoring Script
# Monitors security events, alerts, and generates security reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOGS_DIR="$PROJECT_ROOT/logs"
SECURITY_LOGS_DIR="$PROJECT_ROOT/security-logs"
ALERTS_DIR="$PROJECT_ROOT/security-alerts"

# Monitoring thresholds
MAX_FAILED_LOGINS=5
MAX_RATE_LIMIT_HITS=10
MAX_SQL_INJECTION_ATTEMPTS=3
MAX_XSS_ATTEMPTS=5
MAX_SUSPICIOUS_REQUESTS=20

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SECURITY_LOGS_DIR/security-monitor.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SECURITY_LOGS_DIR/security-monitor.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SECURITY_LOGS_DIR/security-monitor.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SECURITY_LOGS_DIR/security-monitor.log"
}

log_alert() {
    echo -e "${RED}[ALERT]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ALERTS_DIR/security-alerts.log"
}

# Create directories
mkdir -p "$SECURITY_LOGS_DIR" "$ALERTS_DIR"

# Function to monitor failed login attempts
monitor_failed_logins() {
    log_info "Monitoring failed login attempts..."
    
    # Check application logs for failed login patterns
    if [ -f "$LOGS_DIR/app.log" ]; then
        failed_logins=$(grep -c "Authentication failed\|Invalid token\|Unauthorized" "$LOGS_DIR/app.log" 2>/dev/null || echo "0")
        
        if [ "$failed_logins" -gt "$MAX_FAILED_LOGINS" ]; then
            log_alert "High number of failed login attempts detected: $failed_logins"
            generate_alert "failed_logins" "High number of failed login attempts: $failed_logins"
        else
            log_success "Failed login attempts within normal range: $failed_logins"
        fi
    else
        log_warning "Application log file not found: $LOGS_DIR/app.log"
    fi
}

# Function to monitor rate limiting
monitor_rate_limiting() {
    log_info "Monitoring rate limiting..."
    
    # Check for rate limit hits
    if [ -f "$LOGS_DIR/app.log" ]; then
        rate_limit_hits=$(grep -c "Rate limit exceeded\|429" "$LOGS_DIR/app.log" 2>/dev/null || echo "0")
        
        if [ "$rate_limit_hits" -gt "$MAX_RATE_LIMIT_HITS" ]; then
            log_alert "High number of rate limit hits detected: $rate_limit_hits"
            generate_alert "rate_limiting" "High number of rate limit hits: $rate_limit_hits"
        else
            log_success "Rate limiting working normally: $rate_limit_hits hits"
        fi
    fi
}

# Function to monitor SQL injection attempts
monitor_sql_injection() {
    log_info "Monitoring SQL injection attempts..."
    
    # Check for SQL injection patterns
    if [ -f "$LOGS_DIR/app.log" ]; then
        sql_injection_attempts=$(grep -c "UNION\|DROP TABLE\|OR 1=1\|'; DROP" "$LOGS_DIR/app.log" 2>/dev/null || echo "0")
        
        if [ "$sql_injection_attempts" -gt "$MAX_SQL_INJECTION_ATTEMPTS" ]; then
            log_alert "SQL injection attempts detected: $sql_injection_attempts"
            generate_alert "sql_injection" "SQL injection attempts detected: $sql_injection_attempts"
        else
            log_success "No significant SQL injection attempts: $sql_injection_attempts"
        fi
    fi
}

# Function to monitor XSS attempts
monitor_xss_attempts() {
    log_info "Monitoring XSS attempts..."
    
    # Check for XSS patterns
    if [ -f "$LOGS_DIR/app.log" ]; then
        xss_attempts=$(grep -c "<script>\|<img.*onerror\|javascript:" "$LOGS_DIR/app.log" 2>/dev/null || echo "0")
        
        if [ "$xss_attempts" -gt "$MAX_XSS_ATTEMPTS" ]; then
            log_alert "XSS attempts detected: $xss_attempts"
            generate_alert "xss_attempts" "XSS attempts detected: $xss_attempts"
        else
            log_success "No significant XSS attempts: $xss_attempts"
        fi
    fi
}

# Function to monitor suspicious requests
monitor_suspicious_requests() {
    log_info "Monitoring suspicious requests..."
    
    # Check for suspicious patterns
    if [ -f "$LOGS_DIR/app.log" ]; then
        suspicious_requests=$(grep -c "\.\.\/\|\.\.\\\\\|cmd\.exe\|/bin/sh\|eval(" "$LOGS_DIR/app.log" 2>/dev/null || echo "0")
        
        if [ "$suspicious_requests" -gt "$MAX_SUSPICIOUS_REQUESTS" ]; then
            log_alert "Suspicious requests detected: $suspicious_requests"
            generate_alert "suspicious_requests" "Suspicious requests detected: $suspicious_requests"
        else
            log_success "No significant suspicious requests: $suspicious_requests"
        fi
    fi
}

# Function to monitor system resources
monitor_system_resources() {
    log_info "Monitoring system resources..."
    
    # Check CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        log_warning "High CPU usage detected: ${cpu_usage}%"
    fi
    
    # Check memory usage
    memory_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        log_warning "High memory usage detected: ${memory_usage}%"
    fi
    
    # Check disk usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
    if [ "$disk_usage" -gt 80 ]; then
        log_warning "High disk usage detected: ${disk_usage}%"
    fi
}

# Function to monitor network connections
monitor_network_connections() {
    log_info "Monitoring network connections..."
    
    # Check for unusual network connections
    unusual_connections=$(netstat -an | grep -c ":80\|:443\|:22\|:21" 2>/dev/null || echo "0")
    
    if [ "$unusual_connections" -gt 100 ]; then
        log_warning "Unusual number of network connections: $unusual_connections"
    else
        log_success "Network connections within normal range: $unusual_connections"
    fi
}

# Function to generate security alert
generate_alert() {
    local alert_type="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$ALERTS_DIR/alert_${alert_type}_$(date +%Y%m%d_%H%M%S).json" << EOF
{
    "timestamp": "$timestamp",
    "alert_type": "$alert_type",
    "message": "$message",
    "severity": "HIGH",
    "status": "OPEN",
    "acknowledged": false
}
EOF
    
    # Send notification (if configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Security Alert: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    if [ -n "$EMAIL_ALERT_RECIPIENT" ]; then
        echo "Security Alert: $message" | mail -s "Security Alert - $alert_type" "$EMAIL_ALERT_RECIPIENT" 2>/dev/null || true
    fi
}

# Function to generate security report
generate_security_report() {
    log_info "Generating security report..."
    
    local report_file="$SECURITY_LOGS_DIR/security-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Security Monitoring Report

**Generated:** $(date)
**Period:** Last 24 hours

## Summary

| Metric | Count | Status |
|--------|-------|--------|
| Failed Logins | $(grep -c "Authentication failed\|Invalid token\|Unauthorized" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") | $(if [ $(grep -c "Authentication failed\|Invalid token\|Unauthorized" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") -gt $MAX_FAILED_LOGINS ]; then echo "⚠️ HIGH"; else echo "✅ NORMAL"; fi) |
| Rate Limit Hits | $(grep -c "Rate limit exceeded\|429" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") | $(if [ $(grep -c "Rate limit exceeded\|429" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") -gt $MAX_RATE_LIMIT_HITS ]; then echo "⚠️ HIGH"; else echo "✅ NORMAL"; fi) |
| SQL Injection Attempts | $(grep -c "UNION\|DROP TABLE\|OR 1=1\|'; DROP" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") | $(if [ $(grep -c "UNION\|DROP TABLE\|OR 1=1\|'; DROP" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") -gt $MAX_SQL_INJECTION_ATTEMPTS ]; then echo "🚨 DETECTED"; else echo "✅ NONE"; fi) |
| XSS Attempts | $(grep -c "<script>\|<img.*onerror\|javascript:" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") | $(if [ $(grep -c "<script>\|<img.*onerror\|javascript:" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") -gt $MAX_XSS_ATTEMPTS ]; then echo "🚨 DETECTED"; else echo "✅ NONE"; fi) |
| Suspicious Requests | $(grep -c "\.\.\/\|\.\.\\\\\|cmd\.exe\|/bin/sh\|eval(" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") | $(if [ $(grep -c "\.\.\/\|\.\.\\\\\|cmd\.exe\|/bin/sh\|eval(" "$LOGS_DIR/app.log" 2>/dev/null || echo "0") -gt $MAX_SUSPICIOUS_REQUESTS ]; then echo "⚠️ HIGH"; else echo "✅ NORMAL"; fi) |

## System Resources

- **CPU Usage:** $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%
- **Memory Usage:** $(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')%
- **Disk Usage:** $(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)%

## Recent Alerts

EOF

    # Add recent alerts to report
    if [ -d "$ALERTS_DIR" ]; then
        for alert_file in "$ALERTS_DIR"/alert_*.json; do
            if [ -f "$alert_file" ]; then
                echo "- $(jq -r '.timestamp + ": " + .message' "$alert_file" 2>/dev/null || echo "Alert: $(basename "$alert_file")")" >> "$report_file"
            fi
        done
    fi
    
    cat >> "$report_file" << EOF

## Recommendations

1. Review any alerts marked as HIGH or DETECTED
2. Investigate failed login attempts
3. Monitor rate limiting effectiveness
4. Check for any new attack patterns
5. Update security measures as needed

---
*Report generated by Security Monitoring System v1.0*
EOF

    log_success "Security report generated: $report_file"
}

# Function to cleanup old logs and alerts
cleanup_old_data() {
    log_info "Cleaning up old logs and alerts..."
    
    # Keep only last 30 days of logs
    find "$SECURITY_LOGS_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true
    find "$ALERTS_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Function to check security test status
check_security_tests() {
    log_info "Checking security test status..."
    
    # Check if security tests are passing
    if [ -f "$PROJECT_ROOT/scripts/security-test-runner.sh" ]; then
        cd "$PROJECT_ROOT"
        if ./scripts/security-test-runner.sh > /dev/null 2>&1; then
            log_success "Security tests are passing"
        else
            log_warning "Security tests have issues - check test results"
        fi
    else
        log_warning "Security test runner not found"
    fi
}

# Main monitoring function
main() {
    log_info "Starting security monitoring..."
    
    # Run all monitoring checks
    monitor_failed_logins
    monitor_rate_limiting
    monitor_sql_injection
    monitor_xss_attempts
    monitor_suspicious_requests
    monitor_system_resources
    monitor_network_connections
    check_security_tests
    
    # Generate report
    generate_security_report
    
    # Cleanup old data
    cleanup_old_data
    
    log_success "Security monitoring completed"
}

# Check if running in continuous mode
if [ "$1" = "--continuous" ]; then
    log_info "Running in continuous monitoring mode..."
    while true; do
        main
        sleep 300  # Run every 5 minutes
    done
else
    # Run once
    main
fi
