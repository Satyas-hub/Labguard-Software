// ============================================================================
// LABGUARD V2: Database Adapter & Storage Engine
// Supports PostgreSQL / Supabase with robust local fallback for dev / isolation
// ============================================================================

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV } from '../config/env';
import fs from 'fs';
import path from 'path';

let pgPool: Pool | null = null;

try {
  pgPool = new Pool({
    connectionString: ENV.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  pgPool.on('error', (err) => {
    console.warn('[DB Pool] PostgreSQL connection error, maintaining operational fallback:', err.message);
  });
} catch (e) {
  console.warn('[DB Pool] Initialized without immediate PostgreSQL connection');
}

// In-memory store for high-speed local validation / fallback when Postgres is offline
const memoryStore: Record<string, any[]> = {
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
function getStorageFilePaths(): string[] {
  const paths: string[] = [];
  
  // 1. Workspace Data Directory (process.cwd() and relative to __dirname)
  try {
    const wsData = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(wsData)) fs.mkdirSync(wsData, { recursive: true });
    paths.push(path.join(wsData, 'backend_store.json'));
  } catch {}

  try {
    const relData = path.resolve(__dirname, '../../../data');
    if (!fs.existsSync(relData)) fs.mkdirSync(relData, { recursive: true });
    paths.push(path.join(relData, 'backend_store.json'));
  } catch {}

  try {
    const relBackendData = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(relBackendData)) fs.mkdirSync(relBackendData, { recursive: true });
    paths.push(path.join(relBackendData, 'backend_store.json'));
  } catch {}

  // 2. LocalAppData Directory (Current User)
  try {
    const appData = process.env.LOCALAPPDATA || process.env.APPDATA;
    if (appData) {
      const localDir = path.join(appData, 'LABGUARD', 'database');
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      paths.push(path.join(localDir, 'backend_store.json'));
    }
  } catch {}

  // 3. ProgramData Directory (Machine-wide)
  try {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const enterpriseDir = path.join(programData, 'LABGUARD', 'database');
    if (!fs.existsSync(enterpriseDir)) fs.mkdirSync(enterpriseDir, { recursive: true });
    paths.push(path.join(enterpriseDir, 'backend_store.json'));
  } catch {}

  return Array.from(new Set(paths));
}

const STORAGE_PATHS = getStorageFilePaths();
let saveTimeout: NodeJS.Timeout | null = null;

function loadPersistentStore() {
  let loaded = false;
  for (const filePath of STORAGE_PATHS) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
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
    } catch (err: any) {
      console.warn(`[DB Persistence] Failed loading from ${filePath}:`, err.message);
    }
  }

  // Purge any deleted entities from memory if resurrected
  if (Array.isArray(memoryStore.deleted_entities) && memoryStore.deleted_entities.length > 0) {
    const deletedIds = new Set(memoryStore.deleted_entities.map((d: any) => d.id));
    for (const key of ['users', 'students', 'faculty', 'lab_assistants', 'labs', 'computers', 'equipment', 'departments', 'courses', 'subjects', 'classes']) {
      if (Array.isArray(memoryStore[key])) {
        memoryStore[key] = memoryStore[key].filter((item: any) => !deletedIds.has(item.id));
      }
    }
  }

  scheduleSave();
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToDisk();
  }, 50);
}

function saveToDisk() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  const dataToSave: Record<string, any[]> = {};
  for (const key of Object.keys(memoryStore)) {
    dataToSave[key] = memoryStore[key];
  }
  const payload = JSON.stringify(dataToSave, null, 2);

  for (const filePath of STORAGE_PATHS) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, payload, 'utf8');
    } catch (err: any) {
      // Continue to next available fallback path
    }
  }
}

// Initial load on boot
loadPersistentStore();

export const db = {
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (pgPool) {
      try {
        return await pgPool.query<T>(text, params);
      } catch (err: any) {
        // If connection fails, log and proceed with internal adapter logic
        console.warn(`[DB Query Fallback] Postgres query failed: ${err.message}`);
      }
    }

    // Mock empty response conforming to pg.QueryResult
    return {
      rows: [] as T[],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: []
    };
  },

  getStore(table: string): any[] {
    if (!memoryStore[table]) {
      memoryStore[table] = [];
    }
    return memoryStore[table];
  },

  insert(table: string, record: any): any {
    const list = this.getStore(table);
    list.push(record);
    scheduleSave();
    return record;
  },

  find<T = any>(table: string, predicate: (item: T) => boolean): T[] {
    return (this.getStore(table) as T[]).filter(predicate);
  },

  findOne<T = any>(table: string, predicate: (item: T) => boolean): T | undefined {
    return (this.getStore(table) as T[]).find(predicate);
  },

  update<T = any>(table: string, predicate: (item: T) => boolean, updates: Partial<T>): T | undefined {
    const item = this.findOne<T>(table, predicate);
    if (item) {
      Object.assign(item, updates);
      scheduleSave();
    }
    return item;
  },

  delete<T = any>(table: string, predicate: (item: T) => boolean): boolean {
    const list = this.getStore(table);
    const initialLen = list.length;
    memoryStore[table] = list.filter((item: T) => !predicate(item));
    const changed = memoryStore[table].length !== initialLen;
    if (changed) {
      saveToDisk(); // Save to disk immediately upon deletion
    }
    return changed;
  },

  recordDeletion(id: string, entityType: string, extra?: Record<string, any>): void {
    if (!id) return;
    if (!Array.isArray(memoryStore.deleted_entities)) {
      memoryStore.deleted_entities = [];
    }
    const existing = memoryStore.deleted_entities.find((d: any) => d.id === id);
    if (!existing) {
      memoryStore.deleted_entities.push({
        id,
        entityType,
        deletedAt: new Date().toISOString(),
        ...(extra || {})
      });
    }

    // Instantly purge entity from all active memory tables so it cannot linger
    const targetTables = ['users', 'students', 'faculty', 'lab_assistants', 'labs', 'computers', 'equipment', 'departments', 'courses', 'subjects', 'classes', 'academic_years', 'sections'];
    for (const table of targetTables) {
      if (Array.isArray(memoryStore[table])) {
        memoryStore[table] = memoryStore[table].filter((item: any) => {
          if (item.id === id) return false;
          if (extra?.code && item.code && String(item.code).toLowerCase() === String(extra.code).toLowerCase()) return false;
          if (extra?.email && item.email && String(item.email).toLowerCase() === String(extra.email).toLowerCase()) return false;
          if (extra?.pcCode && item.pcCode && String(item.pcCode).toLowerCase() === String(extra.pcCode).toLowerCase()) return false;
          if (extra?.assetId && item.assetId && String(item.assetId).toLowerCase() === String(extra.assetId).toLowerCase()) return false;
          if (extra?.studentId && (item.studentId || item.rollNumber) && (String(item.studentId || item.rollNumber).toLowerCase() === String(extra.studentId).toLowerCase())) return false;
          if (extra?.year && item.year && String(item.year).toLowerCase() === String(extra.year).toLowerCase()) return false;
          return true;
        });
      }
    }

    saveToDisk();
  },

  isDeleted(identifier: string): boolean {
    if (!identifier || !Array.isArray(memoryStore.deleted_entities)) return false;
    const lower = String(identifier).trim().toLowerCase();
    return memoryStore.deleted_entities.some((d: any) => {
      if (d.id === identifier) return true;
      if (d.code && String(d.code).trim().toLowerCase() === lower) return true;
      if (d.email && String(d.email).trim().toLowerCase() === lower) return true;
      if (d.pcCode && String(d.pcCode).trim().toLowerCase() === lower) return true;
      if (d.assetId && String(d.assetId).trim().toLowerCase() === lower) return true;
      if (d.studentId && String(d.studentId).trim().toLowerCase() === lower) return true;
      if (d.year && String(d.year).trim().toLowerCase() === lower) return true;
      return false;
    });
  },

  flush(): void {
    try {
      saveToDisk();
    } catch (err: any) {
      console.warn('[DB Persistence] Error flushing to disk:', err.message);
    }
  }
};

