from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from flasgger import swag_from
from app.services.canvas_service import CanvasService
from app.services.auth_service import require_auth
from app.schemas.validation_schemas import CanvasObjectSchema
from app.middleware.rate_limiting import object_rate_limit
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService
import json

objects_bp = Blueprint('objects', __name__)
canvas_service = CanvasService()

@objects_bp.route('/', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
@object_rate_limit('create')
@swag_from({
    'tags': ['Objects'],
    'summary': 'Create a new canvas object',
    'description': 'Create a new object (rectangle, circle, text, heart, star, diamond, line, or arrow) on a canvas',
    'security': [{'Bearer': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'canvas_id': {
                        'type': 'string',
                        'description': 'ID of the canvas to add the object to'
                    },
                    'object_type': {
                        'type': 'string',
                        'enum': ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow'],
                        'description': 'Type of object to create'
                    },
                    'properties': {
                        'type': 'object',
                        'description': 'Object properties (position, size, color, etc.)',
                        'properties': {
                            'x': {'type': 'number', 'description': 'X coordinate (-10000 to 10000)'},
                            'y': {'type': 'number', 'description': 'Y coordinate (-10000 to 10000)'},
                            'width': {'type': 'number', 'description': 'Width (1 to 10000 pixels)'},
                            'height': {'type': 'number', 'description': 'Height (1 to 10000 pixels)'},
                            'radius': {'type': 'number', 'description': 'Radius (1 to 10000 pixels)'},
                            'text': {'type': 'string', 'description': 'Text content (max 5000 characters)'},
                            'fill': {'type': 'string', 'description': 'Fill color (hex, rgb, rgba, or named color)'},
                            'stroke': {'type': 'string', 'description': 'Stroke color (hex, rgb, rgba, or named color)'},
                            'strokeWidth': {'type': 'number', 'description': 'Stroke width (1 to 20 pixels)'},
                            'fontSize': {'type': 'number', 'description': 'Font size (8 to 72 pixels)'},
                            'fontFamily': {'type': 'string', 'description': 'Font family (Arial, Helvetica, etc.)'},
                            'points': {'type': 'array', 'description': 'Points array for lines/arrows [x1, y1, x2, y2]'}
                        }
                    }
                },
                'required': ['canvas_id', 'object_type', 'properties']
            }
        }
    ],
    'responses': {
        201: {
            'description': 'Object created successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'object': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'canvas_id': {'type': 'string'},
                            'object_type': {'type': 'string'},
                            'properties': {'type': 'object'},
                            'created_by': {'type': 'string'},
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
        403: {
            'description': 'Access denied - insufficient permissions',
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
def create_object(current_user):
    """Create a new canvas object with comprehensive security validation."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate input using comprehensive schema
        schema = CanvasObjectSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as e:
            return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
        
        canvas_id = validated_data['canvas_id']
        object_type = validated_data['object_type']
        properties = validated_data['properties']
        
        # Additional security validations
        from app.utils.validators import InputValidator
        
        # Validate canvas ID format and length
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate object type enum
        try:
            object_type = InputValidator.validate_enum_value(
                object_type, 'object_type', 
                ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
            )
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400
        
        # Validate object properties with comprehensive bounds checking
        try:
            validated_properties = InputValidator.validate_object_properties(properties, object_type)
        except ValidationError as e:
            return jsonify({'error': f'Invalid object properties: {str(e)}'}), 400
        
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_id, current_user.id, 'edit'):
            return jsonify({'error': 'Edit permission required'}), 403
        
        # Sanitize object properties
        sanitized_properties = SanitizationService.sanitize_object_properties(validated_properties)
        
        # Convert properties to JSON string
        properties_json = json.dumps(sanitized_properties)
        
        canvas_object = canvas_service.create_canvas_object(
            canvas_id=canvas_id,
            object_type=object_type,
            properties=properties_json,
            created_by=current_user.id
        )
        
        return jsonify({
            'message': 'Object created successfully',
            'object': canvas_object.to_dict()
        }), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@objects_bp.route('/<object_id>', methods=['GET'])
@require_auth
@object_rate_limit('get')
def get_object(current_user, object_id):
    """Get a specific canvas object with comprehensive security validation."""
    try:
        # Validate object ID format and length
        from app.utils.validators import InputValidator
        try:
            object_id = InputValidator.validate_string_length(object_id, 'object_id', 1, 100)
        except ValidationError as e:
            return jsonify({'error': f'Invalid object ID: {str(e)}'}), 400
        
        # Validate user ID format
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        from app.models import CanvasObject
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return jsonify({'error': 'Object not found'}), 404
        
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_object.canvas_id, user_id):
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'object': canvas_object.to_dict()
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@objects_bp.route('/<object_id>', methods=['PUT'])
@require_auth
@object_rate_limit('update')
def update_object(current_user, object_id):
    """Update a canvas object with comprehensive security validation."""
    try:
        from app.models import CanvasObject
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return jsonify({'error': 'Object not found'}), 404
        
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_object.canvas_id, current_user.id, 'edit'):
            return jsonify({'error': 'Edit permission required'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate object ID format
        from app.utils.validators import InputValidator
        try:
            object_id = InputValidator.validate_string_length(
                object_id, 'object_id', 255, 1
            )
        except ValidationError as e:
            return jsonify({'error': f'Invalid object ID: {str(e)}'}), 400
        
        # Validate and sanitize properties if provided
        properties = data.get('properties')
        if properties is not None:
            try:
                # Validate object properties with comprehensive bounds checking
                validated_properties = InputValidator.validate_object_properties(
                    properties, canvas_object.object_type
                )
                # Sanitize object properties
                sanitized_properties = SanitizationService.sanitize_object_properties(validated_properties)
                # Convert properties to JSON string
                data['properties'] = json.dumps(sanitized_properties)
            except ValidationError as e:
                return jsonify({'error': f'Invalid object properties: {str(e)}'}), 400
        
        # Validate object type if provided
        object_type = data.get('object_type')
        if object_type:
            try:
                object_type = InputValidator.validate_enum_value(
                    object_type, 'object_type', 
                    ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
                )
                data['object_type'] = object_type
            except ValidationError as e:
                return jsonify({'error': str(e)}), 400
        
        updated_object = canvas_service.update_canvas_object(object_id, **data)
        
        return jsonify({
            'message': 'Object updated successfully',
            'object': updated_object.to_dict()
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@objects_bp.route('/<object_id>', methods=['DELETE'])
@require_auth
@object_rate_limit('delete')
def delete_object(current_user, object_id):
    """Delete a canvas object with comprehensive security validation."""
    try:
        # Validate object ID format and length
        from app.utils.validators import InputValidator
        try:
            object_id = InputValidator.validate_string_length(object_id, 'object_id', 1, 100)
        except ValidationError as e:
            return jsonify({'error': f'Invalid object ID: {str(e)}'}), 400
        
        # Validate user ID format
        try:
            user_id = InputValidator.validate_user_id(current_user.id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid user ID: {str(e)}'}), 400
        
        from app.models import CanvasObject
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return jsonify({'error': 'Object not found'}), 404
        
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_object.canvas_id, user_id, 'edit'):
            return jsonify({'error': 'Edit permission required'}), 403
        
        success = canvas_service.delete_canvas_object(object_id)
        if success:
            return jsonify({'message': 'Object deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete object'}), 500
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500
