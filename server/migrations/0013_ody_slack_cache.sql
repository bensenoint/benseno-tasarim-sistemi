-- Ody × Slack köprüsü: çekilen Slack bilgisinin TTL'li önbelleği (6sa kod tarafında).
CREATE TABLE IF NOT EXISTS ody_slack_cache (
  id BIGSERIAL PRIMARY KEY,
  sorgu_tipi TEXT NOT NULL,
  anahtar    TEXT NOT NULL,
  user_scope TEXT NOT NULL,
  ham_ozet   TEXT,
  yorum      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ody_slack_cache_lookup
  ON ody_slack_cache (sorgu_tipi, anahtar, user_scope, created_at DESC);
