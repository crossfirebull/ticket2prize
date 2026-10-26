"""Races that only a real database can show. Runs in CI against Postgres."""

from concurrent.futures import ThreadPoolExecutor

import pytest

from tests.conftest import TEST_DATABASE_URL, guest_with, issue_stub, prize_by_name

pytestmark = pytest.mark.skipif(
    TEST_DATABASE_URL.startswith("sqlite"), reason="needs Postgres for real concurrency"
)


def test_last_prize_goes_to_exactly_one_customer(client, staff_headers):
    bear = prize_by_name(client, "Giant Plushie Bear")
    client.put(f"/api/staff/prizes/{bear['id']}/stock", json={"stock": 1}, headers=staff_headers)
    shoppers = [guest_with(client, 2000) for _ in range(8)]

    def buy(headers):
        body = {"items": [{"prize_id": bear["id"], "quantity": 1}]}
        return client.post("/api/orders", json=body, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(buy, shoppers))

    assert sorted(results) == [201] + [409] * 7
    assert client.get(f"/api/prizes/{bear['id']}").json()["stock"] == 0


def test_stub_claimed_once_under_race(client):
    code = issue_stub(client, 100)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(
            pool.map(lambda _: client.post(f"/api/stubs/{code}/claim").status_code, range(8))
        )
    assert sorted(results) == [200] + [409] * 7
