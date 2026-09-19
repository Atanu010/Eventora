CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider = 'razorpay'),
  provider_order_id TEXT NOT NULL UNIQUE,
  provider_payment_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
  method TEXT,
  failure_code TEXT,
  failure_description TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_provider_payment_id_idx ON payments (provider_payment_id);
CREATE INDEX payments_status_idx ON payments (status);

CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider = 'razorpay'),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_webhook_events_provider_event_unique UNIQUE (provider, provider_event_id)
);