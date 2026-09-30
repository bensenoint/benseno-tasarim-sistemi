-- Kişisel UI tercihleri deposu (2026-09-30, Görkem onayı): kanban kolon sırası gibi
-- kullanıcıya özel ayarlar cihazdan bağımsız saklansın. Anahtar başına tek JSONB satır.
CREATE TABLE IF NOT EXISTS user_ayar (
  user_id    TEXT NOT NULL,
  anahtar    TEXT NOT NULL,
  deger      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anahtar)
);
