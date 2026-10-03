"use strict";
// ============================================================================
// LABGUARD V2: Role-Aware Notification Routing & Deduplication Service
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const cooldownMap = new Map();
const COOLDOWN_WINDOW_MS = 60000; // 1 minute deduplication cooldown
class NotificationService {
    /**
     * Route event to appropriate roles based on institutional policy
     */
    static async dispatchEventNotification(params) {
        const { title, message, severity, eventType, labCode, pcCode, targetRole, targetUserId } = params;
        // Deduplication check
        const dedupKey = `${eventType}:${labCode || '*'}:${pcCode || '*'}:${targetRole || '*'}`;
        const now = Date.now();
        const lastSent = cooldownMap.get(dedupKey) || 0;
        if (now - lastSent < COOLDOWN_WINDOW_MS && severity !== 'CRITICAL') {
            // Cooldown active, suppress duplicate notification
            return null;
        }
        cooldownMap.set(dedupKey, now);
        const notification = {
            id: (0, uuid_1.v4)(),
            title,
            message,
            severity,
            eventType,
            labCode,
            pcCode,
            targetRole,
            targetUserId,
            isRead: false,
            createdAt: new Date().toISOString()
        };
        pool_1.db.insert('notifications', notification);
        return notification;
    }
    static getNotificationsForUser(user) {
        return pool_1.db.find('notifications', (n) => {
            // Direct recipient
            if (n.targetUserId && n.targetUserId === user.id)
                return true;
            // Role broadcast
            if (n.targetRole && n.targetRole === user.role)
                return true;
            // Admin sees institutional notifications
            if (user.role === 'ADMIN')
                return true;
            return false;
        });
    }
    static markAsRead(notificationId) {
        const updated = pool_1.db.update('notifications', (n) => n.id === notificationId, { isRead: true });
        return !!updated;
    }
}
exports.NotificationService = NotificationService;
