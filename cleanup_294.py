from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DELETE FROM work_order_defects WHERE work_order_id = 294 AND id != 23"))
    # Also fix the total_defects count on the work order
    conn.execute(text("UPDATE work_orders SET total_defects = 1 WHERE id = 294"))
    conn.commit()
    print("Cleaned up work order 294.")