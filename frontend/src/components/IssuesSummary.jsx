import { useMemo } from "react";

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

  const categoryCounts = useMemo(() => {
    const counts = {};
    periodIssues.forEach(i => {
      counts[i.category] = (counts[i.category] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [periodIssues]);

  const maxForeman  = foremanCounts.length  > 0 ? foremanCounts[0].total   : 1;
  const maxCategory = categoryCounts.length > 0 ? categoryCounts[0].count  : 1;

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
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Total open</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: openIssues.length > 0 ? "#A32D2D" : "#1D9E75" }}>
            {openIssues.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Active issues</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>In progress</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: inProgress.length > 0 ? "#854F0B" : "#1D9E75" }}>
            {inProgress.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Being worked on</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>New {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#333" }}>
            {newThisPeriod.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Opened this period</p>
        </div>

        <div style={{ background: "#fafafa", border: "0.5px solid #eee", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>Solved {periodLabel.toLowerCase()}</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#1D9E75" }}>
            {solvedThisPeriod.length}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Closed this period</p>
        </div>
      </div>

      {/* Foreman breakdown + top categories */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, padding: "16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 12px" }}>Open issues by foreman</p>
          {foremanCounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "16px 0" }}>No open issues</p>
          ) : (
            foremanCounts.map(f => (
              <div key={f.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>{f.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {f.inProg > 0 && (
                      <span style={{ fontSize: 10, background: "#FAEEDA", color: "#854F0B", padding: "1px 6px", borderRadius: 8, fontWeight: 500 }}>
                        {f.inProg} in progress
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

        <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, padding: "16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 12px" }}>Top categories — {periodLabel.toLowerCase()}</p>
          {categoryCounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "16px 0" }}>No issues this period</p>
          ) : (
            categoryCounts.map(c => (
              <div key={c.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>{titleCase(c.name)}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>{c.count}</span>
                </div>
                <div style={{ height: 6, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(c.count / maxCategory * 100)}%`, background: "#378ADD", borderRadius: 4 }} />
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}