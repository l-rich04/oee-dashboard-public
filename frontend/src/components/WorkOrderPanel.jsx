import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line, Cell,
} from "recharts";

import React, { useState, useEffect, useMemo, useRef } from "react";

import {
  getWorkOrders, createWorkOrder, deleteWorkOrder,
  getTruckTypes, getDefectTypes,
  getWorkOrderDefects, addWorkOrderDefect, deleteWorkOrderDefect,
  getAllDefectBreakdowns, updateWorkOrder,
} from "../api/issues";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

// The backend throws errors as raw JSON text (e.g. {"detail": "..."}).
// This unwraps that into a plain readable string, falling back to the raw
// message if it isn't JSON for some reason.
function extractErrorMessage(err) {
  try {
    const parsed = JSON.parse(err.message);
    return parsed.detail || err.message;
  } catch {
    return err.message || "Something went wrong. Please try again.";
  }
}

function formatWeekRange(weekStart) {
  const start = new Date(weekStart + "T12:00:00");
  const end   = new Date(start);
  end.setDate(end.getDate() + 4);
  const startStr = start.toLocaleDateString([], { month: "numeric", day: "numeric" });
  const endStr   = end.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
  return `${startStr} - ${endStr}`;
}

const CHART_COLORS = ["#1D9E75", "#378ADD", "#E24B4A", "#854F0B", "#533AB7", "#0F6E56", "#A32D2D", "#0C447C"];

let nextId = 1;

function emptyWORow(id) {
  return { id, work_order_num: "", truck_type_id: "", defect_rows: [{ id: nextId++, defect_type_id: "", quantity: 1 }] };
}

function emptyDefectRow() {
  return { id: nextId++, defect_type_id: "", quantity: 1 };
}



export default function WorkOrderPanel({ onSaved, unreadIds = new Set(), onMarkRead, jumpToWorkOrderId = null, onJumpHandled }) {
  const today = new Date();

  const [workOrders, setWorkOrders]               = useState([]);
  const [truckTypes, setTruckTypes]               = useState([]);
  const [defectTypes, setDefectTypes]             = useState([]);
  const [allDefects, setAllDefects]               = useState([]);
  const [showModal, setShowModal]                 = useState(false);
  const [showHistory, setShowHistory]             = useState(false);
  const [chartPeriod, setChartPeriod]             = useState("quarter");
  const [chartYear, setChartYear]                 = useState(today.getFullYear());
  const [chartMonth, setChartMonth]               = useState(today.getMonth());
  const [chartQuarter, setChartQuarter]           = useState(Math.floor(today.getMonth() / 3));
  const [chartTruckType, setChartTruckType]       = useState("all");
  const [weekStart, setWeekStart]                 = useState(getWeekStart());
  const [woRows, setWoRows]                       = useState([emptyWORow(nextId++)]);
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState(null);
  const [successMsg, setSuccessMsg]               = useState(null);
  const [expandedWeeks, setExpanded]              = useState({});
  const [expandedWO, setExpandedWO]               = useState({});
  const [woDefects, setWoDefects]                 = useState({});
  const [editingId, setEditingId]                 = useState(null);
  const [editValues, setEditValues]               = useState({});
  const [confirmWeek, setConfirmWeek]             = useState(null);
  const [selectedYear, setSelectedYear]           = useState(today.getFullYear());
  const [editingDefectId, setEditingDefectId]     = useState(null);
  const [editDefectValues, setEditDefectValues]   = useState({});
  const [addingDefectWoId, setAddingDefectWoId]   = useState(null);
  const [newDefectRow, setNewDefectRow]           = useState({ defect_type_id: "", quantity: 1 });
  const [defectSaving, setDefectSaving]           = useState(false);
  const [confirmDeleteYear, setConfirmDeleteYear] = useState(false);
  const [deletingYear, setDeletingYear]           = useState(false);
  const [markingWeekRead, setMarkingWeekRead]     = useState(null);
  const [highlightedWoId, setHighlightedWoId]     = useState(null);

  // Ref-based locks — these update instantly (no waiting for a re-render),
  // unlike the `saving`/`defectSaving` state flags, which only block the *next*
  // render's disabled button, not a second click that lands before React repaints.
  const submitLockRef     = useRef(false);
  const addDefectLockRef  = useRef(false);
  const editDefectLockRef = useRef(false);

  async function load() {
    const data = await getWorkOrders();
    setWorkOrders(data);
  }

  async function loadTypes() {
    const [tt, dt] = await Promise.all([getTruckTypes(), getDefectTypes()]);
    setTruckTypes(tt);
    setDefectTypes(dt);
  }

  async function loadAllDefects() {
    try {
      const data = await getAllDefectBreakdowns();
      setAllDefects(data);
    } catch (err) {
      console.error("Failed to load defect breakdowns:", err);
    }
  }

  useEffect(() => { load(); loadTypes(); loadAllDefects(); }, []);

  // Auto-jump to most recent year if selected year gets deleted
  useEffect(() => {
    if (workOrders.length === 0) return;
    const years = [...new Set(workOrders.map(wo => new Date(wo.week_start + "T12:00:00").getFullYear()))].sort((a, b) => b - a);
    if (!years.includes(selectedYear)) setSelectedYear(years[0]);
  }, [workOrders]);

  // Reacts to a search-result jump — expands the correct year/week, then
  // scrolls to and briefly highlights the exact work order row so there's
  // no ambiguity about which one was searched for, even inside a week with
  // many rows.
  useEffect(() => {
    if (jumpToWorkOrderId == null) return;
    const wo = workOrders.find(w => w.id === jumpToWorkOrderId);
    if (!wo) return;

    setShowHistory(true);
    setSelectedYear(new Date(wo.week_start + "T12:00:00").getFullYear());
    setExpanded(prev => ({ ...prev, [wo.week_start]: true }));
    setHighlightedWoId(wo.id);

    setTimeout(() => {
      document.getElementById(`wo-row-${wo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    setTimeout(() => setHighlightedWoId(null), 2500);

    onJumpHandled?.();
  }, [jumpToWorkOrderId, workOrders]);

  async function loadWODefects(woId) {
    const data = await getWorkOrderDefects(woId);
    setWoDefects(prev => ({ ...prev, [woId]: data }));
  }

  const availableYears = useMemo(() => {
    const years = new Set(workOrders.map(wo => new Date(wo.week_start + "T12:00:00").getFullYear()));
    years.add(today.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [workOrders]);

  const availableChartMonths = useMemo(() => {
    const ms = new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === chartYear).map(d => new Date(d.week_start).getMonth()));
    return [...ms].sort((a, b) => a - b);
  }, [allDefects, chartYear]);

  const availableChartQuarters = useMemo(() => {
    const qs = new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === chartYear).map(d => Math.floor(new Date(d.week_start).getMonth() / 3)));
    return [...qs].sort((a, b) => a - b);
  }, [allDefects, chartYear]);

  function onChartYearChange(year) {
    setChartYear(year);
    if (chartPeriod === "month") {
      const ms = [...new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === year).map(d => new Date(d.week_start).getMonth()))].sort((a, b) => a - b);
      setChartMonth(ms[ms.length - 1] ?? 0);
    } else if (chartPeriod === "quarter") {
      const qs = [...new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === year).map(d => Math.floor(new Date(d.week_start).getMonth() / 3)))].sort((a, b) => a - b);
      setChartQuarter(qs[qs.length - 1] ?? 0);
    }
  }

  function onChartPeriodChange(p) {
    setChartPeriod(p);
    if (p === "month") {
      const ms = [...new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === chartYear).map(d => new Date(d.week_start).getMonth()))].sort((a, b) => a - b);
      setChartMonth(ms[ms.length - 1] ?? today.getMonth());
    } else if (p === "quarter") {
      const qs = [...new Set(allDefects.filter(d => new Date(d.week_start).getFullYear() === chartYear).map(d => Math.floor(new Date(d.week_start).getMonth() / 3)))].sort((a, b) => a - b);
      setChartQuarter(qs[qs.length - 1] ?? Math.floor(today.getMonth() / 3));
    }
  }

  function matchesPeriod(weekStr) {
    const d  = new Date(weekStr);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    if (chartPeriod === "week")    return weekStr >= getLastWeekStart();
    if (chartPeriod === "month")   return yr === chartYear && mo === chartMonth;
    if (chartPeriod === "quarter") return yr === chartYear && Math.floor(mo / 3) === chartQuarter;
    if (chartPeriod === "year")    return yr === chartYear;
    return true;
  }

  const filteredDefects = useMemo(() => {
    return allDefects.filter(d => matchesPeriod(d.week_start) && (chartTruckType === "all" || d.truck_type === chartTruckType));
  }, [allDefects, chartPeriod, chartYear, chartMonth, chartQuarter, chartTruckType]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => matchesPeriod(wo.week_start) && (chartTruckType === "all" || wo.truck_type === chartTruckType));
  }, [workOrders, chartPeriod, chartYear, chartMonth, chartQuarter, chartTruckType]);

  const pieData = useMemo(() => {
    const totals = {};
    filteredDefects.forEach(d => { totals[d.defect_type] = (totals[d.defect_type] || 0) + d.quantity; });
    return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredDefects]);

  const paretoData = useMemo(() => {
    const total = pieData.reduce((s, d) => s + d.value, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return pieData.map((d, i) => {
      cumulative += d.value;
      return { name: d.name, count: d.value, pct: Math.round((d.value / total) * 100), cumPct: Math.round((cumulative / total) * 100), fill: CHART_COLORS[i % CHART_COLORS.length], eightyLine: 80 };
    });
  }, [pieData]);

  const barData = useMemo(() => {
    const byWeek = {};
    filteredDefects.forEach(d => {
      if (!byWeek[d.week_start]) byWeek[d.week_start] = {};
      byWeek[d.week_start][d.defect_type] = (byWeek[d.week_start][d.defect_type] || 0) + d.quantity;
    });
    const allTypes = [...new Set(filteredDefects.map(d => d.defect_type))];
    return Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b)).map(([week, counts]) => ({
      week: new Date(week + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }),
      ...allTypes.reduce((acc, t) => ({ ...acc, [t]: counts[t] || 0 }), {}),
    }));
  }, [filteredDefects]);

  const barTypes = useMemo(() => [...new Set(filteredDefects.map(d => d.defect_type))], [filteredDefects]);

  function openModal() { setWoRows([emptyWORow(nextId++)]); setWeekStart(getWeekStart()); setError(null); setShowModal(true); }
  function closeModal() { setShowModal(false); setWoRows([emptyWORow(nextId++)]); setError(null); }

  function toggleWeek(week) {
    // Expanding a week no longer auto-marks its work orders as read.
    // Read state now only changes via the explicit "Mark Read" button in
    // the week header — so opening a week to glance at it (or to grab a
    // screenshot) can't silently clear its "NEW" badge before you've
    // actually acknowledged it.
    setExpanded(prev => ({ ...prev, [week]: !prev[week] }));
  }

  async function markWeekRead(week, wos) {
    if (!onMarkRead) return;
    const unread = wos.filter(wo => unreadIds.has(wo.id));
    if (unread.length === 0) return;
    setMarkingWeekRead(week);
    try {
      for (const wo of unread) await onMarkRead(wo.id);
    } finally {
      setMarkingWeekRead(null);
    }
  }

  function toggleWO(woId) {
    setExpandedWO(prev => {
      const next = { ...prev, [woId]: !prev[woId] };
      if (next[woId]) loadWODefects(woId);
      return next;
    });
  }

  function updateWORow(id, field, value) { setWoRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value })); }
  function addDefectRow(woId) { setWoRows(prev => prev.map(r => r.id !== woId ? r : { ...r, defect_rows: [...r.defect_rows, emptyDefectRow()] })); }
  function removeDefectRow(woId, defectRowId) { setWoRows(prev => prev.map(r => r.id !== woId ? r : { ...r, defect_rows: r.defect_rows.filter(d => d.id !== defectRowId) })); }
  function updateDefectRow(woId, defectRowId, field, value) { setWoRows(prev => prev.map(r => r.id !== woId ? r : { ...r, defect_rows: r.defect_rows.map(d => d.id !== defectRowId ? d : { ...d, [field]: value }) })); }
  function addWORow() { setWoRows(prev => [...prev, emptyWORow(nextId++)]); }
  function removeWORow(id) { if (woRows.length === 1) return; setWoRows(prev => prev.filter(r => r.id !== id)); }
  function calcTotal(defect_rows) { return defect_rows.filter(d => d.defect_type_id).reduce((sum, d) => sum + (Number(d.quantity) || 1), 0); }
  function isValidWO(row) { return row.work_order_num.length >= 6 && row.truck_type_id !== ""; }

  const validRows           = woRows.filter(isValidWO);
  const readyCount          = validRows.length;
  const totalDefectsPreview = woRows.reduce((sum, r) => sum + calcTotal(r.defect_rows), 0);
  const dpuPreview          = readyCount > 0 ? (totalDefectsPreview / readyCount).toFixed(2) : "—";

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0 || submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true); setError(null);
    try {
      for (const row of validRows) {
        const total     = calcTotal(row.defect_rows);
        const truckName = truckTypes.find(t => t.id === Number(row.truck_type_id))?.name ?? "n/a";
        const wo = await createWorkOrder({ work_order_num: row.work_order_num, truck_type: truckName, units_completed: 1, total_defects: 0, week_start: weekStart });
        for (const d of row.defect_rows) {
          if (d.defect_type_id) await addWorkOrderDefect(wo.id, Number(d.defect_type_id), Number(d.quantity) || 1);
        }
      }
      setSuccessMsg(`${readyCount} work order${readyCount > 1 ? "s" : ""} added.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      closeModal(); load(); loadAllDefects();
      if (onSaved) onSaved();
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); submitLockRef.current = false; }
  }

  async function handleDelete(id) { await deleteWorkOrder(id); load(); loadAllDefects(); if (onSaved) onSaved(); }

  async function handleDeleteWeek(week) {
    const wos = grouped[week] ?? [];
    await Promise.all(wos.map(wo => deleteWorkOrder(wo.id)));
    setConfirmWeek(null); load(); loadAllDefects();
    if (onSaved) onSaved();
  }

  async function handleDeleteYear() {
    setDeletingYear(true);
    try {
      const wosToDelete = sortedWeeks.flatMap(w => grouped[w]);
      await Promise.all(wosToDelete.map(wo => deleteWorkOrder(wo.id)));
      setConfirmDeleteYear(false);
      load();
      loadAllDefects();
      if (onSaved) onSaved();
    } finally {
      setDeletingYear(false);
    }
  }

  function handlePrintWeek(week, wos) {
    const totalDef = wos.reduce((sum, wo) => sum + wo.total_defects, 0);
    const dpu      = wos.length > 0 ? (totalDef / wos.length).toFixed(2) : "0.00";
    const rowsHtml = wos.map(wo => `<tr><td>${wo.work_order_num}</td><td>${wo.total_defects}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Weekly Defect Sheet - ${formatWeek(week)}</title><style>@page{margin:0.6in}body{font-family:Arial,sans-serif;color:#111;margin:0}h1{font-size:16px;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #333;padding:6px 12px;font-size:13px;text-align:left}th{background:#f0f0f0}td:last-child,th:last-child{text-align:center;width:160px}.dpu{font-size:15px;font-weight:bold;margin-top:8px}</style></head><body><h1>WEEK: ${formatWeekRange(week)}</h1><table><thead><tr><th>WORK ORDER NUMBER</th><th>NUMBER OF DEFECTS</th></tr></thead><tbody>${rowsHtml}</tbody></table><p class="dpu">DPU&nbsp;&nbsp;${dpu}</p></body></html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { alert("Please allow popups to print."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    w.onload = () => w.print();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
  }

  function startEdit(wo) {
    setError(null);
    setEditingId(wo.id);
    // Older work orders can have a truck_type like "n/a" that isn't a real
    // option in the dropdown anymore. If we preload that mismatched value,
    // the <select> visually falls back to showing its first option while
    // React still thinks "n/a" is selected — so clicking that first option
    // does nothing (no real change), and you have to pick something else
    // first before picking the one you actually wanted. Leaving it blank
    // when invalid avoids that trap entirely.
    const validTruckType = truckTypes.some(t => t.name === wo.truck_type) ? wo.truck_type : "";
    setEditValues({
      work_order_num: wo.work_order_num,
      truck_type:     validTruckType,
      total_defects:  wo.total_defects,
    });
  }

  async function saveEdit(wo) {
    const truckToSave = editValues.truck_type || wo.truck_type;
    if (!truckToSave) {
      setError("Please select a truck type before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateWorkOrder(wo.id, {
        work_order_num: editValues.work_order_num,
        truck_type:     truckToSave,
      });
      setEditingId(null);
      setEditValues({});
      setSuccessMsg("Work order updated.");
      setTimeout(() => setSuccessMsg(null), 3000);
      load();
      if (onSaved) onSaved();
    } catch (err) {
      console.error("saveEdit error:", err);
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditDefect(d) { setEditingDefectId(d.id); setEditDefectValues({ defect_type_id: String(d.defect_type_id), quantity: d.quantity }); }

  async function saveEditDefect(woId, defectId) {
    if (editDefectLockRef.current) return;
    editDefectLockRef.current = true;
    setDefectSaving(true);
    try {
      await deleteWorkOrderDefect(woId, defectId);
      await addWorkOrderDefect(woId, Number(editDefectValues.defect_type_id), Number(editDefectValues.quantity) || 1);
      setEditingDefectId(null); setEditDefectValues({});
      const defects = await getWorkOrderDefects(woId);
      setWoDefects(prev => ({ ...prev, [woId]: defects }));
      const orders = await getWorkOrders();
      setWorkOrders(orders);
      loadAllDefects();
    } finally { setDefectSaving(false); editDefectLockRef.current = false; }
  }

  async function handleAddDefect(woId) {
    if (!newDefectRow.defect_type_id || addDefectLockRef.current) return;
    addDefectLockRef.current = true;
    setDefectSaving(true);
    try {
      await addWorkOrderDefect(woId, Number(newDefectRow.defect_type_id), newDefectRow.quantity);
      setAddingDefectWoId(null); setNewDefectRow({ defect_type_id: "", quantity: 1 });
      const defects = await getWorkOrderDefects(woId);
      setWoDefects(prev => ({ ...prev, [woId]: defects }));
      const orders = await getWorkOrders();
      setWorkOrders(orders);
      loadAllDefects();
    } finally { setDefectSaving(false); addDefectLockRef.current = false; }
  }

  async function handleDeleteDefect(woId, defectId) {
    await deleteWorkOrderDefect(woId, defectId);
    const defects = await getWorkOrderDefects(woId);
    setWoDefects(prev => ({ ...prev, [woId]: defects }));
    const orders = await getWorkOrders();
    setWorkOrders(orders);
    loadAllDefects();
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
  const sortedWeeks   = allSortedKeys.filter(w => new Date(w + "T12:00:00").getFullYear() === selectedYear);
  const prevWeekKey   = allSortedKeys[1];
  const prevWos       = prevWeekKey ? workOrders.filter(wo => wo.week_start === prevWeekKey) : [];
  const prevDpuRaw    = prevWos.length > 0 ? prevWos.reduce((sum, wo) => sum + wo.total_defects, 0) / prevWos.length : null;

  const dpuColor = dpuRaw === null ? "#aaa" : prevDpuRaw !== null && dpuRaw < prevDpuRaw ? "#1D9E75" : prevDpuRaw !== null && dpuRaw > prevDpuRaw ? "#A32D2D" : "#888";
  const dpuArrow = dpuRaw === null ? "" : prevDpuRaw !== null && dpuRaw < prevDpuRaw ? "↓ " : prevDpuRaw !== null && dpuRaw > prevDpuRaw ? "↑ " : "→ ";
  const totalFiltered = filteredDefects.reduce((sum, d) => sum + d.quantity, 0);

  function CustomBar(props) {
    const { x, y, width, height, fill } = props;
    return <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />;
  }

  const ParetoTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>{label}</p>
        <p style={{ margin: "0 0 2px", color: "#378ADD" }}>Count: <strong>{d?.count}</strong></p>
        <p style={{ margin: "0 0 2px", color: "#555" }}>Share: {d?.pct}%</p>
        <p style={{ margin: 0, color: "#E24B4A" }}>Cumulative: {d?.cumPct}%</p>
      </div>
    );
  };

  const vitalFew = useMemo(() => {
    if (paretoData.length === 0) return null;
    const idx = paretoData.findIndex(d => d.cumPct > 80);
    const vital = idx === -1 ? paretoData : paretoData.slice(0, idx + 1);
    if (vital.length === paretoData.length) return null;
    return { names: vital.map(d => d.name), cumPct: vital[vital.length - 1].cumPct };
  }, [paretoData]);

  const subSelectStyle = { padding: "4px 8px", fontSize: 11, border: "1px solid #eee", borderRadius: 6, fontFamily: "inherit", background: "#fff", color: "#555" };

  const filterBtnStyle = (active, color = "#1D9E75", bg = "#E1F5EE", tc = "#0F6E56") => ({
    padding: "5px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${active ? color : "#ddd"}`,
    background: active ? bg : "#fff",
    color: active ? tc : "#555",
  });

  const periodLabel = chartPeriod === "week" ? "Last week"
    : chartPeriod === "month"   ? `${MONTHS[chartMonth]} ${chartYear}`
    : chartPeriod === "quarter" ? `Q${chartQuarter + 1} ${chartYear}`
    : `${chartYear}`;

  return (
    <div style={{ marginBottom: 24 }}>

      {/* ADD MODAL */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "90%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Add Work Orders</p>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "10px 14px", background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>Week starting</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#888" }}>All entries saved under this week</span>
            </div>
            <form onSubmit={handleSubmit}>
              {woRows.map(row => (
                <div key={row.id} style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #eee" }}>
                    <input type="text" value={row.work_order_num} onChange={e => updateWORow(row.id, "work_order_num", e.target.value.toUpperCase())} placeholder="Work order #" style={{ ...inputStyle, width: 150 }} />
                    <select value={row.truck_type_id} onChange={e => updateWORow(row.id, "truck_type_id", e.target.value)} style={{ ...inputStyle, width: 140 }}>
                      <option value="">Truck type…</option>
                      {truckTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, background: "#E6F1FB", color: "#0C447C", padding: "2px 8px", borderRadius: 8 }}>{calcTotal(row.defect_rows)} defects</span>
                    {woRows.length > 1 && <button type="button" onClick={() => removeWORow(row.id)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>✕</button>}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11 }}>Defect type</th>
                        <th style={{ padding: "6px 8px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11, width: 70 }}>Qty</th>
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
                          <td style={{ padding: "6px 8px" }}>
                            <input type="number" min="1" value={dr.quantity} onChange={e => updateDefectRow(row.id, dr.id, "quantity", Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 60 }} />
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            {row.defect_rows.length > 1 && <button type="button" onClick={() => removeDefectRow(row.id, dr.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#aaa" }}>✕</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={() => addDefectRow(row.id)} style={{ margin: "8px 14px", padding: "4px 10px", fontSize: 11, border: "0.5px dashed #ddd", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit" }}>+ add defect type</button>
                </div>
              ))}
              <button type="button" onClick={addWORow} style={{ width: "100%", padding: "8px", fontSize: 12, border: "0.5px dashed #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>+ add another work order</button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "0.5px solid #eee" }}>
                <span style={{ fontSize: 12, color: "#888" }}>{readyCount === 0 ? "Complete work order # and truck type to submit" : `${readyCount} work order${readyCount !== 1 ? "s" : ""} · ${totalDefectsPreview} defects · DPU preview: ${dpuPreview}`}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={closeModal} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button type="submit" disabled={readyCount === 0 || saving} style={{ padding: "8px 20px", background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: readyCount > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
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
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmWeek(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "90%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D", margin: "0 0 8px" }}>Delete entire week?</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px" }}>This will permanently delete all {grouped[confirmWeek]?.length} work orders for the week of {formatWeek(confirmWeek)}. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDeleteWeek(confirmWeek)} style={{ padding: "8px 20px", background: "#E24B4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>Yes, delete all</button>
              <button onClick={() => setConfirmWeek(null)} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE YEAR MODAL */}
      {confirmDeleteYear && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteYear(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "90%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D", margin: "0 0 8px" }}>Delete all {selectedYear} work orders?</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px" }}>This will permanently delete all {sortedWeeks.reduce((sum, w) => sum + (grouped[w]?.length ?? 0), 0)} work orders across {sortedWeeks.length} weeks in {selectedYear}. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDeleteYear} disabled={deletingYear} style={{ padding: "8px 20px", background: "#E24B4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit", opacity: deletingYear ? 0.6 : 1 }}>
                {deletingYear ? "Deleting…" : "Yes, delete all"}
              </button>
              <button onClick={() => setConfirmDeleteYear(false)} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
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
        <button onClick={openModal} style={{ padding: "8px 16px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ Add Work Orders</button>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 20 }}>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Trucks Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: lastWeek.length >= 14 ? "#1D9E75" : "#A32D2D" }}>{lastWeek.length}</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last Week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>Target: <span style={{ fontWeight: 500, color: "#555" }}>14–18</span></p>
          </div>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Defect-Free Trucks</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: defectFreeCount === lastWeek.length && lastWeek.length > 0 ? "#1D9E75" : "#854F0B" }}>{defectFreeCount} / {lastWeek.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last Week</p>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>DPU Last Week</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: dpuColor }}>{dpuArrow}{dpuDisplay}</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last Week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>Prev: <span style={{ fontWeight: 500, color: "#555" }}>{prevDpuRaw !== null ? prevDpuRaw.toFixed(2) : "—"}</span></p>
          </div>
        </div>
      </div>

      {successMsg && <div style={{ padding: "10px 14px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 12 }}>{successMsg}</div>}
      {error && <div style={{ padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 13, color: "#A32D2D", marginBottom: 12 }}>{error}</div>}

      {/* DEFECT CHARTS */}
      <div style={{ border: "0.5px solid #eee", borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: 0 }}>
            Defect Type Analysis
            {totalFiltered > 0 && <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>({totalFiltered} total defects · {periodLabel})</span>}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ key: "week", label: "Last week" }, { key: "month", label: "Month" }, { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }].map(p => (
                <button key={p.key} onClick={() => onChartPeriodChange(p.key)} style={filterBtnStyle(chartPeriod === p.key)}>{p.label}</button>
              ))}
            </div>
            {chartPeriod !== "week" && availableYears.length > 1 && (
              <select value={chartYear} onChange={e => onChartYearChange(Number(e.target.value))} style={subSelectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {chartPeriod === "month" && availableChartMonths.length > 0 && (
              <select value={chartMonth} onChange={e => setChartMonth(Number(e.target.value))} style={subSelectStyle}>
                {availableChartMonths.map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
              </select>
            )}
            {chartPeriod === "quarter" && availableChartQuarters.length > 0 && (
              <select value={chartQuarter} onChange={e => setChartQuarter(Number(e.target.value))} style={subSelectStyle}>
                {availableChartQuarters.map(q => <option key={q} value={q}>Q{q + 1}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setChartTruckType("all")} style={filterBtnStyle(chartTruckType === "all", "#378ADD", "#E6F1FB", "#0C447C")}>All</button>
              {truckTypes.map(t => (
                <button key={t.id} onClick={() => setChartTruckType(t.name)} style={filterBtnStyle(chartTruckType === t.name, "#378ADD", "#E6F1FB", "#0C447C")}>{t.name}</button>
              ))}
            </div>
          </div>
        </div>

        {pieData.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "40px 0" }}>No defect breakdown data for this period. Add defect types to work orders to see charts.</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: "0 0 4px" }}>Pareto — Defects by Type</p>
                <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>Sorted Most → Least · Cumulative % Line</p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={paretoData} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} height={48} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ParetoTooltip />} />
                    <Bar yAxisId="left" dataKey="count" name="Count" shape={<CustomBar />} />
                    <Line yAxisId="right" type="monotone" dataKey="cumPct"     name="Cumulative %" stroke="#E24B4A" strokeWidth={2} dot={{ r: 3, fill: "#E24B4A" }} />
                    <Line yAxisId="right" type="monotone" dataKey="eightyLine" name="80% Threshold" stroke="#aaa" strokeWidth={1} strokeDasharray="5 4" dot={false} legendType="line" />
                  </ComposedChart>
                </ResponsiveContainer>
                {vitalFew && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8, fontSize: 11, color: "#0F6E56" }}>
                    <strong>Vital few:</strong> {vitalFew.names.join(", ")} account for {vitalFew.cumPct}% of all defects this period.
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#378ADD", display: "inline-block" }} />Count</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#E24B4A", display: "inline-block" }} />Cumulative %</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, borderTop: "2px dashed #aaa", display: "inline-block" }} />80% Threshold</span>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: "0 0 4px" }}>DPU by Truck Type</p>
                <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>AVG Defects per Unit — {periodLabel}</p>
                {(() => {
                  const byTruck = {};
                  filteredWorkOrders.forEach(wo => {
                    if (!byTruck[wo.truck_type]) byTruck[wo.truck_type] = { defects: 0, count: 0 };
                    byTruck[wo.truck_type].defects += wo.total_defects;
                    byTruck[wo.truck_type].count   += 1;
                  });
                  const dpuByTruck = Object.entries(byTruck)
                    .filter(([name]) => name && name !== "n/a")
                    .map(([name, d]) => ({ name, dpu: Math.round((d.defects / d.count) * 100) / 100, count: d.count }))
                    .sort((a, b) => b.dpu - a.dpu);
                  if (dpuByTruck.length === 0) return <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", paddingTop: 80 }}>No data for this period.</p>;
                  const maxDpu = Math.max(...dpuByTruck.map(d => d.dpu));
                  const DpuTooltip = ({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>{label}</p>
                        <p style={{ margin: "0 0 2px", color: "#378ADD" }}>DPU: <strong>{d?.dpu}</strong></p>
                        <p style={{ margin: 0, color: "#888" }}>{d?.count} work order{d?.count !== 1 ? "s" : ""}</p>
                      </div>
                    );
                  };
                  return (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={dpuByTruck} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(2)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip content={<DpuTooltip />} />
                        <Bar dataKey="dpu" name="DPU" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 10, fill: "#888", formatter: v => v.toFixed(2) }}>
                          {dpuByTruck.map((entry) => (
                            <Cell key={entry.name} fill={entry.dpu > maxDpu * 0.66 ? "#E24B4A" : entry.dpu > maxDpu * 0.33 ? "#854F0B" : "#1D9E75"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
                <p style={{ fontSize: 10, color: "#aaa", margin: "6px 0 0" }}>Green = Lowest DPU · Amber = Moderate · Red = Highest DPU</p>
              </div>
            </div>

            <div>
              {(() => {
                const byTruck = {};
                filteredWorkOrders.forEach(wo => {
                  byTruck[wo.truck_type] = (byTruck[wo.truck_type] || 0) + 1;
                });
                const rawCounts = Object.entries(byTruck)
                  .filter(([name]) => name && name !== "n/a")
                  .map(([name, count]) => ({ name, count }))
                  .sort((a, b) => b.count - a.count);
                const totalTrucks = rawCounts.reduce((sum, t) => sum + t.count, 0);
                const truckCounts = rawCounts.map(t => ({
                  ...t,
                  pct: totalTrucks > 0 ? Math.round((t.count / totalTrucks) * 100) : 0,
                }));

                return (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: "0 0 12px" }}>
                      Trucks Produced by Type
                      {totalTrucks > 0 && (
                        <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>
                          ({totalTrucks} total truck{totalTrucks !== 1 ? "s" : ""} · {periodLabel})
                        </span>
                      )}
                    </p>
                    {truckCounts.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", paddingTop: 40 }}>No data for this period.</p>
                    ) : (() => {
                      const TruckCountTooltip = ({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                            <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>{label}</p>
                            <p style={{ margin: 0, color: "#378ADD" }}>{d?.count} truck{d?.count !== 1 ? "s" : ""} · {d?.pct}% of total</p>
                          </div>
                        );
                      };
                      const CountLabel = (props) => {
                        const { x, y, width, value, index } = props;
                        const entry = truckCounts[index];
                        return (
                          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#555">
                            {value} ({entry?.pct ?? 0}%)
                          </text>
                        );
                      };
                      return (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={truckCounts} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip content={<TruckCountTooltip />} />
                            <Bar dataKey="count" name="Trucks" fill="#378ADD" radius={[3, 3, 0, 0]} label={<CountLabel />} />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </>
                );
              })()}
          
            </div>
          </>
        )}
      </div>

      {/* HISTORY TOGGLE */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showHistory ? 16 : 0 }}>
        <button onClick={() => setShowHistory(prev => !prev)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#555", cursor: "pointer", fontFamily: "inherit" }}>
          {showHistory ? "▲" : "▼"} Work order history
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({sortedWeeks.length} week{sortedWeeks.length !== 1 ? "s" : ""})</span>
        </button>
        {showHistory && (
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", background: "#fff", color: "#555" }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {showHistory && sortedWeeks.length > 0 && (
          <button onClick={() => setConfirmDeleteYear(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            Delete {selectedYear}
          </button>
        )}
      </div>

      {showHistory && sortedWeeks.length === 0 && <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: 24 }}>No work orders for {selectedYear}.</p>}

      {showHistory && (
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {sortedWeeks.map((week, idx) => {
            const wos         = grouped[week];
            const weekDefects = wos.reduce((sum, wo) => sum + wo.total_defects, 0);
            const weekDpu     = wos.length > 0 ? weekDefects / wos.length : 0;
            const newCount    = wos.filter(wo => unreadIds.has(wo.id)).length;
            const prevWeek2   = sortedWeeks[idx + 1];
            const prevWos2    = prevWeek2 ? grouped[prevWeek2] : null;
            const prevDpu2    = prevWos2 ? prevWos2.reduce((sum, wo) => sum + wo.total_defects, 0) / prevWos2.length : null;
            let dpuColor2 = "#888", dpuLabel = "";
            if (prevDpu2 !== null) {
              if (weekDpu < prevDpu2)      { dpuColor2 = "#1D9E75"; dpuLabel = "↓"; }
              else if (weekDpu > prevDpu2) { dpuColor2 = "#A32D2D"; dpuLabel = "↑"; }
              else                         { dpuColor2 = "#888";    dpuLabel = "→"; }
            }
            const isOpen     = expandedWeeks[week];
            const isLastWeek = week === getLastWeekStart();

            return (
              <div key={week} style={{ border: `0.5px solid ${newCount > 0 ? "#E24B4A" : "#eee"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: newCount > 0 ? "#FFF8F8" : isLastWeek ? "#f0faf6" : "#fafafa", borderBottom: isOpen ? "0.5px solid #eee" : "none" }}>
                  <button type="button" onClick={() => toggleWeek(week)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>Week of {formatWeek(week)}</span>
                    {isLastWeek && <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>Last Week</span>}
                    {newCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#E24B4A", color: "#fff", padding: "1px 5px", borderRadius: 8 }}>{newCount} new</span>}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: wos.length >= 14 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{wos.length} trucks</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{weekDefects} defects</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: dpuColor2 }}>{dpuLabel} DPU: {weekDpu.toFixed(2)}</span>
                    {newCount > 0 && onMarkRead && (
                      <button
                        onClick={() => markWeekRead(week, wos)}
                        disabled={markingWeekRead === week}
                        style={{
                          padding: "3px 10px", fontSize: 11, fontWeight: 600,
                          border: "1px solid #D4A017", background: "#FAEEDA", color: "#854F0B",
                          borderRadius: 6, cursor: markingWeekRead === week ? "not-allowed" : "pointer",
                          fontFamily: "inherit", opacity: markingWeekRead === week ? 0.6 : 1,
                        }}
                      >
                        {markingWeekRead === week ? "Marking…" : "Mark Read"}
                      </button>
                    )}
                    <button onClick={() => handlePrintWeek(week, wos)} title="Print weekly defect sheet" style={{ width: 22, height: 22, border: "0.5px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#555", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>🖨</button>
                    <button onClick={() => setConfirmWeek(week)} style={{ width: 22, height: 22, border: "0.5px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#aaa", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    <span onClick={() => toggleWeek(week)} style={{ fontSize: 12, color: "#555", fontWeight: 500, background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>{isOpen ? "▲ Hide" : "▼ Show"}</span>
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
                        <React.Fragment key={wo.id}>
                          <tr id={`wo-row-${wo.id}`} style={{ borderBottom: "0.5px solid #f5f5f5", background: highlightedWoId === wo.id ? "#E6F1FB" : "white", transition: "background 0.4s" }}>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId === wo.id
                                ? <input type="text" value={editValues.work_order_num ?? ""} onChange={e => setEditValues(prev => ({ ...prev, work_order_num: e.target.value.toUpperCase() }))} style={{ ...inputStyle, width: 120 }} />
                                : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {wo.work_order_num}
                                    {unreadIds.has(wo.id) && <span style={{ background: "#E24B4A", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8 }}>NEW</span>}
                                  </div>
                                )}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId === wo.id ? (
                                <select value={editValues.truck_type} onChange={e => setEditValues(prev => ({ ...prev, truck_type: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
                                  <option value="">Select truck type…</option>
                                  {truckTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                              ) : <span style={{ fontSize: 12, background: "#f0f0f0", color: "#555", padding: "2px 8px", borderRadius: 6 }}>{wo.truck_type}</span>}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {wo.total_defects}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              {editingId !== wo.id && <button onClick={() => toggleWO(wo.id)} style={{ padding: "2px 8px", fontSize: 11, border: "0.5px solid #ddd", borderRadius: 6, background: "#fff", color: "#555", cursor: "pointer", fontFamily: "inherit" }}>{expandedWO[wo.id] ? "▲ Hide" : "▼ Show"}</button>}
                            </td>
                            <td style={{ padding: "6px 16px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                {editingId === wo.id ? (
                                  <>
                                    <button onClick={() => saveEdit(wo)} disabled={saving} style={{ padding: "3px 10px", fontSize: 11, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "…" : "Save"}</button>
                                    <button onClick={() => { setEditingId(null); setEditValues({}); setError(null); }} style={{ padding: "3px 8px", fontSize: 11, border: "0.5px solid #ddd", background: "#fff", color: "#888", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
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
                            <tr>
                              <td colSpan={5} style={{ padding: "8px 16px 12px 32px", background: "#fafafa" }}>
                                {woDefects[wo.id] && woDefects[wo.id].length > 0 ? (
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left" }}>Defect type</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left", width: 70 }}>Qty</th>
                                        <th style={{ width: 110 }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {woDefects[wo.id].map(d => (
                                        <tr key={d.id} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                                          <td style={{ padding: "4px 8px", color: "#333" }}>
                                            {editingDefectId === d.id ? (
                                              <select value={editDefectValues.defect_type_id} onChange={e => setEditDefectValues(prev => ({ ...prev, defect_type_id: e.target.value }))} style={{ ...inputStyle, width: "100%" }}>
                                                {defectTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                                              </select>
                                            ) : d.defect_type_name}
                                          </td>
                                          <td style={{ padding: "4px 8px", color: "#333" }}>
                                            {editingDefectId === d.id ? (
                                              <input type="number" min="1" value={editDefectValues.quantity} onChange={e => setEditDefectValues(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))} style={{ ...inputStyle, width: 55 }} />
                                            ) : d.quantity}
                                          </td>
                                          <td style={{ padding: "4px 8px" }}>
                                            {editingDefectId === d.id ? (
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={() => saveEditDefect(wo.id, d.id)} disabled={defectSaving} style={{ padding: "2px 8px", fontSize: 10, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", borderRadius: 4, cursor: "pointer" }}>{defectSaving ? "…" : "Save"}</button>
                                                <button onClick={() => { setEditingDefectId(null); setEditDefectValues({}); }} style={{ padding: "2px 6px", fontSize: 10, border: "0.5px solid #ddd", background: "#fff", color: "#888", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                                              </div>
                                            ) : (
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={() => startEditDefect(d)} style={{ padding: "2px 8px", fontSize: 10, border: "1px solid #378ADD", background: "#E6F1FB", color: "#0C447C", borderRadius: 4, cursor: "pointer" }}>Edit</button>
                                                <button onClick={() => handleDeleteDefect(wo.id, d.id)} style={{ padding: "2px 6px", fontSize: 10, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, cursor: "pointer" }}>Delete</button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 8px", fontStyle: "italic" }}>No defect breakdown recorded.</p>
                                )}
                                {addingDefectWoId === wo.id ? (
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                                    <select value={newDefectRow.defect_type_id} onChange={e => setNewDefectRow(prev => ({ ...prev, defect_type_id: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                                      <option value="">Select defect type…</option>
                                      {defectTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                                    </select>
                                    <input type="number" min="1" value={newDefectRow.quantity} onChange={e => setNewDefectRow(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))} style={{ ...inputStyle, width: 60 }} placeholder="Qty" />
                                    <button onClick={() => handleAddDefect(wo.id)} disabled={defectSaving || !newDefectRow.defect_type_id} style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, cursor: "pointer" }}>{defectSaving ? "…" : "Add"}</button>
                                    <button onClick={() => { setAddingDefectWoId(null); setNewDefectRow({ defect_type_id: "", quantity: 1 }); }} style={{ padding: "4px 8px", fontSize: 11, border: "0.5px solid #ddd", background: "#fff", color: "#888", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setAddingDefectWoId(wo.id); setNewDefectRow({ defect_type_id: "" }); }} style={{ padding: "3px 10px", fontSize: 11, border: "0.5px dashed #ddd", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit" }}>+ add defect type</button>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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