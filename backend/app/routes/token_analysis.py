"""
Token Analysis Routes
Provides endpoints for analyzing and optimizing Firebase authentication tokens.
"""

from flask import Blueprint, jsonify, request
from app.utils.firebase_token_analyzer import firebase_token_analyzer
from app.services.token_optimization_service import token_optimization_service
from app.utils.railway_logger import railway_logger
from app.middleware.auth_middleware import require_auth

token_analysis_bp = Blueprint('token_analysis', __name__)

@token_analysis_bp.route('/analyze', methods=['POST'])
@require_auth
def analyze_token():
    """Analyze a Firebase token for potential issues."""
    try:
        data = request.json
        if not data or 'token' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Token is required'
            }), 400
        
        token = data['token']
        context = data.get('context', 'api_analysis')
        user_id = data.get('user_id', 'unknown')
        
        analysis = firebase_token_analyzer.analyze_token(token, context)
        
        railway_logger.log('token_analysis', 10, f"Token analysis requested for context: {context}")
        
        return jsonify({
            'status': 'success',
            'analysis': analysis
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Token analysis failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Token analysis failed'
        }), 500

@token_analysis_bp.route('/validate', methods=['POST'])
@require_auth
def validate_token():
    """Validate a token for socket usage."""
    try:
        data = request.json
        if not data or 'token' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Token is required'
            }), 400
        
        token = data['token']
        user_id = data.get('user_id', 'unknown')
        
        validation_result = token_optimization_service.validate_token_for_socket(token, user_id)
        
        railway_logger.log('token_analysis', 10, f"Token validation requested for user: {user_id}")
        
        return jsonify({
            'status': 'success',
            'validation': validation_result
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Token validation failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Token validation failed'
        }), 500

@token_analysis_bp.route('/optimize-message', methods=['POST'])
@require_auth
def optimize_socket_message():
    """Optimize a socket message containing a token."""
    try:
        data = request.json
        if not data or 'message' not in data or 'token' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Message and token are required'
            }), 400
        
        message = data['message']
        token = data['token']
        user_id = data.get('user_id', 'unknown')
        
        optimized_message = token_optimization_service.optimize_socket_message_with_token(message, token, user_id)
        
        railway_logger.log('token_analysis', 10, f"Socket message optimization requested for user: {user_id}")
        
        return jsonify({
            'status': 'success',
            'optimized_message': optimized_message
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Socket message optimization failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Socket message optimization failed'
        }), 500

@token_analysis_bp.route('/refresh', methods=['POST'])
@require_auth
def handle_token_refresh():
    """Handle token refresh and analyze the impact."""
    try:
        data = request.json
        if not data or 'old_token' not in data or 'new_token' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Both old_token and new_token are required'
            }), 400
        
        old_token = data['old_token']
        new_token = data['new_token']
        user_id = data.get('user_id', 'unknown')
        
        refresh_result = token_optimization_service.handle_token_refresh(old_token, new_token, user_id)
        
        railway_logger.log('token_analysis', 10, f"Token refresh handled for user: {user_id}")
        
        return jsonify({
            'status': 'success',
            'refresh_result': refresh_result
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Token refresh handling failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Token refresh handling failed'
        }), 500

@token_analysis_bp.route('/statistics', methods=['GET'])
@require_auth
def get_token_statistics():
    """Get token analysis statistics."""
    try:
        analyzer_stats = firebase_token_analyzer.get_token_statistics()
        optimization_stats = token_optimization_service.get_optimization_statistics()
        
        railway_logger.log('token_analysis', 10, "Token statistics requested")
        
        return jsonify({
            'status': 'success',
            'analyzer_statistics': analyzer_stats,
            'optimization_statistics': optimization_stats
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Failed to get token statistics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get token statistics'
        }), 500

@token_analysis_bp.route('/recommendations', methods=['GET'])
@require_auth
def get_recommendations():
    """Get token optimization recommendations."""
    try:
        user_id = request.args.get('user_id')
        
        if user_id:
            recommendations = token_optimization_service.get_token_recommendations(user_id)
        else:
            recommendations = firebase_token_analyzer.get_recommendations()
        
        railway_logger.log('token_analysis', 10, f"Token recommendations requested for user: {user_id or 'all'}")
        
        return jsonify({
            'status': 'success',
            'recommendations': recommendations
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Failed to get recommendations: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get recommendations'
        }), 500

@token_analysis_bp.route('/clear-cache', methods=['POST'])
@require_auth
def clear_token_cache():
    """Clear token cache."""
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        
        token_optimization_service.clear_token_cache(user_id)
        
        message = f"Token cache cleared for user: {user_id}" if user_id else "Token cache cleared for all users"
        railway_logger.log('token_analysis', 10, message)
        
        return jsonify({
            'status': 'success',
            'message': message
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Failed to clear token cache: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to clear token cache'
        }), 500

@token_analysis_bp.route('/reset', methods=['POST'])
@require_auth
def reset_analysis():
    """Reset token analysis data."""
    try:
        firebase_token_analyzer.reset_analysis()
        token_optimization_service.reset_statistics()
        
        railway_logger.log('token_analysis', 10, "Token analysis data reset")
        
        return jsonify({
            'status': 'success',
            'message': 'Token analysis data reset'
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Failed to reset analysis: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to reset analysis'
        }), 500

@token_analysis_bp.route('/health', methods=['GET'])
def get_token_health():
    """Get token analysis health status."""
    try:
        analyzer_stats = firebase_token_analyzer.get_token_statistics()
        optimization_stats = token_optimization_service.get_optimization_statistics()
        
        # Determine health status
        issue_rate = analyzer_stats.get('issue_rate', 0)
        validation_success_rate = optimization_stats.get('validation_success_rate', 1)
        
        if issue_rate <= 0.05 and validation_success_rate >= 0.95:
            health_status = 'excellent'
        elif issue_rate <= 0.10 and validation_success_rate >= 0.90:
            health_status = 'good'
        elif issue_rate <= 0.20 and validation_success_rate >= 0.80:
            health_status = 'fair'
        else:
            health_status = 'poor'
        
        railway_logger.log('token_analysis', 10, f"Token analysis health status: {health_status}")
        
        return jsonify({
            'status': 'success',
            'health_status': health_status,
            'issue_rate': issue_rate,
            'validation_success_rate': validation_success_rate,
            'total_tokens_analyzed': analyzer_stats.get('total_tokens', 0)
        }), 200
    except Exception as e:
        railway_logger.log('token_analysis', 40, f"Failed to get token health: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get token health'
        }), 500
