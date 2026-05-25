# Adım 7 — Slack Canvas → Supabase Veritabanı (Hazırlık)

> v1.0 · Hazırlandı: 25 Mayıs 2026  
> Hedef: Canvas'ı tek kaynak olmaktan çıkarmak, Supabase'i master veri deposu yapmak.  
> Strateji: 3 fazlı migration (write-through → DB master → Canvas opsiyonel).

---

## 1. Canvas'ta Yaşayan Tüm Alanlar

### Aktif Brief (bns_briefs)

| Canvas Alanı | JS Field | Tip | Notlar |
|---|---|---|---|
| no | no | integer | Brief numarası (ör: 142) |
| marka | marka | text | Marka adı (string, BR lookup ile zenginleştiriliyor) |
| baslik / is | baslik | text | Brief başlığı |
| leadId / atanan_ids[0] | leadId | text | Slack User ID |
| contribIds / atanan_ids[1..] | contribIds | text[] | Ek katkıda bulunanlar |
| editor_ids | editor_ids | text[] | Editör ataması (ayrı alan) |
| reviewerId | reviewerId | text | Onaylayan yönetici Slack ID |
| acilma | acilma | timestamptz | Brief açılış zamanı (ISO 8601) |
| deadline | deadline | timestamptz | Teslim zamanı |
| saat | saat | text | Deadline saati (ayrı parse için) |
| durum / status | durum | text | yeni/calisiliyor/incelemede/blokeli/tamamlandi |
| durum_raw | durum_raw | text | Ham Canvas durumu (🎨 teslim vs.) |
| revision / rev | revision | integer | Revizyon sayısı |
| stale | stale | boolean | 3+ gün hareketsiz mi |
| slack_url / link | slack_url | text | Slack mesaj link |
| notes / saat | notes | text | Serbest notlar |
| gecmis | gecmis | text | Geçmiş geçiş kaydı (⏳18May...) |
| dept | dept | text | tasarim / editor / ai |
| _kimden_id | _kimden_id | text | Brief'i açan Slack User ID |
| deltaH | - | computed | deadline - NOW (hesaplanan, saklanmaz) |
| priority / prio | - | computed | deltaH'a göre kod+label (hesaplanan) |

### Tamamlanan Brief (bns_completed)

| Canvas Alanı | JS Field | Tip | Notlar |
|---|---|---|---|
| id | id | text | |
| no | no | integer | |
| marka | marka | text | |
| baslik | baslik | text | |
| leadId | leadId | text | |
| contribIds | contribIds | text[] | |
| deadline | deadline | timestamptz | |
| baslangic / basla | baslangic | timestamptz | Brief başlangıcı |
| bitis | bitis | timestamptz | Tamamlanma zamanı |
| sureH / sure | sureH | numeric | Süre (saat) |
| revision / rev | revision | integer | |
| gecikme / gecikmeH | gecikmeH | numeric | Gecikme saati |
| rating | rating | integer | 1-5 yıldız |
| slack_url | slack_url | text | |
| image_url | image_url | text | Slack thread'deki ilk görsel |
| notes | notes | text | |

### Kullanıcılar (bns_users)

| Alan | Tip | Notlar |
|---|---|---|
| id | text PK | Slack User ID (U0AN6DD79M0) |
| name | text | Tam isim |
| mono | text | 2 harfli monogram |
| rol / dept | text | yonetici / tasarim / editor / ai |
| title | text | Unvan (opsiyonel) |
| is_active | boolean | Slack'te aktif mi |
| is_new | boolean | Yeni çalışan |

### Markalar (bns_brands)

| Alan | Tip | Notlar |
|---|---|---|
| name | text PK | Marka adı (lookup key) |
| color | text | Hex renk kodu |
| wheel_idx | integer | 0-15 arası palet index |

### Eskalasyon Log (escalation_log)

| Alan | Tip | Notlar |
|---|---|---|
| id | serial PK | |
| brief_id | text | |
| marka | text | |
| baslik | text | |
| lead_id | text | |
| ts | timestamptz | Gecikme başlangıcı |
| escalation_1h_at | timestamptz | |
| escalation_24h_at | timestamptz | |
| escalation_48h_at | timestamptz | |
| escalation_72h_at | timestamptz | |

---

## 2. Supabase SQL Schema

```sql
-- Supabase Benseno Tasarım Sistemi — v1.0
-- Faz 1: Canvas'tan write-through (okuma karşılaştırma)
-- Faz 2: DB master (Canvas secondary/display)
-- Faz 3: Canvas opsiyonel (raw archive)

-- ─── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────
create table bns_users (
  id          text primary key,          -- Slack User ID
  name        text not null,
  mono        text,                      -- "AT" gibi monogram
  rol         text not null              -- yonetici | tasarim | editor | ai
                check (rol in ('yonetici','tasarim','editor','ai')),
  title       text,                      -- Genel Müdür vs.
  is_active   boolean not null default true,
  is_new      boolean not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── BRANDS ───────────────────────────────────────────────────
create table bns_brands (
  name        text primary key,          -- "Bauhaus TR"
  color       text not null,             -- "#4E79A7"
  wheel_idx   integer not null default 0,
  created_at  timestamptz default now()
);

-- ─── ACTIVE BRIEFS ────────────────────────────────────────────
create table bns_briefs (
  id            text primary key,        -- "br_1000"
  no            integer not null,
  marka         text references bns_brands(name) on update cascade,
  baslik        text not null,
  lead_id       text references bns_users(id),
  contrib_ids   text[] not null default '{}',
  editor_ids    text[] not null default '{}',
  reviewer_id   text references bns_users(id),
  acilma        timestamptz,
  deadline      timestamptz,
  durum         text not null default 'yeni'
                  check (durum in ('yeni','calisiliyor','incelemede','blokeli','tamamlandi')),
  durum_raw     text,                    -- Ham Canvas durumu
  dept          text,                    -- tasarim | editor | ai
  revision      integer not null default 0,
  stale         boolean not null default false,
  slack_url     text,
  notes         text,
  gecmis        text,                    -- Geçmiş log (Canvas raw)
  kimden_id     text references bns_users(id),  -- Brief'i açan
  -- Senkron meta
  canvas_row_id text,                    -- Canvas'taki satır referansı
  last_synced   timestamptz,             -- Son Canvas→DB sync zamanı
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index bns_briefs_marka      on bns_briefs(marka);
create index bns_briefs_lead       on bns_briefs(lead_id);
create index bns_briefs_durum      on bns_briefs(durum);
create index bns_briefs_deadline   on bns_briefs(deadline);
create index bns_briefs_dept       on bns_briefs(dept);

-- ─── COMPLETED BRIEFS ─────────────────────────────────────────
create table bns_completed (
  id            text primary key,
  no            integer,
  marka         text references bns_brands(name) on update cascade,
  baslik        text not null,
  lead_id       text references bns_users(id),
  contrib_ids   text[] not null default '{}',
  deadline      timestamptz,
  baslangic     timestamptz,             -- Brief açılış (basla alanı)
  bitis         timestamptz,             -- Tamamlanma zamanı
  sure_h        numeric(8,1),            -- Süre saat cinsinden
  gecikme_h     numeric(8,1) default 0, -- Gecikme saati (0 = zamanında)
  revision      integer not null default 0,
  rating        smallint check (rating between 1 and 5),
  slack_url     text,
  image_url     text,                    -- Slack thread görseli
  notes         text,
  last_synced   timestamptz,
  created_at    timestamptz default now()
);

create index bns_completed_marka    on bns_completed(marka);
create index bns_completed_lead     on bns_completed(lead_id);
create index bns_completed_bitis    on bns_completed(bitis);

-- ─── ESCALATION LOG ───────────────────────────────────────────
create table bns_escalation_log (
  id                  serial primary key,
  brief_id            text references bns_briefs(id) on delete cascade,
  marka               text,
  baslik              text,
  lead_id             text,
  ts                  timestamptz,       -- Gecikme başlangıcı
  escalation_1h_at    timestamptz,
  escalation_24h_at   timestamptz,
  escalation_48h_at   timestamptz,
  escalation_72h_at   timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── BLOKELI NOTIFIED ─────────────────────────────────────────
create table bns_blokeli_notified (
  brief_id    text primary key,
  notified_at timestamptz not null,
  created_at  timestamptz default now()
);

-- ─── MARKA STATS (E3 sistemi) ─────────────────────────────────
create table bns_marka_stats (
  marka                   text primary key references bns_brands(name),
  n                       integer not null default 0,
  median_deadline_days    numeric(6,2),
  mad_deadline_days       numeric(6,2),
  median_complete_days    numeric(6,2),
  mean_deadline_days      numeric(6,2),
  std_deadline_days       numeric(6,2),
  mean_complete_days      numeric(6,2),
  deadline_vs_real_delta  numeric(6,2),
  confidence              text check (confidence in ('high','medium','low')),
  trend_4w                numeric(6,2)[],  -- Son 4 haftalık median_complete_days
  last_brief_date         timestamptz,
  last_updated            timestamptz,
  next_refresh            timestamptz
);

-- ─── ACTIVITY LOG ─────────────────────────────────────────────
create table bns_activity (
  id          bigserial primary key,
  ts          timestamptz not null,
  who_id      text references bns_users(id),
  verb        text not null,              -- "onayladı", "rev push", vs.
  target      text,                       -- Brief başlığı veya ID
  meta        text,                       -- Ek bilgi
  brief_id    text references bns_briefs(id) on delete set null,
  created_at  timestamptz default now()
);

create index bns_activity_ts      on bns_activity(ts desc);
create index bns_activity_who     on bns_activity(who_id);
create index bns_activity_brief   on bns_activity(brief_id);

-- ─── COMPUTED VIEW: aktif_briefs ──────────────────────────────
-- deltaH ve priority hesaplamalı görünüm (DB'de NOW() kullanır)
create or replace view bns_active_view as
select
  b.*,
  extract(epoch from (b.deadline - now())) / 3600 as delta_h,
  case
    when b.deadline <= now()                               then 'over'
    when b.deadline <= now() + interval '8 hours'         then 'red'
    when b.deadline <= now() + interval '24 hours'        then 'org'
    when b.deadline <= now() + interval '72 hours'        then 'ylw'
    else                                                       'grn'
  end as priority_code,
  case
    when b.deadline <= now()                               then 'GEÇMİŞ'
    when b.deadline <= now() + interval '8 hours'         then 'ACİL'
    when b.deadline <= now() + interval '24 hours'        then 'YÜKSEK'
    when b.deadline <= now() + interval '72 hours'        then 'NORMAL'
    else                                                       'DÜŞÜK'
  end as priority_label
from bns_briefs b
where b.durum != 'tamamlandi';

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
-- Dashboard read-only için: anon role sadece SELECT
alter table bns_briefs        enable row level security;
alter table bns_completed     enable row level security;
alter table bns_users         enable row level security;
alter table bns_brands        enable row level security;
alter table bns_marka_stats   enable row level security;
alter table bns_activity      enable row level security;

-- Anon: sadece okuma
create policy "anon_read_briefs"     on bns_briefs      for select using (true);
create policy "anon_read_completed"  on bns_completed   for select using (true);
create policy "anon_read_users"      on bns_users       for select using (true);
create policy "anon_read_brands"     on bns_brands      for select using (true);
create policy "anon_read_stats"      on bns_marka_stats for select using (true);
create policy "anon_read_activity"   on bns_activity    for select using (true);

-- Service role (Brief Sync bot): tam yazma
-- Bu policy'ler service_role ile çalışır, ayrıca tanımlamaya gerek yok.
-- Supabase'de service_role RLS'i bypass eder.

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function bns_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_briefs_updated_at
  before update on bns_briefs
  for each row execute function bns_set_updated_at();

create trigger trg_users_updated_at
  before update on bns_users
  for each row execute function bns_set_updated_at();
```

---

## 3. Migration Stratejisi — 3 Faz

### Faz 1 — Write-Through (Karşılaştırma)
**Süre:** 2-4 hafta  
**Risk:** Sıfır (Canvas master, DB sadece kopyalanır)

```
[Canvas] → Brief Sync → [DB yazılır]
                      → [Dashboard mock/live EMBEDDED_DATA ile çalışmaya devam]
```

1. Brief Sync her çalıştığında canvas verilerini DB'ye de upsert et
2. Brief Sync sonunda canvas vs DB karşılaştırması yap, farkları logla
3. Dashboard DB'den okumaz — hâlâ EMBEDDED_DATA'dan

**Başarı kriteri:** 1 hafta boyunca hiç kayıp/fark yok.

---

### Faz 2 — DB Master (Canvas ikincil)
**Süre:** 4-8 hafta  
**Risk:** Orta (DB yazması başarısız olursa fallback Canvas)

```
[Canvas parse] → DB upsert → [Dashboard DB'den okur]
                           → [Canvas sadece "display" olarak güncellenir]
```

1. Dashboard'da `EMBEDDED_DATA` kaldırılır, Supabase JS client eklenir
2. `data.js` → `supabase.from('bns_active_view').select('*')` çeker
3. Canvas güncellenmesi devam eder (görsel özet için) ama artık "kaynak" değil
4. Brief Sync canonical source: DB

**Başarı kriteri:** Brief Sync Canvas'ı okumaz, sadece Supabase okur/yazar.

---

### Faz 3 — Canvas Opsiyonel
**Süre:** Kalıcı  
**Risk:** Düşük

```
[Slack Bot] → DB write → [Dashboard DB'den]
                       → [Canvas: haftalık özet/arşiv olarak opsiyonel]
```

1. Yeni brief açma: `/yeni-brief` → doğrudan DB
2. Durum değişikliği: Slack button → doğrudan DB
3. Canvas: yöneticiler için "okunabilir özet" olarak ayda bir yenilenir

---

## 4. Brief Sync'e Eklenecek Kod (Faz 1 Hazırlığı)

### 4a. Supabase bağlantısı (SKILL.md'e eklenir)

```
SUPABASE_URL = https://{project_id}.supabase.co
SUPABASE_SERVICE_KEY = ~/benseno-tasarim-sistemi/data/.supabase-service-key
```

### 4b. DB upsert adımı (Brief Sync Adım 12 sonrası)

```
### 12b. DB Write (Faz 1 — write-through)

DB bağlantısı var mı? → data/.supabase-service-key dosyasını oku.
Yoksa bu adımı atla, log'a "DB_SKIP: key not found" yaz.

Aktif brief'leri upsert et:
POST /rest/v1/bns_briefs
  on_conflict: id
  prefer: resolution=merge-duplicates

Tamamlanan brief'leri upsert et:
POST /rest/v1/bns_completed
  on_conflict: id

Çıktı log: "DB_WRITE: briefs={N} completed={C} errors={E}"
```

### 4c. Dashboard Supabase client (Faz 2 hazırlığı)

```html
<!-- dashboard/index.html → <head> altına ekle (Faz 2'de aktif edilir) -->
<!-- <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> -->
```

---

## 5. Supabase Kurulum Adımları (Manuel)

> Bu adımlar tarayıcıda yapılacak. Claude Code sadece dosyaları hazırlar.

1. **Proje oluştur:** https://supabase.com/dashboard → New Project  
   - Name: `benseno-tasarim`  
   - Region: `eu-central-1` (Frankfurt — TR'ye en yakın)  
   - Password: güçlü oluştur, kaydet

2. **SQL Editor'ı aç:** yukarıdaki schema'yı çalıştır (tüm `-- ─── ...` blokları sırayla)

3. **API Keys'i al:** Settings → API  
   - `anon public key` → `data/.supabase-anon-key` dosyasına yaz  
   - `service_role secret key` → `data/.supabase-service-key` dosyasına yaz

4. **Test:**
   ```bash
   SUPA_URL=$(cat data/.supabase-url)
   SUPA_KEY=$(cat data/.supabase-service-key)
   curl -s "$SUPA_URL/rest/v1/bns_users" \
     -H "apikey: $SUPA_KEY" \
     -H "Authorization: Bearer $SUPA_KEY" | jq length
   # → 0 (boş, beklenen)
   ```

5. **URL'yi kaydet:** `echo "https://{project_id}.supabase.co" > data/.supabase-url`

---

## 6. .gitignore Güncelleme (Güvenlik)

```
# Supabase secrets
data/.supabase-service-key
data/.supabase-anon-key
data/.supabase-url
```

---

## 7. Çıktı Formatı (Brief Sync log)

```
v7.15 DB: write_through={ok|skip|fail} briefs={N} completed={C} errors={E}
```

---

## Notlar

- **Şu an yapılacak:** Schema hazırlandı, Supabase proje oluşturma Görkem'in yapması gerekiyor.
- **Faz 1 başlangıcı:** Supabase proje + API key hazır olduğunda Brief Sync'e 12b adımı eklenecek.
- **Faz 2 tarihi:** Faz 1'de 1 hafta clean run sonrası geçilmeli (Haziran 2026 tahmini).
- **Faz 3 tarihi:** Slack Bot v1 hazır olduğunda (bkz: plan/slack-bot önerileri).

---

*Dosya: `docs/db-migration-plan.md` · v1.0 · 25 Mayıs 2026*
