import { useState, useCallback, useRef, useEffect } from 'react'
import { CanvasObject } from '../types'

export interface HistoryState {
  objects: CanvasObject[]
  timestamp: number
  action: string
  description?: string
}

export interface UndoRedoState {
  canUndo: boolean
  canRedo: boolean
  currentIndex: number
  historyLength: number
  lastAction: string | null
}

export interface UndoRedoActions {
  saveState: (objects: CanvasObject[], action: string, description?: string) => void
  undo: () => CanvasObject[] | null
  redo: () => CanvasObject[] | null
  clearHistory: () => void
  getHistory: () => HistoryState[]
  jumpToState: (index: number) => CanvasObject[] | null
}

export const useUndoRedo = (
  maxHistorySize = 50,
  debounceMs = 500
): [UndoRedoState, UndoRedoActions] => {
  const [history, setHistory] = useState<HistoryState[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedStateRef = useRef<string | null>(null)

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1
  const lastAction = history[currentIndex]?.action || null

  const saveState = useCallback((
    objects: CanvasObject[],
    action: string,
    description?: string
  ) => {
    // Clear any pending debounced save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Create a serialized version to check for changes
    const serializedState = JSON.stringify(objects.map(obj => ({
      id: obj.id,
      object_type: obj.object_type,
      properties: obj.properties
    })))

    // Skip if state hasn't changed
    if (lastSavedStateRef.current === serializedState) {
      return
    }

    // Debounce rapid changes
    debounceTimerRef.current = setTimeout(() => {
      const newState: HistoryState = {
        objects: objects.map(obj => ({ ...obj })), // Deep copy
        timestamp: Date.now(),
        action,
        description
      }

      setHistory(prev => {
        // Remove any states after current index (when branching)
        const newHistory = prev.slice(0, currentIndex + 1)
        
        // Add new state
        newHistory.push(newState)
        
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift()
        } else {
          setCurrentIndex(prev => prev + 1)
        }
        
        return newHistory
      })

      lastSavedStateRef.current = serializedState
    }, debounceMs)
  }, [currentIndex, maxHistorySize, debounceMs])

  const undo = useCallback((): CanvasObject[] | null => {
    if (!canUndo) return null

    const newIndex = currentIndex - 1
    setCurrentIndex(newIndex)
    
    const state = history[newIndex]
    return state ? state.objects.map(obj => ({ ...obj })) : null
  }, [canUndo, currentIndex, history])

  const redo = useCallback((): CanvasObject[] | null => {
    if (!canRedo) return null

    const newIndex = currentIndex + 1
    setCurrentIndex(newIndex)
    
    const state = history[newIndex]
    return state ? state.objects.map(obj => ({ ...obj })) : null
  }, [canRedo, currentIndex, history])

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentIndex(-1)
    lastSavedStateRef.current = null
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const getHistory = useCallback(() => {
    return history.map((state, index) => ({
      ...state,
      isCurrent: index === currentIndex
    }))
  }, [history, currentIndex])

  const jumpToState = useCallback((index: number): CanvasObject[] | null => {
    if (index < 0 || index >= history.length) return null

    setCurrentIndex(index)
    const state = history[index]
    return state ? state.objects.map(obj => ({ ...obj })) : null
  }, [history])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const state: UndoRedoState = {
    canUndo,
    canRedo,
    currentIndex,
    historyLength: history.length,
    lastAction
  }

  const actions: UndoRedoActions = {
    saveState,
    undo,
    redo,
    clearHistory,
    getHistory,
    jumpToState
  }

  return [state, actions]
}

// Keyboard shortcuts hook
export const useUndoRedoShortcuts = (
  undo: () => void,
  redo: () => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z (undo) or Ctrl/Cmd + Y (redo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'z') {
          e.preventDefault()
          undo()
        } else if (e.key === 'y') {
          e.preventDefault()
          redo()
        }
      }
      // Check for Ctrl/Cmd + Shift + Z (redo on some systems)
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, enabled])
}
