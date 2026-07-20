"""
One-time fix: restores every defect type to active, since the new `active`
column didn't backfill existing rows as True the way it should have.

Safe to run — no defect type could have been intentionally soft-deleted
before today, since that feature didn't exist until this change.

Run once from your backend folder:
    python restore_defect_types.py
"""
import sqlite3

conn = sqlite3.connect("oee.db")
cur  = conn.cursor()

cur.execute("SELECT id, name, active FROM defect_types")
rows = cur.fetchall()
print(f"Found {len(rows)} defect type(s):")
for r in rows:
    print(f"  id={r[0]}  name={r[1]!r}  active={r[2]}")

cur.execute("UPDATE defect_types SET active = 1")
conn.commit()
print(f"\nSet active=1 on all {cur.rowcount} defect type(s).")

conn.close()
print("Done.")