-- İş tipi taksonomisi + briefs.is_tipi. Tipler DB'de: ileride ekleme/birleştirme kod değişikliği istemez.
CREATE TABLE IF NOT EXISTS is_tipleri (
  kod   text PRIMARY KEY,
  ad    text NOT NULL,
  grup  text NOT NULL,
  sira  int  NOT NULL DEFAULT 0,
  aktif boolean NOT NULL DEFAULT true
);
INSERT INTO is_tipleri (kod, ad, grup, sira) VALUES
  ('sm-gorsel',        'Sosyal medya görseli',      'Tasarım',         1),
  ('baski-pop',        'Baskı & POP materyal',      'Tasarım',         2),
  ('ambalaj',          'Ambalaj tasarımı',          'Tasarım',         3),
  ('katalog-dokuman',  'Katalog / doküman',         'Tasarım',         4),
  ('giydirme',         'Araç & mekan giydirme',     'Tasarım',         5),
  ('mailing-tasarim',  'E-posta / mailing',         'Tasarım',         6),
  ('web-gorsel',       'Web görseli / banner',      'Tasarım',         7),
  ('dergi-ilan',       'Dergi / mecra ilanı',       'Tasarım',         8),
  ('video-produksiyon','Video prodüksiyon / kurgu', 'Video & İçerik',  9),
  ('video-revizyon',   'Video revizyon',            'Video & İçerik', 10),
  ('sm-plan',          'Aylık SM içerik planı',     'Video & İçerik', 11),
  ('ceviri',           'Çeviri / lokalizasyon',     'Video & İçerik', 12),
  ('raporlama',        'Raporlama',                 'Analiz & Dijital',13),
  ('web-site',         'Web sitesi geliştirme',     'Analiz & Dijital',14),
  ('uygulama-yazilim', 'Uygulama / yazılım',        'Analiz & Dijital',15),
  ('strateji',         'Strateji / iletişim planı', 'Analiz & Dijital',16),
  ('idari-operasyon',  'İdari / iç operasyon',      'Operasyon',      17),
  ('fiyat-guncelleme', 'Fiyat listesi / güncelleme','Operasyon',      18),
  ('diger',            'Diğer',                     'Operasyon',      19)
ON CONFLICT (kod) DO NOTHING;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS is_tipi text;
