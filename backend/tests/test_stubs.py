from tests.conftest import KIOSK, auth, issue_stub, register


def test_issuing_requires_kiosk_key(client):
    assert client.post("/api/kiosk/stubs", json={"tickets": 10}).status_code == 401
    res = client.post("/api/kiosk/stubs", json={"tickets": 10}, headers={"X-Kiosk-Key": "nope"})
    assert res.status_code == 401


def test_issue_preview_and_qr(client):
    res = client.post("/api/kiosk/stubs", json={"tickets": 350}, headers=KIOSK)
    body = res.json()
    assert body["tickets"] == 350
    assert body["claim_url"].endswith(f"/claim/{body['code']}")
    assert client.get(f"/api/stubs/{body['code']}").json() == {"tickets": 350, "claimed": False}
    qr = client.get(body["qr_url"])
    assert qr.headers["content-type"] == "image/svg+xml"
    assert qr.text.lstrip().startswith("<?xml")


def test_rejects_non_positive_tickets(client):
    res = client.post("/api/kiosk/stubs", json={"tickets": 0}, headers=KIOSK)
    assert res.status_code == 422


def test_guest_claim_creates_wallet(client):
    code = issue_stub(client, 120)
    res = client.post(f"/api/stubs/{code}/claim")
    body = res.json()
    assert res.status_code == 200
    assert body["credited"] == 120 and body["balance"] == 120 and body["account"] is None
    assert client.get("/api/me", headers=auth(body["token"])).json()["balance"] == 120
    assert client.get(f"/api/stubs/{code}").json()["claimed"] is True


def test_stub_can_only_be_claimed_once(client):
    code = issue_stub(client, 50)
    assert client.post(f"/api/stubs/{code}/claim").status_code == 200
    assert client.post(f"/api/stubs/{code}/claim").status_code == 409


def test_claims_accumulate_on_an_account(client):
    session = register(client)
    headers = auth(session["token"])
    for tickets in (100, 250):
        client.post(f"/api/stubs/{issue_stub(client, tickets)}/claim", headers=headers)
    me = client.get("/api/me", headers=headers).json()
    assert me["balance"] == 350
    assert me["account"]["email"] == "sam@example.com"


def test_unknown_stub_404(client):
    assert client.post("/api/stubs/does-not-exist/claim").status_code == 404
