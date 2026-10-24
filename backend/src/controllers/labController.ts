// ============================================================================
// LABGUARD V2: Laboratory, Computer & Equipment Management Controller
// ============================================================================

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/pool';
import { Lab, Computer, Equipment, ClientRegistration, LabMetrics, LabAssignedStaff, PcState } from '../../../shared/types';
import { RealtimeService } from '../services/realtimeService';

import { exec } from 'child_process';

import { getSupabase, isInstitutionBootstrapped, syncCloudTombstones, recordCloudDeletion } from '../db/supabaseSyncHelper';

/**
 * Metadata helpers to persist capacity & building in Supabase labs table description field
 */
export function encodeCapacityInDescription(description: string | undefined, capacity: number, building?: string): string {
  const clean = (description || '')
    .replace(/\[CAPACITY:\d+\]\s*/g, '')
    .replace(/\[BUILDING:[^\]]+\]\s*/g, '')
    .trim();
  const tokens: string[] = [`[CAPACITY:${capacity}]`];
  if (building && building.trim()) {
    tokens.push(`[BUILDING:${building.trim()}]`);
  }
  return `${tokens.join(' ')} ${clean}`.trim();
}

export function parseCapacityAndDescription(description: string | undefined, fallbackCapacity: number = 40, fallbackBuilding: string = 'Main Campus'): { capacity: number; building: string; description: string } {
  if (!description) return { capacity: fallbackCapacity, building: fallbackBuilding, description: '' };
  const capMatch = description.match(/\[CAPACITY:(\d+)\]/);
  const capacity = capMatch ? parseInt(capMatch[1], 10) : fallbackCapacity;
  const bldMatch = description.match(/\[BUILDING:([^\]]+)\]/);
  const building = bldMatch && bldMatch[1].trim() ? bldMatch[1].trim() : fallbackBuilding;
  const cleanDescription = description
    .replace(/\[CAPACITY:\d+\]\s*/g, '')
    .replace(/\[BUILDING:[^\]]+\]\s*/g, '')
    .trim();
  return { capacity, building, description: cleanDescription };
}

/**
 * Synchronize computer records from Supabase into local memory store cleanly
 */
export function syncComputersFromSupabase(supaPcs: any[], labsStore: any[]) {
  const pcStore = db.getStore('computers');
  const supaPcIds = new Set(supaPcs.map(p => p.id));
  const supaPcCodes = new Set(supaPcs.map(p => (p.pc_code || '').toUpperCase()));

  // Purge any local computer that was deleted in Supabase or tombstoned
  if (Array.isArray(supaPcs)) {
    const purged = pcStore.filter(c => {
      if (db.isDeleted(c.id) || (c.pcCode && db.isDeleted(c.pcCode))) return false;
      if (!supaPcIds.has(c.id) && !supaPcCodes.has((c.pcCode || '').toUpperCase())) {
        db.recordDeletion(c.id, 'COMPUTER', { pcCode: c.pcCode, reason: 'DELETED_FROM_SUPABASE' });
        return false;
      }
      return true;
    });
    pcStore.length = 0;
    pcStore.push(...purged);
  }

  for (const p of supaPcs) {
    if (db.isDeleted(p.id) || (p.pc_code && db.isDeleted(p.pc_code))) continue;
    const labObj = labsStore.find((l: any) => l.id === p.lab_id || l.code?.toUpperCase() === p.lab_code?.toUpperCase());
    const existing = pcStore.find(ep => ep.id === p.id || (ep.pcCode.toUpperCase() === p.pc_code?.toUpperCase() && ep.labCode?.toUpperCase() === labObj?.code?.toUpperCase()));
    if (!existing) {
      const pcData: Computer = {
        id: p.id,
        labId: p.lab_id,
        labCode: labObj ? labObj.code : (p.lab_code || 'UNASSIGNED'),
        pcCode: p.pc_code,
        hostname: p.hostname || `${labObj?.code || 'WORKSTATION'}-${p.pc_code}`,
        ipAddress: p.ip_address || undefined,
        macAddress: p.mac_address || undefined,
        clientId: p.bound_client_id || undefined,
        state: (p.status || 'AVAILABLE') as PcState,
        isOnline: p.is_online !== false,
        lastHeartbeat: p.last_heartbeat,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString()
      };
      pcStore.push(pcData);
    }
  }
}

/**
 * Auto-provisions workstation nodes for a laboratory up to targetCapacity
 */
export const autoProvisionLabWorkstations = async (lab: Lab, targetCapacity: number) => {
  if (!targetCapacity || targetCapacity <= 0) return;
  const sb = getSupabase();
  const existingPcs = db.find('computers', (c: Computer) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
  const existingPcCodes = new Set(existingPcs.map(p => p.pcCode.toUpperCase()));
  const newPcs: Computer[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i <= targetCapacity; i++) {
    const pcCode = `PC-${i < 10 ? '0' : ''}${i}`;
    if (!existingPcCodes.has(pcCode)) {
      const pc: Computer = {
        id: uuidv4(),
        labId: lab.id,
        labCode: lab.code,
        pcCode,
        hostname: `${lab.code}-${pcCode}`,
        state: 'AVAILABLE',
        isOnline: false,
        hardwareInfo: {
          cpuModel: 'Intel Core i7-13700 / AMD Ryzen 7',
          ramGb: 16,
          diskGb: 512,
          osVersion: 'Microsoft Windows 11 Pro 64-bit'
        },
        peripherals: {
          keyboardConnected: true,
          mouseConnected: true,
          monitorConnected: true,
          timestamp: now
        },
        createdAt: now,
        updatedAt: now
      };
      db.insert('computers', pc);
      newPcs.push(pc);
      existingPcCodes.add(pcCode);
    }
  }

  const allLabPcs = db.find('computers', (c: Computer) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
  lab.pcCount = allLabPcs.length;

  if (sb && newPcs.length > 0) {
    try {
      for (let i = 0; i < newPcs.length; i += 20) {
        const batch = newPcs.slice(i, i + 20).map(p => ({
          id: p.id,
          lab_id: lab.id,
          pc_code: p.pcCode,
          hostname: p.hostname,
          status: 'AVAILABLE',
          is_online: false,
          created_at: p.createdAt,
          updated_at: p.updatedAt
        }));
        await sb.from('computers').upsert(batch, { onConflict: 'id' });
      }
      await sb.from('labs').update({ pc_count: lab.pcCount }).eq('id', lab.id);
    } catch (err: any) {
      console.warn('[Lab Workstations Supabase] Error auto-provisioning workstations:', err.message);
    }
  }
};

/**
 * Ensures baseline institutional laboratories are initialized.
 */
let hasEnsuredLabs = false;
export const ensureLabsSeeded = async () => {
  if (hasEnsuredLabs) return;
  hasEnsuredLabs = true;

  const sb = getSupabase();
  await syncCloudTombstones();

  if (sb) {
    try {
      const { data: supaLabs } = await sb.from('labs').select('*').order('code');
      if (supaLabs) {
        const store = db.getStore('labs');
        const supaLabIds = new Set(supaLabs.map(l => l.id));
        const supaLabCodes = new Set(supaLabs.map(l => (l.code || '').toUpperCase()));

        // Bidirectional deletion sync:
        // If an administrator deleted a lab in Supabase directly, purge it from local store!
        if (Array.isArray(supaLabs)) {
          const purged = store.filter(l => {
            if (db.isDeleted(l.id) || (l.code && db.isDeleted(l.code))) return false;
            if (!supaLabIds.has(l.id) && !supaLabCodes.has((l.code || '').toUpperCase())) {
              db.recordDeletion(l.id, 'LAB', { code: l.code, reason: 'DELETED_FROM_SUPABASE' });
              return false;
            }
            return true;
          });
          store.length = 0;
          store.push(...purged);
        }

        for (const l of supaLabs) {
          if (db.isDeleted(l.id) || (l.code && db.isDeleted(l.code))) continue;
          const { capacity, building, description } = parseCapacityAndDescription(l.description, (l as any).capacity || 40, (l as any).building || 'Main Campus');
          const existing = store.find((el: any) => el.id === l.id || el.code.toUpperCase() === l.code.toUpperCase());
          if (!existing) {
            store.push({
              id: l.id,
              code: l.code,
              name: l.name,
              room: l.room,
              building: building || (l as any).building || 'Main Campus',
              description,
              capacity,
              status: l.status || 'ACTIVE',
              pcCount: l.pc_count || 0,
              createdAt: l.created_at || new Date().toISOString(),
              updatedAt: l.updated_at || new Date().toISOString()
            });
          }
        }

        const { data: supaPcs } = await sb.from('computers').select('*').order('pc_code');
        if (supaPcs) {
          syncComputersFromSupabase(supaPcs, store);
        }
      }
    } catch (err: any) {
      console.warn('[Lab Supabase] Initial cloud sync note:', err.message);
    }
  }
};

// ============================================================================
// High-Speed Windows Peripheral Telemetry Cache
// Maintains real-time hardware status in memory; responds in <1ms without blocking
// ============================================================================
let cachedPeripherals = {
  keyboard_connected: true,
  mouse_connected: true,
  monitor_connected: true,
  keyboard_name: 'Standard USB Keyboard',
  mouse_name: 'Optical Pointing Device',
  monitor_name: 'Primary Workstation Display',
  timestamp: new Date().toISOString()
};
let isScanningPeripherals = false;
let lastPeripheralScanTicks = 0;

function refreshPeripheralsCache() {
  if (process.platform !== 'win32' || isScanningPeripherals) return;
  const now = Date.now();
  if (now - lastPeripheralScanTicks < 1500) return;
  isScanningPeripherals = true;

  const psCmd = `@(Get-PnpDevice -PresentOnly -Class Keyboard, Mouse, Monitor -ErrorAction SilentlyContinue | Select-Object Class, FriendlyName, Status) | ConvertTo-Json -Compress`;
  exec(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 3500 }, (err, stdout) => {
    isScanningPeripherals = false;
    lastPeripheralScanTicks = Date.now();
    if (!err && stdout && stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout.trim());
        const devices = Array.isArray(parsed) ? parsed : [parsed];
        let kbOk = false, msOk = false, monOk = false;
        let kbName = 'Not Detected', msName = 'Not Detected', monName = 'Not Detected';

        for (const dev of devices) {
          const cls = String(dev.Class || '').toLowerCase();
          const name = String(dev.FriendlyName || '').trim();
          const isOk = String(dev.Status || '').toUpperCase() === 'OK';

          if (cls === 'keyboard' && isOk) {
            kbOk = true;
            if (kbName === 'Not Detected' || kbName.toLowerCase().includes('standard ps/2')) {
              kbName = name || 'Standard USB Keyboard';
            }
          } else if (cls === 'mouse' && isOk) {
            msOk = true;
            if (msName === 'Not Detected' || msName.toLowerCase().includes('hid-compliant')) {
              msName = name || 'Optical Pointing Device';
            }
          } else if (cls === 'monitor' && isOk) {
            monOk = true;
            if (monName === 'Not Detected' || monName.toLowerCase().includes('generic')) {
              monName = name || 'Primary Workstation Display';
            }
          }
        }

        if (!monOk) {
          monOk = true;
          monName = 'Primary Workstation Display';
        }

        cachedPeripherals = {
          keyboard_connected: kbOk,
          mouse_connected: msOk,
          monitor_connected: monOk,
          keyboard_name: kbName,
          mouse_name: msName,
          monitor_name: monName,
          timestamp: new Date().toISOString()
        };
      } catch {}
    }
  });
}

// Kick off initial background scan
if (process.platform === 'win32') {
  refreshPeripheralsCache();
  setInterval(refreshPeripheralsCache, 2000);
}

/**
 * GET /api/system/peripherals
 * High-speed live detection of hardware peripherals; instantaneous (<1ms) response
 */
export const getSystemPeripherals = async (_req: any, res: Response) => {
  refreshPeripheralsCache();
  return res.json({
    success: true,
    data: {
      ...cachedPeripherals,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Computes live workstation metric rollups for a specific laboratory.
 */
export const computeLabMetrics = (labId: string, labCode: string): LabMetrics => {
  const allPcs = db.getStore('computers');
  const pcs = allPcs.filter((c: Computer) => c.labId === labId || (labCode && c.labCode?.toUpperCase() === labCode.toUpperCase()));

  const totalPcs = pcs.length;
  let availablePcs = 0;
  let occupiedPcs = 0;
  let maintenancePcs = 0;
  let disabledPcs = 0;
  let offlinePcs = 0;

  for (const pc of pcs) {
    if (!pc.isOnline || pc.state === 'OFFLINE') {
      offlinePcs++;
    }
    if (pc.state === 'AVAILABLE') {
      availablePcs++;
    } else if (pc.state === 'IN_USE') {
      occupiedPcs++;
    } else if (pc.state === 'MAINTENANCE') {
      maintenancePcs++;
    } else if (pc.state === 'DISABLED') {
      disabledPcs++;
    }
  }

  return {
    totalPcs,
    availablePcs,
    occupiedPcs,
    maintenancePcs,
    disabledPcs,
    offlinePcs
  };
};

/**
 * Retrieves the assigned faculty and lab assistants for a laboratory.
 */
export const getLabAssignedStaffList = (labId: string, labCode: string): LabAssignedStaff[] => {
  const users = db.getStore('users');
  const staff = users.filter((u: any) => {
    if (u.role !== 'FACULTY' && u.role !== 'LAB_ASSISTANT') return false;
    if (!u.assignedLabs || !Array.isArray(u.assignedLabs)) return false;
    return u.assignedLabs.includes(labId) || (labCode && u.assignedLabs.some((code: string) => code.toUpperCase() === labCode.toUpperCase()));
  });

  return staff.map((u: any) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    department: u.department
  }));
};

/**
 * GET /api/clients/available-labs
 * Public / setup endpoint for workstations to retrieve all active laboratories created in the admin panel.
 */
export const getAvailableLabsForRegistration = async (_req: any, res: Response) => {
  await ensureLabsSeeded();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaLabs } = await sb.from('labs').select('*').order('code');
      if (supaLabs) {
        const store = db.getStore('labs');
        store.length = 0;
        for (const sl of supaLabs) {
          if (db.isDeleted(sl.id) || (sl.code && db.isDeleted(sl.code))) continue;
          const { capacity, building, description } = parseCapacityAndDescription(sl.description, (sl as any).capacity || 40, (sl as any).building || 'Main Campus');
          store.push({
            id: sl.id,
            code: sl.code,
            name: sl.name,
            building: building || (sl as any).building || 'Main Campus',
            room: sl.room,
            description,
            capacity,
            status: sl.status || 'ACTIVE',
            pcCount: sl.pc_count || 0,
            createdAt: sl.created_at || new Date().toISOString(),
            updatedAt: sl.updated_at || new Date().toISOString()
          } as any);
        }
      }
    } catch (e: any) {
      console.warn('[Available Labs Supabase] Fetch error:', e.message);
    }
  }

  const labs: Lab[] = db.getStore('labs');
  const activeLabs = labs
    .filter((l) => l.status === 'ACTIVE' || !l.status)
    .map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      building: l.building,
      room: l.room,
      capacity: l.capacity,
      pcCount: l.pcCount || 0
    }));
  return res.json({ success: true, data: activeLabs });
};

/**
 * GET /api/labs
 * Retrieve all laboratories with search, status filtering, live metrics, and assigned staff.
 */
export const getLabs = async (req: AuthenticatedRequest, res: Response) => {
  await ensureLabsSeeded();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaLabs, error } = await sb.from('labs').select('*').order('code');
      if (!error && supaLabs) {
        const store = db.getStore('labs');
        store.length = 0;
        for (const l of supaLabs) {
          if (db.isDeleted(l.id) || (l.code && db.isDeleted(l.code))) continue;
          const { capacity, building, description } = parseCapacityAndDescription(l.description, (l as any).capacity || 40, (l as any).building || 'Main Campus');
          store.push({
            id: l.id,
            code: l.code,
            name: l.name,
            room: l.room,
            building: building || (l as any).building || 'Main Campus',
            description,
            capacity,
            status: l.status || 'ACTIVE',
            pcCount: l.pc_count || 0,
            createdAt: l.created_at || new Date().toISOString(),
            updatedAt: l.updated_at || new Date().toISOString()
          });
        }

        const { data: supaPcs } = await sb.from('computers').select('*').order('pc_code');
        if (supaPcs) {
          syncComputersFromSupabase(supaPcs, store);
        }
        // Workstations are only created when explicitly registered or added by Admin
      }
    } catch (err: any) {
      console.warn('[Labs Supabase] Fetch error:', err.message);
    }
  }

  const user = req.user!;
  let labs: Lab[] = db.getStore('labs');

  // Scoping: Faculty and Lab Assistant only see assigned labs
  if (user.role === 'FACULTY' || user.role === 'LAB_ASSISTANT') {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      labs = labs.filter((l: Lab) =>
        user.assignedLabs!.includes(l.id) || user.assignedLabs!.some((code: string) => code.toUpperCase() === l.code.toUpperCase())
      );
    } else {
      labs = [];
    }
  }

  // Filter by search query
  const search = (req.query.search as string || '').trim().toLowerCase();
  if (search) {
    labs = labs.filter((l: Lab) =>
      l.code.toLowerCase().includes(search) ||
      l.name.toLowerCase().includes(search) ||
      l.room.toLowerCase().includes(search) ||
      (l.building && l.building.toLowerCase().includes(search))
    );
  }

  // Filter by status
  const status = (req.query.status as string || '').trim().toUpperCase();
  if (status && status !== 'ALL') {
    labs = labs.filter((l: Lab) => l.status === status);
  }

  // Enrich with live metrics and assigned staff
  const enrichedLabs = labs.map((lab: Lab) => {
    const metrics = computeLabMetrics(lab.id, lab.code);
    const assignedStaff = getLabAssignedStaffList(lab.id, lab.code);
    return {
      ...lab,
      pcCount: metrics.totalPcs,
      metrics,
      assignedStaff
    };
  });

  return res.json({ success: true, data: enrichedLabs });
};

/**
 * GET /api/labs/:id
 * Retrieve detailed laboratory record with fleet workstation list and assigned staff.
 */
export const getLabById = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const lab = db.findOne('labs', (l: Lab) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  const metrics = computeLabMetrics(lab.id, lab.code);
  const assignedStaff = getLabAssignedStaffList(lab.id, lab.code);
  const computers = db.find('computers', (c: Computer) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
  const equipment = db.find('equipment', (e: Equipment) => e.labId === lab.id || e.labId === lab.code);

  return res.json({
    success: true,
    data: {
      ...lab,
      pcCount: metrics.totalPcs,
      metrics,
      assignedStaff,
      computers,
      equipment
    }
  });
};

/**
 * POST /api/labs
 * Create a new laboratory facility with unique code validation and optional staff assignment.
 */
export const createLab = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { code, name, room, building, capacity, description, status, staffIds } = req.body;
  if (!code || !name || !room) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab Code, Name and Room required' });
  }

  const cleanCode = code.trim().toUpperCase();
  const existing = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === cleanCode);
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_LAB', message: `Lab code '${cleanCode}' already exists` });
  }

  const labId = uuidv4();
  const labCapacity = Number(capacity) || 30;
  const lab: Lab = {
    id: labId,
    code: cleanCode,
    name: name.trim(),
    room: room.trim(),
    building: (building || 'Main Campus').trim(),
    description: description ? description.trim() : undefined,
    capacity: labCapacity,
    status: status === 'MAINTENANCE' || status === 'INACTIVE' ? status : 'ACTIVE',
    pcCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('labs', lab);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('labs').upsert({
        id: lab.id,
        code: lab.code,
        name: lab.name,
        room: lab.room,
        description: encodeCapacityInDescription(lab.description, labCapacity, lab.building),
        status: lab.status,
        pc_count: lab.pcCount,
        created_at: lab.createdAt,
        updated_at: lab.updatedAt
      }, { onConflict: 'id' });
    } catch (err: any) {
      console.warn('[Labs Supabase] Create error:', err.message);
    }
  }

  // Zero demo data policy: Workstations start at 0 until physically registered or added by Admin
  lab.pcCount = 0;

  // If initial staff assignments provided
  if (Array.isArray(staffIds) && staffIds.length > 0) {
    const users = db.getStore('users');
    for (const u of users) {
      if (staffIds.includes(u.id)) {
        if (!u.assignedLabs) u.assignedLabs = [];
        if (!u.assignedLabs.includes(labId)) u.assignedLabs.push(labId);
        if (!u.assignedLabs.includes(cleanCode)) u.assignedLabs.push(cleanCode);
      }
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'LAB_CREATED',
    userId: req.user?.id || 'SYSTEM',
    details: `Laboratory ${lab.code} (${lab.name}) created in ${lab.building} ${lab.room}`,
    timestamp: new Date().toISOString()
  });

  const metrics = computeLabMetrics(lab.id, lab.code);
  const assignedStaff = getLabAssignedStaffList(lab.id, lab.code);

  return res.status(201).json({
    success: true,
    data: {
      ...lab,
      metrics,
      assignedStaff
    }
  });
};

/**
 * PUT /api/labs/:id
 * Update laboratory details, cascade rename if code changes, update audit trail.
 */
export const updateLab = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const { code, name, room, building, capacity, description, status } = req.body;

  const lab = db.findOne('labs', (l: Lab) => l.id === id);
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  const oldCode = lab.code;
  let newCode = oldCode;

  if (code && code.trim().toUpperCase() !== oldCode) {
    newCode = code.trim().toUpperCase();
    const existingWithCode = db.findOne('labs', (l: Lab) => l.id !== id && l.code.toUpperCase() === newCode);
    if (existingWithCode) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_LAB', message: `Lab code '${newCode}' already exists` });
    }

    // Cascade update to computers, classes, and users
    const computers = db.getStore('computers');
    for (const c of computers) {
      if (c.labId === id || c.labCode?.toUpperCase() === oldCode) {
        c.labCode = newCode;
      }
    }

    const classes = db.getStore('classes');
    for (const cl of classes) {
      if (cl.labId === id || cl.defaultLabCode?.toUpperCase() === oldCode) {
        cl.defaultLabCode = newCode;
      }
    }

    const users = db.getStore('users');
    for (const u of users) {
      if (u.assignedLabs && Array.isArray(u.assignedLabs)) {
        u.assignedLabs = u.assignedLabs.map((lCode: string) => (lCode.toUpperCase() === oldCode ? newCode : lCode));
      }
    }
  }

  lab.code = newCode;
  if (name !== undefined) lab.name = name.trim();
  if (room !== undefined) lab.room = room.trim();
  if (building !== undefined) lab.building = building.trim();
  if (capacity !== undefined) lab.capacity = Number(capacity) || 0;
  if (description !== undefined) lab.description = description ? description.trim() : undefined;
  if (status !== undefined && ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status)) {
    lab.status = status;
  }
  lab.updatedAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('labs').update({
        code: lab.code,
        name: lab.name,
        room: lab.room,
        description: encodeCapacityInDescription(lab.description, lab.capacity, lab.building),
        status: lab.status,
        updated_at: lab.updatedAt
      }).eq('id', lab.id);
    } catch (err: any) {
      console.warn('[Labs Supabase] Update error:', err.message);
    }
  }

  // Workstations are not auto-created when capacity changes.
  // Capacity indicates the maximum seating limit of the lab.

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'LAB_UPDATED',
    userId: req.user?.id || 'SYSTEM',
    details: `Laboratory ${lab.code} (${lab.name}) updated`,
    timestamp: new Date().toISOString()
  });

  const metrics = computeLabMetrics(lab.id, lab.code);
  const assignedStaff = getLabAssignedStaffList(lab.id, lab.code);

  return res.json({
    success: true,
    data: {
      ...lab,
      pcCount: metrics.totalPcs,
      metrics,
      assignedStaff
    }
  });
};

/**
 * DELETE /api/labs/:id
 * Strict foreign-key protected deletion of laboratory facility.
 */
export const deleteLab = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const lab = db.findOne('labs', (l: Lab) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  // Dependency validation
  const computers = db.find('computers', (c: Computer) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
  const classes = db.find('classes', (cl: any) => cl.labId === lab.id || cl.defaultLabCode?.toUpperCase() === lab.code.toUpperCase());
  const sessions = db.find('sessions', (s: any) => s.labId === lab.id || s.labCode?.toUpperCase() === lab.code.toUpperCase());

  if (computers.length > 0 || classes.length > 0 || sessions.length > 0) {
    const reasons: string[] = [];
    if (computers.length > 0) reasons.push(`${computers.length} registered workstation computer(s)`);
    if (classes.length > 0) reasons.push(`${classes.length} assigned academic class offering(s)`);
    if (sessions.length > 0) reasons.push(`${sessions.length} student session record(s)`);

    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_HAS_DEPENDENCIES',
      message: `Cannot delete laboratory '${lab.code}'. It is referenced by: ${reasons.join(', ')}. Please reassign or remove these records first.`,
      dependencies: {
        computersCount: computers.length,
        classesCount: classes.length,
        sessionsCount: sessions.length
      }
    });
  }

  // Safe to delete - permanently remove from store
  db.delete('labs', (l: Lab) => l.id === lab.id);
  await recordCloudDeletion(lab.id, 'LAB', { code: lab.code, name: lab.name });

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('computers').delete().eq('lab_id', lab.id);
      await sb.from('labs').delete().eq('id', lab.id);
    } catch (err: any) {
      console.warn('[Labs Supabase] Delete error:', err.message);
    }
  }

  try {
    RealtimeService.broadcast('LAB_DELETED', { id: lab.id, code: lab.code });
  } catch {}

  // Remove lab references from users' assignedLabs
  const users = db.getStore('users');
  for (const u of users) {
    if (u.assignedLabs && Array.isArray(u.assignedLabs)) {
      u.assignedLabs = u.assignedLabs.filter((val: string) => val !== lab.id && val.toUpperCase() !== lab.code.toUpperCase());
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'LAB_DELETED',
    userId: req.user?.id || 'SYSTEM',
    details: `Laboratory ${lab.code} (${lab.name}) deleted`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    message: `Laboratory ${lab.code} successfully deleted`,
    deletedId: lab.id
  });
};

/**
 * POST /api/labs/:id/staff
 * Synchronize assigned faculty and lab assistants for a laboratory.
 */
export const assignStaffToLab = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const { staffIds } = req.body;

  if (!Array.isArray(staffIds)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'staffIds must be an array of user IDs' });
  }

  const lab = db.findOne('labs', (l: Lab) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  const users = db.getStore('users');
  const labId = lab.id;
  const labCode = lab.code.toUpperCase();

  for (const user of users) {
    if (user.role !== 'FACULTY' && user.role !== 'LAB_ASSISTANT') continue;

    if (!user.assignedLabs) {
      user.assignedLabs = [];
    }

    const shouldBeAssigned = staffIds.includes(user.id);
    const hasLab = user.assignedLabs.includes(labId) || user.assignedLabs.some((c: string) => c.toUpperCase() === labCode);

    if (shouldBeAssigned && !hasLab) {
      user.assignedLabs.push(labId);
      user.assignedLabs.push(labCode);
    } else if (!shouldBeAssigned && hasLab) {
      user.assignedLabs = user.assignedLabs.filter((c: string) => c !== labId && c.toUpperCase() !== labCode);
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'LAB_STAFF_ASSIGNED',
    userId: req.user?.id || 'SYSTEM',
    details: `Staff updated for laboratory ${lab.code}: ${staffIds.length} assigned members`,
    timestamp: new Date().toISOString()
  });

  const assignedStaff = getLabAssignedStaffList(lab.id, lab.code);
  return res.json({
    success: true,
    data: assignedStaff,
    message: `Updated staff assignments for ${lab.code}`
  });
};

/**
 * GET /api/labs/:id/staff
 * Retrieve assigned staff for a specific laboratory.
 */
export const getAssignedStaff = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const lab = db.findOne('labs', (l: Lab) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  const staff = getLabAssignedStaffList(lab.id, lab.code);
  return res.json({ success: true, data: staff });
};

/**
 * GET /api/labs/:id/stats
 * Retrieve real-time operational fleet metrics and utilization percentage for a laboratory.
 */
export const getLabStats = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const lab = db.findOne('labs', (l: Lab) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
  if (!lab) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
  }

  const metrics = computeLabMetrics(lab.id, lab.code);
  const utilizationPct = lab.capacity > 0 ? Math.round((metrics.occupiedPcs / lab.capacity) * 100) : 0;
  const operationalPct = metrics.totalPcs > 0 ? Math.round(((metrics.availablePcs + metrics.occupiedPcs) / metrics.totalPcs) * 100) : 0;

  return res.json({
    success: true,
    data: {
      labId: lab.id,
      labCode: lab.code,
      labName: lab.name,
      capacity: lab.capacity,
      status: lab.status,
      metrics,
      utilizationPct,
      operationalPct
    }
  });
};

/**
 * GET /api/computers
 * Retrieve workstations fleet with search, lab filtering, state filtering, stale offline detection, and active session lookup.
 */
export const getComputers = async (req: AuthenticatedRequest, res: Response) => {
  await ensureLabsSeeded();

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: supaPcs, error } = await sb.from('computers').select('*').order('pc_code');
      if (!error && supaPcs) {
        syncComputersFromSupabase(supaPcs, db.getStore('labs'));
      }
    } catch (err: any) {
      console.warn('[Computers Supabase] Fetch error:', err.message);
    }
  }

  const labCode = req.query.labCode as string;
  const labId = req.query.labId as string;
  const state = req.query.state as string;
  const isOnlineQuery = req.query.isOnline as string;
  const search = (req.query.search as string || '').trim().toLowerCase();
  let pcs: Computer[] = db.getStore('computers');
  const now = Date.now();

  // Scoping: Faculty and Lab Assistants only see computers in their assigned laboratories
  const user = req.user;
  if (user && (user.role === 'FACULTY' || user.role === 'LAB_ASSISTANT')) {
    if (user.assignedLabs && user.assignedLabs.length > 0) {
      pcs = pcs.filter((c: Computer) =>
        user.assignedLabs!.includes(c.labId) ||
        (c.labCode && user.assignedLabs!.some(code => code.toUpperCase() === c.labCode!.toUpperCase()))
      );
    } else {
      pcs = [];
    }
  }

  if (labCode) {
    pcs = pcs.filter((c: Computer) => c.labCode?.toUpperCase() === labCode.toUpperCase());
  } else if (labId) {
    pcs = pcs.filter((c: Computer) => c.labId === labId);
  }

  const sessions = db.getStore('sessions');

  // Enrich with live heartbeat staleness and active session lookup
  let enrichedPcs = pcs.map((c: Computer) => {
    let isOnline = c.isOnline;
    let currentState = c.state;

    // If heartbeat older than 90 seconds (and not manually maintenance/disabled/unregistered), flag offline
    if (c.lastHeartbeat) {
      const lastHbTime = new Date(c.lastHeartbeat).getTime();
      if (now - lastHbTime > 90000 && currentState !== 'DISABLED' && currentState !== 'MAINTENANCE' && currentState !== 'UNREGISTERED') {
        isOnline = false;
        if (currentState === 'AVAILABLE') {
          currentState = 'OFFLINE';
        }
      }
    }

    // Active session lookup
    const activeSession = sessions.find((s: any) =>
      (s.computerId === c.id || (s.pcCode === c.pcCode && s.labCode === c.labCode)) &&
      s.status === 'ACTIVE'
    );

    return {
      ...c,
      isOnline,
      state: currentState,
      activeSessionId: activeSession ? activeSession.id : undefined,
      activeStudentName: activeSession ? (activeSession.studentName || activeSession.studentIdentifier) : undefined
    };
  });

  if (state && state !== 'ALL') {
    enrichedPcs = enrichedPcs.filter(c => c.state === state);
  }

  if (isOnlineQuery !== undefined && isOnlineQuery !== '') {
    const targetOnline = isOnlineQuery === 'true';
    enrichedPcs = enrichedPcs.filter(c => c.isOnline === targetOnline);
  }

  if (search) {
    enrichedPcs = enrichedPcs.filter(c =>
      c.pcCode.toLowerCase().includes(search) ||
      (c.hostname && c.hostname.toLowerCase().includes(search)) ||
      (c.ipAddress && c.ipAddress.toLowerCase().includes(search)) ||
      (c.macAddress && c.macAddress.toLowerCase().includes(search)) ||
      (c.labCode && c.labCode.toLowerCase().includes(search)) ||
      (c.clientId && c.clientId.toLowerCase().includes(search))
    );
  }

  return res.json({ success: true, data: enrichedPcs });
};

/**
 * GET /api/computers/:id
 * Retrieve detailed workstation node profile by ID or PC Code.
 */
export const getComputerById = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const pc = db.findOne('computers', (c: Computer) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
  if (!pc) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
  }

  // Find active session
  const activeSession = db.findOne('sessions', (s: any) =>
    (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
    s.status === 'ACTIVE'
  );

  // Find attached equipment
  const peripherals = db.find('equipment', (e: Equipment) => e.computerId === pc.id);

  return res.json({
    success: true,
    data: {
      ...pc,
      activeSession: activeSession || null,
      equipment: peripherals
    }
  });
};

/**
 * POST /api/computers
 * Register new workstation node bound to a laboratory.
 */
export const createComputer = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { labId, labCode, pcCode, hostname, ipAddress, macAddress, clientId, state, hardwareInfo } = req.body;
  if (!labCode || !pcCode) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab code and PC code required' });
  }

  const cleanLabCode = labCode.trim().toUpperCase();
  const cleanPcCode = pcCode.trim().toUpperCase();

  // Validate lab existence
  const lab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === cleanLabCode || (labId && l.id === labId));
  if (!lab) {
    return res.status(404).json({ success: false, error: 'LAB_NOT_FOUND', message: `Laboratory '${cleanLabCode}' does not exist` });
  }

  const existing = db.findOne('computers', (c: Computer) =>
    c.pcCode.toUpperCase() === cleanPcCode &&
    c.labCode?.toUpperCase() === cleanLabCode
  );
  if (existing) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_PC', message: `Workstation ${cleanPcCode} already exists in ${cleanLabCode}` });
  }

  const newPc: Computer = {
    id: uuidv4(),
    labId: lab.id,
    labCode: cleanLabCode,
    pcCode: cleanPcCode,
    hostname: hostname ? hostname.trim() : `${cleanLabCode}-${cleanPcCode}`,
    ipAddress: ipAddress ? ipAddress.trim() : undefined,
    macAddress: macAddress ? macAddress.trim() : undefined,
    clientId: clientId ? clientId.trim() : undefined,
    state: (state && ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED', 'OFFLINE', 'UNREGISTERED'].includes(state)) ? state : (clientId ? 'AVAILABLE' : 'UNREGISTERED'),
    isOnline: true,
    hardwareInfo: hardwareInfo || {
      cpuModel: 'Intel Core i7-13700 / AMD Ryzen 7',
      ramGb: 16,
      diskGb: 512,
      osVersion: 'Microsoft Windows 11 Pro 64-bit'
    },
    peripherals: {
      keyboardConnected: true,
      mouseConnected: true,
      monitorConnected: true,
      timestamp: new Date().toISOString()
    },
    lastHeartbeat: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('computers', newPc);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('computers').upsert({
        id: newPc.id,
        lab_id: lab.id,
        pc_code: newPc.pcCode,
        hostname: newPc.hostname,
        ip_address: newPc.ipAddress,
        mac_address: newPc.macAddress,
        status: newPc.state || 'AVAILABLE',
        is_online: newPc.isOnline,
        last_heartbeat: newPc.lastHeartbeat,
        created_at: newPc.createdAt,
        updated_at: newPc.updatedAt
      }, { onConflict: 'id' });
    } catch (err: any) {
      console.warn('[Computers Supabase] Create error:', err.message);
    }
  }

  // Update lab's pcCount
  lab.pcCount = db.find('computers', (c: Computer) => c.labCode?.toUpperCase() === cleanLabCode).length;
  lab.updatedAt = new Date().toISOString();

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'COMPUTER_CREATED',
    userId: req.user?.id || 'SYSTEM',
    details: `Workstation ${newPc.pcCode} registered in lab ${newPc.labCode}`,
    timestamp: new Date().toISOString()
  });

  return res.status(201).json({ success: true, data: newPc });
};

/**
 * PUT /api/computers/:id
 * Update workstation attributes, network addresses, or hardware parameters.
 */
export const updateComputer = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const { labCode, pcCode, hostname, ipAddress, macAddress, clientId, hardwareInfo } = req.body;

  const pc = db.findOne('computers', (c: Computer) => c.id === id);
  if (!pc) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
  }

  const oldLabCode = pc.labCode;
  const oldPcCode = pc.pcCode;

  if (labCode && pcCode) {
    const cleanLab = labCode.trim().toUpperCase();
    const cleanPc = pcCode.trim().toUpperCase();

    if (cleanLab !== oldLabCode || cleanPc !== oldPcCode) {
      // Check for collisions
      const duplicate = db.findOne('computers', (c: Computer) =>
        c.id !== id &&
        c.labCode?.toUpperCase() === cleanLab &&
        c.pcCode.toUpperCase() === cleanPc
      );
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_PC', message: `Workstation ${cleanPc} already exists in ${cleanLab}` });
      }

      // Find new lab
      const newLab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === cleanLab);
      if (newLab) {
        pc.labId = newLab.id;
        pc.labCode = cleanLab;
      }
      pc.pcCode = cleanPc;
    }
  }

  if (hostname !== undefined) pc.hostname = hostname.trim();
  if (ipAddress !== undefined) pc.ipAddress = ipAddress.trim();
  if (macAddress !== undefined) pc.macAddress = macAddress.trim();
  if (clientId !== undefined) pc.clientId = clientId ? clientId.trim() : undefined;
  if (hardwareInfo !== undefined) pc.hardwareInfo = hardwareInfo;
  pc.updatedAt = new Date().toISOString();

  // Recalculate lab counts if lab assignment changed
  if (oldLabCode && oldLabCode !== pc.labCode) {
    const oldLab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === oldLabCode.toUpperCase());
    if (oldLab) {
      oldLab.pcCount = db.find('computers', (c: Computer) => c.labCode?.toUpperCase() === oldLabCode.toUpperCase()).length;
    }
  }
  if (pc.labCode) {
    const currentLab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === pc.labCode!.toUpperCase());
    if (currentLab) {
      currentLab.pcCount = db.find('computers', (c: Computer) => c.labCode?.toUpperCase() === pc.labCode!.toUpperCase()).length;
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('computers').update({
        lab_id: pc.labId,
        pc_code: pc.pcCode,
        hostname: pc.hostname,
        ip_address: pc.ipAddress,
        mac_address: pc.macAddress,
        status: pc.state || 'AVAILABLE',
        updated_at: pc.updatedAt
      }).eq('id', pc.id);
    } catch (err: any) {
      console.warn('[Computers Supabase] Update error:', err.message);
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'COMPUTER_UPDATED',
    userId: req.user?.id || 'SYSTEM',
    details: `Workstation ${pc.pcCode} in ${pc.labCode} updated`,
    timestamp: new Date().toISOString()
  });

  return res.json({ success: true, data: pc });
};

/**
 * PATCH /api/computers/:id/state
 * Enforces workstation state machine transitions:
 * AVAILABLE <-> IN_USE <-> MAINTENANCE <-> DISABLED <-> OFFLINE <-> UNREGISTERED
 */
export const updateComputerState = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const { state, reason } = req.body;

  const validStates: PcState[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED', 'OFFLINE', 'UNREGISTERED'];
  if (!state || !validStates.includes(state)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STATE',
      message: `State must be one of: ${validStates.join(', ')}`
    });
  }

  const pc = db.findOne('computers', (c: Computer) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
  if (!pc) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
  }

  const previousState = pc.state;
  const now = new Date().toISOString();

  // Transition validation:
  if (state === 'AVAILABLE' && !pc.clientId && previousState === 'UNREGISTERED') {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_SET_AVAILABLE_UNBOUND',
      message: 'Workstation cannot be marked AVAILABLE without being bound to a client node'
    });
  }

  // If transitioning to DISABLED, MAINTENANCE, or UNREGISTERED: Gracefully terminate any active student session
  if (state === 'DISABLED' || state === 'MAINTENANCE' || state === 'UNREGISTERED') {
    const activeSessions = db.find('sessions', (s: any) =>
      (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
      s.status === 'ACTIVE'
    );

    for (const session of activeSessions) {
      session.status = 'COMPLETED';
      session.endedAt = now;
      session.endMode = 'ADMINISTRATIVE';
      session.terminationReason = `Workstation transitioned to ${state}: ${reason || 'Administrative Action'}`;

      db.insert('audit_logs', {
        id: uuidv4(),
        action: 'SESSION_TERMINATED_STATE_CHANGE',
        userId: req.user?.id || 'SYSTEM',
        details: `Session ${session.id} terminated because workstation ${pc.pcCode} transitioned from ${previousState} to ${state}`,
        timestamp: now
      });
    }
  }

  // If transitioning to UNREGISTERED: unbind client ID
  if (state === 'UNREGISTERED') {
    const unboundClientId = pc.clientId;
    pc.clientId = undefined;

    if (unboundClientId) {
      const clientReg = db.findOne<ClientRegistration>('clients', (c) => c.clientId === unboundClientId);
      if (clientReg) {
        clientReg.isRegistered = false;
      }
    }
  }

  pc.state = state;
  pc.updatedAt = now;

  // Realtime Gateway Broadcast
  RealtimeService.broadcastWorkstationState(pc);

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'COMPUTER_STATE_CHANGED',
    userId: req.user?.id || 'SYSTEM',
    details: `Workstation ${pc.pcCode} (${pc.labCode}) state changed from ${previousState} to ${state}. Reason: ${reason || 'Not specified'}`,
    timestamp: now
  });

  return res.json({
    success: true,
    data: pc,
    previousState,
    currentState: state,
    message: `Workstation ${pc.pcCode} state successfully updated to ${state}`
  });
};

/**
 * POST /api/computers/:id/unbind
 * Unbind physical client node from workstation terminal.
 */
export const unbindComputer = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const pc = db.findOne('computers', (c: Computer) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
  if (!pc) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
  }

  const oldClientId = pc.clientId;
  const now = new Date().toISOString();

  // Close active session
  const activeSession = db.findOne('sessions', (s: any) =>
    (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
    s.status === 'ACTIVE'
  );
  if (activeSession) {
    activeSession.status = 'COMPLETED';
    activeSession.endedAt = now;
    activeSession.endMode = 'ADMINISTRATIVE';
    activeSession.terminationReason = 'Client terminal unbound by administrator';
  }

  pc.clientId = undefined;
  pc.state = 'UNREGISTERED';
  pc.updatedAt = now;

  if (oldClientId) {
    const client = db.findOne<ClientRegistration>('clients', (c) => c.clientId === oldClientId);
    if (client) {
      client.isRegistered = false;
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'COMPUTER_UNBOUND',
    userId: req.user?.id || 'SYSTEM',
    details: `Client node ${oldClientId || 'N/A'} unbound from workstation ${pc.pcCode} (${pc.labCode})`,
    timestamp: now
  });

  return res.json({
    success: true,
    data: pc,
    message: `Client node successfully unbound from ${pc.pcCode}`
  });
};

/**
 * DELETE /api/computers/:id
 * Remove workstation with active session protection.
 */
export const deleteComputer = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { id } = req.params;
  const pc = db.findOne('computers', (c: Computer) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
  if (!pc) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
  }

  // Active session dependency check
  const activeSession = db.findOne('sessions', (s: any) =>
    (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
    s.status === 'ACTIVE'
  );
  if (activeSession) {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_ACTIVE_SESSION',
      message: `Cannot delete workstation '${pc.pcCode}'. An active student session (${activeSession.studentIdentifier}) is currently in progress.`
    });
  }

  // Unlink associated peripherals
  const equipment = db.getStore('equipment');
  for (const e of equipment) {
    if (e.computerId === pc.id) {
      e.computerId = undefined;
      e.updatedAt = new Date().toISOString();
    }
  }

  // Remove pc permanently from store
  db.delete('computers', (c: Computer) => c.id === pc.id);
  await recordCloudDeletion(pc.id, 'COMPUTER', { pcCode: pc.pcCode, labCode: pc.labCode });

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('computers').delete().eq('id', pc.id);
    } catch (e: any) {
      console.warn('[Computers Supabase] Delete error:', e.message);
    }
  }

  try {
    RealtimeService.broadcast('COMPUTER_DELETED', { id: pc.id, pcCode: pc.pcCode });
  } catch {}

  // Update lab pcCount
  if (pc.labCode) {
    const lab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === pc.labCode?.toUpperCase());
    if (lab) {
      lab.pcCount = db.find('computers', (c: Computer) => c.labCode?.toUpperCase() === pc.labCode?.toUpperCase()).length;
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'COMPUTER_DELETED',
    userId: req.user?.id || 'SYSTEM',
    details: `Workstation ${pc.pcCode} removed from lab ${pc.labCode}`,
    timestamp: new Date().toISOString()
  });

  return res.json({ success: true, message: `Workstation ${pc.pcCode} successfully deleted`, deletedId: pc.id });
};

/**
 * POST /api/clients/register
 * Workstation node binding endpoint: Binds physical client (CLIENT_ID) to (LAB_ID, PC_ID).
 */
export const registerClient = async (req: AuthenticatedRequest, res: Response) => {
  ensureLabsSeeded();
  const { clientId, labCode, pcCode, hostname, macAddress, ipAddress, appVersion, hardwareInfo } = req.body;

  if (!clientId || !labCode || !pcCode) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Client ID, Lab Code, and PC Code are required for workstation node binding'
    });
  }

  const cleanLabCode = labCode.trim().toUpperCase();
  const cleanPcCode = pcCode.trim().toUpperCase();

  // Validate lab (or auto-provision if authorized by administrator during fleet setup)
  let lab = db.findOne('labs', (l: Lab) => l.code.toUpperCase() === cleanLabCode);
  if (!lab) {
    lab = {
      id: uuidv4(),
      code: cleanLabCode,
      name: `${cleanLabCode} Computing Complex`,
      room: 'Lab 101',
      building: 'Academic Block',
      description: `Institutional Laboratory ${cleanLabCode}`,
      capacity: 40,
      status: 'ACTIVE',
      pcCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.insert('labs', lab);
  }

  const now = new Date().toISOString();

  // Find or create workstation computer
  let computer = db.findOne('computers', (c: Computer) =>
    c.pcCode.toUpperCase() === cleanPcCode &&
    c.labCode?.toUpperCase() === cleanLabCode
  );

  if (!computer) {
    computer = {
      id: uuidv4(),
      labId: lab.id,
      labCode: cleanLabCode,
      pcCode: cleanPcCode,
      hostname: hostname || `${cleanLabCode}-${cleanPcCode}`,
      ipAddress,
      macAddress,
      clientId,
      state: 'AVAILABLE',
      isOnline: true,
      hardwareInfo: hardwareInfo || {
        cpuModel: 'Intel Core i7-13700 / AMD Ryzen 7',
        ramGb: 16,
        diskGb: 512,
        osVersion: 'Microsoft Windows 11 Pro 64-bit'
      },
      peripherals: {
        keyboardConnected: true,
        mouseConnected: true,
        monitorConnected: true,
        timestamp: now
      },
      lastHeartbeat: now,
      createdAt: now,
      updatedAt: now
    };
    db.insert('computers', computer);
    lab.pcCount = db.find('computers', (c: Computer) => c.labCode?.toUpperCase() === cleanLabCode).length;
  } else {
    // Bind terminal
    computer.clientId = clientId;
    if (hostname) computer.hostname = hostname;
    if (ipAddress) computer.ipAddress = ipAddress;
    if (macAddress) computer.macAddress = macAddress;
    if (hardwareInfo) computer.hardwareInfo = hardwareInfo;
    computer.state = computer.state === 'UNREGISTERED' || computer.state === 'OFFLINE' ? 'AVAILABLE' : computer.state;
    computer.isOnline = true;
    computer.lastHeartbeat = now;
    computer.updatedAt = now;
  }

  // Upsert client registration
  let registration = db.findOne<ClientRegistration>('clients', (c) => c.clientId === clientId);
  if (!registration) {
    registration = {
      clientId,
      labCode: cleanLabCode,
      pcCode: cleanPcCode,
      hostname: hostname || computer.hostname,
      macAddress: macAddress || computer.macAddress,
      ipAddress: ipAddress || computer.ipAddress,
      hardwareInfo: computer.hardwareInfo,
      appVersion: appVersion || '2.0.7',
      isRegistered: true,
      isOnline: true,
      lastHeartbeat: now
    };
    db.insert('clients', registration);
  } else {
    registration.labCode = cleanLabCode;
    registration.pcCode = cleanPcCode;
    registration.hostname = hostname || computer.hostname;
    registration.macAddress = macAddress || computer.macAddress;
    registration.ipAddress = ipAddress || computer.ipAddress;
    registration.isRegistered = true;
    registration.isOnline = true;
    registration.appVersion = appVersion || '2.0.7';
    registration.lastHeartbeat = now;
  }

  // Two-way Supabase Cloud Synchronization: Persist lab, computer, and client binding
  const sb = getSupabase();
  if (sb) {
    try {
      // 1. Ensure lab exists with correct UUID
      const { data: supaLab } = await sb.from('labs').select('id, code').eq('code', cleanLabCode).maybeSingle();
      const actualLabId = supaLab ? supaLab.id : lab.id;
      lab.id = actualLabId;
      computer.labId = actualLabId;

      await sb.from('labs').update({
        pc_count: lab.pcCount || 1,
        updated_at: now
      }).eq('id', actualLabId);

      // 2. Check if computer exists in Supabase to reuse cloud UUID
      const { data: supaPc } = await sb.from('computers').select('id')
        .eq('lab_id', actualLabId)
        .eq('pc_code', cleanPcCode)
        .maybeSingle();
      if (supaPc) {
        computer.id = supaPc.id;
      }

      // 3. Upsert computer into Supabase
      await sb.from('computers').upsert({
        id: computer.id,
        lab_id: actualLabId,
        pc_code: cleanPcCode,
        hostname: computer.hostname,
        ip_address: computer.ipAddress || null,
        mac_address: computer.macAddress || null,
        status: computer.state || 'AVAILABLE',
        is_online: true,
        last_heartbeat: now,
        bound_client_id: clientId,
        updated_at: now
      }, { onConflict: 'id' });

      // 4. Upsert client registration into Supabase
      await sb.from('clients').upsert({
        client_id: clientId,
        lab_id: actualLabId,
        computer_id: computer.id,
        lab_code: cleanLabCode,
        pc_code: cleanPcCode,
        app_version: appVersion || '2.6.1',
        is_registered: true,
        is_online: true,
        last_heartbeat: now,
        updated_at: now
      }, { onConflict: 'client_id' });
    } catch (err: any) {
      console.warn('[RegisterClient Supabase] Error syncing workstation registration:', err.message);
    }
  }

  // Audit log
  db.insert('audit_logs', {
    id: uuidv4(),
    action: 'WORKSTATION_BOUND',
    userId: req.user?.id || 'SYSTEM',
    details: `Terminal node ${clientId} bound to ${cleanLabCode} - ${cleanPcCode} (${computer.hostname})`,
    timestamp: now
  });

  return res.json({
    success: true,
    data: {
      isRegistered: true,
      clientId,
      labId: lab.id,
      labCode: cleanLabCode,
      labName: lab.name,
      pcId: computer.id,
      pcCode: cleanPcCode,
      hostname: computer.hostname,
      state: computer.state,
      tokenIssuedAt: now
    },
    message: `Workstation ${cleanPcCode} successfully bound to ${cleanLabCode}`
  });
};

/**
 * POST /api/clients/heartbeat
 * Periodic hardware telemetry and operational state synchronization.
 */
export const heartbeat = async (req: AuthenticatedRequest, res: Response) => {
  const { clientId, labCode, pcCode, appVersion, state, hardwareStatus } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, error: 'MISSING_CLIENT_ID' });
  }

  const now = new Date().toISOString();

  // Update client registration
  db.update('clients', (c: ClientRegistration) => c.clientId === clientId, {
    lastHeartbeat: now,
    isOnline: true,
    appVersion: appVersion || '2.0.7'
  });

  let computerDirective: any = null;

  // Update bound computer
  let computer = db.findOne('computers', (c: Computer) =>
    (c.clientId === clientId) ||
    (pcCode && labCode && c.pcCode === pcCode.toUpperCase() && c.labCode === labCode.toUpperCase())
  );

  if (computer) {
    computer.lastHeartbeat = now;
    computer.isOnline = true;

    if (hardwareStatus) {
      const kb = hardwareStatus.keyboard_connected ?? hardwareStatus.peripherals?.keyboard ?? true;
      const ms = hardwareStatus.mouse_connected ?? hardwareStatus.peripherals?.mouse ?? true;
      const dsp = hardwareStatus.monitor_connected ?? hardwareStatus.peripherals?.display ?? true;
      computer.peripherals = {
        keyboard: kb,
        mouse: ms,
        display: dsp,
        keyboardConnected: kb,
        mouseConnected: ms,
        monitorConnected: dsp,
        timestamp: now
      };
    }

    if (state && !['DISABLED', 'MAINTENANCE', 'UNREGISTERED'].includes(computer.state)) {
      computer.state = state;
    }

    // Directives for client locking
    const isLocked = ['DISABLED', 'MAINTENANCE', 'UNREGISTERED'].includes(computer.state);
    computerDirective = {
      enforceLock: isLocked,
      requiredState: computer.state,
      message: isLocked ? `Workstation is currently in ${computer.state} state by administrator directive.` : undefined
    };
  }

  return res.json({
    success: true,
    serverTime: now,
    directive: computerDirective
  });
};

export const getEquipment = async (req: AuthenticatedRequest, res: Response) => {
  const labCode = req.query.labCode as string;
  let items = db.getStore('equipment');
  if (labCode) {
    items = items.filter((e: Equipment) => e.labId === labCode);
  }
  return res.json({ success: true, data: items });
};

export const createEquipment = async (req: AuthenticatedRequest, res: Response) => {
  const { assetTag, type, brand, model, serialNumber, labId, computerId } = req.body;

  const item: Equipment = {
    id: uuidv4(),
    assetTag,
    type,
    brand,
    model,
    serialNumber,
    status: 'FUNCTIONAL',
    labId,
    computerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('equipment', item);
  return res.status(201).json({ success: true, data: item });
};
