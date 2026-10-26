import uuid
from collections import Counter
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import DB, CurrentPrincipal
from app.models import Order, OrderItem, OrderStatus, Prize
from app.schemas import OrderIn, OrderOut
from app.security import new_pickup_code
from app.wallets import InsufficientTickets, OutOfStock, credit, debit, return_stock, take_stock

router = APIRouter(prefix="/api", tags=["orders"])


def _unique_pickup_code(db: DB) -> str:
    while True:
        code = new_pickup_code()
        if db.scalar(select(Order.id).where(Order.pickup_code == code)) is None:
            return code


def cancel_order(db: DB, order: Order, reason: str) -> None:
    """Refund tickets and put prizes back on the shelf."""
    if order.status != OrderStatus.pending:
        raise HTTPException(409, f"Order is already {order.status}")
    for item in order.items:
        return_stock(db, item.prize_id, item.quantity)
    credit(db, order.wallet_id, order.total_tickets, reason, str(order.id))
    order.status = OrderStatus.cancelled
    order.closed_at = datetime.now(UTC)


@router.post("/orders", response_model=OrderOut, status_code=201)
def checkout(body: OrderIn, db: DB, principal: CurrentPrincipal):
    quantities = Counter()
    for line in body.items:
        quantities[line.prize_id] += line.quantity

    prizes = {p.id: p for p in db.scalars(select(Prize).where(Prize.id.in_(quantities)))}
    missing = set(quantities) - set(prizes)
    if missing:
        raise HTTPException(404, f"Unknown prize id(s): {sorted(missing)}")

    order = Order(
        id=uuid.uuid4(),
        wallet_id=principal.wallet.id,
        pickup_code=_unique_pickup_code(db),
        total_tickets=sum(prizes[pid].ticket_cost * qty for pid, qty in quantities.items()),
    )
    try:
        debit(db, principal.wallet.id, order.total_tickets, "order", str(order.id))
        # Sorted so concurrent checkouts lock prize rows in the same order.
        for prize_id in sorted(quantities):
            take_stock(db, prize_id, quantities[prize_id])
    except InsufficientTickets:
        db.rollback()
        raise HTTPException(409, "Not enough tickets for this order") from None
    except OutOfStock as e:
        db.rollback()
        raise HTTPException(409, f"Not enough stock left for {prizes[e.prize_id].name}") from None

    order.items = [
        OrderItem(prize_id=pid, quantity=qty, unit_cost=prizes[pid].ticket_cost)
        for pid, qty in sorted(quantities.items())
    ]
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=list[OrderOut])
def my_orders(db: DB, principal: CurrentPrincipal):
    stmt = (
        select(Order)
        .where(Order.wallet_id == principal.wallet.id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    return db.scalars(stmt).all()


def _my_order(db: DB, principal: CurrentPrincipal, order_id: uuid.UUID) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.wallet_id != principal.wallet.id:
        raise HTTPException(404, "Order not found")
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: uuid.UUID, db: DB, principal: CurrentPrincipal):
    return _my_order(db, principal, order_id)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_my_order(order_id: uuid.UUID, db: DB, principal: CurrentPrincipal):
    order = _my_order(db, principal, order_id)
    cancel_order(db, order, "refund")
    db.commit()
    return order
