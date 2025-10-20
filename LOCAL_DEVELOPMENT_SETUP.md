# CollabCanvas Local Development Setup

This guide provides comprehensive instructions for setting up CollabCanvas locally with PostgreSQL database and executing the test instructions.

## Prerequisites

- Docker and Docker Compose
- Node.js (v18 or higher)
- Python 3.11
- Git

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd collabcanvas-mvp-day7
   ```

2. **Run the setup script**:
   ```bash
   ./setup-local-dev.sh
   ```

3. **Execute test instructions**:
   ```bash
   ./run-test-instructions.sh
   ```

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Start PostgreSQL with Docker

```bash
docker-compose -f docker-compose.local.yml up postgres -d
```

### 2. Setup Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run_local.py
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

## Services

After setup, the following services will be available:

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **Database**: postgresql://collabcanvas:collabcanvas123@localhost:5432/collabcanvas_local

## Health Checks

- Backend Health: http://localhost:5000/health
- API Health: http://localhost:5000/api/health

## Test Instructions Execution

The test instructions from `logs/test_instructions.md` will be executed automatically when you run:

```bash
./run-test-instructions.sh
```

This script will:

1. **Validate Basic Canvas Functionality**:
   - Ability to place items on the canvas
   - Ability to resize objects on the canvas
   - Ability to move objects around once placed
   - Ability to enter text into a text box
   - Ability to place objects via AI agent prompts

2. **Validate Production User Stories**:
   - Email/password authentication
   - Canvas creation with name and description
   - Canvas list viewing
   - Canvas opening for updates
   - Text box placement and text entry
   - Shape placement (star, circle, rectangle, line, arrow, diamond)
   - Object movement and resizing
   - AI agent canvas generation

3. **Capture Screenshots**: Visual validation of all functionality

## Test Results

Test results will be saved in:
- `test-screenshots-YYYYMMDD_HHMMSS/` - Manual screenshots
- `frontend/cypress/screenshots/` - Cypress test screenshots
- `frontend/playwright-report/` - Playwright test reports
- `test-screenshots-YYYYMMDD_HHMMSS/validation-report.md` - Validation report

## Troubleshooting

### Services Not Starting

1. **Check Docker**:
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Check Ports**:
   ```bash
   lsof -i :3000  # Frontend
   lsof -i :5000  # Backend
   lsof -i :5432  # PostgreSQL
   ```

3. **View Logs**:
   ```bash
   docker-compose -f docker-compose.local.yml logs -f
   ```

### Database Issues

1. **Reset Database**:
   ```bash
   docker-compose -f docker-compose.local.yml down
   docker volume rm collabcanvas-mvp-day7_postgres_data
   docker-compose -f docker-compose.local.yml up -d
   ```

2. **Check Database Connection**:
   ```bash
   docker-compose -f docker-compose.local.yml exec postgres psql -U collabcanvas -d collabcanvas_local -c "SELECT version();"
   ```

### Frontend Issues

1. **Clear Node Modules**:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Environment Variables**:
   ```bash
   echo $VITE_API_URL
   echo $VITE_SOCKET_URL
   ```

### Backend Issues

1. **Check Python Environment**:
   ```bash
   cd backend
   source venv/bin/activate
   python --version
   pip list
   ```

2. **Check Database Connection**:
   ```bash
   cd backend
   source venv/bin/activate
   python -c "from app import create_app; from config_local import LocalConfig; app = create_app(LocalConfig); print('Backend configured successfully')"
   ```

## Development Commands

### Start All Services
```bash
docker-compose -f docker-compose.local.yml up -d
```

### Stop All Services
```bash
docker-compose -f docker-compose.local.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.local.yml logs -f
```

### Run Tests Only
```bash
cd frontend
npm run test:e2e:local:headless
npm run test:playwright:all
```

### Database Operations
```bash
# Access PostgreSQL
docker-compose -f docker-compose.local.yml exec postgres psql -U collabcanvas -d collabcanvas_local

# Run migrations
cd backend
source venv/bin/activate
python -c "from app import create_app; from config_local import LocalConfig; from app.extensions import db; app = create_app(LocalConfig); app.app_context().push(); db.create_all()"
```

## File Structure

```
collabcanvas-mvp-day7/
├── docker-compose.local.yml          # Local development services
├── setup-local-dev.sh               # Automated setup script
├── run-test-instructions.sh         # Test execution script
├── backend/
│   ├── Dockerfile.local             # Backend Docker image
│   ├── init.sql                     # PostgreSQL initialization
│   ├── config_local.py              # Local configuration
│   └── run_local.py                 # Local development runner
├── frontend/
│   ├── Dockerfile.local             # Frontend Docker image
│   └── cypress.config.local-dev.ts  # Local test configuration
└── test-screenshots-*/              # Test results and screenshots
```

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Flask secret key
- `FLASK_ENV`: development
- `CORS_ORIGINS`: Allowed CORS origins

### Frontend
- `VITE_API_URL`: Backend API URL
- `VITE_SOCKET_URL`: WebSocket URL
- `NODE_ENV`: development

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs: `docker-compose -f docker-compose.local.yml logs -f`
3. Ensure all prerequisites are installed
4. Try resetting the environment: `docker-compose -f docker-compose.local.yml down && docker-compose -f docker-compose.local.yml up --build`

## Next Steps

After successful setup and test execution:

1. Review the validation report in `test-screenshots-*/validation-report.md`
2. Check screenshots for visual validation
3. Run additional tests as needed
4. Develop new features using the local environment
