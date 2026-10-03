// ============================================================================
// LABGUARD V2: Notifications Controller Layer
// ============================================================================

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotificationService, GetNotificationsOptions } from '../services/notificationService';
import { NotificationSeverity, UserRole } from '../../../shared/types';

/**
 * GET /api/notifications
 * Retrieves notifications for the caller with filtering and telemetry counts.
 */
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { unreadOnly, severity, eventType, limit, offset } = req.query;

  const options: GetNotificationsOptions = {};
  if (unreadOnly === 'true' || unreadOnly === '1') {
    options.unreadOnly = true;
  }
  if (severity && typeof severity === 'string') {
    options.severity = severity.toUpperCase() as NotificationSeverity;
  }
  if (eventType && typeof eventType === 'string') {
    options.eventType = eventType;
  }
  if (limit) {
    options.limit = parseInt(limit as string, 10);
  }
  if (offset) {
    options.offset = parseInt(offset as string, 10);
  }

  const notifications = NotificationService.getNotificationsForUser(user, options);
  const badge = NotificationService.getUnreadCountForUser(user);

  return res.json({
    success: true,
    data: notifications,
    badge
  });
};

/**
 * GET /api/notifications/badge
 * GET /api/notifications/count
 * Returns unread notification counts.
 */
export const getNotificationBadge = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const badge = NotificationService.getUnreadCountForUser(user);

  return res.json({
    success: true,
    data: badge
  });
};

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const success = NotificationService.markAsRead(id, user);
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

/**
 * POST /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const count = NotificationService.markAllAsReadForUser(user);

  return res.json({
    success: true,
    count,
    message: `Marked ${count} notifications as read`
  });
};

/**
 * POST /api/notifications
 * Dispatches an administrative or system notification.
 */
export const createNotification = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const {
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
    metadata
  } = req.body;

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

  const notification = await NotificationService.dispatchEventNotification({
    title,
    message,
    severity: severity ? (severity.toUpperCase() as NotificationSeverity) : 'INFO',
    eventType: eventType || 'SYSTEM_ANNOUNCEMENT',
    labCode,
    labId,
    pcCode,
    computerId,
    targetRole: targetRole ? (targetRole.toUpperCase() as UserRole) : undefined,
    targetUserId,
    metadata
  });

  return res.status(201).json({
    success: true,
    data: notification,
    message: notification ? 'Notification dispatched successfully' : 'Notification suppressed by deduplication cooldown or user preferences'
  });
};

/**
 * DELETE /api/notifications/:id
 * Dismisses/deletes a notification.
 */
export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const success = NotificationService.deleteNotification(id, user);
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

/**
 * GET /api/notifications/preferences
 * Retrieves user notification preferences.
 */
export const getPreferences = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const prefs = NotificationService.getUserPreferences(user.id);

  return res.json({
    success: true,
    data: prefs
  });
};

/**
 * PATCH /api/notifications/preferences
 * Updates user notification preferences.
 */
export const updatePreferences = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { emailAlerts, hardwareAlerts, maintenanceAlerts, issueAlerts, sessionAlerts, criticalOnly } = req.body;

  const updated = NotificationService.updateUserPreferences(user.id, {
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
