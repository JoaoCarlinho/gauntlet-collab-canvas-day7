#!/bin/bash

# CollabCanvas Simple Local Development Setup Script
# This script sets up the local development environment without Docker

set -e

echo "🚀 Setting up CollabCanvas Simple Local Development Environment"
echo "============================================================="

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
    
    # Install dependencies (excluding psycopg2-binary for now)
    print_status "Installing Python dependencies..."
    pip install --upgrade pip
    
    # Install requirements without psycopg2-binary
    pip install Flask==2.3.3
    pip install Flask-SQLAlchemy==3.0.5
    pip install Flask-SocketIO==5.3.6
    pip install Flask-CORS==4.0.0
    pip install Flask-Migrate==4.0.5
    pip install Flask-Caching==2.1.0
    pip install flasgger==0.9.7.1
    pip install marshmallow==3.20.1
    pip install python-dotenv==1.0.0
    pip install diskcache==5.6.3
    pip install python-socketio==5.9.0
    pip install eventlet==0.33.3
    pip install pytest==7.4.3
    pip install pytest-flask==1.3.0
    pip install pytest-mock==3.12.0
    pip install pytest-cov==4.1.0
    pip install firebase-admin==6.2.0
    pip install bleach==6.0.0
    pip install email-validator==2.1.0
    pip install flask-limiter==3.5.0
    pip install openai==1.12.0
    
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

# Start backend
start_backend() {
    print_status "Starting backend server..."
    
    cd backend
    source venv/bin/activate
    
    # Start backend in background
    python run_local.py &
    BACKEND_PID=$!
    
    # Wait for backend to start
    print_status "Waiting for backend to start..."
    sleep 5
    
    # Check if backend is running
    if curl -f http://localhost:5001/health > /dev/null 2>&1; then
        print_success "Backend is running on http://localhost:5001"
    else
        print_error "Backend failed to start"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    cd ..
}

# Start frontend
start_frontend() {
    print_status "Starting frontend server..."
    
    cd frontend
    
    # Set environment variables for local development
    export VITE_API_URL=http://localhost:5001
    export VITE_SOCKET_URL=http://localhost:5001
    
    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    print_status "Waiting for frontend to start..."
    sleep 10
    
    # Check if frontend is running
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend is running on http://localhost:3000"
    else
        print_error "Frontend failed to start"
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    
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
    echo "  Database: SQLite (backend/instance/app.db)"
    echo ""
    echo "Health Checks:"
    echo "  Backend Health: http://localhost:5000/health"
    echo "  API Health:     http://localhost:5000/api/health"
    echo ""
    echo "To stop services: Press Ctrl+C"
    echo "To run tests:     ./run-test-instructions.sh"
    echo ""
}

# Main execution
main() {
    print_status "Starting CollabCanvas simple local development setup..."
    
    check_node
    check_python
    
    setup_backend
    setup_frontend
    
    start_backend
    start_frontend
    
    show_urls
    
    print_success "Setup complete! You can now run the test instructions."
    
    # Keep the script running
    print_status "Press Ctrl+C to stop all services..."
    wait
}

# Handle cleanup on exit
cleanup() {
    print_status "Stopping services..."
    pkill -f "python run_local.py" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    print_success "Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Run main function
main "$@"
