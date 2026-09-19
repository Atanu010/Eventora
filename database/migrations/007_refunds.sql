CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider = 'razorpay'),
  provider_refund_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refunds_order_idempotency_unique UNIQUE (order_id, idempotency_key)
);

CREATE INDEX refunds_order_id_idx ON refunds (order_id);
CREATE INDEX refunds_payment_id_idx ON refunds (payment_id);
CREATE INDEX refunds_status_idx ON refunds (status);

ALTER TABLE audit_logs
  ALTER COLUMN admin_user_id DROP NOT NULL,
  ADD COLUMN actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT;

UPDATE audit_logs SET actor_user_id = admin_user_id WHERE actor_user_id IS NULL;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_present CHECK (admin_user_id IS NOT NULL OR actor_user_id IS NOT NULL);

CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id);