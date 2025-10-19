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
        from app.config import Config as ProductionConfig
        
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
            # Fallback: start with minimal Flask app with CORS
            from flask import Flask, jsonify, request
            from flask_cors import CORS
            
            app = Flask(__name__)
            CORS(app, origins=['*'])  # Allow all origins for fallback mode
            
            @app.route('/health')
            @app.route('/health/')
            def health():
                return jsonify({'status': 'healthy', 'message': 'CollabCanvas API is running (minimal mode)'}), 200
            
            @app.route('/')
            def root():
                return jsonify({'status': 'running', 'message': 'CollabCanvas API is running (minimal mode)'}), 200
            
            # Add basic API endpoints for CORS preflight
            @app.route('/api/auth/me', methods=['GET', 'OPTIONS'])
            def auth_me():
                if request.method == 'OPTIONS':
                    return '', 200
                return jsonify({'error': 'Authentication not available in minimal mode'}), 503
            
            @app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
            def auth_register():
                if request.method == 'OPTIONS':
                    return '', 200
                return jsonify({'error': 'Authentication not available in minimal mode'}), 503
            
            port = int(os.environ.get('PORT', 5000))
            print(f"Starting minimal application with CORS on port {port}")
            app.run(debug=False, host='0.0.0.0', port=port)
            
        except Exception as fallback_error:
            print(f"Fallback startup also failed: {fallback_error}")
            sys.exit(1)

if __name__ == '__main__':
    main()
