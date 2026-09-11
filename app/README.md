# Harbor POS — tablet app

Offline-first order-taking app for waiters. Orders are written to a local
SQLite outbox first, then pushed to the backend with idempotency keys and
exponential backoff. Cash payments work fully offline; card payments require
connectivity and use Stripe (server-side webhook is the source of truth).

## Setup

    npm install
    npx expo start

## First run on a device

1. The app will ask for a device name + order-number prefix (e.g. "T1").
   This registers the device with the backend at `/devices/register`.
2. A staff member logs in with their PIN while **online** once. That seeds a
   local PIN verifier so they can log in offline afterwards.
3. Menu items sync in from `/menu?since_version=N`.

Point `BASE_URL` in `src/api/client.ts` at your backend host.
