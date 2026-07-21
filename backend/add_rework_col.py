from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE indirect_labor ADD COLUMN rework_hours FLOAT DEFAULT 0"))
    conn.commit()
    print("Done.")