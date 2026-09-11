import { useEffect, useState } from "react";
import { api } from "../api";
import type { MenuItem, Staff } from "../types";

export function MenuManagerPage({ staff }: { staff: Staff }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setItems(await api.listMenu());
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
        <h1>Menu</h1>
        <button onClick={reload} disabled={loading}>
          Refresh
        </button>
      </header>

      <NewItemForm staff={staff} onCreated={reload} />

      {error && <p className="err">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th className="num">Price</th>
            <th className="num">v</th>
            <th>Available</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <MenuRow key={it.id} item={it} staff={staff} onChanged={reload} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewItemForm({
  staff,
  onCreated,
}: {
  staff: Staff;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("general");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(price) * 100);
    if (!name.trim() || !Number.isFinite(cents)) return;
    setBusy(true);
    try {
      await api.createMenuItem(staff.id, {
        name: name.trim(),
        price_cents: cents,
        category: category.trim() || "general",
      });
      setName("");
      setPrice("");
      setCategory("general");
      onCreated();
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
      <input
        placeholder="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <input
        placeholder="9.50"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        inputMode="decimal"
      />
      <button type="submit" disabled={busy || !name.trim() || !price}>
        Add
      </button>
    </form>
  );
}

function MenuRow({
  item,
  staff,
  onChanged,
}: {
  item: MenuItem;
  staff: Staff;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState((item.price_cents / 100).toFixed(2));

  async function save() {
    const cents = Math.round(parseFloat(price) * 100);
    await api.updateMenuItem(staff.id, item.id, {
      name,
      price_cents: cents,
    });
    setEditing(false);
    onChanged();
  }

  async function toggleAvailable() {
    await api.updateMenuItem(staff.id, item.id, {
      available: !item.available,
    });
    onChanged();
  }

  async function remove() {
    if (!confirm(`Remove ${item.name}?`)) return;
    await api.deleteMenuItem(staff.id, item.id);
    onChanged();
  }

  return (
    <tr className={!item.available ? "muted" : ""}>
      <td>
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} />
        ) : (
          item.name
        )}
      </td>
      <td>{item.category}</td>
      <td className="num">
        {editing ? (
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ width: 70 }}
          />
        ) : (
          `$${(item.price_cents / 100).toFixed(2)}`
        )}
      </td>
      <td className="num">{item.version}</td>
      <td>
        <input
          type="checkbox"
          checked={item.available}
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
