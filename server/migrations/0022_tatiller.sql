-- Resmî tatil takvimi (admin yönetir). yarim=true → 09:00-13:00 mesai, kapasitede 0.5 gün.
CREATE TABLE IF NOT EXISTS tatiller (
  gun   date PRIMARY KEY,
  ad    text NOT NULL,
  yarim boolean NOT NULL DEFAULT false
);
INSERT INTO tatiller (gun, ad, yarim) VALUES
  ('2026-01-01', 'Yılbaşı', false),
  ('2026-03-19', 'Ramazan Bayramı Arefesi', true),
  ('2026-03-20', 'Ramazan Bayramı 1. Gün', false),
  ('2026-03-21', 'Ramazan Bayramı 2. Gün', false),
  ('2026-03-22', 'Ramazan Bayramı 3. Gün', false),
  ('2026-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', false),
  ('2026-05-01', 'Emek ve Dayanışma Günü', false),
  ('2026-05-19', 'Atatürk''ü Anma, Gençlik ve Spor Bayramı', false),
  ('2026-05-26', 'Kurban Bayramı Arefesi', true),
  ('2026-05-27', 'Kurban Bayramı 1. Gün', false),
  ('2026-05-28', 'Kurban Bayramı 2. Gün', false),
  ('2026-05-29', 'Kurban Bayramı 3. Gün', false),
  ('2026-05-30', 'Kurban Bayramı 4. Gün', false),
  ('2026-07-15', 'Demokrasi ve Millî Birlik Günü', false),
  ('2026-08-30', 'Zafer Bayramı', false),
  ('2026-10-28', 'Cumhuriyet Bayramı Arefesi', true),
  ('2026-10-29', 'Cumhuriyet Bayramı', false),
  ('2026-12-31', 'Yılbaşı Arefesi', true)
ON CONFLICT (gun) DO NOTHING;
