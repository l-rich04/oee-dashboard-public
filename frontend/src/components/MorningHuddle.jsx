import { useState, useEffect } from "react";
import { getIssues, markIssueRead, addIssueUpdate, updateIssue, getSupervisors, getIssueUpdates } from "../api/issues";

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
          color: issueType === "part" ? "#1D9E75" : "#fff",
        }}>Part Issue</button>
        <button onClick={() => { setIssueType("process"); setCategory(""); }} style={{
          padding: "6px 8px", fontSize: 11, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${issueType === "process" ? "#1D9E75" : "#333"}`,
          background: issueType === "process" ? "#0a2e22" : "transparent",
          color: issueType === "process" ? "#1D9E75" : "#fff",
        }}>Process Issue</button>
      </div>

      {issueType && (
        <select value={category} onChange={e => setCategory(e.target.value)} style={{
          background: "#252a38", border: "0.5px solid #333", borderRadius: 6,
          color: category ? "#fff" : "#fff", fontSize: 12, padding: "6px 10px",
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
          color: "#fff", fontSize: 12, padding: "8px 10px",
          fontFamily: "inherit", resize: "none", boxSizing: "border-box", width: "100%",
        }}
      />

      <button onClick={handleSave} disabled={!isValid || saving} style={{
        padding: "6px 14px", fontSize: 12, border: "none", borderRadius: 6,
        background: isValid && !saving ? "#1D9E75" : "#1a2e25",
        color: isValid && !saving ? "#fff" : "#fff",
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
  const [updateMode, setUpdateMode]     = useState("update");
  const [solvedBy, setSolvedBy]         = useState("");
  const [resolution, setResolution]     = useState("");
  const [saving, setSaving]             = useState(false);
  const [savedMsg, setSavedMsg]         = useState(false);
  const [newBizAdded, setNewBizAdded]   = useState({});
  const [supervisors, setSupervisors]   = useState([]);
  const [issueUpdatesList, setIssueUpdatesList] = useState([]);

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

  const allHistory      = summary.dpu_history ?? [];
  const indirectHistory = summary.indirect_labor_history ?? [];

  const now             = new Date();
  const currentMonthNum = now.getMonth();
  const currentYearNum  = now.getFullYear();
  const currentQuarter  = Math.floor(currentMonthNum / 3);
  const MONTHS          = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function computeWeekMetrics(weekStr) {
    const entry = allHistory.find(w => w.week === weekStr);
    if (!entry) return null;
    const laborEntry   = indirectHistory.find(r => r.week_start === weekStr);
    const weeklyTarget = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;
    const days         = laborEntry?.working_days ?? 5;
    const adjTarget    = weeklyTarget * (days / 5);
    const performance  = adjTarget > 0 ? (entry.trucks / adjTarget) * 100 : 0;
    const availability = laborEntry && laborEntry.total_labor_hours > 0
      ? ((laborEntry.total_labor_hours - laborEntry.indirect_hours - laborEntry.rework_hours) / laborEntry.total_labor_hours) * 100
      : 0;
    const quality = entry.dpu === 0 ? 0
      : entry.dpu <= goals.quarterly_dpu_goal ? 100
      : (goals.quarterly_dpu_goal / entry.dpu) * 100;
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
    return { trucks: entry.trucks, dpu: entry.dpu, availability, performance, quality, oee };
  }

  const currWeekStr        = allHistory[allHistory.length - 1]?.week ?? null;
  const prevWeekStr        = allHistory[allHistory.length - 2]?.week ?? null;
  const prevWeekDpu        = allHistory[allHistory.length - 2]?.dpu ?? null;
  const prevWeekReworkHours = (() => {
    if (!prevWeekStr) return null;
    const r = indirectHistory.find(r => r.week_start === prevWeekStr);
    return r ? r.rework_hours : null;
  })();
  const prevWeekTotalHours = (() => {
    if (!prevWeekStr) return null;
    const r = indirectHistory.find(r => r.week_start === prevWeekStr);
    return r ? r.total_labor_hours : null;
  })();
  const prevReworkPct = prevWeekTotalHours > 0 ? ((prevWeekReworkHours / prevWeekTotalHours) * 100).toFixed(1) : null;
  const currWeekMetrics = currWeekStr ? computeWeekMetrics(currWeekStr) : null;
  const prevWeekMetrics = prevWeekStr ? computeWeekMetrics(prevWeekStr) : null;

  // Trend arrow — used for the arrow/label only. Deliberately NOT used to
  // color a metric gray when it's "same" as last week, since a flat trend
  // can still be a bad number (e.g. 5 trucks both weeks, still under target).
  // Coloring is decided separately below, based on the actual goal/target.
  function trendArrow(curr, prevVal) {
    if (curr == null || prevVal == null) return { arrow: "", trend: null };
    if (curr > prevVal) return { arrow: "↑ ", trend: "up" };
    if (curr < prevVal) return { arrow: "↓ ", trend: "down" };
    return { arrow: "→ ", trend: "same" };
  }

  const oeeTrend    = trendArrow(currWeekMetrics?.oee,          prevWeekMetrics?.oee);
  const availTrend  = trendArrow(currWeekMetrics?.availability, prevWeekMetrics?.availability);
  const perfTrend   = trendArrow(currWeekMetrics?.performance,  prevWeekMetrics?.performance);
  const qualTrend   = trendArrow(currWeekMetrics?.quality,      prevWeekMetrics?.quality);
  const trucksTrend = trendArrow(currWeekMetrics?.trucks,       prevWeekMetrics?.trucks);

  const oeePrev    = prevWeekMetrics ? Math.round(prevWeekMetrics.oee * 10) / 10 : null;
  const availPrev  = prevWeekMetrics ? Math.round(prevWeekMetrics.availability * 10) / 10 : null;
  const perfPrev   = prevWeekMetrics ? Math.round(prevWeekMetrics.performance * 10) / 10 : null;
  const qualPrev   = prevWeekMetrics ? Math.round(prevWeekMetrics.quality * 10) / 10 : null;
  const trucksPrev = prevWeekMetrics ? Math.round(prevWeekMetrics.trucks * 10) / 10 : null;

  function computePeriodAverages(filterFn) {
    const periodWeeks    = allHistory.filter(w => filterFn(w.week));
    const periodIndirect = indirectHistory.filter(r => filterFn(r.week_start));
    if (periodWeeks.length === 0) return null;

    const totalTrucks  = periodWeeks.reduce((s, w) => s + w.trucks, 0);
    const totalDefects = periodWeeks.reduce((s, w) => s + w.dpu * w.trucks, 0);
    const avgDpu       = totalTrucks > 0 ? totalDefects / totalTrucks : 0;
    const avgTrucks    = totalTrucks / periodWeeks.length;
    const weeklyTarget = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;

    const perfByWeek = periodWeeks.map(w => {
      const laborEntry = periodIndirect.find(r => r.week_start === w.week);
      const days       = laborEntry?.working_days ?? 5;
      const adjusted   = weeklyTarget * (days / 5);
      return adjusted > 0 ? (w.trucks / adjusted) * 100 : 0;
    });
    const avgPerf = perfByWeek.length > 0 ? perfByWeek.reduce((a, b) => a + b, 0) / perfByWeek.length : 0;

    const avgAvail = periodIndirect.length > 0
      ? periodIndirect.reduce((s, r) => {
          const avail = r.total_labor_hours > 0
            ? ((r.total_labor_hours - r.indirect_hours - r.rework_hours) / r.total_labor_hours) * 100
            : 0;
          return s + avail;
        }, 0) / periodIndirect.length
      : 0;

    const avgQuality = avgDpu === 0 ? 0
      : avgDpu <= goals.quarterly_dpu_goal ? 100
      : goals.quarterly_dpu_goal / avgDpu * 100;

    const avgOee = avgAvail / 100 * avgPerf / 100 * avgQuality / 100 * 100;

    return { oee: avgOee, availability: avgAvail, performance: avgPerf, quality: avgQuality, trucks: avgTrucks, dpu: avgDpu };
  }

  function r(val) { return val != null ? Math.round(val * 10) / 10 : null; }

  const monthAvgRaw   = computePeriodAverages(dateStr => {
    const d = new Date(dateStr);
    return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
  });
  const quarterAvgRaw = computePeriodAverages(dateStr => {
    const d = new Date(dateStr);
    return d.getFullYear() === currentYearNum && Math.floor(d.getMonth() / 3) === currentQuarter;
  });

  const monthAvg   = monthAvgRaw   ? { oee: r(monthAvgRaw.oee),   availability: r(monthAvgRaw.availability),   performance: r(monthAvgRaw.performance),   quality: r(monthAvgRaw.quality),   trucks: r(monthAvgRaw.trucks),   dpu: r(monthAvgRaw.dpu)   } : null;
  const quarterAvg = quarterAvgRaw ? { oee: r(quarterAvgRaw.oee), availability: r(quarterAvgRaw.availability), performance: r(quarterAvgRaw.performance), quality: r(quarterAvgRaw.quality), trucks: r(quarterAvgRaw.trucks), dpu: r(quarterAvgRaw.dpu) } : null;

  function periodColor(val) {
    if (val == null) return "#fff";
    if (val >= 85)   return "#1D9E75";
    if (val < 60)    return "#E24B4A";
    return "#fff";
  }

  // Threshold-based color — always reflects whether the metric is actually
  // good or bad right now, regardless of whether it changed from last week.
  function thresholdColor(val) {
    if (val == null) return "#fff";
    if (val >= 85) return "#1D9E75";
    if (val >= 60) return "#fff";
    return "#E24B4A";
  }

  // Final card color: if the trend is a genuine up/down, use that (it
  // conveys "getting better/worse"). If the trend is flat ("same") or
  // unavailable, fall back to the threshold color so a stagnant BAD number
  // never gets colored neutral gray.
  function metricColor(trend, val) {
    if (trend.trend === "up")   return "#1D9E75";
    if (trend.trend === "down") return "#E24B4A";
    return thresholdColor(val);
  }

  const oeeColor   = metricColor(oeeTrend,   currWeekMetrics?.oee);
  const availColor = metricColor(availTrend, currWeekMetrics?.availability);
  const perfColor  = metricColor(perfTrend,  currWeekMetrics?.performance);
  const qualColor  = metricColor(qualTrend,  currWeekMetrics?.quality);

  // Trucks uses the min/max target range instead of the 85/60 thresholds.
  function trucksThresholdColor() {
    return summary.trucks_this_week >= goals.weekly_trucks_min ? "#1D9E75" : "#E24B4A";
  }
  const truckColor = trucksTrend.trend === "up"   ? "#1D9E75"
    : trucksTrend.trend === "down" ? "#E24B4A"
    : trucksThresholdColor();

  const dpuColor   = summary.avg_dpu_this_week === 0 ? "#fff"
    : summary.avg_dpu_this_week <= goals.quarterly_dpu_goal ? "#1D9E75" : "#E24B4A";

  const reworkHours = summary.last_week_rework_hours ?? 0;
  const totalHours  = summary.last_week_total_hours ?? 0;
  const reworkPct   = totalHours > 0 ? ((reworkHours / totalHours) * 100).toFixed(1) : "—";
  const reworkColor = parseFloat(reworkPct) > 10 ? "#E24B4A" : parseFloat(reworkPct) > 5 ? "#fff" : "#1D9E75";

  const currentIssue = issues[issueIdx] ?? null;
  const foremenAll   = ["Rick","Todd","Duey","Jordan","Dan","Joel","Willard","Eric","Brian","Ralph","QC","Others"];

  // Load the full update history whenever the current issue changes, so
  // Phase 2 can show every past update, not just a count. This effect must
  // stay AFTER currentIssue is defined above (it reads currentIssue.id).
  useEffect(() => {
    if (!currentIssue) { setIssueUpdatesList([]); return; }
    getIssueUpdates(currentIssue.id)
      .then(setIssueUpdatesList)
      .catch(err => console.error("Failed to load issue updates:", err));
  }, [currentIssue?.id]);

  function clearIssueState() {
    setUpdateText(""); setMadeBy(""); setSolvedBy(""); setResolution(""); setUpdateMode("update");
  }

  function nextStep() {
    if (phase === 1) { setPhase(2); setIssueIdx(0); clearIssueState(); }
    else if (phase === 2) {
      if (issueIdx < issues.length - 1) { setIssueIdx(i => i + 1); clearIssueState(); }
      else setPhase(3);
    } else { onClose(); if (onSaved) onSaved(); }
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
      const refreshed = await getIssueUpdates(currentIssue.id);
      setIssueUpdatesList(refreshed);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
      clearIssueState();
      if (onSaved) onSaved();
    } finally { setSaving(false); }
  }

  async function handleMarkSolved() {
    if (!resolution.trim() || !solvedBy || !currentIssue) return;
    setSaving(true);
    try {
      await updateIssue(currentIssue.id, { status: "solved", resolution_note: resolution.trim(), solved_by: solvedBy });
      if (!currentIssue.is_read) await markIssueRead(currentIssue.id);
      setIssues(prev => prev.filter(i => i.id !== currentIssue.id));
      clearIssueState();
      if (onSaved) onSaved();
    } finally { setSaving(false); }
  }

  const phaseLabel = phase === 1 ? "Phase 1 of 3 — Last week's numbers"
    : phase === 2 ? `Phase 2 of 3 — Issue review ${issues.length > 0 ? `(${issueIdx + 1} of ${issues.length})` : ""}`
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
      color: active ? "#fff" : "#fff",
      border: "none", fontFamily: "inherit", fontWeight: active ? 500 : 400,
    }),
    card: {
      background: "#1a1f2e", border: "0.5px solid #222a38",
      borderRadius: 10, padding: "16px 18px",
    },
    bigNum: (color) => ({
      fontSize: 44, fontWeight: 500, margin: "0 0 6px",
      color, lineHeight: 1,
    }),
    label: {
      fontSize: 10, color: "#fff", margin: "0 0 6px",
      textTransform: "uppercase", letterSpacing: "0.5px",
    },
    sub: { fontSize: 11, color: "#fff", margin: 0 },
    divider: { borderTop: "0.5px solid #252a38", marginTop: 10, paddingTop: 8 },
    periodRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
    periodLabel: { fontSize: 9, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" },
    periodVal: (color) => ({ fontSize: 12, fontWeight: 500, color: color ?? "#fff", margin: 0 }),
    btn: (bg, border, color) => ({
      padding: "7px 16px", fontSize: 12, border: border ? `1px solid ${border}` : "none",
      borderRadius: 7, background: bg, color, cursor: "pointer",
      fontFamily: "inherit", fontWeight: 500,
    }),
    select: {
      width: "100%", background: "#252a38", border: "0.5px solid #333",
      borderRadius: 6, color: "#fff", fontSize: 13, padding: "8px 10px",
      fontFamily: "inherit", boxSizing: "border-box",
    },
    textarea: {
      width: "100%", background: "#252a38", border: "0.5px solid #333",
      borderRadius: 6, color: "#fff", fontSize: 13, padding: "10px 12px",
      fontFamily: "inherit", resize: "none", boxSizing: "border-box",
    },
  };

  return (
    <div style={s.overlay}>

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75" }} />
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>Morning Huddle</span>
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
          <span style={{ fontSize: 12, color: "#fff" }}>{phaseLabel}</span>
          <button onClick={prevStep} style={s.btn("transparent", "#333", "#fff")}>← Back</button>
          <button onClick={nextStep} style={s.btn("#1D9E75", null, "#fff")}>{nextLabel}</button>
          <button onClick={onClose} style={s.btn("transparent", "#333", "#fff")}>Exit</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* PHASE 1 */}
        {phase === 1 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Overall Efficiency",  val: currWeekMetrics ? Math.round(currWeekMetrics.oee * 10) / 10 : 0,          color: oeeColor,   trend: oeeTrend,   prev: oeePrev,   moVal: monthAvg?.oee,          qVal: quarterAvg?.oee,          goal: `Goal: ≥${goals.alert_oee_min ?? 60}%`          },
                { label: "Availability", val: currWeekMetrics ? Math.round(currWeekMetrics.availability * 10) / 10 : 0, color: availColor, trend: availTrend, prev: availPrev, moVal: monthAvg?.availability, qVal: quarterAvg?.availability, goal: `Goal: ≥${goals.alert_availability_min ?? 50}%` },
                { label: "Performance",  val: currWeekMetrics ? Math.round(currWeekMetrics.performance * 10) / 10 : 0,  color: perfColor,  trend: perfTrend,  prev: perfPrev,  moVal: monthAvg?.performance,  qVal: quarterAvg?.performance,  goal: `Goal: ≥${goals.alert_performance_min ?? 50}%`  },
                { label: "Quality",      val: currWeekMetrics ? Math.round(currWeekMetrics.quality * 10) / 10 : 0,      color: qualColor,  trend: qualTrend,  prev: qualPrev,  moVal: monthAvg?.quality,      qVal: quarterAvg?.quality,      goal: `Goal: ≥${goals.alert_quality_min ?? 50}%`      },
              ].map(({ label, val, color, trend, prev, moVal, qVal, goal }) => (
                <div key={label} style={s.card}>
                  <p style={s.label}>{label}</p>
                  <p style={s.bigNum(color)}>{trend.arrow}{val}%</p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <p style={s.sub}>{goal}</p>
                    {prev != null && <p style={s.sub}>Prev Week: <span style={{ color: "#fff", fontWeight: 500 }}>{prev}%</span></p>}
                  </div>
                  <div style={s.divider}>
                    <div style={s.periodRow}>
                      <p style={s.periodLabel}>{MONTHS[currentMonthNum]} avg</p>
                      <p style={s.periodVal(periodColor(moVal))}>{moVal != null ? `${moVal}%` : "—"}</p>
                    </div>
                    <div style={s.periodRow}>
                      <p style={s.periodLabel}>Q{currentQuarter + 1} avg</p>
                      <p style={s.periodVal(periodColor(qVal))}>{qVal != null ? `${qVal}%` : "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={s.card}>
                <p style={s.label}>Trucks Last Week</p>
                <p style={s.bigNum(truckColor)}>{trucksTrend.arrow}{summary.trucks_this_week}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <p style={s.sub}>Target {goals.weekly_trucks_min}–{goals.weekly_trucks_max}</p>
                  {trucksPrev != null && <p style={s.sub}>Prev Week: <span style={{ color: "#fff", fontWeight: 500 }}>{trucksPrev}</span></p>}
                </div>
                <div style={s.divider}>
                  <div style={s.periodRow}>
                    <p style={s.periodLabel}>{MONTHS[currentMonthNum]} avg</p>
                    <p style={s.periodVal(monthAvg?.trucks != null && monthAvg.trucks >= goals.weekly_trucks_min ? "#1D9E75" : "#E24B4A")}>{monthAvg?.trucks != null ? monthAvg.trucks : "—"}</p>
                  </div>
                  <div style={s.periodRow}>
                    <p style={s.periodLabel}>Q{currentQuarter + 1} avg</p>
                    <p style={s.periodVal(quarterAvg?.trucks != null && quarterAvg.trucks >= goals.weekly_trucks_min ? "#1D9E75" : "#E24B4A")}>{quarterAvg?.trucks != null ? quarterAvg.trucks : "—"}</p>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <p style={s.label}>DPU Last Week</p>
                <p style={s.bigNum(dpuColor)}>{summary.avg_dpu_this_week === 0 ? "—" : summary.avg_dpu_this_week}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <p style={s.sub}>Goal: {goals.quarterly_dpu_goal} · Q{currentQuarter + 1}</p>
                  {prevWeekDpu != null && <p style={s.sub}>Prev: <span style={{ color: prevWeekDpu <= goals.quarterly_dpu_goal ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>{prevWeekDpu}</span></p>}
                </div>
                <div style={s.divider}>
                  <div style={s.periodRow}>
                    <p style={s.periodLabel}>{MONTHS[currentMonthNum]} avg</p>
                    <p style={s.periodVal(monthAvg?.dpu != null ? (monthAvg.dpu <= goals.quarterly_dpu_goal ? "#1D9E75" : "#E24B4A") : "#fff")}>{monthAvg?.dpu != null ? monthAvg.dpu : "—"}</p>
                  </div>
                  <div style={s.periodRow}>
                    <p style={s.periodLabel}>Q{currentQuarter + 1} avg</p>
                    <p style={s.periodVal(quarterAvg?.dpu != null ? (quarterAvg.dpu <= goals.quarterly_dpu_goal ? "#1D9E75" : "#E24B4A") : "#fff")}>{quarterAvg?.dpu != null ? quarterAvg.dpu : "—"}</p>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <p style={s.label}>Rework Hours</p>
                <p style={s.bigNum(reworkColor)}>{reworkHours}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                  <p style={s.sub}>of {totalHours} total hrs</p>
                  <p style={{ fontSize: 13, color: reworkColor, margin: 0, fontWeight: 500 }}>= {reworkPct}%</p>
                </div>
                {prevReworkPct != null && (
                  <p style={s.sub}>Prev Week: <span style={{ color: "#fff", fontWeight: 500 }}>{prevReworkPct}%</span></p>
                )}
              </div>
            </div>
          </>
        )}

        {/* PHASE 2 */}
        {phase === 2 && (
          issues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontSize: 18, color: "#fff", margin: 0 }}>No open issues to review</p>
            </div>
          ) : currentIssue && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 500, color: "#fff", margin: "0 0 4px" }}>{currentIssue.foreman_name}</p>
                  <p style={{ fontSize: 12, color: "#fff", margin: 0 }}>Issue {issueIdx + 1} of {issues.length}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { if (issueIdx > 0) { setIssueIdx(i => i - 1); clearIssueState(); } }}
                    disabled={issueIdx === 0}
                    style={{ ...s.btn("transparent", "#fff", "#fff"), opacity: issueIdx === 0 ? 0.4 : 1 }}>← Prev</button>
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
                  <span style={{ fontSize: 11, color: "#fff" }}>#{currentIssue.id}</span>
                  <span style={{ fontSize: 11, background: "#252a38", color: "#fff", padding: "2px 8px", borderRadius: 6 }}>
                    {currentIssue.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 11, color: currentIssue.status === "in_progress" ? "#E4A317" : "#E24B4A" }}>
                    {currentIssue.status === "in_progress" ? "In Progress" : "Open"}
                  </span>
                  <span style={{ fontSize: 11, color: "#fff" }}>
                    {(() => {
                      const diff = Math.floor((new Date() - new Date(currentIssue.created_at + "Z")) / (1000 * 60 * 60 * 24));
                      return diff <= 0 ? "Today" : `${diff}d old`;
                    })()}
                  </span>
                </div>
                <p style={{ fontSize: 20, color: "#fff", margin: "0 0 10px", fontWeight: 500 }}>{currentIssue.description}</p>

                {issueUpdatesList.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#fff", margin: 0 }}>No updates yet</p>
                ) : (
                  <div style={{ borderTop: "0.5px solid #252a38", paddingTop: 10, marginTop: 4 }}>
                    <p style={{ fontSize: 10, color: "#fff", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {issueUpdatesList.length} update{issueUpdatesList.length !== 1 ? "s" : ""} logged
                    </p>
                    <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                      {issueUpdatesList.map(u => (
                        <div key={u.id} style={{ background: "#0f1420", border: "0.5px solid #222a38", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: "#1D9E75" }}>
                              {u.made_by || "Unknown"}
                            </span>
                            <span style={{ fontSize: 10, color: "#fff" }}>
                              {new Date(u.created_at + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: "#fff", margin: 0, whiteSpace: "pre-wrap" }}>{u.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button onClick={() => setUpdateMode("update")} style={{
                    flex: 1, padding: "7px 6px", borderRadius: 7, fontSize: 12,
                    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${updateMode === "update" ? "#1D9E75" : "#333"}`,
                    background: updateMode === "update" ? "#0a2e22" : "transparent",
                    color: updateMode === "update" ? "#1D9E75" : "#fff",
                  }}>Add Update</button>
                  <button onClick={() => setUpdateMode("solve")} style={{
                    flex: 1, padding: "7px 6px", borderRadius: 7, fontSize: 12,
                    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${updateMode === "solve" ? "#E24B4A" : "#333"}`,
                    background: updateMode === "solve" ? "#2e0a0a" : "transparent",
                    color: updateMode === "solve" ? "#E24B4A" : "#fff",
                  }}>Mark Solved</button>
                </div>

                {updateMode === "update" && (
                  <>
                    <p style={{ fontSize: 10, color: "#fff", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Add update from huddle
                    </p>
                    <select value={madeBy} onChange={e => setMadeBy(e.target.value)} style={{ ...s.select, marginBottom: 8 }}>
                      <option value="">Who is making this update?</option>
                      {supervisors.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <textarea value={updateText} onChange={e => setUpdateText(e.target.value)}
                      placeholder="Type update here..." rows={2} style={s.textarea} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <button onClick={handleSaveUpdate} disabled={!updateText.trim() || !madeBy || saving}
                        style={{ ...s.btn("#1D9E75", null, "#fff"), opacity: !updateText.trim() || !madeBy ? 0.5 : 1 }}>
                        {saving ? "Saving…" : "Save update"}
                      </button>
                      <button onClick={() => { clearIssueState(); setIssueIdx(i => Math.min(i + 1, issues.length - 1)); }}
                        style={s.btn("transparent", "#333", "#fff")}>Skip</button>
                      {savedMsg && <span style={{ fontSize: 12, color: "#1D9E75", marginLeft: 4 }}>Saved ✓</span>}
                    </div>
                  </>
                )}

                {updateMode === "solve" && (
                  <>
                    <p style={{ fontSize: 10, color: "#fff", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Mark as solved
                    </p>
                    <select value={solvedBy} onChange={e => setSolvedBy(e.target.value)} style={{ ...s.select, marginBottom: 8 }}>
                      <option value="">Who solved this issue?</option>
                      {supervisors.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <textarea value={resolution} onChange={e => setResolution(e.target.value)}
                      placeholder="Describe how this was resolved…" rows={2} style={s.textarea} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <button onClick={handleMarkSolved} disabled={!resolution.trim() || !solvedBy || saving}
                        style={{ ...s.btn("#E24B4A", null, "#fff"), opacity: !resolution.trim() || !solvedBy ? 0.5 : 1 }}>
                        {saving ? "Saving…" : "Mark solved"}
                      </button>
                      <button onClick={() => { clearIssueState(); setIssueIdx(i => Math.min(i + 1, issues.length - 1)); }}
                        style={s.btn("transparent", "#333", "#fff")}>Skip</button>
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
            <p style={{ fontSize: 16, color: "#fff", margin: "0 0 20px" }}>Does anyone have anything new to add?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {foremenAll.map(f => (
                <div key={f} style={{ ...s.card }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: newBizAdded[f] === "open" ? 10 : 0 }}>
                    <span style={{ fontSize: 15, color: "#fff" }}>{f}</span>
                    <button
                      onClick={() => setNewBizAdded(prev => ({ ...prev, [f]: prev[f] === "open" ? null : "open" }))}
                      style={{
                        padding: "4px 12px", fontSize: 11, borderRadius: 6,
                        border: `1px solid ${newBizAdded[f] === "saved" ? "#1D9E75" : newBizAdded[f] === "open" ? "#fff" : "#333"}`,
                        background: "transparent",
                        color: newBizAdded[f] === "saved" ? "#1D9E75" : newBizAdded[f] === "open" ? "#fff" : "#fff",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      {newBizAdded[f] === "saved" ? "✓ Added" : newBizAdded[f] === "open" ? "Cancel" : "+ Add"}
                    </button>
                  </div>
                  {newBizAdded[f] === "open" && (
                    <NewBizEntry foremanName={f} onSaved={() => {
                      setNewBizAdded(prev => ({ ...prev, [f]: "saved" }));
                      if (onSaved) onSaved();
                    }} />
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