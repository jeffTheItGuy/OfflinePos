import { useEffect, useState } from "react";
import { api } from "../api";
import type { Order } from "../types";

/**
 * Returns the business-day label (YYYY-MM-DD) for an order timestamp.
 *
 * - `cutoverHour` is the local hour when a new business day begins.
 *   A 4 means orders from 00:00–03:59 still belong to the previous day.
 * - We shift the absolute timestamp back by `cutoverHour` first, then
 *   format in the restaurant's timezone. This is correct even when the
 *   device viewing the report is in a different timezone.
 */
export function businessDay(
  iso: string,
  timeZone: string,
  cutoverHour: number,
): string {
  const shifted = new Date(new Date(iso).getTime() - cutoverHour * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export function SalesReportPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("UTC");
  const [cutoverHour, setCutoverHour] = useState(0);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    // Load settings first so the report buckets correctly on first render.
    // If settings fail, the defaults above (UTC / 0 / USD) are still valid.
    api
      .getSettings()
      .then((s) => {
        setTimeZone(s.restaurant_timezone);
        setCutoverHour(s.business_day_cutover_hour);
        setCurrency(s.currency);
      })
      .catch(() => {
        /* keep defaults */
      });

    api
      .listOrders(undefined, 500)
      .then(setOrders)
      .catch((e) => setError((e as Error).message));
  }, []);

  // Only payment_status decides whether an order is paid.
  const paid = orders.filter((o) => o.payment_status === "paid");

  const total = paid.reduce((s, o) => s + o.total_cents, 0);

  const byDay = new Map<string, { count: number; cents: number }>();

  for (const o of paid) {
    const day = businessDay(o.created_at, timeZone, cutoverHour);
    const cur = byDay.get(day) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += o.total_cents;
    byDay.set(day, cur);
  }

  const days = Array.from(byDay.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  const fmt = (cents: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Sales</h1>
      </header>

      {error && <p className="err">{error}</p>}

      <div className="stat-row">
        <div className="stat">
          <div className="stat-k">Paid orders</div>
          <div className="stat-v">{paid.length}</div>
        </div>

        <div className="stat">
          <div className="stat-k">Gross</div>
          <div className="stat-v">{fmt(total)}</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Day ({timeZone})</th>
            <th className="num">Orders</th>
            <th className="num">Gross</th>
          </tr>
        </thead>

        <tbody>
          {days.map(([day, agg]) => (
            <tr key={day}>
              <td>{day}</td>
              <td className="num">{agg.count}</td>
              <td className="num">{fmt(agg.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
