import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { getDefectTypes, createDefectType, deleteDefectType, updateDefectType } from "../api/issues";

const DefectTypeManagePanel = forwardRef(function DefectTypeManagePanel({ onChanged }, ref) {
  const [open, setOpen]             = useState(false);
  const [types, setTypes]           = useState([]);
  const [newName, setNewName]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  async function load() {
    const data = await getDefectTypes();
    setTypes(data);
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createDefectType(newName.trim());
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
    // This is a soft-delete on the backend — it hides the type from new
    // selections here, but any existing work order defect entry that
    // already used it keeps showing its name correctly forever, since the
    // underlying record is never actually removed.
    await deleteDefectType(id);
    load();
    if (onChanged) onChanged();
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditName(t.name);
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
      // Defect types are referenced by ID (not name) from every work order
      // defect entry, so renaming here needs no separate cascade step —
      // every existing entry automatically shows the new name.
      await updateDefectType(id, name);
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
    <div onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "90%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Manage Defect Types</p>
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
            placeholder="Defect type name…"
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

        {error && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 12px" }}>{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {types.length === 0 && (
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: 16 }}>
              No defect types added yet.
            </p>
          )}
          {types.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", background: "#fafafa",
              border: "0.5px solid #eee", borderRadius: 8, gap: 8,
            }}>
              {editingId === t.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                    style={{
                      flex: 1, padding: "5px 8px", fontSize: 13,
                      border: "1px solid #378ADD", borderRadius: 6, fontFamily: "inherit",
                    }}
                  />
                  <button onClick={() => saveEdit(t.id)} disabled={editSaving || !editName.trim()} style={{
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
                  <span style={{ fontSize: 13, color: "#333", flex: 1 }}>{t.name}</span>
                  <button onClick={() => startEdit(t)} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #378ADD", background: "#E6F1FB",
                    color: "#0C447C", borderRadius: 6, cursor: "pointer",
                    fontFamily: "inherit",
                  }}>Edit</button>
                  <button onClick={() => handleDelete(t.id)} style={{
                    padding: "3px 8px", fontSize: 11,
                    border: "1px solid #E24B4A", background: "#FCEBEB",
                    color: "#A32D2D", borderRadius: 6, cursor: "pointer",
                    fontFamily: "inherit",
                  }}>Remove</button>
                </>
              )}
            </div>
          ))}
        </div>
        {editError && <p style={{ fontSize: 12, color: "#A32D2D", margin: "12px 0 0" }}>{editError}</p>}
      </div>
    </div>
  );
});

export default DefectTypeManagePanel;