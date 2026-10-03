# LABGUARD

> **“Authenticate • Monitor • Protect • Manage”**  
> *LABGUARD is a centralized, role-based native Windows computer laboratory access, monitoring, equipment accountability, notification, and offline-first management platform for educational institutions.*

---

## 🛡 System Overview

LABGUARD is engineered specifically as a **100% Native Windows System Application** for higher education institutions operating computer laboratories. It operates both **ONLINE** and **OFFLINE** with automatic background synchronization to the central Spring Boot database.

- **Native Windows WPF:** Built using C# .NET 8, WPF, and MVVM architecture. Zero web browser or WebView dependencies.
- **Offline-First SQLite Database:** Uses `Microsoft.EntityFrameworkCore.Sqlite` for local-first operations. All student sessions, hardware events, issues, and audit logs are recorded locally even without network.
- **Central Synchronization Engine:** Automatically syncs pending local events to the central Spring Boot REST API when network connectivity is restored.
- **Strict Role-Based Access Control (RBAC):** Exactly **FOUR** institutional roles (`ADMIN`, `FACULTY`, `LAB_ASSISTANT`, `STUDENT`). No role switcher; authenticated role is verified by backend/local identity.
- **Event-Driven WMI Hardware Monitoring:** Watches USB peripheral insertion/removal (`Win32_PnPEntity`, `Win32_Keyboard`, `Win32_PointingDevice`) to verify keyboards and mice without polling overhead.
- **Student Session & Automatic Shutdown:** Floating HUD overlay for active student sessions. Ending a student session initiates an automatic 10-second Windows countdown and clean machine shutdown. (Faculty and Admin logouts never shut down the PC).
- **Professional Light Theme:** Clean institutional light styling (white cards `#ffffff`, light slate background `#f8fafc`, dark navy typography `#0f172a`, brand blue accents `#2563eb`).
- **No Mock / Fake Data:** Fresh installation boots into a pristine empty state ready for institutional provisioning. Baseline Admin: `admin@labguard.edu` / `Admin@123456`.

---

## 🏛 Solution Architecture (`src/`)

```
LABGUARD/
│
├── LABGUARD.exe                      # Standalone single-file native Windows executable
│
├── src/
│   ├── LABGUARD.sln                  # Master Visual Studio / .NET 8 Solution
│   ├── LABGUARD.Core/                # Domain entities, enums (Role, SessionStatus, SyncStatus, HardwareEventType)
│   ├── LABGUARD.Data/                # SQLite DbContext (EF Core), local repositories, password hashing
│   ├── LABGUARD.Application/         # Interfaces, DTOs, ApiClient REST communication
│   ├── LABGUARD.Security/            # Dual-mode (Online/Offline) AuthenticationService & RBAC
│   ├── LABGUARD.Hardware/            # Low-resource WMI hardware monitor, keyboard & mouse detection
│   ├── LABGUARD.Sync/                # Background SyncEngine, batch synchronization, idempotency
│   ├── LABGUARD.Notifications/       # Native in-app notifications, anti-flood cooldown & deduplication
│   └── LABGUARD.Desktop/             # WPF Application Shell (Login, Student, Faculty, Assistant, Admin views)
│       └── Assets/                   # Institutional branding icons (logo.ico, logo.png)
│
├── backend/                          # Java 17, Spring Boot 3.3, Spring Security 6 central API
│   ├── src/main/java/com/labguard/   # Entities, Repositories, Controllers, Services
│   └── pom.xml
│
├── database/                         # PostgreSQL / Supabase Schema & Migrations
│   ├── migrations/                   # 01_initial_schema.sql, 02_indexes_and_rls.sql, 03_production_academic_and_enrollment.sql
│   └── seed/                         # 01_seed_data.sql (Clean bootstrap administrator)
│
├── dist/                             # Compiled self-contained release binaries
├── docs/                             # Exhaustive technical documentation
└── scripts/
    ├── build_executables.ps1         # Rebuilds the .NET 8 solution and standalone LABGUARD.exe
    └── install_labguard.ps1          # Installs to AppData, registers in Add/Remove Programs, creates Desktop shortcut
```

---

## 🚀 Building & Running

### 1. Launching the Application
Double-click **`LABGUARD.exe`** on your Desktop or in the project root:
- Automatically loads the local SQLite database (`%LOCALAPPDATA%\LabGuard\labguard_offline.db`).
- Discovers network state and displays live `● ONLINE` or `○ OFFLINE` status.
- Single-instance mutex prevents duplicate instances.

### 2. Rebuilding the Native Application
Run the PowerShell build script:
```powershell
.\scripts\build_executables.ps1
```
This script compiles `src/LABGUARD.sln`, publishes a standalone single-file binary to `dist/`, updates `LABGUARD.exe`, and refreshes Desktop shortcuts.

### 3. Central Spring Boot Backend
```powershell
cd backend
mvn spring-boot:run
```
Listens on `http://localhost:8080`.
