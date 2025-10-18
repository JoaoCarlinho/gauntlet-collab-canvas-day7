from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService
from app.extensions import redis_client
from app.schemas.validation_schemas import (
    ObjectUpdateEventSchema, 
    ObjectCreateEventSchema,
    ObjectDeleteEventSchema,
    JoinCanvasEventSchema,
    LeaveCanvasEventSchema
)
from app.middleware.rate_limiting import check_socket_rate_limit
from app.utils.validators import ValidationError, InputValidator
from app.services.sanitization_service import SanitizationService
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
    def handle_join_canvas(data):
        """Handle user joining a canvas room with comprehensive validation."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            # Validate input using schema
            schema = JoinCanvasEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                emit('error', {'message': 'Validation failed', 'details': e.messages})
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            
            print(f"=== Join Canvas Debug ===")
            print(f"Canvas ID: {canvas_id}")
            print(f"Token provided: {bool(id_token)}")
            
            # Validate canvas ID format
            try:
                canvas_id = InputValidator.validate_canvas_id(canvas_id)
            except ValidationError as e:
                emit('error', {'message': f'Invalid canvas ID: {str(e)}'})
                return
            
            # Verify authentication
            try:
                user = authenticate_socket_user(id_token)
            except Exception as e:
                emit('error', {'message': f'Authentication failed: {str(e)}'})
                return
            
            # Check canvas permission
            canvas_service = CanvasService()
            if not canvas_service.check_canvas_permission(canvas_id, user.id):
                emit('error', {'message': 'Access denied to canvas'})
                return
            
            # Join the canvas room
            join_room(canvas_id)
            
            # Store user info in session
            emit('joined_canvas', {
                'canvas_id': canvas_id,
                'user': user.to_dict()
            })
            
            # Notify others in the room
            emit('user_joined', {
                'user': user.to_dict()
            }, room=canvas_id, include_self=False)
            
        except ValidationError as e:
            emit('error', {'message': 'Validation failed', 'details': str(e)})
        except Exception as e:
            emit('error', {'message': 'Internal server error'})
    
    @socketio.on('leave_canvas')
    def handle_leave_canvas(data):
        """Handle user leaving a canvas room with comprehensive validation."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            # Validate input using schema
            schema = LeaveCanvasEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                emit('error', {'message': 'Validation failed', 'details': e.messages})
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            
            # Validate canvas ID format
            try:
                canvas_id = InputValidator.validate_canvas_id(canvas_id)
            except ValidationError as e:
                emit('error', {'message': f'Invalid canvas ID: {str(e)}'})
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception:
                return
            
            # Leave the canvas room
            leave_room(canvas_id)
            
            # Notify others in the room
            emit('user_left', {
                'user_id': user.id,
                'user_name': user.name
            }, room=canvas_id, include_self=False)
            
        except ValidationError as e:
            emit('error', {'message': 'Validation failed', 'details': str(e)})
        except Exception as e:
            emit('error', {'message': 'Internal server error'})
    
    @socketio.on('object_created')
    def handle_object_created(data):
        """Handle canvas object creation with comprehensive validation."""
        try:
            # Extract object data from the payload
            canvas_id = data.get('canvas_id')
            id_token = data.get('id_token')
            object_data = data.get('object', {})
            
            # Prepare validation data
            validation_data = {
                'canvas_id': canvas_id,
                'id_token': id_token,
                'object_type': object_data.get('type'),
                'properties': object_data.get('properties', {})
            }
            
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(validation_data)
            
            # Validate input using schema
            schema = ObjectCreateEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                emit('error', {'message': 'Validation failed', 'details': e.messages})
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            object_type = validated_data['object_type']
            properties = validated_data['properties']
            
            # Validate canvas ID format
            try:
                canvas_id = InputValidator.validate_canvas_id(canvas_id)
            except ValidationError as e:
                emit('error', {'message': f'Invalid canvas ID: {str(e)}'})
                return
            
            # Validate object type
            try:
                object_type = InputValidator.validate_enum_value(
                    object_type, 'object_type',
                    ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
                )
            except ValidationError as e:
                emit('error', {'message': str(e)})
                return
            
            # Validate object properties
            try:
                validated_properties = InputValidator.validate_object_properties(properties, object_type)
            except ValidationError as e:
                emit('error', {'message': f'Invalid object properties: {str(e)}'})
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception as e:
                emit('error', {'message': f'Authentication failed: {str(e)}'})
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'object_created'):
                emit('error', {'message': 'Rate limit exceeded for object creation'})
                return
            
            # Check edit permission
            canvas_service = CanvasService()
            if not canvas_service.check_canvas_permission(canvas_id, user.id, 'edit'):
                emit('error', {'message': 'Edit permission required'})
                return
            
            # Sanitize object properties
            sanitized_properties = SanitizationService.sanitize_object_properties(validated_properties)
            
            # Create object in database
            canvas_object = canvas_service.create_canvas_object(
                canvas_id=canvas_id,
                object_type=object_type,
                properties=json.dumps(sanitized_properties),
                created_by=user.id
            )
            
            # Broadcast to all users in the canvas room (including the creator)
            emit('object_created', {
                'object': canvas_object.to_dict()
            }, room=canvas_id, include_self=True)
            
        except ValidationError as e:
            emit('error', {'message': 'Validation failed', 'details': str(e)})
        except Exception as e:
            emit('error', {'message': 'Internal server error'})
    
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
        """Handle canvas object deletion with comprehensive validation."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            # Validate input using schema
            schema = ObjectDeleteEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                emit('error', {'message': 'Validation failed', 'details': e.messages})
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            object_id = validated_data['object_id']
            
            # Validate canvas ID format
            try:
                canvas_id = InputValidator.validate_canvas_id(canvas_id)
            except ValidationError as e:
                emit('error', {'message': f'Invalid canvas ID: {str(e)}'})
                return
            
            # Validate object ID format
            try:
                object_id = InputValidator.validate_string_length(object_id, 'object_id', 255, 1)
            except ValidationError as e:
                emit('error', {'message': f'Invalid object ID: {str(e)}'})
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception as e:
                emit('error', {'message': f'Authentication failed: {str(e)}'})
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'object_deleted'):
                emit('error', {'message': 'Rate limit exceeded for object deletion'})
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
            
        except ValidationError as e:
            emit('error', {'message': 'Validation failed', 'details': str(e)})
        except Exception as e:
            emit('error', {'message': 'Internal server error'})
