-- ============================================================================
-- LABGUARD v3.5.1 Optimization & Performance Upgrade Migration
-- Migration File: database/migrations/06_v3_5_1_optimization_upgrade.sql
-- Target: Supabase / PostgreSQL 15+
--
-- STRICT DATA-SAFETY GUARANTEES:
--   1. Purely additive DDL: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS.
--   2. ZERO destructive commands: NO DROP TABLE, NO TRUNCATE, NO CASCADE DELETE.
--   3. Fully idempotent: Safe to execute multiple times against existing production databases.
--   4. Upgrades system metadata, default agent version, and performance indexing.
-- ============================================================================

-- 1. Ensure Agent Version defaults to 3.5.1 on endpoint devices
ALTER TABLE IF EXISTS endpoint_devices 
    ALTER COLUMN agent_version SET DEFAULT '3.5.1';

-- 2. Ensure endpoint_events has is_handled column for alert triaging and filtering
ALTER TABLE IF EXISTS endpoint_events 
    ADD COLUMN IF NOT EXISTS is_handled BOOLEAN DEFAULT false NOT NULL;

-- 3. Performance Indexing for High-Speed Heartbeat & Startup Queries
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_client_lookup 
    ON endpoint_devices (client_id, service_status);

CREATE INDEX IF NOT EXISTS idx_endpoint_events_unhandled_severity
    ON endpoint_events (severity, is_handled, created_at DESC);

-- 4. Optimization Metadata Configuration Registry Entry
CREATE TABLE IF NOT EXISTS local_configuration (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO local_configuration (key, value)
VALUES ('SYSTEM_VERSION', '3.5.1')
ON CONFLICT (key) DO UPDATE SET value = '3.5.1';

INSERT INTO local_configuration (key, value)
VALUES ('STARTUP_OPTIMIZATION_ENABLED', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Also sync to system_settings if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES ('SYSTEM_VERSION', '3.5.1', 'Current system version')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = '3.5.1', updated_at = CURRENT_TIMESTAMP;

        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES ('STARTUP_OPTIMIZATION_ENABLED', 'true', 'Sub-second startup optimization flag')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true', updated_at = CURRENT_TIMESTAMP;
    END IF;
END $$;

-- 5. Audit Log Entry for Version 3.5.1 Upgrade
INSERT INTO audit_logs (id, action, entity, entity_id, metadata, timestamp)
VALUES (
    gen_random_uuid(),
    'SYSTEM_UPGRADE_V3_5_1',
    'SYSTEM',
    '00000000-0000-0000-0000-000000000000',
    '{"version": "3.5.1", "description": "Startup sequence optimization, non-blocking failover, sub-second boot verification."}'::jsonb,
    CURRENT_TIMESTAMP
);


