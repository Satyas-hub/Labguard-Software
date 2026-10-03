"use strict";
// ============================================================================
// LABGUARD V2: Notifications Controller Layer
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePreferences = exports.getPreferences = exports.deleteNotification = exports.createNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotificationBadge = exports.getNotifications = void 0;
const notificationService_1 = require("../services/notificationService");
/**
 * GET /api/notifications
 * Retrieves notifications for the caller with filtering and telemetry counts.
 */
const getNotifications = async (req, res) => {
    const user = req.user;
    const { unreadOnly, severity, eventType, limit, offset } = req.query;
    const options = {};
    if (unreadOnly === 'true' || unreadOnly === '1') {
        options.unreadOnly = true;
    }
    if (severity && typeof severity === 'string') {
        options.severity = severity.toUpperCase();
    }
    if (eventType && typeof eventType === 'string') {
        options.eventType = eventType;
    }
    if (limit) {
        options.limit = parseInt(limit, 10);
    }
    if (offset) {
        options.offset = parseInt(offset, 10);
    }
    const notifications = notificationService_1.NotificationService.getNotificationsForUser(user, options);
    const badge = notificationService_1.NotificationService.getUnreadCountForUser(user);
    return res.json({
        success: true,
        data: notifications,
        badge
    });
};
exports.getNotifications = getNotifications;
/**
 * GET /api/notifications/badge
 * GET /api/notifications/count
 * Returns unread notification counts.
 */
const getNotificationBadge = async (req, res) => {
    const user = req.user;
    const badge = notificationService_1.NotificationService.getUnreadCountForUser(user);
    return res.json({
        success: true,
        data: badge
    });
};
exports.getNotificationBadge = getNotificationBadge;
/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
const markAsRead = async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const success = notificationService_1.NotificationService.markAsRead(id, user);
    if (!success) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Notification not found or unauthorized'
        });
    }
    return res.json({
        success: true,
        message: 'Notification marked as read'
    });
};
exports.markAsRead = markAsRead;
/**
 * POST /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
const markAllAsRead = async (req, res) => {
    const user = req.user;
    const count = notificationService_1.NotificationService.markAllAsReadForUser(user);
    return res.json({
        success: true,
        count,
        message: `Marked ${count} notifications as read`
    });
};
exports.markAllAsRead = markAllAsRead;
/**
 * POST /api/notifications
 * Dispatches an administrative or system notification.
 */
const createNotification = async (req, res) => {
    const user = req.user;
    const { title, message, severity, eventType, labCode, labId, pcCode, computerId, targetRole, targetUserId, metadata } = req.body;
    if (!title || !message) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Title and message are required'
        });
    }
    // Anti-escalation: only ADMIN or LAB_ASSISTANT can broadcast notifications
    if (user.role !== 'ADMIN' && user.role !== 'LAB_ASSISTANT') {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Students and Faculty cannot dispatch system notifications'
        });
    }
    const notification = await notificationService_1.NotificationService.dispatchEventNotification({
        title,
        message,
        severity: severity ? severity.toUpperCase() : 'INFO',
        eventType: eventType || 'SYSTEM_ANNOUNCEMENT',
        labCode,
        labId,
        pcCode,
        computerId,
        targetRole: targetRole ? targetRole.toUpperCase() : undefined,
        targetUserId,
        metadata
    });
    return res.status(201).json({
        success: true,
        data: notification,
        message: notification ? 'Notification dispatched successfully' : 'Notification suppressed by deduplication cooldown or user preferences'
    });
};
exports.createNotification = createNotification;
/**
 * DELETE /api/notifications/:id
 * Dismisses/deletes a notification.
 */
const deleteNotification = async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const success = notificationService_1.NotificationService.deleteNotification(id, user);
    if (!success) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Notification not found or unauthorized to delete'
        });
    }
    return res.json({
        success: true,
        message: 'Notification deleted successfully'
    });
};
exports.deleteNotification = deleteNotification;
/**
 * GET /api/notifications/preferences
 * Retrieves user notification preferences.
 */
const getPreferences = async (req, res) => {
    const user = req.user;
    const prefs = notificationService_1.NotificationService.getUserPreferences(user.id);
    return res.json({
        success: true,
        data: prefs
    });
};
exports.getPreferences = getPreferences;
/**
 * PATCH /api/notifications/preferences
 * Updates user notification preferences.
 */
const updatePreferences = async (req, res) => {
    const user = req.user;
    const { emailAlerts, hardwareAlerts, maintenanceAlerts, issueAlerts, sessionAlerts, criticalOnly } = req.body;
    const updated = notificationService_1.NotificationService.updateUserPreferences(user.id, {
        ...(typeof emailAlerts === 'boolean' && { emailAlerts }),
        ...(typeof hardwareAlerts === 'boolean' && { hardwareAlerts }),
        ...(typeof maintenanceAlerts === 'boolean' && { maintenanceAlerts }),
        ...(typeof issueAlerts === 'boolean' && { issueAlerts }),
        ...(typeof sessionAlerts === 'boolean' && { sessionAlerts }),
        ...(typeof criticalOnly === 'boolean' && { criticalOnly })
    });
    return res.json({
        success: true,
        data: updated,
        message: 'Notification preferences updated'
    });
};
exports.updatePreferences = updatePreferences;
