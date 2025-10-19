"""
Socket.IO Error Handlers
Provides comprehensive error handling and debugging for Socket.IO events.
"""

from flask_socketio import emit
from app.utils.logger import SmartLogger
import traceback
import json
import time

# Initialize logger
error_logger = SmartLogger('socket_error_handler', 'INFO')


def handle_socket_error(error, event_type=None, user_id=None, additional_data=None):
    """
    Handle Socket.IO errors with comprehensive logging and user-friendly responses.
    
    Args:
        error: The error that occurred
        event_type: Type of Socket.IO event that failed
        user_id: ID of the user who triggered the event
        additional_data: Additional context data
    """
    try:
        # Log the error with context
        error_context = {
            'event_type': event_type,
            'user_id': user_id,
            'error_type': type(error).__name__,
            'error_message': str(error),
            'additional_data': additional_data
        }
        
        error_logger.log_error(f"Socket.IO error in {event_type}: {str(error)}", error, error_context)
        
        # Create structured error response
        error_response = {
            'error': {
                'message': str(error),
                'type': type(error).__name__,
                'timestamp': int(time.time() * 1000),
                'event_type': event_type,
                'user_id': user_id,
                'error_id': f"err_{int(time.time() * 1000)}_{hash(str(error)) % 10000:04d}"
            },
            'timestamp': int(time.time() * 1000),
            'type': 'general_error'
        }
        
        # Add additional data if provided
        if additional_data:
            error_response['error']['additional_data'] = additional_data
        
        # Emit structured error response
        emit('socket_error', error_response)
        
        # Determine error type and provide appropriate response
        if isinstance(error, ConnectionError):
            emit('error', {
                'message': 'Connection error occurred. Please check your network connection.',
                'type': 'connection_error',
                'code': 'CONNECTION_ERROR'
            })
        elif isinstance(error, TimeoutError):
            emit('error', {
                'message': 'Request timed out. Please try again.',
                'type': 'timeout_error',
                'code': 'TIMEOUT_ERROR'
            })
        elif isinstance(error, PermissionError):
            emit('error', {
                'message': 'Permission denied. You may not have access to this resource.',
                'type': 'permission_error',
                'code': 'PERMISSION_ERROR'
            })
        elif isinstance(error, ValueError):
            emit('error', {
                'message': 'Invalid data provided. Please check your input.',
                'type': 'validation_error',
                'code': 'VALIDATION_ERROR'
            })
        elif isinstance(error, KeyError):
            emit('error', {
                'message': 'Required data missing. Please provide all required fields.',
                'type': 'missing_data_error',
                'code': 'MISSING_DATA_ERROR'
            })
        else:
            # Generic error handling
            emit('error', {
                'message': 'An unexpected error occurred. Please try again.',
                'type': 'generic_error',
                'code': 'GENERIC_ERROR'
            })
        
    except Exception as e:
        # Fallback error handling if the error handler itself fails
        error_logger.log_error(f"Error handler failed: {str(e)}", e)
        emit('error', {
            'message': 'An error occurred while processing your request.',
            'type': 'handler_error',
            'code': 'HANDLER_ERROR'
        })


def handle_authentication_error(error, event_type=None):
    """
    Handle Socket.IO authentication errors specifically.
    
    Args:
        error: The authentication error
        event_type: Type of Socket.IO event that failed
    """
    try:
        error_logger.log_error(f"Socket.IO authentication error in {event_type}: {str(error)}", error)
        
        emit('error', {
            'message': 'Authentication failed. Please log in again.',
            'type': 'authentication_error',
            'code': 'AUTH_ERROR',
            'action': 'redirect_to_login'
        })
        
    except Exception as e:
        error_logger.log_error(f"Authentication error handler failed: {str(e)}", e)
        emit('error', {
            'message': 'Authentication error occurred.',
            'type': 'auth_handler_error',
            'code': 'AUTH_HANDLER_ERROR'
        })


def handle_validation_error(error, event_type=None, validation_details=None):
    """
    Handle Socket.IO validation errors specifically.
    
    Args:
        error: The validation error
        event_type: Type of Socket.IO event that failed
        validation_details: Details about what validation failed
    """
    try:
        error_logger.log_error(f"Socket.IO validation error in {event_type}: {str(error)}", error)
        
        emit('error', {
            'message': 'Invalid data provided. Please check your input.',
            'type': 'validation_error',
            'code': 'VALIDATION_ERROR',
            'details': validation_details
        })
        
    except Exception as e:
        error_logger.log_error(f"Validation error handler failed: {str(e)}", e)
        emit('error', {
            'message': 'Validation error occurred.',
            'type': 'validation_handler_error',
            'code': 'VALIDATION_HANDLER_ERROR'
        })


def handle_rate_limit_error(event_type, user_id, limit_info):
    """
    Handle Socket.IO rate limit errors specifically.
    
    Args:
        event_type: Type of Socket.IO event that was rate limited
        user_id: ID of the user who hit the rate limit
        limit_info: Information about the rate limit
    """
    try:
        error_logger.log_warning(f"Rate limit exceeded for user {user_id} on event {event_type}")
        
        emit('error', {
            'message': f'Rate limit exceeded. Please wait before trying again.',
            'type': 'rate_limit_error',
            'code': 'RATE_LIMIT_ERROR',
            'limit_info': limit_info
        })
        
    except Exception as e:
        error_logger.log_error(f"Rate limit error handler failed: {str(e)}", e)
        emit('error', {
            'message': 'Rate limit error occurred.',
            'type': 'rate_limit_handler_error',
            'code': 'RATE_LIMIT_HANDLER_ERROR'
        })


def handle_permission_error(error, event_type=None, user_id=None, resource_id=None):
    """
    Handle Socket.IO permission errors specifically.
    
    Args:
        error: The permission error
        event_type: Type of Socket.IO event that failed
        user_id: ID of the user who lacks permission
        resource_id: ID of the resource they tried to access
    """
    try:
        error_logger.log_warning(f"Permission denied for user {user_id} on event {event_type} for resource {resource_id}")
        
        emit('error', {
            'message': 'You do not have permission to perform this action.',
            'type': 'permission_error',
            'code': 'PERMISSION_ERROR',
            'resource_id': resource_id
        })
        
    except Exception as e:
        error_logger.log_error(f"Permission error handler failed: {str(e)}", e)
        emit('error', {
            'message': 'Permission error occurred.',
            'type': 'permission_handler_error',
            'code': 'PERMISSION_HANDLER_ERROR'
        })


def log_socket_event(event_type, user_id=None, success=True, additional_data=None):
    """
    Log Socket.IO events for debugging and monitoring.
    
    Args:
        event_type: Type of Socket.IO event
        user_id: ID of the user who triggered the event
        success: Whether the event was successful
        additional_data: Additional context data
    """
    try:
        log_data = {
            'event_type': event_type,
            'user_id': user_id,
            'success': success,
            'additional_data': additional_data
        }
        
        if success:
            error_logger.log_info(f"Socket.IO event successful: {event_type}", log_data)
        else:
            error_logger.log_warning(f"Socket.IO event failed: {event_type}", log_data)
            
    except Exception as e:
        error_logger.log_error(f"Failed to log socket event: {str(e)}", e)


def create_error_response(error_type, message, code=None, additional_data=None):
    """
    Create a standardized error response for Socket.IO events.
    
    Args:
        error_type: Type of error
        message: Error message
        code: Error code
        additional_data: Additional data to include
        
    Returns:
        Dictionary containing error response
    """
    response = {
        'message': message,
        'type': error_type,
        'timestamp': error_logger.get_timestamp()
    }
    
    if code:
        response['code'] = code
    
    if additional_data:
        response['data'] = additional_data
    
    return response


def emit_error_response(error_type, message, code=None, additional_data=None):
    """
    Emit a standardized error response for Socket.IO events.
    
    Args:
        error_type: Type of error
        message: Error message
        code: Error code
        additional_data: Additional data to include
    """
    try:
        response = create_error_response(error_type, message, code, additional_data)
        emit('error', response)
    except Exception as e:
        error_logger.log_error(f"Failed to emit error response: {str(e)}", e)
        # Fallback to simple error message
        emit('error', {'message': 'An error occurred'})
