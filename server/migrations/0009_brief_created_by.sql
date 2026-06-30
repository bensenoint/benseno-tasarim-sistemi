-- İşi açan kişiyi kalıcı kaydet (silme yetkisi: açan her zaman silebilir).
-- createBrief artık created_by = d.by yazar; açan ayrıca co-lead olarak da eklenir.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Eski briefler için: 'olusturuldu' event'inden açanı geri doldur (en erken kayıt).
UPDATE briefs b
SET created_by = e.user_id
FROM (
  SELECT DISTINCT ON (brief_id) brief_id, user_id
  FROM events
  WHERE verb = 'olusturuldu' AND user_id IS NOT NULL
  ORDER BY brief_id, ts ASC
) e
WHERE e.brief_id = b.id AND b.created_by IS NULL;
