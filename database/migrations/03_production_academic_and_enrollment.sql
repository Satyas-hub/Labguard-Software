-- ============================================================================
-- LABGUARD: College Computer Laboratory Management & Accountability Platform
-- Database Migration: 03_production_academic_and_enrollment.sql
-- Description: Production Academic, Class Assignment & Enrollment Architecture
-- ============================================================================

-- 1. Enhance students, faculty, lab_assistants tables with production columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS course VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS year_of_study INT DEFAULT 1;

ALTER TABLE faculty ADD COLUMN IF NOT EXISTS faculty_id VARCHAR(50);
ALTER TABLE lab_assistants ADD COLUMN IF NOT EXISTS assistant_id VARCHAR(50);

-- 2. Academic Departments
CREATE TABLE IF NOT EXISTS academic_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Academic Courses
CREATE TABLE IF NOT EXISTS academic_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES academic_departments(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    degree_level VARCHAR(50) DEFAULT 'Undergraduate', -- Diploma, B.Tech, M.Tech, etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Academic Classes (Academic Class offerings linking Course, Subject, Section, Lab, Faculty)
CREATE TABLE IF NOT EXISTS academic_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES academic_courses(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES academic_departments(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    default_lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    academic_year VARCHAR(20) NOT NULL, -- e.g. 2026-2027
    year_of_study INT NOT NULL,         -- e.g. 1, 2, 3, 4
    semester INT NOT NULL,              -- e.g. 1..8
    section VARCHAR(20) NOT NULL,       -- e.g. CSE-A
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, ARCHIVED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Student Class Assignments (Separating Enrollment from Assignment with enrollment history)
CREATE TABLE IF NOT EXISTS student_class_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES academic_classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    semester INT NOT NULL,
    section VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, COMPLETED, DROPPED
    enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    enrolled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_student_class_assignment UNIQUE (student_id, class_id)
);

-- 6. Enrollment Requests (Configurable Admin Approval Workflow)
CREATE TABLE IF NOT EXISTS enrollment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) NOT NULL, -- NEW_STUDENT, EXISTING_STUDENT
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    target_class_id UUID NOT NULL REFERENCES academic_classes(id) ON DELETE CASCADE,
    student_data JSONB DEFAULT '{}'::jsonb, -- details for new student
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL, -- PENDING, APPROVED, REJECTED
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 7. System Settings (e.g. Student Enrollment Policy)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Initial default setting for student enrollment policy: DIRECT or ADMIN_APPROVAL
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('student_enrollment_policy', 'DIRECT', 'Policy for faculty student enrollment: DIRECT or ADMIN_APPROVAL')
ON CONFLICT (setting_key) DO NOTHING;

-- Create indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_academic_classes_faculty ON academic_classes(faculty_id);
CREATE INDEX IF NOT EXISTS idx_academic_classes_lab ON academic_classes(default_lab_id);
CREATE INDEX IF NOT EXISTS idx_student_class_student ON student_class_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_class ON student_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_status ON enrollment_requests(status);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_faculty ON enrollment_requests(faculty_id);
