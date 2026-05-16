/**
 * Server-side Helcim API client.
 * Never import this in client components — it uses secret env vars.
 */

const HELCIM_API_BASE = 'https://api.helcim.com/v2';

function normalizeToken(raw) {
  return (raw || '').trim().replace(/^['\"]|['\"]$/g, '');
}

function getTokenFromEnv(names, label) {
  for (const name of names) {
    const value = normalizeToken(process.env[name]);
    if (value) return value;
  }

  throw new Error(`${label} not configured`);
}

function getHelcimApiToken() {
  return getTokenFromEnv(
    ['HELCIM_API_TOKEN', 'HELCIM_API_ACCESS_TOKEN', 'HELCIM_TOKEN'],
    'HELCIM_API_TOKEN'
  );
}

function getHelcimPayJsToken() {
  return getTokenFromEnv(
    ['HELCIM_PAY_JS_TOKEN', 'HELCIM_HELCIMPAY_TOKEN', 'HELCIM_PAY_TOKEN', 'HELCIM_API_TOKEN'],
    'HELCIM_PAY_JS_TOKEN'
  );
}

async function helcimFetch(path, method = 'GET', body = null, token = getHelcimApiToken()) {

  const opts = {
    method,
    headers: {
      accept: 'application/json',
      'api-token': token,
      'content-type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${HELCIM_API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data?.errors?.[0]?.message || data?.message || `Helcim API error ${res.status}`
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Initialize a HelcimPay.js checkout session (server-side). */
export async function initHelcimCheckout({
  paymentType = 'verify',
  currency = 'CAD',
  amount = 0,
  customerRequest,
} = {}) {
  const payJsToken = getHelcimPayJsToken();
  return helcimFetch(
    '/helcim-pay/initialize',
    'POST',
    {
      paymentType,
      amount,
      currency,
      ...(customerRequest && { customerRequest }),
    },
    payJsToken
  );
}

/** Create a new Helcim customer. */
export async function createHelcimCustomer({ contactName, email }) {
  return helcimFetch('/customers', 'POST', { contactName, email });
}

/** Find a customer by email. Returns first match or null. */
export async function findHelcimCustomerByEmail(email) {
  const data = await helcimFetch(
    `/customers?searchBy=email&searchValue=${encodeURIComponent(email)}`
  ).catch(() => null);
  return data?.customers?.[0] ?? null;
}

/** Subscribe a customer to a payment plan. */
export async function createHelcimSubscription({ customerCode, paymentPlanId }) {
  return helcimFetch('/subscriptions', 'POST', {
    customerCode,
    paymentPlanId: parseInt(paymentPlanId, 10),
    dateActivated: new Date().toISOString().split('T')[0],
  });
}

/** Cancel (delete) a subscription. */
export async function cancelHelcimSubscription(subscriptionId) {
  return helcimFetch(`/subscriptions/${subscriptionId}`, 'DELETE');
}

/** Retrieve a subscription by ID. */
export async function getHelcimSubscription(subscriptionId) {
  return helcimFetch(`/subscriptions/${subscriptionId}`);
}

/** Retrieve a card transaction by ID. */
export async function getHelcimTransaction(transactionId) {
  return helcimFetch(`/payment/card-transactions/${transactionId}`);
}
