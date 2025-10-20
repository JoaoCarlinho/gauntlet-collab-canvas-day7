/**
 * Canvas-specific types to replace 'any' usage in canvas operations
 */

// Import the main types from index.ts to avoid duplication
import type { CanvasObject, CanvasObjectProperties } from './index';

// Canvas object types
export type CanvasObjectType = 
  | 'rectangle' 
  | 'circle' 
  | 'text' 
  | 'heart' 
  | 'star' 
  | 'diamond' 
  | 'line' 
  | 'arrow'
  | 'polygon'
  | 'ellipse'
  | 'image'
  | 'group';

// Canvas object interface (using the main CanvasObject from index.ts)
// This is just for reference - the actual CanvasObject is defined in index.ts

// Canvas operation types
export type CanvasOperationType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'move' 
  | 'resize' 
  | 'rotate' 
  | 'duplicate'
  | 'group'
  | 'ungroup'
  | 'bring_to_front'
  | 'send_to_back'
  | 'bring_forward'
  | 'send_backward';

// Canvas operation interface
export interface CanvasOperation {
  id: string;
  type: CanvasOperationType;
  objectId: string;
  canvasId: string;
  userId: string;
  timestamp: number;
  data: Partial<CanvasObjectProperties>;
  metadata?: Record<string, unknown>;
  version?: number;
}

// Canvas state interface (extending the main one)
export interface CanvasStateExtended {
  id: string;
  title: string;
  description?: string;
  objects: CanvasObject[];
  cursors: Array<{
    userId: string;
    userName: string;
    position: { x: number; y: number };
    timestamp: number;
  }>;
  onlineUsers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    avatarUrl?: string;
    timestamp: number;
  }>;
  selectedObjectId: string | null;
  isDragging: boolean;
  zoom: number;
  pan: { x: number; y: number };
  lastModified: string;
  version: number;
}

// Canvas tool types
export interface CanvasTool {
  id: string;
  name: string;
  icon: string;
  category: 'select' | 'shapes' | 'drawing' | 'text' | 'annotation' | 'utilities' | 'ai';
  isActive: boolean;
  isEnabled: boolean;
  properties: Partial<CanvasObjectProperties>;
  cursor?: string;
  shortcut?: string;
}

// Canvas selection interface
export interface CanvasSelection {
  objectIds: string[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isMultiSelect: boolean;
  lastSelectedId: string | null;
}

// Canvas viewport interface
export interface CanvasViewport {
  zoom: number;
  pan: { x: number; y: number };
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: { x: number; y: number };
}

// Canvas history interface
export interface CanvasHistory {
  operations: CanvasOperation[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  maxHistorySize: number;
}

// Canvas collaboration interface
export interface CanvasCollaboration {
  onlineUsers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    avatarUrl?: string;
    cursor?: { x: number; y: number };
    isTyping?: boolean;
    lastSeen: number;
  }>;
  cursors: Array<{
    userId: string;
    userName: string;
    position: { x: number; y: number };
    timestamp: number;
  }>;
  permissions: {
    canEdit: boolean;
    canView: boolean;
    canInvite: boolean;
    canDelete: boolean;
  };
}

// Canvas performance metrics
export interface CanvasPerformanceMetrics {
  renderTime: number;
  objectCount: number;
  memoryUsage: number;
  fps: number;
  lastUpdate: number;
}

// Canvas error types
export interface CanvasError {
  type: 'render' | 'operation' | 'sync' | 'validation';
  message: string;
  objectId?: string;
  operation?: CanvasOperation;
  timestamp: number;
  stack?: string;
}

// Canvas event types
export interface CanvasEvent {
  type: 'object_selected' | 'object_deselected' | 'object_modified' | 'canvas_modified' | 'tool_changed' | 'viewport_changed';
  objectId?: string;
  objectType?: CanvasObjectType;
  properties?: Partial<CanvasObjectProperties>;
  timestamp: number;
  userId?: string;
}

// Canvas service interfaces
export interface CanvasServiceInterface {
  createObject(object: Omit<CanvasObject, 'id' | 'created_at' | 'updated_at'>): Promise<CanvasObject>;
  updateObject(objectId: string, properties: Partial<CanvasObjectProperties>): Promise<CanvasObject>;
  deleteObject(objectId: string): Promise<void>;
  getObject(objectId: string): Promise<CanvasObject | null>;
  getObjects(canvasId: string): Promise<CanvasObject[]>;
  getCanvasState(canvasId: string): Promise<CanvasStateExtended>;
  updateCanvasState(canvasId: string, state: Partial<CanvasStateExtended>): Promise<CanvasStateExtended>;
  validateObject(object: CanvasObject): boolean;
  sanitizeProperties(properties: Record<string, unknown>): CanvasObjectProperties;
}
