<!-- results.md -->
# Test Results Summary

> **Last updated:** not yet executed
> This document records the *intended* suite. No automated test code exists in the repository yet, so no suite has a passing status.

---

## Current Status

| Suite | Status | Notes |
|---|---|---|
| Backend Unit | ❌ Not implemented | 6 cases specified in [unit-testing.md](unit-testing.md) |
| Tablet Unit | ❌ Not implemented | 7 cases specified |
| Web Unit | ❌ Not implemented | 4 cases specified |
| Integration | ❌ Not implemented | 11 cases specified; 1 blocked by a known defect |
| Smoke | ❌ Not implemented | 9 checks specified |
| Offline / Resilience | ❌ Not executed | 9 manual cases specified |
| Concurrency / Load | ❌ Not implemented | 5 race cases + 1 sustained load scenario; 1 blocked by a known defect |
| Security | ❌ Not executed | 11 cases specified; 1 blocker, 4 risk acceptances, 2 gaps |
| Disaster Recovery | ❌ Not executed | 9 drills specified; 3 gaps |

**Overall: the system cannot currently be claimed production ready.** No layer has been executed, and three specified defects are launch blockers.

---

## Launch Blockers

These must be fixed before any suite can pass.

| # | Blocker | Where | Impact | Blocking tests |
|---|---|---|---|---|
| 1 | Payment amount is not validated against the order total | `backend/app/payments/router.py`, `backend/app/payments/schema.py` | Any client can mark any order paid for `0` cents. Direct theft vector | INT-09, SEC-05 |
| 2 | Payment and void read the order without a row lock | `create_cash_payment`, `void_order` | A race can leave an order both `paid` and `void`, or attach a payment to a voided order | CON-02 |
| 3 | Web Z-report request omits the manager identity header | `src/api.ts::getZReport` vs `backend/app/reports/router.py` | The Z-report page cannot authenticate and will fail for every manager | INT-11, SMK-09 |

---

## Risk Acceptances Required

These are design decisions, not defects. Each needs an explicit written acceptance before launch.

| # | Risk | Detail | Blocking tests |
|---|---|---|---|
| 1 | `X-Staff-Id` header is spoofable | Manager ids are readable from the unauthenticated `GET /staff`, so any client on the network can impersonate a manager | SEC-06 |
| 2 | Unauthenticated read surface | `GET /orders`, `/orders/kitchen`, `/staff`, `/menu`, `/tables`, `/settings`, `/devices` require no credentials | SEC-07 |
| 3 | No login rate limiting | 4–12 digit PINs with no throttling or lockout are brute-forceable | SEC-08 |
| 4 | Wildcard CORS | `allow_origins`, `allow_methods`, and `allow_headers` are all `["*"]` | SEC-09 |
| 5 | Weak local offline verifier | Single-round SHA-256 over a short PIN, with the device salt stored in the same local database | SEC-10 |

---

## Known Gaps

| # | Gap | Detail |
|---|---|---|
| 1 | No test infrastructure exists | No `Makefile`, no `tests/` directory, no CI workflows, no test runner configuration for the Expo or Vite apps |
| 2 | Unsynced orders are unrecoverable | Outbox items exist only in the tablet's local SQLite. A wiped or lost tablet permanently loses orders that had not synced |
| 3 | No server-side backlog visibility | Failed sync items are only inspectable on the device that owns them |
| 4 | No idempotency retention policy | `idempotency_keys` grows without bound; no expiry or cleanup job |
| 5 | No backup or restore automation | No scheduled backup, no tested restore procedure |
| 6 | No monitoring or alerting | `/health` exists but nothing polls it |
| 7 | Card payments unimplemented | `Payment.method` supports `stripe`, but no card endpoint or webhook exists. Card traffic cannot be tested |
| 8 | Refunds unimplemented | `payment_status = "refunded"` exists in the contract with no endpoint and no tests |
| 9 | Migration downgrade untested | `alembic downgrade` paths for 0002–0004 have never been executed |
| 10 | Report rounding not specified | Category tax shares are allocated proportionally and rounded; the permitted variance against gross tax is undefined |

---

## Critical Path Checklist

Tracks whether important behaviour has a dedicated test specified — not whether it passes.

| Area | Dedicated Tests | Specified | Executed |
|---|---|---|---|
| Server-side totals and tax | UNIT-B01, INT-05 | ✅ | ❌ |
| Client/server tax parity | UNIT-T01 | ✅ | ❌ |
| Business-day bucketing | UNIT-B02, UNIT-W01, INT-11 | ✅ | ❌ |
| Idempotent retry (all mutations) | INT-06, CON-03, OFF-04, OFF-05 | ✅ | ❌ |
| Order-number uniqueness | CON-01 | ✅ | ❌ |
| Order state guards | INT-07, UNIT-T02, UNIT-T03 | ✅ | ❌ |
| Void authorization and audit | INT-08, SEC-04, SEC-11, OFF-07 | ✅ | ❌ |
| Payment amount enforcement | INT-09, SEC-05 | ✅ | ❌ blocked |
| Payment/void race safety | CON-02 | ✅ | ❌ blocked |
| Offline order lifecycle | OFF-04, OFF-06, OFF-09 | ✅ | ❌ |
| Offline payment lifecycle | OFF-05 | ✅ | ❌ |
| Offline conflict backoff | OFF-08 | ✅ | ❌ |
| Menu/table sync versioning | INT-04, OFF-03 | ✅ | ❌ |
| Manager role enforcement | INT-02, SEC-03 | ✅ | ❌ |
| PIN hash protection | SEC-01, SEC-02 | ✅ | ❌ |
| Z-report reconciliation | INT-11, DR-02 | ✅ | ❌ |
| Deployment routing and assets | SMK-02, SMK-03, SMK-04, SMK-06 | ✅ | ❌ |
| Backup and restore | DR-01, DR-02 | ✅ | ❌ |
| Migration up/down | DR-03 | ✅ | ❌ |
| Rollback | DR-04 | ✅ | ❌ |
| Monitoring and alerting | DR-08 | ✅ | ❌ |

---

## Minimum Gate for a Production-Ready Claim

All of the following must be true:

1. Blockers 1–3 are fixed in code.
2. UNIT-B01, UNIT-B02, INT-02, INT-05, INT-06, INT-07, INT-08, INT-09, INT-11, CON-01, CON-02 pass automatically in CI.
3. OFF-02, OFF-04, OFF-05, OFF-07, OFF-08, OFF-09 pass on a physical device and are signed off.
4. SMK-01 through SMK-09 pass against the real deployment.
5. DR-01 and DR-03 have been executed at least once with recorded evidence.
6. Every item under "Risk Acceptances Required" is either remediated or accepted in writing by the business owner.

Until all six hold, the accurate statement is:

> "Core functionality is implemented. The test suite is specified but not yet executed, and three known defects block a production-ready claim."

---

## Update Policy

1. After adding or executing tests, run the relevant suite and update this document.
2. Before tagging a release, verify unit, integration, smoke, concurrency, offline, security, and disaster-recovery expectations.
3. Record manual suite sign-offs under `test-results/manual/` with the executor's name and the date.
4. Do not paste raw `pytest`, `vitest`, or `k6` output here. Link to CI logs or generated artifacts instead.
5. Never mark a suite as passing on the basis of code review alone.

---

## Related Documents

- [readme.md](readme.md)
- [unit-testing.md](unit-testing.md)
- [integration-testing.md](integration-testing.md)
- [smoke-testing.md](smoke-testing.md)
- [offline-testing.md](offline-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)
- [disaster-recovery-testing.md](disaster-recovery-testing.md)