// ============================================================================
// LABGUARD V2.5.1: Supabase Cloud Synchronization & Permanent Persistence Helper
// Ensures two-way CRUD sync and prevents deleted records from resurrecting.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { db } from './pool';
import fs from 'fs';
import path from 'path';

let cachedClient: SupabaseClient | null = null;
let bootstrappedCache: boolean | null = null;

const LOCK_FILE_PATH = path.resolve(__dirname, '../../data/bootstrap.lock');

export function getSupabase(): SupabaseClient | null {
  if (!cachedClient && ENV.SUPABASE_URL && ENV.SUPABASE_KEY) {
    try {
      cachedClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY, {
        auth: { persistSession: false }
      });
    } catch (e: any) {
      console.warn('[Supabase Sync Helper] Client initialization failed:', e.message);
    }
  }
  return cachedClient;
}

/**
 * Synchronize cloud deletion tombstones between local disk store and Supabase system_settings.
 * Guarantees that any record deleted in Supabase or locally NEVER resurrects.
 */
export async function syncCloudTombstones(): Promise<Set<string>> {
  const sb = getSupabase();
  const localDeleted = db.getStore('deleted_entities');
  const deletedIdSet = new Set<string>(localDeleted.map((d: any) => d.id));

  if (!sb) return deletedIdSet;

  try {
    const { data } = await sb
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'cloud_deleted_entities_tombstones')
      .maybeSingle();

    let cloudDeletedList: any[] = [];
    if (data && data.setting_value) {
      try {
        cloudDeletedList = JSON.parse(data.setting_value);
      } catch {}
    }

    // 1. Ingest cloud tombstones into local store
    let modified = false;
    for (const item of cloudDeletedList) {
      if (item && item.id) {
        deletedIdSet.add(item.id);
        if (!db.isDeleted(item.id)) {
          db.recordDeletion(item.id, item.entityType || 'UNKNOWN', item);
          modified = true;
        }
      }
    }

    // 2. Push any local tombstones up to Supabase
    const mergedMap = new Map<string, any>();
    for (const item of cloudDeletedList) {
      if (item && item.id) mergedMap.set(item.id, item);
    }
    for (const item of localDeleted) {
      if (item && item.id) mergedMap.set(item.id, item);
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
      db.flush();
    }
  } catch (err: any) {
    console.warn('[Supabase Tombstones] Sync error:', err.message);
  }

  return deletedIdSet;
}

/**
 * Permanently records a deletion tombstone locally and in Supabase cloud system_settings
 */
export async function recordCloudDeletion(id: string, entityType: string, extra?: Record<string, any>): Promise<void> {
  // 1. Immediate local tombstone and disk commit
  db.recordDeletion(id, entityType, extra);
  db.flush();

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data } = await sb
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'cloud_deleted_entities_tombstones')
      .maybeSingle();

    let list: any[] = [];
    if (data && data.setting_value) {
      try {
        list = JSON.parse(data.setting_value);
      } catch {}
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
            parsed.users = parsed.users.filter((u: any) => u.id !== id && (extra?.email ? u.email !== extra.email : true));
          }
          if (parsed && Array.isArray(parsed.students)) {
            parsed.students = parsed.students.filter((s: any) => s.id !== id && s.userId !== id);
          }
          await sb.from('system_settings').upsert({
            setting_key: 'users_extended_cache',
            setting_value: JSON.stringify(parsed),
            updated_at: new Date().toISOString()
          }, { onConflict: 'setting_key' });
        } catch {}
      }
    } else if (entityType === 'CLASS') {
      const { data: cacheData } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_classes_cache').maybeSingle();
      if (cacheData && cacheData.setting_value) {
        try {
          const parsed = JSON.parse(cacheData.setting_value);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((c: any) => c.id !== id);
            await sb.from('system_settings').upsert({
              setting_key: 'academic_classes_cache',
              setting_value: JSON.stringify(filtered),
              updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
          }
        } catch {}
      }
    } else if (entityType === 'SECTION') {
      const { data: cacheData } = await sb.from('system_settings').select('setting_value').eq('setting_key', 'academic_sections').maybeSingle();
      if (cacheData && cacheData.setting_value) {
        try {
          const parsed = JSON.parse(cacheData.setting_value);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((s: any) => s.id !== id && (extra?.name ? s.name !== extra.name : true));
            await sb.from('system_settings').upsert({
              setting_key: 'academic_sections',
              setting_value: JSON.stringify(filtered),
              updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
          }
        } catch {}
      }
    }
  } catch (e: any) {
    console.warn('[Supabase Cloud Deletion] Error recording cloud tombstone:', e.message);
  }
}

export async function isInstitutionBootstrapped(): Promise<boolean> {
  if (bootstrappedCache === true) return true;

  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      bootstrappedCache = true;
      return true;
    }
  } catch (e) {
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
    } catch (err: any) {
      console.warn('[Supabase Sync Helper] Error checking bootstrap status in cloud:', err.message);
    }
  }

  return false;
}

export async function markInstitutionBootstrapped(): Promise<void> {
  bootstrappedCache = true;
  saveLocalLock();

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('system_settings').upsert(
        {
          setting_key: 'institution_bootstrap_completed',
          setting_value: 'true',
          description: 'Tracks that the institutional baseline setup has completed; prevents re-seeding deleted records.',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'setting_key' }
      );
    } catch (err: any) {
      console.warn('[Supabase Sync Helper] Error marking bootstrap status in cloud:', err.message);
    }
  }
}

function saveLocalLock() {
  try {
    const dir = path.dirname(LOCK_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ bootstrappedAt: new Date().toISOString() }), 'utf8');
  } catch (e) {
    // Non-critical local write
  }
}
