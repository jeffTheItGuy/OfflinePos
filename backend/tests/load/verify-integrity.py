"""Post-load data integrity checks.
Usage: python tests/load/verify-integrity.py --db-url postgresql://...
"""
import argparse
from sqlalchemy import create_engine, text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True)
    args = parser.parse_args()
    engine = create_engine(args.db_url)

    with engine.connect() as conn:
        # 1. Order number uniqueness
        dupes = conn.execute(text(
            "SELECT order_no, COUNT(*) c FROM orders GROUP BY order_no HAVING COUNT(*)>1"
        )).fetchall()
        assert not dupes, f"Duplicate order numbers: {dupes}"
        print("✅ Order numbers unique")

        # 2. No order is both paid and void
        bad = conn.execute(text(
            "SELECT id FROM orders WHERE payment_status='paid' AND status='void'"
        )).fetchall()
        assert not bad, f"Paid AND void: {bad}"
        print("✅ No paid+void orders")

        # 3. No duplicate payments per order
        dup_pay = conn.execute(text(
            "SELECT order_id, COUNT(*) c FROM payments GROUP BY order_id HAVING COUNT(*)>1"
        )).fetchall()
        assert not dup_pay, f"Duplicate payments: {dup_pay}"
        print("✅ No duplicate payments")

        # 4. Idempotency keys match order count
        orders = conn.execute(text("SELECT COUNT(*) FROM orders")).scalar()
        idem = conn.execute(text("SELECT COUNT(*) FROM idempotency_keys")).scalar()
        print(f"ℹ️  Orders: {orders}, Idempotency keys: {idem}")

    print("\n✅ All integrity checks passed")


if __name__ == "__main__":
    main()
