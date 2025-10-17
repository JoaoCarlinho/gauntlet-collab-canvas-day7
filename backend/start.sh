#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Handle Railway secrets if they exist
if [ -d "/tmp/railpack-build-*/secrets" ]; then
    echo "Railway secrets directory found, copying secrets..."
    # Copy secrets to environment variables if they exist as files
    for secret_file in /tmp/railpack-build-*/secrets/*; do
        if [ -f "$secret_file" ]; then
            secret_name=$(basename "$secret_file")
            secret_value=$(cat "$secret_file")
            export "$secret_name"="$secret_value"
            echo "Set $secret_name from secrets file"
        fi
    done
fi

# Set default CORS_ORIGINS if not set
if [ -z "$CORS_ORIGINS" ]; then
    export CORS_ORIGINS="https://collabcanvas-mvp-day7.vercel.app,https://*.vercel.app"
    echo "Set default CORS_ORIGINS: $CORS_ORIGINS"
fi

# Run database migrations if needed
python -c "
from app import create_app, db
from app.config import ProductionConfig
app = create_app(ProductionConfig)
with app.app_context():
    try:
        db.create_all()
        print('Database tables created successfully')
    except Exception as e:
        print(f'Database setup completed: {e}')
"

# Start the application
python run.py
