# LABGUARD Baseline Database Schema (BEFORE Migration)

**Snapshot Timestamp**: September 20, 2026  
**Target Database**: Supabase PostgreSQL 15+  
**Database URL**: `https://nzonwmhyxbashmyrlzig.supabase.co`  
**Integrity State**: Fully Verified, Zero Data Loss

---

## 1. Verified Active Tables (37 Tables)

```
1.  roles
2.  users
3.  students
4.  faculty
5.  lab_assistants
6.  labs
7.  computers
8.  clients
9.  equipment
10. computer_equipment
11. classes
12. class_faculty
13. class_students
14. class_sessions
15. academic_departments
16. academic_courses
17. academic_classes
18. academic_years
19. sections
20. semesters
21. subjects
22. user_lab_assignments
23. student_class_assignments
24. sessions
25. issues
26. issue_events
27. maintenance
28. hardware_events
29. notifications
30. notification_preferences
31. audit_logs
32. sync_events
33. sync_conflicts
34. system_settings
35. enrollment_requests
36. departments
37. courses
```

---

## 2. Table Schemas & Relationships Summary

### Identity & Authentication
- **`roles`**: `id (UUID PK)`, `name (VARCHAR 50 UNIQUE)`, `description`, `created_at`.
  - Rows: `ADMIN`, `FACULTY`, `LAB_ASSISTANT`, `STUDENT`.
- **`users`**: `id (UUID PK)`, `email (VARCHAR 255 UNIQUE)`, `password_hash (VARCHAR 255)`, `full_name`, `role_id (FK -> roles)`, `phone`, `is_active (BOOLEAN)`, `created_at`, `updated_at`.
  - Baseline Account: `admin@labguard.edu` (System Administrator).
- **`students`**: `id (UUID PK)`, `user_id (FK -> users UNIQUE)`, `student_id (VARCHAR UNIQUE)`, `roll_number`, `course`, `department`, `section`, `semester`, `admission_year`, `year_of_study`, `created_at`.
- **`faculty`**: `id (UUID PK)`, `user_id (FK -> users UNIQUE)`, `faculty_id (VARCHAR UNIQUE)`, `employee_id (VARCHAR UNIQUE)`, `department`, `designation`, `created_at`.
- **`lab_assistants`**: `id (UUID PK)`, `user_id (FK -> users UNIQUE)`, `assistant_id (VARCHAR UNIQUE)`, `employee_id (VARCHAR UNIQUE)`, `department`, `shift`, `created_at`.

### Infrastructure & Hardware Telemetry
- **`labs`**: `id (UUID PK)`, `code (VARCHAR 50 UNIQUE)`, `name`, `room`, `description`, `status`, `pc_count`, `created_at`, `updated_at`.
- **`computers`**: `id (UUID PK)`, `lab_id (FK -> labs)`, `pc_code (VARCHAR 50)`, `hostname`, `ip_address`, `mac_address`, `status`, `is_online`, `last_heartbeat`, `client_version`, `created_at`, `updated_at`, `CONSTRAINT uq_lab_pc_code UNIQUE (lab_id, pc_code)`.
- **`clients`**: `id (UUID PK)`, `client_id (VARCHAR 100 UNIQUE)`, `lab_id (FK -> labs)`, `computer_id (FK -> computers)`, `lab_code`, `pc_code`, `app_version`, `os_version`, `is_registered`, `is_online`, `last_heartbeat`, `ip_address`, `created_at`, `updated_at`.
- **`equipment`**: `id (UUID PK)`, `asset_id (VARCHAR UNIQUE)`, `type`, `brand`, `model`, `serial_number`, `status`, `qr_code_data`, `purchase_date`, `warranty_until`, `created_at`, `updated_at`.
- **`computer_equipment`**: `id (UUID PK)`, `computer_id (FK -> computers)`, `equipment_id (FK -> equipment)`, `slot_type`, `assigned_at`, `unassigned_at`, `status`.
- **`hardware_events`**: `id (UUID PK)`, `lab_id (FK -> labs)`, `computer_id (FK -> computers)`, `equipment_id (FK -> equipment)`, `session_id`, `event_type`, `severity`, `description`, `event_time`, `metadata`.

### Academic Structure & Enrollment
- **`departments`** / **`academic_departments`**: `id (UUID PK)`, `code (UNIQUE)`, `name`, `description`.
- **`courses`** / **`academic_courses`**: `id (UUID PK)`, `department_id (FK)`, `code (UNIQUE)`, `name`, `degree_level`.
- **`academic_years`**: `id (UUID PK)`, `year_code (UNIQUE)`, `start_date`, `end_date`, `is_current`.
- **`semesters`**: `id (UUID PK)`, `academic_year_id (FK)`, `semester_number`, `term`, `start_date`, `end_date`, `is_current`.
- **`sections`**: `id (UUID PK)`, `course_id (FK)`, `name`.
- **`subjects`**: `id (UUID PK)`, `code (UNIQUE)`, `name`, `department`, `semester`.
- **`classes`** / **`academic_classes`**: `id (UUID PK)`, `course_id`, `subject_id`, `academic_year_id`, `semester_id`, `section_id`, `default_lab_id`, `name`, `status`.
- **`class_faculty`**: `id (UUID PK)`, `class_id (FK)`, `faculty_id (FK)`, `role`, `assigned_at`.
- **`student_class_assignments`**: `id (UUID PK)`, `student_id (FK)`, `class_id (FK)`, `academic_year`, `semester`, `section`, `status`, `enrolled_at`, `enrolled_by_user_id`.
- **`enrollment_requests`**: `id (UUID PK)`, `request_type`, `faculty_id (FK)`, `student_id (FK)`, `target_class_id (FK)`, `student_data`, `status`, `admin_notes`.

### Operations, Sessions & Incident Lifecycle
- **`sessions`**: `id (UUID PK)`, `user_id (FK)`, `role`, `lab_id (FK)`, `computer_id (FK)`, `class_session_id`, `start_time`, `end_time`, `status`, `ip_address`, `device_metadata`, `duration_minutes`.
- **`issues`**: `id (UUID PK)`, `issue_code (UNIQUE)`, `computer_id (FK)`, `equipment_id (FK)`, `lab_id (FK)`, `reported_by_user_id (FK)`, `issue_type`, `title`, `description`, `photo_evidence_url`, `status`, `priority`.
- **`issue_events`**: `id (UUID PK)`, `issue_id (FK)`, `user_id (FK)`, `previous_status`, `new_status`, `comment`, `action_taken`, `evidence_url`.
- **`maintenance`**: `id (UUID PK)`, `issue_id (FK)`, `computer_id (FK)`, `equipment_id (FK)`, `technician_name`, `scheduled_date`, `completed_date`, `cost`, `notes`, `status`.
- **`notifications`** & **`notification_preferences`**: System and lab-scoped notifications.
- **`audit_logs`**: Immutable security and audit events.
- **`sync_events`** & **`sync_conflicts`**: Synchronization logging and conflict tracking.
- **`system_settings`**: Key-value system configurations (`student_enrollment_policy`).
