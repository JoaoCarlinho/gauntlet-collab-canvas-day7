"""
Health Check Routes
Provides comprehensive health checking for Railway deployment
"""

from flask import Blueprint, jsonify, current_app
from app.extensions import db
import time
import os
import sys

health_bp = Blueprint('health', __name__, url_prefix='/health')

@health_bp.route('/')
def basic_health():
    """Basic health check - minimal dependencies."""
    return jsonify({
        'status': 'healthy',
        'message': 'CollabCanvas API is running',
        'timestamp': int(time.time()),
        'version': '1.0.0',
        'environment': os.environ.get('FLASK_ENV', 'unknown')
    }), 200

@health_bp.route('/ready')
def readiness_check():
    """Readiness check - verifies all dependencies are ready."""
    try:
        # Check database connection
        db_status = 'healthy'
        try:
            # Use a more compatible database check
            with db.engine.connect() as connection:
                connection.execute('SELECT 1')
        except Exception as e:
            db_status = f'unhealthy: {str(e)}'
        
        # Check environment variables
        env_status = 'healthy'
        required_env_vars = ['FLASK_ENV']
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        if missing_vars:
            env_status = f'unhealthy: missing {missing_vars}'
        
        # Check Redis connection (if available)
        redis_status = 'healthy'
        try:
            from app.extensions import redis_client
            if redis_client:
                redis_client.ping()
            else:
                redis_status = 'not_configured'
        except Exception as e:
            redis_status = f'unhealthy: {str(e)}'
        
        overall_status = 'healthy' if all(status == 'healthy' or status == 'not_configured' 
                                        for status in [db_status, env_status, redis_status]) else 'unhealthy'
        
        return jsonify({
            'status': overall_status,
            'message': 'Readiness check completed',
            'timestamp': int(time.time()),
            'checks': {
                'database': db_status,
                'environment': env_status,
                'redis': redis_status
            }
        }), 200 if overall_status == 'healthy' else 503
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'message': f'Readiness check failed: {str(e)}',
            'timestamp': int(time.time())
        }), 503

@health_bp.route('/live')
def liveness_check():
    """Liveness check - verifies the application is alive."""
    return jsonify({
        'status': 'alive',
        'message': 'Application is alive',
        'timestamp': int(time.time()),
        'uptime': time.time() - current_app.config.get('START_TIME', time.time())
    }), 200

@health_bp.route('/startup')
def startup_check():
    """Startup check - verifies the application has started successfully."""
    try:
        # Check if all critical components are initialized
        components = {
            'flask_app': current_app is not None,
            'database': db is not None,
            'config': current_app.config is not None
        }
        
        all_ready = all(components.values())
        
        return jsonify({
            'status': 'ready' if all_ready else 'starting',
            'message': 'Startup check completed',
            'timestamp': int(time.time()),
            'components': components
        }), 200 if all_ready else 503
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Startup check failed: {str(e)}',
            'timestamp': int(time.time())
        }), 503
