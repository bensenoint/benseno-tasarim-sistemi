-- Portal Faz 1.5 (30 Eyl): marka karnesi portalda görünür — özet metinlerinin
-- müşteri-uyumlu versiyonları (ilk istekte Haiku üretir, burada önbelleklenir).
ALTER TABLE haftalik_karne ADD COLUMN IF NOT EXISTS ozet_hafta_musteri TEXT;
ALTER TABLE haftalik_karne ADD COLUMN IF NOT EXISTS ozet_genel_musteri TEXT;
