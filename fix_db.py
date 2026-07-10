from database import engine, SessionLocal, TruckType, DefectType
from sqlalchemy import text

with engine.connect() as conn:
    # Create new tables if they don't exist
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS truck_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS defect_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS work_order_defects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
            defect_type_id INTEGER NOT NULL REFERENCES defect_types(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """))

    # Add is_read to work_orders if it doesn't exist
    try:
        conn.execute(text("ALTER TABLE work_orders ADD COLUMN is_read BOOLEAN DEFAULT 0"))
        conn.commit()
        print("Added is_read to work_orders.")
    except Exception as e:
        print("is_read column may already exist:", e)

    conn.commit()
    print("Tables created.")

# Seed starting data
db = SessionLocal()
try:
    truck_names  = ["Monmouth", "Alum Comm", "PennDOT", "Steel"]
    defect_names = ["Sharp Edges", "Missing Parts"]

    for name in truck_names:
        if not db.query(TruckType).filter(TruckType.name == name).first():
            db.add(TruckType(name=name))

    for name in defect_names:
        if not db.query(DefectType).filter(DefectType.name == name).first():
            db.add(DefectType(name=name))

    db.commit()
    print("Seed data added.")
finally:
    db.close()

print("Done.")