-- Haftalık karne: kişi/marka/departman/benseno için pazartesi üretilen çift değerlendirme.
-- yildiz_* DB'den hesaplanır (LLM değil); ozet_* Opus üretir. Hafta = pencerenin PAZARTESİ'si.
CREATE TABLE IF NOT EXISTS haftalik_karne (
  id          BIGSERIAL PRIMARY KEY,
  hafta       DATE NOT NULL,                 -- değerlendirilen haftanın pazartesisi
  tip         TEXT NOT NULL CHECK (tip IN ('kisi','marka','dept','benseno')),
  kimlik      TEXT NOT NULL,                 -- kişi: slack_id · marka: ad · dept: kod · benseno: 'benseno'
  ad          TEXT,                          -- görünen ad
  yildiz_hafta  NUMERIC(3,1),                -- o hafta biten işlerin puan ort. (iş yoksa NULL)
  ozet_hafta    TEXT,
  is_sayisi_hafta INT DEFAULT 0,
  yildiz_genel  NUMERIC(3,1),                -- hafta sonu itibarıyla TÜM zaman ortalaması
  ozet_genel    TEXT,
  is_sayisi_genel INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hafta, tip, kimlik)
);
CREATE INDEX IF NOT EXISTS haftalik_karne_lookup ON haftalik_karne (tip, kimlik, hafta DESC);
