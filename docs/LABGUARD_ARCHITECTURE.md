# LABGUARD v2.5.0: System Architecture Specification

**Version**: 2.5.0 Production Gold Master  
**Target Platform**: Microsoft Windows 10/11 x64  
**Runtime**: Tauri 2 + React 18 + Node.js/Express + SQLite + Supabase PostgreSQL  

---

## 1. High-Level Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LABGUARD Client Workstation (Windows 10/11)          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               React 18 Frontend UI (Tauri Webview)             │   │
│   │                                                                │   │
│   │  [ Login Gate ]  [ Student View ]  [ Faculty/Staff Dashboards ]│   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ IPC / Tauri Commands               │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │               Native Windows Rust Engine (Tauri 2)             │   │
│   │                                                                │   │
│   │  • Win32 Mutex Single Instance • Hardware PnP Telemetry Query  │   │
│   │  • %ProgramData% File Storage   • Safe Windows Auto-Shutdown    │   │
│   │  • Windows Autostart Registry  • Client GUID Identity Binding  │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Local Transaction                  │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │         Local SQLite Primary Operational Store                 │   │
│   │                                                                │   │
│   │  • local_sessions   • sync_queue   • local_issues   • audit     │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ HTTP / WebSocket (Port 5000)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    LABGUARD Central Node/Express API                   │
│                                                                        │
│   • JWT Auth & Scoped RBAC         • Hardware & Peripherals Manager    │
│   • Academic & Assignment Services • Real-Time WebSocket Broadcaster   │
│   • Idempotent Sync Batch Engine   • Audit & Security Event Stream     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PostgreSQL Connection Pool
┌───────────────────────────────────▼────────────────────────────────────┐
│                  Central Supabase PostgreSQL (Cloud)                   │
│                                                                        │
│   • 40 Relational Tables           • Zero Business Demo Data           │
│   • Role-Level Security (RLS)      • Complete Historical Audit Logs    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4 Strict Institutional Roles

1. **`ADMIN`**:
   - Institutional authority with complete control over people, infrastructure, academic hierarchies, assignments, schedules, telemetry, and system maintenance.
2. **`FACULTY`**:
   - Academic instructors restricted strictly to assigned classes, subjects, laboratories, and authorized student rosters.
   - Access to dynamic Upcoming, Ongoing, and Completed laboratory batch schedules.
3. **`LAB_ASSISTANT`**:
   - Operational lab stewards restricted strictly to assigned laboratories and designated monitoring batches.
   - Access to live peripheral health indicators, incident triage, and maintenance records.
4. **`STUDENT`**:
   - Workstation self-service restricted to active session tracking, personal equipment validation, and verified issue reporting.
   - Upon ending a lab session, automatically initiates controlled Windows power-off.

---

## 3. Workstation Identity & Rebinding Lifecycle

- **`CLIENT_ID`**: Deterministically generated UUID persisted in `%ProgramData%\LABGUARD\config\workstation.json`.
- **`LAB_CODE` & `PC_CODE`**: Assigned and authorized by Administrator.
- **Reinstall / Rebind Protocol**:
  - When an existing workstation is reinstalled or imaged, it receives a new Client UUID (`Client B`).
  - Administrator rebinds `Client B` to the existing `PC-017` record in `computers`.
  - All historical session history, hardware telemetry, issue logs, and maintenance logs remain linked to `PC-017`.
  - No duplicate computer entities are created.
