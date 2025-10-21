/**
 * Circuit Breaker Service
 * Prevents infinite retry loops on authentication failures and other critical errors.
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private halfOpenCalls = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      halfOpenMaxCalls: 3
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit breaker should be opened
    if (this.state === 'CLOSED' && this.shouldOpen()) {
      this.open();
    }

    // Check if circuit breaker should be closed (recovery)
    if (this.state === 'OPEN' && this.shouldClose()) {
      this.halfOpen();
    }

    // Handle different states
    switch (this.state) {
      case 'OPEN':
        throw new Error(`Circuit breaker '${this.name}' is OPEN - operation blocked`);
      
      case 'HALF_OPEN':
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          throw new Error(`Circuit breaker '${this.name}' is HALF_OPEN - max calls reached`);
        }
        this.halfOpenCalls++;
        break;
      
      case 'CLOSED':
        // Normal operation
        break;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldOpen(): boolean {
    return this.failureCount >= this.config.failureThreshold;
  }

  private shouldClose(): boolean {
    return Date.now() - this.lastFailureTime > this.config.recoveryTimeout;
  }

  private open(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
    console.warn(`Circuit breaker '${this.name}' opened due to ${this.failureCount} failures`);
  }

  private halfOpen(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenCalls = 0;
    console.log(`Circuit breaker '${this.name}' moved to HALF_OPEN state`);
  }

  private close(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    console.log(`Circuit breaker '${this.name}' closed - service recovered`);
  }

  private onSuccess(): void {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.close();
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.open();
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    console.log(`Circuit breaker '${this.name}' reset`);
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  isClosed(): boolean {
    return this.state === 'CLOSED';
  }
}

// Global circuit breaker instances
export const authenticationCircuitBreaker = new CircuitBreaker('authentication', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 60000, // 1 minute
  halfOpenMaxCalls: 2
});

export const apiCircuitBreaker = new CircuitBreaker('api', {
  failureThreshold: 5,
  recoveryTimeout: 15000, // 15 seconds
  monitoringPeriod: 60000, // 1 minute
  halfOpenMaxCalls: 3
});

export const websocketCircuitBreaker = new CircuitBreaker('websocket', {
  failureThreshold: 3,
  recoveryTimeout: 20000, // 20 seconds
  monitoringPeriod: 60000, // 1 minute
  halfOpenMaxCalls: 2
});

// Circuit breaker manager for monitoring and control
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.registerCircuitBreaker('authentication', authenticationCircuitBreaker);
    this.registerCircuitBreaker('api', apiCircuitBreaker);
    this.registerCircuitBreaker('websocket', websocketCircuitBreaker);
  }

  registerCircuitBreaker(name: string, circuitBreaker: CircuitBreaker): void {
    this.circuitBreakers.set(name, circuitBreaker);
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, cb] of this.circuitBreakers) {
      stats[name] = cb.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
  }

  resetCircuitBreaker(name: string): void {
    const cb = this.circuitBreakers.get(name);
    if (cb) {
      cb.reset();
    }
  }

  getOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const stats = this.getAllStats();
    const openBreakers = Object.values(stats).filter(s => s.state === 'OPEN').length;
    const halfOpenBreakers = Object.values(stats).filter(s => s.state === 'HALF_OPEN').length;
    const totalBreakers = Object.keys(stats).length;

    if (openBreakers >= totalBreakers * 0.5) {
      return 'critical';
    } else if (openBreakers > 0 || halfOpenBreakers > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Export individual circuit breakers for convenience
export { authenticationCircuitBreaker as authCircuitBreaker };
