-- Fatura v2: retainer (aylık sabit ücret) + ek iş modeli.
-- brands.aylik_ucret: NULL = retainer yok. briefs.ucret_tipi: 'kapsamda' | 'ek'
-- (NULL okuma kuralı: markası retainer'lıysa kapsamda, değilse ek — geçiş tetiği NULL'ları doldurur).
ALTER TABLE brands ADD COLUMN IF NOT EXISTS aylik_ucret NUMERIC;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ucret_tipi TEXT;
CREATE TABLE IF NOT EXISTS marka_fatura (
  id BIGSERIAL PRIMARY KEY,
  marka_id INT NOT NULL REFERENCES brands(id),
  ay TEXT NOT NULL,
  tutar NUMERIC,
  fatura BOOLEAN NOT NULL DEFAULT false,
  odeme  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (marka_id, ay)
);
