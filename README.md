# OEE Dashboard

A manufacturing OEE (Overall Equipment Effectiveness) dashboard built as an internship project. Replaces the manual Excel morning huddle process with a live web application for tracking production issues, work orders, and OEE metrics.

---

## What it does

- **Foreman issue tickets** — foremen submit part and process issues from any browser, no login required
- **Supervisor dashboard** — view and manage all issues grouped by foreman, with live "new" badges and desktop notifications
- **Morning huddle mode** — structured 3-phase walkthrough of last week's numbers, open issues, and new issues
- **OEE metrics** — Availability, Performance, Quality, and Overall Efficiency calculated yearly with week/month/quarter/year period filters
- **Work order tracking** — log trucks and defects per week, track DPU (Defects Per Unit) trends over time with Pareto analysis
- **Defect breakdown** — log individual defect types per work order with quantity support
- **Weekly labor tracking** — log total, indirect, and rework hours to drive Availability calculations
- **Goal management** — set alert thresholds for OEE metrics and DPU; track quarterly goal changes over time with historical chart reference lines
- **Issue categories** — manage custom categories per issue type (part/process)
- **Export** — export issues and production data to Excel

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3 / FastAPI / SQLAlchemy |
| Database | SQLite |
| Frontend | React / Vite |
| Charts | Recharts |
| Spreadsheet export | SheetJS (xlsx) |

---

## Project structure

```
U:\OEE
├── main.py                        # All API endpoints and OEE calculations
├── database.py                    # SQLAlchemy models
├── migrate.py                     # Run once to create/update tables
├── oee.db                         # SQLite database (never overwrite on server)
├── requirements.txt               # Python dependencies
└── frontend/
    └── src/
        ├── api/
        │   └── issues.js          # All API calls
        ├── pages/
        │   ├── SupervisorDashboard.jsx
        │   └── ForemanForm.jsx
        └── components/
            ├── OEEMetrics.jsx
            ├── OEEGoalsPanel.jsx
            ├── WorkOrderPanel.jsx
            ├── WeeklyLaborPanel.jsx
            ├── MorningHuddle.jsx
            ├── IssuesSummary.jsx
            ├── IssueUpdatePanel.jsx
            ├── IssueEditPanel.jsx
            ├── MassAddPanel.jsx
            ├── ForemanManagePanel.jsx
            ├── SupervisorManagePanel.jsx
            ├── SupervisorLogin.jsx
            ├── PasswordChangePanel.jsx
            ├── TruckTypeManagePanel.jsx
            ├── DefectTypeManagePanel.jsx
            ├── IssueCategoryManagePanel.jsx
            └── IssueStatusBadge.jsx
```

---

## Local development setup

### Backend

```bash
cd U:\OEE
pip install -r requirements.txt
python migrate.py
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd U:\OEE\frontend
npm install
# make sure .env has: VITE_API_URL=http://localhost:8000
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Deploying to the network server

The production instance runs on `\\RGSAPPSRV\OEE` (mapped as `Z:\`).

```bash
# 1. Point frontend at the server backend
#    Edit U:\OEE\frontend\.env → VITE_API_URL=http://rgsappsrv:8000

# 2. Build the frontend
cd /d U:\OEE\frontend
npm run build

# 3. Copy frontend build to server
xcopy /E /Y U:\OEE\frontend\dist\* Z:\frontend\dist\

# 4. Copy backend files to server
copy /Y U:\OEE\main.py Z:\backend\
copy /Y U:\OEE\database.py Z:\backend\

# 5. Restart the backend Windows service
#    Services → OEEBackend → Restart

# 6. Restore local .env
#    Edit U:\OEE\frontend\.env → VITE_API_URL=http://localhost:8000

# 7. Verify at http://rgsappsrv
```

> ⚠️ **Never overwrite `Z:\backend\oee.db`** — this is the live production database.

---

## Key notes

- **Read state** for issues and work orders is tracked in `localStorage` on the supervisor's browser so "new" badges survive page refreshes without hitting the backend on every load.
- **Notifications** require the browser to grant notification permission. Desktop popups require HTTPS or localhost — they will not fire on plain `http://rgsappsrv` due to browser security restrictions.
- **OEE calculations** — Availability is derived from indirect/rework labor hours; Performance from trucks vs weekly target; Quality from DPU vs quarterly goal. All four roll up into Overall OEE.
- **Defect counts** on work orders are the sum of defect entry quantities, not a manually entered number.
- **Password** for the supervisor dashboard is stored as a hashed supervisor record. Default is `1234`.
