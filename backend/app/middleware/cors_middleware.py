from flask import request, jsonify
from functools import wraps

def add_cors_headers(response):
    """Add CORS headers to all responses."""
    origin = request.headers.get('Origin')
    
    # Allow specific origins
    allowed_origins = [
        'https://collab-canvas-frontend.up.railway.app',
        'https://gauntlet-collab-canvas-day7.vercel.app',
        'https://collabcanvas-mvp-day7.vercel.app',
        'https://gauntlet-collab-canvas-24hr.vercel.app',
        'https://gauntlet-collab-canvas-24hr.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ]
    
    # Check if origin matches any allowed pattern
    origin_allowed = False
    if origin:
        # Check exact match
        if origin in allowed_origins:
            origin_allowed = True
        # Check Vercel pattern
        elif origin.endswith('.vercel.app'):
            origin_allowed = True
        # Check Railway pattern
        elif origin.endswith('.up.railway.app'):
            origin_allowed = True
        # Check localhost patterns
        elif origin.startswith('http://localhost:') or origin.startswith('https://localhost:'):
            origin_allowed = True
    
    if origin_allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        # Use wildcard for debugging - this should be more restrictive in production
        response.headers['Access-Control-Allow-Origin'] = '*'
    
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Max-Age'] = '86400'  # 24 hours
    
    return response

def handle_preflight():
    """Handle CORS preflight requests."""
    if request.method == 'OPTIONS':
        # Create response with proper CORS headers
        response = jsonify({'status': 'ok', 'message': 'CORS preflight handled'})
        response = add_cors_headers(response)
        response.status_code = 200
        return response
    return None

def cors_required(f):
    """Decorator to add CORS headers to specific routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Handle preflight requests
        preflight_response = handle_preflight()
        if preflight_response:
            return preflight_response
        
        # Execute the actual function
        response = f(*args, **kwargs)
        
        # Add CORS headers to the response
        if hasattr(response, 'headers'):
            return add_cors_headers(response)
        else:
            # If response is a tuple (data, status_code)
            if isinstance(response, tuple):
                data, status_code = response
                if hasattr(data, 'headers'):
                    return add_cors_headers(data), status_code
                else:
                    # Convert to response object
                    from flask import make_response
                    resp = make_response(data, status_code)
                    return add_cors_headers(resp)
            else:
                # Convert to response object
                from flask import make_response
                resp = make_response(response)
                return add_cors_headers(resp)
    
    return decorated_function
