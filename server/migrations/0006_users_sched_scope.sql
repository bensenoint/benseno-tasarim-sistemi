-- Sıralama (iş kuyruğu) yetkisi kapsamı: 'all' = tüm departmanlar, '<dept>' = yalnız o departman, NULL = yok (yalnız kendi kuyruğu).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sched_scope text;

-- Tüm departmanları sıralayabilenler: Görkem, Reyhan, Cansu
UPDATE users SET sched_scope = 'all'     WHERE id IN ('U030C48PL23','UD96GH76E','U4XCE3532');
-- Yalnız kendi departmanını sıralayabilenler
UPDATE users SET sched_scope = 'tasarim' WHERE id = 'U055EDESLSE';  -- İpek
UPDATE users SET sched_scope = 'editor'  WHERE id = 'U02SZQDAFPF';  -- Erdem
