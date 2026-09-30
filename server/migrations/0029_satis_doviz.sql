-- Döviz faturalama (2026-09-30, Görkem): satış EUR/USD girilebilir. `satis` HER ZAMAN
-- TL kalır (giriş günü TCMB kurundan çevrilir) → mevcut toplam/kâr formülleri değişmez.
-- satis_orij = girilen orijinal tutar, satis_kur = çevrimde kullanılan kur (TL'de NULL).
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS satis_doviz TEXT NOT NULL DEFAULT 'TL';
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS satis_orij NUMERIC;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS satis_kur NUMERIC;
