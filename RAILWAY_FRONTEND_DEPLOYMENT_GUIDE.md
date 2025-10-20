# Railway Frontend Deployment Guide

## 🚀 Quick Setup Instructions

### **Step 1: Create Railway Service (Manual)**

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Login to your account

2. **Create New Service**
   - Click "New Project" or "Add Service"
   - Select "Deploy from GitHub repo"
   - Choose repository: `gauntlet-collab-canvas-day7`
   - Set root directory: `frontend`
   - Service name: `collabcanvas-frontend`

### **Step 2: Configure Environment Variables (Manual)**

In Railway dashboard, add these environment variables to the frontend service:

```bash
# Required Environment Variables
VITE_API_URL=https://gauntlet-collab-canvas-day7-production.up.railway.app
VITE_SOCKET_URL=https://gauntlet-collab-canvas-day7-production.up.railway.app
NODE_ENV=production
PORT=3000

# Optional: Custom domain (if you set one up)
# VITE_APP_URL=https://your-custom-domain.com
```

### **Step 3: Update Backend CORS (Automatic)**

The backend has been updated to allow the new Railway frontend URLs. No manual action needed.

### **Step 4: Deploy**

Railway will automatically:
1. Detect the Node.js project
2. Install dependencies (`npm install`)
3. Build the application (`npm run build:railway`)
4. Start the server (`npm run start:railway`)

## 🔧 Configuration Details

### **Build Process**
- **Builder**: NIXPACKS (automatic Node.js detection)
- **Build Command**: `npm run build:railway`
- **Start Command**: `npm run start:railway`
- **Port**: 3000 (configurable via PORT environment variable)

### **Health Checks**
- **Path**: `/`
- **Timeout**: 30 seconds
- **Retry Policy**: 3 retries on failure

### **File Structure**
```
frontend/
├── railway.json              # Railway configuration
├── env.railway.template      # Environment variables template
├── Dockerfile               # Optional custom build
├── package.json             # Updated with Railway scripts
├── vite.config.ts           # Updated for Railway deployment
└── dist/                    # Built application (auto-generated)
```

## 🌐 Expected URLs

After deployment:
- **Frontend**: `https://collabcanvas-frontend-production.up.railway.app`
- **Backend**: `https://gauntlet-collab-canvas-day7-production.up.railway.app`

## 🔍 Troubleshooting

### **Common Issues**

1. **Build Fails**
   - Check environment variables are set correctly
   - Verify `VITE_API_URL` points to your backend
   - Check Railway logs for specific error messages

2. **CORS Errors**
   - Backend CORS has been updated to include Railway frontend URLs
   - If using custom domain, add it to backend CORS configuration

3. **Socket.IO Connection Issues**
   - Verify `VITE_SOCKET_URL` matches your backend URL
   - Check that backend Socket.IO is properly configured

### **Logs and Monitoring**

- **Railway Logs**: Available in Railway dashboard
- **Health Checks**: Automatic monitoring via `/` endpoint
- **Build Logs**: Available during deployment

## 🎯 Next Steps

1. **Deploy Frontend**: Follow the manual steps above
2. **Test Connection**: Verify frontend can connect to backend
3. **Update DNS**: If using custom domain, update DNS records
4. **Monitor**: Check Railway dashboard for deployment status

## 📞 Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify environment variables
3. Test backend connectivity
4. Review CORS configuration

---

**Status**: ✅ **Ready for Deployment**
**Last Updated**: Railway Frontend Configuration Complete
