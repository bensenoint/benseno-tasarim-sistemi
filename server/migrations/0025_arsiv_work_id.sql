-- Arşiv köprüsü (F3): brief → arşiv servisindeki works kaydı eşlemesi.
-- Otomatik açılan Drive klasörünün workId'si; 'proje:' thread komutu bununla taşır.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS arsiv_work_id BIGINT;
