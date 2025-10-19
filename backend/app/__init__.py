from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate
from flasgger import Swagger
from .config import Config
from .extensions import db, socketio, cors, migrate

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    
    # Configure CORS using environment variables
    cors_origins = app.config.get('CORS_ORIGINS', [])
    if isinstance(cors_origins, str):
        cors_origins = [origin.strip() for origin in cors_origins.split(',')]
    
    # Default allowed origins for development
    default_origins = [
        "http://localhost:3000",
        "http://localhost:5173"
    ]
    
    # Add specific Vercel deployment URLs
    vercel_origins = [
        "https://gauntlet-collab-canvas-day7.vercel.app",
        "https://collabcanvas-mvp-day7.vercel.app",
        "https://gauntlet-collab-canvas-24hr.vercel.app",
        "https://*.vercel.app"
    ]
    
    # Add Railway backend URLs for self-referencing (if needed)
    railway_origins = [
        "https://gauntlet-collab-canvas-7day-production.up.railway.app",
        "https://gauntlet-collab-canvas-day7-production.up.railway.app",
        "https://gauntlet-collab-canvas-24hr-production.up.railway.app",
        "https://*.up.railway.app"
    ]
    
    allowed_origins = default_origins + cors_origins + vercel_origins + railway_origins
    
    # Debug CORS configuration
    print(f"CORS Configuration Debug:")
    print(f"- Environment CORS_ORIGINS: {cors_origins}")
    print(f"- Total allowed origins: {len(allowed_origins)}")
    print(f"- Allowed origins: {allowed_origins}")
    
    # Initialize CORS with comprehensive configuration
    cors.init_app(
        app, 
        origins=allowed_origins, 
        supports_credentials=True,
        allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        expose_headers=['Content-Range', 'X-Content-Range'],
        vary_header=True
    )
    
    # Add CORS and security headers
    @app.after_request
    def add_headers(response):
        """Add CORS and security headers to all responses."""
        # Import CORS middleware
        from .middleware.cors_middleware import add_cors_headers
        
        # Add CORS headers first
        response = add_cors_headers(response)
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
        return response
    
    # Handle preflight requests globally
    @app.before_request
    def handle_preflight():
        """Handle CORS preflight requests globally."""
        from .middleware.cors_middleware import handle_preflight
        return handle_preflight()
    
    socketio.init_app(
        app, 
        cors_allowed_origins="*",  # Temporary wildcard for Socket.IO
        manage_session=False,
        logger=app.config.get('SOCKETIO_LOGGER', False),  # Environment controlled
        engineio_logger=app.config.get('SOCKETIO_ENGINEIO_LOGGER', False),  # Environment controlled
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=1000000,
        always_connect=True,
        allow_upgrades=True,
        transports=['websocket', 'polling']
    )
    migrate.init_app(app, db)
    
    # Initialize Swagger
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec_1',
                "route": '/apispec_1.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs"
    }
    
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "CollabCanvas API",
            "description": "Real-time collaborative canvas API",
            "version": "1.0.0",
            "contact": {
                "name": "CollabCanvas Team",
                "email": "support@collabcanvas.com"
            }
        },
        "host": "localhost:5000",
        "basePath": "/api",
        "schemes": ["http", "https"],
        "securityDefinitions": {
            "Bearer": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "Firebase ID token in format: Bearer <token>"
            }
        },
        "security": [
            {
                "Bearer": []
            }
        ]
    }
    
    swagger = Swagger(app, config=swagger_config, template=swagger_template)
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.canvas import canvas_bp
    from .routes.objects import objects_bp
    from .routes.collaboration import collaboration_bp
    from .routes.ai_agent import ai_agent_bp
    from .routes.ai_agent_debug import ai_agent_debug_bp
    from .routes.cors_debug import cors_debug_bp
    from .routes.test_cors import test_cors_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(canvas_bp, url_prefix='/api/canvas')
    app.register_blueprint(objects_bp, url_prefix='/api/objects')
    app.register_blueprint(collaboration_bp, url_prefix='/api/collaboration')
    app.register_blueprint(ai_agent_bp, url_prefix='/api/ai-agent')
    app.register_blueprint(ai_agent_debug_bp, url_prefix='/api/ai-agent/debug')
    app.register_blueprint(cors_debug_bp, url_prefix='/api/debug')
    app.register_blueprint(test_cors_bp, url_prefix='/api/test')
    
    # Initialize rate limiting
    from .middleware.rate_limiting import init_rate_limiting, init_socket_rate_limiting
    from .middleware.error_handling import init_error_handling
    from .extensions import redis_client
    init_rate_limiting(app)
    init_socket_rate_limiting(redis_client)
    init_error_handling(app)
    
    # Register socket handlers
    from .socket_handlers import register_socket_handlers
    register_socket_handlers(socketio)
    
    # Add Socket.IO connection authentication
    @socketio.on('connect')
    def handle_connect(auth=None):
        """Handle Socket.IO connection."""
        # Only log in development mode
        if app.config.get('DEBUG', False):
            print("=== Socket.IO Connection Established ===")
            print(f"Auth data: {auth}")
        
        # Ensure Firebase is initialized
        try:
            from app.services.auth_service import AuthService
            auth_service = AuthService()
            if app.config.get('DEBUG', False):
                print("Firebase Admin SDK is properly initialized for Socket.IO")
        except Exception as e:
            print(f"Firebase initialization check failed: {e}")
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle Socket.IO disconnection."""
        # Only log in development mode
        if app.config.get('DEBUG', False):
            print("=== Socket.IO Connection Disconnected ===")
    
    # Create database tables
    with app.app_context():
        try:
            db.create_all()
            print("Database tables created successfully")
        except Exception as e:
            print(f"Error creating database tables: {e}")
    
    # Add health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'message': 'CollabCanvas API is running'}, 200
    
    @app.route('/test-firebase')
    def test_firebase():
        try:
            from app.services.auth_service import AuthService
            auth_service = AuthService()
            return {
                'status': 'success',
                'message': 'Firebase service initialized',
                'has_mock_firebase': hasattr(auth_service, '_mock_firebase') and auth_service._mock_firebase
            }, 200
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Firebase service failed: {str(e)}'
            }, 500
    
    @app.route('/')
    def root():
        from datetime import datetime
        return {
            'message': 'CollabCanvas API', 
            'version': '1.0.0',
            'branch': 'forpk',
            'timestamp': str(datetime.utcnow()),
            'status': 'healthy'
        }, 200
    
    return app
