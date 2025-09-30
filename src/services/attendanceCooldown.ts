/**
 * Attendance Cooldown Service
 *
 * Tracks when members last logged attendance to prevent duplicate entries
 * within a configurable cooldown period (default: 8 hours)
 */

interface AttendanceRecord {
  memberId: string;
  memberName: string;
  lastAttendanceTime: number; // Unix timestamp
  confidence: number;
}

class AttendanceCooldownService {
  private readonly STORAGE_KEY = 'attendance_cooldown_tracker';
  private readonly COOLDOWN_HOURS = 8; // 8 hours cooldown
  private readonly COOLDOWN_MS = this.COOLDOWN_HOURS * 60 * 60 * 1000;

  /**
   * Check if member can log attendance (not in cooldown)
   */
  canLogAttendance(memberId: string): boolean {
    const lastAttendance = this.getLastAttendance(memberId);

    if (!lastAttendance) {
      console.log(`✅ First attendance for member ${memberId}`);
      return true;
    }

    const now = Date.now();
    const timeSinceLastAttendance = now - lastAttendance.lastAttendanceTime;
    const hoursAgo = timeSinceLastAttendance / (1000 * 60 * 60);

    if (timeSinceLastAttendance >= this.COOLDOWN_MS) {
      console.log(`✅ Cooldown expired for ${lastAttendance.memberName} (${hoursAgo.toFixed(1)}h ago)`);
      return true;
    }

    const remainingHours = (this.COOLDOWN_MS - timeSinceLastAttendance) / (1000 * 60 * 60);
    console.log(`⏱️ Cooldown active for ${lastAttendance.memberName} - ${remainingHours.toFixed(1)}h remaining`);
    return false;
  }

  /**
   * Get time remaining in cooldown (in hours)
   */
  getCooldownRemaining(memberId: string): number {
    const lastAttendance = this.getLastAttendance(memberId);

    if (!lastAttendance) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastAttendance = now - lastAttendance.lastAttendanceTime;
    const remainingMs = this.COOLDOWN_MS - timeSinceLastAttendance;

    if (remainingMs <= 0) {
      return 0;
    }

    return remainingMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Get formatted cooldown message
   */
  getCooldownMessage(memberId: string, memberName: string): string {
    const remainingHours = this.getCooldownRemaining(memberId);

    if (remainingHours <= 0) {
      return '';
    }

    const hours = Math.floor(remainingHours);
    const minutes = Math.floor((remainingHours - hours) * 60);

    if (hours > 0) {
      return `Attendance already logged ${hours}h ${minutes}m ago. Next attendance in ${(this.COOLDOWN_HOURS - hours)}h ${(60 - minutes)}m`;
    } else {
      return `Attendance already logged ${minutes}m ago. Next attendance in ${Math.ceil((this.COOLDOWN_HOURS * 60) - minutes)}m`;
    }
  }

  /**
   * Record attendance time for a member
   */
  recordAttendance(memberId: string, memberName: string, confidence: number): void {
    console.log(`📝 Recording attendance for ${memberName}`);

    const record: AttendanceRecord = {
      memberId,
      memberName,
      lastAttendanceTime: Date.now(),
      confidence
    };

    const allRecords = this.getAllRecords();
    allRecords[memberId] = record;

    // Cleanup old records (older than cooldown period)
    this.cleanupOldRecords(allRecords);

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allRecords));
    console.log(`✅ Attendance recorded - cooldown until ${new Date(record.lastAttendanceTime + this.COOLDOWN_MS).toLocaleString()}`);
  }

  /**
   * Get last attendance record for a member
   */
  getLastAttendance(memberId: string): AttendanceRecord | null {
    const allRecords = this.getAllRecords();
    return allRecords[memberId] || null;
  }

  /**
   * Get all attendance records
   */
  private getAllRecords(): Record<string, AttendanceRecord> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Failed to load attendance records:', error);
      return {};
    }
  }

  /**
   * Clean up records older than cooldown period
   */
  private cleanupOldRecords(records: Record<string, AttendanceRecord>): void {
    const now = Date.now();
    let cleanedCount = 0;

    Object.keys(records).forEach(memberId => {
      const record = records[memberId];
      const age = now - record.lastAttendanceTime;

      // Remove records older than cooldown period
      if (age > this.COOLDOWN_MS) {
        delete records[memberId];
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired attendance records`);
    }
  }

  /**
   * Clear all attendance records (for testing/debugging)
   */
  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ All attendance records cleared');
  }

  /**
   * Get statistics
   */
  getStats() {
    const records = this.getAllRecords();
    const now = Date.now();

    const activeRecords = Object.values(records).filter(
      record => (now - record.lastAttendanceTime) < this.COOLDOWN_MS
    );

    return {
      totalRecords: Object.keys(records).length,
      activeRecords: activeRecords.length,
      cooldownHours: this.COOLDOWN_HOURS,
      cooldownMs: this.COOLDOWN_MS
    };
  }
}

// Export singleton instance
export const attendanceCooldown = new AttendanceCooldownService();