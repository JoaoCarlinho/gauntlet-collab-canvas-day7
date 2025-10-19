"""
Production Logger
Optimized logging system for production environments with rate limiting
and intelligent log filtering to prevent Railway rate limit issues.
"""

import logging
import time
import os
from typing import Dict, Any, Optional
from collections import defaultdict, deque
from threading import Lock
import json

class ProductionLogger:
    """
    Production-optimized logger with rate limiting and intelligent filtering.
    """
    
    def __init__(self, name: str, level: str = 'WARNING'):
        self.name = name
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        
        # Rate limiting configuration
        self.rate_limits = {
            'cursor_move': {'interval': 30.0, 'max_per_interval': 5},
            'object_update': {'interval': 10.0, 'max_per_interval': 10},
            'auth': {'interval': 60.0, 'max_per_interval': 3},
            'ai_request': {'interval': 30.0, 'max_per_interval': 5},
            'network_check': {'interval': 60.0, 'max_per_interval': 2},
            'error': {'interval': 0.0, 'max_per_interval': 100},  # Always log errors
            'info': {'interval': 5.0, 'max_per_interval': 3},
            'debug': {'interval': 0.0, 'max_per_interval': 0}  # Disabled in production
        }
        
        # Track log counts per interval
        self.log_counts: Dict[str, deque] = defaultdict(lambda: deque())
        self.lock = Lock()
        
        # Environment-based configuration
        self.is_production = os.environ.get('FLASK_ENV') == 'production'
        self.is_railway = os.environ.get('RAILWAY_ENVIRONMENT') is not None
        
        # Aggregation for high-frequency events
        self.aggregated_logs: Dict[str, Dict[str, Any]] = {}
        self.aggregation_interval = 30.0  # seconds
        self.last_aggregation = time.time()
    
    def _should_log(self, event_type: str) -> bool:
        """Check if we should log this event based on rate limiting."""
        if not self.is_production:
            return True  # No rate limiting in development
        
        with self.lock:
            now = time.time()
            rate_config = self.rate_limits.get(event_type, self.rate_limits['info'])
            
            # Clean old entries
            cutoff_time = now - rate_config['interval']
            while (self.log_counts[event_type] and 
                   self.log_counts[event_type][0] < cutoff_time):
                self.log_counts[event_type].popleft()
            
            # Check if we can log
            if len(self.log_counts[event_type]) < rate_config['max_per_interval']:
                self.log_counts[event_type].append(now)
                return True
            
            return False
    
    def _aggregate_log(self, event_type: str, message: str, level: str = 'INFO'):
        """Aggregate similar logs to reduce volume."""
        if not self.is_production:
            return  # No aggregation in development
        
        now = time.time()
        key = f"{event_type}_{level}"
        
        if key not in self.aggregated_logs:
            self.aggregated_logs[key] = {
                'count': 0,
                'first_seen': now,
                'last_seen': now,
                'message': message,
                'level': level
            }
        
        self.aggregated_logs[key]['count'] += 1
        self.aggregated_logs[key]['last_seen'] = now
        
        # Flush aggregated logs periodically
        if now - self.last_aggregation > self.aggregation_interval:
            self._flush_aggregated_logs()
            self.last_aggregation = now
    
    def _flush_aggregated_logs(self):
        """Flush aggregated logs to reduce volume."""
        for key, data in self.aggregated_logs.items():
            if data['count'] > 1:
                duration = data['last_seen'] - data['first_seen']
                message = f"[AGGREGATED] {data['message']} (occurred {data['count']} times in {duration:.1f}s)"
                
                if data['level'] == 'ERROR':
                    self.logger.error(message)
                elif data['level'] == 'WARNING':
                    self.logger.warning(message)
                else:
                    self.logger.info(message)
            elif data['count'] == 1:
                # Single occurrence, log normally
                if data['level'] == 'ERROR':
                    self.logger.error(data['message'])
                elif data['level'] == 'WARNING':
                    self.logger.warning(data['message'])
                else:
                    self.logger.info(data['message'])
        
        self.aggregated_logs.clear()
    
    def log_cursor_move(self, user_id: str, position: Dict[str, float]):
        """Log cursor movement with heavy rate limiting."""
        if self._should_log('cursor_move'):
            self._aggregate_log('cursor_move', f"Cursor: {user_id} -> ({position['x']:.1f}, {position['y']:.1f})")
    
    def log_object_update(self, user_id: str, object_id: str, action: str):
        """Log object updates with rate limiting."""
        if self._should_log('object_update'):
            self._aggregate_log('object_update', f"Object {action}: {object_id} by {user_id}")
    
    def log_auth(self, user_id: str, action: str):
        """Log authentication events with rate limiting."""
        if self._should_log('auth'):
            self.logger.info(f"Auth: {action} for user {user_id}")
    
    def log_ai_request(self, user_id: str, request_type: str, success: bool = True):
        """Log AI requests with rate limiting."""
        if self._should_log('ai_request'):
            status = "SUCCESS" if success else "FAILED"
            self._aggregate_log('ai_request', f"AI {request_type}: {status} for user {user_id}")
    
    def log_network_check(self, service: str, status: str):
        """Log network health checks with heavy rate limiting."""
        if self._should_log('network_check'):
            self._aggregate_log('network_check', f"Network check: {service} -> {status}")
    
    def log_error(self, message: str, error: Exception = None, context: Dict[str, Any] = None):
        """Always log errors (highest priority)."""
        if error:
            error_msg = f"ERROR: {message} - {str(error)}"
        else:
            error_msg = f"ERROR: {message}"
        
        if context:
            error_msg += f" | Context: {json.dumps(context, default=str)}"
        
        self.logger.error(error_msg)
    
    def log_warning(self, message: str, context: Dict[str, Any] = None):
        """Log warnings with rate limiting."""
        if self._should_log('info'):
            warning_msg = f"WARNING: {message}"
            if context:
                warning_msg += f" | Context: {json.dumps(context, default=str)}"
            self.logger.warning(warning_msg)
    
    def log_info(self, message: str, context: Dict[str, Any] = None):
        """Log info with rate limiting."""
        if self._should_log('info'):
            info_msg = f"INFO: {message}"
            if context:
                info_msg += f" | Context: {json.dumps(context, default=str)}"
            self.logger.info(info_msg)
    
    def log_debug(self, message: str, context: Dict[str, Any] = None):
        """Log debug messages (disabled in production)."""
        if not self.is_production and self._should_log('debug'):
            debug_msg = f"DEBUG: {message}"
            if context:
                debug_msg += f" | Context: {json.dumps(context, default=str)}"
            self.logger.debug(debug_msg)
    
    def log_performance(self, operation: str, duration: float, user_id: str = None):
        """Log performance metrics with rate limiting."""
        if self._should_log('info'):
            perf_msg = f"PERF: {operation} took {duration:.3f}s"
            if user_id:
                perf_msg += f" for user {user_id}"
            self.logger.info(perf_msg)
    
    def get_log_stats(self) -> Dict[str, Any]:
        """Get current logging statistics."""
        with self.lock:
            stats = {}
            for event_type, times in self.log_counts.items():
                stats[event_type] = {
                    'count': len(times),
                    'rate_limit': self.rate_limits.get(event_type, {}),
                    'last_log': times[-1] if times else None
                }
            return stats
    
    def flush_aggregated(self):
        """Manually flush aggregated logs."""
        self._flush_aggregated_logs()


# Global production logger instance
production_logger = ProductionLogger('collabcanvas_production', 'WARNING')

# Convenience functions
def log_cursor_move(user_id: str, position: Dict[str, float]):
    production_logger.log_cursor_move(user_id, position)

def log_object_update(user_id: str, object_id: str, action: str):
    production_logger.log_object_update(user_id, object_id, action)

def log_auth(user_id: str, action: str):
    production_logger.log_auth(user_id, action)

def log_ai_request(user_id: str, request_type: str, success: bool = True):
    production_logger.log_ai_request(user_id, request_type, success)

def log_network_check(service: str, status: str):
    production_logger.log_network_check(service, status)

def log_error(message: str, error: Exception = None, context: Dict[str, Any] = None):
    production_logger.log_error(message, error, context)

def log_warning(message: str, context: Dict[str, Any] = None):
    production_logger.log_warning(message, context)

def log_info(message: str, context: Dict[str, Any] = None):
    production_logger.log_info(message, context)

def log_debug(message: str, context: Dict[str, Any] = None):
    production_logger.log_debug(message, context)

def log_performance(operation: str, duration: float, user_id: str = None):
    production_logger.log_performance(operation, duration, user_id)

def get_log_stats() -> Dict[str, Any]:
    return production_logger.get_log_stats()

def flush_aggregated_logs():
    production_logger.flush_aggregated()
