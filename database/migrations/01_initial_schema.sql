-- ============================================================================
-- LABGUARD: College Computer Laboratory Management & Accountability Platform
-- Database Migration: 01_initial_schema.sql
-- Description: Core 21 normalized tables with UUIDs, constraints, and audit fields
-- Target DB: Supabase PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ROLES (Strictly 4 Application Roles: ADMIN, FACULTY, LAB_ASSISTANT, STUDENT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. USERS (Centralized authentication with secure hash)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. STUDENTS (Student specific profile details)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    section VARCHAR(20) NOT NULL,
    semester INT NOT NULL,
    admission_year INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. FACULTY (Faculty profile and institutional details)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 5. LAB ASSISTANTS (Technical staff responsible for laboratory upkeep)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    shift VARCHAR(50) DEFAULT 'GENERAL',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. LABS (Dynamic Laboratory entities - Scalable beyond 7 labs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g. LAB-01, LAB-02
    name VARCHAR(255) NOT NULL,
    room VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, MAINTENANCE, INACTIVE
    pc_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. COMPUTERS (Lab PCs with identification & live status)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS computers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    pc_code VARCHAR(50) NOT NULL, -- e.g. PC-001, PC-017
    hostname VARCHAR(150),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    status VARCHAR(50) DEFAULT 'AVAILABLE' NOT NULL, -- AVAILABLE, OCCUPIED, MAINTENANCE, OFFLINE
    is_online BOOLEAN DEFAULT FALSE NOT NULL,
    last_heartbeat TIMESTAMPTZ,
    client_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_lab_pc_code UNIQUE (lab_id, pc_code)
);

-- ----------------------------------------------------------------------------
-- 8. EQUIPMENT (Accountability asset registry for Keyboards, Mice, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id VARCHAR(100) UNIQUE NOT NULL, -- e.g. KB-017, MS-017
    type VARCHAR(50) NOT NULL, -- KEYBOARD, MOUSE, MONITOR, HEADSET, OTHER
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'OPERATIONAL' NOT NULL, -- OPERATIONAL, DEFECTIVE, MISSING, UNDER_REPAIR
    qr_code_data TEXT NOT NULL,
    purchase_date DATE,
    warranty_until DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 9. COMPUTER_EQUIPMENT (Active/Historical mapping of peripherals to PCs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS computer_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    slot_type VARCHAR(50) NOT NULL, -- KEYBOARD, MOUSE, PRIMARY_MONITOR, etc.
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unassigned_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL -- ACTIVE, REPLACED, DETACHED
);

-- ----------------------------------------------------------------------------
-- 10. USER_LAB_ASSIGNMENTS (Strict RBAC mapping for Faculty & Lab Assistants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_lab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    assignment_type VARCHAR(50) NOT NULL, -- FACULTY, LAB_ASSISTANT, ADMIN_SUPERVISOR
    assigned_from DATE NOT NULL,
    assigned_to DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, INACTIVE, REVOKED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_user_lab_assignment UNIQUE (user_id, lab_id, assignment_type)
);

-- ----------------------------------------------------------------------------
-- 11. SUBJECTS (Academic subjects taught in computer laboratories)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    semester INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 12. CLASS_SESSIONS (Scheduled/live faculty classes in a lab)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
    section VARCHAR(20) NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL, -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    expected_students_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 13. CLASS_STUDENTS (Students roster & attendance for a class session)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL, -- PENDING, JOINED, ABSENT
    CONSTRAINT uq_class_student UNIQUE (class_session_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 14. SESSIONS (PC Usage and Entry/Exit tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL, -- STUDENT, FACULTY
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE RESTRICT,
    class_session_id UUID REFERENCES class_sessions(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_time TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, COMPLETED, CANCELLED, FORCED_END, ERROR
    ip_address VARCHAR(45),
    device_metadata JSONB DEFAULT '{}'::jsonb,
    duration_minutes INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 15. HARDWARE_EVENTS (Supported hardware connection/disconnection monitoring)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hardware_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- HARDWARE_CONNECTED, HARDWARE_DISCONNECTED, HARDWARE_MISMATCH, CLIENT_OFFLINE, CLIENT_ONLINE
    severity VARCHAR(50) DEFAULT 'INFO' NOT NULL, -- INFO, WARNING, CRITICAL
    description TEXT NOT NULL, -- Neutral wording required
    event_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- 16. ISSUES (Issue reporting lifecycle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. ISS-1042
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    issue_type VARCHAR(100) NOT NULL, -- KEY_NOT_WORKING, KEYBOARD_NOT_DETECTED, MOUSE_NOT_WORKING, MOUSE_NOT_DETECTED, CABLE_PROBLEM, PHYSICAL_DAMAGE_REPORTED, OTHER
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    photo_evidence_url TEXT,
    status VARCHAR(50) DEFAULT 'OPEN' NOT NULL, -- OPEN, VERIFIED, INVESTIGATING, MAINTENANCE, RESOLVED, REJECTED
    priority VARCHAR(50) DEFAULT 'MEDIUM' NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 17. ISSUE_EVENTS (Incident timeline history for issues)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    comment TEXT,
    action_taken TEXT,
    evidence_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 18. MAINTENANCE (Maintenance and repair workflow)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    computer_id UUID REFERENCES computers(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    technician_name VARCHAR(150),
    scheduled_date DATE,
    completed_date DATE,
    cost NUMERIC(10, 2) DEFAULT 0.00,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL, -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 19. NOTIFICATIONS (Role and lab-scoped standardized notifications)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
    computer_id UUID REFERENCES computers(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'INFO' NOT NULL, -- INFO, WARNING, CRITICAL
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 20. NOTIFICATION_PREFERENCES (Per-user delivery settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hardware_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    issue_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    maintenance_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    session_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    system_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    in_app_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    browser_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    email_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 21. AUDIT_LOGS (Immutable administrative and security events)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- USER_CREATED, ASSIGNMENT_CHANGED, LAB_CREATED, etc.
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);
