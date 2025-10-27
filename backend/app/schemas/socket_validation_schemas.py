"""
Socket.IO Event Validation Schemas
Provides comprehensive validation for all Socket.IO events to prevent security vulnerabilities
"""

from marshmallow import Schema, fields, validate, validates_schema, ValidationError, INCLUDE
from app.utils.validators import InputValidator


class BaseSocketEventSchema(Schema):
    """Base schema for all socket events that allows unknown fields."""
    class Meta:
        unknown = INCLUDE  # Allow unknown fields (like _token_metadata) without raising errors


class CanvasJoinEventSchema(BaseSocketEventSchema):
    """Schema for canvas join events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    
    @validates_schema
    def validate_canvas_id(self, data, **kwargs):
        """Validate canvas ID format."""
        canvas_id = data.get('canvas_id')
        if canvas_id:
            try:
                InputValidator.validate_canvas_id(canvas_id)
            except Exception as e:
                raise ValidationError(f'Invalid canvas ID: {str(e)}')


class CanvasLeaveEventSchema(BaseSocketEventSchema):
    """Schema for canvas leave events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))


class ObjectCreateEventSchema(BaseSocketEventSchema):
    """Schema for object creation events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    object = fields.Dict(required=True)
    _token_metadata = fields.Dict(required=False)  # Token optimization metadata
    _authenticated_user = fields.Dict(required=False)  # Authenticated user data
    
    @validates_schema
    def validate_object_data(self, data, **kwargs):
        """Validate object data structure."""
        object_data = data.get('object')
        if object_data:
            try:
                # Validate object type (frontend sends 'type', not 'object_type')
                object_type = object_data.get('type')
                if object_type:
                    InputValidator.validate_enum_value(
                        object_type, 'type',
                        ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
                    )
                
                # Validate object properties
                properties = object_data.get('properties', {})
                if properties:
                    InputValidator.validate_object_properties(properties, object_type)
                    
            except Exception as e:
                raise ValidationError(f'Invalid object data: {str(e)}')


class ObjectUpdateEventSchema(BaseSocketEventSchema):
    """Schema for object update events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    object_id = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    updates = fields.Dict(required=True)
    _token_metadata = fields.Dict(required=False)  # Token optimization metadata
    _authenticated_user = fields.Dict(required=False)  # Authenticated user data
    
    @validates_schema
    def validate_updates(self, data, **kwargs):
        """Validate update data."""
        updates = data.get('updates', {})
        if updates:
            # Validate properties if provided
            properties = updates.get('properties')
            if properties and isinstance(properties, dict):
                try:
                    # Get object type from updates or use default
                    object_type = updates.get('object_type', 'rectangle')
                    InputValidator.validate_object_properties(properties, object_type)
                except Exception as e:
                    raise ValidationError(f'Invalid update properties: {str(e)}')


class ObjectDeleteEventSchema(BaseSocketEventSchema):
    """Schema for object deletion events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    object_id = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    _token_metadata = fields.Dict(required=False)  # Token optimization metadata
    _authenticated_user = fields.Dict(required=False)  # Authenticated user data


class CursorMoveEventSchema(BaseSocketEventSchema):
    """Schema for cursor movement events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    position = fields.Dict(required=True)
    timestamp = fields.Float(required=False, validate=validate.Range(min=0))
    _token_metadata = fields.Dict(required=False)  # Token optimization metadata
    _authenticated_user = fields.Dict(required=False)  # Authenticated user data
    
    @validates_schema
    def validate_position(self, data, **kwargs):
        """Validate cursor position."""
        position = data.get('position')
        if position:
            try:
                # Validate x and y coordinates
                x = position.get('x')
                y = position.get('y')
                
                if x is not None:
                    InputValidator.validate_coordinate(x, 'x')
                if y is not None:
                    InputValidator.validate_coordinate(y, 'y')
                    
            except Exception as e:
                raise ValidationError(f'Invalid cursor position: {str(e)}')


class CursorLeaveEventSchema(BaseSocketEventSchema):
    """Schema for cursor leave events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))


class UserOnlineEventSchema(BaseSocketEventSchema):
    """Schema for user online events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    timestamp = fields.Float(required=False, validate=validate.Range(min=0))


class UserOfflineEventSchema(BaseSocketEventSchema):
    """Schema for user offline events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    timestamp = fields.Float(required=False, validate=validate.Range(min=0))


class PresenceUpdateEventSchema(BaseSocketEventSchema):
    """Schema for presence update events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    status = fields.Str(required=False, validate=validate.OneOf(['online', 'away', 'busy', 'offline']))
    activity = fields.Str(required=False, validate=[
        validate.Length(max=100),
        validate.Regexp(r'^[a-zA-Z0-9\s\-_.,!?]+$', error='Invalid activity description')
    ])
    timestamp = fields.Float(required=False, validate=validate.Range(min=0))


class CollaborationInviteEventSchema(BaseSocketEventSchema):
    """Schema for collaboration invite events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    email = fields.Email(required=True, validate=validate.Length(max=255))
    permission = fields.Str(required=True, validate=validate.OneOf(['view', 'edit']))
    message = fields.Str(required=False, validate=validate.Length(max=1000))
    
    @validates_schema
    def validate_email(self, data, **kwargs):
        """Validate email format."""
        email = data.get('email')
        if email:
            try:
                InputValidator.validate_email(email)
            except Exception as e:
                raise ValidationError(f'Invalid email: {str(e)}')


class CollaborationAcceptEventSchema(BaseSocketEventSchema):
    """Schema for collaboration accept events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    invitation_id = fields.Str(required=True, validate=validate.Length(min=1, max=255))


class CollaborationRejectEventSchema(BaseSocketEventSchema):
    """Schema for collaboration reject events."""
    canvas_id = fields.Str(required=True, validate=[
        validate.Length(min=1, max=255),
        validate.Regexp(r'^[a-zA-Z0-9\-_]+$', error='Invalid canvas ID format')
    ])
    id_token = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    invitation_id = fields.Str(required=True, validate=validate.Length(min=1, max=255))


# Schema mapping for easy access
SOCKET_EVENT_SCHEMAS = {
    'join_canvas': CanvasJoinEventSchema,
    'leave_canvas': CanvasLeaveEventSchema,
    'object_created': ObjectCreateEventSchema,
    'object_updated': ObjectUpdateEventSchema,
    'object_deleted': ObjectDeleteEventSchema,
    'cursor_move': CursorMoveEventSchema,
    'cursor_leave': CursorLeaveEventSchema,
    'user_online': UserOnlineEventSchema,
    'user_offline': UserOfflineEventSchema,
    'presence_update': PresenceUpdateEventSchema,
    'collaboration_invite': CollaborationInviteEventSchema,
    'collaboration_accept': CollaborationAcceptEventSchema,
    'collaboration_reject': CollaborationRejectEventSchema,
}


def get_socket_event_schema(event_type):
    """Get validation schema for a Socket.IO event type."""
    return SOCKET_EVENT_SCHEMAS.get(event_type)


def validate_socket_event_data(event_type, data):
    """Validate Socket.IO event data using appropriate schema."""
    schema_class = get_socket_event_schema(event_type)
    if not schema_class:
        raise ValidationError(f'No validation schema found for event type: {event_type}')
    
    schema = schema_class()
    try:
        return schema.load(data)
    except ValidationError as e:
        raise ValidationError(f'Validation failed for {event_type}: {e.messages}')
