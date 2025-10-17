#!/bin/bash

# Install dependencies
pip install -r requirements.txt

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
