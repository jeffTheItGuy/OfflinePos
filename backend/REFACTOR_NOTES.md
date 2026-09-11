# Backend refactor notes

## Why `model.py` and not `orders.model.py`

Python module names cannot contain dots. `from app.orders.orders.service import x`
is parsed as the package path `app/orders/orders/service.py`, not a file named
`orders.service.py`. Files with dots in the name are only loadable via
`importlib.util.spec_from_file_location`, which is not worth it.

The `orders/` folder already provides the namespace the prefix was reaching for,
so `app.orders.service` is equally clear and actually imports.

## Why routers are NOT re-exported from `__init__.py`

`core/deps.py` imports `app.staff.model`. If `app/staff/__init__.py` re-exported
the router, importing `app.staff.model` would run `__init__` -> import router ->
import `core.deps` -> which is still mid-initialization -> ImportError.

So `__init__.py` files are empty and `main.py` imports routers from their
modules directly.

## Models are RECONSTRUCTED

The uploaded files contained Pydantic schemas, not SQLAlchemy models, so the
`model.py` files were inferred from how the routers and services use them.
Diff them against your originals before running anything destructive.

## Circular-import check

Full import graph after refactor, no cycles:

    main -> {orders,menu,staff,devices,payments,health}.router
    *.router -> core.deps -> staff.model -> database
    *.router -> database
    orders.router -> orders.service -> devices.model
    orders.router -> idempotency.service -> idempotency.model
    payments.router -> payments.service -> {orders.model, payments.model}
