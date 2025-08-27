// functions/utils/budgetGuard.js
const dayKey = () => new Date().toISOString().slice(0, 10);
const LIMIT = parseFloat(process.env.DAILY_BUDGET_USD || '25');
const HARD = (process.env.BUDGET_HARD_STOP || '1') === '1';
// Simple in-memory store; replace with Firestore counters in prod
const mem = {};

async function precheck() {
  const total = mem[dayKey()]?.total || 0;
  const ok = total < LIMIT;
  const ratio = LIMIT > 0 ? total / LIMIT : 0;
  return { ok, total, limit: LIMIT, ratio, hard: HARD };
}

async function add(cost) {
  const k = dayKey();
  mem[k] = mem[k] || { total: 0 };
  mem[k].total += Math.max(0, Number(cost) || 0);
  return mem[k];
}

module.exports = { precheck, add };
