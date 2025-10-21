/**
 * Z-Index Calculation Service with Intelligent Layering and Conflict Resolution
 */

import { errorLogger } from '../utils/errorLogger'

export interface ZIndexLayer {
  id: string
  zIndex: number
  objectId: string
  canvasId: string
  userId: string
  timestamp: number
  isLocked: boolean
  metadata?: Record<string, any>
}

export interface ZIndexCalculationResult {
  success: boolean
  zIndex: number
  conflicts: ZIndexConflict[]
  warnings: string[]
  metadata?: Record<string, any>
}

export interface ZIndexConflict {
  objectId: string
  currentZIndex: number
  requestedZIndex: number
  conflictType: 'overlap' | 'boundary' | 'locked'
  resolution: 'auto_increment' | 'swap' | 'reject' | 'manual'
  resolved: boolean
}

export interface ZIndexStrategy {
  name: string
  description: string
  calculate: (context: ZIndexCalculationContext) => number
  priority: number
}

export interface ZIndexCalculationContext {
  objectId: string
  canvasId: string
  userId: string
  requestedZIndex?: number
  operation: 'create' | 'update' | 'move' | 'bring_to_front' | 'send_to_back' | 'bring_forward' | 'send_backward'
  existingLayers: ZIndexLayer[]
  constraints?: {
    minZIndex?: number
    maxZIndex?: number
    avoidConflicts?: boolean
    respectLocks?: boolean
  }
}

export interface ZIndexMetrics {
  totalCalculations: number
  successfulCalculations: number
  failedCalculations: number
  conflictsResolved: number
  averageCalculationTime: number
  mostUsedStrategies: Array<{ strategy: string; count: number }>
  conflictTypes: Array<{ type: string; count: number }>
}

class ZIndexCalculationService {
  private layers: Map<string, ZIndexLayer> = new Map()
  private strategies: ZIndexStrategy[] = []
  private metrics: ZIndexMetrics = {
    totalCalculations: 0,
    successfulCalculations: 0,
    failedCalculations: 0,
    conflictsResolved: 0,
    averageCalculationTime: 0,
    mostUsedStrategies: [],
    conflictTypes: []
  }

  private readonly DEFAULT_MIN_Z_INDEX = 0
  private readonly DEFAULT_MAX_Z_INDEX = 1000000
  private readonly Z_INDEX_INCREMENT = 1
  private readonly MAX_CONFLICT_RESOLUTION_ATTEMPTS = 10

  constructor() {
    this.initializeStrategies()
  }

  /**
   * Initialize z-index calculation strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'sequential',
        description: 'Assign sequential z-index values starting from 1',
        calculate: (context) => this.calculateSequentialZIndex(context),
        priority: 1
      },
      {
        name: 'requested',
        description: 'Use the requested z-index if no conflicts',
        calculate: (context) => this.calculateRequestedZIndex(context),
        priority: 2
      },
      {
        name: 'auto_increment',
        description: 'Auto-increment from the highest existing z-index',
        calculate: (context) => this.calculateAutoIncrementZIndex(context),
        priority: 3
      },
      {
        name: 'conflict_resolution',
        description: 'Resolve conflicts by adjusting existing layers',
        calculate: (context) => this.calculateConflictResolutionZIndex(context),
        priority: 4
      },
      {
        name: 'relative_positioning',
        description: 'Calculate relative to other objects (bring to front, etc.)',
        calculate: (context) => this.calculateRelativePositioningZIndex(context),
        priority: 5
      }
    ]

    // Sort strategies by priority
    this.strategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Calculate z-index for an object
   */
  public async calculateZIndex(context: ZIndexCalculationContext): Promise<ZIndexCalculationResult> {
    const startTime = Date.now()
    this.metrics.totalCalculations++

    try {
      // Validate context
      const validation = this.validateContext(context)
      if (!validation.isValid) {
        return {
          success: false,
          zIndex: 0,
          conflicts: [],
          warnings: [validation.error || 'Invalid context'],
          metadata: { validationError: validation.error }
        }
      }

      // Get existing layers for the canvas
      const existingLayers = this.getLayersForCanvas(context.canvasId)
      context.existingLayers = existingLayers

      // Find appropriate strategy
      const strategy = this.findAppropriateStrategy(context)
      if (!strategy) {
        return {
          success: false,
          zIndex: 0,
          conflicts: [],
          warnings: ['No suitable z-index calculation strategy found'],
          metadata: { strategyError: 'No strategy found' }
        }
      }

      // Calculate z-index using the strategy
      const zIndex = strategy.calculate(context)

      // Check for conflicts
      const conflicts = this.detectConflicts(zIndex, context)
      
      // Resolve conflicts if any
      let resolvedZIndex = zIndex
      let resolvedConflicts: ZIndexConflict[] = []
      
      if (conflicts.length > 0) {
        const resolutionResult = await this.resolveConflicts(conflicts, context)
        resolvedZIndex = resolutionResult.zIndex
        resolvedConflicts = resolutionResult.conflicts
        this.metrics.conflictsResolved += resolvedConflicts.filter(c => c.resolved).length
      }

      // Validate final z-index
      const finalValidation = this.validateZIndex(resolvedZIndex, context)
      if (!finalValidation.isValid) {
        return {
          success: false,
          zIndex: 0,
          conflicts: resolvedConflicts,
          warnings: [finalValidation.error || 'Invalid z-index'],
          metadata: { 
            strategy: strategy.name,
            calculationTime: Date.now() - startTime,
            validationError: finalValidation.error
          }
        }
      }

      // Record the layer
      this.recordLayer({
        id: `${context.objectId}_${Date.now()}`,
        zIndex: resolvedZIndex,
        objectId: context.objectId,
        canvasId: context.canvasId,
        userId: context.userId,
        timestamp: Date.now(),
        isLocked: false,
        metadata: { strategy: strategy.name }
      })

      // Update metrics
      this.metrics.successfulCalculations++
      this.updateAverageCalculationTime(Date.now() - startTime)
      this.updateStrategyUsage(strategy.name)

      return {
        success: true,
        zIndex: resolvedZIndex,
        conflicts: resolvedConflicts,
        warnings: [],
        metadata: {
          strategy: strategy.name,
          calculationTime: Date.now() - startTime,
          conflictsDetected: conflicts.length,
          conflictsResolved: resolvedConflicts.filter(c => c.resolved).length
        }
      }

    } catch (error) {
      console.error('Z-index calculation failed:', error)
      this.metrics.failedCalculations++
      this.updateAverageCalculationTime(Date.now() - startTime)

      errorLogger.logError('Z-index calculation failed', {
        operation: 'general',
        additionalData: { context, error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      })

      return {
        success: false,
        zIndex: 0,
        conflicts: [],
        warnings: [error instanceof Error ? error.message : 'Z-index calculation failed'],
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          calculationTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Validate calculation context
   */
  private validateContext(context: ZIndexCalculationContext): { isValid: boolean; error?: string } {
    if (!context.objectId || !context.canvasId || !context.userId) {
      return { isValid: false, error: 'Missing required context fields' }
    }

    if (!context.operation) {
      return { isValid: false, error: 'Operation type is required' }
    }

    const validOperations = ['create', 'update', 'move', 'bring_to_front', 'send_to_back', 'bring_forward', 'send_backward']
    if (!validOperations.includes(context.operation)) {
      return { isValid: false, error: `Invalid operation: ${context.operation}` }
    }

    return { isValid: true }
  }

  /**
   * Find appropriate strategy for the context
   */
  private findAppropriateStrategy(context: ZIndexCalculationContext): ZIndexStrategy | null {
    // For relative positioning operations, use relative positioning strategy
    if (['bring_to_front', 'send_to_back', 'bring_forward', 'send_backward'].includes(context.operation)) {
      return this.strategies.find(s => s.name === 'relative_positioning') || null
    }

    // For create operations, prefer sequential or auto-increment
    if (context.operation === 'create') {
      return this.strategies.find(s => s.name === 'sequential') || 
             this.strategies.find(s => s.name === 'auto_increment') || null
    }

    // For update operations, try requested first, then conflict resolution
    if (context.operation === 'update' && context.requestedZIndex !== undefined) {
      return this.strategies.find(s => s.name === 'requested') || 
             this.strategies.find(s => s.name === 'conflict_resolution') || null
    }

    // Default to auto-increment
    return this.strategies.find(s => s.name === 'auto_increment') || null
  }

  /**
   * Calculate sequential z-index
   */
  private calculateSequentialZIndex(context: ZIndexCalculationContext): number {
    const existingLayers = context.existingLayers
    if (existingLayers.length === 0) {
      return 1
    }

    // Find the highest z-index and add 1
    const maxZIndex = Math.max(...existingLayers.map(layer => layer.zIndex))
    return maxZIndex + this.Z_INDEX_INCREMENT
  }

  /**
   * Calculate requested z-index
   */
  private calculateRequestedZIndex(context: ZIndexCalculationContext): number {
    if (context.requestedZIndex === undefined) {
      return this.calculateAutoIncrementZIndex(context)
    }

    const constraints = context.constraints || {}
    const minZIndex = constraints.minZIndex || this.DEFAULT_MIN_Z_INDEX
    const maxZIndex = constraints.maxZIndex || this.DEFAULT_MAX_Z_INDEX

    // Clamp to valid range
    return Math.max(minZIndex, Math.min(maxZIndex, context.requestedZIndex))
  }

  /**
   * Calculate auto-increment z-index
   */
  private calculateAutoIncrementZIndex(context: ZIndexCalculationContext): number {
    const existingLayers = context.existingLayers
    if (existingLayers.length === 0) {
      return 1
    }

    // Find the highest z-index and add increment
    const maxZIndex = Math.max(...existingLayers.map(layer => layer.zIndex))
    return maxZIndex + this.Z_INDEX_INCREMENT
  }

  /**
   * Calculate conflict resolution z-index
   */
  private calculateConflictResolutionZIndex(context: ZIndexCalculationContext): number {
    if (context.requestedZIndex === undefined) {
      return this.calculateAutoIncrementZIndex(context)
    }

    const requestedZIndex = context.requestedZIndex
    const existingLayers = context.existingLayers

    // Check if requested z-index conflicts with existing layers
    const conflictingLayers = existingLayers.filter(layer => 
      layer.zIndex === requestedZIndex && 
      (!context.constraints?.respectLocks || !layer.isLocked)
    )

    if (conflictingLayers.length === 0) {
      return requestedZIndex
    }

    // Find the next available z-index
    let nextZIndex = requestedZIndex + 1
    while (existingLayers.some(layer => layer.zIndex === nextZIndex)) {
      nextZIndex++
    }

    return nextZIndex
  }

  /**
   * Calculate relative positioning z-index
   */
  private calculateRelativePositioningZIndex(context: ZIndexCalculationContext): number {
    const existingLayers = context.existingLayers
    const currentLayer = existingLayers.find(layer => layer.objectId === context.objectId)

    if (!currentLayer) {
      // Object doesn't exist yet, use create logic
      return this.calculateAutoIncrementZIndex(context)
    }

    const currentZIndex = currentLayer.zIndex
    const sortedLayers = existingLayers
      .filter(layer => layer.objectId !== context.objectId)
      .sort((a, b) => a.zIndex - b.zIndex)

    switch (context.operation) {
      case 'bring_to_front':
        return sortedLayers.length > 0 ? 
          Math.max(...sortedLayers.map(layer => layer.zIndex)) + 1 : 
          currentZIndex + 1

      case 'send_to_back':
        return sortedLayers.length > 0 ? 
          Math.min(...sortedLayers.map(layer => layer.zIndex)) - 1 : 
          Math.max(1, currentZIndex - 1)

      case 'bring_forward':
        const nextLayer = sortedLayers.find(layer => layer.zIndex > currentZIndex)
        return nextLayer ? nextLayer.zIndex + 1 : currentZIndex + 1

      case 'send_backward':
        const prevLayer = sortedLayers.reverse().find(layer => layer.zIndex < currentZIndex)
        return prevLayer ? Math.max(1, prevLayer.zIndex - 1) : Math.max(1, currentZIndex - 1)

      default:
        return currentZIndex
    }
  }

  /**
   * Detect z-index conflicts
   */
  private detectConflicts(zIndex: number, context: ZIndexCalculationContext): ZIndexConflict[] {
    const conflicts: ZIndexConflict[] = []
    const existingLayers = context.existingLayers

    for (const layer of existingLayers) {
      if (layer.zIndex === zIndex && layer.objectId !== context.objectId) {
        const conflict: ZIndexConflict = {
          objectId: layer.objectId,
          currentZIndex: layer.zIndex,
          requestedZIndex: zIndex,
          conflictType: layer.isLocked ? 'locked' : 'overlap',
          resolution: layer.isLocked ? 'reject' : 'auto_increment',
          resolved: false
        }
        conflicts.push(conflict)
      }
    }

    return conflicts
  }

  /**
   * Resolve z-index conflicts
   */
  private async resolveConflicts(
    conflicts: ZIndexConflict[], 
    context: ZIndexCalculationContext
  ): Promise<{ zIndex: number; conflicts: ZIndexConflict[] }> {
    let resolvedZIndex = context.requestedZIndex || 0
    const resolvedConflicts: ZIndexConflict[] = []

    for (const conflict of conflicts) {
      if (conflict.conflictType === 'locked') {
        // Cannot resolve locked conflicts, reject the request
        conflict.resolution = 'reject'
        conflict.resolved = false
        resolvedConflicts.push(conflict)
        continue
      }

      // Try to resolve the conflict
      let attempts = 0
      while (attempts < this.MAX_CONFLICT_RESOLUTION_ATTEMPTS) {
        resolvedZIndex++
        
        // Check if this z-index is available
        const hasConflict = context.existingLayers.some(layer => 
          layer.zIndex === resolvedZIndex && layer.objectId !== context.objectId
        )

        if (!hasConflict) {
          conflict.resolution = 'auto_increment'
          conflict.resolved = true
          resolvedConflicts.push(conflict)
          break
        }

        attempts++
      }

      if (attempts >= this.MAX_CONFLICT_RESOLUTION_ATTEMPTS) {
        conflict.resolution = 'manual'
        conflict.resolved = false
        resolvedConflicts.push(conflict)
      }
    }

    return { zIndex: resolvedZIndex, conflicts: resolvedConflicts }
  }

  /**
   * Validate z-index value
   */
  private validateZIndex(zIndex: number, context: ZIndexCalculationContext): { isValid: boolean; error?: string } {
    const constraints = context.constraints || {}
    const minZIndex = constraints.minZIndex || this.DEFAULT_MIN_Z_INDEX
    const maxZIndex = constraints.maxZIndex || this.DEFAULT_MAX_Z_INDEX

    if (zIndex < minZIndex) {
      return { isValid: false, error: `Z-index ${zIndex} is below minimum ${minZIndex}` }
    }

    if (zIndex > maxZIndex) {
      return { isValid: false, error: `Z-index ${zIndex} is above maximum ${maxZIndex}` }
    }

    if (!Number.isInteger(zIndex)) {
      return { isValid: false, error: 'Z-index must be an integer' }
    }

    return { isValid: true }
  }

  /**
   * Get layers for a canvas
   */
  private getLayersForCanvas(canvasId: string): ZIndexLayer[] {
    return Array.from(this.layers.values())
      .filter(layer => layer.canvasId === canvasId)
      .sort((a, b) => a.zIndex - b.zIndex)
  }

  /**
   * Record a z-index layer
   */
  private recordLayer(layer: ZIndexLayer): void {
    this.layers.set(layer.id, layer)
  }

  /**
   * Update average calculation time
   */
  private updateAverageCalculationTime(calculationTime: number): void {
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageCalculationTime = 
      (alpha * calculationTime) + ((1 - alpha) * this.metrics.averageCalculationTime)
  }

  /**
   * Update strategy usage
   */
  private updateStrategyUsage(strategyName: string): void {
    const existingStrategy = this.metrics.mostUsedStrategies.find(s => s.strategy === strategyName)
    if (existingStrategy) {
      existingStrategy.count++
    } else {
      this.metrics.mostUsedStrategies.push({ strategy: strategyName, count: 1 })
    }
    
    // Sort by count
    this.metrics.mostUsedStrategies.sort((a, b) => b.count - a.count)
  }

  /**
   * Get z-index for an object
   */
  public getZIndex(objectId: string, canvasId: string): number | null {
    const layer = Array.from(this.layers.values())
      .find(layer => layer.objectId === objectId && layer.canvasId === canvasId)
    
    return layer ? layer.zIndex : null
  }

  /**
   * Update z-index for an object
   */
  public async updateZIndex(
    objectId: string, 
    canvasId: string, 
    userId: string, 
    newZIndex: number,
    operation: ZIndexCalculationContext['operation'] = 'update'
  ): Promise<ZIndexCalculationResult> {
    const context: ZIndexCalculationContext = {
      objectId,
      canvasId,
      userId,
      requestedZIndex: newZIndex,
      operation,
      existingLayers: [],
      constraints: { avoidConflicts: true }
    }

    return this.calculateZIndex(context)
  }

  /**
   * Remove z-index layer for an object
   */
  public removeLayer(objectId: string, canvasId: string): void {
    const layerToRemove = Array.from(this.layers.entries())
      .find(([_, layer]) => layer.objectId === objectId && layer.canvasId === canvasId)
    
    if (layerToRemove) {
      this.layers.delete(layerToRemove[0])
    }
  }

  /**
   * Get all layers for a canvas
   */
  public getCanvasLayers(canvasId: string): ZIndexLayer[] {
    return this.getLayersForCanvas(canvasId)
  }

  /**
   * Get z-index metrics
   */
  public getMetrics(): ZIndexMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear all layers
   */
  public clearAllLayers(): void {
    this.layers.clear()
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalCalculations: 0,
      successfulCalculations: 0,
      failedCalculations: 0,
      conflictsResolved: 0,
      averageCalculationTime: 0,
      mostUsedStrategies: [],
      conflictTypes: []
    }
  }
}

// Export singleton instance
export const zIndexCalculationService = new ZIndexCalculationService()

// Export service
export { ZIndexCalculationService }
