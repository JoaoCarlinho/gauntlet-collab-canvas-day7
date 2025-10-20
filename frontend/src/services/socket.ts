import { io, Socket } from 'socket.io-client'
import { CursorData } from '../types'
import { errorLogger, ErrorContext } from '../utils/errorLogger'
import { socketEventOptimizer } from '../utils/socketOptimizer'
import { socketIOClientOptimizer } from '../utils/socketioClientOptimizer'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Function[]> = new Map()
  private debugMode = import.meta.env.VITE_DEBUG_SOCKET === 'true'
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected'
  private connectionAttempts = 0
  private lastConnectionTime: number | null = null
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown' = 'unknown'

  connect(idToken?: string) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    // Update connection state
    this.connectionState = 'connecting'
    this.connectionAttempts++
    
    // Check if we're in development mode
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_DEBUG_MODE === 'true' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1'
    
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
    
    // Add additional configuration
    const enhancedConfig: any = {
      ...socketConfig,
      forceNew: isDevelopment, // Only force new in development
    }
    
    // Only add auth token if not in development mode
    if (!isDevelopment && idToken) {
      enhancedConfig.auth = {
        token: idToken
      }
    } else if (isDevelopment) {
      console.log('Development mode: Connecting without authentication')
    }
    
    this.socket = io(API_URL, enhancedConfig)

    this.socket.on('connect', () => {
      this.connectionState = 'connected'
      this.connectionAttempts = 0
      this.lastConnectionTime = Date.now()
      this.connectionQuality = 'excellent' // Reset quality on successful connection
      
      if (this.debugMode) {
        console.log('=== Socket.IO Connected Successfully ===')
        console.log('Socket ID:', this.socket?.id)
        console.log('Connection state:', this.connectionState)
        console.log('Connection attempts:', this.connectionAttempts)
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
      
      const context: ErrorContext = {
        operation: 'socket_connection',
        timestamp: Date.now(),
        additionalData: { 
          type: 'connection_error', 
          socketId: this.socket?.id,
          errorMessage: error.message,
          connectionAttempts: this.connectionAttempts
        }
      }
      
      const errorId = errorLogger.logError(error, context)
      this.emit('socket_error', { 
        error, 
        timestamp: Date.now(), 
        type: 'connection_error', 
        errorId,
        connectionState: this.connectionState,
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

  createObject(canvasId: string, idToken: string, object: { type: string; properties: Record<string, any> }) {
    // Enhanced authentication context validation
    this.validateAuthContext(canvasId, idToken)
    
    if (this.socket) {
      // Enhanced data with additional context
      const enhancedData = this.ensureAuthContext({
        canvas_id: canvasId,
        id_token: idToken,
        object
      })
      
      this.socket.emit('object_created', enhancedData)
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
    this.listeners.get(event)!.push(callback)
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

  private emit(event: string, data: any) {
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
  optimizeEmit(event: string, data: any, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
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
  updateOptimizationConfig(config: any) {
    socketEventOptimizer.updateConfig(config)
  }

  // Authentication context validation and enhancement
  private validateAuthContext(canvasId: string, idToken: string): void {
    if (!canvasId || !idToken) {
      throw new Error('Missing authentication context: canvasId or idToken')
    }
    
    // Additional validation
    if (canvasId.length < 10) {
      throw new Error('Invalid canvas ID format')
    }
    
    if (idToken.length < 100) {
      throw new Error('Invalid authentication token format')
    }
  }

  private ensureAuthContext(data: any): any {
    const user = this.getCurrentUser()
    const canvasId = data.canvas_id
    
    if (!user || !user.idToken) {
      throw new Error('User not authenticated')
    }
    
    if (!canvasId) {
      throw new Error('Canvas ID not available')
    }
    
    return {
      ...data,
      canvas_id: canvasId,
      user_id: user.id,
      id_token: user.idToken,
      user_email: user.email,
      timestamp: Date.now()
    }
  }

  private getCurrentUser(): any {
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
  backupObjectState(canvasId: string, objects: any[]): void {
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
  async validateObjectStateConsistency(canvasId: string, expectedObjects: any[]): Promise<boolean> {
    try {
      console.log(`Validating object state consistency for canvas: ${canvasId}`)
      
      // Get current objects from server
      const { canvasAPI } = await import('./api')
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      // Compare with expected objects
      const expectedIds = new Set(expectedObjects.map((obj: any) => obj.id))
      const serverIds = new Set(serverObjects.map((obj: any) => obj.id))
      
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
  async syncObjectState(canvasId: string, localObjects: any[]): Promise<any[]> {
    try {
      console.log(`Syncing object state for canvas: ${canvasId}`)
      
      // Get server objects
      const { canvasAPI } = await import('./api')
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      // Create maps for comparison
      const localMap = new Map(localObjects.map((obj: any) => [obj.id, obj]))
      const serverMap = new Map(serverObjects.map((obj: any) => [obj.id, obj]))
      
      // Find missing objects (on server but not local)
      const missingObjects = serverObjects.filter((obj: any) => !localMap.has(obj.id))
      
      // Find outdated objects (different versions)
      const outdatedObjects = localObjects.filter((localObj: any) => {
        const serverObj = serverMap.get(localObj.id)
        return serverObj && (serverObj as any).updated_at !== localObj.updated_at
      })
      
      // Merge server objects with local objects
      const syncedObjects = [...localObjects]
      
      // Add missing objects
      missingObjects.forEach((obj: any) => {
        syncedObjects.push(obj)
        console.log(`Added missing object: ${obj.id}`)
      })
      
      // Update outdated objects
      outdatedObjects.forEach(localObj => {
        const serverObj = serverMap.get(localObj.id)
        if (serverObj) {
          const index = syncedObjects.findIndex(obj => obj.id === localObj.id)
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
