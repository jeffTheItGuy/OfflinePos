"""CON-04 — Multi-tablet sync conflict."""
import asyncio
import uuid

import pytest


@pytest.mark.asyncio
class TestMultiTabletConflict:
    async def test_add_items_after_payment_rejected(
        self, async_client, seed_order, seed_menu_items
    ):
        order_id = seed_order["id"]
        total = seed_order["total_cents"]

        # Simultaneous: pay + add items
        pay_task = async_client.post(
            "/payments",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "order_id": order_id,
                "amount_cents": total,
            },
        )
        add_task = async_client.post(
            f"/orders/{order_id}/items",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "order_id": order_id,
                "items": [
                    {
                        "menu_item_id": seed_menu_items[2]["id"],
                        "name": "Burger",
                        "quantity": 1,
                        "price_cents": 2500,
                        "notes": "race",
                    }
                ],
            },
        )

        pay_resp, add_resp = await asyncio.gather(pay_task, add_task)
        
        # Fetch final state to verify consistency
        final = await async_client.get(f"/orders/{order_id}")
        order = final.json()
        item_names = [i["name"] for i in order["items"]]

        # Because they are strictly concurrent and both lock the row, 
        # exactly one of them will win the race. Both outcomes are valid 
        # business logic, but the final state must be consistent.
        if pay_resp.status_code in (200, 201):
            # Outcome A: Payment won. Add-items must be rejected (409).
            assert add_resp.status_code == 409, f"Expected 409 for add-items, got {add_resp.status_code}"
            assert "Burger" not in item_names
            assert order["payment_status"] == "paid"
            
        elif add_resp.status_code == 200:
            # Outcome B: Add-items won. The total changed, so the payment 
            # payload (which has the old total) is now invalid (422).
            assert pay_resp.status_code == 422, f"Expected 422 for payment, got {pay_resp.status_code}"
            assert "Burger" in item_names
            assert order["payment_status"] == "unpaid"
            
        else:
            pytest.fail(
                f"Unexpected race outcome: pay={pay_resp.status_code}, add={add_resp.status_code}"
            )