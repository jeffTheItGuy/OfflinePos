import { useEffect, useState } from "react";
import type { Order } from "../types";

export function OrderCard({ order }: { order: Order }) {
  // Recompute the age every 30s so the "late" colour kicks in without
  // requiring the parent to re-render us.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.max(
    0,
    Math.floor((now - new Date(order.created_at).getTime()) / 60_000),
  );

  return (
    <article className="card">
      <header className="card-header">
        <span className="card-no">{order.order_no}</span>
        <span className="card-table">{order.table_name}</span>
        <span className={`card-age ${mins >= 10 ? "late" : ""}`}>{mins}m</span>
      </header>
      <ul className="card-items">
        {order.items.map((it, i) => (
          <li key={i}>
            <span className="qty">{it.quantity}×</span> {it.name}
            {it.notes ? <em className="notes"> — {it.notes}</em> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}
