import { useState, useEffect, useMemo } from "react";
import { getWorkOrders, createWorkOrder, deleteWorkOrder } from "../api/issues";

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split("T")[0];
}

function getLastWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - 6);
  return d.toISOString().split("T")[0];
}

function stripPrefix(val) {
  return val.replace(/[^0-9]/g, "").slice(0, 6);
}

function formatWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

let nextId = 1;

function emptyRow(id) {
  return { id, work_order_num: "", total_defects: "" };
}

function InlineAddRow({ week, onAdded }) {
  const [wo, setWo]         = useState("");
  const [def, setDef]       = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = wo.length === 6 && def !== "" && Number(def) >= 0;

  async function handleAdd() {
    if (!isValid) return;
    setSaving(true);
    try {
      await createWorkOrder({
        work_order_num:  wo,
        truck_type:      "n/a",
        units_completed: 1,
        total_defects:   Number(def),
        week_start:      week,
      });
      setWo("");
      setDef("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr style={{ borderBottom: "0.5px solid #f0f0f0", background: "#fafafa" }}>
      <td style={{ padding: "6px 16px" }}>
        <input
          type="text" maxLength={6} value={wo}
          onChange={e => setWo(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="New work order #"
          style={{ ...inputStyle, width: 160 }}
        />
      </td>
      <td style={{ padding: "6px 16px" }}>
        <input
          type="number" min="0" value={def}
          onChange={e => setDef(e.target.value)}
          placeholder="Defects"
          style={{ ...inputStyle, width: 80 }}
        />
      </td>
      <td style={{ padding: "6px 16px" }}>
        <button
          onClick={handleAdd} disabled={!isValid || saving}
          style={{
            padding: "3px 10px", fontSize: 11,
            border: "1px solid #1D9E75",
            background: isValid && !saving ? "#E1F5EE" : "#f5f5f5",
            color: isValid && !saving ? "#0F6E56" : "#aaa",
            borderRadius: 6, cursor: isValid ? "pointer" : "not-allowed",
          }}>
          {saving ? "…" : "+ Add"}
        </button>
      </td>
    </tr>
  );
}

export default function WorkOrderPanel({ onSaved }) {
  const [workOrders, setWorkOrders]   = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [weekStart, setWeekStart]     = useState(getWeekStart());
  const [rows, setRows]               = useState([emptyRow(nextId++)]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);
  const [expandedWeeks, setExpanded]  = useState({});
  const [editingId, setEditingId]     = useState(null);
  const [editValues, setEditValues]   = useState({});
  const [confirmWeek, setConfirmWeek] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  async function load() {
    const data = await getWorkOrders();
    setWorkOrders(data);
  }

  useEffect(() => { load(); }, []);

  const availableYears = useMemo(() => {
    const years = new Set(workOrders.map(wo => new Date(wo.week_start + "T12:00:00").getFullYear()));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [workOrders]);

  function openModal() {
    setRows([emptyRow(nextId++)]);
    setWeekStart(getWeekStart());
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setRows([emptyRow(nextId++)]);
    setError(null);
  }

  function toggleWeek(week) {
    setExpanded(prev => ({ ...prev, [week]: !prev[week] }));
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: field === "work_order_num" ? stripPrefix(value) : value };
    }));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(nextId++)]);
  }

  function removeRow(id) {
    if (rows.length === 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function isValidRow(row) {
    return row.work_order_num.length === 6 &&
      row.total_defects !== "" &&
      Number(row.total_defects) >= 0;
  }

  const validRows  = rows.filter(isValidRow);
  const readyCount = validRows.length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(validRows.map(row =>
        createWorkOrder({
          work_order_num:  row.work_order_num,
          truck_type:      "n/a",
          units_completed: 1,
          total_defects:   Number(row.total_defects),
          week_start:      weekStart,
        })
      ));
      setSuccessMsg(`${readyCount} work order${readyCount > 1 ? "s" : ""} added.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      closeModal();
      load();
      if (onSaved) onSaved();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteWorkOrder(id);
    load();
    if (onSaved) onSaved();
  }

  async function handleDeleteWeek(week) {
    const wos = grouped[week] ?? [];
    await Promise.all(wos.map(wo => deleteWorkOrder(wo.id)));
    setConfirmWeek(null);
    load();
    if (onSaved) onSaved();
  }

  function startEdit(wo) {
    setEditingId(wo.id);
    setEditValues({ work_order_num: wo.work_order_num, total_defects: wo.total_defects });
  }

  async function saveEdit(wo) {
    await deleteWorkOrder(wo.id);
    await createWorkOrder({
      work_order_num:  editValues.work_order_num,
      truck_type:      "n/a",
      units_completed: 1,
      total_defects:   Number(editValues.total_defects),
      week_start:      wo.week_start,
    });
    setEditingId(null);
    setEditValues({});
    load();
    if (onSaved) onSaved();
  }

  const lastWeek        = workOrders.filter(wo => wo.week_start === getLastWeekStart());
  const totalDefects    = lastWeek.reduce((sum, wo) => sum + wo.total_defects, 0);
  const defectFreeCount = lastWeek.filter(wo => wo.total_defects === 0).length;
  const dpuRaw          = lastWeek.length > 0 ? totalDefects / lastWeek.length : null;
  const dpuDisplay      = dpuRaw !== null ? dpuRaw.toFixed(2) : "—";

  const grouped = workOrders.reduce((acc, wo) => {
    if (!acc[wo.week_start]) acc[wo.week_start] = [];
    acc[wo.week_start].push(wo);
    return acc;
  }, {});

  const allSortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const sortedWeeks = allSortedKeys.filter(w =>
    new Date(w + "T12:00:00").getFullYear() === selectedYear
  );

  const prevWeekKey = allSortedKeys[1];
  const prevWos     = prevWeekKey ? workOrders.filter(wo => wo.week_start === prevWeekKey) : [];
  const prevDpuRaw  = prevWos.length > 0
    ? prevWos.reduce((sum, wo) => sum + wo.total_defects, 0) / prevWos.length
    : null;

  const dpuColor = dpuRaw === null ? "#aaa"
    : prevDpuRaw !== null && dpuRaw < prevDpuRaw ? "#1D9E75"
    : prevDpuRaw !== null && dpuRaw > prevDpuRaw ? "#A32D2D"
    : "#888";

  const dpuArrow = dpuRaw === null ? ""
    : prevDpuRaw !== null && dpuRaw < prevDpuRaw ? "↓ "
    : prevDpuRaw !== null && dpuRaw > prevDpuRaw ? "↑ "
    : "→ ";

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Add modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28,
            width: "90%", maxWidth: 600,
            maxHeight: "80vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Add Work Orders</p>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "12px 16px", background: "#f0faf6",
              border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>Week Starting</label>
              <input
                type="date" value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                style={{ padding: "7px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }}
              />
              <span style={{ fontSize: 12, color: "#888" }}>All entries saved under this week</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", fontWeight: 500, color: "#555" }}>Work order #</th>
                      <th style={{ padding: "8px 12px", fontWeight: 500, color: "#555" }}>Total defects</th>
                      <th style={{ padding: "8px 12px", width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} style={{ borderBottom: "0.5px solid #f0f0f0", background: isValidRow(row) ? "#f0faf6" : "white" }}>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="text" maxLength={6} value={row.work_order_num}
                            onChange={e => updateRow(row.id, "work_order_num", e.target.value)}
                            placeholder="6 digit number"
                            style={{ ...inputStyle, width: 160 }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="number" min="0" value={row.total_defects}
                            onChange={e => updateRow(row.id, "total_defects", e.target.value)}
                            placeholder="e.g. 5"
                            style={{ ...inputStyle, width: 100 }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          <button
                            type="button" onClick={() => removeRow(row.id)}
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
                    ))}
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
                  <button type="button" onClick={closeModal} style={{
                    padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd",
                    borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}>Cancel</button>
                  <button type="submit" disabled={readyCount === 0 || saving} style={{
                    padding: "8px 20px",
                    background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc",
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 13, fontWeight: 500,
                    cursor: readyCount > 0 ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}>
                    {saving ? "Saving…" : `Submit ${readyCount > 0 ? readyCount : ""} Work Order${readyCount !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
              {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete week modal */}
      {confirmWeek && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setConfirmWeek(null); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28,
            width: "90%", maxWidth: 440,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D", margin: "0 0 8px" }}>Delete entire week?</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px" }}>
              This will permanently delete all {grouped[confirmWeek]?.length} work orders for the week of {formatWeek(confirmWeek)}. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDeleteWeek(confirmWeek)} style={{
                padding: "8px 20px", background: "#E24B4A", color: "#fff",
                border: "none", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500, fontFamily: "inherit",
              }}>Yes, delete all</button>
              <button onClick={() => setConfirmWeek(null)} style={{
                padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd",
                borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 2px" }}>Work Orders</h3>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Track weekly work orders and defects. This is how Quality is calculated.</p>
        </div>
        <button onClick={openModal} style={{
          padding: "8px 16px", background: "#1D9E75", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 13,
          fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          + Add Work Orders
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 20 }}>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Trucks Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: lastWeek.length >= 14 ? "#1D9E75" : "#A32D2D" }}>
            {lastWeek.length}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>Target: <span style={{ fontWeight: 500, color: "#555" }}>14–18</span></p>
          </div>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Defect-Free Trucks</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: defectFreeCount === lastWeek.length && lastWeek.length > 0 ? "#1D9E75" : "#854F0B" }}>
            {defectFreeCount} / {lastWeek.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>DPU Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: dpuColor }}>
            {dpuArrow}{dpuDisplay}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
              Prev: <span style={{ fontWeight: 500, color: "#555" }}>{prevDpuRaw !== null ? prevDpuRaw.toFixed(2) : "—"}</span>
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: "10px 14px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 12 }}>
          {successMsg}
        </div>
      )}

      {/* History toggle + year filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showHistory ? 16 : 0 }}>
        <button
          onClick={() => setShowHistory(prev => !prev)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", background: "#fafafa",
            border: "0.5px solid #eee", borderRadius: 8,
            fontSize: 13, fontWeight: 500, color: "#555",
            cursor: "pointer", fontFamily: "inherit",
          }}>
          {showHistory ? "▲" : "▼"} Work order history
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>
            ({sortedWeeks.length} week{sortedWeeks.length !== 1 ? "s" : ""})
          </span>
        </button>
        {showHistory && (
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
        )}
      </div>

      {showHistory && sortedWeeks.length === 0 && (
        <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: 24 }}>No work orders for {selectedYear}.</p>
      )}

      {showHistory && (
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {sortedWeeks.map((week, idx) => {
            const wos         = grouped[week];
            const weekDefects = wos.reduce((sum, wo) => sum + wo.total_defects, 0);
            const weekDpu     = wos.length > 0 ? weekDefects / wos.length : 0;

            const prevWeek2 = sortedWeeks[idx + 1];
            const prevWos2  = prevWeek2 ? grouped[prevWeek2] : null;
            const prevDpu2  = prevWos2
              ? prevWos2.reduce((sum, wo) => sum + wo.total_defects, 0) / prevWos2.length
              : null;

            let dpuColor2 = "#888";
            let dpuLabel  = "";
            if (prevDpu2 !== null) {
              if (weekDpu < prevDpu2)      { dpuColor2 = "#1D9E75"; dpuLabel = "↓"; }
              else if (weekDpu > prevDpu2) { dpuColor2 = "#A32D2D"; dpuLabel = "↑"; }
              else                         { dpuColor2 = "#888";    dpuLabel = "→"; }
            }

            const isOpen     = expandedWeeks[week];
            const isLastWeek = week === getLastWeekStart();

            return (
              <div key={week} style={{ border: "0.5px solid #eee", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px",
                  background: isLastWeek ? "#f0faf6" : "#fafafa",
                  borderBottom: isOpen ? "0.5px solid #eee" : "none",
                }}>
                  <button
                    type="button" onClick={() => toggleWeek(week)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left",
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>Week of {formatWeek(week)}</span>
                    {isLastWeek && (
                      <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                        Last week
                      </span>
                    )}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: wos.length >= 14 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{wos.length} trucks</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{weekDefects} defects</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: dpuColor2 }}>{dpuLabel} DPU: {weekDpu.toFixed(2)}</span>
                    <button
                      onClick={() => setConfirmWeek(week)}
                      style={{
                        width: 22, height: 22, border: "0.5px solid #ddd",
                        borderRadius: 6, background: "#fff", cursor: "pointer",
                        fontSize: 12, color: "#aaa", fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>✕</button>
                    <span
                      onClick={() => toggleWeek(week)}
                      style={{
                        fontSize: 12, color: "#555", fontWeight: 500,
                        background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                      }}>
                      {isOpen ? "▲ Hide" : "▼ Show"}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Work order</th>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Defects</th>
                        <th style={{ padding: "7px 16px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wos.map(wo => (
                        <tr key={wo.id} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                          <td style={{ padding: "6px 16px" }}>
                            {editingId === wo.id ? (
                              <input
                                type="text" maxLength={6} value={editValues.work_order_num}
                                onChange={e => setEditValues(prev => ({ ...prev, work_order_num: stripPrefix(e.target.value) }))}
                                style={{ ...inputStyle, width: 120 }}
                              />
                            ) : wo.work_order_num}
                          </td>
                          <td style={{ padding: "6px 16px" }}>
                            {editingId === wo.id ? (
                              <input
                                type="number" min="0" value={editValues.total_defects}
                                onChange={e => setEditValues(prev => ({ ...prev, total_defects: e.target.value }))}
                                style={{ ...inputStyle, width: 80 }}
                              />
                            ) : wo.total_defects}
                          </td>
                          <td style={{ padding: "6px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              {editingId === wo.id ? (
                                <>
                                  <button onClick={() => saveEdit(wo)} style={{
                                    padding: "3px 10px", fontSize: 11,
                                    border: "1px solid #1D9E75", background: "#E1F5EE",
                                    color: "#0F6E56", borderRadius: 6, cursor: "pointer",
                                  }}>Save</button>
                                  <button onClick={() => { setEditingId(null); setEditValues({}); }} style={{
                                    padding: "3px 8px", fontSize: 11,
                                    border: "0.5px solid #ddd", background: "#fff",
                                    color: "#888", borderRadius: 6, cursor: "pointer",
                                  }}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(wo)} style={{
                                    padding: "3px 10px", fontSize: 11,
                                    border: "1px solid #378ADD", background: "#E6F1FB",
                                    color: "#0C447C", borderRadius: 6, cursor: "pointer",
                                  }}>Edit</button>
                                  <button onClick={() => handleDelete(wo.id)} style={{
                                    padding: "3px 8px", fontSize: 11,
                                    border: "1px solid #E24B4A", background: "#FCEBEB",
                                    color: "#A32D2D", borderRadius: 6, cursor: "pointer",
                                  }}>Delete</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <InlineAddRow week={week} onAdded={() => { load(); if (onSaved) onSaved(); }} />
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showHistory && sortedWeeks.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#888", display: "flex", gap: 16 }}>
          <span style={{ color: "#1D9E75" }}>↓ Improved from previous week</span>
          <span style={{ color: "#A32D2D" }}>↑ Worse than previous week</span>
          <span style={{ color: "#888" }}>→ No change</span>
        </div>
      )}
    </div>
  );
}

const inputStyle = { padding: "6px 8px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" };