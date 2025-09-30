import { getOrganizationId, logSecurityEvent } from './authService';

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  lockoutDuration: number; // milliseconds
  lockoutThreshold: number; // number of violations before lockout
}

interface RateLimitState {
  requests: number[];
  violations: number;
  lockedUntil: number | null;
  deviceId: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxRequestsPerHour: 100,
  lockoutDuration: 5 * 60 * 1000, // 5 minutes
  lockoutThreshold: 20
};

class RateLimiter {
  private config: RateLimitConfig;
  private state: Map<string, RateLimitState> = new Map();
  private storageKey = 'rateLimitState';

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadState();
  }

  /**
   * Load rate limit state from localStorage
   */
  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load rate limit state:', error);
    }
  }

  /**
   * Save rate limit state to localStorage
   */
  private saveState(): void {
    try {
      const obj = Object.fromEntries(this.state);
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save rate limit state:', error);
    }
  }

  /**
   * Get device-specific identifier
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Get or create state for current device
   */
  private getState(): RateLimitState {
    const deviceId = this.getDeviceId();

    if (!this.state.has(deviceId)) {
      this.state.set(deviceId, {
        requests: [],
        violations: 0,
        lockedUntil: null,
        deviceId
      });
    }

    return this.state.get(deviceId)!;
  }

  /**
   * Clean old requests from history
   */
  private cleanOldRequests(requests: number[], cutoffTime: number): number[] {
    return requests.filter(timestamp => timestamp > cutoffTime);
  }

  /**
   * Check if rate limit is exceeded
   */
  public checkLimit(): { allowed: boolean; reason?: string; retryAfter?: number } {
    const state = this.getState();
    const now = Date.now();

    // Check if device is locked out
    if (state.lockedUntil && now < state.lockedUntil) {
      const retryAfter = Math.ceil((state.lockedUntil - now) / 1000);
      return {
        allowed: false,
        reason: 'Device temporarily locked due to excessive requests',
        retryAfter
      };
    }

    // Clear lockout if expired
    if (state.lockedUntil && now >= state.lockedUntil) {
      state.lockedUntil = null;
      state.violations = 0;
    }

    // Clean old requests
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    state.requests = this.cleanOldRequests(state.requests, oneHourAgo);

    // Count requests in last minute and hour
    const requestsLastMinute = state.requests.filter(t => t > oneMinuteAgo).length;
    const requestsLastHour = state.requests.length;

    // Check per-minute limit
    if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
      state.violations++;
      this.saveState();

      // Log rate limit violation
      logSecurityEvent('rate_limit_exceeded', 'medium', {
        type: 'per_minute',
        requests: requestsLastMinute,
        limit: this.config.maxRequestsPerMinute,
        violations: state.violations
      });

      // Lock device if too many violations
      if (state.violations >= this.config.lockoutThreshold) {
        state.lockedUntil = now + this.config.lockoutDuration;
        this.saveState();

        logSecurityEvent('device_locked', 'high', {
          reason: 'excessive_rate_limit_violations',
          violations: state.violations,
          lockoutDuration: this.config.lockoutDuration
        });

        return {
          allowed: false,
          reason: 'Device locked due to excessive requests',
          retryAfter: Math.ceil(this.config.lockoutDuration / 1000)
        };
      }

      return {
        allowed: false,
        reason: `Rate limit exceeded: Max ${this.config.maxRequestsPerMinute} requests per minute`,
        retryAfter: 60
      };
    }

    // Check per-hour limit
    if (requestsLastHour >= this.config.maxRequestsPerHour) {
      logSecurityEvent('rate_limit_exceeded', 'medium', {
        type: 'per_hour',
        requests: requestsLastHour,
        limit: this.config.maxRequestsPerHour
      });

      return {
        allowed: false,
        reason: `Rate limit exceeded: Max ${this.config.maxRequestsPerHour} requests per hour`,
        retryAfter: 3600
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request
   */
  public recordRequest(): void {
    const state = this.getState();
    state.requests.push(Date.now());
    this.saveState();
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): {
    requestsLastMinute: number;
    requestsLastHour: number;
    limitPerMinute: number;
    limitPerHour: number;
    percentageUsedMinute: number;
    percentageUsedHour: number;
    isLocked: boolean;
    lockedUntil: Date | null;
    violations: number;
  } {
    const state = this.getState();
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const requestsLastMinute = state.requests.filter(t => t > oneMinuteAgo).length;
    const requestsLastHour = state.requests.length;

    return {
      requestsLastMinute,
      requestsLastHour,
      limitPerMinute: this.config.maxRequestsPerMinute,
      limitPerHour: this.config.maxRequestsPerHour,
      percentageUsedMinute: (requestsLastMinute / this.config.maxRequestsPerMinute) * 100,
      percentageUsedHour: (requestsLastHour / this.config.maxRequestsPerHour) * 100,
      isLocked: state.lockedUntil !== null && now < state.lockedUntil,
      lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
      violations: state.violations
    };
  }

  /**
   * Reset rate limit for current device (admin override)
   */
  public reset(): void {
    const deviceId = this.getDeviceId();
    this.state.delete(deviceId);
    this.saveState();
    console.log('Rate limiter reset for device:', deviceId);
  }

  /**
   * Get warning threshold (e.g., 80% of limit)
   */
  public isNearLimit(threshold: number = 0.8): boolean {
    const stats = this.getUsageStats();
    return (
      stats.percentageUsedMinute >= threshold * 100 ||
      stats.percentageUsedHour >= threshold * 100
    );
  }
}

// Create singleton instance
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Initialize rate limiter
 */
export const initializeRateLimiter = (config?: Partial<RateLimitConfig>): RateLimiter => {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
};

/**
 * Get rate limiter instance
 */
export const getRateLimiter = (): RateLimiter | null => {
  return rateLimiterInstance;
};

/**
 * Check if request is allowed
 */
export const checkRateLimit = (): { allowed: boolean; reason?: string; retryAfter?: number } => {
  if (!rateLimiterInstance) {
    initializeRateLimiter();
  }
  return rateLimiterInstance!.checkLimit();
};

/**
 * Record a request
 */
export const recordRequest = (): void => {
  if (!rateLimiterInstance) {
    initializeRateLimiter();
  }
  rateLimiterInstance!.recordRequest();
};

/**
 * Get usage statistics
 */
export const getUsageStats = () => {
  if (!rateLimiterInstance) {
    initializeRateLimiter();
  }
  return rateLimiterInstance!.getUsageStats();
};

/**
 * Check if near limit (for warnings)
 */
export const isNearLimit = (threshold?: number): boolean => {
  if (!rateLimiterInstance) {
    initializeRateLimiter();
  }
  return rateLimiterInstance!.isNearLimit(threshold);
};

export default RateLimiter;