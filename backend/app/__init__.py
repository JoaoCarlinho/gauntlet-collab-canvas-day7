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
    
    # Add wildcard for Vercel preview deployments
    allowed_origins = default_origins + cors_origins + ["https://*.vercel.app"]
    
    # Initialize CORS with comprehensive configuration
    cors.init_app(
        app, 
        origins=allowed_origins, 
        supports_credentials=True,
        allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    )
    
    socketio.init_app(
        app, 
        cors_allowed_origins=allowed_origins, 
        manage_session=False,
        logger=app.config.get('SOCKETIO_LOGGER', False),  # Environment controlled
        engineio_logger=app.config.get('SOCKETIO_ENGINEIO_LOGGER', False),  # Environment controlled
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=1000000,
        always_connect=True
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
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(canvas_bp, url_prefix='/api/canvas')
    app.register_blueprint(objects_bp, url_prefix='/api/objects')
    app.register_blueprint(collaboration_bp, url_prefix='/api/collaboration')
    
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
