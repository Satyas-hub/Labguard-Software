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
                  │     LABGUARD Native System Application  │
                  │     (.NET 8, WPF, MVVM, Win32/WMI)      │
                  │     - Offline-First Local SQLite DB     │
                  │     - Kiosk & USB Peripheral Monitor    │
                  │     - Student Auto-Shutdown Manager     │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼ HTTPS (REST API & Batch Sync)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Java Spring Boot 3 Backend API                         │
│  - Spring Security 6 (Stateless JWT + Strict RBAC LabSecurityEvaluator)      │
│  - REST Controllers (Labs, PCs, Equipment, Sessions, Issues, Notifications) │
│  - Idempotent Sync Batch API & WebSocket Real-time Dispatcher               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Central PostgreSQL Database                       │
│  - Normalized Tables (UUIDs, Foreign Keys, Performance Indexes)             │
│  - user_lab_assignments Table for Dynamic Laboratory Isolation               │
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
LABGUARD/
├── frontend/             # Next.js 14/15 App Router, Tailwind CSS, Lucide, Recharts
├── backend/              # Java 17, Spring Boot 3.3, Spring Security 6, WebSocket
├── windows-client/       # C# .NET 8 WPF Application for physical workstation kiosk
├── database/             # PostgreSQL migrations and seed scripts
│   ├── migrations/       # 01_initial_schema.sql, 02_indexes_and_rls.sql
│   └── seed/             # 01_seed_data.sql (7 Labs, 70+ PCs, 140+ peripherals, users)
├── docs/                 # Exhaustive technical documentation
└── scripts/              # Docker Compose, PowerShell, and Bash deployment automation
```

---

## 4. Hardware Accountability Philosophy

A core tenet of LABGUARD is objective, neutral hardware tracking:
- Every workstation has asset-tagged peripherals registered (e.g. `KB-017` for Keyboards, `MS-017` for Mice).
- A USB disconnect event is **NEVER** treated as automatic proof of physical damage or student misconduct.
- Disconnect events are neutrally recorded as *"Mouse connection lost"* or *"Keyboard connection lost"*.
- If an incident occurs, a complete timeline is maintained combining student login, hardware check, disconnect event, report submission, and technician resolution.
