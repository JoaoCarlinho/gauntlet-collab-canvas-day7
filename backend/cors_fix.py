# Temporary CORS fix for production debugging
# Add this to your Railway environment variables or update your config

# Option 1: Add to Railway Environment Variables
CORS_ORIGINS=*

# Option 2: More specific but permissive
CORS_ORIGINS=https://gauntlet-collab-canvas-day7.vercel.app,https://*.vercel.app,https://*.up.railway.app

# Option 3: Debug mode (temporary)
DEBUG=true
FLASK_ENV=development
