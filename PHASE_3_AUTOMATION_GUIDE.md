# 🚀 Phase 3 Automation & Integration Guide

## 📋 Overview

This guide provides comprehensive instructions for using the Phase 3 automation and integration features implemented for CollabCanvas. Phase 3 establishes enterprise-grade automation infrastructure including CI/CD pipelines, monitoring & alerting, incident response, and automated notifications.

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ and Python 3.11+
- Git configured with repository access
- Environment variables configured (see Configuration section)

### Start Monitoring Stack
```bash
# Start the complete monitoring stack
npm run automation:start-monitoring

# Or manually
./scripts/run-phase3-automation.sh start-monitoring
```

### Run Comprehensive Tests
```bash
# Run all Phase 3 automation tests
npm run automation:test

# Or manually
./scripts/run-phase3-automation.sh test
```

### Generate Reports
```bash
# Generate Phase 3 automation report
npm run automation:report

# Or manually
./scripts/run-phase3-automation.sh report
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Notification Channels
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
TEST_NOTIFICATION_EMAIL=team@collabcanvas.com
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/YOUR/WEBHOOK
TEST_WEBHOOK_URL=https://your-webhook-endpoint.com/notify

# PagerDuty Integration
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
PAGERDUTY_ROUTING_KEY=your-pagerduty-routing-key

# Escalation Contacts
ONCALL_ENGINEER=oncall@collabcanvas.com
SENIOR_ENGINEER=senior@collabcanvas.com
ENGINEERING_MANAGER=manager@collabcanvas.com
DIRECTOR=director@collabcanvas.com
CTO=cto@collabcanvas.com

# Database and Services
DATABASE_URL=postgresql://user:password@localhost:5432/collabcanvas
REDIS_URL=redis://localhost:6379

# SMTP Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### GitHub Secrets

Configure the following secrets in your GitHub repository:

- `SLACK_WEBHOOK_URL`
- `PAGERDUTY_INTEGRATION_KEY`
- `TEST_NOTIFICATION_EMAIL`
- `DOCKER_HUB_TOKEN`
- `RAILWAY_TOKEN`
- `VERCEL_TOKEN`

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline is configured in `.github/workflows/ci-cd-pipeline.yml` and includes:

1. **Frontend Tests**: TypeScript compilation, ESLint, unit tests, Playwright tests
2. **Backend Tests**: Python tests, API tests, WebSocket tests, performance tests, security tests
3. **Integration Tests**: E2E tests with Cypress and Playwright
4. **Performance Tests**: Load testing and performance benchmarking
5. **Security Scan**: Vulnerability scanning with Trivy
6. **Build & Deploy**: Docker image building and deployment

### Pipeline Triggers

- **Push to main/develop**: Full pipeline execution
- **Pull Request**: Test execution only
- **Manual Dispatch**: Manual pipeline execution with environment selection

### Deployment Environments

- **Staging**: Automatic deployment on develop branch
- **Production**: Manual approval required for main branch

## 📊 Monitoring & Alerting

### Monitoring Stack

The monitoring stack includes:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and management
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics

### Access URLs

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Alertmanager**: http://localhost:9093

### Key Metrics

- API response times (50th, 95th, 99th percentiles)
- WebSocket connection count and stability
- Database query performance
- System resource usage (CPU, memory, disk)
- Error rates and status codes
- Test execution metrics

### Alert Rules

Critical alerts are configured for:
- High error rates (>10% 5xx errors)
- High response times (>2s 95th percentile)
- WebSocket connection issues
- Database connection problems
- High memory/CPU usage
- Security scan failures

## 🚨 Incident Response

### Incident Severity Levels

- **Critical**: System down, data loss, security breach
- **High**: Major functionality affected, performance degradation
- **Medium**: Minor functionality issues, non-critical bugs
- **Low**: Cosmetic issues, minor improvements

### Incident Response Workflow

1. **Automatic Detection**: Alerts trigger incident creation
2. **Notification**: Team notified via multiple channels
3. **Assignment**: Incident assigned to appropriate team member
4. **Diagnostic**: Automated system diagnostics run
5. **Response Plan**: Pre-defined response plan executed
6. **Resolution**: Incident resolved and documented

### Creating Incidents

```bash
# Create a critical incident
./scripts/incident-response.sh critical "Database connection failure"

# Create a high severity incident
./scripts/incident-response.sh high "API response time degradation"

# Create a medium severity incident
./scripts/incident-response.sh medium "UI rendering issue"

# Create a low severity incident
./scripts/incident-response.sh low "Minor styling issue"
```

## 📞 Escalation Procedures

### Escalation Levels

- **L1**: On-call engineer (15-minute timeout)
- **L2**: Senior engineer (30-minute timeout)
- **L3**: Engineering manager (60-minute timeout)
- **L4**: Director (120-minute timeout)
- **L5**: CTO/Executive (240-minute timeout)

### Escalation Triggers

- No acknowledgment within timeout period
- No resolution within timeout period
- Critical severity incidents (immediate escalation)

### Managing Escalations

```bash
# Create escalation policy
./scripts/escalation-procedures.sh create-policy

# Check escalation health
./scripts/escalation-procedures.sh health-check

# Escalate incident
./scripts/escalation-procedures.sh escalate <incident_id> <current_level> <reason>

# Acknowledge escalation
./scripts/escalation-procedures.sh acknowledge <incident_id> <level> <acknowledged_by>

# Resolve escalation
./scripts/escalation-procedures.sh resolve <incident_id> <level> <resolved_by> <resolution>
```

## 🔄 Rollback Mechanisms

### Automatic Rollback

Rollbacks are automatically triggered when:
- Health checks fail after deployment
- Error rates exceed thresholds
- Performance degrades significantly

### Manual Rollback

```bash
# Execute rollback
./scripts/rollback-deployment.sh

# The script will:
# 1. Create backup of current deployment
# 2. Rollback to previous stable version
# 3. Run post-rollback tests
# 4. Notify team of rollback
# 5. Generate incident report
```

### Rollback Features

- **Version Management**: Automatic backup and version tracking
- **Health Verification**: Post-rollback health checks
- **Test Execution**: Automated smoke tests after rollback
- **Team Notification**: Automatic notification of rollback execution
- **Incident Reporting**: Automatic incident report generation

## 📧 Test Notifications

### Notification Channels

- **Slack**: Rich notifications with test summaries
- **Email**: HTML email reports with attachments
- **Webhook**: Custom webhook integration
- **Microsoft Teams**: Teams channel notifications

### Test Result Processing

```bash
# Process Playwright test results
./scripts/test-notifications.sh process playwright playwright-results.json slack,email

# Process Cypress test results
./scripts/test-notifications.sh process cypress cypress-results.json slack,email

# Process pytest results
./scripts/test-notifications.sh process pytest pytest-results.json slack,email

# Test notification system
./scripts/test-notifications.sh test-notification playwright slack,email
```

### Notification Configuration

```bash
# Create notification configuration
./scripts/test-notifications.sh create-config
```

## 🎯 Available Commands

### NPM Scripts

```bash
# Monitoring
npm run automation:start-monitoring    # Start monitoring stack
npm run automation:stop-monitoring     # Stop monitoring stack
npm run automation:test               # Run Phase 3 tests
npm run automation:report             # Generate reports
npm run automation:all                # Run all automation

# Incident Management
npm run incident:create               # Create incident

# Escalation Management
npm run escalation:create-policy      # Create escalation policy
npm run escalation:health-check       # Check escalation health

# Deployment
npm run rollback:deploy               # Execute rollback

# Notifications
npm run notifications:config          # Create notification config
npm run notifications:test            # Test notifications
```

### Direct Script Execution

```bash
# Phase 3 automation
./scripts/run-phase3-automation.sh [action]

# Incident response
./scripts/incident-response.sh [severity] [description]

# Escalation procedures
./scripts/escalation-procedures.sh [action] [arguments...]

# Rollback deployment
./scripts/rollback-deployment.sh

# Test notifications
./scripts/test-notifications.sh [action] [arguments...]
```

## 📈 Monitoring Dashboards

### Grafana Dashboards

The monitoring stack includes pre-configured dashboards for:

1. **System Overview**: High-level system health and performance
2. **API Performance**: Response times, error rates, throughput
3. **WebSocket Monitoring**: Connection count, stability, latency
4. **Database Performance**: Query times, connection pool, slow queries
5. **System Resources**: CPU, memory, disk usage
6. **Test Execution**: Test results, coverage, performance trends

### Custom Metrics

Application-specific metrics are collected for:
- Canvas operations (create, update, delete)
- Real-time collaboration events
- User authentication and session management
- AI agent performance and usage
- File upload and processing

## 🔍 Troubleshooting

### Common Issues

1. **Monitoring Stack Won't Start**
   - Check Docker and Docker Compose installation
   - Verify port availability (9090, 3001, 9093)
   - Check Docker Compose configuration syntax

2. **Notifications Not Working**
   - Verify webhook URLs and API keys
   - Check network connectivity
   - Validate notification script syntax

3. **Incident Response Issues**
   - Check incident directory permissions
   - Verify escalation contact configuration
   - Ensure jq is installed for JSON processing

4. **Rollback Failures**
   - Check backup directory permissions
   - Verify previous version availability
   - Ensure health check endpoints are accessible

### Debug Commands

```bash
# Check monitoring stack status
docker-compose -f docker-compose.monitoring.yml ps

# View monitoring logs
docker-compose -f docker-compose.monitoring.yml logs

# Test notification channels
./scripts/test-notifications.sh test-notification playwright slack

# Check escalation system health
./scripts/escalation-procedures.sh health-check

# Validate incident response
./scripts/incident-response.sh low "Test incident for debugging"
```

## 📚 Best Practices

### Development Workflow

1. **Always run tests locally** before pushing code
2. **Use meaningful commit messages** for better tracking
3. **Monitor CI/CD pipeline** for failures and performance
4. **Review alert configurations** regularly
5. **Update runbooks** when procedures change

### Incident Management

1. **Acknowledge incidents quickly** to prevent escalation
2. **Follow response plans** for consistent handling
3. **Document all actions** in incident timeline
4. **Conduct post-incident reviews** for improvements
5. **Update procedures** based on lessons learned

### Monitoring

1. **Set appropriate alert thresholds** to avoid noise
2. **Review dashboards regularly** for trends
3. **Monitor resource usage** to prevent issues
4. **Update metrics** as application evolves
5. **Test alerting** periodically

## 🚀 Next Steps

Phase 3 automation is now complete and ready for production use. Consider:

1. **Configure Production Environment**: Set up production environment variables and secrets
2. **Test Full Workflows**: Execute complete incident response and escalation procedures
3. **Train Team**: Ensure team members understand the automation tools and procedures
4. **Monitor Performance**: Track automation effectiveness and optimize as needed
5. **Plan Phase 4**: Begin planning Phase 4 optimizations and advanced features

## 📞 Support

For issues or questions about Phase 3 automation:

1. Check the troubleshooting section above
2. Review logs in the `logs/` directory
3. Check incident reports in the `incidents/` directory
4. Create an issue in the project repository
5. Contact the development team

---

*This guide covers the complete Phase 3 automation and integration implementation for CollabCanvas.*
