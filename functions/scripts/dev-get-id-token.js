// NEW FILE: functions/scripts/dev-get-id-token.js
/**
 * Quick utility to obtain an ID token from the Firebase Auth emulator.
 * Usage:
 *   node functions/scripts/dev-get-id-token.js --email test@example.com --password Test123
 * Requires the Auth emulator to be running (default http://localhost:9099).
 */

const { argv, env } = process;

function parseArgs() {
  const result = { email: 'dev@example.com', password: 'DevPass123' };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const val = argv[i + 1];
    if (key && val) result[key] = val;
  }
  return result;
}

async function main() {
  const { email, password } = parseArgs();
  const host = env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  const baseUrl = `http://${host}/identitytoolkit.googleapis.com/v1`;
  const apiKey = 'fake-api-key'; // any string works for emulator

  // Sign up (creates user if not exists) ➜ returns idToken
  const res = await fetch(`${baseUrl}/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) {
    console.error('Failed to obtain idToken:', data);
    process.exit(1);
  }
  console.log(data.idToken);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
