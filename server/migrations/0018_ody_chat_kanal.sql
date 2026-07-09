-- Ody sohbet loguna kanal ayrımı: dashboard sohbeti mi, Slack DM diyaloğu mu.
ALTER TABLE ody_chat_log ADD COLUMN IF NOT EXISTS kanal text DEFAULT 'dashboard';
