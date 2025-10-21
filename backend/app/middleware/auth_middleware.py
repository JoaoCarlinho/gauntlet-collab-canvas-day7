"""
Authentication Middleware
Provides authentication decorators and middleware functions for route protection.
"""

from functools import wraps
from app.services.auth_service import require_auth as _require_auth

# Re-export the require_auth decorator from auth_service
require_auth = _require_auth

__all__ = ['require_auth']
