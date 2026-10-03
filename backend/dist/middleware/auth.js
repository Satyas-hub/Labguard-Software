"use strict";
// ============================================================================
// LABGUARD V2: Authentication & Strict Server-Side Scoped RBAC Middleware
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceStudentSelfScope = exports.enforceLabAssistantScope = exports.enforceFacultyScope = exports.requireRoles = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const authenticateJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication token missing or invalid format'
        });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Session token has expired or is invalid'
        });
    }
};
exports.authenticateJwt = authenticateJwt;
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: `Role ${req.user.role} is not authorized for this institutional endpoint`
            });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
/**
 * Server-side scoping: Validates that Faculty only accesses assigned classes / students / labs
 */
const enforceFacultyScope = (req, res, next) => {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    if (req.user.role === 'ADMIN')
        return next(); // Admin has unrestricted access
    if (req.user.role !== 'FACULTY') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Requires FACULTY authorization' });
    }
    // Scoping check for requested lab or class
    const requestedLabId = req.params.labId || req.query.labId;
    if (requestedLabId && req.user.assignedLabs && !req.user.assignedLabs.includes(requestedLabId)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: 'Faculty member is not assigned to the requested laboratory'
        });
    }
    next();
};
exports.enforceFacultyScope = enforceFacultyScope;
/**
 * Server-side scoping: Validates that Lab Assistant only accesses assigned labs
 */
const enforceLabAssistantScope = (req, res, next) => {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    if (req.user.role === 'ADMIN')
        return next();
    if (req.user.role !== 'LAB_ASSISTANT') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Requires LAB_ASSISTANT authorization' });
    }
    const requestedLabId = req.params.labId || req.query.labId;
    if (requestedLabId && req.user.assignedLabs && !req.user.assignedLabs.includes(requestedLabId)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: 'Lab Assistant is not authorized for this laboratory facility'
        });
    }
    next();
};
exports.enforceLabAssistantScope = enforceLabAssistantScope;
/**
 * Server-side scoping: Validates that Student can only view their own data and sessions
 */
const enforceStudentSelfScope = (req, res, next) => {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    if (req.user.role === 'ADMIN' || req.user.role === 'FACULTY' || req.user.role === 'LAB_ASSISTANT') {
        return next();
    }
    const targetStudentId = req.params.studentId || req.query.studentId || req.body.studentId;
    if (targetStudentId && targetStudentId !== req.user.id && targetStudentId !== req.user.identifier) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SELF_ONLY',
            message: 'Students may only query or modify their own authenticated record'
        });
    }
    next();
};
exports.enforceStudentSelfScope = enforceStudentSelfScope;
