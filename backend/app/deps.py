import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Account, Role, Wallet
from app.security import decode_token

DB = Annotated[Session, Depends(get_db)]
_bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    wallet: Wallet
    account: Account | None


def _resolve(db: Session, creds: HTTPAuthorizationCredentials | None) -> Principal | None:
    if creds is None:
        return None
    try:
        claims = decode_token(creds.credentials)
        wallet_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from None
    wallet = db.get(Wallet, wallet_id)
    if wallet is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown wallet")
    account = None
    if "acct" in claims:
        account = db.get(Account, uuid.UUID(claims["acct"]))
        if account is None or account.wallet_id != wallet.id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown account")
    return Principal(wallet=wallet, account=account)


def optional_principal(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Principal | None:
    return _resolve(db, creds)


def require_principal(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Principal:
    principal = _resolve(db, creds)
    if principal is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return principal


def require_staff(principal: Annotated[Principal, Depends(require_principal)]) -> Account:
    if principal.account is None or principal.account.role != Role.staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff only")
    return principal.account


def require_kiosk(x_kiosk_key: Annotated[str | None, Header()] = None) -> str:
    if not x_kiosk_key or x_kiosk_key not in get_settings().kiosk_key_set:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid kiosk key")
    return x_kiosk_key


OptionalPrincipal = Annotated[Principal | None, Depends(optional_principal)]
CurrentPrincipal = Annotated[Principal, Depends(require_principal)]
StaffAccount = Annotated[Account, Depends(require_staff)]
Kiosk = Annotated[str, Depends(require_kiosk)]
