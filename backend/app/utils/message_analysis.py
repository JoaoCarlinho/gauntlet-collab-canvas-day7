"""
Message Analysis Utility
Analyzes socket message sizes, formats, and content to identify parse error causes.
"""

import json
import time
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict, deque
from app.utils.railway_logger import railway_logger

class MessageAnalyzer:
    """Analyzes socket messages for size, format, and content issues."""
    
    def __init__(self):
        self.message_history = deque(maxlen=1000)  # Keep last 1000 messages
        self.size_analysis = defaultdict(list)     # Size analysis by message type
        self.format_analysis = defaultdict(int)    # Format analysis by message type
        self.content_analysis = defaultdict(list)  # Content analysis by message type
        
        # Size limits (in bytes)
        self.size_limits = {
            'object_created': 1000000,    # 1MB
            'object_updated': 500000,     # 500KB
            'cursor_move': 10000,         # 10KB
            'user_online': 5000,          # 5KB
            'default': 100000             # 100KB
        }
        
        self.start_time = time.time()
    
    def analyze_message(self, message_type: str, data: Any, user_id: str = 'unknown') -> Dict[str, Any]:
        """Analyze a socket message for potential issues."""
        try:
            # Serialize message to get size
            message_str = json.dumps(data)
            message_size = len(message_str.encode('utf-8'))
            
            # Get size limit for this message type
            size_limit = self.size_limits.get(message_type, self.size_limits['default'])
            
            # Analyze message structure
            structure_analysis = self._analyze_structure(data)
            
            # Analyze content
            content_analysis = self._analyze_content(data)
            
            # Check for potential issues
            issues = []
            if message_size > size_limit:
                issues.append(f"Message size {message_size} exceeds limit {size_limit}")
            
            if structure_analysis.get('has_circular_refs', False):
                issues.append("Message contains circular references")
            
            if structure_analysis.get('has_invalid_types', False):
                issues.append("Message contains invalid types")
            
            if content_analysis.get('has_large_strings', False):
                issues.append("Message contains large strings")
            
            if content_analysis.get('has_deep_nesting', False):
                issues.append("Message has deep nesting")
            
            # Store analysis results
            analysis_result = {
                'message_type': message_type,
                'user_id': user_id,
                'timestamp': time.time(),
                'message_size': message_size,
                'size_limit': size_limit,
                'size_ratio': message_size / size_limit,
                'structure_analysis': structure_analysis,
                'content_analysis': content_analysis,
                'issues': issues,
                'has_issues': len(issues) > 0
            }
            
            # Store in history
            self.message_history.append(analysis_result)
            self.size_analysis[message_type].append(message_size)
            self.format_analysis[message_type] += 1
            self.content_analysis[message_type].append(content_analysis)
            
            # Log analysis
            if issues:
                railway_logger.log('message_analysis', 30, f"Message analysis found issues for {message_type}: {issues}")
            else:
                railway_logger.log('message_analysis', 10, f"Message analysis passed for {message_type}, size: {message_size}")
            
            return analysis_result
            
        except Exception as e:
            railway_logger.log('message_analysis', 40, f"Message analysis failed: {str(e)}")
            return {
                'message_type': message_type,
                'user_id': user_id,
                'timestamp': time.time(),
                'error': str(e),
                'has_issues': True
            }
    
    def _analyze_structure(self, data: Any, visited: Optional[set] = None) -> Dict[str, Any]:
        """Analyze message structure for potential issues."""
        if visited is None:
            visited = set()
        
        analysis = {
            'has_circular_refs': False,
            'has_invalid_types': False,
            'max_depth': 0,
            'total_keys': 0,
            'total_values': 0,
            'type_distribution': defaultdict(int)
        }
        
        try:
            self._analyze_structure_recursive(data, visited, analysis, 0)
        except RecursionError:
            analysis['has_circular_refs'] = True
        except Exception as e:
            analysis['has_invalid_types'] = True
            analysis['error'] = str(e)
        
        return dict(analysis)
    
    def _analyze_structure_recursive(self, data: Any, visited: set, analysis: Dict[str, Any], depth: int) -> None:
        """Recursively analyze message structure."""
        if depth > analysis['max_depth']:
            analysis['max_depth'] = depth
        
        if depth > 10:  # Deep nesting threshold
            analysis['has_deep_nesting'] = True
        
        # Check for circular references
        if id(data) in visited:
            analysis['has_circular_refs'] = True
            return
        
        visited.add(id(data))
        
        # Analyze data type
        data_type = type(data).__name__
        analysis['type_distribution'][data_type] += 1
        
        if isinstance(data, dict):
            analysis['total_keys'] += len(data)
            for key, value in data.items():
                if not isinstance(key, (str, int, float, bool)):
                    analysis['has_invalid_types'] = True
                self._analyze_structure_recursive(value, visited, analysis, depth + 1)
        elif isinstance(data, (list, tuple)):
            analysis['total_values'] += len(data)
            for item in data:
                self._analyze_structure_recursive(item, visited, analysis, depth + 1)
        elif isinstance(data, str):
            if len(data) > 10000:  # Large string threshold
                analysis['has_large_strings'] = True
        elif not isinstance(data, (int, float, bool, type(None))):
            analysis['has_invalid_types'] = True
        
        visited.discard(id(data))
    
    def _analyze_content(self, data: Any) -> Dict[str, Any]:
        """Analyze message content for potential issues."""
        analysis = {
            'has_large_strings': False,
            'has_deep_nesting': False,
            'has_binary_data': False,
            'has_special_chars': False,
            'string_count': 0,
            'total_string_length': 0,
            'max_string_length': 0
        }
        
        try:
            self._analyze_content_recursive(data, analysis, 0)
        except Exception as e:
            analysis['error'] = str(e)
        
        return analysis
    
    def _analyze_content_recursive(self, data: Any, analysis: Dict[str, Any], depth: int) -> None:
        """Recursively analyze message content."""
        if depth > 10:
            analysis['has_deep_nesting'] = True
        
        if isinstance(data, dict):
            for key, value in data.items():
                self._analyze_content_recursive(value, analysis, depth + 1)
        elif isinstance(data, (list, tuple)):
            for item in data:
                self._analyze_content_recursive(item, analysis, depth + 1)
        elif isinstance(data, str):
            analysis['string_count'] += 1
            analysis['total_string_length'] += len(data)
            if len(data) > analysis['max_string_length']:
                analysis['max_string_length'] = len(data)
            
            if len(data) > 10000:
                analysis['has_large_strings'] = True
            
            # Check for special characters that might cause parsing issues
            if any(ord(c) < 32 and c not in '\t\n\r' for c in data):
                analysis['has_special_chars'] = True
        elif isinstance(data, bytes):
            analysis['has_binary_data'] = True
    
    def get_size_statistics(self, message_type: str = None) -> Dict[str, Any]:
        """Get size statistics for messages."""
        if message_type:
            sizes = self.size_analysis.get(message_type, [])
        else:
            sizes = [size for sizes_list in self.size_analysis.values() for size in sizes_list]
        
        if not sizes:
            return {'count': 0, 'average': 0, 'min': 0, 'max': 0, 'median': 0}
        
        sizes.sort()
        count = len(sizes)
        average = sum(sizes) / count
        min_size = sizes[0]
        max_size = sizes[-1]
        median = sizes[count // 2]
        
        return {
            'count': count,
            'average': average,
            'min': min_size,
            'max': max_size,
            'median': median,
            'size_limit': self.size_limits.get(message_type, self.size_limits['default']),
            'exceeds_limit_count': sum(1 for size in sizes if size > self.size_limits.get(message_type, self.size_limits['default']))
        }
    
    def get_format_statistics(self) -> Dict[str, Any]:
        """Get format statistics for messages."""
        total_messages = sum(self.format_analysis.values())
        
        return {
            'total_messages': total_messages,
            'message_types': dict(self.format_analysis),
            'type_distribution': {
                msg_type: count / total_messages if total_messages > 0 else 0
                for msg_type, count in self.format_analysis.items()
            }
        }
    
    def get_issue_summary(self) -> Dict[str, Any]:
        """Get summary of message issues."""
        total_messages = len(self.message_history)
        messages_with_issues = sum(1 for msg in self.message_history if msg.get('has_issues', False))
        
        issue_types = defaultdict(int)
        for msg in self.message_history:
            for issue in msg.get('issues', []):
                issue_types[issue] += 1
        
        return {
            'total_messages': total_messages,
            'messages_with_issues': messages_with_issues,
            'issue_rate': messages_with_issues / total_messages if total_messages > 0 else 0,
            'issue_types': dict(issue_types),
            'recent_issues': [
                {
                    'message_type': msg['message_type'],
                    'timestamp': msg['timestamp'],
                    'issues': msg.get('issues', [])
                }
                for msg in list(self.message_history)[-10:] if msg.get('has_issues', False)
            ]
        }
    
    def get_recommendations(self) -> List[str]:
        """Get recommendations based on analysis."""
        recommendations = []
        
        # Check size issues
        size_stats = self.get_size_statistics()
        if size_stats['exceeds_limit_count'] > 0:
            recommendations.append(f"Reduce message sizes: {size_stats['exceeds_limit_count']} messages exceed size limits")
        
        # Check issue rate
        issue_summary = self.get_issue_summary()
        if issue_summary['issue_rate'] > 0.1:  # More than 10% of messages have issues
            recommendations.append(f"High issue rate: {issue_summary['issue_rate']:.1%} of messages have issues")
        
        # Check specific issue types
        for issue_type, count in issue_summary['issue_types'].items():
            if count > 5:  # More than 5 occurrences
                recommendations.append(f"Address {issue_type}: {count} occurrences")
        
        return recommendations
    
    def reset_analysis(self) -> None:
        """Reset all analysis data."""
        self.message_history.clear()
        self.size_analysis.clear()
        self.format_analysis.clear()
        self.content_analysis.clear()
        self.start_time = time.time()
        railway_logger.log('message_analysis', 10, "Message analysis data reset")

# Global instance
message_analyzer = MessageAnalyzer()
