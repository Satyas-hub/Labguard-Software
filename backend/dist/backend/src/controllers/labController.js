"use strict";
// ============================================================================
// LABGUARD V2: Laboratory, Computer & Equipment Management Controller
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEquipment = exports.getEquipment = exports.heartbeat = exports.registerClient = exports.deleteComputer = exports.unbindComputer = exports.updateComputerState = exports.updateComputer = exports.createComputer = exports.getComputerById = exports.getComputers = exports.getLabStats = exports.getAssignedStaff = exports.assignStaffToLab = exports.deleteLab = exports.updateLab = exports.createLab = exports.getLabById = exports.getLabs = exports.getAvailableLabsForRegistration = exports.getLabAssignedStaffList = exports.computeLabMetrics = exports.getSystemPeripherals = exports.ensureLabsSeeded = exports.autoProvisionLabWorkstations = void 0;
exports.encodeCapacityInDescription = encodeCapacityInDescription;
exports.parseCapacityAndDescription = parseCapacityAndDescription;
exports.syncComputersFromSupabase = syncComputersFromSupabase;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const realtimeService_1 = require("../services/realtimeService");
const child_process_1 = require("child_process");
const supabaseSyncHelper_1 = require("../db/supabaseSyncHelper");
/**
 * Metadata helpers to persist capacity & building in Supabase labs table description field
 */
function encodeCapacityInDescription(description, capacity, building) {
    const clean = (description || '')
        .replace(/\[CAPACITY:\d+\]\s*/g, '')
        .replace(/\[BUILDING:[^\]]+\]\s*/g, '')
        .trim();
    const tokens = [`[CAPACITY:${capacity}]`];
    if (building && building.trim()) {
        tokens.push(`[BUILDING:${building.trim()}]`);
    }
    return `${tokens.join(' ')} ${clean}`.trim();
}
function parseCapacityAndDescription(description, fallbackCapacity = 40, fallbackBuilding = 'Main Campus') {
    if (!description)
        return { capacity: fallbackCapacity, building: fallbackBuilding, description: '' };
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
function syncComputersFromSupabase(supaPcs, labsStore) {
    const pcStore = pool_1.db.getStore('computers');
    pcStore.length = 0; // Clear memory store to match Supabase source of truth
    for (const p of supaPcs) {
        const labObj = labsStore.find((l) => l.id === p.lab_id || l.code?.toUpperCase() === p.lab_code?.toUpperCase());
        const pcData = {
            id: p.id,
            labId: p.lab_id,
            labCode: labObj ? labObj.code : (p.lab_code || 'UNASSIGNED'),
            pcCode: p.pc_code,
            hostname: p.hostname || `${labObj?.code || 'WORKSTATION'}-${p.pc_code}`,
            ipAddress: p.ip_address || undefined,
            macAddress: p.mac_address || undefined,
            clientId: p.bound_client_id || undefined,
            state: (p.status || 'AVAILABLE'),
            isOnline: p.is_online !== false,
            lastHeartbeat: p.last_heartbeat,
            createdAt: p.created_at || new Date().toISOString(),
            updatedAt: p.updated_at || new Date().toISOString()
        };
        pcStore.push(pcData);
    }
}
/**
 * Auto-provisions workstation nodes for a laboratory up to targetCapacity
 */
const autoProvisionLabWorkstations = async (lab, targetCapacity) => {
    if (!targetCapacity || targetCapacity <= 0)
        return;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    const existingPcs = pool_1.db.find('computers', (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
    const existingPcCodes = new Set(existingPcs.map(p => p.pcCode.toUpperCase()));
    const newPcs = [];
    const now = new Date().toISOString();
    for (let i = 1; i <= targetCapacity; i++) {
        const pcCode = `PC-${i < 10 ? '0' : ''}${i}`;
        if (!existingPcCodes.has(pcCode)) {
            const pc = {
                id: (0, uuid_1.v4)(),
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
            pool_1.db.insert('computers', pc);
            newPcs.push(pc);
            existingPcCodes.add(pcCode);
        }
    }
    const allLabPcs = pool_1.db.find('computers', (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
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
        }
        catch (err) {
            console.warn('[Lab Workstations Supabase] Error auto-provisioning workstations:', err.message);
        }
    }
};
exports.autoProvisionLabWorkstations = autoProvisionLabWorkstations;
/**
 * Ensures baseline institutional laboratories are initialized.
 */
let hasEnsuredLabs = false;
const ensureLabsSeeded = async () => {
    if (hasEnsuredLabs)
        return;
    hasEnsuredLabs = true;
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    const alreadyBootstrapped = await (0, supabaseSyncHelper_1.isInstitutionBootstrapped)();
    if (sb) {
        try {
            const { data: supaLabs } = await sb.from('labs').select('*').order('code');
            if (supaLabs) {
                const store = pool_1.db.getStore('labs');
                store.length = 0;
                for (const l of supaLabs) {
                    const { capacity, building, description } = parseCapacityAndDescription(l.description, l.capacity || 40, l.building || 'Main Campus');
                    store.push({
                        id: l.id,
                        code: l.code,
                        name: l.name,
                        room: l.room,
                        building: building || l.building || 'Main Campus',
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
                // Workstations are only registered when configured via login screen / registration modal.
                // No dummy workstations are auto-provisioned.
            }
        }
        catch (err) {
            console.warn('[Lab Supabase] Initial cloud sync note:', err.message);
        }
    }
};
exports.ensureLabsSeeded = ensureLabsSeeded;
/**
 * GET /api/system/peripherals
 * Live detection of hardware peripherals directly from Windows Device Manager (PnP)
 */
const getSystemPeripherals = async (_req, res) => {
    if (process.platform !== 'win32') {
        return res.json({
            success: true,
            data: {
                keyboard_connected: true,
                mouse_connected: true,
                monitor_connected: true,
                keyboard_name: 'Standard Keyboard',
                mouse_name: 'Standard Mouse',
                monitor_name: 'Display Monitor',
                timestamp: new Date().toISOString()
            }
        });
    }
    try {
        const psCmd = `@(Get-PnpDevice -PresentOnly -Class Keyboard, Mouse, Monitor -ErrorAction SilentlyContinue | Select-Object Class, FriendlyName, Status) | ConvertTo-Json -Compress`;
        (0, child_process_1.exec)(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 4000 }, (err, stdout) => {
            let keyboard_connected = false;
            let keyboard_name = 'Not Detected';
            let mouse_connected = false;
            let mouse_name = 'Not Detected';
            let monitor_connected = false;
            let monitor_name = 'Not Detected';
            if (!err && stdout && stdout.trim()) {
                try {
                    const raw = stdout.trim();
                    const parsed = JSON.parse(raw);
                    const devices = Array.isArray(parsed) ? parsed : [parsed];
                    for (const dev of devices) {
                        const cls = String(dev.Class || '').toLowerCase();
                        const name = String(dev.FriendlyName || '').trim();
                        const status = String(dev.Status || '').toUpperCase();
                        const isOk = status === 'OK';
                        if (cls === 'keyboard' && isOk) {
                            keyboard_connected = true;
                            if (keyboard_name === 'Not Detected' || keyboard_name.toLowerCase().includes('standard ps/2')) {
                                keyboard_name = name || 'Standard Keyboard';
                            }
                        }
                        else if (cls === 'mouse' && isOk) {
                            mouse_connected = true;
                            if (mouse_name === 'Not Detected' || mouse_name.toLowerCase().includes('hid-compliant')) {
                                mouse_name = name || 'Pointing Device';
                            }
                        }
                        else if (cls === 'monitor' && isOk) {
                            monitor_connected = true;
                            if (monitor_name === 'Not Detected' || monitor_name.toLowerCase().includes('generic')) {
                                monitor_name = name || 'Display Monitor';
                            }
                        }
                    }
                }
                catch {
                    // Silently fall through
                }
            }
            if (!monitor_connected) {
                monitor_connected = true;
                monitor_name = 'Primary Workstation Display';
            }
            return res.json({
                success: true,
                data: {
                    keyboard_connected,
                    mouse_connected,
                    monitor_connected,
                    keyboard_name,
                    mouse_name,
                    monitor_name,
                    timestamp: new Date().toISOString()
                }
            });
        });
    }
    catch (e) {
        return res.json({
            success: true,
            data: {
                keyboard_connected: true,
                mouse_connected: true,
                monitor_connected: true,
                keyboard_name: 'Windows Keyboard',
                mouse_name: 'Windows Pointing Device',
                monitor_name: 'Display Monitor',
                timestamp: new Date().toISOString()
            }
        });
    }
};
exports.getSystemPeripherals = getSystemPeripherals;
/**
 * Computes live workstation metric rollups for a specific laboratory.
 */
const computeLabMetrics = (labId, labCode) => {
    const allPcs = pool_1.db.getStore('computers');
    const pcs = allPcs.filter((c) => c.labId === labId || (labCode && c.labCode?.toUpperCase() === labCode.toUpperCase()));
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
        }
        else if (pc.state === 'IN_USE') {
            occupiedPcs++;
        }
        else if (pc.state === 'MAINTENANCE') {
            maintenancePcs++;
        }
        else if (pc.state === 'DISABLED') {
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
exports.computeLabMetrics = computeLabMetrics;
/**
 * Retrieves the assigned faculty and lab assistants for a laboratory.
 */
const getLabAssignedStaffList = (labId, labCode) => {
    const users = pool_1.db.getStore('users');
    const staff = users.filter((u) => {
        if (u.role !== 'FACULTY' && u.role !== 'LAB_ASSISTANT')
            return false;
        if (!u.assignedLabs || !Array.isArray(u.assignedLabs))
            return false;
        return u.assignedLabs.includes(labId) || (labCode && u.assignedLabs.some((code) => code.toUpperCase() === labCode.toUpperCase()));
    });
    return staff.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        department: u.department
    }));
};
exports.getLabAssignedStaffList = getLabAssignedStaffList;
/**
 * GET /api/clients/available-labs
 * Public / setup endpoint for workstations to retrieve all active laboratories created in the admin panel.
 */
const getAvailableLabsForRegistration = async (_req, res) => {
    await (0, exports.ensureLabsSeeded)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaLabs } = await sb.from('labs').select('*').order('code');
            if (supaLabs) {
                const store = pool_1.db.getStore('labs');
                store.length = 0;
                for (const sl of supaLabs) {
                    const { capacity, building, description } = parseCapacityAndDescription(sl.description, sl.capacity || 40, sl.building || 'Main Campus');
                    store.push({
                        id: sl.id,
                        code: sl.code,
                        name: sl.name,
                        building: building || sl.building || 'Main Campus',
                        room: sl.room,
                        description,
                        capacity,
                        status: sl.status || 'ACTIVE',
                        pcCount: sl.pc_count || 0,
                        createdAt: sl.created_at || new Date().toISOString(),
                        updatedAt: sl.updated_at || new Date().toISOString()
                    });
                }
            }
        }
        catch (e) {
            console.warn('[Available Labs Supabase] Fetch error:', e.message);
        }
    }
    const labs = pool_1.db.getStore('labs');
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
exports.getAvailableLabsForRegistration = getAvailableLabsForRegistration;
/**
 * GET /api/labs
 * Retrieve all laboratories with search, status filtering, live metrics, and assigned staff.
 */
const getLabs = async (req, res) => {
    await (0, exports.ensureLabsSeeded)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaLabs, error } = await sb.from('labs').select('*').order('code');
            if (!error && supaLabs) {
                const store = pool_1.db.getStore('labs');
                store.length = 0;
                for (const l of supaLabs) {
                    const { capacity, building, description } = parseCapacityAndDescription(l.description, l.capacity || 40, l.building || 'Main Campus');
                    store.push({
                        id: l.id,
                        code: l.code,
                        name: l.name,
                        room: l.room,
                        building: building || l.building || 'Main Campus',
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
        }
        catch (err) {
            console.warn('[Labs Supabase] Fetch error:', err.message);
        }
    }
    const user = req.user;
    let labs = pool_1.db.getStore('labs');
    // Scoping: Faculty and Lab Assistant only see assigned labs
    if (user.role === 'FACULTY' || user.role === 'LAB_ASSISTANT') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            labs = labs.filter((l) => user.assignedLabs.includes(l.id) || user.assignedLabs.some((code) => code.toUpperCase() === l.code.toUpperCase()));
        }
        else {
            labs = [];
        }
    }
    // Filter by search query
    const search = (req.query.search || '').trim().toLowerCase();
    if (search) {
        labs = labs.filter((l) => l.code.toLowerCase().includes(search) ||
            l.name.toLowerCase().includes(search) ||
            l.room.toLowerCase().includes(search) ||
            (l.building && l.building.toLowerCase().includes(search)));
    }
    // Filter by status
    const status = (req.query.status || '').trim().toUpperCase();
    if (status && status !== 'ALL') {
        labs = labs.filter((l) => l.status === status);
    }
    // Enrich with live metrics and assigned staff
    const enrichedLabs = labs.map((lab) => {
        const metrics = (0, exports.computeLabMetrics)(lab.id, lab.code);
        const assignedStaff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
        return {
            ...lab,
            pcCount: metrics.totalPcs,
            metrics,
            assignedStaff
        };
    });
    return res.json({ success: true, data: enrichedLabs });
};
exports.getLabs = getLabs;
/**
 * GET /api/labs/:id
 * Retrieve detailed laboratory record with fleet workstation list and assigned staff.
 */
const getLabById = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const lab = pool_1.db.findOne('labs', (l) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    const metrics = (0, exports.computeLabMetrics)(lab.id, lab.code);
    const assignedStaff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
    const computers = pool_1.db.find('computers', (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
    const equipment = pool_1.db.find('equipment', (e) => e.labId === lab.id || e.labId === lab.code);
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
exports.getLabById = getLabById;
/**
 * POST /api/labs
 * Create a new laboratory facility with unique code validation and optional staff assignment.
 */
const createLab = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { code, name, room, building, capacity, description, status, staffIds } = req.body;
    if (!code || !name || !room) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab Code, Name and Room required' });
    }
    const cleanCode = code.trim().toUpperCase();
    const existing = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === cleanCode);
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_LAB', message: `Lab code '${cleanCode}' already exists` });
    }
    const labId = (0, uuid_1.v4)();
    const labCapacity = Number(capacity) || 30;
    const lab = {
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
    pool_1.db.insert('labs', lab);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
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
        }
        catch (err) {
            console.warn('[Labs Supabase] Create error:', err.message);
        }
    }
    // Zero demo data policy: Workstations start at 0 until physically registered or added by Admin
    lab.pcCount = 0;
    // If initial staff assignments provided
    if (Array.isArray(staffIds) && staffIds.length > 0) {
        const users = pool_1.db.getStore('users');
        for (const u of users) {
            if (staffIds.includes(u.id)) {
                if (!u.assignedLabs)
                    u.assignedLabs = [];
                if (!u.assignedLabs.includes(labId))
                    u.assignedLabs.push(labId);
                if (!u.assignedLabs.includes(cleanCode))
                    u.assignedLabs.push(cleanCode);
            }
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'LAB_CREATED',
        userId: req.user?.id || 'SYSTEM',
        details: `Laboratory ${lab.code} (${lab.name}) created in ${lab.building} ${lab.room}`,
        timestamp: new Date().toISOString()
    });
    const metrics = (0, exports.computeLabMetrics)(lab.id, lab.code);
    const assignedStaff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
    return res.status(201).json({
        success: true,
        data: {
            ...lab,
            metrics,
            assignedStaff
        }
    });
};
exports.createLab = createLab;
/**
 * PUT /api/labs/:id
 * Update laboratory details, cascade rename if code changes, update audit trail.
 */
const updateLab = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const { code, name, room, building, capacity, description, status } = req.body;
    const lab = pool_1.db.findOne('labs', (l) => l.id === id);
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    const oldCode = lab.code;
    let newCode = oldCode;
    if (code && code.trim().toUpperCase() !== oldCode) {
        newCode = code.trim().toUpperCase();
        const existingWithCode = pool_1.db.findOne('labs', (l) => l.id !== id && l.code.toUpperCase() === newCode);
        if (existingWithCode) {
            return res.status(409).json({ success: false, error: 'DUPLICATE_LAB', message: `Lab code '${newCode}' already exists` });
        }
        // Cascade update to computers, classes, and users
        const computers = pool_1.db.getStore('computers');
        for (const c of computers) {
            if (c.labId === id || c.labCode?.toUpperCase() === oldCode) {
                c.labCode = newCode;
            }
        }
        const classes = pool_1.db.getStore('classes');
        for (const cl of classes) {
            if (cl.labId === id || cl.defaultLabCode?.toUpperCase() === oldCode) {
                cl.defaultLabCode = newCode;
            }
        }
        const users = pool_1.db.getStore('users');
        for (const u of users) {
            if (u.assignedLabs && Array.isArray(u.assignedLabs)) {
                u.assignedLabs = u.assignedLabs.map((lCode) => (lCode.toUpperCase() === oldCode ? newCode : lCode));
            }
        }
    }
    lab.code = newCode;
    if (name !== undefined)
        lab.name = name.trim();
    if (room !== undefined)
        lab.room = room.trim();
    if (building !== undefined)
        lab.building = building.trim();
    if (capacity !== undefined)
        lab.capacity = Number(capacity) || 0;
    if (description !== undefined)
        lab.description = description ? description.trim() : undefined;
    if (status !== undefined && ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status)) {
        lab.status = status;
    }
    lab.updatedAt = new Date().toISOString();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
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
        }
        catch (err) {
            console.warn('[Labs Supabase] Update error:', err.message);
        }
    }
    // Workstations are not auto-created when capacity changes.
    // Capacity indicates the maximum seating limit of the lab.
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'LAB_UPDATED',
        userId: req.user?.id || 'SYSTEM',
        details: `Laboratory ${lab.code} (${lab.name}) updated`,
        timestamp: new Date().toISOString()
    });
    const metrics = (0, exports.computeLabMetrics)(lab.id, lab.code);
    const assignedStaff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
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
exports.updateLab = updateLab;
/**
 * DELETE /api/labs/:id
 * Strict foreign-key protected deletion of laboratory facility.
 */
const deleteLab = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const lab = pool_1.db.findOne('labs', (l) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    // Dependency validation
    const computers = pool_1.db.find('computers', (c) => c.labId === lab.id || c.labCode?.toUpperCase() === lab.code.toUpperCase());
    const classes = pool_1.db.find('classes', (cl) => cl.labId === lab.id || cl.defaultLabCode?.toUpperCase() === lab.code.toUpperCase());
    const sessions = pool_1.db.find('sessions', (s) => s.labId === lab.id || s.labCode?.toUpperCase() === lab.code.toUpperCase());
    if (computers.length > 0 || classes.length > 0 || sessions.length > 0) {
        const reasons = [];
        if (computers.length > 0)
            reasons.push(`${computers.length} registered workstation computer(s)`);
        if (classes.length > 0)
            reasons.push(`${classes.length} assigned academic class offering(s)`);
        if (sessions.length > 0)
            reasons.push(`${sessions.length} student session record(s)`);
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
    // Safe to delete
    const labsStore = pool_1.db.getStore('labs');
    const index = labsStore.findIndex((l) => l.id === lab.id);
    if (index !== -1) {
        labsStore.splice(index, 1);
    }
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('computers').delete().eq('lab_id', lab.id);
            await sb.from('labs').delete().eq('id', lab.id);
        }
        catch (err) {
            console.warn('[Labs Supabase] Delete error:', err.message);
        }
    }
    // Remove lab references from users' assignedLabs
    const users = pool_1.db.getStore('users');
    for (const u of users) {
        if (u.assignedLabs && Array.isArray(u.assignedLabs)) {
            u.assignedLabs = u.assignedLabs.filter((val) => val !== lab.id && val.toUpperCase() !== lab.code.toUpperCase());
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
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
exports.deleteLab = deleteLab;
/**
 * POST /api/labs/:id/staff
 * Synchronize assigned faculty and lab assistants for a laboratory.
 */
const assignStaffToLab = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const { staffIds } = req.body;
    if (!Array.isArray(staffIds)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'staffIds must be an array of user IDs' });
    }
    const lab = pool_1.db.findOne('labs', (l) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    const users = pool_1.db.getStore('users');
    const labId = lab.id;
    const labCode = lab.code.toUpperCase();
    for (const user of users) {
        if (user.role !== 'FACULTY' && user.role !== 'LAB_ASSISTANT')
            continue;
        if (!user.assignedLabs) {
            user.assignedLabs = [];
        }
        const shouldBeAssigned = staffIds.includes(user.id);
        const hasLab = user.assignedLabs.includes(labId) || user.assignedLabs.some((c) => c.toUpperCase() === labCode);
        if (shouldBeAssigned && !hasLab) {
            user.assignedLabs.push(labId);
            user.assignedLabs.push(labCode);
        }
        else if (!shouldBeAssigned && hasLab) {
            user.assignedLabs = user.assignedLabs.filter((c) => c !== labId && c.toUpperCase() !== labCode);
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'LAB_STAFF_ASSIGNED',
        userId: req.user?.id || 'SYSTEM',
        details: `Staff updated for laboratory ${lab.code}: ${staffIds.length} assigned members`,
        timestamp: new Date().toISOString()
    });
    const assignedStaff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
    return res.json({
        success: true,
        data: assignedStaff,
        message: `Updated staff assignments for ${lab.code}`
    });
};
exports.assignStaffToLab = assignStaffToLab;
/**
 * GET /api/labs/:id/staff
 * Retrieve assigned staff for a specific laboratory.
 */
const getAssignedStaff = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const lab = pool_1.db.findOne('labs', (l) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    const staff = (0, exports.getLabAssignedStaffList)(lab.id, lab.code);
    return res.json({ success: true, data: staff });
};
exports.getAssignedStaff = getAssignedStaff;
/**
 * GET /api/labs/:id/stats
 * Retrieve real-time operational fleet metrics and utilization percentage for a laboratory.
 */
const getLabStats = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const lab = pool_1.db.findOne('labs', (l) => l.id === id || l.code.toUpperCase() === id.toUpperCase());
    if (!lab) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Laboratory not found' });
    }
    const metrics = (0, exports.computeLabMetrics)(lab.id, lab.code);
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
exports.getLabStats = getLabStats;
/**
 * GET /api/computers
 * Retrieve workstations fleet with search, lab filtering, state filtering, stale offline detection, and active session lookup.
 */
const getComputers = async (req, res) => {
    await (0, exports.ensureLabsSeeded)();
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            const { data: supaPcs, error } = await sb.from('computers').select('*').order('pc_code');
            if (!error && supaPcs) {
                syncComputersFromSupabase(supaPcs, pool_1.db.getStore('labs'));
            }
        }
        catch (err) {
            console.warn('[Computers Supabase] Fetch error:', err.message);
        }
    }
    const labCode = req.query.labCode;
    const labId = req.query.labId;
    const state = req.query.state;
    const isOnlineQuery = req.query.isOnline;
    const search = (req.query.search || '').trim().toLowerCase();
    let pcs = pool_1.db.getStore('computers');
    const now = Date.now();
    // Scoping: Faculty and Lab Assistants only see computers in their assigned laboratories
    const user = req.user;
    if (user && (user.role === 'FACULTY' || user.role === 'LAB_ASSISTANT')) {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            pcs = pcs.filter((c) => user.assignedLabs.includes(c.labId) ||
                (c.labCode && user.assignedLabs.some(code => code.toUpperCase() === c.labCode.toUpperCase())));
        }
        else {
            pcs = [];
        }
    }
    if (labCode) {
        pcs = pcs.filter((c) => c.labCode?.toUpperCase() === labCode.toUpperCase());
    }
    else if (labId) {
        pcs = pcs.filter((c) => c.labId === labId);
    }
    const sessions = pool_1.db.getStore('sessions');
    // Enrich with live heartbeat staleness and active session lookup
    let enrichedPcs = pcs.map((c) => {
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
        const activeSession = sessions.find((s) => (s.computerId === c.id || (s.pcCode === c.pcCode && s.labCode === c.labCode)) &&
            s.status === 'ACTIVE');
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
        enrichedPcs = enrichedPcs.filter(c => c.pcCode.toLowerCase().includes(search) ||
            (c.hostname && c.hostname.toLowerCase().includes(search)) ||
            (c.ipAddress && c.ipAddress.toLowerCase().includes(search)) ||
            (c.macAddress && c.macAddress.toLowerCase().includes(search)) ||
            (c.labCode && c.labCode.toLowerCase().includes(search)) ||
            (c.clientId && c.clientId.toLowerCase().includes(search)));
    }
    return res.json({ success: true, data: enrichedPcs });
};
exports.getComputers = getComputers;
/**
 * GET /api/computers/:id
 * Retrieve detailed workstation node profile by ID or PC Code.
 */
const getComputerById = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const pc = pool_1.db.findOne('computers', (c) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
    if (!pc) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
    }
    // Find active session
    const activeSession = pool_1.db.findOne('sessions', (s) => (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
        s.status === 'ACTIVE');
    // Find attached equipment
    const peripherals = pool_1.db.find('equipment', (e) => e.computerId === pc.id);
    return res.json({
        success: true,
        data: {
            ...pc,
            activeSession: activeSession || null,
            equipment: peripherals
        }
    });
};
exports.getComputerById = getComputerById;
/**
 * POST /api/computers
 * Register new workstation node bound to a laboratory.
 */
const createComputer = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { labId, labCode, pcCode, hostname, ipAddress, macAddress, clientId, state, hardwareInfo } = req.body;
    if (!labCode || !pcCode) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab code and PC code required' });
    }
    const cleanLabCode = labCode.trim().toUpperCase();
    const cleanPcCode = pcCode.trim().toUpperCase();
    // Validate lab existence
    const lab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === cleanLabCode || (labId && l.id === labId));
    if (!lab) {
        return res.status(404).json({ success: false, error: 'LAB_NOT_FOUND', message: `Laboratory '${cleanLabCode}' does not exist` });
    }
    const existing = pool_1.db.findOne('computers', (c) => c.pcCode.toUpperCase() === cleanPcCode &&
        c.labCode?.toUpperCase() === cleanLabCode);
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_PC', message: `Workstation ${cleanPcCode} already exists in ${cleanLabCode}` });
    }
    const newPc = {
        id: (0, uuid_1.v4)(),
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
    pool_1.db.insert('computers', newPc);
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
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
        }
        catch (err) {
            console.warn('[Computers Supabase] Create error:', err.message);
        }
    }
    // Update lab's pcCount
    lab.pcCount = pool_1.db.find('computers', (c) => c.labCode?.toUpperCase() === cleanLabCode).length;
    lab.updatedAt = new Date().toISOString();
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'COMPUTER_CREATED',
        userId: req.user?.id || 'SYSTEM',
        details: `Workstation ${newPc.pcCode} registered in lab ${newPc.labCode}`,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json({ success: true, data: newPc });
};
exports.createComputer = createComputer;
/**
 * PUT /api/computers/:id
 * Update workstation attributes, network addresses, or hardware parameters.
 */
const updateComputer = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const { labCode, pcCode, hostname, ipAddress, macAddress, clientId, hardwareInfo } = req.body;
    const pc = pool_1.db.findOne('computers', (c) => c.id === id);
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
            const duplicate = pool_1.db.findOne('computers', (c) => c.id !== id &&
                c.labCode?.toUpperCase() === cleanLab &&
                c.pcCode.toUpperCase() === cleanPc);
            if (duplicate) {
                return res.status(409).json({ success: false, error: 'DUPLICATE_PC', message: `Workstation ${cleanPc} already exists in ${cleanLab}` });
            }
            // Find new lab
            const newLab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === cleanLab);
            if (newLab) {
                pc.labId = newLab.id;
                pc.labCode = cleanLab;
            }
            pc.pcCode = cleanPc;
        }
    }
    if (hostname !== undefined)
        pc.hostname = hostname.trim();
    if (ipAddress !== undefined)
        pc.ipAddress = ipAddress.trim();
    if (macAddress !== undefined)
        pc.macAddress = macAddress.trim();
    if (clientId !== undefined)
        pc.clientId = clientId ? clientId.trim() : undefined;
    if (hardwareInfo !== undefined)
        pc.hardwareInfo = hardwareInfo;
    pc.updatedAt = new Date().toISOString();
    // Recalculate lab counts if lab assignment changed
    if (oldLabCode && oldLabCode !== pc.labCode) {
        const oldLab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === oldLabCode.toUpperCase());
        if (oldLab) {
            oldLab.pcCount = pool_1.db.find('computers', (c) => c.labCode?.toUpperCase() === oldLabCode.toUpperCase()).length;
        }
    }
    if (pc.labCode) {
        const currentLab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === pc.labCode.toUpperCase());
        if (currentLab) {
            currentLab.pcCount = pool_1.db.find('computers', (c) => c.labCode?.toUpperCase() === pc.labCode.toUpperCase()).length;
        }
    }
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
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
        }
        catch (err) {
            console.warn('[Computers Supabase] Update error:', err.message);
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'COMPUTER_UPDATED',
        userId: req.user?.id || 'SYSTEM',
        details: `Workstation ${pc.pcCode} in ${pc.labCode} updated`,
        timestamp: new Date().toISOString()
    });
    return res.json({ success: true, data: pc });
};
exports.updateComputer = updateComputer;
/**
 * PATCH /api/computers/:id/state
 * Enforces workstation state machine transitions:
 * AVAILABLE <-> IN_USE <-> MAINTENANCE <-> DISABLED <-> OFFLINE <-> UNREGISTERED
 */
const updateComputerState = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const { state, reason } = req.body;
    const validStates = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED', 'OFFLINE', 'UNREGISTERED'];
    if (!state || !validStates.includes(state)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_STATE',
            message: `State must be one of: ${validStates.join(', ')}`
        });
    }
    const pc = pool_1.db.findOne('computers', (c) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
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
        const activeSessions = pool_1.db.find('sessions', (s) => (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
            s.status === 'ACTIVE');
        for (const session of activeSessions) {
            session.status = 'COMPLETED';
            session.endedAt = now;
            session.endMode = 'ADMINISTRATIVE';
            session.terminationReason = `Workstation transitioned to ${state}: ${reason || 'Administrative Action'}`;
            pool_1.db.insert('audit_logs', {
                id: (0, uuid_1.v4)(),
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
            const clientReg = pool_1.db.findOne('clients', (c) => c.clientId === unboundClientId);
            if (clientReg) {
                clientReg.isRegistered = false;
            }
        }
    }
    pc.state = state;
    pc.updatedAt = now;
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastWorkstationState(pc);
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
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
exports.updateComputerState = updateComputerState;
/**
 * POST /api/computers/:id/unbind
 * Unbind physical client node from workstation terminal.
 */
const unbindComputer = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const pc = pool_1.db.findOne('computers', (c) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
    if (!pc) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
    }
    const oldClientId = pc.clientId;
    const now = new Date().toISOString();
    // Close active session
    const activeSession = pool_1.db.findOne('sessions', (s) => (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
        s.status === 'ACTIVE');
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
        const client = pool_1.db.findOne('clients', (c) => c.clientId === oldClientId);
        if (client) {
            client.isRegistered = false;
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
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
exports.unbindComputer = unbindComputer;
/**
 * DELETE /api/computers/:id
 * Remove workstation with active session protection.
 */
const deleteComputer = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
    const { id } = req.params;
    const pc = pool_1.db.findOne('computers', (c) => c.id === id || c.pcCode.toUpperCase() === id.toUpperCase());
    if (!pc) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Workstation not found' });
    }
    // Active session dependency check
    const activeSession = pool_1.db.findOne('sessions', (s) => (s.computerId === pc.id || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
        s.status === 'ACTIVE');
    if (activeSession) {
        return res.status(400).json({
            success: false,
            error: 'CANNOT_DELETE_ACTIVE_SESSION',
            message: `Cannot delete workstation '${pc.pcCode}'. An active student session (${activeSession.studentIdentifier}) is currently in progress.`
        });
    }
    // Unlink associated peripherals
    const equipment = pool_1.db.getStore('equipment');
    for (const e of equipment) {
        if (e.computerId === pc.id) {
            e.computerId = undefined;
            e.updatedAt = new Date().toISOString();
        }
    }
    // Remove pc
    const pcs = pool_1.db.getStore('computers');
    const index = pcs.findIndex((c) => c.id === pc.id);
    if (index !== -1) {
        pcs.splice(index, 1);
    }
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
    if (sb) {
        try {
            await sb.from('computers').delete().eq('id', pc.id);
        }
        catch (e) {
            console.warn('[Computers Supabase] Delete error:', e.message);
        }
    }
    // Update lab pcCount
    if (pc.labCode) {
        const lab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === pc.labCode?.toUpperCase());
        if (lab) {
            lab.pcCount = pool_1.db.find('computers', (c) => c.labCode?.toUpperCase() === pc.labCode?.toUpperCase()).length;
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        action: 'COMPUTER_DELETED',
        userId: req.user?.id || 'SYSTEM',
        details: `Workstation ${pc.pcCode} removed from lab ${pc.labCode}`,
        timestamp: new Date().toISOString()
    });
    return res.json({ success: true, message: `Workstation ${pc.pcCode} successfully deleted`, deletedId: pc.id });
};
exports.deleteComputer = deleteComputer;
/**
 * POST /api/clients/register
 * Workstation node binding endpoint: Binds physical client (CLIENT_ID) to (LAB_ID, PC_ID).
 */
const registerClient = async (req, res) => {
    (0, exports.ensureLabsSeeded)();
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
    let lab = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === cleanLabCode);
    if (!lab) {
        lab = {
            id: (0, uuid_1.v4)(),
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
        pool_1.db.insert('labs', lab);
    }
    const now = new Date().toISOString();
    // Find or create workstation computer
    let computer = pool_1.db.findOne('computers', (c) => c.pcCode.toUpperCase() === cleanPcCode &&
        c.labCode?.toUpperCase() === cleanLabCode);
    if (!computer) {
        computer = {
            id: (0, uuid_1.v4)(),
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
        pool_1.db.insert('computers', computer);
        lab.pcCount = pool_1.db.find('computers', (c) => c.labCode?.toUpperCase() === cleanLabCode).length;
    }
    else {
        // Bind terminal
        computer.clientId = clientId;
        if (hostname)
            computer.hostname = hostname;
        if (ipAddress)
            computer.ipAddress = ipAddress;
        if (macAddress)
            computer.macAddress = macAddress;
        if (hardwareInfo)
            computer.hardwareInfo = hardwareInfo;
        computer.state = computer.state === 'UNREGISTERED' || computer.state === 'OFFLINE' ? 'AVAILABLE' : computer.state;
        computer.isOnline = true;
        computer.lastHeartbeat = now;
        computer.updatedAt = now;
    }
    // Upsert client registration
    let registration = pool_1.db.findOne('clients', (c) => c.clientId === clientId);
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
        pool_1.db.insert('clients', registration);
    }
    else {
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
    const sb = (0, supabaseSyncHelper_1.getSupabase)();
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
        }
        catch (err) {
            console.warn('[RegisterClient Supabase] Error syncing workstation registration:', err.message);
        }
    }
    // Audit log
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
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
exports.registerClient = registerClient;
/**
 * POST /api/clients/heartbeat
 * Periodic hardware telemetry and operational state synchronization.
 */
const heartbeat = async (req, res) => {
    const { clientId, labCode, pcCode, appVersion, state, hardwareStatus } = req.body;
    if (!clientId) {
        return res.status(400).json({ success: false, error: 'MISSING_CLIENT_ID' });
    }
    const now = new Date().toISOString();
    // Update client registration
    pool_1.db.update('clients', (c) => c.clientId === clientId, {
        lastHeartbeat: now,
        isOnline: true,
        appVersion: appVersion || '2.0.7'
    });
    let computerDirective = null;
    // Update bound computer
    let computer = pool_1.db.findOne('computers', (c) => (c.clientId === clientId) ||
        (pcCode && labCode && c.pcCode === pcCode.toUpperCase() && c.labCode === labCode.toUpperCase()));
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
exports.heartbeat = heartbeat;
const getEquipment = async (req, res) => {
    const labCode = req.query.labCode;
    let items = pool_1.db.getStore('equipment');
    if (labCode) {
        items = items.filter((e) => e.labId === labCode);
    }
    return res.json({ success: true, data: items });
};
exports.getEquipment = getEquipment;
const createEquipment = async (req, res) => {
    const { assetTag, type, brand, model, serialNumber, labId, computerId } = req.body;
    const item = {
        id: (0, uuid_1.v4)(),
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
    pool_1.db.insert('equipment', item);
    return res.status(201).json({ success: true, data: item });
};
exports.createEquipment = createEquipment;
