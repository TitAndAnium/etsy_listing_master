/**
 * Emulator integratietest voor Firestore-gebaseerde credits.
 * Handmatig draaien: NODE_ENV=test DAILY_CREDITS=2 USE_FIRESTORE_CREDITS=1 npm test -- credits.emu.test.js
 * De test is standaard geskipt in CI omdat de Firebase-emulators moeten draaien.
 */

const axios = require('axios');
const { spawn } = require('child_process');

const EMU_PORT = 5001; // gelijk aan emul:func
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'etsy-ai-hacker';
const BASE_URL = `http://127.0.0.1:${EMU_PORT}/${PROJECT_ID}/us-central1/api_generateListingFromDump`;

/**
 * Start een emulatorsessie in de achtergrond.
 * Retourneert een functie om het proces te stoppen.
 */
function startEmulators() {
  const proc = spawn('npm', ['run', 'emul:func'], { cwd: '../', shell: true, stdio: 'inherit' });
  return () => proc.kill('SIGINT');
}

describe.skip('🔥 Firestore credits – end-to-end', () => {
  let stop;
  let token;

  beforeAll(async () => {
    jest.setTimeout(30000);
    process.env.DAILY_CREDITS = '2';
    process.env.USE_FIRESTORE_CREDITS = '1';

    // Start emulators
    stop = startEmulators();
    await new Promise(r => setTimeout(r, 5000)); // wacht tot diensten klaar zijn

    // Haal token
    const { execSync } = require('child_process');
    token = execSync('npm run -s dev:token', { cwd: '../' }).toString().trim();
  });

  afterAll(() => {
    if (stop) stop();
  });

  it('verbruikt credits en werpt 429 bij overschrijding', async () => {
    const body = { text: 'demo', allow_handmade: false, gift_mode: false };
    const headers = { Authorization: `Bearer ${token}` };

    // Eerste 2 requests slagen
    for (let i = 0; i < 2; i++) {
      const res = await axios.post(BASE_URL, body, { headers, validateStatus: () => true });
      expect([200, 422]).toContain(res.status);
    }

    // Derde request moet 429 geven
    const res = await axios.post(BASE_URL, body, { headers, validateStatus: () => true });
    expect(res.status).toBe(429);
    expect(res.data.error).toMatch(/Daily credits exhausted/i);
  });
});
