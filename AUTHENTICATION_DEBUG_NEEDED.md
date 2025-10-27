# Authentication Debug - Object Placement Still Failing

**Date:** October 27, 2025, 6:30 AM
**Status:** Railway deployed with latest fixes, but object placement still blocked
**Commit:** 8ef0e01

---

## 🎯 Current Status

### ✅ Fixed
1. **Cache comparison bug** - `float(exp_time)` conversion added
2. **Schema validation** - All schemas have `_token_metadata` and `_authenticated_user` fields
3. **Rate limiting compatibility** - `ex=` parameter used instead of `timeout=`

### ❌ Still Broken
**Object placement completely non-functional**

---

## 🚨 Critical Issue: "User or canvas ID missing"

**Console Error:**
```
Error message: User or canvas ID missing
```

**Railway Logs:**
```
Security: anonymous_rate_limit_exceeded_object_created for user anonymous:100.64.0.4
Anonymous rate limit exceeded for IP 100.64.0.4 on event object_created
```

---

## 🔍 Root Cause Analysis

### What We Know

1. **Socket.IO connection authenticated successfully:**
   ```
   Socket.IO connection authenticated for user: jskeete@gmail.com
   Session stored with keys: ['authenticated_user', 'socket_id', ...]
   ```

2. **Individual Socket.IO events treated as anonymous:**
   ```
   anonymous:100.64.0.4:object_created
   ```

3. **Frontend IS sending id_token:**
   ```typescript
   enhancedSocketService.emit('object_created', {
     canvas_id: canvasId,
     id_token: idToken,  // ← Frontend sends this
     object,
   })
   ```

### The Problem

**Socket.IO events don't have access to Flask session!**

When a Socket.IO event is emitted:
1. It runs in a **different request context** than the initial connection
2. Flask `session` object is **not available** or **empty**
3. `@require_socket_auth` decorator checks session first → **fails**
4. Falls back to checking for `id_token` in data → **???**

**Question:** Is `id_token` actually in the data when it reaches `require_socket_auth`?

---

## 🔍 Debug Strategy

### Added Debug Logging

**File:** `backend/app/middleware/socket_security.py:382`

```python
# Debug session and data information
security_logger.log_info(f"Socket event authentication check - Session keys: {list(session.keys())}")
security_logger.log_info(f"Socket event authentication check - Data keys: {list(data.keys()) if data else 'None'}")
security_logger.log_info(f"Socket event authentication check - Has id_token: {'id_token' in data if data else False}")
```

### What To Check After Next Deployment

Once Railway redeploys with commit 8ef0e01, check logs for:

```
Socket event authentication check - Session keys: [...]
Socket event authentication check - Data keys: [...]
Socket event authentication check - Has id_token: True/False
```

**If `Has id_token: False`:**
- Problem is in validation/sanitization pipeline
- `id_token` is being stripped before reaching `require_socket_auth`
- Need to fix `validate_socket_input` or schema loading

**If `Has id_token: True`:**
- Problem is in fallback authentication logic
- Token is present but validation is failing
- Check `auth_service.verify_token()` for errors

---

## 🔧 Potential Fixes

### Option 1: Use Socket.IO Session (Recommended)

Instead of Flask session, use Socket.IO's built-in session storage:

```python
# In connection handler:
@socketio.on('connect')
def handle_connect(auth=None):
    # ...authenticate...
    socketio.session['authenticated_user'] = user_data  # Store in Socket.IO session

# In require_socket_auth decorator:
user_data = socketio.session.get('authenticated_user')  # Retrieve from Socket.IO session
```

### Option 2: Always Use Token Authentication

Remove dependency on session entirely:

```python
def require_socket_auth(func):
    def wrapper(data, *args, **kwargs):
        # Don't check session - always require id_token
        id_token = data.get('id_token')
        if not id_token:
            emit('error', {'message': 'Authentication token required'})
            return

        # Validate token directly
        auth_service = AuthService()
        user = auth_service.verify_token(id_token)
        # ...
```

### Option 3: Fix Session Context

Ensure Flask session is available in Socket.IO event context:

```python
from flask import session
from flask_socketio import emit

# Make sure Socket.IO uses same session as Flask
socketio = SocketIO(app, manage_session=True)
```

---

## 📊 Decorator Execution Order

Current order in `secure_socket_event`:

```python
# Line 555-560
func = validate_socket_input(schema_class)(func)     # 1. Validate & sanitize
func = require_socket_auth(func)                     # 2. Authenticate
func = check_canvas_permission_decorator(permission)(func)  # 3. Check permissions
func = rate_limit_socket_event(event_type)(func)     # 4. Rate limit
```

**Flow:**
1. `validate_socket_input` receives original `data`
2. Validates with schema: `validated_data = schema.load(data)`
3. Sanitizes: `sanitized_data = sanitize_socket_event_data(validated_data)`
4. Passes `sanitized_data` to next decorator
5. `require_socket_auth` receives `sanitized_data`
6. Checks if `id_token` is in `sanitized_data`

**Critical Question:** Does `sanitized_data` contain `id_token`?

---

## 🎯 Next Steps

1. **Wait for Railway deployment** (commit 8ef0e01)
2. **Try to place object** on canvas
3. **Check Railway logs** for debug output:
   ```
   Socket event authentication check - Has id_token: ???
   ```
4. **Based on logs:**
   - If False → Fix validation/sanitization pipeline
   - If True → Fix authentication logic

---

## 📝 Files Modified

### backend/app/extensions.py
- Line 88: `float(exp_time) < current_time` instead of `exp_time < current_time`
- Fixes cache comparison error

### backend/app/middleware/socket_security.py
- Line 382: Added debug logging for `id_token` presence
- Shows what data is available when authentication runs

---

## 🚀 Deployment Status

**Commit:** 8ef0e01 "Fix cache comparison bug and add authentication debug logging"
**Pushed:** October 27, 2025, 6:30 AM
**Railway Status:** Should be deploying now

**Expected:** Railway will restart backend with new code in ~2-5 minutes

---

## 🧪 Testing After Deployment

1. **Hard refresh browser** (Cmd+Shift+R)
2. **Log in** to canvas app
3. **Navigate to canvas**
4. **Try to place object** (text or shape)
5. **Check browser console** - still see "User or canvas ID missing"?
6. **Check Railway logs** - look for new debug lines
7. **Report findings** - Does data have id_token?

---

**We're getting closer! The next deployment will tell us exactly where the id_token is getting lost.**
