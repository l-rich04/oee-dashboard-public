import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { getForemen, createForeman, deleteForeman, updateForeman } from "../api/issues";

// No longer renders its own trigger button — the gear menu in
// SupervisorDashboard opens this via the exposed open() method instead.
const ForemanManagePanel = forwardRef(function ForemanManagePanel({ onChanged }, ref) {
  const [foremen, setForemen]     = useState([]);
  const [open, setOpen]           = useState(false);
  const [newName, setNewName]     = useState("");
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  async function load() {
    const data = await getForemen();
    setForemen(data);
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await createForeman(name);
      setNewName("");
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError("That name already exists or is invalid.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteForeman(id);
    load();
    if (onChanged) onChanged();
  }

  function startEdit(f) {
    setEditingId(f.id);
    setEditName(f.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditError(null);
  }

  async function saveEdit(id) {
    const name = editName.trim();
    if (!name) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateForeman(id, name);
      setEditingId(null);
      setEditName("");
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setEditError("That name already exists or is invalid.");
    } finally {
      setEditSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "90%", maxWidth: 420,
        maxHeight: "80vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Manage Foremen</p>
          <button onClick={() => setOpen(false)} style={{
            background: "none", border: "none", fontSize: 20,
            cursor: "pointer", color: "#aaa", lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New foreman name"
            style={{
              flex: 1, padding: "8px 10px", fontSize: 13,
              border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit",
            }}
          />
          <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{
            padding: "8px 16px",
            background: newName.trim() && !saving ? "#1D9E75" : "#ccc",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 500,
            cursor: newName.trim() ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}>
            {saving ? "Adding…" : "Add"}
          </button>
        </div>

        {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "0 0 12px" }}>{error}</p>}

        <div style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden" }}>
          {foremen.map(f => (
            <div key={f.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 14px", borderBottom: "0.5px solid #f0f0f0", fontSize: 13,
              gap: 8,
            }}>
              {editingId === f.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(f.id); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                    style={{
                      flex: 1, padding: "5px 8px", fontSize: 13,
                      border: "1px solid #378ADD", borderRadius: 6, fontFamily: "inherit",
                    }}
                  />
                  <button onClick={() => saveEdit(f.id)} disabled={editSaving || !editName.trim()} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #1D9E75", background: "#E1F5EE",
                    color: "#0F6E56", borderRadius: 6, cursor: "pointer", fontWeight: 500,
                  }}>
                    {editSaving ? "…" : "Save"}
                  </button>
                  <button onClick={cancelEdit} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "0.5px solid #ddd", background: "#fff",
                    color: "#888", borderRadius: 6, cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <button onClick={() => startEdit(f)} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #378ADD", background: "#E6F1FB",
                    color: "#0C447C", borderRadius: 6, cursor: "pointer",
                  }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(f.id)} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #E24B4A", background: "#FCEBEB",
                    color: "#A32D2D", borderRadius: 6, cursor: "pointer",
                  }}>
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
          {foremen.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa", padding: 16, fontSize: 13 }}>No foremen yet.</p>
          )}
        </div>
        {editError && <p style={{ color: "#A32D2D", fontSize: 12, margin: "12px 0 0" }}>{editError}</p>}
      </div>
    </div>
  );
});

export default ForemanManagePanel;