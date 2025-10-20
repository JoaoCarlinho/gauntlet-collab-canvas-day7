/**
 * Real-time Permission Change Handling Service with Event Processing and State Synchronization
 */

import { errorLogger } from '../utils/errorLogger'
import { authService } from './authService'
import { networkTimeoutService } from './networkTimeoutService'

export interface PermissionChange {
  id: string
  canvasId: string
  userId: string
  changeType: 'grant' | 'revoke' | 'modify' | 'transfer_ownership'
  permissionType: 'view' | 'edit' | 'delete' | 'share' | 'admin'
  oldValue: boolean
  newValue: boolean
  timestamp: number
  source: 'user_action' | 'admin_action' | 'system_action' | 'api_call'
  metadata?: Record<string, any>
}

export interface PermissionState {
  canvasId: string
  userId: string
  permissions: {
    canView: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canAdmin: boolean
  }
  lastUpdated: number
  version: number
}

export interface PermissionChangeEvent {
  type: 'permission_changed' | 'permission_revoked' | 'permission_granted' | 'ownership_transferred'
  canvasId: string
  userId: string
  changes: PermissionChange[]
  timestamp: number
  source: string
}

export interface PermissionValidationResult {
  isValid: boolean
  permission: string
  error?: string
  suggestion?: string
  timestamp: number
}

export interface PermissionMetrics {
  totalChanges: number
  successfulChanges: number
  failedChanges: number
  permissionGrants: number
  permissionRevokes: number
  ownershipTransfers: number
  averageProcessingTime: number
  realTimeEventProcessingRate: number
}

class PermissionChangeHandlingService {
  private permissionStates: Map<string, PermissionState> = new Map()
  private changeHistory: Map<string, PermissionChange[]> = new Map()
  private eventListeners: Map<string, Function[]> = new Map()
  private metrics: PermissionMetrics = {
    totalChanges: 0,
    successfulChanges: 0,
    failedChanges: 0,
    permissionGrants: 0,
    permissionRevokes: 0,
    ownershipTransfers: 0,
    averageProcessingTime: 0,
    realTimeEventProcessingRate: 0
  }

  private readonly PERMISSION_KEYS = ['canView', 'canEdit', 'canDelete', 'canShare', 'canAdmin']
  private readonly MAX_CHANGE_HISTORY = 1000
  private readonly PERMISSION_SYNC_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.initializePermissionMonitoring()
  }

  /**
   * Initialize permission monitoring
   */
  private initializePermissionMonitoring(): void {
    // Monitor for permission change events
    this.setupEventListeners()
    
    // Periodic permission state sync
    setInterval(() => {
      this.syncPermissionStates()
    }, this.PERMISSION_SYNC_INTERVAL)
  }

  /**
   * Setup event listeners for permission changes
   */
  private setupEventListeners(): void {
    // Listen for socket events (this would integrate with socket service)
    // For now, we'll simulate the event listening
    
    // Listen for storage events (cross-tab communication)
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith('permission_change_')) {
        this.handleStoragePermissionChange(event)
      }
    })

    // Listen for focus events to sync permissions
    window.addEventListener('focus', () => {
      this.syncPermissionStates()
    })
  }

  /**
   * Handle permission change from storage event
   */
  private handleStoragePermissionChange(event: StorageEvent): void {
    try {
      if (event.newValue) {
        const permissionChange: PermissionChange = JSON.parse(event.newValue)
        this.processPermissionChange(permissionChange)
      }
    } catch (error) {
      console.error('Failed to handle storage permission change:', error)
    }
  }

  /**
   * Process permission change
   */
  public async processPermissionChange(change: PermissionChange): Promise<boolean> {
    const startTime = Date.now()
    this.metrics.totalChanges++

    try {
      // Validate permission change
      const validation = this.validatePermissionChange(change)
      if (!validation.isValid) {
        console.error('Invalid permission change:', validation.error)
        this.metrics.failedChanges++
        return false
      }

      // Update permission state
      await this.updatePermissionState(change)

      // Record change in history
      this.recordPermissionChange(change)

      // Emit permission change event
      this.emitPermissionChangeEvent(change)

      // Update metrics
      this.metrics.successfulChanges++
      this.updateChangeMetrics(change)
      this.updateAverageProcessingTime(Date.now() - startTime)

      console.log(`Permission change processed: ${change.changeType} ${change.permissionType} for user ${change.userId}`)
      return true

    } catch (error) {
      console.error('Failed to process permission change:', error)
      this.metrics.failedChanges++
      this.updateAverageProcessingTime(Date.now() - startTime)
      
      errorLogger.logError('Permission change processing failed', {
        change,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      
      return false
    }
  }

  /**
   * Validate permission change
   */
  private validatePermissionChange(change: PermissionChange): PermissionValidationResult {
    // Validate required fields
    if (!change.canvasId || !change.userId || !change.permissionType) {
      return {
        isValid: false,
        permission: change.permissionType || 'unknown',
        error: 'Missing required fields',
        suggestion: 'Ensure canvasId, userId, and permissionType are provided',
        timestamp: Date.now()
      }
    }

    // Validate permission type
    const validPermissionTypes = ['view', 'edit', 'delete', 'share', 'admin']
    if (!validPermissionTypes.includes(change.permissionType)) {
      return {
        isValid: false,
        permission: change.permissionType,
        error: 'Invalid permission type',
        suggestion: `Permission type must be one of: ${validPermissionTypes.join(', ')}`,
        timestamp: Date.now()
      }
    }

    // Validate change type
    const validChangeTypes = ['grant', 'revoke', 'modify', 'transfer_ownership']
    if (!validChangeTypes.includes(change.changeType)) {
      return {
        isValid: false,
        permission: change.permissionType,
        error: 'Invalid change type',
        suggestion: `Change type must be one of: ${validChangeTypes.join(', ')}`,
        timestamp: Date.now()
      }
    }

    // Validate boolean values
    if (typeof change.oldValue !== 'boolean' || typeof change.newValue !== 'boolean') {
      return {
        isValid: false,
        permission: change.permissionType,
        error: 'Permission values must be boolean',
        suggestion: 'Ensure oldValue and newValue are boolean values',
        timestamp: Date.now()
      }
    }

    return {
      isValid: true,
      permission: change.permissionType,
      timestamp: Date.now()
    }
  }

  /**
   * Update permission state
   */
  private async updatePermissionState(change: PermissionChange): Promise<void> {
    const stateKey = `${change.canvasId}:${change.userId}`
    let permissionState = this.permissionStates.get(stateKey)

    if (!permissionState) {
      // Create new permission state
      permissionState = {
        canvasId: change.canvasId,
        userId: change.userId,
        permissions: {
          canView: false,
          canEdit: false,
          canDelete: false,
          canShare: false,
          canAdmin: false
        },
        lastUpdated: Date.now(),
        version: 1
      }
    }

    // Update the specific permission
    const permissionKey = `can${change.permissionType.charAt(0).toUpperCase() + change.permissionType.slice(1)}`
    if (permissionKey in permissionState.permissions) {
      (permissionState.permissions as any)[permissionKey] = change.newValue
    }

    // Handle ownership transfer
    if (change.changeType === 'transfer_ownership') {
      permissionState.permissions.canAdmin = change.newValue
      permissionState.permissions.canEdit = change.newValue
      permissionState.permissions.canDelete = change.newValue
      permissionState.permissions.canShare = change.newValue
    }

    permissionState.lastUpdated = Date.now()
    permissionState.version++

    this.permissionStates.set(stateKey, permissionState)

    // Persist to localStorage for cross-tab communication
    localStorage.setItem(`permission_state_${stateKey}`, JSON.stringify(permissionState))
  }

  /**
   * Record permission change in history
   */
  private recordPermissionChange(change: PermissionChange): void {
    const historyKey = `${change.canvasId}:${change.userId}`
    const changes = this.changeHistory.get(historyKey) || []
    
    changes.push(change)
    
    // Limit history size
    if (changes.length > this.MAX_CHANGE_HISTORY) {
      changes.splice(0, changes.length - this.MAX_CHANGE_HISTORY)
    }
    
    this.changeHistory.set(historyKey, changes)
  }

  /**
   * Emit permission change event
   */
  private emitPermissionChangeEvent(change: PermissionChange): void {
    const event: PermissionChangeEvent = {
      type: this.getEventType(change),
      canvasId: change.canvasId,
      userId: change.userId,
      changes: [change],
      timestamp: Date.now(),
      source: change.source
    }

    // Emit to registered listeners
    const listeners = this.eventListeners.get(change.canvasId) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Permission change event listener error:', error)
      }
    })

    // Broadcast to other tabs via storage
    localStorage.setItem(`permission_change_${change.id}`, JSON.stringify(change))
    setTimeout(() => {
      localStorage.removeItem(`permission_change_${change.id}`)
    }, 1000)
  }

  /**
   * Get event type from permission change
   */
  private getEventType(change: PermissionChange): PermissionChangeEvent['type'] {
    switch (change.changeType) {
      case 'grant':
        return 'permission_granted'
      case 'revoke':
        return 'permission_revoked'
      case 'transfer_ownership':
        return 'ownership_transferred'
      default:
        return 'permission_changed'
    }
  }

  /**
   * Add event listener for permission changes
   */
  public addEventListener(canvasId: string, listener: (event: PermissionChangeEvent) => void): void {
    const listeners = this.eventListeners.get(canvasId) || []
    listeners.push(listener)
    this.eventListeners.set(canvasId, listeners)
  }

  /**
   * Remove event listener
   */
  public removeEventListener(canvasId: string, listener: (event: PermissionChangeEvent) => void): void {
    const listeners = this.eventListeners.get(canvasId) || []
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
      this.eventListeners.set(canvasId, listeners)
    }
  }

  /**
   * Get current permission state
   */
  public getPermissionState(canvasId: string, userId: string): PermissionState | null {
    const stateKey = `${canvasId}:${userId}`
    return this.permissionStates.get(stateKey) || null
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(canvasId: string, userId: string, permission: string): boolean {
    const state = this.getPermissionState(canvasId, userId)
    if (!state) return false

    const permissionKey = `can${permission.charAt(0).toUpperCase() + permission.slice(1)}`
    return (state.permissions as any)[permissionKey] || false
  }

  /**
   * Get permission change history
   */
  public getPermissionChangeHistory(canvasId: string, userId: string): PermissionChange[] {
    const historyKey = `${canvasId}:${userId}`
    return this.changeHistory.get(historyKey) || []
  }

  /**
   * Sync permission states with server
   */
  private async syncPermissionStates(): Promise<void> {
    try {
      const currentUserId = await authService.getCurrentUserId()
      if (!currentUserId) return

      // Get all permission states for current user
      const userStates = Array.from(this.permissionStates.entries())
        .filter(([key, _]) => key.endsWith(`:${currentUserId}`))

      for (const [stateKey, state] of userStates) {
        try {
          // Fetch latest permissions from server
          const latestState = await this.fetchLatestPermissionState(state.canvasId, currentUserId)
          
          if (latestState && latestState.version > state.version) {
            // Update local state with server state
            this.permissionStates.set(stateKey, latestState)
            
            // Emit sync event
            this.emitPermissionSyncEvent(state.canvasId, currentUserId, latestState)
          }
        } catch (error) {
          console.error(`Failed to sync permissions for canvas ${state.canvasId}:`, error)
        }
      }
    } catch (error) {
      console.error('Permission state sync failed:', error)
    }
  }

  /**
   * Fetch latest permission state from server
   */
  private async fetchLatestPermissionState(canvasId: string, userId: string): Promise<PermissionState | null> {
    try {
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // This would integrate with the actual API service
          // For now, we'll simulate the fetch
          return {
            canvasId,
            userId,
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: false,
              canShare: true,
              canAdmin: false
            },
            lastUpdated: Date.now(),
            version: Date.now()
          }
        },
        5000,
        `permission_sync_${canvasId}_${userId}`
      )

      return result.success ? result.data : null
    } catch (error) {
      console.error('Failed to fetch latest permission state:', error)
      return null
    }
  }

  /**
   * Emit permission sync event
   */
  private emitPermissionSyncEvent(canvasId: string, userId: string, state: PermissionState): void {
    const event: PermissionChangeEvent = {
      type: 'permission_changed',
      canvasId,
      userId,
      changes: [],
      timestamp: Date.now(),
      source: 'system_sync'
    }

    const listeners = this.eventListeners.get(canvasId) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Permission sync event listener error:', error)
      }
    })
  }

  /**
   * Update change metrics
   */
  private updateChangeMetrics(change: PermissionChange): void {
    switch (change.changeType) {
      case 'grant':
        this.metrics.permissionGrants++
        break
      case 'revoke':
        this.metrics.permissionRevokes++
        break
      case 'transfer_ownership':
        this.metrics.ownershipTransfers++
        break
    }
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageProcessingTime = 
      (alpha * processingTime) + ((1 - alpha) * this.metrics.averageProcessingTime)
  }

  /**
   * Get permission metrics
   */
  public getMetrics(): PermissionMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear permission data
   */
  public clearPermissionData(canvasId: string, userId: string): void {
    const stateKey = `${canvasId}:${userId}`
    this.permissionStates.delete(stateKey)
    this.changeHistory.delete(stateKey)
    localStorage.removeItem(`permission_state_${stateKey}`)
  }

  /**
   * Clear all permission data
   */
  public clearAllPermissionData(): void {
    this.permissionStates.clear()
    this.changeHistory.clear()
    this.eventListeners.clear()
    
    // Clear localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('permission_state_') || key?.startsWith('permission_change_')) {
        localStorage.removeItem(key)
      }
    }
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalChanges: 0,
      successfulChanges: 0,
      failedChanges: 0,
      permissionGrants: 0,
      permissionRevokes: 0,
      ownershipTransfers: 0,
      averageProcessingTime: 0,
      realTimeEventProcessingRate: 0
    }
  }
}

// Export singleton instance
export const permissionChangeHandlingService = new PermissionChangeHandlingService()

// Export types and service
export { PermissionChangeHandlingService }
export type { PermissionChange, PermissionState, PermissionChangeEvent, PermissionValidationResult, PermissionMetrics }
