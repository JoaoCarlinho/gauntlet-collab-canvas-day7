#!/bin/bash

# 📧 CollabCanvas Test Notification System
# Automated test result notifications and reporting

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
REPORTS_DIR="$PROJECT_ROOT/test-reports"
LOG_DIR="$PROJECT_ROOT/logs"

# Create directories if they don't exist
mkdir -p "$REPORTS_DIR" "$LOG_DIR"

# Test result statuses
STATUS_PASSED="passed"
STATUS_FAILED="failed"
STATUS_SKIPPED="skipped"
STATUS_ERROR="error"

# Notification channels
CHANNEL_SLACK="slack"
CHANNEL_EMAIL="email"
CHANNEL_WEBHOOK="webhook"
CHANNEL_TEAMS="teams"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/test-notifications.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/test-notifications.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/test-notifications.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/test-notifications.log"
}

# Function to parse test results
parse_test_results() {
    local test_type=$1
    local results_file=$2
    
    log_info "Parsing $test_type test results from: $results_file"
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local skipped_tests=0
    local error_tests=0
    local duration=0
    
    case $test_type in
        "playwright")
            if [ -f "$results_file" ]; then
                # Parse Playwright JSON results
                total_tests=$(jq '.stats.total' "$results_file" 2>/dev/null || echo "0")
                passed_tests=$(jq '.stats.passed' "$results_file" 2>/dev/null || echo "0")
                failed_tests=$(jq '.stats.failed' "$results_file" 2>/dev/null || echo "0")
                skipped_tests=$(jq '.stats.skipped' "$results_file" 2>/dev/null || echo "0")
                duration=$(jq '.stats.duration' "$results_file" 2>/dev/null || echo "0")
            fi
            ;;
        "cypress")
            if [ -f "$results_file" ]; then
                # Parse Cypress JSON results
                total_tests=$(jq '.stats.tests' "$results_file" 2>/dev/null || echo "0")
                passed_tests=$(jq '.stats.passes' "$results_file" 2>/dev/null || echo "0")
                failed_tests=$(jq '.stats.failures' "$results_file" 2>/dev/null || echo "0")
                skipped_tests=$(jq '.stats.pending' "$results_file" 2>/dev/null || echo "0")
                duration=$(jq '.stats.duration' "$results_file" 2>/dev/null || echo "0")
            fi
            ;;
        "pytest")
            if [ -f "$results_file" ]; then
                # Parse pytest JSON results
                total_tests=$(jq '.summary.total' "$results_file" 2>/dev/null || echo "0")
                passed_tests=$(jq '.summary.passed' "$results_file" 2>/dev/null || echo "0")
                failed_tests=$(jq '.summary.failed' "$results_file" 2>/dev/null || echo "0")
                skipped_tests=$(jq '.summary.skipped' "$results_file" 2>/dev/null || echo "0")
                duration=$(jq '.summary.duration' "$results_file" 2>/dev/null || echo "0")
            fi
            ;;
        *)
            log_error "Unsupported test type: $test_type"
            return 1
            ;;
    esac
    
    # Calculate error tests
    error_tests=$((total_tests - passed_tests - failed_tests - skipped_tests))
    
    # Create results summary
    cat > "$REPORTS_DIR/${test_type}_summary.json" << EOF
{
  "test_type": "$test_type",
  "timestamp": "$(date -Iseconds)",
  "total_tests": $total_tests,
  "passed_tests": $passed_tests,
  "failed_tests": $failed_tests,
  "skipped_tests": $skipped_tests,
  "error_tests": $error_tests,
  "duration": $duration,
  "success_rate": $(echo "scale=2; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0"),
  "results_file": "$results_file"
}
EOF

    log_success "Test results parsed: $total_tests total, $passed_tests passed, $failed_tests failed"
    
    # Return results
    echo "$total_tests,$passed_tests,$failed_tests,$skipped_tests,$error_tests,$duration"
}

# Function to generate test report
generate_test_report() {
    local test_type=$1
    local results_summary=$2
    local timestamp=$(date)
    
    IFS=',' read -r total passed failed skipped error duration <<< "$results_summary"
    
    local success_rate=$(echo "scale=2; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    local status=""
    
    if [ "$failed" -eq 0 ] && [ "$error" -eq 0 ]; then
        status="✅ PASSED"
    elif [ "$failed" -gt 0 ] || [ "$error" -gt 0 ]; then
        status="❌ FAILED"
    else
        status="⚠️ PARTIAL"
    fi
    
    local report_file="$REPORTS_DIR/${test_type}_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# CollabCanvas Test Report - $test_type

**Generated:** $timestamp  
**Status:** $status

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | $total |
| Passed | $passed |
| Failed | $failed |
| Skipped | $skipped |
| Errors | $error |
| Success Rate | ${success_rate}% |
| Duration | ${duration}ms |

## Test Results

### ✅ Passed Tests
$passed tests passed successfully

### ❌ Failed Tests
$failed tests failed

### ⚠️ Skipped Tests
$skipped tests were skipped

### 🚨 Error Tests
$error tests encountered errors

## Recommendations

EOF

    if [ "$failed" -gt 0 ] || [ "$error" -gt 0 ]; then
        cat >> "$report_file" << EOF
- **Immediate Action Required**: $failed tests failed and $error tests encountered errors
- Review failed test logs for root cause analysis
- Consider blocking deployment until issues are resolved
- Update test cases if failures are due to test issues
EOF
    else
        cat >> "$report_file" << EOF
- **All tests passed successfully** ✅
- Deployment can proceed
- Continue monitoring for regression issues
EOF
    fi
    
    if [ "$skipped" -gt 0 ]; then
        cat >> "$report_file" << EOF
- Review $skipped skipped tests to ensure they are intentionally skipped
- Consider enabling skipped tests if conditions are met
EOF
    fi
    
    cat >> "$report_file" << EOF

## Next Steps

1. Review this report and take appropriate action
2. If tests failed, investigate and fix issues
3. Re-run tests after fixes are applied
4. Update test documentation if needed

---
*This report was generated automatically by the CollabCanvas test notification system.*
EOF

    log_success "Test report generated: $report_file"
    echo "$report_file"
}

# Function to send Slack notification
send_slack_notification() {
    local test_type=$1
    local results_summary=$2
    local report_file=$3
    
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        log_warning "Slack webhook URL not configured"
        return 1
    fi
    
    IFS=',' read -r total passed failed skipped error duration <<< "$results_summary"
    local success_rate=$(echo "scale=2; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    local color="good"
    local emoji="✅"
    local status="PASSED"
    
    if [ "$failed" -gt 0 ] || [ "$error" -gt 0 ]; then
        color="danger"
        emoji="❌"
        status="FAILED"
    elif [ "$skipped" -gt 0 ]; then
        color="warning"
        emoji="⚠️"
        status="PARTIAL"
    fi
    
    local message="{
        \"attachments\": [
            {
                \"color\": \"$color\",
                \"title\": \"$emoji CollabCanvas $test_type Tests - $status\",
                \"fields\": [
                    {
                        \"title\": \"Total Tests\",
                        \"value\": \"$total\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Passed\",
                        \"value\": \"$passed\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Failed\",
                        \"value\": \"$failed\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Skipped\",
                        \"value\": \"$skipped\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Success Rate\",
                        \"value\": \"${success_rate}%\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Duration\",
                        \"value\": \"${duration}ms\",
                        \"short\": true
                    }
                ],
                \"footer\": \"CollabCanvas Test System\",
                \"ts\": $(date +%s)
            }
        ]
    }"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$message" \
        "$SLACK_WEBHOOK_URL" || {
        log_error "Failed to send Slack notification"
        return 1
    }
    
    log_success "Slack notification sent for $test_type tests"
}

# Function to send email notification
send_email_notification() {
    local test_type=$1
    local results_summary=$2
    local report_file=$3
    
    if [ -z "$TEST_NOTIFICATION_EMAIL" ]; then
        log_warning "Test notification email not configured"
        return 1
    fi
    
    IFS=',' read -r total passed failed skipped error duration <<< "$results_summary"
    local success_rate=$(echo "scale=2; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    local subject=""
    local priority=""
    
    if [ "$failed" -gt 0 ] || [ "$error" -gt 0 ]; then
        subject="❌ FAILED: CollabCanvas $test_type Tests"
        priority="high"
    else
        subject="✅ PASSED: CollabCanvas $test_type Tests"
        priority="normal"
    fi
    
    local email_body="CollabCanvas $test_type Test Results

Test Summary:
- Total Tests: $total
- Passed: $passed
- Failed: $failed
- Skipped: $skipped
- Errors: $error
- Success Rate: ${success_rate}%
- Duration: ${duration}ms

Detailed report is attached.

Generated: $(date)
"
    
    if command -v mail >/dev/null 2>&1; then
        echo "$email_body" | mail -s "$subject" -a "$report_file" "$TEST_NOTIFICATION_EMAIL" || {
            log_error "Failed to send email notification"
            return 1
        }
    else
        log_warning "Mail command not available"
        return 1
    fi
    
    log_success "Email notification sent for $test_type tests"
}

# Function to send webhook notification
send_webhook_notification() {
    local test_type=$1
    local results_summary=$2
    local report_file=$3
    
    if [ -z "$TEST_WEBHOOK_URL" ]; then
        log_warning "Test webhook URL not configured"
        return 1
    fi
    
    IFS=',' read -r total passed failed skipped error duration <<< "$results_summary"
    local success_rate=$(echo "scale=2; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    local payload="{
        \"test_type\": \"$test_type\",
        \"timestamp\": \"$(date -Iseconds)\",
        \"total_tests\": $total,
        \"passed_tests\": $passed,
        \"failed_tests\": $failed,
        \"skipped_tests\": $skipped,
        \"error_tests\": $error,
        \"success_rate\": $success_rate,
        \"duration\": $duration,
        \"status\": \"$([ "$failed" -eq 0 ] && [ "$error" -eq 0 ] && echo "passed" || echo "failed")\",
        \"report_file\": \"$report_file\"
    }"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$TEST_WEBHOOK_URL" || {
        log_error "Failed to send webhook notification"
        return 1
    }
    
    log_success "Webhook notification sent for $test_type tests"
}

# Function to send Teams notification
send_teams_notification() {
    local test_type=$1
    local results_summary=$2
    local report_file=$3
    
    if [ -z "$TEAMS_WEBHOOK_URL" ]; then
        log_warning "Teams webhook URL not configured"
        return 1
    fi
    
    IFS=',' read -r total passed failed skipped error duration <<< "$results_summary"
    local success_rate=$(echo "scale=2; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    local color="00ff00"
    local emoji="✅"
    local status="PASSED"
    
    if [ "$failed" -gt 0 ] || [ "$error" -gt 0 ]; then
        color="ff0000"
        emoji="❌"
        status="FAILED"
    elif [ "$skipped" -gt 0 ]; then
        color="ffaa00"
        emoji="⚠️"
        status="PARTIAL"
    fi
    
    local message="{
        \"@type\": \"MessageCard\",
        \"@context\": \"http://schema.org/extensions\",
        \"themeColor\": \"$color\",
        \"summary\": \"$emoji CollabCanvas $test_type Tests - $status\",
        \"sections\": [
            {
                \"activityTitle\": \"$emoji CollabCanvas $test_type Tests - $status\",
                \"activitySubtitle\": \"Test Results Summary\",
                \"facts\": [
                    {
                        \"name\": \"Total Tests\",
                        \"value\": \"$total\"
                    },
                    {
                        \"name\": \"Passed\",
                        \"value\": \"$passed\"
                    },
                    {
                        \"name\": \"Failed\",
                        \"value\": \"$failed\"
                    },
                    {
                        \"name\": \"Skipped\",
                        \"value\": \"$skipped\"
                    },
                    {
                        \"name\": \"Success Rate\",
                        \"value\": \"${success_rate}%\"
                    },
                    {
                        \"name\": \"Duration\",
                        \"value\": \"${duration}ms\"
                    }
                ],
                \"markdown\": true
            }
        ]
    }"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$message" \
        "$TEAMS_WEBHOOK_URL" || {
        log_error "Failed to send Teams notification"
        return 1
    }
    
    log_success "Teams notification sent for $test_type tests"
}

# Function to send notifications to all configured channels
send_notifications() {
    local test_type=$1
    local results_summary=$2
    local report_file=$3
    local channels=$4
    
    log_info "Sending notifications for $test_type tests to channels: $channels"
    
    IFS=',' read -ra CHANNEL_ARRAY <<< "$channels"
    
    for channel in "${CHANNEL_ARRAY[@]}"; do
        case $channel in
            "$CHANNEL_SLACK")
                send_slack_notification "$test_type" "$results_summary" "$report_file"
                ;;
            "$CHANNEL_EMAIL")
                send_email_notification "$test_type" "$results_summary" "$report_file"
                ;;
            "$CHANNEL_WEBHOOK")
                send_webhook_notification "$test_type" "$results_summary" "$report_file"
                ;;
            "$CHANNEL_TEAMS")
                send_teams_notification "$test_type" "$results_summary" "$report_file"
                ;;
            *)
                log_warning "Unknown notification channel: $channel"
                ;;
        esac
    done
}

# Function to process test results and send notifications
process_test_results() {
    local test_type=$1
    local results_file=$2
    local channels=$3
    
    log_info "Processing $test_type test results..."
    
    # Parse test results
    local results_summary=$(parse_test_results "$test_type" "$results_file")
    
    if [ -z "$results_summary" ]; then
        log_error "Failed to parse test results"
        return 1
    fi
    
    # Generate test report
    local report_file=$(generate_test_report "$test_type" "$results_summary")
    
    # Send notifications
    if [ -n "$channels" ]; then
        send_notifications "$test_type" "$results_summary" "$report_file" "$channels"
    else
        # Send to default channels
        send_notifications "$test_type" "$results_summary" "$report_file" "slack,email"
    fi
    
    log_success "Test results processed and notifications sent for $test_type"
}

# Function to create notification configuration
create_notification_config() {
    local config_file="$PROJECT_ROOT/test-notification-config.json"
    
    cat > "$config_file" << EOF
{
  "notification_config": {
    "channels": {
      "slack": {
        "enabled": true,
        "webhook_url": "\${SLACK_WEBHOOK_URL}",
        "channel": "#test-results"
      },
      "email": {
        "enabled": true,
        "recipients": ["\${TEST_NOTIFICATION_EMAIL}"],
        "smtp_server": "\${SMTP_SERVER}",
        "smtp_port": "\${SMTP_PORT}"
      },
      "webhook": {
        "enabled": false,
        "url": "\${TEST_WEBHOOK_URL}",
        "headers": {
          "Authorization": "Bearer \${WEBHOOK_TOKEN}"
        }
      },
      "teams": {
        "enabled": false,
        "webhook_url": "\${TEAMS_WEBHOOK_URL}",
        "channel": "Test Results"
      }
    },
    "test_types": {
      "playwright": {
        "enabled": true,
        "channels": ["slack", "email"],
        "thresholds": {
          "success_rate": 95,
          "max_failures": 0
        }
      },
      "cypress": {
        "enabled": true,
        "channels": ["slack", "email"],
        "thresholds": {
          "success_rate": 95,
          "max_failures": 0
        }
      },
      "pytest": {
        "enabled": true,
        "channels": ["slack", "email"],
        "thresholds": {
          "success_rate": 95,
          "max_failures": 0
        }
      }
    },
    "escalation": {
      "enabled": true,
      "failure_threshold": 5,
      "escalation_channels": ["slack", "email"],
      "escalation_recipients": ["\${ESCALATION_EMAIL}"]
    },
    "created_at": "$(date -Iseconds)",
    "updated_at": "$(date -Iseconds)"
  }
}
EOF

    log_success "Notification configuration created: $config_file"
}

# Main function
main() {
    local action=$1
    local test_type=$2
    local results_file=$3
    local channels=$4
    
    log_info "📧 Starting Test Notification System"
    log_info "Action: $action"
    log_info "Test Type: $test_type"
    log_info "Results File: $results_file"
    log_info "Channels: $channels"
    
    case $action in
        "process")
            if [ -z "$test_type" ] || [ -z "$results_file" ]; then
                log_error "Usage: $0 process <test_type> <results_file> [channels]"
                exit 1
            fi
            process_test_results "$test_type" "$results_file" "$channels"
            ;;
        "create-config")
            create_notification_config
            ;;
        "test-notification")
            if [ -z "$test_type" ]; then
                log_error "Usage: $0 test-notification <test_type> [channels]"
                exit 1
            fi
            # Create dummy test results for testing
            local dummy_results="10,8,1,1,0,5000"
            local dummy_report=$(generate_test_report "$test_type" "$dummy_results")
            send_notifications "$test_type" "$dummy_results" "$dummy_report" "${channels:-slack,email}"
            ;;
        *)
            log_error "Invalid action: $action"
            log_info "Valid actions: process, create-config, test-notification"
            exit 1
            ;;
    esac
    
    log_success "🎉 Test notification process completed"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <action> [arguments...]"
        echo "Actions:"
        echo "  process <test_type> <results_file> [channels]"
        echo "  create-config"
        echo "  test-notification <test_type> [channels]"
        exit 1
    fi
    
    main "$@"
fi
