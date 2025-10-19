"""
Railway-optimized logging utility to prevent rate limit issues.
Implements log rate limiting, aggregation, and sampling.
"""

import time
import logging
import threading
from collections import defaultdict, deque
from typing import Dict, Any, Optional
from functools import wraps

class RailwayLogger:
    """
    Railway-optimized logger that prevents rate limit issues.
    Features:
    - Log rate limiting
    - Log aggregation
    - Log sampling
    - Component-specific log levels
    """
    
    def __init__(self, max_logs_per_minute: int = 50):
        self.max_logs_per_minute = max_logs_per_minute
        self.log_times = deque()
        self.log_counts = defaultdict(int)
        self.aggregated_logs = defaultdict(list)
        self.last_aggregation = time.time()
        self.lock = threading.Lock()
        
        # Component-specific log levels
        self.component_levels = {
            'socket_io': logging.ERROR,
            'auth': logging.ERROR,
            'canvas': logging.ERROR,
            'collaboration': logging.ERROR,
            'cursor': logging.ERROR,
            'ai_agent': logging.ERROR,
            'network_health': logging.ERROR,
            'object_update': logging.ERROR,
            'default': logging.ERROR
        }
        
        # Log sampling rates (1 = log all, 0.1 = log 10%)
        self.sampling_rates = {
            'socket_io': 0.01,  # 1% of Socket.IO events
            'cursor': 0.001,    # 0.1% of cursor events
            'object_update': 0.1,  # 10% of object updates
            'auth': 1.0,        # 100% of auth events (important)
            'default': 0.1      # 10% of other events
        }
    
    def should_log(self, component: str = 'default', level: int = logging.INFO) -> bool:
        """
        Determine if a log should be emitted based on rate limiting and sampling.
        """
        with self.lock:
            now = time.time()
            
            # Check component-specific log level
            component_level = self.component_levels.get(component, self.component_levels['default'])
            if level < component_level:
                return False
            
            # Check rate limiting
            if not self._check_rate_limit(now):
                return False
            
            # Check sampling
            if not self._should_sample(component):
                return False
            
            # Record the log
            self.log_times.append(now)
            self.log_counts[component] += 1
            
            return True
    
    def _check_rate_limit(self, now: float) -> bool:
        """Check if we're within the rate limit."""
        # Remove logs older than 1 minute
        while self.log_times and now - self.log_times[0] > 60:
            self.log_times.popleft()
        
        # Check if we're under the limit
        return len(self.log_times) < self.max_logs_per_minute
    
    def _should_sample(self, component: str) -> bool:
        """Determine if this log should be sampled."""
        import random
        sampling_rate = self.sampling_rates.get(component, self.sampling_rates['default'])
        return random.random() < sampling_rate
    
    def aggregate_log(self, component: str, message: str, level: int = logging.INFO):
        """Aggregate similar logs to reduce volume."""
        with self.lock:
            now = time.time()
            key = f"{component}:{level}:{hash(message) % 1000}"  # Group similar messages
            
            self.aggregated_logs[key].append({
                'message': message,
                'count': 1,
                'first_seen': now,
                'last_seen': now,
                'level': level
            })
            
            # Emit aggregated logs every 30 seconds
            if now - self.last_aggregation > 30:
                self._emit_aggregated_logs()
                self.last_aggregation = now
    
    def _emit_aggregated_logs(self):
        """Emit aggregated logs."""
        for key, logs in self.aggregated_logs.items():
            if logs:
                # Get the most recent log
                latest = logs[-1]
                total_count = sum(log['count'] for log in logs)
                
                if total_count > 1:
                    # Emit aggregated message
                    aggregated_message = f"[AGGREGATED {total_count}x] {latest['message']}"
                    self._emit_log(latest['level'], aggregated_message)
                else:
                    # Emit single message
                    self._emit_log(latest['level'], latest['message'])
                
                # Clear aggregated logs
                logs.clear()
    
    def _emit_log(self, level: int, message: str):
        """Actually emit the log."""
        logger = logging.getLogger('railway_optimized')
        logger.log(level, message)
    
    def log(self, component: str, level: int, message: str, aggregate: bool = False):
        """
        Log a message with Railway optimization.
        
        Args:
            component: Component name (socket_io, auth, canvas, etc.)
            level: Log level (logging.INFO, logging.WARNING, etc.)
            message: Log message
            aggregate: Whether to aggregate similar messages
        """
        if aggregate:
            self.aggregate_log(component, message, level)
        else:
            if self.should_log(component, level):
                self._emit_log(level, message)

# Global instance
railway_logger = RailwayLogger()

def railway_log(component: str = 'default', level: int = logging.INFO, aggregate: bool = False):
    """
    Decorator for Railway-optimized logging.
    
    Usage:
        @railway_log('socket_io', logging.INFO, aggregate=True)
        def some_function():
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if railway_logger.should_log(component, level):
                railway_logger.log(component, level, f"Executing {func.__name__}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

def log_socket_event(component: str, event: str, success: bool = True):
    """Log Socket.IO events with Railway optimization."""
    level = logging.INFO if success else logging.ERROR
    message = f"Socket.IO {component}: {event} {'success' if success else 'failed'}"
    railway_logger.log(component, level, message, aggregate=True)

def log_auth_event(user_id: str, event: str, success: bool = True):
    """Log authentication events with Railway optimization."""
    level = logging.INFO if success else logging.ERROR
    message = f"Auth {event} for user {user_id[:8]}... {'success' if success else 'failed'}"
    railway_logger.log('auth', level, message, aggregate=False)  # Don't aggregate auth logs

def log_canvas_event(canvas_id: str, event: str, success: bool = True):
    """Log canvas events with Railway optimization."""
    level = logging.INFO if success else logging.ERROR
    message = f"Canvas {event} for canvas {canvas_id[:8]}... {'success' if success else 'failed'}"
    railway_logger.log('canvas', level, message, aggregate=True)

def log_cursor_event(user_id: str, event: str):
    """Log cursor events with Railway optimization (high sampling)."""
    message = f"Cursor {event} for user {user_id[:8]}..."
    railway_logger.log('cursor', logging.DEBUG, message, aggregate=True)

def log_object_event(canvas_id: str, event: str, object_type: str, success: bool = True):
    """Log object events with Railway optimization."""
    level = logging.INFO if success else logging.ERROR
    message = f"Object {event} ({object_type}) on canvas {canvas_id[:8]}... {'success' if success else 'failed'}"
    railway_logger.log('object_update', level, message, aggregate=True)

# Replace print statements with Railway-optimized logging
def railway_print(message: str, component: str = 'default', level: int = logging.INFO):
    """Replace print() statements with Railway-optimized logging."""
    railway_logger.log(component, level, message, aggregate=True)
