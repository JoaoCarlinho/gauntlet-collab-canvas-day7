import React, { useEffect, useRef } from 'react'
import { Copy, Scissors, Clipboard, RotateCcw, RotateCw, Trash2, Square } from 'lucide-react'

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  onClose: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  canCopy: boolean
  canCut: boolean
  canPaste: boolean
  canDuplicate: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  canCopy,
  canCut,
  canPaste,
  canDuplicate,
  canDelete,
  canUndo,
  canRedo
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  const menuItems = [
    {
      icon: Copy,
      label: 'Copy',
      shortcut: 'Ctrl+C',
      onClick: onCopy,
      disabled: !canCopy
    },
    {
      icon: Scissors,
      label: 'Cut',
      shortcut: 'Ctrl+X',
      onClick: onCut,
      disabled: !canCut
    },
    {
      icon: Clipboard,
      label: 'Paste',
      shortcut: 'Ctrl+V',
      onClick: onPaste,
      disabled: !canPaste
    },
    {
      icon: Square,
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      onClick: onDuplicate,
      disabled: !canDuplicate
    },
    { type: 'separator' },
    {
      icon: RotateCcw,
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      onClick: onUndo,
      disabled: !canUndo
    },
    {
      icon: RotateCw,
      label: 'Redo',
      shortcut: 'Ctrl+Y',
      onClick: onRedo,
      disabled: !canRedo
    },
    { type: 'separator' },
    {
      icon: Trash2,
      label: 'Delete',
      shortcut: 'Del',
      onClick: onDelete,
      disabled: !canDelete,
      className: 'text-red-600 hover:text-red-700'
    }
  ]

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -10px)'
      }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return (
            <div key={index} className="border-t border-gray-100 my-1" />
          )
        }

        const Icon = item.icon
        return (
          <button
            key={index}
            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${item.className || ''}`}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick()
                onClose()
              }
            }}
            disabled={item.disabled}
          >
            <div className="flex items-center">
              {Icon && <Icon size={16} className="mr-3" />}
              <span>{item.label}</span>
            </div>
            <span className="text-xs text-gray-500 ml-4">{item.shortcut}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ContextMenu
