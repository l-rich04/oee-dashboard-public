"""
One-time migration: creates the issue_categories table and seeds it with
the categories that are currently hardcoded in the frontend (MorningHuddle.jsx,
and likely MassAddPanel.jsx / ForemanForm.jsx too).
 
Run once from your backend folder:
    python add_issue_categories_table.py
"""
from database import Base, engine, SessionLocal, IssueCategory
 
DEFAULTS = {
    "part":    ["defective_part", "wrong_spec", "missing_part", "supplier_issue", "in_house_damage"],
    "process": ["machine_breakdown", "setup_error", "quality_check_fail", "safety_stop", "lack_of_process"],
}
 
if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
 
    db = SessionLocal()
    existing_count = db.query(IssueCategory).count()
    if existing_count == 0:
        for issue_type, names in DEFAULTS.items():
            for name in names:
                db.add(IssueCategory(issue_type=issue_type, name=name))
        db.commit()
        print("issue_categories table created and seeded with the default categories.")
    else:
        print("issue_categories already has data — nothing to do.")
    db.close()