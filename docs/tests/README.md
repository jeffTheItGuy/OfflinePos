<!-- readme.md -->
# Testing Strategy

This directory documents how MobileToServer-POS is tested across the development lifecycle

MobileToServer-POS is a money-handling system with three clients (Expo tablet app, React web admin/kitchen SPA, FastAPI backend) and an offline-first tablet. The test strategy is therefore organised around **business risk**.

The documentation is intentionally limited to what the suite is intended to cover. Where a test does not exist yet, it is marked `Planned`.

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



Backend tests live under `tests/backend/` and run against a disposable Postgres database. Tablet and web tests live beside their respective `package.json` files' test runners.

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