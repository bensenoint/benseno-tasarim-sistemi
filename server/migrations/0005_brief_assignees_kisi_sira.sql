-- Kişisel iş kuyruğu sırası (her atananın kendi sıralaması). brief-içi 'sira'dan farklı.
ALTER TABLE brief_assignees ADD COLUMN IF NOT EXISTS kisi_sira int;
CREATE INDEX IF NOT EXISTS brief_assignees_kisi_sira_idx ON brief_assignees (user_id, kisi_sira);
