# LABGUARD Architecture Documentation

> **Tagline:** “Authenticate • Monitor • Protect • Manage”  
> **Mission:** Centralized computer laboratory access, monitoring, equipment accountability, session tracking, notification, and maintenance management system for higher education institutions.

---

## 1. High-Level Architecture

LABGUARD operates as a secure, distributed multi-tier system composed of four major components:

```
                  ┌─────────────────────────────────────────┐
                  │     Physical Laboratory Workstations    │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │     Physical Laboratory Workstations    │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │     LABGUARD Native System Application  │
                  │     (Tauri 2, React 18, Rust, Win32)    │
                  │     - Offline-First Local SQLite DB     │
                  │     - Kiosk & USB Peripheral Monitor    │
                  │     - Student Auto-Shutdown Manager     │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼ HTTP & WebSocket (Port 5000)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Node.js + Express Central API                         │
│  - JWT Authentication + Scoped RBAC Route Guards                            │
│  - REST Controllers (Labs, PCs, Equipment, Sessions, Issues, Academic)     │
│  - Idempotent Sync Batch API & WebSocket Real-time Telemetry Dispatcher     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ PostgreSQL Connection Pool
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Central PostgreSQL Database (Supabase)                  │
│  - Normalized Tables (UUIDs, Foreign Keys, Performance Indexes)             │
│  - Multi-Department & Multi-Laboratory Academic Scoping                     │
│  - Central Audit Logs & Global History                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Exactly Four Institutional Roles (Zero Super Admin)

The platform enforces strictly **FOUR** application roles:

| Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **`ADMIN`** | Institutional (All Labs + All System Controls) | Manages labs, workstations, equipment assets, user accounts, staff assignments, reports, analytics, system settings, and audit logs. |
| **`FACULTY`** | Assigned Labs + Classes Only | Access restricted strictly to assigned laboratories (`user_lab_assignments`). Starts/ends scheduled classes, monitors student PC assignments live, verifies reported issues, requests maintenance. |
| **`LAB_ASSISTANT`** | Assigned Labs Only | Monitors workstation fleet, live occupancy ("Who is in the lab?" / "Who left the lab?"), tracks peripheral health (Keyboards, Mice), logs neutral hardware events, manages issues and repair tickets. |
| **`STUDENT`** | Self Only | Authenticates on physical lab PCs, views active session & verified peripherals (Keyboard: VERIFIED, Mouse: VERIFIED), reports issues with photo evidence, views ticket timeline and session history. |

---

## 3. Monorepo Organization

```
Labguard-Software/
├── desktop/              # Tauri 2 (Rust) + React 18 + Tailwind CSS Desktop Client
├── backend/              # Node.js 20+, Express 4, TypeScript, WebSocket server
├── database/             # PostgreSQL migrations (Supabase) and seed scripts
├── installer/            # Inno Setup Windows installer scripts & PowerShell automation
├── shared/               # Shared TypeScript data models and enums
└── docs/                 # Exhaustive technical documentation
```

---

## 4. Hardware Accountability Philosophy

A core tenet of LABGUARD is objective, neutral hardware tracking:
- Every workstation has asset-tagged peripherals registered (e.g. `KB-017` for Keyboards, `MS-017` for Mice).
- A USB disconnect event is **NEVER** treated as automatic proof of physical damage or student misconduct.
- Disconnect events are neutrally recorded as *"Mouse connection lost"* or *"Keyboard connection lost"*.
- If an incident occurs, a complete timeline is maintained combining student login, hardware check, disconnect event, report submission, and technician resolution.
