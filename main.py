from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional

from database import Base, engine, get_db, Issue, IssueUpdate, WorkOrder, DowntimeLog, OEEGoals, ReworkHours, Foreman, GoalHistory, IndirectLabor

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---

class IssueCreate(BaseModel):
    issue_type:   str
    category:     str
    description:  str
    foreman_name: str
    created_at:   Optional[datetime] = None


class IssueUpdateSchema(BaseModel):
    status:          Optional[str] = None
    resolution_note: Optional[str] = None
    issue_type:      Optional[str] = None
    category:        Optional[str] = None
    description:     Optional[str] = None
    created_at:      Optional[datetime] = None


class IssueOut(BaseModel):
    id:              int
    issue_type:      str
    category:        str
    description:     str
    foreman_name:    str
    status:          str
    resolution_note: Optional[str]
    created_at:      datetime
    updated_at:      datetime
    production_id:   Optional[int]
    update_count:    Optional[int] = 0
    is_read:         bool = False

    model_config = {"from_attributes": True}


class IssueUpdateCreate(BaseModel):
    note: str


class IssueUpdateOut(BaseModel):
    id:         int
    issue_id:   int
    update_num: int
    note:       str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkOrderCreate(BaseModel):
    work_order_num:  str
    truck_type:      str
    units_completed: int
    total_defects:   int
    week_start:      str


class WorkOrderOut(BaseModel):
    id:              int
    work_order_num:  str
    truck_type:      str
    units_completed: int
    total_defects:   int
    week_start:      str
    created_at:      datetime

    model_config = {"from_attributes": True}


class ReworkCreate(BaseModel):
    week_start: str
    hours:      float
    notes:      Optional[str] = None


class ReworkOut(BaseModel):
    id:         int
    week_start: str
    hours:      float
    notes:      Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IndirectLaborCreate(BaseModel):
    week_start:        str
    total_labor_hours: float
    indirect_hours:    float
    rework_hours:      float = 0
    notes:             Optional[str] = None


class IndirectLaborOut(BaseModel):
    id:                int
    week_start:        str
    total_labor_hours: float
    indirect_hours:    float
    rework_hours:      float
    notes:             Optional[str]
    created_at:        datetime
    updated_at:        datetime

    model_config = {"from_attributes": True}


class OEEGoalsUpdate(BaseModel):
    annual_dpu_goal:    Optional[float] = None
    quarterly_dpu_goal: Optional[float] = None
    weekly_trucks_min:  Optional[int]   = None
    weekly_trucks_max:  Optional[int]   = None
    effective_date:     Optional[str]   = None


class OEEGoalsOut(BaseModel):
    id:                 int
    annual_dpu_goal:    float
    quarterly_dpu_goal: float
    weekly_trucks_min:  int
    weekly_trucks_max:  int
    updated_at:         datetime

    model_config = {"from_attributes": True}


class ForemanCreate(BaseModel):
    name: str


class ForemanOut(BaseModel):
    id:         int
    name:       str
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalHistoryOut(BaseModel):
    id:                 int
    effective_date:     str
    annual_dpu_goal:    float
    quarterly_dpu_goal: float
    weekly_trucks_min:  int
    weekly_trucks_max:  int
    created_at:         datetime

    model_config = {"from_attributes": True}


class GoalHistoryUpdate(BaseModel):
    effective_date:     str
    annual_dpu_goal:    float
    quarterly_dpu_goal: float
    weekly_trucks_min:  int
    weekly_trucks_max:  int


# --- Issue endpoints ---

@app.post("/issues", response_model=IssueOut, status_code=201)
def create_issue(data: IssueCreate, db: Session = Depends(get_db)):
    if data.issue_type not in ("part", "process"):
        raise HTTPException(status_code=400, detail="issue_type must be 'part' or 'process'")
    from database import Issue as IssueModel
    issue_data = data.model_dump()
    if issue_data.get("created_at") is None:
        issue_data["created_at"] = datetime.utcnow()
    issue = IssueModel(**issue_data)
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return IssueOut.model_validate(issue)


@app.post("/issues/bulk", status_code=201)
def bulk_create_issues(data: list[IssueCreate], db: Session = Depends(get_db)):
    from database import Issue as IssueModel
    created = []
    for item in data:
        if not item.issue_type or not item.category or not item.description or not item.foreman_name:
            continue
        issue_data = item.model_dump()
        if issue_data.get("created_at") is None:
            issue_data["created_at"] = datetime.utcnow()
        issue = IssueModel(**issue_data)
        db.add(issue)
        created.append(issue)
    db.commit()
    for issue in created:
        db.refresh(issue)
    return {"created": len(created)}


@app.get("/issues/summary/counts")
def get_summary(period: Optional[str] = None, db: Session = Depends(get_db)):
    from database import Issue as IssueModel

    today = date.today()
    if period == "weekly":
        since = today - timedelta(days=7)
    elif period == "mtd":
        since = date(today.year, today.month, 1)
    elif period == "ytd":
        since = date(today.year, 1, 1)
    else:
        since = None

    query = db.query(IssueModel)
    if since:
        query = query.filter(IssueModel.created_at >= datetime.combine(since, datetime.min.time()))

    issues = query.all()

    by_status   = {}
    by_category = {}
    by_foreman  = {}
    by_type     = {}

    for i in issues:
        by_status[i.status]        = by_status.get(i.status, 0) + 1
        by_category[i.category]    = by_category.get(i.category, 0) + 1
        by_foreman[i.foreman_name] = by_foreman.get(i.foreman_name, 0) + 1
        by_type[i.issue_type]      = by_type.get(i.issue_type, 0) + 1

    return {
        "by_status":   by_status,
        "by_category": by_category,
        "by_foreman":  by_foreman,
        "by_type":     by_type,
    }


@app.get("/issues", response_model=list[IssueOut])
def get_issues(
    status:   Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    from database import Issue as IssueModel, IssueUpdate as IssueUpdateModel

    query = db.query(IssueModel)
    if status:
        query = query.filter(IssueModel.status == status)
    if category:
        query = query.filter(IssueModel.category == category)
    issues = query.order_by(IssueModel.created_at.desc()).all()

    counts = dict(
        db.query(IssueUpdateModel.issue_id, func.count())
          .group_by(IssueUpdateModel.issue_id)
          .all()
    )

    result = []
    for issue in issues:
        data = IssueOut.model_validate(issue)
        data.update_count = counts.get(issue.id, 0)
        result.append(data)
    return result


@app.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    from database import Issue as IssueModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return IssueOut.model_validate(issue)


@app.put("/issues/{issue_id}", response_model=IssueOut)
def update_issue(issue_id: int, data: IssueUpdateSchema, db: Session = Depends(get_db)):
    from database import Issue as IssueModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if data.status:
        allowed = ("open", "in_progress", "solved")
        if data.status not in allowed:
            raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
        issue.status = data.status

    if data.resolution_note is not None: issue.resolution_note = data.resolution_note
    if data.issue_type      is not None: issue.issue_type      = data.issue_type
    if data.category        is not None: issue.category        = data.category
    if data.description     is not None: issue.description     = data.description
    if data.created_at      is not None: issue.created_at      = data.created_at

    issue.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    return IssueOut.model_validate(issue)


@app.delete("/issues/{issue_id}", status_code=204)
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    from database import Issue as IssueModel, IssueUpdate as IssueUpdateModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.query(IssueUpdateModel).filter(IssueUpdateModel.issue_id == issue_id).delete()
    db.delete(issue)
    db.commit()
    return


@app.get("/issues/{issue_id}/updates", response_model=list[IssueUpdateOut])
def get_updates(issue_id: int, db: Session = Depends(get_db)):
    from database import Issue as IssueModel, IssueUpdate as IssueUpdateModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return db.query(IssueUpdateModel)\
             .filter(IssueUpdateModel.issue_id == issue_id)\
             .order_by(IssueUpdateModel.update_num)\
             .all()


@app.post("/issues/{issue_id}/updates", response_model=IssueUpdateOut, status_code=201)
def add_update(issue_id: int, data: IssueUpdateCreate, db: Session = Depends(get_db)):
    from database import Issue as IssueModel, IssueUpdate as IssueUpdateModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    existing = db.query(IssueUpdateModel)\
                 .filter(IssueUpdateModel.issue_id == issue_id)\
                 .count()

    if existing >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 updates already reached")

    update = IssueUpdateModel(
        issue_id=issue_id,
        update_num=existing + 1,
        note=data.note,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return update


@app.put("/issues/{issue_id}/read", response_model=IssueOut)
def mark_issue_read(issue_id: int, db: Session = Depends(get_db)):
    from database import Issue as IssueModel
    issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.is_read    = True
    issue.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    return IssueOut.model_validate(issue)


# --- Work order endpoints ---

@app.post("/work-orders", response_model=WorkOrderOut, status_code=201)
def create_work_order(data: WorkOrderCreate, db: Session = Depends(get_db)):
    wo = WorkOrder(**data.model_dump())
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return wo


@app.get("/work-orders", response_model=list[WorkOrderOut])
def get_work_orders(db: Session = Depends(get_db)):
    return db.query(WorkOrder).order_by(WorkOrder.created_at.desc()).all()


@app.delete("/work-orders/{wo_id}", status_code=204)
def delete_work_order(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    db.delete(wo)
    db.commit()
    return


# --- Rework hours endpoints ---

@app.post("/rework", response_model=ReworkOut, status_code=201)
def upsert_rework(data: ReworkCreate, db: Session = Depends(get_db)):
    existing = db.query(ReworkHours).filter(ReworkHours.week_start == data.week_start).first()
    if existing:
        existing.hours      = data.hours
        existing.notes      = data.notes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    rework = ReworkHours(**data.model_dump())
    db.add(rework)
    db.commit()
    db.refresh(rework)
    return rework


@app.get("/rework", response_model=list[ReworkOut])
def get_rework(db: Session = Depends(get_db)):
    return db.query(ReworkHours).order_by(ReworkHours.week_start.desc()).all()


@app.delete("/rework/{rework_id}", status_code=204)
def delete_rework(rework_id: int, db: Session = Depends(get_db)):
    rework = db.query(ReworkHours).filter(ReworkHours.id == rework_id).first()
    if not rework:
        raise HTTPException(status_code=404, detail="Rework entry not found")
    db.delete(rework)
    db.commit()
    return


# --- Indirect labor endpoints ---

@app.post("/indirect-labor", response_model=IndirectLaborOut, status_code=201)
def upsert_indirect_labor(data: IndirectLaborCreate, db: Session = Depends(get_db)):
    existing = db.query(IndirectLabor).filter(IndirectLabor.week_start == data.week_start).first()
    if existing:
        existing.total_labor_hours = data.total_labor_hours
        existing.indirect_hours    = data.indirect_hours
        existing.notes             = data.notes
        existing.updated_at        = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    record = IndirectLabor(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/indirect-labor", response_model=list[IndirectLaborOut])
def get_indirect_labor(db: Session = Depends(get_db)):
    return db.query(IndirectLabor).order_by(IndirectLabor.week_start.desc()).all()


@app.delete("/indirect-labor/{record_id}", status_code=204)
def delete_indirect_labor(record_id: int, db: Session = Depends(get_db)):
    record = db.query(IndirectLabor).filter(IndirectLabor.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Indirect labor entry not found")
    db.delete(record)
    db.commit()
    return


# --- Foreman endpoints ---

@app.get("/foremen", response_model=list[ForemanOut])
def get_foremen(db: Session = Depends(get_db)):
    return db.query(Foreman).order_by(Foreman.created_at.asc()).all()


@app.post("/foremen", response_model=ForemanOut, status_code=201)
def create_foreman(data: ForemanCreate, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(Foreman).filter(Foreman.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Foreman already exists")
    foreman = Foreman(name=name)
    db.add(foreman)
    db.commit()
    db.refresh(foreman)
    return foreman


@app.delete("/foremen/{foreman_id}", status_code=204)
def delete_foreman(foreman_id: int, db: Session = Depends(get_db)):
    foreman = db.query(Foreman).filter(Foreman.id == foreman_id).first()
    if not foreman:
        raise HTTPException(status_code=404, detail="Foreman not found")
    db.delete(foreman)
    db.commit()
    return


# --- OEE goals endpoints ---

@app.get("/oee/goals", response_model=OEEGoalsOut)
def get_goals(db: Session = Depends(get_db)):
    goals = db.query(OEEGoals).first()
    if not goals:
        goals = OEEGoals()
        db.add(goals)
        db.commit()
        db.refresh(goals)
    return goals


@app.put("/oee/goals", response_model=OEEGoalsOut)
def update_goals(data: OEEGoalsUpdate, db: Session = Depends(get_db)):
    goals = db.query(OEEGoals).first()
    if not goals:
        goals = OEEGoals()
        db.add(goals)

    if data.annual_dpu_goal    is not None: goals.annual_dpu_goal    = data.annual_dpu_goal
    if data.quarterly_dpu_goal is not None: goals.quarterly_dpu_goal = data.quarterly_dpu_goal
    if data.weekly_trucks_min  is not None: goals.weekly_trucks_min  = data.weekly_trucks_min
    if data.weekly_trucks_max  is not None: goals.weekly_trucks_max  = data.weekly_trucks_max

    goals.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(goals)
    return goals


@app.get("/oee/goal-history", response_model=list[GoalHistoryOut])
def get_goal_history(db: Session = Depends(get_db)):
    return db.query(GoalHistory).order_by(GoalHistory.effective_date.asc()).all()


@app.post("/oee/goal-history", response_model=GoalHistoryOut, status_code=201)
def create_goal_history(data: GoalHistoryUpdate, db: Session = Depends(get_db)):
    record = GoalHistory(
        effective_date     = data.effective_date,
        annual_dpu_goal    = data.annual_dpu_goal,
        quarterly_dpu_goal = data.quarterly_dpu_goal,
        weekly_trucks_min  = data.weekly_trucks_min,
        weekly_trucks_max  = data.weekly_trucks_max,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.put("/oee/goal-history/{history_id}", response_model=GoalHistoryOut)
def update_goal_history(history_id: int, data: GoalHistoryUpdate, db: Session = Depends(get_db)):
    record = db.query(GoalHistory).filter(GoalHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Goal history record not found")
    record.effective_date     = data.effective_date
    record.annual_dpu_goal    = data.annual_dpu_goal
    record.quarterly_dpu_goal = data.quarterly_dpu_goal
    record.weekly_trucks_min  = data.weekly_trucks_min
    record.weekly_trucks_max  = data.weekly_trucks_max
    db.commit()
    db.refresh(record)
    return record


@app.delete("/oee/goal-history/{history_id}", status_code=204)
def delete_goal_history(history_id: int, db: Session = Depends(get_db)):
    record = db.query(GoalHistory).filter(GoalHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Goal history record not found")
    db.delete(record)
    db.commit()
    return


# --- OEE summary endpoint ---

@app.get("/oee/summary")
def get_oee_summary(db: Session = Depends(get_db)):
    today         = date.today()
    week_start    = today - timedelta(days=today.weekday())
    last_week     = week_start - timedelta(days=7)
    year_start    = date(today.year, 1, 1)
    quarter       = (today.month - 1) // 3
    quarter_start = date(today.year, quarter * 3 + 1, 1)

    goals = db.query(OEEGoals).first()
    if not goals:
        goals = OEEGoals()
        db.add(goals)
        db.commit()

    work_orders    = db.query(WorkOrder).all()
    indirect_logs  = db.query(IndirectLabor).all()

    # Last week metrics
    last_week_wo  = [wo for wo in work_orders if wo.week_start == str(last_week)]
    total_trucks  = len(last_week_wo)
    total_defects = sum(wo.total_defects for wo in last_week_wo)

    weekly_target     = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2
    avg_dpu_last_week = round(total_defects / total_trucks, 2) if total_trucks > 0 else 0

    # Quality
    if avg_dpu_last_week == 0:
        quality = 0
    elif avg_dpu_last_week <= goals.quarterly_dpu_goal:
        quality = 100.0
    else:
        quality = round(goals.quarterly_dpu_goal / avg_dpu_last_week * 100, 1)

    # Performance
    performance = round(total_trucks / weekly_target * 100, 1) if weekly_target > 0 else 0

    # Availability — total labor hours minus indirect labor minus rework
    last_week_indirect    = next((r for r in indirect_logs if r.week_start == str(last_week)), None)
    last_week_rework = last_week_indirect.rework_hours if last_week_indirect else 0

    if last_week_indirect and last_week_indirect.total_labor_hours > 0:
        total_planned_mins = last_week_indirect.total_labor_hours * 60
        indirect_mins      = last_week_indirect.indirect_hours * 60
        rework_mins        = last_week_indirect.rework_hours * 60
        lost_mins          = indirect_mins + rework_mins
        availability       = round(max(0, (total_planned_mins - lost_mins) / total_planned_mins * 100), 1)
    else:
        availability = 0

    oee = round(availability / 100 * performance / 100 * quality / 100 * 100, 1)

    # Current quarter
    quarterly_wo      = [wo for wo in work_orders if wo.week_start >= str(quarter_start)]
    quarterly_trucks  = len(quarterly_wo)
    quarterly_defects = sum(wo.total_defects for wo in quarterly_wo)
    quarterly_dpu     = round(quarterly_defects / quarterly_trucks, 2) if quarterly_trucks > 0 else 0

    # Last quarter
    last_quarter_num = quarter - 1
    if last_quarter_num < 0:
        last_quarter_start = date(today.year - 1, 10, 1)
        last_quarter_end   = date(today.year, 1, 1)
    else:
        last_quarter_start = date(today.year, last_quarter_num * 3 + 1, 1)
        last_quarter_end   = quarter_start

    last_quarter_wo      = [wo for wo in work_orders if str(last_quarter_start) <= wo.week_start < str(last_quarter_end)]
    last_quarter_trucks  = len(last_quarter_wo)
    last_quarter_defects = sum(wo.total_defects for wo in last_quarter_wo)
    last_quarter_dpu     = round(last_quarter_defects / last_quarter_trucks, 2) if last_quarter_trucks > 0 else 0

    # Current year
    yearly_wo      = [wo for wo in work_orders if wo.week_start >= str(year_start)]
    yearly_trucks  = len(yearly_wo)
    yearly_defects = sum(wo.total_defects for wo in yearly_wo)
    yearly_dpu     = round(yearly_defects / yearly_trucks, 2) if yearly_trucks > 0 else 0

    # Last year
    last_year_start   = date(today.year - 1, 1, 1)
    last_year_end     = date(today.year, 1, 1)
    last_year_wo      = [wo for wo in work_orders if str(last_year_start) <= wo.week_start < str(last_year_end)]
    last_year_trucks  = len(last_year_wo)
    last_year_defects = sum(wo.total_defects for wo in last_year_wo)
    last_year_dpu     = round(last_year_defects / last_year_trucks, 2) if last_year_trucks > 0 else 0

    # Goal history lookup
    goal_history_records = db.query(GoalHistory).order_by(GoalHistory.effective_date.asc()).all()

    def get_goal_for_date(d):
        active = None
        for g in goal_history_records:
            if g.effective_date <= str(d):
                active = g
            else:
                break
        return active or goals

    last_quarter_goal = get_goal_for_date(last_quarter_start)
    last_year_goal    = get_goal_for_date(last_year_start)

    # Weekly DPU history
    weekly_data = {}
    for wo in work_orders:
        if wo.week_start not in weekly_data:
            weekly_data[wo.week_start] = {"trucks": 0, "defects": 0}
        weekly_data[wo.week_start]["trucks"]  += 1
        weekly_data[wo.week_start]["defects"] += wo.total_defects

    weeks_sorted     = sorted(weekly_data.items())
    dpu_history_full = []
    for i, (week, v) in enumerate(weeks_sorted):
        dpu   = round(v["defects"] / v["trucks"], 2) if v["trucks"] > 0 else 0
        prev  = round(weeks_sorted[i-1][1]["defects"] / weeks_sorted[i-1][1]["trucks"], 2) if i > 0 and weeks_sorted[i-1][1]["trucks"] > 0 else None
        trend = None
        if prev is not None:
            trend = "down" if dpu < prev else "up" if dpu > prev else "same"
        dpu_history_full.append({
            "week":   week,
            "dpu":    dpu,
            "trucks": v["trucks"],
            "trend":  trend,
        })

    # Best and worst week this quarter
    quarterly_weekly = {}
    for wo in quarterly_wo:
        if wo.week_start not in quarterly_weekly:
            quarterly_weekly[wo.week_start] = {"trucks": 0, "defects": 0}
        quarterly_weekly[wo.week_start]["trucks"]  += 1
        quarterly_weekly[wo.week_start]["defects"] += wo.total_defects

    quarterly_week_dpus = [
        {"week": w, "dpu": round(v["defects"] / v["trucks"], 2)}
        for w, v in quarterly_weekly.items() if v["trucks"] > 0
    ]

    best_week  = min(quarterly_week_dpus, key=lambda x: x["dpu"]) if quarterly_week_dpus else None
    worst_week = max(quarterly_week_dpus, key=lambda x: x["dpu"]) if quarterly_week_dpus else None

    # Downtime by machine this quarter — kept for reference
    downtime_logs = db.query(DowntimeLog).all()
    downtime_by_machine = {}
    for log in downtime_logs:
        if log.date >= str(quarter_start):
            downtime_by_machine[log.machine] = downtime_by_machine.get(log.machine, 0) + log.duration

    return {
        "oee":                       oee,
        "availability":              availability,
        "performance":               performance,
        "quality":                   quality,
        "trucks_this_week":          total_trucks,
        "avg_dpu_this_week":         avg_dpu_last_week,
        "quarterly_dpu":             quarterly_dpu,
        "last_quarter_dpu":          last_quarter_dpu,
        "last_quarter_dpu_goal":     last_quarter_goal.quarterly_dpu_goal,
        "yearly_dpu":                yearly_dpu,
        "last_year_dpu":             last_year_dpu,
        "last_year_dpu_goal":        last_year_goal.annual_dpu_goal,
        "dpu_history":               dpu_history_full,
        "downtime_by_machine":       downtime_by_machine,
        "last_week_rework_hours":    last_week_rework,
        "last_week_indirect_hours":  last_week_indirect.indirect_hours if last_week_indirect else 0,
        "last_week_total_hours":     last_week_indirect.total_labor_hours if last_week_indirect else 0,
        "best_week_quarter":         best_week,
        "worst_week_quarter":        worst_week,
        "goals": {
            "annual_dpu_goal":    goals.annual_dpu_goal,
            "quarterly_dpu_goal": goals.quarterly_dpu_goal,
            "weekly_trucks_min":  goals.weekly_trucks_min,
            "weekly_trucks_max":  goals.weekly_trucks_max,
        }
    }