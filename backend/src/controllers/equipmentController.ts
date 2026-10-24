// ============================================================================
// LABGUARD V2: Equipment & Peripheral Accountability Controller
// Enforces:
// 1. Physical peripheral accountability hierarchy (LAB -> COMPUTER -> EQUIPMENT)
// 2. Asset tag uniqueness (DUPLICATE_ASSET_TAG)
// 3. Immutable peripheral assignment history audits
// 4. Atomic equipment replacement workflows (Swapping defective with spare)
// 5. Active session dependency protection on deletion
// ============================================================================

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import { ensureLabsSeeded } from './labController';
import {
  Equipment,
  EquipmentType,
  EquipmentStatus,
  EquipmentAssignmentRecord,
  Computer,
  Lab
} from '../../../shared/types';

import { getSupabase } from '../db/supabaseSyncHelper';

/**
 * Ensures clean initial equipment state. Demo equipment seeding is disabled.
 */
export const ensureEquipmentSeeded = () => {
  // Zero demo data policy. Only physical inventory registered by administrators exists.
};


/**
 * GET /api/equipment
 * List equipment with multi-dimensional filtering.
 */
export const getEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaEquip, error } = await sb.from('equipment').select('*').order('asset_id');
      if (!error && supaEquip) {
        const equipStore = db.getStore('equipment');
        equipStore.length = 0;
        for (const eq of supaEquip) {
          equipStore.push({
            id: eq.id,
            assetTag: eq.asset_id,
            type: eq.type,
            brand: eq.brand,
            model: eq.model || '',
            serialNumber: eq.serial_number || '',
            status: eq.status || 'FUNCTIONAL',
            qrCodeData: eq.qr_code_data || eq.asset_id,
            purchaseDate: eq.purchase_date,
            warrantyExpiry: eq.warranty_until,
            createdAt: eq.created_at || new Date().toISOString(),
            updatedAt: eq.updated_at || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[Equipment Supabase] Fetch error:', err.message);
    }
  }

  const { labCode, computerId, pcCode, type, status, search } = req.query as any;

  let items = db.getStore('equipment') as Equipment[];

  if (labCode && labCode !== 'ALL') {
    items = items.filter((e) => e.labCode?.toUpperCase() === labCode.toUpperCase());
  }

  if (computerId) {
    items = items.filter((e) => e.computerId === computerId);
  }

  if (pcCode) {
    items = items.filter((e) => e.pcCode?.toUpperCase() === pcCode.toUpperCase());
  }

  if (type && type !== 'ALL') {
    items = items.filter((e) => e.type === type);
  }

  if (status && status !== 'ALL') {
    items = items.filter((e) => e.status === status);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (e) =>
        e.assetTag.toLowerCase().includes(q) ||
        e.serialNumber.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        (e.pcCode && e.pcCode.toLowerCase().includes(q)) ||
        (e.labCode && e.labCode.toLowerCase().includes(q))
    );
  }

  return res.json({ success: true, data: items });
};

/**
 * GET /api/equipment/:id
 * Retrieve single peripheral details and audit history.
 */
export const getEquipmentById = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const { id } = req.params;

  const item = db.findOne('equipment', (e: Equipment) => e.id === id || e.assetTag.toUpperCase() === id.toUpperCase());
  if (!item) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Equipment not found' });
  }

  return res.json({ success: true, data: item });
};

/**
 * POST /api/equipment
 * Register new physical equipment with unique asset tag.
 */
export const createEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const user = req.user!;
  const {
    assetTag,
    type,
    brand,
    model,
    serialNumber,
    status,
    labCode,
    pcCode,
    workstationId,
    purchaseDate,
    warrantyExpiry,
    specs,
    notes
  } = req.body;

  if (!assetTag || !type || !brand || !model || !serialNumber || !labCode) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Asset Tag, Type, Brand, Model, Serial Number, and Lab Code are required'
    });
  }

  const cleanAssetTag = assetTag.trim().toUpperCase();

  // Enforce unique asset tag
  const existing = db.findOne('equipment', (e: Equipment) => e.assetTag.toUpperCase() === cleanAssetTag);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_ASSET_TAG',
      message: `Equipment with Asset Tag '${cleanAssetTag}' already exists`
    });
  }

  // Validate lab
  const lab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === labCode.trim().toUpperCase());
  if (!lab) {
    return res.status(404).json({
      success: false,
      error: 'LAB_NOT_FOUND',
      message: `Laboratory '${labCode}' not found`
    });
  }

  // Optional PC assignment
  let targetPc: Computer | undefined;
  const targetPcIdentifier = pcCode || workstationId;
  if (targetPcIdentifier && String(targetPcIdentifier).trim()) {
    targetPc = db.findOne(
      'computers',
      (c: Computer) =>
        (c.pcCode.toUpperCase() === String(targetPcIdentifier).trim().toUpperCase() || c.id === targetPcIdentifier) &&
        c.labCode?.toUpperCase() === lab.code.toUpperCase()
    );
    if (!targetPc) {
      targetPc = db.findOne(
        'computers',
        (c: Computer) =>
          c.pcCode.toUpperCase() === String(targetPcIdentifier).trim().toUpperCase() || c.id === targetPcIdentifier
      );
    }
  }

  const now = new Date().toISOString();
  const eqId = uuidv4();

  const historyRecord: EquipmentAssignmentRecord = {
    id: uuidv4(),
    equipmentId: eqId,
    newLabId: lab.id,
    newLabCode: lab.code,
    newComputerId: targetPc?.id,
    newPcCode: targetPc?.pcCode,
    action: 'ASSIGN',
    reason: 'Initial equipment registration',
    performedByUserId: user.id,
    performedByUserName: user.fullName,
    timestamp: now
  };

  const newEquipment: Equipment = {
    id: eqId,
    assetTag: cleanAssetTag,
    type,
    brand: brand.trim(),
    model: model.trim(),
    serialNumber: serialNumber.trim(),
    status: status || (targetPc ? 'FUNCTIONAL' : 'AVAILABLE'),
    labId: lab.id,
    labCode: lab.code,
    computerId: targetPc?.id,
    pcCode: targetPc?.pcCode,
    purchaseDate,
    warrantyExpiry,
    specs: specs || {},
    lastAuditDate: now,
    notes,
    assignmentHistory: [historyRecord],
    createdAt: now,
    updatedAt: now
  };

  db.insert('equipment', newEquipment);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('equipment').upsert({
        id: newEquipment.id,
        asset_id: newEquipment.assetTag,
        type: newEquipment.type,
        brand: newEquipment.brand,
        model: newEquipment.model,
        serial_number: newEquipment.serialNumber,
        status: newEquipment.status,
        qr_code_data: newEquipment.assetTag,
        purchase_date: newEquipment.purchaseDate || null,
        warranty_until: newEquipment.warrantyExpiry || null,
        created_at: newEquipment.createdAt,
        updated_at: newEquipment.updatedAt
      }, { onConflict: 'id' });
    } catch (err: any) {
      console.warn('[Equipment Supabase] Create error:', err.message);
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'EQUIPMENT_REGISTERED',
    userId: user.id,
    details: `Equipment registered: ${newEquipment.assetTag} (${newEquipment.brand} ${newEquipment.model}) in ${lab.code}`,
    timestamp: now
  });

  return res.status(201).json({ success: true, data: newEquipment });
};

/**
 * PUT /api/equipment/:id
 * Update peripheral specifications and properties.
 */
export const updateEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const user = req.user!;
  const { id } = req.params;
  const { brand, model, serialNumber, status, specs, purchaseDate, warrantyExpiry, notes } = req.body;

  const item = db.findOne('equipment', (e: Equipment) => e.id === id || e.assetTag.toUpperCase() === id.toUpperCase());
  if (!item) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Equipment not found' });
  }

  const now = new Date().toISOString();
  if (brand) item.brand = brand.trim();
  if (model) item.model = model.trim();
  if (serialNumber) item.serialNumber = serialNumber.trim();
  if (status) item.status = status;
  if (specs) item.specs = specs;
  if (purchaseDate) item.purchaseDate = purchaseDate;
  if (warrantyExpiry) item.warrantyExpiry = warrantyExpiry;
  if (notes !== undefined) item.notes = notes;
  item.updatedAt = now;

  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'EQUIPMENT_UPDATED',
    userId: user.id,
    details: `Equipment updated: ${item.assetTag} (${item.brand} ${item.model}) - Status: ${item.status}`,
    timestamp: now
  });

  return res.json({ success: true, data: item });
};

/**
 * PATCH /api/equipment/:id/assign
 * Assign to computer, reassign to another workstation, or unassign to pool.
 */
export const assignEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const user = req.user!;
  const { id } = req.params;
  const { labCode, pcCode, workstationId, unassign, reason, notes } = req.body;

  const item = db.findOne('equipment', (e: Equipment) => e.id === id || e.assetTag.toUpperCase() === id.toUpperCase());
  if (!item) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Equipment not found' });
  }

  const now = new Date().toISOString();
  const prevLabId = item.labId;
  const prevLabCode = item.labCode;
  const prevPcId = item.computerId;
  const prevPcCode = item.pcCode;

  if (unassign === true || workstationId === null || pcCode === null || (!pcCode && !workstationId && !labCode && !item.computerId)) {
    // Unassign to lab pool
    item.computerId = undefined;
    item.pcCode = undefined;
    if (item.status === 'FUNCTIONAL' || item.status === 'IN_USE') {
      item.status = 'AVAILABLE';
    }
    item.updatedAt = now;

    const historyRecord: EquipmentAssignmentRecord = {
      id: uuidv4(),
      equipmentId: item.id,
      previousLabId: prevLabId,
      previousLabCode: prevLabCode,
      previousComputerId: prevPcId,
      previousPcCode: prevPcCode,
      newLabId: item.labId,
      newLabCode: item.labCode,
      newComputerId: undefined,
      newPcCode: undefined,
      action: 'UNASSIGN',
      reason: reason || notes || 'Returned to laboratory spare pool',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      timestamp: now
    };

    if (!item.assignmentHistory) item.assignmentHistory = [];
    item.assignmentHistory.push(historyRecord);

    db.insert('audit_logs', {
      id: uuidv4(),
      action: 'EQUIPMENT_UNASSIGNED',
      userId: user.id,
      details: `Equipment ${item.assetTag} detached from workstation ${prevPcCode || 'N/A'} to ${item.labCode} pool`,
      timestamp: now
    });

    return res.json({ success: true, data: item, message: `Equipment ${item.assetTag} unassigned` });
  }

  // Resolve target facility and PC
  const targetLabCode = (labCode || item.labCode || 'LAB-01').toUpperCase();
  const lab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === targetLabCode);
  if (!lab) {
    return res.status(404).json({ success: false, error: 'LAB_NOT_FOUND', message: `Laboratory '${targetLabCode}' not found` });
  }

  let targetPc: Computer | undefined;
  const targetPcIdentifier = pcCode || workstationId;
  if (targetPcIdentifier) {
    targetPc = db.findOne(
      'computers',
      (c: Computer) =>
        (c.pcCode.toUpperCase() === String(targetPcIdentifier).toUpperCase() || c.id === targetPcIdentifier) &&
        c.labCode?.toUpperCase() === targetLabCode
    );
    if (!targetPc) {
      targetPc = db.findOne(
        'computers',
        (c: Computer) =>
          c.pcCode.toUpperCase() === String(targetPcIdentifier).toUpperCase() || c.id === targetPcIdentifier
      );
    }
    if (!targetPc) {
      return res.status(404).json({
        success: false,
        error: 'COMPUTER_NOT_FOUND',
        message: `Workstation '${targetPcIdentifier}' in '${targetLabCode}' not found`
      });
    }
  }

  item.labId = lab.id;
  item.labCode = lab.code;
  item.computerId = targetPc?.id;
  item.pcCode = targetPc?.pcCode;
  item.status = targetPc ? 'FUNCTIONAL' : 'AVAILABLE';
  item.updatedAt = now;

  const isReassign = Boolean(prevPcId && prevPcId !== targetPc?.id);
  const actionType = isReassign ? 'REASSIGN' : 'ASSIGN';

  const historyRecord: EquipmentAssignmentRecord = {
    id: uuidv4(),
    equipmentId: item.id,
    previousLabId: prevLabId,
    previousLabCode: prevLabCode,
    previousComputerId: prevPcId,
    previousPcCode: prevPcCode,
    newLabId: lab.id,
    newLabCode: lab.code,
    newComputerId: targetPc?.id,
    newPcCode: targetPc?.pcCode,
    action: actionType,
    reason: reason || (isReassign ? `Reassigned from ${prevPcCode} to ${targetPc?.pcCode}` : `Assigned to ${targetPc?.pcCode}`),
    performedByUserId: user.id,
    performedByUserName: user.fullName,
    timestamp: now
  };

  if (!item.assignmentHistory) item.assignmentHistory = [];
  item.assignmentHistory.push(historyRecord);

  db.insert('audit_logs', {
    id: uuidv4(),
    action: isReassign ? 'EQUIPMENT_REASSIGNED' : 'EQUIPMENT_ASSIGNED',
    userId: user.id,
    details: `Equipment ${item.assetTag} ${actionType.toLowerCase()}ed to workstation ${targetPc?.pcCode || 'pool'} in ${lab.code}`,
    timestamp: now
  });

  return res.json({
    success: true,
    data: item,
    message: `Equipment ${item.assetTag} successfully ${actionType.toLowerCase()}ed`
  });
};

/**
 * POST /api/equipment/:id/replace
 * Atomically replace a defective equipment item on a workstation with a spare from the pool.
 */
export const replaceEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const user = req.user!;
  const { id } = req.params;
  const replacementEquipmentId = req.body.replacementEquipmentId || req.body.spareEquipmentId;
  const { reason, defectNotes } = req.body;

  if (!replacementEquipmentId) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Replacement equipment ID (spare item) is required'
    });
  }

  const oldItem = db.findOne('equipment', (e: Equipment) => e.id === id || e.assetTag.toUpperCase() === id.toUpperCase());
  if (!oldItem) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Original equipment not found' });
  }

  const newItem = db.findOne(
    'equipment',
    (e: Equipment) => e.id === replacementEquipmentId || e.assetTag.toUpperCase() === replacementEquipmentId.toUpperCase()
  );
  if (!newItem) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Replacement equipment not found' });
  }

  // Verify compatibility & availability
  if (oldItem.type !== newItem.type) {
    return res.status(400).json({
      success: false,
      error: 'TYPE_MISMATCH',
      message: `Cannot replace ${oldItem.type} with ${newItem.type}`
    });
  }

  if (newItem.status === 'FAULTY' || newItem.status === 'MAINTENANCE' || newItem.status === 'DECOMMISSIONED') {
    return res.status(400).json({
      success: false,
      error: 'REPLACEMENT_NOT_AVAILABLE',
      message: `Replacement equipment ${newItem.assetTag} is in ${newItem.status} state`
    });
  }

  const now = new Date().toISOString();
  const targetLabId = oldItem.labId;
  const targetLabCode = oldItem.labCode;
  const targetComputerId = oldItem.computerId;
  const targetPcCode = oldItem.pcCode;

  // 1. Update Old Item (Detached and marked FAULTY / REPLACED)
  oldItem.computerId = undefined;
  oldItem.pcCode = undefined;
  oldItem.status = 'FAULTY';
  if (defectNotes) oldItem.notes = defectNotes;
  oldItem.updatedAt = now;

  const oldHistoryRecord: EquipmentAssignmentRecord = {
    id: uuidv4(),
    equipmentId: oldItem.id,
    previousLabId: targetLabId,
    previousLabCode: targetLabCode,
    previousComputerId: targetComputerId,
    previousPcCode: targetPcCode,
    newLabId: targetLabId,
    newLabCode: targetLabCode,
    newComputerId: undefined,
    newPcCode: undefined,
    action: 'REPLACE',
    reason: `Replaced by ${newItem.assetTag}. Note: ${reason || defectNotes || 'Defective hardware replacement'}`,
    performedByUserId: user.id,
    performedByUserName: user.fullName,
    timestamp: now
  };

  if (!oldItem.assignmentHistory) oldItem.assignmentHistory = [];
  oldItem.assignmentHistory.push(oldHistoryRecord);

  // 2. Update Replacement Item (Assigned to target workstation)
  newItem.labId = targetLabId;
  newItem.labCode = targetLabCode;
  newItem.computerId = targetComputerId;
  newItem.pcCode = targetPcCode;
  newItem.status = 'FUNCTIONAL';
  newItem.updatedAt = now;

  const newHistoryRecord: EquipmentAssignmentRecord = {
    id: uuidv4(),
    equipmentId: newItem.id,
    previousLabId: newItem.labId,
    previousLabCode: newItem.labCode,
    previousComputerId: undefined,
    previousPcCode: undefined,
    newLabId: targetLabId,
    newLabCode: targetLabCode,
    newComputerId: targetComputerId,
    newPcCode: targetPcCode,
    action: 'ASSIGN',
    reason: `Swapped to replace defective peripheral ${oldItem.assetTag} on ${targetPcCode || 'workstation'}`,
    performedByUserId: user.id,
    performedByUserName: user.fullName,
    timestamp: now
  };

  if (!newItem.assignmentHistory) newItem.assignmentHistory = [];
  newItem.assignmentHistory.push(newHistoryRecord);

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'EQUIPMENT_REPLACED',
    userId: user.id,
    details: `Equipment replacement: ${oldItem.assetTag} on ${targetPcCode || 'N/A'} replaced with ${newItem.assetTag}`,
    timestamp: now
  });

  return res.json({
    success: true,
    data: {
      decommissionedItem: oldItem,
      activatedItem: newItem,
      replacedItem: oldItem,
      spareItem: newItem
    },
    message: `Successfully swapped ${oldItem.assetTag} with ${newItem.assetTag}`
  });
};

/**
 * DELETE /api/equipment/:id
 * Decommission/remove peripheral with active session protection.
 */
export const deleteEquipment = async (req: AuthenticatedRequest, res: Response) => {
  ensureEquipmentSeeded();
  const user = req.user!;
  const { id } = req.params;

  const item = db.findOne('equipment', (e: Equipment) => e.id === id || e.assetTag.toUpperCase() === id.toUpperCase());
  if (!item) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Equipment not found' });
  }

  // Active session dependency check if assigned to a workstation
  if (item.computerId) {
    const activeSession = db.findOne('sessions', (s: any) => s.computerId === item.computerId && s.status === 'ACTIVE');
    if (activeSession) {
      return res.status(400).json({
        success: false,
        error: 'CANNOT_DELETE_ACTIVE_SESSION',
        message: `Cannot delete equipment '${item.assetTag}'. It is assigned to workstation '${item.pcCode}' which currently has an active student session in progress.`
      });
    }
  }

  // Remove equipment permanently from store
  db.delete('equipment', (e: Equipment) => e.id === item.id);
  db.recordDeletion(item.id, 'EQUIPMENT', { assetTag: item.assetTag });
  db.flush();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('equipment').delete().eq('id', item.id);
    } catch (e: any) {
      console.warn('[Equipment Supabase] Delete error:', e.message);
    }
  }

  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'EQUIPMENT_DELETED',
    userId: user.id,
    details: `Equipment ${item.assetTag} (${item.brand} ${item.model}) permanently deleted`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    message: `Equipment ${item.assetTag} successfully deleted`,
    deletedId: item.id
  });
};
