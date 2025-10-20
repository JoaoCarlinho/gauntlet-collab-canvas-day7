#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Set default CORS_ORIGINS if not set
if [ -z "$CORS_ORIGINS" ]; then
    export CORS_ORIGINS="https://collab-canvas-frontend.up.railway.app,https://gauntlet-collab-canvas-day7.vercel.app,https://collabcanvas-mvp-day7.vercel.app,https://gauntlet-collab-canvas-24hr.vercel.app,https://*.vercel.app"
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
