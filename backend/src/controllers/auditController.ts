// ============================================================================
// LABGUARD V2: Tamper-Resistant Institutional Audit Controller
// ============================================================================

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import { User, Lab, Computer, Session, Issue, AuditLog, UserRole } from '../../../shared/types';

/**
 * GET /api/audit-logs
 * Retrieves institutional audit logs with multi-parameter filtering, searching, and pagination.
 */
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  const allLogs: AuditLog[] = db.getStore('audit_logs');
  const {
    actorUserId,
    role,
    action,
    entityType,
    entityId,
    labId,
    search,
    dateFrom,
    dateTo,
    order = 'desc',
    limit,
    offset
  } = req.query;

  let filtered = [...allLogs];

  if (actorUserId && typeof actorUserId === 'string') {
    filtered = filtered.filter((l) => l.actorUserId === actorUserId);
  }

  if (role && typeof role === 'string') {
    filtered = filtered.filter((l) => l.role.toUpperCase() === role.toUpperCase());
  }

  if (action && typeof action === 'string') {
    const actionClean = action.trim().toUpperCase();
    filtered = filtered.filter((l) => l.action.toUpperCase().includes(actionClean));
  }

  if (entityType && typeof entityType === 'string') {
    const entityTypeClean = entityType.trim().toUpperCase();
    filtered = filtered.filter((l) => l.entityType.toUpperCase() === entityTypeClean);
  }

  if (entityId && typeof entityId === 'string') {
    filtered = filtered.filter((l) => l.entityId === entityId);
  }

  if (labId && typeof labId === 'string') {
    filtered = filtered.filter((l) => l.labId === labId);
  }

  if (search && typeof search === 'string') {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.actorName.toLowerCase().includes(s) ||
        l.action.toLowerCase().includes(s) ||
        l.entityType.toLowerCase().includes(s) ||
        l.entityId.toLowerCase().includes(s)
    );
  }

  if (dateFrom && typeof dateFrom === 'string') {
    const fromTime = new Date(dateFrom).getTime();
    filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= fromTime);
  }

  if (dateTo && typeof dateTo === 'string') {
    const toTime = new Date(dateTo).getTime();
    filtered = filtered.filter((l) => new Date(l.timestamp).getTime() <= toTime);
  }

  // Sorting
  filtered.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return order === 'asc' ? tA - tB : tB - tA;
  });

  const total = filtered.length;
  const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), 200) : 50;
  const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

  const paged = filtered.slice(parsedOffset, parsedOffset + parsedLimit);

  // Compute telemetry summary
  const distinctActors = new Set(allLogs.map((l) => l.actorUserId)).size;
  const distinctActions = Array.from(new Set(allLogs.map((l) => l.action)));
  const distinctEntityTypes = Array.from(new Set(allLogs.map((l) => l.entityType)));

  return res.json({
    success: true,
    data: paged,
    total,
    limit: parsedLimit,
    offset: parsedOffset,
    summary: {
      distinctActorsCount: distinctActors,
      distinctActions,
      distinctEntityTypes
    }
  });
};

/**
 * GET /api/audit-logs/:id
 * Retrieves a single audit log entry by ID.
 */
export const getAuditLogById = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const log = db.findOne<AuditLog>('audit_logs', (l) => l.id === id);
  if (!log) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Audit log record not found'
    });
  }

  return res.json({
    success: true,
    data: log
  });
};

/**
 * GET /api/audit-logs/metadata
 * Returns metadata summary of audit trail.
 */
export const getAuditMetadata = async (_req: AuthenticatedRequest, res: Response) => {
  const allLogs: AuditLog[] = db.getStore('audit_logs');
  const distinctActions = Array.from(new Set(allLogs.map((l) => l.action)));
  const distinctEntityTypes = Array.from(new Set(allLogs.map((l) => l.entityType)));
  const distinctRoles = Array.from(new Set(allLogs.map((l) => l.role)));

  return res.json({
    success: true,
    data: {
      totalRecords: allLogs.length,
      distinctActions,
      distinctEntityTypes,
      distinctRoles
    }
  });
};

/**
 * GET /api/audit-logs/export
 * Exports filtered audit trail to CSV or JSON format.
 */
export const exportAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  const allLogs: AuditLog[] = db.getStore('audit_logs');
  const { format = 'csv', action, entityType, role, search } = req.query;

  let filtered = [...allLogs];
  if (action && typeof action === 'string') {
    filtered = filtered.filter((l) => l.action.toUpperCase().includes(action.toUpperCase()));
  }
  if (entityType && typeof entityType === 'string') {
    filtered = filtered.filter((l) => l.entityType.toUpperCase() === entityType.toUpperCase());
  }
  if (role && typeof role === 'string') {
    filtered = filtered.filter((l) => l.role.toUpperCase() === role.toUpperCase());
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    filtered = filtered.filter((l) => l.actorName.toLowerCase().includes(s) || l.action.toLowerCase().includes(s));
  }

  // Newest first
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="labguard_audit_export.json"');
    return res.send(JSON.stringify(filtered, null, 2));
  }

  // Default CSV format
  const headers = ['ID', 'Timestamp', 'Actor Name', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Lab ID'];
  const rows = filtered.map((l) => [
    l.id,
    l.timestamp,
    `"${l.actorName.replace(/"/g, '""')}"`,
    l.role,
    l.action,
    l.entityType,
    l.entityId,
    l.labId || ''
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="labguard_audit_export.csv"');
  return res.send(csvContent);
};

/**
 * Immutability Guard: Rejects any modification or deletion of audit logs.
 */
export const rejectAuditMutation = async (_req: AuthenticatedRequest, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'IMMUTABLE_AUDIT_LOG',
    message: 'Audit logs are immutable and tamper-resistant by institutional policy. Deletion and modification are strictly prohibited.'
  });
};

/**
 * Real-time Institutional Analytics.
 * Rule: NO FAKE DATA. Returns exact count or 0/empty state.
 */
export const getAdminAnalytics = async (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getStore('users');
  const labs = db.getStore('labs');
  const computers = db.getStore('computers');
  const equipment = db.getStore('equipment');
  const sessions = db.getStore('sessions');
  const issues = db.getStore('issues');
  const clients = db.getStore('clients');

  const totalStudents = users.filter((u: User) => u.role === 'STUDENT').length;
  const totalFaculty = users.filter((u: User) => u.role === 'FACULTY').length;
  const totalLabAssistants = users.filter((u: User) => u.role === 'LAB_ASSISTANT').length;
  const totalLabs = labs.length;
  const totalComputers = computers.length;
  const totalEquipment = equipment.length;
  const activeSessions = sessions.filter((s: Session) => s.status === 'ACTIVE').length;
  const openIssues = issues.filter((i: Issue) => i.status === 'OPEN').length;

  const onlineClients = clients.filter((c: any) => c.isOnline).length;
  const offlineClients = clients.filter((c: any) => !c.isOnline).length;

  return res.json({
    success: true,
    data: {
      metrics: {
        totalStudents,
        totalFaculty,
        totalLabAssistants,
        totalLabs,
        totalComputers,
        totalEquipment,
        activeSessions,
        openIssues,
        onlineClients,
        offlineClients
      },
      recentActivity: db.getStore('audit_logs').slice(-10).reverse()
    }
  });
};
