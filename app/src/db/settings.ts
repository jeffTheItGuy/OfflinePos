import { getDb } from "./database";

// Tax rates are cached locally (from GET /settings) so orders can be
// totalled correctly even while offline. The server recomputes and the
// sync engine overwrites our numbers with its authoritative answer.

export async function getTaxRates(): Promise<Record<string, number>> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM device_settings WHERE key = 'tax_rates'",
  );
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function cacheTaxRates(
  rates: Record<string, number>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO device_settings (key, value) VALUES ('tax_rates', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [JSON.stringify(rates)],
  );
}

// Mirrors the backend's _compute_totals: every configured rate is applied
// to the subtotal and the results are summed (rounded per rate).
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