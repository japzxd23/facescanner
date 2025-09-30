import { getCurrentSession, refreshSession, signOut, logSecurityEvent } from './authService';

interface SessionConfig {
  idleTimeout: number; // milliseconds
  maxSessionDuration: number; // milliseconds
  checkInterval: number; // milliseconds
}

const DEFAULT_CONFIG: SessionConfig = {
  idleTimeout: 30 * 60 * 1000, // 30 minutes
  maxSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
  checkInterval: 60 * 1000 // 1 minute
};

class SessionManager {
  private config: SessionConfig;
  private lastActivity: number;
  private sessionStart: number;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private deviceFingerprint: string;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastActivity = Date.now();
    this.sessionStart = Date.now();
    this.deviceFingerprint = this.generateFingerprint();
    this.initialize();
  }

  /**
   * Initialize session manager
   */
  private initialize(): void {
    // Track user activity
    this.setupActivityListeners();

    // Start periodic session checks
    this.startSessionCheck();

    // Verify device fingerprint on session restore
    this.verifyDeviceFingerprint();

    console.log('✅ Session manager initialized');
  }

  /**
   * Setup event listeners to track user activity
   */
  private setupActivityListeners(): void {
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, () => {
        this.updateActivity();
      }, { passive: true });
    });
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Start periodic session validation
   */
  private startSessionCheck(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    this.checkIntervalId = setInterval(async () => {
      await this.validateSession();
    }, this.config.checkInterval);
  }

  /**
   * Validate current session
   */
  private async validateSession(): Promise<void> {
    const now = Date.now();
    const session = getCurrentSession();

    if (!session) {
      this.handleSessionExpired('No session found');
      return;
    }

    // Check idle timeout
    const idleTime = now - this.lastActivity;
    if (idleTime > this.config.idleTimeout) {
      await logSecurityEvent('session_timeout', 'low', {
        reason: 'idle_timeout',
        idleTime: Math.floor(idleTime / 1000) + 's'
      });
      this.handleSessionExpired('Session expired due to inactivity');
      return;
    }

    // Check max session duration
    const sessionDuration = now - this.sessionStart;
    if (sessionDuration > this.config.maxSessionDuration) {
      await logSecurityEvent('session_timeout', 'low', {
        reason: 'max_duration',
        duration: Math.floor(sessionDuration / 1000) + 's'
      });
      this.handleSessionExpired('Session expired - please sign in again');
      return;
    }

    // Refresh session if getting old (older than 15 minutes)
    const sessionAge = now - (session.timestamp || 0);
    if (sessionAge > 15 * 60 * 1000) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        this.handleSessionExpired('Session validation failed');
      }
    }
  }

  /**
   * Handle session expiration
   */
  private async handleSessionExpired(reason: string): Promise<void> {
    console.warn('Session expired:', reason);

    await logSecurityEvent('session_expired', 'medium', {
      reason,
      lastActivity: new Date(this.lastActivity).toISOString(),
      sessionStart: new Date(this.sessionStart).toISOString()
    });

    // Stop session checking
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    // Sign out user
    await signOut();
  }

  /**
   * Generate device fingerprint
   */
  private generateFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.maxTouchPoints || 0
    ];

    return btoa(components.join('|'));
  }

  /**
   * Verify device fingerprint matches stored one
   */
  private verifyDeviceFingerprint(): void {
    const storedFingerprint = localStorage.getItem('deviceFingerprint');

    if (!storedFingerprint) {
      // First time - store fingerprint
      localStorage.setItem('deviceFingerprint', this.deviceFingerprint);
      return;
    }

    if (storedFingerprint !== this.deviceFingerprint) {
      console.warn('Device fingerprint mismatch - possible session hijacking');

      logSecurityEvent('fingerprint_mismatch', 'high', {
        stored: storedFingerprint.substring(0, 16),
        current: this.deviceFingerprint.substring(0, 16)
      });

      // For now, just log - could force re-auth in strict mode
    }
  }

  /**
   * Get time until session expires due to inactivity
   */
  public getTimeUntilTimeout(): number {
    const idleTime = Date.now() - this.lastActivity;
    const remaining = this.config.idleTimeout - idleTime;
    return Math.max(0, remaining);
  }

  /**
   * Get session duration
   */
  public getSessionDuration(): number {
    return Date.now() - this.sessionStart;
  }

  /**
   * Force session refresh
   */
  public async forceRefresh(): Promise<boolean> {
    const refreshed = await refreshSession();
    return refreshed !== null;
  }

  /**
   * Extend session (reset timers)
   */
  public extendSession(): void {
    this.lastActivity = Date.now();
    this.sessionStart = Date.now();
    console.log('Session extended');
  }

  /**
   * Stop session manager
   */
  public stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    console.log('Session manager stopped');
  }

  /**
   * Get session health status
   */
  public getStatus(): {
    active: boolean;
    idleTime: number;
    sessionDuration: number;
    timeUntilTimeout: number;
    deviceFingerprint: string;
  } {
    return {
      active: getCurrentSession() !== null,
      idleTime: Date.now() - this.lastActivity,
      sessionDuration: Date.now() - this.sessionStart,
      timeUntilTimeout: this.getTimeUntilTimeout(),
      deviceFingerprint: this.deviceFingerprint.substring(0, 16)
    };
  }
}

// Create singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Initialize session manager
 */
export const initializeSessionManager = (config?: Partial<SessionConfig>): SessionManager => {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(config);
  }
  return sessionManagerInstance;
};

/**
 * Get session manager instance
 */
export const getSessionManager = (): SessionManager | null => {
  return sessionManagerInstance;
};

/**
 * Stop session manager
 */
export const stopSessionManager = (): void => {
  if (sessionManagerInstance) {
    sessionManagerInstance.stop();
    sessionManagerInstance = null;
  }
};

export default SessionManager;