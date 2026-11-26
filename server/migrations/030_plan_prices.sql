-- Teams, phase 3: prices. A plan can be sold at several Stripe prices (by
-- the month and by the year), and a plan sold by the seat (Team) is bought
-- for a number of seats, at least min_seats.
-- Re-runnable, like every migration here.

CREATE TABLE IF NOT EXISTS plan_prices (
  stripe_price_id TEXT PRIMARY KEY,
  plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  interval        TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  -- What it costs, for showing (Stripe charges what the price says); for a
  -- plan sold by the seat, each seat's. Null when it wasn't given.
  amount_cents    INTEGER CHECK (amount_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON plan_prices (plan_id);

-- The one price a plan has had stays its monthly price
INSERT INTO plan_prices (stripe_price_id, plan_id, interval)
  SELECT stripe_price_id, id, 'month' FROM plans WHERE stripe_price_id IS NOT NULL
  ON CONFLICT (stripe_price_id) DO NOTHING;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS per_seat BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS min_seats INTEGER CHECK (min_seats IS NULL OR min_seats >= 1);
-- The first time only, so an admin's later choice stays
UPDATE plans SET per_seat = TRUE, min_seats = 3 WHERE id = 'team' AND min_seats IS NULL;
