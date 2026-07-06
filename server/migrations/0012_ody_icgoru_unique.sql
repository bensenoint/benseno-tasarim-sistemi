-- P2-B denetim K7: ody_icgoru günde-bir garantisi (Railway + Mac yedek aynı anda çalışırsa çift kayıt/DM önlenir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_ody_icgoru_gunluk
  ON notifications (user_id, ((created_at AT TIME ZONE 'Europe/Istanbul')::date))
  WHERE tip = 'ody_icgoru';
