"""
Message Analysis Routes
Provides endpoints for analyzing socket message sizes, formats, and content.
"""

from flask import Blueprint, jsonify, request
from app.utils.message_analysis import message_analyzer
from app.utils.railway_logger import railway_logger
from app.middleware.auth_middleware import require_auth

message_analysis_bp = Blueprint('message_analysis', __name__)

@message_analysis_bp.route('/size-statistics', methods=['GET'])
@require_auth
def get_size_statistics():
    """Get message size statistics."""
    try:
        message_type = request.args.get('message_type')
        stats = message_analyzer.get_size_statistics(message_type)
        
        railway_logger.log('message_analysis', 10, f"Size statistics requested for message type: {message_type or 'all'}")
        
        return jsonify({
            'status': 'success',
            'message_type': message_type,
            'statistics': stats
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to get size statistics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get size statistics'
        }), 500

@message_analysis_bp.route('/format-statistics', methods=['GET'])
@require_auth
def get_format_statistics():
    """Get message format statistics."""
    try:
        stats = message_analyzer.get_format_statistics()
        
        railway_logger.log('message_analysis', 10, "Format statistics requested")
        
        return jsonify({
            'status': 'success',
            'statistics': stats
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to get format statistics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get format statistics'
        }), 500

@message_analysis_bp.route('/issue-summary', methods=['GET'])
@require_auth
def get_issue_summary():
    """Get message issue summary."""
    try:
        summary = message_analyzer.get_issue_summary()
        
        railway_logger.log('message_analysis', 10, "Issue summary requested")
        
        return jsonify({
            'status': 'success',
            'summary': summary
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to get issue summary: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get issue summary'
        }), 500

@message_analysis_bp.route('/recommendations', methods=['GET'])
@require_auth
def get_recommendations():
    """Get recommendations based on message analysis."""
    try:
        recommendations = message_analyzer.get_recommendations()
        
        railway_logger.log('message_analysis', 10, f"Recommendations requested: {len(recommendations)} recommendations")
        
        return jsonify({
            'status': 'success',
            'recommendations': recommendations
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to get recommendations: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get recommendations'
        }), 500

@message_analysis_bp.route('/analyze', methods=['POST'])
@require_auth
def analyze_message():
    """Analyze a specific message."""
    try:
        data = request.json
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No message data provided'
            }), 400
        
        message_type = data.get('message_type', 'unknown')
        message_data = data.get('message_data', {})
        user_id = data.get('user_id', 'unknown')
        
        analysis_result = message_analyzer.analyze_message(message_type, message_data, user_id)
        
        railway_logger.log('message_analysis', 10, f"Message analysis requested for type: {message_type}")
        
        return jsonify({
            'status': 'success',
            'analysis': analysis_result
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to analyze message: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to analyze message'
        }), 500

@message_analysis_bp.route('/reset', methods=['POST'])
@require_auth
def reset_analysis():
    """Reset message analysis data."""
    try:
        message_analyzer.reset_analysis()
        
        railway_logger.log('message_analysis', 10, "Message analysis data reset")
        
        return jsonify({
            'status': 'success',
            'message': 'Message analysis data reset'
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to reset analysis: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to reset analysis'
        }), 500

@message_analysis_bp.route('/health', methods=['GET'])
def get_analysis_health():
    """Get message analysis health status."""
    try:
        issue_summary = message_analyzer.get_issue_summary()
        size_stats = message_analyzer.get_size_statistics()
        
        # Determine health status
        issue_rate = issue_summary.get('issue_rate', 0)
        exceeds_limit_count = size_stats.get('exceeds_limit_count', 0)
        
        if issue_rate <= 0.05 and exceeds_limit_count == 0:
            health_status = 'excellent'
        elif issue_rate <= 0.10 and exceeds_limit_count <= 5:
            health_status = 'good'
        elif issue_rate <= 0.20 and exceeds_limit_count <= 20:
            health_status = 'fair'
        else:
            health_status = 'poor'
        
        railway_logger.log('message_analysis', 10, f"Message analysis health status: {health_status}")
        
        return jsonify({
            'status': 'success',
            'health_status': health_status,
            'issue_rate': issue_rate,
            'exceeds_limit_count': exceeds_limit_count,
            'total_messages': issue_summary.get('total_messages', 0)
        }), 200
    except Exception as e:
        railway_logger.log('message_analysis', 40, f"Failed to get analysis health: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get analysis health'
        }), 500
