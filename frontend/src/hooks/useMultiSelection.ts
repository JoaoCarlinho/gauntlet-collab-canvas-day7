import { useState, useCallback, useEffect } from 'react'
import { CanvasObject } from '../types'

export interface MultiSelectionState {
  selectedObjectIds: Set<string>
  isMultiSelecting: boolean
  selectionBox: {
    startX: number
    startY: number
    endX: number
    endY: number
  } | null
}

export interface MultiSelectionActions {
  selectObject: (objectId: string, addToSelection?: boolean) => void
  deselectObject: (objectId: string) => void
  clearSelection: () => void
  selectAll: () => void
  startSelectionBox: (x: number, y: number) => void
  updateSelectionBox: (x: number, y: number) => void
  endSelectionBox: () => void
  isObjectSelected: (objectId: string) => boolean
  getSelectedObjects: () => CanvasObject[]
  getSelectionBounds: () => { x: number; y: number; width: number; height: number } | null
}

export const useMultiSelection = (
  objects: CanvasObject[],
  onSelectionChange?: (selectedIds: string[]) => void
): [MultiSelectionState, MultiSelectionActions] => {
  const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set())
  const [isMultiSelecting, setIsMultiSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
  } | null>(null)
  

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedObjectIds))
    }
  }, [selectedObjectIds, onSelectionChange])

  const selectObject = useCallback((objectId: string, addToSelection = false) => {
    setSelectedObjectIds(prev => {
      const newSet = new Set(prev)
      if (addToSelection) {
        newSet.add(objectId)
      } else {
        newSet.clear()
        newSet.add(objectId)
      }
      return newSet
    })
  }, [])

  const deselectObject = useCallback((objectId: string) => {
    setSelectedObjectIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(objectId)
      return newSet
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedObjectIds(new Set())
  }, [])

  const selectAll = useCallback(() => {
    setSelectedObjectIds(new Set(objects.map(obj => obj.id)))
  }, [objects])

  const startSelectionBox = useCallback((x: number, y: number) => {
    setIsMultiSelecting(true)
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y })
  }, [])

  const updateSelectionBox = useCallback((x: number, y: number) => {
    if (isMultiSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null)
    }
  }, [isMultiSelecting, selectionBox])

  const endSelectionBox = useCallback(() => {
    if (!isMultiSelecting || !selectionBox) return

    const { startX, startY, endX, endY } = selectionBox
    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)
    const minY = Math.min(startY, endY)
    const maxY = Math.max(startY, endY)

    // Find objects that intersect with the selection box
    const intersectingObjects = objects.filter(obj => {
      const props = obj.properties
      let objBounds = { x: 0, y: 0, width: 0, height: 0 }

      switch (obj.object_type) {
        case 'rectangle':
          objBounds = { x: props.x, y: props.y, width: props.width, height: props.height }
          break
        case 'circle':
          objBounds = {
            x: props.x - props.radius,
            y: props.y - props.radius,
            width: props.radius * 2,
            height: props.radius * 2
          }
          break
        case 'text': {
          const textWidth = props.text.length * props.fontSize * 0.6
          const textHeight = props.fontSize * 1.2
          objBounds = { x: props.x, y: props.y, width: textWidth, height: textHeight }
          break
        }
        default:
          return false
      }

      // Check if object bounds intersect with selection box
      return !(
        objBounds.x + objBounds.width < minX ||
        objBounds.x > maxX ||
        objBounds.y + objBounds.height < minY ||
        objBounds.y > maxY
      )
    })

    // Add intersecting objects to selection
    setSelectedObjectIds(prev => {
      const newSet = new Set(prev)
      intersectingObjects.forEach(obj => newSet.add(obj.id))
      return newSet
    })

    setIsMultiSelecting(false)
    setSelectionBox(null)
  }, [isMultiSelecting, selectionBox, objects])

  const isObjectSelected = useCallback((objectId: string) => {
    return selectedObjectIds.has(objectId)
  }, [selectedObjectIds])

  const getSelectedObjects = useCallback(() => {
    return objects.filter(obj => selectedObjectIds.has(obj.id))
  }, [objects, selectedObjectIds])

  const getSelectionBounds = useCallback(() => {
    const selectedObjects = getSelectedObjects()
    if (selectedObjects.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    selectedObjects.forEach(obj => {
      const props = obj.properties
      let bounds = { x: 0, y: 0, width: 0, height: 0 }

      switch (obj.object_type) {
        case 'rectangle':
          bounds = { x: props.x, y: props.y, width: props.width, height: props.height }
          break
        case 'circle':
          bounds = {
            x: props.x - props.radius,
            y: props.y - props.radius,
            width: props.radius * 2,
            height: props.radius * 2
          }
          break
        case 'text': {
          const textWidth = props.text.length * props.fontSize * 0.6
          const textHeight = props.fontSize * 1.2
          bounds = { x: props.x, y: props.y, width: textWidth, height: textHeight }
          break
        }
      }

      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    })

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }, [getSelectedObjects])

  const state: MultiSelectionState = {
    selectedObjectIds,
    isMultiSelecting,
    selectionBox
  }

  const actions: MultiSelectionActions = {
    selectObject,
    deselectObject,
    clearSelection,
    selectAll,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    isObjectSelected,
    getSelectedObjects,
    getSelectionBounds
  }

  return [state, actions]
}
