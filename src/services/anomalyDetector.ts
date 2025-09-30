import { logSecurityEvent, getOrganizationId } from './authService';
import { supabase } from './supabaseClient';

interface ScanEvent {
  timestamp: number;
  success: boolean;
  memberId?: string;
  memberStatus?: string;
  confidence?: number;
}

interface AnomalyPattern {
  type: 'rapid_failed_scans' | 'banned_member_repeated' | 'unusual_time' | 'pattern_attack' | 'geographic_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: 'log' | 'warn' | 'block' | 'alert_admin';
}

class AnomalyDetector {
  private scanHistory: ScanEvent[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly storageKey = 'anomalyDetectorHistory';
  private blockedUntil: number | null = null;

  constructor() {
    this.loadHistory();
  }

  /**
   * Load scan history from localStorage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.scanHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load anomaly history:', error);
    }
  }

  /**
   * Save scan history to localStorage
   */
  private saveHistory(): void {
    try {
      // Keep only last MAX_HISTORY events
      if (this.scanHistory.length > this.MAX_HISTORY) {
        this.scanHistory = this.scanHistory.slice(-this.MAX_HISTORY);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.scanHistory));
    } catch (error) {
      console.error('Failed to save anomaly history:', error);
    }
  }

  /**
   * Record a scan event
   */
  public recordScan(event: Omit<ScanEvent, 'timestamp'>): void {
    this.scanHistory.push({
      ...event,
      timestamp: Date.now()
    });
    this.saveHistory();
  }

  /**
   * Check for rapid failed scans (potential brute force)
   */
  private checkRapidFailedScans(): AnomalyPattern | null {
    const now = Date.now();
    const last30Seconds = now - 30 * 1000;

    const recentFailures = this.scanHistory.filter(
      event => event.timestamp > last30Seconds && !event.success
    );

    if (recentFailures.length >= 5) {
      return {
        type: 'rapid_failed_scans',
        severity: 'high',
        description: `${recentFailures.length} failed scans in last 30 seconds`,
        action: 'block'
      };
    }

    return null;
  }

  /**
   * Check for repeated scans of banned members
   */
  private checkBannedMemberRepeated(): AnomalyPattern | null {
    const now = Date.now();
    const last5Minutes = now - 5 * 60 * 1000;

    const recentBannedScans = this.scanHistory.filter(
      event =>
        event.timestamp > last5Minutes &&
        event.memberStatus === 'Banned' &&
        event.memberId
    );

    if (recentBannedScans.length >= 3) {
      return {
        type: 'banned_member_repeated',
        severity: 'critical',
        description: `Repeated attempts to scan banned member`,
        action: 'alert_admin'
      };
    }

    return null;
  }

  /**
   * Check for unusual scan times (e.g., middle of night for office)
   */
  private checkUnusualTime(): AnomalyPattern | null {
    const hour = new Date().getHours();

    // Flag scans between 12 AM and 5 AM as unusual for office environments
    if (hour >= 0 && hour < 5) {
      return {
        type: 'unusual_time',
        severity: 'medium',
        description: `Scan at unusual hour: ${hour}:00`,
        action: 'warn'
      };
    }

    return null;
  }

  /**
   * Check for pattern-based attacks (same face different angles rapidly)
   */
  private checkPatternAttack(): AnomalyPattern | null {
    const now = Date.now();
    const last2Minutes = now - 2 * 60 * 1000;

    const recentScans = this.scanHistory.filter(
      event => event.timestamp > last2Minutes
    );

    // If many scans in short time with low confidence, might be trying different photos
    const lowConfidenceScans = recentScans.filter(
      event => event.confidence && event.confidence < 0.5
    );

    if (lowConfidenceScans.length >= 8) {
      return {
        type: 'pattern_attack',
        severity: 'high',
        description: `${lowConfidenceScans.length} low-confidence scans in 2 minutes`,
        action: 'block'
      };
    }

    return null;
  }

  /**
   * Analyze current scan for anomalies
   */
  public async analyze(scanEvent: Omit<ScanEvent, 'timestamp'>): Promise<{
    anomalies: AnomalyPattern[];
    shouldBlock: boolean;
    blockDuration?: number;
  }> {
    // Record the scan
    this.recordScan(scanEvent);

    // Check if currently blocked
    const now = Date.now();
    if (this.blockedUntil && now < this.blockedUntil) {
      return {
        anomalies: [],
        shouldBlock: true,
        blockDuration: Math.ceil((this.blockedUntil - now) / 1000)
      };
    }

    // Clear block if expired
    if (this.blockedUntil && now >= this.blockedUntil) {
      this.blockedUntil = null;
    }

    // Run all anomaly checks
    const anomalies: AnomalyPattern[] = [];

    const rapidFailed = this.checkRapidFailedScans();
    if (rapidFailed) anomalies.push(rapidFailed);

    const bannedRepeated = this.checkBannedMemberRepeated();
    if (bannedRepeated) anomalies.push(bannedRepeated);

    const unusualTime = this.checkUnusualTime();
    if (unusualTime) anomalies.push(unusualTime);

    const patternAttack = this.checkPatternAttack();
    if (patternAttack) anomalies.push(patternAttack);

    // Log all detected anomalies
    for (const anomaly of anomalies) {
      await logSecurityEvent('anomaly_detected', anomaly.severity, {
        type: anomaly.type,
        description: anomaly.description,
        action: anomaly.action,
        scanEvent
      });
    }

    // Determine if should block
    const shouldBlock = anomalies.some(a => a.action === 'block');

    if (shouldBlock) {
      // Block for 30 seconds
      this.blockedUntil = now + 30 * 1000;

      await logSecurityEvent('scanner_blocked', 'high', {
        reason: 'anomaly_detection',
        duration: 30,
        anomalies: anomalies.map(a => a.type)
      });

      // Send admin alert if critical
      const hasCritical = anomalies.some(a => a.severity === 'critical');
      if (hasCritical) {
        await this.sendAdminAlert(anomalies);
      }

      return {
        anomalies,
        shouldBlock: true,
        blockDuration: 30
      };
    }

    return {
      anomalies,
      shouldBlock: false
    };
  }

  /**
   * Send alert to admin dashboard
   */
  private async sendAdminAlert(anomalies: AnomalyPattern[]): Promise<void> {
    try {
      const organizationId = getOrganizationId();
      if (!organizationId) return;

      // Store alert in security_events table
      await supabase.from('security_events').insert({
        organization_id: organizationId,
        event_type: 'admin_alert',
        severity: 'critical',
        details: JSON.stringify({
          message: 'Critical security anomaly detected',
          anomalies: anomalies.map(a => ({
            type: a.type,
            description: a.description,
            severity: a.severity
          })),
          timestamp: new Date().toISOString()
        })
      });

      console.warn('🚨 Admin alert sent:', anomalies);
    } catch (error) {
      console.error('Failed to send admin alert:', error);
    }
  }

  /**
   * Get scan statistics
   */
  public getStatistics(): {
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    successRate: number;
    recentActivity: ScanEvent[];
  } {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const recentScans = this.scanHistory.filter(
      event => event.timestamp > last24Hours
    );

    const successful = recentScans.filter(e => e.success).length;
    const failed = recentScans.filter(e => !e.success).length;

    return {
      totalScans: recentScans.length,
      successfulScans: successful,
      failedScans: failed,
      successRate: recentScans.length > 0 ? (successful / recentScans.length) * 100 : 0,
      recentActivity: recentScans.slice(-10)
    };
  }

  /**
   * Check if currently blocked
   */
  public isBlocked(): { blocked: boolean; remainingTime?: number } {
    if (!this.blockedUntil) {
      return { blocked: false };
    }

    const now = Date.now();
    if (now < this.blockedUntil) {
      return {
        blocked: true,
        remainingTime: Math.ceil((this.blockedUntil - now) / 1000)
      };
    }

    // Clear expired block
    this.blockedUntil = null;
    return { blocked: false };
  }

  /**
   * Reset anomaly detector (admin override)
   */
  public reset(): void {
    this.scanHistory = [];
    this.blockedUntil = null;
    localStorage.removeItem(this.storageKey);
    console.log('Anomaly detector reset');
  }

  /**
   * Clear old history (older than 24 hours)
   */
  public clearOldHistory(): void {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    this.scanHistory = this.scanHistory.filter(
      event => event.timestamp > cutoff
    );

    this.saveHistory();
  }
}

// Create singleton instance
let anomalyDetectorInstance: AnomalyDetector | null = null;

/**
 * Initialize anomaly detector
 */
export const initializeAnomalyDetector = (): AnomalyDetector => {
  if (!anomalyDetectorInstance) {
    anomalyDetectorInstance = new AnomalyDetector();
  }
  return anomalyDetectorInstance;
};

/**
 * Get anomaly detector instance
 */
export const getAnomalyDetector = (): AnomalyDetector | null => {
  return anomalyDetectorInstance;
};

/**
 * Analyze scan for anomalies
 */
export const analyzeScan = async (scanEvent: Omit<ScanEvent, 'timestamp'>) => {
  if (!anomalyDetectorInstance) {
    initializeAnomalyDetector();
  }
  return anomalyDetectorInstance!.analyze(scanEvent);
};

/**
 * Check if scanner is blocked
 */
export const isScannerBlocked = (): { blocked: boolean; remainingTime?: number } => {
  if (!anomalyDetectorInstance) {
    initializeAnomalyDetector();
  }
  return anomalyDetectorInstance!.isBlocked();
};

/**
 * Get scan statistics
 */
export const getScanStatistics = () => {
  if (!anomalyDetectorInstance) {
    initializeAnomalyDetector();
  }
  return anomalyDetectorInstance!.getStatistics();
};

export default AnomalyDetector;