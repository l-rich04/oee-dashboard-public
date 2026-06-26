from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
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
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    production_id   = Column(Integer, nullable=True)


class IssueUpdate(Base):
    __tablename__ = "issue_updates"

    id         = Column(Integer, primary_key=True, index=True)
    issue_id   = Column(Integer, nullable=False)
    update_num = Column(Integer, nullable=False)
    note       = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database and tables created successfully.")