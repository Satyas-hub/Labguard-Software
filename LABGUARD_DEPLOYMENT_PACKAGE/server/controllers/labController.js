"use strict";
// ============================================================================
// LABGUARD V2: Laboratory, Computer & Equipment Management Controller
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEquipment = exports.getEquipment = exports.heartbeat = exports.registerClient = exports.createComputer = exports.getComputers = exports.createLab = exports.getLabs = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const getLabs = async (req, res) => {
    const user = req.user;
    let labs = pool_1.db.getStore('labs');
    // Scoping: Faculty and Lab Assistant only see assigned labs
    if (user.role === 'FACULTY' || user.role === 'LAB_ASSISTANT') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            labs = labs.filter((l) => user.assignedLabs.includes(l.id) || user.assignedLabs.includes(l.code));
        }
    }
    return res.json({ success: true, data: labs });
};
exports.getLabs = getLabs;
const createLab = async (req, res) => {
    const { code, name, room, building, capacity } = req.body;
    if (!code || !name || !room) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab Code, Name and Room required' });
    }
    const existing = pool_1.db.findOne('labs', (l) => l.code.toUpperCase() === code.toUpperCase());
    if (existing) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_LAB', message: 'Lab code already exists' });
    }
    const lab = {
        id: (0, uuid_1.v4)(),
        code: code.toUpperCase(),
        name,
        room,
        building: building || 'Main Science Building',
        capacity: capacity || 30,
        status: 'ACTIVE',
        pcCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pool_1.db.insert('labs', lab);
    return res.status(201).json({ success: true, data: lab });
};
exports.createLab = createLab;
const getComputers = async (req, res) => {
    const labCode = req.query.labCode;
    let pcs = pool_1.db.getStore('computers');
    if (labCode) {
        pcs = pcs.filter((c) => c.labCode === labCode);
    }
    return res.json({ success: true, data: pcs });
};
exports.getComputers = getComputers;
const createComputer = async (req, res) => {
    const { labId, labCode, pcCode, hostname, ipAddress } = req.body;
    if (!labCode || !pcCode) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab code and PC code required' });
    }
    const newPc = {
        id: (0, uuid_1.v4)(),
        labId: labId || (0, uuid_1.v4)(),
        labCode: labCode.toUpperCase(),
        pcCode: pcCode.toUpperCase(),
        hostname: hostname || `${labCode}-${pcCode}`,
        ipAddress,
        state: 'AVAILABLE',
        isOnline: true,
        lastHeartbeat: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pool_1.db.insert('computers', newPc);
    // Update lab pc count
    pool_1.db.update('labs', (l) => l.code === labCode, {
        pcCount: pool_1.db.find('computers', (c) => c.labCode === labCode).length
    });
    return res.status(201).json({ success: true, data: newPc });
};
exports.createComputer = createComputer;
const registerClient = async (req, res) => {
    const { clientId, labCode, pcCode, appVersion } = req.body;
    if (!clientId || !labCode || !pcCode) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Client ID, Lab Code, PC Code required' });
    }
    let registration = pool_1.db.findOne('clients', (c) => c.clientId === clientId);
    if (!registration) {
        registration = {
            clientId,
            labCode: labCode.toUpperCase(),
            pcCode: pcCode.toUpperCase(),
            appVersion: appVersion || '2.0.0',
            isRegistered: true,
            isOnline: true,
            lastHeartbeat: new Date().toISOString()
        };
        pool_1.db.insert('clients', registration);
    }
    else {
        registration.lastHeartbeat = new Date().toISOString();
        registration.isOnline = true;
    }
    return res.json({ success: true, data: registration });
};
exports.registerClient = registerClient;
const heartbeat = async (req, res) => {
    const { clientId, labCode, pcCode, appVersion, state } = req.body;
    if (!clientId) {
        return res.status(400).json({ success: false, error: 'MISSING_CLIENT_ID' });
    }
    const now = new Date().toISOString();
    pool_1.db.update('clients', (c) => c.clientId === clientId, {
        lastHeartbeat: now,
        isOnline: true,
        appVersion: appVersion || '2.0.0'
    });
    if (pcCode && labCode) {
        pool_1.db.update('computers', (c) => c.pcCode === pcCode && c.labCode === labCode, {
            lastHeartbeat: now,
            isOnline: true,
            state: state || 'AVAILABLE'
        });
    }
    return res.json({ success: true, serverTime: now });
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
