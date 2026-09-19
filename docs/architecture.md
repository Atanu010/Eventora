# Eventora Architecture

Eventora is organized as a TypeScript monorepo with separate client and server applications.

- `client/` contains the React and Vite frontend.
- `server/` contains the Express API and its modular route/controller structure.
- `database/` contains PostgreSQL migrations and development seed data.
- `tests/` contains project-wide test coverage as features are added.

The runtime architecture is React -> Express API -> PostgreSQL. The server uses a shared `pg` connection pool, while SQL migrations and seeds remain separate from application routes. Ticket inventory and order totals are authoritative in PostgreSQL transactions; the client never calculates or mutates inventory.

Authentication follows routes -> controllers -> services -> repositories -> PostgreSQL. Passwords are hashed with Argon2id, JWTs contain only the user ID and role, and reusable middleware handles authentication and role authorization. The client communicates with authentication through the Express API and never accesses PostgreSQL directly.

Phase 3 implements registration, login, `GET /api/auth/me`, attendee-default registration, and reusable attendee/organizer/admin authorization. Phase 4 implements event management and discovery. Phase 5 implements transactional order reservations, payment state, idempotency, cancellation/expiration release, and ticket generation. Phase 6 integrates Razorpay test mode with server-side payment verification, webhook idempotency, and locked confirmation. Phase 7 adds server-authoritative ticket check-in. Phase 8 adds durable in-app notifications, transactional lifecycle hooks, read state, and retry processing. Phase 9 adds organizer/admin dashboards using read-only, server-authoritative aggregates. Phase 10 adds admin-only platform KPIs, user and role management, event moderation, operational monitoring, and append-only audit logs. Admin APIs never expose credential fields or QR tokens.

Phase 11 hardens the runtime with validated configuration, Helmet security headers, configuration-driven CORS, endpoint rate limits, cryptographic request IDs, structured request/error logs, bounded JSON payloads, liveness/readiness endpoints, bounded PostgreSQL pooling, and graceful shutdown. `GET /api/health` is lightweight; `GET /api/ready` verifies PostgreSQL. CI runs migrations, tests, typechecks, builds, and a high-severity dependency audit without production secrets.

Phase 12 implements full Razorpay refunds. Refund requests lock the paid order and captured payment, require an idempotency key, reject checked-in tickets and partial amounts, call Razorpay server-side, then atomically mark the order/payment refunded, cancel active tickets, restore inventory, notify the attendee, and append an audit record. Attendees can refund only their own eligible orders; admins can process eligible platform orders; organizers cannot refund arbitrary orders.
