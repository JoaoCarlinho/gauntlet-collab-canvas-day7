/**
 * Socket Event Reliability Service with Event Queuing, Acknowledgment, and Recovery
 */

import { errorLogger } from '../utils/errorLogger'
import { networkTimeoutService } from './networkTimeoutService'

export interface SocketEvent {
  id: string
  type: string
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  requiresAcknowledgment: boolean
  acknowledgmentTimeout: number
  metadata?: Record<string, any>
}

export interface EventAcknowledgment {
  eventId: string
  success: boolean
  error?: string
  timestamp: number
  serverTimestamp?: number
}

export interface EventQueueStats {
  totalEvents: number
  pendingEvents: number
  acknowledgedEvents: number
  failedEvents: number
  averageProcessingTime: number
  queueSize: number
}

export interface ReliabilityConfig {
  maxQueueSize: number
  defaultAcknowledgmentTimeout: number
  maxRetries: number
  retryDelay: number
  batchSize: number
  flushInterval: number
  enableEventDeduplication: boolean
  enableEventOrdering: boolean
}

export interface EventReliabilityResult {
  success: boolean
  eventId: string
  error?: string
  acknowledgment?: EventAcknowledgment
  processingTime: number
}

class SocketEventReliabilityService {
  private eventQueue: SocketEvent[] = []
  private pendingAcknowledgments: Map<string, { event: SocketEvent; timeout: NodeJS.Timeout }> = new Map()
  private eventHistory: Map<string, SocketEvent> = new Map()
  private acknowledgmentHistory: Map<string, EventAcknowledgment> = new Map()
  private queueStats: EventQueueStats = {
    totalEvents: 0,
    pendingEvents: 0,
    acknowledgedEvents: 0,
    failedEvents: 0,
    averageProcessingTime: 0,
    queueSize: 0
  }

  private config: ReliabilityConfig = {
    maxQueueSize: 1000,
    defaultAcknowledgmentTimeout: 10000, // 10 seconds
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 10,
    flushInterval: 1000, // 1 second
    enableEventDeduplication: true,
    enableEventOrdering: true
  }

  private flushInterval: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor() {
    this.startEventProcessing()
  }

  /**
   * Start event processing loop
   */
  private startEventProcessing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    this.flushInterval = setInterval(() => {
      this.processEventQueue()
    }, this.config.flushInterval)
  }

  /**
   * Stop event processing
   */
  public stopEventProcessing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }

  /**
   * Emit event with reliability guarantees
   */
  public async emitEvent(
    eventType: string,
    data: any,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical'
      requiresAcknowledgment?: boolean
      acknowledgmentTimeout?: number
      maxRetries?: number
      metadata?: Record<string, any>
    } = {}
  ): Promise<EventReliabilityResult> {
    const startTime = Date.now()
    
    try {
      // Generate unique event ID
      const eventId = this.generateEventId()
      
      // Create event object
      const event: SocketEvent = {
        id: eventId,
        type: eventType,
        data,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: options.maxRetries || this.config.maxRetries,
        priority: options.priority || 'medium',
        requiresAcknowledgment: options.requiresAcknowledgment || false,
        acknowledgmentTimeout: options.acknowledgmentTimeout || this.config.defaultAcknowledgmentTimeout,
        metadata: options.metadata
      }

      // Check for duplicate events if deduplication is enabled
      if (this.config.enableEventDeduplication && this.isDuplicateEvent(event)) {
        console.log(`Duplicate event detected: ${eventType}`)
        return {
          success: true,
          eventId,
          processingTime: Date.now() - startTime
        }
      }

      // Add to queue
      this.addEventToQueue(event)
      
      // Store in history
      this.eventHistory.set(eventId, event)
      
      // Update stats
      this.updateQueueStats('add')

      // If acknowledgment is required, set up timeout
      if (event.requiresAcknowledgment) {
        this.setupAcknowledgmentTimeout(event)
      }

      // Process immediately if high priority
      if (event.priority === 'critical' || event.priority === 'high') {
        await this.processEventImmediately(event)
      }

      return {
        success: true,
        eventId,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('Failed to emit event:', error)
      errorLogger.logError('Event emission failed', {
        operation: 'socket_connection',
        additionalData: { eventType, error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      })

      return {
        success: false,
        eventId: '',
        error: error instanceof Error ? error.message : 'Event emission failed',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Process event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // Sort events by priority and timestamp
      const sortedEvents = this.sortEventsByPriority(this.eventQueue)
      
      // Process batch of events
      const batch = sortedEvents.slice(0, this.config.batchSize)
      
      for (const event of batch) {
        await this.processEvent(event)
      }

    } catch (error) {
      console.error('Event queue processing error:', error)
      errorLogger.logError('Event queue processing failed', {
        operation: 'socket_connection',
        additionalData: { error: error instanceof Error ? error.message : 'Unknown error', queueSize: this.eventQueue.length },
        timestamp: Date.now()
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process individual event
   */
  private async processEvent(event: SocketEvent): Promise<void> {
    try {
      // Remove from queue
      this.removeEventFromQueue(event.id)
      
      // Emit through socket (this would integrate with actual socket service)
      const result = await this.emitThroughSocket(event)
      
      if (result.success) {
        // Update stats
        this.updateQueueStats('success')
        
        // If acknowledgment is required, wait for it
        if (event.requiresAcknowledgment) {
          await this.waitForAcknowledgment(event)
        }
      } else {
        // Handle failure
        await this.handleEventFailure(event, result.error)
      }

    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error)
      await this.handleEventFailure(event, error instanceof Error ? error.message : 'Processing failed')
    }
  }

  /**
   * Process event immediately (for high priority events)
   */
  private async processEventImmediately(event: SocketEvent): Promise<void> {
    try {
      // Remove from queue
      this.removeEventFromQueue(event.id)
      
      // Emit through socket
      const result = await this.emitThroughSocket(event)
      
      if (result.success) {
        this.updateQueueStats('success')
        
        if (event.requiresAcknowledgment) {
          await this.waitForAcknowledgment(event)
        }
      } else {
        await this.handleEventFailure(event, result.error)
      }

    } catch (error) {
      await this.handleEventFailure(event, error instanceof Error ? error.message : 'Immediate processing failed')
    }
  }

  /**
   * Emit event through socket
   */
  private async emitThroughSocket(event: SocketEvent): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with the actual socket service
      // For now, we'll simulate the emission
      
      const result = await networkTimeoutService.executeWithTimeout(
        async () => {
          // Simulate socket emission
          console.log(`Emitting socket event: ${event.type}`, event.data)
          
          // Simulate success/failure
          if (Math.random() > 0.1) { // 90% success rate
            return { success: true }
          } else {
            throw new Error('Socket emission failed')
          }
        },
        5000,
        `socket_emit_${event.type}`
      )

      return result.success ? { success: true } : { success: false, error: result.error }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Socket emission failed'
      }
    }
  }

  /**
   * Handle event failure
   */
  private async handleEventFailure(event: SocketEvent, error: string): Promise<void> {
    event.retryCount++
    
    if (event.retryCount < event.maxRetries) {
      // Retry the event
      console.log(`Retrying event ${event.id} (attempt ${event.retryCount + 1})`)
      
      // Add back to queue with delay
      setTimeout(() => {
        this.addEventToQueue(event)
      }, this.config.retryDelay * event.retryCount)
      
    } else {
      // Max retries exceeded
      console.error(`Event ${event.id} failed after ${event.maxRetries} attempts: ${error}`)
      
      // Update stats
      this.updateQueueStats('failure')
      
      // Log failure
      errorLogger.logError('Event processing failed', {
        operation: 'socket_connection',
        additionalData: { eventId: event.id, eventType: event.type, retryCount: event.retryCount, error },
        timestamp: Date.now()
      })
      
      // Remove from pending acknowledgments
      this.pendingAcknowledgments.delete(event.id)
    }
  }

  /**
   * Set up acknowledgment timeout
   */
  private setupAcknowledgmentTimeout(event: SocketEvent): void {
    const timeout = setTimeout(() => {
      console.warn(`Acknowledgment timeout for event ${event.id}`)
      this.handleAcknowledgmentTimeout(event)
    }, event.acknowledgmentTimeout)

    this.pendingAcknowledgments.set(event.id, { event, timeout })
  }

  /**
   * Wait for acknowledgment
   */
  private async waitForAcknowledgment(event: SocketEvent): Promise<void> {
    return new Promise((resolve) => {
      const checkAcknowledgment = () => {
        const acknowledgment = this.acknowledgmentHistory.get(event.id)
        if (acknowledgment) {
          resolve()
        } else {
          setTimeout(checkAcknowledgment, 100)
        }
      }
      
      checkAcknowledgment()
    })
  }

  /**
   * Handle acknowledgment timeout
   */
  private handleAcknowledgmentTimeout(event: SocketEvent): void {
    this.pendingAcknowledgments.delete(event.id)
    
    // Retry if not exceeded max retries
    if (event.retryCount < event.maxRetries) {
      event.retryCount++
      this.addEventToQueue(event)
    } else {
      this.updateQueueStats('failure')
      console.error(`Acknowledgment timeout for event ${event.id} after ${event.maxRetries} attempts`)
    }
  }

  /**
   * Record acknowledgment
   */
  public recordAcknowledgment(acknowledgment: EventAcknowledgment): void {
    this.acknowledgmentHistory.set(acknowledgment.eventId, acknowledgment)
    
    // Clear pending acknowledgment
    const pending = this.pendingAcknowledgments.get(acknowledgment.eventId)
    if (pending) {
      clearTimeout(pending.timeout)
      this.pendingAcknowledgments.delete(acknowledgment.eventId)
    }
    
    // Update stats
    if (acknowledgment.success) {
      this.updateQueueStats('acknowledged')
    } else {
      this.updateQueueStats('failure')
    }
  }

  /**
   * Add event to queue
   */
  private addEventToQueue(event: SocketEvent): void {
    // Check queue size limit
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      // Remove oldest low priority events
      const lowPriorityEvents = this.eventQueue.filter(e => e.priority === 'low')
      if (lowPriorityEvents.length > 0) {
        const oldestEvent = lowPriorityEvents.reduce((oldest, current) => 
          current.timestamp < oldest.timestamp ? current : oldest
        )
        this.removeEventFromQueue(oldestEvent.id)
      } else {
        console.warn('Event queue is full and no low priority events to remove')
        return
      }
    }

    this.eventQueue.push(event)
    this.queueStats.queueSize = this.eventQueue.length
  }

  /**
   * Remove event from queue
   */
  private removeEventFromQueue(eventId: string): void {
    const index = this.eventQueue.findIndex(e => e.id === eventId)
    if (index !== -1) {
      this.eventQueue.splice(index, 1)
      this.queueStats.queueSize = this.eventQueue.length
    }
  }

  /**
   * Sort events by priority and timestamp
   */
  private sortEventsByPriority(events: SocketEvent[]): SocketEvent[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    
    return events.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp - b.timestamp
    })
  }

  /**
   * Check for duplicate events
   */
  private isDuplicateEvent(event: SocketEvent): boolean {
    const recentEvents = Array.from(this.eventHistory.values())
      .filter(e => Date.now() - e.timestamp < 5000) // Last 5 seconds
    
    return recentEvents.some(e => 
      e.type === event.type && 
      JSON.stringify(e.data) === JSON.stringify(event.data)
    )
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update queue statistics
   */
  private updateQueueStats(operation: 'add' | 'success' | 'failure' | 'acknowledged'): void {
    switch (operation) {
      case 'add':
        this.queueStats.totalEvents++
        this.queueStats.pendingEvents++
        break
      case 'success':
        this.queueStats.pendingEvents = Math.max(0, this.queueStats.pendingEvents - 1)
        break
      case 'failure':
        this.queueStats.failedEvents++
        this.queueStats.pendingEvents = Math.max(0, this.queueStats.pendingEvents - 1)
        break
      case 'acknowledged':
        this.queueStats.acknowledgedEvents++
        break
    }
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): EventQueueStats {
    return { ...this.queueStats }
  }

  /**
   * Get event history
   */
  public getEventHistory(): Map<string, SocketEvent> {
    return new Map(this.eventHistory)
  }

  /**
   * Get acknowledgment history
   */
  public getAcknowledgmentHistory(): Map<string, EventAcknowledgment> {
    return new Map(this.acknowledgmentHistory)
  }

  /**
   * Clear all data
   */
  public clearAll(): void {
    this.eventQueue = []
    this.eventHistory.clear()
    this.acknowledgmentHistory.clear()
    this.pendingAcknowledgments.clear()
    this.queueStats = {
      totalEvents: 0,
      pendingEvents: 0,
      acknowledgedEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      queueSize: 0
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ReliabilityConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ReliabilityConfig {
    return { ...this.config }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopEventProcessing()
    this.clearAll()
  }
}

// Export singleton instance
export const socketEventReliabilityService = new SocketEventReliabilityService()

// Export service
export { SocketEventReliabilityService }
