-- Portal Faz 3 (30 Eyl): müşteri brief talepleri — ONAYLI AKIŞ (Görkem kararı).
-- Talep doğrudan brief olmaz; yönetici onayında brief'e çevrilir (brief_id bağlanır).
CREATE TABLE IF NOT EXISTS musteri_talepler (
  id            SERIAL PRIMARY KEY,
  marka_id      INTEGER NOT NULL REFERENCES brands(id),
  musteri_id    INTEGER NOT NULL REFERENCES musteri_kullanicilar(id),
  baslik        TEXT NOT NULL,
  aciklama      TEXT,
  istenen_tarih DATE,
  durum         TEXT NOT NULL DEFAULT 'bekliyor',   -- bekliyor | onaylandi | reddedildi
  brief_id      INTEGER,                            -- onaylanınca açılan işin id'si
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
