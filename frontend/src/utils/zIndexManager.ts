import { CanvasObject } from '../types'

export type ZIndexBehavior = 'top' | 'bottom' | 'smart'

export interface ZIndexManager {
  getNextZIndex(objects: CanvasObject[]): number
  getPreviousZIndex(objects: CanvasObject[]): number
  calculateZIndex(
    objects: CanvasObject[], 
    position: { x: number; y: number }, 
    behavior: ZIndexBehavior
  ): number
  bringToFront(objects: CanvasObject[], objectId: string): CanvasObject[]
  sendToBack(objects: CanvasObject[], objectId: string): CanvasObject[]
  moveUp(objects: CanvasObject[], objectId: string): CanvasObject[]
  moveDown(objects: CanvasObject[], objectId: string): CanvasObject[]
  sortObjectsByZIndex(objects: CanvasObject[]): CanvasObject[]
}

export class ZIndexManagerImpl implements ZIndexManager {
  private readonly OVERLAP_THRESHOLD = 50

  /**
   * Get the next highest z-index for a new object
   */
  getNextZIndex(objects: CanvasObject[]): number {
    if (objects.length === 0) return 0
    return Math.max(...objects.map(obj => obj.z_index || 0)) + 1
  }

  /**
   * Get the previous lowest z-index for a new object
   */
  getPreviousZIndex(objects: CanvasObject[]): number {
    if (objects.length === 0) return 0
    return Math.min(...objects.map(obj => obj.z_index || 0)) - 1
  }

  /**
   * Calculate z-index for a new object based on behavior and position
   */
  calculateZIndex(
    objects: CanvasObject[], 
    position: { x: number; y: number }, 
    behavior: ZIndexBehavior = 'top'
  ): number {
    if (objects.length === 0) return 0

    const overlappingObjects = this.findOverlappingObjects(objects, position)
    
    switch (behavior) {
      case 'top':
        return this.getNextZIndex(objects)
      
      case 'bottom':
        return this.getPreviousZIndex(objects)
      
      case 'smart':
        if (overlappingObjects.length > 0) {
          const maxOverlappingZ = Math.max(...overlappingObjects.map(obj => obj.z_index || 0))
          return maxOverlappingZ + 1
        } else {
          return this.getNextZIndex(objects)
        }
      
      default:
        return this.getNextZIndex(objects)
    }
  }

  /**
   * Bring an object to the front (highest z-index)
   */
  bringToFront(objects: CanvasObject[], objectId: string): CanvasObject[] {
    const maxZIndex = this.getNextZIndex(objects)
    return objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, z_index: maxZIndex }
        : obj
    )
  }

  /**
   * Send an object to the back (lowest z-index)
   */
  sendToBack(objects: CanvasObject[], objectId: string): CanvasObject[] {
    const minZIndex = this.getPreviousZIndex(objects)
    return objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, z_index: minZIndex }
        : obj
    )
  }

  /**
   * Move an object up one layer
   */
  moveUp(objects: CanvasObject[], objectId: string): CanvasObject[] {
    return objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, z_index: (obj.z_index || 0) + 1 }
        : obj
    )
  }

  /**
   * Move an object down one layer
   */
  moveDown(objects: CanvasObject[], objectId: string): CanvasObject[] {
    return objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, z_index: (obj.z_index || 0) - 1 }
        : obj
    )
  }

  /**
   * Sort objects by z-index (lowest to highest for rendering order)
   */
  sortObjectsByZIndex(objects: CanvasObject[]): CanvasObject[] {
    return [...objects].sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
  }

  /**
   * Find objects that overlap with the given position
   */
  private findOverlappingObjects(
    objects: CanvasObject[], 
    position: { x: number; y: number }
  ): CanvasObject[] {
    return objects.filter(obj => {
      const objPosition = this.extractPosition(obj.properties)
      if (!objPosition) return false
      
      return this.isOverlapping(position, objPosition, this.OVERLAP_THRESHOLD)
    })
  }

  /**
   * Extract position from object properties
   */
  private extractPosition(properties: any): { x: number; y: number } | null {
    if (properties.x !== undefined && properties.y !== undefined) {
      return { x: properties.x, y: properties.y }
    }
    if (properties.x1 !== undefined && properties.y1 !== undefined) {
      return { x: properties.x1, y: properties.y1 }
    }
    return null
  }

  /**
   * Check if two positions are overlapping within threshold
   */
  private isOverlapping(
    pos1: { x: number; y: number }, 
    pos2: { x: number; y: number }, 
    threshold: number
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    )
    return distance < threshold
  }
}

// Export singleton instance
export const zIndexManager = new ZIndexManagerImpl()

// Export utility functions
export const createObjectWithZIndex = (
  objectType: string,
  position: { x: number; y: number },
  properties: any = {},
  zIndexBehavior: ZIndexBehavior = 'top',
  existingObjects: CanvasObject[] = []
): Partial<CanvasObject> => {
  const zIndex = zIndexManager.calculateZIndex(existingObjects, position, zIndexBehavior)
  
  return {
    object_type: objectType as any,
    properties: {
      x: position.x,
      y: position.y,
      ...properties
    },
    z_index: zIndex
  }
}

export const getZIndexDisplayInfo = (objects: CanvasObject[], objectId: string) => {
  const object = objects.find(obj => obj.id === objectId)
  if (!object) return null
  
  const sortedObjects = zIndexManager.sortObjectsByZIndex(objects)
  const index = sortedObjects.findIndex(obj => obj.id === objectId)
  const total = sortedObjects.length
  
  return {
    zIndex: object.z_index || 0,
    layer: index + 1,
    totalLayers: total,
    isTop: index === total - 1,
    isBottom: index === 0
  }
}
