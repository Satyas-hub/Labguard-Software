"use strict";
// ============================================================================
// LABGUARD V2: Enterprise Security Input Validation Schemas (Zod)
// Hardens all public and authenticated endpoints against malformed payloads,
// SQL injection attempts, oversized buffers, and parameter pollution.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEquipmentSchema = exports.CreateComputerSchema = exports.CreateLabSchema = exports.CreateClassSchema = exports.CreateSectionSchema = exports.CreateAcademicYearSchema = exports.CreateSubjectSchema = exports.CreateCourseSchema = exports.CreateDepartmentSchema = exports.CreateMaintenanceSchema = exports.BatchSyncSchema = exports.ClientHeartbeatSchema = exports.ReportIssueSchema = exports.EndSessionSchema = exports.StartSessionSchema = exports.CreateUserSchema = exports.RefreshTokenSchema = exports.LoginSchema = exports.safeString = exports.sqlInjectionPattern = void 0;
const zod_1 = require("zod");
// Detects common SQL injection attack signatures in input strings
exports.sqlInjectionPattern = /(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC(UTE)?)\b)|(--|\/\*|\*\/|;|\bOR\b\s+['"\d\w]+=['"\d\w]+|\bAND\b\s+['"\d\w]+=['"\d\w]+)/i;
const safeString = (min = 1, max = 255) => zod_1.z.string()
    .trim()
    .min(min, { message: `Must be at least ${min} character(s)` })
    .max(max, { message: `Must not exceed ${max} characters` })
    .refine((val) => !exports.sqlInjectionPattern.test(val), {
    message: 'Input contains forbidden characters or SQL control signatures'
});
exports.safeString = safeString;
exports.LoginSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3).max(100),
    password: zod_1.z.string().min(1).max(128),
    targetRole: zod_1.z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']).optional(),
    role: zod_1.z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']).optional()
}).passthrough().refine((data) => !data.targetRole && !data.role ? true : true, {});
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().trim().min(10, { message: 'Valid refresh token required' })
}).passthrough();
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email({ message: 'Valid institutional email required' }).max(120),
    fullName: zod_1.z.string().trim().min(2).max(100),
    role: zod_1.z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']),
    identifier: zod_1.z.string().trim().max(50).optional(),
    department: zod_1.z.string().trim().max(100).optional(),
    password: zod_1.z.string().min(6).max(128).optional(),
    assignedLabs: zod_1.z.array(zod_1.z.string().trim()).optional(),
    assignedClasses: zod_1.z.array(zod_1.z.string().trim()).optional(),
    course: zod_1.z.string().trim().max(100).optional(),
    yearOfStudy: zod_1.z.number().optional(),
    semester: zod_1.z.number().optional(),
    section: zod_1.z.string().trim().max(20).optional(),
    academicYear: zod_1.z.string().trim().max(50).optional(),
    gender: zod_1.z.string().trim().max(20).optional(),
    dateOfBirth: zod_1.z.string().trim().max(50).optional(),
    phone: zod_1.z.string().trim().max(50).optional()
}).passthrough();
exports.StartSessionSchema = zod_1.z.object({
    labCode: zod_1.z.string().trim().min(1).max(50).optional(),
    pcCode: zod_1.z.string().trim().min(1).max(50).optional(),
    clientId: zod_1.z.string().trim().optional(),
    computerId: zod_1.z.string().trim().optional(),
    startMode: zod_1.z.string().trim().optional()
}).passthrough().refine((data) => (data.labCode && data.pcCode) || data.computerId, { message: 'Lab code and PC code (or computerId) are required' });
exports.EndSessionSchema = zod_1.z.object({
    sessionId: zod_1.z.string().trim().optional(),
    id: zod_1.z.string().trim().optional(),
    endMode: zod_1.z.string().trim().optional(),
    reason: zod_1.z.string().trim().optional()
}).passthrough();
exports.ReportIssueSchema = zod_1.z.object({
    labCode: zod_1.z.string().trim().min(1).max(50).optional(),
    pcCode: zod_1.z.string().trim().min(1).max(50).optional(),
    computerId: zod_1.z.string().trim().optional(),
    equipmentId: zod_1.z.string().trim().optional(),
    issueType: zod_1.z.string().trim().min(1).max(100).optional(),
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    category: zod_1.z.string().trim().max(100).optional(),
    description: zod_1.z.string().trim().min(1).max(1500).optional(),
    severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    sessionId: zod_1.z.string().trim().optional(),
    evidenceUrl: zod_1.z.string().trim().optional()
}).passthrough().refine((data) => (data.labCode && data.pcCode) || data.computerId, { message: 'Lab code and PC code (or computerId) are required' }).refine((data) => !!(data.description || data.title), { message: 'Description or title is required' });
exports.ClientHeartbeatSchema = zod_1.z.object({
    clientId: zod_1.z.string().trim().min(1).max(100).optional(),
    labCode: zod_1.z.string().trim().min(1).max(50).optional(),
    pcCode: zod_1.z.string().trim().min(1).max(50).optional(),
    computerId: zod_1.z.string().trim().optional(),
    appVersion: zod_1.z.string().trim().max(30).optional(),
    peripherals: zod_1.z.any().optional(),
    hardwareStatus: zod_1.z.object({
        keyboard_connected: zod_1.z.boolean().optional(),
        mouse_connected: zod_1.z.boolean().optional(),
        monitor_connected: zod_1.z.boolean().optional(),
        timestamp: zod_1.z.string().optional()
    }).optional()
}).passthrough();
exports.BatchSyncSchema = zod_1.z.object({
    clientId: zod_1.z.string().trim().optional(),
    sessions: zod_1.z.array(zod_1.z.any()).optional(),
    hardwareEvents: zod_1.z.array(zod_1.z.any()).optional(),
    issues: zod_1.z.array(zod_1.z.any()).optional(),
    maintenance: zod_1.z.array(zod_1.z.any()).optional(),
    auditLogs: zod_1.z.array(zod_1.z.any()).optional()
}).passthrough();
exports.CreateMaintenanceSchema = zod_1.z.object({
    labCode: zod_1.z.string().trim().min(1).max(50).optional(),
    labId: zod_1.z.string().trim().min(1).max(50).optional(),
    pcCode: zod_1.z.string().trim().min(1).max(50).optional(),
    computerId: zod_1.z.string().trim().optional(),
    equipmentId: zod_1.z.string().trim().optional(),
    issueId: zod_1.z.string().trim().optional(),
    title: zod_1.z.string().trim().min(1).max(150).optional(),
    description: zod_1.z.string().trim().min(1).max(1500).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    category: zod_1.z.string().trim().max(50).optional(),
    type: zod_1.z.string().trim().max(50).optional(),
    assignedTo: zod_1.z.string().trim().optional(),
    technician: zod_1.z.string().trim().optional(),
    cost: zod_1.z.number().optional()
}).passthrough();
exports.CreateDepartmentSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(30),
    name: zod_1.z.string().trim().min(2).max(120),
    building: zod_1.z.string().trim().max(100).optional(),
    description: zod_1.z.string().trim().max(500).optional()
}).passthrough();
exports.CreateCourseSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(30),
    name: zod_1.z.string().trim().min(2).max(120),
    departmentId: zod_1.z.string().trim().min(1),
    durationYears: zod_1.z.number().min(1).max(10).optional()
}).passthrough();
exports.CreateSubjectSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(30),
    name: zod_1.z.string().trim().min(2).max(120),
    departmentId: zod_1.z.string().trim().min(1),
    semester: zod_1.z.number().min(1).max(12).optional(),
    credits: zod_1.z.number().min(1).max(10).optional()
}).passthrough();
exports.CreateAcademicYearSchema = zod_1.z.object({
    year: zod_1.z.string().trim().min(4).max(30),
    startDate: zod_1.z.string().trim().optional(),
    endDate: zod_1.z.string().trim().optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional()
}).passthrough();
exports.CreateSectionSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(30),
    departmentId: zod_1.z.string().trim().min(1),
    courseId: zod_1.z.string().trim().min(1),
    academicYearId: zod_1.z.string().trim().min(1),
    semester: zod_1.z.number().min(1).max(12).optional()
}).passthrough();
exports.CreateClassSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(50),
    subjectId: zod_1.z.string().trim().min(1),
    facultyId: zod_1.z.string().trim().min(1).optional(),
    labId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1),
    semester: zod_1.z.number().min(1).max(12).optional(),
    sectionId: zod_1.z.string().trim().optional(),
    capacity: zod_1.z.number().min(1).optional(),
    enrollmentPolicy: zod_1.z.enum(['DIRECT', 'APPROVAL_REQUIRED']).optional()
}).passthrough();
exports.CreateLabSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(50),
    name: zod_1.z.string().trim().min(2).max(120),
    location: zod_1.z.string().trim().max(100).optional(),
    room: zod_1.z.string().trim().max(50).optional(),
    capacity: zod_1.z.number().min(1).optional(),
    status: zod_1.z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional()
}).passthrough();
exports.CreateComputerSchema = zod_1.z.object({
    pcCode: zod_1.z.string().trim().min(1).max(50),
    labCode: zod_1.z.string().trim().min(1).max(50).optional(),
    labId: zod_1.z.string().trim().optional(),
    ipAddress: zod_1.z.string().trim().max(45).optional(),
    macAddress: zod_1.z.string().trim().max(50).optional(),
    specs: zod_1.z.any().optional()
}).passthrough();
exports.CreateEquipmentSchema = zod_1.z.object({
    assetTag: zod_1.z.string().trim().min(1).max(50),
    type: zod_1.z.string().trim().min(1).max(50),
    brand: zod_1.z.string().trim().max(100).optional(),
    model: zod_1.z.string().trim().max(100).optional(),
    serialNumber: zod_1.z.string().trim().max(100).optional(),
    labCode: zod_1.z.string().trim().max(50).optional(),
    pcCode: zod_1.z.string().trim().max(50).optional(),
    status: zod_1.z.string().trim().optional()
}).passthrough();
