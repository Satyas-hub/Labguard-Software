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
exports.syncCloudTombstones = syncCloudTombstones;
exports.recordCloudDeletion = recordCloudDeletion;
exports.isInstitutionBootstrapped = isInstitutionBootstrapped;
exports.markInstitutionBootstrapped = markInstitutionBootstrapped;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
const pool_1 = require("./pool");
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
/**
 * Synchronize cloud deletion tombstones between local disk store and Supabase system_settings.
 * Guarantees that any record deleted in Supabase or locally NEVER resurrects.
 */
async function syncCloudTombstones() {
    const sb = getSupabase();
    const localDeleted = pool_1.db.getStore('deleted_entities');
    const deletedIdSet = new Set(localDeleted.map((d) => d.id));
    if (!sb)
        return deletedIdSet;
    try {
        const { data } = await sb
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'cloud_deleted_entities_tombstones')
            .maybeSingle();
        let cloudDeletedList = [];
        if (data && data.setting_value) {
            try {
                cloudDeletedList = JSON.parse(data.setting_value);
            }
            catch { }
        }
        // 1. Ingest cloud tombstones into local store
        let modified = false;
        for (const item of cloudDeletedList) {
            if (item && item.id) {
                deletedIdSet.add(item.id);
                if (!pool_1.db.isDeleted(item.id)) {
                    pool_1.db.recordDeletion(item.id, item.entityType || 'UNKNOWN', item);
                    modified = true;
                }
            }
        }
        // 2. Push any local tombstones up to Supabase
        const mergedMap = new Map();
        for (const item of cloudDeletedList) {
            if (item && item.id)
                mergedMap.set(item.id, item);
        }
        for (const item of localDeleted) {
            if (item && item.id)
                mergedMap.set(item.id, item);
        }
        const mergedList = Array.from(mergedMap.values());
        if (mergedList.length > cloudDeletedList.length) {
            await sb.from('system_settings').upsert({
                setting_key: 'cloud_deleted_entities_tombstones',
                setting_value: JSON.stringify(mergedList),
                description: 'Permanent cloud tombstone registry preventing deleted records from resurrecting across all nodes',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        if (modified) {
            pool_1.db.flush();
        }
    }
    catch (err) {
        console.warn('[Supabase Tombstones] Sync error:', err.message);
    }
    return deletedIdSet;
}
/**
 * Permanently records a deletion tombstone locally and in Supabase cloud system_settings
 */
async function recordCloudDeletion(id, entityType, extra) {
    // 1. Immediate local tombstone and disk commit
    pool_1.db.recordDeletion(id, entityType, extra);
    pool_1.db.flush();
    const sb = getSupabase();
    if (!sb)
        return;
    try {
        const { data } = await sb
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'cloud_deleted_entities_tombstones')
            .maybeSingle();
        let list = [];
        if (data && data.setting_value) {
            try {
                list = JSON.parse(data.setting_value);
            }
            catch { }
        }
        if (!list.some(x => x.id === id)) {
            list.push({
                id,
                entityType,
                deletedAt: new Date().toISOString(),
                ...extra
            });
            await sb.from('system_settings').upsert({
                setting_key: 'cloud_deleted_entities_tombstones',
                setting_value: JSON.stringify(list),
                description: 'Permanent cloud tombstone registry preventing deleted records from resurrecting across all nodes',
                updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
        // 2. Cascade cloud cache cleanups so deleted entities never resurrect from system_settings
        if (entityType === 'USER' || entityType === 'STUDENT') {
            const { data: cacheData } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'users_extended_cache').maybeSingle();
            if (cacheData && cacheData.setting_value) {
                try {
                    const parsed = JSON.parse(cacheData.setting_value);
                    if (parsed && Array.isArray(parsed.users)) {
                        parsed.users = parsed.users.filter((u) => u.id !== id && (extra?.email ? u.email !== extra.email : true));
                    }
                    if (parsed && Array.isArray(parsed.students)) {
                        parsed.students = parsed.students.filter((s) => s.id !== id && s.userId !== id);
                    }
                    await sb.from('system_settings').upsert({
                        setting_key: 'users_extended_cache',
                        setting_value: JSON.stringify(parsed),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'setting_key' });
                }
                catch { }
            }
        }
        else if (entityType === 'CLASS') {
            const { data: cacheData } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_classes_cache').maybeSingle();
            if (cacheData && cacheData.setting_value) {
                try {
                    const parsed = JSON.parse(cacheData.setting_value);
                    if (Array.isArray(parsed)) {
                        const filtered = parsed.filter((c) => c.id !== id);
                        await sb.from('system_settings').upsert({
                            setting_key: 'academic_classes_cache',
                            setting_value: JSON.stringify(filtered),
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'setting_key' });
                    }
                }
                catch { }
            }
        }
        else if (entityType === 'SECTION') {
            const { data: cacheData } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_sections').maybeSingle();
            if (cacheData && cacheData.setting_value) {
                try {
                    const parsed = JSON.parse(cacheData.setting_value);
                    if (Array.isArray(parsed)) {
                        const filtered = parsed.filter((s) => s.id !== id && (extra?.name ? s.name !== extra.name : true));
                        await sb.from('system_settings').upsert({
                            setting_key: 'academic_sections',
                            setting_value: JSON.stringify(filtered),
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'setting_key' });
                    }
                }
                catch { }
            }
        }
    }
    catch (e) {
        console.warn('[Supabase Cloud Deletion] Error recording cloud tombstone:', e.message);
    }
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
