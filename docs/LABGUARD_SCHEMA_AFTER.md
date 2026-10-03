# LABGUARD Production Database Schema (AFTER Migration 05)

**Snapshot Timestamp**: September 20, 2026  
**Target Database**: Supabase PostgreSQL 15+  
**Database URL**: `https://nzonwmhyxbashmyrlzig.supabase.co`  
**Schema State**: Fully Verified, Additive Upgrade Completed

---

## 1. Complete Active Tables (40 Tables)

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
38. faculty_lab_batch_assignments [NEW]
39. lab_assistant_batch_assignments [NEW]
40. class_schedules [NEW]
```

---

## 2. New & Enhanced Schema Definitions

### 1. `faculty_lab_batch_assignments`
- **Purpose**: Direct multi-dimensional assignment linking Faculty member to a specific Laboratory, Class/Batch, and Subject.
- **Fields**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `faculty_id`: `UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE`
  - `lab_id`: `UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE`
  - `class_id`: `UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
  - `subject_id`: `UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE`
  - `status`: `VARCHAR(50) DEFAULT 'ACTIVE'`
  - `created_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- **Constraint**: `CONSTRAINT uq_faculty_lab_batch_assignment UNIQUE (faculty_id, lab_id, class_id, subject_id)`
- **Indexes**: `idx_flba_faculty`, `idx_flba_lab`, `idx_flba_class`

### 2. `lab_assistant_batch_assignments`
- **Purpose**: Restricts Lab Assistant monitoring scope strictly to assigned laboratories and designated classes/batches.
- **Fields**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `lab_assistant_id`: `UUID NOT NULL REFERENCES lab_assistants(id) ON DELETE CASCADE`
  - `lab_id`: `UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE`
  - `class_id`: `UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
  - `status`: `VARCHAR(50) DEFAULT 'ACTIVE'`
  - `created_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- **Constraint**: `CONSTRAINT uq_assistant_lab_batch UNIQUE (lab_assistant_id, lab_id, class_id)`
- **Indexes**: `idx_laba_assistant`, `idx_laba_lab`, `idx_laba_class`

### 3. `class_schedules`
- **Purpose**: Timetable management tracking batch sessions across institutional laboratories.
- **Fields**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `class_id`: `UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
  - `lab_id`: `UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE`
  - `faculty_id`: `UUID REFERENCES faculty(id) ON DELETE SET NULL`
  - `subject_id`: `UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE`
  - `schedule_date`: `DATE NOT NULL`
  - `start_time`: `TIME NOT NULL`
  - `end_time`: `TIME NOT NULL`
  - `status`: `VARCHAR(50) DEFAULT 'UPCOMING'` (`UPCOMING`, `ONGOING`, `COMPLETED`, `CANCELLED`)
  - `expected_students_count`: `INT DEFAULT 0`
  - `created_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- **Constraint**: `CONSTRAINT chk_schedule_times CHECK (end_time > start_time)`
- **Indexes**: `idx_schedules_lab`, `idx_schedules_faculty`, `idx_schedules_class`, `idx_schedules_date_status`

### 4. Workstation Rebinding Enhancements
- **`clients.hardware_status`**: Stores snapshot of detected PnP hardware state.
- **`clients.previous_client_ids`**: JSONB array preserving UUID history when an existing workstation is re-imaged.
- **`computers.bound_client_id`**: Foreign pointer binding hardware terminal to client installation without duplicate computer creation.
