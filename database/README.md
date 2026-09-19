# Database

Eventora uses PostgreSQL through the Node.js `pg` driver. The Express server owns the connection pool; the React client never connects directly to PostgreSQL.

## Local PostgreSQL

The development database is defined in `docker-compose.yml` and uses a named Docker volume for persistence. The default local-only values are documented in `.env.example`.

```bash
docker compose up -d postgres
docker compose ps
docker compose down
```

Set `DATABASE_URL` for server commands. The example local connection string is:

```text
postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev
```

Do not use these development credentials outside local development.

## Migrations and Seeds

Migrations are sequential SQL files in `database/migrations/`. The TypeScript migration runner creates `schema_migrations`, applies pending files in filename order inside transactions, records each applied version, and stops clearly when a migration fails.

Run migrations and development seed data from the repository root:

```bash
npm run db:migrate
npm run db:seed
```

The seed operation is repeatable and uses synthetic development data only. The organizer password is Argon2id-hashed for the seed record and is not a production credential.

## Schema Overview

The initial schema contains `users`, `venues`, `events`, `ticket_types`, `orders`, `order_items`, and `tickets`. UUIDs are generated in PostgreSQL, timestamps use `timestamptz`, and monetary values use `numeric(12, 2)`.

Ticket inventory uses `quantity` plus `quantity_sold`, constrained so sold quantity cannot exceed total quantity. Order creation locks ticket-type rows inside a PostgreSQL transaction, creates pending orders with `payment_status = pending`, and reserves inventory without a payment claim. Pending orders expire after 30 minutes and release reservations when the order flow encounters them.

Important integrity rules include role, status, non-negative monetary and quantity checks, event and sales time-window checks, unique email/slug/order/ticket identifiers, idempotency uniqueness per user, and foreign keys with deliberate restrict, set-null, or aggregate-only cascade behavior.

Phase 6 integrates Razorpay test mode through server-side order creation, signature verification, webhook idempotency, and locked payment confirmation. Phase 7 adds server-authoritative ticket check-in. Phase 8 stores durable in-app notifications with deduplicated lifecycle hooks, read state, and retry processing through `npm run notifications:process`. Phase 9 adds organizer/admin dashboards backed by authoritative sales, inventory, and check-in aggregates. Tickets are generated only after the Eventora backend confirms payment. Refunds remain future work.
