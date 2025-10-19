#!/usr/bin/env python3
"""
Startup script for Railway deployment
Ensures proper initialization and health check readiness
"""

import os
import sys
import time
import signal
import subprocess
from threading import Thread

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    print(f"Received signal {signum}, shutting down gracefully...")
    sys.exit(0)

def wait_for_dependencies():
    """Wait for external dependencies to be ready."""
    print("Waiting for dependencies to be ready...")
    
    # Wait for environment variables
    required_env_vars = ['FLASK_ENV']
    for var in required_env_vars:
        while not os.environ.get(var):
            print(f"Waiting for environment variable: {var}")
            time.sleep(1)
    
    print("Dependencies ready!")

def run_health_check_server():
    """Run a simple health check server while the main app starts."""
    from flask import Flask
    import threading
    
    health_app = Flask(__name__)
    
    @health_app.route('/health')
    @health_app.route('/health/')
    def health():
        return {'status': 'starting', 'message': 'Application is starting up'}, 200
    
    @health_app.route('/')
    def root():
        return {'status': 'starting', 'message': 'Application is starting up'}, 200
    
    def run_health_server():
        health_app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
    
    # Start health server in a separate thread
    health_thread = Thread(target=run_health_server, daemon=True)
    health_thread.start()
    
    return health_thread

def main():
    """Main startup function."""
    print("Starting CollabCanvas application...")
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Wait for dependencies
    wait_for_dependencies()
    
    # Start health check server
    print("Starting health check server...")
    health_thread = run_health_check_server()
    
    # Give health server time to start
    time.sleep(2)
    
    # Start main application
    print("Starting main application...")
    try:
        from app import create_app, socketio
        from app.config import ProductionConfig
        
        app = create_app(ProductionConfig)
        
        port = int(os.environ.get('PORT', 5000))
        print(f"Starting application on port {port}")
        
        socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
        
    except Exception as e:
        print(f"Failed to start application: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
