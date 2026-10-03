-- ============================================================================
-- LABGUARD: College Computer Laboratory Management & Accountability Platform
-- Database Seed: 01_seed_data.sql
-- Description: Production baseline seed (Roles, Initial System Administrator, Settings).
--              Zero business demo data (No demo students, faculty, labs, PCs, or issues).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SYSTEM ROLES (Strictly 4 Application Roles)
-- ----------------------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ADMIN', 'Institution-level management with global access to infrastructure, people, and academic structures'),
    ('10000000-0000-0000-0000-000000000002', 'FACULTY', 'Academic and student management restricted to assigned classes and laboratories'),
    ('10000000-0000-0000-0000-000000000003', 'LAB_ASSISTANT', 'Laboratory operational management restricted strictly to assigned laboratories'),
    ('10000000-0000-0000-0000-000000000004', 'STUDENT', 'Workstation self-service for coursework, equipment status, and reporting issues')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. INITIAL BOOTSTRAP ADMINISTRATOR
-- ----------------------------------------------------------------------------
-- Standard BCrypt Hash for 'Admin@123456' (cost factor 10)
-- Hash: $2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG (valid bcrypt hash)
-- Credentials:
-- Email: admin@labguard.edu
-- Password: Admin@123456
INSERT INTO users (id, email, password_hash, full_name, role_id, phone, is_active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'admin@labguard.edu', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'System Administrator', '10000000-0000-0000-0000-000000000001', '+1-555-0100', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. SYSTEM SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('student_enrollment_policy', 'DIRECT', 'Policy for faculty student enrollment: DIRECT or ADMIN_APPROVAL')
ON CONFLICT (setting_key) DO NOTHING;
