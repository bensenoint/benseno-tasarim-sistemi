-- Bildirim reformu (2026-09-30): rapor e-postaları için kişi e-posta adresi.
-- E-postası olmayan kullanıcıya mail gönderilmez (rapor-mail.js atlar).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
