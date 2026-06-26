# OEE Issue Tracking System

A manufacturing floor issue tracking and supervisor dashboard built as the foundation for a full OEE (Overall Equipment Effectiveness) system.

## Project Overview

This system replaces the manual whiteboard-based morning huddle tracking process. Supervisors can track, manage, and analyze shop floor issues in real time through a web dashboard. Foremen have access to a simple form to submit issues directly if needed.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy
- **Database:** SQLite
- **Frontend:** React (Vite), Recharts, React Router

## How To Run

**Backend**
```bash
cd /d U:\OEE
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0
```

**Frontend**
```bash
cd /d C:\Users\lrichardson\frontend
npm run dev -- --host
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /issues | Submit a new issue |
| POST | /issues/bulk | Submit multiple issues at once |
| GET | /issues | Get all issues with optional filters |
| GET | /issues/{id} | Get a single issue |
| PUT | /issues/{id} | Update status and issue details |
| DELETE | /issues/{id} | Delete an issue and its updates |
| GET | /issues/summary/counts | Chart data by status, category, foreman, type |
| GET | /issues/{id}/updates | Get all updates for an issue |
| POST | /issues/{id}/updates | Add a daily update (max 3 per issue) |

## Future Phases

- **Phase 2** — Authentication with role based access
- **Phase 3** — Production data: machines, shifts, downtime, units, defects
- **Phase 4** — Full OEE calculations: Availability x Performance x Quality
- **Phase 5** — Deploy to company server or cloud hosting for 24/7 access

## Author

Layne Richardson — Internship Project
