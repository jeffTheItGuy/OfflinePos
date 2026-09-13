<!-- disaster-recovery-testing.md -->
# Disaster Recovery Testing

Disaster recovery tests verify that MobileToServer-POS can survive and recover from the failures that actually happen in a restaurant: a corrupted or lost database, a bad deployment, a failed migration, a tablet that is wiped or replaced, and an unexplained backlog of unsynced orders.

These are **runbook-driven drills**, executed against a copy of production data. They are manual, scheduled, and signed off.

---

## Test Cases

### DR-01 — Database backup and restore drill

| Item | Detail |
|---|---|
| Steps | Take a backup of the production database; restore it into a clean Postgres instance; run `alembic upgrade head`; start the backend against the restored database |
| Verifies | That the backup is complete, restorable, and usable by the application |
| Pass criteria | All tables restore; migration state is consistent; `GET /health` returns ok; orders, payments, menu, tables, staff, and settings are all present |
| Evidence | Row counts before and after; `GET /reports/z-report` for the most recent closed business day matches on both instances |
| Frequency | Before launch, then monthly |
| Status | Planned |

### DR-02 — Report reconciliation after restore

| Item | Detail |
|---|---|
| Steps | Generate the Z-report for the last three closed business days on production and on the restored instance; compare every figure |
| Verifies | That financial reporting survives a restore intact |
| Pass criteria | Gross, subtotal, tax, paid order count, void count, void total, cash drawer, and every breakdown match exactly |
| Status | Planned |

### DR-03 — Migration forward and backward

| Item | Detail |
|---|---|
| Steps | From an empty database run `alembic upgrade head`; then `alembic downgrade base`; then `upgrade head` again. Separately, run `upgrade head` against a copy of production data already at `0001_initial` |
| Verifies | Migrations `0001_initial` → `0002_order_voids` → `0003_tax_columns` → `0004_tables` apply and revert cleanly; upgrades on populated data do not lose rows |
| Pass criteria | No errors in either direction; existing orders retain their data through the upgrade; nullable columns added by 0002 do not break existing rows; default `0` values added by 0003 do not corrupt historical totals |
| Status | Planned |

### DR-04 — Application rollback

| Item | Detail |
|---|---|
| Steps | Deploy a new build; roll back to the previous image; verify the older code runs against the newer schema |
| Verifies | That a rollback does not require a database downgrade mid-service |
| Pass criteria | Previous image starts; health check passes; ordering and payment work; no schema incompatibility errors |
| Note | All four current migrations are additive, so rollback without downgrade is expected to work. This must be confirmed, not assumed |
| Status | Planned |

### DR-05 — Tablet loss, wipe, or replacement

| Item | Detail |
|---|---|
| Steps | Clear app data on a registered tablet (or provision a replacement); attempt to re-register with the same prefix; log in online; sync |
| Verifies | Recovery path when the local SQLite database is lost |
| Pass criteria | Behaviour is explicit and documented — either the prefix is released for reuse, or staff are given a clear procedure to register under a new prefix. Menu, tables, and settings re-download. Any orders that were only in the lost device's outbox are identified as unrecoverable and reconciled manually |
| Known gap | Unsynced outbox items exist **only** on the device. There is no server-side record of them, so a wiped tablet permanently loses any order that had not yet synced. This must be stated in the operations runbook and mitigated operationally (frequent sync, visible pending badge, end-of-shift queue check) |
| Status | Planned — gap |

### DR-06 — Stuck sync backlog investigation

| Item | Detail |
|---|---|
| Steps | Inspect the tablet Settings screen outbox list; identify items with high `attempts` and a `last_error`; determine whether each is a permanent 4xx (delayed 24 h) or a transient failure |
| Verifies | That staff and support can diagnose and clear a backlog without developer intervention |
| Pass criteria | Each failed item shows a human-readable error; a documented remedy exists for the common cases (order paid elsewhere, order voided elsewhere, device prefix conflict, backend unreachable) |
| Known gap | Failed items are only visible on the device that owns them. There is no server-side view of client backlogs |
| Status | Planned — gap |

### DR-07 — Idempotency store growth and retention

| Item | Detail |
|---|---|
| Steps | Measure the row count and size of `idempotency_keys` after a representative trading period; project 12-month growth |
| Verifies | That unbounded growth of the idempotency table does not degrade write performance |
| Pass criteria | A retention policy is defined and scheduled (for example, delete keys older than 90 days), or growth is demonstrably negligible for the venue's volume |
| Known gap | No expiry or cleanup job exists. Every order, add-items, void, and payment writes a permanent row |
| Status | Planned — gap |

### DR-08 — Monitoring and alerting

| Item | Detail |
|---|---|
| Steps | Verify an external uptime check against `GET /health`; simulate a backend outage and confirm the alert fires; confirm error logs capture failed logins, 4xx rejections, and 5xx failures |
| Verifies | That an outage is detected before staff report it |
| Pass criteria | Alert delivered within the configured window; logs are retained and searchable; a named person is on call during trading hours |
| Status | Planned |

### DR-09 — Recovery time objective rehearsal

| Item | Detail |
|---|---|
| Steps | Time a full recovery from "database lost" to "trading resumed": restore backup → migrate → start backend → verify smoke checks → resume tablet sync |
| Verifies | That the documented RTO is achievable by the people who will actually perform it |
| Pass criteria | Total elapsed time is recorded and accepted by the business; every step in the runbook was followed without improvisation |
| Status | Planned |

---

## Runbook Summary Template

```markdown
## MobileToServer-POS Disaster Recovery Drill
**Date:** `<yyyy-mm-dd>` · **Environment:** `<name>` · **Operator:** `<name>`

| ID | Drill | Result | Duration | Notes |
|---|---|---|---|---|
| DR-01 | Backup and restore | ⬜ | | |
| DR-02 | Report reconciliation | ⬜ | | |
| DR-03 | Migration up/down | ⬜ | | |
| DR-04 | Application rollback | ⬜ | | |
| DR-05 | Tablet replacement | ⬜ | | |
| DR-06 | Backlog investigation | ⬜ | | |
| DR-07 | Idempotency retention | ⬜ | | |
| DR-08 | Monitoring and alerting | ⬜ | | |
| DR-09 | RTO rehearsal | ⬜ | | |

**RTO achieved:** ______  **RPO achieved:** ______  **Sign-off:** ______
```

---

## What Disaster Recovery Tests Do Not Cover

- Business-rule correctness (see [integration-testing.md](integration-testing.md))
- Offline sync behaviour under normal conditions (see [offline-testing.md](offline-testing.md))
- Performance under load (see [concurrency-testing.md](concurrency-testing.md))
- Host-level or cloud-provider failover between regions
- Point-in-time recovery to an arbitrary timestamp, unless WAL archiving is configured

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [smoke-testing.md](smoke-testing.md)
- [offline-testing.md](offline-testing.md)
- [security-testing.md](security-testing.md)