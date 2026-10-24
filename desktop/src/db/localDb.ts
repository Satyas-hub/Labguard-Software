// ============================================================================
// LABGUARD V2: Typed Local SQLite Service Layer (Phase 19: Offline-First)
// Manages the 14 local enterprise SQLite vaults under ProgramData/LABGUARD/database/labguard.db
// Supports native Rust Tauri IPC + High-Fidelity Fallback Store for Headless Testing
// ============================================================================

import { User, UserRole, Session, HardwareEvent, Issue, Equipment, Lab, Computer } from '../../../shared/types';

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;
async function getInvoke(): Promise<((cmd: string, args?: any) => Promise<any>) | null> {
  if (tauriInvoke) return tauriInvoke;
  try {
    const mod = await import('@tauri-apps/api/core');
    tauriInvoke = mod.invoke;
    return tauriInvoke;
  } catch {
    return null;
  }
}

export interface LocalUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  identifier?: string;
  password_hash?: string;
  offline_token?: string;
  is_active: number;
}

export interface LocalAuthorization {
  id: string;
  user_id: string;
  lab_code: string;
  class_id?: string;
  valid_until?: string;
  created_at: string;
}

export interface LocalSession {
  id: string;
  student_id: string;
  student_identifier?: string;
  student_name?: string;
  lab_code: string;
  pc_code: string;
  client_id: string;
  started_at: string;
  ended_at?: string;
  status: string;
  end_mode?: string;
  notes?: string;
  sync_status: string;
}

export interface LocalHardwareEvent {
  id: string;
  client_id?: string;
  lab_code: string;
  pc_code: string;
  event_type: string;
  description: string;
  severity: string;
  timestamp: string;
  sync_status: string;
}

export interface LocalIssue {
  id: string;
  lab_code: string;
  pc_code: string;
  reported_by?: string;
  issue_type: string;
  description: string;
  status: string;
  created_at: string;
  sync_status: string;
}

export interface LocalMaintenance {
  id: string;
  issue_id?: string;
  lab_code: string;
  pc_code: string;
  responsible_user?: string;
  action_taken?: string;
  status: string;
  start_time?: string;
  end_time?: string;
  sync_status: string;
}

export interface LocalAuditLog {
  id: string;
  actor_user_id?: string;
  actor_name?: string;
  role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  timestamp: string;
  sync_status: string;
}

export interface LocalSyncQueueItem {
  id: string;
  batch_id?: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  status: string;
  attempt_count: number;
  created_at: string;
}

export interface LocalSyncConflict {
  id: string;
  batch_id?: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  client_payload?: string;
  server_payload?: string;
  status: string;
  created_at: string;
}

export interface LocalLabRecord {
  id: string;
  code: string;
  name: string;
  room: string;
  capacity: number;
  status: string;
}

export interface LocalComputerRecord {
  id: string;
  lab_code: string;
  pc_code: string;
  state: string;
  client_id?: string;
}

export interface LocalEquipmentRecord {
  id: string;
  asset_tag: string;
  type: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status: string;
  lab_code?: string;
  pc_code?: string;
}

// ============================================================================
// Cryptographic Password Hashing (Universal Browser / Node)
// ============================================================================
export async function hashOfflinePassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}:labguard_offline_salt`);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node.js fallback
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    // Basic fallback hash
    let h = 0;
    const str = `${salt}:${password}`;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return `fallback_${Math.abs(h).toString(16)}`;
  }
}

// ============================================================================
// In-Memory Relational Fallback Store (Enhanced with Persistent Local Vault)
// ============================================================================
class MemorySqliteStore {
  public configuration: Map<string, string> = new Map();
  public users: Map<string, LocalUser> = new Map();
  public authorizations: Map<string, LocalAuthorization> = new Map();
  public labs: Map<string, LocalLabRecord> = new Map();
  public computers: Map<string, LocalComputerRecord> = new Map();
  public equipment: Map<string, LocalEquipmentRecord> = new Map();
  public sessions: Map<string, LocalSession> = new Map();
  public hardwareEvents: Map<string, LocalHardwareEvent> = new Map();
  public issues: Map<string, LocalIssue> = new Map();
  public maintenance: Map<string, LocalMaintenance> = new Map();
  public notifications: Map<string, any> = new Map();
  public auditLogs: Map<string, LocalAuditLog> = new Map();
  public syncQueue: Map<string, LocalSyncQueueItem> = new Map();
  public syncConflicts: Map<string, any> = new Map();
  public deletedEntityIds: Set<string> = new Set();

  private saveTimer: any = null;

  constructor() {
    this.hydrateFromStorage();
    this.ensureDefaultSeeds();
  }

  public schedulePersist() {
    if (typeof window === 'undefined') return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.persistToStorage();
    }, 100);
  }

  public persistToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const data = {
        configuration: Array.from(this.configuration.entries()),
        users: Array.from(this.users.entries()),
        authorizations: Array.from(this.authorizations.entries()),
        labs: Array.from(this.labs.entries()),
        computers: Array.from(this.computers.entries()),
        equipment: Array.from(this.equipment.entries()),
        sessions: Array.from(this.sessions.entries()),
        hardwareEvents: Array.from(this.hardwareEvents.entries()),
        issues: Array.from(this.issues.entries()),
        maintenance: Array.from(this.maintenance.entries()),
        notifications: Array.from(this.notifications.entries()),
        auditLogs: Array.from(this.auditLogs.entries()),
        syncQueue: Array.from(this.syncQueue.entries()),
        syncConflicts: Array.from(this.syncConflicts.entries()),
        deletedEntityIds: Array.from(this.deletedEntityIds)
      };
      localStorage.setItem('LABGUARD_LOCAL_VAULT_STORE_V3', JSON.stringify(data));
    } catch (e) {
      console.warn('[LocalDb] Failed to persist local vault to localStorage:', e);
    }
  }

  public hydrateFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem('LABGUARD_LOCAL_VAULT_STORE_V3') || localStorage.getItem('LABGUARD_LOCAL_VAULT_STORE');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.configuration) this.configuration = new Map(data.configuration);
        if (data.users) this.users = new Map(data.users);
        if (data.authorizations) this.authorizations = new Map(data.authorizations);
        if (data.labs) this.labs = new Map(data.labs);
        if (data.computers) this.computers = new Map(data.computers);
        if (data.equipment) this.equipment = new Map(data.equipment);
        if (data.sessions) this.sessions = new Map(data.sessions);
        if (data.hardwareEvents) this.hardwareEvents = new Map(data.hardwareEvents);
        if (data.issues) this.issues = new Map(data.issues);
        if (data.maintenance) this.maintenance = new Map(data.maintenance);
        if (data.notifications) this.notifications = new Map(data.notifications);
        if (data.auditLogs) this.auditLogs = new Map(data.auditLogs);
        if (data.syncQueue) this.syncQueue = new Map(data.syncQueue);
        if (data.syncConflicts) this.syncConflicts = new Map(data.syncConflicts);
        if (data.deletedEntityIds && Array.isArray(data.deletedEntityIds)) {
          this.deletedEntityIds = new Set(data.deletedEntityIds);
        }
      }

      // Purge any resurrected deleted entities
      if (this.deletedEntityIds.size > 0) {
        for (const [id] of this.users.entries()) {
          if (this.deletedEntityIds.has(id)) this.users.delete(id);
        }
        for (const [id] of this.labs.entries()) {
          if (this.deletedEntityIds.has(id)) this.labs.delete(id);
        }
        for (const [id] of this.computers.entries()) {
          if (this.deletedEntityIds.has(id)) this.computers.delete(id);
        }
        for (const [id] of this.equipment.entries()) {
          if (this.deletedEntityIds.has(id)) this.equipment.delete(id);
        }
      }
    } catch (e) {
      console.warn('[LocalDb] Failed to hydrate local vault from localStorage:', e);
    }
  }

  public ensureDefaultSeeds() {
    // Zero demo data policy. Only genuine root admin and synchronized records are retained.
    this.schedulePersist();
  }

  public clear() {
    this.configuration.clear();
    this.users.clear();
    this.authorizations.clear();
    this.labs.clear();
    this.computers.clear();
    this.equipment.clear();
    this.sessions.clear();
    this.hardwareEvents.clear();
    this.issues.clear();
    this.maintenance.clear();
    this.notifications.clear();
    this.auditLogs.clear();
    this.syncQueue.clear();
    this.syncConflicts.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('LABGUARD_LOCAL_VAULT_STORE_V3');
      localStorage.removeItem('LABGUARD_LOCAL_VAULT_STORE');
    }
  }
}

const memoryStore = new MemorySqliteStore();
let isTauriAvailable = typeof window !== 'undefined' && (Boolean((window as any).__TAURI_INTERNALS__) || Boolean((window as any).__TAURI__));

// Simple UUID generator for offline entities
function generateOfflineId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'offline-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

// Decode offline token payload safely without external dependencies
function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    let jsonStr: string;
    if (typeof atob !== 'undefined') {
      jsonStr = atob(base64);
    } else {
      jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ============================================================================
// Typed Local Database Service
// ============================================================================
export const LocalDbService = {
  /**
   * Initializes all 14 schema vaults in SQLite
   */
  async init(): Promise<string> {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        return await invokeFn('init_local_database');
      }
    } catch (e: any) {
      isTauriAvailable = false;
    }
    return 'SQLite fallback active (All 14 vaults ready)';
  },

  /**
   * Raw SELECT query returning typed JSON records
   */
  async query<T = any>(sql: string): Promise<T[]> {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        const jsonStr = await invokeFn('query_local_db', { sql });
        return JSON.parse(jsonStr) as T[];
      }
    } catch (e: any) {
      isTauriAvailable = false;
    }

    // High-fidelity fallback parser for essential tables
    const s = sql.trim();
    if (s.includes('FROM local_users')) {
      return Array.from(memoryStore.users.values()) as any;
    }
    if (s.includes('FROM local_sessions')) {
      let sessions = Array.from(memoryStore.sessions.values());
      if (s.includes("status = 'ACTIVE'")) {
        sessions = sessions.filter((x) => x.status === 'ACTIVE');
      }
      return sessions as any;
    }
    if (s.includes('FROM local_computers')) {
      let comps = Array.from(memoryStore.computers.values());
      const m = s.match(/WHERE UPPER\(lab_code\) = '([^']+)'/i);
      if (m) {
        comps = comps.filter((c) => (c.lab_code || '').toUpperCase() === m[1].toUpperCase());
      }
      return comps as any;
    }
    if (s.includes('FROM local_equipment')) {
      return Array.from(memoryStore.equipment.values()) as any;
    }
    if (s.includes('FROM local_labs')) {
      return Array.from(memoryStore.labs.values()) as any;
    }
    if (s.includes('FROM local_issues')) {
      return Array.from(memoryStore.issues.values()) as any;
    }
    if (s.includes('FROM local_hardware_events')) {
      return Array.from(memoryStore.hardwareEvents.values()) as any;
    }
    if (s.includes('FROM local_maintenance')) {
      return Array.from(memoryStore.maintenance.values()) as any;
    }
    if (s.includes('FROM local_audit_logs')) {
      return Array.from(memoryStore.auditLogs.values()) as any;
    }
    if (s.includes('FROM sync_queue')) {
      return Array.from(memoryStore.syncQueue.values()) as any;
    }
    return [];
  },

  /**
   * Execute non-query statements (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string): Promise<number> {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        await invokeFn('execute_local_db', { sql });
      }
    } catch (e: any) {
      isTauriAvailable = false;
    }

    const s = sql.trim();
    const upper = s.toUpperCase();

    if (upper.includes('UPDATE LOCAL_USERS SET IS_ACTIVE = 0')) {
      for (const u of memoryStore.users.values()) {
        if (s.includes(u.email) || (u.identifier && s.includes(u.identifier)) || s.includes(u.id)) {
          u.is_active = 0;
        }
      }
    } else if (upper.includes('UPDATE LOCAL_USERS SET IS_ACTIVE = 1')) {
      for (const u of memoryStore.users.values()) {
        if (s.includes(u.email) || (u.identifier && s.includes(u.identifier)) || s.includes(u.id)) {
          u.is_active = 1;
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_USERS')) {
      if (!upper.includes('WHERE')) {
        memoryStore.users.clear();
      } else {
        for (const [key, u] of Array.from(memoryStore.users.entries())) {
          if (s.includes(u.id) || (u.email && s.toLowerCase().includes(u.email.toLowerCase()))) {
            memoryStore.users.delete(key);
            memoryStore.deletedEntityIds.add(u.id);
          }
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_LABS')) {
      if (!upper.includes('WHERE')) {
        memoryStore.labs.clear();
      } else {
        for (const [key, lab] of Array.from(memoryStore.labs.entries())) {
          if (s.includes(lab.id) || (lab.code && upper.includes(lab.code.toUpperCase()))) {
            memoryStore.labs.delete(key);
            memoryStore.deletedEntityIds.add(lab.id);
          }
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_COMPUTERS')) {
      if (!upper.includes('WHERE')) {
        memoryStore.computers.clear();
      } else {
        for (const [key, comp] of Array.from(memoryStore.computers.entries())) {
          if (s.includes(comp.id) || (comp.pc_code && upper.includes(comp.pc_code.toUpperCase()))) {
            memoryStore.computers.delete(key);
            memoryStore.deletedEntityIds.add(comp.id);
          }
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_EQUIPMENT')) {
      if (!upper.includes('WHERE')) {
        memoryStore.equipment.clear();
      } else {
        for (const [key, eq] of Array.from(memoryStore.equipment.entries())) {
          if (s.includes(eq.id) || (eq.asset_tag && upper.includes(eq.asset_tag.toUpperCase()))) {
            memoryStore.equipment.delete(key);
            memoryStore.deletedEntityIds.add(eq.id);
          }
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_SESSIONS')) {
      if (!upper.includes('WHERE')) {
        memoryStore.sessions.clear();
      } else {
        for (const [key, sess] of Array.from(memoryStore.sessions.entries())) {
          if (s.includes(sess.id)) memoryStore.sessions.delete(key);
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_ISSUES')) {
      if (!upper.includes('WHERE')) {
        memoryStore.issues.clear();
      } else {
        for (const [key, iss] of Array.from(memoryStore.issues.entries())) {
          if (s.includes(iss.id)) memoryStore.issues.delete(key);
        }
      }
    } else if (upper.includes('DELETE FROM LOCAL_AUTHORIZATIONS')) {
      if (!upper.includes('WHERE')) {
        memoryStore.authorizations.clear();
      } else {
        for (const [key, auth] of Array.from(memoryStore.authorizations.entries())) {
          if (s.includes(auth.user_id) || s.includes(auth.id)) memoryStore.authorizations.delete(key);
        }
      }
    }

    memoryStore.schedulePersist();
    return 1;
  },

  /**
   * Permanently delete a user from local SQLite and in-memory vault
   */
  async deleteUser(id: string, email?: string): Promise<void> {
    memoryStore.users.delete(id);
    for (const [key, u] of Array.from(memoryStore.users.entries())) {
      if (u.id === id || (email && u.email.toLowerCase() === email.toLowerCase())) {
        memoryStore.users.delete(key);
      }
    }
    for (const [key, auth] of Array.from(memoryStore.authorizations.entries())) {
      if (auth.user_id === id) {
        memoryStore.authorizations.delete(key);
      }
    }
    memoryStore.deletedEntityIds.add(id);
    memoryStore.schedulePersist();

    const cleanId = id.replace(/'/g, "''");
    const cleanEmail = (email || '').replace(/'/g, "''");
    let sql = `DELETE FROM local_users WHERE id = '${cleanId}'`;
    if (cleanEmail) {
      sql += ` OR LOWER(email) = '${cleanEmail.toLowerCase()}'`;
    }
    sql += ';';
    await this.execute(sql);
    await this.execute(`DELETE FROM local_authorizations WHERE user_id = '${cleanId}';`);
  },

  /**
   * Permanently delete a laboratory from local SQLite and in-memory vault
   */
  async deleteLab(id: string, code?: string): Promise<void> {
    memoryStore.labs.delete(id);
    const labUpper = (code || '').toUpperCase();
    for (const [key, l] of Array.from(memoryStore.labs.entries())) {
      if (l.id === id || (labUpper && l.code.toUpperCase() === labUpper)) {
        memoryStore.labs.delete(key);
      }
    }
    // Cascade remove computers and equipment
    if (labUpper) {
      for (const [key, c] of Array.from(memoryStore.computers.entries())) {
        if ((c.lab_code || '').toUpperCase() === labUpper) {
          memoryStore.computers.delete(key);
        }
      }
      for (const [key, eq] of Array.from(memoryStore.equipment.entries())) {
        if ((eq.lab_code || '').toUpperCase() === labUpper) {
          memoryStore.equipment.delete(key);
        }
      }
    }
    memoryStore.deletedEntityIds.add(id);
    memoryStore.schedulePersist();

    const cleanId = id.replace(/'/g, "''");
    const cleanCode = (code || '').replace(/'/g, "''");
    await this.execute(`DELETE FROM local_labs WHERE id = '${cleanId}' OR UPPER(code) = '${cleanCode.toUpperCase()}';`);
    if (cleanCode) {
      await this.execute(`DELETE FROM local_computers WHERE UPPER(lab_code) = '${cleanCode.toUpperCase()}';`);
      await this.execute(`DELETE FROM local_equipment WHERE UPPER(lab_code) = '${cleanCode.toUpperCase()}';`);
    }
  },

  /**
   * Permanently delete a workstation from local SQLite and in-memory vault
   */
  async deleteComputer(id: string, pcCode?: string, labCode?: string): Promise<void> {
    memoryStore.computers.delete(id);
    const pcUpper = (pcCode || '').toUpperCase();
    const labUpper = (labCode || '').toUpperCase();
    for (const [key, c] of Array.from(memoryStore.computers.entries())) {
      if (c.id === id || (pcUpper && (c.pc_code || '').toUpperCase() === pcUpper && (!labUpper || (c.lab_code || '').toUpperCase() === labUpper))) {
        memoryStore.computers.delete(key);
      }
    }
    memoryStore.deletedEntityIds.add(id);
    memoryStore.schedulePersist();

    const cleanId = id.replace(/'/g, "''");
    let sql = `DELETE FROM local_computers WHERE id = '${cleanId}'`;
    if (pcCode) {
      sql += ` OR (UPPER(pc_code) = '${pcUpper}'`;
      if (labCode) sql += ` AND UPPER(lab_code) = '${labUpper}'`;
      sql += ')';
    }
    sql += ';';
    await this.execute(sql);
  },

  /**
   * Permanently delete equipment from local SQLite and in-memory vault
   */
  async deleteEquipment(id: string): Promise<void> {
    memoryStore.equipment.delete(id);
    memoryStore.deletedEntityIds.add(id);
    memoryStore.schedulePersist();

    const cleanId = id.replace(/'/g, "''");
    await this.execute(`DELETE FROM local_equipment WHERE id = '${cleanId}';`);
  },

  /**
   * Purges all mock / demo data while preserving authentic administrator anchor
   */
  async purgeLocalDemoData(): Promise<void> {
    for (const [key, u] of Array.from(memoryStore.users.entries())) {
      if (u.role !== 'ADMIN' && u.email !== 'admin@labguard.edu') {
        memoryStore.users.delete(key);
      }
    }
    memoryStore.labs.clear();
    memoryStore.computers.clear();
    memoryStore.equipment.clear();
    memoryStore.schedulePersist();

    await this.execute("DELETE FROM local_users WHERE email != 'admin@labguard.edu' AND role != 'ADMIN';");
    await this.execute("DELETE FROM local_labs;");
    await this.execute("DELETE FROM local_computers;");
    await this.execute("DELETE FROM local_equipment;");
  },

  // ==========================================================================
  // Section 1: User & Offline Credential Management
  // ==========================================================================

  /**
   * Caches verified user credentials, salted password hash, and signed offline token into local SQLite
   */
  async cacheOfflineUser(
    user: { id: string; email: string; fullName: string; role: string; identifier?: string; assignedLabs?: string[] },
    plainPassword?: string,
    offlineToken?: string
  ): Promise<void> {
    const passwordHash = plainPassword ? await hashOfflinePassword(plainPassword, user.id) : undefined;
    const cleanId = (user.id || '').replace(/'/g, "''");
    const cleanEmail = (user.email || '').replace(/'/g, "''");
    const cleanName = (user.fullName || '').replace(/'/g, "''");
    const cleanRole = (user.role || '').replace(/'/g, "''");
    const cleanIdentifier = (user.identifier || user.email || '').replace(/'/g, "''");
    const cleanToken = (offlineToken || '').replace(/'/g, "''");
    const cleanHash = (passwordHash || '').replace(/'/g, "''");

    const localUser: LocalUser = {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      identifier: user.identifier || user.email,
      password_hash: passwordHash,
      offline_token: offlineToken,
      is_active: 1
    };

    memoryStore.users.set(user.id, localUser);

    await this.execute(
      `INSERT OR REPLACE INTO local_users (id, email, full_name, role, identifier, password_hash, offline_token, is_active) ` +
      `VALUES ('${cleanId}', '${cleanEmail}', '${cleanName}', '${cleanRole}', '${cleanIdentifier}', '${cleanHash}', '${cleanToken}', 1);`
    );

    // Cache user authorizations for assigned labs
    if (user.assignedLabs && Array.isArray(user.assignedLabs)) {
      for (const labCode of user.assignedLabs) {
        const authId = `${user.id}_${labCode}`;
        const authRecord: LocalAuthorization = {
          id: authId,
          user_id: user.id,
          lab_code: labCode,
          created_at: new Date().toISOString()
        };
        memoryStore.authorizations.set(authId, authRecord);

        await this.execute(
          `INSERT OR REPLACE INTO local_authorizations (id, user_id, lab_code, created_at) ` +
          `VALUES ('${authId}', '${cleanId}', '${labCode.replace(/'/g, "''")}', '${authRecord.created_at}');`
        );
      }
    }
  },

  /**
   * Find cached local user by email or student/employee identifier
   */
  async findLocalUser(identifier: string, role?: string): Promise<LocalUser | null> {
    const cleanId = identifier.trim().toLowerCase();
    
    // Check in-memory store
    for (const u of memoryStore.users.values()) {
      const matchIdent = (u.email && u.email.toLowerCase() === cleanId) || 
                         (u.identifier && u.identifier.toLowerCase() === cleanId);
      if (matchIdent) {
        if (!role || u.role === role) return u;
      }
    }

    // Query native SQLite if available
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        const escaped = cleanId.replace(/'/g, "''");
        let sql = `SELECT * FROM local_users WHERE (LOWER(email) = '${escaped}' OR LOWER(identifier) = '${escaped}')`;
        if (role) {
          sql += ` AND role = '${role.replace(/'/g, "''")}'`;
        }
        sql += ` LIMIT 1`;

        const rows = await this.query<LocalUser>(sql);
        return rows.length > 0 ? rows[0] : null;
      }
    } catch {
      // outside Tauri
    }

    return null;
  },

  /**
   * Secure Offline Authentication with Cryptographic Hash Check and Privilege Escalation Guards
   */
  async verifyOfflineCredentials(
    identifier: string,
    plainPassword: string,
    targetRole: UserRole
  ): Promise<{
    success: boolean;
    user?: User;
    authorizedLabs?: string[];
    error?: string;
    message?: string;
  }> {
    // 1. Locate cached user by identifier (regardless of requested role, to prevent silent role evasion)
    const cached = await this.findLocalUser(identifier);
    if (!cached) {
      return {
        success: false,
        error: 'USER_NOT_CACHED',
        message: 'No cached credentials found for this account on this workstation. Please connect to campus network for initial sign-in.'
      };
    }

    // 2. Active status check
    if (!cached.is_active) {
      return {
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'Account has been deactivated. Offline sign-in is prohibited.'
      };
    }

    // 3. Strict Privilege Escalation Guard
    if (cached.role !== targetRole) {
      return {
        success: false,
        error: 'PRIVILEGE_ESCALATION_BLOCKED',
        message: `Privilege escalation blocked: Account is registered as ${cached.role}, cannot authenticate as ${targetRole}.`
      };
    }

    // 4. Token Expiration Guard (30-day offline policy)
    // 4. Token Expiration Guard (30-day offline policy)
    if (cached.offline_token) {
      const payload = parseJwtPayload(cached.offline_token);
      if (payload && payload.exp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp < nowSec) {
          return {
            success: false,
            error: 'OFFLINE_TOKEN_EXPIRED',
            message: 'Offline authorization has expired (30-day security limit reached). Please reconnect to campus network.'
          };
        }
      }
    }

    // 4b. Progressive Delay & Account Lockout Defense
    const lockKey = `${cached.id}_${cached.role}`;
    const attemptRecord = (memoryStore as any).failedAttemptsMap?.get(lockKey) || { count: 0, lockedUntil: 0 };
    if (attemptRecord.lockedUntil && Date.now() < attemptRecord.lockedUntil) {
      const remainingMin = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
      return {
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to 5 consecutive failed attempts. Retry in ${remainingMin} minute(s).`
      };
    }

    // 5. Password Hash Verification
    if (cached.password_hash) {
      const computedHash = await hashOfflinePassword(plainPassword, cached.id);
      if (computedHash !== cached.password_hash) {
        attemptRecord.count = (attemptRecord.count || 0) + 1;
        if (attemptRecord.count >= 5) {
          attemptRecord.lockedUntil = Date.now() + 15 * 60 * 1000; // 15-min lockout
        }
        if (!(memoryStore as any).failedAttemptsMap) {
          (memoryStore as any).failedAttemptsMap = new Map();
        }
        (memoryStore as any).failedAttemptsMap.set(lockKey, attemptRecord);

        // Record failed attempt audit log
        this.createLocalAuditLog({
          actorUserId: cached.id,
          actorName: cached.full_name,
          role: cached.role,
          action: 'OFFLINE_LOGIN_FAILED',
          entityType: 'SECURITY',
          entityId: cached.id
        }).catch(console.warn);

        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: attemptRecord.count >= 5
            ? 'Account locked for 15 minutes due to 5 failed attempts.'
            : `Invalid password for offline sign-in. Attempt ${attemptRecord.count} of 5.`
        };
      }
    }

    // Reset failed attempts on successful verification
    if ((memoryStore as any).failedAttemptsMap) {
      (memoryStore as any).failedAttemptsMap.delete(lockKey);
    }

    // 6. Retrieve assigned laboratory scopes
    const authorizations: string[] = [];
    for (const auth of memoryStore.authorizations.values()) {
      if (auth.user_id === cached.id) {
        authorizations.push(auth.lab_code);
      }
    }
    if (authorizations.length === 0 && cached.offline_token) {
      const payload = parseJwtPayload(cached.offline_token);
      if (payload && Array.isArray(payload.assignedLabs)) {
        authorizations.push(...payload.assignedLabs);
      }
    }

    const offlineUser: User = {
      id: cached.id,
      email: cached.email,
      fullName: cached.full_name,
      role: cached.role as UserRole,
      identifier: cached.identifier,
      isActive: Boolean(cached.is_active),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 7. Record offline login event into local audit trail & sync queue
    await this.createLocalAuditLog({
      actorUserId: cached.id,
      actorName: cached.full_name,
      role: cached.role,
      action: 'USER_LOGIN_OFFLINE',
      entityType: 'AUTH',
      entityId: cached.id
    });

    return {
      success: true,
      user: offlineUser,
      authorizedLabs: authorizations,
      message: 'Authenticated in Offline Operation Mode (Cached Authorization Verified)'
    };
  },

  // ==========================================================================
  // Section 2: Catalog Caching (Labs, Workstations, Equipment)
  // ==========================================================================

  /**
   * Pre-caches complete campus catalog from server into local SQLite
   */
  async cacheCatalog(labs: Lab[], computers: Computer[], equipment: Equipment[]): Promise<void> {
    for (const lab of labs) {
      const rec: LocalLabRecord = {
        id: lab.id,
        code: lab.code,
        name: lab.name,
        room: lab.room,
        capacity: lab.capacity,
        status: lab.status
      };
      memoryStore.labs.set(lab.id, rec);
      await this.execute(
        `INSERT OR REPLACE INTO local_labs (id, code, name, room, capacity, status) ` +
        `VALUES ('${lab.id}', '${lab.code}', '${lab.name.replace(/'/g, "''")}', '${lab.room}', ${lab.capacity}, '${lab.status}');`
      );
    }

    for (const pc of computers) {
      const labCode = pc.labCode || pc.labId || 'LAB-01';
      const rec: LocalComputerRecord = {
        id: pc.id,
        lab_code: labCode,
        pc_code: pc.pcCode,
        state: pc.state,
        client_id: pc.clientId
      };
      memoryStore.computers.set(pc.id, rec);
      await this.execute(
        `INSERT OR REPLACE INTO local_computers (id, lab_code, pc_code, state, client_id) ` +
        `VALUES ('${pc.id}', '${labCode}', '${pc.pcCode}', '${pc.state}', '${pc.clientId || ''}');`
      );
    }

    for (const eq of equipment) {
      const rec: LocalEquipmentRecord = {
        id: eq.id,
        asset_tag: eq.assetTag,
        type: eq.type,
        brand: eq.brand,
        model: eq.model,
        serial_number: eq.serialNumber,
        status: eq.status,
        lab_code: eq.labCode,
        pc_code: eq.pcCode
      };
      memoryStore.equipment.set(eq.id, rec);
      await this.execute(
        `INSERT OR REPLACE INTO local_equipment (id, asset_tag, type, brand, model, serial_number, status, lab_code, pc_code) ` +
        `VALUES ('${eq.id}', '${eq.assetTag}', '${eq.type}', '${(eq.brand || '').replace(/'/g, "''")}', ` +
        `'${(eq.model || '').replace(/'/g, "''")}', '${(eq.serialNumber || '').replace(/'/g, "''")}', ` +
        `'${eq.status}', '${eq.labCode || ''}', '${eq.pcCode || ''}');`
      );
    }
  },

  async getLocalLabs(): Promise<LocalLabRecord[]> {
    return this.query<LocalLabRecord>('SELECT * FROM local_labs ORDER BY code ASC');
  },

  async getLocalComputers(labCode?: string): Promise<LocalComputerRecord[]> {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query<LocalComputerRecord>(`SELECT * FROM local_computers WHERE UPPER(lab_code) = '${clean}' ORDER BY pc_code ASC`);
    }
    return this.query<LocalComputerRecord>('SELECT * FROM local_computers ORDER BY lab_code, pc_code ASC');
  },

  async getLocalEquipment(labCode?: string, pcCode?: string): Promise<LocalEquipmentRecord[]> {
    let sql = 'SELECT * FROM local_equipment';
    const conditions: string[] = [];
    if (labCode) conditions.push(`UPPER(lab_code) = '${labCode.toUpperCase().replace(/'/g, "''")}'`);
    if (pcCode) conditions.push(`UPPER(pc_code) = '${pcCode.toUpperCase().replace(/'/g, "''")}'`);
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    return this.query<LocalEquipmentRecord>(sql);
  },

  async updateLocalComputerState(labCode: string, pcCode: string, state: string): Promise<void> {
    const cleanLab = labCode.toUpperCase().replace(/'/g, "''");
    const cleanPc = pcCode.toUpperCase().replace(/'/g, "''");
    
    let found = false;
    for (const c of memoryStore.computers.values()) {
      if ((c.lab_code || '').toUpperCase() === cleanLab && (c.pc_code || '').toUpperCase() === cleanPc) {
        c.state = state;
        found = true;
      }
    }

    if (!found) {
      const pcId = `pc-${cleanLab.toLowerCase()}-${cleanPc.toLowerCase()}`;
      memoryStore.computers.set(pcId, {
        id: pcId,
        lab_code: cleanLab,
        pc_code: cleanPc,
        state: state
      });
    }

    await this.execute(
      `UPDATE local_computers SET state = '${state}' WHERE UPPER(lab_code) = '${cleanLab}' AND UPPER(pc_code) = '${cleanPc}';`
    );
  },

  // ==========================================================================
  // Section 3: Sessions in Offline Mode
  // ==========================================================================

  async startLocalSession(payload: {
    studentId: string;
    studentName?: string;
    studentIdentifier?: string;
    labCode: string;
    pcCode: string;
    clientId?: string;
  }): Promise<LocalSession> {
    const id = generateOfflineId();
    const now = new Date().toISOString();

    const session: LocalSession = {
      id,
      student_id: payload.studentId,
      student_name: payload.studentName,
      student_identifier: payload.studentIdentifier,
      lab_code: payload.labCode,
      pc_code: payload.pcCode,
      client_id: payload.clientId || 'CLIENT-' + payload.pcCode,
      started_at: now,
      status: 'ACTIVE',
      sync_status: 'PENDING'
    };

    memoryStore.sessions.set(id, session);

    await this.execute(
      `INSERT INTO local_sessions (id, student_id, student_identifier, student_name, lab_code, pc_code, client_id, started_at, status, sync_status) ` +
      `VALUES ('${id}', '${payload.studentId}', '${payload.studentIdentifier || ''}', '${(payload.studentName || '').replace(/'/g, "''")}', ` +
      `'${payload.labCode}', '${payload.pcCode}', '${session.client_id}', '${now}', 'ACTIVE', 'PENDING');`
    );

    // Set workstation to IN_USE
    await this.updateLocalComputerState(payload.labCode, payload.pcCode, 'IN_USE');

    // Queue for central synchronization
    await this.enqueueSyncItem('SESSION', id, {
      ...session,
      action: 'START'
    });

    // Record local audit log
    await this.createLocalAuditLog({
      actorUserId: payload.studentId,
      actorName: payload.studentName || 'Student',
      role: 'STUDENT',
      action: 'SESSION_START_OFFLINE',
      entityType: 'SESSION',
      entityId: id
    });

    return session;
  },

  async endLocalSession(sessionId: string, endMode: string = 'MANUAL'): Promise<LocalSession | null> {
    const session = memoryStore.sessions.get(sessionId);
    const now = new Date().toISOString();

    if (session) {
      session.ended_at = now;
      session.status = 'COMPLETED';
      session.end_mode = endMode;
      session.sync_status = 'PENDING';

      await this.execute(
        `UPDATE local_sessions SET ended_at = '${now}', status = 'COMPLETED', end_mode = '${endMode}', sync_status = 'PENDING' WHERE id = '${sessionId}';`
      );

      // Restore PC to AVAILABLE
      await this.updateLocalComputerState(session.lab_code, session.pc_code, 'AVAILABLE');

      // Queue for central sync
      await this.enqueueSyncItem('SESSION', sessionId, {
        ...session,
        action: 'END'
      });

      // Local audit log
      await this.createLocalAuditLog({
        actorUserId: session.student_id,
        actorName: session.student_name || 'Student',
        role: 'STUDENT',
        action: 'SESSION_END_OFFLINE',
        entityType: 'SESSION',
        entityId: sessionId
      });

      return session;
    }

    // Direct SQLite update fallback
    await this.execute(
      `UPDATE local_sessions SET ended_at = '${now}', status = 'COMPLETED', end_mode = '${endMode}', sync_status = 'PENDING' WHERE id = '${sessionId}';`
    );
    const rows = await this.query<LocalSession>(`SELECT * FROM local_sessions WHERE id = '${sessionId}'`);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Recovers orphaned active sessions in local SQLite resulting from abnormal
   * application crash, sudden power outage, or ungraceful system reboot.
   */
  async recoverOrphanedLocalSessions(reason: string = 'Abnormal application or system shutdown'): Promise<{
    recoveredCount: number;
    recoveredSessions: LocalSession[];
  }> {
    const recovered: LocalSession[] = [];
    const now = new Date().toISOString();

    // 1. Scan memoryStore and query local SQLite
    const activeFromDb = await this.query<LocalSession>("SELECT * FROM local_sessions WHERE status = 'ACTIVE';");
    
    // Merge any memoryStore active sessions
    const activeIds = new Set<string>();
    for (const s of activeFromDb) {
      activeIds.add(s.id);
    }
    for (const [id, s] of memoryStore.sessions.entries()) {
      if (s.status === 'ACTIVE') {
        activeIds.add(id);
      }
    }

    for (const id of activeIds) {
      let session = memoryStore.sessions.get(id);
      if (!session) {
        session = activeFromDb.find((s) => s.id === id);
        if (session) memoryStore.sessions.set(id, session);
      }

      if (session) {
        session.ended_at = now;
        session.status = 'RECOVERED';
        session.end_mode = 'CRASH_RECOVERED';
        session.notes = (session.notes ? session.notes + ' | ' : '') + reason;
        session.sync_status = 'PENDING';

        await this.execute(
          `UPDATE local_sessions SET ended_at = '${now}', status = 'RECOVERED', end_mode = 'CRASH_RECOVERED', sync_status = 'PENDING' WHERE id = '${id}';`
        );

        // Restore PC state back to AVAILABLE
        await this.updateLocalComputerState(session.lab_code, session.pc_code, 'AVAILABLE');

        // Queue for central synchronization
        await this.enqueueSyncItem('SESSION', id, {
          ...session,
          action: 'RECOVER',
          reason
        });

        // Record local audit log
        await this.createLocalAuditLog({
          actorUserId: session.student_id,
          actorName: session.student_name || 'Student',
          role: 'STUDENT',
          action: 'SESSION_RECOVERED_CRASH',
          entityType: 'SESSION',
          entityId: id
        });

        recovered.push(session);
      }
    }

    return {
      recoveredCount: recovered.length,
      recoveredSessions: recovered
    };
  },

  async getActiveLocalSession(studentId?: string): Promise<LocalSession | null> {
    for (const s of memoryStore.sessions.values()) {
      if (s.status === 'ACTIVE' && (!studentId || s.student_id === studentId)) {
        return s;
      }
    }
    const sql = studentId
      ? `SELECT * FROM local_sessions WHERE student_id = '${studentId}' AND status = 'ACTIVE' LIMIT 1`
      : `SELECT * FROM local_sessions WHERE status = 'ACTIVE' LIMIT 1`;
    const rows = await this.query<LocalSession>(sql);
    return rows.length > 0 ? rows[0] : null;
  },

  async getStudentDashboardData(studentId: string): Promise<any> {
    const activeSession = await this.getActiveLocalSession(studentId);
    let workstationEquipment: LocalEquipmentRecord[] = [];
    if (activeSession) {
      workstationEquipment = await this.getLocalEquipment(activeSession.lab_code, activeSession.pc_code);
    }
    const myIssues = await this.getLocalIssues(studentId);
    const mySessions = Array.from(memoryStore.sessions.values()).filter((s) => s.student_id === studentId);

    return {
      activeSession,
      workstationEquipment,
      myReportedIssues: myIssues,
      myRecentSessions: mySessions
    };
  },

  // ==========================================================================
  // Section 4: Hardware Events in Offline Mode
  // ==========================================================================

  async recordLocalHardwareEvent(event: {
    labCode: string;
    pcCode: string;
    clientId?: string;
    eventType: string;
    description: string;
    severity?: string;
  }): Promise<LocalHardwareEvent> {
    const id = generateOfflineId();
    const now = new Date().toISOString();

    const record: LocalHardwareEvent = {
      id,
      lab_code: event.labCode,
      pc_code: event.pcCode,
      client_id: event.clientId || 'CLIENT-' + event.pcCode,
      event_type: event.eventType,
      description: event.description,
      severity: event.severity || 'INFO',
      timestamp: now,
      sync_status: 'PENDING'
    };

    memoryStore.hardwareEvents.set(id, record);

    await this.execute(
      `INSERT INTO local_hardware_events (id, client_id, lab_code, pc_code, event_type, description, severity, timestamp, sync_status) ` +
      `VALUES ('${id}', '${record.client_id}', '${event.labCode}', '${event.pcCode}', '${event.eventType}', ` +
      `'${event.description.replace(/'/g, "''")}', '${record.severity}', '${now}', 'PENDING');`
    );

    // Queue for sync
    await this.enqueueSyncItem('HARDWARE_EVENT', id, record);

    // Local audit log
    await this.createLocalAuditLog({
      action: 'HARDWARE_EVENT_OFFLINE',
      entityType: 'HARDWARE',
      entityId: id
    });

    return record;
  },

  async getLocalHardwareEvents(labCode?: string): Promise<LocalHardwareEvent[]> {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query<LocalHardwareEvent>(`SELECT * FROM local_hardware_events WHERE UPPER(lab_code) = '${clean}' ORDER BY timestamp DESC`);
    }
    return this.query<LocalHardwareEvent>('SELECT * FROM local_hardware_events ORDER BY timestamp DESC');
  },

  // ==========================================================================
  // Section 5: Issues in Offline Mode
  // ==========================================================================

  async createLocalIssue(issue: {
    labCode: string;
    pcCode: string;
    reportedBy?: string;
    issueType: string;
    description: string;
  }): Promise<LocalIssue> {
    const id = generateOfflineId();
    const now = new Date().toISOString();

    const record: LocalIssue = {
      id,
      lab_code: issue.labCode,
      pc_code: issue.pcCode,
      reported_by: issue.reportedBy,
      issue_type: issue.issueType,
      description: issue.description,
      status: 'OPEN',
      created_at: now,
      sync_status: 'PENDING'
    };

    memoryStore.issues.set(id, record);

    await this.execute(
      `INSERT INTO local_issues (id, lab_code, pc_code, reported_by, issue_type, description, status, created_at, sync_status) ` +
      `VALUES ('${id}', '${issue.labCode}', '${issue.pcCode}', '${issue.reportedBy || ''}', '${issue.issueType}', ` +
      `'${issue.description.replace(/'/g, "''")}', 'OPEN', '${now}', 'PENDING');`
    );

    // Queue for sync
    await this.enqueueSyncItem('ISSUE', id, record);

    // Local audit
    await this.createLocalAuditLog({
      actorUserId: issue.reportedBy,
      action: 'ISSUE_REPORT_OFFLINE',
      entityType: 'ISSUE',
      entityId: id
    });

    return record;
  },

  async getLocalIssues(reportedByOrLabCode?: string): Promise<LocalIssue[]> {
    if (reportedByOrLabCode) {
      const clean = reportedByOrLabCode.replace(/'/g, "''");
      return this.query<LocalIssue>(
        `SELECT * FROM local_issues WHERE reported_by = '${clean}' OR UPPER(lab_code) = '${clean.toUpperCase()}' ORDER BY created_at DESC`
      );
    }
    return this.query<LocalIssue>('SELECT * FROM local_issues ORDER BY created_at DESC');
  },

  // ==========================================================================
  // Section 6: Maintenance in Offline Mode
  // ==========================================================================

  async createLocalMaintenance(order: {
    labCode: string;
    pcCode: string;
    issueId?: string;
    responsibleUser?: string;
    actionTaken?: string;
  }): Promise<LocalMaintenance> {
    const id = generateOfflineId();
    const now = new Date().toISOString();

    const record: LocalMaintenance = {
      id,
      lab_code: order.labCode,
      pc_code: order.pcCode,
      issue_id: order.issueId,
      responsible_user: order.responsibleUser,
      action_taken: order.actionTaken,
      status: 'IN_PROGRESS',
      start_time: now,
      sync_status: 'PENDING'
    };

    memoryStore.maintenance.set(id, record);

    await this.execute(
      `INSERT INTO local_maintenance (id, issue_id, lab_code, pc_code, responsible_user, action_taken, status, start_time, sync_status) ` +
      `VALUES ('${id}', '${order.issueId || ''}', '${order.labCode}', '${order.pcCode}', '${order.responsibleUser || ''}', ` +
      `'${(order.actionTaken || '').replace(/'/g, "''")}', 'IN_PROGRESS', '${now}', 'PENDING');`
    );

    // Set workstation to MAINTENANCE
    await this.updateLocalComputerState(order.labCode, order.pcCode, 'MAINTENANCE');

    // Queue for sync
    await this.enqueueSyncItem('MAINTENANCE', id, record);

    // Local audit
    await this.createLocalAuditLog({
      actorUserId: order.responsibleUser,
      action: 'MAINTENANCE_START_OFFLINE',
      entityType: 'MAINTENANCE',
      entityId: id
    });

    return record;
  },

  async updateLocalMaintenance(id: string, updates: {
    status?: string;
    actionTaken?: string;
    endTime?: string;
  }): Promise<LocalMaintenance | null> {
    const record = memoryStore.maintenance.get(id);
    if (record) {
      if (updates.status) record.status = updates.status;
      if (updates.actionTaken) record.action_taken = updates.actionTaken;
      if (updates.endTime) record.end_time = updates.endTime;
      record.sync_status = 'PENDING';

      await this.execute(
        `UPDATE local_maintenance SET status = '${record.status}', action_taken = '${(record.action_taken || '').replace(/'/g, "''")}', ` +
        `end_time = '${record.end_time || ''}', sync_status = 'PENDING' WHERE id = '${id}';`
      );

      // Restore PC to AVAILABLE on completion
      if (record.status === 'COMPLETED') {
        await this.updateLocalComputerState(record.lab_code, record.pc_code, 'AVAILABLE');
      }

      await this.enqueueSyncItem('MAINTENANCE', id, { ...record, action: 'UPDATE' });
      return record;
    }
    return null;
  },

  async getLocalMaintenance(labCode?: string): Promise<LocalMaintenance[]> {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query<LocalMaintenance>(`SELECT * FROM local_maintenance WHERE UPPER(lab_code) = '${clean}' ORDER BY start_time DESC`);
    }
    return this.query<LocalMaintenance>('SELECT * FROM local_maintenance ORDER BY start_time DESC');
  },

  // ==========================================================================
  // Section 7: Local Audit Trail
  // ==========================================================================

  async createLocalAuditLog(log: {
    actorUserId?: string;
    actorName?: string;
    role?: string;
    action: string;
    entityType: string;
    entityId?: string;
  }): Promise<LocalAuditLog> {
    const id = generateOfflineId();
    const now = new Date().toISOString();

    const record: LocalAuditLog = {
      id,
      actor_user_id: log.actorUserId,
      actor_name: log.actorName,
      role: log.role,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      timestamp: now,
      sync_status: 'PENDING'
    };

    memoryStore.auditLogs.set(id, record);

    await this.execute(
      `INSERT INTO local_audit_logs (id, actor_user_id, actor_name, role, action, entity_type, entity_id, timestamp, sync_status) ` +
      `VALUES ('${id}', '${log.actorUserId || ''}', '${(log.actorName || '').replace(/'/g, "''")}', '${log.role || ''}', ` +
      `'${log.action}', '${log.entityType}', '${log.entityId || ''}', '${now}', 'PENDING');`
    );

    // Queue for sync
    await this.enqueueSyncItem('AUDIT_LOG', id, record);

    return record;
  },

  async getLocalAuditLogs(): Promise<LocalAuditLog[]> {
    return this.query<LocalAuditLog>('SELECT * FROM local_audit_logs ORDER BY timestamp DESC');
  },

  // ==========================================================================
  // Section 8: Sync Queue Management (Phase 19/20 Bridge)
  // ==========================================================================

  async enqueueSyncItem(entityType: string, entityId: string, payload: any): Promise<LocalSyncQueueItem> {
    const id = generateOfflineId();
    const now = new Date().toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const item: LocalSyncQueueItem = {
      id,
      entity_type: entityType,
      entity_id: entityId,
      payload: payloadStr,
      status: 'PENDING',
      attempt_count: 0,
      created_at: now
    };

    memoryStore.syncQueue.set(id, item);

    await this.execute(
      `INSERT INTO sync_queue (id, entity_type, entity_id, payload, status, attempt_count, created_at) ` +
      `VALUES ('${id}', '${entityType}', '${entityId}', '${payloadStr.replace(/'/g, "''")}', 'PENDING', 0, '${now}');`
    );

    return item;
  },

  async getPendingSyncItems(): Promise<LocalSyncQueueItem[]> {
    const pending = Array.from(memoryStore.syncQueue.values()).filter((item) => item.status === 'PENDING');
    if (pending.length > 0) return pending;
    return this.query<LocalSyncQueueItem>("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC");
  },

  async getPendingSyncQueue(): Promise<LocalSyncQueueItem[]> {
    return this.getPendingSyncItems();
  },

  async markSyncItemProcessed(id: string, batchId?: string): Promise<void> {
    const item = memoryStore.syncQueue.get(id);
    if (item) {
      item.status = 'SYNCED';
      item.batch_id = batchId;
    }
    await this.execute(`UPDATE sync_queue SET status = 'SYNCED', batch_id = '${batchId || ''}' WHERE id = '${id}';`);
  },

  async incrementSyncItemAttempt(id: string): Promise<void> {
    const item = memoryStore.syncQueue.get(id);
    if (item) {
      item.attempt_count += 1;
    }
    await this.execute(`UPDATE sync_queue SET attempt_count = attempt_count + 1 WHERE id = '${id}';`);
  },

  async recordSyncConflict(conflict: {
    batchId?: string;
    entityType: string;
    entityId: string;
    reason: string;
    clientPayload?: any;
    serverPayload?: any;
  }): Promise<LocalSyncConflict> {
    const id = generateOfflineId();
    const now = new Date().toISOString();
    const clientStr = conflict.clientPayload ? (typeof conflict.clientPayload === 'string' ? conflict.clientPayload : JSON.stringify(conflict.clientPayload)) : '';
    const serverStr = conflict.serverPayload ? (typeof conflict.serverPayload === 'string' ? conflict.serverPayload : JSON.stringify(conflict.serverPayload)) : '';

    const rec: LocalSyncConflict = {
      id,
      batch_id: conflict.batchId,
      entity_type: conflict.entityType,
      entity_id: conflict.entityId,
      reason: conflict.reason,
      client_payload: clientStr,
      server_payload: serverStr,
      status: 'UNRESOLVED',
      created_at: now
    };

    memoryStore.syncConflicts.set(id, rec);

    await this.execute(
      `INSERT INTO sync_conflicts (id, batch_id, entity_type, entity_id, reason, client_payload, server_payload, status, created_at) ` +
      `VALUES ('${id}', '${conflict.batchId || ''}', '${conflict.entityType}', '${conflict.entityId}', ` +
      `'${conflict.reason.replace(/'/g, "''")}', '${clientStr.replace(/'/g, "''")}', '${serverStr.replace(/'/g, "''")}', 'UNRESOLVED', '${now}');`
    );

    return rec;
  },

  async getSyncConflicts(): Promise<LocalSyncConflict[]> {
    const mem = Array.from(memoryStore.syncConflicts.values());
    if (mem.length > 0) return mem;
    return this.query<LocalSyncConflict>('SELECT * FROM sync_conflicts ORDER BY created_at DESC');
  },

  async resolveSyncConflict(id: string, resolutionStatus: string = 'RESOLVED'): Promise<void> {
    const c = memoryStore.syncConflicts.get(id);
    if (c) c.status = resolutionStatus;
    await this.execute(`UPDATE sync_conflicts SET status = '${resolutionStatus}' WHERE id = '${id}';`);
  },

  async clearLocalStore(): Promise<void> {
    memoryStore.clear();
  }
};
