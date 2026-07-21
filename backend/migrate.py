import sqlite3
import hashlib

conn = sqlite3.connect("oee.db")
cur  = conn.cursor()

migrations = [
    ("oee_goals", "alert_oee_min",          "REAL DEFAULT 60.0"),
    ("oee_goals", "alert_availability_min", "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_performance_min",  "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_quality_min",      "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_stale_days",       "INTEGER DEFAULT 14"),
    ("defect_types", "active",              "BOOLEAN DEFAULT 1"),
]

for table, col, definition in migrations:
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
        print(f"Added {table}.{col}")
    except Exception as e:
        print(f"Skipped {table}.{col}: {e}")

cur.execute("""
    CREATE TABLE IF NOT EXISTS issue_categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_type TEXT NOT NULL,
        name       TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")
print("issue_categories table ready")

# Seed default categories if the table is empty — these match what was
# previously hardcoded in the frontend (MorningHuddle.jsx / DefectForm.jsx).
cur.execute("SELECT COUNT(*) FROM issue_categories")
if cur.fetchone()[0] == 0:
    default_categories = {
        "part":    ["defective_part", "wrong_spec", "missing_part", "supplier_issue", "in_house_damage"],
        "process": ["machine_breakdown", "setup_error", "quality_check_fail", "safety_stop", "lack_of_process"],
    }
    for issue_type, names in default_categories.items():
        for name in names:
            cur.execute(
                "INSERT INTO issue_categories (issue_type, name) VALUES (?, ?)",
                (issue_type, name),
            )
    print("Seeded default issue categories")
else:
    print("issue_categories already has data — skipped seeding")

# --- Dashboard password storage ---
# Moves off the old "__password__<value>" trick stored as a fake Supervisor
# name, into a proper hashed table. Preserves whatever password is already
# active if that old trick was used, instead of resetting to "1234".
cur.execute("""
    CREATE TABLE IF NOT EXISTS dashboard_settings (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        password_hash TEXT NOT NULL,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")
print("dashboard_settings table ready")

cur.execute("SELECT COUNT(*) FROM dashboard_settings")
if cur.fetchone()[0] == 0:
    cur.execute("""
        SELECT name FROM supervisors WHERE name LIKE '__password__%'
        ORDER BY created_at DESC LIMIT 1
    """)
    row = cur.fetchone()
    if row:
        current_password = row[0].replace("__password__", "", 1)
        print("Found existing password in supervisors table — migrating it")
    else:
        current_password = "1234"
        print("No existing password found — using default '1234'")

    password_hash = hashlib.sha256(current_password.encode()).hexdigest()
    cur.execute(
        "INSERT INTO dashboard_settings (password_hash) VALUES (?)",
        (password_hash,),
    )

    cur.execute("DELETE FROM supervisors WHERE name LIKE '__password__%'")
    print("Seeded dashboard_settings and cleaned up fake supervisor record(s)")
else:
    print("dashboard_settings already has a password — skipped seeding")

conn.commit()
conn.close()
print("Done.")