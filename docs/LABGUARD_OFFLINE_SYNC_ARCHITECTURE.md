# LABGUARD v2.5.0: Offline-First & Synchronization Architecture

---

## 1. Local-First Write Pipeline

Every business mutation initiated on the workstation (session start, session end, peripheral disconnection event, issue report) executes through the Local-First Pipeline:

```
User Action / Hardware Event
          │
          ▼
Application Service Layer
          │
          ▼
SQLite Local Transaction (%ProgramData%\LABGUARD\database\labguard.db)
          │
          ├──> Written to local table (e.g. local_sessions)
          │
          └──> Enqueued in sync_queue with unique idempotency_key
          │
          ▼
Instant UI Feedback (No blocking on cloud network latency)
          │
          ├──[ IF ONLINE ]───> Background Sync Worker triggers immediately
          │
          └──[ IF OFFLINE ]──> Retained in SQLite, status marked PENDING
```

---

## 2. Idempotency & Conflict Handling

- **Idempotency**:
  - Every sync queue item carries a deterministic `idempotency_key` composed of `${client_id}:${entity_type}:${entity_id}:${operation}`.
  - Retried HTTP requests return the previous acknowledgement without duplicating server-side rows.
- **UUID Continuity**:
  - Entities created offline (e.g. issues, sessions, telemetry events) generate standard UUIDv4 locally.
  - When synchronized to Supabase, the identical UUID is persisted into the central PostgreSQL table. No ID translation or re-keying occurs.
- **Conflict Strategy**:
  - `SERVER_WINS` for authoritative reference tables (Roles, Academic Hierarchy, System Policies).
  - `CLIENT_WINS` / Merge for local diagnostic telemetry and hardware events.
  - Conflict events are logged to `sync_conflicts` for administrative auditing.

---

## 3. Network State Telemetry

The desktop interface displays real-time connectivity status:
- **`● ONLINE`**: Heartbeat actively acknowledged by Central API; sync queue empty.
- **`● OFFLINE (Changes Pending: N)`**: Local operations continuing safely; background retry scheduled.
- **`● SYNCING`**: Transmitting pending batches to `/api/sync/batch`.
