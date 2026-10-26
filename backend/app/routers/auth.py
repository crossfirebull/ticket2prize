from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select, update

from app.deps import DB, CurrentPrincipal, OptionalPrincipal, Principal
from app.models import Account, Order, Wallet
from app.schemas import AccountOut, LoginIn, Me, RegisterIn, Session
from app.security import hash_password, issue_token, verify_password
from app.wallets import balance_of, credit, debit

router = APIRouter(prefix="/api", tags=["auth"])


def _session(db: DB, account: Account) -> Session:
    return Session(
        token=issue_token(account.wallet_id, account.id),
        balance=balance_of(db, account.wallet),
        account=AccountOut.model_validate(account),
    )


def _merge_guest_wallet(db: DB, guest: Principal | None, into: Wallet) -> None:
    """Move a guest's tickets and orders onto an account they just signed in to."""
    if guest is None or guest.account is not None or guest.wallet.id == into.id:
        return
    amount = balance_of(db, guest.wallet)
    if amount:
        debit(db, guest.wallet.id, amount, "merge", str(into.id))
        credit(db, into.id, amount, "merge", str(guest.wallet.id))
    db.execute(update(Order).where(Order.wallet_id == guest.wallet.id).values(wallet_id=into.id))


@router.post("/auth/register", response_model=Session, status_code=201)
def register(body: RegisterIn, db: DB, guest: OptionalPrincipal):
    email = body.email.lower()
    if db.scalar(select(func.count()).where(Account.email == email)):
        raise HTTPException(409, "An account with that email already exists")
    # A guest who signs up keeps their wallet (and the tickets in it).
    if guest is not None and guest.account is None:
        wallet = guest.wallet
    else:
        wallet = Wallet()
        db.add(wallet)
        db.flush()
    account = Account(
        email=email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        wallet_id=wallet.id,
    )
    db.add(account)
    db.commit()
    return _session(db, account)


@router.post("/auth/login", response_model=Session)
def login(body: LoginIn, db: DB, guest: OptionalPrincipal):
    account = db.scalar(select(Account).where(Account.email == body.email.lower()))
    if account is None or not verify_password(body.password, account.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    _merge_guest_wallet(db, guest, account.wallet)
    db.commit()
    return _session(db, account)


@router.get("/me", response_model=Me)
def me(principal: CurrentPrincipal, db: DB):
    account = principal.account
    return Me(
        balance=balance_of(db, principal.wallet),
        account=AccountOut.model_validate(account) if account else None,
    )
