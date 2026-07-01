import { useState, useEffect } from "react";
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
  const [totalLaborHours, setTotalLaborHours] = useState("");
  const [indirectHours, setIndirectHours]     = useState("");
  const [reworkHours, setReworkHours]         = useState("");
  const [notes, setNotes]                     = useState("");
  const [saving, setSaving]                   = useState(false);
  const [successMsg, setSuccessMsg]           = useState(null);
  const [error, setError]                     = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editValues, setEditValues] = useState({});

  async function load() {
    try {
      const data = await getIndirectLabor();
      setEntries(data);
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  useEffect(() => { load(); }, []);

  const isValid = totalLaborHours !== "" && Number(totalLaborHours) > 0
             && indirectHours   !== "" && Number(indirectHours)   >= 0;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await saveIndirectLabor({
        week_start:        weekStart,
        total_labor_hours: Number(totalLaborHours),
        indirect_hours:    Number(indirectHours),
        rework_hours:      reworkHours !== "" ? Number(reworkHours) : 0,
        notes:             notes.trim() || null,
      });
      setSuccessMsg("Weekly labor hours saved.");
      setTimeout(() => setSuccessMsg(null), 3000);
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
        Log total, indirect, and rework hours each week. Availability = (total − indirect − rework) ÷ total.
      </p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 10, marginBottom: 16, alignItems: "end",
      }}>
        <div>
          <label style={labelStyle}>Week Starting</label>
          <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={inputStyle} />
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

      <div style={{ border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", textAlign: "left" }}>
              <th style={thStyle}>Week</th>
              <th style={thStyle}>Total Hrs</th>
              <th style={thStyle}>Indirect Hrs</th>
              <th style={thStyle}>Rework Hrs</th>
              <th style={thStyle}>Availability</th>
              <th style={thStyle}>Notes</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
  const avail = e.total_labor_hours > 0
    ? Math.round(((e.total_labor_hours - e.indirect_hours - e.rework_hours) / e.total_labor_hours) * 100)
    : 0;
  const availColor = avail >= 85 ? "#1D9E75" : avail >= 70 ? "#854F0B" : "#A32D2D";

  if (editingId === e.id) {
    return (
      <tr key={e.id} style={{ borderBottom: "0.5px solid #f0f0f0", background: "#f0faf6" }}>
        <td style={tdStyle}>
          <input type="date" value={editValues.week_start}
            onChange={ev => setEditValues(p => ({ ...p, week_start: ev.target.value }))}
            style={{ ...editInputStyle, width: 130 }} />
        </td>
        <td style={tdStyle}>
          <input type="number" min="0" step="0.5" value={editValues.total_labor_hours}
            onChange={ev => setEditValues(p => ({ ...p, total_labor_hours: ev.target.value }))}
            style={{ ...editInputStyle, width: 80 }} />
        </td>
        <td style={tdStyle}>
          <input type="number" min="0" step="0.5" value={editValues.indirect_hours}
            onChange={ev => setEditValues(p => ({ ...p, indirect_hours: ev.target.value }))}
            style={{ ...editInputStyle, width: 80 }} />
        </td>
        <td style={tdStyle}>
          <input type="number" min="0" step="0.5" value={editValues.rework_hours}
            onChange={ev => setEditValues(p => ({ ...p, rework_hours: ev.target.value }))}
            style={{ ...editInputStyle, width: 80 }} />
        </td>
        <td style={{ ...tdStyle, color: availColor, fontWeight: 500 }}>{avail}%</td>
        <td style={tdStyle}>
          <input type="text" value={editValues.notes}
            onChange={ev => setEditValues(p => ({ ...p, notes: ev.target.value }))}
            style={{ ...editInputStyle, width: 120 }} />
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
      <td style={tdStyle}>{e.total_labor_hours}</td>
      <td style={tdStyle}>{e.indirect_hours}</td>
      <td style={tdStyle}>{e.rework_hours}</td>
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
        {entries.length === 0 && (
          <p style={{ textAlign: "center", color: "#aaa", padding: "24px", fontSize: 13 }}>
            No weekly labor hours logged yet.
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 };
const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };
const tdStyle    = { padding: "9px 12px", verticalAlign: "middle" };
const thStyle    = { padding: "8px 12px", fontWeight: 500, color: "#555" };
const editInputStyle = { padding: "4px 6px", fontSize: 11, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box"};