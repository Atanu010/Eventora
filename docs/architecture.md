# Eventora Architecture

Eventora is organized as a TypeScript monorepo with separate client and server applications.

- `client/` contains the React and Vite frontend.
- `server/` contains the Express API and its modular route/controller structure.
- `database/` contains PostgreSQL migrations and development seed data.
- `tests/` contains project-wide test coverage as features are added.

The runtime architecture is React -> Express API -> PostgreSQL. The server uses a shared `pg` connection pool, while SQL migrations and seeds remain separate from application routes. Ticket inventory and order totals are authoritative in PostgreSQL transactions; the client never calculates or mutates inventory.

Authentication follows routes -> controllers -> services -> repositories -> PostgreSQL. Passwords are hashed with Argon2id, JWTs contain only the user ID and role, and reusable middleware handles authentication and role authorization. The client communicates with authentication through the Express API and never accesses PostgreSQL directly.

Phase 3 implements registration, login, `GET /api/auth/me`, attendee-default registration, and reusable attendee/organizer/admin authorization. Phase 4 implements event management and discovery. Phase 5 implements transactional order reservations, payment state, idempotency, cancellation/expiration release, and ticket generation. Phase 6 integrates Razorpay test mode with server-side payment verification, webhook idempotency, and locked confirmation. Phase 7 adds server-authoritative ticket check-in. Phase 8 adds durable in-app notifications, transactional lifecycle hooks, read state, and retry processing. Dashboards remain deferred.
