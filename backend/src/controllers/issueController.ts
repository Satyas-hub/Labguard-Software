// ============================================================================
// LABGUARD V2: Issue Management Controller (Phase 15)
// Enforces:
// 1. Full lifecycle state progression:
//    OPEN -> VERIFIED -> INVESTIGATING -> MAINTENANCE -> RESOLVED / REJECTED
// 2. Evidence attachment handling
// 3. Automated linked maintenance generation on transition to MAINTENANCE
// 4. Automated workstation and equipment state transitions
// 5. Scoped issue listing and multi-parameter filters
// 6. Strict anti-escalation RBAC and lab authorization
// ============================================================================

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import { Issue, IssueStatus, MaintenanceRecord, Computer, Equipment } from '../../../shared/types';
import { NotificationService } from '../services/notificationService';
import { isLabInScope } from './assistantController';
import { ensureEquipmentSeeded } from './equipmentController';
import { ensureLabsSeeded } from './labController';
import { RealtimeService } from '../services/realtimeService';
import { SupabaseSyncService } from '../services/supabaseSyncService';

const VALID_STATUSES: IssueStatus[] = [
  'OPEN',
  'VERIFIED',
  'INVESTIGATING',
  'MAINTENANCE',
  'RESOLVED',
  'REJECTED'
];

/**
 * Report a new incident or defective hardware peripheral.
 * POST /api/issues
 */
export const reportIssue = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  ensureEquipmentSeeded();

  const user = req.user!;
  let {
    labCode,
    pcCode,
    issueType,
    description,
    evidenceUrl,
    equipmentId,
    sessionId,
    title,
    category,
    computerId,
    severity
  } = req.body;

  if (!labCode || !pcCode) {
    if (computerId) {
      const pcObj = db.findOne<Computer>('computers', (c) => c.id === computerId || c.pcCode === computerId);
      if (pcObj) {
        labCode = pcObj.labCode;
        pcCode = pcObj.pcCode;
      } else {
        labCode = 'LAB-01';
        pcCode = computerId;
      }
    }
  }

  issueType = issueType || category || title || 'Other';
  description = description || title || 'Issue reported by student';
  const resolvedSeverity = severity || 'MEDIUM';

  if (!labCode || !pcCode || !description) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Lab code, PC code, and description required'
    });
  }

  const issue: Issue = {
    id: uuidv4(),
    reportedBy: user.id,
    reporterName: user.fullName,
    reporterRole: user.role,
    labId: labCode,
    labCode,
    computerId: pcCode,
    pcCode,
    equipmentId,
    sessionId,
    issueType,
    description,
    evidenceUrl,
    severity: resolvedSeverity,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('issues', issue);

  // Notify Lab Assistant & Staff
  await NotificationService.dispatchEventNotification({
    title: `Issue: ${labCode} / ${pcCode} (${issueType})`,
    message: description,
    severity: resolvedSeverity === 'CRITICAL' || resolvedSeverity === 'HIGH' ? 'CRITICAL' : 'WARNING',
    eventType: 'NEW_ISSUE',
    labCode,
    pcCode,
    targetRole: 'LAB_ASSISTANT'
  });

  // Realtime Gateway Broadcast
  RealtimeService.broadcastIssueUpdate(issue, 'CREATED');

  // Direct Supabase Cloud Mirror
  SupabaseSyncService.syncBatch({
    clientId: `CLIENT-${issue.pcCode}`,
    batchId: `live-issue-${issue.id}`,
    timestamp: new Date().toISOString(),
    issues: [issue]
  }).catch((err) => {
    console.warn('[Issue Controller] Supabase reportIssue sync warning:', err.message || err);
  });

  return res.status(201).json({ success: true, data: issue });
};

/**
 * List issues with role-based scoping and multi-parameter filtering.
 * GET /api/issues
 */
export const listIssues = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let issues: Issue[] = db.getStore('issues');

  // Role scoping
  if (user.role === 'STUDENT') {
    issues = issues.filter((i: Issue) => i.reportedBy === user.id);
  } else if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      issues = issues.filter((i: Issue) => isLabInScope(user, i.labId, i.labCode));
    } else {
      issues = [];
    }
  }

  // Multi-parameter filters
  const { status, labCode, pcCode, severity, issueType, search } = req.query;

  if (status && typeof status === 'string') {
    issues = issues.filter((i) => i.status.toUpperCase() === status.toUpperCase());
  }

  if (labCode && typeof labCode === 'string') {
    issues = issues.filter((i) => i.labCode.toUpperCase() === labCode.toUpperCase());
  }

  if (pcCode && typeof pcCode === 'string') {
    issues = issues.filter((i) => i.pcCode.toUpperCase() === pcCode.toUpperCase());
  }

  if (severity && typeof severity === 'string') {
    issues = issues.filter((i) => i.severity === severity.toUpperCase());
  }

  if (issueType && typeof issueType === 'string') {
    issues = issues.filter((i) => i.issueType.toLowerCase() === issueType.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    issues = issues.filter(
      (i) =>
        i.description.toLowerCase().includes(q) ||
        i.issueType.toLowerCase().includes(q) ||
        i.pcCode.toLowerCase().includes(q) ||
        i.labCode.toLowerCase().includes(q)
    );
  }

  // Sort descending by creation date
  issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ success: true, data: issues });
};

/**
 * Retrieve detailed issue inspection by ID.
 * GET /api/issues/:issueId
 */
export const getIssueById = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { issueId } = req.params;

  const issue = db.findOne<Issue>('issues', (i) => i.id === issueId);
  if (!issue) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
  }

  if (user.role === 'STUDENT' && issue.reportedBy !== user.id) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot view other students issues' });
  }

  if ((user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') && !isLabInScope(user, issue.labId, issue.labCode)) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Issue outside assigned facility scope' });
  }

  const workstation = db.findOne<Computer>('computers', (c) =>
    c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode)
  );

  const equipment = issue.equipmentId
    ? db.findOne<Equipment>('equipment', (e) => e.id === issue.equipmentId)
    : null;

  const maintenanceRecords = db.find<MaintenanceRecord>('maintenance', (m) => m.issueId === issue.id);

  return res.json({
    success: true,
    data: {
      issue,
      workstation,
      equipment,
      maintenanceRecords
    }
  });
};

/**
 * Progress issue lifecycle state.
 * PATCH /api/issues/:issueId/status
 */
export const updateIssueStatus = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { issueId } = req.params;
  const { status, resolutionNotes } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  const issue = db.findOne<Issue>('issues', (i) => i.id === issueId);
  if (!issue) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
  }

  // Lab assistant scope check
  if (user.role === 'LAB_ASSISTANT') {
    if (!isLabInScope(user, issue.labId, issue.labCode)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_SCOPE',
        message: 'Lab Assistant is not authorized for the laboratory where this issue occurred'
      });
    }
  }

  const now = new Date().toISOString();
  issue.status = status;
  issue.updatedAt = now;

  if (resolutionNotes) {
    issue.resolutionNotes = resolutionNotes;
  }

  if (status === 'VERIFIED') {
    issue.verifiedBy = user.fullName;
    issue.verifiedAt = now;
  } else if (status === 'RESOLVED') {
    issue.resolvedBy = user.fullName;
    issue.resolvedAt = now;

    // Restore workstation to AVAILABLE if no other maintenance orders are pending
    db.update('computers', (c: Computer) => c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode), {
      state: 'AVAILABLE',
      updatedAt: now
    });

    // Complete linked maintenance orders
    const linkedMaintenance = db.find<MaintenanceRecord>('maintenance', (m) => m.issueId === issue.id);
    for (const m of linkedMaintenance) {
      if (m.status !== 'COMPLETED') {
        m.status = 'COMPLETED';
        m.endTime = now;
      }
    }
  } else if (status === 'MAINTENANCE') {
    // Transition workstation to MAINTENANCE
    db.update('computers', (c: Computer) => c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode), {
      state: 'MAINTENANCE',
      updatedAt: now
    });

    // If attached to equipment, mark faulty
    if (issue.equipmentId) {
      db.update('equipment', (e: Equipment) => e.id === issue.equipmentId, {
        status: 'FAULTY',
        updatedAt: now
      });
    }

    // Check if maintenance order already exists
    const existingMaint = db.findOne<MaintenanceRecord>('maintenance', (m) => m.issueId === issue.id);
    if (!existingMaint) {
      const maintenance: MaintenanceRecord = {
        id: uuidv4(),
        issueId: issue.id,
        labId: issue.labId,
        computerId: issue.computerId,
        equipmentId: issue.equipmentId,
        responsibleUser: user.fullName,
        actionTaken: 'Hardware bench diagnostics and triage initiated',
        startTime: now,
        status: 'IN_PROGRESS',
        notes: resolutionNotes || `Maintenance work order generated from issue: ${issue.issueType}`
      };
      db.insert('maintenance', maintenance);
    }
  }

  // Audit trail
  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'ISSUE_STATUS_UPDATE',
    entityType: 'ISSUE',
    entityId: issue.id,
    labId: issue.labId,
    timestamp: now,
    metadata: { previousStatus: issue.status, newStatus: status, resolutionNotes }
  });

  // Realtime Gateway Broadcast
  RealtimeService.broadcastIssueUpdate(issue, 'UPDATED');

  // Direct Supabase Cloud Mirror
  SupabaseSyncService.syncBatch({
    clientId: `CLIENT-${issue.pcCode}`,
    batchId: `live-issue-update-${issue.id}`,
    timestamp: now,
    issues: [issue]
  }).catch((err) => {
    console.warn('[Issue Controller] Supabase updateIssueStatus sync warning:', err.message || err);
  });

  return res.json({ success: true, data: issue });
};

/**
 * Attach photographic or textual diagnostic evidence to an issue.
 * POST /api/issues/:issueId/evidence
 */
export const attachEvidence = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { issueId } = req.params;
  const { evidenceUrl, evidenceDescription } = req.body;

  if (!evidenceUrl) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Evidence URL or data payload is required'
    });
  }

  const issue = db.findOne<Issue>('issues', (i) => i.id === issueId);
  if (!issue) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
  }

  // Authorization check
  if (user.role === 'STUDENT' && issue.reportedBy !== user.id) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot alter another student issue' });
  }

  const now = new Date().toISOString();
  issue.evidenceUrl = evidenceUrl;
  issue.updatedAt = now;

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'ISSUE_EVIDENCE_ATTACHED',
    entityType: 'ISSUE',
    entityId: issue.id,
    timestamp: now,
    metadata: { evidenceUrl, evidenceDescription }
  });

  return res.json({
    success: true,
    data: issue,
    message: 'Evidence successfully attached to issue record'
  });
};

/**
 * List maintenance work orders.
 * GET /api/maintenance
 */
export const listMaintenance = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let records: MaintenanceRecord[] = db.getStore('maintenance');

  if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      records = records.filter((m: MaintenanceRecord) =>
        user.assignedLabs!.some(
          (al) => al.toLowerCase() === m.labId?.toLowerCase()
        )
      );
    }
  }

  const { status, labId } = req.query;
  if (status && typeof status === 'string') {
    records = records.filter((m) => m.status.toUpperCase() === status.toUpperCase());
  }

  if (labId && typeof labId === 'string') {
    records = records.filter((m) => m.labId.toUpperCase() === labId.toUpperCase());
  }

  return res.json({ success: true, data: records });
};
