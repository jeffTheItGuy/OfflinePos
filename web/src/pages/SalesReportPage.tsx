import { useEffect, useState } from "react";
import { api } from "../api";
import type { Order } from "../types";

export function SalesReportPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listOrders(undefined, 500)
      .then(setOrders)
      .catch((e) => setError((e as Error).message));
  }, []);

  const paid = orders.filter((o) => o.status === "paid");
  const total = paid.reduce((s, o) => s + o.total_cents, 0);

  // Group by UTC date (matches the backend's created_at, which is tz-aware).
  const byDay = new Map<string, { count: number; cents: number }>();
  for (const o of paid) {
    const day = o.created_at.slice(0, 10);
    const cur = byDay.get(day) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += o.total_cents;
    byDay.set(day, cur);
  }
  const days = Array.from(byDay.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

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
          <div className="stat-v">${(total / 100).toFixed(2)}</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Day (UTC)</th>
            <th className="num">Orders</th>
            <th className="num">Gross</th>
          </tr>
        </thead>
        <tbody>
          {days.map(([day, agg]) => (
            <tr key={day}>
              <td>{day}</td>
              <td className="num">{agg.count}</td>
              <td className="num">${(agg.cents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
