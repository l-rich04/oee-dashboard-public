# OEE Dashboard

A manufacturing OEE (Overall Equipment Effectiveness) dashboard built as an internship project. Replaces the manual Excel morning huddle process with a live web application for tracking production issues, work orders, and OEE metrics.

## What it does

- **Foreman issue tickets** — foremen submit issues from any browser, no login required
- **Supervisor dashboard** — view and manage all issues grouped by foreman, with new issue notifications
- **OEE metrics** — Availability, Performance, Quality, and Overall OEE calculated weekly
- **Work order tracking** — log trucks and defects per week, track DPU trends over time
- **Weekly labor tracking** — log total, indirect, and rework hours to drive Availability
- **Goal history** — track quarterly DPU goal changes over time with historical chart reference lines
- **Period filters** — view all metrics by last week, month, quarter, or full year

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14 / FastAPI / SQLAlchemy |
| Database | SQLite |
| Frontend | React / Vite |
| Charts | Recharts |

## Project structure
U:\OEE
├── main.py              # All API endpoints and OEE calculations
├── database.py          # SQLAlchemy models
├── migrate.py           # Run once to create/update tables
├── oee.db               # SQLite database
├── requirements.txt     # Python dependencies
└── frontend/
└── src/
├── api/issues.js
├── pages/
│   ├── SupervisorDashboard.jsx
│   └── ForemanForm.jsx
└── components/
├── OEEMetrics.jsx
├── OEEGoalsPanel.jsx
├── WorkOrderPanel.jsx
├── WeeklyLaborPanel.jsx
├── IssuesSummary.jsx
├── IssueForm.jsx
├── ForemanManagePanel.jsx
├── MassAddPanel.jsx
├── IssueEditPanel.jsx
├── IssueUpdatePanel.jsx
└── SupervisorLogin.jsx
