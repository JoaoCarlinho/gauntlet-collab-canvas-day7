export interface FocusBlurEvent {
  type: 'focus' | 'blur' | 'visibility_change' | 'page_show' | 'page_hide'
  target: string
  timestamp: number
  context: {
    isDrawing: boolean
    isEditing: boolean
    selectedTool: string | null
    activeElement: string | null
  }
}

export interface FocusBlurIssue {
  type: 'interrupted_drawing' | 'lost_focus' | 'visibility_change' | 'context_switch'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  resolution: string
  timestamp: number
  event: FocusBlurEvent
}

export interface FocusBlurRecoveryResult {
  success: boolean
  issue: FocusBlurIssue | null
  resolution: string
  stateRestored: boolean
  actions: string[]
}

export interface FocusBlurState {
  isFocused: boolean
  isVisible: boolean
  lastFocusTime: number
  lastBlurTime: number
  focusCount: number
  blurCount: number
  interruptedOperations: string[]
}

export class FocusBlurIssueHandlingService {
  private focusBlurHistory: FocusBlurEvent[] = []
  private issueHistory: FocusBlurIssue[] = []
  private maxHistorySize = 100
  private currentState: FocusBlurState = {
    isFocused: true,
    isVisible: true,
    lastFocusTime: Date.now(),
    lastBlurTime: 0,
    focusCount: 0,
    blurCount: 0,
    interruptedOperations: []
  }
  private eventListeners: Map<string, Function> = new Map()
  private isMonitoring = false

  /**
   * Start monitoring focus/blur issues
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.setupEventListeners()
    console.log('Focus/blur issue monitoring started')
  }

  /**
   * Stop monitoring focus/blur issues
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.removeEventListeners()
    this.isMonitoring = false
    console.log('Focus/blur issue monitoring stopped')
  }

  /**
   * Setup event listeners for focus/blur detection
   */
  private setupEventListeners(): void {
    // Window focus/blur events
    const handleWindowFocus = () => {
      this.handleFocusEvent('focus', 'window')
    }

    const handleWindowBlur = () => {
      this.handleBlurEvent('blur', 'window')
    }

    // Document visibility change events
    const handleVisibilityChange = () => {
      const event: FocusBlurEvent = {
        type: 'visibility_change',
        target: 'document',
        timestamp: Date.now(),
        context: this.getCurrentContext()
      }
      this.processFocusBlurEvent(event)
    }

    // Page show/hide events
    const handlePageShow = () => {
      const focusEvent: FocusBlurEvent = {
        type: 'page_show',
        target: 'document',
        timestamp: Date.now(),
        context: this.getCurrentContext()
      }
      this.processFocusBlurEvent(focusEvent)
    }

    const handlePageHide = () => {
      const blurEvent: FocusBlurEvent = {
        type: 'page_hide',
        target: 'document',
        timestamp: Date.now(),
        context: this.getCurrentContext()
      }
      this.processFocusBlurEvent(blurEvent)
    }

    // Store event listeners for cleanup
    this.eventListeners.set('window:focus', handleWindowFocus)
    this.eventListeners.set('window:blur', handleWindowBlur)
    this.eventListeners.set('document:visibilitychange', handleVisibilityChange)
    this.eventListeners.set('window:pageshow', handlePageShow)
    this.eventListeners.set('window:pagehide', handlePageHide)

    // Add event listeners
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    for (const [key, listener] of this.eventListeners.entries()) {
      const [target, event] = key.split(':')
      
      if (target === 'window') {
        window.removeEventListener(event, listener as EventListener)
      } else if (target === 'document') {
        document.removeEventListener(event, listener as EventListener)
      }
    }

    this.eventListeners.clear()
  }

  /**
   * Handle focus event
   */
  private handleFocusEvent(type: string, target: string): void {
    const focusEvent: FocusBlurEvent = {
      type: type as any,
      target,
      timestamp: Date.now(),
      context: this.getCurrentContext()
    }

    this.currentState.isFocused = true
    this.currentState.lastFocusTime = Date.now()
    this.currentState.focusCount++

    this.processFocusBlurEvent(focusEvent)
  }

  /**
   * Handle blur event
   */
  private handleBlurEvent(type: string, target: string): void {
    const blurEvent: FocusBlurEvent = {
      type: type as any,
      target,
      timestamp: Date.now(),
      context: this.getCurrentContext()
    }

    this.currentState.isFocused = false
    this.currentState.lastBlurTime = Date.now()
    this.currentState.blurCount++

    this.processFocusBlurEvent(blurEvent)
  }

  /**
   * Process focus/blur event and detect issues
   */
  private processFocusBlurEvent(event: FocusBlurEvent): void {
    // Save to history
    this.focusBlurHistory.push(event)
    if (this.focusBlurHistory.length > this.maxHistorySize) {
      this.focusBlurHistory = this.focusBlurHistory.slice(-this.maxHistorySize)
    }

    // Detect issues
    const issues = this.detectFocusBlurIssues(event)
    
    // Record issues
    issues.forEach(issue => {
      this.recordIssue(issue)
    })

    // Auto-resolve issues if possible
    issues.forEach(issue => {
      this.autoResolveIssue(issue)
    })
  }

  /**
   * Detect focus/blur issues
   */
  private detectFocusBlurIssues(event: FocusBlurEvent): FocusBlurIssue[] {
    const issues: FocusBlurIssue[] = []

    // Check for interrupted drawing
    if (event.type === 'blur' && event.context.isDrawing) {
      issues.push({
        type: 'interrupted_drawing',
        severity: 'high',
        message: 'Drawing interrupted by window blur',
        resolution: 'Save drawing state and resume on focus',
        timestamp: Date.now(),
        event
      })
    }

    // Check for lost focus during editing
    if (event.type === 'blur' && event.context.isEditing) {
      issues.push({
        type: 'lost_focus',
        severity: 'medium',
        message: 'Text editing interrupted by window blur',
        resolution: 'Save editing state and resume on focus',
        timestamp: Date.now(),
        event
      })
    }

    // Check for visibility change during active operations
    if (event.type === 'visibility_change' && (event.context.isDrawing || event.context.isEditing)) {
      issues.push({
        type: 'visibility_change',
        severity: 'medium',
        message: 'Page visibility changed during active operation',
        resolution: 'Pause operation and resume on visibility restore',
        timestamp: Date.now(),
        event
      })
    }

    // Check for context switch
    if (event.type === 'focus' && this.currentState.interruptedOperations.length > 0) {
      issues.push({
        type: 'context_switch',
        severity: 'low',
        message: 'Window focused with interrupted operations',
        resolution: 'Restore interrupted operations',
        timestamp: Date.now(),
        event
      })
    }

    return issues
  }

  /**
   * Auto-resolve focus/blur issues
   */
  private autoResolveIssue(issue: FocusBlurIssue): FocusBlurRecoveryResult {
    const actions: string[] = []

    switch (issue.type) {
      case 'interrupted_drawing':
        return this.resolveInterruptedDrawing(issue, actions)
      
      case 'lost_focus':
        return this.resolveLostFocus(issue, actions)
      
      case 'visibility_change':
        return this.resolveVisibilityChange(issue, actions)
      
      case 'context_switch':
        return this.resolveContextSwitch(issue, actions)
      
      default:
        return {
          success: false,
          issue,
          resolution: 'Unknown issue type',
          stateRestored: false,
          actions
        }
    }
  }

  /**
   * Resolve interrupted drawing issue
   */
  private resolveInterruptedDrawing(issue: FocusBlurIssue, actions: string[]): FocusBlurRecoveryResult {
    // Save current drawing state
    this.currentState.interruptedOperations.push('drawing')
    actions.push('Saved drawing state')

    // Notify user about interruption
    this.notifyUser('Drawing interrupted by window blur. It will be restored when you return.')
    actions.push('Notified user about interruption')

    return {
      success: true,
      issue,
      resolution: 'Drawing state saved for restoration',
      stateRestored: false,
      actions
    }
  }

  /**
   * Resolve lost focus issue
   */
  private resolveLostFocus(issue: FocusBlurIssue, actions: string[]): FocusBlurRecoveryResult {
    // Save current editing state
    this.currentState.interruptedOperations.push('editing')
    actions.push('Saved editing state')

    // Notify user about interruption
    this.notifyUser('Text editing interrupted by window blur. It will be restored when you return.')
    actions.push('Notified user about interruption')

    return {
      success: true,
      issue,
      resolution: 'Editing state saved for restoration',
      stateRestored: false,
      actions
    }
  }

  /**
   * Resolve visibility change issue
   */
  private resolveVisibilityChange(issue: FocusBlurIssue, actions: string[]): FocusBlurRecoveryResult {
    // Pause current operations
    if (issue.event.context.isDrawing) {
      this.currentState.interruptedOperations.push('drawing')
      actions.push('Paused drawing operation')
    }

    if (issue.event.context.isEditing) {
      this.currentState.interruptedOperations.push('editing')
      actions.push('Paused editing operation')
    }

    // Update visibility state
    this.currentState.isVisible = document.visibilityState === 'visible'
    actions.push('Updated visibility state')

    return {
      success: true,
      issue,
      resolution: 'Operations paused due to visibility change',
      stateRestored: false,
      actions
    }
  }

  /**
   * Resolve context switch issue
   */
  private resolveContextSwitch(issue: FocusBlurIssue, actions: string[]): FocusBlurRecoveryResult {
    // Restore interrupted operations
    const restoredOperations: string[] = []
    
    for (const operation of this.currentState.interruptedOperations) {
      switch (operation) {
        case 'drawing':
          this.restoreDrawingState()
          restoredOperations.push('drawing')
          actions.push('Restored drawing state')
          break
        case 'editing':
          this.restoreEditingState()
          restoredOperations.push('editing')
          actions.push('Restored editing state')
          break
      }
    }

    // Clear interrupted operations
    this.currentState.interruptedOperations = []
    actions.push('Cleared interrupted operations')

    return {
      success: true,
      issue,
      resolution: `Restored ${restoredOperations.length} interrupted operations`,
      stateRestored: restoredOperations.length > 0,
      actions
    }
  }

  /**
   * Restore drawing state
   */
  private restoreDrawingState(): void {
    // This would need to be integrated with the canvas drawing system
    // For now, we'll just log the action
    console.log('Restoring drawing state...')
    
    // In a real implementation, you would:
    // 1. Restore the drawing tool
    // 2. Restore the drawing state
    // 3. Resume drawing from where it was interrupted
  }

  /**
   * Restore editing state
   */
  private restoreEditingState(): void {
    // This would need to be integrated with the text editing system
    // For now, we'll just log the action
    console.log('Restoring editing state...')
    
    // In a real implementation, you would:
    // 1. Restore the text editing mode
    // 2. Restore the cursor position
    // 3. Resume editing from where it was interrupted
  }

  /**
   * Notify user about focus/blur issues
   */
  private notifyUser(message: string): void {
    // This would need to be integrated with the user notification system
    console.log(`Focus/Blur Notification: ${message}`)
    
    // In a real implementation, you would:
    // 1. Show a toast notification
    // 2. Update the UI to indicate the issue
    // 3. Provide options for the user to resolve the issue
  }

  /**
   * Get current context for focus/blur events
   */
  private getCurrentContext(): FocusBlurEvent['context'] {
    // This would need to be integrated with the actual canvas state
    // For now, we'll return a placeholder
    return {
      isDrawing: false,
      isEditing: false,
      selectedTool: null,
      activeElement: document.activeElement?.tagName || null
    }
  }

  /**
   * Record issue for analysis
   */
  private recordIssue(issue: FocusBlurIssue): void {
    this.issueHistory.push(issue)
    
    if (this.issueHistory.length > this.maxHistorySize) {
      this.issueHistory = this.issueHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get focus/blur statistics
   */
  getFocusBlurStatistics(): {
    currentState: FocusBlurState
    totalEvents: number
    totalIssues: number
    issuesByType: Record<string, number>
    issuesBySeverity: Record<string, number>
    recentEvents: FocusBlurEvent[]
    recentIssues: FocusBlurIssue[]
  } {
    const issuesByType: Record<string, number> = {}
    const issuesBySeverity: Record<string, number> = {}

    for (const issue of this.issueHistory) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1
    }

    return {
      currentState: { ...this.currentState },
      totalEvents: this.focusBlurHistory.length,
      totalIssues: this.issueHistory.length,
      issuesByType,
      issuesBySeverity,
      recentEvents: this.focusBlurHistory.slice(-10),
      recentIssues: this.issueHistory.slice(-10)
    }
  }

  /**
   * Get current focus/blur state
   */
  getCurrentState(): FocusBlurState {
    return { ...this.currentState }
  }

  /**
   * Check if window is currently focused
   */
  isWindowFocused(): boolean {
    return this.currentState.isFocused
  }

  /**
   * Check if page is currently visible
   */
  isPageVisible(): boolean {
    return this.currentState.isVisible
  }

  /**
   * Get interrupted operations
   */
  getInterruptedOperations(): string[] {
    return [...this.currentState.interruptedOperations]
  }

  /**
   * Clear interrupted operations
   */
  clearInterruptedOperations(): void {
    this.currentState.interruptedOperations = []
  }

  /**
   * Manually trigger focus/blur event processing
   */
  triggerFocusBlurEvent(type: FocusBlurEvent['type'], target: string): void {
    const event: FocusBlurEvent = {
      type,
      target,
      timestamp: Date.now(),
      context: this.getCurrentContext()
    }

    this.processFocusBlurEvent(event)
  }
}

// Export singleton instance
export const focusBlurIssueHandlingService = new FocusBlurIssueHandlingService()
