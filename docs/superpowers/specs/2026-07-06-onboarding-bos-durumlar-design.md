# P2-A · Onboarding & Boş Durumlar — Tasarım Spec'i

> Tarih: 2026-07-06 · Faz: P2-A · EFOR: S · Altyapı: gerekmez (saf frontend) · Risk: yok

## Problem

Yeni eklenen kişiler (Serra, freelancer'lar) sisteme girince nereden başlayacağını
bilmiyor. Boş ekranlar "iş yok" diyor ama "ne yapmalısın" demiyor. Yeni kullanıcı,
ilk işi atanana kadar sistemi tanımadan kalabiliyor — kaybetme riski.

## Hedef

Üç parça, hepsi **saf frontend** (localStorage + mevcut veri; yeni API/DB yok):

1. **WelcomeTour** — ilk-giriş 4 adımlık mini tur (merkezi carousel).
2. **WelcomeCard** — ilk brief'e kadar profildeki "hoş geldin" kartı.
3. **Boş-durum yönlendirmeleri** — mevcut "iş yok" metinlerine tek cümle "ne yapmalısın".

## Tetikleme mantığı (onaylı)

- `hasWork` = kullanıcının atanmış **aktif** iş sayısı > 0.
- **WelcomeTour otomatik açılır** ⟺ `!hasWork` **VE** `localStorage.bns_tour_seen` yok.
  Kapatınca/bitince `bns_tour_seen` set edilir → bir daha otomatik açılmaz.
- Chrome başlığındaki **"?"** butonu turu herkese, her zaman **tekrar** açar
  (bayraktan bağımsız).
- **WelcomeCard** yalnız `!hasWork` iken Profile'ın en üstünde görünür; ilk iş
  atanınca veri değişir → kart kendiliğinden kaybolur (ekstra kalıcılık gerekmez).

## Bileşenler

### 1. `WelcomeTour` (yeni — dashboard/app/Onboarding.jsx)

Ekran ortasında tam-ekran overlay + 4 sayfalı kart. Her sayfa: emoji + başlık +
1-2 cümle. Alt bar: `‹ Geri` · sayfa noktaları · `İleri ›` (son sayfada `Başla`),
sağ üstte `Atla ✕`. Kapanış (Atla/Başla/overlay-dışı tık/Escape) → `bns_tour_seen=1`.

**4 adım içeriği:**
1. **👋 Hoş geldin** — "Burası Benseno iş takip paneli. İşlerin, terminlerin ve ekibin tek yerde."
2. **📋 İşlerin nerede** — "Sana atanan işler *İşler* sekmesinde ve profilinde *Bugün* bölümünde. Bir işe tıkla → detay + aksiyonlar açılır."
3. **⏭️ Aksiyon al** — "İş kartında: Başladım · İlerlet · Termini uzat · Hatırlat. Durum güncellemek için Slack'e geçmene gerek yok."
4. **🔔 Bildirimler & Ody** — "Rozetten bildirimlerini gör; takıldığında Ody'ye (asistan) sorabilirsin. Hazırsın!"

Props: `{ open, onClose }`. `window.WelcomeTour = WelcomeTour`.

### 2. `WelcomeCard` (yeni — dashboard/app/Onboarding.jsx)

Profile en üstünde, yalnız `!hasWork` iken. Metin:

> **👋 Hoş geldin, {ad}!** Henüz sana atanmış bir iş yok. İlk işin atandığında
> burada ve *İşler* sekmesinde görünecek. Bu arada sistemi tanımak için
> **[Turu aç]**. Sorun olursa ekip liderine yaz.

`[Turu aç]` → tur overlay'ini açar. Props: `{ name, onOpenTour }`. `window.WelcomeCard = WelcomeCard`.

### 3. Boş-durum tek cümleleri (mevcut metne eklenir — yeni bileşen yok)

- **Profile→Bugün** "Bugün deadline'ı olan iş yok." → sonuna: "— rahatça nefes al ya da *İşler*den sıradakine bak."
- **Jobs** (kişisel scope) boşsa: "Sana atanmış aktif iş yok. Lider sana iş atadığında burada görünür."
- **Kanban** boşsa: "Bu görünümde iş yok. Filtreyi temizlemeyi ya da *İşler*e bakmayı dene."
- **Genel filtre-boş** ("Bu filtreyle eşleşen brief yok.") → sonuna: "— filtreyi temizlemeyi dene."

## Kod yapısı

- **Yeni dosya:** `dashboard/app/Onboarding.jsx` (WelcomeTour + WelcomeCard).
  `scripts/build-dashboard.sh` cat listesine eklenir (Chrome.jsx'ten önce, App.jsx'ten önce olacak şekilde — window.* atamaları App render'ından önce hazır olsun).
- **App.jsx:** `hasWork` hesabı (currentUser'ın aktif atanmış işleri); `bns_tour_seen`
  useStickyState ile; tur `open` state'i; otomatik-açılış effect'i (`!hasWork && !seen`);
  tur overlay render; Chrome'a `onOpenTour` prop'u (başlık "?" butonu için).
- **Chrome.jsx:** başlık/araç çubuğuna küçük "?" butonu → `onOpenTour()`.
- **Profile.jsx:** en üste `WelcomeCard` (yalnız kendi profili + `!hasWork`).
- **Jobs.jsx / Kanban.jsx / BriefTable.jsx / Profile.jsx:** boş-durum cümleleri yerinde düzenlenir.

## Kapsam dışı (sonraya)

- Kişiye/güne özel içerik (o P2-B "Ody proaktif" işi).
- Backend'e "onboarding tamamlandı" bayrağı (localStorage yeterli; cihaz başına kabul).
- Coachmark/spotlight (kırılgan; merkezi carousel seçildi).

## Test

Saf-UI, formül yok → `formula-test.js` etkilenmez.
- `bash scripts/ci-check.sh` → parse + tek-tanım güvencesi geçer.
- Preview manuel: (a) 0-iş kullanıcıda tur otomatik açılır; Atla → tekrar otomatik açılmaz,
  (b) "?" turu tekrar açar, (c) iş atanınca WelcomeCard kaybolur, (d) boş-durum cümleleri görünür,
  (e) mobilde tur kartı taşmaz.
