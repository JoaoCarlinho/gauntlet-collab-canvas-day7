"""
Socket.IO Debug Routes
Provides debugging endpoints for Socket.IO connection issues.
"""

from flask import Blueprint, jsonify, request
from flask_socketio import emit
from app.utils.logger import SmartLogger
from app.services.auth_service import AuthService
from app.extensions import socketio
import json
from datetime import datetime, timezone

socket_debug_bp = Blueprint('socket_debug', __name__, url_prefix='/api/socket-debug')
logger = SmartLogger('socket_debug', 'INFO')


@socket_debug_bp.route('/connection-test', methods=['GET'])
def test_socket_connection():
    """Test Socket.IO connection status."""
    try:
        return jsonify({
            'status': 'success',
            'message': 'Socket.IO connection test endpoint is working',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'socketio_configured': socketio is not None
        }), 200
        
    except Exception as e:
        logger.log_error(f"Socket connection test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@socket_debug_bp.route('/auth-test', methods=['POST'])
def test_socket_auth():
    """Test Socket.IO authentication."""
    try:
        data = request.get_json()
        id_token = data.get('id_token') if data else None
        
        if not id_token:
            return jsonify({
                'status': 'error',
                'error': 'id_token is required',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 400
        
        # Test authentication
        auth_service = AuthService()
        decoded_token = auth_service.verify_token(id_token)
        user = auth_service.get_user_by_id(decoded_token['uid'])
        
        return jsonify({
            'status': 'success',
            'message': 'Socket.IO authentication test successful',
            'user_id': user.id if user else None,
            'user_email': user.email if user else None,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Socket auth test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@socket_debug_bp.route('/emit-test', methods=['POST'])
def test_socket_emit():
    """Test Socket.IO emit functionality."""
    try:
        data = request.get_json()
        room = data.get('room', 'test_room') if data else 'test_room'
        message = data.get('message', 'Test message') if data else 'Test message'
        
        # Emit a test message
        socketio.emit('test_message', {
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room)
        
        return jsonify({
            'status': 'success',
            'message': f'Test message emitted to room: {room}',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Socket emit test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@socket_debug_bp.route('/error-test', methods=['POST'])
def test_socket_error_handling():
    """Test Socket.IO error handling."""
    try:
        data = request.get_json()
        error_type = data.get('error_type', 'generic') if data else 'generic'
        
        # Simulate different types of errors
        if error_type == 'auth':
            socketio.emit('error', {
                'message': 'Authentication failed',
                'type': 'authentication_error',
                'code': 'AUTH_ERROR'
            })
        elif error_type == 'validation':
            socketio.emit('error', {
                'message': 'Validation failed',
                'type': 'validation_error',
                'code': 'VALIDATION_ERROR'
            })
        elif error_type == 'permission':
            socketio.emit('error', {
                'message': 'Permission denied',
                'type': 'permission_error',
                'code': 'PERMISSION_ERROR'
            })
        else:
            socketio.emit('error', {
                'message': 'Generic error occurred',
                'type': 'generic_error',
                'code': 'GENERIC_ERROR'
            })
        
        return jsonify({
            'status': 'success',
            'message': f'Test error emitted: {error_type}',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Socket error test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@socket_debug_bp.route('/config', methods=['GET'])
def get_socket_config():
    """Get Socket.IO configuration information."""
    try:
        config_info = {
            'cors_allowed_origins': socketio.cors_allowed_origins if hasattr(socketio, 'cors_allowed_origins') else 'Not available',
            'manage_session': socketio.manage_session if hasattr(socketio, 'manage_session') else 'Not available',
            'ping_timeout': socketio.ping_timeout if hasattr(socketio, 'ping_timeout') else 'Not available',
            'ping_interval': socketio.ping_interval if hasattr(socketio, 'ping_interval') else 'Not available',
            'max_http_buffer_size': socketio.max_http_buffer_size if hasattr(socketio, 'max_http_buffer_size') else 'Not available',
            'always_connect': socketio.always_connect if hasattr(socketio, 'always_connect') else 'Not available',
            'allow_upgrades': socketio.allow_upgrades if hasattr(socketio, 'allow_upgrades') else 'Not available',
            'transports': socketio.transports if hasattr(socketio, 'transports') else 'Not available'
        }
        
        return jsonify({
            'status': 'success',
            'config': config_info,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Socket config retrieval failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500
