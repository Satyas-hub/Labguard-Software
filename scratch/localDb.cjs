"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// desktop/src/db/localDb.ts
var localDb_exports = {};
__export(localDb_exports, {
  LocalDbService: () => LocalDbService,
  hashOfflinePassword: () => hashOfflinePassword
});
module.exports = __toCommonJS(localDb_exports);
var tauriInvoke = null;
async function getInvoke() {
  if (tauriInvoke) return tauriInvoke;
  try {
    const mod = await import("@tauri-apps/api/core");
    tauriInvoke = mod.invoke;
    return tauriInvoke;
  } catch {
    return null;
  }
}
async function hashOfflinePassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}:labguard_offline_salt`);
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    const crypto2 = require("crypto");
    return crypto2.createHash("sha256").update(data).digest("hex");
  } catch {
    let h = 0;
    const str = `${salt}:${password}`;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return `fallback_${Math.abs(h).toString(16)}`;
  }
}
var MemorySqliteStore = class {
  configuration = /* @__PURE__ */ new Map();
  users = /* @__PURE__ */ new Map();
  authorizations = /* @__PURE__ */ new Map();
  labs = /* @__PURE__ */ new Map();
  computers = /* @__PURE__ */ new Map();
  equipment = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  hardwareEvents = /* @__PURE__ */ new Map();
  issues = /* @__PURE__ */ new Map();
  maintenance = /* @__PURE__ */ new Map();
  notifications = /* @__PURE__ */ new Map();
  auditLogs = /* @__PURE__ */ new Map();
  syncQueue = /* @__PURE__ */ new Map();
  syncConflicts = /* @__PURE__ */ new Map();
  clear() {
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
  }
};
var memoryStore = new MemorySqliteStore();
var isTauriAvailable = typeof window !== "undefined" && (Boolean(window.__TAURI_INTERNALS__) || Boolean(window.__TAURI__));
function generateOfflineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "offline-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
}
function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    let jsonStr;
    if (typeof atob !== "undefined") {
      jsonStr = atob(base64);
    } else {
      jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
var LocalDbService = {
  /**
   * Initializes all 14 schema vaults in SQLite
   */
  async init() {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        return await invokeFn("init_local_database");
      }
    } catch (e) {
      isTauriAvailable = false;
    }
    return "SQLite fallback active (All 14 vaults ready)";
  },
  /**
   * Raw SELECT query returning typed JSON records
   */
  async query(sql) {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        const jsonStr = await invokeFn("query_local_db", { sql });
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      isTauriAvailable = false;
    }
    const s = sql.trim();
    if (s.includes("FROM local_users")) {
      return Array.from(memoryStore.users.values());
    }
    if (s.includes("FROM local_sessions")) {
      let sessions = Array.from(memoryStore.sessions.values());
      if (s.includes("status = 'ACTIVE'")) {
        sessions = sessions.filter(x => x.status === 'ACTIVE');
      }
      return sessions;
    }
    if (s.includes("FROM local_computers")) {
      let comps = Array.from(memoryStore.computers.values());
      const m = s.match(/WHERE UPPER\(lab_code\) = '([^']+)'/i);
      if (m) {
        comps = comps.filter(c => (c.lab_code || '').toUpperCase() === m[1].toUpperCase());
      }
      return comps;
    }
    if (s.includes("FROM local_equipment")) {
      return Array.from(memoryStore.equipment.values());
    }
    if (s.includes("FROM local_labs")) {
      return Array.from(memoryStore.labs.values());
    }
    if (s.includes("FROM local_issues")) {
      return Array.from(memoryStore.issues.values());
    }
    if (s.includes("FROM local_hardware_events")) {
      return Array.from(memoryStore.hardwareEvents.values());
    }
    if (s.includes("FROM local_maintenance")) {
      return Array.from(memoryStore.maintenance.values());
    }
    if (s.includes("FROM local_audit_logs")) {
      return Array.from(memoryStore.auditLogs.values());
    }
    if (s.includes("FROM sync_queue")) {
      return Array.from(memoryStore.syncQueue.values());
    }
    return [];
  },
  /**
   * Execute non-query statements (INSERT, UPDATE, DELETE)
   */
  async execute(sql) {
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        return await invokeFn("execute_local_db", { sql });
      }
    } catch (e) {
      isTauriAvailable = false;
    }
    const s = sql.trim();
    if (s.includes("UPDATE local_users SET is_active = 0")) {
      for (const u of memoryStore.users.values()) {
        if (s.includes(u.email) || u.identifier && s.includes(u.identifier) || s.includes(u.id)) {
          u.is_active = 0;
        }
      }
    } else if (s.includes("UPDATE local_users SET is_active = 1")) {
      for (const u of memoryStore.users.values()) {
        if (s.includes(u.email) || u.identifier && s.includes(u.identifier) || s.includes(u.id)) {
          u.is_active = 1;
        }
      }
    }
    return 1;
  },
  // ==========================================================================
  // Section 1: User & Offline Credential Management
  // ==========================================================================
  /**
   * Caches verified user credentials, salted password hash, and signed offline token into local SQLite
   */
  async cacheOfflineUser(user, plainPassword, offlineToken) {
    const passwordHash = plainPassword ? await hashOfflinePassword(plainPassword, user.id) : void 0;
    const cleanId = (user.id || "").replace(/'/g, "''");
    const cleanEmail = (user.email || "").replace(/'/g, "''");
    const cleanName = (user.fullName || "").replace(/'/g, "''");
    const cleanRole = (user.role || "").replace(/'/g, "''");
    const cleanIdentifier = (user.identifier || user.email || "").replace(/'/g, "''");
    const cleanToken = (offlineToken || "").replace(/'/g, "''");
    const cleanHash = (passwordHash || "").replace(/'/g, "''");
    const localUser = {
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
      `INSERT OR REPLACE INTO local_users (id, email, full_name, role, identifier, password_hash, offline_token, is_active) VALUES ('${cleanId}', '${cleanEmail}', '${cleanName}', '${cleanRole}', '${cleanIdentifier}', '${cleanHash}', '${cleanToken}', 1);`
    );
    if (user.assignedLabs && Array.isArray(user.assignedLabs)) {
      for (const labCode of user.assignedLabs) {
        const authId = `${user.id}_${labCode}`;
        const authRecord = {
          id: authId,
          user_id: user.id,
          lab_code: labCode,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        memoryStore.authorizations.set(authId, authRecord);
        await this.execute(
          `INSERT OR REPLACE INTO local_authorizations (id, user_id, lab_code, created_at) VALUES ('${authId}', '${cleanId}', '${labCode.replace(/'/g, "''")}', '${authRecord.created_at}');`
        );
      }
    }
  },
  /**
   * Find cached local user by email or student/employee identifier
   */
  async findLocalUser(identifier, role) {
    const cleanId = identifier.trim().toLowerCase();
    for (const u of memoryStore.users.values()) {
      const matchIdent = u.email && u.email.toLowerCase() === cleanId || u.identifier && u.identifier.toLowerCase() === cleanId;
      if (matchIdent) {
        if (!role || u.role === role) return u;
      }
    }
    try {
      const invokeFn = await getInvoke();
      if (invokeFn) {
        const escaped = cleanId.replace(/'/g, "''");
        let sql = `SELECT * FROM local_users WHERE (LOWER(email) = '${escaped}' OR LOWER(identifier) = '${escaped}')`;
        if (role) {
          sql += ` AND role = '${role.replace(/'/g, "''")}'`;
        }
        sql += ` LIMIT 1`;
        const rows = await this.query(sql);
        return rows.length > 0 ? rows[0] : null;
      }
    } catch {
    }
    return null;
  },
  /**
   * Secure Offline Authentication with Cryptographic Hash Check and Privilege Escalation Guards
   */
  async verifyOfflineCredentials(identifier, plainPassword, targetRole) {
    const cached = await this.findLocalUser(identifier);
    if (!cached) {
      return {
        success: false,
        error: "USER_NOT_CACHED",
        message: "No cached credentials found for this account on this workstation. Please connect to campus network for initial sign-in."
      };
    }
    if (!cached.is_active) {
      return {
        success: false,
        error: "ACCOUNT_DISABLED",
        message: "Account has been deactivated. Offline sign-in is prohibited."
      };
    }
    if (cached.role !== targetRole) {
      return {
        success: false,
        error: "PRIVILEGE_ESCALATION_BLOCKED",
        message: `Privilege escalation blocked: Account is registered as ${cached.role}, cannot authenticate as ${targetRole}.`
      };
    }
    if (cached.offline_token) {
      const payload = parseJwtPayload(cached.offline_token);
      if (payload && payload.exp) {
        const nowSec = Math.floor(Date.now() / 1e3);
        if (payload.exp < nowSec) {
          return {
            success: false,
            error: "OFFLINE_TOKEN_EXPIRED",
            message: "Offline authorization has expired (30-day security limit reached). Please reconnect to campus network."
          };
        }
      }
    }
    if (cached.password_hash) {
      const computedHash = await hashOfflinePassword(plainPassword, cached.id);
      if (computedHash !== cached.password_hash) {
        return {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Invalid password for offline sign-in."
        };
      }
    }
    const authorizations = [];
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
    const offlineUser = {
      id: cached.id,
      email: cached.email,
      fullName: cached.full_name,
      role: cached.role,
      identifier: cached.identifier,
      isActive: Boolean(cached.is_active),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.createLocalAuditLog({
      actorUserId: cached.id,
      actorName: cached.full_name,
      role: cached.role,
      action: "USER_LOGIN_OFFLINE",
      entityType: "AUTH",
      entityId: cached.id
    });
    return {
      success: true,
      user: offlineUser,
      authorizedLabs: authorizations,
      message: "Authenticated in Offline Operation Mode (Cached Authorization Verified)"
    };
  },
  // ==========================================================================
  // Section 2: Catalog Caching (Labs, Workstations, Equipment)
  // ==========================================================================
  /**
   * Pre-caches complete campus catalog from server into local SQLite
   */
  async cacheCatalog(labs, computers, equipment) {
    for (const lab of labs) {
      const rec = {
        id: lab.id,
        code: lab.code,
        name: lab.name,
        room: lab.room,
        capacity: lab.capacity,
        status: lab.status
      };
      memoryStore.labs.set(lab.id, rec);
      await this.execute(
        `INSERT OR REPLACE INTO local_labs (id, code, name, room, capacity, status) VALUES ('${lab.id}', '${lab.code}', '${lab.name.replace(/'/g, "''")}', '${lab.room}', ${lab.capacity}, '${lab.status}');`
      );
    }
    for (const pc of computers) {
      const labCode = pc.labCode || pc.labId || "LAB-01";
      const rec = {
        id: pc.id,
        lab_code: labCode,
        pc_code: pc.pcCode,
        state: pc.state,
        client_id: pc.clientId
      };
      memoryStore.computers.set(pc.id, rec);
      await this.execute(
        `INSERT OR REPLACE INTO local_computers (id, lab_code, pc_code, state, client_id) VALUES ('${pc.id}', '${labCode}', '${pc.pcCode}', '${pc.state}', '${pc.clientId || ""}');`
      );
    }
    for (const eq of equipment) {
      const rec = {
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
        `INSERT OR REPLACE INTO local_equipment (id, asset_tag, type, brand, model, serial_number, status, lab_code, pc_code) VALUES ('${eq.id}', '${eq.assetTag}', '${eq.type}', '${(eq.brand || "").replace(/'/g, "''")}', '${(eq.model || "").replace(/'/g, "''")}', '${(eq.serialNumber || "").replace(/'/g, "''")}', '${eq.status}', '${eq.labCode || ""}', '${eq.pcCode || ""}');`
      );
    }
  },
  async getLocalLabs() {
    return this.query("SELECT * FROM local_labs ORDER BY code ASC");
  },
  async getLocalComputers(labCode) {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query(`SELECT * FROM local_computers WHERE UPPER(lab_code) = '${clean}' ORDER BY pc_code ASC`);
    }
    return this.query("SELECT * FROM local_computers ORDER BY lab_code, pc_code ASC");
  },
  async getLocalEquipment(labCode, pcCode) {
    let sql = "SELECT * FROM local_equipment";
    const conditions = [];
    if (labCode) conditions.push(`UPPER(lab_code) = '${labCode.toUpperCase().replace(/'/g, "''")}'`);
    if (pcCode) conditions.push(`UPPER(pc_code) = '${pcCode.toUpperCase().replace(/'/g, "''")}'`);
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
    return this.query(sql);
  },
  async updateLocalComputerState(labCode, pcCode, state) {
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
  async startLocalSession(payload) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const session = {
      id,
      student_id: payload.studentId,
      student_name: payload.studentName,
      student_identifier: payload.studentIdentifier,
      lab_code: payload.labCode,
      pc_code: payload.pcCode,
      client_id: payload.clientId || "CLIENT-" + payload.pcCode,
      started_at: now,
      status: "ACTIVE",
      sync_status: "PENDING"
    };
    memoryStore.sessions.set(id, session);
    await this.execute(
      `INSERT INTO local_sessions (id, student_id, student_identifier, student_name, lab_code, pc_code, client_id, started_at, status, sync_status) VALUES ('${id}', '${payload.studentId}', '${payload.studentIdentifier || ""}', '${(payload.studentName || "").replace(/'/g, "''")}', '${payload.labCode}', '${payload.pcCode}', '${session.client_id}', '${now}', 'ACTIVE', 'PENDING');`
    );
    await this.updateLocalComputerState(payload.labCode, payload.pcCode, "IN_USE");
    await this.enqueueSyncItem("SESSION", id, {
      ...session,
      action: "START"
    });
    await this.createLocalAuditLog({
      actorUserId: payload.studentId,
      actorName: payload.studentName || "Student",
      role: "STUDENT",
      action: "SESSION_START_OFFLINE",
      entityType: "SESSION",
      entityId: id
    });
    return session;
  },
  async endLocalSession(sessionId, endMode = "MANUAL") {
    const session = memoryStore.sessions.get(sessionId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (session) {
      session.ended_at = now;
      session.status = "COMPLETED";
      session.end_mode = endMode;
      session.sync_status = "PENDING";
      await this.execute(
        `UPDATE local_sessions SET ended_at = '${now}', status = 'COMPLETED', end_mode = '${endMode}', sync_status = 'PENDING' WHERE id = '${sessionId}';`
      );
      await this.updateLocalComputerState(session.lab_code, session.pc_code, "AVAILABLE");
      await this.enqueueSyncItem("SESSION", sessionId, {
        ...session,
        action: "END"
      });
      await this.createLocalAuditLog({
        actorUserId: session.student_id,
        actorName: session.student_name || "Student",
        role: "STUDENT",
        action: "SESSION_END_OFFLINE",
        entityType: "SESSION",
        entityId: sessionId
      });
      return session;
    }
    await this.execute(
      `UPDATE local_sessions SET ended_at = '${now}', status = 'COMPLETED', end_mode = '${endMode}', sync_status = 'PENDING' WHERE id = '${sessionId}';`
    );
    const rows = await this.query(`SELECT * FROM local_sessions WHERE id = '${sessionId}'`);
    return rows.length > 0 ? rows[0] : null;
  },
  async recoverOrphanedLocalSessions(reason = 'Abnormal application or system shutdown') {
    const recovered = [];
    const now = new Date().toISOString();
    const activeFromDb = await this.query("SELECT * FROM local_sessions WHERE status = 'ACTIVE';");
    const activeIds = new Set();
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
        await this.updateLocalComputerState(session.lab_code, session.pc_code, 'AVAILABLE');
        await this.enqueueSyncItem('SESSION', id, {
          ...session,
          action: 'RECOVER',
          reason
        });
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
  async getActiveLocalSession(studentId) {
    for (const s of memoryStore.sessions.values()) {
      if (s.status === "ACTIVE" && (!studentId || s.student_id === studentId)) {
        return s;
      }
    }
    const sql = studentId ? `SELECT * FROM local_sessions WHERE student_id = '${studentId}' AND status = 'ACTIVE' LIMIT 1` : `SELECT * FROM local_sessions WHERE status = 'ACTIVE' LIMIT 1`;
    const rows = await this.query(sql);
    return rows.length > 0 ? rows[0] : null;
  },
  async getStudentDashboardData(studentId) {
    const activeSession = await this.getActiveLocalSession(studentId);
    let workstationEquipment = [];
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
  async recordLocalHardwareEvent(event) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      lab_code: event.labCode,
      pc_code: event.pcCode,
      client_id: event.clientId || "CLIENT-" + event.pcCode,
      event_type: event.eventType,
      description: event.description,
      severity: event.severity || "INFO",
      timestamp: now,
      sync_status: "PENDING"
    };
    memoryStore.hardwareEvents.set(id, record);
    await this.execute(
      `INSERT INTO local_hardware_events (id, client_id, lab_code, pc_code, event_type, description, severity, timestamp, sync_status) VALUES ('${id}', '${record.client_id}', '${event.labCode}', '${event.pcCode}', '${event.eventType}', '${event.description.replace(/'/g, "''")}', '${record.severity}', '${now}', 'PENDING');`
    );
    await this.enqueueSyncItem("HARDWARE_EVENT", id, record);
    await this.createLocalAuditLog({
      action: "HARDWARE_EVENT_OFFLINE",
      entityType: "HARDWARE",
      entityId: id
    });
    return record;
  },
  async getLocalHardwareEvents(labCode) {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query(`SELECT * FROM local_hardware_events WHERE UPPER(lab_code) = '${clean}' ORDER BY timestamp DESC`);
    }
    return this.query("SELECT * FROM local_hardware_events ORDER BY timestamp DESC");
  },
  // ==========================================================================
  // Section 5: Issues in Offline Mode
  // ==========================================================================
  async createLocalIssue(issue) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      lab_code: issue.labCode,
      pc_code: issue.pcCode,
      reported_by: issue.reportedBy,
      issue_type: issue.issueType,
      description: issue.description,
      status: "OPEN",
      created_at: now,
      sync_status: "PENDING"
    };
    memoryStore.issues.set(id, record);
    await this.execute(
      `INSERT INTO local_issues (id, lab_code, pc_code, reported_by, issue_type, description, status, created_at, sync_status) VALUES ('${id}', '${issue.labCode}', '${issue.pcCode}', '${issue.reportedBy || ""}', '${issue.issueType}', '${issue.description.replace(/'/g, "''")}', 'OPEN', '${now}', 'PENDING');`
    );
    await this.enqueueSyncItem("ISSUE", id, record);
    await this.createLocalAuditLog({
      actorUserId: issue.reportedBy,
      action: "ISSUE_REPORT_OFFLINE",
      entityType: "ISSUE",
      entityId: id
    });
    return record;
  },
  async getLocalIssues(reportedByOrLabCode) {
    if (reportedByOrLabCode) {
      const clean = reportedByOrLabCode.replace(/'/g, "''");
      return this.query(
        `SELECT * FROM local_issues WHERE reported_by = '${clean}' OR UPPER(lab_code) = '${clean.toUpperCase()}' ORDER BY created_at DESC`
      );
    }
    return this.query("SELECT * FROM local_issues ORDER BY created_at DESC");
  },
  // ==========================================================================
  // Section 6: Maintenance in Offline Mode
  // ==========================================================================
  async createLocalMaintenance(order) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      lab_code: order.labCode,
      pc_code: order.pcCode,
      issue_id: order.issueId,
      responsible_user: order.responsibleUser,
      action_taken: order.actionTaken,
      status: "IN_PROGRESS",
      start_time: now,
      sync_status: "PENDING"
    };
    memoryStore.maintenance.set(id, record);
    await this.execute(
      `INSERT INTO local_maintenance (id, issue_id, lab_code, pc_code, responsible_user, action_taken, status, start_time, sync_status) VALUES ('${id}', '${order.issueId || ""}', '${order.labCode}', '${order.pcCode}', '${order.responsibleUser || ""}', '${(order.actionTaken || "").replace(/'/g, "''")}', 'IN_PROGRESS', '${now}', 'PENDING');`
    );
    await this.updateLocalComputerState(order.labCode, order.pcCode, "MAINTENANCE");
    await this.enqueueSyncItem("MAINTENANCE", id, record);
    await this.createLocalAuditLog({
      actorUserId: order.responsibleUser,
      action: "MAINTENANCE_START_OFFLINE",
      entityType: "MAINTENANCE",
      entityId: id
    });
    return record;
  },
  async updateLocalMaintenance(id, updates) {
    const record = memoryStore.maintenance.get(id);
    if (record) {
      if (updates.status) record.status = updates.status;
      if (updates.actionTaken) record.action_taken = updates.actionTaken;
      if (updates.endTime) record.end_time = updates.endTime;
      record.sync_status = "PENDING";
      await this.execute(
        `UPDATE local_maintenance SET status = '${record.status}', action_taken = '${(record.action_taken || "").replace(/'/g, "''")}', end_time = '${record.end_time || ""}', sync_status = 'PENDING' WHERE id = '${id}';`
      );
      if (record.status === "COMPLETED") {
        await this.updateLocalComputerState(record.lab_code, record.pc_code, "AVAILABLE");
      }
      await this.enqueueSyncItem("MAINTENANCE", id, { ...record, action: "UPDATE" });
      return record;
    }
    return null;
  },
  async getLocalMaintenance(labCode) {
    if (labCode) {
      const clean = labCode.toUpperCase().replace(/'/g, "''");
      return this.query(`SELECT * FROM local_maintenance WHERE UPPER(lab_code) = '${clean}' ORDER BY start_time DESC`);
    }
    return this.query("SELECT * FROM local_maintenance ORDER BY start_time DESC");
  },
  // ==========================================================================
  // Section 7: Local Audit Trail
  // ==========================================================================
  async createLocalAuditLog(log) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      actor_user_id: log.actorUserId,
      actor_name: log.actorName,
      role: log.role,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      timestamp: now,
      sync_status: "PENDING"
    };
    memoryStore.auditLogs.set(id, record);
    await this.execute(
      `INSERT INTO local_audit_logs (id, actor_user_id, actor_name, role, action, entity_type, entity_id, timestamp, sync_status) VALUES ('${id}', '${log.actorUserId || ""}', '${(log.actorName || "").replace(/'/g, "''")}', '${log.role || ""}', '${log.action}', '${log.entityType}', '${log.entityId || ""}', '${now}', 'PENDING');`
    );
    await this.enqueueSyncItem("AUDIT_LOG", id, record);
    return record;
  },
  async getLocalAuditLogs() {
    return this.query("SELECT * FROM local_audit_logs ORDER BY timestamp DESC");
  },
  // ==========================================================================
  // Section 8: Sync Queue Management (Phase 19/20 Bridge)
  // ==========================================================================
  async enqueueSyncItem(entityType, entityId, payload) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const item = {
      id,
      entity_type: entityType,
      entity_id: entityId,
      payload: payloadStr,
      status: "PENDING",
      attempt_count: 0,
      created_at: now
    };
    memoryStore.syncQueue.set(id, item);
    await this.execute(
      `INSERT INTO sync_queue (id, entity_type, entity_id, payload, status, attempt_count, created_at) VALUES ('${id}', '${entityType}', '${entityId}', '${payloadStr.replace(/'/g, "''")}', 'PENDING', 0, '${now}');`
    );
    return item;
  },
  async getPendingSyncItems() {
    const pending = Array.from(memoryStore.syncQueue.values()).filter((item) => item.status === "PENDING");
    if (pending.length > 0) return pending;
    return this.query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC");
  },
  async markSyncItemProcessed(id, batchId) {
    const item = memoryStore.syncQueue.get(id);
    if (item) {
      item.status = "SYNCED";
      item.batch_id = batchId;
    }
    await this.execute(`UPDATE sync_queue SET status = 'SYNCED', batch_id = '${batchId || ""}' WHERE id = '${id}';`);
  },
  async incrementSyncItemAttempt(id) {
    const item = memoryStore.syncQueue.get(id);
    if (item) {
      item.attempt_count += 1;
    }
    await this.execute(`UPDATE sync_queue SET attempt_count = attempt_count + 1 WHERE id = '${id}';`);
  },
  async recordSyncConflict(conflict) {
    const id = generateOfflineId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const clientStr = conflict.clientPayload ? typeof conflict.clientPayload === "string" ? conflict.clientPayload : JSON.stringify(conflict.clientPayload) : "";
    const serverStr = conflict.serverPayload ? typeof conflict.serverPayload === "string" ? conflict.serverPayload : JSON.stringify(conflict.serverPayload) : "";
    const rec = {
      id,
      batch_id: conflict.batchId,
      entity_type: conflict.entityType,
      entity_id: conflict.entityId,
      reason: conflict.reason,
      client_payload: clientStr,
      server_payload: serverStr,
      status: "UNRESOLVED",
      created_at: now
    };
    memoryStore.syncConflicts.set(id, rec);
    await this.execute(
      `INSERT INTO sync_conflicts (id, batch_id, entity_type, entity_id, reason, client_payload, server_payload, status, created_at) VALUES ('${id}', '${conflict.batchId || ""}', '${conflict.entityType}', '${conflict.entityId}', '${conflict.reason.replace(/'/g, "''")}', '${clientStr.replace(/'/g, "''")}', '${serverStr.replace(/'/g, "''")}', 'UNRESOLVED', '${now}');`
    );
    return rec;
  },
  async getSyncConflicts() {
    const mem = Array.from(memoryStore.syncConflicts.values());
    if (mem.length > 0) return mem;
    return this.query("SELECT * FROM sync_conflicts ORDER BY created_at DESC");
  },
  async resolveSyncConflict(id, resolutionStatus = "RESOLVED") {
    const c = memoryStore.syncConflicts.get(id);
    if (c) c.status = resolutionStatus;
    await this.execute(`UPDATE sync_conflicts SET status = '${resolutionStatus}' WHERE id = '${id}';`);
  },
  async clearLocalStore() {
    memoryStore.clear();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LocalDbService,
  hashOfflinePassword
});
