-- P2-B: Ody günlük proaktif içgörü DM tercihi (varsayılan açık)
ALTER TABLE notify_prefs ADD COLUMN IF NOT EXISTS ody_icgoru BOOLEAN DEFAULT true;
