-- 0010_bildirim_reformu.sql — bildirim reformu v1
-- notifications tablosu: zil + dijest tamponu olarak genişletilir.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS tip TEXT DEFAULT 'genel',        -- termin|atama|bloke|musteri|statu|genel
  ADD COLUMN IF NOT EXISTS aciliyet TEXT DEFAULT 'normal',  -- acil|normal
  ADD COLUMN IF NOT EXISTS dijest_at TIMESTAMPTZ,           -- NULL = dijest bekliyor
  ADD COLUMN IF NOT EXISTS slack_at TIMESTAMPTZ,            -- anlık DM zamanı
  ADD COLUMN IF NOT EXISTS brief_id INTEGER,                -- ilgili iş (NULL = genel)
  ADD COLUMN IF NOT EXISTS marka TEXT;                      -- brief'ten türetilir

CREATE INDEX IF NOT EXISTS idx_notif_user_dijest ON notifications (user_id, dijest_at);
CREATE INDEX IF NOT EXISTS idx_notif_brief ON notifications (brief_id);

CREATE TABLE IF NOT EXISTS notify_prefs (
  user_id TEXT PRIMARY KEY,
  ogle_dijest BOOLEAN NOT NULL DEFAULT true,
  tip_termin BOOLEAN NOT NULL DEFAULT true,
  tip_atama  BOOLEAN NOT NULL DEFAULT true,
  tip_bloke  BOOLEAN NOT NULL DEFAULT true,
  sessiz_bas SMALLINT NOT NULL DEFAULT 19,   -- TR saati; [sessiz_bas, sessiz_bit) push yok
  sessiz_bit SMALLINT NOT NULL DEFAULT 8
);

CREATE TABLE IF NOT EXISTS brief_notif_seen (
  user_id TEXT NOT NULL,
  brief_id INTEGER NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brief_id)
);
