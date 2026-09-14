<!-- unit-testing.md -->
# Unit Testing

Unit tests verify individual functions and modules in isolation. They run quickly and require no database, no network, and no device.

---

## Scope

| Area | Runner | Location |
|---|---|---|
| Backend pure logic | `pytest` | `tests/backend/test_unit_*.py` |
| Tablet pure logic | Vitest / Jest | `src/app/**/*.test.ts` |
| Web pure logic | Vitest | `src/web/**/*.test.ts` |

---

## Backend Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-B01 | `orders/router.py::_compute_totals` | Subtotal equals `sum(quantity × price_cents)`; each configured rate is rounded independently; total equals subtotal + tax; empty tax map yields zero tax; multiple rates sum correctly | Planned |
| UNIT-B02 | `reports/service.py::business_day_bounds` | Cutover hour produces correct local window; `cutover_hour = 0` and `= 4` both correct; window is exactly 24h; UTC conversion is stable across a DST transition | Planned |
| UNIT-B03 | `core/security.py::hash_pin` / `verify_pin` | Round-trip succeeds; wrong PIN fails; malformed stored value returns `False` instead of raising; two hashes of the same PIN differ (salt) | Planned |
| UNIT-B04 | `settings/service.py::get_settings` | Missing rows fall back to `SettingsOut` defaults; corrupt JSON row is skipped rather than crashing | Planned |
| UNIT-B05 | `settings/schema.py::SettingsUpdate` | Cutover outside 0–23 rejected; currency not 3 chars rejected; negative tax rate rejected; partial patch leaves other keys untouched | Planned |
| UNIT-B06 | `reports/service.py` tax allocation | Category tax shares sum to gross tax within ±1 cent; zero-subtotal day does not divide by zero | Planned |

---

## Tablet Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-T01 | `db/settings.ts::computeTax` | Matches `UNIT-B01` output for identical subtotal and rate map (client/server parity) | Planned |
| UNIT-T02 | `screens/OrdersScreen.tsx::canAddItems` | True for `sent` / `preparing` / `ready` while unpaid; false for `completed`, `void`, and any `paid` order | Planned |
| UNIT-T03 | `screens/OrdersScreen.tsx::canVoid` | True while unpaid and not already void; false once `payment_status === 'paid'` or `status === 'void'` | Planned |
| UNIT-T04 | `sync/retry.ts::backoffMs` | Exponential growth; capped at 60 000 ms; jitter never negative; high attempt counts stay capped | Planned |
| UNIT-T05 | `store/ordersStore.ts::nextLocalNo` | Produces `{prefix}-L{n}`; increments monotonically; never collides with a server-issued number | Planned |
| UNIT-T06 | `store/cartStore.ts` totals + merge rules | Total is `sum(quantity × price_cents)`; note-free lines merge; lines with notes stay separate; `dec` removes a line at quantity 0 | Planned |
| UNIT-T07 | `db/staff.ts::localVerifier` | Same PIN + same device salt produces a stable verifier; different salt produces a different verifier | Planned |

---

## Web Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-W01 | `pages/SalesReportPage.tsx::businessDay` | Orders before cutover bucket to the previous day; orders at/after cutover bucket to the current day; matches `UNIT-B02` | Planned |
| UNIT-W02 | `pages/AdminOrdersPage.tsx::canVoid` derivation | Void control hidden for paid and already-void orders | Planned |
| UNIT-W03 | `api.ts::request` error handling | Non-2xx throws `ApiError` with server `detail`; empty body does not crash JSON parsing | Planned |
| UNIT-W04 | `hooks/usePolling.ts` | Fires immediately, repeats on interval, and does not restart the interval when the callback identity changes | Planned |

---

## Conventions

- Test user-visible behaviour and returned values, not implementation details.
- Mock the network and the database; never hit a live service from a unit test.
- No snapshot tests.
- No tests for presentational-only components, skeleton loaders, or static markup.
- Money is always asserted in integer cents — never in floats.

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [integration-testing.md](integration-testing.md)
- [offline-testing.md](offline-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)