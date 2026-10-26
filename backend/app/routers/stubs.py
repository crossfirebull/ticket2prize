import io
from datetime import UTC, datetime

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select, update

from app.config import get_settings
from app.deps import DB, Kiosk, OptionalPrincipal
from app.models import TicketStub, Wallet
from app.schemas import AccountOut, ClaimResult, StubCreate, StubOut, StubPreview
from app.security import issue_token, new_stub_code
from app.wallets import balance_of, credit

router = APIRouter(prefix="/api", tags=["stubs"])


def _claim_url(code: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/claim/{code}"


def _get_stub(db: DB, code: str) -> TicketStub:
    stub = db.scalar(select(TicketStub).where(TicketStub.code == code))
    if stub is None:
        raise HTTPException(404, "Ticket stub not found")
    return stub


@router.post("/kiosk/stubs", response_model=StubOut, status_code=201)
def issue_stub(body: StubCreate, db: DB, _kiosk: Kiosk):
    """Called by the ticket-counting kiosk; the response is printed as a QR on the stub."""
    stub = TicketStub(code=new_stub_code(), tickets=body.tickets, kiosk_id=body.kiosk_id)
    db.add(stub)
    db.commit()
    return StubOut(
        code=stub.code,
        tickets=stub.tickets,
        claim_url=_claim_url(stub.code),
        qr_url=f"/api/stubs/{stub.code}/qr.svg",
    )


@router.get("/stubs/{code}", response_model=StubPreview)
def preview_stub(code: str, db: DB):
    stub = _get_stub(db, code)
    return StubPreview(tickets=stub.tickets, claimed=stub.claimed_at is not None)


@router.get("/stubs/{code}/qr.svg")
def stub_qr(code: str, db: DB):
    _get_stub(db, code)
    img = qrcode.make(_claim_url(code), image_factory=qrcode.image.svg.SvgPathImage, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return Response(buf.getvalue(), media_type="image/svg+xml")


@router.post("/stubs/{code}/claim", response_model=ClaimResult)
def claim_stub(code: str, db: DB, principal: OptionalPrincipal):
    """Credit a stub's tickets to the caller's wallet, or to a new guest wallet."""
    stub = _get_stub(db, code)
    if principal is None:
        wallet = Wallet()
        db.add(wallet)
        db.flush()
        account = None
    else:
        wallet, account = principal.wallet, principal.account

    # Conditional update so a stub can only ever be claimed once, even under races.
    result = db.execute(
        update(TicketStub)
        .where(TicketStub.id == stub.id, TicketStub.claimed_at.is_(None))
        .values(claimed_at=datetime.now(UTC), wallet_id=wallet.id)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "This ticket stub has already been claimed")
    credit(db, wallet.id, stub.tickets, "stub", stub.code)
    db.commit()

    return ClaimResult(
        token=issue_token(wallet.id, account.id if account else None),
        balance=balance_of(db, wallet),
        account=AccountOut.model_validate(account) if account else None,
        credited=stub.tickets,
    )
