/**
 * Common type definitions to replace 'any' usage
 */

// Error types
export interface ErrorWithDetails {
  message: string;
  code?: string | number;
  stack?: string;
  details?: Record<string, unknown>;
  error_id?: string;
  event_type?: string;
}

// Event handler types
export type EventHandler<T = Event> = (event: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// Generic callback types
export type Callback<T = void> = () => T;
export type AsyncCallback<T = void> = () => Promise<T>;
export type ValueCallback<T, R = void> = (value: T) => R;
export type AsyncValueCallback<T, R = void> = (value: T) => Promise<R>;

// Socket event types
export interface SocketEventData {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  canvasId?: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ErrorWithDetails;
  message?: string;
}

// Canvas object types
export interface CanvasObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

// Update operation types
export interface UpdateOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'resize' | 'rotate';
  data: Partial<CanvasObject>;
  timestamp: number;
  userId: string;
}

// Connection status types
export interface ConnectionStatus {
  isOnline: boolean;
  apiHealth: 'healthy' | 'degraded' | 'unhealthy';
  socketHealth: 'connected' | 'disconnected' | 'reconnecting';
  lastCheck: number;
  latency?: number;
}

// Network status types
export interface NetworkStatus {
  isOnline: boolean;
  apiHealth: 'healthy' | 'degraded' | 'unhealthy';
  socketHealth: 'connected' | 'disconnected' | 'reconnecting';
  lastCheck: number;
  latency?: number;
  bandwidth?: number;
}

// Offline status types
export interface OfflineStatus {
  isOffline: boolean;
  pendingOperations: UpdateOperation[];
  lastSync: number;
  conflictCount: number;
}

// Failed update types
export interface FailedUpdate {
  error: ErrorWithDetails;
  timestamp: number;
  retryCount: number;
}

// Update progress types
export interface UpdateProgress {
  method: string;
  attempt: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
}

// Generic object with ID
export interface Identifiable {
  id: string;
}

// Generic timestamped object
export interface Timestamped {
  createdAt: number;
  updatedAt: number;
}

// Generic user object
export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: number;
}

// Generic configuration object
export interface Config {
  [key: string]: unknown;
}

// Generic data object
export interface DataObject {
  [key: string]: unknown;
}

// Window object extensions for testing
export interface TestWindow extends Window {
  Cypress?: unknown;
  playwright?: unknown;
}

// Generic function type
export type GenericFunction = (...args: unknown[]) => unknown;

// Generic async function type
export type GenericAsyncFunction = (...args: unknown[]) => Promise<unknown>;
