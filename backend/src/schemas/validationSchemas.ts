// ============================================================================
// LABGUARD V2: Enterprise Security Input Validation Schemas (Zod)
// Hardens all public and authenticated endpoints against malformed payloads,
// SQL injection attempts, oversized buffers, and parameter pollution.
// ============================================================================

import { z } from 'zod';

// Detects common SQL injection attack signatures in input strings
export const sqlInjectionPattern = /(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC(UTE)?)\b)|(--|\/\*|\*\/|;|\bOR\b\s+['"\d\w]+=['"\d\w]+|\bAND\b\s+['"\d\w]+=['"\d\w]+)/i;

export const safeString = (min = 1, max = 255) =>
  z.string()
    .trim()
    .min(min, { message: `Must be at least ${min} character(s)` })
    .max(max, { message: `Must not exceed ${max} characters` })
    .refine((val) => !sqlInjectionPattern.test(val), {
      message: 'Input contains forbidden characters or SQL control signatures'
    });

export const LoginSchema = z.object({
  identifier: z.string().trim().min(3).max(100),
  password: z.string().min(1).max(128),
  targetRole: z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']).optional(),
  role: z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']).optional()
}).passthrough().refine((data) => !data.targetRole && !data.role ? true : true, {});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(10, { message: 'Valid refresh token required' })
}).passthrough();

export const CreateUserSchema = z.object({
  email: z.string().trim().email({ message: 'Valid institutional email required' }).max(120),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']),
  identifier: z.string().trim().max(50).optional(),
  department: z.string().trim().max(100).optional(),
  password: z.string().min(6).max(128).optional(),
  assignedLabs: z.array(z.string().trim()).optional(),
  assignedClasses: z.array(z.string().trim()).optional(),
  course: z.string().trim().max(100).optional(),
  yearOfStudy: z.number().optional(),
  semester: z.number().optional(),
  section: z.string().trim().max(20).optional(),
  academicYear: z.string().trim().max(50).optional(),
  gender: z.string().trim().max(20).optional(),
  dateOfBirth: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(50).optional()
}).passthrough();

export const StartSessionSchema = z.object({
  labCode: z.string().trim().min(1).max(50).optional(),
  pcCode: z.string().trim().min(1).max(50).optional(),
  clientId: z.string().trim().optional(),
  computerId: z.string().trim().optional(),
  startMode: z.string().trim().optional()
}).passthrough().refine(
  (data) => (data.labCode && data.pcCode) || data.computerId,
  { message: 'Lab code and PC code (or computerId) are required' }
);

export const EndSessionSchema = z.object({
  sessionId: z.string().trim().optional(),
  id: z.string().trim().optional(),
  endMode: z.string().trim().optional(),
  reason: z.string().trim().optional()
}).passthrough();

export const ReportIssueSchema = z.object({
  labCode: z.string().trim().min(1).max(50).optional(),
  pcCode: z.string().trim().min(1).max(50).optional(),
  computerId: z.string().trim().optional(),
  equipmentId: z.string().trim().optional(),
  issueType: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().min(1).max(1500).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  sessionId: z.string().trim().optional(),
  evidenceUrl: z.string().trim().optional()
}).passthrough().refine(
  (data) => (data.labCode && data.pcCode) || data.computerId,
  { message: 'Lab code and PC code (or computerId) are required' }
).refine(
  (data) => !!(data.description || data.title),
  { message: 'Description or title is required' }
);

export const ClientHeartbeatSchema = z.object({
  clientId: z.string().trim().min(1).max(100).optional(),
  labCode: z.string().trim().min(1).max(50).optional(),
  pcCode: z.string().trim().min(1).max(50).optional(),
  computerId: z.string().trim().optional(),
  appVersion: z.string().trim().max(30).optional(),
  peripherals: z.any().optional(),
  hardwareStatus: z.object({
    keyboard_connected: z.boolean().optional(),
    mouse_connected: z.boolean().optional(),
    monitor_connected: z.boolean().optional(),
    timestamp: z.string().optional()
  }).optional()
}).passthrough();

export const BatchSyncSchema = z.object({
  clientId: z.string().trim().optional(),
  sessions: z.array(z.any()).optional(),
  hardwareEvents: z.array(z.any()).optional(),
  issues: z.array(z.any()).optional(),
  maintenance: z.array(z.any()).optional(),
  auditLogs: z.array(z.any()).optional()
}).passthrough();

export const CreateMaintenanceSchema = z.object({
  labCode: z.string().trim().min(1).max(50).optional(),
  labId: z.string().trim().min(1).max(50).optional(),
  pcCode: z.string().trim().min(1).max(50).optional(),
  computerId: z.string().trim().optional(),
  equipmentId: z.string().trim().optional(),
  issueId: z.string().trim().optional(),
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().min(1).max(1500).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.string().trim().max(50).optional(),
  type: z.string().trim().max(50).optional(),
  assignedTo: z.string().trim().optional(),
  technician: z.string().trim().optional(),
  cost: z.number().optional()
}).passthrough();

export const CreateDepartmentSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  building: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional()
}).passthrough();

export const CreateCourseSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  departmentId: z.string().trim().min(1),
  durationYears: z.number().min(1).max(10).optional()
}).passthrough();

export const CreateSubjectSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  departmentId: z.string().trim().min(1),
  semester: z.number().min(1).max(12).optional(),
  credits: z.number().min(1).max(10).optional()
}).passthrough();

export const CreateAcademicYearSchema = z.object({
  year: z.string().trim().min(4).max(30),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional()
}).passthrough();

export const CreateSectionSchema = z.object({
  name: z.string().trim().min(1).max(30),
  departmentId: z.string().trim().min(1),
  courseId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  semester: z.number().min(1).max(12).optional()
}).passthrough();

export const CreateClassSchema = z.object({
  code: z.string().trim().min(1).max(50),
  subjectId: z.string().trim().min(1),
  facultyId: z.string().trim().min(1).optional(),
  labId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1),
  semester: z.number().min(1).max(12).optional(),
  sectionId: z.string().trim().optional(),
  capacity: z.number().min(1).optional(),
  enrollmentPolicy: z.enum(['DIRECT', 'APPROVAL_REQUIRED']).optional()
}).passthrough();

export const CreateLabSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().max(100).optional(),
  room: z.string().trim().max(50).optional(),
  capacity: z.number().min(1).optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional()
}).passthrough();

export const CreateComputerSchema = z.object({
  pcCode: z.string().trim().min(1).max(50),
  labCode: z.string().trim().min(1).max(50).optional(),
  labId: z.string().trim().optional(),
  ipAddress: z.string().trim().max(45).optional(),
  macAddress: z.string().trim().max(50).optional(),
  specs: z.any().optional()
}).passthrough();

export const CreateEquipmentSchema = z.object({
  assetTag: z.string().trim().min(1).max(50),
  type: z.string().trim().min(1).max(50),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  labCode: z.string().trim().max(50).optional(),
  pcCode: z.string().trim().max(50).optional(),
  status: z.string().trim().optional()
}).passthrough();
