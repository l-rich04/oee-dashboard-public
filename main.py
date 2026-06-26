from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from database import Base, engine, get_db, Issue, IssueUpdate

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
def get_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from database import Issue as IssueModel

    by_status   = db.query(IssueModel.status, func.count()).group_by(IssueModel.status).all()
    by_category = db.query(IssueModel.category, func.count()).group_by(IssueModel.category).all()
    by_foreman  = db.query(IssueModel.foreman_name, func.count()).group_by(IssueModel.foreman_name).all()
    by_type     = db.query(IssueModel.issue_type, func.count()).group_by(IssueModel.issue_type).all()

    return {
        "by_status":   {s: c for s, c in by_status},
        "by_category": {cat: c for cat, c in by_category},
        "by_foreman":  {f: c for f, c in by_foreman},
        "by_type":     {t: c for t, c in by_type},
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

    if data.resolution_note is not None:
        issue.resolution_note = data.resolution_note

    if data.issue_type is not None:
        if data.issue_type not in ("part", "process"):
            raise HTTPException(status_code=400, detail="issue_type must be 'part' or 'process'")
        issue.issue_type = data.issue_type

    if data.category is not None:
        issue.category = data.category

    if data.description is not None:
        issue.description = data.description

    if data.created_at is not None:
        issue.created_at = data.created_at

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

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

frontend_path = os.path.join(os.path.dirname(__file__), "frontend", "dist")

if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(frontend_path, "index.html"))