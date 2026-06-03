# Benseno — Canvas'tan Postgres'e Geçiş Planı

> **Karar (3 Haziran 2026):** Canvas EMEKLİ · Railway Postgres = tek doğruluk kaynağı ·
> Railway API + dinamik dashboard · Brief girişi HEM yapılandırılmış form HEM serbest-metin LLM parse.
> Amaç: LLM data-agent drift'ini (bu oturumda 4 bug'ın kökü) kökten yok etmek.

---

## 1. Hedef Mimari

```
Slack (reaction / komut / brief formu / serbest mesaj)
        │  (deterministik; serbest-metin için izole LLM parse)
        ▼
   BOT + API  (Railway Node servisi — Socket Mode + Express/Fastify)
        │
        ▼
   POSTGRES  (Railway managed — TEK DOĞRULUK KAYNAĞI)
        │  GET /api/* (auth'lu)
        ▼
   DİNAMİK DASHBOARD  (React, Railway'de servis edilir — canlı API sorgusu)
```

- **Canvas YOK.** data-agent LLM skill EMEKLİ. live-data.json/EMBEDDED EMEKLİ.
- **Override patch dosyaları YOK** (priority/status/financials/completion → DB sütunları).
- **Notification/escalation/raporlar** DB sorgular (live-data.json değil).

---

## 2. Veritabanı Şeması (taslak)

```sql
-- Kanonik kullanıcılar (sabit; isim halüsinasyonu imkânsız)
users(id PK, name, rol, initials, color, title, active)

brands(id PK, name UNIQUE, color, wheel_idx)

briefs(
  id PK, no UNIQUE, slack_ts, slack_url,
  marka_id FK→brands, baslik, dept,
  deadline TIMESTAMPTZ, saat,
  durum,                       -- yeni|calisiliyor|incelemede|blokeli|tamamlandi
  priority, priority_label,    -- reaction override DOĞRUDAN sütun
  rev INT DEFAULT 0,
  maliyet NUMERIC, satis NUMERIC, fatura BOOL, odeme BOOL,
  stale BOOL, gecmis TEXT,
  created_at, completed_at, updated_at   -- bitis/30g/History DOĞAL
)

brief_assignees(brief_id FK, user_id FK, role)  -- atanan/editör/contributor (M:N)

events(                         -- aktivite logu → History/Geçmiş sayfası gerçek
  id PK, brief_id FK, user_id FK, verb, detail, ts
)
```
- Tamamlanan iş = `briefs.completed_at IS NOT NULL` (ayrı tablo gerekmez).
- dept/marka/30g/medyan/revize/puan = **SQL view/sorgu** (LLM toplama YOK).

---

## 3. API (Railway Node — auth'lu)

**Okuma (dashboard):**
`GET /api/state` → {briefs, completed, users, brands, deptStats, brandStats, events} (tek çağrı, dashboard'ın ihtiyacı)
veya granüler: `/api/briefs`, `/api/brand-stats`, `/api/dept-stats`, `/api/events`.

**Yazma:**
`POST /api/brief` (form girişi — yapılandırılmış) · `PATCH /api/brief/:no` (finans/durum vb. — opsiyonel UI girişi)
Slack mutasyonları bot içinden doğrudan DB (HTTP gerekmez).

**Auth:** mevcut `.dashboard-auth-hash` → dashboard login token; API `Authorization: Bearer <token>` kontrol eder. Slack tarafı Slack signing ile.

---

## 4. Brief Girişi (HEM form HEM serbest-metin)

- **Yapılandırılmış:** Slack workflow/modal → {marka, deadline, atananlar, açıklama} → bot **deterministik INSERT** (LLM yok).
- **Serbest metin:** kanala yazılan brief mesajı → bot **küçük izole LLM parse** (sadece alan çıkarımı: marka/deadline/atanan) → DB INSERT. Bu tek nokta LLM kalır ama izole + doğrulanabilir (Canvas'ı yeniden üretmez).

---

## 5. Fazlı Geçiş (her faz bağımsız shippable, eski sistem cutover'a dek çalışır)

| Faz | İş | Doğrulama | Risk |
|---|---|---|---|
| **1. Temel** | Railway Postgres provision · şema+migration · read API (GET) · mevcut temiz live-data.json'dan DB seed | API doğru veri dönüyor (eski dashboard'a dokunulmaz) | Sıfır (paralel) |
| **2. Dashboard→API** | Dinamik dashboard API'den besleniyor · Railway'de servis · auth/login | Dashboard DB'den render | Düşük (eski Pages yedek) |
| **3. Yazma** | Reaction/komut/finans/tamamlama → DB doğrudan · brief intake (form+serbest) → DB | Her mutasyon yolu canlı test | Orta |
| **4. Cutover** | LLM data-agent run KAPAT · escalation/raporlar DB sorgular · Canvas read/write KALDIR | Tam döngü DB üzerinden | Orta (geri dönüş planı) |
| **5. Temizlik** | Override dosyaları, reapply adımları, EMBEDDED injection, gecmis-guard kaldır (safeMap defansif kalır) · eski scriptleri emekli et | Regresyon yok | Düşük |

---

## 6. Avantaj / Dezavantaj (özet)

**Avantaj:** LLM drift sıfır · deterministik · gerçek SQL metrikler · gerçek tarihler · API maliyeti ↓ (orchestrator claude run kalkar) · headless sorun yok · tek doğruluk kaynağı.

**Dezavantaj:** Geçiş emeği (4-6 odaklı oturum) · ekip Canvas alışkanlığını bırakır (dashboard/Home Tab'a geçiş) · Postgres ~$5/ay · DB yedek/migration ops · dashboard yeniden yazımı (dinamik).

---

## 7. Açık Konular (Faz ilerledikçe netleşir)
- Dashboard hosting: Railway statik servis mi, ayrı servis mi (CORS'tan kaçınmak için aynı origin önerilir).
- Ekip için "yeni brief" UX: Slack workflow formu mu, dashboard formu mu, ikisi de mi.
- Yedekleme: Railway otomatik + haftalık dump.
- Geri dönüş (rollback): cutover'a dek eski Canvas+Pages sistemi dokunulmadan durur.

---
*Sonraki adım: Faz 1 (Postgres provision + şema + read API + seed) — sıfır riskli, paralel. Onayla başlanır.*
