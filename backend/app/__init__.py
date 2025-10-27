from flask import Flask, jsonify, request, session
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate
from flasgger import Swagger
import time
import os
from .config import Config
from .extensions import db, socketio, cors, migrate
try:
    from .config_modules.logging_config import LoggingConfig
except ImportError:
    # Fallback logging configuration if logging_config is not available
    class LoggingConfig:
        @staticmethod
        def setup_logging(app):
            import logging
            app.logger.setLevel(logging.INFO)
            print("Using fallback logging configuration")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Track startup time for health checks
    app.config['START_TIME'] = time.time()
    
    # Setup optimized logging configuration
    LoggingConfig.setup_logging(app)
    
    # Initialize extensions
    db.init_app(app)

    # Verify database connection on startup
    with app.app_context():
        try:
            # Test database connection
            db.engine.connect()
            db_url = app.config['SQLALCHEMY_DATABASE_URI']

            # Check if using SQLite (should warn in production)
            if 'sqlite' in db_url.lower():
                print("=" * 60)
                print("⚠️  WARNING: Using SQLite database!")
                print("=" * 60)
                print("SQLite is NOT recommended for production.")
                print("Objects will be lost on every deployment.")
                print("Please add a Postgres service in Railway:")
                print("  1. Go to Railway dashboard")
                print("  2. Click '+ New Service'")
                print("  3. Select 'Database' → 'PostgreSQL'")
                print("=" * 60)
            else:
                print("=" * 60)
                print("✅ Database connected successfully!")
                print(f"Database type: {'PostgreSQL' if 'postgres' in db_url.lower() else 'Unknown'}")
                print("=" * 60)
        except Exception as e:
            print("=" * 60)
            print("❌ DATABASE CONNECTION FAILED!")
            print("=" * 60)
            print(f"Error: {str(e)}")
            print("")
            print("CRITICAL: Cannot connect to database.")
            print("Objects WILL NOT be saved!")
            print("")
            print("Please check:")
            print("  1. DATABASE_URL environment variable is set")
            print("  2. Database service is running in Railway")
            print("  3. Network connectivity to database")
            print("=" * 60)
            # Don't crash the app, but log the error prominently
            import traceback
            traceback.print_exc()

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
        "https://collab-canvas-frontend.up.railway.app",
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
    
    # Add Railway frontend URLs (will be updated when frontend is deployed)
    railway_frontend_origins = [
        "https://collab-canvas-frontend-production.up.railway.app",
        "https://collabcanvas-frontend.up.railway.app",
        "https://*.up.railway.app"
    ]
    
    allowed_origins = default_origins + cors_origins + vercel_origins + railway_origins + railway_frontend_origins
    
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

    # Log incoming requests with IP address
    @app.before_request
    def log_request_info():
        """Log incoming request details including IP address."""
        # Only log in debug mode or when explicitly enabled
        is_debug = os.environ.get('DEBUG', 'false').lower() == 'true' or \
                   os.environ.get('FLASK_ENV') == 'development' or \
                   os.environ.get('LOG_IP_ADDRESSES', 'false').lower() == 'true'

        if is_debug:
            # Get real IP address (handles proxies, load balancers)
            def get_real_ip():
                # Check X-Forwarded-For header (set by proxies/load balancers)
                if request.headers.get('X-Forwarded-For'):
                    # X-Forwarded-For can contain multiple IPs, first one is the client
                    return request.headers.get('X-Forwarded-For').split(',')[0].strip()
                # Check X-Real-IP header (set by some proxies)
                elif request.headers.get('X-Real-IP'):
                    return request.headers.get('X-Real-IP')
                # Fallback to remote_addr
                else:
                    return request.remote_addr or 'unknown'

            ip_address = get_real_ip()
            method = request.method
            path = request.path
            user_agent = request.headers.get('User-Agent', 'unknown')

            # Skip logging for health checks and static files
            if path in ['/health', '/health/', '/api/health'] or path.startswith('/static/'):
                return None

            # Log request info
            print(f"=== Incoming Request ===")
            print(f"IP Address: {ip_address}")
            print(f"Method: {method}")
            print(f"Path: {path}")
            print(f"User Agent: {user_agent[:100]}...")  # Truncate long user agents

        return None

    # Initialize Socket.IO with optimized configuration
    from .utils.socketio_config_optimizer import SocketIOConfigOptimizer
    socketio_config = SocketIOConfigOptimizer.get_optimized_config(app)
    
    # Ensure CORS origins are properly configured for Socket.IO
    socketio_cors_origins = allowed_origins.copy()
    if not socketio_cors_origins:
        socketio_cors_origins = ["*"]  # Fallback to allow all origins
    
    socketio.init_app(
        app, 
        cors_allowed_origins=socketio_cors_origins,
        manage_session=socketio_config['manage_session'],
        logger=socketio_config['logger'],
        engineio_logger=socketio_config['engineio_logger'],
        ping_timeout=socketio_config['ping_timeout'],
        ping_interval=socketio_config['ping_interval'],
        max_http_buffer_size=socketio_config['max_http_buffer_size'],
        always_connect=socketio_config['always_connect'],
        allow_upgrades=socketio_config['allow_upgrades'],
        transports=socketio_config['transports']
    )
    
    # Add custom error handler for transport errors
    @socketio.on_error_default
    def default_error_handler(e):
        """Handle Socket.IO errors with detailed logging."""
        error_message = str(e)
        
        # Log transport-related errors with more detail
        if 'Invalid transport' in error_message:
            print(f"=== Socket.IO Transport Error ===")
            print(f"Error: {error_message}")
            print(f"Available transports: {socketio_config['transports']}")
            print(f"Allow upgrades: {socketio_config['allow_upgrades']}")
            print(f"Client transport attempt detected")
        else:
            print(f"=== Socket.IO Error ===")
            print(f"Error: {error_message}")
            print(f"Error type: {type(e).__name__}")
        
        # Emit error to client for debugging
        emit('error', {
            'message': 'Connection error occurred',
            'type': 'transport_error' if 'Invalid transport' in error_message else 'socket_error',
            'details': error_message
        })
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
    from .routes.socket_debug import socket_debug_bp
    from .routes.collaboration import collaboration_bp
    from .routes.ai_agent import ai_agent_bp
    from .routes.ai_agent_debug import ai_agent_debug_bp
    from .routes.test_execution import test_execution_bp
    from .routes.cors_debug import cors_debug_bp
    from .routes.test_cors import test_cors_bp
    from .routes.health import health_bp
    from .routes.connection_monitoring import connection_monitoring_bp
    from .routes.message_analysis import message_analysis_bp
    from .routes.token_analysis import token_analysis_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(canvas_bp, url_prefix='/api/canvas')
    app.register_blueprint(objects_bp, url_prefix='/api/objects')
    app.register_blueprint(socket_debug_bp)
    app.register_blueprint(collaboration_bp, url_prefix='/api/collaboration')
    app.register_blueprint(ai_agent_bp, url_prefix='/api/ai-agent')
    app.register_blueprint(ai_agent_debug_bp, url_prefix='/api/ai-agent/debug')
    app.register_blueprint(test_execution_bp, url_prefix='/api/test-execution')
    app.register_blueprint(cors_debug_bp, url_prefix='/api/debug')
    app.register_blueprint(test_cors_bp, url_prefix='/api/test')
    app.register_blueprint(health_bp)
    app.register_blueprint(connection_monitoring_bp, url_prefix='/api/connection-monitoring')
    app.register_blueprint(message_analysis_bp, url_prefix='/api/message-analysis')
    app.register_blueprint(token_analysis_bp, url_prefix='/api/token-analysis')
    
    # Initialize cache system
    from .extensions import init_cache
    init_cache(app)
    
    # Initialize rate limiting
    from .middleware.rate_limiting import init_rate_limiting, init_socket_rate_limiting
    from .middleware.error_handling import init_error_handling
    from .extensions import cache_client
    init_rate_limiting(app)
    init_socket_rate_limiting(cache_client)
    init_error_handling(app)
    
    # Register socket handlers
    from .socket_handlers import register_socket_handlers
    register_socket_handlers(socketio)
    
    # Add Socket.IO health check endpoint
    @app.route('/socket.io/')
    @app.route('/socket.io')
    def socketio_health():
        """Socket.IO health check endpoint."""
        return jsonify({
            'status': 'healthy',
            'message': 'Socket.IO endpoint is accessible',
            'transports': socketio_config.get('transports', ['polling']),
            'cors_enabled': True,
            'timestamp': time.time()
        }), 200
    
    # Add Socket.IO connection authentication
    @socketio.on('connect')
    def handle_connect(auth=None):
        """Handle Socket.IO connection with enhanced authentication and session management."""
        try:
            import time
            from app.services.connection_monitoring_service import connection_monitor
            
            # Record connection attempt
            connection_monitor.record_connection_attempt('unknown')
            
            # Enhanced session management
            session.permanent = True
            session.modified = True
            
            # Get client IP address
            def get_socket_ip():
                """Get real IP address from Socket.IO request."""
                # Check X-Forwarded-For header (set by proxies/load balancers)
                if request.headers.get('X-Forwarded-For'):
                    return request.headers.get('X-Forwarded-For').split(',')[0].strip()
                # Check X-Real-IP header
                elif request.headers.get('X-Real-IP'):
                    return request.headers.get('X-Real-IP')
                # Fallback to environ
                elif request.environ.get('REMOTE_ADDR'):
                    return request.environ.get('REMOTE_ADDR')
                else:
                    return 'unknown'

            client_ip = get_socket_ip()

            # Store connection metadata
            session['connection_time'] = time.time()
            session['socket_id'] = request.sid
            session['client_ip'] = client_ip

            # Log in development mode or when LOG_IP_ADDRESSES is enabled
            is_debug = app.config.get('DEBUG', False) or \
                       os.environ.get('LOG_IP_ADDRESSES', 'false').lower() == 'true'

            if is_debug:
                print("=== Socket.IO Connection Attempt ===")
                print(f"Client IP: {client_ip}")
                print(f"Auth data: {auth}")
                print(f"Session ID: {session.get('_id', 'No session ID')}")
                print(f"Socket ID: {request.sid}")

            # Check if we're in development mode (skip auth)
            is_development = app.config.get('DEBUG', False) or app.config.get('FLASK_ENV') == 'development'

            if is_development:
                print("Development mode: Allowing Socket.IO connection without authentication")
                # Store mock user for development with enhanced metadata
                session['authenticated_user'] = {
                    'id': 'dev-user',
                    'email': 'dev@example.com',
                    'name': 'Development User',
                    'auth_method': 'development',
                    'authenticated_at': time.time()
                }
                session['connection_metadata'] = {
                    'connection_time': time.time(),
                    'socket_id': request.sid,
                    'auth_method': 'development',
                    'user_agent': request.headers.get('User-Agent', 'Unknown')
                }
                print(f"Development session stored with keys: {list(session.keys())}")
                return True

            # Production mode: require authentication
            if not auth or not auth.get('token'):
                print("Socket.IO connection rejected: No authentication token provided")
                return False

            # Verify the Firebase token
            try:
                from app.services.auth_service import AuthService
                auth_service = AuthService()
                decoded_token = auth_service.verify_token(auth['token'])

                # Get or create user
                user = auth_service.get_user_by_id(decoded_token['uid'])
                if not user:
                    user = auth_service.register_user(auth['token'])

                # Store user in session for event handlers with enhanced metadata
                session['authenticated_user'] = {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'auth_method': 'firebase',
                    'authenticated_at': time.time(),
                    'token_uid': decoded_token.get('uid')
                }
                session['connection_metadata'] = {
                    'connection_time': time.time(),
                    'socket_id': request.sid,
                    'auth_method': 'firebase',
                    'user_agent': request.headers.get('User-Agent', 'Unknown'),
                    'token_verified': True,
                    'client_ip': client_ip
                }

                print(f"Socket.IO connection authenticated for user: {user.email}")
                print(f"Client IP: {client_ip}")
                print(f"Session stored with keys: {list(session.keys())}")
                print(f"User ID: {user.id}, Token UID: {decoded_token.get('uid')}")
                
                # Record successful connection
                connection_monitor.record_connection_success(user.id)
                return True

            except Exception as e:
                print(f"Socket.IO authentication failed: {str(e)}")
                # Store failed authentication attempt
                session['auth_failure'] = {
                    'error': str(e),
                    'timestamp': time.time(),
                    'auth_data': auth
                }
                
                # Record connection failure
                connection_monitor.record_connection_failure('unknown', 'authentication_failed')
                return False

        except Exception as e:
            print(f"Socket.IO connection error: {str(e)}")
            return False
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle Socket.IO disconnection."""
        try:
            from app.services.connection_monitoring_service import connection_monitor
            from flask import session
            
            # Record connection drop
            user_id = session.get('authenticated_user', {}).get('id', 'unknown')
            connection_monitor.record_connection_drop(user_id, 'client_disconnect')
        except Exception as e:
            print(f"Error recording connection drop: {str(e)}")
        
        # Only log in development mode
        if app.config.get('DEBUG', False):
            print("=== Socket.IO Connection Disconnected ===")
    
    # Create database tables (only if not already created)
    with app.app_context():
        try:
            # Check if tables already exist to prevent duplicate creation
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            if not existing_tables:
                db.create_all()
                print("Database tables created successfully")
            else:
                print("Database tables already exist, skipping creation")
            
            # Start job processor (only if not already running)
            from app.services.job_processor import job_processor
            if not job_processor.running:
                job_processor.start()
                print("Job processor started successfully")
            else:
                print("Job processor already running")
        except Exception as e:
            print(f"Error creating database tables or starting job processor: {e}")
    
    # Add health check endpoints
    @app.route('/health')
    @app.route('/health/')
    def health_check():
        return {'status': 'healthy', 'message': 'CollabCanvas API is running'}, 200
    
    @app.route('/api/health')
    def api_health_check():
        return {'status': 'healthy', 'message': 'Collab Canvas API is running'}, 200
    
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
            'message': 'Collab Canvas API', 
            'version': '1.0.0',
            'branch': 'forpk',
            'timestamp': str(datetime.utcnow()),
            'status': 'healthy'
        }, 200
    
    return app
