"""
Socket.IO Configuration Optimizer
Optimizes Socket.IO configuration to prevent parse errors and improve connection stability.
"""

import json
import logging
from typing import Dict, Any, Optional
from flask import current_app
from app.utils.railway_logger import railway_logger

logger = logging.getLogger(__name__)

class SocketIOConfigOptimizer:
    """Optimizes Socket.IO configuration for production stability."""
    
    # Optimal configuration values for production
    OPTIMAL_CONFIG = {
        # Connection settings
        'ping_timeout': 60,
        'ping_interval': 25,
        'max_http_buffer_size': 1000000,  # 1MB
        'always_connect': True,
        'allow_upgrades': True,
        'transports': ['websocket', 'polling'],
        
        # Message settings
        'max_message_size': 1000000,  # 1MB
        'compression': True,
        'compression_threshold': 1024,  # 1KB
        
        # Reconnection settings
        'reconnection': True,
        'reconnection_attempts': 5,
        'reconnection_delay': 1000,  # 1 second
        'reconnection_delay_max': 5000,  # 5 seconds
        'max_reconnection_attempts': 5,
        
        # Timeout settings
        'timeout': 20000,  # 20 seconds
        'force_new': False,
        
        # Logging settings (production optimized)
        'logger': False,
        'engineio_logger': False,
        
        # Session management
        'manage_session': True,
        'cors_allowed_origins': None,  # Will be set dynamically
    }
    
    @staticmethod
    def get_optimized_config(app) -> Dict[str, Any]:
        """Get optimized Socket.IO configuration for the current environment."""
        try:
            config = SocketIOConfigOptimizer.OPTIMAL_CONFIG.copy()
            
            # Set CORS origins from app config with fallback
            cors_origins = app.config.get('CORS_ORIGINS', [])
            if isinstance(cors_origins, str):
                cors_origins = [origin.strip() for origin in cors_origins.split(',')]
            
            # Add specific Vercel and Railway origins for production
            production_origins = [
                "https://collab-canvas-frontend.up.railway.app",
                "https://gauntlet-collab-canvas-day7.vercel.app",
                "https://collabcanvas-mvp-day7.vercel.app",
                "https://gauntlet-collab-canvas-24hr.vercel.app",
                "https://*.vercel.app",
                "https://*.up.railway.app"
            ]
            
            # Combine all origins
            all_origins = cors_origins + production_origins
            config['cors_allowed_origins'] = all_origins
            
            # Adjust settings based on environment
            if app.config.get('FLASK_ENV') == 'production':
                # Production optimizations for Railway deployment
                config.update({
                    'logger': False,
                    'engineio_logger': False,
                    'max_http_buffer_size': 500000,  # 500KB for production
                    'max_message_size': 500000,  # 500KB for production
                    'compression': True,
                    'compression_threshold': 512,  # 512 bytes
                    'reconnection_attempts': 3,  # Fewer attempts in production
                    'reconnection_delay': 2000,  # 2 seconds
                    'reconnection_delay_max': 10000,  # 10 seconds
                    'transports': ['polling', 'websocket'],  # Allow both transports with polling as primary
                    'allow_upgrades': True,  # Allow upgrade attempts for better compatibility
                })
            else:
                # Development optimizations
                config.update({
                    'logger': True,
                    'engineio_logger': True,
                    'max_http_buffer_size': 2000000,  # 2MB for development
                    'max_message_size': 2000000,  # 2MB for development
                    'compression': False,  # Disable compression in development
                    'reconnection_attempts': 10,  # More attempts in development
                    'reconnection_delay': 1000,  # 1 second
                    'reconnection_delay_max': 5000,  # 5 seconds
                })
            
            railway_logger.log('socket_io', 10, f"Socket.IO configuration optimized for {app.config.get('FLASK_ENV', 'unknown')} environment")
            return config
            
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Failed to get optimized Socket.IO config: {str(e)}")
            return SocketIOConfigOptimizer.OPTIMAL_CONFIG.copy()
    
    @staticmethod
    def validate_message_size(data: Any, max_size: int = 1000000) -> bool:
        """Validate message size to prevent parse errors."""
        try:
            message_str = json.dumps(data)
            message_size = len(message_str.encode('utf-8'))
            
            if message_size > max_size:
                railway_logger.log('socket_io', 40, f"Message too large: {message_size} bytes (max: {max_size})")
                return False
            
            return True
        except (TypeError, ValueError) as e:
            railway_logger.log('socket_io', 40, f"Message size validation failed: {str(e)}")
            return False
    
    @staticmethod
    def sanitize_message_data(data: Any) -> Any:
        """Sanitize message data to prevent parse errors."""
        try:
            if isinstance(data, dict):
                sanitized = {}
                for key, value in data.items():
                    # Ensure keys are strings
                    if not isinstance(key, str):
                        key = str(key)
                    
                    # Sanitize values
                    sanitized[key] = SocketIOConfigOptimizer.sanitize_message_data(value)
                
                return sanitized
            
            elif isinstance(data, list):
                return [SocketIOConfigOptimizer.sanitize_message_data(item) for item in data]
            
            elif isinstance(data, str):
                # Remove null bytes and control characters
                return data.replace('\x00', '').replace('\r', '').replace('\n', ' ')
            
            elif isinstance(data, (int, float, bool)):
                return data
            
            else:
                # Convert other types to string
                return str(data)
                
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Message sanitization failed: {str(e)}")
            return data
    
    @staticmethod
    def get_connection_quality_metrics() -> Dict[str, Any]:
        """Get connection quality metrics for monitoring."""
        try:
            # This would be implemented with actual Socket.IO connection monitoring
            return {
                'parse_error_rate': 0.0,
                'connection_drop_rate': 0.0,
                'reconnection_success_rate': 1.0,
                'average_message_size': 0,
                'compression_ratio': 0.0,
                'transport_type': 'unknown',
                'last_parse_error': None,
                'connection_uptime': 0
            }
        except Exception as e:
            railway_logger.log('socket_io', 40, f"Failed to get connection quality metrics: {str(e)}")
            return {}
    
    @staticmethod
    def optimize_for_parse_errors() -> Dict[str, Any]:
        """Get configuration optimizations specifically for parse error prevention."""
        return {
            # Reduce message sizes
            'max_http_buffer_size': 500000,  # 500KB
            'max_message_size': 500000,  # 500KB
            
            # Enable compression for smaller messages
            'compression': True,
            'compression_threshold': 256,  # 256 bytes
            
            # Optimize timeouts
            'ping_timeout': 30,  # 30 seconds
            'ping_interval': 20,  # 20 seconds
            
            # Reduce reconnection attempts to prevent rapid cycles
            'reconnection_attempts': 3,
            'reconnection_delay': 2000,  # 2 seconds
            'reconnection_delay_max': 8000,  # 8 seconds
            
            # Disable verbose logging
            'logger': False,
            'engineio_logger': False,
            
            # Force specific transport order
            'transports': ['websocket', 'polling'],
            'allow_upgrades': True,
        }
