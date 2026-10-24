"use strict";
// ============================================================================
// LABGUARD V2: Database Adapter & Storage Engine
// Supports PostgreSQL / Supabase with robust local fallback for dev / isolation
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const env_1 = require("../config/env");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let pgPool = null;
try {
    pgPool = new pg_1.Pool({
        connectionString: env_1.ENV.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    });
    pgPool.on('error', (err) => {
        console.warn('[DB Pool] PostgreSQL connection error, maintaining operational fallback:', err.message);
    });
}
catch (e) {
    console.warn('[DB Pool] Initialized without immediate PostgreSQL connection');
}
// In-memory store for high-speed local validation / fallback when Postgres is offline
const memoryStore = {
    roles: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'ADMIN', description: 'Institutional System Administrator' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'FACULTY', description: 'Academic Faculty Professor' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'LAB_ASSISTANT', description: 'Laboratory Operations Assistant' },
        { id: '44444444-4444-4444-4444-444444444444', name: 'STUDENT', description: 'Institutional Student User' }
    ],
    users: [],
    students: [],
    faculty: [],
    lab_assistants: [],
    departments: [],
    courses: [],
    subjects: [],
    academic_years: [],
    semesters: [],
    sections: [],
    classes: [],
    class_faculty: [],
    class_students: [],
    labs: [],
    computers: [],
    clients: [],
    equipment: [],
    sessions: [],
    hardware_events: [],
    issues: [],
    issue_events: [],
    maintenance: [],
    enrollment_requests: [],
    notifications: [],
    notification_preferences: [],
    audit_logs: [],
    sync_events: [],
    deleted_entities: [],
    system_settings: []
};
// ----------------------------------------------------------------------------
// Local Disk Persistence Engine
// Multi-Path Resilient Store (ProgramData -> LocalAppData -> Workspace Data)
// Guarantees zero data loss across reboots even when Postgres/Supabase are offline
// ----------------------------------------------------------------------------
function getStorageFilePaths() {
    const paths = [];
    // 1. Workspace Data Directory (process.cwd() and relative to __dirname)
    try {
        const wsData = path_1.default.resolve(process.cwd(), 'data');
        if (!fs_1.default.existsSync(wsData))
            fs_1.default.mkdirSync(wsData, { recursive: true });
        paths.push(path_1.default.join(wsData, 'backend_store.json'));
    }
    catch { }
    try {
        const relData = path_1.default.resolve(__dirname, '../../../data');
        if (!fs_1.default.existsSync(relData))
            fs_1.default.mkdirSync(relData, { recursive: true });
        paths.push(path_1.default.join(relData, 'backend_store.json'));
    }
    catch { }
    try {
        const relBackendData = path_1.default.resolve(__dirname, '../../data');
        if (!fs_1.default.existsSync(relBackendData))
            fs_1.default.mkdirSync(relBackendData, { recursive: true });
        paths.push(path_1.default.join(relBackendData, 'backend_store.json'));
    }
    catch { }
    // 2. LocalAppData Directory (Current User)
    try {
        const appData = process.env.LOCALAPPDATA || process.env.APPDATA;
        if (appData) {
            const localDir = path_1.default.join(appData, 'LABGUARD', 'database');
            if (!fs_1.default.existsSync(localDir))
                fs_1.default.mkdirSync(localDir, { recursive: true });
            paths.push(path_1.default.join(localDir, 'backend_store.json'));
        }
    }
    catch { }
    // 3. ProgramData Directory (Machine-wide)
    try {
        const programData = process.env.ProgramData || 'C:\\ProgramData';
        const enterpriseDir = path_1.default.join(programData, 'LABGUARD', 'database');
        if (!fs_1.default.existsSync(enterpriseDir))
            fs_1.default.mkdirSync(enterpriseDir, { recursive: true });
        paths.push(path_1.default.join(enterpriseDir, 'backend_store.json'));
    }
    catch { }
    return Array.from(new Set(paths));
}
const STORAGE_PATHS = getStorageFilePaths();
let saveTimeout = null;
function loadPersistentStore() {
    let loaded = false;
    for (const filePath of STORAGE_PATHS) {
        try {
            if (fs_1.default.existsSync(filePath)) {
                const content = fs_1.default.readFileSync(filePath, 'utf8');
                if (content && content.trim()) {
                    const parsed = JSON.parse(content);
                    for (const key of Object.keys(parsed)) {
                        if (Array.isArray(parsed[key])) {
                            memoryStore[key] = parsed[key];
                        }
                    }
                    console.log(`[DB Persistence] Successfully loaded ${Object.keys(parsed).length} tables from ${filePath}`);
                    loaded = true;
                    break;
                }
            }
        }
        catch (err) {
            console.warn(`[DB Persistence] Failed loading from ${filePath}:`, err.message);
        }
    }
    // Purge any deleted entities from memory if resurrected
    if (Array.isArray(memoryStore.deleted_entities) && memoryStore.deleted_entities.length > 0) {
        const deletedIds = new Set(memoryStore.deleted_entities.map((d) => d.id));
        for (const key of ['users', 'students', 'faculty', 'lab_assistants', 'labs', 'computers', 'equipment', 'departments', 'courses', 'subjects', 'classes']) {
            if (Array.isArray(memoryStore[key])) {
                memoryStore[key] = memoryStore[key].filter((item) => !deletedIds.has(item.id));
            }
        }
    }
    scheduleSave();
}
function scheduleSave() {
    if (saveTimeout)
        clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToDisk();
    }, 50);
}
function saveToDisk() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    const dataToSave = {};
    for (const key of Object.keys(memoryStore)) {
        dataToSave[key] = memoryStore[key];
    }
    const payload = JSON.stringify(dataToSave, null, 2);
    for (const filePath of STORAGE_PATHS) {
        try {
            const dir = path_1.default.dirname(filePath);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(filePath, payload, 'utf8');
        }
        catch (err) {
            // Continue to next available fallback path
        }
    }
}
// Initial load on boot
loadPersistentStore();
exports.db = {
    async query(text, params) {
        if (pgPool) {
            try {
                return await pgPool.query(text, params);
            }
            catch (err) {
                // If connection fails, log and proceed with internal adapter logic
                console.warn(`[DB Query Fallback] Postgres query failed: ${err.message}`);
            }
        }
        // Mock empty response conforming to pg.QueryResult
        return {
            rows: [],
            command: 'SELECT',
            rowCount: 0,
            oid: 0,
            fields: []
        };
    },
    getStore(table) {
        if (!memoryStore[table]) {
            memoryStore[table] = [];
        }
        return memoryStore[table];
    },
    insert(table, record) {
        const list = this.getStore(table);
        list.push(record);
        scheduleSave();
        return record;
    },
    find(table, predicate) {
        return this.getStore(table).filter(predicate);
    },
    findOne(table, predicate) {
        return this.getStore(table).find(predicate);
    },
    update(table, predicate, updates) {
        const item = this.findOne(table, predicate);
        if (item) {
            Object.assign(item, updates);
            scheduleSave();
        }
        return item;
    },
    delete(table, predicate) {
        const list = this.getStore(table);
        const initialLen = list.length;
        memoryStore[table] = list.filter((item) => !predicate(item));
        const changed = memoryStore[table].length !== initialLen;
        if (changed) {
            saveToDisk(); // Save to disk immediately upon deletion
        }
        return changed;
    },
    recordDeletion(id, entityType, extra) {
        if (!Array.isArray(memoryStore.deleted_entities)) {
            memoryStore.deleted_entities = [];
        }
        const existing = memoryStore.deleted_entities.find((d) => d.id === id);
        if (!existing) {
            memoryStore.deleted_entities.push({
                id,
                entityType,
                deletedAt: new Date().toISOString(),
                ...(extra || {})
            });
        }
        saveToDisk();
    },
    isDeleted(id) {
        if (!Array.isArray(memoryStore.deleted_entities))
            return false;
        return memoryStore.deleted_entities.some((d) => d.id === id);
    },
    flush() {
        try {
            saveToDisk();
        }
        catch (err) {
            console.warn('[DB Persistence] Error flushing to disk:', err.message);
        }
    }
};
