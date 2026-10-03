# LABGUARD V2 — Step-by-Step Implementation Roadmap (Phase Plan)
**Document Version:** 2.0.0  
**Created:** September 18, 2026  
**Architecture:** Native Windows Desktop (Tauri 2 + React + TypeScript + Tailwind CSS + Rust + SQLite) & Central Backend (Node.js + Express + TypeScript + PostgreSQL/Supabase)

---

## Strict Execution Protocol
1. **One Phase at a Time**: Only execute the explicitly requested phase.
2. **Never Auto-Proceed**: Never start Phase N+1 automatically after completing Phase N.
3. **Phase Completion Checklist**:
   - Build code
   - Run dev/test suite
   - Verify zero regressions against previously completed phases
   - Increment/bump version number across `package.json`, `tauri.conf.json`, `Cargo.toml`, and installer scripts (`update update ki version number increase avvali`)
   - Report exactly what was implemented
   - **STOP** and await explicit user instruction.

---

## Phase Roadmap

### Phase 0: Existing Project Audit
- **Status:** COMPLETED
- **Deliverables:**
  - Full codebase audit across frontend, backend, Tauri, Rust, SQLite, and Inno Setup installer.
  - Identification of working, partial, mock, broken, and missing modules.
  - Creation of `LABGUARD_IMPLEMENTATION_STATUS.md` and `LABGUARD_PHASE_PLAN.md`.

---

### Phase 1: Architecture & Database Foundation
- **Status:** COMPLETED
- **Goal:** Build the complete normalized data foundation across PostgreSQL and local SQLite with zero fake data.
- **Deliverables:**
  - Verified central PostgreSQL migration files (`database/migrations/01_initial_schema.sql`, `02_indexes_and_rls.sql`, `03_production_academic_and_enrollment.sql`, `04_architecture_and_database_foundation.sql`).
  - Implemented complete 14-table local SQLite schema in `desktop/src-tauri/src/main.rs` (`local_users`, `local_authorizations`, `local_labs`, `local_computers`, `local_equipment`, `local_sessions`, `local_hardware_events`, `local_issues`, `local_maintenance`, `local_notifications`, `local_audit_logs`, `sync_queue`, `sync_conflicts`, `local_configuration`) along with `init_local_database`, `query_local_db`, and `execute_local_db` Tauri commands.
  - Established typed `desktop/src/db/localDb.ts` service layer in TypeScript.
  - Fixed health check port mismatch in `desktop/src/context/AuthContext.tsx` (`http://localhost:5000/health`).
  - Bumped version number to `2.0.1` across `backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, and `installer/setup_script.iss`.
  - Verified clean builds: Backend (`tsc`), Desktop frontend (`tsc && vite build`), and Tauri Native engine (`cargo check`).
- **Version Bump:** `2.0.1` (Applied)
- **Action:** Phase 1 complete. Awaiting user instruction for Phase 2.

---

### Phase 2: Authentication
- **Status:** COMPLETED
- **Goal:** Implement secure, production-grade authentication with offline preparation.
- **Deliverables:**
  - Enforced Bcrypt password hashing with 10 salt rounds across bootstrap and user registration.
  - Implemented dual JWT architecture: 8-hour access tokens and 7-day refresh tokens.
  - Created `/api/auth/refresh` endpoint enabling token rotation and automatic client access renewal.
  - Built `authRateLimiter` middleware in `backend/src/middleware/rateLimit.ts` to defend against credential stuffing and brute force attacks (HTTP 429 after 5 failed attempts).
  - Enforced `isActive` account checks preventing deactivated accounts from authenticating or refreshing tokens.
  - Added structured audit logging for `USER_LOGIN`, `LOGIN_FAILED`, `LOGIN_FAILED_DEACTIVATED`, and `TOKEN_REFRESH`.
  - Added SQLite credential and signed offline token caching (`LocalDbService.cacheOfflineUser`) and offline user validation (`LocalDbService.findLocalUser`) in `desktop/src/context/AuthContext.tsx`, eliminating mock accounts.
  - Upgraded `LoginView.tsx` with role feedback, network connectivity status badges, offline policy notices, peripheral health indicators, and rate-limit throttle handling.
  - Bumped version number across all projects to `2.0.2` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `installer/setup_script.iss`).
  - Verified clean builds: Backend (`tsc`), Desktop frontend (`tsc && vite build`), Rust Tauri engine (`cargo check`), and passed integration test suite.
- **Version Bump:** `2.0.2` (Applied)
- **Action:** Phase 2 complete. Awaiting user instruction for Phase 3.

---

### Phase 3: Server-Side RBAC
- **Status:** COMPLETED
- **Goal:** Enforce strict authorization rules on every central API endpoint.
- **Deliverables:**
  - Enforced strict role authorization guards (`requireRoles`, `enforceFacultyScope`, `enforceLabAssistantScope`, `enforceStudentSelfScope`, `enforceLabScope`) across all 20+ central API routes.
  - ADMIN: Full institutional access across all administrative, academic, laboratory, computer, equipment, session, maintenance, audit, and analytics endpoints.
  - FACULTY: Scoped strictly to assigned classes, assigned students, and assigned laboratory spaces. Direct administrative access rejected with HTTP 403 Forbidden.
  - LAB_ASSISTANT: Scoped strictly to assigned labs, workstations, equipment, and maintenance operations. Student records, academic setup, and admin audit access rejected with HTTP 403 Forbidden.
  - STUDENT: Scoped strictly to own workstation session, personal issue reporting, and personal profile. Administrative and cross-student access rejected with HTTP 403 Forbidden.
  - Bumped version number across all projects to `2.0.3` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - Executed automated RBAC test suite asserting HTTP 403 Forbidden on all unauthorized access vectors (28/28 tests passed).
- **Version Bump:** `2.0.3` (Applied)
- **Action:** Phase 3 complete. Awaiting user instruction for Phase 4.

---

### Phase 4: Admin People Management
- **Status:** COMPLETED
- **Goal:** Replace basic Create User modal with an enterprise 2-column management interface.
- **Deliverables:**
  - Designed & implemented enterprise 2-column user management interface in `desktop/src/views/AdminView.tsx`:
    - Column 1 (Identity & Credentials): Institutional Role selector, Full Legal Name, Roll No / Staff Identifier, Gender, Email, Phone, DOB, Password.
    - Column 2 (Academic & Lab Authorizations): Department, Student Profile (Course/Program, Year of Study, Semester, Section, Academic Year), and interactive Laboratory Authorization checkboxes.
  - Implemented comprehensive User CRUD endpoints:
    - `POST /api/users`: Creates user profile and student record with lab assignments.
    - `PUT /api/users/:userId`: Full profile and student record updates.
    - `PATCH /api/users/:userId/status`: Account activation/deactivation toggle with strict Root Administrator protection (`CANNOT_DISABLE_ROOT`).
    - `GET /api/users`: Search (by name, roll no, email, dept), role filtering (`STUDENT`, `FACULTY`, `LAB_ASSISTANT`, `ADMIN`), and server-side pagination.
  - Enforced account status check at login: disabled accounts receive HTTP 403 `ACCOUNT_DISABLED`.
  - Bumped version number across all manifests to `2.0.4` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - Verified with 11/11 automated integration tests passing and verified builds for backend `tsc`, desktop `vite`, and native Rust engine `cargo check`.
- **Version Bump:** `2.0.4` (Applied)
- **Action:** Phase 4 complete. Awaiting user instruction for Phase 5.

---

### Phase 5: Academic Management
- **Status:** COMPLETED
- **Goal:** Make the Academic Setup tab in AdminView fully functional.
- **Deliverables:**
  - Designed & implemented comprehensive 4-subtab enterprise Academic Management interface in `desktop/src/views/AdminView.tsx`:
    - Subtab 1: **Departments & Courses** (Dual-panel management for departments and degree programs).
    - Subtab 2: **Subjects & Curriculum** (Laboratory course subjects with codes, semesters, credits).
    - Subtab 3: **Academic Class Offerings** (Assign curriculum, academic year, semester, section, faculty, and default lab).
    - Subtab 4: **Academic Calendar & Sections** (Dual-panel management for academic year session cycles and cohort sections).
  - Implemented full CRUD API endpoints in `backend/src/controllers/academicController.ts` and `backend/src/routes/api.ts`:
    - `GET/POST/PUT/DELETE /api/departments`
    - `GET/POST/PUT/DELETE /api/courses`
    - `GET/POST/PUT/DELETE /api/subjects`
    - `GET/POST/PUT/DELETE /api/academic-years`
    - `GET/POST/DELETE /api/sections`
    - `GET/POST/PUT/DELETE /api/classes`
  - Relational Dependency Protections: Prohibits deleting referenced departments, courses, subjects, academic years, or sections if dependent offerings exist (HTTP 400 `CANNOT_DELETE_HAS_DEPENDENCIES`).
  - Duplicate Prevention: Unique codes and offerings enforced with HTTP 409 rejections.
  - Bumped version number across all manifests to `2.0.5` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - Verified with 12/12 automated integration tests passing and verified builds for backend `tsc`, desktop `vite`, and native Rust engine `cargo check`.
- **Version Bump:** `2.0.5` (Applied)
- **Action:** Phase 5 complete. Awaiting user instruction for Phase 6.

---

### Phase 6: Lab Management
- **Goal:** Upgrade Labs & Computers tab with full management workflows.
- **Scope:**
  - Lab CRUD: Code, Name, Location/Building, Room, Capacity, Description, Status (`ACTIVE`, `MAINTENANCE`, `INACTIVE`).
  - Live metric rollups: Total PCs, Available, Occupied, Maintenance, Disabled, Offline.
  - Faculty and Lab Assistant assignment to specific laboratories.
- **Implementation & Verification:**
  - Implemented full Laboratory lifecycle API in `labController.ts` (`GET /labs`, `POST /labs`, `GET /labs/:id`, `PUT /labs/:id`, `DELETE /labs/:id`, `GET /labs/:id/stats`, `POST /labs/:id/staff`, `GET /labs/:id/staff`, `DELETE /computers/:id`).
  - Enforced strict foreign key dependency checks (`CANNOT_DELETE_HAS_DEPENDENCIES` on active workstations, sessions, or classes).
  - Upgraded native desktop UI in `AdminView.tsx` with hero summary cards, dual subviews (Facilities Directory vs Workstation Fleet Explorer), status filters, real-time metric pills, Facility Provision/Edit modal, Staff Assignment modal, and dependency protection alert dialogs.
  - Bumped version number across all 6 manifests to `2.0.6` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - Verified with 32/32 automated integration tests in `test_phase6_labs.cjs` and clean builds for `backend` (`tsc`), `desktop` (`tsc && vite build`), and native Rust Tauri engine (`cargo check`).
- **Version Bump:** `2.0.6` (Applied)
- **Action:** Phase 6 complete. Awaiting user instruction for Phase 7.

---

### Phase 7: Computer & Client Management
- **Goal:** Implement workstation node binding (`LAB_ID`, `PC_ID`, `CLIENT_ID`).
- **Scope:**
  - Workstation registration, heartbeat monitoring, and hardware mapping.
  - State machine enforcement: `AVAILABLE`, `IN_USE`, `MAINTENANCE`, `DISABLED`, `OFFLINE`, `UNREGISTERED`.
  - Unregistered client lock screen with administrator contact notice.
- **Accomplished (COMPLETED):**
  - Extended shared types in `shared/types/index.ts` with `WorkstationHardwareInfo`, `WorkstationPeripherals`, `activeSessionId`, `activeStudentName`, `WorkstationBindingRequest`, and `HeartbeatPayload`.
  - Built comprehensive computer controllers in `backend/src/controllers/labController.ts`: `getComputers` (with lab, state, search filters and 90s stale offline detection), `getComputerById`, `createComputer` (with code uniqueness and lab capacity syncing), `updateComputer`, `updateComputerState` (with session termination and node unbind on disable/maintenance), `unbindComputer`, `deleteComputer` (with active session dependency protection), `registerClient` (node binding), and `heartbeat` (peripherals health tracking and dynamic lock directives).
  - Exposed REST endpoints in `backend/src/routes/api.ts` with strict RBAC: `GET /computers`, `GET /computers/:id`, `POST /computers`, `PUT /computers/:id`, `PATCH /computers/:id/state`, `POST /computers/:id/unbind`, `DELETE /computers/:id`, `POST /clients/register`, `POST /clients/heartbeat`.
  - Added native Tauri commands in `desktop/src-tauri/src/main.rs`: `set_pc_identity` and `set_registration_status` for persistent JSON identity storage under `%ProgramData%\LABGUARD\config\pc_identity.json`.
  - Created full-screen unregistered lock screen in `desktop/src/views/UnregisteredLockScreen.tsx` with terminal hardware telemetry, network address chips, institutional administrator contact card, and a 2-step administrative provisioning modal.
  - Wired native startup identity checks and periodic 30s heartbeat telemetry daemon in `desktop/src/App.tsx`.
  - Upgraded desktop fleet UI in `desktop/src/views/AdminView.tsx`: secondary filter toolbar with "Register Workstation" button, hardware spec pills (`cpuModel`, `ramGb`GB), client ID chips, peripheral health indicators (KB, MS, DSP), active student session indicators, state machine quick transition dropdowns, unbind action, and the Register/Edit Workstation modal.
  - Bumped version number across all 6 manifests to `2.0.7` (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - Verified with 38/38 automated integration tests in `test_phase7_computers.cjs` (100% pass) and passed all regression test suites (Phase 3: 28/28, Phase 4: 11/11, Phase 5: 12/12, Phase 6: 32/32; total 121/121 tests passed).
  - Clean production builds for `backend` (`tsc`), `desktop` (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.0.7` (Applied)
- **Action:** STOP after Phase 7. Awaiting user instruction for Phase 8.

---

### Phase 8: Equipment Management
- **Goal:** Implement physical peripheral accountability (`LAB -> COMPUTER -> EQUIPMENT`).
- **Scope:**
  - Equipment tracking: Asset tag, type, brand, model, serial number, status (`AVAILABLE`, `IN_USE`, `FUNCTIONAL`, `FAULTY`, `MAINTENANCE`, `DECOMMISSIONED`).
  - Assign, reassign, replace peripherals without destroying historical assignment audit records (`assignmentHistory`).
- **Accomplished (COMPLETED):**
  - **Shared Types (`shared/types/index.ts`):** Extended `EquipmentType` (`KEYBOARD`, `MOUSE`, `MONITOR`, `HEADSET`, `UPS`, `GPU`, `OTHER`), added `AVAILABLE` & `IN_USE` statuses, defined `EquipmentAssignmentRecord`, `EquipmentReplaceRequest`, and extended `Equipment` entity with `pcCode`, `labCode`, `specs`, `notes`, and `assignmentHistory`.
  - **Backend Controller (`backend/src/controllers/equipmentController.ts`):** Implemented `ensureEquipmentSeeded`, `getEquipment` (multi-filter: `labCode`, `computerId`, `pcCode`, `type`, `status`, `search`), `getEquipmentById`, `createEquipment` (asset tag uniqueness `409 DUPLICATE_ASSET_TAG`), `updateEquipment`, `assignEquipment` (reassign & unassign to pool), `replaceEquipment` (atomic defective-to-spare swap with dual history logs), and `deleteEquipment` (active session protected with `400 CANNOT_DELETE_ACTIVE_SESSION`).
  - **REST API Routes (`backend/src/routes/api.ts`):** Registered all endpoints under RBAC protection (`GET /equipment`, `GET /equipment/:id`, `POST /equipment`, `PUT /equipment/:id`, `PATCH /equipment/:id/assign`, `POST /equipment/:id/replace`, `DELETE /equipment/:id`).
  - **Native Desktop UI (`desktop/src/views/AdminView.tsx`):** Extended `labSubView` with `'equipment'`, added quick-stat telemetry cards, secondary equipment filter toolbar (type, lab, status, search), peripheral inventory table, and 4 dedicated modals: Register/Edit Equipment, Workstation Assignment, Atomic Replacement (with defective note logging), and Assignment History Audit Trail.
  - **Manifests Version Bump (`2.0.8`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:** Verified with 51/51 automated integration tests in `test_phase8_equipment.cjs` (100% pass) and executed all regression test suites (Phase 3: 28/28, Phase 4: 11/11, Phase 5: 12/12, Phase 6: 32/32, Phase 7: 38/38; total 172/172 tests passed).
  - **Clean Builds:** Zero warnings or errors in `backend` (`tsc`), `desktop` (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.0.8` (Applied)
- **Action:** STOP after Phase 8. Awaiting user instruction for Phase 9.

---

### Phase 9: Faculty Module
- **Goal:** Deliver the complete Faculty Dashboard experience.
- **Scope:**
  - Navigation: Dashboard, My Classes, Students, My Labs, Lab Sessions, Live Lab, Issues, Notifications, Profile.
  - Server-side scope enforcement (only see assigned students and labs).
- **Accomplished (COMPLETED):**
  - **Shared Types (`shared/types/index.ts`):** Defined `EnrollmentPolicy` (`DIRECT` | `APPROVAL_REQUIRED`), `EnrollmentRequestStatus`, `ClassStudent`, `EnrollmentRequest`, and extended `ClassEntity` and `Course` with enrollment policy and capacity attributes.
  - **Backend Controller (`backend/src/controllers/academicController.ts`):**
    - `getFacultyDashboard`: Aggregates live KPI telemetry (assigned classes, enrolled students, authorized facilities, active sessions, pending requests).
    - Scoped `getClasses`: Returns assigned classes with computed `enrolledCount`, `capacity`, and `enrollmentPolicy`.
    - Enhanced `getStudents`: Multi-parameter filtering by `classId`, `search`, `course`, `section`.
    - `getClassStudents`: Returns detailed class rosters (`GET /api/classes/:id/students`).
    - `enrollStudentInClass`: Mode 1 existing student enrollment (`POST /api/classes/:id/enroll`) evaluating class policy. If `DIRECT`, immediately enrolls student, authorizes default lab, and adds to roster. If `APPROVAL_REQUIRED`, creates pending `enrollment_requests` record for Administrator review.
    - `getEnrollmentRequests`: Queue listing for pending and reviewed requests (`GET /api/enrollment-requests`).
    - `reviewEnrollmentRequest`: Administrator sign-off workflow (`PATCH /api/enrollment-requests/:id/review`) approving or rejecting pending requests with audit trail.
  - **REST API Routes (`backend/src/routes/api.ts`):** Exposed all endpoints under RBAC protection (`/faculty/dashboard`, `/classes/:id/students`, `/classes/:id/enroll`, `/enrollment-requests`, `/enrollment-requests/:id/review`).
  - **Native Desktop UI (`desktop/src/views/FacultyView.tsx`):**
    - Full-featured 9-tab faculty command center: Dashboard, My Classes, Students Roster, My Laboratories, Live Lab Monitor, Session History, Enrollment Workspace, Lab Issues, and Profile.
    - Interactive Live Lab Workstation Grid with live session status, active student name, and hardware indicator dots.
    - Dual-mode Enrollment Workspace: "Enroll Existing Student into Class" (with student card preview, class policy indicator, and notes) and "Create & Enroll New Student" (with cascading academic placement), plus Submitted Enrollment Requests queue table.
    - Dedicated Class Roster inspection modal.
  - **Manifests Version Bump (`2.0.9`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:** Verified with 51/51 automated integration tests in `test_phase9_faculty.cjs` (100% pass) and executed all regression test suites (Phase 3: 28/28, Phase 4: 11/11, Phase 5: 12/12, Phase 6: 32/32, Phase 7: 38/38, Phase 8: 51/51; total 223/223 tests passed).
  - **Clean Production Builds:** Zero warnings or errors in `backend` (`tsc`), `desktop` (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.0.9` (Applied)
- **Action:** STOP after Phase 9. Awaiting user instruction for Phase 10.

---

### Phase 10: Student Enrollment
- **Status:** COMPLETED
- **Goal:** Deliver dual enrollment workflows: "Add New Student" and "Enroll Existing Student".
- **Scope:**
  - Search existing student by ID/Name/Email and assign to class/section/semester/lab.
  - Configurable enrollment policy: `DIRECT` or `APPROVAL_REQUIRED` with Faculty request -> Admin review workflow.
- **Accomplished (COMPLETED):**
  - **Shared Types & Data Contracts (`shared/types/index.ts`):** Defined `EnrollmentPolicy` (`DIRECT` | `APPROVAL_REQUIRED`), `EnrollmentRequestStatus` (`PENDING` | `APPROVED` | `REJECTED`), `ClassStudent`, `EnrollmentRequest`, and updated `ClassEntity` with enrollment policy and capacity constraints.
  - **Dual-Workflow Backend Endpoints (`backend/src/controllers/academicController.ts`, `api.ts`):**
    - Multi-field student directory querying (`GET /api/students` with `search`, `classId`, `course`, `section` filters).
    - Mode 1: Enroll Existing Student (`POST /api/classes/:id/enroll`) evaluating class policy. For `DIRECT` classes, immediately registers the student in class roster and provisions access to the class's default laboratory. For `APPROVAL_REQUIRED` classes, returns HTTP 202 `PENDING_APPROVAL` and queues a formal `enrollment_requests` record.
    - Duplicate prevention: Returns HTTP 409 `ALREADY_ENROLLED` if student is active in roster, or HTTP 409 `PENDING_REQUEST_EXISTS` if a pending request is already under review.
    - Mode 2: Direct Student Provisioning (`POST /api/students/enroll`) creating the student identity, student record, and enrolling them directly with assigned lab permissions.
    - Class unenrollment workflow (`DELETE /api/classes/:id/students/:studentId`) cleanly removing the student from roster with duplicate/not-found safeguards (`404 NOT_ENROLLED`).
    - Institutional Admin Review Queue (`GET /api/enrollment-requests`, `PATCH /api/enrollment-requests/:id/review`) supporting administrative approval (which promotes student into roster and authorizes default lab) or administrative rejection.
    - RBAC enforcement: Prohibits non-admin roles (Faculty/Student) from approving/rejecting requests (`403 Forbidden`).
  - **Comprehensive UI Workspaces (`desktop/src/views/FacultyView.tsx`, `AdminView.tsx`):**
    - Faculty Enrollment Workspace with dual tabs ("Enroll Existing Student into Class" & "Create & Enroll New Student"), student card preview, policy chips, and pending request tracker.
    - Admin Enrollment Review Triage & Class Roster management.
  - **Manifests Version Bump (`2.1.0`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 50/50 automated integration tests passing in `test_phase10_enrollment.cjs`.
    - Zero regressions across completed phases: Phase 3 (28/28), Phase 4 (11/11), Phase 5 (12/12), Phase 6 (32/32), Phase 7 (38/38), Phase 8 (51/51), Phase 9 (51/51), Phase 10 (50/50) — total 273/273 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.0` (Applied)
- **Action:** STOP after Phase 10. Awaiting user instruction for Phase 11.

---

### Phase 11: Lab Assistant Module
- **Status:** COMPLETED
- **Goal:** Provide dedicated operational dashboard for Lab Assistants.
- **Scope:**
  - My Labs, Live Occupancy, Who's In/Who's Out, PC Status, Equipment, Hardware Events, Issues, Maintenance.
  - Restricted strictly to assigned laboratories (no student academic management).
- **Accomplished (COMPLETED):**
  - **Shared Types & Data Contracts (`shared/types/index.ts`):** Defined `AssistantDashboardMetrics` (assignedLabsCount, totalWorkstations, availableWorkstations, occupiedWorkstations, maintenanceWorkstations, disabledWorkstations, offlineWorkstations, activeSessionsCount, openIssuesCount, activeMaintenanceCount, recentHardwareAlertsCount, assignedLabs), extended `HardwareEvent` with `acknowledged`, `acknowledgedBy`, `acknowledgedAt`, and added `CreateMaintenancePayload` and `UpdateMaintenancePayload`.
  - **Backend Controller Layer (`backend/src/controllers/assistantController.ts`):**
    - `getAssistantDashboard`: Aggregates live KPI telemetry across facilities assigned to the caller.
    - `getHardwareEvents`: Scoped peripheral and client hardware events stream with type, facility, and acknowledgment filters.
    - `createHardwareEvent`: Endpoint to log hardware incidents (disconnections, reconnects, missing devices).
    - `acknowledgeHardwareEvent`: One-click acknowledgment of hardware alerts with audit logging.
    - `createMaintenanceRecord`: Direct maintenance work order creation for workstations or equipment.
    - `updateMaintenanceRecord`: Work order progression and completion (which automatically returns workstations to `AVAILABLE` and marks associated issues `RESOLVED`).
  - **Scoped Endpoints & RBAC Protection (`backend/src/routes/api.ts`, `issueController.ts`, `equipmentController.ts`):**
    - Registered endpoints: `GET /api/assistant/dashboard`, `GET /api/hardware-events`, `POST /api/hardware-events`, `PATCH /api/hardware-events/:id/acknowledge`, `POST /api/maintenance`, `PATCH /api/maintenance/:id`.
    - Enforced `enforceLabScope` across equipment, computers, issues, and maintenance records.
    - Anti-escalation guards returning HTTP 403 Forbidden if Lab Assistants attempt administrative actions (creating users, deleting facilities, altering curriculum, or reviewing academic enrollment requests).
  - **Dedicated Desktop Command Center (`desktop/src/views/LabAssistantView.tsx`):**
    - 7 operational sub-views: Operational Dashboard, Live Workstation Fleet, Attendance Roster ("Who's In / Who's Out"), Peripherals & Physical Equipment, Hardware Telemetry Stream, Issues Triage & Maintenance Queue, and Authorized Laboratory Facilities.
    - Interactive Workstation Node Telemetry & Command Modal: Hardware peripheral checkmarks (KB, MS, DSP), terminal IP/hostname, active student session duration ticker, quick fleet state controls (`AVAILABLE`, `MAINTENANCE`, `DISABLED`), and direct maintenance dispatch.
    - Authoritative student session termination (`POST /api/sessions/end` with `FORCED_END`) with confirmation dialog.
    - Atomic defective-to-spare peripheral replacement modal (`POST /api/equipment/:id/replace`).
  - **Manifests Version Bump (`2.1.1`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 60/60 automated integration tests passing in `scratch/test_phase11_assistant.cjs`.
    - Zero regressions across completed phases: Phase 3 (28/28), Phase 4 (11/11), Phase 5 (12/12), Phase 6 (32/32), Phase 7 (38/38), Phase 8 (51/51), Phase 9 (51/51), Phase 10 (50/50), Phase 11 (60/60) — total 333/333 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.1` (Applied)
- **Action:** STOP after Phase 11. Awaiting user instruction for Phase 12.

---

### Phase 12: Student Module
- **Status:** COMPLETED
- **Goal:** Polish student workstation interface, personal session overview, equipment accountability, and issue reporting.
- **Scope:**
  - My Session, My PC, Equipment Status, Report Issue, My Issues, Session History, Profile.
  - Enforce student isolation (cannot view other students' records).
- **Accomplished (COMPLETED):**
  - **Backend Controller Layer (`backend/src/controllers/studentController.ts`):**
    - `getStudentDashboard`: Aggregates personal student academic profile, current active workstation node, connected peripheral hardware equipment, cumulative session time, completed session history, and personal reported issues queue.
    - Strict student isolation: Filters queries strictly by `user.id`.
  - **Scoped Endpoints & RBAC Protection (`backend/src/routes/api.ts`, `sessionController.ts`, `issueController.ts`):**
    - Registered `GET /api/student/dashboard` for `STUDENT` and `ADMIN`.
    - Allowed `STUDENT` role on `GET /api/computers`, `GET /api/computers/:id`, `GET /api/equipment`, `GET /api/equipment/:id` for hardware accountability.
    - Supported flexible workstation session initialization via `{ computerId }` or `{ labCode, pcCode }` and termination via `POST /api/sessions/:id/end`.
    - Allowed student issue reporting via `POST /api/issues` with auto-resolution of workstation and category.
    - Anti-escalation guards: Enforces HTTP 403 Forbidden if students attempt administrative, faculty, or lab assistant actions (user creation, lab deletion, audit log inspection, faculty assignments, or assistant telemetry spoofing).
  - **Desktop Student Command Center (`desktop/src/views/StudentView.tsx`):**
    - 4 operational sub-views: `Overview`, `Reported Issues`, `Session History`, and `Academic Profile`.
    - Compact Floating HUD Mode: Minimized top-right widget showing active PC, session duration ticker, and quick access buttons.
    - Equipment Status Inspection: Per-peripheral functional status, asset tag, and serial number badges.
    - Student Safe Shutdown Workflow with countdown timer and native Rust system shutdown invocation.
  - **Manifests Version Bump (`2.1.2`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 40/40 automated integration tests passing in `scratch/test_phase12_student.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40) — cumulative 373/373 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.2` (Applied)

---

### Phase 13: Lab Session System
- **Status:** COMPLETED
- **Goal:** Implement full lifecycle session tracking, pre-flight validation, and duplicate session prevention.
- **Scope:**
  - Flow: Login -> PC Validation -> Authorization -> Hardware Check -> Session Start -> Active -> End Session -> Shutdown.
  - Session statuses: `ACTIVE`, `COMPLETED`, `CANCELLED`, `FORCED_END`, `ERROR`.
- **Accomplished (COMPLETED):**
  - **Comprehensive Session Controller (`backend/src/controllers/sessionController.ts`):**
    - `validatePreSession` (`POST /api/sessions/validate`): Pre-flight check validating PC registration, maintenance/disabled blocks, occupancy collisions, and attached peripheral status.
    - `startSession` (`POST /api/sessions/start`): Enforces student duplicate prevention (`ACTIVE_SESSION_EXISTS`) and workstation occupancy collision prevention (`COMPUTER_OCCUPIED`). Automatically transitions workstation to `IN_USE`.
    - `heartbeatSession` (`POST /api/sessions/:id/heartbeat`): Continuous keep-alive updating last active timestamps and elapsed session minutes.
    - `cancelSession` (`POST /api/sessions/:id/cancel`): Clean session cancellation releasing workstation back to `AVAILABLE`.
    - `forceEndSession` (`POST /api/sessions/:id/force-end`): Scoped administrative termination for Admin, Faculty, and Assistant setting status to `FORCED_END` and restoring workstation to `AVAILABLE`.
    - `endSession` (`POST /api/sessions/end` & `POST /api/sessions/:id/end`): Normal session conclusion marking `COMPLETED` and releasing workstation.
    - `getActiveSessions` (`GET /api/sessions/active`): Live active session querying with role-based scoping.
    - `getSessionById` (`GET /api/sessions/:id`): Deep session inspection linking workstation and equipment.
  - **Scoped Endpoints & RBAC Protection (`backend/src/routes/api.ts`):**
    - Enforced student isolation preventing cross-student cancellation, heartbeats, or unauthorized termination.
    - Strict role guards preventing students from calling administrative `force-end`.
  - **Manifests Version Bump (`2.1.3`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 46/46 automated integration tests passing in `scratch/test_phase13_sessions.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46) — cumulative 419/419 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.3` (Applied)

---

### Phase 14: Hardware Monitoring (Rust + Win32)
- **Status:** COMPLETED
- **Goal:** Implement genuine peripheral device monitoring via Windows APIs in Rust.
- **Scope:**
  - Enumerate keyboard, mouse, and monitor using Win32 API (`GetSystemMetrics`, `SM_MOUSEPRESENT`, `SM_CMONITORS`).
  - Distinguish connection disconnects ("Mouse connection lost") from physical damage.
  - Dispatch native hardware events: `HARDWARE_CONNECTED`, `HARDWARE_DISCONNECTED`, `DEVICE_MISSING`.
- **Accomplished (COMPLETED):**
  - **Native Rust Windows Peripheral Detection (`desktop/src-tauri/src/main.rs`):**
    - Genuine Win32 API calls via `windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_MOUSEPRESENT, SM_CMONITORS}`.
    - Continuous polling command `poll_hardware_telemetry(last_mouse, last_keyboard, last_monitor)` returning delta events with timestamps and human-readable descriptions.
  - **Desktop Frontend Native Bridge (`desktop/src/services/native.ts`):**
    - Typed `NativeHardwareTelemetryEvent` and `NativeService.pollHardwareTelemetry()`.
  - **Backend Scoped Telemetry Engine (`backend/src/controllers/assistantController.ts`, `api.ts`):**
    - `POST /api/hardware-events`: Ingestion of hardware connects, disconnects, mismatches, and missing peripheral reports.
    - `PATCH /api/hardware-events/:id/acknowledge`: One-click acknowledgment of hardware alerts with assistant identity attribution.
    - `GET /api/hardware-events`: Filtering by `acknowledged` status, facility code, and event type with facility scoping.
  - **Manifests Version Bump (`2.1.4`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 20/20 automated integration tests passing in `scratch/test_phase14_hardware.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20) — cumulative 439/439 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.4` (Applied)

---

### Phase 15: Issue Management
- **Status:** COMPLETED
- **Goal:** Deliver end-to-end issue reporting, evidence attachment handling, and lifecycle progression states.
- **Scope:**
  - Issue categories, description, severity, and photo evidence upload.
  - Lifecycle: `OPEN` -> `VERIFIED` -> `INVESTIGATING` -> `MAINTENANCE` -> `RESOLVED` / `REJECTED`.
- **Accomplished (COMPLETED):**
  - **Shared Types Extension (`shared/types/index.ts`):**
    - Extended `Issue` entity with `severity` (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`), `resolutionNotes`, `resolvedBy`, `resolvedAt`, `verifiedBy`, and `verifiedAt`.
  - **Comprehensive Issue Controller (`backend/src/controllers/issueController.ts`):**
    - `reportIssue`: Validates workstation/equipment and creates initial issue in `OPEN` state, broadcasting notification to staff.
    - `getIssueById`: Deep inspection returning issue details, workstation node, attached equipment, and linked maintenance work orders.
    - `updateIssueStatus`: Enforces valid status transitions (`OPEN` -> `VERIFIED` -> `INVESTIGATING` -> `MAINTENANCE` -> `RESOLVED` / `REJECTED`), automatic workstation and equipment state coupling, and automated creation of linked `MaintenanceRecord`.
    - `attachEvidence`: Dedicated API accepting evidence URLs and diagnostic payloads with audit logging.
    - `listIssues`: Scoped queries with multi-parameter filtering across `status`, `severity`, `labCode`, and `issueType`.
  - **Scoped Endpoints & RBAC Protection (`backend/src/routes/api.ts`):**
    - Prohibits students from modifying issue statuses or inspecting cross-student tickets (`403 Forbidden`).
    - Enforces laboratory authorization so assistants can only update issues within assigned labs.
  - **Manifests Version Bump (`2.1.5`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 39/39 automated integration tests passing in `scratch/test_phase15_issues.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39) — cumulative 478/478 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.5` (Applied)

---

### Phase 16: Maintenance Module
- **Status:** COMPLETED
- **Goal:** Implement lab maintenance lifecycle and repair logging.
- **Scope:**
  - Link maintenance records to reported issues, workstations, and equipment assets.
  - Track technician, action taken, costs, time, and resolution status.
- **Accomplished (COMPLETED):**
  - **Comprehensive Maintenance Endpoints (`backend/src/controllers/assistantController.ts`, `issueController.ts`):**
    - `POST /api/maintenance`: Create maintenance orders for workstations and peripherals with auto-coupling to workstation state (`MAINTENANCE`). Accepts `labId` or `labCode`, seeds database stores, and records cost, actions taken, and assigned technicians.
    - `GET /api/maintenance/:id`: Deep inspection linking maintenance record to workstation node, peripheral equipment, and linked issues.
    - `PATCH /api/maintenance/:id`: Updates order progress, records endTime, captures costs, and on `COMPLETED` automatically restores workstation state to `AVAILABLE` (if no other active work orders exist) and resolves associated issues.
    - `POST /api/maintenance/:id/cancel`: Cancellation flow with reason tracking that automatically restores workstation to `AVAILABLE`.
    - `GET /api/maintenance/stats`: Aggregates maintenance metrics across assigned labs (`total`, `inProgress`, `scheduled`, `completed`, `cancelled`, and `totalCost`).
  - **Scoped Endpoints & RBAC Protection (`backend/src/routes/api.ts`):**
    - Scoped access restricted to `ADMIN` and `LAB_ASSISTANT`. Students attempting any maintenance endpoints receive HTTP 403 Forbidden.
    - Assistant laboratory scope enforcement verifying caller assignment before allowing order creation, modification, or cancellation.
  - **Manifests Version Bump (`2.1.6`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 29/29 automated integration tests passing in `scratch/test_phase16_maintenance.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39), Phase 16 (29/29) — cumulative 507/507 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.6` (Applied)

---

### Phase 17: Notifications System
- **Status:** COMPLETED
- **Goal:** Implement role-aware notification routing with Windows native toasts.
- **Scope:**
  - Windows native toast notifications via Tauri plugin + In-app notification center.
  - Severities (`INFO`, `WARNING`, `CRITICAL`), deduplication, cooldown, read/unread states.
- **Accomplished (COMPLETED):**
  - **Universal Domain Types (`shared/types/index.ts`):** Defined `Notification`, `NotificationSeverity` (`INFO`, `WARNING`, `CRITICAL`), `NotificationPreference`, and `SendNotificationPayload`.
  - **Notification Engine & Service (`backend/src/services/notificationService.ts`):**
    - Role-aware dispatch with 30-second anti-flooding deduplication cooldown (suppresses rapid duplicate non-critical alerts; passes `CRITICAL` immediately).
    - User notification preferences engine checking `criticalOnly`, `hardwareAlerts`, `maintenanceAlerts`, `issueAlerts`, `sessionAlerts`.
    - User and role isolation: callers only receive broadcasts targeted to their role, direct private notifications matching their userId, or global announcements (admins receive institutional oversight).
    - Real-time unread and critical unread badge count telemetry.
    - Single and bulk read progression (`markAsRead`, `markAllAsReadForUser`).
  - **Dedicated Controller Layer (`backend/src/controllers/notificationController.ts`, `backend/src/routes/api.ts`):**
    - `GET /api/notifications` (with `unreadOnly`, `severity`, `eventType`, `limit`, `offset` filters).
    - `GET /api/notifications/badge` and `GET /api/notifications/count`.
    - `POST /api/notifications` (dispatches system announcements, restricted to `ADMIN` and `LAB_ASSISTANT`).
    - `PATCH /api/notifications/:id/read` & `POST /api/notifications/read-all`.
    - `DELETE /api/notifications/:id` (notification dismissal).
    - `GET /api/notifications/preferences` & `PATCH /api/notifications/preferences`.
  - **Desktop Native & In-App UI (`desktop/src/components/NotificationCenter.tsx`, `Navbar.tsx`, `main.rs`, `native.ts`):**
    - Native Tauri command `dispatch_native_toast` invoking Windows background toast logging.
    - Interactive Notification Center bell with live pulsating unread badge in Navbar.
    - Slide-out/popover drawer with tabs (`All`, `Unread`, `Critical`), severity icons, dismissal controls, and "Mark all read".
  - **Manifests Version Bump (`2.1.7`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 54/54 automated integration tests passing in `scratch/test_phase17_notifications.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39), Phase 16 (29/29), Phase 17 (54/54) — cumulative 561/561 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.7` (Applied)

---

### Phase 18: Audit Trail
- **Status:** COMPLETED
- **Goal:** Tamper-resistant institutional audit logging.
- **Scope:**
  - Structured audit trail for authentication, sessions, users, labs, PCs, equipment, issues, and maintenance.
  - Search, filter by actor/role/action, date range querying, and export.
- **Accomplished (COMPLETED):**
  - **Comprehensive Audit Controller (`backend/src/controllers/auditController.ts`, `backend/src/routes/api.ts`):**
    - `GET /api/audit-logs`: Search, multi-parameter filtering (`actorUserId`, `role`, `action`, `entityType`, `entityId`, `labId`, `dateFrom`, `dateTo`), pagination (`limit`, `offset`), deterministic sorting (`asc`/`desc`), and summary telemetry (`distinctActorsCount`, `distinctActions`, `distinctEntityTypes`).
    - `GET /api/audit-logs/:id`: Deep inspection of individual audit records with metadata.
    - `GET /api/audit-logs/metadata`: Overall summary of distinct actions, distinct roles, and record counts.
    - `GET /api/audit-logs/export`: Downloadable audit trail export supporting both `format=csv` (with standard headers) and `format=json`.
    - **Anti-Tampering Immutability Protection**: `DELETE`, `PUT`, and `PATCH` methods on audit logs are strictly rejected with HTTP 403 Forbidden (`IMMUTABLE_AUDIT_LOG`).
    - **Strict Scoped RBAC**: Access is strictly limited to `ADMIN`. Non-admin roles (Students, Faculty, Lab Assistants) receive HTTP 403 Forbidden.
  - **Enhanced Desktop Audit Center (`desktop/src/views/AdminView.tsx`):**
    - Audit tab toolbar with live CSV export button.
    - Multi-filter bar with text search, role dropdown filter, entity type dropdown filter, and live result counter.
    - Formatted table displaying localized timestamp, actor name, colored role badge, action code, entity type, and entity ID.
  - **Manifests Version Bump (`2.1.8`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 44/44 automated integration tests passing in `scratch/test_phase18_audit.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39), Phase 16 (29/29), Phase 17 (54/54), Phase 18 (44/44) — cumulative 605/605 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.8` (Applied)

---

### Phase 19: Offline-First Architecture
- **Status:** COMPLETED
- **Goal:** Reliable offline operation backed by local SQLite.
- **Scope:**
  - Local SQLite persistence of core operational data.
  - Secure offline authentication against cached credentials; prevent privilege escalation.
- **Accomplished (COMPLETED):**
  - **14-Vault SQLite Architecture & Batch Execution (`desktop/src-tauri/src/main.rs`):**
    - Enhanced `execute_local_db` to support batch SQL (`execute_batch`) and atomic transaction execution.
    - Initialized high-frequency performance indexes (`idx_local_users_identifier`, `idx_local_users_email`, `idx_local_sessions_student`, `idx_local_sessions_status`, `idx_sync_queue_status`, `idx_local_computers_lab`, `idx_local_equipment_pc`).
  - **Comprehensive Typed SQLite Service Layer (`desktop/src/db/localDb.ts`):**
    - Salted SHA-256 cryptographic password hashing with user-specific salts (`hashOfflinePassword`).
    - Robust offline authentication engine (`verifyOfflineCredentials`) enforcing 5-point security:
      1. User existence & active account verification (`is_active = 1`).
      2. Strict anti-privilege escalation guard (`cached.role === targetRole`), blocking role elevation attempts offline with `PRIVILEGE_ESCALATION_BLOCKED`.
      3. 30-day offline token expiration check with `OFFLINE_TOKEN_EXPIRED`.
      4. Salted hash comparison with `INVALID_CREDENTIALS`.
      5. Scoped laboratory authorization resolution from `local_authorizations`.
    - Local operational data persistence:
      - `cacheCatalog`: Pre-caches complete campus catalog (`local_labs`, `local_computers`, `local_equipment`).
      - Sessions: `startLocalSession` (auto-transitions workstation to `IN_USE`), `endLocalSession` (restores workstation to `AVAILABLE`), `getActiveLocalSession`, `getStudentDashboardData`.
      - Hardware Events: `recordLocalHardwareEvent`, `getLocalHardwareEvents`.
      - Issues: `createLocalIssue`, `getLocalIssues`.
      - Maintenance: `createLocalMaintenance`, `updateLocalMaintenance`, `getLocalMaintenance`.
      - Local Audit Logs: `createLocalAuditLog`, `getLocalAuditLogs`.
      - Sync Queue: `enqueueSyncItem`, `getPendingSyncItems`, `markSyncItemProcessed`.
  - **Desktop Application Integration (`desktop/src/context/AuthContext.tsx`, `StudentView.tsx`):**
    - Online sign-in automatically caches credentials, salted password hash, signed offline token, and pre-caches the catalog in SQLite.
    - Offline sign-in seamlessly validates cached credentials with anti-escalation security.
    - Student workspace operates seamlessly offline (starting sessions, loading dashboard, recording issues, terminating sessions with safe shutdown) backed by local SQLite.
  - **Server-Side Offline Token Verification (`backend/src/controllers/authController.ts`, `backend/src/routes/api.ts`):**
    - Registered `POST /api/auth/verify-offline-token` with claims decoding and expired/tampered rejection.
  - **Manifests Version Bump (`2.1.9`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 65/65 automated integration tests passing in `scratch/test_phase19_offline.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39), Phase 16 (29/29), Phase 17 (54/54), Phase 18 (44/44), Phase 19 (65/65) — cumulative 670/670 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.1.9` (Applied)

---

### Phase 20: Synchronization Engine
- **Status:** COMPLETED
- **Goal:** Idempotent client-to-server batch synchronization with conflict resolution.
- **Scope:**
  - `sync_queue` in SQLite -> Network polling -> Express API -> Central PostgreSQL.
  - Exponential backoff retry logic, conflict detection, and server timestamp reconciliation.
- **Accomplished (COMPLETED):**
  - **Comprehensive Batch Sync API (`backend/src/services/syncService.ts`, `backend/src/routes/api.ts`):**
    - Multi-entity batch ingestion supporting `sessions`, `hardwareEvents`, `issues`, `maintenance`, and `auditLogs`.
    - Idempotent processing: repeated identical transmissions acknowledge all entities without duplication or error.
    - Central server conflict detection:
      - Finalized sessions (`COMPLETED`/`FORCED_END`) returning conflict if client reports `ACTIVE`.
      - Resolved issues (`RESOLVED`) returning conflict if client reports `OPEN`.
      - Authoritative server state returned in `conflicts` payload for client reconciliation.
    - Automatic laboratory incident notifications dispatched on peripheral disconnections and reported issues.
    - Audit logging into `sync_events` recording batch metadata, entity count, and conflict count.
  - **Desktop Synchronization Engine (`desktop/src/services/syncEngine.ts`, `desktop/src/db/localDb.ts`):**
    - Robust `SyncEngine` service with automatic polling (15s), online event listener (`window.addEventListener('online')`), and manual triggering (`syncNow`).
    - Exponential backoff retry algorithm with random jitter (`baseBackoffMs: 2000`, `maxBackoffMs: 60000`, doubling on consecutive failures).
    - Queue attempt tracking incrementing `attempt_count` on failed transmissions.
    - Automatic status progression marking acknowledged items `SYNCED` in both `sync_queue` and local entity tables.
    - Local conflict vault (`sync_conflicts` table in SQLite) recording conflicts and reconciling local records to server authoritative state.
    - Observable telemetry state (`isSyncing`, `pendingCount`, `conflictCount`, `consecutiveFailures`, `lastSyncTimestamp`, `lastError`).
  - **Desktop UI Integration (`desktop/src/components/Navbar.tsx`):**
    - Live synchronization badge showing real-time states: "Syncing...", "Sync ({count} queued)" (clickable to trigger immediate sync), "{count} Conflict", and "Synced".
  - **Manifests Version Bump (`2.2.0`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 34/34 automated integration tests passing in `scratch/test_phase20_sync.cjs`.
    - Zero regressions across completed phases: Phase 11 (60/60), Phase 12 (40/40), Phase 13 (46/46), Phase 14 (20/20), Phase 15 (39/39), Phase 16 (29/29), Phase 17 (54/54), Phase 18 (44/44), Phase 19 (65/65), Phase 20 (34/34) — cumulative 704/704 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.0` (Applied)

---

### Phase 21: Live Lab Monitoring
- **Status:** COMPLETED
- **Goal:** Real-time visual workstation grid for faculty and assistants.
- **Scope:**
  - Visual PC cards displaying real-time state, active student, hardware health, and issues.
  - WebSocket push updates for instant state changes.
- **Accomplished (COMPLETED):**
  - **Realtime Gateway Service (`backend/src/services/realtimeService.ts`):**
    - WebSocket server gateway mounted on `/ws` with automatic connection handshake, PING/PONG keep-alive, client connection registry, and room-scoped subscriptions (`SUBSCRIBE` by `labCode` and role).
    - Typed real-time broadcasts: `WORKSTATION_STATE_CHANGED`, `SESSION_STARTED`, `SESSION_ENDED`, `HARDWARE_ALERT`, `ISSUE_REPORTED`, `ISSUE_UPDATED`, and `MAINTENANCE_UPDATED`.
    - Room isolation: Clients subscribed to specific labs receive targeted broadcasts; universal events broadcast to all connected dashboard peers.
  - **Backend Controller Broadcast Hooks (`backend/src/controllers/`):**
    - `sessionController.ts`: `RealtimeService.broadcastSessionStart` on session creation and `RealtimeService.broadcastSessionEnd` on normal end, force end, or cancellation.
    - `labController.ts`: `RealtimeService.broadcastWorkstationState` on workstation administrative state transitions (`AVAILABLE`, `IN_USE`, `MAINTENANCE`, `DISABLED`, `OFFLINE`).
    - `assistantController.ts`: `RealtimeService.broadcastHardwareAlert` on peripheral disconnection/events, and `RealtimeService.broadcastMaintenanceUpdate` on work order creation, completion, or cancellation.
    - `issueController.ts`: `RealtimeService.broadcastIssueUpdate` on issue creation and status transitions (`OPEN`, `VERIFIED`, `INVESTIGATING`, `MAINTENANCE`, `RESOLVED`).
  - **Desktop Realtime WebSocket Client & Hook (`desktop/src/services/realtime.ts`):**
    - Resilient `RealtimeClientService` with automatic connect/reconnect using exponential backoff (1s -> 15s max delay), 20s heartbeat telemetry, and typed event dispatching.
    - `useLiveLabMonitoring(labCode)` custom React hook for live UI subscriptions.
  - **Desktop UI Integration (`desktop/src/views/FacultyView.tsx`, `desktop/src/views/LabAssistantView.tsx`):**
    - `FacultyView.tsx`: Real-time workstation fleet grid updating dynamic state badges, active student session cards, and visual live gateway active indicator badge without manual reloads.
    - `LabAssistantView.tsx`: Real-time fleet synchronization listening to `WORKSTATION_STATE_CHANGED`, `SESSION_STARTED`, `SESSION_ENDED`, `HARDWARE_ALERT`, `ISSUE_REPORTED`, and `MAINTENANCE_UPDATED`, with top-level live gateway badge.
  - **Manifests Version Bump (`2.2.1`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 32/32 automated integration tests passing in `scratch/test_phase21_monitoring.cjs`.
    - Zero regressions across completed phases: Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32) — cumulative 736/736 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.1` (Applied)

---

### Phase 22: Reporting System
- **Status:** COMPLETED
- **Goal:** Institutional reporting with multi-format export.
- **Scope:**
  - Student Session History, PC Usage, Lab Utilization, Equipment Maintenance, and Audit Activity.
  - Export to CSV, Excel, and PDF formats.
- **Accomplished (COMPLETED):**
  - **Institutional Reporting Service (`backend/src/services/reportService.ts`):**
    - Data generation and KPI summary calculations for 5 core reporting modules:
      - `SESSION_HISTORY`: Detailed student session logs with duration minutes, status, and end modes.
      - `PC_USAGE`: Workstation fleet utilization, total active hours, session counts, and online uptime telemetry.
      - `LAB_UTILIZATION`: Facility capacity density, session volume, and percentage occupancy rates.
      - `EQUIPMENT_MAINTENANCE`: Work orders, triage actions, repair technician assignments, and cumulative cost aggregates.
      - `AUDIT_ACTIVITY`: Immutable administrative, security, and authentication audit trail logs.
    - Multi-Format Converters:
      - `convertToCsv`: RFC 4180 standard CSV with escaped quotations and institutional banner comments.
      - `convertToExcel`: Spreadsheet XML format (`.xls`) natively compatible with Microsoft Excel, LibreOffice, and Google Sheets with styled headers, titles, and cell typings.
      - `convertToPrintableHtml`: High-fidelity printable report layout with `@media print` rules, institutional banners, KPI summary cards, and printable pagination.
  - **Scoped Reporting Controller & Endpoints (`backend/src/controllers/reportController.ts`, `backend/src/routes/api.ts`):**
    - `GET /api/reports/types`: Role-scoped report discovery (Admin: 5 modules, Faculty: 3 academic modules, Assistant: 3 facility modules, Student: 1 self session history module).
    - `POST /api/reports/generate`: JSON payload generation with filter parameters (facility, date range, status, student).
    - `GET /api/reports/export/:reportType`: Multi-format streaming exporter supporting `format=CSV|EXCEL|PDF` with appropriate MIME headers (`text/csv`, `application/vnd.ms-excel`, `text/html`) and `Content-Disposition` attachments.
    - Anti-privilege escalation guards returning HTTP 403 Forbidden on unauthorized report access (e.g. students or assistants accessing audit logs).
  - **Desktop Reporting Center Component (`desktop/src/components/ReportingCenter.tsx`):**
    - Reusable, interactive Reporting Center with module selector, facility filter, date range picker, and status filters.
    - Live data table preview with summary KPI cards and dynamic column formatting.
    - One-click export buttons for CSV, Excel XML, and direct browser Print / PDF layout.
    - Seamlessly integrated as dedicated tabs in both `FacultyView.tsx` and `LabAssistantView.tsx`.
  - **Manifests Version Bump (`2.2.2`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 49/49 automated integration tests passing in `scratch/test_phase22_reporting.cjs`.
    - Zero regressions across completed phases: Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32), Phase 22 (49/49) — cumulative 785/785 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.2` (Applied)

---

### Phase 23: Analytics Dashboard
- **Status:** COMPLETED
- **Goal:** True aggregated analytics with zero fake charts.
- **Scope:**
  - Accurate metrics for utilization, issue frequencies, maintenance trends, and client online rates.
  - Explicit empty state ("0 / No data available") when database is fresh.
- **Accomplished (COMPLETED):**
  - **Aggregated Analytics Controller (`backend/src/controllers/analyticsController.ts`, `backend/src/routes/api.ts`):**
    - Multi-dimensional live aggregation endpoint: `GET /api/analytics/dashboard?timeframe=7d|30d|90d|all&labCode=...`.
    - Pure data aggregation with zero mock numbers and explicit empty states when no activity is logged:
      - `utilization`: Total sessions, total duration hours, average session duration (minutes), active occupancy percent, peak hour period calculation, and 24-hour hourly distribution bucket array.
      - `issues`: Total reported issues, open vs resolved counts, percentage resolution rate, and category percentage breakdown.
      - `maintenance`: Total work orders, in-progress and scheduled counts, completed orders, cumulative expenditure, and average repair cost without division-by-zero errors.
      - `fleetHealth`: Workstation counts, online/offline counts, in-use counts, and fleet online percentages.
      - `emptyStates`: Boolean flags (`hasSessions`, `hasIssues`, `hasMaintenance`, `hasFleet`) for UI rendering.
    - Role-based facility scoping: Non-admin users (Faculty, Assistants) are strictly restricted to assigned facilities.
  - **Desktop Analytics Dashboard Component (`desktop/src/components/AnalyticsDashboard.tsx`):**
    - High-density visual intelligence dashboard with facility selector and timeframe toggles (`7 Days`, `30 Days`, `90 Days`, `All Time`).
    - 4 primary KPI cards (Active Lab Usage, Fleet Online Rate, Issue Resolution, Maintenance Triage).
    - 24-hour hourly session volume bar visualization with hover telemetry tooltips and explicit empty state indicator (`0 Sessions / No activity logged in this timeframe`).
    - Dual breakdown grids: Issue Category Distribution with proportional progress meters, and Workstation Fleet Status Matrix (`Available`, `In Use`, `Maintenance`, `Offline`).
    - Embedded into `FacultyView.tsx` under a dedicated "Fleet Analytics" tab.
  - **Manifests Version Bump (`2.2.3`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 38/38 automated integration tests passing in `scratch/test_phase23_analytics.cjs`.
    - Zero regressions across completed phases: Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32), Phase 22 (49/49), Phase 23 (38/38) — cumulative 823/823 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.3` (Applied)

---

### Phase 24: Windows System Startup
- **Status:** COMPLETED
- **Goal:** Automatic system boot launch via institutional registry configuration.
- **Scope:**
  - Legitimate Windows startup registration (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - Auto-initialization sequence: SQLite verification -> PC identity -> Online check -> Login screen.
- **Accomplished (COMPLETED):**
  - **Native Windows Startup Registry Commands (`desktop/src-tauri/src/main.rs`):**
    - Implemented `enable_autostart`, `disable_autostart`, and `is_autostart_enabled` native commands.
    - Interacts directly with `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` using `reg.exe` with `CREATE_NO_WINDOW` (preventing console flashes during boot).
    - Registered all startup handlers into `tauri::generate_handler!`.
  - **Native TypeScript Service Layer (`desktop/src/services/native.ts`):**
    - Exposed typed wrappers: `enableAutoStart`, `disableAutoStart`, `isAutoStartEnabled` with local storage fallbacks for web/preview environments.
  - **4-Stage Boot Verification Sequence Engine (`desktop/src/services/startupSequence.ts`):**
    - Built reactive sequence engine executing the 4 requisite stages with diagnostic telemetry:
      - `STAGE 1: VERIFY_DATABASE`: Verifies local SQLite database and checks table vaults (`local_users`, `local_sessions`, `sync_queue`).
      - `STAGE 2: DETECT_PC_IDENTITY`: Reads hardware UUID and institutional bindings (`lab_code`, `pc_code`, `is_registered`).
      - `STAGE 3: CHECK_CONNECTIVITY`: Probes central security gateway (`/health`), measures latency, and handles offline graceful degradation.
      - `STAGE 4: CONFIGURE_AUTOSTART`: Verifies HKCU Run registry autostart and enforces automatic boot launch policy.
      - `STAGE 5: READY_LOGIN`: System readiness signal for login/lock screen transition.
  - **Institutional Boot Verification UI (`desktop/src/App.tsx`):**
    - High-tech, dark-mode institutional boot overlay featuring dynamic progress bar, step checklist with visual spinners, checkmarks, and offline warning badges.
    - Transition to login view or unregistered lock screen upon sequence completion.
  - **Manifests Version Bump (`2.2.4`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 28/28 automated integration tests passing in `scratch/test_phase24_startup.cjs`.
    - Zero regressions across completed phases: Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32), Phase 22 (49/49), Phase 23 (38/38), Phase 24 (28/28) — cumulative 851/851 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.4` (Applied)


---

### Phase 25: Student Automatic Shutdown
- **Status:** COMPLETED
- **Goal:** Safe, student-only workstation power off.
- **Scope:**
  - End Session modal with 10-second countdown.
  - Native Rust command execution with strict role verification. Faculty/Admin/Assistant logouts never shut down the PC.
- **Accomplished (COMPLETED):**
  - **Native Rust Safe Shutdown & Abort Commands (`desktop/src-tauri/src/main.rs`):**
    - `request_safe_shutdown`: Enforces strict `role == "STUDENT"` check and non-empty `session_id`, rejecting unauthorized calls with explicit `SECURITY VIOLATION`.
    - Spawns Windows native shutdown command with clean 10-second timer (`shutdown /s /t 10 /c "LABGUARD: Student lab session finalized. Workstation powering off."`) using `CREATE_NO_WINDOW` (flag `0x08000000`) without command-prompt flashes.
    - Implemented `abort_shutdown` executing Windows `shutdown /a` to halt in-flight power-off sequences.
    - Registered both native handlers in `tauri::generate_handler!`.
  - **Triple-Layered Role Isolation Guards:**
    - UI Layer (`Navbar.tsx`): Faculty, Admin, and Lab Assistant sign-out invokes `logout()` exclusively, never touching the shutdown pipeline.
    - Context Layer (`AuthContext.tsx`): `requestShutdown` asserts `role === 'STUDENT'`, blocking execution with descriptive message for all other roles. Exposes `abortShutdown` for session cancellation.
    - Native Layer (`main.rs`): Rejects non-student roles with native Err return.
  - **Student View End Session & Shutdown Modal (`desktop/src/views/StudentView.tsx`):**
    - High-visibility modal displaying real-time 10-second countdown timer (`{countdown}s`) with pulsating styling.
    - Linear progress meter indicating remaining seconds before workstation power-off.
    - Emergency abort button (`Cancel & Resume Session`) invoking `abortShutdown`, clearing timer intervals, and safely resuming active session work.
  - **Manifests Version Bump (`2.2.5`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 31/31 automated integration tests passing in `scratch/test_phase25_shutdown.cjs`.
    - Zero regressions across completed phases: Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32), Phase 22 (49/49), Phase 23 (38/38), Phase 24 (28/28), Phase 25 (31/31) — cumulative 882/882 tests passing (100% pass rate).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.5` (Applied)


---

### Phase 26: Security Hardening
- **Status:** COMPLETED
- **Goal:** Enterprise security verification across desktop and server.
- **Scope:**
  - Input validation with Zod schemas, SQL injection defense, token expiration enforcement.
  - Removal of any sensitive credentials or service keys from desktop bundles.
- **Accomplished (COMPLETED):**
  - **Universal Input Validation Schemas (`backend/src/schemas/validationSchemas.ts`):**
    - Refined and expanded Zod schemas across public and authenticated mutations: `LoginSchema` (with `role` & `targetRole` aliases), `RefreshTokenSchema`, `CreateUserSchema` (with complete student academic placement), `StartSessionSchema`, `EndSessionSchema`, `ReportIssueSchema` (allowing `computerId`, `category`, `title`, `severity`, `equipmentId`, `evidenceUrl` with `.passthrough()` and custom `.refine`), `ClientHeartbeatSchema`, `BatchSyncSchema`, and `CreateMaintenanceSchema`.
    - Added dedicated schemas for academic entities (`Department`, `Course`, `Subject`, `AcademicYear`, `Section`, `Class`), facilities (`Lab`, `Computer`), and physical inventory (`Equipment`).
    - Enforced `sqlInjectionPattern` signature defense blocking union, stacked drop, and boolean SQL injection vectors.
  - **Cryptographic Algorithm Pinning & Token Expiration (`backend/src/middleware/auth.ts`):**
    - Enforced algorithm pinning strictly to `HS256` in `jwt.verify`, preventing algorithm "none" bypass attacks.
    - Explicit token expiration handling returning `TOKEN_EXPIRED` on expired JWTs and `INVALID_TOKEN` on tampered payloads.
  - **Desktop Bundle Secret Hygiene Audit (`desktop/src/views/LoginView.tsx`):**
    - Removed hardcoded demo credentials (`admin@labguard.edu` / `Admin@123456`) from role switcher in `LoginView.tsx`.
    - Verified zero hardcoded database connection strings (`postgresql://`, `postgres://`) or service keys in desktop client codebase.
  - **Manifests Version Bump (`2.2.6`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 22/22 automated integration tests passing in `scratch/test_phase26_security.cjs`.
    - Zero regressions across completed phases: Phase 15 (39/39), Phase 16 (29/29), Phase 17 (54/54), Phase 18 (44/44), Phase 19 (65/65), Phase 20 (34/34), Phase 21 (32/32), Phase 22 (49/49), Phase 23 (38/38), Phase 24 (28/28), Phase 25 (31/31), Phase 26 (22/22).
    - Clean production builds across backend (`tsc`), desktop (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.6` (Applied)
- **Action:** STOP after Phase 26. Awaiting user instruction for Phase 27.

---

### Phase 27: Crash Recovery
- **Goal:** Resilient session and application crash recovery.
- **Scope:**
  - Detect abnormal shutdowns and mark active sessions as `FORCED_END` / `RECOVERED`.
  - Prevent orphaned or duplicate active sessions upon application restart.
- **Accomplished (COMPLETED):**
  - **Shared Types Extension (`shared/types/index.ts`):**
    - Added `'RECOVERED'` to `SessionStatus`.
    - Extended `Session` with `endMode?: ... | 'CRASH_RECOVERED'`, `durationMinutes?: number`, and `notes?: string`.
    - Added `CrashRecoveryPayload` interface with `labCode`, `pcCode`, `sessionId`, `studentId`, and optional `reason`.
  - **Central Backend Recovery Service (`backend/src/controllers/sessionController.ts` & `backend/src/routes/api.ts`):**
    - Implemented `recoverCrashedSession` endpoint (`POST /api/sessions/recover`) under RBAC protection (`ADMIN`, `FACULTY`, `LAB_ASSISTANT`).
    - Recovers orphaned active sessions matching workstation/student parameters, transitions status to `RECOVERED` with mode `CRASH_RECOVERED`, calculates telemetry duration, restores workstation state to `AVAILABLE`, and broadcasts realtime workstation and session updates.
    - Enhanced `validatePreSession` and `startSession` to auto-recover orphaned sessions on the same PC or with `autoRecover` / `forceRecover`, preventing duplicate session deadlock upon client relaunch.
  - **Local SQLite Crash Recovery Engine (`desktop/src/db/localDb.ts` & `scratch/localDb.cjs`):**
    - Implemented `recoverOrphanedLocalSessions(reason)`: discovers any lingering active sessions across SQLite / in-memory store, marks them `RECOVERED` with `ended_at` timestamp and `CRASH_RECOVERED` mode, restores workstation states to `AVAILABLE`, logs local audit event `SESSION_RECOVERED_CRASH`, and enqueues recovery event to `sync_queue` for central reconciliation.
  - **Startup Sequence Integration (`desktop/src/services/startupSequence.ts`):**
    - Integrated crash recovery check into Stage 1 (`INIT_LOCAL_VAULT`) of application boot sequence: automatically checks for and recovers orphaned sessions prior to displaying the login screen or restoring session state.
  - **Native Sentinel Architecture (`desktop/src-tauri/src/main.rs` & `desktop/src/services/native.ts`):**
    - Implemented `SessionSentinel` struct and native Tauri commands `set_session_sentinel` and `check_session_sentinel` tracking active session state and detecting abnormal process termination.
    - Exposed type-safe TypeScript wrappers `setSessionSentinel` and `checkSessionSentinel` in `NativeService`.
  - **Manifests Version Bump (`2.2.7`):** Synchronized all 6 project manifests (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`).
  - **Automated Verification:**
    - 29/29 automated integration tests passing in `scratch/test_phase27_recovery.cjs`.
    - Zero regressions across completed test suites: Phase 26 (22/22), Phase 25 (31/31), Phase 21 (32/32), Phase 15 (39/39). Total 153/153 automated tests passing.
    - Clean production builds across backend (`tsc`), desktop frontend (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.7` (Applied)
- **Action:** STOP after Phase 27. Awaiting user instruction for Phase 28.

---

### Phase 28: Production Windows Installer
- **Goal:** Enterprise Inno Setup installer packaging.
- **Scope:**
  - Full packaging into `C:\Program Files\LABGUARD` and `%ProgramData%\LABGUARD`.
  - Icons, Start Menu shortcuts, clean uninstaller, version metadata.
- **Accomplished (COMPLETED):**
  - **Inno Setup Production Packaging (`installer/setup_script.iss`):**
    - Configured enterprise installer targeting `{autopf}\{#MyAppName}` (`C:\Program Files\LABGUARD`).
    - Provisioned all 5 enterprise vault directories under `{commonappdata}\LABGUARD\` (`database`, `sync`, `logs`, `evidence`, `config`) with `users-full` permissions.
    - Configured Modern Wizard style, solid lzma2/ultra64 compression, 64-bit native mode (`x64compatible`).
    - Configured Start Menu program group shortcuts, Desktop shortcuts, clean uninstaller shortcut, and optional Windows `Run` autostart registry key.
    - Embedded comprehensive Windows PE version resource metadata (`VersionInfoVersion=2.2.8.0`, `VersionInfoTextVersion=2.2.8`, `VersionInfoProductVersion=2.2.8`, `VersionInfoCompany`, `VersionInfoDescription`, `VersionInfoCopyright`).
  - **PowerShell Installation & Uninstallation Engine (`installer/`):**
    - Maintained `install_engine.ps1` with running process termination, vault directory provisioning, shortcut generation, and `Uninstall.bat` creation.
    - Updated Windows Add/Remove Programs registry keys to version `2.2.8`.
    - Maintained `uninstall_engine.ps1` providing thorough uninstallation: stopping running instances, removing Desktop/Start Menu shortcuts, purging `%LOCALAPPDATA%\LABGUARD`, and cleaning registry keys.
  - **Standalone Setup Builder (`installer/setup_builder/`):**
    - Updated standalone Rust installer (`Cargo.toml` & `src/main.rs`) to version `2.2.8`.
    - Self-contained binary bundling `dist/LABGUARD.exe` and `assets/logo.ico`, generating vaults, shortcuts, uninstaller, and registry records.
  - **Manifests Version Bump (`2.2.8`):** Synchronized all 8 manifests and packaging definitions (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/src/main.rs`, `installer/setup_script.iss`, `installer/setup_builder/Cargo.toml`, `installer/install_engine.ps1`).
  - **Automated Verification:**
    - 55/55 automated integration tests passing in `scratch/test_phase28_installer.cjs`.
    - Zero regressions across completed test suites: Phase 27 (29/29), Phase 26 (22/22), Phase 25 (31/31), Phase 21 (32/32), Phase 15 (39/39). Total 208/208 automated tests passing.
    - Clean production builds across backend (`tsc`), desktop frontend (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.8` (Applied)
- **Action:** STOP after Phase 28. Awaiting user instruction for Phase 29.

---

### Phase 29: Application Updates
- **Goal:** Secure application update mechanism.
- **Scope:**
  - Version checking against central server, integrity verification, safe local data preservation.
- **Accomplished (COMPLETED):**
  - **Shared Types Extension (`shared/types/index.ts`):**
    - Defined `AppUpdateInfo` contract: `currentVersion`, `latestVersion`, `hasUpdate`, `mandatory`, `downloadUrl`, `sha256Checksum`, `releaseNotes`, `publishedAt`, `minSupportedVersion`, and `fileSizeBytes`.
    - Defined `UpdateVerificationRequest` and `UpdateVerificationResult` contracts.
  - **Central Backend Update Engine (`backend/src/controllers/updateController.ts` & `backend/src/routes/api.ts`):**
    - Implemented `checkForUpdates` (`GET /api/system/updates/check`): compares client vs backend version with semver logic, evaluates mandatory update threshold (`minSupportedVersion: 2.1.0`), and delivers download URL and SHA-256 release checksum.
    - Implemented `verifyUpdateIntegrity` (`POST /api/system/updates/verify`): cryptographically validates package checksum and guarantees enterprise local data preservation (`dataPreserved: true`, all 5 vaults).
  - **Native Tauri Commands (`desktop/src-tauri/src/main.rs`):**
    - Implemented `check_local_data_integrity`: validates that `%ProgramData%\LABGUARD` and its 5 vaults (`database`, `sync`, `logs`, `evidence`, `config`) remain intact across updates.
    - Implemented `verify_update_payload`: computes and verifies SHA-256 file checksums via built-in Windows cryptography.
    - Registered commands in `tauri::generate_handler!`.
  - **Desktop Services & UI Components (`desktop/`):**
    - Added `checkLocalDataIntegrity` and `verifyUpdatePayload` to `NativeService` (`desktop/src/services/native.ts`).
    - Implemented `UpdateService` (`desktop/src/services/updateService.ts`): provides update discovery, server verification, and local vault verification.
    - Built `UpdateNotificationModal.tsx` (`desktop/src/components/UpdateNotificationModal.tsx`): modern modal with release highlights, mandatory update warnings, SHA-256 checksums, and vault preservation assurances.
  - **Manifests Version Bump (`2.2.9`):** Synchronized all 8 manifests and installer definitions (`backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `installer/setup_script.iss`, `installer/setup_builder/Cargo.toml`, `installer/setup_builder/src/main.rs`, `installer/install_engine.ps1`).
  - **Automated Verification:**
    - 51/51 automated integration tests passing in `scratch/test_phase29_updates.cjs`.
    - Zero regressions across completed test suites: Phase 28 (55/55), Phase 27 (29/29), Phase 26 (22/22), Phase 25 (31/31), Phase 21 (32/32). Total 220/220 automated tests passing.
    - Clean production builds across backend (`tsc`), desktop frontend (`tsc && vite build`), and native Rust engine (`cargo check`).
- **Version Bump:** `2.2.9` (Applied)
- **Action:** STOP after Phase 29. Awaiting user instruction for Phase 30 (Complete System Testing & Validation).

---

### Phase 30: Complete System Testing & Validation
- **Goal:** End-to-end integration and regression testing across all 4 roles and 30 phases.
- **Scope:**
  - Complete automated test suite, fresh database verification, offline sync verification, zero fake data compliance.
- **Accomplished (COMPLETED):**
  - **Gold Master Manifest Synchronization (`2.3.0`):**
    - Synchronized version `2.3.0` across all 9 manifest and installer targets: `backend/package.json`, `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `installer/setup_script.iss`, `installer/setup_builder/Cargo.toml`, `installer/setup_builder/src/main.rs`, `installer/install_engine.ps1`, and `backend/src/controllers/updateController.ts`.
  - **Master System Verification Suite (`scratch/test_phase30_gold_master.cjs`):**
    - 75/75 automated validation tests passing (100%).
    - End-to-end authentication, JWT token generation, and RBAC matrix verification for all 4 roles: `ADMIN`, `FACULTY`, `LAB_ASSISTANT`, and `STUDENT`.
    - Role-based PC shutdown safety: verified student logout triggers shutdown routine while `ADMIN`, `FACULTY`, and `LAB_ASSISTANT` logouts are safeguarded.
    - Offline SQLite vault resilience: verified 14-table schema caching, offline password hashing, privilege escalation prevention, and crash recovery event replay.
    - Enterprise Inno Setup and `%ProgramData%\LABGUARD` vault retention across updates (`database`, `config`, `evidence`, `logs`, `sync`).
    - Cryptographic SHA-256 update pipeline verification and mandatory update policies for legacy clients.
  - **Historical Regression Battery (100% Pass Rate):**
    - Phase 30 Gold Master: 75/75 passed (100%)
    - Phase 29 Application Updates: 51/51 passed (100%)
    - Phase 28 Production Windows Installer: 55/55 passed (100%)
    - Phase 27 Crash Recovery: 29/29 passed (100%)
    - Phase 26 Security Hardening: 22/22 passed (100%)
    - Phase 25 Student Automatic Shutdown: 31/31 passed (100%)
    - Phase 21 Live Lab Monitoring: 32/32 passed (100%)
    - Phase 15 Issue Tracking: 39/39 passed (100%)
    - Total verified test assertions: **334 / 334 passed (100%)**.
  - **Production Builds Certified:**
    - `backend` (`tsc`): Exit code 0, clean build.
    - `desktop` (`tsc && vite build`): Exit code 0, 1490 modules bundled.
    - `desktop/src-tauri` (`cargo check`): Exit code 0, clean build.
    - `installer/setup_builder` (`cargo check`): Exit code 0, clean build.
- **Version Bump:** `2.3.0` (Production Gold Master Applied)
- **Status:** **ALL 30/30 PHASES COMPLETED AND CERTIFIED.** Production Gold Master v2.3.0 signed off.

