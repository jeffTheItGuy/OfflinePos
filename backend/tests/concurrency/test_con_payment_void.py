"""CON-02 — Payment racing a void yields exactly one outcome."""
import asyncio
import uuid

import pytest


@pytest.mark.asyncio
class TestPaymentVsVoidRace:
    async def _pay(self, client, order_id, total):
        return await client.post(
            "/payments",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "order_id": order_id,
                "amount_cents": total,
            },
        )

    async def _void(self, client, order_id, manager_id):
        return await client.post(
            f"/orders/{order_id}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_id,
                "reason": "Race test",
            },
            headers={"X-Staff-Id": manager_id},
        )

    async def test_never_both_paid_and_void(
        self, async_client, seed_device, seed_waiter, seed_menu_items, seed_manager
    ):
        """
        Known risk: backend does NOT use with_for_update() on the order row
        in payments/void. This test is expected to FAIL until that fix lands.
        """
        inconsistencies = []

        for trial in range(20):
            # Fresh order each trial
            r = await async_client.post(
                "/orders",
                json={
                    "idempotency_key": str(uuid.uuid4()),
                    "device_id": seed_device["id"],
                    "staff_id": seed_waiter["id"],
                    "table_name": "Race Table",
                    "items": [
                        {
                            "menu_item_id": seed_menu_items[0]["id"],
                            "name": "Coffee",
                            "quantity": 1,
                            "price_cents": 1500,
                            "notes": "",
                        }
                    ],
                },
            )
            order = r.json()
            order_id = order["id"]
            total = order["total_cents"]
            manager_id = seed_manager["id"]

            # Fire both simultaneously
            pay_resp, void_resp = await asyncio.gather(
                self._pay(async_client, order_id, total),
                self._void(async_client, order_id, manager_id),
            )

            pay_ok = pay_resp.status_code in (200, 201)
            void_ok = void_resp.status_code == 200

            # Fetch final state
            final_resp = await async_client.get(f"/orders/{order_id}")
            final = final_resp.json()

            is_paid = final["payment_status"] == "paid"
            is_void = final["status"] == "void"

            if is_paid and is_void:
                inconsistencies.append(
                    f"Trial {trial}: order is BOTH paid and void"
                )
            if pay_ok and void_ok:
                inconsistencies.append(
                    f"Trial {trial}: both payment and void returned success"
                )

        assert not inconsistencies, "\n".join(inconsistencies)
