const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.NODE_ENV === 'test') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    admin.firestore().settings({ host, ssl: false });
  }
}

const db = admin.firestore();

module.exports = { admin, db };
