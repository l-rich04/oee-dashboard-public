"""
One-time cleanup: removes any WorkOrderDefect rows whose work_order_id
doesn't match an existing WorkOrder — leftovers from deletions that happened
before the cascade-delete fix was added to delete_work_order.

Run once from your backend folder:
    python cleanup_orphaned_defects.py
"""
from database import SessionLocal, WorkOrder, WorkOrderDefect

if __name__ == "__main__":
    db = SessionLocal()
    try:
        valid_wo_ids = {wo.id for wo in db.query(WorkOrder.id).all()}
        orphans = db.query(WorkOrderDefect).filter(
            ~WorkOrderDefect.work_order_id.in_(valid_wo_ids)
        ).all() if valid_wo_ids else db.query(WorkOrderDefect).all()

        if not orphans:
            print("No orphaned defect rows found — nothing to clean up.")
        else:
            print(f"Found {len(orphans)} orphaned defect row(s):")
            for o in orphans:
                print(f"  id={o.id}  work_order_id={o.work_order_id}  defect_type_id={o.defect_type_id}  quantity={o.quantity}")
            confirm = input("Delete these rows? [y/N]: ").strip().lower()
            if confirm == "y":
                for o in orphans:
                    db.delete(o)
                db.commit()
                print(f"Deleted {len(orphans)} orphaned row(s).")
            else:
                print("Cancelled — nothing deleted.")
    finally:
        db.close()