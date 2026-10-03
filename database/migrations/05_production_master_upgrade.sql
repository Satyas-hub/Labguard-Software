-- ============================================================================
-- LABGUARD V2.5.0: Production Master Upgrade Migration
-- Migration: 05_production_master_upgrade.sql
-- Target: Supabase PostgreSQL 15+
-- Description: Non-destructive additions:
--   1. faculty_lab_batch_assignments (Faculty -> Lab + Batch/Class + Subject)
--   2. lab_assistant_batch_assignments (Lab Assistant -> Lab + Batch/Class)
--   3. class_schedules (Timetable & Batch Scheduling: UPCOMING, ONGOING, COMPLETED)
--   4. Rebind & Idempotency Constraints
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. FACULTY LAB + BATCH + SUBJECT ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty_lab_batch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, ARCHIVED, REVOKED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_faculty_lab_batch_assignment UNIQUE (faculty_id, lab_id, class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_flba_faculty ON faculty_lab_batch_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_flba_lab ON faculty_lab_batch_assignments(lab_id);
CREATE INDEX IF NOT EXISTS idx_flba_class ON faculty_lab_batch_assignments(class_id);

-- ----------------------------------------------------------------------------
-- 2. LAB ASSISTANT BATCH MONITORING ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_assistant_batch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_assistant_id UUID NOT NULL REFERENCES lab_assistants(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, INACTIVE, REVOKED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_assistant_lab_batch UNIQUE (lab_assistant_id, lab_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_laba_assistant ON lab_assistant_batch_assignments(lab_assistant_id);
CREATE INDEX IF NOT EXISTS idx_laba_lab ON lab_assistant_batch_assignments(lab_id);
CREATE INDEX IF NOT EXISTS idx_laba_class ON lab_assistant_batch_assignments(class_id);

-- ----------------------------------------------------------------------------
-- 3. CLASS SCHEDULES (Detailed Timetable & Live Batch States)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'UPCOMING' NOT NULL, -- UPCOMING, ONGOING, COMPLETED, CANCELLED
    expected_students_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_schedule_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedules_lab ON class_schedules(lab_id);
CREATE INDEX IF NOT EXISTS idx_schedules_faculty ON class_schedules(faculty_id);
CREATE INDEX IF NOT EXISTS idx_schedules_class ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date_status ON class_schedules(schedule_date, status);

-- ----------------------------------------------------------------------------
-- 4. HARDWARE TELEMETRY & CLIENT REBINDING SUPPORT
-- ----------------------------------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hardware_status JSONB DEFAULT '{"keyboard": true, "mouse": true, "monitor": true}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS previous_client_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE computers ADD COLUMN IF NOT EXISTS bound_client_id VARCHAR(100);

-- Enable Row Level Security (RLS) policies for new tables
ALTER TABLE faculty_lab_batch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_assistant_batch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated backend service role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_faculty_lab_batch'
    ) THEN
        CREATE POLICY service_role_all_faculty_lab_batch ON faculty_lab_batch_assignments
            FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_assistant_batch'
    ) THEN
        CREATE POLICY service_role_all_assistant_batch ON lab_assistant_batch_assignments
            FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_schedules'
    ) THEN
        CREATE POLICY service_role_all_schedules ON class_schedules
            FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;
