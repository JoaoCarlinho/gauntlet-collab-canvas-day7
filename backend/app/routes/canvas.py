from flask import Blueprint, request, jsonify
from flasgger import swag_from
from app.services.canvas_service import CanvasService
from app.services.auth_service import require_auth
from app.schemas.validation_schemas import CanvasCreateSchema, CanvasUpdateSchema
from app.middleware.rate_limiting import canvas_rate_limit
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService

canvas_bp = Blueprint('canvas', __name__)
canvas_service = CanvasService()

@canvas_bp.route('/', methods=['GET'])
@canvas_bp.route('', methods=['GET'])
@require_auth
@canvas_rate_limit('get_all')
@swag_from({
    'tags': ['Canvas'],
    'summary': 'Get all canvases',
    'description': 'Get all canvases accessible to the current user (owned, shared, or public)',
    'security': [{'Bearer': []}],
    'responses': {
        200: {
            'description': 'Canvases retrieved successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'canvases': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'string'},
                                'title': {'type': 'string'},
                                'description': {'type': 'string'},
                                'owner_id': {'type': 'string'},
                                'is_public': {'type': 'boolean'},
                                'created_at': {'type': 'string'},
                                'updated_at': {'type': 'string'},
                                'object_count': {'type': 'integer'},
                                'collaborator_count': {'type': 'integer'}
                            }
                        }
                    }
                }
            }
        },
        401: {
            'description': 'Unauthorized - invalid or missing token',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        }
    }
})
def get_canvases(current_user):
    """Get all canvases accessible to the current user with comprehensive security validation."""
    try:
        # Validate user ID format
        from app.utils.validators import InputValidator
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        canvases = canvas_service.get_user_canvases(user_id)
        return jsonify({
            'canvases': [canvas.to_dict() for canvas in canvases]
        }), 200
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@canvas_bp.route('/', methods=['POST'])
@canvas_bp.route('', methods=['POST'])
@require_auth
@canvas_rate_limit('create')
@swag_from({
    'tags': ['Canvas'],
    'summary': 'Create a new canvas',
    'description': 'Create a new canvas owned by the current user with comprehensive security validation',
    'security': [{'Bearer': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'title': {
                        'type': 'string',
                        'description': 'Canvas title (1-255 characters)'
                    },
                    'description': {
                        'type': 'string',
                        'description': 'Canvas description (0-2000 characters, optional)'
                    },
                    'is_public': {
                        'type': 'boolean',
                        'description': 'Whether the canvas is public (optional, default: false)'
                    }
                },
                'required': ['title']
            }
        }
    ],
    'responses': {
        201: {
            'description': 'Canvas created successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'canvas': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'title': {'type': 'string'},
                            'description': {'type': 'string'},
                            'owner_id': {'type': 'string'},
                            'is_public': {'type': 'boolean'},
                            'created_at': {'type': 'string'},
                            'updated_at': {'type': 'string'}
                        }
                    }
                }
            }
        },
        400: {
            'description': 'Bad request - missing required fields or invalid data',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'details': {'type': 'object'}
                }
            }
        },
        401: {
            'description': 'Unauthorized - invalid or missing token',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        },
        429: {
            'description': 'Rate limit exceeded',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'retry_after': {'type': 'number'}
                }
            }
        }
    }
})
def create_canvas(current_user):
    """Create a new canvas with comprehensive security validation."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate input using comprehensive schema
        schema = CanvasCreateSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as e:
            return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
        
        title = validated_data['title']
        description = validated_data.get('description', '')
        is_public = validated_data.get('is_public', False)
        
        # Additional security validations
        from app.utils.validators import InputValidator
        
        # Validate title length and content
        try:
            title = InputValidator.validate_string_length(
                title, 'title', 255, 1
            )
        except ValidationError as e:
            return jsonify({'error': f'Invalid title: {str(e)}'}), 400
        
        # Validate description length if provided
        if description:
            try:
                description = InputValidator.validate_string_length(
                    description, 'description', 2000, 0
                )
            except ValidationError as e:
                return jsonify({'error': f'Invalid description: {str(e)}'}), 400
        
        # Validate is_public is boolean
        if not isinstance(is_public, bool):
            return jsonify({'error': 'is_public must be a boolean value'}), 400
        
        # Sanitize content
        title = SanitizationService.sanitize_canvas_title(title)
        if description:
            description = SanitizationService.sanitize_canvas_description(description)
        
        # Validate owner ID format
        try:
            owner_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        canvas = canvas_service.create_canvas(
            title=title,
            description=description,
            owner_id=owner_id,
            is_public=is_public
        )
        
        return jsonify({
            'message': 'Canvas created successfully',
            'canvas': canvas.to_dict()
        }), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@canvas_bp.route('/<canvas_id>', methods=['GET'])
@require_auth
@canvas_rate_limit('get')
@swag_from({
    'tags': ['Canvas'],
    'summary': 'Get a specific canvas',
    'description': 'Get details of a specific canvas by ID',
    'security': [{'Bearer': []}],
    'parameters': [
        {
            'name': 'canvas_id',
            'in': 'path',
            'type': 'string',
            'required': True,
            'description': 'Canvas ID'
        }
    ],
    'responses': {
        200: {
            'description': 'Canvas retrieved successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'canvas': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'title': {'type': 'string'},
                            'description': {'type': 'string'},
                            'owner_id': {'type': 'string'},
                            'is_public': {'type': 'boolean'},
                            'created_at': {'type': 'string'},
                            'updated_at': {'type': 'string'},
                            'object_count': {'type': 'integer'},
                            'collaborator_count': {'type': 'integer'}
                        }
                    }
                }
            }
        },
        403: {
            'description': 'Access denied - insufficient permissions',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        },
        404: {
            'description': 'Canvas not found',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        }
    }
})
def get_canvas(current_user, canvas_id):
    """Get a specific canvas with comprehensive security validation."""
    try:
        # Validate canvas ID format and length
        from app.utils.validators import InputValidator
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate user ID format
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas:
            return jsonify({'error': 'Canvas not found'}), 404
        
        # Check permission
        has_permission = canvas_service.check_canvas_permission(canvas_id, user_id)
        if not has_permission:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'canvas': canvas.to_dict()
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@canvas_bp.route('/<canvas_id>', methods=['PUT'])
@require_auth
@canvas_rate_limit('update')
def update_canvas(current_user, canvas_id):
    """Update a canvas with comprehensive security validation."""
    try:
        # Validate canvas ID format
        from app.utils.validators import InputValidator
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas:
            return jsonify({'error': 'Canvas not found'}), 404
        
        # Check if user is owner
        if canvas.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can update the canvas'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate input using comprehensive schema
        schema = CanvasUpdateSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as e:
            return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
        
        # Validate and sanitize title if provided
        title = validated_data.get('title')
        if title:
            try:
                title = InputValidator.validate_string_length(
                    title, 'title', 255, 1
                )
                title = SanitizationService.sanitize_canvas_title(title)
                validated_data['title'] = title
            except ValidationError as e:
                return jsonify({'error': f'Invalid title: {str(e)}'}), 400
        
        # Validate and sanitize description if provided
        description = validated_data.get('description')
        if description is not None:
            try:
                description = InputValidator.validate_string_length(
                    description, 'description', 2000, 0
                )
                description = SanitizationService.sanitize_canvas_description(description)
                validated_data['description'] = description
            except ValidationError as e:
                return jsonify({'error': f'Invalid description: {str(e)}'}), 400
        
        # Validate is_public is boolean if provided
        is_public = validated_data.get('is_public')
        if is_public is not None and not isinstance(is_public, bool):
            return jsonify({'error': 'is_public must be a boolean value'}), 400
        
        updated_canvas = canvas_service.update_canvas(canvas_id, **validated_data)
        
        return jsonify({
            'message': 'Canvas updated successfully',
            'canvas': updated_canvas.to_dict()
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@canvas_bp.route('/<canvas_id>', methods=['DELETE'])
@require_auth
@canvas_rate_limit('delete')
def delete_canvas(current_user, canvas_id):
    """Delete a canvas with comprehensive security validation."""
    try:
        # Validate canvas ID format and length
        from app.utils.validators import InputValidator
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate user ID format
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas:
            return jsonify({'error': 'Canvas not found'}), 404
        
        # Check if user is owner
        if canvas.owner_id != user_id:
            return jsonify({'error': 'Only the owner can delete the canvas'}), 403
        
        success = canvas_service.delete_canvas(canvas_id)
        if success:
            return jsonify({'message': 'Canvas deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete canvas'}), 500
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@canvas_bp.route('/<canvas_id>/objects', methods=['GET'])
@require_auth
@canvas_rate_limit('get_objects')
def get_canvas_objects(current_user, canvas_id):
    """Get all objects for a canvas with comprehensive security validation."""
    try:
        # Validate canvas ID format and length
        from app.utils.validators import InputValidator
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate user ID format
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_id, user_id):
            return jsonify({'error': 'Access denied'}), 403
        
        objects = canvas_service.get_canvas_objects(canvas_id)
        return jsonify({
            'objects': [obj.to_dict() for obj in objects]
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500
