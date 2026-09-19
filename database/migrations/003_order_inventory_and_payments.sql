ALTER TABLE ticket_types
  ADD COLUMN quantity_sold INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT ticket_types_quantity_sold_valid CHECK (quantity_sold >= 0 AND quantity_sold <= quantity);

ALTER TABLE orders
  DROP CONSTRAINT orders_status_check,
  ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'refunded')),
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX orders_user_idempotency_key_idx
  ON orders (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX orders_status_expires_at_idx ON orders (status, expires_at);