import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

const COLORS = ["#378ADD", "#1D9E75", "#854F0B", "#E24B4A", "#6C63FF", "#F4A261"];

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function shortLabel(str) {
  const map = {
    "Supplier Issue":      "Supplier Issue",
    "Missing Part":        "Missing Part",
    "Defective Part":      "Defective Part",
    "Quality Check Fail":  "QC Fail",
    "In House Damage":     "In House Damage",
    "Wrong Specification": "Wrong Specification",
    "Machine Breakdown":   "Machine Breakdown",
    "Setup Error":         "Setup Error",
    "Safety Stop":         "Safety Stop",
    "Lack Of Process":     "Lack Of Process",
    "Part Issue":          "Part Issue",
    "Process Issue":       "Process Issue",
    "In Progress":         "In Prog",
  };
  return map[str] ?? str;
}

function Chart({ title, data, color }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #eee",
      borderRadius: 12, padding: 10, overflow: "visible",
    }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 10px" }}>{title}</p>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: -50 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            tickLine={false}
            height={140}
            angle={-90}
            textAnchor="end"
            dx={-4}
          />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color ?? COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SummaryCharts({ summary, issues, onPeriodChange }) {
  const [period, setPeriod] = useState("ytd");

  function handlePeriod(p) {
    setPeriod(p);
    if (onPeriodChange) onPeriodChange(p);
  }

  if (!summary) return null;

  const byCategory = Object.entries(summary.by_category ?? {})
    .map(([k, v]) => ({ name: shortLabel(titleCase(k)), value: v }))
    .sort((a, b) => b.value - a.value);

  const byForeman = Object.entries(summary.by_foreman ?? {})
    .map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => b.value - a.value);

  const byType = Object.entries(summary.by_type ?? {})
    .map(([k, v]) => ({ name: shortLabel(titleCase(k)), value: v }));

  const byStatus = Object.entries(summary.by_status ?? {})
    .map(([k, v]) => ({ name: shortLabel(titleCase(k)), value: v }));

  const avgAge = Object.entries(
    (issues ?? []).reduce((acc, issue) => {
      const created = new Date(issue.created_at + "Z");
      const age = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
      if (!acc[issue.category]) acc[issue.category] = { total: 0, count: 0 };
      acc[issue.category].total += age;
      acc[issue.category].count += 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: shortLabel(titleCase(k)), value: Math.round(v.total / v.count) }))
    .sort((a, b) => b.value - a.value);

  const periodLabel = period === "weekly" ? "Last 7 Days"
    : period === "mtd" ? "Month to Date"
    : "Year to Date";

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: 0 }}>
          Overview <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400 }}>— {periodLabel}</span>
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {["weekly", "mtd", "ytd"].map(p => (
            <button key={p} onClick={() => handlePeriod(p)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 500,
              border: `1px solid ${period === p ? "#1D9E75" : "#eee"}`,
              borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              background: period === p ? "#E1F5EE" : "#fff",
              color: period === p ? "#0F6E56" : "#888",
            }}>
              {p === "weekly" ? "Weekly" : p === "mtd" ? "MTD" : "YTD"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
        <Chart title="Issues By Category"        data={byCategory} />
        <Chart title="Issues By Foreman"          data={byForeman} />
        <Chart title="Part vs Process"            data={byType}     color="#378ADD" />
        <Chart title="Issues By Status"           data={byStatus} />
        <Chart title="Avg Age By Category (Days)" data={avgAge}     color="#854F0B" />
      </div>
    </div>
  );
}