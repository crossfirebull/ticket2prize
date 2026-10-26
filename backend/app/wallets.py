"""Balance and inventory changes.

Every change is a single conditional UPDATE (e.g. `balance = balance - n WHERE balance >= n`),
so two requests racing for the last tickets or the last prize can't both win.
"""

import uuid

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import LedgerEntry, Prize, Wallet


class InsufficientTickets(Exception):
    pass


class OutOfStock(Exception):
    def __init__(self, prize_id: int):
        self.prize_id = prize_id


def credit(db: Session, wallet_id: uuid.UUID, amount: int, reason: str, reference: str) -> None:
    db.execute(update(Wallet).where(Wallet.id == wallet_id).values(balance=Wallet.balance + amount))
    db.add(LedgerEntry(wallet_id=wallet_id, delta=amount, reason=reason, reference=reference))


def debit(db: Session, wallet_id: uuid.UUID, amount: int, reason: str, reference: str) -> None:
    result = db.execute(
        update(Wallet)
        .where(Wallet.id == wallet_id, Wallet.balance >= amount)
        .values(balance=Wallet.balance - amount)
    )
    if result.rowcount != 1:
        raise InsufficientTickets()
    db.add(LedgerEntry(wallet_id=wallet_id, delta=-amount, reason=reason, reference=reference))


def take_stock(db: Session, prize_id: int, quantity: int) -> None:
    result = db.execute(
        update(Prize)
        .where(Prize.id == prize_id, Prize.stock >= quantity)
        .values(stock=Prize.stock - quantity)
    )
    if result.rowcount != 1:
        raise OutOfStock(prize_id)


def return_stock(db: Session, prize_id: int, quantity: int) -> None:
    db.execute(update(Prize).where(Prize.id == prize_id).values(stock=Prize.stock + quantity))


def balance_of(db: Session, wallet: Wallet) -> int:
    db.refresh(wallet)
    return wallet.balance
