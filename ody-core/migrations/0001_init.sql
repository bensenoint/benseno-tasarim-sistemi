-- Ody-core şeması (v1)
CREATE TABLE IF NOT EXISTS sohbet_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT,
  user_name   TEXT,
  role        TEXT,
  soru        TEXT,
  tools       JSONB DEFAULT '[]'::jsonb,
  tool_sayisi INT DEFAULT 0,
  turlar      INT DEFAULT 0,
  yanit       TEXT,
  kanal       TEXT DEFAULT 'dashboard',
  model       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sohbet_log_user_idx ON sohbet_log(user_id, created_at DESC);

-- MCP kaynak kayıtları: token DB'de TUTULMAZ — token_env, ortam değişkeninin ADIdır.
CREATE TABLE IF NOT EXISTS kaynaklar (
  ad         TEXT PRIMARY KEY,          -- araç öneki: tasarim, arsiv...
  base_url   TEXT NOT NULL,             -- https://.../mcp
  token_env  TEXT,                      -- x-bns-token değerini taşıyan env adı
  aktif      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO kaynaklar(ad, base_url, token_env) VALUES
  ('tasarim', 'https://benseno-api-production.up.railway.app/mcp', 'TASARIM_MCP_TOKEN')
ON CONFLICT (ad) DO NOTHING;

CREATE TABLE IF NOT EXISTS maliyet_log (
  id         BIGSERIAL PRIMARY KEY,
  model      TEXT,
  girdi_tok  INT,
  cikti_tok  INT,
  kanal      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
