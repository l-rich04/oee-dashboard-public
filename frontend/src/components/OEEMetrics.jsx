import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine
} from "recharts";

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

export default function OEEMetrics({ summary }) {
  if (!summary) return null;

  const { goals } = summary;

  const today          = new Date();
  const currentYear    = today.getFullYear();
  const currentMonth   = today.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  const allHistory = summary.dpu_history ?? [];

  const availableYears = useMemo(() => {
    const years = new Set(allHistory.map(w => new Date(w.week).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }, [allHistory]);

  const [dpuFilter, setDpuFilter]       = useState("quarter");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSub, setSelectedSub]   = useState(currentQuarter);

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

  function onFilterChange(f) {
    setDpuFilter(f);
    if (f === "quarter") setSelectedSub(currentQuarter);
    if (f === "month")   setSelectedSub(currentMonth);
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

  function getPeriodLabel() {
    if (dpuFilter === "quarter") return `Q${selectedSub + 1} ${selectedYear}`;
    if (dpuFilter === "month")   return `${MONTHS[selectedSub]} ${selectedYear}`;
    return `${selectedYear}`;
  }

  const oeeColor       = summary.oee >= 85 ? "#1D9E75" : summary.oee >= 60 ? "#854F0B" : "#A32D2D";
  const quarterlyColor = summary.quarterly_dpu === 0 ? "#aaa" : summary.quarterly_dpu <= goals.quarterly_dpu_goal ? "#1D9E75" : "#A32D2D";
  const yearlyColor    = summary.yearly_dpu === 0 ? "#aaa" : summary.yearly_dpu <= goals.annual_dpu_goal ? "#1D9E75" : "#A32D2D";
  const trucksColor    = summary.trucks_this_week >= goals.weekly_trucks_min ? "#1D9E75" : "#A32D2D";

  const dpuHistory    = summary.dpu_history ?? [];
  const lastWeekEntry = dpuHistory[dpuHistory.length - 1];
  const prevWeekEntry = dpuHistory[dpuHistory.length - 2];
  const dpuLastWeek   = lastWeekEntry?.dpu ?? 0;
  const dpuPrevWeek   = prevWeekEntry?.dpu ?? null;

  const dpuLastWeekArrow = dpuLastWeek === 0 ? ""
    : dpuPrevWeek !== null && dpuLastWeek < dpuPrevWeek ? "↓ "
    : dpuPrevWeek !== null && dpuLastWeek > dpuPrevWeek ? "↑ "
    : "→ ";

  const dpuLastWeekColor = dpuLastWeek === 0 ? "#aaa"
    : dpuPrevWeek !== null && dpuLastWeek < dpuPrevWeek ? "#1D9E75"
    : dpuPrevWeek !== null && dpuLastWeek > dpuPrevWeek ? "#A32D2D"
    : "#888";

  const btnStyle = (active) => ({
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
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

      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12, marginBottom: 24 }}>
        <MetricCard label="Overall OEE"  value={`${summary.oee}%`}          sub="Last week"                   color={oeeColor} />
        <MetricCard label="Availability" value={`${summary.availability}%`} sub="Excl. rework hours"          color={summary.availability >= 85 ? "#1D9E75" : "#854F0B"} />
        <MetricCard label="Performance"  value={`${summary.performance}%`}  sub="Actual vs target"            color={summary.performance >= 85 ? "#1D9E75" : "#854F0B"} />
        <MetricCard label="Quality"      value={`${summary.quality}%`}      sub="Quarterly goal ÷ actual DPU" color={summary.quality >= 85 ? "#1D9E75" : "#854F0B"} />

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Quarterly DPU</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: quarterlyColor }}>
            {summary.quarterly_dpu === 0 ? "—" : summary.quarterly_dpu}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
              Goal: <span style={{ fontWeight: 500, color: "#555" }}>{goals.quarterly_dpu_goal}</span>
            </p>
            {summary.last_quarter_dpu > 0 && (
              <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
                Last Q: <span style={{ fontWeight: 500, color: summary.last_quarter_dpu <= (summary.last_quarter_dpu_goal ?? goals.quarterly_dpu_goal) ? "#1D9E75" : "#A32D2D" }}>
                  {summary.last_quarter_dpu}
                </span>
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Yearly DPU</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: yearlyColor }}>
            {summary.yearly_dpu === 0 ? "—" : summary.yearly_dpu}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
              Goal: <span style={{ fontWeight: 500, color: "#555" }}>{goals.annual_dpu_goal}</span>
            </p>
            {summary.last_year_dpu > 0 && (
              <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
                Last yr: <span style={{ fontWeight: 500, color: summary.last_year_dpu <= (summary.last_year_dpu_goal ?? goals.annual_dpu_goal) ? "#1D9E75" : "#A32D2D" }}>
                  {summary.last_year_dpu}
                </span>
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Trucks Last Week</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: trucksColor }}>
            {summary.trucks_this_week}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
            <p style={{ fontSize: 11, margin: 0, color: "#888" }}>
              Target: <span style={{ fontWeight: 500, color: "#555" }}>{goals.weekly_trucks_min}–{goals.weekly_trucks_max}</span>
            </p>
          </div>
        </div>

        <div style={{ background: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "0.5px solid #eee" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>DPU Last Week</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: dpuLastWeekColor }}>
            {dpuLastWeek === 0 ? "—" : `${dpuLastWeekArrow}${dpuLastWeek}`}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Last week</p>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: "0 0 16px" }}>Downtime By Machine (mins)</p>
          {Object.keys(summary.downtime_by_machine).length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={Object.entries(summary.downtime_by_machine).map(([k, v]) => ({ name: k, value: v }))}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#378ADD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "60px 0" }}>No downtime logged yet</p>
          )}
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
                  <button key={f} onClick={() => onFilterChange(f)} style={btnStyle(dpuFilter === f)}>
                    {f === "month" ? "Month" : f === "quarter" ? "Quarter" : "Full Year"}
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
                <p style={{ fontSize: 11, color: "#0F6E56", margin: "0 0 2px" }}>Best week — {getPeriodLabel()}</p>
                <p style={{ fontSize: 16, fontWeight: 500, color: "#1D9E75", margin: 0 }}>{bestWeek.dpu} DPU</p>
                <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Week of {bestWeek.week}</p>
              </div>
              <div style={{ flex: 1, background: "#FCEBEB", border: "0.5px solid #E24B4A", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: "#A32D2D", margin: "0 0 2px" }}>Worst week — {getPeriodLabel()}</p>
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
                  <ReferenceLine y={goals.annual_dpu_goal} stroke="#D4A017" strokeDasharray="4 3"
                    label={{ value: `Annual: ${goals.annual_dpu_goal}`, position: "insideTopRight", fontSize: 10, fill: "#D4A017" }} />
                  <ReferenceLine y={goals.quarterly_dpu_goal} stroke="#854F0B" strokeDasharray="4 3"
                    label={{ value: `Quarterly: ${goals.quarterly_dpu_goal}`, position: "insideBottomRight", fontSize: 10, fill: "#854F0B" }} />
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
                          <td style={{ padding: "5px 8px", textAlign: "right", color: w.trucks >= 14 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>
                            {w.trucks}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 500, color }}>
                            {arrow} {w.dpu}
                          </td>
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
            <span style={{ color: "#D4A017" }}>— Annual goal ({goals.annual_dpu_goal})</span>
            <span style={{ color: "#854F0B" }}>— Quarterly goal ({goals.quarterly_dpu_goal})</span>
            <span style={{ color: "#1D9E75" }}>↓ Improved</span>
            <span style={{ color: "#A32D2D" }}>↑ Worsened</span>
            <span style={{ color: "#888" }}>→ No change</span>
          </div>
        </div>

      </div>
    </div>
  );
}