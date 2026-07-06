# "Bugün" Ekranı + Aksiyon Katmanı — Tasarım Spec'i

**Tarih:** 2026-07-06 · **Durum:** Onaya sunuldu · **Kaynak:** Yol haritası P1 (dashboard pasif + dağınık bilgi)

## Problem

Bir tasarımcı giriş yapınca "şu an ne yapmalıyım?" sorusunun cevabı dağınık ve dashboard
**pasif** — görüyor ama üstünden aksiyon alamıyor (Slack'e geçmesi gerekiyor). Panom'da
kişisel widget'lar (kpi/kapasite/risk/işlerim/bugün) var ama (a) salt-görüntüleme, (b) varsayılan
giriş Panom değil. İki eksik: **aksiyon** ve **kurulumsuz tek bir "Bugün" bakışı**.

## Hedef (kullanıcı kararları)

1. **Aksiyon katmanı** — Panom widget'larında ve "Bugün" ekranında, satır üstünde 4 aksiyon:
   **Başladım · İlerlet · Termin öner · Hatırlat**.
2. **Panom'a "Bugün" butonu** → tıklayınca **bağımsız "Bugün" ekranına** gider (nav sekmesi
   DEĞİL, varsayılan giriş DEĞİL). Ekran: sıradaki iş + bugün deadline + geciken + kapasite.

## Mimari — Yaklaşım A (onaylı)

Tek paylaşılan `BriefActions` bileşeni hem Panom widget satırlarında hem `Bugun` ekranında
kullanılır. Statü ve termin aksiyonları MEVCUT altyapıyı çağırır; yalnız "Hatırlat" için 1 yeni
endpoint eklenir. Yeni DB tablosu/kolon YOK.

## Bileşenler

### 1. `BriefActions` (yeni paylaşılan bileşen — dashboard/app/Cards.jsx içine)

`BriefActions({ brief, currentUser, onStatusChange, onRemind })` — yetkiye göre 4 aksiyon butonu.
Saf yetki-gösterim mantığı ayrı bir fonksiyona alınır (test edilebilir):

```
bnsBriefActionPerms(brief, user) → { basla, ilerlet, termin, hatirlat }  (bool'lar)
```
Kurallar:
- **basla**: kullanıcı işin worker/lead'i (`window.bnsIsLead(b,uid)` veya contributors içinde)
  VE `brief.durum ∈ {yeni, calisiliyor}`.
- **ilerlet**: kullanıcı atanmış (worker/lead) VE `brief.durum` ilerletilebilir (aşağıdaki haritada
  bir sonrakisi var).
- **termin**: iş riskli/gecikmiş (`brief.deltaH <= 24` veya `bnsIsRisk`) VE kullanıcı
  lead / açan (`brief.created_by===uid`) / yönetici (`user.yetki==='yonetici'`).
- **hatirlat**: kullanıcı lead veya yönetici.

Aksiyon davranışları (hepsi optimistic + hata durumunda geri al + `window.bnsRefresh()`):
- **Başladım** → `onStatusChange(brief, 'basladi')` (App.jsx'teki mevcut handler; /status'a yazar).
- **İlerlet** → `onStatusChange(brief, NEXT_STATUS[brief.durum])`.
- **Termin öner** → `POST /api/briefs/:id/termin-oneri-uzat` (mevcut; BriefDrawer'daki `terminOneri('uzat')`
  deseniyle aynı — `by: currentUser.slack_id`).
- **Hatırlat** → `onRemind(brief)` → `POST /api/briefs/:id/remind`.

`NEXT_STATUS` (ileri iş akışı; server yan-etkileri kendi hallediyor):
```
yeni→calisiliyor, calisiliyor→basladi, basladi→incelemede,
incelemede→tamamlandi, revizyon→incelemede, beklemede→basladi, blokeli→basladi
```
(musteride/tamamlandi → ilerlet gösterilmez.)

Görsel: kompakt ikon+etiket butonları, mevcut editorial token'lar (`--ink`, `--ember`, `--info`).
`onStatusChange`/`onRemind` prop verilmezse ilgili buton gizlenir (Panom bazı widget'larda
onStatusChange geçmiyorsa kırılmaz).

### 2. Panom widget'larına aksiyon (dashboard/app/Panom.jsx)

`risk`, `mine`, `today` widget'larının brief satırlarına kompakt `BriefActions` eklenir.
Panom'a `onStatusChange` + `onRemind` App.jsx'ten prop olarak geçirilir (şu an geçmiyorsa eklenir).

### 3. Panom başlığına "Bugün" butonu

Panom başlık/araç çubuğuna "🗓️ Bugün" butonu → `setTab('bugun')`. Nav menüsüne EKLENMEZ.

### 4. `screens/Bugun.jsx` (yeni bağımsız ekran)

Props: `{ data, user, currentUser, onOpenBrief, onStatusChange, onRemind, onBack }`.
Sabit düzen (kurulum yok, herkeste aynı):
- **← Panom** dön butonu (`onBack` → setTab('panom')).
- **Sıradaki iş** — kullanıcının aktif işleri arasında `kisi_sira` en küçük olan (yoksa en yakın
  deadline). Büyük kart; "Başladım" öne çıkar. (calc/kuyruk mantığı: contributors[].kisi_sira.)
- **Bugün deadline** — deadline'ı bugün (TR) olan, kullanıcıyla ilişkili aktif işler.
- **Geciken** — `deltaH <= 0`, ilişkili aktif işler (Termin öner burada anlamlı).
- **Kapasitem** — `bnsPersonCapPct(user, bnsPersonLoad(capBriefs,uid)/5)`, tarih-duyarlı
  (Profile/Department ile aynı as-of kuralı).
- Her satır `BriefActions` kullanır.

"İlişkili" = `window.bnsIsLead(b,uid)` VEYA contributors içinde uid.

### 5. Yeni endpoint — `POST /api/briefs/:id/remind` (server/api.js)

`auth.authGuard`. İşin lead+worker'larına (isteği yapan hariç) hatırlatma gönderir:
```
işin brief_assignees (role IN contributor,lead) → her U* kullanıcı (actor hariç) →
notify(uid, { tip:'genel', aciliyet:'acil', text:`🔔 <actorAdı> hatırlattı: #<no> <baslik>`, link, briefId })
```
`aciliyet:'acil'` → sessiz saat/tercih izniyle anlık DM (notify zaten hallediyor). Actor adı
`users`/`dashboard_users`'tan `req.user`. Dönüş `{ ok:true, sent:N }`.

### 6. App.jsx tel bağlantıları

- `bugun` view: `else if (tab === "bugun") Screen = <BugunScreen ... onBack={()=>setTab('panom')} .../>`.
- `onRemind(brief)` helper: `window.bnsApiPost('/api/briefs/'+brief.id+'/remind', {})` → toast + refresh.
- Panom'a `onStatusChange` + `onRemind` prop'ları geçir.
- `BugunScreen` build sırasına `screens/Bugun.jsx` eklenir (build-dashboard.sh dosya listesi).

## Yetki özeti (onaylı)
- Başladım / İlerlet: yalnız işin atananı.
- Termin öner: lead / açan / yönetici.
- Hatırlat: lead / yönetici.

## Test
- **Birim (yeni):** `bnsBriefActionPerms` saf fonksiyonu — atanan/atanmayan, durum sınırları
  (yeni→basla var, tamamlandi→ilerlet yok), yönetici/lead/açan termin/hatırlat izinleri.
  (calc.js/data.js formül-test tarzı, node --test.)
- **Backend:** remind endpoint authGuard + kendini-hariç + notify çağrısı (mevcut test altyapısı).
- **CI:** esbuild parse (Bugun.jsx + değişenler) + 59 formül testi bozulmadan geçmeli.
- **Manuel/preview:** Panom widget aksiyonları + Bugün ekranı + "Bugün" butonu; canlı preview.

## Kapsam dışı (sonraya)
Aksiyonların Jobs/Kanban/Department satırlarına yayılması · "Bugün"ün nav sekmesi/varsayılan
landing yapılması · toplu aksiyon (multi-select) · özelleştirilebilir Bugün düzeni.
