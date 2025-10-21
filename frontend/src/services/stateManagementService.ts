/**
 * Comprehensive State Management Service with Race Condition Prevention
 */

import { CanvasObject } from '../types'
import { errorLogger } from '../utils/errorLogger'
import { unifiedCanvasService } from './unifiedCanvasService'

export interface StateOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'sync'
  data: any
  timestamp: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  retryCount: number
  priority: number
}

export interface StateConflict {
  operationId: string
  conflictType: 'concurrent_update' | 'stale_data' | 'version_mismatch'
  localData: any
  remoteData: any
  resolution: 'local' | 'remote' | 'merge' | 'manual'
  timestamp: number
}

export interface StateMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  conflictsResolved: number
  averageOperationTime: number
  pendingOperations: number
  lastSyncTime: number
}

class StateManagementService {
  private operationQueue: StateOperation[] = []
  private activeOperations = new Map<string, StateOperation>()
  private completedOperations = new Map<string, StateOperation>()
  private stateConflicts: StateConflict[] = []
  private stateMetrics: StateMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    conflictsResolved: 0,
    averageOperationTime: 0,
    pendingOperations: 0,
    lastSyncTime: 0
  }
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null
  private stateVersion = 0
  private lastKnownState: Map<string, CanvasObject> = new Map()

  constructor() {
    this.startOperationProcessor()
  }

  /**
   * Start the operation processor
   */
  private startOperationProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    this.processingInterval = setInterval(() => {
      this.processOperationQueue()
    }, 100) // Process every 100ms
  }

  /**
   * Stop the operation processor
   */
  private stopOperationProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
  }

  /**
   * Process the operation queue
   */
  private async processOperationQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // Sort operations by priority and timestamp
      this.operationQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority // Higher priority first
        }
        return a.timestamp - b.timestamp // Earlier timestamp first
      })

      const operation = this.operationQueue.shift()!
      await this.executeOperation(operation)
    } catch (error) {
      console.error('Error processing operation queue:', error)
      errorLogger.logError(error as Error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: {
          operationType: 'process_operation_queue',
          queueLength: this.operationQueue.length,
          activeOperations: this.activeOperations.size
        }
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: StateOperation): Promise<void> {
    const startTime = Date.now()
    operation.status = 'in_progress'
    this.activeOperations.set(operation.id, operation)

    try {
      switch (operation.type) {
        case 'create':
          await this.executeCreateOperation(operation)
          break
        case 'update':
          await this.executeUpdateOperation(operation)
          break
        case 'delete':
          await this.executeDeleteOperation(operation)
          break
        case 'sync':
          await this.executeSyncOperation(operation)
          break
        default:
          throw new Error(`Unknown operation type: ${operation.type}`)
      }

      operation.status = 'completed'
      this.completedOperations.set(operation.id, operation)
      this.stateMetrics.successfulOperations++
      this.stateMetrics.totalOperations++

      // Update average operation time
      const operationTime = Date.now() - startTime
      const totalTime = this.stateMetrics.averageOperationTime * (this.stateMetrics.successfulOperations - 1) + operationTime
      this.stateMetrics.averageOperationTime = totalTime / this.stateMetrics.successfulOperations

    } catch (error) {
      console.error(`Operation ${operation.id} failed:`, error)
      
      operation.status = 'failed'
      operation.retryCount++
      
      // Retry if retry count is below threshold
      if (operation.retryCount < 3) {
        operation.priority = Math.max(0, operation.priority - 1) // Lower priority for retries
        this.operationQueue.push(operation)
      } else {
        this.completedOperations.set(operation.id, operation)
        this.stateMetrics.failedOperations++
        this.stateMetrics.totalOperations++
      }
    } finally {
      this.activeOperations.delete(operation.id)
      this.updatePendingOperationsCount()
    }
  }

  /**
   * Execute create operation
   */
  private async executeCreateOperation(operation: StateOperation): Promise<any> {
    const { canvasId, object } = operation.data
    
    // Check for conflicts with pending operations
    const conflict = this.checkCreateConflict(canvasId, object)
    if (conflict) {
      await this.resolveConflict(conflict)
    }

    const result = await unifiedCanvasService.createObject(canvasId, object, {
      validateData: true,
      retryOnFailure: true
    })

    if (result.success && result.data) {
      this.lastKnownState.set(result.data.id, result.data)
      this.stateVersion++
    }

    return result
  }

  /**
   * Execute update operation
   */
  private async executeUpdateOperation(operation: StateOperation): Promise<any> {
    const { objectId, properties } = operation.data
    
    // Check for conflicts with pending operations
    const conflict = this.checkUpdateConflict(objectId, properties)
    if (conflict) {
      await this.resolveConflict(conflict)
    }

    const result = await unifiedCanvasService.updateObject(objectId, properties, {
      validateData: true,
      retryOnFailure: true
    })

    if (result.success && result.data) {
      this.lastKnownState.set(result.data.id, result.data)
      this.stateVersion++
    }

    return result
  }

  /**
   * Execute delete operation
   */
  private async executeDeleteOperation(operation: StateOperation): Promise<any> {
    const { objectId } = operation.data
    
    // Check for conflicts with pending operations
    const conflict = this.checkDeleteConflict(objectId)
    if (conflict) {
      await this.resolveConflict(conflict)
    }

    const result = await unifiedCanvasService.deleteObject(objectId, {
      retryOnFailure: true
    })

    if (result.success) {
      this.lastKnownState.delete(objectId)
      this.stateVersion++
    }

    return result
  }

  /**
   * Execute sync operation
   */
  private async executeSyncOperation(operation: StateOperation): Promise<any> {
    const { canvasId } = operation.data
    
    const result = await unifiedCanvasService.getCanvasObjects(canvasId, {
      retryOnFailure: true
    })

    if (result.success && result.data) {
      // Update last known state
      this.lastKnownState.clear()
      result.data.forEach(obj => {
        this.lastKnownState.set(obj.id, obj)
      })
      this.stateVersion++
      this.stateMetrics.lastSyncTime = Date.now()
    }

    return result
  }

  /**
   * Check for create conflicts
   */
  private checkCreateConflict(canvasId: string, object: any): StateConflict | null {
    // Check if there are pending operations that might conflict
    const pendingOperations = this.operationQueue.filter(op => 
      op.type === 'create' && 
      op.data.canvasId === canvasId &&
      op.status === 'pending'
    )

    if (pendingOperations.length > 0) {
      return {
        operationId: pendingOperations[0].id,
        conflictType: 'concurrent_update',
        localData: object,
        remoteData: null,
        resolution: 'merge',
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Check for update conflicts
   */
  private checkUpdateConflict(objectId: string, properties: any): StateConflict | null {
    // Check if there are pending operations for the same object
    const pendingOperations = this.operationQueue.filter(op => 
      (op.type === 'update' || op.type === 'delete') && 
      op.data.objectId === objectId &&
      op.status === 'pending'
    )

    if (pendingOperations.length > 0) {
      const lastKnown = this.lastKnownState.get(objectId)
      return {
        operationId: pendingOperations[0].id,
        conflictType: 'concurrent_update',
        localData: properties,
        remoteData: lastKnown?.properties,
        resolution: 'merge',
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Check for delete conflicts
   */
  private checkDeleteConflict(objectId: string): StateConflict | null {
    // Check if there are pending operations for the same object
    const pendingOperations = this.operationQueue.filter(op => 
      (op.type === 'update' || op.type === 'create') && 
      op.data.objectId === objectId &&
      op.status === 'pending'
    )

    if (pendingOperations.length > 0) {
      const lastKnown = this.lastKnownState.get(objectId)
      return {
        operationId: pendingOperations[0].id,
        conflictType: 'concurrent_update',
        localData: null,
        remoteData: lastKnown,
        resolution: 'manual',
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Resolve state conflict
   */
  private async resolveConflict(conflict: StateConflict): Promise<void> {
    console.log('Resolving state conflict:', conflict)
    
    this.stateConflicts.push(conflict)
    this.stateMetrics.conflictsResolved++

    switch (conflict.resolution) {
      case 'local':
        // Use local data
        break
      case 'remote':
        // Use remote data
        break
      case 'merge':
        // Merge local and remote data
        await this.mergeData(conflict)
        break
      case 'manual':
        // Require manual resolution
        this.emitConflictEvent(conflict)
        break
    }
  }

  /**
   * Merge conflicting data
   */
  private async mergeData(conflict: StateConflict): Promise<void> {
    // Simple merge strategy - prefer non-null values
    if (conflict.localData && conflict.remoteData) {
      const mergedData = { ...conflict.remoteData, ...conflict.localData }
      
      // Update the operation with merged data
      const operation = this.operationQueue.find(op => op.id === conflict.operationId)
      if (operation) {
        operation.data = { ...operation.data, ...mergedData }
      }
    }
  }

  /**
   * Emit conflict event for manual resolution
   */
  private emitConflictEvent(conflict: StateConflict): void {
    // Emit custom event for UI to handle
    const event = new CustomEvent('stateConflict', {
      detail: conflict
    })
    window.dispatchEvent(event)
  }

  /**
   * Queue create operation
   */
  public queueCreateOperation(canvasId: string, object: any, priority: number = 5): string {
    const operationId = `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const operation: StateOperation = {
      id: operationId,
      type: 'create',
      data: { canvasId, object },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      priority
    }

    this.operationQueue.push(operation)
    this.updatePendingOperationsCount()
    
    return operationId
  }

  /**
   * Queue update operation
   */
  public queueUpdateOperation(objectId: string, properties: any, priority: number = 5): string {
    const operationId = `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const operation: StateOperation = {
      id: operationId,
      type: 'update',
      data: { objectId, properties },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      priority
    }

    this.operationQueue.push(operation)
    this.updatePendingOperationsCount()
    
    return operationId
  }

  /**
   * Queue delete operation
   */
  public queueDeleteOperation(objectId: string, priority: number = 5): string {
    const operationId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const operation: StateOperation = {
      id: operationId,
      type: 'delete',
      data: { objectId },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      priority
    }

    this.operationQueue.push(operation)
    this.updatePendingOperationsCount()
    
    return operationId
  }

  /**
   * Queue sync operation
   */
  public queueSyncOperation(canvasId: string, priority: number = 10): string {
    const operationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const operation: StateOperation = {
      id: operationId,
      type: 'sync',
      data: { canvasId },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      priority
    }

    this.operationQueue.push(operation)
    this.updatePendingOperationsCount()
    
    return operationId
  }

  /**
   * Get operation status
   */
  public getOperationStatus(operationId: string): StateOperation | null {
    return this.activeOperations.get(operationId) || 
           this.completedOperations.get(operationId) || 
           this.operationQueue.find(op => op.id === operationId) || 
           null
  }

  /**
   * Cancel operation
   */
  public cancelOperation(operationId: string): boolean {
    // Remove from queue
    const queueIndex = this.operationQueue.findIndex(op => op.id === operationId)
    if (queueIndex !== -1) {
      this.operationQueue.splice(queueIndex, 1)
      this.updatePendingOperationsCount()
      return true
    }

    // Mark active operation as cancelled
    const activeOperation = this.activeOperations.get(operationId)
    if (activeOperation) {
      activeOperation.status = 'failed'
      this.activeOperations.delete(operationId)
      this.completedOperations.set(operationId, activeOperation)
      return true
    }

    return false
  }

  /**
   * Update pending operations count
   */
  private updatePendingOperationsCount(): void {
    this.stateMetrics.pendingOperations = this.operationQueue.length + this.activeOperations.size
  }

  /**
   * Get state metrics
   */
  public getStateMetrics(): StateMetrics {
    return { ...this.stateMetrics }
  }

  /**
   * Get state conflicts
   */
  public getStateConflicts(): StateConflict[] {
    return [...this.stateConflicts]
  }

  /**
   * Clear resolved conflicts
   */
  public clearResolvedConflicts(): void {
    this.stateConflicts = this.stateConflicts.filter(conflict => 
      conflict.resolution === 'manual'
    )
  }

  /**
   * Get current state version
   */
  public getStateVersion(): number {
    return this.stateVersion
  }

  /**
   * Get last known state
   */
  public getLastKnownState(): Map<string, CanvasObject> {
    return new Map(this.lastKnownState)
  }

  /**
   * Reset state
   */
  public resetState(): void {
    this.operationQueue = []
    this.activeOperations.clear()
    this.completedOperations.clear()
    this.stateConflicts = []
    this.stateVersion = 0
    this.lastKnownState.clear()
    this.updatePendingOperationsCount()
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopOperationProcessor()
    this.resetState()
  }
}

// Export singleton instance
export const stateManagementService = new StateManagementService()

// Export service
export { StateManagementService }
