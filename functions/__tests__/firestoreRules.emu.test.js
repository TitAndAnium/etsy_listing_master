const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const path = require('path');
const { setLogLevel } = require('@firebase/logger');

setLogLevel('error');

// Load current Firestore rules
const rules = readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');

describe('Firestore security rules', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-firestore',
      firestore: {
        host: '127.0.0.1',
        port: 8089,
        rules,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  // helper om standaard admin:false mee te sturen zodat rules geen undefined property admin lezen
  const withAdmin = (data = {}) => ({ admin: false, ...data });

  test('users doc owner can read/write, other user denied', async () => {
    const ownerCtx = testEnv.authenticatedContext('userA');
    const otherCtx = testEnv.authenticatedContext('userB');

    const ownerDb = ownerCtx.firestore();
    const otherDb = otherCtx.firestore();

    // owner write succeeds
    await assertSucceeds(ownerDb.collection('users').doc('userA').set(withAdmin({ credits: 10 })));

    // other user cannot read or write
    await assertFails(otherDb.collection('users').doc('userA').get());
    await assertFails(otherDb.collection('users').doc('userA').set(withAdmin({ credits: 20 })));
  });

  test('wallet_ledger admin can read/write, normal user denied', async () => {
    const adminCtx = testEnv.authenticatedContext('serviceAccount', { admin: true });
    const userCtx = testEnv.authenticatedContext('userA');

    const adminDb = adminCtx.firestore();
    const userDb = userCtx.firestore();

    await assertSucceeds(adminDb.collection('wallet_ledger').doc('tx1').set(withAdmin({ uid: 'userA', delta: 100 })));
    await assertSucceeds(adminDb.collection('wallet_ledger').doc('tx1').get());

    await assertFails(userDb.collection('wallet_ledger').doc('tx1').get());
    await assertFails(userDb.collection('wallet_ledger').doc('tx1').set(withAdmin({})));
  });
});
