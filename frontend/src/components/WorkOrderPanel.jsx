import { useState, useEffect, useMemo } from "react";
import {
  getWorkOrders, createWorkOrder, deleteWorkOrder,
  getTruckTypes, getDefectTypes,
  getWorkOrderDefects, addWorkOrderDefect, deleteWorkOrderDefect,
} from "../api/issues";

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

function formatWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

let nextId = 1;

function emptyWORow(id) {
  return { id, work_order_num: "", truck_type_id: "", defect_rows: [{ id: nextId++, defect_type_id: "", quantity: "" }] };
}

function emptyDefectRow() {
  return { id: nextId++, defect_type_id: "", quantity: "" };
}

export default function WorkOrderPanel({ onSaved, unreadIds = new Set(), onMarkRead }) {
  const [workOrders, setWorkOrders]     = useState([]);
  const [truckTypes, setTruckTypes]     = useState([]);
  const [defectTypes, setDefectTypes]   = useState([]);
  const [showModal, setShowModal]       = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [weekStart, setWeekStart]       = useState(getWeekStart());
  const [woRows, setWoRows]             = useState([emptyWORow(nextId++)]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [successMsg, setSuccessMsg]     = useState(null);
  const [expandedWeeks, setExpanded]    = useState({});
  const [expandedWO, setExpandedWO]     = useState({});
  const [woDefects, setWoDefects]       = useState({});
  const [editingId, setEditingId]       = useState(null);
  const [editValues, setEditValues]     = useState({});
  const [confirmWeek, setConfirmWeek]   = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  async function load() {
    const data = await getWorkOrders();
    setWorkOrders(data);
  }

  async function loadTypes() {
    const [tt, dt] = await Promise.all([getTruckTypes(), getDefectTypes()]);
    setTruckTypes(tt);
    setDefectTypes(dt);
  }

  useEffect(() => { load(); loadTypes(); }, []);

  async function loadWODefects(woId) {
    const data = await getWorkOrderDefects(woId);
    setWoDefects(prev => ({ ...prev, [woId]: data }));
  }

  const availableYears = useMemo(() => {
    const years = new Set(workOrders.map(wo => new Date(wo.week_start + "T12:00:00").getFullYear()));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [workOrders]);

  function openModal() {
    setWoRows([emptyWORow(nextId++)]);
    setWeekStart(getWeekStart());
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setWoRows([emptyWORow(nextId++)]);
    setError(null);
  }

  async function toggleWeek(week, wos) {
    const isOpening = !expandedWeeks[week];
    setExpanded(prev => ({ ...prev, [week]: !prev[week] }));
    if (isOpening && onMarkRead) {
      const unread = wos.filter(wo => unreadIds.has(wo.id));
      for (const wo of unread) {
        await onMarkRead(wo.id);
      }
    }
  }

  function toggleWO(woId) {
    setExpandedWO(prev => {
      const next = { ...prev, [woId]: !prev[woId] };
      if (next[woId] && !woDefects[woId]) loadWODefects(woId);
      return next;
    });
  }

  function updateWORow(id, field, value) {
    setWoRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value }));
  }

  function addDefectRow(woId) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: [...r.defect_rows, emptyDefectRow()],
    }));
  }

  function removeDefectRow(woId, defectRowId) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: r.defect_rows.filter(d => d.id !== defectRowId),
    }));
  }

  function updateDefectRow(woId, defectRowId, field, value) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: r.defect_rows.map(d => d.id !== defectRowId ? d : { ...d, [field]: value }),
    }));
  }

  function addWORow() {
    setWoRows(prev => [...prev, emptyWORow(nextId++)]);
  }

  function removeWORow(id) {
    if (woRows.length === 1) return;
    setWoRows(prev => prev.filter(r => r.id !== id));
  }

  function calcTotal(defect_rows) {
    return defect_rows.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  }

  function isValidWO(row) {
    return row.work_order_num.length === 6 && row.truck_type_id !== "";
  }

  const validRows           = woRows.filter(isValidWO);
  const readyCount          = validRows.length;
  const totalDefectsPreview = woRows.reduce((sum, r) => sum + calcTotal(r.defect_rows), 0);
  const dpuPreview          = readyCount > 0 ? (totalDefectsPreview / readyCount).toFixed(2) : "—";

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const row of validRows) {
        const total     = calcTotal(row.defect_rows);
        const truckName = truckTypes.find(t => t.id === Number(row.truck_type_id))?.name ?? "n/a";
        const wo = await createWorkOrder({
          work_order_num:  row.work_order_num,
          truck_type:      truckName,
          units_completed: 1,
          total_defects:   total,
          week_start:      weekStart,
        });
        for (const d of row.defect_rows) {
          if (d.defect_type_id && Number(d.quantity) > 0) {
            await addWorkOrderDefect(wo.id, Number(d.defect_type_id), Number(d.quantity));
          }
        }
      }
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
    setEditValues({
      work_order_num: wo.work_order_num,
      truck_type:     wo.truck_type,
      total_defects:  wo.total_defects,
    });
  }

  async function saveEdit(wo) {
    await deleteWorkOrder(wo.id);
    await createWorkOrder({
      work_order_num:  editValues.work_order_num,
      truck_type:      editValues.truck_type,
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
  const sortedWeeks   = allSortedKeys.filter(w =>
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

      {/* ADD MODAL */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28,
            width: "90%", maxWidth: 640,
            maxHeight: "85vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Add Work Orders</p>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "10px 14px", background: "#f0faf6",
              border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>Week starting</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#888" }}>All entries saved under this week</span>
            </div>

            <form onSubmit={handleSubmit}>
              {woRows.map(row => (
                <div key={row.id} style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #eee" }}>
                    <input
                      type="text" maxLength={6} value={row.work_order_num}
                      onChange={e => updateWORow(row.id, "work_order_num", e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="Work order #"
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <select value={row.truck_type_id} onChange={e => updateWORow(row.id, "truck_type_id", e.target.value)} style={{ ...inputStyle, width: 140 }}>
                      <option value="">Truck type…</option>
                      {truckTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, background: "#E6F1FB", color: "#0C447C", padding: "2px 8px", borderRadius: 8 }}>
                      {calcTotal(row.defect_rows)} defects
                    </span>
                    {woRows.length > 1 && (
                      <button type="button" onClick={() => removeWORow(row.id)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11 }}>Defect type</th>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11, width: 90 }}>Quantity</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.defect_rows.map(dr => (
                        <tr key={dr.id} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                          <td style={{ padding: "6px 14px" }}>
                            <select value={dr.defect_type_id} onChange={e => updateDefectRow(row.id, dr.id, "defect_type_id", e.target.value)} style={{ ...inputStyle, width: "100%" }}>
                              <option value="">Select defect type…</option>
                              {defectTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            <input type="number" min="0" value={dr.quantity} onChange={e => updateDefectRow(row.id, dr.id, "quantity", e.target.value)} placeholder="0" style={{ ...inputStyle, width: 70 }} />
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            {row.defect_rows.length > 1 && (
                              <button type="button" onClick={() => removeDefectRow(row.id, dr.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#aaa" }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={() => addDefectRow(row.id)} style={{ margin: "8px 14px", padding: "4px 10px", fontSize: 11, border: "0.5px dashed #ddd", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit" }}>
                    + add defect type
                  </button>
                </div>
              ))}

              <button type="button" onClick={addWORow} style={{ width: "100%", padding: "8px", fontSize: 12, border: "0.5px dashed #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>
                + add another work order
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "0.5px solid #eee" }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  {readyCount === 0 ? "Complete work order # and truck type to submit" : `${readyCount} work order${readyCount !== 1 ? "s" : ""} · ${totalDefectsPreview} defects · DPU preview: ${dpuPreview}`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={closeModal} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button type="submit" disabled={readyCount === 0 || saving} style={{
                    padding: "8px 20px",
                    background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc",
                    color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: readyCount > 0 ? "pointer" : "not-allowed", fontFamily: "inherit",
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

      {/* CONFIRM DELETE WEEK MODAL */}
      {confirmWeek && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmWeek(null); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "90%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D", margin: "0 0 8px" }}>Delete entire week?</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px" }}>
              This will permanently delete all {grouped[confirmWeek]?.length} work orders for the week of {formatWeek(confirmWeek)}. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDeleteWeek(confirmWeek)} style={{ padding: "8px 20px", background: "#E24B4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>Yes, delete all</button>
              <button onClick={() => setConfirmWeek(null)} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 2px" }}>Work Orders</h3>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Track weekly work orders and defects. This drives Quality and Performance calculations.</p>
        </div>
        <button onClick={openModal} style={{ padding: "8px 16px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          + Add Work Orders
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 20 }}>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Trucks Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: lastWeek.length >= 14 ? "#1D9E75" : "#A32D2D" }}>{lastWeek.length}</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>Target: <span style={{ fontWeight: 500, color: "#555" }}>14–18</span></p>
          </div>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Defect-Free Trucks</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: defectFreeCount === lastWeek.length && lastWeek.length > 0 ? "#1D9E75" : "#854F0B" }}>{defectFreeCount} / {lastWeek.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>DPU Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: dpuColor }}>{dpuArrow}{dpuDisplay}</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>Prev: <span style={{ fontWeight: 500, color: "#555" }}>{prevDpuRaw !== null ? prevDpuRaw.toFixed(2) : "—"}</span></p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: "10px 14px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 12 }}>
          {successMsg}
        </div>
      )}

      {/* HISTORY TOGGLE */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showHistory ? 16 : 0 }}>
        <button onClick={() => setShowHistory(prev => !prev)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", background: "#fafafa",
          border: "0.5px solid #eee", borderRadius: 8,
          fontSize: 13, fontWeight: 500, color: "#555",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          {showHistory ? "▲" : "▼"} Work order history
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({sortedWeeks.length} week{sortedWeeks.length !== 1 ? "s" : ""})</span>
        </button>
        {showHistory && (
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", background: "#fff", color: "#555" }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
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
            const newCount    = wos.filter(wo => unreadIds.has(wo.id)).length;

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
              <div key={week} style={{ border: `0.5px solid ${newCount > 0 ? "#E24B4A" : "#eee"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px",
                  background: newCount > 0 ? "#FFF8F8" : isLastWeek ? "#f0faf6" : "#fafafa",
                  borderBottom: isOpen ? "0.5px solid #eee" : "none",
                }}>
                  <button type="button" onClick={() => toggleWeek(week, wos)} style={{
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
                    {newCount > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "#E24B4A", color: "#fff", padding: "1px 5px", borderRadius: 8 }}>
                        {newCount} new
                      </span>
                    )}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: wos.length >= 14 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{wos.length} trucks</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{weekDefects} defects</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: dpuColor2 }}>{dpuLabel} DPU: {weekDpu.toFixed(2)}</span>
                    <button onClick={() => setConfirmWeek(week)} style={{ width: 22, height: 22, border: "0.5px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#aaa", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    <span onClick={() => toggleWeek(week, wos)} style={{ fontSize: 12, color: "#555", fontWeight: 500, background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>
                      {isOpen ? "▲ Hide" : "▼ Show"}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Work order</th>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Truck type</th>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Defects</th>
                        <th style={{ padding: "7px 16px", fontWeight: 500, color: "#555" }}>Breakdown</th>
                        <th style={{ padding: "7px 16px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wos.map(wo => (
                        <>
                          <tr key={wo.id} style={{ borderBottom: "0.5px solid #f5f5f5", background: "white" }}>
                            <td style={{ padding: "6px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {editingId === wo.id ? (
                                  <input type="text" maxLength={6} value={editValues.work_order_num}
                                    onChange={e => setEditValues(prev => ({ ...prev, work_order_num: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) }))}
                                    style={{ ...inputStyle, width: 100 }} />
                                ) : wo.work_order_num}
              
                              </div>
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId === wo.id ? (
                                <select value={editValues.truck_type} onChange={e => setEditValues(prev => ({ ...prev, truck_type: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
                                  <option value="">Select…</option>
                                  {truckTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                              ) : (
                                <span style={{ fontSize: 12, background: "#f0f0f0", color: "#555", padding: "2px 8px", borderRadius: 6 }}>{wo.truck_type}</span>
                              )}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId === wo.id ? (
                                <input type="number" min="0" value={editValues.total_defects} onChange={e => setEditValues(prev => ({ ...prev, total_defects: e.target.value }))} style={{ ...inputStyle, width: 70 }} />
                              ) : wo.total_defects}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId !== wo.id && (
                                <button onClick={() => toggleWO(wo.id)} style={{ padding: "2px 8px", fontSize: 11, border: "0.5px solid #ddd", borderRadius: 6, background: "#fff", color: "#555", cursor: "pointer", fontFamily: "inherit" }}>
                                  {expandedWO[wo.id] ? "▲ Hide" : "▼ Show"}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                {editingId === wo.id ? (
                                  <>
                                    <button onClick={() => saveEdit(wo)} style={{ padding: "3px 10px", fontSize: 11, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, cursor: "pointer" }}>Save</button>
                                    <button onClick={() => { setEditingId(null); setEditValues({}); }} style={{ padding: "3px 8px", fontSize: 11, border: "0.5px solid #ddd", background: "#fff", color: "#888", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(wo)} style={{ padding: "3px 10px", fontSize: 11, border: "1px solid #378ADD", background: "#E6F1FB", color: "#0C447C", borderRadius: 6, cursor: "pointer" }}>Edit</button>
                                    <button onClick={() => handleDelete(wo.id)} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D", borderRadius: 6, cursor: "pointer" }}>Delete</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedWO[wo.id] && (
                            <tr key={`${wo.id}-defects`}>
                              <td colSpan={5} style={{ padding: "0 16px 10px 32px", background: "#fafafa" }}>
                                {woDefects[wo.id] && woDefects[wo.id].length > 0 ? (
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left" }}>Defect type</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left" }}>Quantity</th>
                                        <th style={{ width: 40 }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {woDefects[wo.id].map(d => (
                                        <tr key={d.id}>
                                          <td style={{ padding: "4px 8px", color: "#333" }}>{d.defect_type_name}</td>
                                          <td style={{ padding: "4px 8px", color: "#333" }}>{d.quantity}</td>
                                          <td style={{ padding: "4px 8px" }}>
                                            <button onClick={async () => {
                                              await deleteWorkOrderDefect(wo.id, d.id);
                                              loadWODefects(wo.id);
                                              load();
                                              if (onSaved) onSaved();
                                            }} style={{ padding: "2px 6px", fontSize: 10, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, cursor: "pointer" }}>✕</button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p style={{ fontSize: 12, color: "#aaa", margin: "8px 0", fontStyle: "italic" }}>No defect breakdown recorded.</p>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
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