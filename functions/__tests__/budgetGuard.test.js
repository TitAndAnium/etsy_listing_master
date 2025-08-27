/* eslint-env jest */
const path = require('path');

describe('budget cap guard', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, DAILY_BUDGET_USD: '0.01', BUDGET_HARD_STOP: '1' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('returns 429 when daily cap reached', async () => {
    const { add } = require(path.join('..', 'utils', 'budgetGuard'));
    await add(0.02); // exceed budget
    const gen = require(path.join('..', 'generateFromDumpCore'));
    const res = await gen('Silver ring gift text', 'u1', { runId: 'cap-1' });
    expect(res.status).toBe(429);
  });

  test('soft mode allows generation', async () => {
    process.env.BUDGET_HARD_STOP = '0';
    const gen = require(path.join('..', 'generateFromDumpCore'));
    const res = await gen('Silver ring gift text', 'u1', { runId: 'cap-2' });
    // In soft mode we expect normal success (status 200 or undefined for success path)
    expect(res.status === 429).toBe(false);
  });
});
