from tests.conftest import auth, guest_with, prize_by_name, register


def checkout(client, headers, *lines):
    items = [{"prize_id": pid, "quantity": qty} for pid, qty in lines]
    return client.post("/api/orders", json={"items": items}, headers=headers)


def test_checkout_spends_tickets_and_stock(client):
    headers = guest_with(client, 500)
    yoyo = prize_by_name(client, "Light Up YoYo - Red")
    res = checkout(client, headers, (yoyo["id"], 1), (yoyo["id"], 1))
    order = res.json()
    assert res.status_code == 201
    assert order["status"] == "pending" and order["total_tickets"] == 500
    assert len(order["pickup_code"]) == 6
    assert [(i["prize_id"], i["quantity"]) for i in order["items"]] == [(yoyo["id"], 2)]
    assert client.get("/api/me", headers=headers).json()["balance"] == 0
    assert client.get(f"/api/prizes/{yoyo['id']}").json()["stock"] == yoyo["stock"] - 2


def test_not_enough_tickets_changes_nothing(client):
    headers = guest_with(client, 100)
    switch = prize_by_name(client, "Nintendo Switch")
    res = checkout(client, headers, (switch["id"], 1))
    assert res.status_code == 409
    assert client.get("/api/me", headers=headers).json()["balance"] == 100
    assert client.get(f"/api/prizes/{switch['id']}").json()["stock"] == switch["stock"]


def test_out_of_stock_refunds_whole_order(client):
    headers = guest_with(client, 5000)
    candy = prize_by_name(client, "Tootsie Roll")
    bear = prize_by_name(client, "Giant Plushie Bear")
    assert bear["stock"] == 0
    res = checkout(client, headers, (candy["id"], 1), (bear["id"], 1))
    assert res.status_code == 409
    assert "Giant Plushie Bear" in res.json()["detail"]
    assert client.get("/api/me", headers=headers).json()["balance"] == 5000
    assert client.get(f"/api/prizes/{candy['id']}").json()["stock"] == candy["stock"]


def test_unknown_prize(client):
    headers = guest_with(client, 100)
    assert checkout(client, headers, (9999, 1)).status_code == 404


def test_checkout_requires_sign_in(client):
    candy = prize_by_name(client, "Tootsie Roll")
    assert checkout(client, {}, (candy["id"], 1)).status_code == 401


def test_cancel_refunds_and_restocks(client):
    headers = guest_with(client, 100)
    candy = prize_by_name(client, "Tootsie Roll")
    order = checkout(client, headers, (candy["id"], 4)).json()
    res = client.post(f"/api/orders/{order['id']}/cancel", headers=headers)
    assert res.json()["status"] == "cancelled"
    assert client.get("/api/me", headers=headers).json()["balance"] == 100
    assert client.get(f"/api/prizes/{candy['id']}").json()["stock"] == candy["stock"]
    again = client.post(f"/api/orders/{order['id']}/cancel", headers=headers)
    assert again.status_code == 409


def test_orders_are_private(client):
    headers = guest_with(client, 100)
    candy = prize_by_name(client, "Tootsie Roll")
    order = checkout(client, headers, (candy["id"], 1)).json()
    stranger = auth(register(client)["token"])
    assert client.get(f"/api/orders/{order['id']}", headers=stranger).status_code == 404
    assert client.get("/api/orders", headers=stranger).json() == []
    assert client.get(f"/api/orders/{order['id']}", headers=headers).status_code == 200
