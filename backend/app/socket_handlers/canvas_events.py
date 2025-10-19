from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService
from app.extensions import redis_client
from app.schemas.validation_schemas import ObjectUpdateEventSchema
from app.middleware.rate_limiting import check_socket_rate_limit
from app.middleware.socket_security import (
    secure_socket_event, authenticate_socket_user, check_canvas_permission,
    sanitize_broadcast_data, SocketAuthenticationError, SocketAuthorizationError
)
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService
from app.utils.logger import SmartLogger
from app.socket_handlers.error_handlers import (
    handle_socket_error, handle_authentication_error, handle_validation_error,
    handle_permission_error, log_socket_event, emit_error_response
)
import json

def register_canvas_handlers(socketio):
    """Register canvas-related Socket.IO event handlers."""
    
    def authenticate_socket_user(id_token):
        """Authenticate user for Socket.IO events."""
        try:
            print(f"=== Socket.IO Authentication Debug ===")
            print(f"Token length: {len(id_token) if id_token else 0}")
            print(f"Token starts with: {id_token[:50] if id_token else 'None'}...")
            
            auth_service = AuthService()
            decoded_token = auth_service.verify_token(id_token)
            print(f"Token verified for user: {decoded_token.get('uid', 'unknown')}")
            
            user = auth_service.get_user_by_id(decoded_token['uid'])
            if not user:
                print("User not found in database, registering...")
                user = auth_service.register_user(id_token)
                print(f"User registered: {user.email}")
            else:
                print(f"User found in database: {user.email}")
            
            return user
        except Exception as e:
            print(f"Socket.IO authentication failed: {str(e)}")
            print(f"Exception type: {type(e)}")
            raise e
    
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
            log_socket_event('join_canvas', data.get('_authenticated_user', {}).get('id'), False)
    
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
            log_socket_event('leave_canvas', data.get('_authenticated_user', {}).get('id'), False)
    
    @socketio.on('object_created')
    @secure_socket_event('object_created', 'edit')
    def handle_object_created(data):
        """Handle canvas object creation with comprehensive security."""
        try:
            canvas_id = data.get('canvas_id')
            user = data.get('_authenticated_user')
            object_data = data.get('object')
            
            # Create object in database
            canvas_service = CanvasService()
            canvas_object = canvas_service.create_canvas_object(
                canvas_id=canvas_id,
                object_type=object_data['type'],
                properties=json.dumps(object_data['properties']),
                created_by=user.id
            )
            
            # Broadcast to all users in the canvas room (including the creator)
            emit('object_created', {
                'object': canvas_object.to_dict()
            }, room=canvas_id, include_self=True)
            
        except Exception as e:
            emit('error', {'message': str(e)})
    
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
