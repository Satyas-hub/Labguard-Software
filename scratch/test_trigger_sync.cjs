async function testSync() {
  const payload = {
    clientId: 'CLIENT-8F3A29-LAB03-PC017',
    batchId: 'test-batch-' + Date.now(),
    timestamp: new Date().toISOString(),
    sessions: [
      {
        id: 'sess-test-' + Date.now(),
        studentId: 'STU-1001',
        studentIdentifier: 'student@labguard.edu',
        studentName: 'Test Student',
        labId: 'LAB-03',
        labCode: 'LAB-03',
        computerId: 'PC-017',
        pcCode: 'PC-017',
        clientId: 'CLIENT-8F3A29-LAB03-PC017',
        startedAt: new Date().toISOString(),
        status: 'ACTIVE',
        startMode: 'NORMAL',
        syncStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    issues: [
      {
        id: 'issue-test-' + Date.now(),
        reportedBy: 'student@labguard.edu',
        labId: 'LAB-03',
        labCode: 'LAB-03',
        computerId: 'PC-017',
        pcCode: 'PC-017',
        issueType: 'Keyboard Problem',
        severity: 'LOW',
        status: 'OPEN',
        description: 'Spacebar key slightly sticking during session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    hardwareEvents: [],
    maintenance: [],
    auditLogs: []
  };

  try {
    // 1. Authenticate to obtain token
    const authRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@labguard.edu', password: 'Admin@123456', role: 'ADMIN' })
    });
    const authJson = await authRes.json();
    const token = authJson.data?.accessToken;

    if (!token) {
      console.log('Login failed:', authJson);
      return;
    }

    // 2. Submit sync batch
    const res = await fetch('http://localhost:5000/api/sync/batch', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    console.log('Sync Batch Response:', json);
  } catch (e) {
    console.error('Error triggering sync:', e.message);
  }
}

testSync();
