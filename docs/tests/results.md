# Test Results

**Last Run:** 2026-09-14 19:03 UTC  
**Overall Status:** ✅ All Passing (36/36)

## Summary

| Area | Tests | Passed | Failed | Skipped | Time |
|---|---|---|---|---|---|
| Backend | 19 | 19 | 0 | 0 | 2.26s |
| Tablet | 11 | 11 | 0 | 0 | 1.85s |
| Web | 6 | 6 | 0 | 0 | 1.49s |
| **Total** | **36** | **36** | **0** | **0** | **5.60s** |

---

## Detailed Breakdown

### Backend (Python / Pytest)
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

Machine-readable JUnit XML reports are generated in the `test-results/` directory via `make test-unit`:
- `test-results/backend-unit.xml`
- `test-results/tablet-unit.xml`
- `test-results/web-unit.xml`

*Note: Integration, load, and smoke tests are not yet implemented. See `unit-testing.md` for the list of deferred test cases (e.g., UNIT-T02, UNIT-T05, UNIT-W04) which require SQLite mocks, React Testing Library, or a live database.*