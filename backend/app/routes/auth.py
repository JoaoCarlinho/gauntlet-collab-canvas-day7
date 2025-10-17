from flask import Blueprint, request, jsonify
from flasgger import swag_from
from app.services.auth_service import AuthService, require_auth
from app.middleware.rate_limiting import auth_rate_limit
from app.middleware.error_handling import secure_error_handler, handle_validation_error, handle_internal_error
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@auth_rate_limit('register')
@secure_error_handler
@swag_from({
    'tags': ['Authentication'],
    'summary': 'Register a new user',
    'description': 'Register a new user with Firebase ID token',
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'idToken': {
                        'type': 'string',
                        'description': 'Firebase ID token'
                    }
                },
                'required': ['idToken']
            }
        }
    ],
    'responses': {
        201: {
            'description': 'User registered successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'email': {'type': 'string'},
                            'name': {'type': 'string'},
                            'avatar_url': {'type': 'string'},
                            'created_at': {'type': 'string'},
                            'updated_at': {'type': 'string'}
                        }
                    }
                }
            }
        },
        400: {
            'description': 'Bad request - missing or invalid ID token',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        }
    }
})
def register():
    """Register a new user with comprehensive security validation."""
    data = request.get_json()
    if not data:
        return handle_validation_error('Request body is required')
    
    id_token = data.get('idToken')
    if not id_token:
        return handle_validation_error('ID token is required')
    
    # Validate ID token format and length
    from app.utils.validators import InputValidator
    try:
        id_token = InputValidator.validate_string_length(id_token, 'idToken', 1, 2000)
    except ValidationError as e:
        return handle_validation_error(f'Invalid ID token: {str(e)}')
    
    auth_service = AuthService()
    user = auth_service.register_user(id_token)
    
    return jsonify({
        'message': 'User registered successfully',
        'user': user.to_dict()
    }), 201

@auth_bp.route('/me', methods=['GET'])
@require_auth
@auth_rate_limit('get_user')
@secure_error_handler
@swag_from({
    'tags': ['Authentication'],
    'summary': 'Get current user information',
    'description': 'Get information about the currently authenticated user',
    'security': [{'Bearer': []}],
    'responses': {
        200: {
            'description': 'User information retrieved successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'email': {'type': 'string'},
                            'name': {'type': 'string'},
                            'avatar_url': {'type': 'string'},
                            'created_at': {'type': 'string'},
                            'updated_at': {'type': 'string'}
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
def get_current_user(current_user):
    """Get current user information with comprehensive security validation."""
    # Validate user ID format
    from app.utils.validators import InputValidator
    try:
        user_id = InputValidator.validate_user_id(current_user.id)
    except ValidationError as e:
        return handle_validation_error(f'Invalid user ID: {str(e)}')
    
    return jsonify({
        'user': current_user.to_dict()
    }), 200

@auth_bp.route('/verify', methods=['POST'])
@auth_rate_limit('verify')
@secure_error_handler
@swag_from({
    'tags': ['Authentication'],
    'summary': 'Verify Firebase ID token',
    'description': 'Verify a Firebase ID token and return decoded information',
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'idToken': {
                        'type': 'string',
                        'description': 'Firebase ID token to verify'
                    }
                },
                'required': ['idToken']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Token verified successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'valid': {'type': 'boolean'},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'uid': {'type': 'string'},
                            'email': {'type': 'string'},
                            'name': {'type': 'string'}
                        }
                    }
                }
            }
        },
        401: {
            'description': 'Invalid token',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        }
    }
})
def verify_token():
    """Verify Firebase ID token with comprehensive security validation."""
    data = request.get_json()
    if not data:
        return handle_validation_error('Request body is required')
    
    id_token = data.get('idToken')
    if not id_token:
        return handle_validation_error('ID token is required')
    
    # Validate ID token format and length
    from app.utils.validators import InputValidator
    try:
        id_token = InputValidator.validate_string_length(id_token, 'idToken', 1, 2000)
    except ValidationError as e:
        return handle_validation_error(f'Invalid ID token: {str(e)}')
    
    auth_service = AuthService()
    decoded_token = auth_service.verify_token(id_token)
    
    return jsonify({
        'valid': True,
        'user': decoded_token
    }), 200
