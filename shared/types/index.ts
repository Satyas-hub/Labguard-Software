// ============================================================================
// LABGUARD V2: Universal Shared Domain Types
// ============================================================================

export type UserRole = 'ADMIN' | 'FACULTY' | 'LAB_ASSISTANT' | 'STUDENT';

export type PcState = 
  | 'AVAILABLE' 
  | 'IN_USE' 
  | 'MAINTENANCE' 
  | 'DISABLED' 
  | 'OFFLINE' 
  | 'UNREGISTERED';

export type ClientState = 
  | 'INITIALIZING'
  | 'CONNECTING'
  | 'READY'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'SESSION_ACTIVE'
  | 'OFFLINE'
  | 'MAINTENANCE'
  | 'ERROR'
  | 'UNREGISTERED';

export type SessionStatus = 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'FORCED_END' 
  | 'RECOVERED' 
  | 'ERROR';

export interface CrashRecoveryPayload {
  labCode?: string;
  pcCode?: string;
  computerId?: string;
  clientId?: string;
  sessionId?: string;
  studentId?: string;
  reason?: string;
}

export type SyncStatus = 
  | 'PENDING' 
  | 'SYNCING' 
  | 'SYNCED' 
  | 'FAILED' 
  | 'CONFLICT';

export type HardwareEventType =
  | 'PC_ONLINE'
  | 'PC_OFFLINE'
  | 'CLIENT_ONLINE'
  | 'CLIENT_OFFLINE'
  | 'HARDWARE_CONNECTED'
  | 'HARDWARE_DISCONNECTED'
  | 'HARDWARE_MISMATCH'
  | 'DEVICE_MISSING';

export type IssueType =
  | 'Keyboard Problem'
  | 'Mouse Problem'
  | 'Device Not Detected'
  | 'Cable Problem'
  | 'Physical Damage Reported'
  | 'Other';

export type IssueStatus =
  | 'OPEN'
  | 'VERIFIED'
  | 'INVESTIGATING'
  | 'MAINTENANCE'
  | 'RESOLVED'
  | 'REJECTED';

export type MaintenanceStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type EnrollmentPolicy = 'DIRECT' | 'APPROVAL_REQUIRED';

// ----------------------------------------------------------------------------
// Entities
// ----------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  identifier?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  studentId: string;
  department: string;
  course: string;
  yearOfStudy: number;
  semester: number;
  section: string;
  academicYear: string;
  dateOfBirth?: string;
  gender?: string;
  createdAt: string;
}

export interface FacultyProfile {
  id: string;
  userId: string;
  employeeId: string;
  department: string;
  designation: string;
  createdAt: string;
}

export interface LabAssistantProfile {
  id: string;
  userId: string;
  employeeId: string;
  department: string;
  shift: string;
  createdAt: string;
}

export interface LabMetrics {
  totalPcs: number;
  availablePcs: number;
  occupiedPcs: number;
  maintenancePcs: number;
  disabledPcs: number;
  offlinePcs: number;
}

export interface LabAssignedStaff {
  id: string;
  fullName: string;
  email: string;
  role: 'FACULTY' | 'LAB_ASSISTANT';
  department?: string;
}

export interface Lab {
  id: string;
  code: string; // e.g. LAB-01
  name: string;
  room: string;
  building?: string;
  description?: string;
  capacity: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  pcCount: number;
  metrics?: LabMetrics;
  assignedStaff?: LabAssignedStaff[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkstationHardwareInfo {
  cpuModel?: string;
  ramGb?: number;
  diskGb?: number;
  osVersion?: string;
}

export interface WorkstationPeripherals {
  keyboard?: boolean;
  mouse?: boolean;
  display?: boolean;
  keyboardConnected?: boolean;
  mouseConnected?: boolean;
  monitorConnected?: boolean;
  timestamp?: string;
}

export interface Computer {
  id: string;
  labId: string;
  labCode?: string;
  pcCode: string; // e.g. PC-017
  hostname?: string;
  ipAddress?: string;
  macAddress?: string;
  state: PcState;
  isOnline: boolean;
  clientId?: string;
  hardwareInfo?: WorkstationHardwareInfo;
  peripherals?: WorkstationPeripherals;
  activeSessionId?: string;
  activeStudentName?: string;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRegistration {
  clientId: string;
  pcCode: string;
  labCode: string;
  appVersion: string;
  hostname?: string;
  macAddress?: string;
  ipAddress?: string;
  hardwareInfo?: WorkstationHardwareInfo;
  isRegistered: boolean;
  lastHeartbeat?: string;
  isOnline: boolean;
}

export interface WorkstationBindingRequest {
  clientId: string;
  labCode: string;
  pcCode: string;
  hostname?: string;
  ipAddress?: string;
  macAddress?: string;
  appVersion?: string;
  hardwareInfo?: WorkstationHardwareInfo;
}

export interface HeartbeatPayload {
  clientId: string;
  labCode?: string;
  pcCode?: string;
  appVersion?: string;
  state?: PcState;
  hardwareStatus?: {
    keyboard_connected: boolean;
    mouse_connected: boolean;
    monitor_connected: boolean;
  };
}

export type EquipmentType = 'KEYBOARD' | 'MOUSE' | 'MONITOR' | 'UPS' | 'HEADSET' | 'GPU' | 'OTHER';
export type EquipmentStatus = 'AVAILABLE' | 'IN_USE' | 'FUNCTIONAL' | 'FAULTY' | 'MAINTENANCE' | 'REPLACED' | 'ACTIVE' | 'DECOMMISSIONED';

export interface EquipmentAssignmentRecord {
  id: string;
  equipmentId: string;
  previousLabId?: string;
  previousLabCode?: string;
  previousComputerId?: string;
  previousPcCode?: string;
  newLabId: string;
  newLabCode?: string;
  newComputerId?: string;
  newPcCode?: string;
  action: 'ASSIGN' | 'REASSIGN' | 'UNASSIGN' | 'REPLACE';
  reason?: string;
  performedByUserId: string;
  performedByUserName?: string;
  timestamp: string;
}

export interface Equipment {
  id: string;
  assetTag: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber: string;
  status: EquipmentStatus;
  labId: string;
  labCode?: string;
  computerId?: string;
  pcCode?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  specs?: Record<string, any>;
  lastAuditDate?: string;
  notes?: string;
  assignmentHistory?: EquipmentAssignmentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentReplaceRequest {
  replacementEquipmentId: string;
  reason?: string;
  defectNotes?: string;
}

export interface Session {
  id: string;
  studentId: string;
  studentIdentifier: string;
  studentName: string;
  labId: string;
  labCode: string;
  computerId: string;
  pcCode: string;
  clientId: string;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  startMode: 'NORMAL' | 'OFFLINE' | 'RECOVERED';
  endMode?: 'NORMAL' | 'TIMEOUT' | 'FORCED_END' | 'SHUTDOWN' | 'CRASH_RECOVERED';
  durationMinutes?: number;
  notes?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HardwareEvent {
  id: string;
  clientId: string;
  labId: string;
  labCode: string;
  computerId: string;
  pcCode: string;
  equipmentId?: string;
  sessionId?: string;
  eventType: HardwareEventType;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  syncStatus: SyncStatus;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Issue {
  id: string;
  reportedBy: string;
  reporterName?: string;
  reporterRole?: UserRole;
  labId: string;
  labCode: string;
  computerId: string;
  pcCode: string;
  equipmentId?: string;
  sessionId?: string;
  issueType: IssueType;
  description: string;
  evidenceUrl?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: IssueStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  issueId?: string;
  labId: string;
  labCode?: string;
  computerId: string;
  equipmentId?: string;
  responsibleUser: string;
  actionTaken: string;
  cost?: number;
  startTime: string;
  endTime?: string;
  status: MaintenanceStatus;
  notes?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode?: string;
  degreeLevel?: string;
  enrollmentPolicy?: EnrollmentPolicy;
  createdAt?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  departmentId?: string;
  departmentCode?: string;
  semester: number;
  credits?: number;
  createdAt?: string;
}

export interface AcademicYear {
  id: string;
  year: string; // e.g. 2025-2026
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

export interface SectionEntity {
  id: string;
  name: string; // e.g. A, B, C
  courseId?: string;
  semester?: number;
  createdAt?: string;
}

export type EnrollmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ClassEntity {
  id: string;
  name?: string;
  courseId: string;
  courseCode?: string;
  subjectId?: string;
  subjectCode?: string;
  subjectName?: string;
  academicYear: string;
  semester: number;
  section: string;
  defaultLabId?: string;
  defaultLabCode?: string;
  assignedFacultyId?: string;
  assignedFacultyName?: string;
  enrollmentPolicy?: EnrollmentPolicy;
  enrolledCount?: number;
  capacity?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
}

export interface ClassStudent {
  id: string;
  classId: string;
  studentId: string; // roll number or student profile id
  userId: string;
  enrolledAt: string;
  enrolledByUserId: string;
  status: 'ACTIVE' | 'DROPPED';
}

export interface EnrollmentRequest {
  id: string;
  studentId: string; // roll number or identifier
  studentUserId: string;
  studentName: string;
  classId: string;
  className: string;
  courseCode: string;
  section: string;
  policy: EnrollmentPolicy;
  requestedByUserId: string;
  requestedByUserName: string;
  status: EnrollmentRequestStatus;
  reviewedByUserId?: string;
  reviewedByUserName?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  targetUserId?: string;
  targetRole?: UserRole;
  title: string;
  message: string;
  severity: NotificationSeverity;
  eventType: string;
  labCode?: string;
  pcCode?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  role: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  clientId?: string;
  labId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Offline Sync Package
// ----------------------------------------------------------------------------

export interface SyncBatchPayload {
  clientId: string;
  batchId: string;
  timestamp: string;
  sessions?: Session[];
  hardwareEvents?: HardwareEvent[];
  issues?: Issue[];
  auditLogs?: AuditLog[];
  maintenance?: MaintenanceRecord[];
}

export interface SyncBatchResponse {
  batchId: string;
  serverTimestamp: string;
  acknowledgedIds: string[];
  conflicts: {
    entityId: string;
    entityType: string;
    reason: string;
    serverState: unknown;
  }[];
}

// ----------------------------------------------------------------------------
// API Auth Response
// ----------------------------------------------------------------------------

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  offlineToken?: string; // Encrypted cached token for local SQLite authentication
  authorizedLabs?: string[];
  authorizedClasses?: string[];
}

// ----------------------------------------------------------------------------
// Lab Assistant Operations & Dashboard
// ----------------------------------------------------------------------------

export interface AssistantDashboardMetrics {
  assignedLabsCount: number;
  totalWorkstations: number;
  availableWorkstations: number;
  occupiedWorkstations: number;
  maintenanceWorkstations: number;
  disabledWorkstations: number;
  offlineWorkstations: number;
  activeSessionsCount: number;
  openIssuesCount: number;
  activeMaintenanceCount: number;
  recentHardwareAlertsCount: number;
  assignedLabs: Lab[];
}

export interface CreateMaintenancePayload {
  labId: string;
  computerId: string;
  equipmentId?: string;
  issueId?: string;
  actionTaken: string;
  responsibleUser?: string;
  cost?: number;
  status?: MaintenanceStatus;
  notes?: string;
}

export interface UpdateMaintenancePayload {
  actionTaken?: string;
  responsibleUser?: string;
  cost?: number;
  status?: MaintenanceStatus;
  notes?: string;
  endTime?: string;
}

// ----------------------------------------------------------------------------
// Institutional Notifications & Routing System
// ----------------------------------------------------------------------------

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  eventType: string;
  labCode?: string;
  labId?: string;
  pcCode?: string;
  computerId?: string;
  targetRole?: UserRole;
  targetUserId?: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  emailAlerts: boolean;
  hardwareAlerts: boolean;
  maintenanceAlerts: boolean;
  issueAlerts: boolean;
  sessionAlerts: boolean;
  criticalOnly: boolean;
  updatedAt: string;
}

export interface SendNotificationPayload {
  title: string;
  message: string;
  severity?: NotificationSeverity;
  eventType?: string;
  labCode?: string;
  pcCode?: string;
  targetRole?: UserRole;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Application Updates & Version Control (Phase 29)
// ----------------------------------------------------------------------------

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  mandatory: boolean;
  downloadUrl: string;
  sha256Checksum: string;
  releaseNotes: string[];
  publishedAt: string;
  minSupportedVersion: string;
  fileSizeBytes: number;
}

export interface UpdateVerificationRequest {
  version: string;
  platform: string;
  checksum?: string;
}

export interface UpdateVerificationResult {
  verified: boolean;
  integrityHash: string;
  dataPreserved: boolean;
  preservedVaults: string[];
  message: string;
}
