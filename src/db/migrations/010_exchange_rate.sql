CREATE TABLE IF NOT EXISTS exchange_rate_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  syp_per_usd NUMERIC(14, 4) NOT NULL CHECK (syp_per_usd > 0),
  note TEXT,
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO exchange_rate_settings (id, syp_per_usd)
VALUES (1, 142)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS exchange_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_rate NUMERIC(14, 4) NOT NULL,
  new_rate NUMERIC(14, 4) NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_changed_at
  ON exchange_rate_history (changed_at DESC);
