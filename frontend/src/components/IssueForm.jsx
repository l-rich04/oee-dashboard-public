import { useState, useEffect } from "react";
import { submitIssue, getForemen } from "../api/issues";

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

const EMPTY = {
  issue_type:   "",
  category:     "",
  description:  "",
  foreman_name: "",
};

export default function IssueForm() {
  const [form, setForm]           = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [foremen, setForemen]     = useState([]);

  useEffect(() => {
    getForemen()
      .then(data => setForemen(data.map(f => f.name)))
      .catch(err => console.error("Failed to load foremen:", err));
  }, []);

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "issue_type") next.category = "";
      return next;
    });
  }

  const isValid =
    form.issue_type &&
    form.category &&
    form.description.trim() &&
    form.foreman_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      await submitIssue({
        issue_type:   form.issue_type,
        category:     form.category,
        description:  form.description.trim(),
        foreman_name: form.foreman_name,
      });
      setSubmitted(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#E1F5EE", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 28,
        }}>✓</div>
        <h2 style={{ margin: "0 0 8px" }}>Issue Submitted</h2>
        <p style={{ color: "#666", margin: "0 0 24px" }}>
          The supervisor has been notified.
        </p>
        <button onClick={() => { setForm(EMPTY); setSubmitted(false); }}
          style={btnStyle("#1D9E75")}>
          Submit Another Issue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      <div>
        <label style={labelStyle}>Issue Type</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {["part", "process"].map(t => (
            <button key={t} type="button"
              onClick={() => set("issue_type", t)}
              style={{
                padding: "14px 10px",
                border: `2px solid ${form.issue_type === t ? "#1D9E75" : "#ddd"}`,
                borderRadius: 8,
                background: form.issue_type === t ? "#E1F5EE" : "#fff",
                color: form.issue_type === t ? "#0F6E56" : "#555",
                fontWeight: 500, cursor: "pointer", fontSize: 14,
              }}>
              {t === "part" ? "Part Issue" : "Process Issue"}
            </button>
          ))}
        </div>
      </div>

      {form.issue_type && (
        <div>
          <label style={labelStyle}>Category</label>
          <select value={form.category}
            onChange={e => set("category", e.target.value)}
            style={inputStyle}>
            <option value="">Select a category…</option>
            {CATEGORIES[form.issue_type].map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label style={labelStyle}>Description</label>
        <textarea value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Describe what happened…"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <div>
        <label style={labelStyle}>Your Name</label>
        <select value={form.foreman_name}
          onChange={e => set("foreman_name", e.target.value)}
          style={inputStyle}>
          <option value="">Select your name…</option>
          {foremen.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "#A32D2D", margin: 0 }}>{error}</p>}

      <button type="submit" disabled={!isValid || loading}
        style={btnStyle(isValid && !loading ? "#1D9E75" : "#ccc")}>
        {loading ? "Submitting…" : "Submit Issue"}
      </button>

    </form>
  );
}

const labelStyle = {
  display: "block", fontSize: 13,
  fontWeight: 500, color: "#555", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "10px 12px",
  fontSize: 14, border: "1px solid #ddd",
  borderRadius: 8, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
  background: "#fff",
};

function btnStyle(bg) {
  return {
    padding: "13px", background: bg,
    border: "none", borderRadius: 8,
    color: "#fff", fontSize: 14,
    fontWeight: 500, cursor: bg === "#ccc" ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}