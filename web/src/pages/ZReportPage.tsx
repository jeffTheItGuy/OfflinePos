import { useEffect, useState } from "react";
import { api } from "../api";
import type { ZReport } from "../types";

export function ZReportPage() {
  const [report, setReport] = useState<ZReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("");

  async function load(dateStr?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getZReport(dateStr || undefined);
      setReport(data);
      // Sync the date input to whatever the server resolved
      if (!dateStr) setDay(data.business_day);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fmt = (cents: number) =>
    report
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: report.currency,
        }).format(cents / 100)
      : `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Z-Report</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
          <button onClick={() => load(day)} disabled={loading}>
            {loading ? "…" : "Load"}
          </button>
        </div>
      </header>

      {error && <p className="err">{error}</p>}
      {loading && !report && <p>Loading…</p>}

      {report && (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>
            Business day {report.business_day} · {report.timezone} ·
            cutover {report.cutover_hour}:00
          </p>

          {/* ── Summary stats ── */}
          <div className="stat-row">
            <div className="stat">
              <div className="stat-k">Gross</div>
              <div className="stat-v">{fmt(report.gross_cents)}</div>
            </div>
            <div className="stat">
              <div className="stat-k">Tax</div>
              <div className="stat-v">{fmt(report.tax_cents)}</div>
            </div>
            <div className="stat">
              <div className="stat-k">Paid Orders</div>
              <div className="stat-v">{report.paid_order_count}</div>
            </div>
            <div className="stat">
              <div className="stat-k">Voids</div>
              <div className="stat-v">{report.void_count}</div>
            </div>
            <div className="stat" style={{ borderColor: "var(--ok)" }}>
              <div className="stat-k">Cash in Drawer</div>
              <div className="stat-v">
                {fmt(report.cash_expected_in_drawer_cents)}
              </div>
            </div>
          </div>

          {/* ── By payment method ── */}
          <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>
            By Payment Method
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th className="num">Transactions</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.by_payment_method.map((m) => (
                <tr key={m.method}>
                  <td style={{ textTransform: "capitalize" }}>{m.method}</td>
                  <td className="num">{m.count}</td>
                  <td className="num">{fmt(m.total_cents)}</td>
                </tr>
              ))}
              {report.by_payment_method.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No payments recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── By category ── */}
          <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>
            By Category
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Lines</th>
                <th className="num">Subtotal</th>
                <th className="num">Tax</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.by_category.map((c) => (
                <tr key={c.category}>
                  <td style={{ textTransform: "capitalize" }}>{c.category}</td>
                  <td className="num">{c.line_count}</td>
                  <td className="num">{fmt(c.subtotal_cents)}</td>
                  <td className="num">{fmt(c.tax_cents)}</td>
                  <td className="num">{fmt(c.total_cents)}</td>
                </tr>
              ))}
              {report.by_category.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No items sold.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── By staff ── */}
          <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>By Staff</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th className="num">Orders</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.by_staff.map((s) => (
                <tr key={s.staff_id}>
                  <td>{s.staff_name}</td>
                  <td className="num">{s.order_count}</td>
                  <td className="num">{fmt(s.total_cents)}</td>
                </tr>
              ))}
              {report.by_staff.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No orders taken.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── Voids ── */}
          <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>
            Voids ({report.void_count})
          </h2>
          {report.voids.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Table</th>
                  <th>Reason</th>
                  <th>Voided By</th>
                  <th className="num">Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {report.voids.map((v) => (
                  <tr key={v.order_id}>
                    <td>{v.order_no}</td>
                    <td>{v.table_name}</td>
                    <td>{v.reason ?? "—"}</td>
                    <td>{v.voided_by_name ?? "—"}</td>
                    <td className="num">{fmt(v.total_cents)}</td>
                    <td>{new Date(v.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No voids today.</p>
          )}
        </>
      )}
    </div>
  );
}