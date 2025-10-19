"""
Logging Configuration
Centralized logging configuration for different environments
with Railway rate limit optimization.
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
try:
    from app.utils.production_logger import production_logger
except ImportError:
    production_logger = None

class LoggingConfig:
    """Centralized logging configuration."""
    
    @staticmethod
    def setup_logging(app):
        """Setup logging configuration based on environment."""
        if app.config.get('FLASK_ENV') == 'production':
            LoggingConfig._setup_production_logging(app)
        else:
            LoggingConfig._setup_development_logging(app)
    
    @staticmethod
    def _setup_production_logging(app):
        """Setup production logging with Railway optimization."""
        
        # Remove all existing handlers
        for handler in app.logger.handlers[:]:
            app.logger.removeHandler(handler)
        
        # Set production log level
        app.logger.setLevel(logging.WARNING)
        
        # Create console handler with rate limiting
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.WARNING)
        
        # Create formatter for production
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)
        
        # Add handler to app logger
        app.logger.addHandler(console_handler)
        
        # Disable Flask-SocketIO logging in production
        logging.getLogger('socketio').setLevel(logging.ERROR)
        logging.getLogger('engineio').setLevel(logging.ERROR)
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
        
        # Disable third-party library logging
        logging.getLogger('urllib3').setLevel(logging.ERROR)
        logging.getLogger('requests').setLevel(logging.ERROR)
        logging.getLogger('openai').setLevel(logging.ERROR)
        
        # Set specific loggers to WARNING level
        logging.getLogger('app').setLevel(logging.WARNING)
        logging.getLogger('app.services').setLevel(logging.WARNING)
        logging.getLogger('app.routes').setLevel(logging.WARNING)
        logging.getLogger('app.socket_handlers').setLevel(logging.WARNING)
        
        # Only log errors for high-frequency components
        logging.getLogger('app.socket_handlers.cursor_events').setLevel(logging.ERROR)
        logging.getLogger('app.socket_handlers.canvas_events').setLevel(logging.ERROR)
        logging.getLogger('app.services.ai_agent_service').setLevel(logging.ERROR)
        
        app.logger.info("Production logging configured with Railway optimization")
    
    @staticmethod
    def _setup_development_logging(app):
        """Setup development logging with full verbosity."""
        
        # Remove all existing handlers
        for handler in app.logger.handlers[:]:
            app.logger.removeHandler(handler)
        
        # Set development log level
        app.logger.setLevel(logging.DEBUG)
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        
        # Create formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)
        
        # Add handler to app logger
        app.logger.addHandler(console_handler)
        
        # Enable Flask-SocketIO logging in development
        logging.getLogger('socketio').setLevel(logging.INFO)
        logging.getLogger('engineio').setLevel(logging.INFO)
        
        app.logger.info("Development logging configured")
    
    @staticmethod
    def get_log_level_for_component(component_name: str, is_production: bool = False) -> str:
        """Get appropriate log level for a component."""
        if not is_production:
            return 'DEBUG'
        
        # High-frequency components get ERROR level only
        high_frequency_components = [
            'cursor_events',
            'canvas_events',
            'object_update',
            'network_health',
            'socket_connection'
        ]
        
        if any(comp in component_name.lower() for comp in high_frequency_components):
            return 'ERROR'
        
        # Medium-frequency components get WARNING level
        medium_frequency_components = [
            'ai_agent',
            'auth',
            'user_management',
            'canvas_management'
        ]
        
        if any(comp in component_name.lower() for comp in medium_frequency_components):
            return 'WARNING'
        
        # Low-frequency components get INFO level
        return 'INFO'
    
    @staticmethod
    def configure_component_logger(component_name: str, is_production: bool = False):
        """Configure logger for a specific component."""
        logger = logging.getLogger(component_name)
        log_level = LoggingConfig.get_log_level_for_component(component_name, is_production)
        logger.setLevel(getattr(logging, log_level.upper()))
        return logger


class RailwayLoggingOptimizer:
    """Specialized logging optimizer for Railway deployment."""
    
    def __init__(self):
        self.is_railway = os.environ.get('RAILWAY_ENVIRONMENT') is not None
        self.log_count = 0
        self.last_reset = 0
        self.max_logs_per_minute = 200  # Conservative limit for Railway
    
    def should_log(self, level: str = 'INFO') -> bool:
        """Check if we should log based on Railway limits."""
        if not self.is_railway:
            return True
        
        import time
        now = time.time()
        
        # Reset counter every minute
        if now - self.last_reset > 60:
            self.log_count = 0
            self.last_reset = now
        
        # Check if we're within limits
        if level == 'ERROR':
            return True  # Always log errors
        elif level == 'WARNING':
            return self.log_count < self.max_logs_per_minute * 0.5
        else:
            return self.log_count < self.max_logs_per_minute * 0.1
    
    def increment_log_count(self):
        """Increment the log counter."""
        if self.is_railway:
            self.log_count += 1


# Global Railway logging optimizer
railway_optimizer = RailwayLoggingOptimizer()
