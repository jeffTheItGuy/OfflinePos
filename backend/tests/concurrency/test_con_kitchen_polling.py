"""CON-05 — Kitchen polling under concurrent status writes."""
import asyncio

import pytest


@pytest.mark.asyncio
class TestKitchenPolling:
    async def test_no_lost_transitions(self, async_client, seed_order):
        order_id = seed_order["id"]
        transitions = ["preparing", "ready", "completed"]
        observed: list[str] = []
        errors: list[str] = []

        async def poller():
            for _ in range(30):
                r = await async_client.get("/orders/kitchen?limit=50")
                if r.status_code != 200:
                    errors.append(f"Poll failed: {r.status_code}")
                    continue
                for o in r.json():
                    if o["id"] == order_id:
                        observed.append(o["status"])
                await asyncio.sleep(0.1)

        async def writer():
            for status in transitions:
                await asyncio.sleep(0.15)
                r = await async_client.patch(
                    f"/orders/{order_id}/status",
                    json={"status": status},
                )
                if r.status_code != 200:
                    errors.append(f"Status update failed: {r.text}")

        await asyncio.gather(poller(), writer())

        assert not errors, "\n".join(errors)

        # Verify no backwards transitions
        status_order = ["sent", "preparing", "ready", "completed"]
        max_seen = -1
        for s in observed:
            if s in status_order:
                idx = status_order.index(s)
                assert idx >= max_seen, (
                    f"Reverted: saw '{s}' after '{status_order[max_seen]}'"
                )
                max_seen = idx
