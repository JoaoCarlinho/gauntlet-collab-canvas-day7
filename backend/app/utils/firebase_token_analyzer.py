"""
Firebase Token Analyzer
Analyzes Firebase authentication tokens for size, format, and parsing issues that may cause socket errors.
"""

import json
import time
import base64
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict, deque
from app.utils.railway_logger import railway_logger

class FirebaseTokenAnalyzer:
    """Analyzes Firebase authentication tokens for potential parse error causes."""
    
    def __init__(self):
        self.token_history = deque(maxlen=1000)  # Keep last 1000 tokens
        self.token_analysis = defaultdict(list)  # Analysis by token characteristics
        self.parse_errors = deque(maxlen=100)    # Keep last 100 parse errors
        self.start_time = time.time()
        
        # Token size thresholds
        self.size_thresholds = {
            'small': 1000,      # < 1KB
            'medium': 5000,     # 1-5KB
            'large': 10000,     # 5-10KB
            'very_large': 50000 # > 10KB
        }
    
    def analyze_token(self, token: str, context: str = 'unknown') -> Dict[str, Any]:
        """Analyze a Firebase token for potential issues."""
        try:
            analysis = {
                'context': context,
                'timestamp': time.time(),
                'token_length': len(token),
                'token_size_bytes': len(token.encode('utf-8')),
                'is_valid_format': False,
                'has_parse_issues': False,
                'issues': [],
                'token_parts': {},
                'character_analysis': {},
                'serialization_test': {}
            }
            
            # Basic token format validation
            if not token or not isinstance(token, str):
                analysis['issues'].append('Token is empty or not a string')
                analysis['has_parse_issues'] = True
                return analysis
            
            # Check token length
            if len(token) < 100:
                analysis['issues'].append('Token too short (likely invalid)')
                analysis['has_parse_issues'] = True
            elif len(token) > 10000:
                analysis['issues'].append('Token unusually long')
                analysis['has_parse_issues'] = True
            
            # Analyze token structure (JWT format: header.payload.signature)
            token_parts = self._analyze_token_structure(token)
            analysis['token_parts'] = token_parts
            
            # Character analysis
            char_analysis = self._analyze_token_characters(token)
            analysis['character_analysis'] = char_analysis
            
            # Check for problematic characters
            if char_analysis.get('has_control_chars', False):
                analysis['issues'].append('Token contains control characters')
                analysis['has_parse_issues'] = True
            
            if char_analysis.get('has_non_ascii', False):
                analysis['issues'].append('Token contains non-ASCII characters')
                analysis['has_parse_issues'] = True
            
            # Test JSON serialization
            serialization_test = self._test_token_serialization(token)
            analysis['serialization_test'] = serialization_test
            
            if not serialization_test.get('success', False):
                analysis['issues'].append(f"Token serialization failed: {serialization_test.get('error', 'Unknown error')}")
                analysis['has_parse_issues'] = True
            
            # Test token in socket message context
            socket_test = self._test_token_in_socket_context(token)
            analysis['socket_context_test'] = socket_test
            
            if not socket_test.get('success', False):
                analysis['issues'].append(f"Token socket context test failed: {socket_test.get('error', 'Unknown error')}")
                analysis['has_parse_issues'] = True
            
            # Determine if token format is valid
            analysis['is_valid_format'] = (
                len(analysis['issues']) == 0 and
                token_parts.get('has_valid_structure', False) and
                serialization_test.get('success', False)
            )
            
            # Store analysis
            self.token_history.append(analysis)
            self._categorize_token_analysis(analysis)
            
            # Log analysis results
            if analysis['has_parse_issues']:
                railway_logger.log('firebase_token', 30, f"Token analysis found issues for {context}: {analysis['issues']}")
            else:
                railway_logger.log('firebase_token', 10, f"Token analysis passed for {context}, size: {analysis['token_size_bytes']} bytes")
            
            return analysis
            
        except Exception as e:
            error_analysis = {
                'context': context,
                'timestamp': time.time(),
                'error': str(e),
                'has_parse_issues': True,
                'issues': [f"Analysis failed: {str(e)}"]
            }
            self.token_history.append(error_analysis)
            railway_logger.log('firebase_token', 40, f"Token analysis failed for {context}: {str(e)}")
            return error_analysis
    
    def _analyze_token_structure(self, token: str) -> Dict[str, Any]:
        """Analyze the structure of a Firebase token."""
        analysis = {
            'has_valid_structure': False,
            'part_count': 0,
            'header': None,
            'payload': None,
            'signature': None,
            'header_decoded': None,
            'payload_decoded': None,
            'expiry_time': None,
            'issued_time': None,
            'user_id': None
        }
        
        try:
            # Split token into parts
            parts = token.split('.')
            analysis['part_count'] = len(parts)
            
            if len(parts) != 3:
                return analysis
            
            header, payload, signature = parts
            analysis['header'] = header
            analysis['payload'] = payload
            analysis['signature'] = signature
            
            # Decode header
            try:
                header_decoded = json.loads(base64.urlsafe_b64decode(header + '==').decode('utf-8'))
                analysis['header_decoded'] = header_decoded
            except Exception as e:
                analysis['header_error'] = str(e)
            
            # Decode payload
            try:
                payload_decoded = json.loads(base64.urlsafe_b64decode(payload + '==').decode('utf-8'))
                analysis['payload_decoded'] = payload_decoded
                
                # Extract key information
                analysis['expiry_time'] = payload_decoded.get('exp')
                analysis['issued_time'] = payload_decoded.get('iat')
                analysis['user_id'] = payload_decoded.get('uid')
                
            except Exception as e:
                analysis['payload_error'] = str(e)
            
            # Check if structure is valid
            analysis['has_valid_structure'] = (
                len(parts) == 3 and
                analysis.get('header_decoded') is not None and
                analysis.get('payload_decoded') is not None
            )
            
        except Exception as e:
            analysis['structure_error'] = str(e)
        
        return analysis
    
    def _analyze_token_characters(self, token: str) -> Dict[str, Any]:
        """Analyze the characters in a Firebase token."""
        analysis = {
            'total_chars': len(token),
            'ascii_chars': 0,
            'non_ascii_chars': 0,
            'control_chars': 0,
            'special_chars': 0,
            'has_control_chars': False,
            'has_non_ascii': False,
            'char_distribution': defaultdict(int),
            'problematic_chars': []
        }
        
        for char in token:
            char_code = ord(char)
            analysis['char_distribution'][char] += 1
            
            if char_code < 32:  # Control characters
                analysis['control_chars'] += 1
                analysis['has_control_chars'] = True
                analysis['problematic_chars'].append({
                    'char': repr(char),
                    'code': char_code,
                    'position': token.index(char)
                })
            elif char_code > 127:  # Non-ASCII
                analysis['non_ascii_chars'] += 1
                analysis['has_non_ascii'] = True
                analysis['problematic_chars'].append({
                    'char': repr(char),
                    'code': char_code,
                    'position': token.index(char)
                })
            elif char in '{}[]"\\':  # Special JSON characters
                analysis['special_chars'] += 1
        
        analysis['ascii_chars'] = analysis['total_chars'] - analysis['non_ascii_chars'] - analysis['control_chars']
        
        return dict(analysis)
    
    def _test_token_serialization(self, token: str) -> Dict[str, Any]:
        """Test JSON serialization of the token."""
        test_result = {
            'success': False,
            'error': None,
            'serialized_size': 0,
            'serialization_time': 0
        }
        
        try:
            start_time = time.time()
            
            # Test direct serialization
            serialized = json.dumps(token)
            test_result['serialized_size'] = len(serialized.encode('utf-8'))
            
            # Test in object context
            test_object = {'id_token': token, 'canvas_id': 'test', 'timestamp': time.time()}
            serialized_object = json.dumps(test_object)
            
            end_time = time.time()
            test_result['serialization_time'] = end_time - start_time
            test_result['success'] = True
            
        except TypeError as e:
            test_result['error'] = f"TypeError: {str(e)}"
        except ValueError as e:
            test_result['error'] = f"ValueError: {str(e)}"
        except Exception as e:
            test_result['error'] = f"Unexpected error: {str(e)}"
        
        return test_result
    
    def _test_token_in_socket_context(self, token: str) -> Dict[str, Any]:
        """Test token in socket message context."""
        test_result = {
            'success': False,
            'error': None,
            'message_size': 0
        }
        
        try:
            # Create a typical socket message with the token
            socket_message = {
                'canvas_id': 'test-canvas-123',
                'id_token': token,
                'object': {
                    'type': 'text',
                    'properties': {
                        'text': 'Test object',
                        'x': 100,
                        'y': 200,
                        'width': 200,
                        'height': 50
                    }
                },
                'timestamp': time.time(),
                'user_id': 'test-user'
            }
            
            # Test serialization
            serialized = json.dumps(socket_message)
            test_result['message_size'] = len(serialized.encode('utf-8'))
            
            # Test deserialization
            deserialized = json.loads(serialized)
            
            # Verify token integrity
            if deserialized.get('id_token') == token:
                test_result['success'] = True
            else:
                test_result['error'] = 'Token integrity check failed'
            
        except Exception as e:
            test_result['error'] = str(e)
        
        return test_result
    
    def _categorize_token_analysis(self, analysis: Dict[str, Any]) -> None:
        """Categorize token analysis for statistics."""
        size_bytes = analysis.get('token_size_bytes', 0)
        
        if size_bytes < self.size_thresholds['small']:
            category = 'small'
        elif size_bytes < self.size_thresholds['medium']:
            category = 'medium'
        elif size_bytes < self.size_thresholds['large']:
            category = 'large'
        else:
            category = 'very_large'
        
        self.token_analysis[category].append(analysis)
    
    def analyze_token_refresh_timing(self, old_token: str, new_token: str) -> Dict[str, Any]:
        """Analyze token refresh timing and impact."""
        analysis = {
            'old_token_analysis': self.analyze_token(old_token, 'old_token'),
            'new_token_analysis': self.analyze_token(new_token, 'new_token'),
            'refresh_impact': {},
            'recommendations': []
        }
        
        old_size = analysis['old_token_analysis'].get('token_size_bytes', 0)
        new_size = analysis['new_token_analysis'].get('token_size_bytes', 0)
        
        analysis['refresh_impact'] = {
            'size_change': new_size - old_size,
            'size_change_percent': ((new_size - old_size) / old_size * 100) if old_size > 0 else 0,
            'old_has_issues': analysis['old_token_analysis'].get('has_parse_issues', False),
            'new_has_issues': analysis['new_token_analysis'].get('has_parse_issues', False)
        }
        
        # Generate recommendations
        if analysis['refresh_impact']['size_change_percent'] > 50:
            analysis['recommendations'].append('Token size increased significantly during refresh')
        
        if analysis['refresh_impact']['new_has_issues'] and not analysis['refresh_impact']['old_has_issues']:
            analysis['recommendations'].append('New token introduced parse issues')
        
        return analysis
    
    def get_token_statistics(self) -> Dict[str, Any]:
        """Get statistics about analyzed tokens."""
        total_tokens = len(self.token_history)
        tokens_with_issues = sum(1 for token in self.token_history if token.get('has_parse_issues', False))
        
        size_distribution = {}
        for category, tokens in self.token_analysis.items():
            size_distribution[category] = len(tokens)
        
        issue_types = defaultdict(int)
        for token in self.token_history:
            for issue in token.get('issues', []):
                issue_types[issue] += 1
        
        return {
            'total_tokens': total_tokens,
            'tokens_with_issues': tokens_with_issues,
            'issue_rate': tokens_with_issues / total_tokens if total_tokens > 0 else 0,
            'size_distribution': size_distribution,
            'issue_types': dict(issue_types),
            'recent_issues': [
                {
                    'context': token['context'],
                    'timestamp': token['timestamp'],
                    'issues': token.get('issues', [])
                }
                for token in list(self.token_history)[-10:] if token.get('has_parse_issues', False)
            ],
            'uptime_seconds': time.time() - self.start_time
        }
    
    def get_recommendations(self) -> List[str]:
        """Get recommendations based on token analysis."""
        recommendations = []
        stats = self.get_token_statistics()
        
        if stats['issue_rate'] > 0.1:  # More than 10% of tokens have issues
            recommendations.append(f"High token issue rate: {stats['issue_rate']:.1%} of tokens have parse issues")
        
        for issue_type, count in stats['issue_types'].items():
            if count > 5:
                recommendations.append(f"Address {issue_type}: {count} occurrences")
        
        if stats['size_distribution'].get('very_large', 0) > 0:
            recommendations.append("Some tokens are unusually large, consider optimization")
        
        return recommendations
    
    def reset_analysis(self) -> None:
        """Reset all token analysis data."""
        self.token_history.clear()
        self.token_analysis.clear()
        self.parse_errors.clear()
        self.start_time = time.time()
        railway_logger.log('firebase_token', 10, "Firebase token analysis data reset")

# Global instance
firebase_token_analyzer = FirebaseTokenAnalyzer()
