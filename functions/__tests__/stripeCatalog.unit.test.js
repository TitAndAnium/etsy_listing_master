// functions/__tests__/stripeCatalog.unit.test.js

jest.mock('fs', () => ({
  readFileSync: () => JSON.stringify({
    price_basic_monthly: { credits: 1000, currency: 'eur', amount_cents: 500 },
  }),
}));

const { getPlanByPriceId } = require('../utils/stripeCatalog');

test('vindt plan en leest credits/amount/currency', () => {
  const plan = getPlanByPriceId('price_basic_monthly');
  expect(plan).toBeTruthy();
  expect(plan.credits).toBe(1000);
  expect(plan.amount_cents).toBe(500);
  expect(plan.currency).toBe('eur');
});

test('onbekende priceId => null', () => {
  expect(getPlanByPriceId('nope')).toBe(null);
});
