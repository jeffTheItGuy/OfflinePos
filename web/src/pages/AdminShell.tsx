import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { Staff } from "../types";
import { MenuManagerPage } from "./MenuManagerPage";
import { AdminOrdersPage } from "./AdminOrdersPage";
import { StaffManagerPage } from "./StaffManagerPage";
import { SalesReportPage } from "./SalesReportPage";
import { SettingsPage } from "./SettingsPage";
import { TablesManagerPage } from "./TablesManagerPage";

const STORAGE_KEY = "harbor.staff";

function loadStaff(): Staff | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

export function AdminShell({
  path,
  navigate,
}: {
  path: string;
  navigate: (to: string) => void;
}) {
  const [staff, setStaff] = useState<Staff | null>(loadStaff);

  useEffect(() => {
    if (staff) localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
    else localStorage.removeItem(STORAGE_KEY);
  }, [staff]);

  if (!staff || staff.role !== "manager") {
    return (
      <LoginScreen
        current={staff}
        onLogin={setStaff}
        onLogout={() => setStaff(null)}
      />
    );
  }

  const sub = path.replace(/^\/admin\/?/, "");
  const page:
    | "menu"
    | "orders"
    | "staff"
    | "sales"
    | "settings"
    | "tables" = sub.startsWith("orders")
    ? "orders"
    : sub.startsWith("staff")
      ? "staff"
      : sub.startsWith("sales")
        ? "sales"
        : sub.startsWith("settings")
          ? "settings"
          : sub.startsWith("tables")
            ? "tables"
            : "menu";

  const NavLink = ({
    to,
    label,
    active,
  }: {
    to: string;
    label: string;
    active: boolean;
  }) => (
    <a
      href={to}
      className={active ? "active" : ""}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {label}
    </a>
  );

  return (
    <div className="admin">
      <aside className="admin-side">
        <h2>Harbor Admin</h2>
        <nav>
          <NavLink to="/admin" label="Menu" active={page === "menu"} />
          <NavLink
            to="/admin/tables"
            label="Tables"
            active={page === "tables"}
          />
          <NavLink
            to="/admin/orders"
            label="Orders"
            active={page === "orders"}
          />
          <NavLink to="/admin/staff" label="Staff" active={page === "staff"} />
          <NavLink to="/admin/sales" label="Sales" active={page === "sales"} />
          <NavLink
            to="/admin/settings"
            label="Settings"
            active={page === "settings"}
          />
        </nav>
        <div className="admin-user">
          <div>{staff.name}</div>
          <div className="muted">{staff.role}</div>
          <button onClick={() => setStaff(null)}>Log out</button>
        </div>
      </aside>
      <main className="admin-main">
        {page === "menu" && <MenuManagerPage staff={staff} />}
        {page === "tables" && <TablesManagerPage staff={staff} />}
        {page === "orders" && <AdminOrdersPage staff={staff} />}
        {page === "staff" && <StaffManagerPage staff={staff} />}
        {page === "sales" && <SalesReportPage />}
        {page === "settings" && <SettingsPage staff={staff} />}
      </main>
    </div>
  );
}

function LoginScreen({
  current,
  onLogin,
  onLogout,
}: {
  current: Staff | null;
  onLogin: (s: Staff) => void;
  onLogout: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const staff = await api.login(pin);
      if (staff.role !== "manager") {
        setError("Manager role required");
        return;
      }
      onLogin(staff);
      setPin("");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? "Invalid PIN"
          : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Admin login</h1>
        <p className="muted">Managers only.</p>
        {current && current.role !== "manager" && (
          <p className="err">
            Signed in as {current.name} ({current.role}) —{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onLogout();
              }}
            >
              log out
            </a>
            .
          </p>
        )}
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={12}
          autoFocus
        />
        {error && <p className="err">{error}</p>}
        <button type="submit" disabled={busy || pin.length < 4}>
          {busy ? "…" : "Log in"}
        </button>
      </form>
    </div>
  );
}