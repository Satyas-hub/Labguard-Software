-- ============================================================================
-- LABGUARD: College Computer Laboratory Management & Accountability Platform
-- Database Migration: 02_indexes_and_rls.sql
-- Description: Indexes for sub-millisecond query performance and Supabase RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);

CREATE INDEX IF NOT EXISTS idx_faculty_user_id ON faculty(user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_employee_id ON faculty(employee_id);

CREATE INDEX IF NOT EXISTS idx_lab_assistants_user_id ON lab_assistants(user_id);

CREATE INDEX IF NOT EXISTS idx_labs_code ON labs(code);
CREATE INDEX IF NOT EXISTS idx_labs_status ON labs(status);

CREATE INDEX IF NOT EXISTS idx_computers_lab_id ON computers(lab_id);
CREATE INDEX IF NOT EXISTS idx_computers_status ON computers(status);
CREATE INDEX IF NOT EXISTS idx_computers_is_online ON computers(is_online);
CREATE INDEX IF NOT EXISTS idx_computers_pc_code ON computers(pc_code);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_id ON equipment(asset_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);

CREATE INDEX IF NOT EXISTS idx_computer_equipment_computer_id ON computer_equipment(computer_id);
CREATE INDEX IF NOT EXISTS idx_computer_equipment_equipment_id ON computer_equipment(equipment_id);
CREATE INDEX IF NOT EXISTS idx_computer_equipment_status ON computer_equipment(status);

CREATE INDEX IF NOT EXISTS idx_user_lab_assignments_user_id ON user_lab_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lab_assignments_lab_id ON user_lab_assignments(lab_id);
CREATE INDEX IF NOT EXISTS idx_user_lab_assignments_status ON user_lab_assignments(status);

CREATE INDEX IF NOT EXISTS idx_class_sessions_faculty_id ON class_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_lab_id ON class_sessions(lab_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_start ON class_sessions(scheduled_start);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lab_id ON sessions(lab_id);
CREATE INDEX IF NOT EXISTS idx_sessions_computer_id ON sessions(computer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_hardware_events_lab_id ON hardware_events(lab_id);
CREATE INDEX IF NOT EXISTS idx_hardware_events_computer_id ON hardware_events(computer_id);
CREATE INDEX IF NOT EXISTS idx_hardware_events_event_time ON hardware_events(event_time);
CREATE INDEX IF NOT EXISTS idx_hardware_events_event_type ON hardware_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hardware_events_severity ON hardware_events(severity);

CREATE INDEX IF NOT EXISTS idx_issues_lab_id ON issues(lab_id);
CREATE INDEX IF NOT EXISTS idx_issues_computer_id ON issues(computer_id);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON issues(reported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

CREATE INDEX IF NOT EXISTS idx_issue_events_issue_id ON issue_events(issue_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_computer_id ON maintenance(computer_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);

-- ----------------------------------------------------------------------------
-- Automatic Updated At Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_labs_updated_at ON labs;
CREATE TRIGGER trg_labs_updated_at BEFORE UPDATE ON labs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_computers_updated_at ON computers;
CREATE TRIGGER trg_computers_updated_at BEFORE UPDATE ON computers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_equipment_updated_at ON equipment;
CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON maintenance;
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
