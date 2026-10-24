# LABGUARD

> **“Authenticate • Monitor • Protect • Manage”**  
> *Enterprise-grade, role-based native Windows computer laboratory access control, hardware monitoring, equipment accountability, real-time notifications, and offline-first management platform for educational institutions.*

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D4?logo=windows)](https://microsoft.com/windows)
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%202.0-24C8D8?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Native%20Engine-Rust%202021-DEA584?logo=rust)](https://www.rust-lang.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%2020%2B%20%7C%20Express%204-339933?logo=nodedotjs)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Supabase-3ECF8E?logo=supabase)](https://supabase.com/)
[![Local Storage](https://img.shields.io/badge/Local%20Cache-SQLite%20(rusqlite)-003B57?logo=sqlite)](https://sqlite.org/)

---

## 🛡️ System Overview

LABGUARD is engineered specifically as an institutional **Native Windows System Application** for higher education institutions and university computer laboratories. It functions seamlessly in both **ONLINE** and **OFFLINE** modes with automated background synchronization to a central synchronization API.

- **Native Windows Desktop Shell:** Powered by **Tauri 2** (Rust) rendering a hardware-accelerated **React 18 + Tailwind CSS** interface using Microsoft Edge WebView2 with minimal memory footprint (~40–70MB RAM).
- **Direct Win32 & WMI OS Integration:** Native Rust backend leverages the Windows API (`windows` crate 0.56) for single-instance mutex enforcement, PnP peripheral telemetry query, and controlled workstation lockdown.
- **Offline-First SQLite Resilience:** Workstations embed a 14-table local SQLite database (`rusqlite`) in `%ProgramData%\LABGUARD\database\labguard.db`. Student sessions, hardware events, and issue tickets are captured locally even when disconnected from the campus network.
- **Bi-Directional Idempotent Synchronization:** Background sync engine automatically batches and transmits pending local transactions to the central Node/Express REST API when network connectivity is verified.
- **Strict 4-Role Access Control (RBAC):** Exactly four scoped institutional roles: `ADMIN`, `FACULTY`, `LAB_ASSISTANT`, and `STUDENT`.
- **Event-Driven Hardware & Peripheral Monitoring:** Real-time detection of USB peripheral connectivity (Keyboards, Mice, Display) via Win32 device notification hooks and WMI queries.
- **Student Session & Controlled Safe Auto-Shutdown:** Displays a non-intrusive floating HUD overlay for active student sessions. Ending a student session triggers an automated 10-second countdown and clean Windows power-off (`shutdown /s /t 10`). Administrative and faculty logouts bypass shutdown.
- **Clean Institutional Light Theme:** Styled with professional educational UI guidelines (white cards `#ffffff`, slate background `#f8fafc`, navy typography `#0f172a`, brand blue accents `#2563eb`).
- **Production Packaging:** Self-contained Windows installer generated via **Inno Setup** (`LABGUARD-Setup.exe`).

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Desktop Application** | **Tauri 2** (Rust 2021) | Low-resource native container, Win32 API hooks, PnP peripheral monitor, single-instance mutex, and local IPC commands. |
| **Frontend UI** | **React 18 + TypeScript 5.3** | Component-driven UI, strictly-typed data models, modular role views, HUD overlay mode. |
| **UI Styling & Assets** | **Tailwind CSS 3.4 + Lucide React** | Institutional design system, PostCSS, responsive lab screen optimization (1366×768+). |
| **Local Offline DB** | **SQLite (bundled via `rusqlite` 0.31)** | 14 local tables storing sessions, cached credentials, audit records, and offline sync queue. |
| **Central Backend API** | **Node.js 20+ & Express 4** | RESTful endpoints on port `5000`, route-level RBAC middleware, and token management. |
| **Realtime Engine** | **WebSockets (`ws` 8.16)** | Real-time telemetry streaming, client heartbeat polling, and live fleet status broadcasts. |
| **Authentication** | **JWT & Bcrypt.js** | Dual-token authentication (8h access token + 7d refresh token), bcrypt (10 rounds), and rate limiting (HTTP 429). |
| **Central Database** | **PostgreSQL (Supabase Cloud)** | 40+ normalized relational tables, UUID primary keys, Row-Level Security (RLS), and indexing. |
| **Windows Installer** | **Inno Setup & PowerShell** | Automated deployment to `%ProgramData%\LABGUARD`, Desktop/Start Menu shortcuts, and uninstaller. |

---

## 🏛️ Monorepo Architecture

```
Labguard-Software/
│
├── desktop/                          # Native Windows Desktop Client (Tauri 2 + React)
│   ├── src/                          # React 18 frontend (views, components, db services, types)
│   │   ├── views/                    # LoginView, StudentView, FacultyView, LabAssistantView, AdminView
│   │   ├── db/                       # LocalDbService (typed local SQLite interface)
│   │   └── components/               # Header, HUD, Modals, Fleet grids
│   ├── src-tauri/                    # Native Rust Engine (Tauri 2)
│   │   ├── src/main.rs               # Win32 APIs, SQLite migrations, shutdown command, PnP monitoring
│   │   ├── Cargo.toml                # Rust dependencies (tauri, rusqlite, windows-rs, serde)
│   │   └── tauri.conf.json           # Tauri window configuration & permissions
│   ├── package.json                  # React, Vite, Tailwind dependencies
│   └── vite.config.ts                # Vite build configuration
│
├── backend/                          # Central Node/Express API & Synchronization Server
│   ├── src/
│   │   ├── server.ts                 # Express & WebSocket server initialization (Port 5000)
│   │   ├── routes/                   # REST API routes (/auth, /users, /labs, /computers, /sessions, etc.)
│   │   ├── middleware/               # Scoped RBAC guards, JWT verification, rate limiter
│   │   ├── services/                 # Database services, realtime WebSocket broadcaster, sync engine
│   │   └── config/                   # Environment variable loader and Supabase/PG pool config
│   ├── package.json                  # Node.js backend dependencies
│   └── tsconfig.json                 # Backend TypeScript configuration
│
├── database/                         # Central Database Schemas & Migrations
│   ├── migrations/                   # PostgreSQL DDL migrations (01 through 04)
│   │   ├── 01_initial_schema.sql
│   │   ├── 02_indexes_and_rls.sql
│   │   ├── 03_production_academic_and_enrollment.sql
│   │   └── 04_architecture_and_database_foundation.sql
│   └── seed/                         # Bootstrap admin and institutional seed data
│
├── shared/                           # Shared TypeScript models and enum definitions
│   └── types/
│
├── installer/                        # Inno Setup Windows deployment scripts
│   ├── setup_script.iss              # Inno Setup configuration compiler script
│   ├── build_installer.ps1           # Full build automation pipeline script
│   └── install_engine.ps1            # Workstation provisioning and registry setup
│
├── docs/                             # Exhaustive technical and architectural documentation
└── LABGUARD_FEATURES_LIST.txt        # Comprehensive system specification & feature audit
```

---

## 👥 The Four Strict Institutional Roles

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      INSTITUTIONAL ACCESS HIERARCHY                      │
├─────────────────┬────────────────────────────────────────────────────────┤
│ ADMIN           │ Full authority over institutional infrastructure,       │
│                 │ academic classes, labs, workstations, users & audit.   │
├─────────────────┼────────────────────────────────────────────────────────┤
│ FACULTY         │ Restricted strictly to assigned classes, subjects,     │
│                 │ laboratories, and authorized student rosters.          │
├─────────────────┼────────────────────────────────────────────────────────┤
│ LAB_ASSISTANT   │ Operational steward restricted to assigned labs,       │
│                 │ live peripheral health triage & maintenance tickets.   │
├─────────────────┼────────────────────────────────────────────────────────┤
│ STUDENT         │ Physical workstation access, verified peripheral       │
│                 │ verification, issue reporting, and auto-shutdown HUD.  │
└─────────────────┴────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started & Local Development

### Prerequisites

- **Node.js**: `v20.x` or higher
- **Rust Toolchain**: `stable` (edition 2021) with `cargo` (`rustup default stable`)
- **Visual Studio Build Tools**: C++ build tools for Windows
- **Operating System**: Windows 10 or Windows 11 x64

---

### 1. Database Setup (Supabase PostgreSQL)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, run the migration scripts sequentially from `database/migrations/`:
   - `01_initial_schema.sql`
   - `02_indexes_and_rls.sql`
   - `03_production_academic_and_enrollment.sql`
   - `04_architecture_and_database_foundation.sql`
3. Execute `database/seed/01_seed_data.sql` to initialize the root institutional Administrator.

---

### 2. Backend Server Setup

```powershell
cd backend

# Install dependencies
npm install

# Configure environment variables
copy .env.example .env
# Edit .env and supply your SUPABASE_URL, SUPABASE_KEY, or DATABASE_URL

# Start development server
npm run dev
```

The backend server starts on **`http://localhost:5000`** (Health check: `http://localhost:5000/health`).

---

### 3. Desktop Application Setup

```powershell
cd desktop

# Install dependencies
npm install

# Run Desktop App in Tauri 2 Development Mode
npm run tauri dev
```

Tauri will compile the Rust native layer, launch the Vite development server, and display the native Windows client window.

---

### 4. Compiling the Production Installer

To produce the standalone **`LABGUARD-Setup.exe`** Windows installer:

```powershell
.\installer\build_installer.ps1
```

The compiled installer will be output into the `dist/` directory.

---

## 🔑 Default Bootstrap Credentials

On a newly provisioned database, use the bootstrap institutional credentials:

- **Email**: `admin@labguard.edu`
- **Password**: `Admin@123456`
- **Role**: `ADMIN`

*(It is strictly recommended to update the administrative password upon first login).*

---

## 📄 License

Institutional Proprietary — LABGUARD Software Engineering. All Rights Reserved.
