# AI Canvas Job Processing Architecture

## Quick Answer to Your Questions

**Q: Where would job logs be visible?**
**A:** Railway logs - same place as all your Python Flask logs

**Q: Is the job running on the same server as the Python code?**
**A:** YES - it runs in the same Railway container as a background thread

**Q: Does a job runner need to be configured?**
**A:** NO - it auto-starts when Flask starts (already configured)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY CONTAINER                            │
│  (Single Python process running Flask app)                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   MAIN FLASK THREAD                      │  │
│  │  - Handles HTTP requests                                │  │
│  │  - API endpoints (/api/canvas, /api/ai-agent/*, etc)   │  │
│  │  - Socket.IO WebSocket connections                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           │ Spawns on startup                  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              JOB PROCESSOR THREAD                        │  │
│  │  (background daemon thread)                              │  │
│  │                                                           │  │
│  │  Every 5 seconds:                                        │  │
│  │    1. Query database for 'queued' jobs                  │  │
│  │    2. If found, spawn worker thread                     │  │
│  │    3. Repeat                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           │ Spawns worker threads              │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              JOB WORKER THREADS                          │  │
│  │  (up to 3 concurrent jobs)                               │  │
│  │                                                           │  │
│  │  For each job:                                           │  │
│  │    1. Initialize AIAgentService                          │  │
│  │    2. Call OpenAI API                                    │  │
│  │    3. Parse response                                     │  │
│  │    4. Save objects to PostgreSQL                         │  │
│  │    5. Emit WebSocket events                              │  │
│  │    6. Mark job as 'completed'                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ALL LOGS GO TO STDOUT → Railway Logs Dashboard               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow: From Request to Completion

### 1. **Job Creation** (API Request)
```
POST /api/ai-agent/create-canvas
↓
ai_agent.py:create_canvas_with_ai()
↓
AIJobService.create_canvas_job()
↓
INSERT INTO ai_jobs (status='queued')
↓
Return 202 Accepted with job_id
```

**Logs you'll see:**
```
[ai_job_service] Created AI job b1e5430d-494d-467f-91e1-702190132d88 for user WOUl6X...
```

### 2. **Job Discovery** (Background Thread)
```
job_processor._process_loop() [runs every 5 seconds]
↓
SELECT * FROM ai_jobs WHERE status='queued' ORDER BY priority DESC, created_at ASC
↓
If job found → Spawn worker thread
```

**Logs you'll see:**
```
[job_processor] Processing job b1e5430d-494d-467f-91e1-702190132d88
```

### 3. **Job Processing** (Worker Thread)
```
ai_job_service.process_job()
↓
UPDATE ai_jobs SET status='processing', started_at=NOW()
↓
Try to initialize AIAgentService
↓
OpenAIClientFactory.create_client()
↓
ai_service.create_canvas_from_query()
↓
OpenAI API call (chat.completions.create)
↓
Parse response → Create objects → Save to DB
↓
UPDATE ai_jobs SET status='completed', result_data={...}
```

**Logs you'll see:**
```
[ai_job_service] AI service initialized for job b1e5430d-494d-467f-91e1-702190132d88
[openai_client_factory] Creating OpenAI client with api_key only (no validation)
[openai_client_factory] OpenAI client created successfully (will validate on first use)
[ai_agent_service] Starting AI canvas creation for user WOUl6X...
[ai_agent_service] Sanitizing user query...
[ai_agent_service] Emitted ai_generation_started for request: abc123...
[ai_agent_service] Using OpenAI model: gpt-4
[ai_agent_service] OpenAI API call successful
[ai_agent_service] Parsed 5 objects from AI response
[ai_agent_service] Saved 5 objects to canvas f2c40e86...
[ai_agent_service] Emitted ai_generation_completed for request: abc123...
[ai_job_service] AI job b1e5430d-494d-467f-91e1-702190132d88 completed successfully
```

### 4. **Error Handling** (If Something Fails)
```
Exception occurs during processing
↓
ai_job_service.process_job() catches exception
↓
job.schedule_retry() or job.mark_failed()
↓
UPDATE ai_jobs SET status='failed', error_message='...', retry_count=1
↓
Emit 'ai_job_error' WebSocket event
```

**Logs you'll see:**
```
[ai_job_service] Failed to initialize AI service: OpenAI API key is required but not configured
[ai_job_service] AI job b1e5430d-494d-467f-91e1-702190132d88 failed: OpenAI API key is required...
```

---

## Log Locations

### **ALL LOGS ARE IN RAILWAY**

There's **only one place** to look for logs:

1. **Railway Dashboard**
   - Go to: https://railway.app/
   - Select project: `gauntlet-collab-canvas-day7-production`
   - Click on backend service
   - Click "Deployments" tab
   - Click on latest deployment
   - View logs in real-time

2. **Log Types You'll See:**

   **Startup Logs:**
   ```
   Starting Container
   Database connected successfully
   Job processor started successfully
   ```

   **HTTP Request Logs:**
   ```
   POST /api/ai-agent/create-canvas → 202
   GET /api/ai-agent/job/b1e5430d.../status → 200
   ```

   **Job Processing Logs:**
   ```
   [job_processor] Processing job b1e5430d...
   [ai_job_service] AI service initialized for job b1e5430d...
   [ai_agent_service] Starting AI canvas creation...
   [ai_agent_service] OpenAI API call successful
   [ai_job_service] AI job b1e5430d... completed successfully
   ```

   **Error Logs:**
   ```
   [ai_job_service] Failed to initialize AI service: ...
   [ai_agent_service] AI canvas creation failed: ...
   ```

---

## Job Runner Configuration

### **Already Configured - Auto-Starts**

The job processor is automatically started when Flask initializes:

**File:** `backend/app/__init__.py:515-521`
```python
# Start job processor (only if not already running)
from app.services.job_processor import job_processor
if not job_processor.running:
    job_processor.start()
    print("Job processor started successfully")
else:
    print("Job processor already running")
```

### **Configuration Settings**

**File:** `backend/app/config_modules/job_config.py`

```python
MAX_CONCURRENT_JOBS = 3        # Max jobs running at same time
PROCESSING_INTERVAL = 5        # Check for new jobs every 5 seconds
MAX_RETRIES = 3               # Retry failed jobs up to 3 times
RETRY_BACKOFF_BASE = 2        # Exponential backoff (2^retry_count minutes)
```

**Environment Variables (Optional):**
- `MAX_CONCURRENT_JOBS` - Default: 3
- `JOB_PROCESSING_INTERVAL` - Default: 5 seconds
- `MAX_JOB_RETRIES` - Default: 3

### **No External Job Runner Needed**

Unlike some systems that use:
- ❌ Celery (requires Redis/RabbitMQ)
- ❌ Bull (requires Redis)
- ❌ AWS Lambda (separate infrastructure)
- ❌ Google Cloud Tasks (separate service)

This system uses:
- ✅ Python threading (built-in)
- ✅ PostgreSQL (already have it)
- ✅ Runs in same process (no extra config)

---

## Monitoring Job Status

### **1. Via Debug Endpoint**
```bash
curl https://gauntlet-collab-canvas-day7-production.up.railway.app/api/ai-agent/debug/environment
```

**Response:**
```json
{
  "job_processor": {
    "running": true,
    "active_jobs": 0,
    "max_concurrent_jobs": 3,
    "processing_interval": 5
  },
  "recent_jobs": [
    {
      "id": "b1e5430d-494d-467f-91e1-702190132d88",
      "status": "queued",
      "created_at": "2025-10-28T20:54:55.766730",
      "started_at": null,
      "completed_at": null,
      "error_message": null,
      "retry_count": 0
    }
  ]
}
```

### **2. Via Health Endpoint**
```bash
curl https://gauntlet-collab-canvas-day7-production.up.railway.app/api/ai-agent/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "job_processor": {
    "running": true,
    "active_jobs": 0,
    "max_concurrent_jobs": 3
  }
}
```

### **3. Via Railway Logs**

Search for:
- `"Processing job"` - Job picked up
- `"AI job .* completed successfully"` - Job finished
- `"AI job .* failed"` - Job failed
- `"Failed to initialize AI service"` - Can't start OpenAI client

---

## Why Jobs Weren't Processing

### **Before Fix (Current State)**

```
1. Job created → status='queued' ✅
2. Job processor finds job ✅
3. Worker thread spawned ✅
4. Try to initialize AIAgentService ❌ FAILS HERE
   - OpenAIClientFactory tries to create client
   - Calls client.models.list() to test connection
   - Test fails (network/rate limit/key issue)
   - Returns None
   - AIAgentService.__init__ raises RuntimeError
5. Job marked as failed ❌
```

**Railway Logs Would Show:**
```
[ai_job_service] Failed to initialize AI service: Failed to initialize OpenAI client
```

**BUT:**
- Job stays in 'queued' status (not marked failed properly)
- No retry scheduled
- Job processor doesn't log the error
- Looks like nothing is happening

### **After Fix (What Will Happen)**

```
1. Job created → status='queued' ✅
2. Job processor finds job ✅
3. Worker thread spawned ✅
4. Initialize AIAgentService ✅ SUCCEEDS NOW
   - OpenAIClientFactory creates client WITHOUT testing
   - Returns client immediately
   - AIAgentService.__init__ succeeds
5. Call OpenAI API ✅
   - Validates API key on first actual use
   - If key invalid, clear error message
6. Create objects, save to DB ✅
7. Job marked as completed ✅
```

**Railway Logs Will Show:**
```
[job_processor] Processing job b1e5430d-494d-467f-91e1-702190132d88
[ai_job_service] AI service initialized for job b1e5430d...
[openai_client_factory] Creating OpenAI client with api_key only (no validation)
[openai_client_factory] OpenAI client created successfully
[ai_agent_service] Starting AI canvas creation...
[ai_agent_service] OpenAI API call successful
[ai_job_service] AI job b1e5430d... completed successfully
```

---

## Troubleshooting

### **Issue: "Job processor started successfully" but no jobs processing**

**Check:**
1. Are jobs in 'queued' status?
   ```bash
   curl .../api/ai-agent/debug/environment
   ```

2. Look for initialization errors in Railway logs:
   ```
   Failed to initialize AI service
   ```

3. Check if AIAgentService can initialize:
   ```json
   "ai_service": {"status": "FAILED"}  // ← Bad
   "ai_service": {"status": "INITIALIZED"}  // ← Good
   ```

### **Issue: Jobs processing but failing**

**Check Railway logs for:**
- OpenAI API errors (invalid key, rate limit, quota)
- Database errors (can't save objects)
- Parsing errors (can't parse OpenAI response)

### **Issue: No logs at all**

**Possible reasons:**
1. Railway deploying from wrong branch
2. Old code cached (force redeploy)
3. Container crashed (check deployment status)

---

## Summary

✅ **Job runner IS configured** - auto-starts with Flask
✅ **Logs ARE visible** - Railway logs dashboard
✅ **Jobs RUN in same container** - Python threading
✅ **No extra setup needed** - fully integrated

After your fix deploys, you should see full job processing logs in Railway showing the entire flow from job pickup to OpenAI API call to object creation! 🚀
