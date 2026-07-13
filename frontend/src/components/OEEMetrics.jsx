import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { getGoalHistory } from "../api/issues";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function MetricCard({ label, value, sub, color, prevLabel, prevValue }) {
  return (
    <div style={{
      background: "#fafafa", borderRadius: 8,
      padding: "14px 16px", border: "0.5px solid #eee",
    }}>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: color ?? "#1a1a1a" }}>{value}</p>
      {prevValue != null ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {sub && <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{sub}</p>}
          <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
            {prevLabel ?? "Prev"}: <span style={{ fontWeight: 500, color: "#555" }}>{prevValue}</span>
          </p>
        </div>
      ) : (
        sub && <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{sub}</p>
      )}
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

  const lastHistoryEntry   = allHistory[allHistory.length - 1];
  const lastHistoryYear    = lastHistoryEntry ? new Date(lastHistoryEntry.week).getFullYear() : currentYear;
  const lastHistoryQuarter = lastHistoryEntry ? Math.floor(new Date(lastHistoryEntry.week).getMonth() / 3) : currentQuarter;

  const [goalHistory, setGoalHistory] = useState([]);

  useEffect(() => {
    getGoalHistory()
      .then(data => setGoalHistory(data))
      .catch(err => console.error("goal history error:", err));
  }, []);

  const [period, setPeriod]     = useState("week");
  const [cardYear, setCardYear] = useState(lastHistoryYear);
  const [cardSub, setCardSub]   = useState(lastHistoryQuarter);

  const [dpuFilter, setDpuFilter]       = useState("quarter");
  const [selectedYear, setSelectedYear] = useState(lastHistoryYear);
  const [selectedSub, setSelectedSub]   = useState(lastHistoryQuarter);

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
    if (dpuFilter === "ytd") return sorted.length ? sorted[sorted.length - 1] : goals;
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

  const periodData = useMemo(() => {
    if (period === "week") {
      const last = allHistory[allHistory.length - 1]?.dpu ?? 0;
      const prev = allHistory[allHistory.length - 2]?.dpu ?? null;

      // Compute Availability / Performance / Quality / OEE for a single given week,
      // using the same formulas as the multi-week period averages below,
      // so last week and the week before it are calculated the same way.
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
          : entry.dpu <= periodGoal.quarterly_dpu_goal ? 100
          : (periodGoal.quarterly_dpu_goal / entry.dpu) * 100;
        const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
        return { trucks: entry.trucks, availability, performance, quality, oee };
      }

      const currWeekStr = allHistory[allHistory.length - 1]?.week ?? null;
      const prevWeekStr = allHistory[allHistory.length - 2]?.week ?? null;
      const currMetrics = currWeekStr ? computeWeekMetrics(currWeekStr) : null;
      const prevMetrics = prevWeekStr ? computeWeekMetrics(prevWeekStr) : null;

      function trendArrow(curr, prevVal) {
        if (curr == null || prevVal == null) return { arrow: "", color: "#888" };
        if (curr > prevVal) return { arrow: "↑ ", color: "#1D9E75" };
        if (curr < prevVal) return { arrow: "↓ ", color: "#A32D2D" };
        return { arrow: "→ ", color: "#888" };
      }

      const oeeTrend    = trendArrow(currMetrics?.oee, prevMetrics?.oee);
      const availTrend  = trendArrow(currMetrics?.availability, prevMetrics?.availability);
      const perfTrend   = trendArrow(currMetrics?.performance, prevMetrics?.performance);
      const qualTrend   = trendArrow(currMetrics?.quality, prevMetrics?.quality);
      const trucksTrend = trendArrow(currMetrics?.trucks, prevMetrics?.trucks);

      return {
        label:        `Last Week (${getLastWeekStart()})`,
        oee:          summary.oee,
        availability: summary.availability,
        performance:  summary.performance,
        quality:      summary.quality,
        trucks:       summary.trucks_this_week,
        dpu:          summary.avg_dpu_this_week,
        dpuArrow:     prev === null ? "" : last < prev ? "↓ " : last > prev ? "↑ " : "→ ",
        dpuColor:     prev === null ? "#888" : last < prev ? "#1D9E75" : last > prev ? "#A32D2D" : "#888",
        oeeArrow:        oeeTrend.arrow,    oeeTrendColor:    oeeTrend.color,
        availArrow:      availTrend.arrow,  availTrendColor:  availTrend.color,
        perfArrow:       perfTrend.arrow,   perfTrendColor:   perfTrend.color,
        qualArrow:       qualTrend.arrow,   qualTrendColor:   qualTrend.color,
        trucksArrow:     trucksTrend.arrow, trucksTrendColor: trucksTrend.color,
        oeePrev:      prevMetrics ? Math.round(prevMetrics.oee * 10) / 10 : null,
        availPrev:    prevMetrics ? Math.round(prevMetrics.availability * 10) / 10 : null,
        perfPrev:     prevMetrics ? Math.round(prevMetrics.performance * 10) / 10 : null,
        qualPrev:     prevMetrics ? Math.round(prevMetrics.quality * 10) / 10 : null,
        trucksPrev:   prevMetrics ? Math.round(prevMetrics.trucks * 10) / 10 : null,
        prevLabel:    "Prev WK",
        trucksLabel:  "Trucks Last Week",
        dpuLabel:     "DPU Last Week",
        trucksSub:    `Target: ${goals.weekly_trucks_min}–${goals.weekly_trucks_max}`,
        dpuSub:       "vs Previous Week",
      };
    }

    // Compute Availability / Performance / Quality / OEE / Trucks / DPU averaged
    // over all weeks that fall in a given month / quarter / year.
    function computePeriodAverages(periodType, year, sub) {
      const filterWeeks = (weeks) => weeks.filter(w => {
        const d = new Date(w.week);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        if (periodType === "month")   return yr === year && mo === sub;
        if (periodType === "quarter") return yr === year && Math.floor(mo / 3) === sub;
        if (periodType === "ytd")     return yr === year;
        return false;
      });
      const filterIndirect = (logs) => logs.filter(r => {
        const d = new Date(r.week_start);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        if (periodType === "month")   return yr === year && mo === sub;
        if (periodType === "quarter") return yr === year && Math.floor(mo / 3) === sub;
        if (periodType === "ytd")     return yr === year;
        return false;
      });

      const periodWeeks    = filterWeeks(allHistory);
      const periodIndirect = filterIndirect(indirectHistory);
      if (periodWeeks.length === 0) return null;

      const totalTrucks  = periodWeeks.reduce((s, w) => s + w.trucks, 0);
      const totalDefects = periodWeeks.reduce((s, w) => s + w.dpu * w.trucks, 0);
      const avgDpu        = totalTrucks > 0 ? totalDefects / totalTrucks : 0;
      const avgTrucksRaw   = totalTrucks / periodWeeks.length;
      const weeklyTarget  = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2;

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
        : avgDpu <= periodGoal.quarterly_dpu_goal ? 100
        : periodGoal.quarterly_dpu_goal / avgDpu * 100;

      const avgOee = avgAvail / 100 * avgPerf / 100 * avgQuality / 100 * 100;

      return { oee: avgOee, availability: avgAvail, performance: avgPerf, quality: avgQuality, trucks: avgTrucksRaw, dpu: avgDpu };
    }

    function trendArrow(curr, prevVal) {
      if (curr == null || prevVal == null) return { arrow: "", color: "#888" };
      if (curr > prevVal) return { arrow: "↑ ", color: "#1D9E75" };
      if (curr < prevVal) return { arrow: "↓ ", color: "#A32D2D" };
      return { arrow: "→ ", color: "#888" };
    }

    function getPrevPeriodKey(periodType, year, sub) {
      if (periodType === "month") {
        let m = sub - 1, y = year;
        if (m < 0) { m = 11; y -= 1; }
        return { year: y, sub: m };
      }
      if (periodType === "quarter") {
        let q = sub - 1, y = year;
        if (q < 0) { q = 3; y -= 1; }
        return { year: y, sub: q };
      }
      // ytd — compare to the prior year
      return { year: year - 1, sub: 0 };
    }

    const current  = computePeriodAverages(period, cardYear, cardSub);
    const prevKey  = getPrevPeriodKey(period, cardYear, cardSub);
    const previous = computePeriodAverages(period, prevKey.year, prevKey.sub);

    const oeeTrend    = trendArrow(current?.oee, previous?.oee);
    const availTrend  = trendArrow(current?.availability, previous?.availability);
    const perfTrend   = trendArrow(current?.performance, previous?.performance);
    const qualTrend   = trendArrow(current?.quality, previous?.quality);
    const trucksTrend = trendArrow(current?.trucks, previous?.trucks);

    const avgDpu    = current ? Math.round(current.dpu * 100) / 100 : 0;
    const avgTrucks = current ? Math.round(current.trucks * 10) / 10 : 0;
    const avgPerf   = current ? Math.round(current.performance * 10) / 10 : 0;
    const avgAvail  = current ? Math.round(current.availability * 10) / 10 : 0;
    const avgQuality = current ? Math.round(current.quality * 10) / 10 : 0;
    const avgOee    = current ? Math.round(current.oee * 10) / 10 : 0;

    const periodLabels = {
      month:   `${MONTHS[cardSub]} ${cardYear}`,
      quarter: `Q${cardSub + 1} ${cardYear}`,
      ytd:     `Full Year ${cardYear}`,
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
      oeeArrow:        oeeTrend.arrow,    oeeTrendColor:    oeeTrend.color,
      availArrow:      availTrend.arrow,  availTrendColor:  availTrend.color,
      perfArrow:       perfTrend.arrow,   perfTrendColor:   perfTrend.color,
      qualArrow:       qualTrend.arrow,   qualTrendColor:   qualTrend.color,
      trucksArrow:     trucksTrend.arrow, trucksTrendColor: trucksTrend.color,
      oeePrev:      previous ? Math.round(previous.oee * 10) / 10 : null,
      availPrev:    previous ? Math.round(previous.availability * 10) / 10 : null,
      perfPrev:     previous ? Math.round(previous.performance * 10) / 10 : null,
      qualPrev:     previous ? Math.round(previous.quality * 10) / 10 : null,
      trucksPrev:   previous ? Math.round(previous.trucks * 10) / 10 : null,
      prevLabel:    period === "month" ? "Last MO" : period === "quarter" ? "Last Q" : "Last YR",
      trucksLabel:  "Avg Trucks / Week",
      dpuLabel:     "Avg DPU",
      trucksSub:    `Target: ${goals.weekly_trucks_min}–${goals.weekly_trucks_max}`,
      dpuSub:       `${periodLabels[period]} Average`,
    };
  }, [period, summary, allHistory, indirectHistory, goals, cardYear, cardSub, periodGoal]);

  const oeeColor    = periodData.oeeArrow    ? periodData.oeeTrendColor    : (periodData.oee >= 85 ? "#1D9E75" : periodData.oee >= 60 ? "#854F0B" : "#A32D2D");
  const availColor  = periodData.availArrow  ? periodData.availTrendColor  : (periodData.availability >= 85 ? "#1D9E75" : "#854F0B");
  const perfColor   = periodData.perfArrow   ? periodData.perfTrendColor   : (periodData.performance >= 85 ? "#1D9E75" : "#854F0B");
  const qualColor   = periodData.qualArrow   ? periodData.qualTrendColor   : (periodData.quality >= 85 ? "#1D9E75" : "#854F0B");
  const trucksColor = periodData.trucksArrow ? periodData.trucksTrendColor : (periodData.trucks >= goals.weekly_trucks_min ? "#1D9E75" : "#A32D2D");

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
        <MetricCard label="Overall Efficiency"  value={`${periodData.oeeArrow ?? ""}${periodData.oee}%`}          sub={period === "week" ? "Last Week" : "Period AVG"} color={oeeColor} prevLabel={periodData.prevLabel} prevValue={periodData.oeePrev != null ? `${periodData.oeePrev}%` : null} />
        <MetricCard label="Availability" value={`${periodData.availArrow ?? ""}${periodData.availability}%`} sub="Downtime / Total Labor Hours"                   color={availColor} prevLabel={periodData.prevLabel} prevValue={periodData.availPrev != null ? `${periodData.availPrev}%` : null} />
        <MetricCard label="Performance"  value={`${periodData.perfArrow ?? ""}${periodData.performance}%`}  sub="Actual vs Target"                               color={perfColor} prevLabel={periodData.prevLabel} prevValue={periodData.perfPrev != null ? `${periodData.perfPrev}%` : null} />
        <MetricCard label="Quality"      value={`${periodData.qualArrow ?? ""}${periodData.quality}%`}      sub="Goal / Actual DPU"                              color={qualColor} prevLabel={periodData.prevLabel} prevValue={periodData.qualPrev != null ? `${periodData.qualPrev}%` : null} />
      </div>

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
            {periodData.trucksArrow ?? ""}{periodData.trucks}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{periodData.trucksSub}</p>
            {periodData.trucksPrev != null && (
              <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
                {periodData.prevLabel}: <span style={{ fontWeight: 500, color: "#555" }}>{periodData.trucksPrev}</span>
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{periodData.dpuLabel}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: periodData.dpuColor }}>
            {periodData.dpu === 0 ? "—" : `${periodData.dpuArrow}${periodData.dpu}`}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{periodData.dpuSub}</p>
        </div>

      </div>

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
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                      <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "left", background: "#fff", position: "sticky", top: 0 }}>Week</th>
                      <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "right", background: "#fff", position: "sticky", top: 0 }}>Trucks</th>
                      <th style={{ padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "right", background: "#fff", position: "sticky", top: 0 }}>DPU</th>
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