"""
Comprehensive error handling middleware for CollabCanvas API
Provides secure error handling to prevent information disclosure
"""

from flask import jsonify, request, g
from functools import wraps
import logging
import traceback
from typing import Dict, Any, Optional
from werkzeug.exceptions import HTTPException
from app.utils.validators import ValidationError

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Base class for security-related errors."""
    pass


class InputValidationError(SecurityError):
    """Error for input validation failures."""
    pass


class PermissionError(SecurityError):
    """Error for permission-related failures."""
    pass


class RateLimitError(SecurityError):
    """Error for rate limiting failures."""
    pass


class ErrorHandler:
    """Centralized error handling service."""
    
    def __init__(self, app=None):
        self.app = app
        self.error_messages = {
            # Generic errors
            'internal_server_error': 'Internal server error',
            'bad_request': 'Bad request',
            'unauthorized': 'Unauthorized access',
            'forbidden': 'Access forbidden',
            'not_found': 'Resource not found',
            'conflict': 'Resource conflict',
            'validation_failed': 'Validation failed',
            'rate_limit_exceeded': 'Rate limit exceeded',
            
            # Authentication errors
            'invalid_token': 'Invalid authentication token',
            'token_expired': 'Authentication token expired',
            'missing_token': 'Authentication token required',
            'invalid_credentials': 'Invalid credentials',
            
            # Authorization errors
            'insufficient_permissions': 'Insufficient permissions',
            'access_denied': 'Access denied',
            'owner_only': 'Only the owner can perform this action',
            'edit_permission_required': 'Edit permission required',
            
            # Validation errors
            'invalid_input': 'Invalid input provided',
            'missing_required_field': 'Required field is missing',
            'invalid_format': 'Invalid format',
            'out_of_range': 'Value out of allowed range',
            'duplicate_resource': 'Resource already exists',
            
            # Business logic errors
            'self_invitation': 'Cannot invite yourself',
            'self_removal': 'Cannot remove yourself',
            'canvas_not_found': 'Canvas not found',
            'user_not_found': 'User not found',
            'object_not_found': 'Object not found',
            'invitation_not_found': 'Invitation not found',
            'invitation_expired': 'Invitation has expired'
        }
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize error handling with Flask app."""
        self.app = app
        
        # Register global error handlers
        app.register_error_handler(ValidationError, self.handle_validation_error)
        app.register_error_handler(SecurityError, self.handle_security_error)
        app.register_error_handler(HTTPException, self.handle_http_error)
        app.register_error_handler(Exception, self.handle_generic_error)
        
        # Register before request handler for logging
        app.before_request(self.before_request)
        
        # Register after request handler for response logging
        app.after_request(self.after_request)
    
    def before_request(self):
        """Log incoming requests in development mode."""
        if self.app.config.get('DEBUG', False):
            logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")
    
    def after_request(self, response):
        """Log responses in development mode."""
        if self.app.config.get('DEBUG', False):
            logger.info(f"Response: {response.status_code} for {request.method} {request.path}")
        return response
    
    def handle_validation_error(self, error: ValidationError) -> tuple:
        """Handle validation errors securely."""
        logger.warning(f"Validation error: {str(error)}")
        
        # Don't expose internal validation details
        return jsonify({
            'error': self.error_messages['validation_failed'],
            'message': 'The provided data is invalid'
        }), 400
    
    def handle_security_error(self, error: SecurityError) -> tuple:
        """Handle security-related errors."""
        logger.warning(f"Security error: {str(error)}")
        
        # Map specific security errors to generic messages
        if isinstance(error, InputValidationError):
            return jsonify({
                'error': self.error_messages['invalid_input'],
                'message': 'The provided input is invalid'
            }), 400
        elif isinstance(error, PermissionError):
            return jsonify({
                'error': self.error_messages['access_denied'],
                'message': 'You do not have permission to perform this action'
            }), 403
        elif isinstance(error, RateLimitError):
            return jsonify({
                'error': self.error_messages['rate_limit_exceeded'],
                'message': 'Too many requests. Please try again later'
            }), 429
        else:
            return jsonify({
                'error': self.error_messages['internal_server_error'],
                'message': 'An error occurred while processing your request'
            }), 500
    
    def handle_http_error(self, error: HTTPException) -> tuple:
        """Handle HTTP exceptions."""
        logger.warning(f"HTTP error: {error.code} - {error.description}")
        
        # Map HTTP status codes to secure error messages
        error_messages = {
            400: self.error_messages['bad_request'],
            401: self.error_messages['unauthorized'],
            403: self.error_messages['forbidden'],
            404: self.error_messages['not_found'],
            409: self.error_messages['conflict'],
            429: self.error_messages['rate_limit_exceeded']
        }
        
        message = error_messages.get(error.code, self.error_messages['internal_server_error'])
        
        return jsonify({
            'error': message,
            'message': 'An error occurred while processing your request'
        }), error.code
    
    def handle_generic_error(self, error: Exception) -> tuple:
        """Handle generic exceptions securely."""
        # Log the full error for debugging
        logger.error(f"Unhandled error: {str(error)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Don't expose internal error details to clients
        return jsonify({
            'error': self.error_messages['internal_server_error'],
            'message': 'An unexpected error occurred'
        }), 500
    
    def create_error_response(self, error_type: str, message: Optional[str] = None, 
                            status_code: int = 500, details: Optional[Dict[str, Any]] = None) -> tuple:
        """Create a standardized error response."""
        error_message = self.error_messages.get(error_type, self.error_messages['internal_server_error'])
        
        response_data = {
            'error': error_message,
            'message': message or 'An error occurred while processing your request'
        }
        
        if details and self.app.config.get('DEBUG', False):
            # Only include details in development mode
            response_data['details'] = details
        
        return jsonify(response_data), status_code


# Global error handler instance
error_handler = ErrorHandler()


def init_error_handling(app):
    """Initialize error handling for the Flask app."""
    error_handler.init_app(app)
    return error_handler


def secure_error_handler(f):
    """Decorator for secure error handling in route functions."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            return error_handler.handle_validation_error(e)
        except SecurityError as e:
            return error_handler.handle_security_error(e)
        except HTTPException as e:
            return error_handler.handle_http_error(e)
        except Exception as e:
            return error_handler.handle_generic_error(e)
    return decorated_function


def handle_validation_error(error_message: str, details: Optional[Dict[str, Any]] = None) -> tuple:
    """Create a validation error response."""
    return error_handler.create_error_response(
        'validation_failed', 
        error_message, 
        400, 
        details
    )


def handle_permission_error(error_message: str = None) -> tuple:
    """Create a permission error response."""
    return error_handler.create_error_response(
        'access_denied', 
        error_message or 'You do not have permission to perform this action', 
        403
    )


def handle_not_found_error(resource_type: str = 'Resource') -> tuple:
    """Create a not found error response."""
    return error_handler.create_error_response(
        'not_found', 
        f'{resource_type} not found', 
        404
    )


def handle_conflict_error(error_message: str) -> tuple:
    """Create a conflict error response."""
    return error_handler.create_error_response(
        'conflict', 
        error_message, 
        409
    )


def handle_internal_error(error_message: str = None) -> tuple:
    """Create an internal server error response."""
    return error_handler.create_error_response(
        'internal_server_error', 
        error_message or 'An unexpected error occurred', 
        500
    )


# Utility functions for common error scenarios
def validate_required_fields(data: Dict[str, Any], required_fields: list) -> Optional[tuple]:
    """Validate that required fields are present in request data."""
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    
    if missing_fields:
        return handle_validation_error(
            f'Missing required fields: {", ".join(missing_fields)}',
            {'missing_fields': missing_fields}
        )
    
    return None


def validate_user_permission(user_id: str, resource_owner_id: str, action: str = 'access') -> Optional[tuple]:
    """Validate that a user has permission to perform an action on a resource."""
    if user_id != resource_owner_id:
        return handle_permission_error(f'Only the owner can {action} this resource')
    
    return None


def validate_canvas_access(canvas, user_id: str, required_permission: str = 'view') -> Optional[tuple]:
    """Validate that a user has access to a canvas."""
    if not canvas:
        return handle_not_found_error('Canvas')
    
    # Check if user is owner
    if canvas.owner_id == user_id:
        return None
    
    # Check if canvas is public and user only needs view permission
    if canvas.is_public and required_permission == 'view':
        return None
    
    # Check collaboration permissions
    from app.services.canvas_service import CanvasService
    canvas_service = CanvasService()
    
    if not canvas_service.check_canvas_permission(canvas.id, user_id, required_permission):
        return handle_permission_error(f'{required_permission.capitalize()} permission required')
    
    return None


def validate_object_access(object_id: str, user_id: str, required_permission: str = 'view') -> Optional[tuple]:
    """Validate that a user has access to an object."""
    from app.models import CanvasObject
    from app.services.canvas_service import CanvasService
    
    canvas_object = CanvasObject.query.filter_by(id=object_id).first()
    if not canvas_object:
        return handle_not_found_error('Object')
    
    canvas_service = CanvasService()
    if not canvas_service.check_canvas_permission(canvas_object.canvas_id, user_id, required_permission):
        return handle_permission_error(f'{required_permission.capitalize()} permission required')
    
    return None


def validate_invitation_access(invitation_id: str, user_id: str) -> Optional[tuple]:
    """Validate that a user has access to an invitation."""
    from app.services.collaboration_service import CollaborationService
    
    collaboration_service = CollaborationService()
    invitation = collaboration_service.get_invitation_by_id(invitation_id)
    
    if not invitation:
        return handle_not_found_error('Invitation')
    
    if invitation.is_expired():
        return handle_conflict_error('Invitation has expired')
    
    return None
