"""CON-01 — Concurrent order creation allocates unique numbers."""
import asyncio
import uuid

import pytest


@pytest.mark.asyncio
class TestConcurrentOrderNumbers:
    async def test_20_parallel_orders_get_unique_numbers(
        self, async_client, seed_device, seed_waiter, seed_menu_items
    ):
        device_id = seed_device["id"]
        staff_id = seed_waiter["id"]
        item_id = seed_menu_items[0]["id"]

        async def create():
            return await async_client.post(
                "/orders",
                json={
                    "idempotency_key": str(uuid.uuid4()),
                    "device_id": device_id,
                    "staff_id": staff_id,
                    "table_name": "Conc Table",
                    "items": [
                        {
                            "menu_item_id": item_id,
                            "name": "Coffee",
                            "quantity": 1,
                            "price_cents": 1500,
                            "notes": "",
                        }
                    ],
                },
            )

        responses = await asyncio.gather(*[create() for _ in range(20)])

        # All must succeed
        for r in responses:
            assert r.status_code in (200, 201), f"Got {r.status_code}: {r.text}"

        order_nos = [r.json()["order_no"] for r in responses]

        # 20 distinct numbers
        assert len(set(order_nos)) == 20, f"Duplicates: {order_nos}"

        # All share the device prefix
        for no in order_nos:
            assert no.startswith("CT-")

        # Sequence is contiguous (no gaps)
        seqs = sorted(int(no.split("-")[1]) for no in order_nos)
        for i in range(1, len(seqs)):
            assert seqs[i] == seqs[i - 1] + 1, f"Gap: {seqs[i-1]} -> {seqs[i]}"

    async def test_no_500_errors(
        self, async_client, seed_device, seed_waiter, seed_menu_items
    ):
        for _ in range(5):
            r = await async_client.post(
                "/orders",
                json={
                    "idempotency_key": str(uuid.uuid4()),
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
                },
            )
            assert r.status_code != 500
