-- Müşteri Portalı Faz 1 (2026-09-30, Görkem onayı): dış müşteri hesapları + müşteri-uyumlu
-- metin kolonları. Müşteri yalnız kendi markasının işlerini görür (JWT marka_id).
CREATE TABLE IF NOT EXISTS musteri_kullanicilar (
  id           SERIAL PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  sifre_hash   TEXT NOT NULL,
  marka_id     INTEGER NOT NULL REFERENCES brands(id),
  ad           TEXT,
  aktif        BOOLEAN NOT NULL DEFAULT true,
  sifre_degistir BOOLEAN NOT NULL DEFAULT true,   -- ilk girişte şifre değişimi zorunlu
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login   TIMESTAMPTZ
);

-- Müşteriye gösterilecek YUMUŞATILMIŞ metinler (Haiku üretir; ham iç metin ASLA portala gitmez).
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS thread_ozet_musteri TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS rating_sebep_musteri TEXT;
