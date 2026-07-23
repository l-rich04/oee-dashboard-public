"""
Seed script - populates a fresh oee.db with fake demo data.

This is for demonstration purposes only. All names, numbers, and work
order IDs below are made up and do not represent any real facility,
person, or production data.

Usage:
    python migrate.py        # creates empty tables first
    python seed_demo_data.py # populates them with fake demo data
"""

import sqlite3
from datetime import datetime, timedelta
import hashlib

DB_PATH = "oee.db"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def seed():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now = datetime.now()

    # --- Foremen ---
    foremen = ["Alex Morgan", "Jamie Chen", "Sam Rivera", "Taylor Brooks"]
    for name in foremen:
        cur.execute(
            "INSERT OR IGNORE INTO foremen (name, created_at) VALUES (?, ?)",
            (name, now),
        )

    # --- Supervisors ---
    supervisors = ["Jordan Lee", "Casey Patel"]
    for name in supervisors:
        cur.execute(
            "INSERT OR IGNORE INTO supervisors (name, created_at) VALUES (?, ?)",
            (name, now),
        )

    # --- Truck types ---
    truck_types = ["Flatbed", "Box Truck", "Tanker", "Refrigerated"]
    for name in truck_types:
        cur.execute(
            "INSERT OR IGNORE INTO truck_types (name, created_at) VALUES (?, ?)",
            (name, now),
        )

    # --- Defect types ---
    defect_types = ["Paint scratch", "Misaligned panel", "Wiring fault", "Missing bolt"]
    for name in defect_types:
        cur.execute(
            "INSERT OR IGNORE INTO defect_types (name, created_at) VALUES (?, ?)",
            (name, now),
        )

    # --- Issue categories ---
    categories = [("part", "Frame"), ("part", "Electrical"), ("process", "Assembly line"), ("process", "Paint booth")]
    for issue_type, name in categories:
        cur.execute(
            "INSERT INTO issue_categories (issue_type, name, created_at) VALUES (?, ?, ?)",
            (issue_type, name, now),
        )

    # --- Dashboard settings (demo password: "demo1234") ---
    cur.execute(
        "INSERT OR IGNORE INTO dashboard_settings (id, password_hash, updated_at) VALUES (1, ?, ?)",
        (hash_password("demo1234"), now),
    )

    # --- OEE goals ---
    cur.execute(
        """INSERT OR IGNORE INTO oee_goals
           (id, annual_dpu_goal, quarterly_dpu_goal, weekly_trucks_min, weekly_trucks_max, updated_at)
           VALUES (1, 2.5, 2.0, 40, 60, ?)""",
        (now,),
    )

    # --- Goal history (last 3 quarters) ---
    goal_history = [
        ("2026-01-01", 3.0, 2.5, 35, 55),
        ("2026-04-01", 2.7, 2.2, 38, 58),
        ("2026-07-01", 2.5, 2.0, 40, 60),
    ]
    for effective_date, annual, quarterly, min_t, max_t in goal_history:
        cur.execute(
            """INSERT INTO goal_history
               (effective_date, annual_dpu_goal, quarterly_dpu_goal, weekly_trucks_min, weekly_trucks_max, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (effective_date, annual, quarterly, min_t, max_t, now),
        )

    # --- Weekly labor + rework hours (last 6 weeks) ---
    for i in range(6):
        week_start = (now - timedelta(weeks=i)).strftime("%Y-%m-%d")
        cur.execute(
            """INSERT OR IGNORE INTO indirect_labor
               (week_start, total_labor_hours, indirect_hours, rework_hours, working_days, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (week_start, 320.0, 40.0 + i, 8.0 + i * 0.5, 5, now, now),
        )
        cur.execute(
            """INSERT OR IGNORE INTO rework_hours (week_start, hours, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (week_start, 8.0 + i * 0.5, "Demo data", now, now),
        )

    # --- Work orders (last 4 weeks, a few per week) ---
    sample_work_orders = [
        ("WO-1001", "Flatbed", 12, 2, 0),
        ("WO-1002", "Box Truck", 18, 3, 1),
        ("WO-1003", "Tanker", 9, 1, 2),
        ("WO-1004", "Refrigerated", 15, 4, 3),
        ("WO-1005", "Flatbed", 20, 2, 0),
        ("WO-1006", "Box Truck", 11, 0, 1),
    ]
    work_order_ids = []
    for i, (wo_num, truck_type, units, defects, week_offset) in enumerate(sample_work_orders):
        week_start = (now - timedelta(weeks=week_offset)).strftime("%Y-%m-%d")
        cur.execute(
            """INSERT INTO work_orders
               (work_order_num, truck_type, units_completed, total_defects, week_start, created_at, is_read)
               VALUES (?, ?, ?, ?, ?, ?, 1)""",
            (wo_num, truck_type, units, defects, week_start, now - timedelta(weeks=week_offset)),
        )
        work_order_ids.append(cur.lastrowid)

    # --- Work order defects (link a couple of work orders to defect types) ---
    cur.execute("SELECT id FROM defect_types LIMIT 4")
    defect_type_ids = [row[0] for row in cur.fetchall()]
    if work_order_ids and defect_type_ids:
        cur.execute(
            "INSERT INTO work_order_defects (work_order_id, defect_type_id, quantity, created_at) VALUES (?, ?, ?, ?)",
            (work_order_ids[1], defect_type_ids[0], 2, now),
        )
        cur.execute(
            "INSERT INTO work_order_defects (work_order_id, defect_type_id, quantity, created_at) VALUES (?, ?, ?, ?)",
            (work_order_ids[3], defect_type_ids[2], 3, now),
        )

    # --- Issues (a mix of open/resolved) ---
    sample_issues = [
        ("part", "Frame", "Bent frame rail on unit 4, needs replacement before final assembly.", "Alex Morgan", "open"),
        ("process", "Paint booth", "Paint booth ventilation running slow, causing longer dry times.", "Jamie Chen", "open"),
        ("part", "Electrical", "Wiring harness connector loose on 2 units this week.", "Sam Rivera", "resolved"),
        ("process", "Assembly line", "Line 2 conveyor jammed twice this shift.", "Taylor Brooks", "resolved"),
        ("part", "Frame", "Cracked weld found during inspection.", "Alex Morgan", "open"),
    ]
    issue_ids = []
    for issue_type, category, description, foreman, status in sample_issues:
        resolution_note = "Fixed and verified." if status == "resolved" else None
        solved_by = "Jordan Lee" if status == "resolved" else None
        cur.execute(
            """INSERT INTO issues
               (issue_type, category, description, foreman_name, status, resolution_note,
                created_at, updated_at, is_read, solved_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (issue_type, category, description, foreman, status, resolution_note, now, now, solved_by),
        )
        issue_ids.append(cur.lastrowid)

    # --- Issue updates on the resolved issues ---
    for issue_id in issue_ids[2:4]:
        cur.execute(
            """INSERT INTO issue_updates (issue_id, update_num, note, created_at, made_by)
               VALUES (?, 1, ?, ?, ?)""",
            (issue_id, "Parts ordered, ETA 2 days.", now, "Jordan Lee"),
        )
        cur.execute(
            """INSERT INTO issue_updates (issue_id, update_num, note, created_at, made_by)
               VALUES (?, 2, ?, ?, ?)""",
            (issue_id, "Repair completed and verified.", now, "Jordan Lee"),
        )

    # --- Downtime logs ---
    downtime_samples = [
        ("Press #2", 45, "Mechanical jam", (now - timedelta(days=2)).strftime("%Y-%m-%d")),
        ("Conveyor Line 2", 20, "Belt slippage", (now - timedelta(days=5)).strftime("%Y-%m-%d")),
    ]
    for machine, duration, reason, date in downtime_samples:
        cur.execute(
            "INSERT INTO downtime_logs (machine, duration, reason, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (machine, duration, reason, date, "Demo data", now),
        )

    conn.commit()
    conn.close()
    print("Demo data seeded successfully.")
    print("Supervisor dashboard demo password: demo1234")


if __name__ == "__main__":
    seed()
