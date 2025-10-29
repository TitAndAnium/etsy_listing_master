// functions/jest.teardown.js
// Sluit alle firebase-admin apps na test-run om open handles te voorkomen
module.exports = async () => {
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length) {
      await Promise.all(admin.apps.map((app) => app.delete().catch(() => {})));
    }
  } catch (_) {
    // firebase-admin was wellicht nooit geladen in deze Jest-run – negeer
  }
};
