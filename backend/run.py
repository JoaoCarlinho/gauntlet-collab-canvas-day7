import os
from app import create_app, socketio
from app.config import DevelopmentConfig, ProductionConfig, TestingConfig

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Deployment marker: b1693ad - Force Railway to rebuild with latest schema fixes

# Determine configuration based on environment
env = os.environ.get('FLASK_ENV', 'development')
if env == 'production':
    config_class = ProductionConfig
elif env == 'testing':
    config_class = TestingConfig
else:
    config_class = DevelopmentConfig

app = create_app(config_class)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
