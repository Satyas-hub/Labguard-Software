// ============================================================================
// LABGUARD V2: Central API Routes Definition
// ============================================================================

import { Router } from 'express';
import {
  authenticateJwt,
  requireRoles,
  enforceFacultyScope,
  enforceLabAssistantScope,
  enforceStudentSelfScope,
  enforceLabScope
} from '../middleware/auth';

import * as authController from '../controllers/authController';
import * as academicController from '../controllers/academicController';
import * as labController from '../controllers/labController';
import * as sessionController from '../controllers/sessionController';
import * as issueController from '../controllers/issueController';
import * as auditController from '../controllers/auditController';
import * as equipmentController from '../controllers/equipmentController';
import * as assistantController from '../controllers/assistantController';
import * as studentController from '../controllers/studentController';
import * as notificationController from '../controllers/notificationController';
import * as reportController from '../controllers/reportController';
import * as analyticsController from '../controllers/analyticsController';
import * as updateController from '../controllers/updateController';
import { SyncService } from '../services/syncService';
import { SupabaseSyncService } from '../services/supabaseSyncService';
import { NotificationService } from '../services/notificationService';
import { authRateLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import {
  LoginSchema,
  RefreshTokenSchema,
  CreateUserSchema,
  StartSessionSchema,
  EndSessionSchema,
  ReportIssueSchema,
  ClientHeartbeatSchema,
  BatchSyncSchema,
  CreateMaintenanceSchema
} from '../schemas/validationSchemas';

const router = Router();

// ----------------------------------------------------------------------------
// Public & Authentication Endpoints
// ----------------------------------------------------------------------------
router.post('/auth/login', authRateLimiter, validateBody(LoginSchema), authController.login);
router.post('/auth/refresh', validateBody(RefreshTokenSchema), authController.refreshToken);
router.post('/auth/verify-staff-exit', authController.verifyStaffExit);

// ----------------------------------------------------------------------------
// Protected User Profile
// ----------------------------------------------------------------------------
router.get('/auth/profile', authenticateJwt, authController.getProfile);
router.post('/auth/verify-offline-token', authController.verifyOfflineToken);

// ----------------------------------------------------------------------------
// Admin User Management (ADMIN Only)
// ----------------------------------------------------------------------------
router.get(['/users', '/admin/users'], authenticateJwt, requireRoles(['ADMIN']), authController.listUsers);
router.post(['/users', '/admin/users'], authenticateJwt, requireRoles(['ADMIN']), validateBody(CreateUserSchema), authController.createUser);
router.put(['/users/:userId', '/admin/users/:userId'], authenticateJwt, requireRoles(['ADMIN']), authController.updateUser);
router.patch(['/users/:userId/status', '/admin/users/:userId/status'], authenticateJwt, requireRoles(['ADMIN']), authController.toggleUserStatus);
router.delete(['/users/:userId', '/admin/users/:userId'], authenticateJwt, requireRoles(['ADMIN']), authController.deleteUser);

// ----------------------------------------------------------------------------
// Academic Management & Enrollment (ADMIN and FACULTY Only)
// ----------------------------------------------------------------------------
router.get('/departments', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getDepartments);
router.post('/departments', authenticateJwt, requireRoles(['ADMIN']), academicController.createDepartment);
router.put('/departments/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.updateDepartment);
router.delete('/departments/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteDepartment);

router.get('/courses', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getCourses);
router.post('/courses', authenticateJwt, requireRoles(['ADMIN']), academicController.createCourse);
router.put('/courses/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.updateCourse);
router.delete('/courses/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteCourse);

router.get('/subjects', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getSubjects);
router.post('/subjects', authenticateJwt, requireRoles(['ADMIN']), academicController.createSubject);
router.put('/subjects/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.updateSubject);
router.delete('/subjects/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteSubject);

router.get('/academic-years', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getAcademicYears);
router.post('/academic-years', authenticateJwt, requireRoles(['ADMIN']), academicController.createAcademicYear);
router.put('/academic-years/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.updateAcademicYear);
router.delete('/academic-years/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteAcademicYear);

router.get('/sections', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getSections);
router.post('/sections', authenticateJwt, requireRoles(['ADMIN']), academicController.createSection);
router.delete('/sections/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteSection);

router.get('/classes', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getClasses);
router.post('/classes', authenticateJwt, requireRoles(['ADMIN']), academicController.createClass);
router.put('/classes/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.updateClass);
router.delete('/classes/:id', authenticateJwt, requireRoles(['ADMIN']), academicController.deleteClass);

router.get('/classes/:id/students', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getClassStudents);
router.post('/classes/:id/enroll', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.enrollStudentInClass);
router.delete('/classes/:id/students/:studentId', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.unenrollStudentFromClass);

router.get('/students', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getStudents);
router.post('/students/enroll', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.enrollStudent);

router.get('/enrollment-requests', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.getEnrollmentRequests);
router.patch('/enrollment-requests/:id/review', authenticateJwt, requireRoles(['ADMIN']), academicController.reviewEnrollmentRequest);

router.get('/faculty/dashboard', authenticateJwt, requireRoles(['FACULTY', 'ADMIN']), academicController.getFacultyDashboard);
router.get('/assistant/dashboard', authenticateJwt, requireRoles(['LAB_ASSISTANT', 'ADMIN']), assistantController.getAssistantDashboard);
router.get('/student/dashboard', authenticateJwt, requireRoles(['STUDENT', 'ADMIN']), studentController.getStudentDashboard);

// ----------------------------------------------------------------------------
// Laboratories, PCs, Clients & Equipment
// ----------------------------------------------------------------------------
router.get('/labs', authenticateJwt, labController.getLabs);
router.post('/labs', authenticateJwt, requireRoles(['ADMIN']), labController.createLab);
router.get('/labs/:id', authenticateJwt, labController.getLabById);
router.put('/labs/:id', authenticateJwt, requireRoles(['ADMIN']), labController.updateLab);
router.delete('/labs/:id', authenticateJwt, requireRoles(['ADMIN']), labController.deleteLab);
router.get('/labs/:id/stats', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), labController.getLabStats);
router.post('/labs/:id/staff', authenticateJwt, requireRoles(['ADMIN']), labController.assignStaffToLab);
router.get('/labs/:id/staff', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), labController.getAssignedStaff);

router.get('/computers', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), enforceLabScope, labController.getComputers);
router.get('/computers/:id', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), labController.getComputerById);
router.post('/computers', authenticateJwt, requireRoles(['ADMIN']), labController.createComputer);
router.put('/computers/:id', authenticateJwt, requireRoles(['ADMIN']), labController.updateComputer);
router.patch('/computers/:id/state', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), labController.updateComputerState);
router.post('/computers/:id/unbind', authenticateJwt, requireRoles(['ADMIN']), labController.unbindComputer);
router.delete('/computers/:id', authenticateJwt, requireRoles(['ADMIN']), labController.deleteComputer);

router.get('/clients/available-labs', labController.getAvailableLabsForRegistration);
router.post('/clients/register', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), labController.registerClient);
router.post('/clients/heartbeat', validateBody(ClientHeartbeatSchema), labController.heartbeat);
router.get('/system/peripherals', labController.getSystemPeripherals);

// ----------------------------------------------------------------------------
// Physical Equipment & Peripheral Accountability (Phase 8)
// ----------------------------------------------------------------------------
router.get('/equipment', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), enforceLabScope, equipmentController.getEquipment);
router.get('/equipment/:id', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), equipmentController.getEquipmentById);
router.post('/equipment', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), enforceLabScope, equipmentController.createEquipment);
router.put('/equipment/:id', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), equipmentController.updateEquipment);
router.patch('/equipment/:id/assign', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), equipmentController.assignEquipment);
router.post('/equipment/:id/replace', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), equipmentController.replaceEquipment);
router.delete('/equipment/:id', authenticateJwt, requireRoles(['ADMIN']), equipmentController.deleteEquipment);

// ----------------------------------------------------------------------------
// Hardware Peripheral Events & Telemetry (Phase 11)
// ----------------------------------------------------------------------------
router.get('/hardware-events', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), assistantController.getHardwareEvents);
router.post(['/hardware-events', '/assistant/telemetry/event'], authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.createHardwareEvent);
router.patch('/hardware-events/:id/acknowledge', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.acknowledgeHardwareEvent);

// Faculty Subject/Assignment Alias
router.post('/faculty/assignments', authenticateJwt, requireRoles(['ADMIN', 'FACULTY']), academicController.createSubject);

// ----------------------------------------------------------------------------
// Student Sessions (Lifecycle & Scoped Endpoints - Phase 13)
// ----------------------------------------------------------------------------
router.post('/sessions/validate', authenticateJwt, sessionController.validatePreSession);
router.post('/sessions/start', authenticateJwt, requireRoles(['STUDENT']), validateBody(StartSessionSchema), sessionController.startSession);
router.post(['/sessions/end', '/sessions/:id/end'], authenticateJwt, validateBody(EndSessionSchema), sessionController.endSession);
router.post('/sessions/recover', authenticateJwt, sessionController.recoverCrashedSession);
router.post('/sessions/:id/heartbeat', authenticateJwt, sessionController.heartbeatSession);
router.post('/sessions/:id/cancel', authenticateJwt, sessionController.cancelSession);
router.post('/sessions/:id/force-end', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), sessionController.forceEndSession);
router.get('/sessions', authenticateJwt, sessionController.listSessions);
router.get('/sessions/active', authenticateJwt, sessionController.getActiveSessions);
router.get('/sessions/:id', authenticateJwt, sessionController.getSessionById);

// ----------------------------------------------------------------------------
// Issue Tracking & Maintenance
// ----------------------------------------------------------------------------
router.post('/issues', authenticateJwt, validateBody(ReportIssueSchema), issueController.reportIssue);
router.get('/issues', authenticateJwt, issueController.listIssues);
router.get('/issues/:issueId', authenticateJwt, issueController.getIssueById);
router.patch('/issues/:issueId/status', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), issueController.updateIssueStatus);
router.post('/issues/:issueId/evidence', authenticateJwt, issueController.attachEvidence);
router.get('/maintenance', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), issueController.listMaintenance);
router.get('/maintenance/stats', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.getMaintenanceStats);
router.get('/maintenance/:id', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.getMaintenanceById);
router.post('/maintenance', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), validateBody(CreateMaintenanceSchema), assistantController.createMaintenanceRecord);
router.patch('/maintenance/:id', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.updateMaintenanceRecord);
router.post('/maintenance/:id/cancel', authenticateJwt, requireRoles(['ADMIN', 'LAB_ASSISTANT']), assistantController.cancelMaintenanceRecord);

// ----------------------------------------------------------------------------
// Offline Synchronization Engine
// ----------------------------------------------------------------------------
router.post(['/sync', '/sync/batch'], validateBody(BatchSyncSchema), async (req, res) => {
  try {
    const result = await SyncService.processSyncBatch(req.body);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'SYNC_ERROR', message: err.message });
  }
});

router.get('/sync/supabase/status', (_req, res) => {
  const stats = SupabaseSyncService.getStats();
  return res.json({ success: true, data: stats });
});

// ----------------------------------------------------------------------------
// Notifications & Auditing
// ----------------------------------------------------------------------------
router.get('/notifications', authenticateJwt, notificationController.getNotifications);
router.get('/notifications/badge', authenticateJwt, notificationController.getNotificationBadge);
router.get('/notifications/count', authenticateJwt, notificationController.getNotificationBadge);
router.post('/notifications', authenticateJwt, notificationController.createNotification);
router.patch('/notifications/:id/read', authenticateJwt, notificationController.markAsRead);
router.post('/notifications/read-all', authenticateJwt, notificationController.markAllAsRead);
router.delete('/notifications/:id', authenticateJwt, notificationController.deleteNotification);
router.get('/notifications/preferences', authenticateJwt, notificationController.getPreferences);
router.patch('/notifications/preferences', authenticateJwt, notificationController.updatePreferences);

router.get('/audit-logs', authenticateJwt, requireRoles(['ADMIN']), auditController.getAuditLogs);
router.get('/audit-logs/metadata', authenticateJwt, requireRoles(['ADMIN']), auditController.getAuditMetadata);
router.get('/audit-logs/export', authenticateJwt, requireRoles(['ADMIN']), auditController.exportAuditLogs);
router.get('/audit-logs/:id', authenticateJwt, requireRoles(['ADMIN']), auditController.getAuditLogById);
router.delete('/audit-logs/:id', authenticateJwt, auditController.rejectAuditMutation);
router.put('/audit-logs/:id', authenticateJwt, auditController.rejectAuditMutation);
router.patch('/audit-logs/:id', authenticateJwt, auditController.rejectAuditMutation);
router.delete('/audit-logs', authenticateJwt, auditController.rejectAuditMutation);

router.get('/analytics', authenticateJwt, requireRoles(['ADMIN']), auditController.getAdminAnalytics);
router.get('/analytics/dashboard', authenticateJwt, requireRoles(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), analyticsController.getAggregatedAnalytics);

// ----------------------------------------------------------------------------
// Institutional Reporting & Multi-Format Exports (Phase 22)
// ----------------------------------------------------------------------------
router.get('/reports/types', authenticateJwt, reportController.getReportTypes);
router.post('/reports/generate', authenticateJwt, reportController.generateReport);
router.get('/reports/export/:reportType', authenticateJwt, reportController.exportReport);

// ----------------------------------------------------------------------------
// System & Application Updates (Phase 29)
// ----------------------------------------------------------------------------
router.get('/system/updates/check', updateController.checkForUpdates);
router.post('/system/updates/verify', updateController.verifyUpdateIntegrity);

export default router;
