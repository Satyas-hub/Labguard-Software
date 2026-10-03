# LABGUARD v2.5.0: Database Design & Normalization Specification

---

## 1. Design Philosophy
The LABGUARD storage architecture uses a dual-engine model:
1. **Local SQLite (`labguard.db`)**: Primary operational and offline-first store situated in `%ProgramData%\LABGUARD\database\labguard.db`. Every workstation mutation is committed to SQLite first and enqueued in `sync_queue`.
2. **Central Supabase PostgreSQL**: Authoritative system-of-record housing the institutional hierarchy, historical telemetry, and multi-laboratory reporting data.

---

## 2. Core Relational Entities & Cardinality

### Academic & People Domain
- `departments` (1) ──< `courses` (N)
- `courses` (1) ──< `classes` (N)
- `academic_years` (1) ──< `semesters` (N)
- `semesters` (1) ──< `classes` (N)
- `sections` (1) ──< `classes` (N)
- `subjects` (1) ──< `classes` (N)
- `classes` (1) ──< `student_class_assignments` (N) >── (1) `students`
- `classes` (1) ──< `class_faculty` (N) >── (1) `faculty`

### Multi-Dimensional Assignment Domain
- `faculty_lab_batch_assignments`:
  - `faculty_id` (FK -> `faculty.id`)
  - `lab_id` (FK -> `labs.id`)
  - `class_id` (FK -> `classes.id`)
  - `subject_id` (FK -> `subjects.id`)
  - Unique constraint enforces zero duplicate active assignments.
- `lab_assistant_batch_assignments`:
  - `lab_assistant_id` (FK -> `lab_assistants.id`)
  - `lab_id` (FK -> `labs.id`)
  - `class_id` (FK -> `classes.id`)
  - Unique constraint enforces single active monitoring assignment.
- `class_schedules`:
  - Timetable entity linking `class_id`, `lab_id`, `faculty_id`, `subject_id`, `schedule_date`, `start_time`, `end_time`.
  - Dynamic status: `UPCOMING`, `ONGOING`, `COMPLETED`, `CANCELLED`.

### Infrastructure & Hardware Domain
- `labs` (1) ──< `computers` (N)
  - `UNIQUE (lab_id, pc_code)` prevents duplicate PC identifiers within a lab.
- `computers` (1) ──< `clients` (1)
  - `client_id` is unique per physical installation.
- `computers` (1) ──< `computer_equipment` (N) >── (1) `equipment`
  - Peripherals assigned to specific workstation slots (`KEYBOARD`, `MOUSE`, `PRIMARY_MONITOR`).

### Operations & Auditing Domain
- `sessions`: User workstation login periods (`ACTIVE`, `COMPLETED`, `FORCED_END`).
- `hardware_events`: Hardware connection, disconnection, and mismatch telemetry.
- `issues` & `issue_events`: Defect reporting and verification timeline.
- `maintenance`: Physical repair and parts replacement tracking.
- `audit_logs`: Immutable institutional ledger tracking security events.
