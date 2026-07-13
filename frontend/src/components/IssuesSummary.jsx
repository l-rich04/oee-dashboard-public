import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const CHART_COLORS = ["#1D9E75", "#378ADD", "#E24B4A", "#854F0B", "#533AB7", "#0F6E56", "#A32D2D", "#0C447C"];

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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

  const openIssues    = issues.filter(i => i.status !== "solved");
  const inProgress    = issues.filter(i => i.status === "in_progress");
  const newThisPeriod = periodIssues.filter(i => i.status !== "solved");
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

  // Full category breakdown, used for the pie chart below.
  const allCategoryCounts = useMemo(() => {
    const counts = {};
    periodIssues.forEach(i => {
      counts[i.category] = (counts[i.category] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: titleCase(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [periodIssues]);

  const totalPeriodIssues = allCategoryCounts.reduce((sum, c) => sum + c.value, 0);

  const maxForeman = foremanCounts.length > 0 ? foremanCounts[0].total : 1;

  const btnStyle = (active) => ({
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
    border: `1px solid ${active ? "#1D9E75" : "#eee"}`,
    borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
    background: active ? "#E1F5EE" : "#fff",
    color: active ? "#0F6E56" : "#888",
  });

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>Issues overview</p>
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
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: openIssues.length > 0 ? "#A32D2D" : "#1D9E75" }}>
            {openIssues.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Active Issues</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>In Progress</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: inProgress.length > 0 ? "#854F0B" : "#1D9E75" }}>
            {inProgress.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Being Worked On</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>New {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#333" }}>
            {newThisPeriod.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Opened This Period</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Solved {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#1D9E75" }}>
            {solvedThisPeriod.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Closed This Period</p>
        </div>
      </div>

      {/* Foreman breakdown + top categories */}
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

      {/* Category Analysis — pie chart only */}
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
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "40px 0" }}>
            No issues for this period.
          </p>
        ) : (
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={allCategoryCounts} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {allCategoryCounts.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Issues"]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px", marginTop: 8 }}>
              {allCategoryCounts.map((entry, index) => (
                <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[index % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: "#555" }}>{entry.name}</span>
                  <span style={{ color: "#888" }}>({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}