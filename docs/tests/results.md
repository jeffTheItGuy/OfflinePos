# Test Results
**Last Run:** 2026-09-16
**Overall Status:** ✅ All Passing (101/101)

## Summary
| Area | Tests | Passed | Failed | Skipped | Time |
|---|---|---|---|---|---|
| Backend Unit | 19 | 19 | 0 | 0 | 2.26s |
| Backend Integration | 65 | 65 | 0 | 0 | 27.43s |
| Tablet Unit | 11 | 11 | 0 | 0 | 1.85s |
| Web Unit | 6 | 6 | 0 | 0 | 1.49s |
| **Total** | **101** | **101** | **0** | **0** | **~33.03s** |

---

## Detailed Breakdown

### Backend Unit (Python / Pytest)
*19 tests passed in 2.26s*
- **`test_unit_business_day`** (5 tests)
- ✅ test_window_is_exactly_24_hours
- ✅ test_cutover_zero_starts_at_midnight_utc
- ✅ test_cutover_four_shifts_window_forward
- ✅ test_offset_timezone_converts_to_utc
- ✅ test_dst_day_uses_daylight_offset
- **`test_unit_security`** (4 tests)
- ✅ test_round_trip_succeeds
- ✅ test_wrong_pin_fails
- ✅ test_same_pin_produces_different_hashes_due_to_salt
- ✅ test_malformed_stored_value_returns_false_not_raise
- **`test_unit_settings_schema`** (5 tests)
- ✅ test_defaults_apply_on_fresh_database
- ✅ test_cutover_out_of_range_rejected
- ✅ test_currency_must_be_three_chars
- ✅ test_partial_patch_only_sets_supplied_keys
- ✅ test_valid_full_update_is_accepted
- **`test_unit_totals`** (5 tests)
- ✅ test_subtotal_is_sum_of_line_totals
- ✅ test_empty_tax_map_yields_zero_tax
- ✅ test_single_rate_applied_to_subtotal
- ✅ test_multiple_rates_rounded_independently_then_summed
- ✅ test_empty_order_totals_to_zero

### Backend Integration (Python / Pytest against Postgres)
*65 tests passed in 27.43s*
- **`test_int_bootstrap`** (3 tests) - INT-01
- **`test_int_staff`** (7 tests) - INT-02
- **`test_int_settings`** (7 tests) - INT-03
- **`test_int_menu_tables`** (8 tests) - INT-04
- **`test_int_orders`** (5 tests) - INT-05
- **`test_int_idempotency`** (4 tests) - INT-06
- **`test_int_add_items`** (5 tests) - INT-07
- **`test_int_void`** (6 tests) - INT-08
- **`test_int_payments`** (7 tests) - INT-09 *(SEC-05 Blocker Resolved)*
- **`test_int_kitchen`** (6 tests) - INT-10
- **`test_int_zreport`** (7 tests) - INT-11

### Tablet (Expo / Vitest)
*11 tests passed in 1.85s*
- **`src/lib/tax.test.ts`** (4 tests) — *UNIT-T01*
- ✅ returns 0 with no rates
- ✅ applies a single rate to the subtotal
- ✅ rounds each rate independently then sums
- ✅ matches backend _compute_totals for identical inputs
- **`src/store/cartStore.test.ts`** (4 tests) — *UNIT-T06*
- ✅ total is sum(quantity × price_cents) in integer cents
- ✅ note-free lines for the same item merge
- ✅ lines with notes stay separate
- ✅ dec removes a line when it reaches zero
- **`src/sync/retry.test.ts`** (3 tests) — *UNIT-T04*
- ✅ grows exponentially
- ✅ caps at 60 seconds
- ✅ jitter is never negative

### Web (Vite / Vitest)
*6 tests passed in 1.49s*
- **`src/api.test.ts`** (3 tests) — *UNIT-W03*
- ✅ throws ApiError carrying the server detail on non-2xx
- ✅ falls back to statusText when the body is empty
- ✅ returns the parsed body on success
- **`src/pages/SalesReportPage.test.ts`** (3 tests) — *UNIT-W01*
- ✅ buckets an order before cutover to the previous day
- ✅ buckets an order at/after cutover to the current day
- ✅ cutover 0 buckets by calendar day

---

## Artifacts
Machine-readable JUnit XML reports are generated in the `test-results/` directory via `make test`:
- `test-results/backend-unit.xml`
- `test-results/backend-integration.xml`
- `test-results/tablet-unit.xml`
- `test-results/web-unit.xml`

*Note: Load, smoke, and offline tests are run manually or via separate deployment scripts. See respective testing documentation for deferred test cases.*