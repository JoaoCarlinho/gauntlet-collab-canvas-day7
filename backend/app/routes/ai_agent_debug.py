"""
Debug routes for AI Agent to help identify 500 errors.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import os
import traceback
from app.utils.logger import SmartLogger
from app.services.openai_client_factory import OpenAIClientFactory

ai_agent_debug_bp = Blueprint('ai_agent_debug', __name__, url_prefix='/api/ai-agent/debug')
logger = SmartLogger('ai_agent_debug', 'INFO')

@ai_agent_debug_bp.route('/environment', methods=['GET'])
def check_environment():
    """Check environment variables and configuration."""
    try:
        env_vars = {
            'OPENAI_API_KEY': 'SET' if os.environ.get('OPENAI_API_KEY') else 'NOT SET',
            'FLASK_ENV': os.environ.get('FLASK_ENV', 'NOT SET'),
            'DEBUG': os.environ.get('DEBUG', 'NOT SET'),
            'CORS_ORIGINS': os.environ.get('CORS_ORIGINS', 'NOT SET')
        }
        
        return jsonify({
            'status': 'success',
            'environment': env_vars,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Environment check failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@ai_agent_debug_bp.route('/imports', methods=['GET'])
def check_imports():
    """Check if all required imports are working."""
    try:
        import_results = {}
        
        # Test OpenAI import
        try:
            import openai
            import_results['openai'] = 'SUCCESS'
        except Exception as e:
            import_results['openai'] = f'FAILED: {str(e)}'
        
        # Test AI Agent Service import
        try:
            from app.services.ai_agent_service import AIAgentService
            import_results['ai_agent_service'] = 'SUCCESS'
        except Exception as e:
            import_results['ai_agent_service'] = f'FAILED: {str(e)}'
        
        # Test AI Performance Service import
        try:
            from app.services.ai_performance_service import AIPerformanceService
            import_results['ai_performance_service'] = 'SUCCESS'
        except Exception as e:
            import_results['ai_performance_service'] = f'FAILED: {str(e)}'
        
        # Test AI Security Service import
        try:
            from app.services.ai_security_service import AISecurityService
            import_results['ai_security_service'] = 'SUCCESS'
        except Exception as e:
            import_results['ai_security_service'] = f'FAILED: {str(e)}'
        
        # Test Schemas import
        try:
            from app.schemas.ai_agent_schemas import CanvasCreationRequestSchema
            import_results['ai_agent_schemas'] = 'SUCCESS'
        except Exception as e:
            import_results['ai_agent_schemas'] = f'FAILED: {str(e)}'
        
        return jsonify({
            'status': 'success',
            'imports': import_results,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Import check failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@ai_agent_debug_bp.route('/service-init', methods=['GET'])
def test_service_initialization():
    """Test AI Agent service initialization."""
    try:
        from app.services.ai_agent_service import AIAgentService
        
        # Try to initialize the service
        ai_service = AIAgentService()
        
        return jsonify({
            'status': 'success',
            'message': 'AI Agent Service initialized successfully',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Service initialization failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@ai_agent_debug_bp.route('/openai-test', methods=['GET'])
def test_openai_connection():
    """Test OpenAI API connection."""
    try:
        import openai
        
        # Check if API key is set
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return jsonify({
                'status': 'error',
                'error': 'OPENAI_API_KEY not set',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 500
        
        # Create OpenAI client via factory for compatibility
        client = OpenAIClientFactory.create_client(api_key)
        if not client:
            return jsonify({
                'status': 'error',
                'error': 'Failed to initialize OpenAI client',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 500
        
        # Try to list models (this will test the connection)
        models = client.models.list()
        
        return jsonify({
            'status': 'success',
            'message': 'OpenAI connection successful',
            'model_count': len(models.data) if hasattr(models, 'data') else 0,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"OpenAI connection test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@ai_agent_debug_bp.route('/test-request', methods=['POST'])
def test_ai_request():
    """Test a simple AI request to identify issues."""
    try:
        from app.services.ai_agent_service import AIAgentService
        
        # Get test data from request
        data = request.json or {}
        test_query = data.get('query', 'Create a simple rectangle')
        
        # Initialize service
        ai_service = AIAgentService()
        
        # Test the core method
        result = ai_service.create_canvas_from_query(
            query=test_query,
            user_id='test-user-id',
            style='modern',
            color_scheme='default'
        )
        
        return jsonify({
            'status': 'success',
            'message': 'AI request test successful',
            'result': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.log_error(f"AI request test failed: {str(e)}", e)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
