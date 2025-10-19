#!/bin/bash

# 🚨 CollabCanvas Incident Response Script
# Automated incident response and escalation procedures

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
INCIDENT_DIR="$PROJECT_ROOT/incidents"
LOG_DIR="$PROJECT_ROOT/logs"

# Create directories if they don't exist
mkdir -p "$INCIDENT_DIR" "$LOG_DIR"

# Incident severity levels
SEVERITY_CRITICAL="critical"
SEVERITY_HIGH="high"
SEVERITY_MEDIUM="medium"
SEVERITY_LOW="low"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/incident-response.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/incident-response.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/incident-response.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/incident-response.log"
}

log_critical() {
    echo -e "${RED}[CRITICAL]${NC} $1" | tee -a "$LOG_DIR/incident-response.log"
}

# Function to create incident record
create_incident_record() {
    local incident_id=$1
    local severity=$2
    local description=$3
    local timestamp=$(date)
    
    local incident_file="$INCIDENT_DIR/incident_${incident_id}.json"
    
    cat > "$incident_file" << EOF
{
  "incident_id": "$incident_id",
  "severity": "$severity",
  "status": "open",
  "description": "$description",
  "created_at": "$timestamp",
  "updated_at": "$timestamp",
  "assigned_to": "",
  "escalated": false,
  "resolution": "",
  "timeline": [
    {
      "timestamp": "$timestamp",
      "action": "incident_created",
      "description": "Incident created with severity: $severity"
    }
  ]
}
EOF

    log_info "Incident record created: $incident_file"
    echo "$incident_file"
}

# Function to update incident status
update_incident_status() {
    local incident_file=$1
    local status=$2
    local action=$3
    local description=$4
    local timestamp=$(date)
    
    # Update incident status
    jq --arg status "$status" --arg timestamp "$timestamp" \
       '.status = $status | .updated_at = $timestamp' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg action "$action" --arg description "$description" \
       '.timeline += [{"timestamp": $timestamp, "action": $action, "description": $description}]' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    log_info "Incident status updated: $status"
}

# Function to assign incident
assign_incident() {
    local incident_file=$1
    local assignee=$2
    local timestamp=$(date)
    
    jq --arg assignee "$assignee" --arg timestamp "$timestamp" \
       '.assigned_to = $assignee | .updated_at = $timestamp' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg assignee "$assignee" \
       '.timeline += [{"timestamp": $timestamp, "action": "assigned", "description": "Incident assigned to: $assignee"}]' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    log_info "Incident assigned to: $assignee"
}

# Function to escalate incident
escalate_incident() {
    local incident_file=$1
    local reason=$2
    local timestamp=$(date)
    
    jq --argjson escalated true --arg timestamp "$timestamp" \
       '.escalated = $escalated | .updated_at = $timestamp' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg reason "$reason" \
       '.timeline += [{"timestamp": $timestamp, "action": "escalated", "description": "Incident escalated. Reason: $reason"}]' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    log_warning "Incident escalated: $reason"
}

# Function to resolve incident
resolve_incident() {
    local incident_file=$1
    local resolution=$2
    local timestamp=$(date)
    
    jq --arg resolution "$resolution" --arg timestamp "$timestamp" \
       '.resolution = $resolution | .status = "resolved" | .updated_at = $timestamp' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    # Add timeline entry
    jq --arg timestamp "$timestamp" --arg resolution "$resolution" \
       '.timeline += [{"timestamp": $timestamp, "action": "resolved", "description": "Incident resolved: $resolution"}]' \
       "$incident_file" > "$incident_file.tmp" && mv "$incident_file.tmp" "$incident_file"
    
    log_success "Incident resolved: $resolution"
}

# Function to send notifications
send_notification() {
    local severity=$1
    local message=$2
    local incident_id=$3
    
    log_info "Sending notification for incident: $incident_id"
    
    # Critical incidents - immediate notification
    if [ "$severity" = "$SEVERITY_CRITICAL" ]; then
        # Send to on-call team
        if [ -n "$ONCALL_SLACK_WEBHOOK" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🚨 CRITICAL INCIDENT: $message\", \"channel\":\"#oncall\"}" \
                "$ONCALL_SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
        fi
        
        # Send to PagerDuty
        if [ -n "$PAGERDUTY_INTEGRATION_KEY" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"routing_key\":\"$PAGERDUTY_INTEGRATION_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"$message\",\"severity\":\"critical\",\"source\":\"CollabCanvas\"}}" \
                "https://events.pagerduty.com/v2/enqueue" || log_warning "Failed to send PagerDuty notification"
        fi
        
        # Send email to on-call team
        if [ -n "$ONCALL_EMAIL" ]; then
            echo "CRITICAL INCIDENT: $message" | mail -s "🚨 CRITICAL: CollabCanvas Incident $incident_id" "$ONCALL_EMAIL" || log_warning "Failed to send email notification"
        fi
    fi
    
    # High severity incidents
    if [ "$severity" = "$SEVERITY_HIGH" ]; then
        if [ -n "$TEAM_SLACK_WEBHOOK" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"⚠️ HIGH SEVERITY INCIDENT: $message\", \"channel\":\"#alerts\"}" \
                "$TEAM_SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
        fi
    fi
    
    # Medium and low severity incidents
    if [ "$severity" = "$SEVERITY_MEDIUM" ] || [ "$severity" = "$SEVERITY_LOW" ]; then
        if [ -n "$TEAM_SLACK_WEBHOOK" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"📋 INCIDENT: $message\", \"channel\":\"#incidents\"}" \
                "$TEAM_SLACK_WEBHOOK" || log_warning "Failed to send Slack notification"
        fi
    fi
    
    log_success "Notifications sent for incident: $incident_id"
}

# Function to run diagnostic checks
run_diagnostic_checks() {
    local incident_id=$1
    local timestamp=$(date)
    
    log_info "Running diagnostic checks for incident: $incident_id"
    
    local diagnostic_file="$INCIDENT_DIR/diagnostics_${incident_id}.txt"
    
    cat > "$diagnostic_file" << EOF
# CollabCanvas Diagnostic Report
Incident ID: $incident_id
Timestamp: $timestamp

## System Status
EOF

    # Check service health
    echo "### Service Health Checks" >> "$diagnostic_file"
    curl -s http://localhost:5000/health >> "$diagnostic_file" 2>&1 || echo "Backend health check failed" >> "$diagnostic_file"
    echo "" >> "$diagnostic_file"
    
    curl -s http://localhost:3000 >> "$diagnostic_file" 2>&1 || echo "Frontend health check failed" >> "$diagnostic_file"
    echo "" >> "$diagnostic_file"
    
    # Check system resources
    echo "### System Resources" >> "$diagnostic_file"
    if command -v top >/dev/null 2>&1; then
        top -bn1 | head -20 >> "$diagnostic_file"
    fi
    echo "" >> "$diagnostic_file"
    
    # Check disk space
    echo "### Disk Space" >> "$diagnostic_file"
    df -h >> "$diagnostic_file" 2>&1
    echo "" >> "$diagnostic_file"
    
    # Check memory usage
    echo "### Memory Usage" >> "$diagnostic_file"
    if command -v free >/dev/null 2>&1; then
        free -h >> "$diagnostic_file"
    fi
    echo "" >> "$diagnostic_file"
    
    # Check network connectivity
    echo "### Network Connectivity" >> "$diagnostic_file"
    ping -c 3 8.8.8.8 >> "$diagnostic_file" 2>&1 || echo "Network connectivity check failed" >> "$diagnostic_file"
    echo "" >> "$diagnostic_file"
    
    # Check Docker containers (if applicable)
    if command -v docker >/dev/null 2>&1; then
        echo "### Docker Containers" >> "$diagnostic_file"
        docker ps >> "$diagnostic_file" 2>&1
        echo "" >> "$diagnostic_file"
    fi
    
    # Check Kubernetes pods (if applicable)
    if command -v kubectl >/dev/null 2>&1; then
        echo "### Kubernetes Pods" >> "$diagnostic_file"
        kubectl get pods >> "$diagnostic_file" 2>&1
        echo "" >> "$diagnostic_file"
    fi
    
    log_success "Diagnostic checks completed: $diagnostic_file"
    echo "$diagnostic_file"
}

# Function to create incident response plan
create_response_plan() {
    local severity=$1
    local incident_id=$2
    
    log_info "Creating incident response plan for severity: $severity"
    
    local response_plan=""
    
    case $severity in
        "$SEVERITY_CRITICAL")
            response_plan="
1. IMMEDIATE ACTIONS (0-5 minutes):
   - Notify on-call team via PagerDuty
   - Send critical alerts to Slack #oncall
   - Begin incident response procedures
   - Assess impact and scope

2. SHORT-TERM ACTIONS (5-15 minutes):
   - Assign incident to senior engineer
   - Run diagnostic checks
   - Implement immediate mitigation if possible
   - Update stakeholders

3. MEDIUM-TERM ACTIONS (15-60 minutes):
   - Root cause analysis
   - Implement permanent fix
   - Monitor system stability
   - Document findings

4. LONG-TERM ACTIONS (1-24 hours):
   - Post-incident review
   - Update runbooks
   - Implement preventive measures
   - Update monitoring and alerting"
            ;;
        "$SEVERITY_HIGH")
            response_plan="
1. IMMEDIATE ACTIONS (0-15 minutes):
   - Notify team via Slack
   - Assign incident to available engineer
   - Assess impact and scope

2. SHORT-TERM ACTIONS (15-30 minutes):
   - Run diagnostic checks
   - Implement mitigation
   - Update stakeholders

3. MEDIUM-TERM ACTIONS (30-120 minutes):
   - Root cause analysis
   - Implement fix
   - Monitor system stability

4. LONG-TERM ACTIONS (2-48 hours):
   - Post-incident review
   - Update documentation
   - Implement improvements"
            ;;
        "$SEVERITY_MEDIUM")
            response_plan="
1. IMMEDIATE ACTIONS (0-30 minutes):
   - Log incident
   - Assign to team member
   - Assess impact

2. SHORT-TERM ACTIONS (30-60 minutes):
   - Investigate issue
   - Implement fix
   - Monitor resolution

3. LONG-TERM ACTIONS (1-7 days):
   - Document resolution
   - Update procedures
   - Implement preventive measures"
            ;;
        "$SEVERITY_LOW")
            response_plan="
1. IMMEDIATE ACTIONS (0-60 minutes):
   - Log incident
   - Assign to team member

2. SHORT-TERM ACTIONS (1-4 hours):
   - Investigate and resolve
   - Document solution

3. LONG-TERM ACTIONS (1-14 days):
   - Update documentation
   - Implement improvements"
            ;;
    esac
    
    echo "$response_plan"
}

# Function to handle critical incident
handle_critical_incident() {
    local incident_id=$1
    local description=$2
    
    log_critical "Handling CRITICAL incident: $incident_id"
    
    # Create incident record
    local incident_file=$(create_incident_record "$incident_id" "$SEVERITY_CRITICAL" "$description")
    
    # Send immediate notifications
    send_notification "$SEVERITY_CRITICAL" "$description" "$incident_id"
    
    # Run diagnostic checks
    local diagnostic_file=$(run_diagnostic_checks "$incident_id")
    
    # Create response plan
    local response_plan=$(create_response_plan "$SEVERITY_CRITICAL" "$incident_id")
    
    # Save response plan
    echo "$response_plan" > "$INCIDENT_DIR/response_plan_${incident_id}.txt"
    
    # Assign to on-call engineer
    assign_incident "$incident_file" "oncall-engineer"
    
    # Update status
    update_incident_status "$incident_file" "investigating" "critical_response_initiated" "Critical incident response initiated"
    
    log_critical "Critical incident response initiated for: $incident_id"
    log_info "Incident file: $incident_file"
    log_info "Diagnostic file: $diagnostic_file"
    log_info "Response plan: $INCIDENT_DIR/response_plan_${incident_id}.txt"
}

# Function to handle high severity incident
handle_high_incident() {
    local incident_id=$1
    local description=$2
    
    log_warning "Handling HIGH severity incident: $incident_id"
    
    # Create incident record
    local incident_file=$(create_incident_record "$incident_id" "$SEVERITY_HIGH" "$description")
    
    # Send notifications
    send_notification "$SEVERITY_HIGH" "$description" "$incident_id"
    
    # Run diagnostic checks
    local diagnostic_file=$(run_diagnostic_checks "$incident_id")
    
    # Create response plan
    local response_plan=$(create_response_plan "$SEVERITY_HIGH" "$incident_id")
    
    # Save response plan
    echo "$response_plan" > "$INCIDENT_DIR/response_plan_${incident_id}.txt"
    
    # Assign to available engineer
    assign_incident "$incident_file" "senior-engineer"
    
    # Update status
    update_incident_status "$incident_file" "investigating" "high_response_initiated" "High severity incident response initiated"
    
    log_warning "High severity incident response initiated for: $incident_id"
}

# Function to handle medium severity incident
handle_medium_incident() {
    local incident_id=$1
    local description=$2
    
    log_info "Handling MEDIUM severity incident: $incident_id"
    
    # Create incident record
    local incident_file=$(create_incident_record "$incident_id" "$SEVERITY_MEDIUM" "$description")
    
    # Send notifications
    send_notification "$SEVERITY_MEDIUM" "$description" "$incident_id"
    
    # Assign to team member
    assign_incident "$incident_file" "team-member"
    
    # Update status
    update_incident_status "$incident_file" "investigating" "medium_response_initiated" "Medium severity incident response initiated"
    
    log_info "Medium severity incident response initiated for: $incident_id"
}

# Function to handle low severity incident
handle_low_incident() {
    local incident_id=$1
    local description=$2
    
    log_info "Handling LOW severity incident: $incident_id"
    
    # Create incident record
    local incident_file=$(create_incident_record "$incident_id" "$SEVERITY_LOW" "$description")
    
    # Send notifications
    send_notification "$SEVERITY_LOW" "$description" "$incident_id"
    
    # Assign to team member
    assign_incident "$incident_file" "team-member"
    
    # Update status
    update_incident_status "$incident_file" "investigating" "low_response_initiated" "Low severity incident response initiated"
    
    log_info "Low severity incident response initiated for: $incident_id"
}

# Main incident response function
main() {
    local severity=$1
    local description=$2
    local incident_id=$(date +"%Y%m%d_%H%M%S")_$(echo "$description" | tr ' ' '_' | tr -cd '[:alnum:]_')
    
    log_info "🚨 Starting Incident Response Process"
    log_info "Incident ID: $incident_id"
    log_info "Severity: $severity"
    log_info "Description: $description"
    
    case $severity in
        "$SEVERITY_CRITICAL")
            handle_critical_incident "$incident_id" "$description"
            ;;
        "$SEVERITY_HIGH")
            handle_high_incident "$incident_id" "$description"
            ;;
        "$SEVERITY_MEDIUM")
            handle_medium_incident "$incident_id" "$description"
            ;;
        "$SEVERITY_LOW")
            handle_low_incident "$incident_id" "$description"
            ;;
        *)
            log_error "Invalid severity level: $severity"
            log_info "Valid levels: $SEVERITY_CRITICAL, $SEVERITY_HIGH, $SEVERITY_MEDIUM, $SEVERITY_LOW"
            exit 1
            ;;
    esac
    
    log_success "🎉 Incident response process completed"
    log_info "Incident ID: $incident_id"
    log_info "Check incident files in: $INCIDENT_DIR"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    if [ $# -lt 2 ]; then
        echo "Usage: $0 <severity> <description>"
        echo "Severity levels: critical, high, medium, low"
        echo "Example: $0 critical 'Database connection failure'"
        exit 1
    fi
    
    main "$1" "$2"
fi
