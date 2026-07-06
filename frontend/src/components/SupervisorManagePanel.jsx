import { useState, useEffect } from "react";
import { getSupervisors, createSupervisor, deleteSupervisor } from "../api/issues";

export default function SupervisorManagePanel({ onChanged }) {
  const [open, setOpen]         = useState(false);
  const [supervisors, setSupervisors] = useState([]);
  const [newName, setNewName]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  async function load() {
    const data = await getSupervisors();
    setSupervisors(data);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSupervisor(newName.trim());
      setNewName("");
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError("Name already exists or could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteSupervisor(id);
    load();
    if (onChanged) onChanged();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        padding: "7px 14px", fontSize: 13, fontWeight: 500,
        border: "0.5px solid #ddd", borderRadius: 8,
        background: "#fff", color: "#555",
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Manage Supervisors
      </button>

      {open && (
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
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Manage Supervisors</p>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", fontSize: 20,
                cursor: "pointer", color: "#aaa", lineHeight: 1,
              }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Supervisor name…"
                style={{
                  flex: 1, padding: "8px 12px", fontSize: 13,
                  border: "1px solid #ddd", borderRadius: 8,
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <button onClick={handleAdd} disabled={!newName.trim() || saving} style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 500,
                border: "none", borderRadius: 8,
                background: newName.trim() ? "#1D9E75" : "#ccc",
                color: "#fff", cursor: newName.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}>
                {saving ? "…" : "Add"}
              </button>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {supervisors.length === 0 && (
                <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: 16 }}>
                  No supervisors added yet.
                </p>
              )}
              {supervisors.map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", background: "#fafafa",
                  border: "0.5px solid #eee", borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, color: "#333" }}>{s.name}</span>
                  <button onClick={() => handleDelete(s.id)} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #E24B4A", background: "#FCEBEB",
                    color: "#A32D2D", borderRadius: 6, cursor: "pointer",
                    fontFamily: "inherit",
                  }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}