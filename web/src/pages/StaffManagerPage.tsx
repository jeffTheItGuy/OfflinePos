import { useEffect, useState } from "react";
import { api } from "../api";
import type { Staff } from "../types";

export function StaffManagerPage({ staff }: { staff: Staff }) {
  const [list, setList] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setList(await api.listStaff());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Staff</h1>
        <button onClick={reload}>Refresh</button>
      </header>

      <NewStaffForm staff={staff} onCreated={reload} />

      {error && <p className="err">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.role}</td>
              <td className="mono">{s.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewStaffForm({
  staff,
  onCreated,
}: {
  staff: Staff;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"waiter" | "manager">("waiter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || pin.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await api.createStaff(staff.id, { name: name.trim(), pin, role });
      setName("");
      setPin("");
      setRole("waiter");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="row-form" onSubmit={submit}>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "waiter" | "manager")}
      >
        <option value="waiter">waiter</option>
        <option value="manager">manager</option>
      </select>
      <input
        placeholder="PIN (4-12)"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        maxLength={12}
      />
      <button type="submit" disabled={busy || !name.trim() || pin.length < 4}>
        Add
      </button>
      {error && <span className="err">{error}</span>}
    </form>
  );
}
