import { useState, useCallback, useRef } from 'react'
import { CanvasObject } from '../types'

export interface ClipboardState {
  copiedObjects: CanvasObject[]
  hasCopiedObjects: boolean
}

export interface ClipboardActions {
  copyObjects: (objects: CanvasObject[]) => void
  pasteObjects: (offsetX?: number, offsetY?: number) => CanvasObject[]
  cutObjects: (objects: CanvasObject[]) => CanvasObject[]
  clearClipboard: () => void
  duplicateObjects: (objects: CanvasObject[], offsetX?: number, offsetY?: number) => CanvasObject[]
}

export const useClipboard = (): [ClipboardState, ClipboardActions] => {
  const [copiedObjects, setCopiedObjects] = useState<CanvasObject[]>([])
  const clipboardRef = useRef<CanvasObject[]>([])

  const copyObjects = useCallback((objects: CanvasObject[]) => {
    if (objects.length === 0) return

    // Create deep copies of the objects with new IDs
    const copiedObjects = objects.map(obj => ({
      ...obj,
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      properties: {
        ...obj.properties,
        // Add a small offset for visual feedback
        x: obj.properties.x + 10,
        y: obj.properties.y + 10
      }
    }))

    setCopiedObjects(copiedObjects)
    clipboardRef.current = copiedObjects

    // Also copy to system clipboard as JSON
    try {
      const clipboardData = {
        type: 'collabcanvas-objects',
        version: '1.0',
        objects: copiedObjects.map(obj => ({
          object_type: obj.object_type,
          properties: obj.properties
        }))
      }
      navigator.clipboard.writeText(JSON.stringify(clipboardData))
    } catch (error) {
      console.warn('Failed to copy to system clipboard:', error)
    }
  }, [])

  const pasteObjects = useCallback((offsetX = 20, offsetY = 20): CanvasObject[] => {
    if (copiedObjects.length === 0) return []

    // Create new objects with fresh IDs and offset positions
    const pastedObjects = copiedObjects.map((obj, index) => ({
      ...obj,
      id: `pasted_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      properties: {
        ...obj.properties,
        x: obj.properties.x + offsetX,
        y: obj.properties.y + offsetY
      }
    }))

    return pastedObjects
  }, [copiedObjects])

  const cutObjects = useCallback((objects: CanvasObject[]): CanvasObject[] => {
    if (objects.length === 0) return []

    // Copy the objects first
    copyObjects(objects)

    // Return the original objects for removal
    return objects
  }, [copyObjects])

  const clearClipboard = useCallback(() => {
    setCopiedObjects([])
    clipboardRef.current = []
  }, [])

  const duplicateObjects = useCallback((objects: CanvasObject[], offsetX = 20, offsetY = 20): CanvasObject[] => {
    if (objects.length === 0) return []

    // Create duplicates with new IDs and offset positions
    const duplicatedObjects = objects.map((obj, index) => ({
      ...obj,
      id: `duplicated_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      properties: {
        ...obj.properties,
        x: obj.properties.x + offsetX,
        y: obj.properties.y + offsetY
      }
    }))

    return duplicatedObjects
  }, [])

  const state: ClipboardState = {
    copiedObjects,
    hasCopiedObjects: copiedObjects.length > 0
  }

  const actions: ClipboardActions = {
    copyObjects,
    pasteObjects,
    cutObjects,
    clearClipboard,
    duplicateObjects
  }

  return [state, actions]
}

// Utility function to paste from system clipboard
export const pasteFromSystemClipboard = async (): Promise<CanvasObject[]> => {
  try {
    const clipboardText = await navigator.clipboard.readText()
    const clipboardData = JSON.parse(clipboardText)
    
    if (clipboardData.type === 'collabcanvas-objects' && clipboardData.objects) {
      return clipboardData.objects.map((objData: any, index: number) => ({
        id: `pasted_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        object_type: objData.object_type,
        properties: objData.properties,
        canvas_id: '', // Will be set by the parent component
        user_id: '', // Will be set by the parent component
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    }
  } catch (error) {
    console.warn('Failed to paste from system clipboard:', error)
  }
  
  return []
}
