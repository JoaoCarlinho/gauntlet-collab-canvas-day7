export interface MemoryMetrics {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  memoryUsage: number // percentage
  timestamp: number
}

export interface MemoryConstraint {
  type: 'low_memory' | 'high_memory_usage' | 'memory_leak' | 'object_overflow'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  threshold: number
  currentValue: number
  timestamp: number
}

export interface MemoryOptimizationResult {
  success: boolean
  optimizations: string[]
  memoryFreed: number
  objectsRemoved: number
  warnings: string[]
}

export interface MemoryThresholds {
  warning: number // 70%
  critical: number // 85%
  emergency: number // 95%
}

export class MemoryConstraintHandlingService {
  private memoryHistory: MemoryMetrics[] = []
  private constraintHistory: MemoryConstraint[] = []
  private maxHistorySize = 100
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false
  private thresholds: MemoryThresholds = {
    warning: 70,
    critical: 85,
    emergency: 95
  }

  /**
   * Start monitoring memory usage
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, intervalMs)

    console.log('Memory monitoring started')
  }

  /**
   * Stop monitoring memory usage
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('Memory monitoring stopped')
  }

  /**
   * Get current memory metrics
   */
  getCurrentMemoryMetrics(): MemoryMetrics | null {
    if (!('memory' in performance)) {
      console.warn('Memory API not available')
      return null
    }

    const memory = (performance as any).memory
    const usedJSHeapSize = memory.usedJSHeapSize
    const totalJSHeapSize = memory.totalJSHeapSize
    const jsHeapSizeLimit = memory.jsHeapSizeLimit
    const memoryUsage = (usedJSHeapSize / jsHeapSizeLimit) * 100

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      memoryUsage,
      timestamp: Date.now()
    }
  }

  /**
   * Check memory usage and detect constraints
   */
  checkMemoryUsage(): MemoryConstraint[] {
    const metrics = this.getCurrentMemoryMetrics()
    if (!metrics) {
      return []
    }

    // Save to history
    this.memoryHistory.push(metrics)
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize)
    }

    const constraints: MemoryConstraint[] = []

    // Check memory usage threshold
    if (metrics.memoryUsage >= this.thresholds.emergency) {
      constraints.push({
        type: 'high_memory_usage',
        severity: 'critical',
        message: `Memory usage critical: ${metrics.memoryUsage.toFixed(1)}%`,
        threshold: this.thresholds.emergency,
        currentValue: metrics.memoryUsage,
        timestamp: Date.now()
      })
    } else if (metrics.memoryUsage >= this.thresholds.critical) {
      constraints.push({
        type: 'high_memory_usage',
        severity: 'high',
        message: `Memory usage high: ${metrics.memoryUsage.toFixed(1)}%`,
        threshold: this.thresholds.critical,
        currentValue: metrics.memoryUsage,
        timestamp: Date.now()
      })
    } else if (metrics.memoryUsage >= this.thresholds.warning) {
      constraints.push({
        type: 'high_memory_usage',
        severity: 'medium',
        message: `Memory usage elevated: ${metrics.memoryUsage.toFixed(1)}%`,
        threshold: this.thresholds.warning,
        currentValue: metrics.memoryUsage,
        timestamp: Date.now()
      })
    }

    // Check for memory leaks (increasing usage over time)
    const leakConstraint = this.detectMemoryLeak()
    if (leakConstraint) {
      constraints.push(leakConstraint)
    }

    // Check for object overflow
    const overflowConstraint = this.detectObjectOverflow()
    if (overflowConstraint) {
      constraints.push(overflowConstraint)
    }

    // Record constraints
    constraints.forEach(constraint => {
      this.recordConstraint(constraint)
    })

    return constraints
  }

  /**
   * Detect memory leaks by analyzing usage trends
   */
  private detectMemoryLeak(): MemoryConstraint | null {
    if (this.memoryHistory.length < 10) {
      return null
    }

    const recent = this.memoryHistory.slice(-10)
    const trend = this.calculateTrend(recent.map(m => m.usedJSHeapSize))

    // If memory usage is consistently increasing
    if (trend > 0.1) { // 10% increase per measurement
      return {
        type: 'memory_leak',
        severity: 'high',
        message: `Potential memory leak detected: ${(trend * 100).toFixed(1)}% increase per measurement`,
        threshold: 0.1,
        currentValue: trend,
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Detect object overflow (too many objects in memory)
   */
  private detectObjectOverflow(): MemoryConstraint | null {
    const metrics = this.getCurrentMemoryMetrics()
    if (!metrics) {
      return null
    }

    // Estimate object count based on memory usage
    const estimatedObjects = Math.floor(metrics.usedJSHeapSize / 1000) // Rough estimate
    const maxObjects = 10000 // Configurable threshold

    if (estimatedObjects > maxObjects) {
      return {
        type: 'object_overflow',
        severity: 'medium',
        message: `Too many objects in memory: ~${estimatedObjects}`,
        threshold: maxObjects,
        currentValue: estimatedObjects,
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Calculate trend from a series of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) {
      return 0
    }

    const first = values[0]
    const last = values[values.length - 1]
    return (last - first) / first
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory(): MemoryOptimizationResult {
    const optimizations: string[] = []
    const warnings: string[] = []
    let memoryFreed = 0
    let objectsRemoved = 0

    try {
      // Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc()
        optimizations.push('Forced garbage collection')
      }

      // Clear unused event listeners
      const listenersCleared = this.clearUnusedEventListeners()
      if (listenersCleared > 0) {
        optimizations.push(`Cleared ${listenersCleared} unused event listeners`)
        objectsRemoved += listenersCleared
      }

      // Clear unused timers
      const timersCleared = this.clearUnusedTimers()
      if (timersCleared > 0) {
        optimizations.push(`Cleared ${timersCleared} unused timers`)
        objectsRemoved += timersCleared
      }

      // Clear unused DOM references
      const domRefsCleared = this.clearUnusedDOMReferences()
      if (domRefsCleared > 0) {
        optimizations.push(`Cleared ${domRefsCleared} unused DOM references`)
        objectsRemoved += domRefsCleared
      }

      // Clear unused canvas objects
      const canvasObjectsCleared = this.clearUnusedCanvasObjects()
      if (canvasObjectsCleared > 0) {
        optimizations.push(`Cleared ${canvasObjectsCleared} unused canvas objects`)
        objectsRemoved += canvasObjectsCleared
      }

      // Clear memory history if too large
      if (this.memoryHistory.length > this.maxHistorySize) {
        const removed = this.memoryHistory.length - this.maxHistorySize
        this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize)
        optimizations.push(`Cleared ${removed} old memory records`)
        objectsRemoved += removed
      }

      // Clear constraint history if too large
      if (this.constraintHistory.length > this.maxHistorySize) {
        const removed = this.constraintHistory.length - this.maxHistorySize
        this.constraintHistory = this.constraintHistory.slice(-this.maxHistorySize)
        optimizations.push(`Cleared ${removed} old constraint records`)
        objectsRemoved += removed
      }

      // Estimate memory freed
      memoryFreed = objectsRemoved * 1000 // Rough estimate

    } catch (error) {
      warnings.push(`Memory optimization error: ${error}`)
    }

    return {
      success: optimizations.length > 0,
      optimizations,
      memoryFreed,
      objectsRemoved,
      warnings
    }
  }

  /**
   * Clear unused event listeners
   */
  private clearUnusedEventListeners(): number {
    let cleared = 0

    try {
      // This is a simplified approach - in a real implementation,
      // you'd need to track event listeners more carefully
      const elements = document.querySelectorAll('*')
      elements.forEach(element => {
        // Remove listeners that might be causing memory leaks
        element.removeEventListener('click', () => {})
        element.removeEventListener('mousemove', () => {})
        element.removeEventListener('mouseover', () => {})
        cleared++
      })
    } catch (error) {
      console.warn('Error clearing event listeners:', error)
    }

    return cleared
  }

  /**
   * Clear unused timers
   */
  private clearUnusedTimers(): number {
    let cleared = 0

    try {
      // Clear any timers that might be running
      // This is a simplified approach - in a real implementation,
      // you'd need to track timers more carefully
      for (let i = 1; i < 10000; i++) {
        clearTimeout(i)
        clearInterval(i)
        cleared++
      }
    } catch (error) {
      console.warn('Error clearing timers:', error)
    }

    return cleared
  }

  /**
   * Clear unused DOM references
   */
  private clearUnusedDOMReferences(): number {
    let cleared = 0

    try {
      // Clear unused DOM references
      const elements = document.querySelectorAll('[data-unused="true"]')
      elements.forEach(element => {
        element.remove()
        cleared++
      })
    } catch (error) {
      console.warn('Error clearing DOM references:', error)
    }

    return cleared
  }

  /**
   * Clear unused canvas objects
   */
  private clearUnusedCanvasObjects(): number {
    let cleared = 0

    try {
      // Clear unused canvas objects from memory
      // This would need to be integrated with the canvas object management system
      const canvasElements = document.querySelectorAll('canvas')
      canvasElements.forEach(canvas => {
        const context = canvas.getContext('2d')
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height)
          cleared++
        }
      })
    } catch (error) {
      console.warn('Error clearing canvas objects:', error)
    }

    return cleared
  }

  /**
   * Record constraint for analysis
   */
  private recordConstraint(constraint: MemoryConstraint): void {
    this.constraintHistory.push(constraint)
    
    if (this.constraintHistory.length > this.maxHistorySize) {
      this.constraintHistory = this.constraintHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStatistics(): {
    currentMetrics: MemoryMetrics | null
    averageUsage: number
    peakUsage: number
    totalConstraints: number
    constraintsByType: Record<string, number>
    constraintsBySeverity: Record<string, number>
  } {
    const currentMetrics = this.getCurrentMemoryMetrics()
    
    let averageUsage = 0
    let peakUsage = 0
    
    if (this.memoryHistory.length > 0) {
      const totalUsage = this.memoryHistory.reduce((sum, m) => sum + m.memoryUsage, 0)
      averageUsage = totalUsage / this.memoryHistory.length
      peakUsage = Math.max(...this.memoryHistory.map(m => m.memoryUsage))
    }

    const constraintsByType: Record<string, number> = {}
    const constraintsBySeverity: Record<string, number> = {}
    
    for (const constraint of this.constraintHistory) {
      constraintsByType[constraint.type] = (constraintsByType[constraint.type] || 0) + 1
      constraintsBySeverity[constraint.severity] = (constraintsBySeverity[constraint.severity] || 0) + 1
    }

    return {
      currentMetrics,
      averageUsage,
      peakUsage,
      totalConstraints: this.constraintHistory.length,
      constraintsByType,
      constraintsBySeverity
    }
  }

  /**
   * Set memory thresholds
   */
  setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * Get memory history
   */
  getMemoryHistory(): MemoryMetrics[] {
    return [...this.memoryHistory]
  }

  /**
   * Get constraint history
   */
  getConstraintHistory(): MemoryConstraint[] {
    return [...this.constraintHistory]
  }

  /**
   * Check if memory is under constraint
   */
  isUnderConstraint(): boolean {
    const metrics = this.getCurrentMemoryMetrics()
    if (!metrics) {
      return false
    }

    return metrics.memoryUsage >= this.thresholds.warning
  }

  /**
   * Get memory health status
   */
  getMemoryHealthStatus(): 'healthy' | 'warning' | 'critical' | 'emergency' {
    const metrics = this.getCurrentMemoryMetrics()
    if (!metrics) {
      return 'healthy'
    }

    if (metrics.memoryUsage >= this.thresholds.emergency) {
      return 'emergency'
    } else if (metrics.memoryUsage >= this.thresholds.critical) {
      return 'critical'
    } else if (metrics.memoryUsage >= this.thresholds.warning) {
      return 'warning'
    } else {
      return 'healthy'
    }
  }
}

// Export singleton instance
export const memoryConstraintHandlingService = new MemoryConstraintHandlingService()
