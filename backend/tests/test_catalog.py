def test_health(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ready"}


def test_metrics_exposed(client):
    client.get("/api/prizes")
    assert "http_requests_total" in client.get("/metrics").text


def test_lists_seeded_catalog_cheapest_first(client):
    prizes = client.get("/api/prizes").json()
    assert len(prizes) == 44
    costs = [p["ticket_cost"] for p in prizes]
    assert costs == sorted(costs)


def test_filters(client):
    candy = client.get("/api/prizes", params={"category": "candy"}).json()
    assert {p["category"] for p in candy} == {"candy"}
    assert [p["name"] for p in client.get("/api/prizes", params={"q": "pikachu"}).json()] == [
        "Pokemon - Pikachu Plushie"
    ]
    in_stock = client.get("/api/prizes", params={"in_stock": True}).json()
    assert in_stock and all(p["stock"] > 0 for p in in_stock)
    assert len(in_stock) < 44


def test_categories(client):
    categories = client.get("/api/categories").json()
    assert "candy" in categories and categories == sorted(categories)


def test_unknown_prize_404(client):
    assert client.get("/api/prizes/9999").status_code == 404
