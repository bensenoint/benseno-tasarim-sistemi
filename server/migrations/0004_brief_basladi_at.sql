-- "İşe başlandı" statüsü: gerçek çalışma başlangıç damgası.
-- Durum 'basladi' olunca status endpoint'te (COALESCE ile bir kez) set edilir.
-- Süre hesabı: queries.js baslangic = COALESCE(basladi_at, started_at) — damga yoksa eski davranış.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS basladi_at timestamptz;
CREATE INDEX IF NOT EXISTS briefs_basladi_idx ON briefs(basladi_at);
