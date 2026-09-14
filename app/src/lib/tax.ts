// Pure money math — no imports, so it's unit-testable in isolation and
// mirrors the backend's _compute_totals exactly.
export function computeTax(
  subtotalCents: number,
  rates: Record<string, number>,
): number {
  let tax = 0;
  for (const rate of Object.values(rates)) {
    tax += Math.round(subtotalCents * rate);
  }
  return tax;
}