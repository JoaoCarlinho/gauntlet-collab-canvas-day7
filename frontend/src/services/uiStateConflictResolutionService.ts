import { CanvasObject } from '../types'
import { DrawingTool } from '../types/toolbar'

export interface UIStateConflict {
  type: 'drawing' | 'text_editing' | 'tool_selection' | 'multi_selection' | 'general'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  resolution: string
  timestamp: number
}

export interface UIStateSnapshot {
  isDrawing: boolean
  editingObjectId: string | null
  selectedTool: DrawingTool | null
  selectedObjectIds: Set<string>
  isMultiSelecting: boolean
  timestamp: number
}

export interface ConflictResolutionResult {
  success: boolean
  conflict: UIStateConflict | null
  resolution: string
  newState?: Partial<UIStateSnapshot>
}

export class UIStateConflictResolutionService {
  private conflictHistory: UIStateConflict[] = []
  private maxHistorySize = 100
  private stateSnapshots: UIStateSnapshot[] = []
  private maxSnapshots = 50

  /**
   * Analyze current UI state for potential conflicts
   */
  analyzeStateConflicts(currentState: UIStateSnapshot): UIStateConflict[] {
    const conflicts: UIStateConflict[] = []

    // Check for drawing state conflicts
    if (currentState.isDrawing && currentState.editingObjectId) {
      conflicts.push({
        type: 'drawing',
        severity: 'high',
        message: 'Cannot draw while editing text',
        resolution: 'End text editing before starting new drawing',
        timestamp: Date.now()
      })
    }

    // Check for tool selection conflicts
    if (currentState.isDrawing && currentState.selectedTool?.id !== 'select') {
      conflicts.push({
        type: 'tool_selection',
        severity: 'medium',
        message: 'Drawing in progress with non-select tool',
        resolution: 'Complete current drawing or switch to select tool',
        timestamp: Date.now()
      })
    }

    // Check for multi-selection conflicts
    if (currentState.isMultiSelecting && currentState.isDrawing) {
      conflicts.push({
        type: 'multi_selection',
        severity: 'high',
        message: 'Cannot start multi-selection while drawing',
        resolution: 'Complete current drawing before multi-selecting',
        timestamp: Date.now()
      })
    }

    // Check for text editing conflicts
    if (currentState.editingObjectId && currentState.isDrawing) {
      conflicts.push({
        type: 'text_editing',
        severity: 'critical',
        message: 'Cannot draw while editing text',
        resolution: 'End text editing before starting new drawing',
        timestamp: Date.now()
      })
    }

    // Check for general state conflicts
    if (currentState.selectedObjectIds.size > 0 && currentState.isDrawing) {
      conflicts.push({
        type: 'general',
        severity: 'medium',
        message: 'Objects selected while drawing',
        resolution: 'Clear selection before starting new drawing',
        timestamp: Date.now()
      })
    }

    return conflicts
  }

  /**
   * Resolve drawing state conflicts
   */
  resolveDrawingStateConflict(
    currentState: UIStateSnapshot,
    targetAction: 'start_drawing' | 'end_drawing' | 'continue_drawing'
  ): ConflictResolutionResult {
    const conflicts = this.analyzeStateConflicts(currentState)
    const drawingConflicts = conflicts.filter(c => c.type === 'drawing')

    if (drawingConflicts.length === 0) {
      return {
        success: true,
        conflict: null,
        resolution: 'No conflicts detected'
      }
    }

    const conflict = drawingConflicts[0]

    switch (targetAction) {
      case 'start_drawing':
        return this.resolveStartDrawingConflict(currentState, conflict)
      case 'end_drawing':
        return this.resolveEndDrawingConflict(currentState, conflict)
      case 'continue_drawing':
        return this.resolveContinueDrawingConflict(currentState, conflict)
      default:
        return {
          success: false,
          conflict,
          resolution: 'Unknown action type'
        }
    }
  }

  /**
   * Resolve text editing mode conflicts
   */
  resolveTextEditingConflict(
    currentState: UIStateSnapshot,
    targetAction: 'start_editing' | 'end_editing' | 'continue_editing'
  ): ConflictResolutionResult {
    const conflicts = this.analyzeStateConflicts(currentState)
    const textConflicts = conflicts.filter(c => c.type === 'text_editing')

    if (textConflicts.length === 0) {
      return {
        success: true,
        conflict: null,
        resolution: 'No conflicts detected'
      }
    }

    const conflict = textConflicts[0]

    switch (targetAction) {
      case 'start_editing':
        return this.resolveStartTextEditingConflict(currentState, conflict)
      case 'end_editing':
        return this.resolveEndTextEditingConflict(currentState, conflict)
      case 'continue_editing':
        return this.resolveContinueTextEditingConflict(currentState, conflict)
      default:
        return {
          success: false,
          conflict,
          resolution: 'Unknown action type'
        }
    }
  }

  /**
   * Resolve tool selection conflicts
   */
  resolveToolSelectionConflict(
    currentState: UIStateSnapshot,
    newTool: DrawingTool
  ): ConflictResolutionResult {
    const conflicts = this.analyzeStateConflicts(currentState)
    const toolConflicts = conflicts.filter(c => c.type === 'tool_selection')

    if (toolConflicts.length === 0) {
      return {
        success: true,
        conflict: null,
        resolution: 'No conflicts detected'
      }
    }

    const conflict = toolConflicts[0]

    // If currently drawing and trying to switch to a different tool
    if (currentState.isDrawing && newTool.id !== currentState.selectedTool?.id) {
      return {
        success: false,
        conflict: {
          ...conflict,
          message: `Cannot switch to ${newTool.name} while drawing`,
          resolution: 'Complete current drawing before switching tools'
        },
        resolution: 'Complete current drawing before switching tools'
      }
    }

    // If editing text and trying to switch to a non-select tool
    if (currentState.editingObjectId && newTool.id !== 'select') {
      return {
        success: false,
        conflict: {
          ...conflict,
          message: `Cannot switch to ${newTool.name} while editing text`,
          resolution: 'End text editing before switching tools'
        },
        resolution: 'End text editing before switching tools'
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Tool selection allowed'
    }
  }

  /**
   * Resolve multi-selection conflicts
   */
  resolveMultiSelectionConflict(
    currentState: UIStateSnapshot,
    targetAction: 'start_selection' | 'end_selection' | 'continue_selection'
  ): ConflictResolutionResult {
    const conflicts = this.analyzeStateConflicts(currentState)
    const selectionConflicts = conflicts.filter(c => c.type === 'multi_selection')

    if (selectionConflicts.length === 0) {
      return {
        success: true,
        conflict: null,
        resolution: 'No conflicts detected'
      }
    }

    const conflict = selectionConflicts[0]

    switch (targetAction) {
      case 'start_selection':
        return this.resolveStartMultiSelectionConflict(currentState, conflict)
      case 'end_selection':
        return this.resolveEndMultiSelectionConflict(currentState, conflict)
      case 'continue_selection':
        return this.resolveContinueMultiSelectionConflict(currentState, conflict)
      default:
        return {
          success: false,
          conflict,
          resolution: 'Unknown action type'
        }
    }
  }

  /**
   * Get recommended state changes to resolve conflicts
   */
  getRecommendedStateChanges(conflicts: UIStateConflict[]): Partial<UIStateSnapshot> {
    const recommendations: Partial<UIStateSnapshot> = {}

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'drawing':
          if (conflict.severity === 'critical' || conflict.severity === 'high') {
            recommendations.isDrawing = false
          }
          break
        case 'text_editing':
          if (conflict.severity === 'critical' || conflict.severity === 'high') {
            recommendations.editingObjectId = null
          }
          break
        case 'multi_selection':
          if (conflict.severity === 'high') {
            recommendations.isMultiSelecting = false
            recommendations.selectedObjectIds = new Set()
          }
          break
        case 'tool_selection':
          if (conflict.severity === 'medium' || conflict.severity === 'high') {
            // Keep current tool but ensure it's compatible
            recommendations.selectedTool = null // Will be set by caller
          }
          break
      }
    }

    return recommendations
  }

  /**
   * Save state snapshot for conflict analysis
   */
  saveStateSnapshot(state: UIStateSnapshot): void {
    this.stateSnapshots.push(state)
    
    // Keep only recent snapshots
    if (this.stateSnapshots.length > this.maxSnapshots) {
      this.stateSnapshots = this.stateSnapshots.slice(-this.maxSnapshots)
    }
  }

  /**
   * Record conflict for analysis
   */
  recordConflict(conflict: UIStateConflict): void {
    this.conflictHistory.push(conflict)
    
    // Keep only recent conflicts
    if (this.conflictHistory.length > this.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get conflict statistics
   */
  getConflictStatistics(): {
    totalConflicts: number
    conflictsByType: Record<string, number>
    conflictsBySeverity: Record<string, number>
    recentConflicts: UIStateConflict[]
  } {
    const conflictsByType: Record<string, number> = {}
    const conflictsBySeverity: Record<string, number> = {}
    
    for (const conflict of this.conflictHistory) {
      conflictsByType[conflict.type] = (conflictsByType[conflict.type] || 0) + 1
      conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1
    }

    return {
      totalConflicts: this.conflictHistory.length,
      conflictsByType,
      conflictsBySeverity,
      recentConflicts: this.conflictHistory.slice(-10)
    }
  }

  // Private helper methods for specific conflict resolutions

  private resolveStartDrawingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.editingObjectId) {
      return {
        success: false,
        conflict,
        resolution: 'End text editing before starting new drawing',
        newState: {
          editingObjectId: null,
          isDrawing: true
        }
      }
    }

    if (currentState.isMultiSelecting) {
      return {
        success: false,
        conflict,
        resolution: 'End multi-selection before starting new drawing',
        newState: {
          isMultiSelecting: false,
          selectedObjectIds: new Set(),
          isDrawing: true
        }
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Drawing can start'
    }
  }

  private resolveEndDrawingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    return {
      success: true,
      conflict: null,
      resolution: 'Drawing ended successfully',
      newState: {
        isDrawing: false,
        selectedTool: null
      }
    }
  }

  private resolveContinueDrawingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.editingObjectId) {
      return {
        success: false,
        conflict,
        resolution: 'Cannot continue drawing while editing text'
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Drawing can continue'
    }
  }

  private resolveStartTextEditingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.isDrawing) {
      return {
        success: false,
        conflict,
        resolution: 'End current drawing before starting text editing',
        newState: {
          isDrawing: false,
          selectedTool: null
        }
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Text editing can start'
    }
  }

  private resolveEndTextEditingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    return {
      success: true,
      conflict: null,
      resolution: 'Text editing ended successfully',
      newState: {
        editingObjectId: null
      }
    }
  }

  private resolveContinueTextEditingConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.isDrawing) {
      return {
        success: false,
        conflict,
        resolution: 'Cannot continue text editing while drawing'
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Text editing can continue'
    }
  }

  private resolveStartMultiSelectionConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.isDrawing) {
      return {
        success: false,
        conflict,
        resolution: 'End current drawing before starting multi-selection',
        newState: {
          isDrawing: false,
          selectedTool: null
        }
      }
    }

    if (currentState.editingObjectId) {
      return {
        success: false,
        conflict,
        resolution: 'End text editing before starting multi-selection',
        newState: {
          editingObjectId: null
        }
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Multi-selection can start'
    }
  }

  private resolveEndMultiSelectionConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    return {
      success: true,
      conflict: null,
      resolution: 'Multi-selection ended successfully',
      newState: {
        isMultiSelecting: false,
        selectedObjectIds: new Set()
      }
    }
  }

  private resolveContinueMultiSelectionConflict(
    currentState: UIStateSnapshot,
    conflict: UIStateConflict
  ): ConflictResolutionResult {
    if (currentState.isDrawing) {
      return {
        success: false,
        conflict,
        resolution: 'Cannot continue multi-selection while drawing'
      }
    }

    if (currentState.editingObjectId) {
      return {
        success: false,
        conflict,
        resolution: 'Cannot continue multi-selection while editing text'
      }
    }

    return {
      success: true,
      conflict: null,
      resolution: 'Multi-selection can continue'
    }
  }
}

// Export singleton instance
export const uiStateConflictResolutionService = new UIStateConflictResolutionService()
