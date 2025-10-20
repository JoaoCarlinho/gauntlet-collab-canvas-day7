from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from datetime import datetime, timezone
import os
from marshmallow import ValidationError
from app.services.ai_agent_service import AIAgentService
from app.services.ai_agent_simple import SimpleAIAgentService
from app.services.auth_service import require_auth
from app.services.prompt_service import PromptService
from app.schemas.ai_agent_schemas import (
    CanvasCreationRequestSchema, 
    AIAgentHealthResponseSchema,
    CanvasCreationResponseSchema
)
from app.middleware.rate_limiting import ai_rate_limit
from app.utils.logger import SmartLogger

ai_agent_bp = Blueprint('ai_agent', __name__, url_prefix='/api/ai-agent')
logger = SmartLogger('ai_agent_routes', 'WARNING')

@ai_agent_bp.route('/create-canvas', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
@ai_rate_limit('create_canvas')
def create_canvas_with_ai(current_user):
    """
    Create canvas objects using AI agent based on user query.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - instructions
          properties:
            instructions:
              type: string
              description: Natural language description of what to create
              example: "Create a flowchart for a user login process"
            style:
              type: string
              enum: [modern, corporate, creative, minimal]
              default: modern
              description: Visual style for the canvas
            colorScheme:
              type: string
              enum: [pastel, vibrant, monochrome, default]
              default: default
              description: Color scheme for the canvas
            canvas_id:
              type: string
              description: Optional existing canvas ID to add objects to
    responses:
      200:
        description: Canvas created successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            canvas:
              type: object
              properties:
                id:
                  type: string
                title:
                  type: string
                objects:
                  type: array
                  items:
                    type: object
            message:
              type: string
      400:
        description: Invalid request data
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        # Validate request data
        schema = CanvasCreationRequestSchema()
        data = schema.load(request.json)
        
        # Initialize AI agent service (try fallback service first to avoid OpenAI issues)
        try:
            from app.services.ai_agent_fallback import FallbackAIAgentService
            ai_service = FallbackAIAgentService()
            logger.log_info("Using fallback AI service (no OpenAI dependency)")
        except Exception as e:
            logger.log_error(f"Fallback AI service failed, trying robust service: {str(e)}", e)
            try:
                from app.services.ai_agent_robust import RobustAIAgentService
                ai_service = RobustAIAgentService()
            except Exception as e2:
                logger.log_error(f"Robust AI service failed, trying simple service: {str(e2)}", e2)
                try:
                    ai_service = SimpleAIAgentService()
                except Exception as e3:
                    logger.log_error(f"Simple AI service failed, trying full service: {str(e3)}", e3)
                    try:
                        ai_service = AIAgentService()
                    except Exception as e4:
                        logger.log_error(f"All AI services failed, using emergency fallback: {str(e4)}", e4)
                        # Emergency fallback - create a simple canvas without AI
                        return self._create_emergency_canvas(data, current_user)
        
        # Process the query and generate canvas objects
        result = ai_service.create_canvas_from_query(
            query=data['instructions'],
            user_id=current_user.id,
            canvas_id=data.get('canvas_id'),
            style=data.get('style', 'modern'),
            color_scheme=data.get('colorScheme', 'default')
        )
        
        # Only log success in development
        if os.environ.get('FLASK_ENV') == 'development':
            logger.log_info(f"AI canvas created successfully for user {current_user.id}")
        
        return jsonify({
            'success': True,
            'canvas': {
                'id': result['canvas_id'],
                'title': result['title'],
                'objects': result['objects']
            },
            'message': result['message']
        }), 200
        
    except ValidationError as e:
        logger.log_warning(f"Validation error in AI canvas creation: {e.messages}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'details': e.messages
        }), 400
        
    except ValueError as e:
        logger.log_warning(f"Value error in AI canvas creation: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid request',
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.log_error(f"AI canvas creation failed: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to create canvas',
            'message': str(e)
        }), 500


def _create_emergency_canvas(data, current_user):
        """Emergency fallback when all AI services fail."""
        try:
            import uuid
            from app.models.canvas import Canvas
            from app.models.canvas_object import CanvasObject
            from app.extensions import db
            
            # Create a simple canvas with basic objects
            canvas = Canvas(
                id=str(uuid.uuid4()),
                title=f"Canvas: {data['instructions'][:50]}...",
                owner_id=current_user.id,
                is_public=False
            )
            db.session.add(canvas)
            db.session.commit()
            
            # Create a simple rectangle object
            canvas_object = CanvasObject(
                id=str(uuid.uuid4()),
                canvas_id=canvas.id,
                object_type='rectangle',
                properties=json.dumps({
                    'fill': '#3B82F6',
                    'stroke': '#1E40AF',
                    'text': 'Canvas Object',
                    'fontSize': 14,
                    'x': 100,
                    'y': 100,
                    'width': 200,
                    'height': 100
                }),
                created_by=current_user.id
            )
            db.session.add(canvas_object)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'canvas': {
                    'id': canvas.id,
                    'title': canvas.title,
                    'objects': [{
                        'id': canvas_object.id,
                        'type': canvas_object.object_type,
                        'properties': json.loads(canvas_object.properties)
                    }]
                },
                'message': 'Canvas created with emergency fallback (AI services unavailable)'
            }), 200
            
        except Exception as e:
            logger.log_error(f"Emergency canvas creation failed: {str(e)}", e)
            return jsonify({
                'success': False,
                'error': 'All canvas creation methods failed',
                'message': 'Unable to create canvas at this time'
            }), 500

@ai_agent_bp.route('/health', methods=['GET'])
@ai_rate_limit('health')
def health_check():
    """
    Health check endpoint for AI agent service.
    
    ---
    tags:
      - AI Agent
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
            openai_connected:
              type: boolean
            timestamp:
              type: string
      500:
        description: Service is unhealthy
    """
    try:
        ai_service = AIAgentService()
        # Test OpenAI connection by listing models
        models = ai_service.openai_client.models.list()
        
        return jsonify({
            'status': 'healthy',
            'openai_connected': True,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'model_count': len(models.data) if hasattr(models, 'data') else 0
        }), 200
        
    except Exception as e:
        logger.log_error(f"AI agent health check failed: {str(e)}", e)
        return jsonify({
            'status': 'unhealthy',
            'openai_connected': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@ai_agent_bp.route('/models', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def list_available_models(current_user):
    """
    List available OpenAI models for AI canvas generation.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    responses:
      200:
        description: List of available models
        schema:
          type: object
          properties:
            success:
              type: boolean
            models:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  object:
                    type: string
                  created:
                    type: integer
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        ai_service = AIAgentService()
        models = ai_service.openai_client.models.list()
        
        # Filter for chat completion models
        chat_models = [
            {
                'id': model.id,
                'object': model.object,
                'created': model.created
            }
            for model in models.data
            if 'gpt' in model.id.lower()
        ]
        
        return jsonify({
            'success': True,
            'models': chat_models,
            'current_model': os.environ.get('OPENAI_MODEL', 'gpt-4')
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to list models: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to list models',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/performance', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def get_performance_metrics(current_user):
    """
    Get AI Agent performance metrics.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    responses:
      200:
        description: Performance metrics retrieved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            metrics:
              type: object
              properties:
                total_requests:
                  type: integer
                cache_hits:
                  type: integer
                cache_misses:
                  type: integer
                cache_hit_rate:
                  type: string
                average_response_time:
                  type: string
                cache_size:
                  type: integer
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        ai_service = AIAgentService()
        metrics = ai_service.performance_service.get_performance_metrics()
        
        return jsonify({
            'success': True,
            'metrics': metrics
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get performance metrics: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to get performance metrics',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/security', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def get_security_metrics(current_user):
    """
    Get AI Agent security metrics and status.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    responses:
      200:
        description: Security metrics retrieved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            security_metrics:
              type: object
              properties:
                prompt_injection_patterns:
                  type: integer
                dangerous_keywords:
                  type: integer
                security_limits:
                  type: object
                service_status:
                  type: string
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        ai_service = AIAgentService()
        security_metrics = ai_service.security_service.get_security_metrics()
        
        return jsonify({
            'success': True,
            'security_metrics': security_metrics
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get security metrics: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to get security metrics',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/prompts', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def get_user_prompts(current_user):
    """
    Get user's prompt history.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    parameters:
      - in: query
        name: limit
        type: integer
        default: 50
        description: Maximum number of prompts to return
      - in: query
        name: offset
        type: integer
        default: 0
        description: Number of prompts to skip
      - in: query
        name: status
        type: string
        enum: [pending, processing, completed, failed]
        description: Filter by status
    responses:
      200:
        description: Prompts retrieved successfully
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        prompt_service = PromptService()
        
        # Get query parameters
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        status_filter = request.args.get('status')
        
        prompts = prompt_service.get_user_prompts(
            user_id=current_user.id,
            limit=limit,
            offset=offset,
            status_filter=status_filter
        )
        
        return jsonify({
            'success': True,
            'prompts': [prompt.to_dict() for prompt in prompts],
            'count': len(prompts)
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get user prompts: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to get prompts',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/prompts/<prompt_id>', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def get_prompt_by_id(current_user, prompt_id):
    """
    Get a specific prompt with associated canvases.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    parameters:
      - in: path
        name: prompt_id
        type: string
        required: true
        description: Prompt ID
    responses:
      200:
        description: Prompt retrieved successfully
      401:
        description: Unauthorized
      404:
        description: Prompt not found
      500:
        description: Internal server error
    """
    try:
        prompt_service = PromptService()
        prompt = prompt_service.get_prompt_with_canvases(prompt_id)
        
        if not prompt:
            return jsonify({
                'success': False,
                'error': 'Prompt not found'
            }), 404
        
        # Check authorization
        if prompt.user_id != current_user.id:
            return jsonify({
                'success': False,
                'error': 'Access denied'
            }), 403
        
        # Get canvases associated with this prompt
        canvases = [canvas.to_dict() for canvas in prompt.canvases.all()]
        
        prompt_dict = prompt.to_dict()
        prompt_dict['canvases'] = canvases
        
        return jsonify({
            'success': True,
            'prompt': prompt_dict
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get prompt: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to get prompt',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/prompts/<prompt_id>', methods=['DELETE'])
@require_auth
@ai_rate_limit('models')
def delete_prompt(current_user, prompt_id):
    """
    Delete a prompt.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    parameters:
      - in: path
        name: prompt_id
        type: string
        required: true
        description: Prompt ID
      - in: query
        name: delete_canvases
        type: boolean
        default: false
        description: Whether to delete associated canvases
    responses:
      200:
        description: Prompt deleted successfully
      401:
        description: Unauthorized
      404:
        description: Prompt not found
      500:
        description: Internal server error
    """
    try:
        prompt_service = PromptService()
        prompt = prompt_service.get_prompt_by_id(prompt_id)
        
        if not prompt:
            return jsonify({
                'success': False,
                'error': 'Prompt not found'
            }), 404
        
        # Check authorization
        if prompt.user_id != current_user.id:
            return jsonify({
                'success': False,
                'error': 'Access denied'
            }), 403
        
        delete_canvases = request.args.get('delete_canvases', 'false').lower() == 'true'
        
        success = prompt_service.delete_prompt(prompt_id, delete_canvases=delete_canvases)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Prompt deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete prompt'
            }), 500
        
    except Exception as e:
        logger.log_error(f"Failed to delete prompt: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to delete prompt',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/prompts/stats', methods=['GET'])
@require_auth
@ai_rate_limit('models')
def get_prompt_stats(current_user):
    """
    Get statistics about user's prompts.
    
    ---
    tags:
      - AI Agent
    security:
      - Bearer: []
    responses:
      200:
        description: Statistics retrieved successfully
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        prompt_service = PromptService()
        stats = prompt_service.get_prompts_stats(current_user.id)
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get prompt stats: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to get statistics',
            'message': str(e)
        }), 500
