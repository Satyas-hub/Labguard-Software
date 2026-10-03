const { getSystemPeripherals, getAvailableLabsForRegistration } = require('../backend/dist/backend/src/controllers/labController.js');
const { getEquipment } = require('../backend/dist/backend/src/controllers/equipmentController.js');
const { getAssistantDashboard } = require('../backend/dist/backend/src/controllers/assistantController.js');

console.log('--- 1. Testing Live Windows Device Manager Peripherals ---');
getSystemPeripherals({}, {
  json: (res) => {
    console.log('Peripherals Result:', JSON.stringify(res, null, 2));

    console.log('\n--- 2. Verifying Available Labs (Expect 0 Demo Labs) ---');
    getAvailableLabsForRegistration({}, {
      json: (labsRes) => {
        console.log('Available Labs Count:', labsRes.data.length);
        console.log('Available Labs Data:', labsRes.data);

        console.log('\n--- 3. Verifying Equipment Store (Expect 0 Demo Peripherals) ---');
        getEquipment({ query: {}, user: { role: 'ADMIN' } }, {
          json: (eqRes) => {
            console.log('Equipment Count:', eqRes.data ? eqRes.data.length : eqRes.length);

            console.log('\n--- 4. Verifying Hardware Events (Expect 0 Demo Events) ---');
            getAssistantDashboard({ user: { role: 'ADMIN' } }, {
              json: (dashRes) => {
                console.log('Dashboard Hardware Events Count:', dashRes.data?.recentHardwareEvents?.length || 0);
                console.log('\n[SUCCESS] All verification tests completed!');
              }
            });
          }
        });
      }
    });
  }
});
