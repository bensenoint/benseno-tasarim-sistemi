-- Ody öneri geri bildirimi: kullanıcı beğen/beğenme + (beğenmemede) sebep.
-- Beğenmemede Ody öneriyi yeniden değerlendirir; sonuç (kept/revised) burada izlenir.
CREATE TABLE ody_advice_feedback (
  id           bigserial PRIMARY KEY,
  user_id      text NOT NULL,                 -- giriş yapan kişinin slack_id'si
  notif_id     bigint,                        -- ilgili bildirim (notifications.id); eşleşmezse null
  advice_text  text,                          -- geri bildirim anındaki öneri metni
  vote         text NOT NULL CHECK (vote IN ('up','down')),
  reason       text,                          -- beğenmeme nedeni (opsiyonel)
  reevaluated  boolean NOT NULL DEFAULT false,-- Ody yeniden değerlendirdi mi
  outcome      text CHECK (outcome IN ('kept','revised')),  -- yeniden değerlendirme sonucu
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ody_advice_feedback_user_idx  ON ody_advice_feedback(user_id);
CREATE INDEX ody_advice_feedback_notif_idx ON ody_advice_feedback(notif_id);
