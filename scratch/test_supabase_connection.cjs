const { createClient } = require('../backend/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://wqvqqqyrrasjutghizmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = ['sessions', 'issues', 'maintenance', 'hardware_events', 'audit_logs', 'lab_reports'];
async function test() {
  console.log('Testing connection to Supabase:', supabaseUrl);
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`[TABLE: ${table}] Error:`, error.message, `(${error.code})`);
      } else {
        console.log(`[TABLE: ${table}] READY (Connected)`);
      }
    } catch (e) {
      console.log(`[TABLE: ${table}] Exception:`, e.message);
    }
  }
}

test();
