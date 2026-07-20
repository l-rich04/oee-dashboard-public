from database import engine, Base
from database import WorkOrder, DowntimeLog, OEEGoals, ReworkHours, Foreman, Issue, GoalHistory, IndirectLabor
from sqlalchemy import text
from database import SessionLocal

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    db.execute(text("ALTER TABLE issues ADD COLUMN is_read BOOLEAN DEFAULT 0"))
    db.commit()
    print("Added issues.is_read column.")
except Exception as e:
    print(f"issues.is_read column may already exist: {e}")

try:
    db.execute(text("ALTER TABLE work_orders ADD COLUMN is_read BOOLEAN DEFAULT 0"))
    db.commit()
    print("Added work_orders.is_read column.")
except Exception as e:
    print(f"work_orders.is_read column may already exist: {e}")

db.close()
print("Migration complete.")