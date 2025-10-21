"""
Connection Monitoring Routes
Provides endpoints for monitoring Socket.IO connection health and quality.
"""

from flask import Blueprint, jsonify, request
from app.services.connection_monitoring_service import connection_monitor
from app.utils.railway_logger import railway_logger
from app.middleware.auth_middleware import require_auth

connection_monitoring_bp = Blueprint('connection_monitoring', __name__)

@connection_monitoring_bp.route('/metrics', methods=['GET'])
@require_auth
def get_connection_metrics():
    """Get overall connection metrics."""
    try:
        metrics = connection_monitor.get_overall_metrics()
        railway_logger.log('connection_monitoring', 10, "Connection metrics requested")
        return jsonify({
            'status': 'success',
            'metrics': metrics
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to get connection metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get connection metrics'
        }), 500

@connection_monitoring_bp.route('/metrics/<user_id>', methods=['GET'])
@require_auth
def get_user_connection_metrics(user_id):
    """Get connection metrics for a specific user."""
    try:
        metrics = connection_monitor.get_connection_metrics(user_id)
        railway_logger.log('connection_monitoring', 10, f"User connection metrics requested for: {user_id}")
        return jsonify({
            'status': 'success',
            'user_id': user_id,
            'metrics': metrics
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to get user connection metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get user connection metrics'
        }), 500

@connection_monitoring_bp.route('/parse-errors', methods=['GET'])
@require_auth
def get_parse_error_metrics():
    """Get parse error metrics and analysis."""
    try:
        metrics = connection_monitor.get_parse_error_metrics()
        railway_logger.log('connection_monitoring', 10, "Parse error metrics requested")
        return jsonify({
            'status': 'success',
            'parse_error_metrics': metrics
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to get parse error metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get parse error metrics'
        }), 500

@connection_monitoring_bp.route('/health', methods=['GET'])
def get_connection_health():
    """Get connection health status."""
    try:
        overall_metrics = connection_monitor.get_overall_metrics()
        parse_error_metrics = connection_monitor.get_parse_error_metrics()
        
        # Determine overall health status
        success_rate = overall_metrics.get('success_rate', 0)
        parse_error_rate = overall_metrics.get('parse_error_rate', 0)
        
        if success_rate >= 0.95 and parse_error_rate <= 0.01:
            health_status = 'excellent'
        elif success_rate >= 0.85 and parse_error_rate <= 0.05:
            health_status = 'good'
        elif success_rate >= 0.70 and parse_error_rate <= 0.10:
            health_status = 'fair'
        else:
            health_status = 'poor'
        
        railway_logger.log('connection_monitoring', 10, f"Connection health status: {health_status}")
        
        return jsonify({
            'status': 'success',
            'health_status': health_status,
            'success_rate': success_rate,
            'parse_error_rate': parse_error_rate,
            'active_users': overall_metrics.get('active_users', 0),
            'uptime_seconds': overall_metrics.get('uptime_seconds', 0)
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to get connection health: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get connection health'
        }), 500

@connection_monitoring_bp.route('/reset', methods=['POST'])
@require_auth
def reset_metrics():
    """Reset connection metrics."""
    try:
        user_id = request.json.get('user_id') if request.json else None
        connection_monitor.reset_metrics(user_id)
        
        message = f"Metrics reset for user: {user_id}" if user_id else "All metrics reset"
        railway_logger.log('connection_monitoring', 10, message)
        
        return jsonify({
            'status': 'success',
            'message': message
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to reset metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to reset metrics'
        }), 500

@connection_monitoring_bp.route('/alerts', methods=['GET'])
@require_auth
def get_connection_alerts():
    """Get connection alerts and warnings."""
    try:
        overall_metrics = connection_monitor.get_overall_metrics()
        parse_error_metrics = connection_monitor.get_parse_error_metrics()
        
        alerts = []
        
        # Check for high parse error rate
        if parse_error_metrics.get('parse_error_rate_per_minute', 0) > 0.1:
            alerts.append({
                'type': 'high_parse_error_rate',
                'severity': 'high',
                'message': f"High parse error rate: {parse_error_metrics['parse_error_rate_per_minute']:.2f} errors per minute"
            })
        
        # Check for low success rate
        success_rate = overall_metrics.get('success_rate', 0)
        if success_rate < 0.85:
            alerts.append({
                'type': 'low_success_rate',
                'severity': 'medium' if success_rate >= 0.70 else 'high',
                'message': f"Low connection success rate: {success_rate:.2%}"
            })
        
        # Check for parse error trend
        parse_error_trend = parse_error_metrics.get('parse_error_trend', 'stable')
        if parse_error_trend == 'increasing':
            alerts.append({
                'type': 'increasing_parse_errors',
                'severity': 'medium',
                'message': "Parse errors are increasing"
            })
        
        railway_logger.log('connection_monitoring', 10, f"Connection alerts requested: {len(alerts)} alerts")
        
        return jsonify({
            'status': 'success',
            'alerts': alerts,
            'alert_count': len(alerts)
        }), 200
    except Exception as e:
        railway_logger.log('connection_monitoring', 40, f"Failed to get connection alerts: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get connection alerts'
        }), 500
