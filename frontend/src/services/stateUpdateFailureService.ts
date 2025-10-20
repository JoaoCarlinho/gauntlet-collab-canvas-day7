/**
 * State Update Failure Handling Service with Conflict Resolution and Recovery
 */

import { errorLogger } from '../utils/errorLogger'
import { networkTimeoutService } from './networkTimeoutService'

export interface StateUpdate {
  id: string
  type: 'create' | 'update' | 'delete' | 'move' | 'resize'
  objectId: string
  canvasId: string
  userId: string
  data: any
  timestamp: number
  version: number
  optimistic: boolean
  metadata?: Record<string, any>
}

export interface StateConflict {
  updateId: string
  conflictingUpdateId: string
  conflictType: 'version' | 'concurrent' | 'optimistic' | 'data'
  resolution: 'server_wins' | 'client_wins' | 'merge' | 'manual'
  resolved: boolean
  timestamp: number
}

export interface StateUpdateResult {
  success: boolean
  updateId: string
  error?: string
  conflict?: StateConflict
  resolvedData?: any
  timestamp: number
}

export interface StateRecoveryStrategy {
  name: string
  description: string
  canApply: (update: StateUpdate, error: string) => boolean
  execute: (update: StateUpdate, error: string) => Promise<StateUpdateResult>
  priority: number
}

export interface StateMetrics {
  totalUpdates: number
  successfulUpdates: number
  failedUpdates: number
  conflictedUpdates: number
  averageUpdateTime: number
  conflictResolutionRate: number
  optimisticUpdateSuccessRate: number
}

class StateUpdateFailureService {
  private updateHistory: Map<string, StateUpdate> = new Map()
  private conflictHistory: Map<string, StateConflict> = new Map()
  private pendingUpdates: Map<string, StateUpdate> = new Map()
  private recoveryStrategies: StateRecoveryStrategy[] = []
  
  private metrics: StateMetrics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    conflictedUpdates: 0,
    averageUpdateTime: 0,
    conflictResolutionRate: 0,
    optimisticUpdateSuccessRate: 0
  }

  private readonly MAX_UPDATE_HISTORY = 1000
  private readonly CONFLICT_RESOLUTION_TIMEOUT = 5000
  private readonly OPTIMISTIC_UPDATE_TIMEOUT = 3000

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'version_conflict_resolution',
        description: 'Resolve version conflicts by updating to latest version',
        canApply: (update, error) => error.includes('version') || error.includes('conflict'),
        execute: async (update, error) => this.resolveVersionConflict(update, error),
        priority: 1
      },
      {
        name: 'optimistic_update_rollback',
        description: 'Rollback optimistic update and retry with server state',
        canApply: (update, error) => update.optimistic && (error.includes('conflict') || error.includes('version')),
        execute: async (update, error) => this.rollbackOptimisticUpdate(update, error),
        priority: 2
      },
      {
        name: 'concurrent_update_merge',
        description: 'Merge concurrent updates intelligently',
        canApply: (update, error) => error.includes('concurrent') || error.includes('merge'),
        execute: async (update, error) => this.mergeConcurrentUpdates(update, error),
        priority: 3
      },
      {
        name: 'data_validation_retry',
        description: 'Retry update with validated data',
        canApply: (update, error) => error.includes('validation') || error.includes('invalid'),
        execute: async (update, error) => this.retryWithValidatedData(update, error),
        priority: 4
      },
      {
        name: 'server_state_sync',
        description: 'Sync with server state and retry',
        canApply: (update, error) => error.includes('sync') || error.includes('state'),
        execute: async (update, error) => this.syncWithServerState(update, error),
        priority: 5
      },
      {
        name: 'user_notification',
        description: 'Notify user of state update failure',
        canApply: (update, error) => true, // Always available as fallback
        execute: async (update, error) => this.notifyUserOfFailure(update, error),
        priority: 6
      }
    ]

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Record state update
   */
  public recordStateUpdate(update: StateUpdate): void {
    this.updateHistory.set(update.id, update)
    this.pendingUpdates.set(update.id, update)
    this.metrics.totalUpdates++
    
    // Clean up old history
    if (this.updateHistory.size > this.MAX_UPDATE_HISTORY) {
      const oldestUpdate = Array.from(this.updateHistory.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0]
      this.updateHistory.delete(oldestUpdate.id)
    }
  }

  /**
   * Handle state update success
   */
  public handleUpdateSuccess(updateId: string, resolvedData?: any): void {
    const update = this.pendingUpdates.get(updateId)
    if (update) {
      this.pendingUpdates.delete(updateId)
      this.metrics.successfulUpdates++
      
      if (update.optimistic) {
        this.updateOptimisticSuccessRate(true)
      }
      
      // Update average update time
      this.updateAverageUpdateTime(Date.now() - update.timestamp)
      
      console.log(`State update succeeded: ${updateId}`)
    }
  }

  /**
   * Handle state update failure
   */
  public async handleUpdateFailure(
    updateId: string, 
    error: string, 
    conflictData?: any
  ): Promise<StateUpdateResult> {
    const update = this.pendingUpdates.get(updateId)
    if (!update) {
      return {
        success: false,
        updateId,
        error: 'Update not found',
        timestamp: Date.now()
      }
    }

    this.metrics.failedUpdates++
    
    if (update.optimistic) {
      this.updateOptimisticSuccessRate(false)
    }

    // Check for conflicts
    if (conflictData) {
      const conflict = await this.handleStateConflict(update, conflictData)
      if (conflict) {
        this.metrics.conflictedUpdates++
        return {
          success: false,
          updateId,
          error,
          conflict,
          timestamp: Date.now()
        }
      }
    }

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(update, error)
    
    if (recoveryResult.success) {
      this.pendingUpdates.delete(updateId)
      this.metrics.successfulUpdates++
    }

    return recoveryResult
  }

  /**
   * Handle state conflict
   */
  private async handleStateConflict(update: StateUpdate, conflictData: any): Promise<StateConflict | null> {
    try {
      const conflictId = `conflict_${update.id}_${Date.now()}`
      
      const conflict: StateConflict = {
        updateId: update.id,
        conflictingUpdateId: conflictData.conflictingUpdateId || 'unknown',
        conflictType: this.determineConflictType(conflictData),
        resolution: 'manual', // Default to manual resolution
        resolved: false,
        timestamp: Date.now()
      }

      this.conflictHistory.set(conflictId, conflict)
      
      // Attempt automatic resolution
      const resolutionResult = await this.attemptConflictResolution(conflict, update, conflictData)
      
      if (resolutionResult.success) {
        conflict.resolved = true
        conflict.resolution = resolutionResult.resolution || 'server_wins'
        this.metrics.conflictResolutionRate = 
          (this.metrics.conflictResolutionRate * (this.metrics.conflictedUpdates - 1) + 1) / this.metrics.conflictedUpdates
      }

      return conflict

    } catch (error) {
      console.error('Failed to handle state conflict:', error)
      return null
    }
  }

  /**
   * Attempt conflict resolution
   */
  private async attemptConflictResolution(
    conflict: StateConflict,
    update: StateUpdate,
    conflictData: any
  ): Promise<{ success: boolean; resolution?: string }> {
    try {
      switch (conflict.conflictType) {
        case 'version':
          return await this.resolveVersionConflict(update, conflictData.error)
        
        case 'concurrent':
          return await this.resolveConcurrentConflict(update, conflictData)
        
        case 'optimistic':
          return await this.resolveOptimisticConflict(update, conflictData)
        
        case 'data':
          return await this.resolveDataConflict(update, conflictData)
        
        default:
          return { success: false }
      }
    } catch (error) {
      console.error('Conflict resolution failed:', error)
      return { success: false }
    }
  }

  /**
   * Attempt recovery from update failure
   */
  private async attemptRecovery(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.canApply(update, error)
    )

    for (const strategy of applicableStrategies) {
      try {
        console.log(`Attempting recovery strategy: ${strategy.name}`)
        
        const result = await networkTimeoutService.executeWithTimeout(
          () => strategy.execute(update, error),
          this.CONFLICT_RESOLUTION_TIMEOUT,
          `state_recovery_${strategy.name}`
        )

        if (result.success && result.data) {
          const recoveryResult = result.data as StateUpdateResult
          if (recoveryResult.success) {
            console.log(`Recovery strategy ${strategy.name} succeeded`)
            return recoveryResult
          }
        }

        console.log(`Recovery strategy ${strategy.name} failed: ${result.error}`)

      } catch (error) {
        console.error(`Recovery strategy ${strategy.name} threw error:`, error)
        errorLogger.logError('State recovery strategy error', {
          strategy: strategy.name,
          updateId: update.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // All strategies failed
    return {
      success: false,
      updateId: update.id,
      error: 'All recovery strategies failed',
      timestamp: Date.now()
    }
  }

  /**
   * Resolve version conflict
   */
  private async resolveVersionConflict(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // Fetch latest version from server
      const latestData = await this.fetchLatestObjectData(update.objectId, update.canvasId)
      
      if (latestData) {
        // Update the update with latest version
        const updatedUpdate = {
          ...update,
          data: { ...update.data, ...latestData },
          version: latestData.version || update.version + 1
        }

        return {
          success: true,
          updateId: update.id,
          resolvedData: updatedUpdate.data,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        updateId: update.id,
        error: 'Failed to fetch latest version',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Version conflict resolution failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Rollback optimistic update
   */
  private async rollbackOptimisticUpdate(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // Fetch current server state
      const serverData = await this.fetchLatestObjectData(update.objectId, update.canvasId)
      
      if (serverData) {
        // Notify UI to rollback optimistic changes
        this.notifyOptimisticRollback(update, serverData)
        
        return {
          success: true,
          updateId: update.id,
          resolvedData: serverData,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        updateId: update.id,
        error: 'Failed to fetch server state for rollback',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Optimistic rollback failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Merge concurrent updates
   */
  private async mergeConcurrentUpdates(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // This would implement intelligent merging logic
      // For now, we'll use a simple server-wins approach
      
      const serverData = await this.fetchLatestObjectData(update.objectId, update.canvasId)
      
      if (serverData) {
        return {
          success: true,
          updateId: update.id,
          resolvedData: serverData,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        updateId: update.id,
        error: 'Failed to merge concurrent updates',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Concurrent update merge failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Retry with validated data
   */
  private async retryWithValidatedData(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // Validate and clean the data
      const validatedData = this.validateAndCleanData(update.data)
      
      if (validatedData) {
        const retryUpdate = {
          ...update,
          data: validatedData,
          retryCount: (update.metadata?.retryCount || 0) + 1
        }

        return {
          success: true,
          updateId: update.id,
          resolvedData: validatedData,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        updateId: update.id,
        error: 'Data validation failed',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Data validation retry failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Sync with server state
   */
  private async syncWithServerState(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // Fetch complete server state
      const serverState = await this.fetchLatestObjectData(update.objectId, update.canvasId)
      
      if (serverState) {
        // Update local state to match server
        this.notifyStateSync(update, serverState)
        
        return {
          success: true,
          updateId: update.id,
          resolvedData: serverState,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        updateId: update.id,
        error: 'Failed to sync with server state',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Server state sync failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Notify user of failure
   */
  private async notifyUserOfFailure(update: StateUpdate, error: string): Promise<StateUpdateResult> {
    try {
      // This would integrate with user notification service
      console.log(`Notifying user of state update failure: ${update.type} on object ${update.objectId}`)
      
      return {
        success: false,
        updateId: update.id,
        error: `State update failed: ${error}. Please try again.`,
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        updateId: update.id,
        error: error instanceof Error ? error.message : 'User notification failed',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Determine conflict type
   */
  private determineConflictType(conflictData: any): 'version' | 'concurrent' | 'optimistic' | 'data' {
    if (conflictData.versionConflict) return 'version'
    if (conflictData.concurrentUpdate) return 'concurrent'
    if (conflictData.optimisticConflict) return 'optimistic'
    if (conflictData.dataConflict) return 'data'
    return 'version' // Default
  }

  /**
   * Fetch latest object data from server
   */
  private async fetchLatestObjectData(objectId: string, canvasId: string): Promise<any> {
    try {
      // This would integrate with the actual API service
      // For now, we'll simulate the fetch
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            id: objectId,
            canvas_id: canvasId,
            version: Date.now(),
            // ... other object data
          })
        }, 100)
      })
    } catch (error) {
      console.error('Failed to fetch latest object data:', error)
      return null
    }
  }

  /**
   * Validate and clean data
   */
  private validateAndCleanData(data: any): any {
    try {
      // Implement data validation logic
      // For now, we'll return the data as-is
      return data
    } catch (error) {
      console.error('Data validation failed:', error)
      return null
    }
  }

  /**
   * Notify optimistic rollback
   */
  private notifyOptimisticRollback(update: StateUpdate, serverData: any): void {
    // This would integrate with the UI state management
    console.log(`Optimistic rollback for update ${update.id}:`, serverData)
  }

  /**
   * Notify state sync
   */
  private notifyStateSync(update: StateUpdate, serverData: any): void {
    // This would integrate with the UI state management
    console.log(`State sync for update ${update.id}:`, serverData)
  }

  /**
   * Update optimistic success rate
   */
  private updateOptimisticSuccessRate(success: boolean): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.optimisticUpdateSuccessRate = 
      (alpha * (success ? 1 : 0)) + ((1 - alpha) * this.metrics.optimisticUpdateSuccessRate)
  }

  /**
   * Update average update time
   */
  private updateAverageUpdateTime(updateTime: number): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageUpdateTime = 
      (alpha * updateTime) + ((1 - alpha) * this.metrics.averageUpdateTime)
  }

  /**
   * Get state metrics
   */
  public getMetrics(): StateMetrics {
    return { ...this.metrics }
  }

  /**
   * Get update history
   */
  public getUpdateHistory(): Map<string, StateUpdate> {
    return new Map(this.updateHistory)
  }

  /**
   * Get conflict history
   */
  public getConflictHistory(): Map<string, StateConflict> {
    return new Map(this.conflictHistory)
  }

  /**
   * Get pending updates
   */
  public getPendingUpdates(): Map<string, StateUpdate> {
    return new Map(this.pendingUpdates)
  }

  /**
   * Clear all data
   */
  public clearAll(): void {
    this.updateHistory.clear()
    this.conflictHistory.clear()
    this.pendingUpdates.clear()
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      conflictedUpdates: 0,
      averageUpdateTime: 0,
      conflictResolutionRate: 0,
      optimisticUpdateSuccessRate: 0
    }
  }
}

// Export singleton instance
export const stateUpdateFailureService = new StateUpdateFailureService()

// Export types and service
export { StateUpdateFailureService }
export type { StateUpdate, StateConflict, StateUpdateResult, StateRecoveryStrategy, StateMetrics }
