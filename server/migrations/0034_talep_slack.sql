-- Portal (30 Eyl): talep mesajının Slack konumu — brief'e çevrilince ekler/yazışma
-- brief thread'ine link olarak taşınabilsin diye saklanır.
ALTER TABLE musteri_talepler ADD COLUMN IF NOT EXISTS slack_channel TEXT;
ALTER TABLE musteri_talepler ADD COLUMN IF NOT EXISTS slack_ts TEXT;
