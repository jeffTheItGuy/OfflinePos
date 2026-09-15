"""CON-03 — Same idempotency key sent concurrently."""
import asyncio
import uuid

import pytest


@pytest.mark.asyncio
class TestConcurrentIdempotency:
    async def test_burst_collapses_to_one_order(
        self, async_client, seed_device, seed_waiter, seed_menu_items
    ):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "Idem Table",
            "items": [
                {
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "Coffee",
                    "quantity": 1,
                    "price_cents": 1500,
                    "notes": "",
                }
            ],
        }

        async def fire():
            return await async_client.post("/orders", json=payload)

        responses = await asyncio.gather(*[fire() for _ in range(10)])

        # All succeed
        for r in responses:
            assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"

        # All return the SAME order
        ids = {r.json()["id"] for r in responses}
        order_nos = {r.json()["order_no"] for r in responses}

        assert len(ids) == 1, f"Multiple orders: {ids}"
        assert len(order_nos) == 1, f"Multiple order_nos: {order_nos}"

    async def test_no_500_on_replay(
        self, async_client, seed_device, seed_waiter, seed_menu_items
    ):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "T",
            "items": [
                {
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "X",
                    "quantity": 1,
                    "price_cents": 100,
                    "notes": "",
                }
            ],
        }
        # First request creates
        r1 = await async_client.post("/orders", json=payload)
        assert r1.status_code in (200, 201)

        # 5 more replays — none should 500
        for _ in range(5):
            r = await async_client.post("/orders", json=payload)
            assert r.status_code != 500
