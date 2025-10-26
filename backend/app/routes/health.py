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
            from sqlalchemy import text
            with db.engine.connect() as connection:
                connection.execute(text('SELECT 1'))
        except Exception as e:
            db_status = f'unhealthy: {str(e)}'
        
        # Check environment variables
        env_status = 'healthy'
        required_env_vars = ['FLASK_ENV']
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        if missing_vars:
            env_status = f'unhealthy: missing {missing_vars}'
        
        # Check cache connection (if available)
        cache_status = 'healthy'
        try:
            from app.extensions import cache_client
            if cache_client:
                # Test cache functionality
                cache_client.set('health_check', 'test', timeout=10)
                test_value = cache_client.get('health_check')
                if test_value != 'test':
                    cache_status = 'unhealthy: cache test failed'
            else:
                cache_status = 'not_configured'
        except Exception as e:
            cache_status = f'unhealthy: {str(e)}'
        
        overall_status = 'healthy' if all(status == 'healthy' or status == 'not_configured' 
                                        for status in [db_status, env_status, cache_status]) else 'unhealthy'
        
        return jsonify({
            'status': overall_status,
            'message': 'Readiness check completed',
            'timestamp': int(time.time()),
            'checks': {
                'database': db_status,
                'environment': env_status,
                'cache': cache_status
            }
        }), 200 if overall_status == 'healthy' else 503
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'message': f'Readiness check failed: {str(e)}',
            'timestamp': int(time.time())
        }), 503

@health_bp.route('/database')
def database_status():
    """Detailed database status check."""
    try:
        from sqlalchemy import text
        import time as time_module

        start_time = time_module.time()

        # Test database connection
        with db.engine.connect() as connection:
            connection.execute(text('SELECT 1'))

        connection_time = (time_module.time() - start_time) * 1000  # Convert to ms

        # Get database URL (masked for security)
        db_url = current_app.config['SQLALCHEMY_DATABASE_URI']
        db_type = 'unknown'
        if 'postgresql' in db_url.lower():
            db_type = 'PostgreSQL'
        elif 'sqlite' in db_url.lower():
            db_type = 'SQLite'
        elif 'mysql' in db_url.lower():
            db_type = 'MySQL'

        # Mask the password in URL
        masked_url = db_url
        if '@' in masked_url:
            parts = masked_url.split('@')
            if '://' in parts[0]:
                protocol_and_creds = parts[0].split('://')
                if ':' in protocol_and_creds[1]:
                    user = protocol_and_creds[1].split(':')[0]
                    masked_url = f"{protocol_and_creds[0]}://{user}:***@{parts[1]}"

        return jsonify({
            'status': 'healthy',
            'database_type': db_type,
            'connection_url': masked_url,
            'connection_time_ms': round(connection_time, 2),
            'is_sqlite': 'sqlite' in db_url.lower(),
            'warning': 'SQLite detected - objects will be lost on restart!' if 'sqlite' in db_url.lower() else None,
            'timestamp': int(time.time())
        }), 200

    except Exception as e:
        import traceback
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'error_trace': traceback.format_exc(),
            'warning': 'DATABASE CONNECTION FAILED - Objects cannot be saved!',
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
