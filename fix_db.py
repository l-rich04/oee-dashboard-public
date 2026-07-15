import sqlite3

conn = sqlite3.connect("oee.db")
cur  = conn.cursor()

migrations = [
    ("oee_goals", "alert_oee_min",          "REAL DEFAULT 60.0"),
    ("oee_goals", "alert_availability_min", "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_performance_min",  "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_quality_min",      "REAL DEFAULT 50.0"),
    ("oee_goals", "alert_stale_days",       "INTEGER DEFAULT 14"),
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

conn.commit()
conn.close()
print("Done.")