"""
Unified Rate Limiting Service for CollabCanvas
Provides comprehensive rate limiting across API endpoints and Socket.IO events
with advanced features like burst protection, adaptive limiting, and user tiers.
"""

import time
import json
import hashlib
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass
from enum import Enum
import redis
from app.extensions import redis_client
from app.utils.logger import SmartLogger


class RateLimitAlgorithm(Enum):
    """Rate limiting algorithms."""
    TOKEN_BUCKET = "token_bucket"
    SLIDING_WINDOW = "sliding_window"
    FIXED_WINDOW = "fixed_window"
    LEAKY_BUCKET = "leaky_bucket"


class UserTier(Enum):
    """User tier levels."""
    FREE = "free"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"
    ADMIN = "admin"


@dataclass
class RateLimitConfig:
    """Rate limiting configuration."""
    limit: int
    window_seconds: int
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET
    burst_allowance: Optional[int] = None
    user_tier_multiplier: float = 1.0
    geographic_multiplier: float = 1.0


@dataclass
class RateLimitResult:
    """Rate limiting result."""
    allowed: bool
    remaining: int
    reset_time: float
    retry_after: Optional[float] = None
    reason: Optional[str] = None


class TokenBucketLimiter:
    """Token bucket rate limiter with burst allowance."""
    
    def __init__(self, capacity: int, refill_rate: float, burst_allowance: Optional[int] = None):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.burst_allowance = burst_allowance or capacity
        self.tokens = capacity
        self.last_refill = time.time()
    
    def is_allowed(self, tokens_requested: int = 1) -> RateLimitResult:
        """Check if request is allowed and consume tokens."""
        current_time = time.time()
        time_elapsed = current_time - self.last_refill
        
        # Refill tokens based on time elapsed
        tokens_to_add = time_elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = current_time
        
        # Check if enough tokens available
        if self.tokens >= tokens_requested:
            self.tokens -= tokens_requested
            remaining = int(self.tokens)
            reset_time = current_time + (self.capacity - self.tokens) / self.refill_rate
            
            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_time=reset_time
            )
        else:
            # Calculate retry after time
            tokens_needed = tokens_requested - self.tokens
            retry_after = tokens_needed / self.refill_rate
            
            return RateLimitResult(
                allowed=False,
                remaining=int(self.tokens),
                reset_time=current_time + retry_after,
                retry_after=retry_after,
                reason="Token bucket exhausted"
            )


class SlidingWindowLimiter:
    """Sliding window rate limiter for precise limits."""
    
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests = []
    
    def is_allowed(self) -> RateLimitResult:
        """Check if request is allowed within sliding window."""
        current_time = time.time()
        
        # Remove requests outside the window
        cutoff_time = current_time - self.window_seconds
        self.requests = [req_time for req_time in self.requests if req_time > cutoff_time]
        
        # Check if under limit
        if len(self.requests) < self.limit:
            self.requests.append(current_time)
            remaining = self.limit - len(self.requests)
            reset_time = self.requests[0] + self.window_seconds if self.requests else current_time + self.window_seconds
            
            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_time=reset_time
            )
        else:
            # Calculate retry after time
            oldest_request = self.requests[0]
            retry_after = oldest_request + self.window_seconds - current_time
            
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=oldest_request + self.window_seconds,
                retry_after=retry_after,
                reason="Sliding window limit exceeded"
            )


class FixedWindowLimiter:
    """Fixed window rate limiter."""
    
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
    
    def is_allowed(self, current_count: int) -> RateLimitResult:
        """Check if request is allowed within fixed window."""
        if current_count < self.limit:
            remaining = self.limit - current_count - 1
            reset_time = time.time() + self.window_seconds
            
            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_time=reset_time
            )
        else:
            reset_time = time.time() + self.window_seconds
            
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                retry_after=self.window_seconds,
                reason="Fixed window limit exceeded"
            )


class BurstProtection:
    """Protection against rapid-fire requests."""
    
    def __init__(self, max_burst: int = 10, burst_window: int = 5, backoff_multiplier: float = 2.0):
        self.max_burst = max_burst
        self.burst_window = burst_window
        self.backoff_multiplier = backoff_multiplier
        self.burst_tracker = {}
    
    def detect_burst(self, user_id: str) -> bool:
        """Detect if user is making burst requests."""
        current_time = time.time()
        
        if user_id not in self.burst_tracker:
            self.burst_tracker[user_id] = []
        
        # Remove old requests outside burst window
        cutoff_time = current_time - self.burst_window
        self.burst_tracker[user_id] = [
            req_time for req_time in self.burst_tracker[user_id] 
            if req_time > cutoff_time
        ]
        
        # Add current request
        self.burst_tracker[user_id].append(current_time)
        
        # Check if burst detected
        if len(self.burst_tracker[user_id]) > self.max_burst:
            return True
        
        return False
    
    def get_backoff_time(self, user_id: str) -> float:
        """Get backoff time for user."""
        burst_count = len(self.burst_tracker.get(user_id, []))
        if burst_count > self.max_burst:
            return self.burst_window * (self.backoff_multiplier ** (burst_count - self.max_burst))
        return 0


class AdaptiveRateLimiter:
    """Adaptive rate limiting based on user behavior."""
    
    def __init__(self):
        self.user_trust_scores = {}
        self.behavior_analyzer = BehaviorAnalyzer()
    
    def get_trust_score(self, user_id: str) -> float:
        """Get user trust score (0.0 to 1.0)."""
        if user_id not in self.user_trust_scores:
            self.user_trust_scores[user_id] = 0.5  # Default neutral score
        
        return self.user_trust_scores[user_id]
    
    def update_trust_score(self, user_id: str, behavior_score: float):
        """Update user trust score based on behavior."""
        current_score = self.get_trust_score(user_id)
        # Weighted average with recent behavior
        new_score = (current_score * 0.7) + (behavior_score * 0.3)
        self.user_trust_scores[user_id] = max(0.0, min(1.0, new_score))
    
    def get_adaptive_multiplier(self, user_id: str) -> float:
        """Get adaptive multiplier for user (0.5 to 2.0)."""
        trust_score = self.get_trust_score(user_id)
        # Convert trust score to multiplier (0.5x to 2.0x)
        return 0.5 + (trust_score * 1.5)


class BehaviorAnalyzer:
    """Analyze user behavior for adaptive rate limiting."""
    
    def analyze_behavior(self, user_id: str, request_data: Dict[str, Any]) -> float:
        """Analyze user behavior and return score (0.0 to 1.0)."""
        # Simple behavior analysis - can be enhanced
        score = 0.5  # Neutral score
        
        # Check for suspicious patterns
        if self._is_suspicious_pattern(request_data):
            score = 0.1  # Low score for suspicious behavior
        elif self._is_normal_pattern(request_data):
            score = 0.9  # High score for normal behavior
        
        return score
    
    def _is_suspicious_pattern(self, request_data: Dict[str, Any]) -> bool:
        """Check for suspicious request patterns."""
        # Check for rapid requests, unusual payloads, etc.
        return False  # Simplified for now
    
    def _is_normal_pattern(self, request_data: Dict[str, Any]) -> bool:
        """Check for normal request patterns."""
        # Check for expected request patterns
        return True  # Simplified for now


class GeographicLimiter:
    """Geographic-based rate limiting."""
    
    def __init__(self):
        self.country_limits = {
            'US': 1.0,      # Full rate limit
            'CA': 1.0,      # Full rate limit
            'EU': 0.8,      # 80% of base limit
            'GB': 0.8,      # 80% of base limit
            'AU': 0.8,      # 80% of base limit
            'ASIA': 0.6,    # 60% of base limit
            'OTHER': 0.4    # 40% of base limit
        }
    
    def get_geographic_multiplier(self, ip_address: str) -> float:
        """Get geographic multiplier for IP address."""
        # Simplified - in production, use GeoIP service
        country = self._get_country_from_ip(ip_address)
        return self.country_limits.get(country, 0.4)
    
    def _get_country_from_ip(self, ip_address: str) -> str:
        """Get country from IP address."""
        # Simplified - in production, use GeoIP service like MaxMind
        return 'US'  # Default to US


class UnifiedRateLimiter:
    """Unified rate limiting service for all application components."""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client or redis_client
        self.logger = SmartLogger('unified_rate_limiter', 'INFO')
        
        # Initialize components
        self.burst_protection = BurstProtection()
        self.adaptive_limiter = AdaptiveRateLimiter()
        self.geographic_limiter = GeographicLimiter()
        
        # Rate limiting configurations
        self.configs = self._load_default_configs()
    
    def _load_default_configs(self) -> Dict[str, RateLimitConfig]:
        """Load default rate limiting configurations."""
        return {
            # API Endpoints
            'api_auth_login': RateLimitConfig(5, 60, RateLimitAlgorithm.TOKEN_BUCKET, 2),
            'api_auth_register': RateLimitConfig(3, 60, RateLimitAlgorithm.TOKEN_BUCKET, 1),
            'api_canvas_create': RateLimitConfig(10, 60, RateLimitAlgorithm.TOKEN_BUCKET, 3),
            'api_canvas_update': RateLimitConfig(20, 60, RateLimitAlgorithm.TOKEN_BUCKET, 5),
            'api_collaboration_invite': RateLimitConfig(5, 60, RateLimitAlgorithm.TOKEN_BUCKET, 2),
            
            # Socket.IO Events
            'socket_cursor_move': RateLimitConfig(60, 60, RateLimitAlgorithm.SLIDING_WINDOW),
            'socket_object_created': RateLimitConfig(10, 60, RateLimitAlgorithm.TOKEN_BUCKET, 3),
            'socket_object_updated': RateLimitConfig(30, 60, RateLimitAlgorithm.TOKEN_BUCKET, 5),
            'socket_presence_update': RateLimitConfig(20, 60, RateLimitAlgorithm.TOKEN_BUCKET, 5),
            
            # User Tier Limits
            'free_tier': RateLimitConfig(100, 3600, user_tier_multiplier=0.5),
            'premium_tier': RateLimitConfig(1000, 3600, user_tier_multiplier=1.0),
            'enterprise_tier': RateLimitConfig(10000, 3600, user_tier_multiplier=2.0),
        }
    
    def check_rate_limit(
        self,
        user_id: str,
        limit_type: str,
        ip_address: Optional[str] = None,
        user_tier: UserTier = UserTier.FREE,
        request_data: Optional[Dict[str, Any]] = None
    ) -> RateLimitResult:
        """
        Check rate limit for user and request type.
        
        Args:
            user_id: User identifier
            limit_type: Type of rate limit to check
            ip_address: User's IP address for geographic limiting
            user_tier: User's tier level
            request_data: Request data for behavior analysis
            
        Returns:
            RateLimitResult with rate limiting decision
        """
        try:
            # Get base configuration
            config = self.configs.get(limit_type)
            if not config:
                # No rate limit configured - allow
                return RateLimitResult(allowed=True, remaining=999, reset_time=time.time() + 3600)
            
            # Check burst protection
            if self.burst_protection.detect_burst(user_id):
                backoff_time = self.burst_protection.get_backoff_time(user_id)
                self.logger.log_security(user_id, "burst_protection_triggered", f"Backoff: {backoff_time}s")
                
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=time.time() + backoff_time,
                    retry_after=backoff_time,
                    reason="Burst protection triggered"
                )
            
            # Apply user tier multiplier
            effective_limit = int(config.limit * config.user_tier_multiplier)
            
            # Apply geographic multiplier if IP provided
            if ip_address:
                geo_multiplier = self.geographic_limiter.get_geographic_multiplier(ip_address)
                effective_limit = int(effective_limit * geo_multiplier)
            
            # Apply adaptive multiplier
            adaptive_multiplier = self.adaptive_limiter.get_adaptive_multiplier(user_id)
            effective_limit = int(effective_limit * adaptive_multiplier)
            
            # Get rate limiter based on algorithm
            rate_limiter = self._get_rate_limiter(config, effective_limit)
            
            # Check rate limit
            if config.algorithm == RateLimitAlgorithm.FIXED_WINDOW:
                current_count = self._get_fixed_window_count(user_id, limit_type, config.window_seconds)
                result = rate_limiter.is_allowed(current_count)
            else:
                result = rate_limiter.is_allowed()
            
            # Update behavior analysis
            if request_data:
                behavior_score = self.adaptive_limiter.behavior_analyzer.analyze_behavior(user_id, request_data)
                self.adaptive_limiter.update_trust_score(user_id, behavior_score)
            
            # Log rate limiting decision
            if not result.allowed:
                self.logger.log_security(
                    user_id, 
                    "rate_limit_exceeded", 
                    f"Type: {limit_type}, Limit: {effective_limit}, Reason: {result.reason}"
                )
            
            return result
            
        except Exception as e:
            self.logger.log_error(f"Rate limit check failed: {str(e)}", e)
            # On error, allow the request (fail open)
            return RateLimitResult(allowed=True, remaining=999, reset_time=time.time() + 3600)
    
    def _get_rate_limiter(self, config: RateLimitConfig, effective_limit: int):
        """Get appropriate rate limiter based on algorithm."""
        if config.algorithm == RateLimitAlgorithm.TOKEN_BUCKET:
            refill_rate = effective_limit / config.window_seconds
            return TokenBucketLimiter(effective_limit, refill_rate, config.burst_allowance)
        elif config.algorithm == RateLimitAlgorithm.SLIDING_WINDOW:
            return SlidingWindowLimiter(effective_limit, config.window_seconds)
        elif config.algorithm == RateLimitAlgorithm.FIXED_WINDOW:
            return FixedWindowLimiter(effective_limit, config.window_seconds)
        else:
            # Default to token bucket
            refill_rate = effective_limit / config.window_seconds
            return TokenBucketLimiter(effective_limit, refill_rate, config.burst_allowance)
    
    def _get_fixed_window_count(self, user_id: str, limit_type: str, window_seconds: int) -> int:
        """Get current count for fixed window rate limiting."""
        if not self.redis_client:
            return 0
        
        try:
            key = f"rate_limit:fixed:{user_id}:{limit_type}"
            current_count = self.redis_client.get(key)
            
            if current_count is None:
                # First request in window
                self.redis_client.setex(key, window_seconds, 1)
                return 1
            else:
                # Increment counter
                new_count = self.redis_client.incr(key)
                return new_count
                
        except Exception as e:
            self.logger.log_error(f"Fixed window count failed: {str(e)}", e)
            return 0
    
    def update_config(self, limit_type: str, config: RateLimitConfig):
        """Update rate limiting configuration."""
        self.configs[limit_type] = config
        self.logger.log_info(f"Updated rate limit config for {limit_type}")
    
    def get_user_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get rate limiting analytics for user."""
        trust_score = self.adaptive_limiter.get_trust_score(user_id)
        adaptive_multiplier = self.adaptive_limiter.get_adaptive_multiplier(user_id)
        
        return {
            'user_id': user_id,
            'trust_score': trust_score,
            'adaptive_multiplier': adaptive_multiplier,
            'burst_requests': len(self.burst_protection.burst_tracker.get(user_id, [])),
            'tier': 'free'  # This should come from user service
        }


# Global unified rate limiter instance
unified_rate_limiter = UnifiedRateLimiter()
