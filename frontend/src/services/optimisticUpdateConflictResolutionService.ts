import { CanvasObject } from '../types'

export interface OptimisticUpdate {
  id: string
  type: 'create' | 'update' | 'delete' | 'move' | 'resize'
  objectId: string
  object: CanvasObject | null
  originalObject?: CanvasObject
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed' | 'conflicted'
  retryCount: number
  maxRetries: number
}

export interface UpdateConflict {
  type: 'version_mismatch' | 'concurrent_edit' | 'state_drift' | 'server_rejection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  optimisticUpdate: OptimisticUpdate
  serverObject: CanvasObject | null
  message: string
  resolution: string
  timestamp: number
}

export interface ConflictResolutionResult {
  success: boolean
  conflict: UpdateConflict | null
  resolution: string
  finalObject: CanvasObject | null
  actions: string[]
}

export interface UpdateQueue {
  pending: OptimisticUpdate[]
  confirmed: OptimisticUpdate[]
  failed: OptimisticUpdate[]
  conflicted: OptimisticUpdate[]
}

export class OptimisticUpdateConflictResolutionService {
  private updateQueue: UpdateQueue = {
    pending: [],
    confirmed: [],
    failed: [],
    conflicted: []
  }
  private conflictHistory: UpdateConflict[] = []
  private maxHistorySize = 100
  private maxRetries = 3
  private conflictResolutionTimeout = 5000 // 5 seconds

  /**
   * Add an optimistic update to the queue
   */
  addOptimisticUpdate(
    type: OptimisticUpdate['type'],
    objectId: string,
    object: CanvasObject | null,
    originalObject?: CanvasObject
  ): string {
    const updateId = this.generateUpdateId()
    const update: OptimisticUpdate = {
      id: updateId,
      type,
      objectId,
      object,
      originalObject,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.maxRetries
    }

    this.updateQueue.pending.push(update)
    console.log(`Added optimistic update: ${updateId} for ${objectId}`)

    return updateId
  }

  /**
   * Process server confirmation for an update
   */
  processServerConfirmation(
    updateId: string,
    serverObject: CanvasObject | null,
    success: boolean
  ): ConflictResolutionResult {
    const update = this.findUpdateById(updateId)
    if (!update) {
      return {
        success: false,
        conflict: null,
        resolution: 'Update not found',
        finalObject: null,
        actions: ['Update not found in queue']
      }
    }

    if (success) {
      return this.handleSuccessfulConfirmation(update, serverObject)
    } else {
      return this.handleFailedConfirmation(update, serverObject)
    }
  }

  /**
   * Detect conflicts between optimistic updates and server state
   */
  detectConflicts(
    optimisticObject: CanvasObject,
    serverObject: CanvasObject
  ): UpdateConflict[] {
    const conflicts: UpdateConflict[] = []

    // Check for version mismatch
    if (optimisticObject.version !== serverObject.version) {
      conflicts.push({
        type: 'version_mismatch',
        severity: 'high',
        optimisticUpdate: this.findUpdateByObjectId(optimisticObject.id),
        serverObject,
        message: `Version mismatch: optimistic=${optimisticObject.version}, server=${serverObject.version}`,
        resolution: 'Merge changes or use server version',
        timestamp: Date.now()
      })
    }

    // Check for concurrent edits
    if (this.hasConcurrentEdits(optimisticObject, serverObject)) {
      conflicts.push({
        type: 'concurrent_edit',
        severity: 'medium',
        optimisticUpdate: this.findUpdateByObjectId(optimisticObject.id),
        serverObject,
        message: 'Concurrent edits detected',
        resolution: 'Merge concurrent changes',
        timestamp: Date.now()
      })
    }

    // Check for state drift
    if (this.hasStateDrift(optimisticObject, serverObject)) {
      conflicts.push({
        type: 'state_drift',
        severity: 'medium',
        optimisticUpdate: this.findUpdateByObjectId(optimisticObject.id),
        serverObject,
        message: 'Significant state drift detected',
        resolution: 'Reconcile state differences',
        timestamp: Date.now()
      })
    }

    return conflicts
  }

  /**
   * Resolve update conflicts
   */
  resolveConflicts(conflicts: UpdateConflict[]): ConflictResolutionResult[] {
    const results: ConflictResolutionResult[] = []

    for (const conflict of conflicts) {
      const result = this.resolveConflict(conflict)
      results.push(result)
      
      if (result.success) {
        this.recordConflict(conflict)
      }
    }

    return results
  }

  /**
   * Resolve a specific conflict
   */
  private resolveConflict(conflict: UpdateConflict): ConflictResolutionResult {
    const actions: string[] = []

    switch (conflict.type) {
      case 'version_mismatch':
        return this.resolveVersionMismatch(conflict, actions)
      
      case 'concurrent_edit':
        return this.resolveConcurrentEdit(conflict, actions)
      
      case 'state_drift':
        return this.resolveStateDrift(conflict, actions)
      
      case 'server_rejection':
        return this.resolveServerRejection(conflict, actions)
      
      default:
        return {
          success: false,
          conflict,
          resolution: 'Unknown conflict type',
          finalObject: null,
          actions: ['Unknown conflict type']
        }
    }
  }

  /**
   * Resolve version mismatch conflict
   */
  private resolveVersionMismatch(
    conflict: UpdateConflict,
    actions: string[]
  ): ConflictResolutionResult {
    const optimisticUpdate = conflict.optimisticUpdate
    const serverObject = conflict.serverObject

    if (!optimisticUpdate || !serverObject) {
      return {
        success: false,
        conflict,
        resolution: 'Missing update or server object',
        finalObject: null,
        actions: ['Missing required data']
      }
    }

    // Strategy: Use server version if it's newer, otherwise merge
    if (serverObject.version > optimisticUpdate.object!.version) {
      // Server version is newer, use it
      this.moveUpdateToConfirmed(optimisticUpdate.id)
      actions.push('Used server version (newer)')
      
      return {
        success: true,
        conflict,
        resolution: 'Used server version due to newer version',
        finalObject: serverObject,
        actions
      }
    } else {
      // Try to merge changes
      const mergedObject = this.mergeObjects(optimisticUpdate.object!, serverObject)
      if (mergedObject) {
        this.moveUpdateToConfirmed(optimisticUpdate.id)
        actions.push('Merged optimistic and server changes')
        
        return {
          success: true,
          conflict,
          resolution: 'Successfully merged changes',
          finalObject: mergedObject,
          actions
        }
      } else {
        // Merge failed, use server version
        this.moveUpdateToFailed(optimisticUpdate.id)
        actions.push('Merge failed, used server version')
        
        return {
          success: true,
          conflict,
          resolution: 'Merge failed, used server version',
          finalObject: serverObject,
          actions
        }
      }
    }
  }

  /**
   * Resolve concurrent edit conflict
   */
  private resolveConcurrentEdit(
    conflict: UpdateConflict,
    actions: string[]
  ): ConflictResolutionResult {
    const optimisticUpdate = conflict.optimisticUpdate
    const serverObject = conflict.serverObject

    if (!optimisticUpdate || !serverObject) {
      return {
        success: false,
        conflict,
        resolution: 'Missing update or server object',
        finalObject: null,
        actions: ['Missing required data']
      }
    }

    // Strategy: Merge concurrent changes
    const mergedObject = this.mergeConcurrentChanges(optimisticUpdate.object!, serverObject)
    if (mergedObject) {
      this.moveUpdateToConfirmed(optimisticUpdate.id)
      actions.push('Merged concurrent changes')
      
      return {
        success: true,
        conflict,
        resolution: 'Successfully merged concurrent changes',
        finalObject: mergedObject,
        actions
      }
    } else {
      // Merge failed, use server version
      this.moveUpdateToFailed(optimisticUpdate.id)
      actions.push('Concurrent merge failed, used server version')
      
      return {
        success: true,
        conflict,
        resolution: 'Concurrent merge failed, used server version',
        finalObject: serverObject,
        actions
      }
    }
  }

  /**
   * Resolve state drift conflict
   */
  private resolveStateDrift(
    conflict: UpdateConflict,
    actions: string[]
  ): ConflictResolutionResult {
    const optimisticUpdate = conflict.optimisticUpdate
    const serverObject = conflict.serverObject

    if (!optimisticUpdate || !serverObject) {
      return {
        success: false,
        conflict,
        resolution: 'Missing update or server object',
        finalObject: null,
        actions: ['Missing required data']
      }
    }

    // Strategy: Use server state for significant drift
    this.moveUpdateToFailed(optimisticUpdate.id)
    actions.push('Used server state due to significant drift')
    
    return {
      success: true,
      conflict,
      resolution: 'Used server state due to significant drift',
      finalObject: serverObject,
      actions
    }
  }

  /**
   * Resolve server rejection conflict
   */
  private resolveServerRejection(
    conflict: UpdateConflict,
    actions: string[]
  ): ConflictResolutionResult {
    const optimisticUpdate = conflict.optimisticUpdate

    if (!optimisticUpdate) {
      return {
        success: false,
        conflict,
        resolution: 'Missing update',
        finalObject: null,
        actions: ['Missing update data']
      }
    }

    // Strategy: Retry or use original state
    if (optimisticUpdate.retryCount < optimisticUpdate.maxRetries) {
      optimisticUpdate.retryCount++
      actions.push(`Retrying update (attempt ${optimisticUpdate.retryCount})`)
      
      return {
        success: true,
        conflict,
        resolution: `Retrying update (attempt ${optimisticUpdate.retryCount})`,
        finalObject: optimisticUpdate.object,
        actions
      }
    } else {
      // Max retries reached, use original state
      this.moveUpdateToFailed(optimisticUpdate.id)
      actions.push('Max retries reached, using original state')
      
      return {
        success: true,
        conflict,
        resolution: 'Max retries reached, using original state',
        finalObject: optimisticUpdate.originalObject || null,
        actions
      }
    }
  }

  /**
   * Handle successful server confirmation
   */
  private handleSuccessfulConfirmation(
    update: OptimisticUpdate,
    serverObject: CanvasObject | null
  ): ConflictResolutionResult {
    this.moveUpdateToConfirmed(update.id)
    
    return {
      success: true,
      conflict: null,
      resolution: 'Update confirmed by server',
      finalObject: serverObject || update.object,
      actions: ['Update confirmed by server']
    }
  }

  /**
   * Handle failed server confirmation
   */
  private handleFailedConfirmation(
    update: OptimisticUpdate,
    serverObject: CanvasObject | null
  ): ConflictResolutionResult {
    // Check for conflicts
    if (update.object && serverObject) {
      const conflicts = this.detectConflicts(update.object, serverObject)
      if (conflicts.length > 0) {
        this.moveUpdateToConflicted(update.id)
        const conflict = conflicts[0]
        
        return {
          success: false,
          conflict,
          resolution: 'Conflicts detected, resolution required',
          finalObject: null,
          actions: ['Conflicts detected']
        }
      }
    }

    // No conflicts, just failed
    this.moveUpdateToFailed(update.id)
    
    return {
      success: true,
      conflict: null,
      resolution: 'Update failed, using original state',
      finalObject: update.originalObject || null,
      actions: ['Update failed, using original state']
    }
  }

  /**
   * Merge two objects
   */
  private mergeObjects(optimistic: CanvasObject, server: CanvasObject): CanvasObject | null {
    try {
      // Simple merge strategy: use optimistic for user changes, server for system changes
      const merged: CanvasObject = {
        ...server,
        ...optimistic,
        version: Math.max(optimistic.version, server.version) + 1,
        updated_at: new Date().toISOString()
      }

      return merged
    } catch (error) {
      console.error('Failed to merge objects:', error)
      return null
    }
  }

  /**
   * Merge concurrent changes
   */
  private mergeConcurrentChanges(optimistic: CanvasObject, server: CanvasObject): CanvasObject | null {
    try {
      // More sophisticated merge for concurrent changes
      const merged: CanvasObject = {
        ...server,
        properties: {
          ...server.properties,
          ...optimistic.properties
        },
        version: Math.max(optimistic.version, server.version) + 1,
        updated_at: new Date().toISOString()
      }

      return merged
    } catch (error) {
      console.error('Failed to merge concurrent changes:', error)
      return null
    }
  }

  /**
   * Check for concurrent edits
   */
  private hasConcurrentEdits(optimistic: CanvasObject, server: CanvasObject): boolean {
    // Check if both objects have been modified recently
    const optimisticTime = new Date(optimistic.updated_at).getTime()
    const serverTime = new Date(server.updated_at).getTime()
    const timeDiff = Math.abs(optimisticTime - serverTime)
    
    // Consider concurrent if modified within 5 seconds
    return timeDiff < 5000
  }

  /**
   * Check for state drift
   */
  private hasStateDrift(optimistic: CanvasObject, server: CanvasObject): boolean {
    // Check for significant differences in properties
    const optimisticProps = optimistic.properties
    const serverProps = server.properties
    
    // Check position drift
    const positionDiff = Math.abs(optimisticProps.x - serverProps.x) + 
                        Math.abs(optimisticProps.y - serverProps.y)
    
    // Check size drift
    const sizeDiff = Math.abs((optimisticProps.width || 0) - (serverProps.width || 0)) +
                    Math.abs((optimisticProps.height || 0) - (serverProps.height || 0))
    
    // Consider significant drift if position or size differs by more than 100 pixels
    return positionDiff > 100 || sizeDiff > 100
  }

  /**
   * Move update to confirmed queue
   */
  private moveUpdateToConfirmed(updateId: string): void {
    const update = this.findUpdateById(updateId)
    if (update) {
      update.status = 'confirmed'
      this.updateQueue.confirmed.push(update)
      this.removeFromPending(updateId)
    }
  }

  /**
   * Move update to failed queue
   */
  private moveUpdateToFailed(updateId: string): void {
    const update = this.findUpdateById(updateId)
    if (update) {
      update.status = 'failed'
      this.updateQueue.failed.push(update)
      this.removeFromPending(updateId)
    }
  }

  /**
   * Move update to conflicted queue
   */
  private moveUpdateToConflicted(updateId: string): void {
    const update = this.findUpdateById(updateId)
    if (update) {
      update.status = 'conflicted'
      this.updateQueue.conflicted.push(update)
      this.removeFromPending(updateId)
    }
  }

  /**
   * Remove update from pending queue
   */
  private removeFromPending(updateId: string): void {
    this.updateQueue.pending = this.updateQueue.pending.filter(u => u.id !== updateId)
  }

  /**
   * Find update by ID
   */
  private findUpdateById(updateId: string): OptimisticUpdate | null {
    const allUpdates = [
      ...this.updateQueue.pending,
      ...this.updateQueue.confirmed,
      ...this.updateQueue.failed,
      ...this.updateQueue.conflicted
    ]
    
    return allUpdates.find(u => u.id === updateId) || null
  }

  /**
   * Find update by object ID
   */
  private findUpdateByObjectId(objectId: string): OptimisticUpdate | null {
    const allUpdates = [
      ...this.updateQueue.pending,
      ...this.updateQueue.confirmed,
      ...this.updateQueue.failed,
      ...this.updateQueue.conflicted
    ]
    
    return allUpdates.find(u => u.objectId === objectId) || null
  }

  /**
   * Generate unique update ID
   */
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Record conflict for analysis
   */
  private recordConflict(conflict: UpdateConflict): void {
    this.conflictHistory.push(conflict)
    
    if (this.conflictHistory.length > this.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get update queue statistics
   */
  getUpdateQueueStatistics(): {
    totalUpdates: number
    pendingUpdates: number
    confirmedUpdates: number
    failedUpdates: number
    conflictedUpdates: number
    conflictsByType: Record<string, number>
    conflictsBySeverity: Record<string, number>
  } {
    const totalUpdates = this.updateQueue.pending.length + 
                        this.updateQueue.confirmed.length + 
                        this.updateQueue.failed.length + 
                        this.updateQueue.conflicted.length

    const conflictsByType: Record<string, number> = {}
    const conflictsBySeverity: Record<string, number> = {}

    for (const conflict of this.conflictHistory) {
      conflictsByType[conflict.type] = (conflictsByType[conflict.type] || 0) + 1
      conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1
    }

    return {
      totalUpdates,
      pendingUpdates: this.updateQueue.pending.length,
      confirmedUpdates: this.updateQueue.confirmed.length,
      failedUpdates: this.updateQueue.failed.length,
      conflictedUpdates: this.updateQueue.conflicted.length,
      conflictsByType,
      conflictsBySeverity
    }
  }

  /**
   * Get current update queue
   */
  getUpdateQueue(): UpdateQueue {
    return { ...this.updateQueue }
  }

  /**
   * Clear completed updates
   */
  clearCompletedUpdates(): void {
    this.updateQueue.confirmed = []
    this.updateQueue.failed = []
    this.updateQueue.conflicted = []
  }

  /**
   * Retry failed updates
   */
  retryFailedUpdates(): void {
    const failedUpdates = [...this.updateQueue.failed]
    this.updateQueue.failed = []
    
    for (const update of failedUpdates) {
      update.status = 'pending'
      update.retryCount = 0
      this.updateQueue.pending.push(update)
    }
  }
}

// Export singleton instance
export const optimisticUpdateConflictResolutionService = new OptimisticUpdateConflictResolutionService()
