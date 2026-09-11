# Harbor POS — web (kitchen + admin)

Vite + React + TypeScript SPA. Two top-level views:

- `/kitchen` — read-only, polls `GET /orders?status=sent` every 5s.
- `/admin`   — manager-only. PIN login, menu CRUD, staff CRUD, sales report.

## Dev

    npm install
    npm run dev
    # → http://localhost:5173/kitchen
    # → http://localhost:5173/admin

The Vite dev server proxies `/orders`, `/menu`, `/staff`, `/devices`,
`/payments`, `/health` to `http://localhost:8000`. Start the backend first.

## Prod

    docker compose build web
    docker compose up -d web

Served behind Caddy. Required Caddyfile routing (the SPA's static assets
live at `/assets/*` and must also go to the `web` container):

    pos.nimbusurf.com {
        handle /admin*      { reverse_proxy web:80 }
        handle /kitchen*    { reverse_proxy web:80 }
        handle /assets/*    { reverse_proxy web:80 }
        handle              { reverse_proxy api:8000 }
    }

If `/assets/*` is missing from Caddy, the HTML loads but every JS/CSS
request 404s against the API. That's the classic symptom.

## Auth

`/admin` asks for a manager PIN via `POST /staff/login`. The returned
`staff.id` goes into the `X-Staff-Id` header on write endpoints
(`/menu`, `/staff`). The backend enforces the manager role — this is v1
pragmatic auth, not a token system.
