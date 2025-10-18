"""
Rate Limiting Configuration Management
Provides dynamic configuration management for rate limiting across the application.
"""

import json
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum
from app.services.unified_rate_limiter import RateLimitConfig, RateLimitAlgorithm, UserTier


class ConfigEnvironment(Enum):
    """Configuration environments."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class RateLimitRule:
    """Rate limiting rule configuration."""
    name: str
    limit: int
    window_seconds: int
    algorithm: str
    burst_allowance: Optional[int] = None
    user_tier_multiplier: float = 1.0
    geographic_multiplier: float = 1.0
    enabled: bool = True
    description: str = ""


@dataclass
class UserTierConfig:
    """User tier configuration."""
    tier: str
    display_name: str
    api_requests_per_hour: int
    socket_events_per_hour: int
    canvas_operations_per_hour: int
    collaboration_invites_per_day: int
    file_uploads_per_hour: int
    burst_allowance_multiplier: float = 1.0
    priority: int = 0


@dataclass
class GeographicConfig:
    """Geographic rate limiting configuration."""
    country_code: str
    country_name: str
    multiplier: float
    enabled: bool = True
    notes: str = ""


@dataclass
class BurstProtectionConfig:
    """Burst protection configuration."""
    enabled: bool = True
    max_burst: int = 10
    burst_window: int = 5
    backoff_multiplier: float = 2.0
    max_backoff: int = 300  # 5 minutes


@dataclass
class AdaptiveLimitingConfig:
    """Adaptive rate limiting configuration."""
    enabled: bool = True
    trust_score_weight: float = 0.3
    behavior_analysis_window: int = 3600
    min_multiplier: float = 0.5
    max_multiplier: float = 2.0
    learning_rate: float = 0.1


class RateLimitingConfigManager:
    """Manages rate limiting configuration dynamically."""
    
    def __init__(self, environment: ConfigEnvironment = ConfigEnvironment.PRODUCTION):
        self.environment = environment
        self.config_version = "1.0.0"
        self.last_updated = time.time()
        
        # Load configurations
        self.api_rules = self._load_api_rules()
        self.socket_rules = self._load_socket_rules()
        self.user_tiers = self._load_user_tiers()
        self.geographic_configs = self._load_geographic_configs()
        self.burst_protection = self._load_burst_protection_config()
        self.adaptive_limiting = self._load_adaptive_limiting_config()
    
    def _load_api_rules(self) -> Dict[str, RateLimitRule]:
        """Load API endpoint rate limiting rules."""
        return {
            # Authentication endpoints
            'auth_login': RateLimitRule(
                name='auth_login',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=2,
                description='User login attempts'
            ),
            'auth_register': RateLimitRule(
                name='auth_register',
                limit=3,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=1,
                description='User registration attempts'
            ),
            'auth_refresh_token': RateLimitRule(
                name='auth_refresh_token',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Token refresh requests'
            ),
            'auth_verify': RateLimitRule(
                name='auth_verify',
                limit=20,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=5,
                description='Token verification requests'
            ),
            
            # Canvas endpoints
            'canvas_create': RateLimitRule(
                name='canvas_create',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Canvas creation requests'
            ),
            'canvas_update': RateLimitRule(
                name='canvas_update',
                limit=20,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=5,
                description='Canvas update requests'
            ),
            'canvas_delete': RateLimitRule(
                name='canvas_delete',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=1,
                description='Canvas deletion requests'
            ),
            'canvas_list': RateLimitRule(
                name='canvas_list',
                limit=30,
                window_seconds=60,
                algorithm='sliding_window',
                description='Canvas listing requests'
            ),
            'canvas_get': RateLimitRule(
                name='canvas_get',
                limit=50,
                window_seconds=60,
                algorithm='sliding_window',
                description='Canvas retrieval requests'
            ),
            
            # Object endpoints
            'object_create': RateLimitRule(
                name='object_create',
                limit=50,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=10,
                description='Object creation requests'
            ),
            'object_update': RateLimitRule(
                name='object_update',
                limit=100,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=20,
                description='Object update requests'
            ),
            'object_delete': RateLimitRule(
                name='object_delete',
                limit=20,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=5,
                description='Object deletion requests'
            ),
            
            # Collaboration endpoints
            'collaboration_invite': RateLimitRule(
                name='collaboration_invite',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=2,
                description='Collaboration invitation requests'
            ),
            'collaboration_accept': RateLimitRule(
                name='collaboration_accept',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Collaboration acceptance requests'
            ),
            'collaboration_reject': RateLimitRule(
                name='collaboration_reject',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Collaboration rejection requests'
            ),
            'collaboration_presence_update': RateLimitRule(
                name='collaboration_presence_update',
                limit=10,
                window_seconds=60,
                algorithm='sliding_window',
                description='Presence update requests'
            ),
        }
    
    def _load_socket_rules(self) -> Dict[str, RateLimitRule]:
        """Load Socket.IO event rate limiting rules."""
        return {
            'socket_join_canvas': RateLimitRule(
                name='socket_join_canvas',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=2,
                description='Canvas join events'
            ),
            'socket_leave_canvas': RateLimitRule(
                name='socket_leave_canvas',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Canvas leave events'
            ),
            'socket_cursor_move': RateLimitRule(
                name='socket_cursor_move',
                limit=60,
                window_seconds=60,
                algorithm='sliding_window',
                description='Cursor movement events'
            ),
            'socket_cursor_leave': RateLimitRule(
                name='socket_cursor_leave',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Cursor leave events'
            ),
            'socket_object_created': RateLimitRule(
                name='socket_object_created',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='Object creation events'
            ),
            'socket_object_updated': RateLimitRule(
                name='socket_object_updated',
                limit=30,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=5,
                description='Object update events'
            ),
            'socket_object_deleted': RateLimitRule(
                name='socket_object_deleted',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=2,
                description='Object deletion events'
            ),
            'socket_user_online': RateLimitRule(
                name='socket_user_online',
                limit=5,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=2,
                description='User online events'
            ),
            'socket_user_offline': RateLimitRule(
                name='socket_user_offline',
                limit=10,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=3,
                description='User offline events'
            ),
            'socket_presence_update': RateLimitRule(
                name='socket_presence_update',
                limit=20,
                window_seconds=60,
                algorithm='token_bucket',
                burst_allowance=5,
                description='Presence update events'
            ),
        }
    
    def _load_user_tiers(self) -> Dict[str, UserTierConfig]:
        """Load user tier configurations."""
        return {
            'free': UserTierConfig(
                tier='free',
                display_name='Free Tier',
                api_requests_per_hour=100,
                socket_events_per_hour=1000,
                canvas_operations_per_hour=50,
                collaboration_invites_per_day=10,
                file_uploads_per_hour=5,
                burst_allowance_multiplier=0.5,
                priority=0
            ),
            'premium': UserTierConfig(
                tier='premium',
                display_name='Premium Tier',
                api_requests_per_hour=1000,
                socket_events_per_hour=10000,
                canvas_operations_per_hour=500,
                collaboration_invites_per_day=100,
                file_uploads_per_hour=50,
                burst_allowance_multiplier=1.0,
                priority=1
            ),
            'enterprise': UserTierConfig(
                tier='enterprise',
                display_name='Enterprise Tier',
                api_requests_per_hour=10000,
                socket_events_per_hour=100000,
                canvas_operations_per_hour=5000,
                collaboration_invites_per_day=1000,
                file_uploads_per_hour=500,
                burst_allowance_multiplier=2.0,
                priority=2
            ),
            'admin': UserTierConfig(
                tier='admin',
                display_name='Admin Tier',
                api_requests_per_hour=100000,
                socket_events_per_hour=1000000,
                canvas_operations_per_hour=50000,
                collaboration_invites_per_day=10000,
                file_uploads_per_hour=5000,
                burst_allowance_multiplier=5.0,
                priority=3
            ),
        }
    
    def _load_geographic_configs(self) -> Dict[str, GeographicConfig]:
        """Load geographic rate limiting configurations."""
        return {
            'US': GeographicConfig(
                country_code='US',
                country_name='United States',
                multiplier=1.0,
                notes='Full rate limit'
            ),
            'CA': GeographicConfig(
                country_code='CA',
                country_name='Canada',
                multiplier=1.0,
                notes='Full rate limit'
            ),
            'GB': GeographicConfig(
                country_code='GB',
                country_name='United Kingdom',
                multiplier=0.8,
                notes='80% of base limit'
            ),
            'DE': GeographicConfig(
                country_code='DE',
                country_name='Germany',
                multiplier=0.8,
                notes='80% of base limit'
            ),
            'FR': GeographicConfig(
                country_code='FR',
                country_name='France',
                multiplier=0.8,
                notes='80% of base limit'
            ),
            'AU': GeographicConfig(
                country_code='AU',
                country_name='Australia',
                multiplier=0.8,
                notes='80% of base limit'
            ),
            'JP': GeographicConfig(
                country_code='JP',
                country_name='Japan',
                multiplier=0.6,
                notes='60% of base limit'
            ),
            'CN': GeographicConfig(
                country_code='CN',
                country_name='China',
                multiplier=0.6,
                notes='60% of base limit'
            ),
            'IN': GeographicConfig(
                country_code='IN',
                country_name='India',
                multiplier=0.6,
                notes='60% of base limit'
            ),
            'OTHER': GeographicConfig(
                country_code='OTHER',
                country_name='Other Countries',
                multiplier=0.4,
                notes='40% of base limit'
            ),
        }
    
    def _load_burst_protection_config(self) -> BurstProtectionConfig:
        """Load burst protection configuration."""
        return BurstProtectionConfig(
            enabled=True,
            max_burst=10,
            burst_window=5,
            backoff_multiplier=2.0,
            max_backoff=300
        )
    
    def _load_adaptive_limiting_config(self) -> AdaptiveLimitingConfig:
        """Load adaptive rate limiting configuration."""
        return AdaptiveLimitingConfig(
            enabled=True,
            trust_score_weight=0.3,
            behavior_analysis_window=3600,
            min_multiplier=0.5,
            max_multiplier=2.0,
            learning_rate=0.1
        )
    
    def get_rule(self, rule_name: str) -> Optional[RateLimitRule]:
        """Get rate limiting rule by name."""
        return self.api_rules.get(rule_name) or self.socket_rules.get(rule_name)
    
    def get_user_tier_config(self, tier: str) -> Optional[UserTierConfig]:
        """Get user tier configuration."""
        return self.user_tiers.get(tier)
    
    def get_geographic_config(self, country_code: str) -> Optional[GeographicConfig]:
        """Get geographic configuration."""
        return self.geographic_configs.get(country_code) or self.geographic_configs.get('OTHER')
    
    def update_rule(self, rule_name: str, rule: RateLimitRule):
        """Update rate limiting rule."""
        if rule_name in self.api_rules:
            self.api_rules[rule_name] = rule
        elif rule_name in self.socket_rules:
            self.socket_rules[rule_name] = rule
        else:
            # Add new rule to API rules by default
            self.api_rules[rule_name] = rule
        
        self.last_updated = time.time()
    
    def update_user_tier(self, tier: str, config: UserTierConfig):
        """Update user tier configuration."""
        self.user_tiers[tier] = config
        self.last_updated = time.time()
    
    def update_geographic_config(self, country_code: str, config: GeographicConfig):
        """Update geographic configuration."""
        self.geographic_configs[country_code] = config
        self.last_updated = time.time()
    
    def update_burst_protection(self, config: BurstProtectionConfig):
        """Update burst protection configuration."""
        self.burst_protection = config
        self.last_updated = time.time()
    
    def update_adaptive_limiting(self, config: AdaptiveLimitingConfig):
        """Update adaptive limiting configuration."""
        self.adaptive_limiting = config
        self.last_updated = time.time()
    
    def export_config(self) -> Dict[str, Any]:
        """Export current configuration as dictionary."""
        return {
            'version': self.config_version,
            'environment': self.environment.value,
            'last_updated': self.last_updated,
            'api_rules': {name: asdict(rule) for name, rule in self.api_rules.items()},
            'socket_rules': {name: asdict(rule) for name, rule in self.socket_rules.items()},
            'user_tiers': {name: asdict(tier) for name, tier in self.user_tiers.items()},
            'geographic_configs': {name: asdict(config) for name, config in self.geographic_configs.items()},
            'burst_protection': asdict(self.burst_protection),
            'adaptive_limiting': asdict(self.adaptive_limiting),
        }
    
    def import_config(self, config_data: Dict[str, Any]) -> bool:
        """Import configuration from dictionary."""
        try:
            # Validate configuration structure
            if not self._validate_config(config_data):
                return False
            
            # Update configurations
            self.config_version = config_data.get('version', self.config_version)
            self.last_updated = time.time()
            
            # Update rules
            if 'api_rules' in config_data:
                self.api_rules = {
                    name: RateLimitRule(**rule_data) 
                    for name, rule_data in config_data['api_rules'].items()
                }
            
            if 'socket_rules' in config_data:
                self.socket_rules = {
                    name: RateLimitRule(**rule_data) 
                    for name, rule_data in config_data['socket_rules'].items()
                }
            
            # Update other configurations
            if 'user_tiers' in config_data:
                self.user_tiers = {
                    name: UserTierConfig(**tier_data) 
                    for name, tier_data in config_data['user_tiers'].items()
                }
            
            if 'geographic_configs' in config_data:
                self.geographic_configs = {
                    name: GeographicConfig(**config_data) 
                    for name, config_data in config_data['geographic_configs'].items()
                }
            
            if 'burst_protection' in config_data:
                self.burst_protection = BurstProtectionConfig(**config_data['burst_protection'])
            
            if 'adaptive_limiting' in config_data:
                self.adaptive_limiting = AdaptiveLimitingConfig(**config_data['adaptive_limiting'])
            
            return True
            
        except Exception as e:
            print(f"Error importing configuration: {str(e)}")
            return False
    
    def _validate_config(self, config_data: Dict[str, Any]) -> bool:
        """Validate configuration data structure."""
        required_fields = ['api_rules', 'socket_rules', 'user_tiers']
        return all(field in config_data for field in required_fields)
    
    def get_environment_specific_config(self) -> Dict[str, Any]:
        """Get environment-specific configuration adjustments."""
        if self.environment == ConfigEnvironment.DEVELOPMENT:
            # More lenient limits for development
            return {
                'multiplier': 2.0,
                'burst_allowance_multiplier': 2.0,
                'adaptive_limiting_enabled': False
            }
        elif self.environment == ConfigEnvironment.STAGING:
            # Moderate limits for staging
            return {
                'multiplier': 1.5,
                'burst_allowance_multiplier': 1.5,
                'adaptive_limiting_enabled': True
            }
        else:  # PRODUCTION
            # Strict limits for production
            return {
                'multiplier': 1.0,
                'burst_allowance_multiplier': 1.0,
                'adaptive_limiting_enabled': True
            }


# Global configuration manager instance
config_manager = RateLimitingConfigManager()
