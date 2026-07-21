import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { getIssueCategories, createIssueCategory, deleteIssueCategory, updateIssueCategory } from "../api/issues";

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function CategoryColumn({ title, issueType, categories, onAdd, onDelete, adding, editingId, editName, editSaving, editError, onStartEdit, onEditNameChange, onSaveEdit, onCancelEdit }) {
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    if (!newName.trim() || adding) return;
    await onAdd(issueType, newName.trim());
    setNewName("");
  }

  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 10px" }}>{title}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, minHeight: 28 }}>
        {categories.length === 0 ? (
          <span style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>No categories yet</span>
        ) : (
          categories.map(c => (
            editingId === c.id ? (
              <span key={c.id} style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, background: "#fff", padding: "2px 4px",
                borderRadius: 8, border: "1px solid #378ADD",
              }}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => onEditNameChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") onSaveEdit(c.id); if (e.key === "Escape") onCancelEdit(); }}
                  autoFocus
                  style={{
                    width: 110, padding: "3px 6px", fontSize: 12,
                    border: "none", outline: "none", fontFamily: "inherit",
                  }}
                />
                <button onClick={() => onSaveEdit(c.id)} disabled={editSaving || !editName.trim()} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#1D9E75", fontSize: 13, lineHeight: 1, padding: "0 2px", fontWeight: 700,
                }}>✓</button>
                <button onClick={onCancelEdit} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#888", fontSize: 13, lineHeight: 1, padding: "0 2px",
                }}>✕</button>
              </span>
            ) : (
              <span key={c.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, background: "#f0f0f0", color: "#333",
                padding: "4px 8px 4px 10px", borderRadius: 8,
              }}>
                <span
                  onClick={() => onStartEdit(c)}
                  title="Click to rename"
                  style={{ cursor: "pointer" }}
                >
                  {titleCase(c.name)}
                </span>
                <button onClick={() => onDelete(c.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#A32D2D", fontSize: 13, lineHeight: 1, padding: 0,
                }}>✕</button>
              </span>
            )
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="New category…"
          style={{
            flex: 1, padding: "6px 10px", fontSize: 12,
            border: "0.5px solid #ddd", borderRadius: 8,
            fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <button onClick={handleAdd} disabled={!newName.trim() || adding} style={{
          padding: "6px 12px", fontSize: 12, fontWeight: 500,
          background: newName.trim() && !adding ? "#1D9E75" : "#ccc", color: "#fff",
          border: "none", borderRadius: 8,
          cursor: newName.trim() && !adding ? "pointer" : "not-allowed",
          fontFamily: "inherit",
        }}>
          + Add
        </button>
      </div>
    </div>
  );
}

const IssueCategoryManagePanel = forwardRef(function IssueCategoryManagePanel({ onChanged }, ref) {
  const [showModal, setShowModal]     = useState(false);
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [adding, setAdding]           = useState(false);
  const [error, setError]             = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState("");
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState(null);

  useImperativeHandle(ref, () => ({
    open: () => setShowModal(true),
  }));

  async function load() {
    setLoading(true);
    try {
      const data = await getIssueCategories();
      setCategories(data);
    } catch (err) {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (showModal) load(); }, [showModal]);

  async function handleAdd(issueType, name) {
    setAdding(true);
    setError(null);
    try {
      await createIssueCategory(issueType, name);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || "Failed to add category.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      await deleteIssueCategory(id);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || "Failed to delete category.");
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(titleCase(c.name));
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
      await updateIssueCategory(id, name);
      setEditingId(null);
      setEditName("");
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setEditError(err.message || "Failed to rename category.");
    } finally {
      setEditSaving(false);
    }
  }

  const partCategories    = categories.filter(c => c.issue_type === "part");
  const processCategories = categories.filter(c => c.issue_type === "process");

  if (!showModal) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "90%", maxWidth: 560, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Manage Issue Categories</p>
          <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px" }}>
          These are the categories foremen can pick from when submitting a Part or Process issue.
          Click a category's name to rename it.
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", gap: 24 }}>
            <CategoryColumn
              title="Part Issue Categories"
              issueType="part"
              categories={partCategories}
              onAdd={handleAdd}
              onDelete={handleDelete}
              adding={adding}
              editingId={editingId}
              editName={editName}
              editSaving={editSaving}
              editError={editError}
              onStartEdit={startEdit}
              onEditNameChange={setEditName}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
            />
            <CategoryColumn
              title="Process Issue Categories"
              issueType="process"
              categories={processCategories}
              onAdd={handleAdd}
              onDelete={handleDelete}
              adding={adding}
              editingId={editingId}
              editName={editName}
              editSaving={editSaving}
              editError={editError}
              onStartEdit={startEdit}
              onEditNameChange={setEditName}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
            />
          </div>
        )}

        {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "12px 0 0" }}>{error}</p>}
        {editError && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{editError}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={() => setShowModal(false)} style={{
            padding: "8px 20px", background: "#1D9E75", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
});

export default IssueCategoryManagePanel;