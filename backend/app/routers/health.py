from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.deps import DB

router = APIRouter(tags=["health"])


@router.get("/healthz")
def liveness():
    return {"status": "ok"}


@router.get("/readyz")
def readiness(db: DB):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(503, "database unavailable") from None
    return {"status": "ready"}
