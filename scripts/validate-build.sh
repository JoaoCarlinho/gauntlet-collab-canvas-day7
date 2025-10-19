#!/bin/bash

# 🔍 Build Validation Script
# Validates that the codebase builds successfully and all TypeScript errors are resolved

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to validate frontend build
validate_frontend_build() {
    log_info "Validating frontend build..."
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Run TypeScript check
    log_info "Running TypeScript check..."
    npx tsc --noEmit
    
    # Run build
    log_info "Running production build..."
    npm run build
    
    log_success "Frontend build validation completed successfully!"
}

# Function to validate backend build
validate_backend_build() {
    log_info "Validating backend build..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        log_warning "Python virtual environment not found. Please create one manually."
        return 0
    fi
    
    # Activate virtual environment and check syntax
    log_info "Checking Python syntax..."
    source venv/bin/activate
    python -m py_compile *.py
    
    log_success "Backend build validation completed successfully!"
}

# Function to run linting
run_linting() {
    log_info "Running linting checks..."
    
    cd "$FRONTEND_DIR"
    
    # Run ESLint
    log_info "Running ESLint..."
    npx eslint src/ --ext .ts,.tsx --max-warnings 0
    
    # Run Prettier check
    log_info "Running Prettier check..."
    npx prettier --check src/
    
    log_success "Linting checks completed successfully!"
}

# Function to run tests
run_tests() {
    log_info "Running test validation..."
    
    cd "$FRONTEND_DIR"
    
    # Run unit tests
    log_info "Running unit tests..."
    npm test -- --watchAll=false --passWithNoTests
    
    log_success "Test validation completed successfully!"
}

# Main validation function
main() {
    log_info "🔍 Starting build validation..."
    
    validate_frontend_build
    validate_backend_build
    run_linting
    run_tests
    
    log_success "🎉 All build validations passed successfully!"
    log_info "The codebase is ready for deployment."
}

# Run main function
main "$@"
