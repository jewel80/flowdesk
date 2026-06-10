// Ad-hoc end-to-end smoke test against the running stack (not part of the suite).
const BASE = process.env.BASE ?? 'http://localhost:3000/api/v1';

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return data;
}

const login = (email) =>
  call('POST', '/auth/login', null, { email, password: 'password123' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
};

(async () => {
  console.log('1. Sales logs in & creates a request');
  const sales = await login('sales@flowdesk.dev');
  const created = await call('POST', '/billing-requests', sales.accessToken, {
    title: 'E2E Smoke Test',
    customerName: 'Smoke Co',
    amount: 1234.56,
  });
  assert(created.status === 'DRAFT', 'request created as DRAFT');
  assert(created.reference.startsWith('BR-'), `reference assigned: ${created.reference}`);

  console.log('2. Sales submits it');
  let req = await call('POST', `/billing-requests/${created.id}/submit`, sales.accessToken);
  assert(req.status === 'SUBMITTED', 'request moved to SUBMITTED');

  console.log('3. Sales cannot approve (RBAC)');
  let forbidden = false;
  try {
    await call('POST', `/billing-requests/${created.id}/approve`, sales.accessToken);
  } catch (e) {
    forbidden = /403/.test(e.message);
  }
  assert(forbidden, 'sales is forbidden from approving');

  console.log('4. Accounts logs in & approves');
  const accounts = await login('accounts@flowdesk.dev');
  req = await call('POST', `/billing-requests/${created.id}/approve`, accounts.accessToken);
  assert(req.status === 'APPROVED', 'request moved to APPROVED');

  console.log('5. Async worker generates the invoice');
  let invoiced = null;
  for (let i = 0; i < 15; i++) {
    await sleep(500);
    const r = await call('GET', `/billing-requests/${created.id}`, accounts.accessToken);
    if (r.status === 'INVOICED' && r.invoiceId) {
      invoiced = r;
      break;
    }
  }
  assert(invoiced, 'request reached INVOICED via the BullMQ worker');

  console.log('6. Invoice exists with correct amount');
  const invoice = await call('GET', `/invoices/${invoiced.invoiceId}`, accounts.accessToken);
  assert(invoice.amount === 1234.56, `invoice amount correct: ${invoice.amount}`);
  assert(invoice.status === 'ISSUED', 'invoice status ISSUED');

  console.log('7. Accounts marks invoice paid');
  const paid = await call('POST', `/invoices/${invoice.id}/mark-paid`, accounts.accessToken);
  assert(paid.status === 'PAID', 'invoice marked PAID');

  console.log('8. Audit trail captured the full lifecycle');
  const audit = await call('GET', `/billing-requests/${created.id}/audit`, accounts.accessToken);
  const actions = audit.map((a) => a.action);
  console.log('  trail:', actions.join(' -> '));
  for (const expected of ['CREATED', 'SUBMITTED', 'APPROVED', 'INVOICE_GENERATED', 'INVOICE_PAID']) {
    assert(actions.includes(expected), `audit contains ${expected}`);
  }

  console.log('9. Manager dashboard metrics');
  const manager = await login('manager@flowdesk.dev');
  const metrics = await call('GET', '/metrics/summary', manager.accessToken);
  assert(metrics.scope === 'organisation', 'manager sees organisation scope');
  console.log('  metrics:', JSON.stringify(metrics.requests.byStatus));

  console.log('\n✅ ALL E2E CHECKS PASSED');
})().catch((e) => {
  console.error('\n❌ ' + e.message);
  process.exit(1);
});
