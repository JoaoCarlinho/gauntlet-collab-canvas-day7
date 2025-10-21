"""
Token Optimization Service
Optimizes Firebase token handling for socket connections to prevent parse errors.
"""

import time
import json
from typing import Dict, Any, Optional, Tuple, List
from app.utils.railway_logger import railway_logger
from app.utils.firebase_token_analyzer import firebase_token_analyzer

class TokenOptimizationService:
    """Service for optimizing Firebase token handling in socket connections."""
    
    def __init__(self):
        self.token_cache = {}  # Cache for validated tokens
        self.token_validation_history = {}  # Track validation attempts
        self.optimization_stats = {
            'tokens_validated': 0,
            'tokens_cached': 0,
            'cache_hits': 0,
            'validation_failures': 0,
            'optimization_applied': 0
        }
        self.start_time = time.time()
    
    def validate_token_for_socket(self, token: str, user_id: str = 'unknown') -> Dict[str, Any]:
        """Validate a token for socket usage with optimization."""
        try:
            # Check cache first
            cache_key = f"{user_id}:{hash(token)}"
            if cache_key in self.token_cache:
                cached_result = self.token_cache[cache_key]
                if time.time() - cached_result['timestamp'] < 300:  # 5 minute cache
                    self.optimization_stats['cache_hits'] += 1
                    railway_logger.log('token_optimization', 10, f"Token cache hit for user: {user_id}")
                    return cached_result['result']
            
            # Analyze token for potential issues
            analysis = firebase_token_analyzer.analyze_token(token, f"socket_validation_{user_id}")
            
            # Create validation result
            validation_result = {
                'is_valid': analysis.get('is_valid_format', False),
                'has_issues': analysis.get('has_parse_issues', False),
                'issues': analysis.get('issues', []),
                'token_size': analysis.get('token_size_bytes', 0),
                'analysis': analysis,
                'optimization_applied': False,
                'recommendations': []
            }
            
            # Apply optimizations if needed
            if validation_result['has_issues']:
                optimization_result = self._apply_token_optimizations(token, analysis)
                validation_result['optimization_applied'] = optimization_result['applied']
                validation_result['recommendations'] = optimization_result['recommendations']
                
                if optimization_result['applied']:
                    self.optimization_stats['optimization_applied'] += 1
            
            # Cache the result
            self.token_cache[cache_key] = {
                'result': validation_result,
                'timestamp': time.time()
            }
            self.optimization_stats['tokens_cached'] += 1
            
            # Update statistics
            self.optimization_stats['tokens_validated'] += 1
            if not validation_result['is_valid']:
                self.optimization_stats['validation_failures'] += 1
            
            # Track validation history
            self.token_validation_history[user_id] = {
                'last_validation': time.time(),
                'validation_count': self.token_validation_history.get(user_id, {}).get('validation_count', 0) + 1,
                'last_result': validation_result
            }
            
            railway_logger.log('token_optimization', 10, f"Token validated for user: {user_id}, valid: {validation_result['is_valid']}")
            
            return validation_result
            
        except Exception as e:
            railway_logger.log('token_optimization', 40, f"Token validation failed for user {user_id}: {str(e)}")
            return {
                'is_valid': False,
                'has_issues': True,
                'issues': [f"Validation error: {str(e)}"],
                'token_size': 0,
                'analysis': None,
                'optimization_applied': False,
                'recommendations': ['Fix token validation error']
            }
    
    def _apply_token_optimizations(self, token: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Apply optimizations to a token if possible."""
        optimizations = {
            'applied': False,
            'recommendations': []
        }
        
        try:
            # Check for common issues and provide recommendations
            issues = analysis.get('issues', [])
            
            for issue in issues:
                if 'Token too short' in issue:
                    optimizations['recommendations'].append('Token appears to be invalid or corrupted')
                elif 'Token unusually long' in issue:
                    optimizations['recommendations'].append('Consider token refresh to get a shorter token')
                elif 'control characters' in issue.lower():
                    optimizations['recommendations'].append('Token contains invalid characters, refresh required')
                elif 'non-ASCII' in issue.lower():
                    optimizations['recommendations'].append('Token contains non-ASCII characters, refresh required')
                elif 'serialization failed' in issue.lower():
                    optimizations['recommendations'].append('Token cannot be serialized, refresh required')
            
            # Check token expiry
            token_parts = analysis.get('token_parts', {})
            payload = token_parts.get('payload_decoded', {})
            if payload:
                exp_time = payload.get('exp')
                if exp_time:
                    current_time = time.time()
                    if exp_time < current_time:
                        optimizations['recommendations'].append('Token has expired, refresh required')
                    elif exp_time - current_time < 300:  # Less than 5 minutes
                        optimizations['recommendations'].append('Token expires soon, consider refresh')
            
            # If we have specific recommendations, mark as optimization applied
            if optimizations['recommendations']:
                optimizations['applied'] = True
            
        except Exception as e:
            railway_logger.log('token_optimization', 30, f"Token optimization failed: {str(e)}")
            optimizations['recommendations'].append(f"Optimization error: {str(e)}")
        
        return optimizations
    
    def optimize_socket_message_with_token(self, message: Dict[str, Any], token: str, user_id: str = 'unknown') -> Dict[str, Any]:
        """Optimize a socket message containing a token."""
        try:
            # Validate token first
            token_validation = self.validate_token_for_socket(token, user_id)
            
            # Create optimized message
            optimized_message = message.copy()
            
            # Apply token-specific optimizations
            if token_validation['has_issues']:
                # If token has issues, we might want to handle it differently
                optimized_message['_token_issues'] = token_validation['issues']
                optimized_message['_token_optimization_applied'] = True
            
            # Ensure token is properly formatted in message
            if 'id_token' in optimized_message:
                optimized_message['id_token'] = token
            
            # Add token metadata for debugging
            optimized_message['_token_metadata'] = {
                'size': token_validation['token_size'],
                'validated_at': time.time(),
                'has_issues': token_validation['has_issues']
            }
            
            railway_logger.log('token_optimization', 10, f"Socket message optimized for user: {user_id}")
            
            return optimized_message
            
        except Exception as e:
            railway_logger.log('token_optimization', 40, f"Socket message optimization failed for user {user_id}: {str(e)}")
            return message  # Return original message if optimization fails
    
    def handle_token_refresh(self, old_token: str, new_token: str, user_id: str = 'unknown') -> Dict[str, Any]:
        """Handle token refresh and analyze the impact."""
        try:
            # Analyze both tokens
            refresh_analysis = firebase_token_analyzer.analyze_token_refresh_timing(old_token, new_token)
            
            # Validate new token
            new_token_validation = self.validate_token_for_socket(new_token, user_id)
            
            # Clear old token from cache
            old_cache_key = f"{user_id}:{hash(old_token)}"
            if old_cache_key in self.token_cache:
                del self.token_cache[old_cache_key]
            
            # Create refresh result
            refresh_result = {
                'refresh_successful': new_token_validation['is_valid'],
                'old_token_analysis': refresh_analysis['old_token_analysis'],
                'new_token_analysis': refresh_analysis['new_token_analysis'],
                'refresh_impact': refresh_analysis['refresh_impact'],
                'recommendations': refresh_analysis['recommendations'] + new_token_validation['recommendations'],
                'optimization_applied': new_token_validation['optimization_applied']
            }
            
            railway_logger.log('token_optimization', 10, f"Token refresh handled for user: {user_id}")
            
            return refresh_result
            
        except Exception as e:
            railway_logger.log('token_optimization', 40, f"Token refresh handling failed for user {user_id}: {str(e)}")
            return {
                'refresh_successful': False,
                'error': str(e),
                'recommendations': ['Fix token refresh error']
            }
    
    def get_optimization_statistics(self) -> Dict[str, Any]:
        """Get token optimization statistics."""
        cache_size = len(self.token_cache)
        validation_history_size = len(self.token_validation_history)
        
        # Calculate cache hit rate
        total_cache_requests = self.optimization_stats['tokens_validated']
        cache_hit_rate = (self.optimization_stats['cache_hits'] / total_cache_requests) if total_cache_requests > 0 else 0
        
        # Calculate validation success rate
        validation_success_rate = 1 - (self.optimization_stats['validation_failures'] / total_cache_requests) if total_cache_requests > 0 else 1
        
        return {
            'optimization_stats': self.optimization_stats.copy(),
            'cache_size': cache_size,
            'validation_history_size': validation_history_size,
            'cache_hit_rate': cache_hit_rate,
            'validation_success_rate': validation_success_rate,
            'optimization_rate': (self.optimization_stats['optimization_applied'] / total_cache_requests) if total_cache_requests > 0 else 0,
            'uptime_seconds': time.time() - self.start_time
        }
    
    def clear_token_cache(self, user_id: Optional[str] = None) -> None:
        """Clear token cache for a specific user or all users."""
        if user_id:
            # Clear cache entries for specific user
            keys_to_remove = [key for key in self.token_cache.keys() if key.startswith(f"{user_id}:")]
            for key in keys_to_remove:
                del self.token_cache[key]
            railway_logger.log('token_optimization', 10, f"Token cache cleared for user: {user_id}")
        else:
            # Clear entire cache
            self.token_cache.clear()
            railway_logger.log('token_optimization', 10, "Token cache cleared for all users")
    
    def get_token_recommendations(self, user_id: str) -> List[str]:
        """Get token recommendations for a specific user."""
        recommendations = []
        
        # Check user's validation history
        user_history = self.token_validation_history.get(user_id, {})
        if user_history:
            last_result = user_history.get('last_result', {})
            if last_result.get('has_issues', False):
                recommendations.extend(last_result.get('recommendations', []))
            
            validation_count = user_history.get('validation_count', 0)
            if validation_count > 10:  # User has many validation attempts
                recommendations.append('Consider implementing token refresh optimization')
        
        # Get general recommendations from token analyzer
        analyzer_recommendations = firebase_token_analyzer.get_recommendations()
        recommendations.extend(analyzer_recommendations)
        
        return recommendations
    
    def reset_statistics(self) -> None:
        """Reset optimization statistics."""
        self.optimization_stats = {
            'tokens_validated': 0,
            'tokens_cached': 0,
            'cache_hits': 0,
            'validation_failures': 0,
            'optimization_applied': 0
        }
        self.token_validation_history.clear()
        self.start_time = time.time()
        railway_logger.log('token_optimization', 10, "Token optimization statistics reset")

# Global instance
token_optimization_service = TokenOptimizationService()
