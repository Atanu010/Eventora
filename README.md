
# Eventora

Eventora is a TypeScript monorepo for an event platform.

## Project Structure

- `client/` - React, Vite, and TypeScript frontend
- `server/` - Express and TypeScript API
- `database/` - PostgreSQL schema, migrations, and development seeds
- `tests/` - Project-wide test space
- `docs/` - Architecture and project documentation

## Development Commands

Install dependencies separately in `client/` and `server/` when development begins, then use the root scripts:

```bash
npm run dev:client
npm run dev:server
npm run build:client
npm run build:server
npm run typecheck:client
npm run typecheck:server
npm run db:migrate
npm run db:seed
npm run test:auth
npm run test:events
npm run test:orders
```

Start the local PostgreSQL service before database or server validation:

```bash
docker compose up -d postgres
```

The server exposes `GET /api/health` and verifies the PostgreSQL connection through its shared connection pool. Authentication endpoints are available at `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`. Order endpoints include `POST /api/orders`, order retrieval/cancellation, order tickets, and `GET /api/tickets`.

## Completed

- Phase 1 foundation
- Phase 2 PostgreSQL database layer, migrations, schema, connection pool, and development seed mechanism
- Phase 3 Argon2id authentication, JWT middleware, role authorization, and current-user profile
- Phase 4 event management, public discovery, venues, and ticket-type foundations
- Phase 5 transactional inventory reservations, orders, payment state, and ticket generation
- Phase 6 Razorpay test-mode payment verification and webhook idempotency
- Phase 7 server-authoritative ticket check-in
- Phase 8 durable in-app notifications and retry processing
- Phase 9 organizer/admin dashboards with authoritative event metrics
- Phase 10 admin platform management, moderation, and audit logging

## Remaining Future Work

- Refund workflows
