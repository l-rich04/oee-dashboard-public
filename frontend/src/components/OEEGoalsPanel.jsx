import { useState, useEffect } from "react";
import { getOEEGoals, updateOEEGoals, getGoalHistory } from "../api/issues";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getPeriodLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function OEEGoalsPanel({ onSaved }) {
  const [goals, setGoals]                 = useState(null);
  const [history, setHistory]             = useState([]);
  const [open, setOpen]                   = useState(false);
  const [saving, setSaving]               = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [editingId, setEditingId]         = useState(null);
  const [editValues, setEditValues]       = useState({});
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());

  useEffect(() => {
  if (history.length === 0) return;
  const years = [...new Set(history.map(r => parseInt(r.effective_date.split("-")[0])))].sort((a, b) => b - a);
  if (!years.includes(historyYear)) {
    setHistoryYear(years[0]);
  }
}, [history]);

  async function load() {
    try {
      const [g, h] = await Promise.all([getOEEGoals(), getGoalHistory()]);
      setGoals(g);
      setHistory(h);
    } catch (err) {
      console.error("Goals load error:", err);
    }
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    load();
    setEffectiveDate(today());
    setEditingId(null);
    setEditValues({});
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setEditValues({});
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditValues({
      effective_date:     row.effective_date,
      annual_dpu_goal:    row.annual_dpu_goal,
      quarterly_dpu_goal: row.quarterly_dpu_goal,
      weekly_trucks_min:  row.weekly_trucks_min,
      weekly_trucks_max:  row.weekly_trucks_max,
    });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/oee/goal-history/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_date:     editValues.effective_date,
          annual_dpu_goal:    Number(editValues.annual_dpu_goal),
          quarterly_dpu_goal: Number(editValues.quarterly_dpu_goal),
          weekly_trucks_min:  Number(editValues.weekly_trucks_min),
          weekly_trucks_max:  Number(editValues.weekly_trucks_max),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingId(null);
      setEditValues({});
      load();
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Save edit error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHistory(id) {
    try {
      const res = await fetch(`${BASE}/oee/goal-history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      load();
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOEEGoals({
        annual_dpu_goal:        Number(goals.annual_dpu_goal),
        quarterly_dpu_goal:     Number(goals.quarterly_dpu_goal),
        weekly_trucks_min:      Number(goals.weekly_trucks_min),
        weekly_trucks_max:      Number(goals.weekly_trucks_max),
        alert_oee_min:          Number(goals.alert_oee_min          ?? 60),
        alert_availability_min: Number(goals.alert_availability_min ?? 50),
        alert_performance_min:  Number(goals.alert_performance_min  ?? 50),
        alert_quality_min:      Number(goals.alert_quality_min      ?? 50),
        alert_stale_days:       Number(goals.alert_stale_days       ?? 14),
      });

      await fetch(`${BASE}/oee/goal-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_date:     effectiveDate,
          annual_dpu_goal:    Number(goals.annual_dpu_goal),
          quarterly_dpu_goal: Number(goals.quarterly_dpu_goal),
          weekly_trucks_min:  Number(goals.weekly_trucks_min),
          weekly_trucks_max:  Number(goals.weekly_trucks_max),
        }),
      });

      load();
      if (onSaved) onSaved();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  if (!goals) return null;

  const sortedHistory   = [...history].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  const filteredHistory = sortedHistory.filter(r => parseInt(r.effective_date.split("-")[0]) === historyYear);
  const availableYears = [...new Set(sortedHistory.map(r => parseInt(r.effective_date.split("-")[0])))].sort((a, b) => b - a);

  const inputStyle = {
    padding: "4px 6px", fontSize: 11,
    border: "1px solid #ddd", borderRadius: 6,
    fontFamily: "inherit", boxSizing: "border-box",
  };

  const fieldStyle = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "1px solid #ddd", borderRadius: 8,
    fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <>
      <button onClick={openModal} style={{
        padding: "7px 14px", fontSize: 13, border: "0.5px solid #ddd",
        borderRadius: 8, background: "#fff", cursor: "pointer",
        fontFamily: "inherit", color: "#555",
      }}>
        Edit Goals
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28,
            width: "90%", maxWidth: 580,
            maxHeight: "85vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Production goals</p>
              <button onClick={closeModal} style={{
                background: "none", border: "none", fontSize: 20,
                cursor: "pointer", color: "#aaa", lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Effective date */}
            <div style={{ background: "#f9f9f9", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 6 }}>Effective from</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} style={fieldStyle} />
              <p style={{ fontSize: 11, color: "#aaa", margin: "6px 0 0" }}>
                This date will be saved to goal history when you click Save goals.
              </p>
            </div>

            {/* Production targets */}
            <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 10px" }}>Production targets</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Annual DPU Goal",    field: "annual_dpu_goal",    step: "0.01", hint: "Full year target" },
                { label: "Quarterly DPU Goal", field: "quarterly_dpu_goal", step: "0.01", hint: "This quarter's target" },
                { label: "Weekly Trucks Min",  field: "weekly_trucks_min",  step: "1",    hint: null },
                { label: "Weekly Trucks Max",  field: "weekly_trucks_max",  step: "1",    hint: null },
              ].map(({ label, field, step, hint }) => (
                <div key={field}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>{label}</label>
                  <input
                    type="number" step={step} value={goals[field]}
                    onChange={e => setGoals(prev => ({ ...prev, [field]: e.target.value }))}
                    style={fieldStyle}
                  />
                  {hint && <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 0" }}>{hint}</p>}
                </div>
              ))}
            </div>

            {/* Alert thresholds */}
            <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 4px" }}>Alert Thresholds</p>
            <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>
              Dashboard banner alerts fire when metrics drop below these values.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Yearly OEE Minimum %",          field: "alert_oee_min",          def: 60, hint: "Alert if OEE drops below this" },
                { label: "Yearly Availability Minimum %", field: "alert_availability_min", def: 50, hint: "Alert if Availability drops below this" },
                { label: "Yearly Performance Minimum %",  field: "alert_performance_min",  def: 50, hint: "Alert if Performance drops below this" },
                { label: "Yearly Quality Minimum %",      field: "alert_quality_min",      def: 50, hint: "Alert if Quality drops below this" },
                { label: "Stale Issue Days",       field: "alert_stale_days",       def: 14, hint: "Alert if issue open longer than this" },
              ].map(({ label, field, def, hint }) => (
                <div key={field}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>{label}</label>
                  <input
                    type="number" step="1" min="0"
                    value={goals[field] ?? def}
                    onChange={e => setGoals(prev => ({ ...prev, [field]: e.target.value }))}
                    style={fieldStyle}
                  />
                  <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 0" }}>{hint}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <button onClick={handleSave} disabled={saving} style={{
                padding: "8px 20px", background: "#1D9E75", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13,
                fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
                {saving ? "Saving…" : "Save goals"}
              </button>
              <button onClick={closeModal} style={{
                padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd",
                borderRadius: 8, fontSize: 13, cursor: "pointer",
                fontFamily: "inherit", color: "#555",
              }}>
                Cancel
              </button>
            </div>

            {/* Goal history */}
            {sortedHistory.length > 0 && (
              <div style={{ borderTop: "0.5px solid #eee", paddingTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: 0 }}>Goal history</p>
                  {availableYears.length > 1 && (
                    <select
                      value={historyYear}
                      onChange={e => setHistoryYear(Number(e.target.value))}
                      style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #eee", borderRadius: 6, fontFamily: "inherit", background: "#fff", color: "#555" }}
                    >
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>

                {filteredHistory.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: "16px 0" }}>No goal history for {historyYear}.</p>
                ) : (
                  <div style={{ border: "0.5px solid #eee", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #eee" }}>
                          <th style={{ padding: "6px 10px", fontWeight: 500, color: "#888", textAlign: "left" }}>Effective from</th>
                          <th style={{ padding: "6px 10px", fontWeight: 500, color: "#888", textAlign: "left" }}>Period</th>
                          <th style={{ padding: "6px 10px", fontWeight: 500, color: "#888", textAlign: "right" }}>Annual</th>
                          <th style={{ padding: "6px 10px", fontWeight: 500, color: "#888", textAlign: "right" }}>Quarterly</th>
                          <th style={{ padding: "6px 10px", width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((row, i) => (
                          <tr key={row.id} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                            {editingId === row.id ? (
                              <>
                                <td style={{ padding: "6px 8px" }}>
                                  <input type="date" value={editValues.effective_date} onChange={e => setEditValues(p => ({ ...p, effective_date: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
                                </td>
                                <td style={{ padding: "6px 8px", color: "#888" }}>{getPeriodLabel(editValues.effective_date)}</td>
                                <td style={{ padding: "6px 8px" }}>
                                  <input type="number" step="0.01" value={editValues.annual_dpu_goal} onChange={e => setEditValues(p => ({ ...p, annual_dpu_goal: e.target.value }))} style={{ ...inputStyle, width: 60 }} />
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  <input type="number" step="0.01" value={editValues.quarterly_dpu_goal} onChange={e => setEditValues(p => ({ ...p, quarterly_dpu_goal: e.target.value }))} style={{ ...inputStyle, width: 60 }} />
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={saveEdit} disabled={saving} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, cursor: "pointer" }}>Save</button>
                                    <button onClick={() => { setEditingId(null); setEditValues({}); }} style={{ padding: "3px 6px", fontSize: 11, border: "0.5px solid #ddd", background: "#fff", color: "#888", borderRadius: 6, cursor: "pointer" }}>✕</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: "6px 10px", color: "#333" }}>
                                  {row.effective_date}
                                  {row.id === sortedHistory[0].id && (
  <span style={{ fontSize: 10, background: "#E1F5EE", color: "#0F6E56", padding: "1px 6px", borderRadius: 8, marginLeft: 6, fontWeight: 500 }}>current</span>
)}
                                </td>
                                <td style={{ padding: "6px 10px", color: "#888" }}>{getPeriodLabel(row.effective_date)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#888" }}>{Number(row.annual_dpu_goal).toFixed(2)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#888" }}>{Number(row.quarterly_dpu_goal).toFixed(2)}</td>
                                <td style={{ padding: "6px 10px" }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => startEdit(row)} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #378ADD", background: "#E6F1FB", color: "#0C447C", borderRadius: 6, cursor: "pointer" }}>Edit</button>
                                    <button onClick={() => handleDeleteHistory(row.id)} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D", borderRadius: 6, cursor: "pointer" }}>Delete</button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}