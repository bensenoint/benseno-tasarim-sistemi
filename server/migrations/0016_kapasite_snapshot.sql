-- Kapasite v2 saatlik arşivi (hibrit): ekranlar canlı hesaplar; bu tablo GERÇEKLEŞMİŞ
-- doluluk tarihçesini biriktirir (trend/rapor/kalibrasyon). scope: 'firma' | 'dept:tasarim' | 'kisi:U...'.
CREATE TABLE IF NOT EXISTS kapasite_snapshot (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope TEXT NOT NULL,
  pct INT NOT NULL
);
CREATE INDEX IF NOT EXISTS kapasite_snapshot_scope_ts ON kapasite_snapshot (scope, ts DESC);
