-- İşe dönüşte termin uzatma hatırlatıcısı + muaf (cezasız) uzatma.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS termin_oneri_at timestamptz;  -- hatırlatıcı açıldı anı (NULL = kapalı)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS termin_oneri_ms bigint;        -- önerilen uzatma (bekleme/müşteride süresi, ms)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS uzatma_muaf int NOT NULL DEFAULT 0;  -- muaf (gecikme/ceza sayılmayan) uzatma sayısı
