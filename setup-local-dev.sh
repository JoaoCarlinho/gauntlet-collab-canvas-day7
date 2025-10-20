#!/bin/bash

# CollabCanvas Local Development Setup Script
# This script sets up the complete local development environment with PostgreSQL

set -e

echo "🚀 Setting up CollabCanvas Local Development Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "Node.js and npm are installed"
}

# Check if Python is installed
check_python() {
    print_status "Checking Python installation..."
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3 first."
        exit 1
    fi
    
    print_success "Python 3 is installed"
}

# Setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    print_success "Backend setup complete"
    cd ..
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    cd frontend
    
    # Install dependencies
    print_status "Installing Node.js dependencies..."
    npm install
    
    print_success "Frontend setup complete"
    cd ..
}

# Start services with Docker Compose
start_services() {
    print_status "Starting services with Docker Compose..."
    
    # Stop any existing containers
    docker-compose -f docker-compose.local.yml down
    
    # Build and start services
    docker-compose -f docker-compose.local.yml up --build -d
    
    print_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    until docker-compose -f docker-compose.local.yml exec -T postgres pg_isready -U collabcanvas -d collabcanvas_local; do
        sleep 2
    done
    print_success "PostgreSQL is ready"
    
    # Wait for backend
    print_status "Waiting for backend..."
    until curl -f http://localhost:5000/health > /dev/null 2>&1; do
        sleep 2
    done
    print_success "Backend is ready"
    
    # Wait for frontend
    print_status "Waiting for frontend..."
    until curl -f http://localhost:3000 > /dev/null 2>&1; do
        sleep 2
    done
    print_success "Frontend is ready"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    cd backend
    source venv/bin/activate
    
    # Initialize database
    python -c "
from app import create_app
from config_local import LocalConfig
from app.extensions import db

app = create_app(LocalConfig)
with app.app_context():
    db.create_all()
    print('Database tables created successfully')
"
    
    print_success "Database migrations complete"
    cd ..
}

# Display service URLs
show_urls() {
    echo ""
    echo "🎉 Local Development Environment Ready!"
    echo "======================================"
    echo ""
    echo "Services:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo "  Database: postgresql://collabcanvas:collabcanvas123@localhost:5432/collabcanvas_local"
    echo ""
    echo "Health Checks:"
    echo "  Backend Health: http://localhost:5000/health"
    echo "  API Health:     http://localhost:5000/api/health"
    echo ""
    echo "To stop services: docker-compose -f docker-compose.local.yml down"
    echo "To view logs:     docker-compose -f docker-compose.local.yml logs -f"
    echo ""
}

# Main execution
main() {
    print_status "Starting CollabCanvas local development setup..."
    
    check_docker
    check_node
    check_python
    
    setup_backend
    setup_frontend
    
    start_services
    wait_for_services
    run_migrations
    
    show_urls
    
    print_success "Setup complete! You can now run the test instructions."
}

# Run main function
main "$@"
