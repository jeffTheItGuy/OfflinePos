import { useState } from "react";
import { api } from "../api";
import type { Order, OrderStatus } from "../types";
import { usePolling } from "../hooks/usePolling";
import { OrderCard } from "../components/OrderCard";

type KitchenFilter = "active" | "all";

export function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KitchenFilter>("active");

  async function reload() {
    try {
      const data = await api.listKitchenOrders(50);
      setOrders(data);
      setError(null);
      setLastUpdate(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  usePolling(reload, 5000);

  async function setStatus(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    setError(null);

    try {
      await api.updateOrderStatus(order.id, status);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const visibleOrders =
    filter === "all"
      ? orders
      : orders.filter((o) =>
          ["sent", "preparing", "ready"].includes(o.status),
        );

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

      <div className="kitchen-toolbar">
        <button
          className={filter === "active" ? "active" : ""}
          onClick={() => setFilter("active")}
        >
          Active
        </button>

        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>

        <button onClick={reload}>Refresh</button>
      </div>

      {visibleOrders.length === 0 ? (
        <p className="kitchen-empty">No open orders.</p>
      ) : (
        <div className="kitchen-grid">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              footer={
                <KitchenActions
                  order={order}
                  busy={busyId === order.id}
                  onSetStatus={setStatus}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KitchenActions({
  order,
  busy,
  onSetStatus,
}: {
  order: Order;
  busy: boolean;
  onSetStatus: (order: Order, status: OrderStatus) => void;
}) {
  if (order.status === "sent") {
    return (
      <button
        className="kitchen-btn kitchen-btn-start"
        disabled={busy}
        onClick={() => onSetStatus(order, "preparing")}
      >
        Start
      </button>
    );
  }

  if (order.status === "preparing") {
    return (
      <button
        className="kitchen-btn kitchen-btn-ready"
        disabled={busy}
        onClick={() => onSetStatus(order, "ready")}
      >
        Ready
      </button>
    );
  }

  if (order.status === "ready") {
    return (
      <button
        className="kitchen-btn kitchen-btn-complete"
        disabled={busy}
        onClick={() => onSetStatus(order, "completed")}
      >
        Completed
      </button>
    );
  }

  return null;
}