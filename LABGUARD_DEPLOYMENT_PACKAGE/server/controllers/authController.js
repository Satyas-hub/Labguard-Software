"use strict";
// ============================================================================
// LABGUARD V2: Authentication & User Controller
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = exports.createUser = exports.getProfile = exports.refreshToken = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
const rateLimit_1 = require("../middleware/rateLimit");
// Ensure bootstrap institutional accounts exist for all 4 roles if database is fresh
const ensureBootstrapInstitutionalUsers = async () => {
    const salt = bcryptjs_1.default.genSaltSync(10);
    const bootstrapUsers = [
        {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@labguard.edu',
            password: 'Admin@123456',
            fullName: 'Institutional System Administrator',
            role: 'ADMIN',
            phone: '+1 800-LABGUARD',
            identifier: 'admin@labguard.edu'
        },
        {
            id: '00000000-0000-0000-0000-000000000002',
            email: 'faculty@labguard.edu',
            password: 'Faculty@123456',
            fullName: 'Dr. Sarah Jenkins (Faculty)',
            role: 'FACULTY',
            phone: '+1 800-LABGUARD-F',
            identifier: 'faculty@labguard.edu'
        },
        {
            id: '00000000-0000-0000-0000-000000000003',
            email: 'assistant@labguard.edu',
            password: 'Assistant@123456',
            fullName: 'David Vance (Lab Assistant)',
            role: 'LAB_ASSISTANT',
            phone: '+1 800-LABGUARD-A',
            identifier: 'assistant@labguard.edu'
        },
        {
            id: '00000000-0000-0000-0000-000000000004',
            email: 'student@labguard.edu',
            password: 'Student@123456',
            fullName: 'Alex Mercer (Student)',
            role: 'STUDENT',
            phone: '+1 800-LABGUARD-S',
            identifier: 'STU-2026-001'
        }
    ];
    for (const bu of bootstrapUsers) {
        const existing = pool_1.db.findOne('users', (u) => u.email === bu.email);
        if (!existing) {
            const passwordHash = bcryptjs_1.default.hashSync(bu.password, salt);
            const userObj = {
                id: bu.id,
                email: bu.email,
                passwordHash,
                fullName: bu.fullName,
                role: bu.role,
                phone: bu.phone,
                identifier: bu.identifier,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            pool_1.db.insert('users', userObj);
            if (bu.role === 'STUDENT') {
                pool_1.db.insert('students', {
                    id: (0, uuid_1.v4)(),
                    userId: bu.id,
                    studentId: bu.identifier,
                    department: 'Computer Science & Engineering',
                    course: 'B.Tech',
                    yearOfStudy: 3,
                    semester: 5,
                    section: 'A',
                    academicYear: '2026-2027',
                    createdAt: new Date().toISOString()
                });
            }
        }
    }
};
ensureBootstrapInstitutionalUsers();
const login = async (req, res) => {
    const { identifier, password, role } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Identifier and password are required'
        });
    }
    // Find user by email or student/employee identifier
    const user = pool_1.db.findOne('users', (u) => {
        if (u.email.toLowerCase() === identifier.toLowerCase())
            return true;
        if (u.identifier && u.identifier.toLowerCase() === identifier.toLowerCase())
            return true;
        return false;
    });
    if (!user) {
        (0, rateLimit_1.recordFailedLogin)(req);
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: 'ANONYMOUS',
            actorName: identifier,
            role: role || 'UNKNOWN',
            action: 'LOGIN_FAILED',
            entityType: 'AUTH',
            entityId: identifier,
            timestamp: new Date().toISOString()
        });
        return res.status(401).json({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials or unassigned role'
        });
    }
    if (!user.isActive) {
        (0, rateLimit_1.recordFailedLogin)(req);
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: user.id,
            actorName: user.fullName,
            role: user.role,
            action: 'LOGIN_FAILED_DEACTIVATED',
            entityType: 'AUTH',
            entityId: user.id,
            timestamp: new Date().toISOString()
        });
        return res.status(403).json({
            success: false,
            error: 'ACCOUNT_DISABLED',
            message: 'Institutional account has been suspended or deactivated'
        });
    }
    if (role && user.role !== role) {
        (0, rateLimit_1.recordFailedLogin)(req);
        return res.status(401).json({
            success: false,
            error: 'ROLE_MISMATCH',
            message: `User is not provisioned under the ${role} role`
        });
    }
    const isPasswordValid = bcryptjs_1.default.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
        (0, rateLimit_1.recordFailedLogin)(req);
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: user.id,
            actorName: user.fullName,
            role: user.role,
            action: 'LOGIN_FAILED_CREDENTIALS',
            entityType: 'AUTH',
            entityId: user.id,
            timestamp: new Date().toISOString()
        });
        return res.status(401).json({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials or unassigned role'
        });
    }
    // Clear rate-limiting records on verified login
    (0, rateLimit_1.clearFailedLogin)(req);
    // Generate tokens
    const tokenPayload = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        identifier: user.identifier || user.email,
        assignedLabs: user.assignedLabs || [],
        assignedClasses: user.assignedClasses || []
    };
    const accessToken = jsonwebtoken_1.default.sign(tokenPayload, env_1.ENV.JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
    const offlineToken = jsonwebtoken_1.default.sign(tokenPayload, env_1.ENV.OFFLINE_TOKEN_SECRET, { expiresIn: '30d' });
    // Record audit
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'USER_LOGIN',
        entityType: 'AUTH',
        entityId: user.id,
        timestamp: new Date().toISOString()
    });
    const response = {
        accessToken,
        refreshToken,
        offlineToken,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            phone: user.phone,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        },
        authorizedLabs: user.assignedLabs,
        authorizedClasses: user.assignedClasses
    };
    return res.json({ success: true, data: response });
};
exports.login = login;
const refreshToken = async (req, res) => {
    const { refreshToken: token } = req.body;
    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Refresh token is required'
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        const user = pool_1.db.findOne('users', (u) => u.id === decoded.id);
        if (!user || !user.isActive) {
            return res.status(403).json({
                success: false,
                error: 'ACCOUNT_DISABLED',
                message: 'Account is inactive or does not exist'
            });
        }
        const tokenPayload = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            identifier: user.identifier || user.email,
            assignedLabs: user.assignedLabs || [],
            assignedClasses: user.assignedClasses || []
        };
        const newAccessToken = jsonwebtoken_1.default.sign(tokenPayload, env_1.ENV.JWT_SECRET, { expiresIn: '8h' });
        const newRefreshToken = jsonwebtoken_1.default.sign({ id: user.id }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
        const newOfflineToken = jsonwebtoken_1.default.sign(tokenPayload, env_1.ENV.OFFLINE_TOKEN_SECRET, { expiresIn: '30d' });
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: user.id,
            actorName: user.fullName,
            role: user.role,
            action: 'TOKEN_REFRESH',
            entityType: 'AUTH',
            entityId: user.id,
            timestamp: new Date().toISOString()
        });
        return res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                offlineToken: newOfflineToken
            }
        });
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Refresh token has expired or is invalid'
        });
    }
};
exports.refreshToken = refreshToken;
const getProfile = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    const user = pool_1.db.findOne('users', (u) => u.id === req.user.id);
    if (!user)
        return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    return res.json({ success: true, data: user });
};
exports.getProfile = getProfile;
const createUser = async (req, res) => {
    const { email, password, fullName, role, identifier, department, course, yearOfStudy, semester, section } = req.body;
    if (!email || !password || !fullName || !role) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Missing required user fields' });
    }
    const existing = pool_1.db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_USER', message: 'User with this email already exists' });
    }
    const salt = bcryptjs_1.default.genSaltSync(10);
    const passwordHash = bcryptjs_1.default.hashSync(password, salt);
    const userId = (0, uuid_1.v4)();
    const newUser = {
        id: userId,
        email,
        passwordHash,
        fullName,
        role: role,
        identifier: identifier || email,
        department: department || 'General',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pool_1.db.insert('users', newUser);
    // If Student, create student profile
    if (role === 'STUDENT') {
        pool_1.db.insert('students', {
            id: (0, uuid_1.v4)(),
            userId,
            studentId: identifier || `STU-${Date.now().toString().slice(-4)}`,
            department: department || 'Computer Science',
            course: course || 'B.Tech',
            yearOfStudy: yearOfStudy || 1,
            semester: semester || 1,
            section: section || 'A',
            academicYear: '2026-2027',
            createdAt: new Date().toISOString()
        });
    }
    // Audit
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        role: req.user.role,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: userId,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json({
        success: true,
        data: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role,
            identifier: newUser.identifier,
            isActive: newUser.isActive
        }
    });
};
exports.createUser = createUser;
const listUsers = async (req, res) => {
    const roleFilter = req.query.role;
    let users = pool_1.db.getStore('users').map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        identifier: u.identifier,
        department: u.department,
        isActive: u.isActive,
        createdAt: u.createdAt
    }));
    if (roleFilter) {
        users = users.filter((u) => u.role === roleFilter);
    }
    return res.json({ success: true, data: users });
};
exports.listUsers = listUsers;
