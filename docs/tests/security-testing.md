<!-- security-testing.md -->
# Security Testing
Security tests verify that MobileToServer-POS protects the three things an attacker (or a dishonest staff member) actually wants: the ability to void or discount orders, the ability to mark an order paid without paying, and read access to sales and staff data.
MobileToServer-POS uses **v1 pragmatic auth**: a numeric PIN, a server-side PBKDF2 hash, and an `X-Staff-Id` header on privileged writes. There are no tokens, no sessions, and no signatures. Several tests below therefore exist to **document and bound an accepted risk** rather than to prove a control is strong.

---

## Test Cases

### SEC-01 — PIN hashes never leave the server
| Item | Detail |
|---|---|
| Steps | Call `POST /staff/login`, `GET /staff`, `POST /staff`; inspect every response body and every cached tablet `staff_cache` row |
| Verifies | `StaffOut` excludes `pin_hash`; the tablet caches only id, name, and role |
| Pass criteria | The string `pin_hash` appears in no response body and no client-side store |
| Status | Implemented *(Automated)* |

### SEC-02 — Stored hashes are salted and non-reversible
| Item | Detail |
|---|---|
| Steps | Create two staff with the identical PIN; inspect the stored `pin_hash` values; attempt verification with a tampered digest |
| Verifies | `hash_pin` uses a per-PIN 16-byte random salt with 100 000 PBKDF2-SHA256 iterations; `verify_pin` uses constant-time comparison and fails closed on malformed input |
| Pass criteria | Identical PINs produce different stored values; malformed hash returns `False` without raising |
| Status | Implemented *(Automated)* |

### SEC-03 — Manager-only surface is fully gated
| Item | Detail |
|---|---|
| Steps | With no header, a waiter id, an inactive manager id, a non-existent id, and an active manager id, call every privileged endpoint |
| Verifies | `require_manager` in `core/deps.py` and the explicit manager check inside `void_order` |
| Endpoints | `POST/PATCH/DELETE /menu`, `POST/PATCH/DELETE /tables`, `POST /staff`, `PATCH /settings`, `GET /reports/z-report` |
| Pass criteria | Only the active manager succeeds; all other identities receive 401 (missing) or 403 (insufficient/inactive); no partial write occurs on a rejected request |
| Status | Implemented *(Automated)* |

### SEC-04 — Void authorization cannot be bypassed
| Item | Detail |
|---|---|
| Steps | Void an order using a waiter id in the body with a manager id in the header, and the reverse; void with a deleted/inactive manager id; void with a fabricated id |
| Verifies | `void_order` re-resolves `payload.staff_id` against the `staff` table and requires `active` and `role == "manager"` |
| Pass criteria | Every mismatched or fabricated combination → 403; no order is voided; `voided_by` is never set to an unauthorized id |
| Status | Implemented *(Automated)* |

### SEC-05 — Payment amount cannot be understated
| Item | Detail |
|---|---|
| Steps | Pay a `$31.25` order with `amount_cents = 0`, with `amount_cents = 1`, and with an inflated amount |
| Verifies | That the server refuses to mark an order paid for less than its total |
| Pass criteria | Any amount other than `order.total_cents` is rejected, unless partial/split payment is an intentional documented feature with its own rules |
| Resolution | **Blocker Resolved.** `create_cash_payment` now strictly compares `payload.amount_cents` to `order.total_cents` and rejects mismatches with a 422/409. |
| Status | Implemented *(Automated)* |

### SEC-06 — Header-trust boundary is documented and bounded
| Item | Detail |
|---|---|
| Steps | From an untrusted client on the same network, send `X-Staff-Id: <any manager id>` to a privileged endpoint |
| Verifies | Whether the header can be spoofed by anyone who can read a manager id |
| Expected result | **It can.** Manager ids are returned by the unauthenticated `GET /staff` endpoint, so any client that can reach the API can impersonate a manager |
| Required decision | Either restrict the API to a trusted network segment, or replace the header with a signed token before exposing the backend beyond the venue LAN |
| Status | Implemented *(Risk documented via automated tests)* |

### SEC-07 — Unauthenticated read surface
| Item | Detail |
|---|---|
| Steps | With no credentials, call `GET /orders`, `GET /orders/kitchen`, `GET /staff`, `GET /menu`, `GET /tables`, `GET /settings`, `GET /devices` |
| Verifies | Which business data is readable by any client that can reach the API |
| Expected result | All of the above currently return data. Sales history, staff names and ids, and device prefixes are exposed |
| Required decision | Accept for a LAN-only deployment, or split a public kitchen read from an authenticated admin read |
| Status | Implemented *(Risk documented via automated tests)* |

### SEC-08 — Login brute-force resistance
| Item | Detail |
|---|---|
| Steps | Send 200 rapid `POST /staff/login` requests with incorrect PINs |
| Verifies | Rate limiting, lockout, or delay on repeated failures |
| Expected result | No rate limiting exists. PINs are 4–12 digits, so an unrestricted endpoint is brute-forceable |
| Required control | Per-IP or per-device throttling, temporary lockout, and logging of failed attempts |
| Status | Implemented *(Gap documented via automated tests)* |

### SEC-09 — CORS and transport configuration
| Item | Detail |
|---|---|
| Steps | Inspect the CORS middleware configuration; send a cross-origin request with a forged `Origin` header; verify TLS termination at the proxy |
| Verifies | That the allowed-origin policy matches the deployment |
| Expected result | `allow_origins`, `allow_methods`, and `allow_headers` are all `["*"]` |
| Required control | Restrict origins to the actual admin/kitchen origins, or justify the wildcard for a LAN-only API |
| Status | Implemented *(Gap documented via automated tests)* |

### SEC-10 — Local offline verifier strength
| Item | Detail |
|---|---|
| Steps | Extract the tablet's `staff_cache` table from a device backup; attempt offline PIN guessing against the stored verifier |
| Verifies | That the local SHA-256(salt:pin) verifier does not make PIN recovery trivial on a stolen tablet |
| Expected result | Single-round SHA-256 over a 4-digit PIN is fast to brute-force. The device salt is stored in the same database |
| Required control | Accept as a physical-security risk, or move to a slow KDF locally and gate offline voids behind a manager present in person |
| Status | Planned *(Tablet-side manual test)* |

### SEC-11 — Void and payment audit integrity
| Item | Detail |
|---|---|
| Steps | Void orders as two different managers; inspect `void_reason`, `voided_by`, and the Z-report void list |
| Verifies | Every void is attributable and appears in the end-of-day report |
| Pass criteria | `voided_by` resolves to the correct staff name in the report; empty reasons are rejected; voids cannot be silently deleted through any exposed endpoint |
| Status | Implemented *(Automated)* |

---

## Summary Template
*Use this template for manual penetration testing and physical device security sign-offs. Backend API rules (SEC-01 through SEC-09, SEC-11) are now continuously verified by the automated `make test-security` suite.*

```markdown
## MobileToServer-POS Security Suite
**Build:** `<version>` · **Environment:** `<url>` · **Date:** `<yyyy-mm-dd>`
| ID | Test | Result | Risk if failing |
|---|---|---|---|
| SEC-01 | PIN hash not exposed | ✅ Auto | Credential leak |
| SEC-02 | Salted PBKDF2 storage | ✅ Auto | Offline cracking |
| SEC-03 | Manager-only endpoints | ✅ Auto | Unauthorized config/menu changes |
| SEC-04 | Void authorization | ✅ Auto | Unattributed voids |
| SEC-05 | Payment amount enforced | ✅ Auto | **Direct theft** |
| SEC-06 | Header-trust boundary | ⚠️ Auto (Risk Accepted) | Manager impersonation |
| SEC-07 | Unauthenticated reads | ⚠️ Auto (Risk Accepted) | Sales/staff data exposure |
| SEC-08 | Brute-force resistance | ⚠️ Auto (Gap) | PIN compromise |
| SEC-09 | CORS / TLS | ⚠️ Auto (Gap) | Cross-origin abuse |
| SEC-10 | Local verifier strength | ⬜ Manual | Stolen-device PIN recovery |
| SEC-11 | Audit integrity | ✅ Auto | Untraceable shrinkage |
**Executed by:** ______  **Sign-off:** ______