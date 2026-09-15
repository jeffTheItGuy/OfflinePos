<!-- concurrency-testing.md -->
# Concurrency and Load Testing
For a single-venue POS, extreme traffic volume is not the primary risk. The primary risk is **simultaneous writes**: several tablets creating orders in the same second, a payment racing a void, or many clients polling the kitchen endpoint at once.

This layer therefore combines race-condition tests (correctness under simultaneity) with a modest sustained-load test (stability under a realistic Friday-night rush).

---

## Part A — Race Condition Tests

### CON-01 — Concurrent order creation allocates unique numbers
| Item | Detail |
|---|---|
| Method | Fire 20 simultaneous `POST /orders` requests for the **same** `device_id`, each with a distinct `idempotency_key` |
| Verifies | `allocate_order_no` uses `SELECT ... FOR UPDATE` on the device row, so `order_no_seq` increments serially |
| Pass criteria | 20 orders created; 20 distinct `order_no` values; sequence numbers are contiguous with no gaps and no duplicates; no request returns 500 |
| Status | Implemented |

### CON-02 — Payment racing a void yields exactly one outcome
| Item | Detail |
|---|---|
| Method | Fire `POST /payments` and `POST /orders/{id}/void` for the same order simultaneously, repeatedly across many trials |
| Verifies | The order never ends up both `paid` and `void`; no payment row is attached to a voided order |
| Pass criteria | Every trial ends in exactly one terminal state; a payment on a voided order is rejected; a void on a paid order is rejected; no inconsistent rows |
| Resolution | The read-check-write race condition was resolved by applying `with_for_update()` row locks to the `Order` model in both the payment and void endpoints. |
| Status | Implemented |

### CON-03 — Same idempotency key sent concurrently
| Item | Detail |
|---|---|
| Method | Send the identical `POST /orders` payload (same `idempotency_key`) on 10 parallel connections |
| Verifies | The unique constraint on `orders.idempotency_key` plus the `IntegrityError` fallback collapses the burst into one order |
| Pass criteria | Exactly one order row exists; every caller receives the same order body; no 500s escape to the client |
| Resolution | `store_response()` was updated to gracefully catch `IntegrityError` and rollback the idempotency key insert if a concurrent request won the race, preventing 500 crashes. |
| Status | Implemented |

### CON-04 — Multi-tablet sync against one order
| Item | Detail |
|---|---|
| Method | Two tablets hold the same order. Tablet A pays it while Tablet B enqueues an add-items change; both sync in the same window |
| Verifies | `pullOrderStatuses` converges both devices on the server state; the losing operation is rejected and surfaced |
| Pass criteria | Server holds one payment and the original item list; Tablet B's outbox records the 409 with a `last_error`; neither tablet shows a paid order with extra unpaid items |
| Resolution | Row locking (`with_for_update()`) ensures strict serialization. The test validates both valid business outcomes: a `409 Conflict` if the payment wins the lock, or a `422 Unprocessable Entity` if the add-items request wins the lock and changes the order total before the payment validates its amount. |
| Status | Implemented |

### CON-05 — Kitchen polled under concurrent status writes
| Item | Detail |
|---|---|
| Method | 5 kitchen browsers poll `GET /orders/kitchen?limit=50` every 5 s while tablets advance orders through `sent → preparing → ready → completed` |
| Verifies | No lost or reverted status transitions; no duplicate tickets rendered |
| Pass criteria | Every transition is eventually visible to every client; no order reappears after completion; no polling request errors |
| Status | Implemented |

---

## Part B — Sustained Load Test

### Scenario
| Parameter | Value |
|---|---|
| Tool | `k6` |
| Virtual users | 10 (representing 10 tablets) |
| Think time | 1 s between actions per VU |
| Duration | 11 minutes total |

Stages:
| Stage | Duration | Target VUs |
|---|---:|---:|
| Ramp up | 2 m | 10 |
| Steady state | 5 m | 10 |
| Rush | 2 m | 25 |
| Ramp down | 2 m | 0 |

### Traffic Mix
| Action | Weight | Endpoint |
|---|---:|---|
| Create order | 50% | `POST /orders` |
| List kitchen orders | 20% | `GET /orders/kitchen` |
| Take cash payment | 15% | `POST /payments` |
| Add items | 10% | `POST /orders/{id}/items` |
| Void order (manager) | 5% | `POST /orders/{id}/void` |

### Thresholds
The load test fails if any threshold is breached.
| Metric | Threshold |
|---|---|
| p95 latency | `< 300 ms` |
| p99 latency | `< 800 ms` |
| Error rate (5xx) | `< 0.5%` |
| Duplicate `order_no` | `0` |
| Duplicate payment rows per order | `0` |

### Data-Integrity Checks (run after the load phase)
| Check | Assertion |
|---|---|
| Order-number uniqueness | `COUNT(*) = COUNT(DISTINCT order_no)` for the test window |
| Payment uniqueness | No order has more than one confirmed payment |
| Terminal-state consistency | No order is both `void` and `paid` |
| Report reconciliation | `GET /reports/z-report` gross equals the sum of paid order totals created during the run |
| Queue drain | All tablet outboxes reach zero pending within 60 s of network stability |

---

## Running the Load Test
```bash
BASE_URL="http://localhost:8000" \
TEST_MANAGER_PIN="1234" \
DEVICE_PREFIX="LT" \
SUMMARY_PATH="test-results/load/load-summary.md" \
bash tests/load/run-load-test.sh