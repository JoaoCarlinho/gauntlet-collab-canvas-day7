import React from 'react'
import { CanvasObject } from '../types'
import { getZIndexDisplayInfo } from '../utils/zIndexManager'
import { ArrowUp, ArrowDown, MoveUp, MoveDown, Eye } from 'lucide-react'

interface LayerManagementPanelProps {
  objects: CanvasObject[]
  selectedObjectId: string | null
  onObjectSelect: (objectId: string) => void
  onBringToFront: (objectId: string) => void
  onSendToBack: (objectId: string) => void
  onMoveUp: (objectId: string) => void
  onMoveDown: (objectId: string) => void
  onToggleVisibility?: (objectId: string) => void
  isVisible?: boolean
  onClose?: () => void
}

const LayerManagementPanel: React.FC<LayerManagementPanelProps> = ({
  objects,
  selectedObjectId,
  onObjectSelect,
  onBringToFront,
  onSendToBack,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  isVisible = false,
  onClose
}) => {
  if (!isVisible) return null

  // Sort objects by z-index (highest first for display)
  const sortedObjects = [...objects].sort((a, b) => (b.z_index || 0) - (a.z_index || 0))

  const getObjectIcon = (objectType: string) => {
    switch (objectType) {
      case 'rectangle': return '▭'
      case 'circle': return '●'
      case 'text': return 'T'
      case 'heart': return '♥'
      case 'star': return '★'
      case 'diamond': return '◆'
      case 'line': return '─'
      case 'arrow': return '→'
      default: return '?'
    }
  }

  const getObjectColor = (object: CanvasObject) => {
    const fill = object.properties.fill
    if (fill && typeof fill === 'string') {
      return fill
    }
    return '#6b7280' // Default gray
  }

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-hidden z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Layer Management</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sortedObjects.map((object, index) => {
          const isSelected = object.id === selectedObjectId
          const zIndexInfo = getZIndexDisplayInfo(objects, object.id)
          const isTop = index === 0
          const isBottom = index === sortedObjects.length - 1

          return (
            <div
              key={object.id}
              className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onObjectSelect(object.id)}
            >
              {/* Object Icon */}
              <div 
                className="w-6 h-6 rounded flex items-center justify-center text-white text-sm font-bold mr-3"
                style={{ backgroundColor: getObjectColor(object) }}
              >
                {getObjectIcon(object.object_type)}
              </div>

              {/* Object Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {object.object_type.charAt(0).toUpperCase() + object.object_type.slice(1)}
                </div>
                <div className="text-xs text-gray-500">
                  Layer {zIndexInfo?.layer || 1} of {zIndexInfo?.totalLayers || 1}
                </div>
              </div>

              {/* Layer Controls */}
              <div className="flex items-center space-x-1">
                {/* Visibility Toggle */}
                {onToggleVisibility && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVisibility(object.id)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Toggle visibility"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}

                {/* Layer Management Buttons */}
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onBringToFront(object.id)
                    }}
                    disabled={isTop}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Bring to front"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveUp(object.id)
                    }}
                    disabled={isTop}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <MoveUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveDown(object.id)
                    }}
                    disabled={isBottom}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <MoveDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSendToBack(object.id)
                    }}
                    disabled={isBottom}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Send to back"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Layer Statistics */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          {objects.length} object{objects.length !== 1 ? 's' : ''} • 
          Z-index range: {Math.min(...objects.map(o => o.z_index || 0))} - {Math.max(...objects.map(o => o.z_index || 0))}
        </div>
      </div>
    </div>
  )
}

export default LayerManagementPanel
