-- 0001 — Benseno temel şema (Canvas→Postgres geçişi, Faz 1)
-- users · brands · briefs · brief_assignees · brief_tags · brief_attachments · brief_approvals · events
-- Tüm metrikler bu tablolar üstünde SQL ile hesaplanır (LLM toplama yok).

-- updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- KANONİK KULLANICILAR (isim halüsinasyonu imkânsız — id = Slack user ID)
CREATE TABLE users (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  rol         text,
  dept        text,
  yetki       text NOT NULL DEFAULT 'uye',   -- yonetici|dept_lider|uye
  initials    text,
  color       text,
  title       text,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE brands (
  id            serial PRIMARY KEY,
  name          text UNIQUE NOT NULL,
  color         text,
  wheel_idx     int,
  slack_channel text
);

CREATE TABLE briefs (
  id             serial PRIMARY KEY,
  no             int UNIQUE,
  slack_ts       text,
  slack_channel  text,
  slack_url      text,
  marka_id       int REFERENCES brands(id) ON DELETE SET NULL,
  baslik         text NOT NULL,
  dept           text,
  deadline       timestamptz,
  saat           text,
  durum          text NOT NULL DEFAULT 'yeni',
  priority       text,
  priority_label text,
  rev            int NOT NULL DEFAULT 0,
  maliyet        numeric,
  satis          numeric,
  fatura         boolean NOT NULL DEFAULT false,
  odeme          boolean NOT NULL DEFAULT false,
  musteri_notu   text,
  tahmini_sure_h numeric,
  akis           text NOT NULL DEFAULT 'sirali',
  stale          boolean NOT NULL DEFAULT false,
  gecmis         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER briefs_updated_at BEFORE UPDATE ON briefs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX briefs_marka_idx     ON briefs(marka_id);
CREATE INDEX briefs_durum_idx     ON briefs(durum);
CREATE INDEX briefs_completed_idx ON briefs(completed_at);
CREATE INDEX briefs_slack_ts_idx  ON briefs(slack_ts);

CREATE TABLE brief_assignees (
  id       serial PRIMARY KEY,
  brief_id int NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id  text NOT NULL REFERENCES users(id),
  role     text NOT NULL DEFAULT 'contributor',  -- lead|contributor|editor|gozlemci
  sira     int,
  UNIQUE (brief_id, user_id, role)
);
CREATE INDEX brief_assignees_brief_idx ON brief_assignees(brief_id);
CREATE INDEX brief_assignees_user_idx  ON brief_assignees(user_id);

CREATE TABLE brief_tags (
  id       serial PRIMARY KEY,
  brief_id int NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  tag      text NOT NULL,
  UNIQUE (brief_id, tag)
);

CREATE TABLE brief_attachments (
  id          serial PRIMARY KEY,
  brief_id    int NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  url         text NOT NULL,
  filename    text,
  mime        text,
  uploaded_by text REFERENCES users(id),
  source      text NOT NULL DEFAULT 'dashboard_upload',  -- dashboard_upload|slack_thread
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brief_approvals (
  id          serial PRIMARY KEY,
  brief_id    int NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  approver_id text NOT NULL REFERENCES users(id),
  sira        int,
  durum       text NOT NULL DEFAULT 'bekliyor',  -- bekliyor|onaylandi|reddedildi
  ts          timestamptz
);

-- OLAY DEFTERİ (audit + undo + de-dup)
CREATE TABLE events (
  id        bigserial PRIMARY KEY,
  brief_id  int REFERENCES briefs(id) ON DELETE SET NULL,
  user_id   text REFERENCES users(id),
  verb      text NOT NULL,
  detail    jsonb,
  source    text,
  slack_ts  text,
  ts        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_brief_idx ON events(brief_id);
CREATE INDEX events_ts_idx    ON events(ts);
CREATE UNIQUE INDEX events_idem_idx ON events(slack_ts, verb) WHERE slack_ts IS NOT NULL;
