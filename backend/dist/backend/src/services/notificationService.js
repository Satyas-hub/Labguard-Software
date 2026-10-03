"use strict";
// ============================================================================
// LABGUARD V2: Role-Aware Notification Routing & Deduplication Service
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const cooldownMap = new Map();
const COOLDOWN_WINDOW_MS = 30000; // 30 seconds deduplication cooldown for non-critical alerts
class NotificationService {
    /**
     * Dispatches an institutional event notification with role-awareness, deduplication, and preferences check.
     */
    static async dispatchEventNotification(params) {
        const severity = params.severity || 'INFO';
        const { title, message, eventType, labCode, labId, pcCode, computerId, targetRole, targetUserId, metadata } = params;
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
        const notification = {
            id: (0, uuid_1.v4)(),
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
        pool_1.db.insert('notifications', notification);
        return notification;
    }
    /**
     * Retrieves notifications scoped to the recipient user.
     */
    static getNotificationsForUser(user, options = {}) {
        let notifications = pool_1.db.find('notifications', (n) => {
            // Direct recipient matches
            if (n.targetUserId && n.targetUserId === user.id)
                return true;
            // Role broadcast matches
            if (n.targetRole && n.targetRole === user.role)
                return true;
            // Global broadcast (neither role nor user specified)
            if (!n.targetRole && !n.targetUserId)
                return true;
            // Administrators have institutional oversight
            if (user.role === 'ADMIN')
                return true;
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
    static getUnreadCountForUser(user) {
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
    static markAsRead(notificationId, user) {
        const n = pool_1.db.findOne('notifications', (item) => item.id === notificationId);
        if (!n)
            return false;
        // Optional scoping check
        if (user && user.role !== 'ADMIN') {
            const isRecipient = (n.targetUserId && n.targetUserId === user.id) ||
                (n.targetRole && n.targetRole === user.role) ||
                (!n.targetRole && !n.targetUserId);
            if (!isRecipient)
                return false;
        }
        const updated = pool_1.db.update('notifications', (item) => item.id === notificationId, {
            isRead: true,
            readAt: new Date().toISOString()
        });
        return !!updated;
    }
    /**
     * Marks all scoped notifications as read for the user.
     */
    static markAllAsReadForUser(user) {
        const userNotifications = this.getNotificationsForUser(user, { unreadOnly: true });
        const now = new Date().toISOString();
        let count = 0;
        for (const n of userNotifications) {
            pool_1.db.update('notifications', (item) => item.id === n.id, {
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
    static deleteNotification(notificationId, user) {
        const n = pool_1.db.findOne('notifications', (item) => item.id === notificationId);
        if (!n)
            return false;
        if (user && user.role !== 'ADMIN' && n.targetUserId !== user.id) {
            return false;
        }
        return pool_1.db.delete('notifications', (item) => item.id === notificationId);
    }
    /**
     * Retrieves or provisions the user's notification preferences.
     */
    static getUserPreferences(userId) {
        let pref = pool_1.db.findOne('notification_preferences', (p) => p.userId === userId);
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
            pool_1.db.insert('notification_preferences', pref);
        }
        return pref;
    }
    /**
     * Updates notification preferences for the user.
     */
    static updateUserPreferences(userId, updates) {
        const current = this.getUserPreferences(userId);
        const updated = {
            ...current,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        pool_1.db.update('notification_preferences', (p) => p.userId === userId, updated);
        return updated;
    }
    /**
     * Resets cooldown map (useful for test assertions).
     */
    static clearCooldowns() {
        cooldownMap.clear();
    }
}
exports.NotificationService = NotificationService;
