import { useState } from "react";
import { bulkCreateIssues } from "../api/issues";

const CATEGORIES = {
  part: [
    { value: "defective_part",  label: "Defective Part" },
    { value: "wrong_spec",      label: "Wrong Specification" },
    { value: "missing_part",    label: "Missing Part" },
    { value: "supplier_issue",  label: "Supplier Issue" },
    { value: "in_house_damage", label: "In House Damage" },
  ],
  process: [
    { value: "machine_breakdown",  label: "Machine Breakdown" },
    { value: "setup_error",        label: "Setup Error" },
    { value: "quality_check_fail", label: "Quality Check Fail" },
    { value: "safety_stop",        label: "Safety Stop" },
    { value: "lack_of_process",    label: "Lack Of Process" },
  ],
};

const FOREMEN = [
  "Rick", "Todd", "Duey", "Jordan", "Dan",
  "Joel", "Willard", "Eric", "Brian", "Ralph", "QC", "Others",
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function emptyRow(id) {
  return {
    id,
    issue_type:   "",
    category:     "",
    description:  "",
    foreman_name: "",
    date:         today(),
  };
}

let nextId = 1;

export default function MassAddPanel({ onClose, onSaved }) {
  const [rows, setRows]             = useState([emptyRow(nextId++)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "issue_type") {
        updated.category = "";
      }
      return updated;
    }));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(nextId++)]);
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function isValid(row) {
    return row.issue_type && row.category && row.description.trim() && row.foreman_name;
  }

  const validRows  = rows.filter(isValid);
  const readyCount = validRows.length;

  async function handleSubmit() {
    if (readyCount === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = validRows.map(r => ({
        issue_type:   r.issue_type,
        category:     r.category,
        description:  r.description.trim(),
        foreman_name: r.foreman_name,
        created_at:   new Date(r.date + "T12:00:00").toISOString(),
      }));
      await bulkCreateIssues(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      background: "#fff", border: "0.5px solid #eee",
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Add Multiple Issues</p>
        <button onClick={onClose} style={{
          background: "none", border: "none", fontSize: 18,
          cursor: "pointer", color: "#aaa", lineHeight: 1,
        }}>✕</button>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#888" }}>
        Fill in each row. Incomplete rows are skipped automatically.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              {["Date", "Issue Type", "Category", "Description", "Foreman Name", ""].map(h => (
                <th key={h} style={{ padding: "6px 8px", fontWeight: 500, color: "#555", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{
                borderBottom: "0.5px solid #f5f5f5",
                background: isValid(row) ? "#f0faf6" : "white",
              }}>
                <td style={tdStyle}>
                  <input type="date" value={row.date}
                    onChange={e => updateRow(row.id, "date", e.target.value)}
                    style={inputStyle} />
                </td>
                <td style={tdStyle}>
                  <select value={row.issue_type}
                    onChange={e => updateRow(row.id, "issue_type", e.target.value)}
                    style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="part">Part Issue</option>
                    <option value="process">Process Issue</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <select value={row.category}
                    onChange={e => updateRow(row.id, "category", e.target.value)}
                    disabled={!row.issue_type}
                    style={{ ...inputStyle, color: !row.issue_type ? "#bbb" : "inherit" }}>
                    <option value="">
                      {row.issue_type ? "Select category…" : "Select type first…"}
                    </option>
                    {(CATEGORIES[row.issue_type] ?? []).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <input type="text" value={row.description}
                    onChange={e => updateRow(row.id, "description", e.target.value)}
                    placeholder="Brief description…"
                    style={{ ...inputStyle, minWidth: 200 }} />
                </td>
                <td style={tdStyle}>
                  <select value={row.foreman_name}
                    onChange={e => updateRow(row.id, "foreman_name", e.target.value)}
                    style={{ ...inputStyle, minWidth: 120 }}>
                    <option value="">Select…</option>
                    {FOREMEN.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    style={{
                      width: 26, height: 26, border: "0.5px solid #ddd",
                      borderRadius: 6, background: "#fff",
                      cursor: rows.length > 1 ? "pointer" : "not-allowed",
                      fontSize: 13, color: "#aaa", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} style={{
        marginTop: 10, padding: "7px 14px", background: "#fafafa",
        border: "0.5px dashed #ddd", borderRadius: 6, fontSize: 12,
        color: "#888", cursor: "pointer", fontFamily: "inherit",
      }}>
        + Add Another Row
      </button>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 16, paddingTop: 16, borderTop: "0.5px solid #eee",
      }}>
        <span style={{ fontSize: 12, color: "#888" }}>
          {readyCount === 0
            ? "No complete rows yet"
            : `${readyCount} issue${readyCount > 1 ? "s" : ""} ready to submit`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd",
            borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit}
            disabled={readyCount === 0 || submitting}
            style={{
              padding: "8px 20px",
              background: readyCount > 0 && !submitting ? "#1D9E75" : "#ccc",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              cursor: readyCount > 0 ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}>
            {submitting ? "Submitting…" : `Submit ${readyCount > 0 ? readyCount : ""} Issue${readyCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>
      )}
    </div>
  );
}

const tdStyle    = { padding: "6px 8px", verticalAlign: "middle" };
const inputStyle = {
  padding: "6px 8px", fontSize: 12, border: "0.5px solid #ddd",
  borderRadius: 6, fontFamily: "inherit", width: "100%",
  boxSizing: "border-box", background: "#fff",
};