from flask import Blueprint, request, jsonify
from app.middleware.cors_middleware import cors_required

test_cors_bp = Blueprint('test_cors', __name__, url_prefix='/api/test')

@test_cors_bp.route('/cors', methods=['GET', 'OPTIONS'])
@cors_required
def test_cors():
    """Test endpoint to verify CORS is working."""
    return jsonify({
        'status': 'success',
        'message': 'CORS is working!',
        'origin': request.headers.get('Origin', 'No Origin'),
        'method': request.method,
        'timestamp': '2024-01-01T00:00:00Z'
    }), 200

@test_cors_bp.route('/auth-test', methods=['GET', 'OPTIONS'])
@cors_required
def test_auth_cors():
    """Test endpoint that mimics auth endpoint CORS behavior."""
    return jsonify({
        'status': 'success',
        'message': 'Auth CORS test working!',
        'origin': request.headers.get('Origin', 'No Origin'),
        'method': request.method,
        'headers': dict(request.headers)
    }), 200
