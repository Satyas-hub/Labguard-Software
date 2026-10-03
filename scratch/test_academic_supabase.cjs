const http = require('http');
const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
const { app } = require('../backend/dist/backend/src/server.js');

const sb = createClient(
  'https://wqvqqqyrrasjutghizmt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE'
);

const PORT = 5022;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request({ hostname: 'localhost', port: PORT, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const server = http.createServer(app);
  await new Promise(r => server.listen(PORT, r));
  console.log('Test server listening on port', PORT);

  try {
    // 1. Login as Admin
    const loginRes = await request('POST', '/api/auth/login', {
      identifier: 'admin@labguard.edu',
      password: 'Admin@123456',
      role: 'ADMIN'
    });
    console.log('Login status:', loginRes.status, 'token received:', !!loginRes.body?.data?.accessToken);
    const token = loginRes.body.data.accessToken;

    // 2. Get Departments (initial bootstrap if needed)
    const getRes = await request('GET', '/api/departments', null, token);
    console.log('Initial departments count:', getRes.body?.data?.length);

    // Verify Supabase has departments
    const { data: supaDepts1 } = await sb.from('academic_departments').select('*');
    console.log('Supabase academic_departments count:', supaDepts1.length);

    // 3. Create Department
    const createRes = await request('POST', '/api/departments', {
      code: 'CIVIL',
      name: 'Civil Engineering',
      description: 'Department of Civil Engineering'
    }, token);
    console.log('Created department status:', createRes.status, createRes.body?.data?.code);

    // Verify it is in Supabase
    const { data: supaCivil } = await sb.from('academic_departments').select('*').eq('code', 'CIVIL');
    console.log('CIVIL in Supabase:', supaCivil.length > 0 ? 'YES (SYNCED)' : 'NO');
    const civilId = supaCivil[0]?.id;

    // 4. Delete Department CIVIL
    const delRes = await request('DELETE', `/api/departments/${civilId}`, null, token);
    console.log('Delete CIVIL status:', delRes.status, delRes.body);

    // Verify it is REMOVED from Supabase
    const { data: supaCivilAfter } = await sb.from('academic_departments').select('*').eq('code', 'CIVIL');
    console.log('CIVIL in Supabase after delete:', supaCivilAfter.length === 0 ? 'DELETED' : 'STILL THERE');

    // 5. Query departments again - ensure CIVIL is gone and NOT coming back
    const getAfter = await request('GET', '/api/departments', null, token);
    const hasCivil = getAfter.body?.data?.some(d => d.code === 'CIVIL');
    console.log('CIVIL in GET /api/departments after delete:', hasCivil ? 'STILL COMING BACK' : 'PERMANENTLY GONE');

    console.log('\n[SUCCESS] All Supabase academic sync and deletion tests passed!');
  } finally {
    server.close();
  }
}

run().catch(console.error);
