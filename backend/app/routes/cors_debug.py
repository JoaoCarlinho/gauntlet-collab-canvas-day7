from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.utils.logger import SmartLogger

cors_debug_bp = Blueprint('cors_debug', __name__, url_prefix='/api/debug')
logger = SmartLogger('cors_debug', 'INFO')

@cors_debug_bp.route('/cors', methods=['GET', 'OPTIONS'])
@cross_origin(origins=['*'])  # Temporary permissive CORS for debugging
def cors_debug():
    """Debug endpoint to test CORS configuration."""
    try:
        # Log request details
        logger.log_info(f"CORS Debug Request - Method: {request.method}")
        logger.log_info(f"Origin: {request.headers.get('Origin', 'No Origin')}")
        logger.log_info(f"Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            # Handle preflight request
            response = jsonify({
                'status': 'preflight_ok',
                'message': 'CORS preflight request handled',
                'origin': request.headers.get('Origin', 'No Origin'),
                'method': request.method
            })
            
            # Add CORS headers manually
            response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            return response, 200
        
        # Handle actual request
        return jsonify({
            'status': 'success',
            'message': 'CORS debug endpoint working',
            'origin': request.headers.get('Origin', 'No Origin'),
            'method': request.method,
            'timestamp': '2024-01-01T00:00:00Z'
        }), 200
        
    except Exception as e:
        logger.log_error(f"CORS debug error: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@cors_debug_bp.route('/health', methods=['GET'])
@cross_origin(origins=['*'])
def health_check():
    """Simple health check with CORS."""
    return jsonify({
        'status': 'healthy',
        'message': 'Backend is running',
        'cors_enabled': True
    }), 200
