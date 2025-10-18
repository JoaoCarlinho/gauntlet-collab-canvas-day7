"""
AI Security Service for securing AI Agent operations.
Handles input sanitization, prompt injection prevention, and security validation.
"""

import re
import html
import json
from typing import Dict, Any, List, Optional
from app.utils.logger import SmartLogger
from app.services.sanitization_service import SanitizationService


class AISecurityService:
    """Service for securing AI Agent operations."""
    
    def __init__(self):
        self.logger = SmartLogger('ai_security_service', 'INFO')
        self.sanitization_service = SanitizationService()
        
        # Security patterns for prompt injection detection
        self.prompt_injection_patterns = [
            r'ignore\s+(?:previous|above|all)\s+(?:instructions?|prompts?)',
            r'forget\s+(?:everything|all)\s+(?:previous|above)',
            r'you\s+are\s+now\s+(?:a\s+)?(?:different|new)',
            r'pretend\s+to\s+be',
            r'act\s+as\s+if',
            r'roleplay\s+as',
            r'system\s*:\s*',
            r'admin\s*:\s*',
            r'override\s*:\s*',
            r'<\|.*?\|>',  # Special tokens
            r'\[.*?\]',    # Bracketed commands
            r'\{.*?\}',    # Curly brace commands
        ]
        
        # Dangerous keywords that could indicate malicious intent
        self.dangerous_keywords = [
            'password', 'token', 'key', 'secret', 'private',
            'admin', 'root', 'system', 'execute', 'run',
            'delete', 'drop', 'truncate', 'alter', 'create',
            'script', 'javascript', 'eval', 'function',
            'http', 'https', 'ftp', 'file://', 'data:',
            'base64', 'encode', 'decode'
        ]
        
        # Maximum allowed values for security
        self.security_limits = {
            'max_query_length': 1000,
            'max_objects_per_canvas': 50,
            'max_object_label_length': 100,
            'max_canvas_title_length': 200,
            'max_coordinate_value': 1000,
            'max_size_value': 500,
            'max_font_size': 24,
            'min_font_size': 8
        }
    
    def sanitize_user_query(self, query: str) -> str:
        """
        Sanitize user query to prevent prompt injection and other attacks.
        
        Args:
            query: User query to sanitize
            
        Returns:
            Sanitized query
        """
        if not query or not isinstance(query, str):
            return ""
        
        # Remove extra whitespace
        sanitized = query.strip()
        
        # Check for prompt injection patterns
        if self._detect_prompt_injection(sanitized):
            self.logger.log_error(f"Prompt injection detected in query: {sanitized[:100]}...")
            raise ValueError("Invalid query format detected")
        
        # Check for dangerous keywords
        if self._detect_dangerous_keywords(sanitized):
            self.logger.log_error(f"Dangerous keywords detected in query: {sanitized[:100]}...")
            raise ValueError("Query contains potentially dangerous content")
        
        # HTML escape to prevent XSS
        sanitized = html.escape(sanitized)
        
        # Remove potential command injection patterns
        sanitized = self._remove_command_patterns(sanitized)
        
        # Limit length
        if len(sanitized) > self.security_limits['max_query_length']:
            sanitized = sanitized[:self.security_limits['max_query_length']]
            self.logger.log_error(f"Query truncated due to length limit")
        
        return sanitized
    
    def validate_ai_response(self, response: str) -> Dict[str, Any]:
        """
        Validate AI response for security issues.
        
        Args:
            response: AI response to validate
            
        Returns:
            Validated and sanitized response data
        """
        if not response or not isinstance(response, str):
            raise ValueError("Invalid AI response format")
        
        try:
            # Parse JSON response
            data = json.loads(response)
        except json.JSONDecodeError as e:
            self.logger.log_error(f"Invalid JSON in AI response: {str(e)}")
            raise ValueError("Invalid AI response format")
        
        # Validate response structure
        if not isinstance(data, dict):
            raise ValueError("AI response must be a JSON object")
        
        if 'canvas' not in data:
            raise ValueError("AI response missing canvas data")
        
        canvas_data = data['canvas']
        
        # Validate canvas title
        if 'title' in canvas_data:
            canvas_data['title'] = self._sanitize_canvas_title(canvas_data['title'])
        
        # Validate objects
        if 'objects' in canvas_data:
            canvas_data['objects'] = self._validate_objects(canvas_data['objects'])
        
        return data
    
    def _detect_prompt_injection(self, query: str) -> bool:
        """Detect potential prompt injection attacks."""
        query_lower = query.lower()
        
        for pattern in self.prompt_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return True
        
        return False
    
    def _detect_dangerous_keywords(self, query: str) -> bool:
        """Detect potentially dangerous keywords."""
        query_lower = query.lower()
        
        # Check for dangerous keywords in context
        for keyword in self.dangerous_keywords:
            if keyword in query_lower:
                # Check if it's in a dangerous context
                if self._is_dangerous_context(query_lower, keyword):
                    return True
        
        return False
    
    def _is_dangerous_context(self, query: str, keyword: str) -> bool:
        """Check if keyword is used in a dangerous context."""
        # Look for patterns that suggest malicious intent
        dangerous_contexts = [
            f'get {keyword}',
            f'find {keyword}',
            f'show {keyword}',
            f'reveal {keyword}',
            f'extract {keyword}',
            f'steal {keyword}',
            f'hack {keyword}',
            f'exploit {keyword}',
            f'bypass {keyword}',
            f'crack {keyword}'
        ]
        
        for context in dangerous_contexts:
            if context in query:
                return True
        
        return False
    
    def _remove_command_patterns(self, query: str) -> str:
        """Remove potential command injection patterns."""
        # Remove common command patterns
        command_patterns = [
            r';\s*[a-zA-Z]',  # Semicolon followed by command
            r'\|\s*[a-zA-Z]',  # Pipe followed by command
            r'&&\s*[a-zA-Z]',  # Double ampersand followed by command
            r'\|\|\s*[a-zA-Z]',  # Double pipe followed by command
            r'`[^`]*`',  # Backtick commands
            r'\$\([^)]*\)',  # Command substitution
        ]
        
        for pattern in command_patterns:
            query = re.sub(pattern, '', query, flags=re.IGNORECASE)
        
        return query
    
    def _sanitize_canvas_title(self, title: str) -> str:
        """Sanitize canvas title."""
        if not title or not isinstance(title, str):
            return "AI Generated Canvas"
        
        # HTML escape
        sanitized = html.escape(title)
        
        # Limit length
        if len(sanitized) > self.security_limits['max_canvas_title_length']:
            sanitized = sanitized[:self.security_limits['max_canvas_title_length']]
        
        return sanitized
    
    def _validate_objects(self, objects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate and sanitize AI-generated objects."""
        if not isinstance(objects, list):
            raise ValueError("Objects must be a list")
        
        if len(objects) > self.security_limits['max_objects_per_canvas']:
            self.logger.log_warning(f"Too many objects in AI response: {len(objects)}")
            objects = objects[:self.security_limits['max_objects_per_canvas']]
        
        validated_objects = []
        
        for obj in objects:
            if not isinstance(obj, dict):
                continue  # Skip invalid objects
            
            validated_obj = self._validate_single_object(obj)
            if validated_obj:
                validated_objects.append(validated_obj)
        
        return validated_objects
    
    def _validate_single_object(self, obj: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate and sanitize a single object."""
        # Validate object type
        valid_types = ['rectangle', 'circle', 'diamond', 'text', 'arrow', 'line']
        if 'type' not in obj or obj['type'] not in valid_types:
            return None
        
        validated_obj = {
            'type': obj['type'],
            'x': self._validate_coordinate(obj.get('x', 100)),
            'y': self._validate_coordinate(obj.get('y', 100)),
            'width': self._validate_size(obj.get('width', 120)),
            'height': self._validate_size(obj.get('height', 60)),
            'color': self._validate_color(obj.get('color', '#3B82F6')),
            'fontSize': self._validate_font_size(obj.get('fontSize', 14))
        }
        
        # Validate label/text
        if 'label' in obj:
            validated_obj['label'] = self._sanitize_object_label(obj['label'])
        
        return validated_obj
    
    def _validate_coordinate(self, coord: Any) -> float:
        """Validate coordinate value."""
        try:
            coord = float(coord)
            if coord < 0 or coord > self.security_limits['max_coordinate_value']:
                return 100.0  # Default safe value
            return coord
        except (ValueError, TypeError):
            return 100.0
    
    def _validate_size(self, size: Any) -> float:
        """Validate size value."""
        try:
            size = float(size)
            if size < 10 or size > self.security_limits['max_size_value']:
                return 120.0  # Default safe value
            return size
        except (ValueError, TypeError):
            return 120.0
    
    def _validate_color(self, color: Any) -> str:
        """Validate color value."""
        if not color or not isinstance(color, str):
            return '#3B82F6'  # Default safe color
        
        # Check for valid hex color
        if re.match(r'^#[0-9A-Fa-f]{6}$', color):
            return color.upper()
        
        # Check for valid hex color without #
        if re.match(r'^[0-9A-Fa-f]{6}$', color):
            return f"#{color.upper()}"
        
        # Default safe color
        return '#3B82F6'
    
    def _validate_font_size(self, font_size: Any) -> int:
        """Validate font size value."""
        try:
            font_size = int(font_size)
            if (font_size < self.security_limits['min_font_size'] or 
                font_size > self.security_limits['max_font_size']):
                return 14  # Default safe value
            return font_size
        except (ValueError, TypeError):
            return 14
    
    def _sanitize_object_label(self, label: str) -> str:
        """Sanitize object label."""
        if not label or not isinstance(label, str):
            return ""
        
        # HTML escape
        sanitized = html.escape(label)
        
        # Limit length
        if len(sanitized) > self.security_limits['max_object_label_length']:
            sanitized = sanitized[:self.security_limits['max_object_label_length']]
        
        return sanitized
    
    def validate_api_key(self, api_key: str) -> bool:
        """Validate OpenAI API key format."""
        if not api_key or not isinstance(api_key, str):
            return False
        
        # Check for valid OpenAI API key format
        if not re.match(r'^sk-[a-zA-Z0-9]{48}$', api_key):
            return False
        
        return True
    
    def log_security_event(self, event_type: str, details: str, user_id: Optional[str] = None):
        """Log security events for monitoring."""
        self.logger.log_error(f"Security Event - {event_type}: {details}")
        
        # In production, this would send to a security monitoring system
        # For now, we just log it
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics for monitoring."""
        return {
            'prompt_injection_patterns': len(self.prompt_injection_patterns),
            'dangerous_keywords': len(self.dangerous_keywords),
            'security_limits': self.security_limits,
            'service_status': 'active'
        }
