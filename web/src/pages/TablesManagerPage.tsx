import { useEffect, useState } from "react";
import { api } from "../api";
import type { Staff, TableItem } from "../types";

const SECTIONS = ["DINE-IN", "TAKEOUT & TABS", "BAR", "PATIO", "OTHER"];

export function TablesManagerPage({ staff }: { staff: Staff }) {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setTables(await api.listTables());
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

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tables</h1>
        <button onClick={reload} disabled={loading}>
          Refresh
        </button>
      </header>

      <NewTableForm staff={staff} onCreated={reload} />

      {error && <p className="err">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Section</th>
            <th className="num">v</th>
            <th>Available</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <TableRow key={t.id} table={t} staff={staff} onChanged={reload} />
          ))}
        </tbody>
      </table>

      {tables.length === 0 && !loading && (
        <p className="muted" style={{ marginTop: 16 }}>
          No tables configured yet. Add your first table above — tablets will
          pick it up on their next sync.
        </p>
      )}
    </div>
  );
}

function NewTableForm({
  staff,
  onCreated,
}: {
  staff: Staff;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("DINE-IN");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createTable(staff.id, {
        name: name.trim(),
        section,
      });
      setName("");
      setSection("DINE-IN");
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="row-form" onSubmit={submit}>
      <input
        placeholder="Table name (e.g. T1, Bar, Patio)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select value={section} onChange={(e) => setSection(e.target.value)}>
        {SECTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy || !name.trim()}>
        Add
      </button>
    </form>
  );
}

function TableRow({
  table,
  staff,
  onChanged,
}: {
  table: TableItem;
  staff: Staff;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);
  const [section, setSection] = useState(table.section);

  async function save() {
    await api.updateTable(staff.id, table.id, { name, section });
    setEditing(false);
    onChanged();
  }

  async function toggleAvailable() {
    await api.updateTable(staff.id, table.id, {
      available: !table.available,
    });
    onChanged();
  }

  async function remove() {
    if (!confirm(`Remove ${table.name}?`)) return;
    await api.deleteTable(staff.id, table.id);
    onChanged();
  }

  return (
    <tr className={!table.available ? "muted" : ""}>
      <td>
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} />
        ) : (
          table.name
        )}
      </td>
      <td>
        {editing ? (
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          table.section
        )}
      </td>
      <td className="num">{table.version}</td>
      <td>
        <input
          type="checkbox"
          checked={table.available}
          onChange={toggleAvailable}
        />
      </td>
      <td className="actions">
        {editing ? (
          <>
            <button onClick={save}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={remove}>Delete</button>
          </>
        )}
      </td>
    </tr>
  );
}