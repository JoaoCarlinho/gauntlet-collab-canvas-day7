#!/bin/bash

# Security Test Runner Script
# Executes comprehensive security testing suite and generates reports

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
REPORTS_DIR="$PROJECT_ROOT/security-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Initialize test report
REPORT_FILE="$REPORTS_DIR/security_test_report_$TIMESTAMP.md"
cat > "$REPORT_FILE" << EOF
# Security Test Report

**Generated:** $(date)
**Timestamp:** $TIMESTAMP

## Test Summary

| Test Category | Total | Passed | Failed | Skipped |
|---------------|-------|--------|--------|---------|
EOF

# Function to run backend security tests
run_backend_security_tests() {
    log_step "🔒 Running Backend Security Tests"
    
    cd "$BACKEND_DIR"
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
        log_info "Activated virtual environment"
    fi
    
    # Install test dependencies
    log_info "Installing test dependencies..."
    pip install -r requirements_test.txt 2>/dev/null || pip install pytest pytest-cov pytest-html
    
    # Run security tests
    log_info "Running security test suite..."
    if python -m pytest tests/test_security.py -v --html="$REPORTS_DIR/backend_security_tests_$TIMESTAMP.html" --self-contained-html; then
        log_success "Backend security tests passed"
        ((PASSED_TESTS++))
    else
        log_error "Backend security tests failed"
        ((FAILED_TESTS++))
    fi
    
    # Run penetration tests
    log_info "Running penetration test suite..."
    if python -m pytest tests/test_penetration.py -v --html="$REPORTS_DIR/backend_penetration_tests_$TIMESTAMP.html" --self-contained-html; then
        log_success "Backend penetration tests passed"
        ((PASSED_TESTS++))
    else
        log_error "Backend penetration tests failed"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS += 2))
}

# Function to run frontend security tests
run_frontend_security_tests() {
    log_step "🎭 Running Frontend Security Tests"
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Run security tests
    log_info "Running frontend security tests..."
    if npx cypress run --spec 'cypress/e2e/security-testing.cy.ts' --config-file cypress.config.auth.ts --headless; then
        log_success "Frontend security tests passed"
        ((PASSED_TESTS++))
    else
        log_error "Frontend security tests failed"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
}

# Function to run dependency security scan
run_dependency_security_scan() {
    log_step "🔍 Running Dependency Security Scan"
    
    # Backend dependency scan
    cd "$BACKEND_DIR"
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    log_info "Scanning backend dependencies..."
    if command -v safety &> /dev/null; then
        if safety check --json > "$REPORTS_DIR/backend_dependency_scan_$TIMESTAMP.json" 2>/dev/null; then
            log_success "Backend dependency scan completed"
            ((PASSED_TESTS++))
        else
            log_warning "Backend dependency scan found vulnerabilities"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "Safety not installed, skipping backend dependency scan"
        ((SKIPPED_TESTS++))
    fi
    
    # Frontend dependency scan
    cd "$FRONTEND_DIR"
    log_info "Scanning frontend dependencies..."
    if command -v npm audit &> /dev/null; then
        if npm audit --json > "$REPORTS_DIR/frontend_dependency_scan_$TIMESTAMP.json" 2>/dev/null; then
            log_success "Frontend dependency scan completed"
            ((PASSED_TESTS++))
        else
            log_warning "Frontend dependency scan found vulnerabilities"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "npm audit not available, skipping frontend dependency scan"
        ((SKIPPED_TESTS++))
    fi
    
    ((TOTAL_TESTS += 2))
}

# Function to run static code analysis
run_static_code_analysis() {
    log_step "📊 Running Static Code Analysis"
    
    # Backend static analysis
    cd "$BACKEND_DIR"
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    log_info "Running backend static analysis..."
    if command -v bandit &> /dev/null; then
        if bandit -r app/ -f json -o "$REPORTS_DIR/backend_static_analysis_$TIMESTAMP.json" 2>/dev/null; then
            log_success "Backend static analysis completed"
            ((PASSED_TESTS++))
        else
            log_warning "Backend static analysis found issues"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "Bandit not installed, skipping backend static analysis"
        ((SKIPPED_TESTS++))
    fi
    
    # Frontend static analysis
    cd "$FRONTEND_DIR"
    log_info "Running frontend static analysis..."
    if command -v eslint &> /dev/null; then
        if npx eslint src/ --format json --output-file "$REPORTS_DIR/frontend_static_analysis_$TIMESTAMP.json" 2>/dev/null; then
            log_success "Frontend static analysis completed"
            ((PASSED_TESTS++))
        else
            log_warning "Frontend static analysis found issues"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "ESLint not available, skipping frontend static analysis"
        ((SKIPPED_TESTS++))
    fi
    
    ((TOTAL_TESTS += 2))
}

# Function to run security headers test
run_security_headers_test() {
    log_step "🛡️ Testing Security Headers"
    
    # Test security headers
    log_info "Testing security headers..."
    
    # Start the application in background
    cd "$BACKEND_DIR"
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    # Start Flask app in background
    python run_local.py &
    APP_PID=$!
    
    # Wait for app to start
    sleep 5
    
    # Test security headers
    if command -v curl &> /dev/null; then
        HEADERS_OUTPUT="$REPORTS_DIR/security_headers_$TIMESTAMP.txt"
        curl -I http://localhost:5000/api/health > "$HEADERS_OUTPUT" 2>/dev/null
        
        # Check for required security headers
        REQUIRED_HEADERS=("X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection" "Strict-Transport-Security")
        MISSING_HEADERS=()
        
        for header in "${REQUIRED_HEADERS[@]}"; do
            if ! grep -q "$header" "$HEADERS_OUTPUT"; then
                MISSING_HEADERS+=("$header")
            fi
        done
        
        if [ ${#MISSING_HEADERS[@]} -eq 0 ]; then
            log_success "All required security headers present"
            ((PASSED_TESTS++))
        else
            log_warning "Missing security headers: ${MISSING_HEADERS[*]}"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "curl not available, skipping security headers test"
        ((SKIPPED_TESTS++))
    fi
    
    # Stop the application
    kill $APP_PID 2>/dev/null || true
    
    ((TOTAL_TESTS++))
}

# Function to run OWASP ZAP scan (if available)
run_owasp_zap_scan() {
    log_step "🕷️ Running OWASP ZAP Scan"
    
    if command -v zap.sh &> /dev/null; then
        log_info "Running OWASP ZAP scan..."
        
        # Start ZAP in daemon mode
        zap.sh -daemon -port 8090 &
        ZAP_PID=$!
        
        # Wait for ZAP to start
        sleep 10
        
        # Run spider scan
        if curl -s "http://localhost:8090/JSON/spider/action/scan/?url=http://localhost:5000" > /dev/null; then
            log_info "ZAP spider scan started"
            
            # Wait for scan to complete
            sleep 30
            
            # Get scan results
            curl -s "http://localhost:8090/JSON/core/view/alerts/" > "$REPORTS_DIR/owasp_zap_scan_$TIMESTAMP.json"
            
            log_success "OWASP ZAP scan completed"
            ((PASSED_TESTS++))
        else
            log_error "Failed to start OWASP ZAP scan"
            ((FAILED_TESTS++))
        fi
        
        # Stop ZAP
        kill $ZAP_PID 2>/dev/null || true
    else
        log_warning "OWASP ZAP not available, skipping ZAP scan"
        ((SKIPPED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
}

# Function to generate security report
generate_security_report() {
    log_step "📋 Generating Security Report"
    
    # Calculate pass rate
    if [ $TOTAL_TESTS -gt 0 ]; then
        PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    else
        PASS_RATE=0
    fi
    
    # Update report file
    cat >> "$REPORT_FILE" << EOF
| Backend Security | $((TOTAL_TESTS / 2)) | $((PASSED_TESTS / 2)) | $((FAILED_TESTS / 2)) | $((SKIPPED_TESTS / 2)) |
| Frontend Security | 1 | $((PASSED_TESTS % 2)) | $((FAILED_TESTS % 2)) | $((SKIPPED_TESTS % 2)) |
| Dependency Scan | 2 | $((PASSED_TESTS / 2)) | $((FAILED_TESTS / 2)) | $((SKIPPED_TESTS / 2)) |
| Static Analysis | 2 | $((PASSED_TESTS / 2)) | $((FAILED_TESTS / 2)) | $((SKIPPED_TESTS / 2)) |
| Security Headers | 1 | $((PASSED_TESTS % 2)) | $((FAILED_TESTS % 2)) | $((SKIPPED_TESTS % 2)) |
| OWASP ZAP Scan | 1 | $((PASSED_TESTS % 2)) | $((FAILED_TESTS % 2)) | $((SKIPPED_TESTS % 2)) |

## Overall Results

- **Total Tests:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Skipped:** $SKIPPED_TESTS
- **Pass Rate:** $PASS_RATE%

## Test Details

### Backend Security Tests
- **File:** \`tests/test_security.py\`
- **Coverage:** Input validation, XSS prevention, SQL injection protection, rate limiting, authentication security
- **Report:** \`backend_security_tests_$TIMESTAMP.html\`

### Backend Penetration Tests
- **File:** \`tests/test_penetration.py\`
- **Coverage:** SQL injection, XSS, CSRF, directory traversal, command injection, LDAP injection, XPath injection, XXE, SSRF, buffer overflow, integer overflow, race conditions, DoS
- **Report:** \`backend_penetration_tests_$TIMESTAMP.html\`

### Frontend Security Tests
- **File:** \`cypress/e2e/security-testing.cy.ts\`
- **Coverage:** XSS prevention, input validation, authentication security, rate limiting, data sanitization, CSP, session security, network security
- **Screenshots:** Available in \`cypress/screenshots/\`

### Dependency Security Scan
- **Backend:** \`backend_dependency_scan_$TIMESTAMP.json\`
- **Frontend:** \`frontend_dependency_scan_$TIMESTAMP.json\`

### Static Code Analysis
- **Backend:** \`backend_static_analysis_$TIMESTAMP.json\`
- **Frontend:** \`frontend_static_analysis_$TIMESTAMP.json\`

### Security Headers Test
- **Report:** \`security_headers_$TIMESTAMP.txt\`

### OWASP ZAP Scan
- **Report:** \`owasp_zap_scan_$TIMESTAMP.json\`

## Recommendations

EOF

    # Add recommendations based on test results
    if [ $FAILED_TESTS -gt 0 ]; then
        cat >> "$REPORT_FILE" << EOF
### Critical Issues Found
- $FAILED_TESTS test(s) failed
- Review failed tests and implement fixes
- Consider additional security measures

EOF
    fi
    
    if [ $PASS_RATE -lt 80 ]; then
        cat >> "$REPORT_FILE" << EOF
### Security Improvements Needed
- Pass rate is below 80%
- Implement additional security measures
- Consider security training for development team

EOF
    fi
    
    cat >> "$REPORT_FILE" << EOF
### General Recommendations
1. Implement comprehensive input validation
2. Add rate limiting to all endpoints
3. Ensure proper authentication and authorization
4. Regular security audits and penetration testing
5. Keep dependencies updated
6. Implement security monitoring and alerting
7. Follow OWASP Top 10 guidelines

## Next Steps

1. Review all failed tests
2. Implement security fixes
3. Re-run security tests
4. Schedule regular security audits
5. Update security documentation

---
*Report generated by Security Test Runner v1.0*
EOF

    log_success "Security report generated: $REPORT_FILE"
}

# Function to cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Deactivate virtual environment
    if [ -n "$VIRTUAL_ENV" ]; then
        deactivate
    fi
}

# Main execution
main() {
    log_step "🚀 Starting Security Test Suite"
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run all security tests
    run_backend_security_tests
    run_frontend_security_tests
    run_dependency_security_scan
    run_static_code_analysis
    run_security_headers_test
    run_owasp_zap_scan
    
    # Generate final report
    generate_security_report
    
    # Print summary
    log_step "📊 Security Test Summary"
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Failed: $FAILED_TESTS"
    else
        log_info "Failed: $FAILED_TESTS"
    fi
    if [ $SKIPPED_TESTS -gt 0 ]; then
        log_warning "Skipped: $SKIPPED_TESTS"
    else
        log_info "Skipped: $SKIPPED_TESTS"
    fi
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        log_info "Pass Rate: $PASS_RATE%"
        
        if [ $PASS_RATE -ge 80 ]; then
            log_success "Security test suite completed successfully!"
        else
            log_warning "Security test suite completed with issues. Review failed tests."
        fi
    fi
    
    log_info "Detailed report available at: $REPORT_FILE"
}

# Check if running in CI/CD environment
if [ "$CI" = "true" ]; then
    log_info "Running in CI/CD environment"
    # Set environment variables for CI/CD
    export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"
fi

# Run main function
main "$@"
