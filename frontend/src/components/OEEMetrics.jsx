import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { getGoalHistory } from "../api/issues";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fafafa", borderRadius: 8,
      padding: "14px 16px", border: "0.5px solid #eee",
    }}>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: color ?? "#1a1a1a" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function getLastWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff - 7);
  return monday.toISOString().split("T")[0];
}

export default function OEEMetrics({ summary }) {
  if (!summary) return null;

  const { goals } = summary;
  const today          = new Date();
  const currentYear    = today.getFullYear();
  const currentMonth   = today.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  const allHistory      = summary.dpu_history ?? [];
  const indirectHistory = summary.indirect_labor_history ?? [];

  const [goalHistory, setGoalHistory] = useState([]);

  useEffect(() => {
    getGoalHistory()
      .then(data => setGoalHistory(data))
      .catch(err => console.error("goal history error:", err));
  }, []);

  // Card period state
  const [period, setPeriod]     = useState("week");
  const [cardYear, setCardYear] = useState(currentYear);
  const [cardSub, setCardSub]   = useState(currentQuarter);

  // Chart period state
  const [dpuFilter, setDpuFilter]       = useState("quarter");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSub, setSelectedSub]   = useState(currentQuarter);

  // --- Available periods ---

  const availableYears = useMemo(() => {
    const years = new Set(allHistory.map(w => new Date(w.week).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [allHistory]);

  const cardAvailableQuarters = useMemo(() => {
    const qs = new Set(allHistory
      .filter(w => new Date(w.week).getFullYear() === cardYear)
      .map(w => Math.floor(new Date(w.week).getMonth() / 3)));
    return [...qs].sort((a, b) => a - b);
  }, [allHistory, cardYear]);

  const cardAvailableMonths = useMemo(() => {
    const ms = new Set(allHistory
      .filter(w => new Date(w.week).getFullYear() === cardYear)
      .map(w => new Date(w.week).getMonth()));
    return [...ms].sort((a, b) => a - b);
  }, [allHistory, cardYear]);

  const availableQuarters = useMemo(() => {
    const qs = new Set(allHistory
      .filter(w => new Date(w.week).getFullYear() === selectedYear)
      .map(w => Math.floor(new Date(w.week).getMonth() / 3)));
    return [...qs].sort((a, b) => a - b);
  }, [allHistory, selectedYear]);

  const availableMonths = useMemo(() => {
    const ms = new Set(allHistory
      .filter(w => new Date(w.week).getFullYear() === selectedYear)
      .map(w => new Date(w.week).getMonth()));
    return [...ms].sort((a, b) => a - b);
  }, [allHistory, selectedYear]);

  // --- Year change handlers ---

  function onCardYearChange(year) {
    setCardYear(year);
    if (period === "quarter") {
      const qs = [...new Set(allHistory
        .filter(w => new Date(w.week).getFullYear() === year)
        .map(w => Math.floor(new Date(w.week).getMonth() / 3)))].sort((a,b) => a-b);
      setCardSub(qs[qs.length - 1] ?? 0);
    } else if (period === "month") {
      const ms = [...new Set(allHistory
        .filter(w => new Date(w.week).getFullYear() === year)
        .map(w => new Date(w.week).getMonth()))].sort((a,b) => a-b);
      setCardSub(ms[ms.length - 1] ?? 0);
    }
  }

  function onYearChange(year) {
    setSelectedYear(year);
    if (dpuFilter === "quarter") {
      const qs = [...new Set(allHistory
        .filter(w => new Date(w.week).getFullYear() === year)
        .map(w => Math.floor(new Date(w.week).getMonth() / 3)))].sort((a,b) => a-b);
      setSelectedSub(qs[qs.length - 1] ?? 0);
    } else if (dpuFilter === "month") {
      const ms = [...new Set(allHistory
        .filter(w => new Date(w.week).getFullYear() === year)
        .map(w => new Date(w.week).getMonth()))].sort((a,b) => a-b);
      setSelectedSub(ms[ms.length - 1] ?? 0);
    }
  }

  // --- Filtered chart history ---

  const filteredHistory = useMemo(() => {
    return allHistory.filter(w => {
      const d = new Date(w.week);
      if (d.getFullYear() !== selectedYear) return false;
      if (dpuFilter === "quarter") return Math.floor(d.getMonth() / 3) === selectedSub;
      if (dpuFilter === "month")   return d.getMonth() === selectedSub;
      return true;
    });
  }, [allHistory, dpuFilter, selectedYear, selectedSub]);

  const bestWeek      = filteredHistory.length > 0 ? [...filteredHistory].sort((a,b) => a.dpu - b.dpu)[0]  : null;
  const worstWeek     = filteredHistory.length > 0 ? [...filteredHistory].sort((a,b) => b.dpu - a.dpu)[0] : null;
  const showBestWorst = bestWeek && worstWeek && bestWeek.week !== worstWeek.week;

  function getChartPeriodLabel() {
    if (dpuFilter === "quarter") return `Q${selectedSub + 1} ${selectedYear}`;
    if (dpuFilter === "month")   return `${MONTHS[selectedSub]} ${selectedYear}`;
    return `${selectedYear}`;
  }

  // --- Goal lookups ---

  const chartGoal = useMemo(() => {
    const sorted = [...goalHistory].sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    function lookup(dateStr) {
      if (!sorted.length) return goals;
      let active = sorted[0];
      for (const g of sorted) {
        if (g.effective_date <= dateStr) active = g;
        else break;
      }
      return active;
    }

    if (dpuFilter === "ytd") {
      return sorted.length ? sorted[sorted.length - 1] : goals;
    }
    const midWeek = filteredHistory[Math.floor(filteredHistory.length / 2)]?.week;
    if (!midWeek) return goals;
    return lookup(midWeek);
  }, [dpuFilter, goalHistory, filteredHistory, goals]);

  const periodGoal = useMemo(() => {
    const sorted = [...goalHistory].sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    function lookup(dateStr) {
      if (!sorted.length) return goals;
      let active = sorted[0];
      for (const g of sorted) {
        if (g.effective_date <= dateStr) active = g;
        else break;
      }
      return active;
    }

    let targetDate;
    if (period === "week") {
      targetDate = getLastWeekStart();
    } else if (period === "month") {
      targetDate = `${cardYear}-${String(cardSub + 1).padStart(2, "0")}-01`;
    } else if (period === "quarter") {
      targetDate = `${cardYear}-${String(cardSub * 3 + 1).padStart(2, "0")}-01`;
    } else {
      const descSorted = [...goalHistory].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
      return descSorted.length ? descSorted[0] : goals;
    }
    return lookup(targetDate);
  }, [goalHistory, period, cardYear, cardSub, goals]);

  // --- Period card data ---

  const periodData = useMemo(() => {
    if (period === "week") {
      const last = allHistory[allHistory.length - 1]?.dpu ?? 0;
      const prev = allHistory[allHistory.length - 2]?.dpu ?? null;
      return {
        label:        `Last week (${getLastWeekStart()})`,
        oee:          summary.oee,
        availability: summary.availability,
        performance:  summary.performance,
        quality:      summary.quality,
        trucks:       summary.trucks_this_week,
        dpu:          summary.avg_dpu_this_week,
        dpuArrow:     prev === null ? "" : last < prev ? "↓ " : last > prev ? "↑ " : "→ ",
        dpuColor:     prev === null ? "#888" : last < prev ? "#1D9E75" : last > prev ? "#A32D2D" : "#888",
        trucksLabel:  "Trucks last week",
        dpuLabel:     "DPU last week",
        trucksSub:    `Target: ${goals.weekly_trucks_min}–${goals.weekly_trucks_max}`,
        dpuSub:       "vs previous week",
      };
    }

    const filterWeeks = (weeks) => weeks.filter(w => {
      const d = new Date(w.week);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      if (period === "month")   return yr === cardYear && mo === cardSub;
      if (period === "quarter") return yr === cardYear && Math.floor(mo / 3) === cardSub;
      if (period === "ytd")     return yr === cardYear;
      return false;
    });

    const periodWeeks  = filterWeeks(allHistory);
    const totalTrucks  = periodWeeks.reduce((s, w) => s + w.trucks, 0);
    const totalDefects = periodWeeks.reduce((s, w) => s + w.dpu * w.trucks, 0);
    const avgDpu       = totalTrucks > 0 ? Math.round((totalDefects / totalTrucks) * 100) / 100 : 0;
    const avgTrucks    = periodWeeks.length > 0 ? Math.round((totalTrucks / periodWeeks.length) * 10) / 10 : 0;
    const weeklyTarget = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;
    const avgPerf      = weeklyTarget > 0 ? Math.round(avgTrucks / weeklyTarget * 100 * 10) / 10 : 0;

    const filterIndirect = (logs) => logs.filter(r => {
      const d = new Date(r.week_start);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      if (period === "month")   return yr === cardYear && mo === cardSub;
      if (period === "quarter") return yr === cardYear && Math.floor(mo / 3) === cardSub;
      if (period === "ytd")     return yr === cardYear;
      return false;
    });

    const periodIndirect = filterIndirect(indirectHistory);
    const avgAvail = periodIndirect.length > 0
      ? Math.round(
          periodIndirect.reduce((s, r) => {
            const avail = r.total_labor_hours > 0
              ? ((r.total_labor_hours - r.indirect_hours - r.rework_hours) / r.total_labor_hours) * 100
              : 0;
            return s + avail;
          }, 0) / periodIndirect.length * 10
        ) / 10
      : 0;

    const avgQuality = avgDpu === 0 ? 0
      : avgDpu <= periodGoal.quarterly_dpu_goal ? 100
      : Math.round(periodGoal.quarterly_dpu_goal / avgDpu * 100 * 10) / 10;

    const avgOee = Math.round(avgAvail / 100 * avgPerf / 100 * avgQuality / 100 * 100 * 10) / 10;

    const periodLabels = {
      month:   `${MONTHS[cardSub]} ${cardYear}`,
      quarter: `Q${cardSub + 1} ${cardYear}`,
      ytd:     `Full year ${cardYear}`,
    };

    return {
      label:        `Showing: ${periodLabels[period]}`,
      oee:          avgOee,
      availability: avgAvail,
      performance:  avgPerf,
      quality:      avgQuality,
      trucks:       avgTrucks,
      dpu:          avgDpu,
      dpuArrow:     "",
      dpuColor:     avgDpu === 0 ? "#aaa" : avgDpu <= periodGoal.quarterly_dpu_goal ? "#1D9E75" : "#A32D2D",
      trucksLabel:  "Avg trucks / week",
      dpuLabel:     "Avg DPU",
      trucksSub:    `Target: ${goals.weekly_trucks_min}–${goals.weekly_trucks_max}`,
      dpuSub:       `${periodLabels[period]} average`,
    };
  }, [period, summary, allHistory, indirectHistory, goals, cardYear, cardSub, periodGoal]);

  // --- Colors ---

  const oeeColor    = periodData.oee >= 85 ? "#1D9E75" : periodData.oee >= 60 ? "#854F0B" : "#A32D2D";
  const availColor  = periodData.availability >= 85 ? "#1D9E75" : "#854F0B";
  const perfColor   = periodData.performance >= 85 ? "#1D9E75" : "#854F0B";
  const qualColor   = periodData.quality >= 85 ? "#1D9E75" : "#854F0B";
  const trucksColor = periodData.trucks >= goals.weekly_trucks_min ? "#1D9E75" : "#A32D2D";

  const btnStyle = (active) => ({
    padding: "5px 12px", fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? "#1D9E75" : "#eee"}`,
    borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
    background: active ? "#E1F5EE" : "#fff",
    color: active ? "#0F6E56" : "#888",
  });

  const subSelectStyle = {
    padding: "4px 8px", fontSize: 11,
    border: "1px solid #eee", borderRadius: 6,
    fontFamily: "inherit", background: "#fff", color: "#555",
  };

  return (
    <div>

      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>OEE Overview</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {availableYears.length > 1 && period !== "week" && (
            <select value={cardYear} onChange={e => onCardYearChange(Number(e.target.value))} style={subSelectStyle}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            {["week", "month", "quarter", "ytd"].map(p => (
              <button key={p} onClick={() => {
                setPeriod(p);
                if (p === "quarter") {
                  const qs = [...new Set(allHistory
                    .filter(w => new Date(w.week).getFullYear() === cardYear)
                    .map(w => Math.floor(new Date(w.week).getMonth() / 3)))].sort((a,b) => a-b);
                  setCardSub(qs[qs.length - 1] ?? currentQuarter);
                } else if (p === "month") {
                  const ms = [...new Set(allHistory
                    .filter(w => new Date(w.week).getFullYear() === cardYear)
                    .map(w => new Date(w.week).getMonth()))].sort((a,b) => a-b);
                  setCardSub(ms[ms.length - 1] ?? currentMonth);
                } else if (p === "ytd") {
                  setCardYear(currentYear);
                }
              }} style={btnStyle(period === p)}>
                {p === "week" ? "Last week" : p === "month" ? "Month" : p === "quarter" ? "Quarter" : "Full year"}
              </button>
            ))}
          </div>
          {period === "quarter" && cardAvailableQuarters.length > 0 && (
            <select value={cardSub} onChange={e => setCardSub(Number(e.target.value))} style={subSelectStyle}>
              {cardAvailableQuarters.map(q => <option key={q} value={q}>Q{q + 1} {cardYear}</option>)}
            </select>
          )}
          {period === "month" && cardAvailableMonths.length > 0 && (
            <select value={cardSub} onChange={e => setCardSub(Number(e.target.value))} style={subSelectStyle}>
              {cardAvailableMonths.map(m => <option key={m} value={m}>{MONTHS[m]} {cardYear}</option>)}
            </select>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 14px" }}>{periodData.label}</p>

      {/* Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
        <MetricCard label="Overall OEE"  value={`${periodData.oee}%`}          sub={period === "week" ? "Last week" : "Period avg"} color={oeeColor} />
        <MetricCard label="Availability" value={`${periodData.availability}%`} sub="Excl. indirect and rework"                      color={availColor} />
        <MetricCard label="Performance"  value={`${periodData.performance}%`}  sub="Actual vs target"                               color={perfColor} />
        <MetricCard label="Quality"      value={`${periodData.quality}%`}      sub="Goal ÷ actual DPU"                              color={qualColor} />
      </div>

      {/* Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Quarterly DPU</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: periodData.dpu === 0 ? "#aaa" : periodData.dpu <= periodGoal.quarterly_dpu_goal ? "#1D9E75" : "#A32D2D" }}>
            {periodData.dpu === 0 ? "—" : periodData.dpu}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
              Goal: <span style={{ fontWeight: 500, color: "#555" }}>{periodGoal.quarterly_dpu_goal}</span>
            </p>
            {period === "week" && summary.last_quarter_dpu > 0 && (
              <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
                Last Q: <span style={{ fontWeight: 500, color: summary.last_quarter_dpu <= (summary.last_quarter_dpu_goal ?? periodGoal.quarterly_dpu_goal) ? "#1D9E75" : "#A32D2D" }}>
                  {summary.last_quarter_dpu}
                </span>
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Yearly DPU</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: summary.yearly_dpu === 0 ? "#aaa" : summary.yearly_dpu <= periodGoal.annual_dpu_goal ? "#1D9E75" : "#A32D2D" }}>
            {summary.yearly_dpu === 0 ? "—" : summary.yearly_dpu}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
              Goal: <span style={{ fontWeight: 500, color: "#555" }}>{periodGoal.annual_dpu_goal}</span>
            </p>
            {period === "week" && summary.last_year_dpu > 0 && (
              <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
                Last yr: <span style={{ fontWeight: 500, color: summary.last_year_dpu <= (summary.last_year_dpu_goal ?? periodGoal.annual_dpu_goal) ? "#1D9E75" : "#A32D2D" }}>
                  {summary.last_year_dpu}
                </span>
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{periodData.trucksLabel}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: trucksColor }}>
            {periodData.trucks}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{periodData.trucksSub}</p>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{periodData.dpuLabel}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: periodData.dpuColor }}>
            {periodData.dpu === 0 ? "—" : `${periodData.dpuArrow}${periodData.dpu}`}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{periodData.dpuSub}</p>
        </div>

      </div>

      {/* DPU Chart */}
      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>Weekly DPU Trend</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {availableYears.length > 1 && (
              <select value={selectedYear} onChange={e => onYearChange(Number(e.target.value))} style={subSelectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              {["month", "quarter", "ytd"].map(f => (
                <button key={f} onClick={() => {
                  setDpuFilter(f);
                  if (f === "quarter") {
                    const qs = [...new Set(allHistory
                      .filter(w => new Date(w.week).getFullYear() === selectedYear)
                      .map(w => Math.floor(new Date(w.week).getMonth() / 3)))].sort((a,b) => a-b);
                    setSelectedSub(qs[qs.length - 1] ?? currentQuarter);
                  } else if (f === "month") {
                    const ms = [...new Set(allHistory
                      .filter(w => new Date(w.week).getFullYear() === selectedYear)
                      .map(w => new Date(w.week).getMonth()))].sort((a,b) => a-b);
                    setSelectedSub(ms[ms.length - 1] ?? currentMonth);
                  }
                }} style={btnStyle(dpuFilter === f)}>
                  {f === "month" ? "Month" : f === "quarter" ? "Quarter" : "Full year"}
                </button>
              ))}
            </div>
            {dpuFilter === "quarter" && availableQuarters.length > 0 && (
              <select value={selectedSub} onChange={e => setSelectedSub(Number(e.target.value))} style={subSelectStyle}>
                {availableQuarters.map(q => <option key={q} value={q}>Q{q + 1} {selectedYear}</option>)}
              </select>
            )}
            {dpuFilter === "month" && availableMonths.length > 0 && (
              <select value={selectedSub} onChange={e => setSelectedSub(Number(e.target.value))} style={subSelectStyle}>
                {availableMonths.map(m => <option key={m} value={m}>{MONTHS[m]} {selectedYear}</option>)}
              </select>
            )}
          </div>
        </div>

        {showBestWorst && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "#0F6E56", margin: "0 0 2px" }}>Best week — {getChartPeriodLabel()}</p>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#1D9E75", margin: 0 }}>{bestWeek.dpu} DPU</p>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Week of {bestWeek.week}</p>
            </div>
            <div style={{ flex: 1, background: "#FCEBEB", border: "0.5px solid #E24B4A", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "#A32D2D", margin: "0 0 2px" }}>Worst week — {getChartPeriodLabel()}</p>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#A32D2D", margin: 0 }}>{worstWeek.dpu} DPU</p>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Week of {worstWeek.week}</p>
            </div>
          </div>
        )}

        {filteredHistory.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={filteredHistory}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={chartGoal.annual_dpu_goal} stroke="#D4A017" strokeDasharray="4 3"
                  label={{ value: `Annual: ${chartGoal.annual_dpu_goal}`, position: "insideTopRight", fontSize: 10, fill: "#D4A017" }} />
                <ReferenceLine y={chartGoal.quarterly_dpu_goal} stroke="#854F0B" strokeDasharray="4 3"
                  label={{ value: `Quarterly: ${chartGoal.quarterly_dpu_goal}`, position: "insideBottomRight", fontSize: 10, fill: "#854F0B" }} />
                <Line type="monotone" dataKey="dpu" stroke="#378ADD" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>

            <div style={{ marginTop: 12, borderTop: "0.5px solid #f0f0f0", paddingTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                    <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left" }}>Week</th>
                    <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "right" }}>Trucks</th>
                    <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "right" }}>DPU</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredHistory].reverse().map((w) => {
                    const color = w.trend === "down" ? "#1D9E75" : w.trend === "up" ? "#A32D2D" : "#888";
                    const arrow = w.trend === "down" ? "↓" : w.trend === "up" ? "↑" : w.trend === "same" ? "→" : "";
                    return (
                      <tr key={w.week} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                        <td style={{ padding: "5px 8px", color: "#555" }}>{w.week}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: w.trucks >= 14 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{w.trucks}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 500, color }}>{arrow} {w.dpu}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "40px 0" }}>No data for this period</p>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: "#888", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: "#D4A017" }}>— Annual goal ({chartGoal.annual_dpu_goal})</span>
          <span style={{ color: "#854F0B" }}>— Quarterly goal ({chartGoal.quarterly_dpu_goal})</span>
          <span style={{ color: "#1D9E75" }}>↓ Improved</span>
          <span style={{ color: "#A32D2D" }}>↑ Worsened</span>
          <span style={{ color: "#888" }}>→ No change</span>
        </div>
      </div>

    </div>
  );
}