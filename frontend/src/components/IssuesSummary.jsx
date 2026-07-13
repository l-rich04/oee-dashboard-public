import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Cell,
} from "recharts";

const CHART_COLORS = ["#1D9E75", "#378ADD", "#E24B4A", "#854F0B", "#533AB7", "#0F6E56", "#A32D2D", "#0C447C"];

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function ResolutionChart({ solvedIssues }) {
  const [view, setView] = useState("category");

  const data = useMemo(() => {
    if (!solvedIssues || solvedIssues.length === 0) return { byCategory: [], byForeman: [] };

    const catMap = {};
    const fMap   = {};

    solvedIssues.forEach(i => {
      const days = (new Date(i.updated_at + "Z") - new Date(i.created_at + "Z")) / (1000 * 60 * 60 * 24);
      const cat  = titleCase(i.category);
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(days);
      if (!fMap[i.foreman_name]) fMap[i.foreman_name] = [];
      fMap[i.foreman_name].push(days);
    });

    const toRows = (map) => Object.entries(map)
      .map(([name, days]) => ({
        name,
        avg:   Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10,
        count: days.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    return { byCategory: toRows(catMap), byForeman: toRows(fMap) };
  }, [solvedIssues]);

  const chartData = view === "category" ? data.byCategory : data.byForeman;
  const maxAvg    = chartData.length > 0 ? Math.max(...chartData.map(d => d.avg)) : 1;

  const btnStyle = (active) => ({
    padding: "3px 8px", fontSize: 10, fontWeight: 500,
    border: `1px solid ${active ? "#378ADD" : "#eee"}`,
    borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
    background: active ? "#E6F1FB" : "#fff",
    color: active ? "#0C447C" : "#888",
  });

  const ResTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>{label}</p>
        <p style={{ margin: "0 0 2px", color: "#378ADD" }}>Avg: <strong>{d?.avg} days</strong></p>
        <p style={{ margin: 0, color: "#888" }}>{d?.count} issue{d?.count !== 1 ? "s" : ""} resolved</p>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button onClick={() => setView("category")} style={btnStyle(view === "category")}>By Category</button>
        <button onClick={() => setView("foreman")}  style={btnStyle(view === "foreman")}>By Foreman</button>
      </div>
      {chartData.length === 0 ? (
        <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", paddingTop: 60 }}>No resolved issues for this period.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.min(Math.max(chartData.length * 36 + 40, 160), 240)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}d`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip content={<ResTooltip />} />
              <Bar dataKey="avg" name="Avg Days" radius={[0, 3, 3, 0]}
                label={{ position: "right", fontSize: 10, fill: "#888", formatter: v => `${v}d` }}>
                {chartData.map(entry => (
                  <Cell key={entry.name} fill={
                    entry.avg > maxAvg * 0.66 ? "#E24B4A" :
                    entry.avg > maxAvg * 0.33 ? "#854F0B" : "#1D9E75"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 10, color: "#aaa", margin: "6px 0 0" }}>
            Green = fast · Amber = moderate · Red = slow
          </p>
        </>
      )}
    </>
  );
}

export default function IssuesSummary({ issues, period, onPeriodChange }) {
  const today = new Date();

  const periodStart = useMemo(() => {
    if (period === "week") {
      const d = new Date(today);
      d.setDate(today.getDate() - 7);
      return d;
    }
    if (period === "month") return new Date(today.getFullYear(), today.getMonth(), 1);
    if (period === "ytd")   return new Date(today.getFullYear(), 0, 1);
    return null;
  }, [period]);

  const periodIssues = useMemo(() => {
    if (!periodStart) return issues;
    return issues.filter(i => new Date(i.created_at + "Z") >= periodStart);
  }, [issues, periodStart]);

  const openIssues       = issues.filter(i => i.status !== "solved");
  const inProgress       = issues.filter(i => i.status === "in_progress");
  const newThisPeriod    = periodIssues.filter(i => i.status !== "solved");
  const solvedThisPeriod = useMemo(() => {
    if (!periodStart) return issues.filter(i => i.status === "solved");
    return issues.filter(i => i.status === "solved" && new Date(i.updated_at + "Z") >= periodStart);
  }, [issues, periodStart]);

  const periodLabel = period === "week" ? "This week" : period === "month" ? "This month" : "This year";

  const foremanCounts = useMemo(() => {
    const counts = {};
    openIssues.forEach(i => {
      if (!counts[i.foreman_name]) counts[i.foreman_name] = { open: 0, inProg: 0 };
      counts[i.foreman_name].open++;
      if (i.status === "in_progress") counts[i.foreman_name].inProg++;
    });
    return Object.entries(counts)
      .map(([name, c]) => ({ name, ...c, total: c.open }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [openIssues]);

  const allCategoryCounts = useMemo(() => {
    const counts = {};
    periodIssues.forEach(i => {
      counts[i.category] = (counts[i.category] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: titleCase(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [periodIssues]);

  const paretoData = useMemo(() => {
    const total = allCategoryCounts.reduce((s, c) => s + c.value, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return allCategoryCounts.map((c, i) => {
      cumulative += c.value;
      return {
        name:       c.name,
        count:      c.value,
        pct:        Math.round((c.value / total) * 100),
        cumPct:     Math.round((cumulative / total) * 100),
        fill:       CHART_COLORS[i % CHART_COLORS.length],
        eightyLine: 80,
      };
    });
  }, [allCategoryCounts]);

  const totalPeriodIssues = allCategoryCounts.reduce((sum, c) => sum + c.value, 0);
  const maxForeman        = foremanCounts.length > 0 ? foremanCounts[0].total : 1;

  const btnStyle = (active) => ({
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
    border: `1px solid ${active ? "#1D9E75" : "#eee"}`,
    borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
    background: active ? "#E1F5EE" : "#fff",
    color: active ? "#0F6E56" : "#888",
  });

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

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>Issues Overview</p>
        <div style={{ display: "flex", gap: 4 }}>
          {["week", "month", "ytd"].map(p => (
            <button key={p} onClick={() => onPeriodChange(p)} style={btnStyle(period === p)}>
              {p === "week" ? "Weekly" : p === "month" ? "MTD" : "YTD"}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Total Open</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: openIssues.length > 0 ? "#A32D2D" : "#1D9E75" }}>{openIssues.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Active Issues</p>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>In Progress</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: inProgress.length > 0 ? "#854F0B" : "#1D9E75" }}>{inProgress.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Being Worked On</p>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>New {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#333" }}>{newThisPeriod.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Opened This Period</p>
        </div>
        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Solved {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#1D9E75" }}>{solvedThisPeriod.length}</p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Closed This Period</p>
        </div>
      </div>

      {/* Foreman breakdown */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, padding: "16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 12px" }}>Open Issues by Foreman</p>
          {foremanCounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "16px 0" }}>No Open Issues</p>
          ) : (
            foremanCounts.map(f => (
              <div key={f.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>{f.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {f.inProg > 0 && (
                      <span style={{ fontSize: 10, background: "#FAEEDA", color: "#854F0B", padding: "1px 6px", borderRadius: 8, fontWeight: 500 }}>
                        {f.inProg} In Progress
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "#888" }}>{f.total}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(f.total / maxForeman * 100)}%`, background: "#E24B4A", borderRadius: 4 }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category Analysis — Pareto + Resolution Time */}
      <div style={{ border: "0.5px solid #eee", borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: "0 0 16px" }}>
          Category Analysis
          {totalPeriodIssues > 0 && (
            <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>
              ({totalPeriodIssues} total issue{totalPeriodIssues !== 1 ? "s" : ""})
            </span>
          )}
        </p>

        {allCategoryCounts.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "40px 0" }}>No issues for this period.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>

            {/* LEFT — Pareto */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 4px" }}>Pareto — by Category</p>
              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>Sorted most → least · Cumulative % line</p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={paretoData} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} height={48} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ParetoTooltip />} />
                  <Bar yAxisId="left" dataKey="count" name="Count" shape={<CustomBar />} />
                  <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#E24B4A" strokeWidth={2} dot={{ r: 3, fill: "#E24B4A" }} />
                  <Line yAxisId="right" type="monotone" data={paretoData.map(d => ({ ...d, eightyLine: 80 }))} dataKey="eightyLine" name="80% Threshold" stroke="#aaa" strokeWidth={1} strokeDasharray="5 4" dot={false} legendType="line" />
                </ComposedChart>
              </ResponsiveContainer>
              {(() => {
                const lastUnder = paretoData.findIndex(d => d.cumPct > 80);
                const vital = lastUnder === -1 ? paretoData : paretoData.slice(0, lastUnder + 1);
                if (vital.length === 0 || vital.length === paretoData.length) return null;
                return (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8, fontSize: 11, color: "#0F6E56" }}>
                    <strong>Vital few:</strong> {vital.map(d => d.name).join(", ")} account for {vital[vital.length - 1].cumPct}% of all issues this period.
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#378ADD", display: "inline-block" }} />Count</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#E24B4A", display: "inline-block" }} />Cumulative %</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, borderTop: "2px dashed #aaa", display: "inline-block" }} />80% Threshold</span>
              </div>
            </div>

            {/* RIGHT — Resolution Time */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 2px" }}>Avg Resolution Time</p>
              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>Days from open to solved — {periodLabel.toLowerCase()}</p>
              <ResolutionChart solvedIssues={solvedThisPeriod} />
            </div>

          </div>
        )}
      </div>

    </div>
  );
}