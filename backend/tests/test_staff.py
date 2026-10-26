from tests.conftest import auth, guest_with, prize_by_name, register


def place_order(client, tickets=100, prize="Tootsie Roll", quantity=2):
    headers = guest_with(client, tickets)
    item = prize_by_name(client, prize)
    order = client.post(
        "/api/orders",
        json={"items": [{"prize_id": item["id"], "quantity": quantity}]},
        headers=headers,
    ).json()
    return headers, order


def test_customers_cannot_use_staff_routes(client):
    customer = auth(register(client)["token"])
    assert client.get("/api/staff/orders", headers=customer).status_code == 403
    assert client.get("/api/staff/orders").status_code == 401


def test_pickup_flow(client, staff_headers):
    customer, order = place_order(client)
    queue = client.get("/api/staff/orders", headers=staff_headers).json()
    assert [o["id"] for o in queue] == [order["id"]]

    found = client.get(
        f"/api/staff/orders/by-code/{order['pickup_code'].lower()}", headers=staff_headers
    )
    assert found.json()["id"] == order["id"]

    done = client.post(f"/api/staff/orders/{order['id']}/fulfill", headers=staff_headers)
    assert done.json()["status"] == "fulfilled"
    assert client.get("/api/staff/orders", headers=staff_headers).json() == []
    again = client.post(f"/api/staff/orders/{order['id']}/fulfill", headers=staff_headers)
    assert again.status_code == 409
    # A fulfilled order can't be cancelled for a refund.
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=customer).status_code == 409


def test_staff_cancel_refunds_customer(client, staff_headers):
    customer, order = place_order(client)
    res = client.post(f"/api/staff/orders/{order['id']}/cancel", headers=staff_headers)
    assert res.json()["status"] == "cancelled"
    assert client.get("/api/me", headers=customer).json()["balance"] == 100


def test_unknown_pickup_code(client, staff_headers):
    res = client.get("/api/staff/orders/by-code/ZZZZZZ", headers=staff_headers)
    assert res.status_code == 404


def test_inventory(client, staff_headers):
    low = client.get("/api/staff/prizes/low-stock", headers=staff_headers).json()
    assert low[0]["stock"] == 0
    bear = prize_by_name(client, "Giant Plushie Bear")
    res = client.put(
        f"/api/staff/prizes/{bear['id']}/stock", json={"stock": 4}, headers=staff_headers
    )
    assert res.json()["stock"] == 4
    bad = client.put(
        f"/api/staff/prizes/{bear['id']}/stock", json={"stock": -1}, headers=staff_headers
    )
    assert bad.status_code == 422
