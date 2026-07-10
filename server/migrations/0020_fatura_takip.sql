-- Fatura takip: ek işlerin eksikleri (satış/fatura) tamamlanma sonrası kovalanır.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS fatura_hatirlatma_asama int NOT NULL DEFAULT 0;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS fatura_kart_ts text;
-- Mini anahtar-değer: zamanlanmış görevlerin tekil-gönderim işaretleri (ör. fatura_toplu_son).
CREATE TABLE IF NOT EXISTS ayarlar (k text PRIMARY KEY, v text);
