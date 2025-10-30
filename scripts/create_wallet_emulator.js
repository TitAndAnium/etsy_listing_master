// scripts/create_wallet_emulator.js
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function main() {
  const uid = process.argv[2];
  const credits = Number(process.argv[3] || 10);

  if (!uid) {
    console.error('Usage: node create_wallet_emulator.js <uid> [credits]');
    process.exit(1);
  }

  // Admin SDK initialisatie voor emulator
  initializeApp({
    projectId: 'etsy-ai-hacker'
  });

  const db = getFirestore();

  const docRef = db.collection('wallets').doc(uid);
  await docRef.set({
    uid: uid,
    credits: credits,
    ledger: []
  });

  console.log('Wrote wallet for', uid, 'credits:', credits);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
