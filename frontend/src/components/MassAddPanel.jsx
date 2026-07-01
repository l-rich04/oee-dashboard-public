import { useState } from "react";
import { bulkCreateIssues } from "../api/issues";

const PART_CATEGORIES = [
  { value: "defective_part",   label: "Defective Part" },
  { value: "wrong_spec",       label: "Wrong Specification" },
  { value: "missing_part",     label: "Missing Part" },
  { value: "supplier_issue",   label: "Supplier Issue" },
  { value: "in_house_damage",  label: "In House Damage" },
];

const PROCESS_CATEGORIES = [
  { value: "machine_breakdown",   label: "Machine Breakdown" },
  { value: "setup_error",         label: "Setup Error" },
  { value: "quality_check_fail",  label: "Quality Check Fail" },
  { value: "safety_stop",         label: "Safety Stop" },
  { value: "lack_of_process",     label: "Lack Of Process" },
];

const FOREMEN = ["Rick", "Todd", "Duey", "Jordan", "Dan", "Joel", "Willard", "Eric", "Brian", "Ralph", "QC", "Others"];

let nextId = 1;

function emptyRow(id, defaultDate) {
  return {
    id,
    issue_type: "",
    category: "",
    description: "",
    foreman_name: "",
    created_at: defaultDate,
  };
}

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function MassAddPanel({ onClose, onSaved }) {
  const [sharedDate, setSharedDate] = useState(today());
  const [rows, setRows]             = useState([emptyRow(nextId++, today())]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  function applySharedDate(date) {
    setSharedDate(date);
    setRows(prev => prev.map(r => ({ ...r, created_at: date })));
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field === "issue_type") {
        return { ...r, issue_type: value, category: "" };
      }
      return { ...r, [field]: value };
    }));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(nextId++, sharedDate)]);
  }

  function removeRow(id) {
    if (rows.length === 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function isValidRow(row) {
    return row.issue_type && row.category && row.description.trim() && row.foreman_name && row.created_at;
  }

  const validRows  = rows.filter(isValidRow);
  const readyCount = validRows.length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0) return;
    setSaving(true);
    setError(null);
    try {
      await bulkCreateIssues(validRows.map(r => ({
        issue_type:   r.issue_type,
        category:     r.category,
        description:  r.description.trim(),
        foreman_name: r.foreman_name,
        created_at:   new Date(r.created_at + "T12:00:00").toISOString(),
      })));
      onSaved();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "92%", maxWidth: 780,
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Add Multiple Issues</p>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 20,
            cursor: "pointer", color: "#aaa", lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          padding: "12px 16px", background: "#f0faf6",
          border: "0.5px solid #1D9E75", borderRadius: 8,
        }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>
            Date for all entries
          </label>
          <input
            type="date"
            value={sharedDate}
            onChange={e => applySharedDate(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            Change to backdate, or edit per row below
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", fontWeight: 500, color: "#555" }}>Type</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, color: "#555" }}>Category</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, color: "#555" }}>Description</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, color: "#555" }}>Foreman</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, color: "#555" }}>Date</th>
                  <th style={{ padding: "8px 10px", width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const categories = row.issue_type === "part" ? PART_CATEGORIES
                    : row.issue_type === "process" ? PROCESS_CATEGORIES
                    : [];
                  return (
                    <tr key={row.id} style={{
                      borderBottom: "0.5px solid #f0f0f0",
                      background: isValidRow(row) ? "#f0faf6" : "white",
                    }}>
                      <td style={{ padding: "6px 10px" }}>
                        <select
                          value={row.issue_type}
                          onChange={e => updateRow(row.id, "issue_type", e.target.value)}
                          style={{ ...inputStyle, width: 100 }}
                        >
                          <option value="">Select…</option>
                          <option value="part">Part</option>
                          <option value="process">Process</option>
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <select
                          value={row.category}
                          onChange={e => updateRow(row.id, "category", e.target.value)}
                          disabled={!row.issue_type}
                          style={{ ...inputStyle, width: 150 }}
                        >
                          <option value="">Select…</option>
                          {categories.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={row.description}
                          onChange={e => updateRow(row.id, "description", e.target.value)}
                          placeholder="What happened…"
                          style={{ ...inputStyle, width: 180 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <select
                          value={row.foreman_name}
                          onChange={e => updateRow(row.id, "foreman_name", e.target.value)}
                          style={{ ...inputStyle, width: 100 }}
                        >
                          <option value="">Select…</option>
                          {FOREMEN.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="date"
                          value={row.created_at}
                          onChange={e => updateRow(row.id, "created_at", e.target.value)}
                          style={{ ...inputStyle, width: 130 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          style={{
                            width: 26, height: 26, border: "0.5px solid #ddd",
                            borderRadius: 6, background: "#fff",
                            cursor: rows.length > 1 ? "pointer" : "not-allowed",
                            fontSize: 13, color: "#aaa",
                          }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addRow} style={{
            padding: "7px 14px", background: "#fafafa",
            border: "0.5px dashed #ddd", borderRadius: 6,
            fontSize: 12, color: "#888", cursor: "pointer",
            fontFamily: "inherit", marginBottom: 16,
          }}>
            + Add another row
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "0.5px solid #eee" }}>
            <span style={{ fontSize: 12, color: "#888" }}>
              {readyCount === 0 ? "No complete rows yet" : `${readyCount} ready to submit`}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose} style={{
                padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd",
                borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                Cancel
              </button>
              <button type="submit" disabled={readyCount === 0 || saving} style={{
                padding: "8px 20px",
                background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                cursor: readyCount > 0 ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}>
                {saving ? "Saving…" : `Submit ${readyCount > 0 ? readyCount : ""} Issue${readyCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "6px 8px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" };