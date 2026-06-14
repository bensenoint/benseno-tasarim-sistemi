# 01 — Evidence

## Visual (canlı + tokens.css)
- **Renk sistemi:** Sıcak paper paleti (`--paper #FBFAF7`, `--surface #FFFFFF`), 5-kademe ink (`--ink #16161A`…`--ink-5 #B6B6BE`), 3-kademe line, tek aksan `--ember #C24A2C`. Tam dark-mode paritesi (tokens.css:162-199). (tokens.css:19-45)
- **Tipografi:** 3 aile — Geist (sans), Instrument Serif (display, başlıklar), Geist Mono (sayılar/rozet). (tokens.css:75-77)
- **Kontrast:** birincil metin/zemin = **17.29:1** (WCAG AAA). Ölçüldü.
- **Focus ring:** token tanımlı `--ring-focus: 0 0 0 2px var(--paper), 0 0 0 4px var(--ember)`. (tokens.css:142)
- **Spacing/grid:** `--grid-gap:16px`, `--section-gap:24px` (responsive: 12/18 mobil, 20/32 geniş). (tokens.css:371-388)
- **State'ler:** loading (spinner, index.html), error (ScreenErrorBoundary), empty ("Risk yok — temiz", "48 saatte termin yok"), focus (ring token), disabled (Gönder btn), hover (nav/satır/kart) — hepsi mevcut.
- **Overview görünüm:** editöryel serif başlık ("İyi akşamlar, Görkem"), 7 KPI kartı (sayı + mini sparkline + delta chip), "Bugün ve yarın" tablosu (öncelik/kalan/marka/atanan/teslim/durum), collapsed rail, sessiz topbar.

## Structural
- 20 route (App.jsx). Sidebar rail/flyout, modüler screens/*. Kart chrome tutarlı (Cards.jsx).
- Ody maskotu: mood-reaktif, bildirim akışına bağlı (Chrome.jsx) — emsal ürünlerde nadir bir öğe.

## Copy & Honesty
- Etiketler düz Türkçe, davranışla 1:1 (Aktif brief, Geciken, Çalışılıyor, Müşteride). Pazarlama süslemesi yok (iç araç).
- Önceki denetimde yakalanan tek uyumsuzluk ("Bugün teslim" = 24s pencere) **düzeltildi** → takvim-bugün.
- Dark pattern yok.

## Weight & Friction
- `bundle.js` 408K (gömülü EMBEDDED_DATA dahil — saf JS daha küçük) + React UMD (~140K) + data.js. Başlangıç JS muhtemelen >500KB.
- **GridStack CDN (~CSS+JS) her sayfada yükleniyor** (index.html:11-12) — oysa Panom şu an gizli → ölü yük.
- Idle animasyon: Ody `odyBob 4.5s infinite` sürekli çalışıyor. `prefers-reduced-motion` guard'ı yok.
- Başlangıçta modal/badge yok; topbar sade.

## Bilinen boşluklar
- Lighthouse/TTI ölçülmedi (tahmini). A11y klavye sırası tam taranmadı (yüksek kontrast + focus token mevcut).
