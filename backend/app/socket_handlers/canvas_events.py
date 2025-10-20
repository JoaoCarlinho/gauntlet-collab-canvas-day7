from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService
from app.extensions import cache_client
from app.schemas.validation_schemas import ObjectUpdateEventSchema
from app.middleware.rate_limiting import check_socket_rate_limit
from app.middleware.socket_security import (
    secure_socket_event, authenticate_socket_user, check_canvas_permission,
    sanitize_broadcast_data, SocketAuthenticationError, SocketAuthorizationError
)
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService
from app.utils.logger import SmartLogger
from app.utils.railway_logger import railway_logger, log_socket_event, log_auth_event, log_canvas_event, log_object_event
from app.socket_handlers.error_handlers import (
    handle_socket_error, handle_authentication_error, handle_validation_error,
    handle_permission_error, emit_error_response
)
from app.utils.socket_message_validator import SocketMessageValidator
import json

def register_canvas_handlers(socketio):
    """Register canvas-related Socket.IO event handlers.
    
    Note: AI generation events (ai_generation_started, ai_generation_completed, 
    ai_generation_failed) are emitted from AIAgentService and listened to by the frontend.
    They are not handled as incoming socket events here.
    """
    
    def authenticate_socket_user(id_token):
        """Authenticate user for Socket.IO events."""
        try:
            # Use Railway-optimized logging instead of print statements
            railway_logger.log('socket_io', 10, f"Socket.IO authentication attempt, token length: {len(id_token) if id_token else 0}")
            
            auth_service = AuthService()
            decoded_token = auth_service.verify_token(id_token)
            user_id = decoded_token.get('uid', 'unknown')
            railway_logger.log('socket_io', 10, f"Token verified for user: {user_id}")
            
            user = auth_service.get_user_by_id(decoded_token['uid'])
            if not user:
                railway_logger.log('socket_io', 10, "User not found in database, registering...")
                user = auth_service.register_user(id_token)
                log_auth_event(user_id, 'register', True)
            else:
                log_auth_event(user_id, 'authenticate', True)
            
            return user
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Socket.IO authentication failed: {str(e)}")
            raise e
    
    @socketio.on('join_user_room')
    @secure_socket_event('join_user_room', 'view')
    def handle_join_user_room(data):
        """Handle user joining their personal room for AI generation updates."""
        try:
            user = data.get('_authenticated_user')
            user_room = f'user_{user.id}'
            
            # Join the user's personal room
            join_room(user_room)
            
            railway_logger.log('socket_io', 10, f"User {user.id} joined personal room: {user_room}")
            
            emit('joined_user_room', {
                'room': user_room,
                'user_id': user.id
            })
            
        except Exception as e:
            handle_socket_error(e, 'join_user_room', data.get('_authenticated_user', {}).get('id'))
            log_socket_event('user', 'join_user_room', False)
    
    @socketio.on('join_canvas')
    @secure_socket_event('join_canvas', 'view')
    def handle_join_canvas(data):
        """Handle user joining a canvas room with comprehensive security."""
        try:
            canvas_id = data.get('canvas_id')
            user = data.get('_authenticated_user')
            
            # Join the canvas room
            join_room(canvas_id)
            
            # Prepare user data for broadcast (sanitized)
            user_data = user.to_dict()
            sanitized_user_data = sanitize_broadcast_data({'user': user_data})['user']
            
            # Store user info in session
            emit('joined_canvas', {
                'canvas_id': canvas_id,
                'user': sanitized_user_data
            })
            
            # Notify others in the room (sanitized data)
            emit('user_joined', {
                'user': sanitized_user_data
            }, room=canvas_id, include_self=False)
            
        except Exception as e:
            handle_socket_error(e, 'join_canvas', data.get('_authenticated_user', {}).get('id'))
            log_socket_event('canvas', 'join_canvas', False)
    
    @socketio.on('leave_canvas')
    @secure_socket_event('leave_canvas', 'view')
    def handle_leave_canvas(data):
        """Handle user leaving a canvas room with comprehensive security."""
        try:
            canvas_id = data.get('canvas_id')
            user = data.get('_authenticated_user')
            
            # Leave the canvas room
            leave_room(canvas_id)
            
            # Notify others in the room (sanitized data)
            emit('user_left', {
                'user_id': user.id,
                'user_name': SanitizationService.sanitize_html(user.name or '')
            }, room=canvas_id, include_self=False)
            
        except Exception as e:
            handle_socket_error(e, 'leave_canvas', data.get('_authenticated_user', {}).get('id'))
            log_socket_event('canvas', 'leave_canvas', False)
    
    @socketio.on('object_created')
    @secure_socket_event('object_created', 'edit')
    def handle_object_created(data):
        """Handle canvas object creation with comprehensive security and validation."""
        try:
            # Validate message data to prevent parse errors
            if not SocketMessageValidator.validate_socket_message('object_created', data):
                railway_logger.log('socket_io', 40, "Object creation message validation failed")
                emit('error', {'message': 'Invalid message format', 'type': 'validation_error'})
                return
            
            # Sanitize message data
            sanitized_data = SocketMessageValidator.sanitize_message_data(data)
            
            canvas_id = sanitized_data.get('canvas_id')
            user = sanitized_data.get('_authenticated_user')
            object_data = sanitized_data.get('object')
            
            # Additional validation
            if not canvas_id or not user or not object_data:
                railway_logger.log('socket_io', 40, "Missing required data for object creation")
                emit('error', {'message': 'Missing required data', 'type': 'validation_error'})
                return
            
            # Validate object data structure
            if not isinstance(object_data, dict) or 'type' not in object_data or 'properties' not in object_data:
                railway_logger.log('socket_io', 40, "Invalid object data structure")
                emit('error', {'message': 'Invalid object data', 'type': 'validation_error'})
                return
            
            # Create object in database
            canvas_service = CanvasService()
            # Handle both user object and user dict
            user_id = user.id if hasattr(user, 'id') else user.get('id')
            
            # Validate object properties are JSON serializable
            try:
                properties_json = json.dumps(object_data['properties'])
            except (TypeError, ValueError) as e:
                railway_logger.log('socket_io', 40, f"Object properties not JSON serializable: {str(e)}")
                emit('error', {'message': 'Invalid object properties', 'type': 'validation_error'})
                return
            
            canvas_object = canvas_service.create_canvas_object(
                canvas_id=canvas_id,
                object_type=object_data['type'],
                properties=properties_json,
                created_by=user_id
            )
            
            # Log successful object creation
            log_object_event(canvas_id, 'created', object_data['type'], True)
            
            # Prepare response data with validation
            response_data = {
                'object': canvas_object.to_dict()
            }
            
            # Validate response data before emitting
            if not SocketMessageValidator.validate_message_size(response_data):
                railway_logger.log('socket_io', 40, "Response data too large for object creation")
                emit('error', {'message': 'Response data too large', 'type': 'size_error'})
                return
            
            # Broadcast to all users in the canvas room (including the creator)
            emit('object_created', response_data, room=canvas_id, include_self=True)
            
            railway_logger.log('socket_io', 10, f"Object created successfully: {canvas_object.id}")
            
        except Exception as e:
            canvas_id = data.get('canvas_id', 'unknown') if data else 'unknown'
            object_type = data.get('object', {}).get('type', 'unknown') if data else 'unknown'
            log_object_event(canvas_id, 'created', object_type, False)
            railway_logger.log('socket_io', 40, f"Object creation failed: {str(e)}")
            emit('error', {'message': 'Object creation failed', 'type': 'creation_error'})
    
    @socketio.on('object_updated')
    def handle_object_updated(data):
        """Handle canvas object update."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            # Validate input using schema
            schema = ObjectUpdateEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                emit('error', {'message': 'Validation failed', 'details': e.messages})
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            object_id = validated_data['object_id']
            properties = validated_data['properties']
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception as e:
                emit('error', {'message': f'Authentication failed: {str(e)}'})
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'object_updated'):
                emit('error', {'message': 'Rate limit exceeded for object updates'})
                return
            
            # Check edit permission
            canvas_service = CanvasService()
            if not canvas_service.check_canvas_permission(canvas_id, user.id, 'edit'):
                emit('error', {'message': 'Edit permission required'})
                return
            
            # Sanitize object properties
            sanitized_properties = SanitizationService.sanitize_object_properties(properties)
            
            # Update object in database
            updated_object = canvas_service.update_canvas_object(
                object_id=object_id,
                properties=json.dumps(sanitized_properties)
            )
            
            if updated_object:
                # Broadcast to all users in the canvas room (including the updater)
                emit('object_updated', {
                    'object': updated_object.to_dict()
                }, room=canvas_id, include_self=True)
            
        except ValidationError as e:
            emit('error', {'message': 'Validation failed', 'details': str(e)})
        except Exception as e:
            emit('error', {'message': 'Internal server error'})
    
    @socketio.on('object_deleted')
    def handle_object_deleted(data):
        """Handle canvas object deletion."""
        try:
            canvas_id = data.get('canvas_id')
            id_token = data.get('id_token')
            object_id = data.get('object_id')
            
            if not all([canvas_id, id_token, object_id]):
                emit('error', {'message': 'canvas_id, id_token, and object_id are required'})
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception as e:
                emit('error', {'message': f'Authentication failed: {str(e)}'})
                return
            
            # Check edit permission
            canvas_service = CanvasService()
            if not canvas_service.check_canvas_permission(canvas_id, user.id, 'edit'):
                emit('error', {'message': 'Edit permission required'})
                return
            
            # Delete object from database
            success = canvas_service.delete_canvas_object(object_id)
            
            if success:
                # Broadcast to all users in the canvas room (including the deleter)
                emit('object_deleted', {
                    'object_id': object_id
                }, room=canvas_id, include_self=True)
            
        except Exception as e:
            emit('error', {'message': str(e)})
