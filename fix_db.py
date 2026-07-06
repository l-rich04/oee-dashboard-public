from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE indirect_labor ADD COLUMN working_days INTEGER DEFAULT 5"))
        conn.commit()
        print("Done.")
    except Exception as e:
        print("Error:", e)