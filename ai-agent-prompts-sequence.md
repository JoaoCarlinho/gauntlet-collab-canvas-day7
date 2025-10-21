# AI Agent Prompts Sequence Documentation

This document describes the complete sequence of actions that occur when a message is sent to the AI agent from the canvas to receive a generated canvas configuration with objects placed on it as described in a prompt.

## Overview

The AI agent system uses an asynchronous job-based architecture with polling-only Socket.IO transport and HTTP polling mechanisms to handle canvas generation requests. The system supports multiple AI service implementations with fallback mechanisms for reliability. **Note: This system uses zero WebSocket connections and relies entirely on polling-based communication.**

## Complete Action Sequence

### 1. Frontend User Interaction

**Location**: `frontend/src/components/AIAgentPanel.tsx`

1. **User Input Collection**:
   - User enters natural language instructions in the AI Agent Panel
   - User selects style preferences (modern, corporate, creative, minimal)
   - User selects color scheme (pastel, vibrant, monochrome, default)
   - Optional: User specifies existing canvas ID to add objects to

2. **Form Validation**:
   - Client-side validation ensures instructions are not empty
   - Input sanitization prevents XSS attacks
   - Character limits enforced (max 1000 characters for instructions)

### 2. Frontend Request Initiation

**Location**: `frontend/src/hooks/useAIAgent.ts`

3. **API Request Creation**:
   - `createCanvas()` function called with user input
   - Request payload includes:
     - `instructions`: Natural language description
     - `style`: Visual style preference
     - `colorScheme`: Color scheme preference
     - `canvas_id`: Optional existing canvas ID
   - JWT token attached for authentication

4. **HTTP Request to Backend**:
   - POST request to `/api/ai-agent/create-canvas`
   - Headers include Authorization Bearer token
   - Content-Type: application/json

### 3. Backend Request Processing

**Location**: `backend/app/routes/ai_agent.py`

5. **Route Handler Execution**:
   - `create_canvas_with_ai()` function processes the request
   - Cross-origin headers set for CORS support
   - Authentication middleware validates JWT token
   - Rate limiting applied to prevent abuse

6. **Request Validation**:
   - `CanvasCreationRequestSchema` validates request data
   - Security checks for prompt injection patterns
   - Dangerous keyword detection and filtering
   - Canvas ID format validation

7. **Job Creation**:
   - `AIJobService.create_canvas_job()` creates background job
   - Job stored in PostgreSQL with status 'queued'
   - Job includes user ID, request data, and priority
   - Job ID returned to frontend

8. **Immediate Response**:
   - HTTP 202 (Accepted) response sent to frontend
   - Response includes:
     - `success: true`
     - `job_id`: Unique job identifier
     - `message`: "Canvas creation job started"
     - `status`: "queued"

### 4. Background Job Processing

**Location**: `backend/app/services/ai_job_service.py`

9. **Job Queue Processing**:
   - Background worker picks up queued job
   - Job status updated to 'processing'
   - Job status stored in PostgreSQL database for polling access

10. **AI Service Initialization**:
    - `AIAgentService` instance created
    - OpenAI client initialized with API key
    - Service selection based on configuration (main, simple, robust, fallback)

11. **Progress Updates**:
    - Job status updated in database with progress information
    - Frontend polls for status updates via HTTP API

### 5. AI Canvas Generation

**Location**: `backend/app/services/ai_agent_service.py`

12. **Request Optimization**:
    - Query optimization for better AI responses
    - Common pattern detection for cached results
    - Performance optimization applied

13. **Security Validation**:
    - Input sanitization and validation
    - AI response security checks
    - Malicious content detection

14. **AI Prompt Construction**:
    - System prompt defines AI role as "expert product manager and Figma power user"
    - Available object types specified:
      - rectangle: For boxes, containers, buttons
      - circle: For decision points, highlights
      - diamond: For decision points, conditions
      - text: For labels, descriptions
      - arrow: For connections, flow direction
      - line: For separators, connections

15. **User Prompt Generation**:
    ```
    Create a canvas layout based on this description: "{query}"
    
    Style preferences: {style_guidance}
    
    Return a JSON object with this exact structure:
    {
        "title": "Descriptive title for the canvas",
        "objects": [
            {
                "type": "rectangle|circle|diamond|text|arrow|line",
                "label": "Object label or text content",
                "x": number (0-1000),
                "y": number (0-1000),
                "width": number (10-500),
                "height": number (10-500),
                "color": "hex color code",
                "fontSize": number (8-24, for text objects)
            }
        ]
    }
    ```

16. **OpenAI API Call**:
    - Model: GPT-4 (configurable via OPENAI_MODEL env var)
    - JSON schema enforced for structured response
    - Max tokens: 2000
    - Temperature: 0.7
    - Response format validation

17. **AI Response Processing**:
    - JSON response parsed and validated
    - Object properties sanitized
    - Canvas objects created from AI response
    - Object optimization for rendering performance

### 6. Canvas and Object Creation

**Location**: `backend/app/services/ai_agent_service.py`

18. **Canvas Management**:
    - New canvas created if no canvas_id provided
    - Existing canvas retrieved and validated if canvas_id provided
    - Canvas ownership verified
    - Canvas linked to AI prompt for tracking

19. **Object Persistence**:
    - Canvas objects saved to database
    - Each object includes:
      - Unique ID (UUID)
      - Canvas ID reference
      - Object type (rectangle, circle, etc.)
      - Properties (position, size, color, text)
      - Creator user ID
      - Timestamps

20. **Progress Update**:
    - Job status updated in database with progress 90%
    - Status message: "Finalizing canvas..."

### 7. Job Completion

**Location**: `backend/app/services/ai_job_service.py`

21. **Job Status Update**:
    - Job marked as 'completed'
    - Result data stored in job record
    - Completion timestamp recorded

22. **Success Notification**:
    - Job completion status stored in database
    - Frontend polls for completion via HTTP API
    - Result data available via `/api/ai-agent/job/{jobId}/result` endpoint

### 8. Frontend Response Handling

**Location**: `frontend/src/components/AIAgentPanel.tsx`

23. **Polling-Only Status Monitoring**:
    - Frontend uses `pollJobStatus()` function for status checking
    - Polls job status every 5 seconds via HTTP API
    - Maximum 60 attempts (5 minutes timeout)
    - Status checked via `/api/ai-agent/job/{jobId}/status` endpoint

24. **Polling Mechanism** (Primary):
    - `pollJobStatus()` function polls job status every 5 seconds
    - Maximum 60 attempts (5 minutes timeout)
    - Status checked via `/api/ai-agent/job/{jobId}/status` endpoint
    - Real-time progress updates displayed to user through polling

25. **Completion Handling**:
    - Job result retrieved via `/api/ai-agent/job/{jobId}/result` endpoint
    - Success notification displayed to user
    - AI Agent Panel closed automatically
    - Canvas page updated with new objects
    - Undo/redo state saved for new content

### 9. Error Handling and Fallbacks

**Multiple Locations**

26. **AI Service Fallbacks**:
    - Primary: `AIAgentService` (full-featured)
    - Secondary: `SimpleAIAgentService` (basic functionality)
    - Tertiary: `RobustAIAgentService` (error-resistant)
    - Final: `FallbackAIAgentService` (template-based)

27. **Error Scenarios**:
    - OpenAI API failures
    - Invalid AI responses
    - Database connection issues
    - Authentication failures
    - Rate limit exceeded

28. **Error Notifications**:
    - Job error status stored in database
    - Frontend polls for error status via HTTP API
    - Job retry mechanism available
    - Emergency canvas creation as last resort

## Polling-Based Communication

### HTTP API Endpoints for Status Monitoring

- `GET /api/ai-agent/job/{jobId}/status`: Get current job status
- `GET /api/ai-agent/job/{jobId}/result`: Get job result when completed
- `POST /api/ai-agent/create-canvas`: Create new AI canvas job

### Job Status Data Structure

```typescript
interface AIJobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  progress: number;
  result?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}
```

### Polling Configuration

- **Polling Interval**: 5 seconds
- **Maximum Attempts**: 60 (5 minutes total)
- **Timeout Handling**: Automatic timeout after 5 minutes
- **Error Handling**: Graceful degradation with user notifications

## Socket.IO Polling-Only Implementation

### Transport Configuration

The system uses Socket.IO with **polling-only** transport to eliminate WebSocket-related issues:

```typescript
// Frontend Socket.IO Configuration
const socketConfig = {
  transports: ['polling'], // Force polling-only transport
  upgrade: false, // Disable WebSocket upgrade attempts
  rememberUpgrade: false,
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
}
```

### Backend Socket.IO Configuration

```python
# Backend Socket.IO Configuration
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    transports=['polling'],  # Force polling-only transport
    allow_upgrades=False,    # Disable WebSocket upgrades
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=500000,
    logger=False,
    engineio_logger=False
)
```

### Benefits of Polling-Only Approach

1. **Reliability**: Eliminates WebSocket connection issues and parse errors
2. **Compatibility**: Works across all network configurations and proxies
3. **Simplicity**: Reduces complexity of connection management
4. **Debugging**: Easier to debug and monitor HTTP-based communication
5. **Production Stability**: Proven to work reliably in production environments

## API Endpoints

### Primary Endpoints

- `POST /api/ai-agent/create-canvas`: Create canvas with AI
- `GET /api/ai-agent/job/{jobId}/status`: Get job status
- `GET /api/ai-agent/job/{jobId}/result`: Get job result
- `GET /api/ai-agent/health`: Health check

### Request/Response Schemas

**Request Schema**:
```json
{
  "instructions": "string (1-1000 chars)",
  "style": "modern|corporate|creative|minimal",
  "colorScheme": "pastel|vibrant|monochrome|default",
  "canvas_id": "string (optional)",
  "priority": "number (optional)"
}
```

**Response Schema**:
```json
{
  "success": true,
  "job_id": "uuid",
  "message": "string",
  "status": "queued|processing|completed|failed"
}
```

## Security Measures

1. **Input Validation**: Comprehensive schema validation
2. **Prompt Injection Prevention**: Pattern detection and filtering
3. **Rate Limiting**: Per-user request limits
4. **Authentication**: JWT token validation
5. **Authorization**: Canvas ownership verification
6. **Content Sanitization**: XSS and injection prevention
7. **Error Handling**: Secure error messages without sensitive data

## Performance Optimizations

1. **Caching**: Common pattern detection and caching
2. **Background Processing**: Asynchronous job processing
3. **Object Optimization**: Rendering performance optimization
4. **Token Optimization**: Efficient HTTP request handling
5. **Database Indexing**: Optimized queries for job management
6. **Polling Optimization**: Intelligent polling intervals and timeout handling

## Monitoring and Logging

1. **Structured Logging**: Comprehensive logging at all levels
2. **Performance Metrics**: Job processing times and success rates
3. **Error Tracking**: Detailed error logging and reporting
4. **User Analytics**: Usage patterns and performance metrics
5. **Health Checks**: System health monitoring

This sequence ensures reliable, secure, and performant AI-powered canvas generation with comprehensive error handling and user feedback mechanisms using polling-only communication infrastructure.
