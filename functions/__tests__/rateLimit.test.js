'use strict';

const rl = require('../utils/rateLimit');

describe('rateLimit per uid per minute (memory)', () => {
  beforeEach(() => rl._resetTestState());

  test('allows up to limit then blocks with 429', async () => {
    const limit = 2;
    const uid = 'u1';
    const r1 = await rl.check(uid, limit);
    const r2 = await rl.check(uid, limit);
    const r3 = await rl.check(uid, limit);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
    expect(r3.status).toBe(429);
    expect(typeof r3.retryAfterSec).toBe('number');
  });

  test('separate uids have independent buckets', async () => {
    const limit = 1;
    const a1 = await rl.check('A', limit);
    const b1 = await rl.check('B', limit);
    const a2 = await rl.check('A', limit);
    expect(a1.ok).toBe(true);
    expect(b1.ok).toBe(true);
    expect(a2.ok).toBe(false);
  });
});
