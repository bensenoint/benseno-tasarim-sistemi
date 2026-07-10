-- Evden çalışma günleri: takvimde ayrı tür. İş günü matematiğini ETKİLEMEZ (normal mesai);
-- kişi/departman/firma ve iş bazlı evden-vs-ofis verim raporlarının veri temelidir.
ALTER TABLE tatiller ADD COLUMN IF NOT EXISTS tur text NOT NULL DEFAULT 'tatil';
INSERT INTO tatiller (gun, ad, yarim, tur) VALUES
  ('2026-07-03', 'Evden çalışma', false, 'evden'),
  ('2026-07-10', 'Evden çalışma', false, 'evden'),
  ('2026-07-14', 'Evden çalışma', false, 'evden')
ON CONFLICT (gun) DO NOTHING;
