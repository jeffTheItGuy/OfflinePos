<!-- smoke-testing.md -->
# Smoke Testing

Smoke tests verify that a deployed MobileToServer-POS environment is fundamentally healthy and correctly routed. They run **after** deployment and are the gate between "the build succeeded" and "staff may start trading".

MobileToServer-POS is served by two containers behind a reverse proxy: `web` (nginx SPA) and `api` (FastAPI). The single most common deployment failure is a missing `/assets/*` route — the HTML loads but every JS and CSS request 404s against the API.

---

## Smoke Checks

| ID | Check | What it verifies | Status |
|---|---|---|---|
| SMK-01 | API reachable | `GET /health` returns `{"status":"ok","service":"MobileToServer-POS"}` | Planned |
| SMK-02 | SPA shell loads | `GET /` returns 200 HTML containing the `root` mount point | Planned |
| SMK-03 | Static assets served | At least one hashed file under `/assets/*` returns 200 with a `Cache-Control: immutable` header | Planned |
| SMK-04 | SPA deep links | `GET /admin`, `GET /admin/tables`, `GET /admin/zreport`, `GET /kitchen` each return the SPA shell (200), not a 404 | Planned |
| SMK-05 | API proxy routing | `GET /menu`, `GET /tables`, `GET /settings`, `GET /orders/kitchen` reach the backend and return JSON, not HTML | Planned |
| SMK-06 | Cache headers | `/index.html` returns `Cache-Control: no-store`; `/assets/*` returns a long-lived immutable header | Planned |
| SMK-07 | Manager login path | `POST /staff/login` with a known PIN returns 200 and a staff object with no `pin_hash` field | Planned |
| SMK-08 | Tablet reachability | From the tablet's network, `GET {EXPO_PUBLIC_BASE_URL}/health` succeeds within the 8 s client timeout | Planned |
| SMK-09 | End-to-end golden path | Register/login → create one order → order appears at `/orders/kitchen` → pay cash → order reports `payment_status = "paid"` | Planned |

SMK-09 is the only smoke check that writes data. It must run against a **staging** environment, or use a clearly-marked smoke table name so the order can be voided and excluded from reporting.

---

## Reference Routing Configuration

The smoke script validates the deployed proxy against this expectation:

```text
/admin*     → web:80
/kitchen*   → web:80
/assets/*   → web:80
/*          → api:8000
```

And the API surface that must be proxied:

```text
/health
/orders
/menu
/tables
/staff
/devices
/payments
/settings
/reports
```

If `/assets/*` is routed to the API, SMK-03 fails and the SPA renders a blank page. If `/reports` is missing from the proxy list, the Z-report page fails while everything else works.

---

## Running the Smoke Test

```bash
BASE_URL="https://pos.example.com" \
SMOKE_PIN="1234" \
RESULTS_FILE="test-results/smoke/results.md" \
bash tests/smoke/smoke-deploy.sh
```

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Public origin of the deployment | `http://localhost` |
| `SMOKE_PIN` | Manager PIN for SMK-07 | empty (check skipped) |
| `SMOKE_DEVICE_PREFIX` | Device prefix for SMK-09 | empty (check skipped) |
| `RESULTS_FILE` | Markdown summary output path | `test-results/smoke/results.md` |
| `TIMEOUT` | Per-request timeout in seconds | `8` |

Checks requiring credentials are **skipped**, not failed, when the corresponding variable is unset. Skips are reported explicitly in the summary.

---

## Latency Baseline

A separate baseline script reports average, minimum, and maximum latency for the golden path.

```bash
BASE_URL="https://pos.example.com" bash tests/smoke/baseline.sh
```

| Condition | Meaning |
|---|---|
| Average latency > 250 ms | Investigate |
| Average latency > 800 ms | Critical; script exits non-zero |

The 800 ms critical threshold matches the tablet client's 8 s fetch timeout with margin for a full order payload on degraded restaurant Wi-Fi.

---

## Results Summary Shape

```markdown
## ✅ MobileToServer-POS Smoke Test
**Environment:** `https://pos.example.com` · **Passed:** 9/9

| Check | Status | Detail |
|---|---|---|
| API reachable | ✅ Pass | HTTP 200 |
| SPA shell | ✅ Pass | HTTP 200 |
| Static assets | ✅ Pass | HTTP 200, immutable |
| SPA deep links | ✅ Pass | 4/4 routes |
| API proxy routing | ✅ Pass | JSON returned |
| Cache headers | ✅ Pass | no-store / immutable |
| Manager login | ✅ Pass | 200, no pin_hash |
| Tablet reachability | ✅ Pass | 41 ms |
| Golden path | ✅ Pass | order T1-1 paid |
```

---

## What Smoke Tests Do Not Cover

- Business-rule correctness (see [integration-testing.md](integration-testing.md))
- Offline behaviour and outbox recovery (see [offline-testing.md](offline-testing.md))
- Race conditions and sustained traffic (see [concurrency-testing.md](concurrency-testing.md))
- Authorization bypass attempts (see [security-testing.md](security-testing.md))
- Backup and restore validity (see [disaster-recovery-testing.md](disaster-recovery-testing.md))
- Database migration from a populated production snapshot

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [integration-testing.md](integration-testing.md)
- [disaster-recovery-testing.md](disaster-recovery-testing.md)