const SUPABASE_URL = 'https://wqvqqqyrrasjutghizmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function main() {
  console.log('Fetching computers from Supabase via REST API...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/computers?select=*`, { headers });
  const pcs = await res.json();
  console.log(`Found ${pcs.length} computers in Supabase.`);

  // Delete all computers
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/computers?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers
  });
  console.log('Delete status:', delRes.status);

  // Update labs pc_count to 0
  const labsRes = await fetch(`${SUPABASE_URL}/rest/v1/labs?select=*`, { headers });
  const labs = await labsRes.json();
  if (Array.isArray(labs)) {
    for (const lab of labs) {
      await fetch(`${SUPABASE_URL}/rest/v1/labs?id=eq.${lab.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pc_count: 0 })
      });
    }
    console.log(`Updated pc_count to 0 for ${labs.length} laboratories.`);
  }

  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/computers?select=*`, { headers });
  const remaining = await checkRes.json();
  console.log(`Remaining computers in Supabase: ${Array.isArray(remaining) ? remaining.length : 0}`);
}

main().catch(console.error);
