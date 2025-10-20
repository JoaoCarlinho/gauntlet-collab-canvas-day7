# 🚀 Railway Deployment Guide

## Prerequisites

1. **Railway CLI Installed** ✅
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

## Deployment Steps

### Step 1: Login to Railway
```bash
railway login
```
Follow the browser authentication flow.

### Step 2: Set Environment Variables
```bash
# Job processing configuration
railway variables set MAX_CONCURRENT_JOBS=3
railway variables set JOB_PROCESSING_INTERVAL=5
railway variables set MAX_JOB_RETRIES=3
railway variables set JOB_CLEANUP_DAYS=7

# Flask configuration
railway variables set FLASK_ENV=production
railway variables set FLASK_DEBUG=False

# CORS configuration (update with your actual frontend URL)
railway variables set CORS_ORIGINS="https://gauntlet-collab-canvas-day7.vercel.app,https://collabcanvas-mvp-day7.vercel.app"
```

### Step 3: Deploy
```bash
railway up
```

## Alternative: Use the Automated Script

If you prefer, you can use the automated deployment script:

```bash
./deploy_async.sh
```

## Post-Deployment Verification

### 1. Check Health Endpoint
```bash
curl https://your-railway-app.up.railway.app/api/ai-agent/health
```

Expected response:
```json
{
  "database": "connected",
  "job_processor": {
    "active_jobs": 0,
    "max_concurrent_jobs": 3,
    "processing_interval": 5,
    "running": true
  },
  "status": "healthy",
  "timestamp": "2025-10-20T04:47:23.390077"
}
```

### 2. Test Job Creation
```bash
curl -X POST https://your-railway-app.up.railway.app/api/ai-agent/create-canvas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"instructions": "Create a simple flowchart", "style": "modern", "colorScheme": "default"}'
```

Expected response:
```json
{
  "success": true,
  "job_id": "uuid-here",
  "message": "Canvas creation job started",
  "status": "queued"
}
```

### 3. Monitor Job Status
```bash
curl https://your-railway-app.up.railway.app/api/ai-agent/job/{job_id}/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What's New in This Deployment

### ✅ **Asynchronous AI Processing**
- Canvas creation returns immediately with job ID (HTTP 202)
- Background job processing with PostgreSQL-based queuing
- Real-time status updates via polling
- Automatic retry with exponential backoff

### ✅ **Railway Compatible**
- No Redis dependency (uses PostgreSQL for job queuing)
- Single container deployment
- Background threading for job processing
- Comprehensive error handling and logging

### ✅ **Enhanced API Endpoints**
- `POST /api/ai-agent/create-canvas` - Returns job ID immediately
- `GET /api/ai-agent/job/{job_id}/status` - Get job status
- `GET /api/ai-agent/job/{job_id}/result` - Get job result
- `POST /api/ai-agent/job/{job_id}/cancel` - Cancel job
- `POST /api/ai-agent/job/{job_id}/retry` - Retry failed job
- `GET /api/ai-agent/jobs` - List user jobs
- `GET /api/ai-agent/jobs/stats` - Get job statistics
- `GET /api/ai-agent/health` - Enhanced health check

### ✅ **Frontend Integration**
- Updated React components for async flow
- Real-time progress tracking
- Improved error handling
- Non-blocking UI experience

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is properly configured in Railway
   - Check DATABASE_URL environment variable

2. **Job Processor Not Starting**
   - Check logs for application context errors
   - Verify all dependencies are installed

3. **Authentication Errors**
   - Ensure Firebase configuration is correct
   - Check FIREBASE_* environment variables

4. **CORS Issues**
   - Update CORS_ORIGINS with your frontend URL
   - Ensure frontend is deployed and accessible

### Monitoring

- Check Railway dashboard for deployment status
- Monitor application logs for errors
- Use health endpoint to verify system status
- Check job statistics for processing metrics

## Success Criteria

✅ **Deployment Successful When:**
- Health endpoint returns "healthy" status
- Job processor shows "running": true
- Create canvas endpoint returns job_id
- Frontend can communicate with backend
- No critical errors in logs

---

**🎉 Ready to deploy! Run the commands above to deploy your async AI implementation to Railway.**
