/**
 * Event handler types to replace 'any' usage in event handlers
 */

// Konva/Konva.js event types - using a more flexible approach
export interface KonvaEvent {
  target: {
    getStage: () => KonvaStage | null;
    getParent: () => KonvaNode | null;
    getAbsolutePosition: () => { x: number; y: number };
    getAbsoluteScale: () => { x: number; y: number };
    getSize: () => { width: number; height: number };
    getAttrs: () => Record<string, unknown>;
    setAttrs: (attrs: Record<string, unknown>) => void;
    destroy: () => void;
  };
  evt: MouseEvent | TouchEvent | KeyboardEvent;
  type: string;
  cancelBubble: boolean;
  currentTarget: KonvaNode | null;
}

export interface KonvaStage {
  getPointerPosition: () => { x: number; y: number } | null;
  getAbsolutePosition: () => { x: number; y: number };
  getAbsoluteScale: () => { x: number; y: number };
  getSize: () => { width: number; height: number };
  getStage: () => KonvaStage;
  getParent: () => KonvaNode | null;
  getAttrs: () => Record<string, unknown>;
  setAttrs: (attrs: Record<string, unknown>) => void;
  destroy: () => void;
}

export interface KonvaNode {
  getStage: () => KonvaStage | null;
  getParent: () => KonvaNode | null;
  getAbsolutePosition: () => { x: number; y: number };
  getAbsoluteScale: () => { x: number; y: number };
  getSize: () => { width: number; height: number };
  getAttrs: () => Record<string, unknown>;
  setAttrs: (attrs: Record<string, unknown>) => void;
  destroy: () => void;
  id: () => string;
  name: () => string;
}

// Mouse and touch event types
export interface CanvasMouseEvent extends KonvaEvent {
  evt: MouseEvent;
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'click' | 'dblclick' | 'contextmenu';
}

export interface CanvasTouchEvent extends KonvaEvent {
  evt: TouchEvent;
  type: 'touchstart' | 'touchend' | 'touchmove';
}

export interface CanvasKeyboardEvent extends KonvaEvent {
  evt: KeyboardEvent;
  type: 'keydown' | 'keyup' | 'keypress';
}

// Canvas interaction event types
export interface ObjectSelectEvent extends CanvasMouseEvent {
  objectId: string;
  objectType: string;
  objectData: Record<string, unknown>;
}

export interface ObjectResizeEvent extends CanvasMouseEvent {
  objectId: string;
  newProperties: {
    width: number;
    height: number;
    x: number;
    y: number;
    scaleX?: number;
    scaleY?: number;
  };
}

export interface ObjectMoveEvent extends CanvasMouseEvent {
  objectId: string;
  newPosition: { x: number; y: number };
  delta: { x: number; y: number };
}

export interface ObjectRotateEvent extends CanvasMouseEvent {
  objectId: string;
  newRotation: number;
  delta: number;
}

// Cursor and hover event types
export interface CursorHoverEvent extends CanvasMouseEvent {
  cursor: {
    user_id: string;
    user_name: string;
    position: { x: number; y: number };
    timestamp: number;
  };
  tooltip: {
    x: number;
    y: number;
    content: string;
  };
}

// Stage interaction event types
export interface StageClickEvent extends Omit<CanvasMouseEvent, 'target'> {
  target: KonvaStage;
  emptySpace: boolean;
}

export interface StageMouseMoveEvent extends Omit<CanvasMouseEvent, 'target'> {
  target: KonvaStage;
  pointerPosition: { x: number; y: number };
}

// Generic event handler types
export type EventHandler<T extends KonvaEvent = KonvaEvent> = (event: T) => void;
export type AsyncEventHandler<T extends KonvaEvent = KonvaEvent> = (event: T) => Promise<void>;

// Specific event handler types
export type ObjectEventHandler = (objectId: string, event: KonvaEvent) => void;
export type StageEventHandler = (event: KonvaEvent) => void;
export type CursorEventHandler = (cursor: CursorHoverEvent['cursor'], event: KonvaEvent) => void;
