# 🚀 **Deployment Configuration Guide**

## 📋 **Overview**

This guide provides step-by-step instructions for configuring automatic builds and deployments for the `collabcanvas-mvp-day7` repository on Vercel (frontend) and Railway (backend).

## 🎯 **Architecture**

- **Frontend:** React + Vite + TypeScript → **Vercel**
- **Backend:** Flask + Python → **Railway**
- **Database:** PostgreSQL → **Railway**
- **Cache:** Redis → **Railway**

---

## 🌐 **Vercel Configuration (Frontend)**

### **1. Connect Repository to Vercel**

#### **Via Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import from GitHub: `JoaoCarlinho/gauntlet-collab-canvas-day7`
4. Configure project settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

#### **Via Vercel CLI:**
```bash
cd /Users/joaocarlinho/gauntlet/collabcanvas-mvp-day7/frontend
npm i -g vercel
vercel login
vercel --prod
```

### **2. Environment Variables**

Configure these environment variables in Vercel dashboard:

```bash
# API Configuration
VITE_API_BASE_URL=https://your-railway-backend-url.railway.app
VITE_SOCKET_URL=https://your-railway-backend-url.railway.app

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Environment
VITE_NODE_ENV=production
```

### **3. Build Configuration**

Create/update `frontend/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "unsafe-none"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### **4. Automatic Deployments**

Vercel will automatically:
- ✅ Deploy on every push to `master` branch
- ✅ Create preview deployments for pull requests
- ✅ Run build process with `npm run build`
- ✅ Serve static files from `dist` directory

---

## 🚂 **Railway Configuration (Backend)**

### **1. Connect Repository to Railway**

#### **Via Railway Dashboard:**
1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `JoaoCarlinho/gauntlet-collab-canvas-day7`
5. Configure service:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python run.py`

#### **Via Railway CLI:**
```bash
cd /Users/joaocarlinho/gauntlet/collabcanvas-mvp-day7/backend
npm install -g @railway/cli
railway login
railway init
railway up
```

### **2. Environment Variables**

Configure these environment variables in Railway dashboard:

```bash
# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-secret-key-here

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Redis Configuration
REDIS_URL=redis://user:password@host:port
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# CORS Configuration
CORS_ORIGINS=https://your-vercel-frontend-url.vercel.app

# Socket.IO Configuration
SOCKETIO_CORS_ALLOWED_ORIGINS=https://your-vercel-frontend-url.vercel.app
```

### **3. Database Setup**

#### **Add PostgreSQL Service:**
1. In Railway dashboard, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically:
   - Create PostgreSQL instance
   - Generate connection string
   - Set `DATABASE_URL` environment variable

#### **Add Redis Service:**
1. In Railway dashboard, click "New Service"
2. Select "Database" → "Redis"
3. Railway will automatically:
   - Create Redis instance
   - Generate connection string
   - Set `REDIS_URL` environment variable

### **4. Build Configuration**

Create `backend/railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python run.py",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **5. Automatic Deployments**

Railway will automatically:
- ✅ Deploy on every push to `master` branch
- ✅ Run database migrations
- ✅ Install dependencies with `pip install -r requirements.txt`
- ✅ Start application with `python run.py`

---

## 🔧 **Additional Configuration Files**

### **1. Frontend Environment Template**

Create `frontend/.env.production`:

```bash
# Production Environment Variables
VITE_API_BASE_URL=https://your-railway-backend-url.railway.app
VITE_SOCKET_URL=https://your-railway-backend-url.railway.app
VITE_NODE_ENV=production

# Firebase Configuration (replace with your values)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### **2. Backend Health Check**

Update `backend/run.py` to include health check:

```python
from flask import Flask, jsonify
from app import create_app

app = create_app()

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
```

### **3. Database Migration Setup**

Create `backend/migrate.py`:

```python
from flask_migrate import upgrade
from app import create_app, db

app = create_app()

with app.app_context():
    upgrade()
    print("Database migrations completed successfully")
```

Update `backend/railway.json` to run migrations:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python migrate.py && python run.py",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🚀 **Deployment Steps**

### **1. Initial Setup**

1. **Create Vercel Project:**
   - Connect GitHub repository
   - Configure build settings
   - Set environment variables

2. **Create Railway Project:**
   - Connect GitHub repository
   - Add PostgreSQL service
   - Add Redis service
   - Set environment variables

### **2. First Deployment**

1. **Deploy Backend First:**
   ```bash
   cd /Users/joaocarlinho/gauntlet/collabcanvas-mvp-day7
   git add .
   git commit -m "Configure deployment settings"
   git push origin master
   ```

2. **Get Backend URL:**
   - Copy Railway deployment URL
   - Update Vercel environment variables

3. **Deploy Frontend:**
   - Update `VITE_API_BASE_URL` in Vercel
   - Trigger new deployment

### **3. Verify Deployment**

1. **Backend Health Check:**
   ```bash
   curl https://your-railway-backend-url.railway.app/health
   ```

2. **Frontend Access:**
   - Visit Vercel deployment URL
   - Test object creation and manipulation
   - Verify real-time collaboration

---

## 📊 **Monitoring and Logs**

### **Vercel Monitoring:**
- **Analytics:** Built-in performance monitoring
- **Logs:** Function logs in dashboard
- **Errors:** Error tracking and notifications

### **Railway Monitoring:**
- **Metrics:** CPU, memory, and network usage
- **Logs:** Real-time application logs
- **Health Checks:** Automatic health monitoring

---

## 🔄 **Continuous Deployment**

### **Automatic Triggers:**
- ✅ **Push to master:** Deploys to production
- ✅ **Pull requests:** Creates preview deployments
- ✅ **Branch protection:** Ensures code quality

### **Manual Deployment:**
```bash
# Force redeploy
git commit --allow-empty -m "Trigger deployment"
git push origin master
```

---

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **Build Failures:**
   - Check environment variables
   - Verify build commands
   - Review dependency versions

2. **Database Connection:**
   - Verify `DATABASE_URL` format
   - Check database service status
   - Review connection limits

3. **CORS Issues:**
   - Update `CORS_ORIGINS` with frontend URL
   - Check `SOCKETIO_CORS_ALLOWED_ORIGINS`
   - Verify header configurations

4. **Socket.IO Issues:**
   - Check WebSocket support
   - Verify CORS settings
   - Review connection limits

---

## 📋 **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Health check endpoint working
- [ ] CORS settings updated
- [ ] Firebase configuration complete

### **Post-Deployment:**
- [ ] Backend health check passes
- [ ] Frontend loads correctly
- [ ] Object creation works
- [ ] Real-time collaboration functions
- [ ] Error handling works
- [ ] Performance is acceptable

---

*This configuration ensures reliable, automatic deployments with proper monitoring and error handling for the CollabCanvas MVP.*
