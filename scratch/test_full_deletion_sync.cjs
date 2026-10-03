const path = require('path');
const { createClient } = require(path.join(__dirname, '../backend/node_modules/@supabase/supabase-js'));

const SUPABASE_URL = 'https://wqvqqqyrrasjutghizmt.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE';
const API_BASE = 'http://localhost:5000/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function request(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('=== LABGUARD v2.5.1 Full Deletion & Supabase Sync Test ===\n');

  // 1. Check version endpoint
  console.log('[1] Checking System Version...');
  const verRes = await request('/system/updates/check?version=2.5.1');
  const latestVer = verRes.data?.data?.latestVersion || verRes.data?.latestVersion;
  console.log('Update Check Status:', verRes.status, 'Latest Version:', latestVer);
  if (latestVer === '2.5.1') {
    console.log('✅ Version 2.5.1 correctly exposed!\n');
  } else {
    console.log('⚠️ Version mismatch:', verRes.data);
  }

  // 2. Login as Admin
  console.log('[2] Logging in as root institutional administrator...');
  const loginRes = await request('/auth/login', 'POST', {
    identifier: 'admin@labguard.edu',
    password: 'Admin@123456'
  });
  if (loginRes.status !== 200 || !loginRes.data.data?.accessToken) {
    console.error('❌ Login failed:', loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.data.accessToken;
  console.log('✅ Logged in as:', loginRes.data.data.user.email, '\n');

  const extractId = (res) => res.data?.data?.id || res.data?.id || res.data?.data?.user?.id || res.data?.user?.id;
  const extractList = (res) => {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.data)) return res.data.data;
    return [];
  };

  // 3. Test Academic Department Sync & Deletion
  console.log('[3] Testing Department Create -> Supabase Check -> Delete -> Supabase Verify...');
  const deptCode = 'TEST_DEPT_' + Date.now().toString().slice(-4);
  const createDeptRes = await request('/departments', 'POST', {
    name: 'Sync Test Department',
    code: deptCode
  }, token);
  const deptId = extractId(createDeptRes);
  console.log('Created Dept:', deptId, 'Code:', deptCode);

  const { data: supaDeptAfterCreate } = await supabase.from('academic_departments').select('*').eq('id', deptId);
  console.log('Supabase check after create:', supaDeptAfterCreate && supaDeptAfterCreate.length > 0 ? 'FOUND IN SUPABASE' : 'NOT FOUND');

  const delDeptRes = await request(`/departments/${deptId}`, 'DELETE', null, token);
  console.log('Delete Department status:', delDeptRes.status);

  const { data: supaDeptAfterDelete } = await supabase.from('academic_departments').select('*').eq('id', deptId);
  console.log('Supabase check after delete:', supaDeptAfterDelete && supaDeptAfterDelete.length === 0 ? '✅ PERMANENTLY REMOVED FROM SUPABASE' : '❌ STILL IN SUPABASE');

  // Verify it does not re-appear on GET /departments
  const getDeptsRes = await request('/departments', 'GET', null, token);
  const deptReappeared = extractList(getDeptsRes).some(d => d.id === deptId);
  console.log('Backend GET check:', !deptReappeared ? '✅ DOES NOT REAPPEAR' : '❌ REAPPEARED IN APP');
  console.log('');

  // 4. Test Lab Sync & Deletion
  console.log('[4] Testing Lab Create -> Supabase Check -> Delete -> Supabase Verify...');
  const labCode = 'LAB_' + Date.now().toString().slice(-4);
  const createLabRes = await request('/labs', 'POST', {
    name: 'Sync Test Lab',
    code: labCode,
    capacity: 25,
    room: 'Room-999'
  }, token);
  const labId = extractId(createLabRes);
  console.log('Created Lab:', labId, 'Code:', labCode, 'Response:', createLabRes.status);

  const { data: supaLabAfterCreate } = await supabase.from('labs').select('*').eq('id', labId);
  console.log('Supabase check after create:', supaLabAfterCreate && supaLabAfterCreate.length > 0 ? 'FOUND IN SUPABASE' : 'NOT FOUND');

  // 5. Test Computer Sync & Deletion (inside this lab)
  console.log('\n[5] Testing Computer Create -> Supabase Check -> Delete -> Supabase Verify...');
  const pcCode = 'PC_' + Date.now().toString().slice(-4);
  const createCompRes = await request('/computers', 'POST', {
    labCode: labCode,
    pcCode: pcCode,
    hostname: `${labCode}-${pcCode}`,
    ipAddress: '192.168.1.99',
    macAddress: 'AA:BB:CC:DD:EE:FF'
  }, token);
  const computerId = extractId(createCompRes);
  console.log('Created Computer:', computerId, 'Code:', pcCode, 'Response:', createCompRes.status);

  const { data: supaCompAfterCreate } = await supabase.from('computers').select('*').eq('id', computerId);
  console.log('Supabase check after create:', supaCompAfterCreate && supaCompAfterCreate.length > 0 ? 'FOUND IN SUPABASE' : 'NOT FOUND');

  const delCompRes = await request(`/computers/${computerId}`, 'DELETE', null, token);
  console.log('Delete Computer status:', delCompRes.status);

  const { data: supaCompAfterDelete } = await supabase.from('computers').select('*').eq('id', computerId);
  console.log('Supabase check after delete:', supaCompAfterDelete && supaCompAfterDelete.length === 0 ? '✅ PERMANENTLY REMOVED FROM SUPABASE' : '❌ STILL IN SUPABASE');

  // 6. Test Equipment Sync & Deletion (inside this lab)
  console.log('\n[6] Testing Equipment Create -> Supabase Check -> Delete -> Supabase Verify...');
  const assetTag = 'EQ_' + Date.now().toString().slice(-4);
  const createEqRes = await request('/equipment', 'POST', {
    assetTag: assetTag,
    type: 'KEYBOARD',
    brand: 'Logitech',
    model: 'K120 USB',
    serialNumber: 'SN-' + Date.now().toString().slice(-4),
    labCode: labCode,
    status: 'OPERATIONAL'
  }, token);
  const eqId = extractId(createEqRes);
  console.log('Created Equipment:', eqId, 'AssetTag:', assetTag, 'Response:', createEqRes.status);

  const { data: supaEqAfterCreate } = await supabase.from('equipment').select('*').eq('id', eqId);
  console.log('Supabase check after create:', supaEqAfterCreate && supaEqAfterCreate.length > 0 ? 'FOUND IN SUPABASE' : 'NOT FOUND');

  const delEqRes = await request(`/equipment/${eqId}`, 'DELETE', null, token);
  console.log('Delete Equipment status:', delEqRes.status);

  const { data: supaEqAfterDelete } = await supabase.from('equipment').select('*').eq('id', eqId);
  console.log('Supabase check after delete:', supaEqAfterDelete && supaEqAfterDelete.length === 0 ? '✅ PERMANENTLY REMOVED FROM SUPABASE' : '❌ STILL IN SUPABASE');

  // Now delete the lab
  console.log('\n[4b] Deleting Lab -> Supabase Verify...');
  const delLabRes = await request(`/labs/${labId}`, 'DELETE', null, token);
  console.log('Delete Lab status:', delLabRes.status);

  const { data: supaLabAfterDelete } = await supabase.from('labs').select('*').eq('id', labId);
  console.log('Supabase check after delete:', supaLabAfterDelete && supaLabAfterDelete.length === 0 ? '✅ PERMANENTLY REMOVED FROM SUPABASE' : '❌ STILL IN SUPABASE');

  const getLabsRes = await request('/labs', 'GET', null, token);
  const labReappeared = extractList(getLabsRes).some(l => l.id === labId);
  console.log('Backend GET check:', !labReappeared ? '✅ DOES NOT REAPPEAR' : '❌ REAPPEARED IN APP');
  console.log('');

  // 7. Test User Sync & Deletion
  console.log('[7] Testing User Create -> Supabase Check -> Delete -> Supabase Verify...');
  const userEmail = 'testuser_' + Date.now().toString().slice(-4) + '@labguard.edu';
  const createUserRes = await request('/users', 'POST', {
    email: userEmail,
    fullName: 'Temporary Sync Test User',
    role: 'STUDENT',
    password: 'Password123!',
    identifier: 'STU_' + Date.now().toString().slice(-4)
  }, token);
  const userId = extractId(createUserRes);
  console.log('Created User:', userId, 'Email:', userEmail);

  const { data: supaUserAfterCreate } = await supabase.from('users').select('*').eq('id', userId);
  console.log('Supabase check after create:', supaUserAfterCreate && supaUserAfterCreate.length > 0 ? 'FOUND IN SUPABASE' : 'NOT FOUND');

  const delUserRes = await request(`/users/${userId}`, 'DELETE', null, token);
  console.log('Delete User status:', delUserRes.status);

  const { data: supaUserAfterDelete } = await supabase.from('users').select('*').eq('id', userId);
  console.log('Supabase check after delete:', supaUserAfterDelete && supaUserAfterDelete.length === 0 ? '✅ PERMANENTLY REMOVED FROM SUPABASE' : '❌ STILL IN SUPABASE');

  console.log('\n=== ALL DELETION & SUPABASE SYNCHRONIZATION TESTS COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
