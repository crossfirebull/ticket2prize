from tests.conftest import auth, guest_with, prize_by_name, register


def test_register_and_login(client):
    session = register(client)
    assert session["balance"] == 0
    assert session["account"]["role"] == "customer"
    res = client.post(
        "/api/auth/login", json={"email": "SAM@example.com", "password": "correct-horse"}
    )
    assert res.status_code == 200
    assert res.json()["account"]["id"] == session["account"]["id"]


def test_duplicate_email_rejected(client):
    register(client)
    res = client.post(
        "/api/auth/register",
        json={"email": "sam@example.com", "password": "another-pass", "display_name": "x"},
    )
    assert res.status_code == 409


def test_wrong_password(client):
    register(client)
    res = client.post("/api/auth/login", json={"email": "sam@example.com", "password": "nope"})
    assert res.status_code == 401


def test_short_password_rejected(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "password": "short", "display_name": "A"},
    )
    assert res.status_code == 422


def test_bad_tokens(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers=auth("garbage")).status_code == 401


def test_guest_who_registers_keeps_tickets(client):
    guest = guest_with(client, 400)
    session = register(client, headers=guest)
    assert session["balance"] == 400


def test_guest_who_logs_in_merges_tickets_and_orders(client):
    register(client)
    guest = guest_with(client, 300)
    candy = prize_by_name(client, "Tootsie Roll")
    order = client.post(
        "/api/orders", json={"items": [{"prize_id": candy["id"], "quantity": 2}]}, headers=guest
    ).json()

    res = client.post(
        "/api/auth/login",
        json={"email": "sam@example.com", "password": "correct-horse"},
        headers=guest,
    )
    account = auth(res.json()["token"])
    assert res.json()["balance"] == 290
    assert [o["id"] for o in client.get("/api/orders", headers=account).json()] == [order["id"]]
    assert client.get("/api/me", headers=guest).json()["balance"] == 0
