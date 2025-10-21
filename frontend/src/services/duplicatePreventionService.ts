/**
 * Intelligent Duplicate Prevention Service
 */

import { CanvasObject } from '../types'

export interface DuplicateDetectionRule {
  name: string
  weight: number
  check: (obj1: any, obj2: any) => number // Returns similarity score 0-1
}

export interface DuplicateCandidate {
  object: CanvasObject
  similarity: number
  reasons: string[]
  confidence: 'low' | 'medium' | 'high'
}

export interface DuplicatePreventionConfig {
  similarityThreshold: number
  timeWindow: number // milliseconds
  positionTolerance: number
  sizeTolerance: number
  enableAutoPrevention: boolean
  enableUserNotification: boolean
}

export interface DuplicateMetrics {
  totalChecks: number
  duplicatesDetected: number
  duplicatesPrevented: number
  falsePositives: number
  averageSimilarity: number
  lastCheckTime: number
}

class DuplicatePreventionService {
  private config: DuplicatePreventionConfig = {
    similarityThreshold: 0.8,
    timeWindow: 5000, // 5 seconds
    positionTolerance: 10,
    sizeTolerance: 5,
    enableAutoPrevention: true,
    enableUserNotification: true
  }

  private detectionRules: DuplicateDetectionRule[] = []
  private recentObjects: Map<string, { object: CanvasObject; timestamp: number }> = new Map()
  private duplicateMetrics: DuplicateMetrics = {
    totalChecks: 0,
    duplicatesDetected: 0,
    duplicatesPrevented: 0,
    falsePositives: 0,
    averageSimilarity: 0,
    lastCheckTime: 0
  }

  constructor() {
    this.initializeDetectionRules()
    this.startCleanupInterval()
  }

  /**
   * Initialize duplicate detection rules
   */
  private initializeDetectionRules(): void {
    this.detectionRules = [
      {
        name: 'exact_position',
        weight: 0.3,
        check: (obj1, obj2) => this.checkExactPosition(obj1, obj2)
      },
      {
        name: 'similar_position',
        weight: 0.2,
        check: (obj1, obj2) => this.checkSimilarPosition(obj1, obj2)
      },
      {
        name: 'exact_size',
        weight: 0.2,
        check: (obj1, obj2) => this.checkExactSize(obj1, obj2)
      },
      {
        name: 'similar_size',
        weight: 0.15,
        check: (obj1, obj2) => this.checkSimilarSize(obj1, obj2)
      },
      {
        name: 'same_type',
        weight: 0.1,
        check: (obj1, obj2) => this.checkSameType(obj1, obj2)
      },
      {
        name: 'similar_properties',
        weight: 0.05,
        check: (obj1, obj2) => this.checkSimilarProperties(obj1, obj2)
      }
    ]
  }

  /**
   * Start cleanup interval for recent objects
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldObjects()
    }, 30000) // Clean up every 30 seconds
  }

  /**
   * Clean up old objects from recent objects map
   */
  private cleanupOldObjects(): void {
    const now = Date.now()
    const cutoff = now - this.config.timeWindow

    for (const [key, entry] of this.recentObjects.entries()) {
      if (entry.timestamp < cutoff) {
        this.recentObjects.delete(key)
      }
    }
  }

  /**
   * Check for duplicates before creating an object
   */
  public async checkForDuplicates(
    newObject: CanvasObject,
    existingObjects: CanvasObject[]
  ): Promise<DuplicateCandidate[]> {
    this.duplicateMetrics.totalChecks++
    this.duplicateMetrics.lastCheckTime = Date.now()

    const candidates: DuplicateCandidate[] = []
    const now = Date.now()

    // Check against recent objects first (most likely to be duplicates)
    for (const [, entry] of this.recentObjects.entries()) {
      if (now - entry.timestamp > this.config.timeWindow) {
        continue // Skip old objects
      }

      const similarity = this.calculateSimilarity(newObject, entry.object)
      if (similarity >= this.config.similarityThreshold) {
        const reasons = this.getSimilarityReasons(newObject, entry.object)
        const confidence = this.calculateConfidence(similarity, reasons.length)
        
        candidates.push({
          object: entry.object,
          similarity,
          reasons,
          confidence
        })
      }
    }

    // Check against existing objects
    for (const existingObject of existingObjects) {
      // Skip if already checked in recent objects
      if (this.recentObjects.has(existingObject.id)) {
        continue
      }

      const similarity = this.calculateSimilarity(newObject, existingObject)
      if (similarity >= this.config.similarityThreshold) {
        const reasons = this.getSimilarityReasons(newObject, existingObject)
        const confidence = this.calculateConfidence(similarity, reasons.length)
        
        candidates.push({
          object: existingObject,
          similarity,
          reasons,
          confidence
        })
      }
    }

    // Sort by similarity (highest first)
    candidates.sort((a, b) => b.similarity - a.similarity)

    if (candidates.length > 0) {
      this.duplicateMetrics.duplicatesDetected++
      
      // Update average similarity
      const totalSimilarity = candidates.reduce((sum, c) => sum + c.similarity, 0)
      const currentAvg = this.duplicateMetrics.averageSimilarity * (this.duplicateMetrics.duplicatesDetected - 1)
      this.duplicateMetrics.averageSimilarity = (currentAvg + totalSimilarity) / this.duplicateMetrics.duplicatesDetected
    }

    return candidates
  }

  /**
   * Calculate similarity between two objects
   */
  private calculateSimilarity(obj1: CanvasObject, obj2: CanvasObject): number {
    let totalWeight = 0
    let weightedScore = 0

    for (const rule of this.detectionRules) {
      const score = rule.check(obj1, obj2)
      weightedScore += score * rule.weight
      totalWeight += rule.weight
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0
  }

  /**
   * Get reasons for similarity
   */
  private getSimilarityReasons(obj1: CanvasObject, obj2: CanvasObject): string[] {
    const reasons: string[] = []

    if (this.checkExactPosition(obj1, obj2) > 0.9) {
      reasons.push('Exact same position')
    } else if (this.checkSimilarPosition(obj1, obj2) > 0.7) {
      reasons.push('Very similar position')
    }

    if (this.checkExactSize(obj1, obj2) > 0.9) {
      reasons.push('Exact same size')
    } else if (this.checkSimilarSize(obj1, obj2) > 0.7) {
      reasons.push('Very similar size')
    }

    if (this.checkSameType(obj1, obj2) > 0.9) {
      reasons.push('Same object type')
    }

    if (this.checkSimilarProperties(obj1, obj2) > 0.8) {
      reasons.push('Similar visual properties')
    }

    return reasons
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(similarity: number, reasonCount: number): 'low' | 'medium' | 'high' {
    if (similarity >= 0.9 && reasonCount >= 3) {
      return 'high'
    } else if (similarity >= 0.8 && reasonCount >= 2) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * Check exact position similarity
   */
  private checkExactPosition(obj1: CanvasObject, obj2: CanvasObject): number {
    const props1 = obj1.properties
    const props2 = obj2.properties

    if (props1.x === props2.x && props1.y === props2.y) {
      return 1.0
    }

    return 0
  }

  /**
   * Check similar position
   */
  private checkSimilarPosition(obj1: CanvasObject, obj2: CanvasObject): number {
    const props1 = obj1.properties
    const props2 = obj2.properties

    const dx = Math.abs(props1.x - props2.x)
    const dy = Math.abs(props1.y - props2.y)
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= this.config.positionTolerance) {
      return 1.0 - (distance / this.config.positionTolerance) * 0.5
    }

    return 0
  }

  /**
   * Check exact size similarity
   */
  private checkExactSize(obj1: CanvasObject, obj2: CanvasObject): number {
    const props1 = obj1.properties
    const props2 = obj2.properties

    // Handle different object types
    if (obj1.object_type === 'circle' && obj2.object_type === 'circle') {
      return props1.radius === props2.radius ? 1.0 : 0
    }

    if (props1.width === props2.width && props1.height === props2.height) {
      return 1.0
    }

    return 0
  }

  /**
   * Check similar size
   */
  private checkSimilarSize(obj1: CanvasObject, obj2: CanvasObject): number {
    const props1 = obj1.properties
    const props2 = obj2.properties

    // Handle different object types
    if (obj1.object_type === 'circle' && obj2.object_type === 'circle') {
      const radiusDiff = Math.abs(props1.radius - props2.radius)
      if (radiusDiff <= this.config.sizeTolerance) {
        return 1.0 - (radiusDiff / this.config.sizeTolerance) * 0.5
      }
      return 0
    }

    const widthDiff = Math.abs(props1.width - props2.width)
    const heightDiff = Math.abs(props1.height - props2.height)

    if (widthDiff <= this.config.sizeTolerance && heightDiff <= this.config.sizeTolerance) {
      const avgDiff = (widthDiff + heightDiff) / 2
      return 1.0 - (avgDiff / this.config.sizeTolerance) * 0.5
    }

    return 0
  }

  /**
   * Check same type
   */
  private checkSameType(obj1: CanvasObject, obj2: CanvasObject): number {
    return obj1.object_type === obj2.object_type ? 1.0 : 0
  }

  /**
   * Check similar properties
   */
  private checkSimilarProperties(obj1: CanvasObject, obj2: CanvasObject): number {
    const props1 = obj1.properties
    const props2 = obj2.properties

    let matches = 0
    let total = 0

    // Check common properties
    const commonProps = ['fill', 'stroke', 'strokeWidth', 'opacity', 'fontSize', 'fontFamily']
    
    for (const prop of commonProps) {
      if (props1[prop] !== undefined && props2[prop] !== undefined) {
        total++
        if (props1[prop] === props2[prop]) {
          matches++
        }
      }
    }

    return total > 0 ? matches / total : 0
  }

  /**
   * Prevent duplicate creation
   */
  public async preventDuplicate(
    newObject: CanvasObject,
    existingObjects: CanvasObject[]
  ): Promise<{ prevented: boolean; reason?: string; alternatives?: any[] }> {
    const candidates = await this.checkForDuplicates(newObject, existingObjects)

    if (candidates.length === 0) {
      // No duplicates found, allow creation
      this.recordObject(newObject)
      return { prevented: false }
    }

    const bestCandidate = candidates[0]

    if (this.config.enableAutoPrevention && bestCandidate.confidence === 'high') {
      // Auto-prevent high confidence duplicates
      this.duplicateMetrics.duplicatesPrevented++
      
      return {
        prevented: true,
        reason: `Potential duplicate detected: ${bestCandidate.reasons.join(', ')}`,
        alternatives: this.generateAlternatives(newObject)
      }
    }

    if (this.config.enableUserNotification) {
      // Notify user about potential duplicate
      this.notifyUserAboutDuplicate(newObject, bestCandidate)
    }

    // Record the object anyway (user can decide)
    this.recordObject(newObject)
    return { prevented: false }
  }

  /**
   * Record object for future duplicate detection
   */
  private recordObject(object: CanvasObject): void {
    this.recentObjects.set(object.id, {
      object,
      timestamp: Date.now()
    })
  }

  /**
   * Generate alternatives for duplicate object
   */
  private generateAlternatives(originalObject: CanvasObject): any[] {
    const alternatives = []
    const props = originalObject.properties

    // Alternative 1: Offset position
    alternatives.push({
      ...originalObject,
      properties: {
        ...props,
        x: props.x + 20,
        y: props.y + 20
      }
    })

    // Alternative 2: Different size
    if (props.width && props.height) {
      alternatives.push({
        ...originalObject,
        properties: {
          ...props,
          width: props.width * 1.2,
          height: props.height * 1.2
        }
      })
    }

    // Alternative 3: Different color
    alternatives.push({
      ...originalObject,
      properties: {
        ...props,
        fill: this.generateRandomColor()
      }
    })

    return alternatives
  }

  /**
   * Generate random color
   */
  private generateRandomColor(): string {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  /**
   * Notify user about potential duplicate
   */
  private notifyUserAboutDuplicate(newObject: CanvasObject, candidate: DuplicateCandidate): void {
    const event = new CustomEvent('duplicateDetected', {
      detail: {
        newObject,
        candidate,
        timestamp: Date.now()
      }
    })
    window.dispatchEvent(event)
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DuplicatePreventionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  public getConfig(): DuplicatePreventionConfig {
    return { ...this.config }
  }

  /**
   * Get duplicate metrics
   */
  public getMetrics(): DuplicateMetrics {
    return { ...this.duplicateMetrics }
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.duplicateMetrics = {
      totalChecks: 0,
      duplicatesDetected: 0,
      duplicatesPrevented: 0,
      falsePositives: 0,
      averageSimilarity: 0,
      lastCheckTime: 0
    }
  }

  /**
   * Add custom detection rule
   */
  public addDetectionRule(rule: DuplicateDetectionRule): void {
    this.detectionRules.push(rule)
  }

  /**
   * Remove detection rule
   */
  public removeDetectionRule(ruleName: string): void {
    this.detectionRules = this.detectionRules.filter(rule => rule.name !== ruleName)
  }

  /**
   * Clear recent objects
   */
  public clearRecentObjects(): void {
    this.recentObjects.clear()
  }

  /**
   * Get recent objects count
   */
  public getRecentObjectsCount(): number {
    return this.recentObjects.size
  }
}

// Export singleton instance
export const duplicatePreventionService = new DuplicatePreventionService()

// Export service
export { DuplicatePreventionService }
