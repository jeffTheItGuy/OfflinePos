import { useEffect, useState } from "react";
import { api } from "../api";
import type { RestaurantSettings, Staff } from "../types";

const TIMEZONES = [
  "UTC",
  "Africa/Harare",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export function SettingsPage({ staff }: { staff: Staff }) {
  const [s, setS] = useState<RestaurantSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Tax rate form state
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");

  useEffect(() => {
    api
      .getSettings()
      .then(setS)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (!s) return <p>{error ?? "Loading…"}</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.updateSettings(staff.id, s);
      setS(next);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addTaxRate() {
    if (!s) return;
    const name = taxName.trim().toLowerCase();
    const rate = parseFloat(taxRate);
    if (!name || !Number.isFinite(rate) || rate < 0 || rate > 1) return;
    setS({
      ...s,
      tax_rates: { ...s.tax_rates, [name]: rate },
    });
    setTaxName("");
    setTaxRate("");
  }

  function removeTaxRate(key: string) {
    if (!s) return;
    const { [key]: _, ...rest } = s.tax_rates;
    setS({ ...s, tax_rates: rest });
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      {error && <p className="err">{error}</p>}
      {saved && <p className="ok">Saved.</p>}

      <form
        className="row-form"
        onSubmit={save}
        style={{
          flexDirection: "column",
          alignItems: "stretch",
          gap: 12,
          maxWidth: 480,
        }}
      >
        <label>
          Restaurant timezone
          <select
            value={s.restaurant_timezone}
            onChange={(e) =>
              setS({ ...s, restaurant_timezone: e.target.value })
            }
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label>
          Business-day cutover hour (0–23)
          <input
            type="number"
            min={0}
            max={23}
            value={s.business_day_cutover_hour}
            onChange={(e) =>
              setS({
                ...s,
                business_day_cutover_hour: Number(e.target.value),
              })
            }
          />
        </label>

        <label>
          Currency (ISO 4217)
          <input
            value={s.currency}
            maxLength={3}
            onChange={(e) =>
              setS({ ...s, currency: e.target.value.toUpperCase() })
            }
          />
        </label>

        {/* ── Step 3: Tax rates ─────────────────────────────────── */}
        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
          <legend style={{ fontWeight: 700, fontSize: 14 }}>Tax Rates</legend>

          {Object.keys(s.tax_rates).length === 0 && (
            <p className="muted" style={{ margin: "4px 0" }}>
              No tax rates configured. Orders will have $0.00 tax.
            </p>
          )}

          {Object.entries(s.tax_rates).map(([name, rate]) => (
            <div
              key={name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                {name}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {(rate * 100).toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={() => removeTaxRate(name)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              placeholder="Name (e.g. vat)"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              placeholder="Rate (e.g. 0.15)"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
              style={{ width: 100 }}
            />
            <button type="button" onClick={addTaxRate}>
              Add
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Rate is a decimal: 0.15 = 15%. Multiple rates are summed.
          </p>
        </fieldset>

        <button type="submit" disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
      </form>
    </div>
  );
}