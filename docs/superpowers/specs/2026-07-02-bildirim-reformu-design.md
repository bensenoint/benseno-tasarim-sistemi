# Bildirim Reformu v1 — Tasarım Spec'i

**Tarih:** 2026-07-02 · **Durum:** Onaya sunuldu · **Kaynak:** Yol haritası P0 (bildirim yorgunluğu)

## Problem

Sistem 8 zamanlı rapor üretiyor (sabah kanal 07:50, kişisel DM 07:55, termin-risk saat başı :15,
thread-özet :00, kanal-özet :30, günsonu 18:45, günlük 17:05, haftalık Cuma, aylık ay sonu).
Kullanıcı geri bildirimi: **hacim çok + alaka düşük + hiçbir kontrol yok** → bildirimler tümden
görmezden geliniyor. Ayrıca dashboard'da bir işe/markaya ait bildirim geçmişi görünmüyor.

## Hedef davranış (kullanıcı kararları)

| Karar | Değer |
|---|---|
| Ana model | **Günlük dijest** — anlık bildirim istisna, gerisi toplu |
| Dijest zamanı | Günde 2: **08:30 ve 13:30** (haftaiçi) |
| Dijest kanalı | **İkisi de**: Slack DM + uygulama-içi zil |
| Anlık (acil) istisna | **Termin riski** + **sana atama/lead** — anında Slack DM |
| Bloke / müşteri dönüşü | Dijeste girer (anlık değil) |
| Kanal raporları | **Sadeleşir**: saatlik thread-özet + kanal-özet KALDIRILIR; sabah kanal, günlük 17:05, haftalık, aylık KALIR |
| Kişi kontrolü (v1) | **Orta**: öğlen dijesti aç/kapa + kategori aç/kapa (termin/atama/bloke) + kişisel sessiz saat |
| İş/marka rozetleri | İşin **TÜM** bildirimleri görünür (kişiye bakılmaksızın) — akış zinciri sonraki halkayı da ilgilendirir |

## Mimari — Yaklaşım A (onaylı)

Merkezi `notify()` kapısı; mevcut `notifications` tablosu hem **zil** hem **dijest tamponu**.
Yeni tablo yok denecek kadar az yüzey; üreticiler tek fonksiyona bağlanır.

```
üretici (termin-risk / writes.js atama / writes.js statü)
        │
        ▼
  notify(userId, {tip, aciliyet, text, link, briefId})     ← server/notify.js (YENİ)
        │
        ├─ HER ZAMAN: INSERT notifications (zilde anında görünür)
        ├─ acil + pref açık + sessiz saat dışı + haftaiçi → slack.dm anında, slack_at=now()
        └─ değilse → satır bekler; 08:30/13:30 dijesti toplar (dijest_at=now())
```

## 1. Veri modeli

Migration `0010_bildirim_reformu.sql`:

```sql
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS tip TEXT DEFAULT 'genel',        -- termin|atama|bloke|musteri|statu|genel
  ADD COLUMN IF NOT EXISTS aciliyet TEXT DEFAULT 'normal',  -- acil|normal
  ADD COLUMN IF NOT EXISTS dijest_at TIMESTAMPTZ,           -- NULL = dijest bekliyor
  ADD COLUMN IF NOT EXISTS slack_at TIMESTAMPTZ,            -- anlık DM zamanı
  ADD COLUMN IF NOT EXISTS brief_id INTEGER,                -- ilgili iş (NULL = genel)
  ADD COLUMN IF NOT EXISTS marka TEXT;                      -- brief'ten türetilir

CREATE TABLE IF NOT EXISTS notify_prefs (
  user_id TEXT PRIMARY KEY,
  ogle_dijest BOOLEAN DEFAULT true,
  tip_termin BOOLEAN DEFAULT true,    -- kategori kapatmak yalnız ANLIK DM'i keser;
  tip_atama  BOOLEAN DEFAULT true,    -- zil + dijest her zaman yazılır
  tip_bloke  BOOLEAN DEFAULT true,
  sessiz_bas SMALLINT DEFAULT 19,     -- TR saati; 19→08 push yok
  sessiz_bit SMALLINT DEFAULT 8
);

CREATE TABLE IF NOT EXISTS brief_notif_seen (
  user_id TEXT NOT NULL,
  brief_id INTEGER NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brief_id)
);
```

`notify_prefs`te satır yoksa varsayılanlar geçerli — kurulum gerektirmez.

## 2. `server/notify.js` (yeni, tek dosya)

```js
async function notify(userId, { tip='genel', aciliyet='normal', text, link=null, briefId=null })
```
1. `briefId` verilmişse markayı brief'ten çöz (tek SELECT), `notifications`e INSERT
   (tip, aciliyet, brief_id, marka dahil). **Bu adım hiçbir koşula bağlı değil** — zil kaydı garantidir.
2. `aciliyet==='acil'` ise: `notify_prefs` oku (yoksa varsayılan) →
   `tip_<tip>` açık **ve** TR saati sessiz aralık dışında **ve** haftaiçi ise `slack.dm` + `slack_at=now()`.
3. DM hatası yutulur (log'lanır) — satır tabloda kaldığı için bildirim kaybolmaz, dijest yakalar.

Mevcut doğrudan INSERT'ler (`writes.js:537`, `slack.js logNotification`) `notify()`'a yönlendirilir
(logNotification imzası korunur, içi notify'ı çağırır — geriye uyum).

## 3. Üreticiler

| Üretici | Olay | tip / aciliyet | Alıcılar |
|---|---|---|---|
| `scripts/termin-risk.js` | iş riske girdi (bnsIsRisk) | termin / **acil** | lead'ler + worker'lar |
| `server/writes.js` | kişiye atama / lead yapıldı | atama / **acil** | yalnız yeni eklenen kişi |
| `server/writes.js` | statü → blokeli | bloke / normal | lead'ler + worker'lar |
| `server/writes.js` | müşteri dönüşü (musteride→aktif) | musteri / normal | lead'ler + worker'lar |

termin-risk'in thread'e yazdığı saatlik uyarı mesajı **kaldırılır**; kişi başına 20 saatlik
tekrar-bastırma (idempotans) `notifications`ta son `tip='termin'` satırının zamanına bakılarak korunur.

## 4. Dijest — `scripts/rapor-dijest.js` (yeni; rapor-kisisel devrolur)

08:30 ve 13:30 haftaiçi, kişi başına tek Slack DM:
- **Bekleyenler:** `dijest_at IS NULL AND user_id=$1` satırları tip'e göre gruplanır.
- **Bugünün işleri:** sıradaki iş (kuyruk), bugün deadline, geciken — calc.js formülleriyle
  (rapor-kisisel'in mevcut içeriği buraya taşınır; `musteride` hariç kuralı korunur).
- Gönderim sonrası işlenen satırlara `dijest_at=now()`.
- **Boşsa DM atılmaz.** 13:30 dijesti `ogle_dijest=false` olan kişiye gitmez (bekleyenleri
  ertesi sabah 08:30 dijesti toplar).
- `rapor-kisisel.js` silinmez; scheduler'dan çıkarılır (geri dönüş kolaylığı).

## 5. Scheduler değişiklikleri (`scripts/scheduler.js`)

```
KALDIR: 55 7  * * 1-5  run-kisisel-rapor.sh
KALDIR: 0  9-19 * * 1-5 run-thread-ozet.sh          ← saatlik gürültü
KALDIR: 30 9-19 * * 1-5 run-kanal-ozet.sh           ← saatlik gürültü
EKLE:   30 8  * * 1-5  run-dijest.sh
EKLE:   30 13 * * 1-5  run-dijest.sh
KALIR:  50 7 sabah-kanal · 15 9-19 termin-risk (artık notify üretir) ·
        45 18 kanal-günsonu · 5 17 günlük · 10 17 Cuma haftalık · 15 17 25-31 aylık ·
        bakım cron'ları (log-temizle, PAT, yedek)
```

## 6. Tercih paneli (dashboard)

- API: `GET /api/notify-prefs` + `POST /api/notify-prefs` (authGuard; kişi yalnız kendi satırı;
  Zod ile alan doğrulama, saat 0-23).
- UI: Profil ekranına küçük "Bildirim tercihleri" kartı — öğlen dijesti anahtar, 3 kategori
  anahtarı, sessiz saat başı/bitişi (select 0-23). Kayıt anında POST; görsel dil mevcut
  editorial token'larla.

## 7. İş & marka bildirim rozetleri (dashboard)

**Kapsam kararı:** rozet ve liste işin **TÜM** bildirimlerini gösterir (kime üretildiğine
bakılmaksızın) — iş akışı zincirinde dolaylı etki görünür olsun.

- **Tekilleştirme:** aynı olay N kişiye N satır yazar → iş görünümünde
  `(brief_id, tip, text)` üçlüsü 10 dk penceresinde tek olay sayılır (SQL `DISTINCT ON` /
  `MIN(created_at)` gruplaması sunucuda yapılır).
- **API:** `/api/embedded` payload'ına `bns_notif`: `{ briefs: {<brief_id>: {count, last_at}},
  markalar: {<marka>: {count, last_at}} }` — kişinin `brief_notif_seen.seen_at` (yoksa 7 gün)
  sonrası **tekil olay** sayıları. Tek gruplu sorgu; payload küçük kalır.
  Ek uç: `GET /api/briefs/:id/notifications` (authGuard) — o işin tekil olay listesi (son 30);
  `POST /api/briefs/:id/notif-seen` — `brief_notif_seen` upsert.
- **UI — iş:** BriefTable satırı + Kanban kartında okunmamış>0 ise küçük rozet (mevcut rozet
  dilinde, sayı ile). BriefDrawer'a "Bildirimler" bölümü (accordion): tekil olaylar kronolojik
  (tip ikonu + metin + zaman). Bölüm açılınca `notif-seen` POST → rozet o kişi için söner.
- **UI — marka:** Brand sayfası üstüne aynı desen — markanın işlerindeki tekil olaylar
  (accordion, PeriodSebep kalıbı); satıra tıklayınca ilgili işin drawer'ı açılır.

## 8. Kademeli açılış

- `BNS_NOTIFY_V2` env bayrağı: kapalıyken üreticiler eski davranışta (thread uyarısı dahil),
  scheduler eski cron'larla. Açılınca yeni akış. Railway'de önce bayrak kapalı deploy →
  Görkem + 1 kişi için manuel doğrulama (dijest dry-run, acil DM testi) → bayrak açılır.
- Geri dönüş: bayrağı kapatmak eski davranışı geri getirir (kod silinmez).

## 9. Test planı

- **Birim (yeni `server/notify.test.js`):** acil→satır+DM; normal→yalnız satır; sessiz saatte
  acil→satır var DM yok; kategori kapalı→DM yok satır var; briefId→marka doldurulur;
  DM hatası→satır sağlam.
- **Dijest (`scripts/` test):** bekleyen gruplama; boş→DM yok; `ogle_dijest=false`→13:30 atlanır,
  satırlar sabaha kalır; dijest_at işaretlenir.
- **Rozet:** tekilleştirme (3 alıcılı olay=1), seen sonrası sayım sıfırlanır.
- **Mevcut korumalar:** CI kapısı + 59 formül testi + consistency-check değişmeden geçmeli.

## Kapsam dışı (v2'ye)

Yönetici "tüm ekip bildirimleri" ayrı görünümü/toggle'ı · Ody proaktif içgörü · sabah-kanal
raporunun kişiselleştirilmesi · bildirim arama/filtreleme.
