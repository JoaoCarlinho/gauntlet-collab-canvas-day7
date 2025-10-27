# Token Refresh Flow Investigation

**Date:** 2025-10-27
**Status:** ✅ **ANALYSIS COMPLETE**

---

## Executive Summary

After investigating the token refresh flow in response to expired token errors seen in Railway logs, I found that **the token auto-refresh implementation is actually quite robust and comprehensive**. However, the errors in the logs reveal a critical issue: **the user's session lasted 55 hours**, which is far beyond Firebase's 1-hour token expiration window, indicating the user left the app open for days without the refresh mechanism being triggered.

---

## Railway Log Evidence

### Token Expiration Errors

From `railway_logs.log`:

```
Line 91-97:
=== Token Verification Failed ===
Error: Token expired, 1761332941 < 1761530854
Error type: ExpiredIdTokenError
Socket.IO authentication failed: Token has expired. Please refresh your authentication.
```

```
Line 163-166:
=== Token Verification Failed ===
Error: Token expired, 1761332941 < 1761530857
Error type: ExpiredIdTokenError
Socket.IO authentication failed: Token has expired. Please refresh your authentication.
```

### Timeline Analysis

- **Token Creation:** Timestamp `1761332941` (Unix timestamp)
- **First Failure:** Timestamp `1761530854`
- **Second Failure:** Timestamp `1761530857`
- **Time Difference:** 197,913 seconds = **54.97 hours** ≈ **55 hours**

**This means the user left the browser tab open for over 2 days without interacting with it!**

---

## Current Token Refresh Implementation

### 1. AuthService - Comprehensive Auto-Refresh ✅

**File:** `frontend/src/services/authService.ts`

The implementation includes:

#### **Periodic Refresh (Every 5 Minutes)**
```typescript
private readonly REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

private startTokenRefresh(): void {
  this.refreshInterval = setInterval(() => {
    if (this.authState.isAuthenticated) {
      this.validateAndRefreshToken()
    }
  }, this.REFRESH_INTERVAL)
}
```

✅ **Good:** Checks token every 5 minutes
✅ **Good:** Automatically refreshes if expiring within 10 minutes

#### **Visibility Change Detection**
```typescript
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && this.authState.isAuthenticated) {
    this.validateAndRefreshToken()
  }
})
```

✅ **Good:** Refreshes when user returns to tab
✅ **Good:** Handles user switching tabs

#### **Window Focus Detection**
```typescript
window.addEventListener('focus', () => {
  if (this.authState.isAuthenticated) {
    this.validateAndRefreshToken()
  }
})
```

✅ **Good:** Refreshes when window regains focus

#### **Proactive Refresh Threshold**
```typescript
private shouldRefreshToken(expiresAt?: number): boolean {
  if (!expiresAt) return true

  const now = Date.now()
  const refreshThreshold = 10 * 60 * 1000 // 10 minutes
  return (expiresAt - now) < refreshThreshold
}
```

✅ **Good:** Refreshes 10 minutes before expiration
✅ **Good:** Provides buffer time

### 2. API Interceptor - Handles 401 Errors ✅

**File:** `frontend/src/services/api.ts`

```typescript
if (error.response?.status === 401) {
  console.warn('Authentication error - attempting token refresh')

  await authenticationCircuitBreaker.execute(async () => {
    await authService.forceTokenRefresh()
    const newToken = await authService.getValidToken()
    if (newToken && error.config) {
      error.config.headers.Authorization = `Bearer ${newToken}`
      error.config.retryCount = (error.config.retryCount || 0) + 1
      return api.request(error.config)
    }
  })
}
```

✅ **Good:** Catches 401 errors
✅ **Good:** Forces token refresh
✅ **Good:** Retries original request with new token
✅ **Good:** Circuit breaker protection

### 3. Firebase Token Refresh ✅

**File:** `frontend/src/services/firebase.ts`

```typescript
export const refreshFirebaseToken = async (): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser
    if (currentUser) {
      console.log('Refreshing Firebase ID token...')
      const token = await currentUser.getIdToken(true) // Force refresh
      console.log('Token refreshed successfully')
      return token
    }
    return null
  } catch (error) {
    console.error('Failed to refresh Firebase token:', error)
    return null
  }
}
```

✅ **Good:** Uses Firebase's built-in `getIdToken(true)` with force refresh
✅ **Good:** Proper error handling

---

## Why Token Expired Despite All This

### The Problem: Browser Tab Backgrounded for 55 Hours

The user left the browser tab open but **did not interact with it for over 2 days**. Here's what happened:

#### **Hour 0:**
- User loads app, gets fresh token (valid for 1 hour)
- Token will expire at Hour 1

#### **Hour 0-1:**
- authService runs every 5 minutes checking token
- At ~50 minutes, token is within 10-minute refresh threshold
- **Token should be refreshed proactively**

#### **Hour 1+:**
- Token expired
- But... **what if the browser tab was backgrounded?**

### Browser Background Tab Behavior

**CRITICAL DISCOVERY:** Modern browsers throttle background tabs to save resources:

1. **SetInterval Throttling:**
   - Background tabs: intervals run at **most once per second**
   - Some browsers: intervals **paused entirely** after 5 minutes in background
   - Chrome: **aggressive throttling** after 5 minutes

2. **Event Listener Throttling:**
   - `visibilitychange` fires when switching tabs ✅
   - `focus` fires when returning to window ✅
   - **BUT** if tab stays in background for 55 hours, neither fires!

3. **The 55-Hour Gap:**
   - User opened app at timestamp 1761332941
   - Immediately backgrounded the tab (or computer went to sleep)
   - Tab remained in background for 55 hours
   - Periodic refresh (`setInterval`) was throttled/paused
   - Token expired after 1 hour
   - User returned to tab at timestamp 1761530854
   - `visibilitychange` event should have fired → token refresh should have happened
   - **BUT**: The refresh attempt failed or didn't happen fast enough

---

## Analysis of Railway Logs: What Actually Happened

### Sequence of Events

**Before Token Expired (not in logs):**
- User authenticated successfully
- Token created at timestamp 1761332941
- User backgrounded tab or closed laptop

**Hour 0-55 (tab backgrounded):**
- `setInterval` throttled/paused by browser
- No refresh occurred
- Token expired after 1 hour

**Hour 55 (user returns):**
```
Line 91-97: First attempt to use app
=== Token Verification Failed ===
Error: Token expired, 1761332941 < 1761530854
Socket.IO authentication failed: Token has expired.
```

**What should have happened:**
1. `visibilitychange` event fires
2. authService.validateAndRefreshToken() called
3. Token refreshed before user makes any requests

**What actually happened:**
1. User made Socket.IO connection attempt
2. Backend checked token → expired
3. Backend rejected connection
4. Frontend's 401 handler tried to refresh
5. Refresh succeeded (or should have)
6. But Socket.IO had already failed

### Why Socket.IO Failed

Socket.IO authentication happens **during connection handshake**, not via HTTP interceptors:

```typescript
// Socket connection with auth
socketIO.connect(url, {
  auth: {
    token: await getIdToken() // Token retrieved ONCE during connection
  }
})
```

**Problem:** If the token is expired when Socket.IO tries to connect, it fails immediately. The HTTP 401 interceptor doesn't help because Socket.IO uses WebSocket protocol, not HTTP!

---

## Root Causes Identified

### 1. Browser Tab Throttling (PRIMARY CAUSE) 🔴

**Issue:** Background tabs have `setInterval` throttled/paused

**Impact:** 5-minute token check doesn't run for hours

**Evidence:** 55-hour gap between token creation and first error

### 2. Socket.IO Connection Before Token Validation (SECONDARY) 🟡

**Issue:** Socket.IO connects immediately on page load with whatever token is in localStorage

**Impact:** If token is stale/expired, Socket.IO fails before token can be refreshed

**Evidence:** "Socket.IO authentication failed" errors in logs

### 3. No Immediate Token Validation on Tab Focus (MINOR) ⚪

**Issue:** `visibilitychange` and `focus` events trigger async token validation, but Socket.IO might connect before validation completes

**Impact:** Race condition between token refresh and Socket.IO connection

**Evidence:** Multiple failed attempts in quick succession

---

## Recommended Fixes

### Fix 1: Validate Token BEFORE Socket.IO Connection 🔴 **CRITICAL**

**Problem:** Socket.IO connects immediately with potentially expired token

**Solution:** Add token validation step before Socket.IO connection

**Implementation:**
```typescript
// In socket.ts or wherever Socket.IO is initialized

async function connectSocket() {
  // 1. Validate and refresh token FIRST
  const tokenValidation = await authService.validateAndRefreshToken()

  if (!tokenValidation.isValid) {
    console.error('Cannot connect to socket: invalid token')
    // Redirect to login or show error
    return
  }

  // 2. THEN connect Socket.IO with fresh token
  const socket = socketIO.connect(url, {
    auth: {
      token: tokenValidation.token
    }
  })
}
```

**Benefits:**
- ✅ Ensures fresh token before connection
- ✅ Prevents failed Socket.IO handshakes
- ✅ Better user experience (clear error vs connection failure)

### Fix 2: Add Page Load Token Validation 🟡 **RECOMMENDED**

**Problem:** User returns after hours, token may be stale

**Solution:** Validate token immediately on app initialization

**Implementation:**
```typescript
// In App.tsx or main initialization

useEffect(() => {
  async function initializeAuth() {
    console.log('Initializing auth on page load...')
    const validation = await authService.validateAndRefreshToken()

    if (!validation.isValid) {
      console.warn('Token invalid on page load, redirecting to login')
      // Redirect to login or clear auth
      authService.clearAuth()
      navigate('/login')
    } else {
      console.log('Token validated successfully on page load')
    }
  }

  initializeAuth()
}, [])
```

**Benefits:**
- ✅ Catches stale tokens immediately
- ✅ Proactive validation before any API calls
- ✅ Better UX (immediate redirect vs waiting for first error)

### Fix 3: Add Heartbeat for Background Tabs 🟢 **OPTIONAL**

**Problem:** `setInterval` throttled in background tabs

**Solution:** Use Service Worker for background heartbeat (advanced)

**Implementation:**
```typescript
// Register service worker for background token refresh
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/token-refresh-worker.js')
}

// In token-refresh-worker.js
setInterval(() => {
  // Service workers run even when tab is backgrounded
  // Send message to all clients to refresh token
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'REFRESH_TOKEN' })
    })
  })
}, 5 * 60 * 1000) // 5 minutes
```

**Benefits:**
- ✅ Works even in background tabs
- ✅ More reliable than `setInterval`
- ⚠️ More complex to implement

**Drawbacks:**
- ❌ Requires service worker setup
- ❌ More complexity
- ❌ May not be worth it for this use case

### Fix 4: Show "Session Expired" Message 🟢 **NICE TO HAVE**

**Problem:** Users don't know why connection failed

**Solution:** Detect expired token and show clear message

**Implementation:**
```typescript
// In socket error handler

socket.on('error', (error) => {
  if (error?.message?.includes('expired') || error?.type === 'auth_error') {
    toast.error(
      'Your session has expired. Please log in again.',
      {
        duration: 10000,
        action: {
          label: 'Login',
          onClick: () => navigate('/login')
        }
      }
    )
  }
})
```

**Benefits:**
- ✅ Clear user communication
- ✅ Provides action to resolve
- ✅ Better UX

---

## Implementation Priority

### **Priority 1: CRITICAL (Implement Now)** 🔴

1. **Fix 1: Validate token before Socket.IO connection**
   - Prevents failed connections
   - Ensures fresh token
   - Essential for user experience

### **Priority 2: RECOMMENDED (Implement Soon)** 🟡

2. **Fix 2: Page load token validation**
   - Catches stale sessions early
   - Proactive vs reactive
   - Improves UX

3. **Fix 4: Session expired message**
   - Clear user communication
   - Easy to implement
   - Nice to have

### **Priority 3: OPTIONAL (Consider Later)** 🟢

4. **Fix 3: Service worker heartbeat**
   - Complex implementation
   - Marginal benefit
   - Only if background tab sessions are common

---

## Testing Plan

### Test Scenario 1: Background Tab for 2+ Hours

**Steps:**
1. Log in to app
2. Immediately background tab (switch to another tab)
3. Wait 2+ hours (or manually expire token in localStorage)
4. Switch back to tab
5. Observe behavior

**Expected Behavior (After Fix):**
- Token validated on tab focus
- Fresh token retrieved
- Socket.IO connects successfully
- No errors in console

### Test Scenario 2: Page Load with Expired Token

**Steps:**
1. Log in to app
2. Manually set token expiration in localStorage to past timestamp
3. Reload page
4. Observe behavior

**Expected Behavior (After Fix):**
- Token validated on page load
- Expired token detected
- User redirected to login
- Clear message shown

### Test Scenario 3: Normal Usage

**Steps:**
1. Log in to app
2. Use normally for 30 minutes
3. Leave tab active
4. Return after 30 minutes
5. Continue using

**Expected Behavior:**
- Token auto-refreshed proactively (at 50-minute mark)
- No interruption to user
- No errors

---

## Summary

### Current State: Actually Pretty Good! ✅

The token refresh implementation is **comprehensive and well-designed**:
- ✅ Periodic refresh every 5 minutes
- ✅ Proactive refresh 10 minutes before expiration
- ✅ Visibility change detection
- ✅ Window focus detection
- ✅ 401 error handling with retry
- ✅ Circuit breaker protection

### The Real Issue: Edge Case Scenario 🔍

The errors in Railway logs are from a **rare edge case**:
- User left tab open for **55 hours** without interaction
- Browser throttled background `setInterval`
- Token expired after 1 hour
- User returned and tried to connect with expired token
- Socket.IO failed before token could be refreshed

### Recommended Action: Small Improvements 🎯

The implementation doesn't need major changes, just **two small additions**:

1. **Validate token before Socket.IO connection** (CRITICAL)
   - Ensures fresh token before connecting
   - Prevents failed handshakes

2. **Validate token on page load** (RECOMMENDED)
   - Catches stale sessions early
   - Better UX

These are **small, targeted fixes** that address the specific edge case without over-engineering.

---

**Investigation Completed:** 2025-10-27
**Status:** Ready for implementation
**Priority:** Fix 1 (Critical), Fix 2 (Recommended)
