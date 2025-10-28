# AI Canvas Generation Setup Guide

## Critical Issue Identified

**The AI canvas generation flow is incomplete due to missing OPENAI_API_KEY environment variable.**

## Diagnosis

Based on log analysis and code review, the following issues prevent AI-generated canvases from appearing:

### Flow Analysis

**✅ Working:**
1. Frontend POST to `/api/ai-agent/create-canvas` → 202 Accepted
2. Job created with status 'queued' in database
3. Frontend polls `/api/ai-agent/job/{id}/status` successfully (20+ times)
4. Job processor started according to logs

**❌ NOT Working:**
1. Jobs stuck in 'queued' status forever
2. No evidence of job processing in logs
3. No OpenAI API calls
4. No objects created
5. Frontend never receives completion

### Root Cause

The `OPENAI_API_KEY` environment variable is **NOT SET** in Railway deployment.

From `backend/app/services/ai_agent_service.py:24-28`:
```python
api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    self.logger.log_error("OPENAI_API_KEY environment variable not set")
    raise ValueError("OpenAI API key is required but not configured")
```

When the job processor tries to process a job, it attempts to initialize `AIAgentService`, which fails immediately if `OPENAI_API_KEY` is missing. The job is then marked as 'failed' with an error message.

## Solution: Set OPENAI_API_KEY in Railway

### Step 1: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. **IMPORTANT:** Save it somewhere safe - you won't be able to see it again!

### Step 2: Add to Railway Environment Variables

1. Go to Railway dashboard: https://railway.app/
2. Navigate to your project: `gauntlet-collab-canvas-day7-production`
3. Click on the backend service
4. Go to "Variables" tab
5. Click "New Variable"
6. Add:
   - **Variable Name:** `OPENAI_API_KEY`
   - **Value:** `sk-...` (your actual key)
7. Click "Add"
8. **IMPORTANT:** Railway will automatically redeploy your service

### Step 3: Verify Configuration

After Railway redeploys (takes 2-3 minutes), verify the setup:

#### Option A: Using the Debug Endpoint

```bash
curl https://gauntlet-collab-canvas-day7-production.up.railway.app/api/ai-agent/debug/environment
```

**Expected Response:**
```json
{
  "success": true,
  "environment": {
    "openai_api_key": "SET",           // Should say "SET" not "MISSING"
    "api_key_length": 51,               // Should be > 0
    "openai_model": "gpt-4",
    "flask_env": "production"
  },
  "ai_service": {
    "status": "INITIALIZED",            // Should say "INITIALIZED" not "FAILED"
    "error": null
  },
  "job_processor": {
    "running": true,
    "active_jobs": 0,
    "max_concurrent_jobs": 3
  },
  "recent_jobs": [...]
}
```

#### Option B: Check Railway Logs

After setting the environment variable, check Railway logs for:
```
OpenAI client initialized successfully
AI Agent Service dependencies initialized successfully
```

### Step 4: Test AI Canvas Generation

1. Open your canvas app: https://collab-canvas-frontend.up.railway.app/
2. Sign in
3. Open AI Panel
4. Enter a prompt like: "Create a simple flowchart with 3 boxes"
5. Click "Generate"
6. Objects should appear on canvas within 5-10 seconds

## Additional Configuration (Optional)

### Set OpenAI Model (Optional)

By default, the system uses `gpt-4`. To use a different model:

1. Add another environment variable in Railway:
   - **Variable Name:** `OPENAI_MODEL`
   - **Value:** `gpt-4-turbo-preview` (or any other model)

Available models:
- `gpt-4` (default, most capable)
- `gpt-4-turbo-preview` (faster, cheaper)
- `gpt-3.5-turbo` (fastest, cheapest)

## Troubleshooting

### Issue: Debug endpoint shows "MISSING"

**Solution:** The environment variable wasn't saved properly. Go back to Railway and verify it's there.

### Issue: Debug endpoint shows "FAILED" with error

**Possible errors:**

1. **"OpenAI API key is required but not configured"**
   - The key is still not set or Railway hasn't redeployed yet
   - Wait 2-3 minutes and try again

2. **"Invalid API key"**
   - The key is incorrect or has been revoked
   - Get a new key from OpenAI and update Railway

3. **"Rate limit exceeded"**
   - You've exceeded your OpenAI API quota
   - Check your OpenAI billing dashboard
   - Add credits to your OpenAI account

### Issue: Jobs stuck in 'queued' status

Run the debug endpoint and check `recent_jobs`. If jobs show status 'failed', check the `error_message` field.

### Issue: Jobs processing but frontend doesn't show objects

This means the backend is working but the frontend state management has issues. Check:
1. Console logs for errors
2. Network tab for failed POST `/api/objects/` requests
3. Verify the mixed content fix was deployed (commit 4e6558c)

## Architecture Overview

For reference, here's how the complete flow works:

1. **Frontend:** User enters prompt in AI Panel
2. **API:** POST `/api/ai-agent/create-canvas` → Creates job (status: 'queued')
3. **Job Processor:** Background thread picks up job
4. **AI Service:** Calls OpenAI API with prompt
5. **AI Service:** Creates canvas objects in database
6. **WebSocket:** Emits `ai_generation_completed` event with objects
7. **Frontend:** Receives event → Updates state → Objects appear on canvas
8. **Polling Fallback:** If WebSocket fails, polling gets job result with objects

## Files Modified

- `backend/app/routes/ai_agent.py` - Added `/debug/environment` endpoint
- This documentation file

## Next Steps

1. Set `OPENAI_API_KEY` in Railway
2. Wait for redeployment
3. Run debug endpoint to verify
4. Test AI canvas generation
5. If issues persist, check Railway logs and run debug endpoint again

## Support

If you continue to have issues:
1. Run the debug endpoint and share the output
2. Check Railway logs for errors
3. Verify your OpenAI account has credits
4. Check the recent_jobs in debug endpoint for error messages
