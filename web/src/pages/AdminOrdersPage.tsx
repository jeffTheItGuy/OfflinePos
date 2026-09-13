import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { Order, Staff } from "../types";

export function AdminOrdersPage({ staff }: { staff: Staff }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setOrders(await api.listOrders(undefined, 200));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleVoid(order: Order) {
    const reason = prompt(
      `Void ${order.order_no} (${order.table_name})?\nEnter reason:`,
    );
    if (!reason || !reason.trim()) return;

    setVoidingId(order.id);
    setError(null);
    try {
      await api.voidOrder(staff.id, order.id, {
        idempotency_key: crypto.randomUUID(),
        reason: reason.trim(),
      });
      await reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(`Void failed: ${msg}`);
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Orders</h1>
        <button onClick={reload} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && <p className="err">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Table</th>
            <th>Status</th>
            <th>Payment</th>
            <th className="num">Total</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const voided = o.status === "void";
            const canVoid = !voided && (o.payment_status ?? "unpaid") !== "paid";
            return (
              <tr key={o.id} className={voided ? "muted" : ""}>
                <td>{o.order_no}</td>
                <td>{o.table_name}</td>
                <td>
                  {o.status}
                  {voided && o.void_reason ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      ✕ {o.void_reason}
                    </div>
                  ) : null}
                </td>
                <td>{o.payment_status ?? "unpaid"}</td>
                <td className="num">${(o.total_cents / 100).toFixed(2)}</td>
                <td>{new Date(o.created_at).toLocaleString()}</td>
                <td className="actions">
                  {canVoid && (
                    <button
                      disabled={voidingId === o.id}
                      onClick={() => handleVoid(o)}
                    >
                      {voidingId === o.id ? "…" : "Void"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}