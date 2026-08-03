-- Prompt cache gözlemlenebilirliği: okunan/yazılan cache tokenleri
ALTER TABLE maliyet_log ADD COLUMN IF NOT EXISTS cache_okuma INT DEFAULT 0;
ALTER TABLE maliyet_log ADD COLUMN IF NOT EXISTS cache_yazma INT DEFAULT 0;
