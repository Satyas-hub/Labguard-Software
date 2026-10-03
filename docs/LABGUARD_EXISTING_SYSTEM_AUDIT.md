# LABGUARD Existing System Audit Report (v2.5.0 Upgrade)

**Audit Date**: September 20, 2026  
**Auditor**: Principal System Architect & Senior Full-Stack Engineer  
**Target Platform**: Native Windows 10/11 x64 (Tauri 2 + React + Node/Express + SQLite + Supabase)

---

## 1. Executive Summary

This audit establishes a complete architectural, functional, and schema inventory of the existing **LABGUARD** system prior to executing the master v2.5.0 upgrade. The audit confirms that the existing implementation already contains robust, high-value components (Express REST server, WebSocket service, Supabase sync bridge, Tauri 2 Rust native bridge, and a comprehensive 4-role React desktop interface). 

All existing components and the 37 Supabase tables are **healthy, online, and strictly preserved**. The upgrade will extend the schema non-destructively, synchronize all version identifiers to **2.5.0**, implement strict role-scoped server-side filtering for Faculty and Lab Assistants, and enforce the PC identity and rebind lifecycles.

---

## 2. Technology Stack & Component Inventory

### 2.1 Desktop Runtime & Frontend (`/desktop`)
- **Runtime**: Tauri 2 (`@tauri-apps/api/core` v2.0.0, `@tauri-apps/plugin-shell` v2.0.0)
- **Frontend Framework**: React 18 with TypeScript 5
- **Styling**: Tailwind CSS v3 with custom modern enterprise styling
- **Views**:
  - `LoginView.tsx` (31 KB): Role segmented access, device manager hardware diagnostics, server URL discovery modal.
  - `AdminView.tsx` (339 KB): Complete institutional control across Overview, People, Labs, Academic, Enrollment, Audit, and Settings.
  - `FacultyView.tsx` (75 KB): Academic class management, student roster, attendance verification, lab assignment view.
  - `LabAssistantView.tsx` (106 KB): Live PC statuses, peripheral health telemetry, hardware events, incident/maintenance logging.
  - `StudentView.tsx` (50 KB): Active session tracking, peripheral indicators, self-service issue reporting, End Session & Shutdown dialog.
  - `UnregisteredLockScreen.tsx` (24 KB): Terminal gate blocking unassigned workstations with Client GUID display and admin registration PIN.
- **Local Database & Services**:
  - `localDb.ts` (41 KB): Local SQLite / browser-isolated storage managing offline sessions, hardware telemetry, issues, and sync queues.
  - `native.ts` (8.4 KB): IPC bridge invoking Tauri Rust commands (`get_pc_identity`, `set_pc_identity`, `get_hardware_status`, `request_safe_shutdown`, etc.).
  - `startupSequence.ts` (8 KB): 4-stage boot sequence verifying local SQLite schema, hardware binding, security gateway, and Windows autostart registry.
  - `syncEngine.ts` (10.6 KB): Offline-first batch synchronization engine uploading queued actions to the central Express API.

### 2.2 Native Windows Integration (`/desktop/src-tauri`)
- **Rust Engine**: Rust 2021 edition, Tauri 2.0.0, `windows` crate v0.56 (`Win32_System_Shutdown`, `Win32_Security`, `Win32_Foundation`, `Win32_UI_WindowsAndMessaging`, `Win32_System_Threading`).
- **Core Native Capabilities**:
  - Enterprise data directories under `%ProgramData%\LABGUARD\` (`database/`, `sync/`, `logs/`, `evidence/`, `config/`).
  - Single-instance enforcement via Windows Win32 Mutex `Local\LABGUARD_DESKTOP_SINGLE_INSTANCE_MUTEX`.
  - Windows PnP hardware device querying (detecting Keyboards, Pointing Devices, and Monitors via PowerShell/WMI fallback and native API).
  - Native system shutdown (`InitiateSystemShutdownExW` / `ExitWindowsEx`) strictly constrained to authenticated Student sessions.
  - Windows Autostart registry integration under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

### 2.3 Backend Server (`/backend`)
- **Runtime**: Node.js v20+, Express v4.19, TypeScript v5.3.
- **Protocol**: HTTP/REST on Port 5000 + WebSocket on `/ws`.
- **Database Engine**: `pg` Pool connecting to central Supabase PostgreSQL, complemented by memory-store resilience.
- **Controllers & Middleware**:
  - `authController.ts` & `auth.ts`: JWT authentication, bcrypt hash validation, strict RBAC (`requireRoles`), and scoped data filters (`enforceFacultyScope`, `enforceLabAssistantScope`, `enforceStudentSelfScope`, `enforceLabScope`).
  - `academicController.ts`: Departments, courses, academic years, semesters, sections, classes, and enrollment workflows.
  - `labController.ts`: Laboratories, computers, client registration, workstation heartbeats, hardware telemetry.
  - `equipmentController.ts`: Peripherals asset tracking, slot assignments, and replacement tracking.
  - `sessionController.ts`: Student session validation, session initiation, crash recovery, and scoped termination.
  - `issueController.ts`: Issue reporting lifecycle, status updates, and maintenance scheduling.
  - `assistantController.ts`: Lab Assistant dashboard, hardware events acknowledgement, and maintenance records.
  - `supabaseSyncService.ts`: Real-time and batch synchronization bridge streaming workstation events to Supabase.

---

## 3. Database Schema Verification (Supabase Cloud)

Live inspection of the Supabase PostgreSQL database (`https://nzonwmhyxbashmyrlzig.supabase.co`) confirmed all 37 foundational tables are **active, intact, and properly structured**:

| # | Table Name | Existing Row Count | Integrity Status |
|---|------------|--------------------|------------------|
| 1 | `roles` | 4 | Baseline roles active (`ADMIN`, `FACULTY`, `LAB_ASSISTANT`, `STUDENT`) |
| 2 | `users` | 1 | Bootstrap Admin active (`admin@labguard.edu`) |
| 3 | `system_settings` | 1 | Production setting active (`student_enrollment_policy`) |
| 4 | `students` | 0 | Clean schema, ready |
| 5 | `faculty` | 0 | Clean schema, ready |
| 6 | `lab_assistants` | 0 | Clean schema, ready |
| 7 | `labs` | 0 | Clean schema, ready |
| 8 | `computers` | 0 | Clean schema, ready |
| 9 | `clients` | 0 | Clean schema, ready |
| 10 | `equipment` | 0 | Clean schema, ready |
| 11 | `computer_equipment` | 0 | Clean schema, ready |
| 12 | `classes` | 0 | Clean schema, ready |
| 13 | `class_faculty` | 0 | Clean schema, ready |
| 14 | `class_students` | 0 | Clean schema, ready |
| 15 | `class_sessions` | 0 | Clean schema, ready |
| 16 | `academic_departments` | 0 | Clean schema, ready |
| 17 | `academic_courses` | 0 | Clean schema, ready |
| 18 | `academic_classes` | 0 | Clean schema, ready |
| 19 | `academic_years` | 0 | Clean schema, ready |
| 20 | `sections` | 0 | Clean schema, ready |
| 21 | `semesters` | 0 | Clean schema, ready |
| 22 | `subjects` | 0 | Clean schema, ready |
| 23 | `user_lab_assignments` | 0 | Clean schema, ready |
| 24 | `student_class_assignments` | 0 | Clean schema, ready |
| 25 | `sessions` | 0 | Clean schema, ready |
| 26 | `issues` | 0 | Clean schema, ready |
| 27 | `issue_events` | 0 | Clean schema, ready |
| 28 | `maintenance` | 0 | Clean schema, ready |
| 29 | `hardware_events` | 0 | Clean schema, ready |
| 30 | `notifications` | 0 | Clean schema, ready |
| 31 | `notification_preferences` | 0 | Clean schema, ready |
| 32 | `audit_logs` | 0 | Clean schema, ready |
| 33 | `sync_events` | 0 | Clean schema, ready |
| 34 | `sync_conflicts` | 0 | Clean schema, ready |
| 35 | `enrollment_requests` | 0 | Clean schema, ready |
| 36 | `departments` | 0 | Clean schema, ready |
| 37 | `courses` | 0 | Clean schema, ready |

---

## 4. Gap Analysis & Additions Required

1. **Academic Assignments & Batch Schedules**:
   - Need dedicated, direct relational structures for:
     - `faculty_lab_batch_assignments`: Direct linkage between Faculty + Lab + Class/Batch + Subject.
     - `lab_assistant_batch_assignments`: Direct linkage between Lab Assistant + Lab + Class/Batch.
     - `class_schedules`: Detailed time-table slot tracking (`schedule_date`, `start_time`, `end_time`, `status`: `UPCOMING`, `ONGOING`, `COMPLETED`, `CANCELLED`).
2. **Rebind Client Lifecycle**:
   - When a workstation is reimaged or reinstalled, the new `client_id` must rebind cleanly to the existing `computer_id` and `pc_code` in `clients` and `computers` without generating a duplicate computer entity or losing historical sessions/hardware events.
3. **Display Scaling on 1366×768**:
   - Optimize card height and button margins in `LoginView.tsx` and session status cards so interactive controls are never pushed below the taskbar.
4. **Synchronized Global Version Numbering**:
   - Increment all 8 version files to **`2.5.0`**.

---

## 5. Non-Destructive Integration Strategy

- **No existing tables or rows will be altered destructively**.
- A new forward migration `05_production_master_upgrade.sql` will be introduced.
- Existing controllers and services will be enriched with the required batch assignment and timetable calculation queries.
- Zero fake data will be injected.
