// ============================================================================
// LABGUARD V2: Role-Aware Notification Routing & Deduplication Service
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationPreference, NotificationSeverity, UserRole } from '../../../shared/types';
import { db } from '../db/pool';

const cooldownMap = new Map<string, number>();
const COOLDOWN_WINDOW_MS = 30000; // 30 seconds deduplication cooldown for non-critical alerts

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  severity?: NotificationSeverity;
  eventType?: string;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  /**
   * Dispatches an institutional event notification with role-awareness, deduplication, and preferences check.
   */
  public static async dispatchEventNotification(params: {
    title: string;
    message: string;
    severity?: NotificationSeverity;
    eventType: string;
    labCode?: string;
    labId?: string;
    pcCode?: string;
    computerId?: string;
    targetRole?: UserRole;
    targetUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification | null> {
    const severity: NotificationSeverity = params.severity || 'INFO';
    const {
      title,
      message,
      eventType,
      labCode,
      labId,
      pcCode,
      computerId,
      targetRole,
      targetUserId,
      metadata
    } = params;

    // Deduplication check
    const dedupKey = `${eventType}:${labCode || '*'}:${pcCode || '*'}:${targetRole || '*'}:${targetUserId || '*'}`;
    const now = Date.now();
    const lastSent = cooldownMap.get(dedupKey) || 0;

    if (now - lastSent < COOLDOWN_WINDOW_MS && severity !== 'CRITICAL') {
      // Cooldown active, suppress duplicate notification
      return null;
    }
    cooldownMap.set(dedupKey, now);

    // If targeted directly to a specific user, check their notification preferences
    if (targetUserId) {
      const prefs = this.getUserPreferences(targetUserId);
      if (prefs.criticalOnly && severity !== 'CRITICAL') {
        return null;
      }
      if (eventType.startsWith('HARDWARE_') && !prefs.hardwareAlerts && severity !== 'CRITICAL') {
        return null;
      }
      if (eventType.startsWith('MAINTENANCE_') && !prefs.maintenanceAlerts && severity !== 'CRITICAL') {
        return null;
      }
      if (eventType.startsWith('ISSUE_') && !prefs.issueAlerts && severity !== 'CRITICAL') {
        return null;
      }
      if (eventType.startsWith('SESSION_') && !prefs.sessionAlerts && severity !== 'CRITICAL') {
        return null;
      }
    }

    const notification: Notification = {
      id: uuidv4(),
      title,
      message,
      severity,
      eventType,
      labCode,
      labId,
      pcCode,
      computerId,
      targetRole,
      targetUserId,
      isRead: false,
      metadata,
      createdAt: new Date().toISOString()
    };

    db.insert('notifications', notification);
    return notification;
  }

  /**
   * Retrieves notifications scoped to the recipient user.
   */
  public static getNotificationsForUser(
    user: { id: string; role: UserRole },
    options: GetNotificationsOptions = {}
  ): Notification[] {
    let notifications = db.find<Notification>('notifications', (n) => {
      // Direct recipient matches
      if (n.targetUserId && n.targetUserId === user.id) return true;
      // Role broadcast matches
      if (n.targetRole && n.targetRole === user.role) return true;
      // Global broadcast (neither role nor user specified)
      if (!n.targetRole && !n.targetUserId) return true;
      // Administrators have institutional oversight
      if (user.role === 'ADMIN') return true;
      return false;
    });

    // Sort newest first
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply filters
    if (options.unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }
    if (options.severity) {
      notifications = notifications.filter((n) => n.severity === options.severity);
    }
    if (options.eventType) {
      notifications = notifications.filter((n) => n.eventType === options.eventType);
    }

    const offset = options.offset || 0;
    if (options.limit && options.limit > 0) {
      return notifications.slice(offset, offset + options.limit);
    }

    return offset > 0 ? notifications.slice(offset) : notifications;
  }

  /**
   * Returns unread badge telemetry for the caller.
   */
  public static getUnreadCountForUser(user: { id: string; role: UserRole }): {
    total: number;
    unread: number;
    criticalUnread: number;
  } {
    const list = this.getNotificationsForUser(user);
    const unread = list.filter((n) => !n.isRead);
    const criticalUnread = unread.filter((n) => n.severity === 'CRITICAL').length;
    return {
      total: list.length,
      unread: unread.length,
      criticalUnread
    };
  }

  /**
   * Marks a single notification as read.
   */
  public static markAsRead(notificationId: string, user?: { id: string; role: UserRole }): boolean {
    const n = db.findOne<Notification>('notifications', (item) => item.id === notificationId);
    if (!n) return false;

    // Optional scoping check
    if (user && user.role !== 'ADMIN') {
      const isRecipient = (n.targetUserId && n.targetUserId === user.id) ||
                          (n.targetRole && n.targetRole === user.role) ||
                          (!n.targetRole && !n.targetUserId);
      if (!isRecipient) return false;
    }

    const updated = db.update<Notification>('notifications', (item) => item.id === notificationId, {
      isRead: true,
      readAt: new Date().toISOString()
    });
    return !!updated;
  }

  /**
   * Marks all scoped notifications as read for the user.
   */
  public static markAllAsReadForUser(user: { id: string; role: UserRole }): number {
    const userNotifications = this.getNotificationsForUser(user, { unreadOnly: true });
    const now = new Date().toISOString();
    let count = 0;

    for (const n of userNotifications) {
      db.update<Notification>('notifications', (item) => item.id === n.id, {
        isRead: true,
        readAt: now
      });
      count++;
    }

    return count;
  }

  /**
   * Deletes a notification by ID.
   */
  public static deleteNotification(notificationId: string, user?: { id: string; role: UserRole }): boolean {
    const n = db.findOne<Notification>('notifications', (item) => item.id === notificationId);
    if (!n) return false;

    if (user && user.role !== 'ADMIN' && n.targetUserId !== user.id) {
      return false;
    }

    return db.delete('notifications', (item: Notification) => item.id === notificationId);
  }

  /**
   * Retrieves or provisions the user's notification preferences.
   */
  public static getUserPreferences(userId: string): NotificationPreference {
    let pref = db.findOne<NotificationPreference>('notification_preferences', (p) => p.userId === userId);
    if (!pref) {
      pref = {
        userId,
        emailAlerts: true,
        hardwareAlerts: true,
        maintenanceAlerts: true,
        issueAlerts: true,
        sessionAlerts: true,
        criticalOnly: false,
        updatedAt: new Date().toISOString()
      };
      db.insert('notification_preferences', pref);
    }
    return pref;
  }

  /**
   * Updates notification preferences for the user.
   */
  public static updateUserPreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreference, 'userId' | 'updatedAt'>>
  ): NotificationPreference {
    const current = this.getUserPreferences(userId);
    const updated: NotificationPreference = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    db.update('notification_preferences', (p: NotificationPreference) => p.userId === userId, updated);
    return updated;
  }

  /**
   * Resets cooldown map (useful for test assertions).
   */
  public static clearCooldowns(): void {
    cooldownMap.clear();
  }
}

