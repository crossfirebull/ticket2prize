from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select

from app.deps import DB
from app.models import Prize
from app.schemas import PrizeOut

router = APIRouter(prefix="/api", tags=["prizes"])


@router.get("/prizes", response_model=list[PrizeOut])
def list_prizes(
    db: DB,
    category: str | None = None,
    q: str | None = Query(default=None, max_length=80),
    in_stock: bool = False,
):
    stmt = select(Prize).order_by(Prize.ticket_cost, Prize.name)
    if category:
        stmt = stmt.where(Prize.category == category)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Prize.name.ilike(pattern), Prize.description.ilike(pattern)))
    if in_stock:
        stmt = stmt.where(Prize.stock > 0)
    return db.scalars(stmt).all()


@router.get("/prizes/{prize_id}", response_model=PrizeOut)
def get_prize(prize_id: int, db: DB):
    prize = db.get(Prize, prize_id)
    if prize is None:
        raise HTTPException(404, "Prize not found")
    return prize


@router.get("/categories", response_model=list[str])
def list_categories(db: DB):
    return db.scalars(select(Prize.category).distinct().order_by(Prize.category)).all()
