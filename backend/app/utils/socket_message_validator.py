"""
Socket.IO Message Validation Utility
Provides comprehensive validation for Socket.IO messages to prevent parse errors.
"""

import json
import logging
from typing import Dict, Any, Optional, List
from app.utils.railway_logger import railway_logger

logger = logging.getLogger(__name__)

class SocketMessageValidator:
    """Validates Socket.IO messages to prevent parse errors."""
    
    # Maximum message size (1MB)
    MAX_MESSAGE_SIZE = 1024 * 1024
    
    # Maximum object properties size (100KB)
    MAX_OBJECT_PROPERTIES_SIZE = 100 * 1024
    
    # Allowed object types
    ALLOWED_OBJECT_TYPES = [
        'rectangle', 'circle', 'text', 'heart', 'star', 
        'diamond', 'line', 'arrow'
    ]
    
    # Required fields for different event types
    REQUIRED_FIELDS = {
        'object_created': ['canvas_id', 'object'],
        'object_updated': ['canvas_id', 'object_id', 'properties'],
        'object_deleted': ['canvas_id', 'object_id'],
        'join_canvas': ['canvas_id'],
        'leave_canvas': ['canvas_id'],
        'cursor_move': ['canvas_id', 'position']
    }
    
    @staticmethod
    def validate_message_size(data: Any) -> bool:
        """Validate message size to prevent parse errors."""
        try:
            message_str = json.dumps(data)
            message_size = len(message_str.encode('utf-8'))
            
            if message_size > SocketMessageValidator.MAX_MESSAGE_SIZE:
                railway_logger.log('socket_io', 40, f"Message too large: {message_size} bytes")
                return False
            
            return True
        except (TypeError, ValueError) as e:
            railway_logger.log('socket_io', 40, f"Message size validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_json_serializable(data: Any) -> bool:
        """Validate that data is JSON serializable."""
        try:
            json.dumps(data)
            return True
        except (TypeError, ValueError) as e:
            railway_logger.log('socket_io', 40, f"JSON serialization validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_object_data(object_data: Dict[str, Any]) -> bool:
        """Validate object data structure and content."""
        try:
            # Check required fields
            if not isinstance(object_data, dict):
                railway_logger.log('socket_io', 40, "Object data must be a dictionary")
                return False
            
            # Validate object type
            object_type = object_data.get('type')
            if not object_type or object_type not in SocketMessageValidator.ALLOWED_OBJECT_TYPES:
                railway_logger.log('socket_io', 40, f"Invalid object type: {object_type}")
                return False
            
            # Validate properties
            properties = object_data.get('properties')
            if not isinstance(properties, dict):
                railway_logger.log('socket_io', 40, "Object properties must be a dictionary")
                return False
            
            # Validate properties size
            properties_str = json.dumps(properties)
            properties_size = len(properties_str.encode('utf-8'))
            if properties_size > SocketMessageValidator.MAX_OBJECT_PROPERTIES_SIZE:
                railway_logger.log('socket_io', 40, f"Object properties too large: {properties_size} bytes")
                return False
            
            # Validate property values
            for key, value in properties.items():
                if not isinstance(key, str):
                    railway_logger.log('socket_io', 40, f"Property key must be string: {key}")
                    return False
                
                # Check for circular references or non-serializable values
                try:
                    json.dumps(value)
                except (TypeError, ValueError):
                    railway_logger.log('socket_io', 40, f"Property value not serializable: {key}")
                    return False
            
            return True
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Object data validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_canvas_id(canvas_id: str) -> bool:
        """Validate canvas ID format."""
        try:
            if not isinstance(canvas_id, str):
                railway_logger.log('socket_io', 40, "Canvas ID must be a string")
                return False
            
            if len(canvas_id) < 10 or len(canvas_id) > 255:
                railway_logger.log('socket_io', 40, f"Invalid canvas ID length: {len(canvas_id)}")
                return False
            
            # Check for valid UUID format (basic check)
            if not canvas_id.replace('-', '').replace('_', '').isalnum():
                railway_logger.log('socket_io', 40, f"Invalid canvas ID format: {canvas_id}")
                return False
            
            return True
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Canvas ID validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_position_data(position: Dict[str, Any]) -> bool:
        """Validate position data for cursor events."""
        try:
            if not isinstance(position, dict):
                railway_logger.log('socket_io', 40, "Position must be a dictionary")
                return False
            
            # Check required position fields
            if 'x' not in position or 'y' not in position:
                railway_logger.log('socket_io', 40, "Position must contain x and y coordinates")
                return False
            
            # Validate coordinate types and ranges
            try:
                x = float(position['x'])
                y = float(position['y'])
                
                # Check reasonable coordinate ranges
                if x < -10000 or x > 10000 or y < -10000 or y > 10000:
                    railway_logger.log('socket_io', 40, f"Position coordinates out of range: x={x}, y={y}")
                    return False
                
            except (ValueError, TypeError):
                railway_logger.log('socket_io', 40, "Position coordinates must be numeric")
                return False
            
            return True
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Position validation failed: {str(e)}")
            return False
    
    @staticmethod
    def validate_socket_message(event_type: str, data: Dict[str, Any]) -> bool:
        """Comprehensive Socket.IO message validation."""
        try:
            # Check if data is None or empty
            if not data:
                railway_logger.log('socket_io', 40, "Message data is empty")
                return False
            
            # Validate message size
            if not SocketMessageValidator.validate_message_size(data):
                return False
            
            # Validate JSON serializability
            if not SocketMessageValidator.validate_json_serializable(data):
                return False
            
            # Check required fields for event type
            if event_type in SocketMessageValidator.REQUIRED_FIELDS:
                required_fields = SocketMessageValidator.REQUIRED_FIELDS[event_type]
                for field in required_fields:
                    if field not in data:
                        railway_logger.log('socket_io', 40, f"Missing required field: {field}")
                        return False
            
            # Validate canvas_id if present
            canvas_id = data.get('canvas_id')
            if canvas_id and not SocketMessageValidator.validate_canvas_id(canvas_id):
                return False
            
            # Validate object data if present
            object_data = data.get('object')
            if object_data and not SocketMessageValidator.validate_object_data(object_data):
                return False
            
            # Validate position data if present
            position = data.get('position')
            if position and not SocketMessageValidator.validate_position_data(position):
                return False
            
            # Validate object_id if present
            object_id = data.get('object_id')
            if object_id and not isinstance(object_id, str):
                railway_logger.log('socket_io', 40, "Object ID must be a string")
                return False
            
            railway_logger.log('socket_io', 10, f"Message validation successful for event: {event_type}")
            return True
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Message validation failed: {str(e)}")
            return False
    
    @staticmethod
    def sanitize_message_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize message data to prevent parse errors."""
        try:
            sanitized_data = {}
            
            for key, value in data.items():
                # Ensure keys are strings
                if not isinstance(key, str):
                    key = str(key)
                
                # Sanitize values based on type
                if isinstance(value, str):
                    # Remove null bytes and control characters
                    sanitized_value = value.replace('\x00', '').replace('\r', '').replace('\n', ' ')
                    sanitized_data[key] = sanitized_value
                elif isinstance(value, (int, float, bool)):
                    sanitized_data[key] = value
                elif isinstance(value, dict):
                    sanitized_data[key] = SocketMessageValidator.sanitize_message_data(value)
                elif isinstance(value, list):
                    sanitized_list = []
                    for item in value:
                        if isinstance(item, dict):
                            sanitized_list.append(SocketMessageValidator.sanitize_message_data(item))
                        elif isinstance(item, str):
                            sanitized_list.append(item.replace('\x00', '').replace('\r', '').replace('\n', ' '))
                        else:
                            sanitized_list.append(item)
                    sanitized_data[key] = sanitized_list
                else:
                    # Convert other types to string
                    sanitized_data[key] = str(value)
            
            return sanitized_data
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Message sanitization failed: {str(e)}")
            return data  # Return original data if sanitization fails
