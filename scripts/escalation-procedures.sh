#!/bin/bash

# 📞 CollabCanvas Escalation Procedures Script
# Automated escalation procedures for incidents and alerts

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
ESCALATION_DIR="$PROJECT_ROOT/escalations"
LOG_DIR="$PROJECT_ROOT/logs"

# Create directories if they don't exist
mkdir -p "$ESCALATION_DIR" "$LOG_DIR"

# Escalation levels
LEVEL_1="L1"  # On-call engineer
LEVEL_2="L2"  # Senior engineer
LEVEL_3="L3"  # Engineering manager
LEVEL_4="L4"  # Director/VP
LEVEL_5="L5"  # CTO/Executive

# Escalation timeouts (in minutes)
TIMEOUT_L1=15
TIMEOUT_L2=30
TIMEOUT_L3=60
TIMEOUT_L4=120
TIMEOUT_L5=240

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/escalation.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/escalation.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/escalation.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/escalation.log"
}

log_critical() {
    echo -e "${RED}[CRITICAL]${NC} $1" | tee -a "$LOG_DIR/escalation.log"
}

# Function to get current on-call engineer
get_oncall_engineer() {
    # This would typically query your on-call system (PagerDuty, OpsGenie, etc.)
    # For now, we'll use environment variables or default values
    
    if [ -n "$ONCALL_ENGINEER" ]; then
        echo "$ONCALL_ENGINEER"
    else
        echo "oncall-engineer@collabcanvas.com"
    fi
}

# Function to get escalation contacts
get_escalation_contacts() {
    local level=$1
    
    case $level in
        "$LEVEL_1")
            echo "$(get_oncall_engineer)"
            ;;
        "$LEVEL_2")
            echo "${SENIOR_ENGINEER:-senior-engineer@collabcanvas.com}"
            ;;
        "$LEVEL_3")
            echo "${ENGINEERING_MANAGER:-engineering-manager@collabcanvas.com}"
            ;;
        "$LEVEL_4")
            echo "${DIRECTOR:-director@collabcanvas.com}"
            ;;
        "$LEVEL_5")
            echo "${CTO:-cto@collabcanvas.com}"
            ;;
        *)
            log_error "Invalid escalation level: $level"
            return 1
            ;;
    esac
}

# Function to create escalation record
create_escalation_record() {
    local incident_id=$1
    local current_level=$2
    local reason=$3
    local timestamp=$(date)
    
    local escalation_file="$ESCALATION_DIR/escalation_${incident_id}_${current_level}.json"
    
    cat > "$escalation_file" << EOF
{
  "incident_id": "$incident_id",
  "escalation_level": "$current_level",
  "reason": "$reason",
  "created_at": "$timestamp",
  "updated_at": "$timestamp",
  "status": "active",
  "escalated_to": "",
  "acknowledged": false,
  "resolved": false,
  "timeline": [
    {
      "timestamp": "$timestamp",
      "action": "escalation_created",
      "description": "Escalation created for level $current_level. Reason: $reason"
    }
  ]
}
EOF

    log_info "Escalation record created: $escalation_file"
    echo "$escalation_file"
}

# Function to send escalation notification
send_escalation_notification() {
    local level=$1
    local incident_id=$2
    local reason=$3
    local contact=$4
    
    log_info "Sending escalation notification to level $level: $contact"
    
    local subject=""
    local message=""
    local channel=""
    
    case $level in
        "$LEVEL_1")
            subject="🚨 L1 ESCALATION: CollabCanvas Incident $incident_id"
            message="L1 Escalation: $reason"
            channel="#oncall"
            ;;
        "$LEVEL_2")
            subject="⚠️ L2 ESCALATION: CollabCanvas Incident $incident_id"
            message="L2 Escalation: $reason"
            channel="#senior-engineers"
            ;;
        "$LEVEL_3")
            subject="📞 L3 ESCALATION: CollabCanvas Incident $incident_id"
            message="L3 Escalation: $reason"
            channel="#engineering-managers"
            ;;
        "$LEVEL_4")
            subject="📢 L4 ESCALATION: CollabCanvas Incident $incident_id"
            message="L4 Escalation: $reason"
            channel="#directors"
            ;;
        "$LEVEL_5")
            subject="🚨 L5 EXECUTIVE ESCALATION: CollabCanvas Incident $incident_id"
            message="L5 Executive Escalation: $reason"
            channel="#executives"
            ;;
    esac
    
    # Send Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\", \"channel\":\"$channel\"}" \
            "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
    fi
    
    # Send email notification
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$contact" || log_warning "Failed to send email notification"
    fi
    
    # Send PagerDuty notification for L1 and L2
    if [ "$level" = "$LEVEL_1" ] || [ "$level" = "$LEVEL_2" ]; then
        if [ -n "$PAGERDUTY_INTEGRATION_KEY" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"routing_key\":\"$PAGERDUTY_INTEGRATION_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"$message\",\"severity\":\"critical\",\"source\":\"CollabCanvas\"}}" \
                "https://events.pagerduty.com/v2/enqueue" || log_warning "Failed to send PagerDuty notification"
        fi
    fi
    
    # Send SMS for L3 and above (if configured)
    if [ "$level" = "$LEVEL_3" ] || [ "$level" = "$LEVEL_4" ] || [ "$level" = "$LEVEL_5" ]; then
        if [ -n "$SMS_SERVICE_URL" ] && [ -n "$SMS_API_KEY" ]; then
            curl -X POST -H "Authorization: Bearer $SMS_API_KEY" \
                -H 'Content-type: application/json' \
                --data "{\"to\":\"$contact\",\"message\":\"$message\"}" \
                "$SMS_SERVICE_URL" || log_warning "Failed to send SMS notification"
        fi
    fi
    
    log_success "Escalation notification sent to level $level"
}

# Function to escalate to next level
escalate_to_level() {
    local incident_id=$1
    local current_level=$2
    local reason=$3
    local timestamp=$(date)
    
    # Determine next level
    local next_level=""
    case $current_level in
        "$LEVEL_1")
            next_level="$LEVEL_2"
            ;;
        "$LEVEL_2")
            next_level="$LEVEL_3"
            ;;
        "$LEVEL_3")
            next_level="$LEVEL_4"
            ;;
        "$LEVEL_4")
            next_level="$LEVEL_5"
            ;;
        "$LEVEL_5")
            log_error "Already at highest escalation level (L5)"
            return 1
            ;;
        *)
            log_error "Invalid current escalation level: $current_level"
            return 1
            ;;
    esac
    
    log_warning "Escalating incident $incident_id from $current_level to $next_level"
    
    # Get contact for next level
    local contact=$(get_escalation_contacts "$next_level")
    
    # Create escalation record
    local escalation_file=$(create_escalation_record "$incident_id" "$next_level" "$reason")
    
    # Send notification
    send_escalation_notification "$next_level" "$incident_id" "$reason" "$contact"
    
    # Update escalation record
    jq --arg contact "$contact" --arg timestamp "$timestamp" \
       '.escalated_to = $contact | .updated_at = $timestamp' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg next_level "$next_level" --arg contact "$contact" \
       '.timeline += [{"timestamp": $timestamp, "action": "escalated", "description": "Escalated to level $next_level, contacted: $contact"}]' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    log_success "Escalated to level $next_level, contacted: $contact"
}

# Function to acknowledge escalation
acknowledge_escalation() {
    local escalation_file=$1
    local acknowledged_by=$2
    local timestamp=$(date)
    
    jq --argjson acknowledged true --arg acknowledged_by "$acknowledged_by" --arg timestamp "$timestamp" \
       '.acknowledged = $acknowledged | .acknowledged_by = $acknowledged_by | .updated_at = $timestamp' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg acknowledged_by "$acknowledged_by" \
       '.timeline += [{"timestamp": $timestamp, "action": "acknowledged", "description": "Escalation acknowledged by: $acknowledged_by"}]' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    log_success "Escalation acknowledged by: $acknowledged_by"
}

# Function to resolve escalation
resolve_escalation() {
    local escalation_file=$1
    local resolved_by=$2
    local resolution=$3
    local timestamp=$(date)
    
    jq --argjson resolved true --arg resolved_by "$resolved_by" --arg resolution "$resolution" --arg timestamp "$timestamp" \
       '.resolved = $resolved | .resolved_by = $resolved_by | .resolution = $resolution | .status = "resolved" | .updated_at = $timestamp' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg resolved_by "$resolved_by" --arg resolution "$resolution" \
       '.timeline += [{"timestamp": $timestamp, "action": "resolved", "description": "Escalation resolved by: $resolved_by. Resolution: $resolution"}]' \
       "$escalation_file" > "$escalation_file.tmp" && mv "$escalation_file.tmp" "$escalation_file"
    
    log_success "Escalation resolved by: $resolved_by"
}

# Function to check escalation timeouts
check_escalation_timeouts() {
    local incident_id=$1
    local current_level=$2
    local escalation_time=$3
    
    local timeout_minutes=0
    case $current_level in
        "$LEVEL_1")
            timeout_minutes=$TIMEOUT_L1
            ;;
        "$LEVEL_2")
            timeout_minutes=$TIMEOUT_L2
            ;;
        "$LEVEL_3")
            timeout_minutes=$TIMEOUT_L3
            ;;
        "$LEVEL_4")
            timeout_minutes=$TIMEOUT_L4
            ;;
        "$LEVEL_5")
            timeout_minutes=$TIMEOUT_L5
            ;;
    esac
    
    local current_time=$(date +%s)
    local escalation_timestamp=$(date -d "$escalation_time" +%s)
    local elapsed_minutes=$(( (current_time - escalation_timestamp) / 60 ))
    
    if [ $elapsed_minutes -ge $timeout_minutes ]; then
        log_warning "Escalation timeout reached for level $current_level ($elapsed_minutes minutes)"
        return 0  # Timeout reached
    else
        log_info "Escalation timeout not reached for level $current_level ($elapsed_minutes/$timeout_minutes minutes)"
        return 1  # Timeout not reached
    fi
}

# Function to handle automatic escalation
handle_automatic_escalation() {
    local incident_id=$1
    local current_level=$2
    local escalation_time=$3
    local reason=$4
    
    log_info "Checking automatic escalation for incident: $incident_id"
    
    if check_escalation_timeouts "$incident_id" "$current_level" "$escalation_time"; then
        log_warning "Automatic escalation triggered for incident: $incident_id"
        escalate_to_level "$incident_id" "$current_level" "$reason"
    else
        log_info "No automatic escalation needed for incident: $incident_id"
    fi
}

# Function to create escalation policy
create_escalation_policy() {
    local policy_file="$ESCALATION_DIR/escalation_policy.json"
    
    cat > "$policy_file" << EOF
{
  "escalation_policy": {
    "name": "CollabCanvas Incident Escalation Policy",
    "description": "Automated escalation procedures for CollabCanvas incidents",
    "levels": [
      {
        "level": "L1",
        "name": "On-call Engineer",
        "timeout_minutes": $TIMEOUT_L1,
        "contacts": ["$(get_oncall_engineer)"],
        "notification_methods": ["slack", "email", "pagerduty"],
        "description": "First line of defense for incident response"
      },
      {
        "level": "L2",
        "name": "Senior Engineer",
        "timeout_minutes": $TIMEOUT_L2,
        "contacts": ["${SENIOR_ENGINEER:-senior-engineer@collabcanvas.com}"],
        "notification_methods": ["slack", "email", "pagerduty"],
        "description": "Senior technical expertise for complex issues"
      },
      {
        "level": "L3",
        "name": "Engineering Manager",
        "timeout_minutes": $TIMEOUT_L3,
        "contacts": ["${ENGINEERING_MANAGER:-engineering-manager@collabcanvas.com}"],
        "notification_methods": ["slack", "email", "sms"],
        "description": "Management oversight and resource coordination"
      },
      {
        "level": "L4",
        "name": "Director",
        "timeout_minutes": $TIMEOUT_L4,
        "contacts": ["${DIRECTOR:-director@collabcanvas.com}"],
        "notification_methods": ["slack", "email", "sms"],
        "description": "Executive oversight for critical incidents"
      },
      {
        "level": "L5",
        "name": "CTO/Executive",
        "timeout_minutes": $TIMEOUT_L5,
        "contacts": ["${CTO:-cto@collabcanvas.com}"],
        "notification_methods": ["slack", "email", "sms", "phone"],
        "description": "Executive leadership for business-critical incidents"
      }
    ],
    "escalation_triggers": [
      {
        "condition": "no_acknowledgment",
        "timeout_minutes": 15,
        "action": "escalate_to_next_level"
      },
      {
        "condition": "no_resolution",
        "timeout_minutes": 60,
        "action": "escalate_to_next_level"
      },
      {
        "condition": "critical_severity",
        "timeout_minutes": 5,
        "action": "immediate_escalation"
      }
    ],
    "created_at": "$(date)",
    "updated_at": "$(date)"
  }
}
EOF

    log_success "Escalation policy created: $policy_file"
}

# Function to run escalation health check
run_escalation_health_check() {
    log_info "Running escalation system health check..."
    
    local health_file="$ESCALATION_DIR/health_check_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$health_file" << EOF
# Escalation System Health Check
Timestamp: $(date)

## Contact Verification
EOF

    # Check if contacts are reachable
    for level in "$LEVEL_1" "$LEVEL_2" "$LEVEL_3" "$LEVEL_4" "$LEVEL_5"; do
        local contact=$(get_escalation_contacts "$level")
        echo "Level $level: $contact" >> "$health_file"
        
        # Test email (if configured)
        if command -v mail >/dev/null 2>&1; then
            echo "Test email to $contact" | mail -s "Escalation System Health Check" "$contact" 2>/dev/null && \
                echo "  ✓ Email test successful" >> "$health_file" || \
                echo "  ✗ Email test failed" >> "$health_file"
        fi
    done
    
    echo "" >> "$health_file"
    echo "## Notification Systems" >> "$health_file"
    
    # Test Slack webhook
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data '{"text":"Escalation system health check"}' \
            "$SLACK_WEBHOOK_URL" >/dev/null && \
            echo "✓ Slack webhook test successful" >> "$health_file" || \
            echo "✗ Slack webhook test failed" >> "$health_file"
    else
        echo "✗ Slack webhook not configured" >> "$health_file"
    fi
    
    # Test PagerDuty integration
    if [ -n "$PAGERDUTY_INTEGRATION_KEY" ]; then
        echo "✓ PagerDuty integration configured" >> "$health_file"
    else
        echo "✗ PagerDuty integration not configured" >> "$health_file"
    fi
    
    log_success "Escalation health check completed: $health_file"
}

# Main escalation function
main() {
    local action=$1
    local incident_id=$2
    local level=$3
    local reason=$4
    
    log_info "📞 Starting Escalation Procedures"
    log_info "Action: $action"
    log_info "Incident ID: $incident_id"
    log_info "Level: $level"
    log_info "Reason: $reason"
    
    case $action in
        "escalate")
            if [ -z "$incident_id" ] || [ -z "$level" ] || [ -z "$reason" ]; then
                log_error "Usage: $0 escalate <incident_id> <level> <reason>"
                exit 1
            fi
            escalate_to_level "$incident_id" "$level" "$reason"
            ;;
        "acknowledge")
            if [ -z "$incident_id" ] || [ -z "$level" ]; then
                log_error "Usage: $0 acknowledge <incident_id> <level> <acknowledged_by>"
                exit 1
            fi
            local escalation_file="$ESCALATION_DIR/escalation_${incident_id}_${level}.json"
            if [ -f "$escalation_file" ]; then
                acknowledge_escalation "$escalation_file" "$4"
            else
                log_error "Escalation file not found: $escalation_file"
                exit 1
            fi
            ;;
        "resolve")
            if [ -z "$incident_id" ] || [ -z "$level" ]; then
                log_error "Usage: $0 resolve <incident_id> <level> <resolved_by> <resolution>"
                exit 1
            fi
            local escalation_file="$ESCALATION_DIR/escalation_${incident_id}_${level}.json"
            if [ -f "$escalation_file" ]; then
                resolve_escalation "$escalation_file" "$4" "$5"
            else
                log_error "Escalation file not found: $escalation_file"
                exit 1
            fi
            ;;
        "check-timeouts")
            if [ -z "$incident_id" ] || [ -z "$level" ] || [ -z "$reason" ]; then
                log_error "Usage: $0 check-timeouts <incident_id> <level> <escalation_time> <reason>"
                exit 1
            fi
            handle_automatic_escalation "$incident_id" "$level" "$4" "$reason"
            ;;
        "create-policy")
            create_escalation_policy
            ;;
        "health-check")
            run_escalation_health_check
            ;;
        *)
            log_error "Invalid action: $action"
            log_info "Valid actions: escalate, acknowledge, resolve, check-timeouts, create-policy, health-check"
            exit 1
            ;;
    esac
    
    log_success "🎉 Escalation procedure completed"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <action> [arguments...]"
        echo "Actions:"
        echo "  escalate <incident_id> <level> <reason>"
        echo "  acknowledge <incident_id> <level> <acknowledged_by>"
        echo "  resolve <incident_id> <level> <resolved_by> <resolution>"
        echo "  check-timeouts <incident_id> <level> <escalation_time> <reason>"
        echo "  create-policy"
        echo "  health-check"
        exit 1
    fi
    
    main "$@"
fi
