import { useState } from "react";
import { api } from "../api";
import type { Order } from "../types";
import { usePolling } from "../hooks/usePolling";
import { OrderCard } from "../components/OrderCard";

export function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  usePolling(async () => {
    try {
      const sent = await api.listOrders("sent", 50);
      setOrders(sent);
      setError(null);
      setLastUpdate(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }, 5000);

  return (
    <div className="kitchen">
      <header className="kitchen-header">
        <h1>Kitchen</h1>
        <div className="kitchen-status">
          {error ? (
            <span className="err">offline — {error}</span>
          ) : (
            <span className="ok">
              live ·{" "}
              {lastUpdate
                ? new Date(lastUpdate).toLocaleTimeString()
                : "…"}
            </span>
          )}
        </div>
      </header>

      {orders.length === 0 ? (
        <p className="kitchen-empty">No open orders.</p>
      ) : (
        <div className="kitchen-grid">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
