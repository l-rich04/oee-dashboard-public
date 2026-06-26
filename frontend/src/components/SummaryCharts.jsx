import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

const COLORS = {
  open:        "#E24B4A",
  in_progress: "#EF9F27",
  solved:      "#1D9E75",
};

const BAR_COLOR = "#378ADD";

function toChartData(obj) {
  return Object.entries(obj).map(([name, value]) => ({
    name: name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }));
}

function SimpleBar({ data, colorByName = false }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={colorByName
                ? (COLORS[entry.name.toLowerCase().replace(/ /g, "_")] ?? BAR_COLOR)
                : BAR_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SummaryCharts({ summary, issues }) {
  if (!summary) return null;

  function avgAgeByCategory(issues) {
    const groups = {};
    issues.forEach(issue => {
      const days = Math.floor(
        (new Date() - new Date(issue.created_at + "Z")) / (1000 * 60 * 60 * 24)
      );
      if (!groups[issue.category]) groups[issue.category] = [];
      groups[issue.category].push(days);
    });
    return Object.entries(groups).map(([name, ages]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      value: Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
    })).sort((a, b) => b.value - a.value);
  }

  const categoryData = toChartData(summary.by_category)
    .sort((a, b) => b.value - a.value);

  const foremanData = toChartData(summary.by_foreman)
    .sort((a, b) => b.value - a.value);

  const typeData   = toChartData(summary.by_type);
  const statusData = toChartData(summary.by_status);
  const ageData    = avgAgeByCategory(issues);

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>
        Overview
      </h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 24,
      }}>

        <div style={cardStyle}>
          <p style={chartTitle}>Issues By Category</p>
          <SimpleBar data={categoryData} />
        </div>

        <div style={cardStyle}>
          <p style={chartTitle}>Issues By Foreman</p>
          <SimpleBar data={foremanData} />
        </div>

        <div style={cardStyle}>
          <p style={chartTitle}>Part vs Process</p>
          <SimpleBar data={typeData} />
        </div>

        <div style={cardStyle}>
          <p style={chartTitle}>Issues By Status</p>
          <SimpleBar data={statusData} colorByName />
        </div>

        <div style={cardStyle}>
          <p style={chartTitle}>Avg Age By Category (Days)</p>
          <SimpleBar data={ageData} />
        </div>

      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  padding: "20px 16px 8px",
};

const chartTitle = {
  fontSize: 13,
  fontWeight: 500,
  color: "#555",
  marginBottom: 8,
};