import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional
from database import Base, engine, get_db, Issue, IssueUpdate, WorkOrder, DowntimeLog, OEEGoals, ReworkHours, Foreman, GoalHistory, IndirectLabor, Supervisor, TruckType, DefectType, WorkOrderDefect, IssueCategory, DashboardSettings

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


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
    solved_by:       Optional[str] = None
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
    solved_by:       Optional[str] = None
    created_at:      datetime
    updated_at:      datetime
    production_id:   Optional[int]
    update_count:    Optional[int] = 0
    is_read:         bool = False

    model_config = {"from_attributes": True}


class IssueUpdateCreate(BaseModel):
    note:    str
    made_by: Optional[str] = None


class IssueUpdateOut(BaseModel):
    id:         int
    issue_id:   int
    update_num: int
    note:       str
    made_by:    Optional[str] = None
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


class WorkOrderDefectCreate(BaseModel):
    defect_type_id: int
    quantity:       int = 1


class WorkOrderDefectOut(BaseModel):
    id:               int
    work_order_id:    int
    defect_type_id:   int
    defect_type_name: Optional[str] = None
    quantity:         int
    created_at:       datetime

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
    working_days:      int = 5
    total_labor_hours: float
    indirect_hours:    float
    rework_hours:      float = 0
    notes:             Optional[str] = None


class IndirectLaborOut(BaseModel):
    id:                int
    week_start:        str
    working_days:      int
    total_labor_hours: float
    indirect_hours:    float
    rework_hours:      float
    notes:             Optional[str]
    created_at:        datetime
    updated_at:        datetime

    model_config = {"from_attributes": True}


class OEEGoalsUpdate(BaseModel):
    annual_dpu_goal:        Optional[float] = None
    quarterly_dpu_goal:     Optional[float] = None
    weekly_trucks_min:      Optional[int]   = None
    weekly_trucks_max:      Optional[int]   = None
    effective_date:         Optional[str]   = None
    alert_oee_min:          Optional[float] = None
    alert_availability_min: Optional[float] = None
    alert_performance_min:  Optional[float] = None
    alert_quality_min:      Optional[float] = None
    alert_stale_days:       Optional[int]   = None


class OEEGoalsOut(BaseModel):
    id:                     int
    annual_dpu_goal:        float
    quarterly_dpu_goal:     float
    weekly_trucks_min:      int
    weekly_trucks_max:      int
    alert_oee_min:          float
    alert_availability_min: float
    alert_performance_min:  float
    alert_quality_min:      float
    alert_stale_days:       int
    updated_at:             datetime

    model_config = {"from_attributes": True}


class ForemanCreate(BaseModel):
    name: str


class ForemanOut(BaseModel):
    id:         int
    name:       str
    created_at: datetime

    model_config = {"from_attributes": True}


class SupervisorCreate(BaseModel):
    name: str


class SupervisorOut(BaseModel):
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


class IssueCategoryCreate(BaseModel):
    issue_type: str
    name:       str


class IssueCategoryOut(BaseModel):
    id:         int
    issue_type: str
    name:       str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Issue endpoints ---

@app.post("/issues", response_model=IssueOut, status_code=201)
def create_issue(data: IssueCreate, db: Session = Depends(get_db)):
    if data.issue_type not in ("part", "process"):
        raise HTTPException(status_code=400, detail="issue_type must be 'part' or 'process'")
    issue_data = data.model_dump()
    if issue_data.get("created_at") is None:
        issue_data["created_at"] = datetime.utcnow()
    issue = Issue(**issue_data)
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return IssueOut.model_validate(issue)


@app.post("/issues/bulk", status_code=201)
def bulk_create_issues(data: list[IssueCreate], db: Session = Depends(get_db)):
    created = []
    for item in data:
        if not item.issue_type or not item.category or not item.description or not item.foreman_name:
            continue
        issue_data = item.model_dump()
        if issue_data.get("created_at") is None:
            issue_data["created_at"] = datetime.utcnow()
        issue = Issue(**issue_data)
        db.add(issue)
        created.append(issue)
    db.commit()
    for issue in created:
        db.refresh(issue)
    return {"created": len(created)}


@app.get("/issues/summary/counts")
def get_summary(period: Optional[str] = None, db: Session = Depends(get_db)):
    today = date.today()
    if period == "weekly":
        since = today - timedelta(days=7)
    elif period == "mtd":
        since = date(today.year, today.month, 1)
    elif period == "ytd":
        since = date(today.year, 1, 1)
    else:
        since = None

    query = db.query(Issue)
    if since:
        query = query.filter(Issue.created_at >= datetime.combine(since, datetime.min.time()))

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

    query = db.query(Issue)
    if status:
        query = query.filter(Issue.status == status)
    if category:
        query = query.filter(Issue.category == category)
    issues = query.order_by(Issue.created_at.desc()).all()

    counts = dict(
        db.query(IssueUpdate.issue_id, func.count())
          .group_by(IssueUpdate.issue_id)
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
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return IssueOut.model_validate(issue)


@app.put("/issues/{issue_id}", response_model=IssueOut)
def update_issue(issue_id: int, data: IssueUpdateSchema, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if data.status:
        allowed = ("open", "in_progress", "solved")
        if data.status not in allowed:
            raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
        issue.status = data.status

    if data.resolution_note is not None: issue.resolution_note = data.resolution_note
    if data.solved_by       is not None: issue.solved_by       = data.solved_by
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
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.query(IssueUpdate).filter(IssueUpdate.issue_id == issue_id).delete()
    db.delete(issue)
    db.commit()
    return


@app.get("/issues/{issue_id}/updates", response_model=list[IssueUpdateOut])
def get_updates(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return db.query(IssueUpdate)\
             .filter(IssueUpdate.issue_id == issue_id)\
             .order_by(IssueUpdate.update_num)\
             .all()


@app.post("/issues/{issue_id}/updates", response_model=IssueUpdateOut, status_code=201)
def add_update(issue_id: int, data: IssueUpdateCreate, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    existing = db.query(IssueUpdate)\
                 .filter(IssueUpdate.issue_id == issue_id)\
                 .count()

    update = IssueUpdate(
        issue_id=issue_id,
        update_num=existing + 1,
        note=data.note,
        made_by=data.made_by,
    )
    db.add(update)
    issue.is_read    = False
    issue.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(update)
    return update


@app.put("/issues/{issue_id}/updates/{update_id}", response_model=IssueUpdateOut)
def edit_update(issue_id: int, update_id: int, data: IssueUpdateCreate, db: Session = Depends(get_db)):
    update = db.query(IssueUpdate).filter(
        IssueUpdate.id == update_id,
        IssueUpdate.issue_id == issue_id
    ).first()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    update.note    = data.note
    update.made_by = data.made_by
    db.commit()
    db.refresh(update)
    return update


@app.delete("/issues/{issue_id}/updates/{update_id}", status_code=204)
def delete_update(issue_id: int, update_id: int, db: Session = Depends(get_db)):
    update = db.query(IssueUpdate).filter(
        IssueUpdate.id == update_id,
        IssueUpdate.issue_id == issue_id
    ).first()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    db.delete(update)
    db.commit()
    return


@app.put("/issues/{issue_id}/read", response_model=IssueOut)
def mark_issue_read(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.is_read    = True
    issue.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    return IssueOut.model_validate(issue)


# --- Issue category endpoints ---

@app.get("/issue-categories", response_model=list[IssueCategoryOut])
def get_issue_categories(db: Session = Depends(get_db)):
    return db.query(IssueCategory).order_by(IssueCategory.issue_type, IssueCategory.name).all()


@app.post("/issue-categories", response_model=IssueCategoryOut, status_code=201)
def create_issue_category(data: IssueCategoryCreate, db: Session = Depends(get_db)):
    name = data.name.strip().lower().replace(" ", "_")
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(IssueCategory).filter(
        IssueCategory.name == name,
        IssueCategory.issue_type == data.issue_type
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = IssueCategory(issue_type=data.issue_type, name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@app.delete("/issue-categories/{cat_id}", status_code=204)
def delete_issue_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(IssueCategory).filter(IssueCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return


@app.put("/issue-categories/{cat_id}", response_model=IssueCategoryOut)
def update_issue_category(cat_id: int, data: dict, db: Session = Depends(get_db)):
    cat = db.query(IssueCategory).filter(IssueCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    new_name = data.get("name", "").strip().lower().replace(" ", "_")
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(IssueCategory).filter(
        IssueCategory.name == new_name,
        IssueCategory.issue_type == cat.issue_type,
        IssueCategory.id != cat_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A category with that name already exists")
    old_name = cat.name
    cat.name = new_name
    if old_name != new_name:
        db.query(Issue).filter(
            Issue.category == old_name,
            Issue.issue_type == cat.issue_type,
        ).update({"category": new_name})
    db.commit()
    db.refresh(cat)
    return cat


# --- Work order endpoints ---

@app.post("/work-orders", response_model=WorkOrderOut, status_code=201)
def create_work_order(data: WorkOrderCreate, db: Session = Depends(get_db)):
    new_year = data.week_start[:4]  # "2026-07-13" -> "2026"

    existing = db.query(WorkOrder).filter(
        WorkOrder.work_order_num == data.work_order_num,
        WorkOrder.week_start.like(f"{new_year}-%"),
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Work order {data.work_order_num} already exists for {new_year} "
                f"(week of {existing.week_start}). Add defects to the existing "
                f"entry instead of creating a new one."
            ),
        )

    wo = WorkOrder(**data.model_dump())
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return wo


@app.get("/work-orders", response_model=list[WorkOrderOut])
def get_work_orders(db: Session = Depends(get_db)):
    return db.query(WorkOrder).order_by(WorkOrder.created_at.desc()).all()


@app.put("/work-orders/{wo_id}")
def update_work_order(wo_id: int, data: dict, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if "work_order_num" in data: wo.work_order_num = data["work_order_num"]
    if "truck_type"     in data: wo.truck_type     = data["truck_type"]
    # total_defects is intentionally NOT settable here — it is always
    # derived from the real WorkOrderDefect rows, never taken from the
    # request body, no matter what the caller sends.

    rows = db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo_id).all()
    wo.total_defects = sum(r.quantity for r in rows)

    db.commit()
    db.refresh(wo)
    return wo


@app.delete("/work-orders/{wo_id}", status_code=204)
def delete_work_order(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Delete this work order's defect rows first, so nothing orphaned is
    # left behind for a future work order to accidentally inherit (SQLite
    # can reuse a deleted row's id for the next new record).
    db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo_id).delete()

    db.delete(wo)
    db.commit()
    return


@app.get("/work-orders/{wo_id}/defects")
def get_work_order_defects(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    defects = db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo_id).all()
    result = []
    for d in defects:
        dt = db.query(DefectType).filter(DefectType.id == d.defect_type_id).first()
        result.append({
            "id":               d.id,
            "work_order_id":    d.work_order_id,
            "defect_type_id":   d.defect_type_id,
            "defect_type_name": dt.name if dt else "Unknown",
            "quantity":         d.quantity,
        })
    return result


@app.post("/work-orders/{wo_id}/defects", response_model=WorkOrderDefectOut, status_code=201)
def add_wo_defect(wo_id: int, data: WorkOrderDefectCreate, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    existing = db.query(WorkOrderDefect).filter(
        WorkOrderDefect.work_order_id == wo_id,
        WorkOrderDefect.defect_type_id == data.defect_type_id,
    ).first()

    if existing:
        # Same defect type already on this work order — add to its quantity
        # rather than creating a duplicate row. 3 (existing) + 2 (new) = 5,
        # exactly the same total as two separate rows of 3 and 2 would give.
        existing.quantity += data.quantity
        defect = existing
    else:
        defect = WorkOrderDefect(
            work_order_id=wo_id,
            defect_type_id=data.defect_type_id,
            quantity=data.quantity,
        )
        db.add(defect)

    db.flush()
    all_defects      = db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo_id).all()
    wo.total_defects = sum(d.quantity for d in all_defects)
    db.commit()
    db.refresh(defect)
    dt = db.query(DefectType).filter(DefectType.id == data.defect_type_id).first()
    return WorkOrderDefectOut(
        id=defect.id, work_order_id=defect.work_order_id,
        defect_type_id=defect.defect_type_id,
        defect_type_name=dt.name if dt else None,
        quantity=defect.quantity, created_at=defect.created_at,
    )


@app.delete("/work-orders/{wo_id}/defects/{defect_id}", status_code=204)
def delete_work_order_defect(wo_id: int, defect_id: int, db: Session = Depends(get_db)):
    defect = db.query(WorkOrderDefect).filter(
        WorkOrderDefect.id == defect_id,
        WorkOrderDefect.work_order_id == wo_id
    ).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    db.delete(defect)
    db.commit()
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if wo:
        rows = db.query(WorkOrderDefect).filter(WorkOrderDefect.work_order_id == wo_id).all()
        wo.total_defects = sum(r.quantity for r in rows)
        db.commit()
    return


@app.get("/work-orders/defects/all")
def get_all_defect_breakdowns(db: Session = Depends(get_db)):
    defects = db.query(WorkOrderDefect).all()
    result  = []
    for d in defects:
        wo = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
        dt = db.query(DefectType).filter(DefectType.id == d.defect_type_id).first()
        if wo and dt:
            result.append({
                "work_order_id":  d.work_order_id,
                "week_start":     wo.week_start,
                "truck_type":     wo.truck_type,
                "defect_type":    dt.name,
                "defect_type_id": d.defect_type_id,
                "quantity":       d.quantity,
            })
    return result


@app.put("/work-orders/{wo_id}/read")
def mark_work_order_read(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    wo.is_read = True
    db.commit()
    db.refresh(wo)
    return wo


# --- Truck type endpoints ---

@app.get("/truck-types")
def get_truck_types(db: Session = Depends(get_db)):
    return db.query(TruckType).order_by(TruckType.name).all()


@app.post("/truck-types", status_code=201)
def create_truck_type(data: dict, db: Session = Depends(get_db)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(TruckType).filter(TruckType.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Truck type already exists")
    tt = TruckType(name=name)
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt


@app.delete("/truck-types/{tt_id}", status_code=204)
def delete_truck_type(tt_id: int, db: Session = Depends(get_db)):
    tt = db.query(TruckType).filter(TruckType.id == tt_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Truck type not found")
    db.delete(tt)
    db.commit()
    return


@app.put("/truck-types/{tt_id}")
def update_truck_type(tt_id: int, data: dict, db: Session = Depends(get_db)):
    tt = db.query(TruckType).filter(TruckType.id == tt_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Truck type not found")
    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(TruckType).filter(TruckType.name == new_name, TruckType.id != tt_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A truck type with that name already exists")
    old_name = tt.name
    tt.name = new_name
    if old_name != new_name:
        db.query(WorkOrder).filter(WorkOrder.truck_type == old_name).update({"truck_type": new_name})
    db.commit()
    db.refresh(tt)
    return tt


# --- Defect type endpoints ---

@app.get("/defect-types")
def get_defect_types(db: Session = Depends(get_db)):
    return db.query(DefectType).filter(DefectType.active == True).order_by(DefectType.name).all()


@app.post("/defect-types", status_code=201)
def create_defect_type(data: dict, db: Session = Depends(get_db)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(DefectType).filter(DefectType.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Defect type already exists")
    dt = DefectType(name=name)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return dt


@app.put("/defect-types/{dt_id}")
def update_defect_type(dt_id: int, data: dict, db: Session = Depends(get_db)):
    dt = db.query(DefectType).filter(DefectType.id == dt_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Defect type not found")
    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(DefectType).filter(DefectType.name == new_name, DefectType.id != dt_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A defect type with that name already exists")
    # No cascade needed here — WorkOrderDefect references defect_type_id,
    # not the name, so renaming is automatically reflected everywhere.
    dt.name = new_name
    db.commit()
    db.refresh(dt)
    return dt


@app.delete("/defect-types/{dt_id}", status_code=204)
def delete_defect_type(dt_id: int, db: Session = Depends(get_db)):
    dt = db.query(DefectType).filter(DefectType.id == dt_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Defect type not found")
    # Soft-delete: hides it from new selections, but any existing
    # WorkOrderDefect row that references this id still resolves its name
    # correctly forever, since the row itself is never removed.
    dt.active = False
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
        existing.working_days      = data.working_days
        existing.total_labor_hours = data.total_labor_hours
        existing.indirect_hours    = data.indirect_hours
        existing.rework_hours      = data.rework_hours
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


@app.put("/foremen/{foreman_id}", response_model=ForemanOut)
def update_foreman(foreman_id: int, data: dict, db: Session = Depends(get_db)):
    foreman = db.query(Foreman).filter(Foreman.id == foreman_id).first()
    if not foreman:
        raise HTTPException(status_code=404, detail="Foreman not found")
    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(Foreman).filter(Foreman.name == new_name, Foreman.id != foreman_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A foreman with that name already exists")
    old_name = foreman.name
    foreman.name = new_name
    if old_name != new_name:
        db.query(Issue).filter(Issue.foreman_name == old_name).update({"foreman_name": new_name})
    db.commit()
    db.refresh(foreman)
    return foreman


# --- Supervisor endpoints ---

@app.get("/supervisors", response_model=list[SupervisorOut])
def get_supervisors(db: Session = Depends(get_db)):
    return db.query(Supervisor).order_by(Supervisor.created_at.asc()).all()


@app.post("/supervisors", response_model=SupervisorOut, status_code=201)
def create_supervisor(data: SupervisorCreate, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(Supervisor).filter(Supervisor.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supervisor already exists")
    supervisor = Supervisor(name=name)
    db.add(supervisor)
    db.commit()
    db.refresh(supervisor)
    return supervisor


@app.delete("/supervisors/{supervisor_id}", status_code=204)
def delete_supervisor(supervisor_id: int, db: Session = Depends(get_db)):
    supervisor = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="Supervisor not found")
    db.delete(supervisor)
    db.commit()
    return


@app.put("/supervisors/{supervisor_id}", response_model=SupervisorOut)
def update_supervisor(supervisor_id: int, data: dict, db: Session = Depends(get_db)):
    supervisor = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="Supervisor not found")
    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    existing = db.query(Supervisor).filter(Supervisor.name == new_name, Supervisor.id != supervisor_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A supervisor with that name already exists")
    old_name = supervisor.name
    supervisor.name = new_name
    if old_name != new_name:
        db.query(Issue).filter(Issue.solved_by == old_name).update({"solved_by": new_name})
        db.query(IssueUpdate).filter(IssueUpdate.made_by == old_name).update({"made_by": new_name})
    db.commit()
    db.refresh(supervisor)
    return supervisor


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

    if data.annual_dpu_goal        is not None: goals.annual_dpu_goal        = data.annual_dpu_goal
    if data.quarterly_dpu_goal     is not None: goals.quarterly_dpu_goal     = data.quarterly_dpu_goal
    if data.weekly_trucks_min      is not None: goals.weekly_trucks_min      = data.weekly_trucks_min
    if data.weekly_trucks_max      is not None: goals.weekly_trucks_max      = data.weekly_trucks_max
    if data.alert_oee_min          is not None: goals.alert_oee_min          = data.alert_oee_min
    if data.alert_availability_min is not None: goals.alert_availability_min = data.alert_availability_min
    if data.alert_performance_min  is not None: goals.alert_performance_min  = data.alert_performance_min
    if data.alert_quality_min      is not None: goals.alert_quality_min      = data.alert_quality_min
    if data.alert_stale_days       is not None: goals.alert_stale_days       = data.alert_stale_days

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

    work_orders   = db.query(WorkOrder).all()
    indirect_logs = db.query(IndirectLabor).all()

    # Goal-history lookup — computed once here, reused everywhere below,
    # so quality/oee and every other goal-aware figure in this function
    # always agree with each other and with what Morning Huddle computes
    # locally from the same data.
    goal_history_records = db.query(GoalHistory).order_by(GoalHistory.effective_date.asc()).all()

    def get_goal_for_date(d):
        active = None
        for g in goal_history_records:
            if g.effective_date <= str(d):
                active = g
            else:
                break
        return active or goals

    last_week_goal = get_goal_for_date(last_week)

    last_week_wo  = [wo for wo in work_orders if wo.week_start == str(last_week)]
    total_trucks  = len(last_week_wo)
    total_defects = sum(wo.total_defects for wo in last_week_wo)

    weekly_target     = (goals.weekly_trucks_min + goals.weekly_trucks_max) / 2
    avg_dpu_last_week = round(total_defects / total_trucks, 2) if total_trucks > 0 else 0

    if avg_dpu_last_week == 0:
        quality = 0
    elif avg_dpu_last_week <= last_week_goal.quarterly_dpu_goal:
        quality = 100.0
    else:
        quality = round(last_week_goal.quarterly_dpu_goal / avg_dpu_last_week * 100, 1)

    last_week_indirect = next((r for r in indirect_logs if r.week_start == str(last_week)), None)
    working_days       = last_week_indirect.working_days if last_week_indirect else 5
    day_ratio          = working_days / 5
    adjusted_target    = weekly_target * day_ratio
    performance        = round(total_trucks / adjusted_target * 100, 1) if adjusted_target > 0 else 0

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

    quarterly_wo      = [wo for wo in work_orders if wo.week_start >= str(quarter_start)]
    quarterly_trucks  = len(quarterly_wo)
    quarterly_defects = sum(wo.total_defects for wo in quarterly_wo)
    quarterly_dpu     = round(quarterly_defects / quarterly_trucks, 2) if quarterly_trucks > 0 else 0

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

    yearly_wo      = [wo for wo in work_orders if wo.week_start >= str(year_start)]
    yearly_trucks  = len(yearly_wo)
    yearly_defects = sum(wo.total_defects for wo in yearly_wo)
    yearly_dpu     = round(yearly_defects / yearly_trucks, 2) if yearly_trucks > 0 else 0

    last_year_start   = date(today.year - 1, 1, 1)
    last_year_end     = date(today.year, 1, 1)
    last_year_wo      = [wo for wo in work_orders if str(last_year_start) <= wo.week_start < str(last_year_end)]
    last_year_trucks  = len(last_year_wo)
    last_year_defects = sum(wo.total_defects for wo in last_year_wo)
    last_year_dpu     = round(last_year_defects / last_year_trucks, 2) if last_year_trucks > 0 else 0

    last_quarter_goal    = get_goal_for_date(last_quarter_start)
    last_year_goal       = get_goal_for_date(last_year_start)
    overview_quarter_goal = get_goal_for_date(quarter_start)

    weekly_data = {}
    for wo in work_orders:
        if wo.week_start not in weekly_data:
            weekly_data[wo.week_start] = {"trucks": 0, "defects": 0}
        weekly_data[wo.week_start]["trucks"]  += 1
        weekly_data[wo.week_start]["defects"] += wo.total_defects

    weeks_sorted     = sorted(weekly_data.items())
    dpu_history_full = []
    for i, (week, v) in enumerate(weeks_sorted):
        dpu  = round(v["defects"] / v["trucks"], 2) if v["trucks"] > 0 else 0
        prev = round(weeks_sorted[i-1][1]["defects"] / weeks_sorted[i-1][1]["trucks"], 2) if i > 0 and weeks_sorted[i-1][1]["trucks"] > 0 else None
        trend = None
        if prev is not None:
            trend = "down" if dpu < prev else "up" if dpu > prev else "same"
        dpu_history_full.append({"week": week, "dpu": dpu, "trucks": v["trucks"], "trend": trend})

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

    downtime_logs = db.query(DowntimeLog).all()
    downtime_by_machine = {}
    for log in downtime_logs:
        if log.date >= str(quarter_start):
            downtime_by_machine[log.machine] = downtime_by_machine.get(log.machine, 0) + log.duration

    return {
        "oee":                      oee,
        "availability":             availability,
        "performance":              performance,
        "quality":                  quality,
        "trucks_this_week":         total_trucks,
        "avg_dpu_this_week":        avg_dpu_last_week,
        "quarterly_dpu":            quarterly_dpu,
        "last_quarter_dpu":         last_quarter_dpu,
        "last_quarter_dpu_goal":    last_quarter_goal.quarterly_dpu_goal,
        "yearly_dpu":               yearly_dpu,
        "last_year_dpu":            last_year_dpu,
        "last_year_dpu_goal":       last_year_goal.annual_dpu_goal,
        "dpu_history":              dpu_history_full,
        "downtime_by_machine":      downtime_by_machine,
        "last_week_rework_hours":   last_week_rework,
        "last_week_indirect_hours": last_week_indirect.indirect_hours if last_week_indirect else 0,
        "last_week_total_hours":    last_week_indirect.total_labor_hours if last_week_indirect else 0,
        "last_week_working_days":   working_days,
        "best_week_quarter":        best_week,
        "worst_week_quarter":       worst_week,
        "indirect_labor_history": [
            {
                "week_start":        r.week_start,
                "total_labor_hours": r.total_labor_hours,
                "indirect_hours":    r.indirect_hours,
                "rework_hours":      r.rework_hours,
                "working_days":      r.working_days if r.working_days else 5,
            }
            for r in indirect_logs
        ],
        "goals": {
            "annual_dpu_goal":      overview_quarter_goal.annual_dpu_goal,
            "quarterly_dpu_goal":   overview_quarter_goal.quarterly_dpu_goal,
            "weekly_trucks_min":    goals.weekly_trucks_min,
            "weekly_trucks_max":    goals.weekly_trucks_max,
            "alert_oee_min":          getattr(goals, "alert_oee_min",          60.0),
            "alert_availability_min": getattr(goals, "alert_availability_min", 50.0),
            "alert_performance_min":  getattr(goals, "alert_performance_min",  50.0),
            "alert_quality_min":      getattr(goals, "alert_quality_min",      50.0),
            "alert_stale_days":       getattr(goals, "alert_stale_days",       14),
        }
    }


@app.get("/export/all")
def export_all(db: Session = Depends(get_db)):
    issues       = db.query(Issue).order_by(Issue.created_at.desc()).all()
    updates      = db.query(IssueUpdate).order_by(IssueUpdate.issue_id, IssueUpdate.update_num).all()
    work_orders  = db.query(WorkOrder).order_by(WorkOrder.week_start.desc()).all()
    indirect     = db.query(IndirectLabor).order_by(IndirectLabor.week_start.desc()).all()
    goal_history = db.query(GoalHistory).order_by(GoalHistory.effective_date.asc()).all()
    foremen      = db.query(Foreman).order_by(Foreman.created_at.asc()).all()
    supervisors  = db.query(Supervisor).order_by(Supervisor.created_at.asc()).all()

    defect_breakdown = []
    defects = db.query(WorkOrderDefect).all()
    for d in defects:
        wo = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
        dt = db.query(DefectType).filter(DefectType.id == d.defect_type_id).first()
        if wo and dt:
            defect_breakdown.append({
                "work_order_num": wo.work_order_num,
                "truck_type":     wo.truck_type,
                "week_start":     wo.week_start,
                "defect_type":    dt.name,
                "quantity":       d.quantity,
            })

    return {
        "issues": [
            {
                "id":              i.id,
                "issue_type":      i.issue_type,
                "category":        i.category.replace("_", " ").title(),
                "description":     i.description,
                "foreman_name":    i.foreman_name,
                "status":          i.status,
                "resolution_note": i.resolution_note,
                "solved_by":       i.solved_by,
                "created_at":      str(i.created_at),
                "updated_at":      str(i.updated_at),
            }
            for i in issues
        ],
        "issue_updates": [
            {
                "issue_id":   u.issue_id,
                "update_num": u.update_num,
                "note":       u.note,
                "made_by":    u.made_by,
                "created_at": str(u.created_at),
            }
            for u in updates
        ],
        "work_orders": [
            {
                "work_order_num":  wo.work_order_num,
                "truck_type":      wo.truck_type,
                "units_completed": wo.units_completed,
                "total_defects":   wo.total_defects,
                "week_start":      wo.week_start,
                "created_at":      str(wo.created_at),
            }
            for wo in work_orders
        ],
        "defect_breakdown": defect_breakdown,
        "labor_hours": [
            {
                "week_start":        r.week_start,
                "working_days":      r.working_days,
                "total_labor_hours": r.total_labor_hours,
                "indirect_hours":    r.indirect_hours,
                "rework_hours":      r.rework_hours,
                "notes":             r.notes,
            }
            for r in indirect
        ],
        "goal_history": [
            {
                "effective_date":     g.effective_date,
                "annual_dpu_goal":    g.annual_dpu_goal,
                "quarterly_dpu_goal": g.quarterly_dpu_goal,
                "weekly_trucks_min":  g.weekly_trucks_min,
                "weekly_trucks_max":  g.weekly_trucks_max,
            }
            for g in goal_history
        ],
        "foremen":     [{"name": f.name} for f in foremen],
        "supervisors": [{"name": s.name} for s in supervisors],
    }


# --- Auth endpoints ---

@app.post("/auth/verify")
def verify_password(data: dict, db: Session = Depends(get_db)):
    password = data.get("password", "")
    setting = db.query(DashboardSettings).first()
    if setting and hash_pw(password) == setting.password_hash:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Incorrect password")


@app.post("/auth/change-password")
def change_password(data: dict, db: Session = Depends(get_db)):
    current  = data.get("current_password", "")
    new_pass = data.get("new_password", "")
    setting = db.query(DashboardSettings).first()
    if not setting or hash_pw(current) != setting.password_hash:
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(new_pass) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    setting.password_hash = hash_pw(new_pass)
    setting.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}