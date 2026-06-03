# Benseno — Canvas'tan Postgres'e Geçiş Planı (FİNAL · son kontrol)

> **Karar (3 Haz 2026):** Canvas EMEKLİ → **Postgres = tek doğruluk** → **Bot+API (Railway)** →
> **dinamik dashboard (Railway, mobil-tam)**. Amaç: bu oturumdaki 4 bug'ın kökü olan LLM data-agent
> drift'ini kökten yok etmek + iki yönlü (Slack ⇄ dashboard) çalışmak.

---

## 0. KESİNLEŞEN KARARLAR (özet)

| Konu | Karar |
|---|---|
| Kaynak | **Postgres** (Railway managed). Canvas + LLM data-agent + EMBEDDED + override dosyaları **emekli** |
| Sunum | **Railway API + dinamik dashboard** (Railway'de servis, tek origin/CORS yok), **mobil tam**, **canlı polling** |
| Aksiyon (hibrit) | **Hızlı = reaction** (🎨✍️🤖👀✅ + 🔴🟠🟡🟢) · **Zengin = thread-yazı** (maliyet/satış, fatura/ödeme, onay, not) |
| Brief girişi | **Slack form** (deterministik) **+ serbest-metin** (izole LLM parse → **onayla-sonra-kaydet**) **+ dashboard formu** (tüm alanlar) |
| İki yön | Her brief = **tek Slack mesajı** (markaya göre kanal). Edit → `chat.update` + thread notu + **DM yalnızca o brief'in kişilerine** (lead+atanan+gözlemci, asla herkese) |
| Brief alanları | + müşteri notu · tahmini süre · etiket (seç **veya** yaz; boşsa Claude önerir) · dosya/ek (dashboard yükleme **+** Slack thread otomatik yakalama) · onay zinciri |
| Onay/atama | `akis` = **sıralı veya paralel** · lead **değiştirilebilir** · gözlemci **eklenebilir** · atanan **değiştirilebilir** · onay `onay ok` ile ilerler |
| Yetki | **Rol + departman** bazlı (yönetici tümü · dept lideri kendi dept'i · atanan kendi briefi) |
| Veri | Test'te mevcut (temiz) veriyle akış öğrenilir → **canlıdan ÖNCE tümü silinir → sıfır veri ile başlanır** |
| Rapor/yedek | **Otomatik dışa aktarma** + **analiz alanı**: dept yükü · marka bazlı süre · iş adetleri · iş tipi yoğunluğu · ciro/maliyet/tahsilat · kârlılık · gecikme trendi |
| Audit | `events` defteri (her mutasyon) · brief tamamlandıktan **18 ay** sonra temizlenir |

---

## 1. SAĞLAMLIK İLKELERİ (her faza işler — kurşun-geçirmezlik)

1. **Olay defteri (events):** State tablosu (briefs) güncellenir AMA her mutasyon `events`'e de bir satır
   olarak eklenir → tam audit + geri-al + "kim ne zaman ne yaptı". Geçmiş sayfası = bu defter.
2. **Sınırda doğrulama + idempotency:** Tüm yazımlar (API + Slack) tek şema doğrulamasından (Zod) geçer →
   bozuk veri DB'ye **giremez**. Slack event ts'i idempotency key → aynı reaction/komut **iki kez işlenmez**.
3. **Hata alarmı (1. günden):** Bot/DB/Slack hatası → **Görkem'e anında DM** + log. Sessiz hata YOK.
4. **Ayrı staging ortamı + DB:** Geliştirme/test **prod'a dokunmadan**. Canlı = boş prod DB.
5. **Migration aracı (Drizzle/Prisma):** Şema elle değil, versiyonlu migration'larla evrilir.
6. **LLM yalnız izole + onaylı:** Tek LLM noktası = serbest-metin brief parse → çıktı **önce gösterilir,
   onaylanınca** DB'ye yazılır. LLM asla sessizce yazmaz.

---

## 2. VERİTABANI ŞEMASI

```sql
users(id PK, name, rol, dept, yetki, initials, color, title, active)   -- kanonik; isim halüsinasyonu imkânsız
brands(id PK, name UNIQUE, color, wheel_idx, slack_channel)            -- markaya göre brief kanalı

briefs(
  id PK, no UNIQUE, slack_ts, slack_channel, slack_url,
  marka_id→brands, baslik, dept, deadline TIMESTAMPTZ, saat,
  durum,                       -- yeni|calisiliyor|incelemede|blokeli|tamamlandi
  priority, priority_label, rev INT,
  maliyet NUMERIC, satis NUMERIC, fatura BOOL, odeme BOOL,
  musteri_notu TEXT, tahmini_sure_h NUMERIC,
  akis,                        -- sirali | paralel
  stale BOOL, gecmis TEXT,
  created_at, completed_at, updated_at
)
brief_assignees(brief_id, user_id, role, sira)   -- role: lead|contributor|editor|gozlemci ; lead/atanan değişebilir, gözlemci eklenebilir
brief_tags(brief_id, tag)                        -- seç veya serbest; boşsa Claude önerir
brief_attachments(id, brief_id, url, filename, mime, uploaded_by, source, ts)  -- source: dashboard_upload | slack_thread (otomatik yakalanır)
brief_approvals(id, brief_id, approver_id, sira, durum, ts)            -- akis=sirali → sıra; paralel → eşzamanlı
events(id, brief_id, user_id, verb, detail, source, ts)               -- olay defteri; 18 ay retention
```
- Tamamlanan = `completed_at IS NOT NULL`. Tüm metrikler **SQL** (LLM toplama yok).

---

## 3. İŞ AKIŞI — UÇTAN UCA (bir brief'in yaşamı)

```
① AÇILIŞ
   Slack form  /  serbest-metin (→ LLM parse → ONAYLA)  /  dashboard formu
        │  doğrula (Zod) → DB INSERT + events[açıldı]
        ▼
   bot → marka kanalına Slack mesajı postlar (slack_ts saklanır) → atananlara DM

② ÇALIŞMA (iş thread'de ilerler)
   Hızlı:  thread mesajına REACTION 🎨/👀/✅/🔴
   Zengin: thread'e YAZI "maliyet 1500" / "fatura ok" / "onay ok"
        │  bot event alır → doğrula → DB UPDATE + events[...] (idempotency: ts bir kez)
        ▼
   bot → brief mesajını chat.update + thread'e not + DM (YALNIZCA brief kişileri)
   dashboard → polling ile ~10-15 sn'de yansır

③ DASHBOARD'DAN DÜZENLEME / YENİ BRIEF
   API (rol+dept auth) → doğrula → DB UPDATE/INSERT + events
        ▼
   bot → Slack yansıması (②'deki aynı: mesaj güncelle + thread not + DM brief kişileri)

④ ONAY (akis: sıralı→sırayla / paralel→eşzamanlı)
   thread "onay ok" veya dashboard → events → bir sonrakine geç / hepsi tamam → ilerle

⑤ TAMAMLAMA
   ✅ reaction veya dashboard → completed_at=now + events[tamamlandı] → mesaj güncelle + DM

⑥ RAPOR / YEDEK
   Dashboard analiz alanı DB'den canlı · otomatik dışa aktarma · 18 ay sonra audit temizliği
```

---

## 4. YAPIM SIRASI — FAZLAR (sıralı; eski sistem cutover'a (Faz 4) dek paralel çalışır)

| Faz | İçerik | Sağlamlık | Doğrulama | Risk |
|---|---|---|---|---|
| **0 · Hazırlık** | Ayrı **staging** Railway env + **Postgres** + **migration aracı** kur | #4, #5 | DB ayakta, migration çalışıyor | Sıfır |
| **1 · Temel** | Şema+migration · **read API** (auth) · **events** tablosu · **Zod doğrulama** katmanı · **hata alarmı** · test verisinden seed (staging) | #1,#2,#3,#5 | API doğru veri dönüyor; eski dashboard'a dokunulmaz | Sıfır (paralel) |
| **2 · Dashboard→API** | **Dinamik dashboard** (Railway, **mobil-tam**) · **canlı polling** · **rol+dept** login/auth | #7 | Dashboard DB'den render, mobil OK | Düşük (eski Pages yedek) |
| **3 · Yazma + iki yön** | Reaction+thread aksiyonları→DB(+events) · brief intake (form + serbest-metin **onaylı**) · finans (dashboard+thread) · **edit→Slack yansıma** (chat.update+thread+**DM brief kişileri**) · dosya/ek · etiket · onay zinciri | #1,#2,#6,#9,#10 | Her mutasyon yolu canlı test (idempotency dahil) | Orta |
| **4 · Cutover** | LLM data-agent **KAPAT** · escalation/raporlar **DB'den** · Canvas read/write **KALDIR** · **rapor-analiz alanı + otomatik export** | — | Tam döngü DB üzerinden | Orta (rollback hazır) |
| **5 · Temizlik + CANLI** | Eski override/EMBEDDED/guard/scriptleri emekli et · **VERİYİ SIFIRLA** → **sıfır veri ile canlıya geç** | — | Regresyon yok; temiz başlangıç | Düşük |

---

## 5. Avantaj / Maliyet
**Avantaj:** LLM drift sıfır · deterministik · gerçek SQL metrikler + gerçek tarihler · iki yönlü · tam audit/undo ·
orchestrator claude run kalkar (API maliyeti↓, kota sorunu biter) · headless sorun yok · sessiz hata biter.
**Maliyet:** geçiş emeği (~4-6 odaklı oturum) · ekip Canvas→dashboard/Home Tab geçişi · Postgres ~$5/ay · DB yedek/migration ops.

---
*Sonraki adım: onay → **Faz 0-1** (staging + Postgres + şema + read API). Sıfır riskli, eski sistem paralel çalışır.*
