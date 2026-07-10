# Tek Aktif İş (WIP=1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline — yerleşik karar).

**Goal:** Kişi başına aynı anda tek fiilî iş; kişi-bazlı 🚀; çakışmada onay kartı/penceresi; profilde "sen: beklemede".

## Task 1: Migration 0021 + writes.js kapı çekirdeği
- 0021: `ALTER TABLE brief_assignees ADD COLUMN IF NOT EXISTS calisiyor boolean NOT NULL DEFAULT false;` + backfill: basladi durumundaki TEK worker'lı briefların worker'ına true.
- writes.js: `wipCakisma(uid, haricBriefId)` (calisiyor=true olduğu başka brief) · `wipBaslat(briefId, uid, {zorla})`: çakışma yok→işaret aç (+durum basladi değilse setStatus'a bırakılır, işaret yönetimi setStatus içinde); çakışma var & !zorla → {cakisma}; zorla → eski işte işaret kapat + eski işte başka calisiyor yoksa setStatus(beklemede, system, Ody notu).
- setStatus entegrasyonu: durum→basladi geçişinde (source her ne olursa) tetikleyen worker ise kapıdan geçir (çakışmada e.status=409 + cakisma throw; d.zorla bayrağıyla zorla yolu); basladi DIŞI duruma geçişte briefin tüm calisiyor işaretleri kapanır; revizyon notuna 🚀 ipucu; tetikleyen atanan değil + tek worker → o worker kapıdan (çakışmada başlatma yine olur ama calisiyor açılmaz, worker'a DM).
- statusBody zod'a `zorla: z.boolean().optional()`.
- Otomatik kuyruk (system→basladi): çakışan worker varsa başlatma yerine DM "sıradaki işin hazır, 🚀 ile başla" (brief calisiliyor'da bırak).

## Task 2: "ben de başladım" + API
- Yeni endpoint POST `/api/briefs/:id/ben-basladim` (writeGuard {by, zorla}) → brief basladi durumundaysa ve kişi atananıysa wipBaslat (durum değişmez); 409+cakisma.
- setStatus basladi yolu da 409+cakisma JSON döndürür (handleWrite'ta e.status ile).

## Task 3: Slack — onay kartı + reaction yolları
- Reaction/kelime basladi handler'ları: statusYetki sonrası POST status {zorla yok} → 409 ise thread'e onay kartı: `bns_wip_onay` (value: JSON {id, by, benBasladim}) + `bns_wip_vazgec`; kartta çakışan iş adı. Onay action: yalnız value.by tıklayabilir; POST {zorla:true} (status ya da ben-basladim) → kartı ✓ günceller. Vazgeç: kartı siler/günceller.
- Brief zaten basladi iken atananın 🚀 reaction'ı → ben-basladim çağrısı (409→aynı kart).

## Task 4: Dashboard — onay penceresi + profil rozeti + embedded
- queries.js: workers json_build_object'e `'calisiyor', a.calisiyor` ekle (assignees join'inde). data.js hydrate passthrough.
- App.jsx persist status yolu: 409+cakisma yanıtında window.confirm benzeri modal (basit confirm() yeterli — ev stili: bnsToast değil confirm) → onayda zorla:true ile tekrar.
- Profile.jsx: kişinin 'basladi' işinde workers içinde kendi kaydı calisiyor=false ise durum hücresinde "çalışılıyor · sen: beklemede" rozeti.

## Task 5: Testler + doküman + deploy + canlı smoke
- Birim: wipBaslat çekirdeği (railway run ile canlı DB'de sahte olmayan test yerine — SQL'e dokunan kısım için test işleri üzerinden canlı smoke; saf kısımlar node testi).
- Help + klavuz bölümü; CI+build; deploy api+bot+Pages.
- Canlı smoke: 2 test işi → #A'ya başla → #B'ye 🚀 → onay kartı → onayla → #A beklemede + #B basladi + işaretler doğru → temizlik.
