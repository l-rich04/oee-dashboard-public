from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./oee.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Issue(Base):
    __tablename__ = "issues"

    id              = Column(Integer, primary_key=True, index=True)
    issue_type      = Column(String, nullable=False)
    category        = Column(String, nullable=False)
    description     = Column(Text, nullable=False)
    foreman_name    = Column(String, nullable=False)
    status          = Column(String, default="open")
    resolution_note = Column(Text, nullable=True)
    solved_by       = Column(String, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    production_id   = Column(Integer, nullable=True)
    is_read         = Column(Boolean, default=False, nullable=False)


class IssueUpdate(Base):
    __tablename__ = "issue_updates"

    id         = Column(Integer, primary_key=True, index=True)
    issue_id   = Column(Integer, nullable=False)
    update_num = Column(Integer, nullable=False)
    note       = Column(Text, nullable=False)
    made_by    = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id              = Column(Integer, primary_key=True, index=True)
    work_order_num  = Column(String, nullable=False)
    truck_type      = Column(String, nullable=False)
    units_completed = Column(Integer, nullable=False)
    total_defects   = Column(Integer, nullable=False)
    week_start      = Column(String, nullable=False)
    is_read         = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)


class TruckType(Base):
    __tablename__ = "truck_types"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DefectType(Base):
    __tablename__ = "defect_types"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, unique=True, nullable=False)
    active     = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkOrderDefect(Base):
    __tablename__ = "work_order_defects"

    id             = Column(Integer, primary_key=True, index=True)
    work_order_id  = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    defect_type_id = Column(Integer, ForeignKey("defect_types.id"), nullable=False)
    quantity       = Column(Integer, nullable=False, default=1)
    created_at     = Column(DateTime, default=datetime.utcnow)


class DowntimeLog(Base):
    __tablename__ = "downtime_logs"

    id         = Column(Integer, primary_key=True, index=True)
    machine    = Column(String, nullable=False)
    duration   = Column(Integer, nullable=False)
    reason     = Column(String, nullable=False)
    date       = Column(String, nullable=False)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class OEEGoals(Base):
    __tablename__ = "oee_goals"

    id                     = Column(Integer, primary_key=True, index=True)
    annual_dpu_goal        = Column(Float, default=1.62)
    quarterly_dpu_goal     = Column(Float, default=3.53)
    weekly_trucks_min      = Column(Integer, default=14)
    weekly_trucks_max      = Column(Integer, default=18)
    alert_oee_min          = Column(Float,   default=60.0)
    alert_availability_min = Column(Float,   default=50.0)
    alert_performance_min  = Column(Float,   default=50.0)
    alert_quality_min      = Column(Float,   default=50.0)
    alert_stale_days       = Column(Integer, default=14)
    updated_at             = Column(DateTime, default=datetime.utcnow)


class ReworkHours(Base):
    __tablename__ = "rework_hours"

    id         = Column(Integer, primary_key=True, index=True)
    week_start = Column(String, nullable=False, unique=True)
    hours      = Column(Float, nullable=False)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Foreman(Base):
    __tablename__ = "foremen"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Supervisor(Base):
    __tablename__ = "supervisors"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GoalHistory(Base):
    __tablename__ = "goal_history"

    id                 = Column(Integer, primary_key=True, index=True)
    effective_date     = Column(String, nullable=False)
    annual_dpu_goal    = Column(Float, nullable=False)
    quarterly_dpu_goal = Column(Float, nullable=False)
    weekly_trucks_min  = Column(Integer, nullable=False)
    weekly_trucks_max  = Column(Integer, nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)


class IndirectLabor(Base):
    __tablename__ = "indirect_labor"

    id                = Column(Integer, primary_key=True, index=True)
    week_start        = Column(String, nullable=False, unique=True)
    working_days      = Column(Integer, nullable=False, default=5)
    total_labor_hours = Column(Float, nullable=False)
    indirect_hours    = Column(Float, nullable=False)
    rework_hours      = Column(Float, nullable=False, default=0)
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IssueCategory(Base):
    __tablename__ = "issue_categories"

    id         = Column(Integer, primary_key=True, index=True)
    issue_type = Column(String, nullable=False)   # "part" or "process"
    name       = Column(String, nullable=False)   # e.g. "defective_part"
    created_at = Column(DateTime, default=datetime.utcnow)


class DashboardSettings(Base):
    __tablename__ = "dashboard_settings"

    id            = Column(Integer, primary_key=True, index=True)
    password_hash = Column(String, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database and tables created successfully.")