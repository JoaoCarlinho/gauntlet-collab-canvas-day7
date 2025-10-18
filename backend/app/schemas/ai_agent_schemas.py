from marshmallow import Schema, fields, validate

class CanvasCreationRequestSchema(Schema):
    """Schema for AI canvas creation requests."""
    instructions = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=1000),
        error_messages={'required': 'Instructions are required'}
    )
    style = fields.Str(
        missing='modern',
        validate=validate.OneOf(['modern', 'corporate', 'creative', 'minimal']),
        error_messages={'validator_failed': 'Invalid style option'}
    )
    colorScheme = fields.Str(
        missing='default',
        validate=validate.OneOf(['pastel', 'vibrant', 'monochrome', 'default']),
        error_messages={'validator_failed': 'Invalid color scheme option'}
    )
    canvas_id = fields.Str(
        missing=None,
        validate=validate.Length(min=1, max=100),
        allow_none=True
    )

class AIAgentHealthResponseSchema(Schema):
    """Schema for AI agent health check responses."""
    status = fields.Str(required=True)
    openai_connected = fields.Bool(required=True)
    timestamp = fields.Str(required=True)
    error = fields.Str(allow_none=True)

class CanvasCreationResponseSchema(Schema):
    """Schema for AI canvas creation responses."""
    success = fields.Bool(required=True)
    canvas = fields.Dict(required=True)
    message = fields.Str(required=True)
    error = fields.Str(allow_none=True)
