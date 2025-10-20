/**
 * API response types to replace 'any' usage in API services
 */

import { User, Canvas, CanvasObject, Invitation } from './index';
import { ErrorWithDetails } from './common';

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ErrorWithDetails;
  message?: string;
  timestamp?: number;
  requestId?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Authentication API responses
export interface AuthResponse extends ApiResponse<{
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn: number;
}> {}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  confirmPassword?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

// User API responses
export interface UserResponse extends ApiResponse<User> {}
export interface UsersResponse extends PaginatedResponse<User> {}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
  avatar_url?: string;
}

// Canvas API responses
export interface CanvasResponse extends ApiResponse<Canvas> {}
export interface CanvasesResponse extends PaginatedResponse<Canvas> {}

export interface CanvasCreateRequest {
  title: string;
  description?: string;
  is_public?: boolean;
  prompt_id?: string;
}

export interface CanvasUpdateRequest {
  title?: string;
  description?: string;
  is_public?: boolean;
}

export interface CanvasDeleteResponse extends ApiResponse<{
  deleted: boolean;
  canvasId: string;
}> {}

// Canvas Object API responses
export interface CanvasObjectResponse extends ApiResponse<CanvasObject> {}
export interface CanvasObjectsResponse extends ApiResponse<CanvasObject[]> {}

export interface CanvasObjectCreateRequest {
  canvas_id: string;
  object_type: CanvasObject['object_type'];
  properties: Record<string, unknown>;
}

export interface CanvasObjectUpdateRequest {
  properties: Record<string, unknown>;
}

export interface CanvasObjectDeleteResponse extends ApiResponse<{
  deleted: boolean;
  objectId: string;
}> {}

// Canvas Permission API responses
export interface CanvasPermissionResponse extends ApiResponse<{
  id: number;
  canvas_id: string;
  user_id: string;
  permission_type: 'view' | 'edit';
  granted_at: string;
  granted_by: string;
}> {}

export interface CanvasPermissionsResponse extends ApiResponse<Array<{
  id: number;
  canvas_id: string;
  user_id: string;
  permission_type: 'view' | 'edit';
  granted_at: string;
  granted_by: string;
  user: User;
}>> {}

export interface CanvasPermissionCreateRequest {
  canvas_id: string;
  user_id: string;
  permission_type: 'view' | 'edit';
}

// Invitation API responses
export interface InvitationResponse extends ApiResponse<Invitation> {}
export interface InvitationsResponse extends PaginatedResponse<Invitation> {}

export interface InvitationCreateRequest {
  canvas_id: string;
  invitee_email: string;
  permission_type: 'view' | 'edit';
  expires_at?: string;
}

export interface InvitationUpdateRequest {
  status: 'accepted' | 'declined';
}

export interface InvitationDeleteResponse extends ApiResponse<{
  deleted: boolean;
  invitationId: string;
}> {}

// Prompt API responses
export interface PromptResponse extends ApiResponse<{
  id: string;
  user_id: string;
  instructions: string;
  style: 'modern' | 'corporate' | 'creative' | 'minimal';
  color_scheme: 'pastel' | 'vibrant' | 'monochrome' | 'default';
  model_used: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  request_metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  canvas_count: number;
  canvases?: Canvas[];
}> {}

export interface PromptsResponse extends PaginatedResponse<{
  id: string;
  user_id: string;
  instructions: string;
  style: 'modern' | 'corporate' | 'creative' | 'minimal';
  color_scheme: 'pastel' | 'vibrant' | 'monochrome' | 'default';
  model_used: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  request_metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  canvas_count: number;
  canvases?: Canvas[];
}> {}

export interface PromptCreateRequest {
  instructions: string;
  style: 'modern' | 'corporate' | 'creative' | 'minimal';
  color_scheme: 'pastel' | 'vibrant' | 'monochrome' | 'default';
}

export interface PromptUpdateRequest {
  instructions?: string;
  style?: 'modern' | 'corporate' | 'creative' | 'minimal';
  color_scheme?: 'pastel' | 'vibrant' | 'monochrome' | 'default';
}

// Health check API response
export interface HealthCheckResponse extends ApiResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  services: {
    database: 'healthy' | 'degraded' | 'unhealthy';
    redis: 'healthy' | 'degraded' | 'unhealthy';
    socket: 'healthy' | 'degraded' | 'unhealthy';
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}> {}

// Error response types
export interface ValidationErrorResponse extends ApiResponse<never> {
  success: false;
  error: ErrorWithDetails & {
    type: 'validation';
    details: Record<string, string[]>;
  };
}

export interface AuthenticationErrorResponse extends ApiResponse<never> {
  success: false;
  error: ErrorWithDetails & {
    type: 'authentication';
    code: 'invalid_credentials' | 'token_expired' | 'token_invalid' | 'access_denied';
  };
}

export interface AuthorizationErrorResponse extends ApiResponse<never> {
  success: false;
  error: ErrorWithDetails & {
    type: 'authorization';
    code: 'insufficient_permissions' | 'resource_not_found' | 'access_denied';
  };
}

export interface RateLimitErrorResponse extends ApiResponse<never> {
  success: false;
  error: ErrorWithDetails & {
    type: 'rate_limit';
    code: 'too_many_requests';
    retryAfter: number;
  };
}

export interface ServerErrorResponse extends ApiResponse<never> {
  success: false;
  error: ErrorWithDetails & {
    type: 'server_error';
    code: 'internal_error' | 'service_unavailable' | 'timeout';
  };
}

// API service configuration
export interface ApiServiceConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers: Record<string, string>;
  withCredentials: boolean;
}

// API service interface
export interface ApiServiceInterface {
  get<T>(url: string, config?: Record<string, unknown>): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<ApiResponse<T>>;
  patch<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: Record<string, unknown>): Promise<ApiResponse<T>>;
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  setBaseUrl(url: string): void;
  getBaseUrl(): string;
}
