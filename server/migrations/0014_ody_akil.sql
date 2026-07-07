-- P3.2: thread duygu tonu + marka risk seviyesi (yönetici-only alanlar)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS thread_ton TEXT;         -- notr|gergin|memnun|acil
ALTER TABLE brand_daily ADD COLUMN IF NOT EXISTS risk_seviye TEXT;   -- dusuk|orta|yuksek (marka_risk tool cache)
