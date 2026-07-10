-- Tek aktif iş (WIP=1): kişi-bazlı "fiilen çalışıyor" işareti.
ALTER TABLE brief_assignees ADD COLUMN IF NOT EXISTS calisiyor boolean NOT NULL DEFAULT false;
-- Backfill: 'basladi' durumundaki TEK worker'lı işlerin worker'ı çalışıyor sayılır
-- (çok worker'lılarda kimin çalıştığı bilinmiyor — boş bırakılır, kişiler 🚀 ile girer).
UPDATE brief_assignees a SET calisiyor = true
FROM briefs b
WHERE a.brief_id = b.id AND b.durum = 'basladi' AND b.deleted_at IS NULL
  AND a.role = 'contributor'
  AND (SELECT count(*) FROM brief_assignees x WHERE x.brief_id = b.id AND x.role = 'contributor') = 1;
