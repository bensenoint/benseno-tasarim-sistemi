-- Portal (30 Eyl): talep ekleri metadata — yönetici karta düşen dosyayı brief'e
-- çevirmeden önce dashboard içinde görüntüleyebilsin (bytes Slack'te durur, proxy ile okunur).
ALTER TABLE musteri_talepler ADD COLUMN IF NOT EXISTS dosyalar JSONB;
