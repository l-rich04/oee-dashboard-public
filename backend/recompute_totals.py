"""
One-time fix: recalculates total_defects on every work order to match the
actual sum of its WorkOrderDefect rows. Fixes stale totals left over from
before the total became purely derived (e.g. from the old editable-total
field, or manual /docs testing that set total_defects directly).

Run once from your backend folder:
    python recompute_totals.py
"""
from database import SessionLocal, WorkOrder, WorkOrderDefect

if __name__ == "__main__":
    db = SessionLocal()
    try:
        work_orders = db.query(WorkOrder).all()
        fixed = 0
        for wo in work_orders:
            rows = db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo.id).all()
            real_total = sum(r.quantity for r in rows)
            if wo.total_defects != real_total:
                print(f"Work order {wo.work_order_num} (id={wo.id}): {wo.total_defects} -> {real_total}")
                wo.total_defects = real_total
                fixed += 1

        if fixed == 0:
            print("Every work order's total_defects already matches its rows — nothing to fix.")
        else:
            confirm = input(f"\nFix {fixed} mismatched work order(s)? [y/N]: ").strip().lower()
            if confirm == "y":
                db.commit()
                print(f"Fixed {fixed} work order(s).")
            else:
                print("Cancelled — nothing changed.")
    finally:
        db.close()