#!/usr/bin/env python3
"""
Minimal Flask application for Railway deployment
This version includes only essential components to avoid import issues
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# Set environment variables
if not os.environ.get('FLASK_ENV'):
    os.environ['FLASK_ENV'] = 'production'

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///site.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    transports=['polling'],  # Railway doesn't support WebSocket
    allow_upgrades=False,    # Disable upgrade attempts
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=500000,
    logger=False,
    engineio_logger=False
)

# Configure CORS
CORS(app, origins=[
    "https://collab-canvas-frontend.up.railway.app",
    "https://gauntlet-collab-canvas-day7.vercel.app",
    "https://collabcanvas-mvp-day7.vercel.app",
    "https://collabcanvas-24-mvp.firebaseapp.com",
    "http://localhost:3000",
    "http://localhost:5173"
])

# Health endpoints
@app.route('/health')
@app.route('/health/')
def health():
    return jsonify({
        'status': 'healthy',
        'message': 'CollabCanvas API is running',
        'version': '1.0.0'
    }), 200

@app.route('/socket.io/')
@app.route('/socket.io')
def socketio_health():
    """Socket.IO health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'message': 'Socket.IO endpoint is accessible',
        'transports': ['polling'],
        'cors_enabled': True
    }), 200

@app.route('/')
def root():
    return jsonify({
        'status': 'running',
        'message': 'CollabCanvas API is running',
        'version': '1.0.0'
    }), 200

# Basic API endpoints with CORS support
@app.route('/api/auth/me', methods=['GET', 'OPTIONS'])
def auth_me():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'error': 'Authentication service not available'}), 503

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
def auth_register():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'error': 'Authentication service not available'}), 503

@app.route('/api/canvas', methods=['GET', 'POST', 'OPTIONS'])
def canvas():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'error': 'Canvas service not available'}), 503

@app.route('/api/ai-agent/health', methods=['GET', 'OPTIONS'])
def ai_health():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        'status': 'unhealthy',
        'message': 'AI service not available in minimal mode'
    }), 503

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting minimal CollabCanvas application on port {port}")
    socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
