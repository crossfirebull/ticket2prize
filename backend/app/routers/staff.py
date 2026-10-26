import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import DB, StaffAccount
from app.models import Order, OrderStatus, Prize
from app.routers.orders import cancel_order
from app.schemas import OrderOut, PrizeOut, StockUpdate

router = APIRouter(prefix="/api/staff", tags=["staff"])


def _order(db: DB, order_id: uuid.UUID) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return order


@router.get("/orders", response_model=list[OrderOut])
def pickup_queue(db: DB, _staff: StaffAccount, status: OrderStatus = OrderStatus.pending):
    stmt = select(Order).where(Order.status == status).order_by(Order.created_at).limit(100)
    return db.scalars(stmt).all()


@router.get("/orders/by-code/{pickup_code}", response_model=OrderOut)
def find_by_pickup_code(pickup_code: str, db: DB, _staff: StaffAccount):
    order = db.scalar(select(Order).where(Order.pickup_code == pickup_code.strip().upper()))
    if order is None:
        raise HTTPException(404, "No order with that pickup code")
    return order


@router.post("/orders/{order_id}/fulfill", response_model=OrderOut)
def fulfill(order_id: uuid.UUID, db: DB, staff: StaffAccount):
    order = _order(db, order_id)
    if order.status != OrderStatus.pending:
        raise HTTPException(409, f"Order is already {order.status}")
    order.status = OrderStatus.fulfilled
    order.closed_at = datetime.now(UTC)
    order.fulfilled_by = staff.id
    db.commit()
    return order


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel(order_id: uuid.UUID, db: DB, _staff: StaffAccount):
    order = _order(db, order_id)
    cancel_order(db, order, "staff_refund")
    db.commit()
    return order


@router.get("/prizes/low-stock", response_model=list[PrizeOut])
def low_stock(db: DB, _staff: StaffAccount, threshold: int = 5):
    stmt = select(Prize).where(Prize.stock <= threshold).order_by(Prize.stock, Prize.name)
    return db.scalars(stmt).all()


@router.put("/prizes/{prize_id}/stock", response_model=PrizeOut)
def set_stock(prize_id: int, body: StockUpdate, db: DB, _staff: StaffAccount):
    prize = db.get(Prize, prize_id)
    if prize is None:
        raise HTTPException(404, "Prize not found")
    prize.stock = body.stock
    db.commit()
    return prize
