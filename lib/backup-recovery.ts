/**
 * Backup and Recovery System
 * Handles automated backups, versioning, and disaster recovery
 */

import type { Profile, Settings, Post, Conversation } from "./ghc-types"

export interface BackupSnapshot {
  id: string
  timestamp: number
  version: number
  data: {
    profile: Profile | null
    settings: Settings | null
    posts: Post[]
    conversations: Conversation[]
  }
  hash: string
  checksum: number
  metadata: {
    deviceId: string
    appVersion: string
    createdBy: "auto" | "manual"
  }
}

export interface RecoveryPoint {
  snapshotId: string
  timestamp: number
  label: string
  dataIntegrity: "verified" | "suspected_corruption" | "unknown"
}

/**
 * Backup and Recovery Manager
 */
export class BackupRecoveryManager {
  private snapshots: BackupSnapshot[] = []
  private recoveryPoints: RecoveryPoint[] = []
  private readonly MAX_BACKUPS = 20
  private readonly BACKUP_VERSION = 1

  /**
   * Create automatic backup checkpoint
   */
  createBackup(
    profile: Profile | null,
    settings: Settings | null,
    posts: Post[],
    conversations: Conversation[],
    createdBy: "auto" | "manual" = "auto"
  ): BackupSnapshot {
    const snapshot: BackupSnapshot = {
      id: this.generateBackupId(),
      timestamp: Date.now(),
      version: this.BACKUP_VERSION,
      data: { profile, settings, posts, conversations },
      hash: this.calculateHash({ profile, settings, posts, conversations }),
      checksum: this.calculateChecksum({ profile, settings, posts, conversations }),
      metadata: {
        deviceId: this.getDeviceId(),
        appVersion: "1.0.0",
        createdBy,
      },
    }

    this.snapshots.push(snapshot)
    this.trimOldBackups()

    // Create recovery point
    this.recoveryPoints.push({
      snapshotId: snapshot.id,
      timestamp: snapshot.timestamp,
      label: `${createdBy === "manual" ? "Manual" : "Auto"} backup`,
      dataIntegrity: "verified",
    })

    return snapshot
  }

  /**
   * Restore from backup snapshot
   */
  restoreFromSnapshot(snapshotId: string): BackupSnapshot | null {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId)

    if (!snapshot) {
      console.warn("[v0] Snapshot not found:", snapshotId)
      return null
    }

    // Verify data integrity before restore
    if (!this.verifySnapshot(snapshot)) {
      console.error("[v0] Snapshot corruption detected:", snapshotId)
      return null
    }

    return snapshot
  }

  /**
   * Get latest backup
   */
  getLatestBackup(): BackupSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null
  }

  /**
   * List all backups
   */
  listBackups(): BackupSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Get backup history
   */
  getRecoveryPoints(): RecoveryPoint[] {
    return [...this.recoveryPoints]
  }

  /**
   * Verify snapshot integrity
   */
  verifySnapshot(snapshot: BackupSnapshot): boolean {
    const currentHash = this.calculateHash(snapshot.data)
    const currentChecksum = this.calculateChecksum(snapshot.data)

    const hashValid = currentHash === snapshot.hash
    const checksumValid = currentChecksum === snapshot.checksum

    if (!hashValid || !checksumValid) {
      console.error("[v0] Snapshot verification failed", {
        snapshotId: snapshot.id,
        hashValid,
        checksumValid,
      })
      return false
    }

    return true
  }

  /**
   * Verify all snapshots in backup chain
   */
  verifyBackupChain(): {
    totalSnapshots: number
    validSnapshots: number
    corruptedSnapshots: string[]
  } {
    const corruptedSnapshots: string[] = []

    this.snapshots.forEach((snapshot) => {
      if (!this.verifySnapshot(snapshot)) {
        corruptedSnapshots.push(snapshot.id)
      }
    })

    return {
      totalSnapshots: this.snapshots.length,
      validSnapshots: this.snapshots.length - corruptedSnapshots.length,
      corruptedSnapshots,
    }
  }

  /**
   * Differential backup - only backs up changed data
   */
  createDifferentialBackup(
    previous: BackupSnapshot | null,
    current: BackupSnapshot
  ): Partial<BackupSnapshot> {
    if (!previous) {
      return current
    }

    const changes: any = {}

    if (JSON.stringify(previous.data.profile) !== JSON.stringify(current.data.profile)) {
      changes.profile = current.data.profile
    }

    if (JSON.stringify(previous.data.settings) !== JSON.stringify(current.data.settings)) {
      changes.settings = current.data.settings
    }

    if (JSON.stringify(previous.data.posts) !== JSON.stringify(current.data.posts)) {
      changes.posts = current.data.posts
    }

    if (
      JSON.stringify(previous.data.conversations) !== JSON.stringify(current.data.conversations)
    ) {
      changes.conversations = current.data.conversations
    }

    return {
      ...current,
      data: changes,
    }
  }

  /**
   * Export backup for external storage
   */
  exportBackup(snapshotId: string): string {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId)
    if (!snapshot) return ""

    return JSON.stringify(snapshot)
  }

  /**
   * Import backup from external source
   */
  importBackup(backupJson: string): BackupSnapshot | null {
    try {
      const snapshot = JSON.parse(backupJson) as BackupSnapshot

      // Validate structure
      if (!snapshot.id || !snapshot.data || !snapshot.hash) {
        console.error("[v0] Invalid backup format")
        return null
      }

      // Verify integrity
      if (!this.verifySnapshot(snapshot)) {
        console.error("[v0] Imported backup integrity check failed")
        return null
      }

      this.snapshots.push(snapshot)
      this.trimOldBackups()

      return snapshot
    } catch (error) {
      console.error("[v0] Backup import failed:", error)
      return null
    }
  }

  /**
   * Calculate simple hash for backup
   */
  private calculateHash(data: any): string {
    const json = JSON.stringify(data)
    let hash = 0

    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * Calculate checksum for integrity verification
   */
  private calculateChecksum(data: any): number {
    const json = JSON.stringify(data)
    let checksum = 0

    for (let i = 0; i < json.length; i++) {
      checksum += json.charCodeAt(i)
    }

    return checksum
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get device identifier
   */
  private getDeviceId(): string {
    if (typeof window === "undefined") return "server"
    return navigator.userAgent.substring(0, 50)
  }

  /**
   * Trim old backups, keeping only most recent
   */
  private trimOldBackups(): void {
    if (this.snapshots.length > this.MAX_BACKUPS) {
      const removed = this.snapshots.splice(0, this.snapshots.length - this.MAX_BACKUPS)
      const removedIds = removed.map((s) => s.id)

      // Also remove corresponding recovery points
      this.recoveryPoints = this.recoveryPoints.filter((p) => !removedIds.includes(p.snapshotId))
    }
  }

  /**
   * Clear all backups (for development only)
   */
  clearAllBackups(): void {
    this.snapshots = []
    this.recoveryPoints = []
  }

  /**
   * Get backup statistics
   */
  getBackupStats() {
    return {
      totalBackups: this.snapshots.length,
      totalRecoveryPoints: this.recoveryPoints.length,
      oldestBackup: this.snapshots[0]?.timestamp || null,
      newestBackup: this.snapshots[this.snapshots.length - 1]?.timestamp || null,
      totalStorageBytes: JSON.stringify(this.snapshots).length,
    }
  }
}

export const backupRecoveryManager = new BackupRecoveryManager()
