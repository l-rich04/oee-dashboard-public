import { useState, useMemo } from "react";
import {
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

// Simple least-squares linear regression — no external library needed for
// something this small. Returns {slope, intercept} for y = slope*x + intercept.
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function InsightsPanel({ summary }) {
  const [compareVar, setCompareVar] = useState("rework");
  const [weeksBack, setWeeksBack] = useState(8);
  const [weeksForward, setWeeksForward] = useState(4);

  const dpuHistory      = summary?.dpu_history ?? [];
  const indirectHistory = summary?.indirect_labor_history ?? [];
  const quarterlyGoal   = summary?.goals?.quarterly_dpu_goal ?? null;

  // --- Forecast chart data ---
  const isValidWeek = (w) => /^\d{4}-\d{2}-\d{2}$/.test(w?.week ?? "");

  const forecastData = useMemo(() => {
    const recent = dpuHistory.filter(w => w.trucks > 0 && isValidWeek(w)).slice(-weeksBack);
    if (recent.length < 3) return { rows: [], crossesGoalAt: null };

    const points = recent.map((w, i) => ({ x: i, y: w.dpu }));
    const reg = linearRegression(points);
    if (!reg) return { rows: [], crossesGoalAt: null };

    const rows = recent.map(w => ({ week: w.week, actual: w.dpu, forecast: null }));
    // Repeat the last actual point on the forecast series too, so the
    // dashed line visually connects to the solid one instead of jumping.
    rows[rows.length - 1].forecast = rows[rows.length - 1].actual;

    // "Meeting goal" means DPU is at or below the goal — lower DPU is
    // better. A crossing only matters relative to where you currently
    // stand: if you're already under goal, crossing further down isn't
    // news; if you're under goal and rising, crossing ABOVE it is a
    // warning; if you're over goal and falling, crossing below it is good
    // news. Comparing the predicted value to the goal in isolation can't
    // tell these apart.
    const lastActual = rows[rows.length - 1].actual;
    const currentlyMeetingGoal = quarterlyGoal != null ? lastActual <= quarterlyGoal : null;

    let crossesGoalAt = null;
    for (let i = 1; i <= weeksForward; i++) {
      const x = recent.length - 1 + i;
      const predicted = Math.max(0, reg.slope * x + reg.intercept);
      rows.push({ week: `+${i}wk`, actual: null, forecast: Math.round(predicted * 100) / 100 });
      if (quarterlyGoal != null && crossesGoalAt === null) {
        const predictedMeetsGoal = predicted <= quarterlyGoal;
        if (predictedMeetsGoal !== currentlyMeetingGoal) crossesGoalAt = i;
      }
    }

    return {
      rows,
      crossesGoalAt,
      currentlyMeetingGoal,
      trendDirection: reg.slope < 0 ? "improving" : reg.slope > 0 ? "worsening" : "flat",
    };
  }, [dpuHistory, quarterlyGoal, weeksBack, weeksForward]);

  // --- Correlation chart data ---
  const compareOptions = [
    { value: "rework", label: "Rework Hours",   getX: (labor) => labor?.rework_hours },
    { value: "trucks", label: "Trucks Produced", getX: (labor, dpu) => dpu?.trucks },
    { value: "days",   label: "Working Days",   getX: (labor) => labor?.working_days },
  ];
  const activeOption = compareOptions.find(o => o.value === compareVar);

  const scatterData = useMemo(() => {
    return dpuHistory
      .filter(w => w.trucks > 0 && isValidWeek(w))
      .map(w => {
        const labor = indirectHistory.find(r => r.week_start === w.week);
        const x = activeOption.getX(labor, w);
        return x != null ? { x, y: w.dpu, week: w.week } : null;
      })
      .filter(Boolean);
  }, [dpuHistory, indirectHistory, activeOption]);

  const CorrelationTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>Week of {d.week}</p>
        <p style={{ margin: "0 0 2px", color: "#378ADD" }}>{activeOption.label}: <strong>{d.x}</strong></p>
        <p style={{ margin: 0, color: "#1D9E75" }}>DPU: <strong>{d.y}</strong></p>
      </div>
    );
  };

  const ForecastTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const actual   = payload.find(p => p.dataKey === "actual")?.value;
    const forecast = payload.find(p => p.dataKey === "forecast")?.value;
    return (
      <div style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#333" }}>{label}</p>
        {actual != null && <p style={{ margin: "0 0 2px", color: "#378ADD" }}>Actual: <strong>{actual}</strong></p>}
        {forecast != null && <p style={{ margin: 0, color: "#888" }}>Forecast: <strong>{forecast}</strong></p>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ border: "0.5px solid #eee", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>DPU Forecast</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#888" }}>Trend based on last</label>
              <select
                value={weeksBack}
                onChange={e => setWeeksBack(Number(e.target.value))}
                style={{ padding: "4px 8px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", background: "#fff", color: "#555" }}
              >
                {[4, 6, 8, 12, 16].map(n => <option key={n} value={n}>{n} weeks</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#888" }}>Project forward</label>
              <select
                value={weeksForward}
                onChange={e => setWeeksForward(Number(e.target.value))}
                style={{ padding: "4px 8px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", background: "#fff", color: "#555" }}
              >
                {[2, 4, 6, 8].map(n => <option key={n} value={n}>{n} weeks</option>)}
              </select>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>
          Trend projected from the last {weeksBack} weeks, extended {weeksForward} weeks forward
        </p>

        {forecastData.rows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: "40px 0" }}>
            Not enough weekly data yet to forecast a trend.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData.rows} margin={{ top: 10, right: 45, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, dataMax => Math.max(dataMax, quarterlyGoal ?? 0) * 1.15]} />
                <Tooltip content={<ForecastTooltip />} />
                {quarterlyGoal != null && (
                  <ReferenceLine y={quarterlyGoal} stroke="#888" strokeDasharray="4 4" label={{ value: "Goal", fontSize: 10, fill: "#888", position: "insideTopRight" }} />
                )}
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#378ADD" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#378ADD" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 12, color: "#555", margin: "10px 0 0" }}>
              {forecastData.trendDirection === "improving" && "DPU is trending down"}
              {forecastData.trendDirection === "worsening" && "DPU is trending up"}
              {forecastData.trendDirection === "flat" && "DPU is holding roughly flat"}
              {quarterlyGoal != null && forecastData.currentlyMeetingGoal && forecastData.crossesGoalAt == null && (
                <> — on pace to keep meeting the quarterly goal.</>
              )}
              {quarterlyGoal != null && forecastData.currentlyMeetingGoal && forecastData.crossesGoalAt != null && (
                <> — at this rate it's projected to exceed the quarterly goal in about {forecastData.crossesGoalAt} week{forecastData.crossesGoalAt !== 1 ? "s" : ""}.</>
              )}
              {quarterlyGoal != null && !forecastData.currentlyMeetingGoal && forecastData.crossesGoalAt != null && (
                <> — projected to meet the quarterly goal in about {forecastData.crossesGoalAt} week{forecastData.crossesGoalAt !== 1 ? "s" : ""}.</>
              )}
              {quarterlyGoal != null && !forecastData.currentlyMeetingGoal && forecastData.crossesGoalAt == null && (
                <> — currently above the quarterly goal and not on pace to meet it within the next {weeksForward} weeks.</>
              )}
            </p>
          </>
        )}
      </div>

      <div style={{ border: "0.5px solid #eee", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#555", margin: 0 }}>DPU vs. Another Variable</p>
          <select
            value={compareVar}
            onChange={e => setCompareVar(e.target.value)}
            style={{ padding: "5px 10px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", background: "#fff", color: "#555" }}
          >
            {compareOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>
          Each point is one week — look for a pattern, not a straight line
        </p>

        {scatterData.length === 0 ? (
          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: "40px 0" }}>
            Not enough weekly data yet to compare.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" dataKey="x" name={activeOption.label} tick={{ fontSize: 10 }} label={{ value: activeOption.label, position: "bottom", fontSize: 11, fill: "#888" }} />
              <YAxis type="number" dataKey="y" name="DPU" tick={{ fontSize: 10 }} label={{ value: "DPU", angle: -90, position: "insideLeft", fontSize: 11, fill: "#888" }} />
              <Tooltip content={<CorrelationTooltip />} />
              <Scatter data={scatterData} fill="#1D9E75" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}