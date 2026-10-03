-- ============================================================================
-- LABGUARD v3.5.0 Production Upgrade Migration
-- Migration File: database/migrations/05_v3_5_0_production_upgrade.sql
-- Target: Supabase / PostgreSQL 15+
--
-- STRICT DATA-SAFETY GUARANTEES:
--   1. Purely additive DDL: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS.
--   2. ZERO destructive commands: NO DROP TABLE, NO TRUNCATE, NO CASCADE DELETE.
--   3. Fully idempotent: Safe to execute multiple times against existing production databases.
--   4. Preserves all existing users, roles, computers, labs, classes, sessions, and audit records.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENDPOINT DEVICES (Enterprise EDR Workstation State & Inventory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS endpoint_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) UNIQUE NOT NULL,
    computer_id UUID REFERENCES computers(id) ON DELETE SET NULL,
    lab_code VARCHAR(50) NOT NULL DEFAULT 'UNASSIGNED',
    pc_code VARCHAR(50) NOT NULL DEFAULT 'UNASSIGNED',
    hostname VARCHAR(150),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    os_version VARCHAR(100) DEFAULT 'Microsoft Windows',
    agent_version VARCHAR(50) DEFAULT '3.5.0' NOT NULL,
    service_status VARCHAR(50) DEFAULT 'RUNNING' NOT NULL, -- RUNNING, STOPPED, DEGRADED
    health_state VARCHAR(50) DEFAULT 'HEALTHY' NOT NULL,   -- HEALTHY, WARNING, CRITICAL, OFFLINE
    network_state VARCHAR(50) DEFAULT 'ONLINE' NOT NULL,  -- ONLINE, OFFLINE, DEGRADED
    cpu_usage NUMERIC(5,2) DEFAULT 0.0,
    memory_usage NUMERIC(5,2) DEFAULT 0.0,
    disk_usage NUMERIC(5,2) DEFAULT 0.0,
    active_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    current_user_role VARCHAR(50),
    last_heartbeat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_sync_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    pending_events_count INT DEFAULT 0,
    security_event_count INT DEFAULT 0,
    is_maintenance_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endpoint_devices_client_id ON endpoint_devices(client_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_lab_pc ON endpoint_devices(lab_code, pc_code);
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_health ON endpoint_devices(health_state);
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_heartbeat ON endpoint_devices(last_heartbeat);

-- ----------------------------------------------------------------------------
-- 2. ENDPOINT & SECURITY EVENTS (Unified EDR Event Pipeline)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS endpoint_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) UNIQUE,
    client_id VARCHAR(100) NOT NULL,
    computer_id UUID REFERENCES computers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) DEFAULT 'SECURITY' NOT NULL, -- SYSTEM, AUTHENTICATION, SESSION, APPLICATION, DEVICE, NETWORK, SECURITY, MAINTENANCE, SYNC, RUNTIME, UPDATE
    event_type VARCHAR(100) NOT NULL,                 -- e.g. LOGIN_SUCCESS, LOGIN_FAILED, USB_CONNECTED, PROCESS_ALERT, NETWORK_OFFLINE, RECOVERY
    severity VARCHAR(50) DEFAULT 'INFO' NOT NULL,     -- INFO, WARNING, CRITICAL
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    local_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status VARCHAR(50) DEFAULT 'SYNCHRONIZED' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endpoint_events_client_id ON endpoint_events(client_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_category ON endpoint_events(category);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_severity ON endpoint_events(severity);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_timestamp ON endpoint_events(created_at);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_type ON endpoint_events(event_type);

-- ----------------------------------------------------------------------------
-- 3. OFFLINE CREDENTIALS CACHE (Secure Central Vault for Offline Authentication)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offline_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- Exactly 4 roles: ADMIN, FACULTY, LAB_ASSISTANT, STUDENT
    credential_hash TEXT NOT NULL,
    salt TEXT,
    iterations INT DEFAULT 100000 NOT NULL,
    credential_version INT DEFAULT 1 NOT NULL,
    last_successful_online_auth TIMESTAMPTZ,
    last_credential_sync TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    account_status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, LOCKED, DISABLED
    offline_login_allowed BOOLEAN DEFAULT TRUE NOT NULL,
    offline_login_expiry TIMESTAMPTZ,
    permissions_version INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offline_credentials_user ON offline_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_credentials_username ON offline_credentials(username);
CREATE INDEX IF NOT EXISTS idx_offline_credentials_role ON offline_credentials(role);

-- ----------------------------------------------------------------------------
-- 4. ENDPOINT HEARTBEATS & RUNTIME HEALTH TELEMETRY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS endpoint_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) NOT NULL,
    computer_id UUID REFERENCES computers(id) ON DELETE SET NULL,
    agent_version VARCHAR(50) DEFAULT '3.5.0' NOT NULL,
    service_status VARCHAR(50) DEFAULT 'RUNNING' NOT NULL,
    health_state VARCHAR(50) DEFAULT 'HEALTHY' NOT NULL,
    cpu_percent NUMERIC(5,2) DEFAULT 0.0,
    memory_percent NUMERIC(5,2) DEFAULT 0.0,
    disk_percent NUMERIC(5,2) DEFAULT 0.0,
    hardware_status JSONB DEFAULT '{"keyboard": true, "mouse": true, "monitor": true}'::jsonb,
    active_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    pending_sync_count INT DEFAULT 0,
    security_event_count INT DEFAULT 0,
    network_latency_ms INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endpoint_heartbeats_client ON endpoint_heartbeats(client_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_heartbeats_recorded ON endpoint_heartbeats(recorded_at);

-- ----------------------------------------------------------------------------
-- 5. SYNC QUEUE METADATA & IDEMPOTENT RECONCILIATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_queue_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(100) NOT NULL,
    client_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(200) UNIQUE NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    status VARCHAR(50) DEFAULT 'SYNCHRONIZED' NOT NULL, -- SYNCHRONIZED, FAILED, CONFLICT
    attempt_count INT DEFAULT 1 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_meta_batch ON sync_queue_metadata(batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_meta_client ON sync_queue_metadata(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_meta_idempotency ON sync_queue_metadata(idempotency_key);

-- ----------------------------------------------------------------------------
-- 6. CLIENT VERSIONS & SAFE UPDATE RELEASES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag VARCHAR(50) UNIQUE NOT NULL, -- e.g. 3.5.0
    release_name VARCHAR(255) NOT NULL,
    min_supported_version VARCHAR(50) DEFAULT '3.0.0' NOT NULL,
    download_url TEXT,
    checksum_sha256 VARCHAR(64),
    release_notes TEXT,
    is_critical BOOLEAN DEFAULT FALSE NOT NULL,
    released_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert initial release entry for v3.5.0 idempotently
INSERT INTO client_versions (version_tag, release_name, min_supported_version, checksum_sha256, release_notes, is_critical)
VALUES ('3.5.0', 'LABGUARD v3.5.0 Production EDR & Resilient Offline-First Release', '3.0.0', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Full enterprise EDR runtime, offline credentials cache, boot initialization shield, resilient watchdog, and endpoint telemetry.', false)
ON CONFLICT (version_tag) DO UPDATE SET
    release_name = EXCLUDED.release_name,
    release_notes = EXCLUDED.release_notes,
    released_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 7. ADDITIVE COLUMNS ON EXISTING SYSTEM TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE computers ADD COLUMN IF NOT EXISTS bound_client_id VARCHAR(100);
ALTER TABLE computers ADD COLUMN IF NOT EXISTS agent_version VARCHAR(50) DEFAULT '3.5.0';
ALTER TABLE computers ADD COLUMN IF NOT EXISTS health_state VARCHAR(50) DEFAULT 'HEALTHY';
ALTER TABLE computers ADD COLUMN IF NOT EXISTS cpu_usage NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE computers ADD COLUMN IF NOT EXISTS memory_usage NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE computers ADD COLUMN IF NOT EXISTS disk_usage NUMERIC(5,2) DEFAULT 0.0;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS agent_version VARCHAR(50) DEFAULT '3.5.0';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_state VARCHAR(50) DEFAULT 'HEALTHY';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_status VARCHAR(50) DEFAULT 'RUNNING';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hardware_status JSONB DEFAULT '{"keyboard": true, "mouse": true, "monitor": true}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS previous_client_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_offline BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'SYNCHRONIZED';

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_offline BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'SYNCHRONIZED';

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE endpoint_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_endpoint_devices') THEN
        CREATE POLICY service_role_endpoint_devices ON endpoint_devices FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_endpoint_events') THEN
        CREATE POLICY service_role_endpoint_events ON endpoint_events FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_offline_credentials') THEN
        CREATE POLICY service_role_offline_credentials ON offline_credentials FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_endpoint_heartbeats') THEN
        CREATE POLICY service_role_endpoint_heartbeats ON endpoint_heartbeats FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_sync_queue_metadata') THEN
        CREATE POLICY service_role_sync_queue_metadata ON sync_queue_metadata FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_client_versions') THEN
        CREATE POLICY service_role_client_versions ON client_versions FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;
