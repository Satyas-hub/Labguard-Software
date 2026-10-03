"use strict";
// ============================================================================
// LABGUARD V2: Central API Routes Definition
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const authController = __importStar(require("../controllers/authController"));
const academicController = __importStar(require("../controllers/academicController"));
const labController = __importStar(require("../controllers/labController"));
const sessionController = __importStar(require("../controllers/sessionController"));
const issueController = __importStar(require("../controllers/issueController"));
const auditController = __importStar(require("../controllers/auditController"));
const equipmentController = __importStar(require("../controllers/equipmentController"));
const assistantController = __importStar(require("../controllers/assistantController"));
const studentController = __importStar(require("../controllers/studentController"));
const notificationController = __importStar(require("../controllers/notificationController"));
const reportController = __importStar(require("../controllers/reportController"));
const analyticsController = __importStar(require("../controllers/analyticsController"));
const updateController = __importStar(require("../controllers/updateController"));
const syncService_1 = require("../services/syncService");
const supabaseSyncService_1 = require("../services/supabaseSyncService");
const rateLimit_1 = require("../middleware/rateLimit");
const validate_1 = require("../middleware/validate");
const validationSchemas_1 = require("../schemas/validationSchemas");
const router = (0, express_1.Router)();
// ----------------------------------------------------------------------------
// Public & Authentication Endpoints
// ----------------------------------------------------------------------------
router.post('/auth/login', rateLimit_1.authRateLimiter, (0, validate_1.validateBody)(validationSchemas_1.LoginSchema), authController.login);
router.post('/auth/refresh', (0, validate_1.validateBody)(validationSchemas_1.RefreshTokenSchema), authController.refreshToken);
router.post('/auth/verify-staff-exit', authController.verifyStaffExit);
// ----------------------------------------------------------------------------
// Protected User Profile
// ----------------------------------------------------------------------------
router.get('/auth/profile', auth_1.authenticateJwt, authController.getProfile);
router.post('/auth/verify-offline-token', authController.verifyOfflineToken);
// ----------------------------------------------------------------------------
// Admin User Management (ADMIN Only)
// ----------------------------------------------------------------------------
router.get(['/users', '/admin/users'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.listUsers);
router.post(['/users', '/admin/users'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), (0, validate_1.validateBody)(validationSchemas_1.CreateUserSchema), authController.createUser);
router.put(['/users/:userId', '/admin/users/:userId'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.updateUser);
router.patch(['/users/:userId/status', '/admin/users/:userId/status'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.toggleUserStatus);
router.delete(['/users/:userId', '/admin/users/:userId'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.deleteUser);
// ----------------------------------------------------------------------------
// Academic Management & Enrollment (ADMIN and FACULTY Only)
// ----------------------------------------------------------------------------
router.get('/departments', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getDepartments);
router.post('/departments', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createDepartment);
router.put('/departments/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.updateDepartment);
router.delete('/departments/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteDepartment);
router.get('/courses', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getCourses);
router.post('/courses', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createCourse);
router.put('/courses/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.updateCourse);
router.delete('/courses/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteCourse);
router.get('/subjects', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getSubjects);
router.post('/subjects', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createSubject);
router.put('/subjects/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.updateSubject);
router.delete('/subjects/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteSubject);
router.get('/academic-years', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getAcademicYears);
router.post('/academic-years', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createAcademicYear);
router.put('/academic-years/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.updateAcademicYear);
router.delete('/academic-years/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteAcademicYear);
router.get('/sections', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getSections);
router.post('/sections', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createSection);
router.delete('/sections/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteSection);
router.get('/classes', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getClasses);
router.post('/classes', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createClass);
router.put('/classes/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.updateClass);
router.delete('/classes/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.deleteClass);
router.get('/classes/:id/students', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getClassStudents);
router.post('/classes/:id/enroll', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.enrollStudentInClass);
router.delete('/classes/:id/students/:studentId', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.unenrollStudentFromClass);
router.get('/students', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getStudents);
router.post('/students/enroll', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.enrollStudent);
router.get('/enrollment-requests', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.getEnrollmentRequests);
router.patch('/enrollment-requests/:id/review', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.reviewEnrollmentRequest);
router.get('/faculty/dashboard', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['FACULTY', 'ADMIN']), academicController.getFacultyDashboard);
router.get('/assistant/dashboard', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['LAB_ASSISTANT', 'ADMIN']), assistantController.getAssistantDashboard);
router.get('/student/dashboard', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['STUDENT', 'ADMIN']), studentController.getStudentDashboard);
// ----------------------------------------------------------------------------
// Laboratories, PCs, Clients & Equipment
// ----------------------------------------------------------------------------
router.get('/labs', auth_1.authenticateJwt, labController.getLabs);
router.post('/labs', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.createLab);
router.get('/labs/:id', auth_1.authenticateJwt, labController.getLabById);
router.put('/labs/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.updateLab);
router.delete('/labs/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.deleteLab);
router.get('/labs/:id/stats', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), labController.getLabStats);
router.post('/labs/:id/staff', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.assignStaffToLab);
router.get('/labs/:id/staff', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), labController.getAssignedStaff);
router.get('/computers', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), auth_1.enforceLabScope, labController.getComputers);
router.get('/computers/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), labController.getComputerById);
router.post('/computers', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.createComputer);
router.put('/computers/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.updateComputer);
router.patch('/computers/:id/state', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), labController.updateComputerState);
router.post('/computers/:id/unbind', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.unbindComputer);
router.delete('/computers/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.deleteComputer);
router.get('/clients/available-labs', labController.getAvailableLabsForRegistration);
router.post('/clients/register', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), labController.registerClient);
router.post('/clients/heartbeat', (0, validate_1.validateBody)(validationSchemas_1.ClientHeartbeatSchema), labController.heartbeat);
router.get('/system/peripherals', labController.getSystemPeripherals);
// ----------------------------------------------------------------------------
// Physical Equipment & Peripheral Accountability (Phase 8)
// ----------------------------------------------------------------------------
router.get('/equipment', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), auth_1.enforceLabScope, equipmentController.getEquipment);
router.get('/equipment/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']), equipmentController.getEquipmentById);
router.post('/equipment', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), auth_1.enforceLabScope, equipmentController.createEquipment);
router.put('/equipment/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), equipmentController.updateEquipment);
router.patch('/equipment/:id/assign', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), equipmentController.assignEquipment);
router.post('/equipment/:id/replace', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), equipmentController.replaceEquipment);
router.delete('/equipment/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), equipmentController.deleteEquipment);
// ----------------------------------------------------------------------------
// Hardware Peripheral Events & Telemetry (Phase 11)
// ----------------------------------------------------------------------------
router.get('/hardware-events', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), assistantController.getHardwareEvents);
router.post(['/hardware-events', '/assistant/telemetry/event'], auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.createHardwareEvent);
router.patch('/hardware-events/:id/acknowledge', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.acknowledgeHardwareEvent);
// Faculty Subject/Assignment Alias
router.post('/faculty/assignments', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.createSubject);
// ----------------------------------------------------------------------------
// Student Sessions (Lifecycle & Scoped Endpoints - Phase 13)
// ----------------------------------------------------------------------------
router.post('/sessions/validate', auth_1.authenticateJwt, sessionController.validatePreSession);
router.post('/sessions/start', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['STUDENT']), (0, validate_1.validateBody)(validationSchemas_1.StartSessionSchema), sessionController.startSession);
router.post(['/sessions/end', '/sessions/:id/end'], auth_1.authenticateJwt, (0, validate_1.validateBody)(validationSchemas_1.EndSessionSchema), sessionController.endSession);
router.post('/sessions/recover', auth_1.authenticateJwt, sessionController.recoverCrashedSession);
router.post('/sessions/:id/heartbeat', auth_1.authenticateJwt, sessionController.heartbeatSession);
router.post('/sessions/:id/cancel', auth_1.authenticateJwt, sessionController.cancelSession);
router.post('/sessions/:id/force-end', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), sessionController.forceEndSession);
router.get('/sessions', auth_1.authenticateJwt, sessionController.listSessions);
router.get('/sessions/active', auth_1.authenticateJwt, sessionController.getActiveSessions);
router.get('/sessions/:id', auth_1.authenticateJwt, sessionController.getSessionById);
// ----------------------------------------------------------------------------
// Issue Tracking & Maintenance
// ----------------------------------------------------------------------------
router.post('/issues', auth_1.authenticateJwt, (0, validate_1.validateBody)(validationSchemas_1.ReportIssueSchema), issueController.reportIssue);
router.get('/issues', auth_1.authenticateJwt, issueController.listIssues);
router.get('/issues/:issueId', auth_1.authenticateJwt, issueController.getIssueById);
router.patch('/issues/:issueId/status', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), issueController.updateIssueStatus);
router.post('/issues/:issueId/evidence', auth_1.authenticateJwt, issueController.attachEvidence);
router.get('/maintenance', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), issueController.listMaintenance);
router.get('/maintenance/stats', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.getMaintenanceStats);
router.get('/maintenance/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.getMaintenanceById);
router.post('/maintenance', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), (0, validate_1.validateBody)(validationSchemas_1.CreateMaintenanceSchema), assistantController.createMaintenanceRecord);
router.patch('/maintenance/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.updateMaintenanceRecord);
router.post('/maintenance/:id/cancel', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), assistantController.cancelMaintenanceRecord);
// ----------------------------------------------------------------------------
// Offline Synchronization Engine
// ----------------------------------------------------------------------------
router.post(['/sync', '/sync/batch'], (0, validate_1.validateBody)(validationSchemas_1.BatchSyncSchema), async (req, res) => {
    try {
        const result = await syncService_1.SyncService.processSyncBatch(req.body);
        return res.json({ success: true, data: result });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'SYNC_ERROR', message: err.message });
    }
});
router.get('/sync/supabase/status', (_req, res) => {
    const stats = supabaseSyncService_1.SupabaseSyncService.getStats();
    return res.json({ success: true, data: stats });
});
// ----------------------------------------------------------------------------
// Notifications & Auditing
// ----------------------------------------------------------------------------
router.get('/notifications', auth_1.authenticateJwt, notificationController.getNotifications);
router.get('/notifications/badge', auth_1.authenticateJwt, notificationController.getNotificationBadge);
router.get('/notifications/count', auth_1.authenticateJwt, notificationController.getNotificationBadge);
router.post('/notifications', auth_1.authenticateJwt, notificationController.createNotification);
router.patch('/notifications/:id/read', auth_1.authenticateJwt, notificationController.markAsRead);
router.post('/notifications/read-all', auth_1.authenticateJwt, notificationController.markAllAsRead);
router.delete('/notifications/:id', auth_1.authenticateJwt, notificationController.deleteNotification);
router.get('/notifications/preferences', auth_1.authenticateJwt, notificationController.getPreferences);
router.patch('/notifications/preferences', auth_1.authenticateJwt, notificationController.updatePreferences);
router.get('/audit-logs', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAuditLogs);
router.get('/audit-logs/metadata', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAuditMetadata);
router.get('/audit-logs/export', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.exportAuditLogs);
router.get('/audit-logs/:id', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAuditLogById);
router.delete('/audit-logs/:id', auth_1.authenticateJwt, auditController.rejectAuditMutation);
router.put('/audit-logs/:id', auth_1.authenticateJwt, auditController.rejectAuditMutation);
router.patch('/audit-logs/:id', auth_1.authenticateJwt, auditController.rejectAuditMutation);
router.delete('/audit-logs', auth_1.authenticateJwt, auditController.rejectAuditMutation);
router.get('/analytics', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAdminAnalytics);
router.get('/analytics/dashboard', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY', 'LAB_ASSISTANT']), analyticsController.getAggregatedAnalytics);
// ----------------------------------------------------------------------------
// Institutional Reporting & Multi-Format Exports (Phase 22)
// ----------------------------------------------------------------------------
router.get('/reports/types', auth_1.authenticateJwt, reportController.getReportTypes);
router.post('/reports/generate', auth_1.authenticateJwt, reportController.generateReport);
router.get('/reports/export/:reportType', auth_1.authenticateJwt, reportController.exportReport);
// ----------------------------------------------------------------------------
// System & Application Updates (Phase 29)
// ----------------------------------------------------------------------------
router.get('/system/updates/check', updateController.checkForUpdates);
router.post('/system/updates/verify', updateController.verifyUpdateIntegrity);
exports.default = router;
