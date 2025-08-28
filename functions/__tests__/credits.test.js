const { ensureCredits, consumeCredits, getBalance } = require('../utils/credits');

describe('credits utils', () => {
  const uid = 'testUser';
  beforeEach(() => {
    process.env.DAILY_CREDITS = '100';
    process.env.NODE_ENV = 'test';
  });

  test('ensureCredits returns default remaining', async () => {
    const info = await ensureCredits(uid);
    expect(info.limit).toBe(100);
    expect(info.used).toBe(0);
    expect(info.remaining).toBe(100);
  });

  test('consumeCredits deducts and respects limit', async () => {
    let res = await consumeCredits(uid, 30);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(70);

    // Exceed limit
    res = await consumeCredits(uid, 80);
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(70); // remaining unchanged when exceed
  });

  test('getBalance mirrors ensureCredits remaining', async () => {
    await consumeCredits(uid, 40);
    const bal = await getBalance(uid);
    expect(bal.remaining).toBe(60);
  });
});
