import { useState, forwardRef, useImperativeHandle } from "react";

const SECTIONS = [
  {
    title: "OEE (Overall Efficiency)",
    body: "Overall Equipment Effectiveness — a single score combining Availability, Performance, and Quality. It's calculated as Availability × Performance × Quality (each as a percentage), so a weak number in any one of the three pulls the whole score down. This is the industry-standard way to summarize \"how well is production actually running,\" beyond any single metric alone.",
  },
  {
    title: "Availability",
    body: "The share of scheduled labor time that was actually available for production, after subtracting indirect hours (time spent on things other than production) and rework hours. Calculated as (Total Hours − Indirect Hours − Rework Hours) ÷ Total Hours.",
  },
  {
    title: "Performance",
    body: "How many trucks actually got built compared to the target range for that week, adjusted for how many working days were in the week. If a week only had 4 working days instead of 5, the target itself scales down proportionally before comparing.",
  },
  {
    title: "Quality",
    body: "How close actual DPU (Defects Per Unit) came to the quarterly DPU goal. If DPU is at or under the goal, Quality is 100%. If DPU is worse than the goal, Quality drops proportionally — for example, a DPU twice as high as the goal gives a Quality score of 50%.",
  },
  {
    title: "DPU (Defects Per Unit)",
    body: "The average number of defects found per truck built in a given week — total defects for the week divided by total trucks. Lower is better. This is the main quality metric everything else (Quality %, the goal lines, the Insights forecast) is built around.",
  },
  {
    title: "Trucks Target",
    body: "The weekly range you're aiming to build (e.g. 14–18). Shown against the actual count for whatever period is selected, colored green if at/above the minimum, red if below.",
  },
  {
    title: "Goals & Goal History",
    body: "Your annual and quarterly DPU goals, plus your weekly truck target range, editable from the gear menu. Every time you save a change, it's recorded with an effective date in Goal History — so past weeks are always measured against whatever goal was actually in effect at the time, not retroactively judged by today's goal.",
  },
  {
    title: "Target Zone Colors (Weekly DPU Trend chart)",
    body: "The green/amber/red bands behind the trend line show, at a glance, whether a given week's DPU was at/under goal (green), up to 1.5x the goal (amber), or worse than that (red). These bands use the goal that was active for the period you're viewing, not always today's goal.",
  },
  {
    title: "Morning Huddle",
    body: "A guided, 3-phase walkthrough meant to be run as a daily/weekly team meeting: Phase 1 shows last week's numbers, Phase 2 walks through every open issue one at a time so nothing gets missed, Phase 3 is for logging any new business that comes up in the meeting itself.",
  },
  {
    title: "Work Orders & Defect Tracking",
    body: "Each work order can have one or more defect types logged against it, each with a quantity. The Pareto chart shows which defect types account for the most total defects (the \"80% of problems come from 20% of causes\" idea) — the 80% threshold line marks the point where a handful of defect types explain most of your issues.",
  },
  {
    title: "Insights — DPU Forecast",
    body: "Fits a simple trend line through your recent weeks of DPU data and projects it forward a few weeks, comparing where that trend would land against your quarterly goal. This is a straightforward statistical projection, not a sophisticated prediction model — one unusually good or bad week can swing it more than a smarter model would allow. Treat it as a directional signal, not a guarantee.",
  },
  {
    title: "Insights — DPU vs. Another Variable",
    body: "A scatter plot comparing weekly DPU against something else (rework hours, trucks produced, or working days) to see whether a real pattern exists. A visible upward or downward trend in the dots suggests a real relationship; a random-looking cloud of dots means there probably isn't one — which is itself useful to know.",
  },
];

const HelpGuidePanel = forwardRef(function HelpGuidePanel(props, ref) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  if (!open) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "90%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>How this Works</p>
          <button onClick={() => setOpen(false)} style={{
            background: "none", border: "none", fontSize: 20,
            cursor: "pointer", color: "#aaa", lineHeight: 1,
          }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px" }}>
          What every metric and feature on this dashboard actually means.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SECTIONS.map((s, i) => (
            <div key={s.title} style={{ border: "0.5px solid #eee", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => setExpanded(prev => prev === i ? null : i)}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px",
                  background: expanded === i ? "#fafafa" : "#fff",
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{s.title}</span>
                <span style={{ fontSize: 12, color: "#aaa" }}>{expanded === i ? "▲" : "▼"}</span>
              </button>
              {expanded === i && (
                <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0, padding: "0 14px 14px" }}>
                  {s.body}
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={() => setOpen(false)} style={{
            padding: "8px 20px", background: "#1D9E75", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
});

export default HelpGuidePanel;