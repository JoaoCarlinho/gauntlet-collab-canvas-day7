export interface EventHandlerConflict {
  type: 'duplicate_listener' | 'conflicting_listener' | 'orphaned_listener' | 'memory_leak'
  severity: 'low' | 'medium' | 'high' | 'critical'
  element: string
  eventType: string
  message: string
  resolution: string
  timestamp: number
}

export interface EventHandlerInfo {
  element: string
  eventType: string
  handler: Function
  isActive: boolean
  addedAt: number
  lastUsed: number
}

export interface ConflictResolutionResult {
  success: boolean
  conflict: EventHandlerConflict | null
  resolution: string
  handlersRemoved: number
  handlersAdded: number
}

export class EventHandlerConflictResolutionService {
  private registeredHandlers: Map<string, EventHandlerInfo[]> = new Map()
  private conflictHistory: EventHandlerConflict[] = []
  private maxHistorySize = 100
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  /**
   * Start monitoring event handler conflicts
   */
  startMonitoring(intervalMs = 10000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.detectConflicts()
    }, intervalMs)

    console.log('Event handler conflict monitoring started')
  }

  /**
   * Stop monitoring event handler conflicts
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('Event handler conflict monitoring stopped')
  }

  /**
   * Register an event handler
   */
  registerHandler(
    element: string,
    eventType: string,
    handler: Function
  ): void {
    const key = `${element}:${eventType}`
    const handlerInfo: EventHandlerInfo = {
      element,
      eventType,
      handler,
      isActive: true,
      addedAt: Date.now(),
      lastUsed: Date.now()
    }

    if (!this.registeredHandlers.has(key)) {
      this.registeredHandlers.set(key, [])
    }

    const handlers = this.registeredHandlers.get(key)!
    handlers.push(handlerInfo)

    console.log(`Registered event handler: ${key}`)
  }

  /**
   * Unregister an event handler
   */
  unregisterHandler(
    element: string,
    eventType: string,
    handler: Function
  ): boolean {
    const key = `${element}:${eventType}`
    const handlers = this.registeredHandlers.get(key)

    if (!handlers) {
      return false
    }

    const index = handlers.findIndex(h => h.handler === handler)
    if (index === -1) {
      return false
    }

    handlers.splice(index, 1)
    
    if (handlers.length === 0) {
      this.registeredHandlers.delete(key)
    }

    console.log(`Unregistered event handler: ${key}`)
    return true
  }

  /**
   * Detect event handler conflicts
   */
  detectConflicts(): EventHandlerConflict[] {
    const conflicts: EventHandlerConflict[] = []

    for (const [key, handlers] of this.registeredHandlers.entries()) {
      const [element, eventType] = key.split(':')

      // Check for duplicate listeners
      if (handlers.length > 1) {
        conflicts.push({
          type: 'duplicate_listener',
          severity: 'medium',
          element,
          eventType,
          message: `Multiple handlers registered for ${key}`,
          resolution: 'Remove duplicate handlers',
          timestamp: Date.now()
        })
      }

      // Check for conflicting listeners
      const conflictingHandlers = this.findConflictingHandlers(handlers)
      if (conflictingHandlers.length > 0) {
        conflicts.push({
          type: 'conflicting_listener',
          severity: 'high',
          element,
          eventType,
          message: `Conflicting handlers detected for ${key}`,
          resolution: 'Resolve handler conflicts',
          timestamp: Date.now()
        })
      }

      // Check for orphaned listeners
      const orphanedHandlers = handlers.filter(h => !h.isActive)
      if (orphanedHandlers.length > 0) {
        conflicts.push({
          type: 'orphaned_listener',
          severity: 'low',
          element,
          eventType,
          message: `${orphanedHandlers.length} orphaned handlers for ${key}`,
          resolution: 'Remove orphaned handlers',
          timestamp: Date.now()
        })
      }

      // Check for memory leaks
      const oldHandlers = handlers.filter(h => Date.now() - h.addedAt > 300000) // 5 minutes
      if (oldHandlers.length > 0) {
        conflicts.push({
          type: 'memory_leak',
          severity: 'medium',
          element,
          eventType,
          message: `${oldHandlers.length} old handlers for ${key}`,
          resolution: 'Clean up old handlers',
          timestamp: Date.now()
        })
      }
    }

    // Record conflicts
    conflicts.forEach(conflict => {
      this.recordConflict(conflict)
    })

    return conflicts
  }

  /**
   * Resolve event handler conflicts
   */
  resolveConflicts(conflicts: EventHandlerConflict[]): ConflictResolutionResult {
    let handlersRemoved = 0
    let handlersAdded = 0
    const resolutions: string[] = []

    for (const conflict of conflicts) {
      const result = this.resolveConflict(conflict)
      if (result.success) {
        handlersRemoved += result.handlersRemoved
        handlersAdded += result.handlersAdded
        resolutions.push(result.resolution)
      }
    }

    return {
      success: resolutions.length > 0,
      conflict: conflicts[0] || null,
      resolution: resolutions.join('; '),
      handlersRemoved,
      handlersAdded
    }
  }

  /**
   * Resolve a specific conflict
   */
  private resolveConflict(conflict: EventHandlerConflict): ConflictResolutionResult {
    const key = `${conflict.element}:${conflict.eventType}`
    const handlers = this.registeredHandlers.get(key)

    if (!handlers) {
      return {
        success: false,
        conflict,
        resolution: 'No handlers found',
        handlersRemoved: 0,
        handlersAdded: 0
      }
    }

    let handlersRemoved = 0
    let handlersAdded = 0

    switch (conflict.type) {
      case 'duplicate_listener':
        // Keep only the most recent handler
        const mostRecent = handlers.reduce((latest, current) => 
          current.addedAt > latest.addedAt ? current : latest
        )
        const duplicates = handlers.filter(h => h !== mostRecent)
        duplicates.forEach(duplicate => {
          this.unregisterHandler(conflict.element, conflict.eventType, duplicate.handler)
          handlersRemoved++
        })
        break

      case 'conflicting_listener':
        // Remove conflicting handlers
        const conflictingHandlers = this.findConflictingHandlers(handlers)
        conflictingHandlers.forEach(conflicting => {
          this.unregisterHandler(conflict.element, conflict.eventType, conflicting.handler)
          handlersRemoved++
        })
        break

      case 'orphaned_listener':
        // Remove orphaned handlers
        const orphanedHandlers = handlers.filter(h => !h.isActive)
        orphanedHandlers.forEach(orphaned => {
          this.unregisterHandler(conflict.element, conflict.eventType, orphaned.handler)
          handlersRemoved++
        })
        break

      case 'memory_leak':
        // Remove old handlers
        const oldHandlers = handlers.filter(h => Date.now() - h.addedAt > 300000)
        oldHandlers.forEach(old => {
          this.unregisterHandler(conflict.element, conflict.eventType, old.handler)
          handlersRemoved++
        })
        break
    }

    return {
      success: true,
      conflict,
      resolution: `Resolved ${conflict.type} for ${key}`,
      handlersRemoved,
      handlersAdded
    }
  }

  /**
   * Find conflicting handlers
   */
  private findConflictingHandlers(handlers: EventHandlerInfo[]): EventHandlerInfo[] {
    const conflicting: EventHandlerInfo[] = []

    for (let i = 0; i < handlers.length; i++) {
      for (let j = i + 1; j < handlers.length; j++) {
        if (this.areHandlersConflicting(handlers[i], handlers[j])) {
          conflicting.push(handlers[i], handlers[j])
        }
      }
    }

    return conflicting
  }

  /**
   * Check if two handlers are conflicting
   */
  private areHandlersConflicting(handler1: EventHandlerInfo, handler2: EventHandlerInfo): boolean {
    // This is a simplified conflict detection
    // In a real implementation, you'd need more sophisticated analysis
    const handler1Str = handler1.handler.toString()
    const handler2Str = handler2.handler.toString()

    // Check for similar functionality
    if (handler1Str.length > 50 && handler2Str.length > 50) {
      const similarity = this.calculateSimilarity(handler1Str, handler2Str)
      return similarity > 0.8 // 80% similarity threshold
    }

    return false
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) {
      return 1.0
    }

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Clean up all event handlers
   */
  cleanupAllHandlers(): ConflictResolutionResult {
    let handlersRemoved = 0
    const resolutions: string[] = []

    for (const [key, handlers] of this.registeredHandlers.entries()) {
      const [element, eventType] = key.split(':')
      
      handlers.forEach(handler => {
        this.unregisterHandler(element, eventType, handler.handler)
        handlersRemoved++
      })

      resolutions.push(`Cleaned up ${handlers.length} handlers for ${key}`)
    }

    this.registeredHandlers.clear()

    return {
      success: true,
      conflict: null,
      resolution: resolutions.join('; '),
      handlersRemoved,
      handlersAdded: 0
    }
  }

  /**
   * Get handler statistics
   */
  getHandlerStatistics(): {
    totalHandlers: number
    handlersByElement: Record<string, number>
    handlersByEvent: Record<string, number>
    conflictsByType: Record<string, number>
    conflictsBySeverity: Record<string, number>
  } {
    const handlersByElement: Record<string, number> = {}
    const handlersByEvent: Record<string, number> = {}
    let totalHandlers = 0

    for (const [key, handlers] of this.registeredHandlers.entries()) {
      const [element, eventType] = key.split(':')
      
      handlersByElement[element] = (handlersByElement[element] || 0) + handlers.length
      handlersByEvent[eventType] = (handlersByEvent[eventType] || 0) + handlers.length
      totalHandlers += handlers.length
    }

    const conflictsByType: Record<string, number> = {}
    const conflictsBySeverity: Record<string, number> = {}

    for (const conflict of this.conflictHistory) {
      conflictsByType[conflict.type] = (conflictsByType[conflict.type] || 0) + 1
      conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1
    }

    return {
      totalHandlers,
      handlersByElement,
      handlersByEvent,
      conflictsByType,
      conflictsBySeverity
    }
  }

  /**
   * Record conflict for analysis
   */
  private recordConflict(conflict: EventHandlerConflict): void {
    this.conflictHistory.push(conflict)
    
    if (this.conflictHistory.length > this.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): EventHandlerInfo[] {
    const allHandlers: EventHandlerInfo[] = []
    
    for (const handlers of this.registeredHandlers.values()) {
      allHandlers.push(...handlers)
    }

    return allHandlers
  }

  /**
   * Get handlers for a specific element and event
   */
  getHandlers(element: string, eventType: string): EventHandlerInfo[] {
    const key = `${element}:${eventType}`
    return this.registeredHandlers.get(key) || []
  }

  /**
   * Check if a handler is registered
   */
  isHandlerRegistered(element: string, eventType: string, handler: Function): boolean {
    const handlers = this.getHandlers(element, eventType)
    return handlers.some(h => h.handler === handler)
  }

  /**
   * Update handler usage timestamp
   */
  updateHandlerUsage(element: string, eventType: string, handler: Function): void {
    const handlers = this.getHandlers(element, eventType)
    const handlerInfo = handlers.find(h => h.handler === handler)
    
    if (handlerInfo) {
      handlerInfo.lastUsed = Date.now()
    }
  }
}

// Export singleton instance
export const eventHandlerConflictResolutionService = new EventHandlerConflictResolutionService()
