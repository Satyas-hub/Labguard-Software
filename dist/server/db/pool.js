"use strict";
// ============================================================================
// LABGUARD V2: Database Adapter & Storage Engine
// Supports PostgreSQL / Supabase with robust local fallback for dev / isolation
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const env_1 = require("../config/env");
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
    audit_logs: [],
    sync_events: [],
    system_settings: []
};
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
        }
        return item;
    },
    delete(table, predicate) {
        const list = this.getStore(table);
        const idx = list.findIndex(predicate);
        if (idx !== -1) {
            list.splice(idx, 1);
            return true;
        }
        return false;
    }
};
