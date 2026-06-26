-- Yıldız karnesi sebep açıklamalarını TARİHLİ sakla.
-- Şimdiye dek entity_sebep yalnız "en güncel" snapshot tutuyordu; geçmiş bir tarih
-- aralığı seçildiğinde o döneme ait yorum gösterilemiyordu. Ortalamalar zaten
-- tarihe duyarlı (client, data.completed rating'lerinden hesaplıyor) — bu migration
-- YORUM metinlerine de tarih boyutu ekler.

-- entity_sebep tablosu hiçbir migration'da tanımlı değildi (prod'da elle/önceki
-- şemadan gelmiş). Taze DB'lerde read path kırılmasın diye idempotent oluştur.
CREATE TABLE IF NOT EXISTS entity_sebep (
  type         text NOT NULL,
  key          text NOT NULL,
  sebep        text NOT NULL,
  rating_avg   numeric,
  rating_count int,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type, key)
);

-- Tarihli arşiv: her gün-sonu turunda entity başına o günkü sebep bir satır.
-- gun = TR yerel tarih (Europe/Istanbul). (type, key, gun) tekil → aynı gün
-- yeniden üretim upsert eder (gün içinde tekrar çalışırsa son hali kalır).
CREATE TABLE IF NOT EXISTS entity_sebep_history (
  type         text NOT NULL,
  key          text NOT NULL,
  gun          date NOT NULL,
  sebep        text NOT NULL,
  rating_avg   numeric,
  rating_count int,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type, key, gun)
);

-- Aralık sorguları için (read path: son 1 yıl, gun'a göre).
CREATE INDEX IF NOT EXISTS idx_entity_sebep_history_gun ON entity_sebep_history (gun);

-- Backfill: mevcut "en güncel" sebepleri tarihli arşive taşı ki en az bir veri
-- noktası olsun (updated_at'in TR tarihiyle). Aksi halde arşiv bugüne kadar boş kalır.
INSERT INTO entity_sebep_history (type, key, gun, sebep, rating_avg, rating_count, created_at)
SELECT type, key, (updated_at AT TIME ZONE 'Europe/Istanbul')::date AS gun,
       sebep, rating_avg, rating_count, updated_at
FROM entity_sebep
ON CONFLICT (type, key, gun) DO NOTHING;
