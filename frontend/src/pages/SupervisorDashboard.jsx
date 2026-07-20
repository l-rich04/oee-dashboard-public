import { Helmet } from "react-helmet-async";
import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { getIssues, getSummary, deleteIssue, getOEESummary, getForemen, markIssueRead, exportAll, getWorkOrders, markWorkOrderRead } from "../api/issues";
import IssueStatusBadge from "../components/IssueStatusBadge";
import IssueUpdatePanel from "../components/IssueUpdatePanel";
import IssueEditPanel from "../components/IssueEditPanel";
import MassAddPanel from "../components/MassAddPanel";
import SupervisorLogin from "../components/SupervisorLogin";
import OEEMetrics from "../components/OEEMetrics";
import OEEGoalsPanel from "../components/OEEGoalsPanel";
import WorkOrderPanel from "../components/WorkOrderPanel";
import WeeklyLaborPanel from "../components/WeeklyLaborPanel";
import ForemanManagePanel from "../components/ForemanManagePanel";
import IssuesSummary from "../components/IssuesSummary";
import MorningHuddle from "../components/MorningHuddle";
import SupervisorManagePanel from "../components/SupervisorManagePanel";
import TruckTypeManagePanel from "../components/TruckTypeManagePanel";
import DefectTypeManagePanel from "../components/DefectTypeManagePanel";
import PasswordChangePanel from "../components/PasswordChangePanel";
import IssueCategoryManagePanel from "../components/IssueCategoryManagePanel";

function daysOld(createdAt) {
  const created = new Date(createdAt + "Z");
  const now = new Date();
  const diff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Today";
  return `${diff}d`;
}

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Safe notification helper ─────────────────────────────────────────────────
// IMPORTANT: every desktop notification MUST go through this helper.
// `new Notification(...)` can throw (blocked by OS, permission edge cases,
// browser quirks, etc). Previously these calls were unguarded, which meant a
// thrown error inside load()/loadWorkOrders() would silently abort the rest
// of the async function — including the setIssues()/setWorkOrders() calls
// that update the "NEW" badges. That's why notifications AND the unread
// badges were failing together. Wrapping in try/catch means a notification
// failure can never block a state update again, and errors get logged so
// they're actually visible instead of disappearing silently.
function safeNotify(title, options) {
  try {
    if (typeof Notification === "undefined") return null;
    if (Notification.permission !== "granted") return null;
    const notif = new Notification(title, options);
    notif.onclick = () => { window.focus(); notif.close(); };
    return notif;
  } catch (err) {
    console.error("Notification failed to display:", title, err);
    return null;
  }
}

// ─── Alert banner component ───────────────────────────────────────────────────

function AlertBanner({ alerts, onDismiss, onDismissAll }) {
  if (!alerts || alerts.length === 0) return null;

  const severityStyle = {
    critical: { bg: "#FCEBEB", border: "#F09595", icon: "ti-alert-triangle", iconColor: "#A32D2D", titleColor: "#791F1F", textColor: "#A32D2D", badgeBg: "#F09595", badgeColor: "#501313", label: "Critical" },
    warning:  { bg: "#E1F5EE", border: "#5DCAA5", icon: "ti-alert-circle",   iconColor: "#0F6E56", titleColor: "#085041", textColor: "#0F6E56", badgeBg: "#9FE1CB", badgeColor: "#04342C", label: "Attention" },
    info:     { bg: "#fafafa", border: "#eee",    icon: "ti-clock",           iconColor: "#888",    titleColor: "#333",    textColor: "#888",    badgeBg: "#eee",    badgeColor: "#555",    label: "Info" },
  };

  return (
    <div style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-bell" style={{ fontSize: 15, color: "#888" }} aria-hidden="true" />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>
            {alerts.length} alert{alerts.length !== 1 ? "s" : ""} this week
          </span>
        </div>
        <button onClick={onDismissAll} style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          Dismiss all
        </button>
      </div>
      {alerts.map((alert, i) => {
        const s = severityStyle[alert.severity] ?? severityStyle.info;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < alerts.length - 1 ? "0.5px solid #eee" : "none", background: s.bg }}>
            <i className={`ti ${s.icon}`} style={{ fontSize: 15, color: s.iconColor, flexShrink: 0 }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: s.titleColor, margin: 0 }}>{alert.title}</p>
              {alert.detail && <p style={{ fontSize: 11, color: s.textColor, margin: "2px 0 0" }}>{alert.detail}</p>}
            </div>
            <span style={{ fontSize: 10, background: s.badgeBg, color: s.badgeColor, padding: "2px 7px", borderRadius: 10, fontWeight: 500, whiteSpace: "nowrap" }}>
              {s.label}
            </span>
            <button onClick={() => onDismiss(i)} style={{ fontSize: 13, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1, fontFamily: "inherit" }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alert threshold checker ──────────────────────────────────────────────────

function computeAlerts(oeeSummary, issues) {
  if (!oeeSummary) return [];
  const alerts = [];
  const { goals } = oeeSummary;

  const oeeMin    = Number(goals.alert_oee_min          ?? 60);
  const availMin  = Number(goals.alert_availability_min ?? 50);
  const perfMin   = Number(goals.alert_performance_min  ?? 50);
  const qualMin   = Number(goals.alert_quality_min      ?? 50);
  const staleDays = Number(goals.alert_stale_days       ?? 14);

  if (oeeSummary.oee > 0 && oeeSummary.oee < oeeMin) {
    alerts.push({ severity: "critical", title: `OEE dropped below ${oeeMin}% — this year ${oeeSummary.oee}%`, detail: "Review Availability, Performance, and Quality metrics." });
  }
  if (oeeSummary.availability > 0 && oeeSummary.availability < availMin) {
    alerts.push({ severity: "critical", title: `Availability dropped below ${availMin}% — this year ${oeeSummary.availability}%`, detail: "Review indirect and rework hours." });
  }
  if (oeeSummary.performance > 0 && oeeSummary.performance < perfMin) {
    alerts.push({ severity: "critical", title: `Performance dropped below ${perfMin}% — this year ${oeeSummary.performance}%`, detail: "Truck output is below target." });
  }
  if (oeeSummary.quality > 0 && oeeSummary.quality < qualMin) {
    alerts.push({ severity: "critical", title: `Quality dropped below ${qualMin}% — this year ${oeeSummary.quality}%`, detail: "DPU is above quarterly goal." });
  }
  if (oeeSummary.yearly_dpu > 0 && oeeSummary.yearly_dpu > goals.annual_dpu_goal) {
    alerts.push({ severity: "critical", title: `Yearly DPU exceeded annual goal — ${oeeSummary.yearly_dpu} vs ${goals.annual_dpu_goal} target`, detail: "Review defect breakdown in Work Orders." });
  }
  if (oeeSummary.quarterly_dpu > 0 && oeeSummary.quarterly_dpu > goals.quarterly_dpu_goal) {
    alerts.push({ severity: "critical", title: `Quarterly DPU exceeded goal — ${oeeSummary.quarterly_dpu} vs ${goals.quarterly_dpu_goal} target`, detail: "Review defect breakdown in Work Orders." });
  }

  const staleIssues = issues.filter(i => {
    if (i.status === "solved") return false;
    const days = Math.floor((new Date() - new Date(i.created_at + "Z")) / (1000 * 60 * 60 * 24));
    return days > staleDays;
  });
  if (staleIssues.length > 0) {
    const names = [...new Set(staleIssues.map(i => i.foreman_name))].join(", ");
    alerts.push({ severity: "warning", title: `${staleIssues.length} issue${staleIssues.length !== 1 ? "s" : ""} open longer than ${staleDays} days`, detail: `Foremen: ${names}` });
  }

  return alerts;
}

function getAlertWeekKey() {
  const d = new Date();
  const day  = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return `alerts_notified_${monday.toISOString().split("T")[0]}`;
}

export default function SupervisorDashboard() {
  const [authed, setAuthed]                   = useState(sessionStorage.getItem("supervisor_auth") === "true");
  const [activeTab, setActiveTab]             = useState("issues");
  const [activeOeeTab, setActiveOeeTab]       = useState("overview");
  const [issues, setIssues]                   = useState([]);
  const [summary, setSummary]                 = useState(null);
  const [oeeSummary, setOeeSummary]           = useState(null);
  const [foremen, setForemen]                 = useState([]);
  const [workOrders, setWorkOrders]           = useState([]);
  const [period, setPeriod]                   = useState("ytd");
  const [updating, setUpdating]               = useState(null);
  const [editing, setEditing]                 = useState(null);
  const [checkedIds, setCheckedIds]           = useState(new Set());
  const [toDelete, setToDelete]               = useState(null);
  const [deleteMsg, setDeleteMsg]             = useState(false);
  const [massAdding, setMassAdding]           = useState(false);
  const [expandedForemen, setExpandedForemen] = useState({});
  const [showSolved, setShowSolved]           = useState(false);
  const [huddleOpen, setHuddleOpen]           = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [exporting, setExporting]             = useState(false);
  const [alerts, setAlerts]                   = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  const knownIssueIds       = useRef(null);
  const knownIssueSnapshots = useRef(null);
  const knownWorkOrderIds   = useRef(null);
  const prevAlertTitles     = useRef("");
  // Persistent read state that survives 30s polls AND full page reloads.
  // This is now the ONLY source of truth for "did I mark this read" — there
  // is no more "treat everything as read on first load" special case, since
  // that used to silently override this persisted state the moment the page
  // loaded, hiding genuinely unread items right when you'd want to see them.
  const readIssueIds     = useRef(new Set(JSON.parse(localStorage.getItem("readIssueIds") || "[]")));
  const readWorkOrderIds = useRef(new Set(JSON.parse(localStorage.getItem("readWorkOrderIds") || "[]")));

  useEffect(() => {
    if (!authed) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then(perm => setNotifPermission(perm));
    }
  }, [authed]);

  useEffect(() => {
    if (!oeeSummary) return;
    const computed = computeAlerts(oeeSummary, issues);
    const newTitles = computed.map(a => a.title).join("|");

    if (newTitles !== prevAlertTitles.current) {
      prevAlertTitles.current = newTitles;
      setDismissedAlerts(new Set());

      if (Notification.permission === "granted" && computed.length > 0) {
        const weekKey = getAlertWeekKey();
        const alreadyNotified = sessionStorage.getItem(weekKey);
        if (!alreadyNotified) {
          computed.forEach((alert, i) => {
            setTimeout(() => {
              safeNotify(alert.severity === "critical" ? "Dashboard Alert" : "Dashboard Notice", {
                body: alert.title,
                icon: "/favicon.svg",
                badge: "/favicon.svg",
                tag: `alert-${weekKey}-${i}`,
              });
            }, i * 800);
          });
          sessionStorage.setItem(weekKey, "1");
        }
      }
    }

    setAlerts(computed);
  }, [oeeSummary, issues]);

  const visibleAlerts = alerts.filter((_, i) => !dismissedAlerts.has(i));

  function dismissAlert(idx) {
    setDismissedAlerts(prev => new Set([...prev, idx]));
  }

  function dismissAllAlerts() {
    setDismissedAlerts(new Set(alerts.map((_, i) => i)));
  }

  async function load() {
    const [data, sum] = await Promise.all([getIssues({}), getSummary(period)]);
    const isFirstLoad = knownIssueIds.current === null;

    if (!isFirstLoad && Notification.permission === "granted") {
      const newIssues = data.filter(i => !knownIssueIds.current.has(i.id));
      newIssues.forEach(issue => {
        safeNotify("New Issue Submitted", {
          body: `${issue.foreman_name} — ${titleCase(issue.category)}: ${issue.description}`,
          icon: "/favicon.svg", badge: "/favicon.svg", tag: `issue-${issue.id}`,
        });
      });

      data.forEach(issue => {
        const prevSnap = knownIssueSnapshots.current?.get(issue.id);
        if (!prevSnap) return;
        const gotNewUpdate  = (issue.update_count ?? 0) > (prevSnap.update_count ?? 0);
        const statusChanged = issue.status !== prevSnap.status;
        if (!gotNewUpdate && !statusChanged) return;
        const justSolved = statusChanged && issue.status === "solved";
        const title = justSolved ? "Issue Marked Solved" : "Issue Updated";
        const body  = justSolved
          ? `${issue.foreman_name} — ${titleCase(issue.category)} marked solved${issue.solved_by ? ` by ${issue.solved_by}` : ""}`
          : `${issue.foreman_name} — ${titleCase(issue.category)}: new update logged`;
        safeNotify(title, {
          body, icon: "/favicon.svg", badge: "/favicon.svg",
          tag: `issue-update-${issue.id}-${issue.update_count}-${issue.status}`,
        });
      });
    }

    knownIssueIds.current = new Set(data.map(i => i.id));
    knownIssueSnapshots.current = new Map(
      data.map(i => [i.id, { update_count: i.update_count ?? 0, status: i.status }])
    );

    // Trust the backend's is_read directly — no localStorage override.
    // localStorage-based overrides break when IDs get reused after a
    // bulk delete (new record, recycled ID, stale "already read" entry).
    setIssues(data);
    setSummary(sum);
    setCheckedIds(new Set());
    setLoading(false);
  }

  async function loadOEE() {
    try { const data = await getOEESummary(); setOeeSummary(data); }
    catch (err) { console.error("OEE error:", err); }
  }

  async function loadForemen() {
    try { const data = await getForemen(); setForemen(data.map(f => f.name)); }
    catch (err) { console.error("Foremen error:", err); }
  }

  async function loadWorkOrders(silent = false) {
    try {
      const data = await getWorkOrders();
      const isFirstLoad = knownWorkOrderIds.current === null;

      if (!isFirstLoad && Notification.permission === "granted") {
        const newWOs = data.filter(wo => !knownWorkOrderIds.current.has(wo.id));
        newWOs.forEach(wo => {
          safeNotify("New Defect Report Submitted", {
            body: `Work order ${wo.work_order_num} — ${wo.truck_type} — ${wo.total_defects} defect${wo.total_defects !== 1 ? "s" : ""}`,
            icon: "/favicon.svg", badge: "/favicon.svg", tag: `wo-${wo.id}`,
          });
        });
      }

      knownWorkOrderIds.current = new Set(data.map(wo => wo.id));

      // Trust the backend's is_read directly — no localStorage override.
      // localStorage-based overrides break when IDs get reused after a
      // bulk delete (new record, recycled ID, stale "already read" entry).
      setWorkOrders(data);

    } catch (err) {
      console.error("Work orders error:", err);
    }
  }

  useEffect(() => {
    if (authed) { load(); loadOEE(); loadForemen(); loadWorkOrders(); }
  }, [authed, period]);

  // Polling interval — shortened from 30s to 10s so genuinely new items
  // (submitted by someone else) get picked up and notified about faster.
  const loadRef    = useRef(null);
  const loadWORef  = useRef(null);
  const loadOEERef = useRef(null);
  loadRef.current    = load;
  loadWORef.current  = loadWorkOrders;
  loadOEERef.current = loadOEE;

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(() => {
      loadRef.current().catch(err => console.error("Poll load() failed:", err));
      loadWORef.current(true);
      loadOEERef.current();
    }, 10000);
    return () => clearInterval(interval);
  }, [authed]);
  async function handleExport(mode) {
    setExporting(true);
    try {
      const data = await exportAll();
      const wb = XLSX.utils.book_new();
      if (mode === "issues") {
        const issueRows = data.issues.map(i => ({
          "ID": i.id, "Type": i.issue_type === "part" ? "Part Issue" : "Process Issue",
          "Category": i.category, "Description": i.description, "Foreman": i.foreman_name,
          "Status": i.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
          "Resolution Note": i.resolution_note ?? "", "Solved By": i.solved_by ?? "",
          "Created": i.created_at, "Updated": i.updated_at,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows), "Issues");
        const updateRows = data.issue_updates.map(u => ({
          "Issue ID": u.issue_id, "Update #": u.update_num, "Note": u.note,
          "Made By": u.made_by ?? "", "Created At": u.created_at,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(updateRows), "Issue Updates");
      }
      if (mode === "oee") {
        const woRows = data.work_orders.map(wo => ({
          "Work Order #":    wo.work_order_num,
          "Truck Type":      wo.truck_type,
          "Units Completed": wo.units_completed,
          "Total Defects":   wo.total_defects,
          "DPU":             wo.units_completed > 0 ? (wo.total_defects / wo.units_completed).toFixed(2) : 0,
          "Week Start":      wo.week_start,
          "Created At":      wo.created_at,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(woRows), "Work Orders");
        if (data.defect_breakdown && data.defect_breakdown.length > 0) {
          const defectRows = data.defect_breakdown.map(d => ({
            "Work Order #": d.work_order_num,
            "Truck Type":   d.truck_type,
            "Week Start":   d.week_start,
            "Defect Type":  d.defect_type,
            "Quantity":     d.quantity,
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(defectRows), "Defect Breakdown");
        }
        const laborRows = data.labor_hours.map(r => ({
          "Week Start":        r.week_start,
          "Working Days":      r.working_days,
          "Total Labor Hours": r.total_labor_hours,
          "Indirect Hours":    r.indirect_hours,
          "Rework Hours":      r.rework_hours,
          "Availability %":    r.total_labor_hours > 0 ? (((r.total_labor_hours - r.indirect_hours - r.rework_hours) / r.total_labor_hours) * 100).toFixed(1) : 0,
          "Notes":             r.notes ?? "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(laborRows), "Labor Hours");
        const goalRows = data.goal_history.map(g => ({
          "Effective Date":     g.effective_date,
          "Annual DPU Goal":    g.annual_dpu_goal,
          "Quarterly DPU Goal": g.quarterly_dpu_goal,
          "Weekly Trucks Min":  g.weekly_trucks_min,
          "Weekly Trucks Max":  g.weekly_trucks_max,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalRows), "Goal History");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.foremen), "Foremen");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.supervisors), "Supervisors");
      }
      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, mode === "issues" ? `OEE_Issues_${date}.xlsx` : `OEE_Production_${date}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const activeIssues  = issues.filter(i => i.status !== "solved");
  const solvedIssues  = issues.filter(i => i.status === "solved");
  const unreadCount   = activeIssues.filter(i => !i.is_read).length;
  const unreadWOCount = workOrders.filter(wo => !wo.is_read).length;
  const totalUnread   = unreadCount + unreadWOCount;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const svgData = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#1D9E75"/>
      <rect x="4" y="20" width="4" height="8" rx="1" fill="white" opacity="0.9"/>
      <rect x="10" y="14" width="4" height="14" rx="1" fill="white" opacity="0.9"/>
      <rect x="16" y="9" width="4" height="19" rx="1" fill="white" opacity="0.9"/>
      <rect x="22" y="16" width="4" height="12" rx="1" fill="white" opacity="0.9"/>
      <polyline points="6,18 12,12 18,7 24,14" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    </svg>`;
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.src    = url;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      URL.revokeObjectURL(url);
      if (totalUnread > 0) {
        ctx.beginPath(); ctx.arc(22, 10, 11, 0, 2 * Math.PI);
        ctx.fillStyle = "#E24B4A"; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(totalUnread > 9 ? "9+" : String(totalUnread), 22, 10);
      }
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.type = "image/png"; link.href = canvas.toDataURL("image/png");
    };
  }, [totalUnread]);

  function toggleForeman(key) { setExpandedForemen(prev => ({ ...prev, [key]: !prev[key] })); }
  function toggleCheck(id) {
    setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function confirmDelete(ids) { setToDelete(ids); setUpdating(null); setEditing(null); setMassAdding(false); }
  async function handleDelete() {
    if (!toDelete) return;
    await Promise.all(toDelete.map(id => deleteIssue(id)));
    setToDelete(null); setDeleteMsg(true);
    setTimeout(() => setDeleteMsg(false), 3000);
    load();
  }

  async function markRead(issueId) {
    await markIssueRead(issueId);
    readIssueIds.current.add(issueId);
    localStorage.setItem("readIssueIds", JSON.stringify([...readIssueIds.current]));
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, is_read: true } : i));
  }


  const grouped = activeIssues.reduce((acc, issue) => {
    if (!acc[issue.foreman_name]) acc[issue.foreman_name] = [];
    acc[issue.foreman_name].push(issue); return acc;
  }, {});
  const solvedGrouped = solvedIssues.reduce((acc, issue) => {
    if (!acc[issue.foreman_name]) acc[issue.foreman_name] = [];
    acc[issue.foreman_name].push(issue); return acc;
  }, {});
  const sortForemen = (keys) => [...keys].sort((a, b) => {
    const aIdx = foremen.indexOf(a), bIdx = foremen.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1; if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  const sortedForemen       = sortForemen(Object.keys(grouped));
  const sortedSolvedForemen = sortForemen(Object.keys(solvedGrouped));

  if (!authed) return (
    <>
      <Helmet><title>Supervisor Dashboard</title></Helmet>
      <SupervisorLogin onSuccess={() => setAuthed(true)} />
    </>
  );

  return (
    <>
      <Helmet>
        <title>{totalUnread > 0 ? `(${totalUnread}) Supervisor Dashboard` : "Supervisor Dashboard"}</title>
      </Helmet>
      <main style={{ maxWidth: 1600, margin: "40px auto", padding: "0 24px" }}>
        {loading ? (
          <p style={{ fontSize: 14, color: "#aaa", marginTop: 80, textAlign: "center" }}>Loading dashboard...</p>
        ) : (
          <>
            {/* HEADER */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Supervisor Dashboard</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {notifPermission === "denied" && (
                  <span style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB", padding: "3px 10px", borderRadius: 8 }}>
                    Notifications blocked — enable in browser settings
                  </span>
                )}
                {notifPermission === "default" && (
                  <button onClick={() => Notification.requestPermission().then(p => setNotifPermission(p))} style={{
                    fontSize: 11, color: "#854F0B", background: "#FAEEDA",
                    border: "1px solid #EF9F27", padding: "4px 12px",
                    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  }}>Enable notifications</button>
                )}
                {notifPermission === "granted" && (
                  <span style={{ fontSize: 11, color: "#0F6E56", background: "#E1F5EE", padding: "3px 10px", borderRadius: 8 }}>
                    Notifications on
                  </span>
                )}
                <PasswordChangePanel />
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 20, marginTop: 4 }}>
              Overall Equipment Effectiveness and Production Metrics
            </p>

            {/* ALERT BANNER */}
            <AlertBanner
              alerts={visibleAlerts}
              onDismiss={dismissAlert}
              onDismissAll={dismissAllAlerts}
            />

            {/* MAIN TAB BAR */}
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #eee", marginBottom: 28 }}>
              {["issues", "oee"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 500,
                  border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                  color: activeTab === tab ? "#1D9E75" : "#888",
                  borderBottom: `2px solid ${activeTab === tab ? "#1D9E75" : "transparent"}`,
                  marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
                }}>
                  {tab === "issues" ? "Issues" : "OEE & Production"}
                  {tab === "issues" && unreadCount > 0 && (
                    <span style={{ background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, lineHeight: "16px" }}>
                      {unreadCount}
                    </span>
                  )}
                  {tab === "oee" && unreadWOCount > 0 && (
                    <span style={{ background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, lineHeight: "16px" }}>
                      {unreadWOCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ISSUES TAB */}
            {activeTab === "issues" && (
              <>
                <IssuesSummary issues={issues} period={period} onPeriodChange={(p) => setPeriod(p)} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All Issues</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ForemanManagePanel onChanged={loadForemen} />
                    <SupervisorManagePanel onChanged={() => {}} />
                    <IssueCategoryManagePanel onChanged={() => {}} />
                    <button onClick={() => handleExport("issues")} disabled={exporting} style={{
                      padding: "8px 16px", background: "#fff", color: "#555",
                      border: "1px solid #ddd", borderRadius: 8, fontSize: 13,
                      fontWeight: 500, cursor: exporting ? "not-allowed" : "pointer", fontFamily: "inherit",
                    }}>
                      {exporting ? "Exporting…" : "↓ Export Issues"}
                    </button>
                    <button onClick={() => { setMassAdding(prev => !prev); setUpdating(null); setEditing(null); setToDelete(null); }} style={{
                      padding: "8px 16px", background: "#1D9E75", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13,
                      fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}>+ Add Multiple Issues</button>
                  </div>
                </div>

                {massAdding && <MassAddPanel onClose={() => setMassAdding(false)} onSaved={() => { setMassAdding(false); load(); }} />}
                {updating && <IssueUpdatePanel issue={updating} onClose={() => setUpdating(null)} onSaved={load} />}
                {editing && <IssueEditPanel issue={editing} onClose={() => setEditing(null)} onSaved={load} />}

                {toDelete && (
                  <div style={{ marginTop: 16, padding: 20, border: "1px solid #E24B4A", borderRadius: 12, background: "#fff", marginBottom: 16 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 500, color: "#A32D2D" }}>
                      Delete {toDelete.length} Issue{toDelete.length > 1 ? "s" : ""}?
                    </p>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>The following will be permanently deleted. This cannot be undone.</p>
                    <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 13, color: "#333" }}>
                      {toDelete.map(id => {
                        const issue = issues.find(i => i.id === id);
                        return issue ? <li key={id} style={{ marginBottom: 4 }}>Issue #{id} — {titleCase(issue.category)} ({issue.foreman_name})</li> : null;
                      })}
                    </ul>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleDelete} style={{ padding: "8px 20px", background: "#E24B4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>Yes, Delete</button>
                      <button onClick={() => setToDelete(null)} style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {deleteMsg && (
                  <div style={{ padding: "12px 16px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 12 }}>
                    Issues deleted successfully.
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#888" }}>
                    {checkedIds.size > 0 ? `${checkedIds.size} issue${checkedIds.size > 1 ? "s" : ""} selected` : ""}
                  </span>
                  <button disabled={checkedIds.size === 0} onClick={() => confirmDelete([...checkedIds])} style={{
                    padding: "7px 16px", fontSize: 13, borderRadius: 8,
                    cursor: checkedIds.size > 0 ? "pointer" : "not-allowed",
                    border: "1px solid #E24B4A",
                    background: checkedIds.size > 0 ? "#FCEBEB" : "#f5f5f5",
                    color: checkedIds.size > 0 ? "#A32D2D" : "#bbb",
                    fontWeight: 500, fontFamily: "inherit",
                  }}>Delete Selected</button>
                </div>

                {sortedForemen.length === 0 && <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>No Active Issues Found.</p>}

                {sortedForemen.map(foremanName => {
                  const foremanIssues = grouped[foremanName];
                  if (foremanIssues.length === 0) return null;
                  const isOpen   = expandedForemen[foremanName];
                  const newCount = foremanIssues.filter(i => !i.is_read).length;
                  const counts   = foremanIssues.reduce((acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {});
                  return (
                    <div key={foremanName} style={{ border: "0.5px solid #eee", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fafafa", borderBottom: isOpen ? "0.5px solid #eee" : "none" }}>
                        <button type="button" onClick={() => toggleForeman(foremanName)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{foremanName}</span>
                            {newCount > 0 && <span style={{ background: "#E24B4A", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8 }}>{newCount} new</span>}
                          </div>
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ fontSize: 12, color: "#888" }}>{foremanIssues.length} issue{foremanIssues.length !== 1 ? "s" : ""}</span>
                          {counts.open > 0 && <span style={{ fontSize: 11, color: "#854F0B" }}>{counts.open} open</span>}
                          {counts.in_progress > 0 && <span style={{ fontSize: 11, color: "#854F0B" }}>{counts.in_progress} in progress</span>}
                          <span onClick={() => toggleForeman(foremanName)} style={{ fontSize: 12, color: "#555", fontWeight: 500, background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>
                            {isOpen ? "▲ Hide" : "▼ Show"}
                          </span>
                        </div>
                      </div>
                      {isOpen && (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                              <th style={{ padding: "7px 12px", width: 30 }}></th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>ID</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Type</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Category</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Description</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Status</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Age</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Created</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Updates</th>
                              <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {foremanIssues.map(issue => (
                              <tr key={issue.id} style={{ borderBottom: "0.5px solid #f5f5f5", background: checkedIds.has(issue.id) ? "#FFF5F5" : !issue.is_read ? "#FFFBF0" : "white" }}>
                                <td style={{ padding: "8px 12px" }}>
                                  <input type="checkbox" checked={checkedIds.has(issue.id)} onChange={() => toggleCheck(issue.id)} style={{ cursor: "pointer", accentColor: "#E24B4A" }} />
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    #{issue.id}
                                    {!issue.is_read && <span style={{ background: "#E24B4A", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8 }}>NEW</span>}
                                  </div>
                                </td>
                                <td style={tdStyle}>{issue.issue_type === "part" ? "Part Issue" : "Process Issue"}</td>
                                <td style={tdStyle}>{titleCase(issue.category)}</td>
                                <td style={{ ...tdStyle, maxWidth: 140 }}>{issue.description}</td>
                                <td style={tdStyle}><IssueStatusBadge status={issue.status} /></td>
                                <td style={tdStyle}>
                                  <span style={{
                                    background: daysOld(issue.created_at) === "Today" ? "#E1F5EE" : parseInt(daysOld(issue.created_at)) > 7 ? "#FCEBEB" : "#FAEEDA",
                                    color: daysOld(issue.created_at) === "Today" ? "#0F6E56" : parseInt(daysOld(issue.created_at)) > 7 ? "#A32D2D" : "#854F0B",
                                    padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500,
                                  }}>{daysOld(issue.created_at)}</span>
                                </td>
                                <td style={tdStyle}>{new Date(issue.created_at + "Z").toLocaleDateString()}</td>
                                <td style={{ ...tdStyle, fontSize: 12, color: "#888" }}>{issue.update_count ?? 0}</td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                                    {!issue.is_read && (
                                      <button onClick={() => markRead(issue.id)} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #D4A017", background: "#FAEEDA", color: "#854F0B", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Mark Read</button>
                                    )}
                                    <button onClick={async () => { setUpdating(issue); setEditing(null); setToDelete(null); setMassAdding(false); if (!issue.is_read) await markRead(issue.id); }} style={{ ...btnBase, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>Update</button>
                                    <button onClick={async () => { setEditing(issue); setUpdating(null); setToDelete(null); setMassAdding(false); if (!issue.is_read) await markRead(issue.id); }} style={{ ...btnBase, border: "1px solid #378ADD", background: "#E6F1FB", color: "#0C447C", fontWeight: 500 }}>Edit</button>
                                    <button onClick={() => confirmDelete([issue.id])} style={{ ...btnBase, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D" }}>Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}

                {/* SOLVED SECTION */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setShowSolved(prev => !prev)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#555", cursor: "pointer", fontFamily: "inherit" }}>
                      {showSolved ? "▲" : "▼"} View Solved
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({solvedIssues.length} issue{solvedIssues.length !== 1 ? "s" : ""})</span>
                    </button>
                    {solvedIssues.length > 0 && (
                      <button onClick={() => confirmDelete(solvedIssues.map(i => i.id))} style={{ padding: "10px 16px", background: "#FCEBEB", border: "1px solid #E24B4A", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#A32D2D", cursor: "pointer", fontFamily: "inherit" }}>
                        Delete All Solved ({solvedIssues.length})
                      </button>
                    )}
                  </div>
                  {showSolved && (
                    <div style={{ marginTop: 8 }}>
                      {sortedSolvedForemen.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: 24, fontSize: 13 }}>No solved issues yet.</p>}
                      {sortedSolvedForemen.map(foremanName => {
                        const foremanSolved = solvedGrouped[foremanName];
                        const isOpen        = expandedForemen[foremanName + "_solved"];
                        return (
                          <div key={foremanName} style={{ border: "0.5px solid #eee", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fafafa", borderBottom: isOpen ? "0.5px solid #eee" : "none" }}>
                              <button type="button" onClick={() => toggleForeman(foremanName + "_solved")} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left" }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{foremanName}</span>
                                <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>Solved</span>
                              </button>
                              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <span style={{ fontSize: 12, color: "#888" }}>{foremanSolved.length} issue{foremanSolved.length !== 1 ? "s" : ""}</span>
                                <span onClick={() => toggleForeman(foremanName + "_solved")} style={{ fontSize: 12, color: "#555", fontWeight: 500, background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>{isOpen ? "▲ Hide" : "▼ Show"}</span>
                              </div>
                            </div>
                            {isOpen && (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                                    <th style={{ padding: "7px 12px", width: 30 }}></th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>ID</th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Type</th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Category</th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Description</th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Created</th>
                                    <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {foremanSolved.map(issue => (
                                    <tr key={issue.id} style={{ borderBottom: "0.5px solid #f5f5f5", background: checkedIds.has(issue.id) ? "#FFF5F5" : "#fafafa" }}>
                                      <td style={{ padding: "8px 12px" }}><input type="checkbox" checked={checkedIds.has(issue.id)} onChange={() => toggleCheck(issue.id)} style={{ cursor: "pointer", accentColor: "#E24B4A" }} /></td>
                                      <td style={tdStyle}>#{issue.id}</td>
                                      <td style={tdStyle}>{issue.issue_type === "part" ? "Part Issue" : "Process Issue"}</td>
                                      <td style={tdStyle}>{titleCase(issue.category)}</td>
                                      <td style={{ ...tdStyle, maxWidth: 140 }}>{issue.description}</td>
                                      <td style={tdStyle}>{new Date(issue.created_at + "Z").toLocaleDateString()}</td>
                                      <td style={tdStyle}>
                                        <div style={{ display: "flex", gap: 5 }}>
                                          <button onClick={() => { setUpdating(issue); setEditing(null); setToDelete(null); setMassAdding(false); }} style={{ ...btnBase, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>Update</button>
                                          <button onClick={() => confirmDelete([issue.id])} style={{ ...btnBase, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D" }}>Delete</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* OEE TAB */}
            {activeTab === "oee" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["overview", "workorders", "downtime"].map(tab => (
                      <button key={tab} onClick={() => setActiveOeeTab(tab)} style={{
                        padding: "7px 16px", fontSize: 13, fontWeight: 500,
                        border: `1px solid ${activeOeeTab === tab ? "#1D9E75" : "#eee"}`,
                        borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                        background: activeOeeTab === tab ? "#E1F5EE" : "#fff",
                        color: activeOeeTab === tab ? "#0F6E56" : "#888",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        {tab === "overview" ? "Overview" : tab === "workorders" ? "Work Orders" : "Availability"}
                        {tab === "workorders" && unreadWOCount > 0 && (
                          <span style={{ background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, lineHeight: "16px" }}>
                            {unreadWOCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {activeOeeTab === "overview" && (
                      <button onClick={() => handleExport("oee")} disabled={exporting} style={{
                        padding: "7px 16px", fontSize: 13, fontWeight: 500,
                        border: "1px solid #ddd", borderRadius: 8,
                        background: "#fff", color: "#555",
                        cursor: exporting ? "not-allowed" : "pointer", fontFamily: "inherit",
                      }}>
                        {exporting ? "Exporting…" : "↓ Export Data"}
                      </button>
                    )}
                    {activeOeeTab === "workorders" && (
                      <>
                        <TruckTypeManagePanel onChanged={() => {}} />
                        <DefectTypeManagePanel onChanged={() => {}} />
                      </>
                    )}
                    <button onClick={() => setHuddleOpen(true)} style={{
                      padding: "7px 16px", fontSize: 13, fontWeight: 500,
                      border: "1px solid #1D9E75", borderRadius: 8,
                      background: "#E1F5EE", color: "#0F6E56",
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>▶ Start Huddle</button>
                    <OEEGoalsPanel onSaved={loadOEE} />
                  </div>
                </div>

                {activeOeeTab === "overview" && <OEEMetrics summary={oeeSummary} />}
                {activeOeeTab === "workorders" && (
                  <WorkOrderPanel
                    onSaved={() => { loadOEE(); loadWorkOrders(true); }}
                    unreadIds={new Set(workOrders.filter(wo => !wo.is_read).map(wo => wo.id))}
                    onMarkRead={async (id) => {
                      await markWorkOrderRead(id);
                      readWorkOrderIds.current.add(id);
                      localStorage.setItem("readWorkOrderIds", JSON.stringify([...readWorkOrderIds.current]));
                      setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, is_read: true } : wo));
                    }}
                  />
                )}
                {activeOeeTab === "downtime" && <WeeklyLaborPanel onSaved={loadOEE} />}

                {huddleOpen && (
                  <MorningHuddle
                    summary={oeeSummary}
                    onClose={() => setHuddleOpen(false)}
                    onSaved={() => { load(); loadOEE(); }}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

const tdStyle = { padding: "9px 12px", verticalAlign: "top" };
const btnBase = { padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#333" };