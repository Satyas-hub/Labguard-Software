// ============================================================================
// LABGUARD V2.5.1: Supabase Cloud Synchronization & Permanent Persistence Helper
// Ensures two-way CRUD sync and prevents deleted records from resurrecting.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
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
