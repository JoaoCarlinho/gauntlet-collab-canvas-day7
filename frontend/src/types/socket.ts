/**
 * Socket event types to replace 'any' usage in socket services
 */

import { CursorData } from './index';

// Socket connection states
export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Socket connection quality levels
export type SocketConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';

// Socket event types
export interface SocketEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  canvasId?: string;
  eventId?: string;
}

// Canvas-specific socket events
export interface CanvasObjectEvent extends SocketEvent {
  type: 'object_created' | 'object_updated' | 'object_deleted' | 'object_moved' | 'object_resized';
  payload: {
    objectId: string;
    objectType: string;
    properties: Record<string, unknown>;
    userId: string;
    canvasId: string;
    timestamp: number;
  };
}

export interface CursorEvent extends SocketEvent {
  type: 'cursor_move' | 'cursor_enter' | 'cursor_leave';
  payload: {
    cursor: CursorData;
    canvasId: string;
  };
}

export interface UserPresenceEvent extends SocketEvent {
  type: 'user_joined' | 'user_left' | 'user_typing' | 'user_stopped_typing';
  payload: {
    userId: string;
    userName: string;
    userEmail: string;
    avatarUrl?: string;
    canvasId: string;
    timestamp: number;
  };
}

export interface CanvasStateEvent extends SocketEvent {
  type: 'canvas_state_sync' | 'canvas_state_request' | 'canvas_state_response';
  payload: {
    canvasId: string;
    objects: Array<{
      id: string;
      type: string;
      properties: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }>;
    cursors: CursorData[];
    onlineUsers: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      avatarUrl?: string;
      timestamp: number;
    }>;
    timestamp: number;
  };
}

export interface ConnectionEvent extends SocketEvent {
  type: 'connection_status' | 'connection_quality' | 'connection_error';
  payload: {
    status: SocketConnectionState;
    quality?: SocketConnectionQuality;
    error?: {
      message: string;
      code: string;
      timestamp: number;
    };
    latency?: number;
    timestamp: number;
  };
}

export interface OfflineEvent extends SocketEvent {
  type: 'offline_mode' | 'sync_complete' | 'sync_failed' | 'conflict_detected';
  payload: {
    isOffline: boolean;
    pendingOperations?: Array<{
      id: string;
      type: string;
      data: Record<string, unknown>;
      timestamp: number;
    }>;
    syncedCount?: number;
    conflictCount?: number;
    error?: {
      message: string;
      code: string;
    };
    timestamp: number;
  };
}

export interface VisibilityEvent extends SocketEvent {
  type: 'visibility_recovery_success' | 'visibility_recovery_failed';
  payload: {
    canvasId: string;
    recoveredObjects?: number;
    missingObjects?: string[];
    error?: {
      message: string;
      code: string;
    };
    timestamp: number;
  };
}

// Socket service configuration
export interface SocketConfig {
  forceNew: boolean;
  withCredentials: boolean;
  extraHeaders: Record<string, string>;
  transports: string[];
  timeout: number;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  maxReconnectionAttempts: number;
  auth?: {
    token: string;
  };
}

// Socket service state
export interface SocketServiceState {
  connectionState: SocketConnectionState;
  connectionAttempts: number;
  lastConnectionTime: number | null;
  connectionQuality: SocketConnectionQuality;
  isDebugMode: boolean;
}

// Socket event listener types
export type SocketEventListener<T extends SocketEvent = SocketEvent> = (event: T) => void;
export type SocketErrorListener = (error: Error) => void;
export type SocketConnectionListener = (state: SocketConnectionState) => void;
export type SocketQualityListener = (quality: SocketConnectionQuality) => void;

// Socket service methods
export interface SocketServiceInterface {
  connect(idToken?: string): void;
  disconnect(): void;
  emit(event: string, data: Record<string, unknown>): void;
  on<T extends SocketEvent>(event: string, listener: SocketEventListener<T>): void;
  off(event: string, listener: SocketEventListener): void;
  getConnectionState(): SocketConnectionState;
  getConnectionQuality(): SocketConnectionQuality;
  isConnected(): boolean;
  optimizeEmit(event: string, data: Record<string, unknown>, priority?: 'low' | 'normal' | 'high' | 'critical'): void;
  updateOptimizationConfig(config: Record<string, unknown>): void;
  backupObjectState(canvasId: string, objects: Array<Record<string, unknown>>): void;
  validateObjectStateConsistency(canvasId: string, expectedObjects: Array<Record<string, unknown>>): Promise<boolean>;
  syncObjectState(canvasId: string, localObjects: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>>;
}
