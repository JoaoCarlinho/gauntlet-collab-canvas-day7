"""
Connection Monitoring Service
Tracks connection quality metrics and parse error statistics for Socket.IO connections.
"""

import time
from typing import Dict, Any, Optional
from collections import defaultdict, deque
from app.utils.railway_logger import railway_logger

class ConnectionMonitoringService:
    """Service for monitoring Socket.IO connection health and quality."""
    
    def __init__(self):
        self.connection_metrics = defaultdict(lambda: {
            'total_connections': 0,
            'successful_connections': 0,
            'failed_connections': 0,
            'parse_errors': 0,
            'connection_drops': 0,
            'reconnection_attempts': 0,
            'reconnection_successes': 0,
            'average_message_size': 0,
            'last_connection_time': 0,
            'connection_streak': 0,
            'longest_streak': 0
        })
        
        self.parse_error_history = deque(maxlen=100)  # Keep last 100 parse errors
        self.connection_history = deque(maxlen=50)    # Keep last 50 connections
        self.message_size_history = deque(maxlen=200) # Keep last 200 message sizes
        
        self.start_time = time.time()
    
    def record_connection_attempt(self, user_id: str = 'unknown') -> None:
        """Record a connection attempt."""
        self.connection_metrics[user_id]['total_connections'] += 1
        self.connection_metrics[user_id]['last_connection_time'] = time.time()
        
        railway_logger.log('connection_monitor', 10, f"Connection attempt recorded for user: {user_id}")
    
    def record_connection_success(self, user_id: str = 'unknown') -> None:
        """Record a successful connection."""
        self.connection_metrics[user_id]['successful_connections'] += 1
        self.connection_metrics[user_id]['connection_streak'] += 1
        
        if self.connection_metrics[user_id]['connection_streak'] > self.connection_metrics[user_id]['longest_streak']:
            self.connection_metrics[user_id]['longest_streak'] = self.connection_metrics[user_id]['connection_streak']
        
        # Record in connection history
        self.connection_history.append({
            'user_id': user_id,
            'timestamp': time.time(),
            'success': True
        })
        
        railway_logger.log('connection_monitor', 10, f"Connection success recorded for user: {user_id}")
    
    def record_connection_failure(self, user_id: str = 'unknown', error_type: str = 'unknown') -> None:
        """Record a connection failure."""
        self.connection_metrics[user_id]['failed_connections'] += 1
        self.connection_metrics[user_id]['connection_streak'] = 0
        
        # Record in connection history
        self.connection_history.append({
            'user_id': user_id,
            'timestamp': time.time(),
            'success': False,
            'error_type': error_type
        })
        
        railway_logger.log('connection_monitor', 20, f"Connection failure recorded for user: {user_id}, error: {error_type}")
    
    def record_parse_error(self, user_id: str = 'unknown', error_details: Optional[Dict[str, Any]] = None) -> None:
        """Record a parse error."""
        self.connection_metrics[user_id]['parse_errors'] += 1
        
        # Record in parse error history
        self.parse_error_history.append({
            'user_id': user_id,
            'timestamp': time.time(),
            'error_details': error_details or {}
        })
        
        railway_logger.log('connection_monitor', 30, f"Parse error recorded for user: {user_id}")
    
    def record_connection_drop(self, user_id: str = 'unknown', reason: str = 'unknown') -> None:
        """Record a connection drop."""
        self.connection_metrics[user_id]['connection_drops'] += 1
        
        railway_logger.log('connection_monitor', 20, f"Connection drop recorded for user: {user_id}, reason: {reason}")
    
    def record_reconnection_attempt(self, user_id: str = 'unknown') -> None:
        """Record a reconnection attempt."""
        self.connection_metrics[user_id]['reconnection_attempts'] += 1
        
        railway_logger.log('connection_monitor', 10, f"Reconnection attempt recorded for user: {user_id}")
    
    def record_reconnection_success(self, user_id: str = 'unknown') -> None:
        """Record a successful reconnection."""
        self.connection_metrics[user_id]['reconnection_successes'] += 1
        
        railway_logger.log('connection_monitor', 10, f"Reconnection success recorded for user: {user_id}")
    
    def record_message_size(self, size: int, user_id: str = 'unknown') -> None:
        """Record message size for analysis."""
        self.message_size_history.append({
            'user_id': user_id,
            'size': size,
            'timestamp': time.time()
        })
        
        # Update average message size
        if self.message_size_history:
            total_size = sum(msg['size'] for msg in self.message_size_history)
            avg_size = total_size / len(self.message_size_history)
            self.connection_metrics[user_id]['average_message_size'] = avg_size
    
    def get_connection_quality(self, user_id: str = 'unknown') -> str:
        """Get connection quality rating for a user."""
        metrics = self.connection_metrics[user_id]
        
        # Calculate success rate
        total_connections = metrics['total_connections']
        if total_connections == 0:
            return 'unknown'
        
        success_rate = metrics['successful_connections'] / total_connections
        parse_error_rate = metrics['parse_errors'] / max(total_connections, 1)
        
        # Determine quality based on metrics
        if success_rate >= 0.95 and parse_error_rate <= 0.01:
            return 'excellent'
        elif success_rate >= 0.85 and parse_error_rate <= 0.05:
            return 'good'
        elif success_rate >= 0.70 and parse_error_rate <= 0.10:
            return 'fair'
        else:
            return 'poor'
    
    def get_parse_error_metrics(self) -> Dict[str, Any]:
        """Get parse error metrics."""
        total_parse_errors = sum(metrics['parse_errors'] for metrics in self.connection_metrics.values())
        
        # Calculate parse error rate (errors per minute)
        uptime_minutes = (time.time() - self.start_time) / 60
        parse_error_rate = total_parse_errors / max(uptime_minutes, 1)
        
        return {
            'total_parse_errors': total_parse_errors,
            'parse_error_rate_per_minute': parse_error_rate,
            'recent_parse_errors': list(self.parse_error_history)[-10:],  # Last 10 errors
            'parse_error_trend': self._calculate_parse_error_trend()
        }
    
    def get_connection_metrics(self, user_id: str = 'unknown') -> Dict[str, Any]:
        """Get connection metrics for a specific user."""
        metrics = self.connection_metrics[user_id].copy()
        metrics['connection_quality'] = self.get_connection_quality(user_id)
        metrics['uptime_seconds'] = time.time() - self.start_time
        
        return metrics
    
    def get_overall_metrics(self) -> Dict[str, Any]:
        """Get overall connection metrics."""
        total_connections = sum(metrics['total_connections'] for metrics in self.connection_metrics.values())
        total_successful = sum(metrics['successful_connections'] for metrics in self.connection_metrics.values())
        total_failed = sum(metrics['failed_connections'] for metrics in self.connection_metrics.values())
        total_parse_errors = sum(metrics['parse_errors'] for metrics in self.connection_metrics.values())
        
        success_rate = total_successful / max(total_connections, 1)
        parse_error_rate = total_parse_errors / max(total_connections, 1)
        
        return {
            'total_connections': total_connections,
            'successful_connections': total_successful,
            'failed_connections': total_failed,
            'success_rate': success_rate,
            'parse_errors': total_parse_errors,
            'parse_error_rate': parse_error_rate,
            'active_users': len(self.connection_metrics),
            'uptime_seconds': time.time() - self.start_time,
            'recent_connections': list(self.connection_history)[-20:],  # Last 20 connections
            'average_message_size': sum(msg['size'] for msg in self.message_size_history) / max(len(self.message_size_history), 1)
        }
    
    def _calculate_parse_error_trend(self) -> str:
        """Calculate parse error trend (increasing, decreasing, stable)."""
        if len(self.parse_error_history) < 10:
            return 'insufficient_data'
        
        # Compare first half vs second half of recent errors
        mid_point = len(self.parse_error_history) // 2
        first_half = list(self.parse_error_history)[:mid_point]
        second_half = list(self.parse_error_history)[mid_point:]
        
        first_half_count = len(first_half)
        second_half_count = len(second_half)
        
        if second_half_count > first_half_count * 1.2:
            return 'increasing'
        elif second_half_count < first_half_count * 0.8:
            return 'decreasing'
        else:
            return 'stable'
    
    def reset_metrics(self, user_id: Optional[str] = None) -> None:
        """Reset metrics for a specific user or all users."""
        if user_id:
            self.connection_metrics[user_id] = {
                'total_connections': 0,
                'successful_connections': 0,
                'failed_connections': 0,
                'parse_errors': 0,
                'connection_drops': 0,
                'reconnection_attempts': 0,
                'reconnection_successes': 0,
                'average_message_size': 0,
                'last_connection_time': 0,
                'connection_streak': 0,
                'longest_streak': 0
            }
            railway_logger.log('connection_monitor', 10, f"Metrics reset for user: {user_id}")
        else:
            self.connection_metrics.clear()
            self.parse_error_history.clear()
            self.connection_history.clear()
            self.message_size_history.clear()
            self.start_time = time.time()
            railway_logger.log('connection_monitor', 10, "All metrics reset")

# Global instance
connection_monitor = ConnectionMonitoringService()
