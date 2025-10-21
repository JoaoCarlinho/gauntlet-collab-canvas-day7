import { io, Socket } from 'socket.io-client'
import { CursorData } from '../types'
import { errorLogger, ErrorContext } from '../utils/errorLogger'
import { socketEventOptimizer } from '../utils/socketOptimizer'
import { socketIOClientOptimizer } from '../utils/socketioClientOptimizer'
import { canvasAPI } from './api'
import { tokenOptimizationService } from './tokenOptimizationService'
import { 
  SocketConfig, 
  SocketConnectionState,
  SocketConnectionQuality
} from '../types/socket'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Function[]> = new Map()
  private debugMode = import.meta.env.VITE_DEBUG_SOCKET === 'true'
  private connectionState: SocketConnectionState = 'disconnected'
  private connectionAttempts = 0
  private lastConnectionTime: number | null = null
  private connectionQuality: SocketConnectionQuality = 'unknown'

  connect(idToken?: string) {
    const API_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string
    
    // Update connection state
    this.connectionState = 'connecting'
    this.connectionAttempts++
    
    // Check if we're in development mode
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.MODE === 'development' ||
                         import.meta.env.VITE_DEBUG_MODE === 'true' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1'
    
    // If we've had multiple connection failures, try polling-only mode
    const shouldUsePollingOnly = this.connectionAttempts > 2
    
    // Only log in debug mode
    if (this.debugMode) {
      console.log('=== Socket.IO Connection Debug ===')
      console.log('API URL:', API_URL)
      console.log('Development mode:', isDevelopment)
      console.log('Token length:', idToken?.length || 0)
      console.log('Connection state:', this.connectionState)
      console.log('Connection attempts:', this.connectionAttempts)
    }
    
    // Get optimized Socket.IO configuration
    const socketConfig = socketIOClientOptimizer.getOptimizedConfig()
    
    // Add additional configuration with CORS support
    const enhancedConfig: SocketConfig = {
      ...socketConfig,
      forceNew: isDevelopment, // Only force new in development
      withCredentials: true, // Enable credentials for CORS
      extraHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      transports: ['polling'], // Force polling-only transport to prevent parse errors
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      maxReconnectionAttempts: 5,
      // upgrade: !shouldUsePollingOnly, // Disable upgrades if using polling-only
      // rememberUpgrade: false // Don't remember failed upgrades
    }
    
    // Only add auth token if not in development mode
    if (!isDevelopment && idToken) {
      enhancedConfig.auth = {
        token: idToken
      }
    } else if (isDevelopment) {
      console.log('Development mode: Connecting without authentication')
    }
    
    // Ensure correct path and secure transport in production
    const url = API_URL
    const config = {
      path: '/socket.io',
      ...enhancedConfig
    }
    this.socket = io(url, config)

    this.socket.on('connect', () => {
      this.connectionState = 'connected'
      this.connectionAttempts = 0
      this.lastConnectionTime = Date.now()
      this.connectionQuality = 'excellent' // Reset quality on successful connection
      
      // Log connection success for debugging
      console.log('=== Socket.IO Connected Successfully ===')
      console.log('Socket ID:', this.socket?.id)
      console.log('Connection state:', this.connectionState)
      console.log('Connection attempts:', this.connectionAttempts)
      console.log('Connection quality:', this.connectionQuality)
      console.log('Transport:', this.socket?.io?.engine?.transport?.name)
      console.log('Parse error metrics:', socketIOClientOptimizer.getParseErrorMetrics())
      
      if (this.debugMode) {
        console.log('Debug mode: Additional connection details logged above')
      }
      
      // Notify connection monitor of successful connection
      this.emit('connection_restored', {
        socketId: this.socket?.id,
        timestamp: Date.now(),
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality
      })
    })

    this.socket.on('disconnect', (reason) => {
      this.connectionState = 'disconnected'
      this.connectionQuality = 'poor'
      
      // Record connection drop for metrics
      socketIOClientOptimizer.recordConnectionDrop()
      
      if (this.debugMode) {
        console.log('=== Socket.IO Disconnected ===')
        console.log('Reason:', reason)
        console.log('Connection state:', this.connectionState)
        console.log('Parse error metrics:', socketIOClientOptimizer.getParseErrorMetrics())
      }
      
      // Notify connection monitor of disconnection
      this.emit('connection_lost', {
        reason,
        timestamp: Date.now(),
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality
      })
      
      // Emit event for state backup
      this.emit('connection_disconnected', {
        reason,
        timestamp: Date.now(),
        connectionState: this.connectionState
      })
    })

    // Track reconnection attempts
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.connectionState = 'reconnecting'
      this.connectionAttempts = attemptNumber
      this.connectionQuality = 'poor'
      
      if (this.debugMode) {
        console.log('=== Socket.IO Reconnection Attempt ===')
        console.log('Attempt:', attemptNumber)
        console.log('Connection state:', this.connectionState)
      }
      
      this.emit('reconnection_attempt', {
        attempt: attemptNumber,
        timestamp: Date.now(),
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality
      })
    })

    this.socket.on('reconnect', (attemptNumber) => {
      // Record successful reconnection
      socketIOClientOptimizer.recordReconnectionSuccess()
      
      // Update connection state
      this.connectionState = 'connected'
      this.lastConnectionTime = Date.now()
      
      // Update connection quality based on metrics
      this.connectionQuality = socketIOClientOptimizer.getConnectionQuality()
      
      if (this.debugMode) {
        console.log('=== Socket.IO Reconnected ===')
        console.log('Attempt:', attemptNumber)
        console.log('Connection quality:', this.connectionQuality)
        console.log('Parse error metrics:', socketIOClientOptimizer.getParseErrorMetrics())
      }
      
      this.emit('reconnection_success', {
        attempt: attemptNumber,
        timestamp: Date.now()
      })
      
      // Emit connection state change
      this.emit('connection_state_changed', {
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality,
        timestamp: Date.now()
      })
      
      // Emit event for state restoration
      this.emit('connection_restored', {
        attempt: attemptNumber,
        timestamp: Date.now(),
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality
      })
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('=== Socket.IO Reconnection Error ===')
      console.error('Error:', error)
      
      this.emit('reconnection_failed', {
        error: error.message,
        timestamp: Date.now()
      })
    })

    this.socket.on('reconnect_failed', () => {
      console.error('=== Socket.IO Reconnection Failed - Max Attempts Reached ===')
      
      this.emit('reconnection_exhausted', {
        timestamp: Date.now()
      })
    })

    // Always log errors, regardless of debug mode
    this.socket.on('connect_error', (error) => {
      console.error('=== Socket.IO Connection Error ===')
      console.error('Error:', error)
      console.error('Error message:', error.message)
      
      // Update connection state
      this.connectionState = 'disconnected'
      this.connectionQuality = 'poor'
      
      // Handle specific error types
      let errorType = 'connection_error'
      if (error.message.includes('CORS')) {
        errorType = 'cors_error'
      } else if (error.message.includes('xhr poll error')) {
        errorType = 'polling_error'
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout_error'
      } else if (error.message.includes('websocket error') || error.message.includes('FI: websocket error')) {
        errorType = 'websocket_error'
        // For WebSocket errors, try to force polling transport
        if (this.socket && this.socket.io && this.socket.io.engine) {
          console.log('WebSocket error detected, attempting to force polling transport')
          // Note: Direct transport assignment may not be supported in all Socket.IO versions
          // This is a fallback attempt
        }
      } else if (error.message.includes('Invalid transport')) {
        errorType = 'transport_error'
        console.log('Invalid transport error detected, this may indicate server configuration mismatch')
      }
      
      const context: ErrorContext = {
        operation: 'socket_connection',
        timestamp: Date.now(),
        additionalData: { 
          type: errorType, 
          socketId: this.socket?.id,
          errorMessage: error.message,
          connectionAttempts: this.connectionAttempts,
          originalError: error
        }
      }
      
      const errorId = errorLogger.logError(error, context)
      this.emit('socket_error', { 
        error, 
        timestamp: Date.now(), 
        type: errorType, 
        errorId,
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality,
        connectionAttempts: this.connectionAttempts
      })
      
      // Emit connection state change
      this.emit('connection_state_changed', {
        connectionState: this.connectionState,
        connectionQuality: this.connectionQuality,
        timestamp: Date.now(),
        error: error.message
      })
    })

    this.socket.on('error', (error) => {
      // Check if this is a parse error
      const isParseError = error?.message?.includes('parse error') || 
                          error?.description?.includes('parse error') ||
                          error?.code === 'parse_error'
      
      if (isParseError) {
        socketIOClientOptimizer.recordParseError()
        console.error('=== Socket.IO Parse Error Detected ===')
      } else {
        console.error('=== Socket.IO Error ===')
      }
      
      console.error('Error type:', typeof error)
      console.error('Error message:', error?.message || 'No message')
      console.error('Error code:', error?.code || 'No code')
      console.error('Error description:', error?.description || 'No description')
      console.error('Is parse error:', isParseError)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      console.error('Socket ID:', this.socket?.id)
      console.error('Socket connected:', this.socket?.connected)
      console.error('Socket transport:', this.socket?.io?.engine?.transport?.name)
      console.error('Parse error metrics:', socketIOClientOptimizer.getParseErrorMetrics())
      
      const context: ErrorContext = {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { 
          type: 'general_error', 
          socketId: this.socket?.id,
          errorType: typeof error,
          errorMessage: error?.message,
          errorCode: error?.code,
          socketConnected: this.socket?.connected,
          transport: this.socket?.io?.engine?.transport?.name
        }
      }
      
      const errorId = errorLogger.logError(error, context)
      // Emit error event for components to handle
      this.emit('socket_error', { 
        error, 
        timestamp: Date.now(), 
        type: 'general_error', 
        errorId,
        details: {
          message: error?.message,
          code: error?.code,
          socketId: this.socket?.id,
          connected: this.socket?.connected
        }
      })
    })

    // Register event listeners
    this.registerEventListeners()
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  private registerEventListeners() {
    if (!this.socket) return

    // Canvas events
    this.socket.on('joined_canvas', (data) => {
      this.emit('joined_canvas', data)
    })

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data)
    })

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data)
    })

    this.socket.on('object_created', (data) => {
      this.emit('object_created', data)
    })

    this.socket.on('object_updated', (data) => {
      this.emit('object_updated', data)
    })

    this.socket.on('object_deleted', (data) => {
      this.emit('object_deleted', data)
    })

    // Cursor events
    this.socket.on('cursor_moved', (data: CursorData) => {
      this.emit('cursor_moved', data)
    })

    this.socket.on('cursor_left', (data) => {
      this.emit('cursor_left', data)
    })

    this.socket.on('cursors_data', (data) => {
      this.emit('cursors_data', data)
    })

    // Presence events
    this.socket.on('user_came_online', (data) => {
      this.emit('user_came_online', data)
    })

    this.socket.on('user_went_offline', (data) => {
      this.emit('user_went_offline', data)
    })

    this.socket.on('online_users', (data) => {
      this.emit('online_users', data)
    })

    // AI Generation events
    this.socket.on('ai_generation_started', (data) => {
      if (this.debugMode) {
        console.log('=== AI Generation Started ===')
        console.log('Data:', data)
      }
      this.emit('ai_generation_started', data)
    })

    this.socket.on('ai_generation_completed', (data) => {
      if (this.debugMode) {
        console.log('=== AI Generation Completed ===')
        console.log('Data:', data)
      }
      this.emit('ai_generation_completed', data)
    })

    this.socket.on('ai_generation_failed', (data) => {
      console.error('=== AI Generation Failed ===')
      console.error('Data:', data)
      
      const context: ErrorContext = {
        operation: 'ai_generation',
        timestamp: Date.now(),
        additionalData: { 
          type: 'ai_generation_failed',
          errorData: data,
          requestId: data.request_id
        }
      }
      
      const errorId = errorLogger.logError(data.error_message || data, context)
      this.emit('ai_generation_failed', { ...data, errorId })
    })

    // Error events for object operations
    this.socket.on('object_update_failed', (data) => {
      console.error('=== Object Update Failed ===')
      console.error('Data:', data)
      
      const context: ErrorContext = {
        operation: 'object_update',
        objectId: data.object_id,
        timestamp: Date.now(),
        additionalData: { 
          type: 'object_update_failed',
          errorData: data
        }
      }
      
      const errorId = errorLogger.logError(data.error || data, context)
      this.emit('object_update_failed', { ...data, errorId })
    })

    this.socket.on('object_create_failed', (data) => {
      console.error('=== Object Create Failed ===')
      console.error('Data:', data)
      
      const context: ErrorContext = {
        operation: 'object_create',
        objectType: data.object_type,
        timestamp: Date.now(),
        additionalData: { 
          type: 'object_create_failed',
          errorData: data
        }
      }
      
      const errorId = errorLogger.logError(data.error || data, context)
      this.emit('object_create_failed', { ...data, errorId })
    })

    this.socket.on('object_delete_failed', (data) => {
      console.error('=== Object Delete Failed ===')
      console.error('Data:', data)
      
      const context: ErrorContext = {
        operation: 'object_delete',
        objectId: data.object_id,
        timestamp: Date.now(),
        additionalData: { 
          type: 'object_delete_failed',
          errorData: data
        }
      }
      
      const errorId = errorLogger.logError(data.error || data, context)
      this.emit('object_delete_failed', { ...data, errorId })
    })
  }

  // Canvas events
  joinCanvas(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('join_canvas', { canvas_id: canvasId, id_token: idToken })
    }
  }

  leaveCanvas(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('leave_canvas', { canvas_id: canvasId, id_token: idToken })
    }
  }

  async createObject(canvasId: string, idToken: string, object: { type: string; properties: Record<string, any> }) {
    // Enhanced authentication context validation (relaxed in dev by validateAuthContext)
    this.validateAuthContext(canvasId, idToken)
    
    if (this.socket) {
      try {
        // Validate and optimize token
        const tokenValidation = await tokenOptimizationService.validateTokenForSocket(idToken)
        if (!tokenValidation.isValid) {
          console.error('Token validation failed for object creation:', tokenValidation.issues)
          this.emit('object_create_failed', {
            error: 'Token validation failed',
            issues: tokenValidation.issues,
            object_type: object.type
          })
          return
        }

        // Preserve passed idToken; augment with user fields only if available
        const payload: Record<string, unknown> = {
          canvas_id: canvasId,
          id_token: idToken,
          object
        }
        const enhancedData = this.ensureAuthContext(payload)
        
        // Optimize message with token
        const optimizedData = await tokenOptimizationService.optimizeSocketMessageWithToken(enhancedData, idToken)
        
        // Log object creation payload for parse error debugging
        try {
          const messageSize = new Blob([JSON.stringify(optimizedData)]).size
          console.log('=== Object Creation Payload ===')
          console.log('Message size:', messageSize, 'bytes')
          console.log('Canvas ID:', canvasId)
          console.log('Object type:', object.type)
          console.log('Token length:', idToken.length)
          console.log('Token validation:', tokenValidation.isValid ? 'PASSED' : 'FAILED')
          console.log('Payload keys:', Object.keys(optimizedData))
          console.log('Object properties keys:', Object.keys(object.properties || {}))
          if (tokenValidation.hasIssues) {
            console.log('Token issues:', tokenValidation.issues)
          }
        } catch (logError) {
          console.error('Failed to log object creation payload:', logError)
        }
        
        this.socket.emit('object_created', optimizedData)
      } catch (error) {
        console.error('Object creation failed:', error)
        this.emit('object_create_failed', {
          error: String(error),
          object_type: object.type
        })
      }
    }
  }

  updateObject(canvasId: string, idToken: string, objectId: string, properties: Record<string, any>) {
    if (this.socket) {
      this.socket.emit('object_updated', {
        canvas_id: canvasId,
        id_token: idToken,
        object_id: objectId,
        properties
      })
    }
  }

  deleteObject(canvasId: string, idToken: string, objectId: string) {
    if (this.socket) {
      this.socket.emit('object_deleted', {
        canvas_id: canvasId,
        id_token: idToken,
        object_id: objectId
      })
    }
  }

  // Cursor events
  moveCursor(canvasId: string, idToken: string, position: { x: number; y: number }) {
    if (this.socket) {
      this.socket.emit('cursor_move', {
        canvas_id: canvasId,
        id_token: idToken,
        position,
        timestamp: Date.now()
      })
    }
  }

  leaveCursor(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('cursor_leave', {
        canvas_id: canvasId,
        id_token: idToken
      })
    }
  }

  getCursors(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('get_cursors', {
        canvas_id: canvasId,
        id_token: idToken
      })
    }
  }

  // Presence events
  userOnline(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('user_online', {
        canvas_id: canvasId,
        id_token: idToken,
        timestamp: Date.now()
      })
    }
  }

  userOffline(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('user_offline', {
        canvas_id: canvasId,
        id_token: idToken
      })
    }
  }

  getOnlineUsers(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('get_online_users', {
        canvas_id: canvasId,
        id_token: idToken
      })
    }
  }

  sendHeartbeat(canvasId: string, idToken: string) {
    if (this.socket) {
      this.socket.emit('heartbeat', {
        canvas_id: canvasId,
        id_token: idToken,
        timestamp: Date.now()
      })
    }
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.push(callback)
    }
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  // Get error log for debugging (delegates to errorLogger)
  getErrorLog() {
    return errorLogger.getErrorLog()
  }

  // Clear error log (delegates to errorLogger)
  clearErrorLog() {
    errorLogger.clearLog()
  }

  // Get error statistics
  getErrorStats() {
    return errorLogger.getErrorStats()
  }

  // Socket optimization methods
  optimizeEmit(event: string, data: Record<string, unknown>, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
    if (!this.socket) {
      console.warn('Socket not connected, cannot emit event:', event)
      return
    }

    // Validate message size to prevent parse errors
    const maxSize = priority === 'critical' ? 2000000 : 1000000 // 2MB for critical, 1MB for others
    if (!socketIOClientOptimizer.validateMessageSize(data, maxSize)) {
      console.error(`Event ${event} rejected: message too large`)
      return
    }

    // Sanitize message data to prevent parse errors
    const sanitizedData = socketIOClientOptimizer.sanitizeMessageData(data)

    // Use socket optimizer for non-critical events
    if (priority !== 'critical') {
      const eventId = socketEventOptimizer.optimizeEvent({
        type: event,
        data: sanitizedData,
        priority,
        maxRetries: 3
      })
      
      if (this.debugMode) {
        console.log(`Optimized event ${eventId} queued:`, event, sanitizedData)
      }
      return eventId
    }

    // Emit critical events immediately with sanitized data
    this.socket.emit(event, sanitizedData)
    if (this.debugMode) {
      console.log(`Critical event emitted immediately:`, event, sanitizedData)
    }
  }

  // Get socket optimization statistics
  getOptimizationStats() {
    return socketEventOptimizer.getStats()
  }

  // Get parse error metrics
  getParseErrorMetrics() {
    return socketIOClientOptimizer.getParseErrorMetrics()
  }

  // Get recommended configuration adjustments
  getRecommendedAdjustments() {
    return socketIOClientOptimizer.getRecommendedAdjustments()
  }

  // Reset parse error metrics
  resetParseErrorMetrics() {
    socketIOClientOptimizer.resetMetrics()
  }

  // Get socket optimization queue status
  getOptimizationQueueStatus() {
    return socketEventOptimizer.getQueueStatus()
  }

  // Flush optimization queue
  async flushOptimizationQueue() {
    return socketEventOptimizer.flushQueue()
  }

  // Clear optimization queue
  clearOptimizationQueue() {
    socketEventOptimizer.clearQueue()
  }

  // Update optimization configuration
  updateOptimizationConfig(config: Record<string, unknown>) {
    socketEventOptimizer.updateConfig(config)
  }

  // Authentication context validation and enhancement
  private validateAuthContext(canvasId: string, idToken: string): void {
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'
    if (!canvasId || !idToken) {
      throw new Error('Missing authentication context: canvasId or idToken')
    }
    // In dev, relax strict length checks to avoid blocking local/test flows
    if (!isDev) {
      if (canvasId.length < 10) {
        throw new Error('Invalid canvas ID format')
      }
      if (idToken.length < 100) {
        throw new Error('Invalid authentication token format')
      }
    }
  }

  private ensureAuthContext(data: Record<string, unknown>): Record<string, unknown> {
    const user = this.getCurrentUser()
    const canvasId = data.canvas_id
    // Do not throw if user is missing; prefer passed id_token; just augment if available
    const enriched: Record<string, unknown> = {
      ...data,
      canvas_id: canvasId,
      timestamp: Date.now()
    }
    if (user && user.idToken) {
      enriched['user_id'] = user.user.id
      // Only set id_token from user if none was provided in data
      if (!('id_token' in enriched)) {
        enriched['id_token'] = user.idToken
      }
      enriched['user_email'] = user.user.email
    }
    return enriched
  }

  private getCurrentUser(): { idToken: string; user: { id: string; email: string; name: string } } | null {
    try {
      const userStr = localStorage.getItem('user')
      const idToken = localStorage.getItem('idToken')
      
      if (!userStr || !idToken) {
        return null
      }
      
      const user = JSON.parse(userStr)
      return {
        ...user,
        idToken
      }
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  /**
   * State synchronization methods for object visibility
   */
  private objectStateBackup = new Map<string, any[]>()
  private lastSyncTime = new Map<string, number>()

  /**
   * Backup object state before potential disconnection
   */
  backupObjectState(canvasId: string, objects: Array<Record<string, unknown>>): void {
    try {
      console.log(`Backing up object state for canvas: ${canvasId} (${objects.length} objects)`)
      this.objectStateBackup.set(canvasId, [...objects])
      this.lastSyncTime.set(canvasId, Date.now())
    } catch (error) {
      console.error('Error backing up object state:', error)
    }
  }

  /**
   * Restore object state after reconnection
   */
  async restoreObjectState(canvasId: string): Promise<any[]> {
    try {
      console.log(`Restoring object state for canvas: ${canvasId}`)
      
      const backup = this.objectStateBackup.get(canvasId)
      if (!backup) {
        console.log('No backup found for canvas:', canvasId)
        return []
      }

      // Check if backup is recent (within 5 minutes)
      const lastSync = this.lastSyncTime.get(canvasId) || 0
      const now = Date.now()
      const backupAge = now - lastSync

      if (backupAge > 5 * 60 * 1000) { // 5 minutes
        console.log('Backup too old, clearing:', backupAge)
        this.objectStateBackup.delete(canvasId)
        this.lastSyncTime.delete(canvasId)
        return []
      }

      console.log(`Restored ${backup.length} objects from backup`)
      return backup
    } catch (error) {
      console.error('Error restoring object state:', error)
      return []
    }
  }

  /**
   * Clear object state backup
   */
  clearObjectStateBackup(canvasId: string): void {
    this.objectStateBackup.delete(canvasId)
    this.lastSyncTime.delete(canvasId)
    console.log(`Cleared object state backup for canvas: ${canvasId}`)
  }

  /**
   * Validate object state consistency
   */
  async validateObjectStateConsistency(canvasId: string, expectedObjects: Array<Record<string, unknown>>): Promise<boolean> {
    try {
      console.log(`Validating object state consistency for canvas: ${canvasId}`)
      
      // Get current objects from server
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      // Compare with expected objects
      const expectedIds = new Set(expectedObjects.map((obj: any) => obj.id as string))
      const serverIds = new Set(serverObjects.map((obj: any) => obj.id as string))
      
      const missingObjects = [...expectedIds].filter(id => !serverIds.has(id))
      const extraObjects = [...serverIds].filter(id => !expectedIds.has(id))
      
      if (missingObjects.length > 0) {
        console.warn(`Missing objects on server: ${missingObjects.join(', ')}`)
      }
      
      if (extraObjects.length > 0) {
        console.warn(`Extra objects on server: ${extraObjects.join(', ')}`)
      }
      
      const isConsistent = missingObjects.length === 0 && extraObjects.length === 0
      console.log(`Object state consistency: ${isConsistent ? 'VALID' : 'INVALID'}`)
      
      return isConsistent
    } catch (error) {
      console.error('Error validating object state consistency:', error)
      return false
    }
  }

  /**
   * Sync object state with server
   */
  async syncObjectState(canvasId: string, localObjects: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    try {
      console.log(`Syncing object state for canvas: ${canvasId}`)
      
      // Get server objects
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      // Create maps for comparison
      const localMap = new Map(localObjects.map((obj: any) => [obj.id as string, obj]))
      const serverMap = new Map(serverObjects.map((obj: any) => [obj.id as string, obj]))
      
      // Find missing objects (on server but not local)
      const missingObjects = serverObjects.filter((obj: any) => !localMap.has(obj.id as string))
      
      // Find outdated objects (different versions)
      const outdatedObjects = localObjects.filter((localObj: any) => {
        const serverObj = serverMap.get(localObj.id as string)
        return serverObj && (serverObj as any).updated_at !== localObj.updated_at
      })
      
      // Merge server objects with local objects
      const syncedObjects = [...localObjects]
      
      // Add missing objects
      missingObjects.forEach((obj: any) => {
        syncedObjects.push(obj)
        console.log(`Added missing object: ${obj.id as string}`)
      })
      
      // Update outdated objects
      outdatedObjects.forEach(localObj => {
        const serverObj = serverMap.get(String(localObj.id))
        if (serverObj) {
        const index = syncedObjects.findIndex((obj: any) => obj.id === String(localObj.id))
        if (index !== -1) {
          syncedObjects[index] = serverObj
          console.log(`Updated outdated object: ${localObj.id}`)
        }
        }
      })
      
      console.log(`Object state sync completed: ${syncedObjects.length} objects`)
      return syncedObjects
      
    } catch (error) {
      console.error('Error syncing object state:', error)
      return localObjects // Return local objects as fallback
    }
  }

  // Connection state management methods
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    return this.connectionState
  }

  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    return this.connectionQuality
  }

  getConnectionAttempts(): number {
    return this.connectionAttempts
  }

  getLastConnectionTime(): number | null {
    return this.lastConnectionTime
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' && this.socket?.connected === true
  }

  isConnecting(): boolean {
    return this.connectionState === 'connecting' || this.connectionState === 'reconnecting'
  }

  getConnectionInfo() {
    return {
      state: this.connectionState,
      quality: this.connectionQuality,
      attempts: this.connectionAttempts,
      lastConnectionTime: this.lastConnectionTime,
      socketId: this.socket?.id,
      connected: this.socket?.connected,
      transport: this.socket?.io?.engine?.transport?.name
    }
  }
}

export const socketService = new SocketService()
