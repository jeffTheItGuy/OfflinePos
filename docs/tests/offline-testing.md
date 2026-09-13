<!-- offline-testing.md -->
# Offline and Resilience Testing

Offline tests verify the tablet's offline-first contract: orders and cash payments taken without connectivity are never lost, never duplicated, and always converge on the server's authoritative state once the network returns.

This is the highest-risk layer in MobileToServer-POS. Restaurant Wi-Fi fails routinely, and the sync engine retries automatically — so a missing idempotency guarantee becomes a double charge or a duplicated kitchen ticket.

These tests are **manual and scripted**. They require a real device (or an emulator) with controllable network state and a reachable backend.

---

## Environment

| Component | Requirement |
|---|---|
| Device | Physical Android tablet running the release build |
| Backend | Reachable over Wi-Fi, with a known device prefix registered |
| Network control | Airplane mode plus a second, independent outage method (router off / captive portal) |
| Staff | One waiter PIN and one manager PIN, both seeded online first |
| Observation | `/orders`, `/orders/kitchen`, and the tablet Settings screen outbox list |

---

## Test Cases

### OFF-01 — Device registration and identity persistence

| Item | Detail |
|---|---|
| Steps | Register the tablet with a name and prefix; force-close and reopen the app; attempt to register a second device with the same prefix |
| Verifies | `POST /devices/register` stores the device id, name, prefix, and `device_salt` in `meta`; identity survives restart; duplicate prefixes are rejected |
| Pass criteria | App skips the setup screen on relaunch; second registration with the same prefix → 409 and a visible error |
| Status | Planned |

### OFF-02 — Online login seeds the offline verifier

| Item | Detail |
|---|---|
| Steps | Log in online as staff; log out; enable airplane mode; log in again with the same PIN; try a wrong PIN; try a staff member who has never logged in on this device |
| Verifies | `seedVerifier` writes a salted SHA-256 verifier on successful online login; `offlineLogin` matches against `staff_cache` |
| Pass criteria | Offline login succeeds for the seeded staff; wrong PIN rejected offline with no fallback loop; unseeded staff rejected with the "log in online once" message |
| Status | Planned |

### OFF-03 — Menu, table, and settings cache

| Item | Detail |
|---|---|
| Steps | Sync online; force-close; enable airplane mode; reopen; browse the menu and table picker; add items to the cart and observe totals |
| Verifies | `pullMenu`, `pullTables`, and `pullSettings` persist to SQLite; `computeTax` uses cached `tax_rates` offline |
| Pass criteria | Menu and tables render offline; unavailable items are hidden; cart total includes tax computed from cached rates and matches what the server later returns |
| Status | Planned |

### OFF-04 — Offline order creation syncs exactly once

| Item | Detail |
|---|---|
| Steps | Airplane mode on; create an order; confirm the local number renders as `{prefix}-L{n}` with the pending marker; force-close and reopen; airplane mode off; wait for background sync; trigger "Force sync now"; repeat the force sync twice |
| Verifies | The order is enqueued before any network attempt; `recordServerOrderNo` replaces the local number; `applyServerOrderState` overwrites optimistic totals; replay is idempotent |
| Pass criteria | Order appears at `/orders/kitchen` once; local `-L` number replaced by `{prefix}-{seq}`; server `subtotal/tax/total` replace local values; repeated force-sync produces no duplicate order and no duplicate `order_no`; outbox drains to zero |
| Status | Planned |

### OFF-05 — Offline cash payment syncs exactly once

| Item | Detail |
|---|---|
| Steps | Create an order; go offline; take cash payment for the full total; confirm the local order shows `paid`; restore network; sync; force sync twice more |
| Verifies | `payCash` optimistically sets `payment_status = 'paid'` and enqueues a `payment` item; the server records one `Payment` row |
| Pass criteria | Exactly one payment row exists for the order; server `payment_status = "paid"`; kitchen `status` unchanged; repeated sync does not create a second payment; UI offers no second payment action |
| Status | Planned |

### OFF-06 — Offline add-items syncs and recomputes

| Item | Detail |
|---|---|
| Steps | Create an order; go offline; add two more lines including one with kitchen notes; restore network; sync |
| Verifies | `addItems` writes local `order_items`, recomputes subtotal/tax/total, and enqueues `order_add_items`; the server recomputes authoritatively |
| Pass criteria | All lines present server-side; notes preserved; server totals overwrite local totals; no duplicated lines on retry |
| Status | Planned |

### OFF-07 — Offline void with manager authorization

| Item | Detail |
|---|---|
| Steps | Create an unpaid order; go offline; open the order action sheet; attempt void with a waiter PIN; attempt void with an empty reason; void with a manager PIN and a reason; restore network; sync |
| Verifies | `offlineLogin` enforces the manager role locally; reason is mandatory; `order_void` syncs and the server re-validates |
| Pass criteria | Waiter PIN rejected locally; empty reason blocked; manager void succeeds and syncs; server row has `status = "void"`, `void_reason`, and `voided_by` set; the void appears in the Z-report void list |
| Status | Planned |

### OFF-08 — Conflict handling and permanent-failure backoff

| Item | Detail |
|---|---|
| Steps | Create an order online. On a second client (web admin or API), pay that order. On the tablet, go offline and enqueue an add-items change for the same order. Restore network and sync |
| Verifies | The server rejects the modification with 409; `flushOutbox` classifies 4xx as a permanent failure and delays retry by 24 h instead of hot-looping |
| Pass criteria | Order remains paid and unmodified server-side; the failed item shows a `last_error` in the Settings outbox list; the item is not retried on every 30 s tick; staff can see that something needs attention |
| Status | Planned |

### OFF-09 — Network loss, restart, and queue drain

| Item | Detail |
|---|---|
| Steps | Create several orders and one cash payment while offline; force-close the app; keep the network off and reopen (verify the pending count survives); restore the network; wait for `NetInfo` and the 30 s interval to fire; confirm the banner clears |
| Verifies | SQLite WAL persistence of the outbox across process death; `startNetworkWatcher` triggers sync on reconnect; `SyncBanner` reflects real state |
| Pass criteria | Pending count is correct after restart; queue drains completely with no duplicates; banner disappears when `pending === 0` and online; Settings shows an empty queue and a fresh `lastSync` timestamp |
| Status | Planned |

---

## Pass/Fail Summary Template

```markdown
## MobileToServer-POS Offline Suite
**Device:** `<model>` · **Build:** `<version>` · **Backend:** `<url>` · **Date:** `<yyyy-mm-dd>`

| ID | Test | Result | Notes |
|---|---|---|---|
| OFF-01 | Device registration | ⬜ | |
| OFF-02 | Offline login seeding | ⬜ | |
| OFF-03 | Menu/table/settings cache | ⬜ | |
| OFF-04 | Offline order sync | ⬜ | |
| OFF-05 | Offline payment sync | ⬜ | |
| OFF-06 | Offline add-items sync | ⬜ | |
| OFF-07 | Offline void | ⬜ | |
| OFF-08 | Conflict backoff | ⬜ | |
| OFF-09 | Restart and drain | ⬜ | |

**Executed by:** ______  **Sign-off:** ______
```

---

## What Offline Tests Do Not Cover

- Server-side enforcement of the same rules (covered by [integration-testing.md](integration-testing.md))
- Two tablets racing on the same order at the same instant (covered by [concurrency-testing.md](concurrency-testing.md))
- Local verifier strength and device-level data protection (covered by [security-testing.md](security-testing.md))
- Recovery of a tablet whose local database is corrupted or whose app data is cleared (covered by [disaster-recovery-testing.md](disaster-recovery-testing.md))
- Card / Stripe payments — no offline card path exists

---

## Related Documents

- [readme.md](readme.md)
- [results.md](results.md)
- [integration-testing.md](integration-testing.md)
- [concurrency-testing.md](concurrency-testing.md)
- [security-testing.md](security-testing.md)