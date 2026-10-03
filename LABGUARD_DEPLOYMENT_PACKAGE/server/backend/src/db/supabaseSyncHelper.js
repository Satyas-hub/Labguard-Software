"use strict";
// ============================================================================
// LABGUARD V2.5.1: Supabase Cloud Synchronization & Permanent Persistence Helper
// Ensures two-way CRUD sync and prevents deleted records from resurrecting.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
exports.isInstitutionBootstrapped = isInstitutionBootstrapped;
exports.markInstitutionBootstrapped = markInstitutionBootstrapped;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedClient = null;
let bootstrappedCache = null;
const LOCK_FILE_PATH = path_1.default.resolve(__dirname, '../../data/bootstrap.lock');
function getSupabase() {
    if (!cachedClient && env_1.ENV.SUPABASE_URL && env_1.ENV.SUPABASE_KEY) {
        try {
            cachedClient = (0, supabase_js_1.createClient)(env_1.ENV.SUPABASE_URL, env_1.ENV.SUPABASE_KEY, {
                auth: { persistSession: false }
            });
        }
        catch (e) {
            console.warn('[Supabase Sync Helper] Client initialization failed:', e.message);
        }
    }
    return cachedClient;
}
async function isInstitutionBootstrapped() {
    if (bootstrappedCache === true)
        return true;
    try {
        if (fs_1.default.existsSync(LOCK_FILE_PATH)) {
            bootstrappedCache = true;
            return true;
        }
    }
    catch (e) {
        // Ignore file read error
    }
    const sb = getSupabase();
    if (sb) {
        try {
            const { data } = await sb
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'institution_bootstrap_completed')
                .maybeSingle();
            if (data && data.setting_value === 'true') {
                bootstrappedCache = true;
                saveLocalLock();
                return true;
            }
        }
        catch (err) {
            console.warn('[Supabase Sync Helper] Error checking bootstrap status in cloud:', err.message);
        }
    }
    return false;
}
async function markInstitutionBootstrapped() {
    bootstrappedCache = true;
    saveLocalLock();
    const sb = getSupabase();
    if (sb) {
        try {
            await sb.from('system_settings').upsert({
                setting_key: 'institution_bootstrap_completed',
                setting_value: 'true',
                description: 'Tracks that the institutional baseline setup has completed; prevents re-seeding deleted records.',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        catch (err) {
            console.warn('[Supabase Sync Helper] Error marking bootstrap status in cloud:', err.message);
        }
    }
}
function saveLocalLock() {
    try {
        const dir = path_1.default.dirname(LOCK_FILE_PATH);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ bootstrappedAt: new Date().toISOString() }), 'utf8');
    }
    catch (e) {
        // Non-critical local write
    }
}
