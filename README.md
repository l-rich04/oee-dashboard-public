# OEE Dashboard

A manufacturing OEE (Overall Equipment Effectiveness) dashboard built as an internship project. Replaces a manual Excel morning huddle process with a live web application for tracking production issues, work orders, and OEE metrics.

## What it does

- **Foreman issue tickets** — foremen submit issues from any browser, no login required
- **Supervisor dashboard** — view and manage all issues grouped by foreman, with new issue notifications
- **Morning huddle view** — quick daily review of open issues and status updates
- **OEE metrics** — Availability, Performance, Quality, and Overall OEE calculated weekly
- **Work order tracking** — log trucks and defects per week, track DPU trends over time
- **Weekly labor tracking** — log total, indirect, and rework hours to drive Availability
- **Goal history** — track quarterly DPU goal changes over time with historical chart reference lines
- **Insights & forecasting** — DPU trend forecasting, correlation view, and top-defect breakdowns
- **In-app help guide** — built-in walkthrough of how the dashboard works, accessible from a `?` icon in the header
- **Management panels** — add/rename/edit foremen, supervisors, truck types, defect types, and issue categories
- **Period filters** — view all metrics by last week, month, quarter, or full year

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python / FastAPI / SQLAlchemy |
| Database | SQLite |
| Frontend | React / Vite |
| Charts | Recharts |

## Project structure

```
oee-dashboard-public/
├── backend/
│   ├── main.py              # API endpoints and OEE calculations
│   ├── database.py          # SQLAlchemy models
│   ├── migrate.py           # Run once to create/update tables
│   └── requirements.txt     # Python dependencies
└── frontend/
    └── src/
        ├── api/
        │   └── issues.js
        ├── pages/
        │   ├── SupervisorDashboard.jsx
        │   ├── ForemanForm.jsx
        │   └── DefectForm.jsx
        ├── components/
        │   ├── OEEMetrics.jsx
        │   ├── OEEGoalsPanel.jsx
        │   ├── WorkOrderPanel.jsx
        │   ├── WeeklyLaborPanel.jsx
        │   ├── IssuesSummary.jsx
        │   ├── IssueEditPanel.jsx
        │   ├── IssueUpdatePanel.jsx
        │   ├── IssueStatusBadge.jsx
        │   ├── MorningHuddle.jsx
        │   ├── InsightsPanel.jsx
        │   ├── HelpGuidePanel.jsx
        │   ├── MassAddPanel.jsx
        │   ├── SummaryCharts.jsx
        │   ├── SupervisorLogin.jsx
        │   ├── PasswordChangePanel.jsx
        │   ├── ForemanManagePanel.jsx
        │   ├── SupervisorManagePanel.jsx
        │   ├── TruckTypeManagePanel.jsx
        │   ├── DefectTypeManagePanel.jsx
        │   └── IssueCategoryManagePanel.jsx
        └── App.jsx
```

## Local development setup

**Backend**

```bash
cd backend
pip install -r requirements.txt
python migrate.py      # creates the SQLite database and tables
python main.py          # starts the API server
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

By default the frontend expects the API at `http://localhost:8000`. Set `VITE_API_URL` in a `.env` file inside `frontend/` to point at a different backend address if needed.

## Demo data

This repo includes `backend/oee.db`, a small SQLite database pre-loaded with **fake sample data** (made-up foreman names, sample issues, and sample work orders) so the app has something to show right after cloning — none of it reflects any real facility or person.

- **Supervisor dashboard login password:** `1234`
- To reset and regenerate the demo data at any point:
  ```bash
  cd backend
  del oee.db          # or: rm oee.db on Mac/Linux
  python migrate.py
  python seed_demo_data.py
  ```

## Deployment

This app was originally deployed on an internal network server running IIS as a reverse proxy in front of the FastAPI backend, with the built frontend served as static files. The general pattern for deploying it elsewhere:

**Backend**

1. Copy the `backend/` folder to your server.
2. Install dependencies: `pip install -r requirements.txt`
3. Run `python migrate.py` once to create the database and tables.
4. Run the backend as a persistent process — either directly (`python main.py`), behind a process manager (e.g. `pm2`, `systemd`, or a Windows service wrapper like NSSM), or behind a WSGI/ASGI server such as `uvicorn` for production use.
5. Make sure the port the backend listens on (default `8000`) is reachable from wherever the frontend will be served.

**Frontend**

1. Set `VITE_API_URL` in `frontend/.env` to the address where your backend is reachable (e.g. `http://your-server-address:8000`).
2. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
3. This outputs static files to `frontend/dist/`. Serve that folder with any static file server or reverse proxy (IIS, Nginx, Apache, Caddy, etc.).

**Notes on going from local to network deployment**

- If it works locally but not over the network, the most common cause is the frontend still pointing at `localhost` instead of the server's actual network address in `VITE_API_URL` — remember to rebuild (`npm run build`) after changing it, since Vite bakes environment variables into the build at build time, not runtime.
- Make sure your backend process is bound to `0.0.0.0` (all interfaces) rather than `127.0.0.1` (localhost only) if you want it reachable from other machines on the network.
- If using HTTP (not HTTPS) internally, some browser features like push notifications will be blocked by default — this needs either an HTTPS certificate or a manual browser override per machine.

## Notes

- No authentication is required for foremen submitting issues — this was an intentional design choice to keep the process fast on the shop floor. Supervisor-facing panels are gated by a simple password login.
- The included `backend/oee.db` is fake demo data only (see the **Demo data** section above). `.gitignore` blocks any other `.db` file from being committed, so your own real data stays local if you continue developing this further.
- This project was built and deployed for a specific production environment; deployment configuration (server addresses, service names) has been generalized here and will need to be adapted to your own environment.

## About this project

Built as a hands-on internship project to digitize a manual, paper/Excel-based morning huddle process for tracking production issues and OEE metrics on the shop floor.
