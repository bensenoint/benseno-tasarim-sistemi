-- Ody sohbet logu: doğruluk gözlemlenebilirliği için her /api/chat etkileşimini kaydeder.
-- Amaç: hangi sorularda tool çağrılmadığını (uydurmaya açık), hangi tool'ların kullanıldığını
-- ve gerçek "ıskalamaları" görüp yeni eval vakasına çevirmek. Best-effort yazılır (yanıtı bloklamaz).
CREATE TABLE IF NOT EXISTS ody_chat_log (
  id          bigserial PRIMARY KEY,
  user_id     text,
  user_name   text,
  role        text,
  soru        text,              -- son kullanıcı mesajı
  tools       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- çağrılan tool adları (sırayla)
  tool_sayisi int  NOT NULL DEFAULT 0,
  turlar      int  NOT NULL DEFAULT 0,              -- agentic loop tur sayısı
  yanit       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ody_chat_log_created_idx ON ody_chat_log (created_at DESC);
-- Tool çağrılmayan (tools boş) etkileşimleri hızlı bulmak için kısmi indeks.
CREATE INDEX IF NOT EXISTS ody_chat_log_notool_idx ON ody_chat_log (created_at DESC) WHERE tool_sayisi = 0;
