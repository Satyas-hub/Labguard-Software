// ============================================================================
// LABGUARD V2: Lab Assistant Operational Controller
// Enforces:
// 1. Strict operational scoping to assigned laboratories
// 2. Real-time fleet occupancy and telemetry aggregation
// 3. Hardware peripheral event stream and acknowledgment
// 4. End-to-end maintenance lifecycle management
// ============================================================================

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import {
  Lab,
  Computer,
  Session,
  Issue,
  MaintenanceRecord,
  HardwareEvent,
  AssistantDashboardMetrics,
  HardwareEventType,
  MaintenanceStatus,
  Equipment
} from '../../../shared/types';
import { ensureLabsSeeded, computeLabMetrics } from './labController';
import { RealtimeService } from '../services/realtimeService';

/**
 * Ensures clean initial hardware event store. Demo hardware event seeding is disabled.
 */
export const ensureHardwareEventsSeeded = () => {
  // Zero demo data policy. Only genuine hardware events captured from workstations exist.
};


/**
 * Helper to check if a laboratory is within the caller's assigned scope.
 */
export const isLabInScope = (user: any, labId?: string, labCode?: string): boolean => {
  if (user.role === 'ADMIN') return true;
  if (!user.assignedLabs || user.assignedLabs.length === 0) return false;
  return user.assignedLabs.some(
    (al: string) =>
      (labId && al.toLowerCase() === labId.toLowerCase()) ||
      (labCode && al.toLowerCase() === labCode.toLowerCase())
  );
};

/**
 * GET /api/assistant/dashboard
 * Aggregates operational KPIs for the authenticated lab assistant across assigned facilities.
 */
export const getAssistantDashboard = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  ensureHardwareEventsSeeded();

  const user = req.user!;
  const allLabs: Lab[] = db.getStore('labs');

  // Filter labs according to assistant assignment
  let assignedLabs: Lab[] = allLabs;
  if (user.role !== 'ADMIN') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      assignedLabs = allLabs.filter((l) => isLabInScope(user, l.id, l.code));
    } else {
      assignedLabs = [];
    }
  }

  const assignedLabIds = new Set(assignedLabs.map((l) => l.id.toLowerCase()));
  const assignedLabCodes = new Set(assignedLabs.map((l) => l.code.toLowerCase()));

  // Workstations in assigned labs
  const allPcs: Computer[] = db.getStore('computers');
  const assignedPcs = allPcs.filter(
    (pc) =>
      assignedLabIds.has(pc.labId.toLowerCase()) ||
      (pc.labCode && assignedLabCodes.has(pc.labCode.toLowerCase()))
  );

  let availableWorkstations = 0;
  let occupiedWorkstations = 0;
  let maintenanceWorkstations = 0;
  let disabledWorkstations = 0;
  let offlineWorkstations = 0;

  for (const pc of assignedPcs) {
    if (!pc.isOnline || pc.state === 'OFFLINE') {
      offlineWorkstations++;
    }
    if (pc.state === 'AVAILABLE') {
      availableWorkstations++;
    } else if (pc.state === 'IN_USE') {
      occupiedWorkstations++;
    } else if (pc.state === 'MAINTENANCE') {
      maintenanceWorkstations++;
    } else if (pc.state === 'DISABLED') {
      disabledWorkstations++;
    }
  }

  // Active student sessions in assigned labs
  const allSessions: Session[] = db.getStore('sessions');
  const activeSessions = allSessions.filter(
    (s) =>
      s.status === 'ACTIVE' &&
      (assignedLabIds.has(s.labId?.toLowerCase() || '') ||
        (s.labCode && assignedLabCodes.has(s.labCode.toLowerCase())))
  );

  // Issues in assigned labs
  const allIssues: Issue[] = db.getStore('issues');
  const openIssues = allIssues.filter(
    (i) =>
      i.status !== 'RESOLVED' &&
      (assignedLabIds.has(i.labId?.toLowerCase() || '') ||
        (i.labCode && assignedLabCodes.has(i.labCode.toLowerCase())))
  );

  // Maintenance records in assigned labs
  const allMaintenance: MaintenanceRecord[] = db.getStore('maintenance');
  const activeMaintenance = allMaintenance.filter(
    (m) =>
      m.status !== 'COMPLETED' &&
      (assignedLabIds.has(m.labId.toLowerCase()))
  );

  // Unacknowledged hardware events in assigned labs
  const allHardwareEvents: HardwareEvent[] = db.getStore('hardware_events');
  const recentHardwareAlerts = allHardwareEvents.filter(
    (e) =>
      !e.acknowledged &&
      (assignedLabIds.has(e.labId.toLowerCase()) ||
        (e.labCode && assignedLabCodes.has(e.labCode.toLowerCase())))
  );

  // Decorate assigned labs with live metrics
  const decoratedLabs = assignedLabs.map((lab) => ({
    ...lab,
    metrics: computeLabMetrics(lab.id, lab.code)
  }));

  const metrics: AssistantDashboardMetrics = {
    assignedLabsCount: assignedLabs.length,
    totalWorkstations: assignedPcs.length,
    availableWorkstations,
    occupiedWorkstations,
    maintenanceWorkstations,
    disabledWorkstations,
    offlineWorkstations,
    activeSessionsCount: activeSessions.length,
    openIssuesCount: openIssues.length,
    activeMaintenanceCount: activeMaintenance.length,
    recentHardwareAlertsCount: recentHardwareAlerts.length,
    assignedLabs: decoratedLabs
  };

  return res.json({
    success: true,
    data: metrics
  });
};

/**
 * GET /api/hardware-events
 * Lists hardware events scoped to the user's assigned laboratories.
 */
export const getHardwareEvents = async (req: AuthenticatedRequest, res: Response) => {
  ensureHardwareEventsSeeded();
  const user = req.user!;
  let events: HardwareEvent[] = db.getStore('hardware_events');

  // Scoping check for LAB_ASSISTANT and FACULTY
  if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      events = events.filter((e) => isLabInScope(user, e.labId, e.labCode));
    } else {
      events = [];
    }
  }

  // Filters
  const { labCode, pcCode, eventType, unacknowledgedOnly, acknowledged, search } = req.query;

  if (labCode && typeof labCode === 'string') {
    events = events.filter((e) => e.labCode.toUpperCase() === labCode.toUpperCase());
  }

  if (pcCode && typeof pcCode === 'string') {
    events = events.filter((e) => e.pcCode.toUpperCase() === pcCode.toUpperCase());
  }

  if (eventType && typeof eventType === 'string') {
    events = events.filter((e) => e.eventType === eventType);
  }

  if (acknowledged !== undefined) {
    const isAck = acknowledged === 'true' || acknowledged === '1';
    events = events.filter((e) => !!e.acknowledged === isAck);
  } else if (unacknowledgedOnly === 'true' || unacknowledgedOnly === '1') {
    events = events.filter((e) => !e.acknowledged);
  }

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    events = events.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.pcCode.toLowerCase().includes(q) ||
        e.labCode.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q)
    );
  }

  // Sort descending by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json({
    success: true,
    data: events
  });
};

/**
 * POST /api/hardware-events
 * Records a new hardware peripheral / connectivity event.
 */
export const createHardwareEvent = async (req: AuthenticatedRequest, res: Response) => {
  ensureHardwareEventsSeeded();
  const user = req.user!;
  const { labCode, pcCode, eventType, description, equipmentId, metadata } = req.body;

  if (!labCode || !pcCode || !eventType || !description) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'labCode, pcCode, eventType, and description are required'
    });
  }

  // Find workstation
  const pc = db.findOne<Computer>(
    'computers',
    (c) => c.pcCode.toUpperCase() === pcCode.toUpperCase() && c.labCode?.toUpperCase() === labCode.toUpperCase()
  );

  const labId = pc?.labId || uuidv4();

  // Scoping check for LAB_ASSISTANT
  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, labId, labCode)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: `User is not authorized for laboratory ${labCode}`
    });
  }

  const now = new Date().toISOString();
  const event: HardwareEvent = {
    id: uuidv4(),
    clientId: pc ? (pc as any).clientId || `CLIENT-${pc.pcCode}` : `CLIENT-${pcCode}`,
    labId,
    labCode,
    computerId: pc?.id || uuidv4(),
    pcCode,
    equipmentId,
    eventType: eventType as HardwareEventType,
    description,
    metadata,
    timestamp: now,
    syncStatus: 'SYNCED',
    acknowledged: false
  };

  db.insert('hardware_events', event);

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'HARDWARE_EVENT_LOGGED',
    entityType: 'HARDWARE',
    entityId: event.id,
    details: `${eventType}: ${description} (${labCode} - ${pcCode})`,
    timestamp: now
  });

  // Realtime Gateway Broadcast
  RealtimeService.broadcastHardwareAlert(event);

  return res.status(201).json({
    success: true,
    data: event
  });
};

/**
 * PATCH /api/hardware-events/:id/acknowledge
 * Acknowledges a hardware event.
 */
export const acknowledgeHardwareEvent = async (req: AuthenticatedRequest, res: Response) => {
  ensureHardwareEventsSeeded();
  const user = req.user!;
  const { id } = req.params;

  const event = db.findOne<HardwareEvent>('hardware_events', (e) => e.id === id);
  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Hardware event not found'
    });
  }

  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, event.labId, event.labCode)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: 'User is not authorized for the laboratory associated with this event'
    });
  }

  const now = new Date().toISOString();
  event.acknowledged = true;
  event.acknowledgedBy = user.fullName;
  event.acknowledgedAt = now;

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'HARDWARE_EVENT_ACKNOWLEDGED',
    entityType: 'HARDWARE',
    entityId: event.id,
    timestamp: now
  });

  return res.json({
    success: true,
    data: event
  });
};

/**
 * POST /api/maintenance
 * Creates a maintenance record for a workstation or peripheral.
 */
export const createMaintenanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const user = req.user!;
  const { computerId, equipmentId, issueId, actionTaken, responsibleUser, cost, status, notes } = req.body;
  const labId = req.body.labId || req.body.labCode;

  if (!labId || !computerId || !actionTaken) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'labId (or labCode), computerId, and actionTaken are required'
    });
  }

  // Find lab to check scope
  const lab = db.findOne<Lab>('labs', (l) => l.id === labId || l.code.toUpperCase() === labId.toUpperCase());
  const actualLabId = lab?.id || labId;
  const actualLabCode = lab?.code || labId;

  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, actualLabId, actualLabCode)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: 'User is not authorized for the requested laboratory'
    });
  }

  // Find computer
  const pc = db.findOne<Computer>('computers', (c) => c.id === computerId || c.pcCode.toUpperCase() === computerId.toUpperCase());
  const actualComputerId = pc?.id || computerId;

  const now = new Date().toISOString();
  const maintenanceStatus: MaintenanceStatus = status || 'IN_PROGRESS';

  const record: MaintenanceRecord = {
    id: uuidv4(),
    issueId,
    labId: actualLabId,
    computerId: actualComputerId,
    equipmentId,
    responsibleUser: responsibleUser || user.fullName,
    actionTaken,
    cost: typeof cost === 'number' ? cost : 0,
    startTime: now,
    status: maintenanceStatus,
    notes
  };

  db.insert('maintenance', record);

  // If workstation is attached and maintenance is active, set PC state to MAINTENANCE
  if (maintenanceStatus === 'IN_PROGRESS' || maintenanceStatus === 'SCHEDULED') {
    db.update('computers', (c: Computer) => c.id === actualComputerId || c.pcCode.toUpperCase() === computerId.toUpperCase(), {
      state: 'MAINTENANCE'
    });
  }

  // If issueId was provided, update issue status to MAINTENANCE
  if (issueId) {
    db.update('issues', (i: Issue) => i.id === issueId, {
      status: 'MAINTENANCE',
      updatedAt: now
    });
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'MAINTENANCE_CREATED',
    entityType: 'MAINTENANCE',
    entityId: record.id,
    timestamp: now
  });

  // Realtime Gateway Broadcast
  RealtimeService.broadcastMaintenanceUpdate(record);

  return res.status(201).json({
    success: true,
    data: record
  });
};

/**
 * PATCH /api/maintenance/:id
 * Updates or completes a maintenance work order.
 */
export const updateMaintenanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const user = req.user!;
  const { id } = req.params;
  const { actionTaken, responsibleUser, cost, status, notes } = req.body;

  const record = db.findOne<MaintenanceRecord>('maintenance', (m) => m.id === id);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Maintenance record not found'
    });
  }

  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, record.labId)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_SCOPE',
      message: 'User is not authorized for the laboratory associated with this maintenance record'
    });
  }

  const now = new Date().toISOString();
  if (actionTaken) record.actionTaken = actionTaken;
  if (responsibleUser) record.responsibleUser = responsibleUser;
  if (typeof cost === 'number') record.cost = cost;
  if (notes !== undefined) record.notes = notes;

  if (status) {
    record.status = status as MaintenanceStatus;
    if (status === 'COMPLETED') {
      record.endTime = now;

      // When maintenance completes, check if this PC has any other ongoing maintenance
      const otherActive = db.findOne<MaintenanceRecord>(
        'maintenance',
        (m) => m.id !== id && (m.computerId === record.computerId || m.computerId.toUpperCase() === record.computerId.toUpperCase()) && (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED')
      );
      if (!otherActive) {
        db.update('computers', (c: Computer) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase(), {
          state: 'AVAILABLE'
        });
      }

      // If tied to an issue, mark issue resolved
      if (record.issueId) {
        db.update('issues', (i: Issue) => i.id === record.issueId, {
          status: 'RESOLVED',
          updatedAt: now
        });
      }
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    actorUserId: user.id,
    actorName: user.fullName,
    role: user.role,
    action: 'MAINTENANCE_UPDATED',
    entityType: 'MAINTENANCE',
    entityId: record.id,
    timestamp: now
  });

  // Realtime Gateway Broadcast
  RealtimeService.broadcastMaintenanceUpdate(record);

  return res.json({
    success: true,
    data: record
  });
};

/**
 * GET /api/maintenance/stats
 * Aggregates maintenance metrics across assigned labs.
 */
export const getMaintenanceStats = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const user = req.user!;
  let records: MaintenanceRecord[] = db.getStore('maintenance');

  if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      records = records.filter((m) => isLabInScope(user, m.labId));
    }
  }

  const inProgress = records.filter((m) => m.status === 'IN_PROGRESS').length;
  const scheduled = records.filter((m) => m.status === 'SCHEDULED').length;
  const completed = records.filter((m) => m.status === 'COMPLETED').length;
  const cancelled = records.filter((m) => m.status === 'CANCELLED').length;
  const totalCost = records.reduce((acc, curr) => acc + (curr.cost || 0), 0);

  return res.json({
    success: true,
    data: {
      total: records.length,
      inProgress,
      scheduled,
      completed,
      cancelled,
      totalCost
    }
  });
};

/**
 * GET /api/maintenance/:id
 * Retrieves specific maintenance work order by ID.
 */
export const getMaintenanceById = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const user = req.user!;
  const { id } = req.params;

  const record = db.findOne<MaintenanceRecord>('maintenance', (m) => m.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Maintenance record not found' });
  }

  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, record.labId)) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Unauthorized for this laboratory' });
  }

  const workstation = db.findOne<Computer>('computers', (c) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase());
  const equipment = record.equipmentId ? db.findOne<Equipment>('equipment', (e) => e.id === record.equipmentId) : null;
  const linkedIssue = record.issueId ? db.findOne<Issue>('issues', (i) => i.id === record.issueId) : null;

  return res.json({
    success: true,
    data: {
      record,
      workstation,
      equipment,
      linkedIssue
    }
  });
};

/**
 * POST /api/maintenance/:id/cancel
 * Cancels a maintenance work order and restores PC if appropriate.
 */
export const cancelMaintenanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const user = req.user!;
  const { id } = req.params;
  const { reason } = req.body;

  const record = db.findOne<MaintenanceRecord>('maintenance', (m) => m.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Maintenance record not found' });
  }

  if (user.role === 'LAB_ASSISTANT' && !isLabInScope(user, record.labId)) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Unauthorized for this laboratory' });
  }

  const now = new Date().toISOString();
  record.status = 'CANCELLED';
  record.notes = reason ? `${record.notes || ''} [CANCELLED: ${reason}]` : record.notes;
  record.endTime = now;

  // Restore PC state to AVAILABLE if no other active maintenance
  const otherActive = db.findOne<MaintenanceRecord>(
    'maintenance',
    (m) => m.id !== id && (m.computerId === record.computerId || m.computerId.toUpperCase() === record.computerId.toUpperCase()) && (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED')
  );
  if (!otherActive) {
    db.update('computers', (c: Computer) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase(), {
      state: 'AVAILABLE'
    });
  }

  // Realtime Gateway Broadcast
  RealtimeService.broadcastMaintenanceUpdate(record);

  return res.json({
    success: true,
    data: record,
    message: 'Maintenance order cancelled'
  });
};
