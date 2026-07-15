import { useState, useEffect } from "react";
import { getIssues, markIssueRead, addIssueUpdate, updateIssue, getSupervisors } from "../api/issues";

function getLastWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff - 7);
  return monday.toISOString().split("T")[0];
}

function NewBizEntry({ foremanName, onSaved }) {
  const [issueType, setIssueType] = useState("");
  const [category, setCategory]   = useState("");
  const [desc, setDesc]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [categories, setCategories] = useState({ part: [], process: [] });

  useEffect(() => {
    import("../api/issues").then(({ getIssueCategories }) => {
      getIssueCategories().then(data => {
        setCategories({
          part:    data.filter(c => c.issue_type === "part").map(c => c.name),
          process: data.filter(c => c.issue_type === "process").map(c => c.name),
        });
      }).catch(err => console.error("Failed to load issue categories:", err));
    });
  }, []);

  function titleCase(str) {
    return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  const isValid = issueType && category && desc.trim();

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      const { submitIssue } = await import("../api/issues");
      await submitIssue({
        issue_type:   issueType,
        category:     category,
        description:  desc.trim(),
        foreman_name: foremanName,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button onClick={() => { setIssueType("part"); setCategory(""); }} style={{
          padding: "6px 8px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${issueType === "part" ? "#1D9E75" : "#333"}`,
          background: issueType === "part" ? "#0a2e22" : "transparent",
          color: issueType === "part" ? "#1D9E75" : "#666",
        }}>Part Issue</button>
        <button onClick={() => { setIssueType("process"); setCategory(""); }} style={{
          padding: "6px 8px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${issueType === "process" ? "#1D9E75" : "#333"}`,
          background: issueType === "process" ? "#0a2e22" : "transparent",
          color: issueType === "process" ? "#1D9E75" : "#666",
        }}>Process Issue</button>
      </div>

      {issueType && (
        <select value={category} onChange={e => setCategory(e.target.value)} style={{
          background: "#252a38", border: "0.5px solid #333", borderRadius: 6,
          color: category ? "#ccc" : "#555", fontSize: 12, padding: "6px 10px",
          fontFamily: "inherit",
        }}>
          <option value="">Select category…</option>
          {categories[issueType].map(c => (
            <option key={c} value={c}>{titleCase(c)}</option>
          ))}
        </select>
      )}

      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Describe the issue…"
        rows={2}
        style={{
          background: "#252a38", border: "0.5px solid #333", borderRadius: 6,
          color: "#ccc", fontSize: 12, padding: "8px 10px",
          fontFamily: "inherit", resize: "none", boxSizing: "border-box", width: "100%",
        }}
      />

      <button onClick={handleSave} disabled={!isValid || saving} style={{
        padding: "6px 14px", fontSize: 12, border: "none", borderRadius: 6,
        background: isValid && !saving ? "#1D9E75" : "#1a2e25",
        color: isValid && !saving ? "#fff" : "#444",
        cursor: isValid ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500,
        alignSelf: "flex-start",
      }}>
        {saving ? "Saving…" : "Submit Issue"}
      </button>
    </div>
  );
}

export default function MorningHuddle({ summary, onClose, onSaved }) {
  const [phase, setPhase]               = useState(1);
  const [issues, setIssues]             = useState([]);
  const [issueIdx, setIssueIdx]         = useState(0);
  const [updateText, setUpdateText]     = useState("");
  const [madeBy, setMadeBy]             = useState("");
  const [updateMode, setUpdateMode]     = useState("update"); // "update" | "solve"
  const [solvedBy, setSolvedBy]         = useState("");
  const [resolution, setResolution]     = useState("");
  const [saving, setSaving]             = useState(false);
  const [savedMsg, setSavedMsg]         = useState(false);
  const [newBizAdded, setNewBizAdded]   = useState({});
  const [supervisors, setSupervisors]   = useState([]);

  useEffect(() => {
    getIssues({}).then(data => {
      const active = data.filter(i => i.status !== "solved");
      const foremenOrder = ["Rick","Todd","Duey","Jordan","Dan","Joel","Willard","Eric","Brian","Ralph","QC","Others"];
      const sorted = [...active].sort((a, b) => {
        const aIdx = foremenOrder.indexOf(a.foreman_name);
        const bIdx = foremenOrder.indexOf(b.foreman_name);
        if (aIdx === -1 && bIdx === -1) return a.foreman_name.localeCompare(b.foreman_name);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
      setIssues(sorted);
    });
    getSupervisors().then(data => setSupervisors(data.map(s => s.name)));
  }, []);

  if (!summary) return null;

  const { goals } = summary;

  // History used to compute week-over-week trend arrows for the Phase 1 cards,
  // calculated the same way OEEMetrics.jsx computes its "Last week" trend arrows.
  const allHistory      = summary.dpu_history ?? [];
  const indirectHistory = summary.indirect_labor_history ?? [];

  function computeWeekMetrics(weekStr) {
    const entry = allHistory.find(w => w.week === weekStr);
    if (!entry) return null;
    const laborEntry   = indirectHistory.find(r => r.week_start === weekStr);
    const weeklyTarget = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;
    const days         = laborEntry?.working_days ?? 5;
    const adjTarget     = weeklyTarget * (days / 5);
    const performance   = adjTarget > 0 ? (entry.trucks / adjTarget) * 100 : 0;
    const availability  = laborEntry && laborEntry.total_labor_hours > 0
      ? ((laborEntry.total_labor_hours - laborEntry.indirect_hours - laborEntry.rework_hours) / laborEntry.total_labor_hours) * 100
      : 0;
    const quality = entry.dpu === 0 ? 0
      : entry.dpu <= goals.quarterly_dpu_goal ? 100
      : (goals.quarterly_dpu_goal / entry.dpu) * 100;
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
    return { trucks: entry.trucks, availability, performance, quality, oee };
  }

  const currWeekStr = allHistory[allHistory.length - 1]?.week ?? null;
  const prevWeekStr = allHistory[allHistory.length - 2]?.week ?? null;
  const currWeekMetrics = currWeekStr ? computeWeekMetrics(currWeekStr) : null;
  const prevWeekMetrics = prevWeekStr ? computeWeekMetrics(prevWeekStr) : null;

  function trendArrow(curr, prevVal) {
    if (curr == null || prevVal == null) return { arrow: "", color: null };
    if (curr > prevVal) return { arrow: "↑ ", color: "#1D9E75" };
    if (curr < prevVal) return { arrow: "↓ ", color: "#E24B4A" };
    return { arrow: "→ ", color: "#888" };
  }

  const oeeTrend    = trendArrow(currWeekMetrics?.oee, prevWeekMetrics?.oee);
  const availTrend  = trendArrow(currWeekMetrics?.availability, prevWeekMetrics?.availability);
  const perfTrend   = trendArrow(currWeekMetrics?.performance, prevWeekMetrics?.performance);
  const qualTrend   = trendArrow(currWeekMetrics?.quality, prevWeekMetrics?.quality);
  const trucksTrend = trendArrow(currWeekMetrics?.trucks, prevWeekMetrics?.trucks);

  const oeePrev    = prevWeekMetrics ? Math.round(prevWeekMetrics.oee * 10) / 10 : null;
  const availPrev  = prevWeekMetrics ? Math.round(prevWeekMetrics.availability * 10) / 10 : null;
  const perfPrev   = prevWeekMetrics ? Math.round(prevWeekMetrics.performance * 10) / 10 : null;
  const qualPrev   = prevWeekMetrics ? Math.round(prevWeekMetrics.quality * 10) / 10 : null;
  const trucksPrev = prevWeekMetrics ? Math.round(prevWeekMetrics.trucks * 10) / 10 : null;

  // Month-to-date averages, shown as smaller text under each weekly card.
  const now              = new Date();
  const currentMonthNum  = now.getMonth();
  const currentYearNum   = now.getFullYear();

  function computeMonthAverages() {
    const monthWeeks = allHistory.filter(w => {
      const d = new Date(w.week);
      return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
    });
    const monthIndirect = indirectHistory.filter(r => {
      const d = new Date(r.week_start);
      return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
    });
    if (monthWeeks.length === 0) return null;

    const totalTrucks  = monthWeeks.reduce((s, w) => s + w.trucks, 0);
    const totalDefects = monthWeeks.reduce((s, w) => s + w.dpu * w.trucks, 0);
    const avgDpu        = totalTrucks > 0 ? totalDefects / totalTrucks : 0;
    const avgTrucks     = totalTrucks / monthWeeks.length;
    const weeklyTarget  = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;

    const perfByWeek = monthWeeks.map(w => {
      const laborEntry = monthIndirect.find(r => r.week_start === w.week);
      const days       = laborEntry?.working_days ?? 5;
      const adjusted   = weeklyTarget * (days / 5);
      return adjusted > 0 ? (w.trucks / adjusted) * 100 : 0;
    });
    const avgPerf = perfByWeek.length > 0 ? perfByWeek.reduce((a, b) => a + b, 0) / perfByWeek.length : 0;

    const avgAvail = monthIndirect.length > 0
      ? monthIndirect.reduce((s, r) => {
          const avail = r.total_labor_hours > 0
            ? ((r.total_labor_hours - r.indirect_hours - r.rework_hours) / r.total_labor_hours) * 100
            : 0;
          return s + avail;
        }, 0) / monthIndirect.length
      : 0;

    const avgQuality = avgDpu === 0 ? 0
      : avgDpu <= goals.quarterly_dpu_goal ? 100
      : goals.quarterly_dpu_goal / avgDpu * 100;

    const avgOee = avgAvail / 100 * avgPerf / 100 * avgQuality / 100 * 100;

    return { oee: avgOee, availability: avgAvail, performance: avgPerf, quality: avgQuality, trucks: avgTrucks, dpu: avgDpu };
  }

  const monthAvg = computeMonthAverages();
  const oeeMonth    = monthAvg ? Math.round(monthAvg.oee * 10) / 10 : null;
  const availMonth  = monthAvg ? Math.round(monthAvg.availability * 10) / 10 : null;
  const perfMonth   = monthAvg ? Math.round(monthAvg.performance * 10) / 10 : null;
  const qualMonth   = monthAvg ? Math.round(monthAvg.quality * 10) / 10 : null;
  const trucksMonth = monthAvg ? Math.round(monthAvg.trucks * 10) / 10 : null;

  const oeeColor   = oeeTrend.color   ?? (summary.oee >= 85 ? "#1D9E75" : summary.oee >= 60 ? "#E4A317" : "#E24B4A");
  const availColor = availTrend.color ?? (summary.availability >= 85 ? "#1D9E75" : "#E4A317");
  const perfColor  = perfTrend.color  ?? (summary.performance >= 85 ? "#1D9E75" : "#E4A317");
  const qualColor  = qualTrend.color  ?? (summary.quality >= 85 ? "#1D9E75" : "#E4A317");
  const truckColor = trucksTrend.color ?? (summary.trucks_this_week >= goals.weekly_trucks_min ? "#1D9E75" : "#E24B4A");
  const dpuColor   = summary.avg_dpu_this_week === 0 ? "#888"
    : summary.avg_dpu_this_week <= goals.quarterly_dpu_goal ? "#1D9E75" : "#E24B4A";

  const reworkHours = summary.last_week_rework_hours ?? 0;
  const totalHours  = summary.last_week_total_hours ?? 0;
  const reworkPct   = totalHours > 0 ? ((reworkHours / totalHours) * 100).toFixed(1) : "—";
  const reworkColor = parseFloat(reworkPct) > 10 ? "#E24B4A" : parseFloat(reworkPct) > 5 ? "#E4A317" : "#1D9E75";

  const currentIssue = issues[issueIdx] ?? null;
  const foremenAll   = ["Rick","Todd","Duey","Jordan","Dan","Joel","Willard","Eric","Brian","Ralph","QC","Others"];

  function clearIssueState() {
    setUpdateText("");
    setMadeBy("");
    setSolvedBy("");
    setResolution("");
    setUpdateMode("update");
  }

  function nextStep() {
    if (phase === 1) { setPhase(2); setIssueIdx(0); clearIssueState(); }
    else if (phase === 2) {
      if (issueIdx < issues.length - 1) { setIssueIdx(i => i + 1); clearIssueState(); }
      else setPhase(3);
    } else {
      onClose();
      if (onSaved) onSaved();
    }
  }

  function prevStep() {
    if (phase === 2 && issueIdx > 0) { setIssueIdx(i => i - 1); clearIssueState(); }
    else if (phase === 2 && issueIdx === 0) setPhase(1);
    else if (phase === 3) setPhase(2);
  }

  async function handleSaveUpdate() {
    if (!updateText.trim() || !madeBy || !currentIssue) return;
    setSaving(true);
    try {
      await addIssueUpdate(currentIssue.id, { note: updateText.trim(), made_by: madeBy });
      await updateIssue(currentIssue.id, { status: "in_progress" });
      if (!currentIssue.is_read) await markIssueRead(currentIssue.id);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
      clearIssueState();
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkSolved() {
    if (!resolution.trim() || !solvedBy || !currentIssue) return;
    setSaving(true);
    try {
      await updateIssue(currentIssue.id, {
        status:          "solved",
        resolution_note: resolution.trim(),
        solved_by:       solvedBy,
      });
      if (!currentIssue.is_read) await markIssueRead(currentIssue.id);
      setIssues(prev => prev.filter(i => i.id !== currentIssue.id));
      clearIssueState();
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  }

  const phaseLabel = phase === 1
    ? "Phase 1 of 3 — Last week's numbers"
    : phase === 2
    ? `Phase 2 of 3 — Issue review ${issues.length > 0 ? `(${issueIdx + 1} of ${issues.length})` : ""}`
    : "Phase 3 of 3 — New business";

  const nextLabel = phase === 3 ? "Done ✓"
    : phase === 2 && issueIdx === issues.length - 1 ? "Finish issues →"
    : "Next →";

  const s = {
    overlay: {
      position: "fixed", inset: 0, background: "#0a0d12",
      zIndex: 2000, display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: "auto",
    },
    header: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 28px", borderBottom: "0.5px solid #1a1f2e", flexShrink: 0,
    },
    body: { flex: 1, padding: "24px 28px" },
    phaseBtn: (active) => ({
      padding: "4px 14px", fontSize: 11, borderRadius: 20, cursor: "pointer",
      background: active ? "#1D9E75" : "#1a1f2e",
      color: active ? "#fff" : "#555",
      border: "none", fontFamily: "inherit", fontWeight: active ? 500 : 400,
    }),
    card: {
      background: "#1a1f2e", border: "0.5px solid #222a38",
      borderRadius: 10, padding: "20px 22px",
    },
    bigNum: (color) => ({
      fontSize: 48, fontWeight: 500, margin: "0 0 4px",
      color, lineHeight: 1,
    }),
    label: {
      fontSize: 10, color: "#555", margin: "0 0 8px",
      textTransform: "uppercase", letterSpacing: "0.5px",
    },
    sub: { fontSize: 11, color: "#444", margin: 0 },
    btn: (bg, border, color) => ({
      padding: "7px 16px", fontSize: 12, border: border ? `1px solid ${border}` : "none",
      borderRadius: 7, background: bg, color, cursor: "pointer",
      fontFamily: "inherit", fontWeight: 500,
    }),
    select: {
      width: "100%", background: "#252a38", border: "0.5px solid #333",
      borderRadius: 6, color: "#ccc", fontSize: 13, padding: "8px 10px",
      fontFamily: "inherit", boxSizing: "border-box",
    },
    textarea: {
      width: "100%", background: "#252a38", border: "0.5px solid #333",
      borderRadius: 6, color: "#ccc", fontSize: 13, padding: "10px 12px",
      fontFamily: "inherit", resize: "none", boxSizing: "border-box",
    },
  };

  return (
    <div style={s.overlay}>

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75" }} />
          <span style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>Morning Huddle</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map(p => (
            <button key={p} onClick={() => { setPhase(p); if (p === 2) { setIssueIdx(0); clearIssueState(); } }}
              style={s.phaseBtn(phase === p)}>
              {p === 1 ? "1 · Numbers" : p === 2 ? "2 · Issues" : "3 · New business"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#333" }}>{phaseLabel}</span>
          <button onClick={prevStep} style={s.btn("transparent", "#333", "#888")}>← Back</button>
          <button onClick={nextStep} style={s.btn("#1D9E75", null, "#fff")}>{nextLabel}</button>
          <button onClick={onClose} style={s.btn("transparent", "#333", "#555")}>Exit</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* PHASE 1 */}
        {phase === 1 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
              <div style={s.card}>
                <p style={s.label}>Overall OEE</p>
                <p style={s.bigNum(oeeColor)}>{oeeTrend.arrow}{summary.oee}%</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={s.sub}>Last Week</p>
                  {oeePrev != null && <p style={s.sub}>Prev wk: <span style={{ color: "#888", fontWeight: 500 }}>{oeePrev}%</span></p>}
                </div>
                {oeeMonth != null && <p style={{ fontSize: 9, color: "#3a3a3a", margin: "4px 0 0" }}>Month avg: {oeeMonth}%</p>}
              </div>
              <div style={s.card}>
                <p style={s.label}>Availability</p>
                <p style={s.bigNum(availColor)}>{availTrend.arrow}{summary.availability}%</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={s.sub}>Downtime / Total Labor Hours</p>
                  {availPrev != null && <p style={s.sub}>Prev wk: <span style={{ color: "#888", fontWeight: 500 }}>{availPrev}%</span></p>}
                </div>
                {availMonth != null && <p style={{ fontSize: 9, color: "#3a3a3a", margin: "4px 0 0" }}>Month avg: {availMonth}%</p>}
              </div>
              <div style={s.card}>
                <p style={s.label}>Performance</p>
                <p style={s.bigNum(perfColor)}>{perfTrend.arrow}{summary.performance}%</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={s.sub}>Actual vs Target</p>
                  {perfPrev != null && <p style={s.sub}>Prev wk: <span style={{ color: "#888", fontWeight: 500 }}>{perfPrev}%</span></p>}
                </div>
                {perfMonth != null && <p style={{ fontSize: 9, color: "#3a3a3a", margin: "4px 0 0" }}>Month avg: {perfMonth}%</p>}
              </div>
              <div style={s.card}>
                <p style={s.label}>Quality</p>
                <p style={s.bigNum(qualColor)}>{qualTrend.arrow}{summary.quality}%</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={s.sub}>Goal / Actual DPU</p>
                  {qualPrev != null && <p style={s.sub}>Prev wk: <span style={{ color: "#888", fontWeight: 500 }}>{qualPrev}%</span></p>}
                </div>
                {qualMonth != null && <p style={{ fontSize: 9, color: "#3a3a3a", margin: "4px 0 0" }}>Month avg: {qualMonth}%</p>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={s.card}>
                <p style={s.label}>Trucks Last Week</p>
                <p style={s.bigNum(truckColor)}>{trucksTrend.arrow}{summary.trucks_this_week}</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={s.sub}>Target {goals.weekly_trucks_min}–{goals.weekly_trucks_max}</p>
                  {trucksPrev != null && <p style={s.sub}>Prev wk: <span style={{ color: "#888", fontWeight: 500 }}>{trucksPrev}</span></p>}
                </div>
                {trucksMonth != null && <p style={{ fontSize: 9, color: "#3a3a3a", margin: "4px 0 0" }}>Month avg: {trucksMonth}/wk</p>}
              </div>
              <div style={s.card}>
                <p style={s.label}>DPU Last Week</p>
                <p style={s.bigNum(dpuColor)}>{summary.avg_dpu_this_week === 0 ? "—" : summary.avg_dpu_this_week}</p>
                <p style={s.sub}>Goal / Actual DPU · Q{Math.floor(new Date().getMonth() / 3) + 1}</p>
              </div>
              <div style={s.card}>
                <p style={s.label}>Rework hours</p>
                <p style={s.bigNum(reworkColor)}>{reworkHours}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <p style={s.sub}>of {totalHours} total hrs</p>
                  <p style={{ fontSize: 13, color: reworkColor, margin: 0, fontWeight: 500 }}>= {reworkPct}%</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* PHASE 2 */}
        {phase === 2 && (
          issues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontSize: 18, color: "#555", margin: 0 }}>No open issues to review</p>
            </div>
          ) : currentIssue && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 500, color: "#ccc", margin: "0 0 4px" }}>{currentIssue.foreman_name}</p>
                  <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Issue {issueIdx + 1} of {issues.length}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { if (issueIdx > 0) { setIssueIdx(i => i - 1); clearIssueState(); } }}
                    disabled={issueIdx === 0}
                    style={{ ...s.btn("transparent", "#333", "#888"), opacity: issueIdx === 0 ? 0.4 : 1 }}>← Prev</button>
                  <button onClick={() => {
                    if (issueIdx < issues.length - 1) { setIssueIdx(i => i + 1); clearIssueState(); }
                    else setPhase(3);
                  }} style={s.btn("transparent", "#1D9E75", "#1D9E75")}>
                    {issueIdx < issues.length - 1 ? "Next issue →" : "Finish issues →"}
                  </button>
                </div>
              </div>

              <div style={{ ...s.card, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: "#444" }}>#{currentIssue.id}</span>
                  <span style={{ fontSize: 11, background: "#252a38", color: "#888", padding: "2px 8px", borderRadius: 6 }}>
                    {currentIssue.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 11, color: currentIssue.status === "in_progress" ? "#E4A317" : "#888" }}>
                    {currentIssue.status === "in_progress" ? "In Progress" : "Open"}
                  </span>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {(() => {
                      const diff = Math.floor((new Date() - new Date(currentIssue.created_at + "Z")) / (1000 * 60 * 60 * 24));
                      return diff <= 0 ? "Today" : `${diff}d old`;
                    })()}
                  </span>
                </div>
                <p style={{ fontSize: 20, color: "#ddd", margin: "0 0 10px", fontWeight: 500 }}>{currentIssue.description}</p>
                <p style={{ fontSize: 13, color: "#555", margin: 0 }}>
                  {currentIssue.update_count > 0 ? `${currentIssue.update_count} update${currentIssue.update_count > 1 ? "s" : ""} logged` : "No updates yet"}
                </p>
              </div>

              <div style={s.card}>
                {/* Mode toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button onClick={() => setUpdateMode("update")} style={{
                    flex: 1, padding: "7px 6px", borderRadius: 7, fontSize: 12,
                    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${updateMode === "update" ? "#1D9E75" : "#333"}`,
                    background: updateMode === "update" ? "#0a2e22" : "transparent",
                    color: updateMode === "update" ? "#1D9E75" : "#555",
                  }}>Add Update</button>
                  <button onClick={() => setUpdateMode("solve")} style={{
                    flex: 1, padding: "7px 6px", borderRadius: 7, fontSize: 12,
                    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${updateMode === "solve" ? "#E24B4A" : "#333"}`,
                    background: updateMode === "solve" ? "#2e0a0a" : "transparent",
                    color: updateMode === "solve" ? "#E24B4A" : "#555",
                  }}>Mark Solved</button>
                </div>

                {updateMode === "update" && (
                  <>
                    <p style={{ fontSize: 10, color: "#555", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Add update from huddle
                    </p>
                    <select value={madeBy} onChange={e => setMadeBy(e.target.value)}
                      style={{ ...s.select, marginBottom: 8 }}>
                      <option value="">Who is making this update?</option>
                      {supervisors.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <textarea
                      value={updateText}
                      onChange={e => setUpdateText(e.target.value)}
                      placeholder="Type update here..."
                      rows={2}
                      style={s.textarea}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <button onClick={handleSaveUpdate} disabled={!updateText.trim() || !madeBy || saving}
                        style={{ ...s.btn("#1D9E75", null, "#fff"), opacity: !updateText.trim() || !madeBy ? 0.5 : 1 }}>
                        {saving ? "Saving…" : "Save update"}
                      </button>
                      <button onClick={() => { clearIssueState(); setIssueIdx(i => Math.min(i + 1, issues.length - 1)); }}
                        style={s.btn("transparent", "#333", "#666")}>
                        Skip
                      </button>
                      {savedMsg && <span style={{ fontSize: 12, color: "#1D9E75", marginLeft: 4 }}>Saved ✓</span>}
                    </div>
                  </>
                )}

                {updateMode === "solve" && (
                  <>
                    <p style={{ fontSize: 10, color: "#555", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Mark as solved
                    </p>
                    <select value={solvedBy} onChange={e => setSolvedBy(e.target.value)}
                      style={{ ...s.select, marginBottom: 8 }}>
                      <option value="">Who solved this issue?</option>
                      {supervisors.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <textarea
                      value={resolution}
                      onChange={e => setResolution(e.target.value)}
                      placeholder="Describe how this was resolved…"
                      rows={2}
                      style={s.textarea}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <button onClick={handleMarkSolved} disabled={!resolution.trim() || !solvedBy || saving}
                        style={{ ...s.btn("#E24B4A", null, "#fff"), opacity: !resolution.trim() || !solvedBy ? 0.5 : 1 }}>
                        {saving ? "Saving…" : "Mark solved"}
                      </button>
                      <button onClick={() => { clearIssueState(); setIssueIdx(i => Math.min(i + 1, issues.length - 1)); }}
                        style={s.btn("transparent", "#333", "#666")}>
                        Skip
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )
        )}

        {/* PHASE 3 */}
        {phase === 3 && (
          <>
            <p style={{ fontSize: 16, color: "#555", margin: "0 0 20px" }}>Does anyone have anything new to add?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {foremenAll.map(f => (
                <div key={f} style={{ ...s.card }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: newBizAdded[f] === "open" ? 10 : 0 }}>
                    <span style={{ fontSize: 15, color: "#ccc" }}>{f}</span>
                    <button
                      onClick={() => setNewBizAdded(prev => ({ ...prev, [f]: prev[f] === "open" ? null : "open" }))}
                      style={{
                        padding: "4px 12px", fontSize: 11, borderRadius: 6,
                        border: `1px solid ${newBizAdded[f] === "saved" ? "#1D9E75" : newBizAdded[f] === "open" ? "#378ADD" : "#333"}`,
                        background: "transparent",
                        color: newBizAdded[f] === "saved" ? "#1D9E75" : newBizAdded[f] === "open" ? "#378ADD" : "#555",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      {newBizAdded[f] === "saved" ? "✓ Added" : newBizAdded[f] === "open" ? "Cancel" : "+ Add"}
                    </button>
                  </div>
                  {newBizAdded[f] === "open" && (
                    <NewBizEntry
                      foremanName={f}
                      onSaved={() => {
                        setNewBizAdded(prev => ({ ...prev, [f]: "saved" }));
                        if (onSaved) onSaved();
                      }}
                    />
                  )}
                  {newBizAdded[f] === "saved" && (
                    <p style={{ fontSize: 12, color: "#1D9E75", margin: "8px 0 0" }}>Issue added to dashboard</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}