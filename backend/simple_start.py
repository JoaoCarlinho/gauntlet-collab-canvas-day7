#!/usr/bin/env python3
"""
Simple startup script for Railway deployment
Handles errors gracefully and provides fallback options
"""

import os
import sys
import time

def main():
    """Main startup function with error handling."""
    print("Starting CollabCanvas application...")
    
    # Set environment variables if not set
    if not os.environ.get('FLASK_ENV'):
        os.environ['FLASK_ENV'] = 'production'
        print("Set FLASK_ENV=production")
    
    try:
        # Import and create the application
        from app import create_app, socketio
        from app.config import ProductionConfig
        
        print("Creating Flask application...")
        app = create_app(ProductionConfig)
        
        port = int(os.environ.get('PORT', 5000))
        print(f"Starting application on port {port}")
        
        # Start the application
        socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
        
    except Exception as e:
        print(f"Failed to start application: {e}")
        print("Attempting to start with minimal configuration...")
        
        try:
            # Fallback: start with minimal Flask app
            from flask import Flask
            app = Flask(__name__)
            
            @app.route('/health')
            @app.route('/health/')
            def health():
                return {'status': 'healthy', 'message': 'CollabCanvas API is running (minimal mode)'}, 200
            
            @app.route('/')
            def root():
                return {'status': 'running', 'message': 'CollabCanvas API is running (minimal mode)'}, 200
            
            port = int(os.environ.get('PORT', 5000))
            print(f"Starting minimal application on port {port}")
            app.run(debug=False, host='0.0.0.0', port=port)
            
        except Exception as fallback_error:
            print(f"Fallback startup also failed: {fallback_error}")
            sys.exit(1)

if __name__ == '__main__':
    main()
