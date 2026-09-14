<!-- unit-testing.md -->
# Unit Testing

Unit tests verify individual functions and modules in isolation. They run quickly and require no database, no network, and no device.

---

## Scope

| Area | Runner | Location |
|---|---|---|
| Backend pure logic | `pytest` | `backend/tests/test_unit_*.py` |
| Tablet pure logic | Vitest | `app/src/**/*.test.ts` |
| Web pure logic | Vitest | `web/src/**/*.test.ts` |

Each app owns its own tests. Backend keeps them in `backend/tests/`; the tablet and web keep them colocated next to the source they test — matching how `app/` and `web/` are self-contained units.

---

## Running

| Command | What it runs |
|---|---|
| `make test-unit-backend` | `python -m pytest backend/tests -q` (from repo root) |
| `make test-unit-tablet` | `cd app && npm run test` (vitest, node 22 via nvm) |
| `make test-unit-web` | `cd web && npm run test` (vitest, node 22 via nvm) |
| `make test-unit` | all three, in sequence |
| `make test` | alias for `test-unit` |
| `make clean-test-results` | remove `test-results/` artifacts |

Backend tests force `DATABASE_URL=sqlite:///:memory:` in `backend/tests/conftest.py` **before** any module imports, so they never touch Postgres or a live driver. They run identically whether the app is configured for `psycopg` or `psycopg2`.

---

## Required setup

Two small source edits make the code unit-testable, plus the test scaffolding:

**Source edits**

| App | Change | Why |
|---|---|---|
| Tablet | Extract `computeTax` from `app/src/db/settings.ts` into `app/src/lib/tax.ts`; re-export it from `settings.ts` | `settings.ts` imports `expo-sqlite` at module load, which crashes a Node test runner |
| Web | Add `export` to `businessDay` in `web/src/pages/SalesReportPage.tsx` | The function is module-local and can't be imported otherwise |

**New files**

| File | Purpose |
|---|---|
| `backend/tests/conftest.py` | Forces in-memory SQLite + puts repo root on `sys.path` |
| `app/src/lib/tax.ts` | Dependency-free home for `computeTax` |
| `app/vitest.config.ts` | Vitest config (`environment: "node"`) |
| `web/vitest.config.ts` | Vitest config (React plugin + `environment: "node"`) |
| `app/package.json`, `web/package.json` | Add `vitest` devDependency + `"test": "vitest run"` script |

---

## Backend Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-B01 | `orders/router.py::_compute_totals` | Subtotal equals `sum(quantity × price_cents)`; each configured rate is rounded independently; total equals subtotal + tax; empty tax map yields zero tax; multiple rates sum correctly; empty order totals to zero | Implemented |
| UNIT-B02 | `reports/service.py::business_day_bounds` | Cutover hour produces correct local window; `cutover_hour = 0` and `= 4` both correct; window is exactly 24h; offset timezone converts to UTC; DST day uses the daylight offset | Implemented |
| UNIT-B03 | `core/security.py::hash_pin` / `verify_pin` | Round-trip succeeds; wrong PIN fails; malformed stored value returns `False` instead of raising; two hashes of the same PIN differ (salt) | Implemented |
| UNIT-B04 | `settings/schema.py::SettingsOut` | Missing rows fall back to defaults (UTC, cutover 0, USD, empty tax map). The DB-backed `get_settings` path is integration territory. | Implemented (defaults only) |
| UNIT-B05 | `settings/schema.py::SettingsUpdate` | Cutover outside 0–23 rejected; currency not 3 chars rejected; partial patch leaves other keys untouched; valid full update accepted | Implemented |
| UNIT-B06 | `reports/service.py` tax allocation | Category tax shares sum to gross tax within ±1 cent; zero-subtotal day does not divide by zero | Deferred — logic is embedded in the DB-heavy `build_z_report`; cover in integration tests |

> The original "negative tax rate rejected" case for UNIT-B05 is **not** tested: `SettingsUpdate.tax_rates` has no `ge=0` constraint, so that assertion would fail. Add validation to `tax_rates` first if you want it.

---

## Tablet Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-T01 | `lib/tax.ts::computeTax` | Matches `UNIT-B01` output for identical subtotal and rate map (client/server parity); rounds each rate independently | Implemented |
| UNIT-T02 | `screens/OrdersScreen.tsx::canAddItems` | True for `sent` / `preparing` / `ready` while unpaid; false for `completed`, `void`, and any `paid` order | Deferred — not exported from `OrdersScreen.tsx` |
| UNIT-T03 | `screens/OrdersScreen.tsx::canVoid` | True while unpaid and not already void; false once `payment_status === 'paid'` or `status === 'void'` | Deferred — not exported from `OrdersScreen.tsx` |
| UNIT-T04 | `sync/retry.ts::backoffMs` | Exponential growth; capped at 60 000 ms; jitter never negative; high attempt counts stay capped | Implemented |
| UNIT-T05 | `store/ordersStore.ts::nextLocalNo` | Produces `{prefix}-L{n}`; increments monotonically; never collides with a server-issued number | Deferred — needs SQLite (`getMeta`/`setMeta`) mocks |
| UNIT-T06 | `store/cartStore.ts` totals + merge rules | Total is `sum(quantity × price_cents)`; note-free lines merge; lines with notes stay separate; `dec` removes a line at quantity 0 | Implemented |
| UNIT-T07 | `db/staff.ts::localVerifier` | Same PIN + same device salt produces a stable verifier; different salt produces a different verifier | Deferred — needs `expo-crypto` + DB mocks |

---

## Web Unit Tests

| ID | Target | What it verifies | Status |
|---|---|---|---|
| UNIT-W01 | `pages/SalesReportPage.tsx::businessDay` | Orders before cutover bucket to the previous day; orders at/after cutover bucket to the current day; matches `UNIT-B02` | Implemented (requires `export`) |
| UNIT-W02 | `pages/AdminOrdersPage.tsx::canVoid` derivation | Void control hidden for paid and already-void orders | Deferred — logic is inline in the component, not extracted |
| UNIT-W03 | `api.ts::request` error handling | Non-2xx throws `ApiError` with server `detail`; empty body does not crash JSON parsing; success returns parsed body | Implemented |
| UNIT-W04 | `hooks/usePolling.ts` | Fires immediately, repeats on interval, and does not restart the interval when the callback identity changes | Deferred — needs React render (testing-library) |

---

## Conventions

- Test user-visible behaviour and returned values, not implementation details.
- Mock the network and the database; never hit a live service from a unit test.
- No snapshot tests.
- No tests for presentational-only components, skeleton loaders, or static markup.
- Money is always asserted in integer cents — never in floats.
- **Rounding parity:** JS `Math.round` rounds half-up; Python `round` uses banker's rounding. They diverge only on exact `.5` boundaries, so fixtures avoid those values. If a 1-cent client/server mismatch ever appears, this is the cause.
- Backend tests run from the repo root so `import backend.app...` resolves; `conftest.py` handles path + SQLite isolation.

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [integration-testing.md](integration-testing.md)
- [offline-testing.md](offline-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)