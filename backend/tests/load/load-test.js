import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ── Custom metrics ──
const duplicateOrderNos = new Counter('duplicate_order_nos');
const paidAndVoid = new Counter('paid_and_void_orders');
const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const MANAGER_PIN = __ENV.TEST_MANAGER_PIN || '';
const DEVICE_PREFIX = __ENV.DEVICE_PREFIX || 'LT';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 25 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    errors: ['rate<0.005'],
    duplicate_order_nos: ['count==0'],
    paid_and_void: ['count==0'],
  },
};

export function setup() {
  // Register device
  const devResp = http.post(
    `${BASE_URL}/devices/register`,
    JSON.stringify({ name: `Load-${DEVICE_PREFIX}`, order_no_prefix: DEVICE_PREFIX }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  let device;
  if (devResp.status === 201 || devResp.status === 200) {
    device = devResp.json();
  } else {
    const list = http.get(`${BASE_URL}/devices`).json();
    device = list.find((d) => d.order_no_prefix === DEVICE_PREFIX);
  }

  // Login manager
  let managerId = null;
  if (MANAGER_PIN) {
    const login = http.post(
      `${BASE_URL}/staff/login`,
      JSON.stringify({ pin: MANAGER_PIN }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (login.status === 200) managerId = login.json().id;
  }

  // Create menu item
  const menuResp = http.post(
    `${BASE_URL}/menu`,
    JSON.stringify({ name: 'Load Item', price_cents: 1000, category: 'load' }),
    { headers: { 'Content-Type': 'application/json', 'X-Staff-Id': managerId || 'load' } }
  );
  const menuItem = menuResp.status === 201 ? menuResp.json() : null;

  return { device, managerId, menuItem };
}

export default function (data) {
  const r = Math.random();
  if (r < 0.50) createOrder(data);
  else if (r < 0.70) listKitchen();
  else if (r < 0.85) takePayment(data);
  else if (r < 0.95) addItems(data);
  else if (data.managerId) voidOrder(data);
  else listKitchen();
  sleep(1);
}

function createOrder(data) {
  if (!data.device || !data.menuItem) return;
  const resp = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      idempotency_key: `${__VU}-${__ITER}-${Date.now()}`,
      device_id: data.device.id,
      table_name: `Load-${__VU}`,
      items: [{
        menu_item_id: data.menuItem.id,
        name: data.menuItem.name,
        quantity: 1 + Math.floor(Math.random() * 3),
        price_cents: data.menuItem.price_cents,
        notes: '',
      }],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  errorRate.add(resp.status >= 500);
  if (resp.status === 200 || resp.status === 201) {
    globalThis.__lastOrderId = resp.json().id;
    globalThis.__lastTotal = resp.json().total_cents;
  }
}

function listKitchen() {
  const resp = http.get(`${BASE_URL}/orders/kitchen?limit=50`);
  errorRate.add(resp.status >= 500);
}

function takePayment(data) {
  const orderId = globalThis.__lastOrderId;
  const total = globalThis.__lastTotal;
  if (!orderId || !total) return;
  const resp = http.post(
    `${BASE_URL}/payments`,
    JSON.stringify({
      idempotency_key: `pay-${__VU}-${__ITER}-${Date.now()}`,
      order_id: orderId,
      amount_cents: total,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  errorRate.add(resp.status >= 500);
}

function addItems(data) {
  const orderId = globalThis.__lastOrderId;
  if (!orderId || !data.menuItem) return;
  const resp = http.post(
    `${BASE_URL}/orders/${orderId}/items`,
    JSON.stringify({
      idempotency_key: `add-${__VU}-${__ITER}-${Date.now()}`,
      order_id: orderId,
      items: [{
        menu_item_id: data.menuItem.id,
        name: data.menuItem.name,
        quantity: 1,
        price_cents: data.menuItem.price_cents,
        notes: 'load add',
      }],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (resp.status !== 409) errorRate.add(resp.status >= 500);
}

function voidOrder(data) {
  const orderId = globalThis.__lastOrderId;
  if (!orderId || !data.managerId) return;
  const resp = http.post(
    `${BASE_URL}/orders/${orderId}/void`,
    JSON.stringify({
      idempotency_key: `void-${__VU}-${__ITER}-${Date.now()}`,
      staff_id: data.managerId,
      reason: 'Load test void',
    }),
    { headers: { 'Content-Type': 'application/json', 'X-Staff-Id': data.managerId } }
  );
  if (resp.status !== 409) errorRate.add(resp.status >= 500);
}

export function teardown(data) {
  const resp = http.get(`${BASE_URL}/orders?limit=500`);
  if (resp.status === 200) {
    const orders = resp.json();
    const bad = orders.filter((o) => o.payment_status === 'paid' && o.status === 'void');
    if (bad.length > 0) {
      paidAndVoid.add(bad.length);
      console.error(`Found ${bad.length} paid+void orders`);
    }
    const nos = orders.map((o) => o.order_no);
    if (new Set(nos).size !== nos.length) {
      console.error(`Duplicate order numbers detected`);
    }
  }
}
