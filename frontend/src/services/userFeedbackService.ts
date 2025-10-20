/**
 * Comprehensive User Feedback System
 */

import { errorLogger } from '../utils/errorLogger'

export interface FeedbackMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'loading'
  title: string
  message: string
  duration?: number
  actions?: FeedbackAction[]
  timestamp: number
  persistent?: boolean
  category?: string
}

export interface FeedbackAction {
  label: string
  action: () => void
  type?: 'primary' | 'secondary' | 'danger'
}

export interface FeedbackConfig {
  maxMessages: number
  defaultDuration: number
  enableSound: boolean
  enableVibration: boolean
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  enableAutoDismiss: boolean
  enableProgressBar: boolean
}

export interface FeedbackMetrics {
  totalMessages: number
  messagesByType: Map<string, number>
  averageDisplayTime: number
  userInteractions: number
  dismissedMessages: number
  lastMessageTime: number
}

class UserFeedbackService {
  private messages: FeedbackMessage[] = []
  private config: FeedbackConfig = {
    maxMessages: 5,
    defaultDuration: 5000,
    enableSound: true,
    enableVibration: false,
    position: 'top-right',
    enableAutoDismiss: true,
    enableProgressBar: true
  }
  private metrics: FeedbackMetrics = {
    totalMessages: 0,
    messagesByType: new Map(),
    averageDisplayTime: 0,
    userInteractions: 0,
    dismissedMessages: 0,
    lastMessageTime: 0
  }
  private messageTimeouts = new Map<string, NodeJS.Timeout>()
  private messageElements = new Map<string, HTMLElement>()

  constructor() {
    this.initializeFeedbackContainer()
    this.setupEventListeners()
  }

  /**
   * Initialize feedback container
   */
  private initializeFeedbackContainer(): void {
    // Remove existing container if any
    const existingContainer = document.getElementById('feedback-container')
    if (existingContainer) {
      existingContainer.remove()
    }

    // Create feedback container
    const container = document.createElement('div')
    container.id = 'feedback-container'
    container.className = `feedback-container feedback-${this.config.position}`
    
    // Add styles
    const styles = `
      .feedback-container {
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        max-width: 400px;
        width: 100%;
      }
      
      .feedback-top-right {
        top: 20px;
        right: 20px;
      }
      
      .feedback-top-left {
        top: 20px;
        left: 20px;
      }
      
      .feedback-bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .feedback-bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .feedback-top-center {
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .feedback-bottom-center {
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .feedback-message {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 10px;
        padding: 16px;
        pointer-events: auto;
        position: relative;
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        border-left: 4px solid #3b82f6;
      }
      
      .feedback-message.show {
        transform: translateX(0);
      }
      
      .feedback-message.success {
        border-left-color: #10b981;
      }
      
      .feedback-message.error {
        border-left-color: #ef4444;
      }
      
      .feedback-message.warning {
        border-left-color: #f59e0b;
      }
      
      .feedback-message.info {
        border-left-color: #3b82f6;
      }
      
      .feedback-message.loading {
        border-left-color: #8b5cf6;
      }
      
      .feedback-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .feedback-title {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
        margin: 0;
      }
      
      .feedback-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: #6b7280;
        font-size: 18px;
        line-height: 1;
      }
      
      .feedback-close:hover {
        color: #374151;
      }
      
      .feedback-content {
        color: #4b5563;
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
      }
      
      .feedback-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .feedback-action {
        padding: 6px 12px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .feedback-action.primary {
        background: #3b82f6;
        color: white;
      }
      
      .feedback-action.primary:hover {
        background: #2563eb;
      }
      
      .feedback-action.secondary {
        background: #f3f4f6;
        color: #374151;
      }
      
      .feedback-action.secondary:hover {
        background: #e5e7eb;
      }
      
      .feedback-action.danger {
        background: #ef4444;
        color: white;
      }
      
      .feedback-action.danger:hover {
        background: #dc2626;
      }
      
      .feedback-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: #3b82f6;
        border-radius: 0 0 8px 8px;
        transition: width linear;
      }
      
      .feedback-progress.success {
        background: #10b981;
      }
      
      .feedback-progress.error {
        background: #ef4444;
      }
      
      .feedback-progress.warning {
        background: #f59e0b;
      }
      
      .feedback-progress.info {
        background: #3b82f6;
      }
      
      .feedback-progress.loading {
        background: #8b5cf6;
      }
    `
    
    const styleElement = document.createElement('style')
    styleElement.textContent = styles
    document.head.appendChild(styleElement)
    
    document.body.appendChild(container)
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for custom events
    window.addEventListener('duplicateDetected', this.handleDuplicateDetected.bind(this))
    window.addEventListener('stateConflict', this.handleStateConflict.bind(this))
    window.addEventListener('connectionLost', this.handleConnectionLost.bind(this))
    window.addEventListener('connectionRestored', this.handleConnectionRestored.bind(this))
  }

  /**
   * Show success message
   */
  public success(title: string, message: string, options: Partial<FeedbackMessage> = {}): string {
    return this.showMessage({
      type: 'success',
      title,
      message,
      ...options
    })
  }

  /**
   * Show error message
   */
  public error(title: string, message: string, options: Partial<FeedbackMessage> = {}): string {
    return this.showMessage({
      type: 'error',
      title,
      message,
      persistent: true, // Errors are persistent by default
      ...options
    })
  }

  /**
   * Show warning message
   */
  public warning(title: string, message: string, options: Partial<FeedbackMessage> = {}): string {
    return this.showMessage({
      type: 'warning',
      title,
      message,
      ...options
    })
  }

  /**
   * Show info message
   */
  public info(title: string, message: string, options: Partial<FeedbackMessage> = {}): string {
    return this.showMessage({
      type: 'info',
      title,
      message,
      ...options
    })
  }

  /**
   * Show loading message
   */
  public loading(title: string, message: string, options: Partial<FeedbackMessage> = {}): string {
    return this.showMessage({
      type: 'loading',
      title,
      message,
      persistent: true, // Loading messages are persistent
      ...options
    })
  }

  /**
   * Show message
   */
  public showMessage(messageData: Omit<FeedbackMessage, 'id' | 'timestamp'>): string {
    const message: FeedbackMessage = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      duration: this.config.defaultDuration,
      ...messageData
    }

    // Update metrics
    this.metrics.totalMessages++
    this.metrics.lastMessageTime = message.timestamp
    const typeCount = this.metrics.messagesByType.get(message.type) || 0
    this.metrics.messagesByType.set(message.type, typeCount + 1)

    // Add to messages array
    this.messages.push(message)

    // Remove excess messages
    if (this.messages.length > this.config.maxMessages) {
      const removedMessage = this.messages.shift()!
      this.dismissMessage(removedMessage.id)
    }

    // Create and show message element
    this.createMessageElement(message)

    // Auto-dismiss if enabled and not persistent
    if (this.config.enableAutoDismiss && !message.persistent && message.duration) {
      const timeout = setTimeout(() => {
        this.dismissMessage(message.id)
      }, message.duration)
      
      this.messageTimeouts.set(message.id, timeout)
    }

    // Play sound if enabled
    if (this.config.enableSound) {
      this.playSound(message.type)
    }

    // Vibrate if enabled
    if (this.config.enableVibration && 'vibrate' in navigator) {
      this.vibrate(message.type)
    }

    return message.id
  }

  /**
   * Create message element
   */
  private createMessageElement(message: FeedbackMessage): void {
    const container = document.getElementById('feedback-container')
    if (!container) return

    const element = document.createElement('div')
    element.className = `feedback-message ${message.type}`
    element.setAttribute('data-message-id', message.id)

    // Create header
    const header = document.createElement('div')
    header.className = 'feedback-header'

    const title = document.createElement('h4')
    title.className = 'feedback-title'
    title.textContent = message.title

    const closeButton = document.createElement('button')
    closeButton.className = 'feedback-close'
    closeButton.innerHTML = '×'
    closeButton.onclick = () => this.dismissMessage(message.id)

    header.appendChild(title)
    header.appendChild(closeButton)

    // Create content
    const content = document.createElement('p')
    content.className = 'feedback-content'
    content.textContent = message.message

    element.appendChild(header)
    element.appendChild(content)

    // Create actions if provided
    if (message.actions && message.actions.length > 0) {
      const actionsContainer = document.createElement('div')
      actionsContainer.className = 'feedback-actions'

      message.actions.forEach(action => {
        const button = document.createElement('button')
        button.className = `feedback-action ${action.type || 'secondary'}`
        button.textContent = action.label
        button.onclick = () => {
          this.metrics.userInteractions++
          action.action()
        }
        actionsContainer.appendChild(button)
      })

      element.appendChild(actionsContainer)
    }

    // Create progress bar if enabled
    if (this.config.enableProgressBar && message.duration && !message.persistent) {
      const progress = document.createElement('div')
      progress.className = `feedback-progress ${message.type}`
      progress.style.width = '100%'
      progress.style.transitionDuration = `${message.duration}ms`
      
      // Start progress animation
      setTimeout(() => {
        progress.style.width = '0%'
      }, 100)
      
      element.appendChild(progress)
    }

    container.appendChild(element)
    this.messageElements.set(message.id, element)

    // Trigger animation
    setTimeout(() => {
      element.classList.add('show')
    }, 100)
  }

  /**
   * Dismiss message
   */
  public dismissMessage(messageId: string): void {
    const element = this.messageElements.get(messageId)
    if (element) {
      element.classList.remove('show')
      setTimeout(() => {
        element.remove()
        this.messageElements.delete(messageId)
      }, 300)
    }

    // Clear timeout
    const timeout = this.messageTimeouts.get(messageId)
    if (timeout) {
      clearTimeout(timeout)
      this.messageTimeouts.delete(messageId)
    }

    // Remove from messages array
    const messageIndex = this.messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      this.messages.splice(messageIndex, 1)
      this.metrics.dismissedMessages++
    }
  }

  /**
   * Update loading message
   */
  public updateLoadingMessage(messageId: string, title: string, message: string): void {
    const element = this.messageElements.get(messageId)
    if (element) {
      const titleElement = element.querySelector('.feedback-title')
      const contentElement = element.querySelector('.feedback-content')
      
      if (titleElement) titleElement.textContent = title
      if (contentElement) contentElement.textContent = message
    }
  }

  /**
   * Play sound for message type
   */
  private playSound(type: string): void {
    // Create audio context for simple beep sounds
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Different frequencies for different message types
      const frequencies = {
        success: 800,
        error: 400,
        warning: 600,
        info: 500,
        loading: 700
      }

      oscillator.frequency.setValueAtTime(frequencies[type as keyof typeof frequencies] || 500, audioContext.currentTime)
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      // Ignore audio errors
    }
  }

  /**
   * Vibrate for message type
   */
  private vibrate(type: string): void {
    if ('vibrate' in navigator) {
      const patterns = {
        success: [100],
        error: [200, 100, 200],
        warning: [150, 50, 150],
        info: [100],
        loading: [50, 50, 50]
      }

      navigator.vibrate(patterns[type as keyof typeof patterns] || [100])
    }
  }

  /**
   * Handle duplicate detected event
   */
  private handleDuplicateDetected(event: CustomEvent): void {
    const { newObject, candidate } = event.detail
    
    this.warning(
      'Potential Duplicate Detected',
      `This object is very similar to an existing one: ${candidate.reasons.join(', ')}`,
      {
        actions: [
          {
            label: 'Create Anyway',
            action: () => {
              // Allow creation
              window.dispatchEvent(new CustomEvent('duplicateResolved', {
                detail: { action: 'create', newObject }
              }))
            },
            type: 'primary'
          },
          {
            label: 'Cancel',
            action: () => {
              // Cancel creation
              window.dispatchEvent(new CustomEvent('duplicateResolved', {
                detail: { action: 'cancel', newObject }
              }))
            },
            type: 'secondary'
          }
        ]
      }
    )
  }

  /**
   * Handle state conflict event
   */
  private handleStateConflict(event: CustomEvent): void {
    const { conflict } = event.detail
    
    this.error(
      'State Conflict Detected',
      'There was a conflict while updating the canvas. Please refresh to see the latest changes.',
      {
        actions: [
          {
            label: 'Refresh',
            action: () => {
              window.location.reload()
            },
            type: 'primary'
          },
          {
            label: 'Ignore',
            action: () => {
              // Do nothing
            },
            type: 'secondary'
          }
        ]
      }
    )
  }

  /**
   * Handle connection lost event
   */
  private handleConnectionLost(event: CustomEvent): void {
    this.warning(
      'Connection Lost',
      'You have lost connection to the server. Changes will be saved when connection is restored.',
      {
        persistent: true
      }
    )
  }

  /**
   * Handle connection restored event
   */
  private handleConnectionRestored(event: CustomEvent): void {
    this.success(
      'Connection Restored',
      'Your connection to the server has been restored.',
      {
        duration: 3000
      }
    )
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<FeedbackConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Reinitialize container if position changed
    if (newConfig.position) {
      this.initializeFeedbackContainer()
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): FeedbackConfig {
    return { ...this.config }
  }

  /**
   * Get feedback metrics
   */
  public getMetrics(): FeedbackMetrics {
    return {
      ...this.metrics,
      messagesByType: new Map(this.metrics.messagesByType)
    }
  }

  /**
   * Clear all messages
   */
  public clearAllMessages(): void {
    this.messages.forEach(message => {
      this.dismissMessage(message.id)
    })
  }

  /**
   * Get current messages
   */
  public getCurrentMessages(): FeedbackMessage[] {
    return [...this.messages]
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalMessages: 0,
      messagesByType: new Map(),
      averageDisplayTime: 0,
      userInteractions: 0,
      dismissedMessages: 0,
      lastMessageTime: 0
    }
  }
}

// Export singleton instance
export const userFeedbackService = new UserFeedbackService()

// Export types and service
export { UserFeedbackService }
export type { FeedbackMessage, FeedbackAction, FeedbackConfig, FeedbackMetrics }
