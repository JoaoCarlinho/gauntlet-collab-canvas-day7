from marshmallow import Schema, fields, validate, validates_schema, ValidationError
import re

class CanvasCreationRequestSchema(Schema):
    """Schema for AI canvas creation requests."""
    instructions = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=1000),
        error_messages={'required': 'Instructions are required'}
    )
    style = fields.Str(
        load_default='modern',
        validate=validate.OneOf(['modern', 'corporate', 'creative', 'minimal']),
        error_messages={'validator_failed': 'Invalid style option'}
    )
    colorScheme = fields.Str(
        load_default='default',
        validate=validate.OneOf(['pastel', 'vibrant', 'monochrome', 'default']),
        error_messages={'validator_failed': 'Invalid color scheme option'}
    )
    canvas_id = fields.Str(
        load_default=None,
        validate=validate.Length(min=1, max=100),
        allow_none=True
    )
    
    @validates_schema
    def validate_instructions_security(self, data, **kwargs):
        """Validate instructions for security issues."""
        instructions = data.get('instructions', '')
        
        # Check for prompt injection patterns
        prompt_injection_patterns = [
            r'ignore\s+(?:previous|above|all)\s+(?:instructions?|prompts?)',
            r'forget\s+(?:everything|all)\s+(?:previous|above)',
            r'you\s+are\s+now\s+(?:a\s+)?(?:different|new)',
            r'pretend\s+to\s+be',
            r'act\s+as\s+if',
            r'roleplay\s+as',
            r'system\s*:\s*',
            r'admin\s*:\s*',
            r'override\s*:\s*'
        ]
        
        for pattern in prompt_injection_patterns:
            if re.search(pattern, instructions, re.IGNORECASE):
                raise ValidationError('Invalid instruction format detected')
        
        # Check for dangerous keywords in context
        dangerous_keywords = [
            'password', 'token', 'key', 'secret', 'private',
            'admin', 'root', 'system', 'execute', 'run',
            'delete', 'drop', 'truncate', 'alter', 'create',
            'script', 'javascript', 'eval', 'function'
        ]
        
        instructions_lower = instructions.lower()
        for keyword in dangerous_keywords:
            if keyword in instructions_lower:
                # Check for dangerous context
                dangerous_contexts = [
                    f'get {keyword}',
                    f'find {keyword}',
                    f'show {keyword}',
                    f'reveal {keyword}',
                    f'extract {keyword}',
                    f'steal {keyword}',
                    f'hack {keyword}',
                    f'exploit {keyword}'
                ]
                
                for context in dangerous_contexts:
                    if context in instructions_lower:
                        raise ValidationError('Query contains potentially dangerous content')
    
    @validates_schema
    def validate_canvas_id_format(self, data, **kwargs):
        """Validate canvas ID format."""
        canvas_id = data.get('canvas_id')
        if canvas_id:
            # Check for valid UUID format or alphanumeric format
            if not re.match(r'^[a-zA-Z0-9\-_]{1,100}$', canvas_id):
                raise ValidationError('Invalid canvas ID format')

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
