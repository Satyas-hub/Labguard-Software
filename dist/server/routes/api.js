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
const syncService_1 = require("../services/syncService");
const notificationService_1 = require("../services/notificationService");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// ----------------------------------------------------------------------------
// Public & Authentication Endpoints
// ----------------------------------------------------------------------------
router.post('/auth/login', rateLimit_1.authRateLimiter, authController.login);
router.post('/auth/refresh', authController.refreshToken);
// ----------------------------------------------------------------------------
// Protected User Profile
// ----------------------------------------------------------------------------
router.get('/auth/profile', auth_1.authenticateJwt, authController.getProfile);
// ----------------------------------------------------------------------------
// Admin User Management
// ----------------------------------------------------------------------------
router.get('/users', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.listUsers);
router.post('/users', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), authController.createUser);
// ----------------------------------------------------------------------------
// Academic Management & Enrollment
// ----------------------------------------------------------------------------
router.get('/departments', auth_1.authenticateJwt, academicController.getDepartments);
router.post('/departments', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createDepartment);
router.get('/courses', auth_1.authenticateJwt, academicController.getCourses);
router.post('/courses', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createCourse);
router.get('/classes', auth_1.authenticateJwt, academicController.getClasses);
router.post('/classes', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), academicController.createClass);
router.get('/students', auth_1.authenticateJwt, academicController.getStudents);
router.post('/students/enroll', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'FACULTY']), academicController.enrollStudent);
// ----------------------------------------------------------------------------
// Laboratories, PCs, Clients & Equipment
// ----------------------------------------------------------------------------
router.get('/labs', auth_1.authenticateJwt, labController.getLabs);
router.post('/labs', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.createLab);
router.get('/computers', auth_1.authenticateJwt, labController.getComputers);
router.post('/computers', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), labController.createComputer);
router.post('/clients/register', auth_1.authenticateJwt, labController.registerClient);
router.post('/clients/heartbeat', auth_1.authenticateJwt, labController.heartbeat);
router.get('/equipment', auth_1.authenticateJwt, labController.getEquipment);
router.post('/equipment', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), labController.createEquipment);
// ----------------------------------------------------------------------------
// Student Sessions (Lifecycle & Scoped Endpoints)
// ----------------------------------------------------------------------------
router.post('/sessions/start', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['STUDENT']), sessionController.startSession);
router.post('/sessions/end', auth_1.authenticateJwt, sessionController.endSession);
router.get('/sessions', auth_1.authenticateJwt, sessionController.listSessions);
// ----------------------------------------------------------------------------
// Issue Tracking & Maintenance
// ----------------------------------------------------------------------------
router.post('/issues', auth_1.authenticateJwt, issueController.reportIssue);
router.get('/issues', auth_1.authenticateJwt, issueController.listIssues);
router.patch('/issues/:issueId/status', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), issueController.updateIssueStatus);
router.get('/maintenance', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN', 'LAB_ASSISTANT']), issueController.listMaintenance);
// ----------------------------------------------------------------------------
// Offline Synchronization Engine
// ----------------------------------------------------------------------------
router.post(['/sync', '/sync/batch'], auth_1.authenticateJwt, async (req, res) => {
    try {
        const result = await syncService_1.SyncService.processSyncBatch(req.body);
        return res.json({ success: true, data: result });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'SYNC_ERROR', message: err.message });
    }
});
// ----------------------------------------------------------------------------
// Notifications & Auditing
// ----------------------------------------------------------------------------
router.get('/notifications', auth_1.authenticateJwt, (req, res) => {
    const notifications = notificationService_1.NotificationService.getNotificationsForUser(req.user);
    return res.json({ success: true, data: notifications });
});
router.patch('/notifications/:id/read', auth_1.authenticateJwt, (req, res) => {
    const success = notificationService_1.NotificationService.markAsRead(req.params.id);
    return res.json({ success });
});
router.get('/audit-logs', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAuditLogs);
router.get('/analytics', auth_1.authenticateJwt, (0, auth_1.requireRoles)(['ADMIN']), auditController.getAdminAnalytics);
exports.default = router;
