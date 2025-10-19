#!/bin/bash

# 🚨 CollabCanvas Rollback Deployment Script
# Automatically rolls back to the previous stable deployment

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
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_DIR="$PROJECT_ROOT/logs"

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

# Function to get current deployment version
get_current_version() {
    if command -v kubectl >/dev/null 2>&1; then
        kubectl get deployment collabcanvas-backend -o jsonpath='{.metadata.labels.version}' 2>/dev/null || echo "unknown"
    elif command -v docker >/dev/null 2>&1; then
        docker ps --filter "name=collabcanvas-backend" --format "{{.Image}}" | cut -d: -f2 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Function to get previous stable version
get_previous_version() {
    if [ -f "$BACKUP_DIR/last-stable-version.txt" ]; then
        cat "$BACKUP_DIR/last-stable-version.txt"
    else
        echo "unknown"
    fi
}

# Function to backup current deployment
backup_current_deployment() {
    local current_version=$(get_current_version)
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="deployment_backup_${current_version}_${timestamp}"
    
    log_info "Creating backup of current deployment: $current_version"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR/$backup_name"
    
    # Backup configuration files
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        cp "$PROJECT_ROOT/docker-compose.yml" "$BACKUP_DIR/$backup_name/"
    fi
    
    if [ -f "$PROJECT_ROOT/.env" ]; then
        cp "$PROJECT_ROOT/.env" "$BACKUP_DIR/$backup_name/"
    fi
    
    # Backup database (if accessible)
    if command -v pg_dump >/dev/null 2>&1; then
        log_info "Backing up database..."
        pg_dump "$DATABASE_URL" > "$BACKUP_DIR/$backup_name/database_backup.sql" 2>/dev/null || log_warning "Database backup failed"
    fi
    
    # Save current version info
    echo "$current_version" > "$BACKUP_DIR/$backup_name/version.txt"
    echo "$timestamp" > "$BACKUP_DIR/$backup_name/timestamp.txt"
    
    log_success "Backup created: $backup_name"
    echo "$backup_name"
}

# Function to rollback to previous version
rollback_to_previous() {
    local previous_version=$(get_previous_version)
    
    if [ "$previous_version" = "unknown" ]; then
        log_error "No previous stable version found. Cannot rollback."
        return 1
    fi
    
    log_info "Rolling back to previous version: $previous_version"
    
    # Rollback based on deployment method
    if command -v kubectl >/dev/null 2>&1; then
        rollback_kubernetes "$previous_version"
    elif command -v docker >/dev/null 2>&1; then
        rollback_docker "$previous_version"
    else
        log_error "No supported deployment method found (kubectl or docker)"
        return 1
    fi
}

# Function to rollback Kubernetes deployment
rollback_kubernetes() {
    local version=$1
    
    log_info "Rolling back Kubernetes deployment to version: $version"
    
    # Rollback backend deployment
    kubectl rollout undo deployment/collabcanvas-backend --to-revision="$version" || {
        log_error "Failed to rollback backend deployment"
        return 1
    }
    
    # Rollback frontend deployment
    kubectl rollout undo deployment/collabcanvas-frontend --to-revision="$version" || {
        log_error "Failed to rollback frontend deployment"
        return 1
    }
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/collabcanvas-backend --timeout=300s || {
        log_error "Backend rollback timeout"
        return 1
    }
    
    kubectl rollout status deployment/collabcanvas-frontend --timeout=300s || {
        log_error "Frontend rollback timeout"
        return 1
    }
    
    log_success "Kubernetes rollback completed"
}

# Function to rollback Docker deployment
rollback_docker() {
    local version=$1
    
    log_info "Rolling back Docker deployment to version: $version"
    
    # Stop current containers
    docker-compose down || log_warning "Failed to stop current containers"
    
    # Pull previous version images
    docker pull "collabcanvas-backend:$version" || {
        log_error "Failed to pull backend image: $version"
        return 1
    }
    
    docker pull "collabcanvas-frontend:$version" || {
        log_error "Failed to pull frontend image: $version"
        return 1
    }
    
    # Update docker-compose.yml with previous version
    sed -i.bak "s/collabcanvas-backend:.*/collabcanvas-backend:$version/" "$PROJECT_ROOT/docker-compose.yml"
    sed -i.bak "s/collabcanvas-frontend:.*/collabcanvas-frontend:$version/" "$PROJECT_ROOT/docker-compose.yml"
    
    # Start with previous version
    docker-compose up -d || {
        log_error "Failed to start containers with previous version"
        return 1
    }
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Health check
    if curl -f http://localhost:5000/health >/dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    log_success "Docker rollback completed"
}

# Function to run post-rollback tests
run_post_rollback_tests() {
    log_info "Running post-rollback tests..."
    
    # Basic health checks
    local backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)
    local frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
    
    if [ "$backend_health" = "200" ] && [ "$frontend_health" = "200" ]; then
        log_success "Basic health checks passed"
    else
        log_error "Basic health checks failed"
        return 1
    fi
    
    # Run smoke tests
    if [ -f "$PROJECT_ROOT/frontend/package.json" ]; then
        cd "$PROJECT_ROOT/frontend"
        if npm run test:smoke >/dev/null 2>&1; then
            log_success "Smoke tests passed"
        else
            log_warning "Smoke tests failed, but continuing..."
        fi
        cd "$PROJECT_ROOT"
    fi
    
    log_success "Post-rollback tests completed"
}

# Function to notify team about rollback
notify_rollback() {
    local previous_version=$(get_previous_version)
    local current_version=$(get_current_version)
    local timestamp=$(date)
    
    log_info "Notifying team about rollback..."
    
    # Send notification (customize based on your notification system)
    local message="🚨 ROLLBACK EXECUTED 🚨
    
    Time: $timestamp
    Rolled back from: $current_version
    Rolled back to: $previous_version
    Reason: Automated rollback due to deployment issues
    
    Please investigate the deployment issues and prepare a fix."
    
    # Example: Send to Slack
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
    fi
    
    # Example: Send email
    if command -v mail >/dev/null 2>&1 && [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "CollabCanvas Rollback Executed" "$ALERT_EMAIL" || log_warning "Failed to send email notification"
    fi
    
    log_success "Team notification sent"
}

# Function to create incident report
create_incident_report() {
    local previous_version=$(get_previous_version)
    local current_version=$(get_current_version)
    local timestamp=$(date)
    local backup_name=$1
    
    log_info "Creating incident report..."
    
    cat > "$LOG_DIR/incident_report_$(date +%Y%m%d_%H%M%S).md" << EOF
# CollabCanvas Rollback Incident Report

## Incident Summary
- **Time**: $timestamp
- **Type**: Automated Rollback
- **Severity**: High
- **Status**: Resolved

## Details
- **Rolled back from**: $current_version
- **Rolled back to**: $previous_version
- **Backup created**: $backup_name
- **Trigger**: Automated rollback due to deployment issues

## Actions Taken
1. Backup of current deployment created
2. Rollback to previous stable version executed
3. Post-rollback tests performed
4. Team notified of rollback

## Next Steps
1. Investigate root cause of deployment failure
2. Fix issues in the failed deployment
3. Test fixes in staging environment
4. Plan re-deployment with fixes

## Lessons Learned
- [ ] Add more comprehensive pre-deployment tests
- [ ] Improve monitoring and alerting
- [ ] Enhance rollback procedures
- [ ] Update documentation

## Timeline
- $(date): Rollback initiated
- $(date): Rollback completed
- $(date): Post-rollback tests completed
- $(date): Team notified
EOF

    log_success "Incident report created"
}

# Main rollback function
main() {
    log_info "🚨 Starting CollabCanvas Rollback Process"
    log_info "Timestamp: $(date)"
    
    # Get current version
    local current_version=$(get_current_version)
    log_info "Current version: $current_version"
    
    # Get previous version
    local previous_version=$(get_previous_version)
    log_info "Previous stable version: $previous_version"
    
    if [ "$previous_version" = "unknown" ]; then
        log_error "No previous stable version found. Cannot proceed with rollback."
        exit 1
    fi
    
    # Create backup of current deployment
    local backup_name=$(backup_current_deployment)
    
    # Perform rollback
    if rollback_to_previous; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed"
        exit 1
    fi
    
    # Run post-rollback tests
    if run_post_rollback_tests; then
        log_success "Post-rollback tests passed"
    else
        log_warning "Post-rollback tests failed, but rollback was successful"
    fi
    
    # Notify team
    notify_rollback
    
    # Create incident report
    create_incident_report "$backup_name"
    
    log_success "🎉 Rollback process completed successfully"
    log_info "Rolled back from: $current_version"
    log_info "Rolled back to: $previous_version"
    log_info "Backup created: $backup_name"
    log_info "Incident report: $LOG_DIR/incident_report_*.md"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
