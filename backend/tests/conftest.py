import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.db import Base, get_db, make_engine
from app.main import app
from app.models import Account, Role, Wallet
from app.security import hash_password
from app.seed import seed_prizes

# CI points this at a real Postgres; locally the suite runs on in-memory SQLite.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite://")
KIOSK = {"X-Kiosk-Key": "dev-kiosk-key"}


@pytest.fixture(scope="session")
def engine():
    if TEST_DATABASE_URL.startswith("sqlite"):
        from sqlalchemy import create_engine

        eng = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        eng = make_engine(TEST_DATABASE_URL)
    yield eng
    eng.dispose()


@pytest.fixture
def SessionTest(engine):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        seed_prizes(db)
    return factory


@pytest.fixture
def client(SessionTest):
    def override():
        with SessionTest() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def issue_stub(client, tickets: int) -> str:
    res = client.post("/api/kiosk/stubs", json={"tickets": tickets}, headers=KIOSK)
    assert res.status_code == 201, res.text
    return res.json()["code"]


def guest_with(client, tickets: int) -> dict:
    """Headers for a guest who has just scanned a stub worth `tickets`."""
    res = client.post(f"/api/stubs/{issue_stub(client, tickets)}/claim")
    assert res.status_code == 200, res.text
    return auth(res.json()["token"])


def register(client, email="sam@example.com", password="correct-horse", headers=None) -> dict:
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "display_name": "Sam"},
        headers=headers or {},
    )
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture
def staff_headers(client, SessionTest):
    with SessionTest() as db:
        wallet = Wallet()
        db.add(wallet)
        db.flush()
        db.add(
            Account(
                email="staff@example.com",
                display_name="Staff",
                password_hash=hash_password("staff-password"),
                role=Role.staff,
                wallet_id=wallet.id,
            )
        )
        db.commit()
    res = client.post(
        "/api/auth/login", json={"email": "staff@example.com", "password": "staff-password"}
    )
    return auth(res.json()["token"])


def prize_by_name(client, name: str) -> dict:
    return next(p for p in client.get("/api/prizes").json() if p["name"] == name)
