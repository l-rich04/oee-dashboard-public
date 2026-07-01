from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS indirect_labor"))
    conn.commit()
    print("Dropped indirect_labor.")