# 🚀 Complete Deployment Guide for CollabCanvas MVP Day7

## 📋 **Overview**

This guide provides step-by-step instructions to deploy your `collabcanvas-mvp-day7` project to:
- **Frontend**: Vercel (React + TypeScript)
- **Backend**: Railway (Flask + Python)
- **Database**: Railway PostgreSQL
- **Authentication**: Firebase (already configured)

---

## 🎯 **Prerequisites**

- ✅ GitHub repository: `collabcanvas-mvp-day7`
- ✅ Firebase project: `collabcanvas-24-mvp` (already configured)
- ✅ Vercel account
- ✅ Railway account
- ✅ All critical fixes applied (build errors resolved)

---

## 🌐 **Step 1: Deploy Backend to Railway**

### **1.1 Connect Repository to Railway**

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Sign in with your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `collabcanvas-mvp-day7` repository
   - Select the `backend` folder as root directory

3. **Configure Service**
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `./start.sh`

### **1.2 Add Database Services**

1. **Add PostgreSQL**
   - In your Railway project, click "New Service"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically:
     - Create PostgreSQL instance
     - Generate `DATABASE_URL` environment variable
     - Connect it to your app

2. **Add Redis (Optional)**
   - Click "New Service"
   - Select "Database" → "Redis"
   - Railway will automatically:
     - Create Redis instance
     - Generate `REDIS_URL` environment variable

### **1.3 Set Environment Variables**

In Railway dashboard, go to your backend service → Variables tab:

```bash
# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-secret-key-here-change-this-in-production

# Database Configuration (Railway will provide these automatically)
# DATABASE_URL=postgresql://user:password@host:port/database
# REDIS_URL=redis://user:password@host:port

# Firebase Configuration (use your existing Firebase project)
FIREBASE_PROJECT_ID=collabcanvas-24-mvp
FIREBASE_PRIVATE_KEY_ID=70025e873e41f61c9eb4137038b1d420a669626b
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC56nl49eeKf2VY\nInaDNMSojgjQOxF5n4Ex1TNe3tcwYEMkTIrO+y7hqsewL+xeXFP53ueWuzOMWfGE\n6DkOvVOTwXtB33JpeLZo0Iww5uRfsBlJX5M0E+/lImi7xwBnLdd9bcjHmMAvvhS4\nL21tuv7NWR2j2khQ5kFsg40xUJMzRAWOt5Yp8tWsu3iRk7eoS+xZDCQwoYERlTGm\nyN3sKcY6U/AdnJkWVO5crWc40xjDnOgk5mkLyLW9XI4KPTh1vMqYKild/gkJ8Qe5\niRxa1hFAK1+Fv+nofuNwW4wV+kbuzo3VI+8g+bPKBABQvRy3G4v2bY1dlN7xD0x0\ntQklKb9fAgMBAAECggEADqLyiD7XyTQJXvxrlx3G47w23mngENKpYap2vl/N0i2p\n64gpH21v/e0rhmfndHBRXikZ02iOgNyt4nhD0bC/DTFcyk1UnRAXUD4m40yyKwRa\noUeod5+gMcpZM3tRwU2/Gs1TUr9oVfnheLSnKU3g9HqxFi6/pbrS6L+clIbS5+Sv\nL4H54aWj56QEoPrgDAw2uRRBpHJ+RWraoGbHE7NFRVyrJ9DAUBp6iehtiKq3DrK4\nIbXhASHS1EXWBbuQPs6wh+o8pmoljJfq0pp7oPgSziqBGclwYWONaN6Ggep7rEkh\nw4+WUKTrT2hqpnOcobbfU9//FjCcL92tWQYkl0GgKQKBgQDauHMC/v9RaE4mZ2XJ\nSxkXCA1MiKA8DLKcWgIpa7noFV7od9CtN2T6Gjj4x/ik4RNrMCkIvZZ04R4E9D+Y\nfs65dROWpmx125GLcw8Y7vcE4KNG9UPExpoGz0A2NUukv0OaSfxg+hnR/FKra38P\n2wQrYFGV54B7pAv1An9tSpe1ZwKBgQDZmqUPoF6J1dWHTg1uNOV9zUmhHendP8ZG\nPzxGLc6c/YoN5nPR1Dr34yRNcNDwmiG/OSlOyj90Fdd3RRkWzd/70j+acygXLQKb\nL5An6s6P0nRcIOsuGMrlsDfrzIm9HVFxSfCo9V6oAg1rFLaKn4iG+lHnB1lcpz+q\nXw7AuXCzSQKBgQCXFejkve7ydiHd53jpZsXrIfXF028UbBUJaieqIy8lgXWxEesF\nbImFNo36VHCOvKekWH1P+16uWD9bXrl7hsUYWSZx3352n3jXomBgcdoS9XX0c0If\n8Ky/XXTWvVQGdtSlBMyg1ML3Sdx1a2k3M6yapgtViLg5MGXOFq6deXR4qwKBgBaD\nBSiEssMXuCtzS7hnCIbnQgLFEXiuLFkAGcA45PMg17Nwb/L5PdB/UzYfwb3idDNQ\nOpHIIqBj0hKot1vAmLd4nNPhrfgX0/kyBnvastv2LcuKLEpsjjEM9fwTAPzrl41c\n1OTl3ZEMBU9aqTfWIU21f9uiyv/m3ZNGmkQd6ybhAoGAOzS1LY4Z6otzjfHkFV+z\nVgJeDOhalk5apvRIGychrducvkXJ8EH4uq31RYN6B3BVg5zDojWF2ak+9gYH2Op6\nFUWkvEMWAqEB73u/NwTyNPLxiqbdn2FAQ5SVHh4XDH4r9+8vuovrssppH3a2/5WG\nK+yH/XKNSsWqgM31mOq51co=\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@collabcanvas-24-mvp.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=113427911244146012632
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40collabcanvas-24-mvp.iam.gserviceaccount.com

# CORS Configuration (will be updated after frontend deployment)
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

### **1.4 Deploy Backend**

1. **Trigger Deployment**
   - Railway will automatically deploy when you push to the `fix/railway-build-config` branch
   - Or manually trigger deployment in Railway dashboard

2. **Monitor Deployment**
   - Check Railway logs for any errors
   - Verify the health endpoint: `https://your-railway-app.up.railway.app/health`

3. **Get Backend URL**
   - Copy the Railway deployment URL
   - You'll need this for the frontend configuration

---

## 🎨 **Step 2: Deploy Frontend to Vercel**

### **2.1 Connect Repository to Vercel**

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Project**
   - Click "New Project"
   - Import from GitHub: `collabcanvas-mvp-day7`
   - Configure project settings:
     - **Framework Preset**: Vite
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

### **2.2 Set Environment Variables**

In Vercel dashboard, go to your project → Settings → Environment Variables:

```bash
# API Configuration (use your Railway backend URL)
VITE_API_URL=https://your-railway-backend-url.railway.app

# Firebase Configuration (use your existing Firebase project)
VITE_FIREBASE_API_KEY=AIzaSyC2S9aa0Moxqr_DqAfciw8p5-yWOA7s1rc
VITE_FIREBASE_AUTH_DOMAIN=collabcanvas-24-mvp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=collabcanvas-24-mvp
VITE_FIREBASE_STORAGE_BUCKET=collabcanvas-24-mvp.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=162398539425
VITE_FIREBASE_APP_ID=1:162398539425:web:1ea48cd4d849b0dda2eae0
VITE_FIREBASE_MEASUREMENT_ID=G-WLRX1MHLJ0

# Environment
VITE_NODE_ENV=production
```

### **2.3 Deploy Frontend**

1. **Trigger Deployment**
   - Vercel will automatically deploy when you push to the `fix/vercel-build-errors` branch
   - Or manually trigger deployment in Vercel dashboard

2. **Monitor Deployment**
   - Check Vercel build logs
   - Verify the app loads without errors
   - Check that the login button is visible (screenshot should be available)

3. **Get Frontend URL**
   - Copy the Vercel deployment URL
   - You'll need this to update the backend CORS configuration

---

## 🔗 **Step 3: Connect Frontend and Backend**

### **3.1 Update CORS Configuration**

1. **Go to Railway Dashboard**
   - Navigate to your backend service
   - Go to Variables tab

2. **Update CORS Origins**
   - Update `CORS_ORIGINS` with your Vercel URL:
   ```bash
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   ```

3. **Redeploy Backend**
   - Railway will automatically redeploy with the new CORS settings

### **3.2 Test Connection**

1. **Test Frontend to Backend Connection**
   - Visit your Vercel app
   - Open browser developer tools
   - Check for any CORS errors in the console

2. **Test Authentication**
   - Click the "Sign in with Google" button
   - Verify Firebase authentication works
   - Check that you can access the dashboard

---

## 🧪 **Step 4: Verify Deployment**

### **4.1 Backend Health Check**

```bash
curl https://your-railway-backend-url.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "version": "1.0.0"
}
```

### **4.2 Frontend Functionality Test**

1. **Homepage Loads**
   - ✅ App loads without errors
   - ✅ Login button is visible
   - ✅ No console errors

2. **Authentication Works**
   - ✅ Google sign-in popup appears
   - ✅ User can authenticate successfully
   - ✅ Dashboard loads after authentication

3. **Canvas Functionality**
   - ✅ Can create new canvases
   - ✅ Can navigate to canvas editor
   - ✅ Real-time collaboration works

### **4.3 Database Connection**

1. **Check Railway Logs**
   - Verify database connection is successful
   - Check for any migration errors

2. **Test Data Persistence**
   - Create a canvas
   - Refresh the page
   - Verify canvas still exists

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Vercel Build Failures**
- **Issue**: TypeScript compilation errors
- **Solution**: Ensure you're using the `fix/vercel-build-errors` branch
- **Check**: Test files are excluded from build

#### **2. Railway Build Failures**
- **Issue**: "Script start.sh not found"
- **Solution**: Ensure you're using the `fix/railway-build-config` branch
- **Check**: `start.sh` file exists and is executable

#### **3. CORS Errors**
- **Issue**: Frontend can't connect to backend
- **Solution**: Update `CORS_ORIGINS` in Railway with your Vercel URL
- **Check**: Both services are deployed and running

#### **4. Firebase Authentication Errors**
- **Issue**: Google sign-in not working
- **Solution**: Verify all Firebase environment variables are set correctly
- **Check**: Firebase project is properly configured

#### **5. Database Connection Issues**
- **Issue**: Backend can't connect to PostgreSQL
- **Solution**: Check Railway database service is running
- **Check**: `DATABASE_URL` environment variable is set

### **Debug Commands**

```bash
# Check Railway logs
railway logs

# Check Vercel build logs
vercel logs

# Test backend health
curl https://your-railway-backend-url.railway.app/health

# Test frontend
curl -I https://your-vercel-app.vercel.app
```

---

## 📊 **Deployment Checklist**

### **Backend (Railway)**
- [ ] Repository connected to Railway
- [ ] PostgreSQL database added
- [ ] Redis database added (optional)
- [ ] Environment variables configured
- [ ] Backend deploys successfully
- [ ] Health endpoint responds
- [ ] Database connection works

### **Frontend (Vercel)**
- [ ] Repository connected to Vercel
- [ ] Environment variables configured
- [ ] Frontend builds successfully
- [ ] App loads without errors
- [ ] Screenshot is available in Vercel
- [ ] Login button is visible

### **Integration**
- [ ] CORS configuration updated
- [ ] Frontend can connect to backend
- [ ] Authentication works
- [ ] Real-time features work
- [ ] Data persists correctly

---

## 🎯 **Final URLs**

After successful deployment, you should have:

- **Frontend**: `https://your-app-name.vercel.app`
- **Backend**: `https://your-app-name-production.up.railway.app`
- **Health Check**: `https://your-app-name-production.up.railway.app/health`
- **API Docs**: `https://your-app-name-production.up.railway.app/docs`

---

## 🎉 **Success!**

Your CollabCanvas MVP is now deployed and ready for use! Users can:
- ✅ Sign in with Google
- ✅ Create and manage canvases
- ✅ Collaborate in real-time
- ✅ Access the application from anywhere

**Next Steps**: Share your deployed application with users and gather feedback for future improvements!
