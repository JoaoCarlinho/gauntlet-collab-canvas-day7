#!/bin/bash

# Railway build script with retry mechanisms
set -e

echo "🚀 Starting Railway build process..."

# Function to retry npm commands
retry_npm() {
    local max_attempts=3
    local delay=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "📦 Attempt $attempt/$max_attempts: $1"
        
        if eval "$1"; then
            echo "✅ Success on attempt $attempt"
            return 0
        else
            echo "❌ Attempt $attempt failed"
            if [ $attempt -lt $max_attempts ]; then
                echo "⏳ Waiting ${delay}s before retry..."
                sleep $delay
                delay=$((delay * 2))  # Exponential backoff
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "💥 All attempts failed"
    return 1
}

# Clean npm cache if needed
echo "🧹 Cleaning npm cache..."
npm cache clean --force || true

# Install dependencies with retry
echo "📦 Installing dependencies..."
retry_npm "npm ci --frozen-lockfile"

# Build the application
echo "🔨 Building application..."
npm run build:railway

echo "✅ Build completed successfully!"
