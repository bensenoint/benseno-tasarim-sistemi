-- P3.3a: firma-seviyesi proaktif sinyal push toggle'ı (yönetici kapatabilir)
ALTER TABLE notify_prefs ADD COLUMN IF NOT EXISTS tip_firma_sinyal BOOLEAN NOT NULL DEFAULT true;
