import { useState } from "react";
import { updateIssue } from "../api/issues";

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

function toInputDate(ts) {
  return new Date(ts + "Z").toISOString().split("T")[0];
}

export default function IssueEditPanel({ issue, onClose, onSaved }) {
  const [issueType,   setIssueType]   = useState(issue.issue_type);
  const [category,    setCategory]    = useState(issue.category);
  const [description, setDescription] = useState(issue.description);
  const [date,        setDate]        = useState(toInputDate(issue.created_at));
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  function handleTypeChange(t) {
    setIssueType(t);
    setCategory("");
  }

  const isValid = issueType && category && description.trim() && date;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await updateIssue(issue.id, {
        issue_type:  issueType,
        category,
        description: description.trim(),
        created_at:  new Date(date + "T12:00:00").toISOString(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      marginTop: 24, padding: 24,
      border: "0.5px solid #eee", borderRadius: 12,
      background: "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          Edit Issue #{issue.id}
        </p>
        <button onClick={onClose} style={{
          background: "none", border: "none", fontSize: 18,
          cursor: "pointer", color: "#aaa", lineHeight: 1,
        }}>✕</button>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
        Changes will be saved immediately.
      </p>

      <div style={{ height: "0.5px", background: "#eee", margin: "0 0 16px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <div>
          <label style={labelStyle}>Date Created</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Issue Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["part", "process"].map(t => (
              <button key={t} type="button"
                onClick={() => handleTypeChange(t)}
                style={{
                  padding: "10px",
                  border: `2px solid ${issueType === t ? "#1D9E75" : "#ddd"}`,
                  borderRadius: 8,
                  background: issueType === t ? "#E1F5EE" : "#fff",
                  color: issueType === t ? "#0F6E56" : "#555",
                  fontWeight: 500, cursor: "pointer", fontSize: 13,
                  fontFamily: "inherit",
                }}>
                {t === "part" ? "Part Issue" : "Process Issue"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={inputStyle}>
            <option value="">Select a category…</option>
            {(CATEGORIES[issueType] ?? []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {error && (
          <p style={{ color: "#A32D2D", fontSize: 12, margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={!isValid || saving} style={{
            padding: "9px 20px",
            background: isValid && !saving ? "#1D9E75" : "#ccc",
            border: "none", borderRadius: 8, color: "#fff",
            fontSize: 13, fontWeight: 500, cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} style={{
            padding: "9px 14px", background: "#fff",
            border: "0.5px solid #ddd", borderRadius: 8,
            fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#666",
          }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 13,
  fontWeight: 500, color: "#555", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "10px 12px",
  fontSize: 13, border: "1px solid #ddd",
  borderRadius: 8, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
  background: "#fff",
};