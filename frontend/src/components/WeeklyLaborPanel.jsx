import { useState, useEffect, useMemo } from "react";
import { getIndirectLabor, saveIndirectLabor, deleteIndirectLabor } from "../api/issues";

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split("T")[0];
}

function formatWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function WeeklyLaborPanel({ onSaved }) {
  const [entries, setEntries]                 = useState([]);
  const [weekStart, setWeekStart]             = useState(getWeekStart());
  const [workingDays, setWorkingDays]         = useState(5);
  const [totalLaborHours, setTotalLaborHours] = useState("");
  const [indirectHours, setIndirectHours]     = useState("");
  const [reworkHours, setReworkHours]         = useState("");
  const [notes, setNotes]                     = useState("");
  const [saving, setSaving]                   = useState(false);
  const [successMsg, setSuccessMsg]           = useState(null);
  const [error, setError]                     = useState(null);
  const [editingId, setEditingId]             = useState(null);
  const [editValues, setEditValues]           = useState({});
  const [selectedYear, setSelectedYear]       = useState(new Date().getFullYear());

  async function load() {
    try {
      const data = await getIndirectLabor();
      setEntries(data);
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  useEffect(() => { load(); }, []);

  const availableYears = useMemo(() => {
    const years = new Set(entries.map(e => new Date(e.week_start + "T12:00:00").getFullYear()));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e =>
      new Date(e.week_start + "T12:00:00").getFullYear() === selectedYear
    );
  }, [entries, selectedYear]);

  const isValid = totalLaborHours !== "" && Number(totalLaborHours) > 0
               && indirectHours   !== "" && Number(indirectHours)   >= 0;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await saveIndirectLabor({
        week_start:        weekStart,
        working_days:      Number(workingDays),
        total_labor_hours: Number(totalLaborHours),
        indirect_hours:    Number(indirectHours),
        rework_hours:      reworkHours !== "" ? Number(reworkHours) : 0,
        notes:             notes.trim() || null,
      });
      setSuccessMsg("Weekly labor hours saved.");
      setTimeout(() => setSuccessMsg(null), 3000);
      setWorkingDays(5);
      setTotalLaborHours("");
      setIndirectHours("");
      setReworkHours("");
      setNotes("");
      load();
      if (onSaved) onSaved();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteIndirectLabor(id);
    load();
    if (onSaved) onSaved();
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditValues({
      week_start:        entry.week_start,
      working_days:      entry.working_days ?? 5,
      total_labor_hours: entry.total_labor_hours,
      indirect_hours:    entry.indirect_hours,
      rework_hours:      entry.rework_hours,
      notes:             entry.notes ?? "",
    });
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await saveIndirectLabor({
        week_start:        editValues.week_start,
        working_days:      Number(editValues.working_days),
        total_labor_hours: Number(editValues.total_labor_hours),
        indirect_hours:    Number(editValues.indirect_hours),
        rework_hours:      Number(editValues.rework_hours),
        notes:             editValues.notes.trim() || null,
      });
      setEditingId(null);
      setEditValues({});
      load();
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 6px" }}>Weekly Labor Hours</h3>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px" }}>
        Log Total, Indirect, and Rework Hours Each Week. Set working days to less than 5 for short weeks — performance target adjusts automatically.
      </p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 10, marginBottom: 16, alignItems: "end",
      }}>
        <div>
          <label style={labelStyle}>Week Starting</label>
          <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Working Days</label>
          <select
            value={workingDays}
            onChange={e => setWorkingDays(Number(e.target.value))}
            style={inputStyle}>
            {[1, 2, 3, 4, 5].map(d => (
              <option key={d} value={d}>{d} day{d !== 1 ? "s" : ""}{d === 5 ? " (full week)" : " (short week)"}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Total Labor Hours</label>
          <input
            type="number" min="0" step="0.5"
            value={totalLaborHours}
            onChange={e => setTotalLaborHours(e.target.value)}
            placeholder="e.g. 400"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Indirect Hours</label>
          <input
            type="number" min="0" step="0.5"
            value={indirectHours}
            onChange={e => setIndirectHours(e.target.value)}
            placeholder="e.g. 80"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Rework Hours</label>
          <input
            type="number" min="0" step="0.5"
            value={reworkHours}
            onChange={e => setReworkHours(e.target.value)}
            placeholder="e.g. 6"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any extra details…"
            style={inputStyle}
          />
        </div>
        <div>
          <button onClick={handleSave} disabled={!isValid || saving} style={{
            width: "100%", padding: "9px 12px",
            background: isValid && !saving ? "#1D9E75" : "#ccc",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 500,
            cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {workingDays < 5 && (
        <div style={{ padding: "10px 14px", background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 8, fontSize: 12, color: "#854F0B", marginBottom: 12 }}>
          Short week — performance target will be adjusted to {workingDays}/5 of the normal target.
        </div>
      )}

      {successMsg && (
        <div style={{ padding: "10px 14px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 12 }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 13, color: "#A32D2D", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>Logged Entries</p>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{
            padding: "5px 10px", fontSize: 12, border: "1px solid #ddd",
            borderRadius: 8, fontFamily: "inherit", background: "#fff", color: "#555",
          }}>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div style={{ border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden", maxHeight: 400, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", textAlign: "left" }}>
              <th style={thStyle}>Week</th>
              <th style={thStyle}>Days</th>
              <th style={thStyle}>Total hrs</th>
              <th style={thStyle}>Indirect hrs</th>
              <th style={thStyle}>Rework hrs</th>
              <th style={thStyle}>Rework %</th>
              <th style={thStyle}>Availability</th>
              <th style={thStyle}>Notes</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(e => {
              const days = e.working_days ?? 5;
              const avail = e.total_labor_hours > 0
                ? Math.round(((e.total_labor_hours - e.indirect_hours - e.rework_hours) / e.total_labor_hours) * 100)
                : 0;
              const availColor = avail >= 85 ? "#1D9E75" : avail >= 70 ? "#854F0B" : "#A32D2D";
              const reworkPct      = e.total_labor_hours > 0
                ? ((e.rework_hours / e.total_labor_hours) * 100).toFixed(1)
                : "0.0";
              const reworkPctColor = parseFloat(reworkPct) > 10 ? "#A32D2D" : parseFloat(reworkPct) > 5 ? "#854F0B" : "#1D9E75";

              if (editingId === e.id) {
                return (
                  <tr key={e.id} style={{ borderBottom: "0.5px solid #f0f0f0", background: "#f0faf6" }}>
                    <td style={tdStyle}>
                      <input type="date" value={editValues.week_start}
                        onChange={ev => setEditValues(p => ({ ...p, week_start: ev.target.value }))}
                        style={{ ...editInputStyle, width: 130 }} />
                    </td>
                    <td style={tdStyle}>
                      <select value={editValues.working_days}
                        onChange={ev => setEditValues(p => ({ ...p, working_days: Number(ev.target.value) }))}
                        style={{ ...editInputStyle, width: 60 }}>
                        {[1,2,3,4,5].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.5" value={editValues.total_labor_hours}
                        onChange={ev => setEditValues(p => ({ ...p, total_labor_hours: ev.target.value }))}
                        style={{ ...editInputStyle, width: 70 }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.5" value={editValues.indirect_hours}
                        onChange={ev => setEditValues(p => ({ ...p, indirect_hours: ev.target.value }))}
                        style={{ ...editInputStyle, width: 70 }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.5" value={editValues.rework_hours}
                        onChange={ev => setEditValues(p => ({ ...p, rework_hours: ev.target.value }))}
                        style={{ ...editInputStyle, width: 70 }} />
                    </td>
                    <td style={{ ...tdStyle, color: reworkPctColor, fontWeight: 500 }}>{reworkPct}%</td>
                    <td style={{ ...tdStyle, color: availColor, fontWeight: 500 }}>{avail}%</td>
                    <td style={tdStyle}>
                      <input type="text" value={editValues.notes}
                        onChange={ev => setEditValues(p => ({ ...p, notes: ev.target.value }))}
                        style={{ ...editInputStyle, width: 100 }} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleSaveEdit} disabled={saving} style={{
                          padding: "3px 10px", fontSize: 11,
                          border: "1px solid #1D9E75", background: "#E1F5EE",
                          color: "#0F6E56", borderRadius: 6, cursor: "pointer",
                        }}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditValues({}); }} style={{
                          padding: "3px 8px", fontSize: 11,
                          border: "0.5px solid #ddd", background: "#fff",
                          color: "#888", borderRadius: 6, cursor: "pointer",
                        }}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={e.id} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                  <td style={tdStyle}>{formatWeek(e.week_start)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: days < 5 ? "#FAEEDA" : "#f0f0f0",
                      color: days < 5 ? "#854F0B" : "#555",
                      padding: "1px 6px", borderRadius: 6,
                    }}>{days}d</span>
                  </td>
                  <td style={tdStyle}>{e.total_labor_hours}</td>
                  <td style={tdStyle}>{e.indirect_hours}</td>
                  <td style={tdStyle}>{e.rework_hours}</td>
                  <td style={{ ...tdStyle, color: reworkPctColor, fontWeight: 500 }}>{reworkPct}%</td>
                  <td style={{ ...tdStyle, color: availColor, fontWeight: 500 }}>{avail}%</td>
                  <td style={{ ...tdStyle, color: "#888" }}>{e.notes ?? "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(e)} style={{
                        padding: "3px 8px", fontSize: 11,
                        border: "1px solid #378ADD", background: "#E6F1FB",
                        color: "#0C447C", borderRadius: 6, cursor: "pointer",
                      }}>Edit</button>
                      <button onClick={() => handleDelete(e.id)} style={{
                        padding: "3px 8px", fontSize: 11,
                        border: "1px solid #E24B4A", background: "#FCEBEB",
                        color: "#A32D2D", borderRadius: 6, cursor: "pointer",
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredEntries.length === 0 && (
          <p style={{ textAlign: "center", color: "#aaa", padding: "24px", fontSize: 13 }}>
            No weekly labor hours logged for {selectedYear}.
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle     = { display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 };
const inputStyle     = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };
const tdStyle        = { padding: "9px 12px", verticalAlign: "middle" };
const thStyle        = { padding: "8px 12px", fontWeight: 500, color: "#555" };
const editInputStyle = { padding: "4px 6px", fontSize: 11, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" };