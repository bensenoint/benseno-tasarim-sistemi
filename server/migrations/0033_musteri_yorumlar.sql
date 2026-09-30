-- Portal Faz 2 (30 Eyl): müşteri iş yorumları. Yorum işin Slack thread'ine de düşer
-- ve sorumlulara bildirim gider; burada müşteri portalında listelemek için saklanır.
CREATE TABLE IF NOT EXISTS musteri_yorumlar (
  id          SERIAL PRIMARY KEY,
  brief_id    INTEGER NOT NULL,
  musteri_id  INTEGER NOT NULL REFERENCES musteri_kullanicilar(id),
  metin       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS musteri_yorumlar_brief ON musteri_yorumlar(brief_id);
