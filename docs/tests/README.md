<!-- readme.md -->
# Testing Strategy

This directory documents how MobileToServer-POS is tested across the development lifecycle — from unit tests to integration tests, offline/resilience testing, concurrency testing, security testing, deployment smoke tests, and disaster-recovery drills.

MobileToServer-POS is a money-handling system with three clients (Expo tablet app, React web admin/kitchen SPA, FastAPI backend) and an offline-first tablet. The test strategy is therefore organised around **business risk**, not coverage percentages.

The documentation is intentionally limited to what the suite is intended to cover. Where a test does not exist yet, it is marked `Planned`.

---

## Test Documents

| Document | Purpose |
|---|---|
| [results.md](results.md) | Current test results, known gaps, blockers, and suite status |
| [unit-testing.md](unit-testing.md) | Backend and frontend pure-logic unit tests |
| [integration-testing.md](integration-testing.md) | API contract and business-rule tests against a live stack |
| [smoke-testing.md](smoke-testing.md) | Post-deployment health checks and routing validation |
| [offline-testing.md](offline-testing.md) | Tablet offline-first behaviour, outbox sync, and conflict handling |
| [concurrency-testing.md](concurrency-testing.md) | Race conditions, order-number allocation, and load thresholds |
| [security-testing.md](security-testing.md) | Authentication, role authorization, PIN handling, and attack surface |
| [disaster-recovery-testing.md](disaster-recovery-testing.md) | Backups, restores, migrations, rollbacks, and monitoring |

---

## Test Layers

| Layer | What it covers | Documented in |
|---|---|---|
| Unit | Pure logic: totals, tax, business day, backoff, order rules, PIN hashing | [unit-testing.md](unit-testing.md) |
| Integration | API contracts and money/state rules against Postgres | [integration-testing.md](integration-testing.md) |
| Smoke | Deployed environment health, proxy routing, SPA asset delivery | [smoke-testing.md](smoke-testing.md) |
| Offline / Resilience | Airplane-mode ordering, outbox drain, idempotent retry, conflicts | [offline-testing.md](offline-testing.md) |
| Concurrency / Load | Duplicate order numbers, payment-vs-void races, sustained traffic | [concurrency-testing.md](concurrency-testing.md) |
| Security | Manager-only endpoints, PIN exposure, spoofing, open reads | [security-testing.md](security-testing.md) |
| Disaster Recovery | Backup/restore, migrations, rollback, backlog inspection, alerting | [disaster-recovery-testing.md](disaster-recovery-testing.md) |

The **six launch-gate layers** are Smoke, Integration, Offline, Concurrency, Security, and Disaster Recovery. Unit tests support them but are not sufficient on their own.

---

## Repository Layout (proposed)

```text
tests/
  README.md
  results.md
  unit-testing.md
  integration-testing.md
  smoke-testing.md
  offline-testing.md
  concurrency-testing.md
  security-testing.md
  disaster-recovery-testing.md
  backend/
    conftest.py
    test_unit_totals.py
    test_unit_business_day.py
    test_unit_security.py
    test_api_auth.py
    test_api_settings.py
    test_api_menu_tables.py
    test_api_orders.py
    test_api_payments.py
    test_api_reports.py
    test_concurrency.py
  app/
    computeTax.test.ts
    orderRules.test.ts
    backoff.test.ts
    localOrderNo.test.ts
  web/
    businessDay.test.ts
  smoke/
    smoke-deploy.sh
  load/
    MobileToServer-POS_load.js
    run-load-test.sh
  offline/
    offline-checklist.md
  security/
    security-checklist.md
  dr/
    backup-restore-runbook.md
```

Backend tests live under `tests/backend/` and run against a disposable Postgres database. Tablet and web tests live beside their respective `package.json` files' test runners.

---

## Running the Tests

The repository does not yet contain a `Makefile`. The targets below are the intended interface and must be created before this suite can be executed.

### Backend Unit + Integration

```bash
make test-unit          # fast pure-logic backend tests
make test-integration   # docker compose stack + API tests
make test-integration-down
```

### Frontend Unit

```bash
make test-app           # Expo tablet pure-logic tests
make test-web           # Vite/React web tests
```

### Smoke

```bash
bash tests/smoke/smoke-deploy.sh
```

### Load / Concurrency

```bash
bash tests/load/run-load-test.sh
```

### Manual Suites

Offline, Security, and Disaster Recovery suites are scripted checklists executed by a human against a real device and a production-like environment:

```text
tests/offline/offline-checklist.md
tests/security/security-checklist.md
tests/dr/backup-restore-runbook.md
```

---

## Coverage and Results

Artifacts are written by the test runners, not pasted into documentation.

| Artifact | Location |
|---|---|
| Backend unit + integration logs | `test-results/backend/` |
| Tablet unit results | `test-results/app/` |
| Web unit results | `test-results/web/` |
| Smoke summary | `test-results/smoke/results.md` |
| Load summary | `test-results/load/load-summary.md` |
| Manual suite sign-offs | `test-results/manual/` |

High-level pass/fail status, blockers, and known gaps are tracked in:

- [results.md](results.md)

Do not paste raw `pytest`, `vitest`, or `k6` output into the docs. Link to CI logs or generated artifacts instead.

---

## CI Workflows (proposed)

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/unit.yml` | `push`, `pull_request` | Backend + app + web unit tests |
| `.github/workflows/integration.yml` | `push`, `pull_request` | API contract tests against Postgres |
| `.github/workflows/smoke-test.yml` | `workflow_dispatch` | Post-deploy routing and health checks |
| `.github/workflows/load-test.yml` | `workflow_dispatch` | Concurrency and sustained-load thresholds |

Manual suites (Offline, Security, Disaster Recovery) are gated by a recorded sign-off in `test-results/manual/` before a release tag.

---

## Related Documents

- [results.md](results.md)
- [unit-testing.md](unit-testing.md)
- [integration-testing.md](integration-testing.md)
- [smoke-testing.md](smoke-testing.md)
- [offline-testing.md](offline-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)
- [disaster-recovery-testing.md](disaster-recovery-testing.md)