# "İşe başlandı" Statüsü — Tasarım

**Tarih:** 2026-06-24
**Durum:** Onaylandı (tasarım)

## Amaç

İş akışına, "işi kabul ettim/üstlendim" ile "gerçekten o iş üzerinde şu an çalışıyorum"
ayrımını yapan yeni bir statü eklemek. Bugün `çalışılıyor` pratikte "kabul" anlamında
kullanılıyor; gerçek çalışma başlangıcı ölçülemiyor. Yeni `İşe başlandı` statüsü bu boşluğu
kapatır ve çalışma süresi metriğini gerçek emek başlangıcına dayandırır.

## Akış modeli (tamamen eklemeli)

```
yeni  →  çalışılıyor (kabul/üstlenildi)  →  İşe başlandı (YENİ)  →  incelemede  →  …
```

- Yeni durum key: **`basladi`**, etiket **"İşe başlandı"** (kısa: "Başladı").
- Renk: `çalışılıyor`dan (mavi/`--info`) ayrışan canlı yeşil/teal — "şu an aktif" hissi.
  Uygulamada `var(--ok, #2E8F66)` veya benzeri yeşil; mevcut token paleti içinden seçilir.
- Geçişler serbest kalır (bugünkü gibi herhangi emoji herhangi durumu set edebilir; sıkı
  state-machine zorunluluğu yok).
- Mevcut `çalışılıyor` statüsünün anlamı/verisi DEĞİŞMEZ — tamamen eklemeli.

## Veri modeli + süre metriği

**Mevcut:** `bnsSureH(bitis, baslangic, beklemeMs)` = (bitiş − başlangıç − bekleme).
`queries.js`'te `baslangic = ms(b.started_at)`, `bitis = ms(b.completed_at)`.

**Değişiklik (hibrit, calc.js'e dokunmadan):**
- Migration `0004_brief_basladi_at.sql`: `ALTER TABLE briefs ADD COLUMN basladi_at timestamptz;`
- Status endpoint (`server/writes.js` durum güncelleme): durum `basladi` olduğunda ve
  `basladi_at` NULL ise → `basladi_at = now()` set edilir (ilk işe-başlama anı; sonradan
  geri/ileri statü değişimlerinde tekrar yazılmaz).
- `server/queries.js` (getEmbedded + getState): `baslangic = ms(COALESCE(b.basladi_at, b.started_at))`.
  - Damga VARSA: süre işe-başlandı → bitiş (gerçek emek süresi).
  - Damga YOKSA (tüm geçmiş + 🚀 işaretlenmemiş yeni işler): mevcut `started_at` → bitiş.
- **calc.js ve 35 testi DEĞİŞMEZ** — yalnız `baslangic`'i besleyen timestamp değişir.

## Slack bot (`scripts/slack-bot.js`)

- 🚀 (`:rocket:`) reaksiyonu → `basladi`. Eklenecek yerler:
  - `DURUM_MAP`: `rocket: 'basladi'`
  - thread-metni `EMOJI_DURUM`: `{ emoji: '🚀', durum: 'basladi' }`, `{ emoji: ':rocket:', durum: 'basladi' }`
  - `/yardım` durum listesi metni: `🚀 → İşe başlandı`
- Mevcut bso-* özel emoji seti ve diğer eşlemeler korunur.

## Dashboard

- **StatusPill** (`dashboard/app/Atoms.jsx`): `basladi: { color: <yeşil>, label: "Başladı", full: "İşe başlandı" }`.
- **Kanban** (`screens/Kanban.jsx`): `Çalışılıyor` ile `İncelemede` arasına yeni kolon
  `{ id: "basladi", label: "İşe başlandı", Ic: <uygun ikon>, accent: <yeşil> }`.
- **BriefTable** (`dashboard/app/BriefTable.jsx`): durum değiştirme menüsüne
  `["basladi", "İşe başlandı"]` seçeneği (Çalışılıyor'dan sonra).
- **Jobs "Açık" scope** (`screens/Jobs.jsx`): `scope==="open"` filtresi bugün
  `yeni||calisiliyor`; buna `basladi` eklenir (aktif iş sayılır). Segment sayacı da güncellenir.
- **Ody** (`server/ody-tools.js` `brief_sorgula` durum açıklaması + `server/chat-bilgi.md`):
  yeni durum `basladi` listelenir.

## Kapasite / aktif yük

`basladi` açık iş sayılır (kapasiteye dahil), tıpkı `çalışılıyor` gibi. Çoğu sorgu zaten
"müşteride değil → aktif" mantığında olduğundan (`durum <> 'musteride'`) `basladi` otomatik
doğru kapsanır. Özel "müşteride hariç aktif" filtreleri zaten `basladi`'yı içerir.

## Geriye dönük uyum

Tüm mevcut işlerde `basladi_at = NULL` → COALESCE ile `started_at` kullanılır (eski davranış
birebir korunur). Sıfır veri kaybı, sıfır migrasyon riski; tamamen eklemeli.

## Etki yüzeyi & test

**Elle dokunulacak dosyalar:**
- `server/writes.js` (DURUMLAR enum + `basladi_at` set)
- `server/migrations/0004_brief_basladi_at.sql` (yeni)
- `server/queries.js` (COALESCE)
- `dashboard/app/Atoms.jsx` (StatusPill)
- `dashboard/app/screens/Kanban.jsx` (kolon)
- `dashboard/app/BriefTable.jsx` (durum menüsü)
- `dashboard/app/screens/Jobs.jsx` ("Açık" scope)
- `scripts/slack-bot.js` (emoji eşleme + /yardım)
- `server/ody-tools.js` + `server/chat-bilgi.md` (Ody durum bilgisi)

**Otomatik doğru davranan (musteride-değil mantığı):** aktif/gecikme sayımları, kapasite,
consistency-check dept sayıları.

**Test:**
- `calc.js` 35 testi değişmeden geçer (mantık aynı).
- Yeni birim/entegrasyon testi: durum → `basladi` set edilince `basladi_at` damgalanır;
  `queries` COALESCE damgalı işte `basladi_at`, damgasızda `started_at` döndürür.
- `consistency-check.js`: `basladi`'nın aktif sayımlara dahil olduğu doğrulanır (regresyon yok).
- Ody eval: opsiyonel "kaç iş işe başlandı durumunda" vakası.

## Kapsam dışı (sonraki turlar)

- "İşe başlandı"ya özel ayrı bir KPI/rapor kartı (süre zaten metriğe yansıyor; ek kart YAGNI).
- Sıkı state-machine (geçiş kısıtları) — bugünkü serbest geçiş korunur.
- Özel bso-* emoji (🚀 standart unicode yeterli görüldü).
