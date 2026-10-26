import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

_hasher = PasswordHash.recommended()

# No 0/O/1/I/L so codes can be read aloud at the counter without confusion.
PICKUP_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


def new_stub_code() -> str:
    return secrets.token_urlsafe(12)


def new_pickup_code(length: int = 6) -> str:
    return "".join(secrets.choice(PICKUP_ALPHABET) for _ in range(length))


def issue_token(wallet_id: uuid.UUID, account_id: uuid.UUID | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {
        "sub": str(wallet_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.token_ttl_minutes),
    }
    if account_id:
        claims["acct"] = str(account_id)
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
