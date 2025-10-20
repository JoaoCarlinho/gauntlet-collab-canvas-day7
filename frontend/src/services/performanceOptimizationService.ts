export interface PerformanceMetrics {
  fps: number
  frameTime: number
  memoryUsage: number
  renderTime: number
  updateTime: number
  timestamp: number
}

export interface PerformanceThresholds {
  fps: { warning: number; critical: number }
  frameTime: { warning: number; critical: number }
  memoryUsage: { warning: number; critical: number }
  renderTime: { warning: number; critical: number }
  updateTime: { warning: number; critical: number }
}

export interface PerformanceIssue {
  type: 'low_fps' | 'high_frame_time' | 'high_memory' | 'slow_render' | 'slow_update'
  severity: 'low' | 'medium' | 'high' | 'critical'
  metric: string
  value: number
  threshold: number
  message: string
  resolution: string
  timestamp: number
}

export interface OptimizationResult {
  success: boolean
  optimizations: string[]
  performanceGained: number
  issuesResolved: number
  warnings: string[]
}

export class PerformanceOptimizationService {
  private metricsHistory: PerformanceMetrics[] = []
  private issueHistory: PerformanceIssue[] = []
  private maxHistorySize = 100
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false
  private frameCount = 0
  private lastFrameTime = 0
  private thresholds: PerformanceThresholds = {
    fps: { warning: 45, critical: 30 },
    frameTime: { warning: 22, critical: 33 }, // 22ms = 45fps, 33ms = 30fps
    memoryUsage: { warning: 70, critical: 85 },
    renderTime: { warning: 16, critical: 33 },
    updateTime: { warning: 8, critical: 16 }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 1000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.startFrameRateMonitoring()
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)

    console.log('Performance monitoring started')
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    
    this.stopFrameRateMonitoring()
    this.isMonitoring = false
    console.log('Performance monitoring stopped')
  }

  /**
   * Start frame rate monitoring
   */
  private startFrameRateMonitoring(): void {
    const measureFrameRate = (timestamp: number) => {
      if (this.lastFrameTime === 0) {
        this.lastFrameTime = timestamp
      }

      this.frameCount++
      const deltaTime = timestamp - this.lastFrameTime

      if (deltaTime >= 1000) { // Update every second
        const fps = (this.frameCount * 1000) / deltaTime
        this.updateFrameRate(fps, deltaTime / this.frameCount)
        
        this.frameCount = 0
        this.lastFrameTime = timestamp
      }

      if (this.isMonitoring) {
        requestAnimationFrame(measureFrameRate)
      }
    }

    requestAnimationFrame(measureFrameRate)
  }

  /**
   * Stop frame rate monitoring
   */
  private stopFrameRateMonitoring(): void {
    this.frameCount = 0
    this.lastFrameTime = 0
  }

  /**
   * Update frame rate metrics
   */
  private updateFrameRate(fps: number, frameTime: number): void {
    const currentMetrics = this.getCurrentMetrics()
    if (currentMetrics) {
      currentMetrics.fps = fps
      currentMetrics.frameTime = frameTime
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics()
    if (!metrics) {
      return
    }

    // Save to history
    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize)
    }

    // Detect performance issues
    const issues = this.detectPerformanceIssues(metrics)
    
    // Record issues
    issues.forEach(issue => {
      this.recordIssue(issue)
    })

    // Auto-optimize if critical issues detected
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    if (criticalIssues.length > 0) {
      this.autoOptimize(criticalIssues)
    }
  }

  /**
   * Get current performance metrics
   */
  private getCurrentMetrics(): PerformanceMetrics | null {
    const metrics: PerformanceMetrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      renderTime: 0,
      updateTime: 0,
      timestamp: Date.now()
    }

    // Get memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memoryUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    }

    // Get render time (simplified)
    const renderStart = performance.now()
    // Simulate render time measurement
    const renderEnd = performance.now()
    metrics.renderTime = renderEnd - renderStart

    // Get update time (simplified)
    const updateStart = performance.now()
    // Simulate update time measurement
    const updateEnd = performance.now()
    metrics.updateTime = updateEnd - updateStart

    return metrics
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(metrics: PerformanceMetrics): PerformanceIssue[] {
    const issues: PerformanceIssue[] = []

    // Check FPS
    if (metrics.fps < this.thresholds.fps.critical) {
      issues.push({
        type: 'low_fps',
        severity: 'critical',
        metric: 'fps',
        value: metrics.fps,
        threshold: this.thresholds.fps.critical,
        message: `FPS critically low: ${metrics.fps.toFixed(1)}`,
        resolution: 'Reduce rendering complexity or enable performance optimizations',
        timestamp: Date.now()
      })
    } else if (metrics.fps < this.thresholds.fps.warning) {
      issues.push({
        type: 'low_fps',
        severity: 'medium',
        metric: 'fps',
        value: metrics.fps,
        threshold: this.thresholds.fps.warning,
        message: `FPS below warning threshold: ${metrics.fps.toFixed(1)}`,
        resolution: 'Consider performance optimizations',
        timestamp: Date.now()
      })
    }

    // Check frame time
    if (metrics.frameTime > this.thresholds.frameTime.critical) {
      issues.push({
        type: 'high_frame_time',
        severity: 'critical',
        metric: 'frameTime',
        value: metrics.frameTime,
        threshold: this.thresholds.frameTime.critical,
        message: `Frame time critically high: ${metrics.frameTime.toFixed(1)}ms`,
        resolution: 'Optimize rendering pipeline',
        timestamp: Date.now()
      })
    } else if (metrics.frameTime > this.thresholds.frameTime.warning) {
      issues.push({
        type: 'high_frame_time',
        severity: 'medium',
        metric: 'frameTime',
        value: metrics.frameTime,
        threshold: this.thresholds.frameTime.warning,
        message: `Frame time above warning threshold: ${metrics.frameTime.toFixed(1)}ms`,
        resolution: 'Consider rendering optimizations',
        timestamp: Date.now()
      })
    }

    // Check memory usage
    if (metrics.memoryUsage > this.thresholds.memoryUsage.critical) {
      issues.push({
        type: 'high_memory',
        severity: 'critical',
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage.critical,
        message: `Memory usage critically high: ${metrics.memoryUsage.toFixed(1)}%`,
        resolution: 'Clear unused objects and optimize memory usage',
        timestamp: Date.now()
      })
    } else if (metrics.memoryUsage > this.thresholds.memoryUsage.warning) {
      issues.push({
        type: 'high_memory',
        severity: 'medium',
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage.warning,
        message: `Memory usage above warning threshold: ${metrics.memoryUsage.toFixed(1)}%`,
        resolution: 'Monitor memory usage and consider cleanup',
        timestamp: Date.now()
      })
    }

    // Check render time
    if (metrics.renderTime > this.thresholds.renderTime.critical) {
      issues.push({
        type: 'slow_render',
        severity: 'critical',
        metric: 'renderTime',
        value: metrics.renderTime,
        threshold: this.thresholds.renderTime.critical,
        message: `Render time critically high: ${metrics.renderTime.toFixed(1)}ms`,
        resolution: 'Optimize rendering operations',
        timestamp: Date.now()
      })
    } else if (metrics.renderTime > this.thresholds.renderTime.warning) {
      issues.push({
        type: 'slow_render',
        severity: 'medium',
        metric: 'renderTime',
        value: metrics.renderTime,
        threshold: this.thresholds.renderTime.warning,
        message: `Render time above warning threshold: ${metrics.renderTime.toFixed(1)}ms`,
        resolution: 'Consider rendering optimizations',
        timestamp: Date.now()
      })
    }

    // Check update time
    if (metrics.updateTime > this.thresholds.updateTime.critical) {
      issues.push({
        type: 'slow_update',
        severity: 'critical',
        metric: 'updateTime',
        value: metrics.updateTime,
        threshold: this.thresholds.updateTime.critical,
        message: `Update time critically high: ${metrics.updateTime.toFixed(1)}ms`,
        resolution: 'Optimize update operations',
        timestamp: Date.now()
      })
    } else if (metrics.updateTime > this.thresholds.updateTime.warning) {
      issues.push({
        type: 'slow_update',
        severity: 'medium',
        metric: 'updateTime',
        value: metrics.updateTime,
        threshold: this.thresholds.updateTime.warning,
        message: `Update time above warning threshold: ${metrics.updateTime.toFixed(1)}ms`,
        resolution: 'Consider update optimizations',
        timestamp: Date.now()
      })
    }

    return issues
  }

  /**
   * Auto-optimize performance
   */
  private autoOptimize(issues: PerformanceIssue[]): void {
    console.log('Auto-optimizing performance due to critical issues:', issues.length)
    
    // Implement automatic optimizations based on issue types
    for (const issue of issues) {
      switch (issue.type) {
        case 'low_fps':
        case 'high_frame_time':
          this.optimizeRendering()
          break
        case 'high_memory':
          this.optimizeMemory()
          break
        case 'slow_render':
          this.optimizeRenderPipeline()
          break
        case 'slow_update':
          this.optimizeUpdatePipeline()
          break
      }
    }
  }

  /**
   * Optimize rendering performance
   */
  private optimizeRendering(): void {
    // Reduce rendering quality
    this.setRenderingQuality('medium')
    
    // Enable object culling
    this.enableObjectCulling()
    
    // Reduce update frequency
    this.reduceUpdateFrequency()
    
    console.log('Applied rendering optimizations')
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemory(): void {
    // Clear unused objects
    this.clearUnusedObjects()
    
    // Reduce object detail
    this.reduceObjectDetail()
    
    // Enable object pooling
    this.enableObjectPooling()
    
    console.log('Applied memory optimizations')
  }

  /**
   * Optimize render pipeline
   */
  private optimizeRenderPipeline(): void {
    // Batch render operations
    this.batchRenderOperations()
    
    // Use efficient rendering techniques
    this.useEfficientRendering()
    
    // Reduce visual effects
    this.reduceVisualEffects()
    
    console.log('Applied render pipeline optimizations')
  }

  /**
   * Optimize update pipeline
   */
  private optimizeUpdatePipeline(): void {
    // Batch update operations
    this.batchUpdateOperations()
    
    // Use efficient update techniques
    this.useEfficientUpdates()
    
    // Reduce update frequency
    this.reduceUpdateFrequency()
    
    console.log('Applied update pipeline optimizations')
  }

  /**
   * Set rendering quality
   */
  private setRenderingQuality(quality: 'low' | 'medium' | 'high'): void {
    // This would need to be integrated with the actual rendering system
    console.log(`Setting rendering quality to: ${quality}`)
  }

  /**
   * Enable object culling
   */
  private enableObjectCulling(): void {
    // This would need to be integrated with the actual rendering system
    console.log('Enabling object culling')
  }

  /**
   * Reduce update frequency
   */
  private reduceUpdateFrequency(): void {
    // This would need to be integrated with the actual update system
    console.log('Reducing update frequency')
  }

  /**
   * Clear unused objects
   */
  private clearUnusedObjects(): void {
    // This would need to be integrated with the actual object management system
    console.log('Clearing unused objects')
  }

  /**
   * Reduce object detail
   */
  private reduceObjectDetail(): void {
    // This would need to be integrated with the actual object system
    console.log('Reducing object detail')
  }

  /**
   * Enable object pooling
   */
  private enableObjectPooling(): void {
    // This would need to be integrated with the actual object system
    console.log('Enabling object pooling')
  }

  /**
   * Batch render operations
   */
  private batchRenderOperations(): void {
    // This would need to be integrated with the actual rendering system
    console.log('Batching render operations')
  }

  /**
   * Use efficient rendering
   */
  private useEfficientRendering(): void {
    // This would need to be integrated with the actual rendering system
    console.log('Using efficient rendering techniques')
  }

  /**
   * Reduce visual effects
   */
  private reduceVisualEffects(): void {
    // This would need to be integrated with the actual rendering system
    console.log('Reducing visual effects')
  }

  /**
   * Batch update operations
   */
  private batchUpdateOperations(): void {
    // This would need to be integrated with the actual update system
    console.log('Batching update operations')
  }

  /**
   * Use efficient updates
   */
  private useEfficientUpdates(): void {
    // This would need to be integrated with the actual update system
    console.log('Using efficient update techniques')
  }

  /**
   * Record performance issue
   */
  private recordIssue(issue: PerformanceIssue): void {
    this.issueHistory.push(issue)
    
    if (this.issueHistory.length > this.maxHistorySize) {
      this.issueHistory = this.issueHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStatistics(): {
    currentMetrics: PerformanceMetrics | null
    averageMetrics: Partial<PerformanceMetrics>
    peakMetrics: Partial<PerformanceMetrics>
    totalIssues: number
    issuesByType: Record<string, number>
    issuesBySeverity: Record<string, number>
    recentIssues: PerformanceIssue[]
  } {
    const currentMetrics = this.getCurrentMetrics()
    
    let averageMetrics: Partial<PerformanceMetrics> = {}
    let peakMetrics: Partial<PerformanceMetrics> = {}
    
    if (this.metricsHistory.length > 0) {
      const totalFps = this.metricsHistory.reduce((sum, m) => sum + m.fps, 0)
      const totalFrameTime = this.metricsHistory.reduce((sum, m) => sum + m.frameTime, 0)
      const totalMemoryUsage = this.metricsHistory.reduce((sum, m) => sum + m.memoryUsage, 0)
      const totalRenderTime = this.metricsHistory.reduce((sum, m) => sum + m.renderTime, 0)
      const totalUpdateTime = this.metricsHistory.reduce((sum, m) => sum + m.updateTime, 0)
      
      const count = this.metricsHistory.length
      averageMetrics = {
        fps: totalFps / count,
        frameTime: totalFrameTime / count,
        memoryUsage: totalMemoryUsage / count,
        renderTime: totalRenderTime / count,
        updateTime: totalUpdateTime / count
      }
      
      peakMetrics = {
        fps: Math.max(...this.metricsHistory.map(m => m.fps)),
        frameTime: Math.max(...this.metricsHistory.map(m => m.frameTime)),
        memoryUsage: Math.max(...this.metricsHistory.map(m => m.memoryUsage)),
        renderTime: Math.max(...this.metricsHistory.map(m => m.renderTime)),
        updateTime: Math.max(...this.metricsHistory.map(m => m.updateTime))
      }
    }

    const issuesByType: Record<string, number> = {}
    const issuesBySeverity: Record<string, number> = {}

    for (const issue of this.issueHistory) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1
    }

    return {
      currentMetrics,
      averageMetrics,
      peakMetrics,
      totalIssues: this.issueHistory.length,
      issuesByType,
      issuesBySeverity,
      recentIssues: this.issueHistory.slice(-10)
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds }
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  /**
   * Get issue history
   */
  getIssueHistory(): PerformanceIssue[] {
    return [...this.issueHistory]
  }

  /**
   * Check if performance is under threshold
   */
  isPerformanceUnderThreshold(): boolean {
    const metrics = this.getCurrentMetrics()
    if (!metrics) {
      return false
    }

    return metrics.fps < this.thresholds.fps.warning ||
           metrics.frameTime > this.thresholds.frameTime.warning ||
           metrics.memoryUsage > this.thresholds.memoryUsage.warning ||
           metrics.renderTime > this.thresholds.renderTime.warning ||
           metrics.updateTime > this.thresholds.updateTime.warning
  }

  /**
   * Get performance health status
   */
  getPerformanceHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const metrics = this.getCurrentMetrics()
    if (!metrics) {
      return 'healthy'
    }

    const criticalIssues = this.detectPerformanceIssues(metrics)
      .filter(issue => issue.severity === 'critical')
    
    if (criticalIssues.length > 0) {
      return 'critical'
    }

    const warningIssues = this.detectPerformanceIssues(metrics)
      .filter(issue => issue.severity === 'medium')
    
    if (warningIssues.length > 0) {
      return 'warning'
    }

    return 'healthy'
  }
}

// Export singleton instance
export const performanceOptimizationService = new PerformanceOptimizationService()
