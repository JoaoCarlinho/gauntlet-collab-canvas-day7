#!/usr/bin/env python3
"""
Minimal working Flask application for Railway deployment
This version has minimal dependencies to ensure it works
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS

# Create Flask app
app = Flask(__name__)

# Configure CORS - allow all origins for now
CORS(app, origins=['*'])

# Health endpoints
@app.route('/health')
@app.route('/health/')
def health():
    return jsonify({
        'status': 'healthy',
        'message': 'CollabCanvas API is running',
        'version': '1.0.0'
    }), 200

@app.route('/')
def root():
    return jsonify({
        'status': 'running',
        'message': 'CollabCanvas API is running',
        'version': '1.0.0'
    }), 200

# API endpoints with CORS support
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
        'message': 'AI service not available'
    }), 503

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting working CollabCanvas application on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port)
