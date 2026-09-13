<!-- integration-testing.md -->
# Integration Testing

Integration tests verify that the MobileToServer-POS backend enforces its business rules correctly against a real Postgres database: money arithmetic, idempotency, order state transitions, void authorization, payment rules, menu/table sync versioning, and end-of-day reporting.

These are the highest-value automated tests in the repository. A defect here loses money or produces a wrong Z-report.

---

## Test Environment

| Component | Value |
|---|---|
| Backend | FastAPI app from `backend/app/main.py` |
| Database | Disposable Postgres, migrated with `alembic upgrade head` |
| Client | `fastapi.testclient.TestClient` or `httpx` |
| Fixtures | seeded device, waiter, manager, menu items, settings |
| Isolation | Fresh database or truncated tables per test module |

Environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres DSN for the test database | `postgresql+psycopg://postgres:postgres@db:5432/MobileToServer-POS_test` |
| `DEFAULT_MANAGER_NAME` | Bootstrap manager name | `Test Admin` |
| `DEFAULT_MANAGER_PIN` | Bootstrap manager PIN | `1234` |

---

## Test Cases

### INT-01 — Bootstrap, migrations, and health

| Item | Detail |
|---|---|
| Steps | Run `alembic upgrade head` on an empty database; start the app; call `GET /health`; restart the app |
| Verifies | Migrations 0001→0004 apply cleanly; `/health` returns `{"status": "ok"}`; default manager is seeded once and not duplicated on restart |
| Pass criteria | Empty DB reaches head; health 200; exactly one active manager row after two startups |
| Status | Planned |

### INT-02 — Staff login and manager authorization

| Item | Detail |
|---|---|
| Steps | `POST /staff/login` with correct and incorrect PIN; call every manager-only endpoint with no header, a waiter header, an inactive manager header, and an active manager header |
| Verifies | `require_manager` in `core/deps.py` rejects missing/invalid/inactive/non-manager identities; `StaffOut` never includes `pin_hash` |
| Endpoints | `POST /menu`, `PATCH /menu/{id}`, `DELETE /menu/{id}`, `POST /tables`, `PATCH /tables/{id}`, `DELETE /tables/{id}`, `POST /staff`, `PATCH /settings`, `GET /reports/z-report` |
| Pass criteria | Correct PIN → 200 staff object; wrong PIN → 401; missing header → 401; waiter → 403; inactive manager → 403; active manager → allowed; no response body anywhere contains `pin_hash` |
| Status | Planned |

### INT-03 — Settings and tax rate validation

| Item | Detail |
|---|---|
| Steps | `GET /settings` on an empty database; `PATCH /settings` as manager with timezone, cutover, currency, and `tax_rates` |
| Verifies | Defaults (`UTC`, `0`, `USD`, `{}`) on a fresh DB; partial patch writes only supplied keys; invalid values rejected |
| Pass criteria | Defaults returned; patch persists; cutover `< 0` or `> 23` → 422; currency length ≠ 3 → 422; negative rate → 422 |
| Status | Planned |

### INT-04 — Menu and table sync versioning

| Item | Detail |
|---|---|
| Steps | Create, update, toggle availability, and delete a menu item; repeat for a table; poll `GET /menu?since_version=N` and `GET /tables?since_version=N` |
| Verifies | Soft delete sets `available = false` rather than removing the row; `version` increments on every mutation; delta queries return only changed rows |
| Pass criteria | Row survives delete; version strictly increases; `since_version` returns exactly the changed set and nothing else |
| Status | Planned |

### INT-05 — Order creation and server-side totals

| Item | Detail |
|---|---|
| Steps | Configure `tax_rates` `{vat: 0.15, service: 0.10}`; `POST /orders` with two items; inspect the response and the persisted row |
| Verifies | `_compute_totals` is authoritative — client-supplied totals are ignored; `allocate_order_no` produces `{prefix}-{seq}`; items are snapshotted with name, quantity, price, notes |
| Pass criteria | `subtotal_cents = 2500`, `tax_cents = 625`, `total_cents = 3125` for the reference fixture; `order_no` matches the device prefix; unknown `device_id` → 422; empty `items` → 422 |
| Status | Planned |

### INT-06 — Idempotency across all mutating endpoints

| Item | Detail |
|---|---|
| Steps | For each of `POST /orders`, `POST /orders/{id}/items`, `POST /orders/{id}/void`, `POST /payments`: send once, then resend the identical `idempotency_key` |
| Verifies | `idempotency/service.py` cache replay and the unique-constraint fallback path both return the original result without creating a second row |
| Pass criteria | Second call returns the same body; row counts unchanged; `orders.idempotency_key` and `payments.idempotency_key` remain unique; no duplicate `order_no` |
| Status | Planned |

### INT-07 — Add-items rules and recomputation

| Item | Detail |
|---|---|
| Steps | Add items to orders in `sent`, `preparing`, `ready`, `completed`, `void`, and `paid` states |
| Verifies | Only open unpaid orders are modifiable; totals and tax are recomputed over **all** items |
| Pass criteria | `sent`/`preparing`/`ready` unpaid → 200 with new totals; `completed` → 409; `void` → 409; `paid` → 409 |
| Status | Planned |

### INT-08 — Void rules and audit trail

| Item | Detail |
|---|---|
| Steps | Void an unpaid order as a manager with a reason; attempt as a waiter; attempt with an empty reason; attempt on a paid order; attempt twice |
| Verifies | Manager authorization, mandatory reason, paid-order protection, and audit columns |
| Pass criteria | Manager void → 200 with `status = "void"`, `void_reason` and `voided_by` persisted; waiter → 403; empty reason → 422; paid order → 409; replay of the same key → same result, no second write |
| Status | Planned |

### INT-09 — Cash payment rules and amount enforcement

| Item | Detail |
|---|---|
| Steps | Pay an unpaid order with the exact total; pay again; pay a void order; pay with `amount_cents = 0`; pay with an over-amount |
| Verifies | Single payment per order; void orders cannot be charged; `payment_status` transitions independently of kitchen `status`; **payment amount is validated against `order.total_cents`** |
| Pass criteria | First payment → 201, `payment_status = "paid"`, kitchen `status` unchanged; second payment → 409 or cached replay; void order → 409; `amount_cents ≠ total_cents` → 422/409 |
| Known blocker | `PaymentCreate.amount_cents` is only constrained by `Field(ge=0)`. The router never compares it to `order.total_cents`, so an order can currently be marked paid with `0`. This test **must fail** until the guard is added, unless partial payments are an intentional, documented feature. |
| Status | Planned — blocked |

### INT-10 — Kitchen and order list filtering

| Item | Detail |
|---|---|
| Steps | Seed orders in every status; call `GET /orders/kitchen`; call `GET /orders` with `status`, `payment_status`, `device_id`, and `limit` |
| Verifies | Kitchen only sees `sent`, `preparing`, `ready`; comma-separated multi-status filters work; `limit` is respected and capped |
| Pass criteria | `completed` and `void` never appear in `/orders/kitchen`; each filter narrows results correctly; `limit > 500` is clamped |
| Status | Planned |

### INT-11 — Z-report correctness

| Item | Detail |
|---|---|
| Steps | Set timezone `Africa/Harare` and cutover `4`; create paid, unpaid, and void orders on both sides of the cutover; call `GET /reports/z-report` as a manager, with and without `?day=` |
| Verifies | `business_day_bounds` bucketing; gross/subtotal/tax equal the sum of **paid** orders only; void count and void total; payment-method breakdown; category breakdown; staff breakdown; cash drawer equals cash payment total; manager auth required |
| Pass criteria | Every reported figure reconciles to the seeded rows; orders at 03:59 and 04:01 land in different business days; unauthenticated or waiter request → 401/403 |
| Status | Planned |

---

## What Is Not Currently Covered

The integration suite does **not** automate:

- Migration downgrade (`alembic downgrade`) verification
- Redis or cache-layer behaviour (MobileToServer-POS has no cache tier)
- True failover or chaos testing
- Postgres failure and connection-pool exhaustion behaviour
- External production endpoint validation
- Card / Stripe payment flows (no card endpoint is implemented in the backend)
- Refund flows (`payment_status = "refunded"` exists in the contract but has no endpoint)

Those areas belong in [disaster-recovery-testing.md](disaster-recovery-testing.md) or in manual runbooks.

---

## Notes

- Test counts in [results.md](results.md) refer to top-level test functions; parametrized cases are counted as subtests.
- Every money assertion is made in integer cents.
- Tests that exercise the `IntegrityError` fallback path must disable the idempotency cache first, otherwise the cached path shadows the constraint path.

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [unit-testing.md](unit-testing.md)
- [offline-testing.md](offline-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)