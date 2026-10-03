-- ============================================================================
-- LABGUARD V2: Supabase Migration Script for Workstation Report Synchronization
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ============================================================================

-- 1. Ensure all columns exist on SESSIONS table
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS student_identifier TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS computer_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS lab_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS lab_code TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS pc_code TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS start_mode TEXT DEFAULT 'NORMAL';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS end_mode TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'SYNCED';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure all columns exist on ISSUES table
CREATE TABLE IF NOT EXISTS public.issues (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reporter_name TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reporter_role TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS computer_id TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS lab_id TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS lab_code TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS pc_code TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_type TEXT DEFAULT 'Other';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'LOW';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure all columns exist on MAINTENANCE table
CREATE TABLE IF NOT EXISTS public.maintenance (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS issue_id TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS lab_id TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS lab_code TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS computer_id TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS responsible_user TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SCHEDULED';
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Ensure all columns exist on HARDWARE_EVENTS table
CREATE TABLE IF NOT EXISTS public.hardware_events (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS lab_id TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS lab_code TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS computer_id TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS pc_code TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hardware_events ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Ensure all columns exist on AUDIT_LOGS table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS lab_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Consolidated Workstation Sync Batches table
CREATE TABLE IF NOT EXISTS public.lab_reports (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'WORKSTATION_BATCH_SYNC',
    sessions_count INT DEFAULT 0,
    issues_count INT DEFAULT 0,
    maintenance_count INT DEFAULT 0,
    hardware_events_count INT DEFAULT 0,
    audit_logs_count INT DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Grant access to anon, authenticated, and service_role (Prevents RLS 42501 error)
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.issues DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hardware_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculty DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_assistants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.labs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.computers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academic_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 8. Seed Baseline Roles if not present
INSERT INTO public.roles (id, name, description)
VALUES 
    ('10000000-0000-0000-0000-000000000001', 'ADMIN', 'Institutional System Administrator'),
    ('10000000-0000-0000-0000-000000000002', 'FACULTY', 'Academic Faculty Professor'),
    ('10000000-0000-0000-0000-000000000003', 'LAB_ASSISTANT', 'Laboratory Operations Assistant'),
    ('10000000-0000-0000-0000-000000000004', 'STUDENT', 'Institutional Student User')
ON CONFLICT (id) DO NOTHING;

