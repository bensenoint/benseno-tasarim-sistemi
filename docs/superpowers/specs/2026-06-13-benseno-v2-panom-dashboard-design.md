# Benseno v2 "Panom" — Kişiye Özel Widget Dashboard'ı · Tasarım Spec'i

**Tarih:** 2026-06-13
**Durum:** Onaylandı (brainstorming) → uygulama planı bekliyor

**Amaç:** Mevcut dashboard'ın bazı ekranlara sığmayan yoğun yerleşimini, kişiye özel
düzenlenebilir bir **widget panosu** ile değiştirmek. Modern, kart-tabanlı, mobil-güçlü,
yoğun web kullanımı için tasarlanmış. Prod'a dokunmadan ayrı `/v2` demo alanında geliştirilir.

---

## Karar Özeti (brainstorming çıktısı)

| Karar | Seçim |
|---|---|
| Etkileşim analitiği | Kendi hafif izleyicimiz (paralel alt-proje, ayrı specte) |
| Demo alanı | Aynı GitHub Pages'te `/v2` yolu |
| Tasarım yönü | Kart tuvali (Yön 2) görünümü + sabit Ody (Yön 1) + tam kişiselleştirme |
| Kişiselleştirme | **Tam widget panosu — serbest ızgara** (ekle/çıkar/taşı/boyutlandır), kişiye özel kayıt |

---

## Mimari

- **Konum:** `dashboard-v2/` klasörü → GitHub Pages `/v2/`. Mevcut prod dashboard'a SIFIR risk.
- **Veri:** mevcut `calc.js` + `auth` + `GET /api/embedded` (JWT, salt-okur) boru hattı yeniden
  kullanılır. Yeni olan yalnızca KABUK + widget sistemi. Gerçek canlı veri.
- **Izgara motoru:** `gridstack.js` (CDN — cdnjs/jsdelivr). Sürükle/boyutlandır/responsive el yapımı
  DEĞİL; kanıtlanmış kütüphane. CSP allowlist'te.
- **Kimlik:** dashboard ile aynı `bns_token` (JWT). Giriş yoksa login (mevcut akış yeniden kullanılır).

## Widget Modeli

- Her widget örneği: `{ type: string, x: int, y: int, w: int, h: int }` (gridstack koordinatları).
- **Widget kayıt defteri** (`widgets.js`): `type → { title, minW, render(el, data) }`. render fonksiyonu
  `window.BNS_DATA`'dan (hidratlanmış canlı veri) okur; mevcut hesap helper'ları (calc.js) kullanılır.
- **Başlangıç kütüphanesi (1. kilometre taşı için 4–5):**
  - `riskli-islerim` — bnsIsRisk olan, kişinin işleri (renk vurgulu liste)
  - `kapasitem` — bnsPersonCapPct (büyük sayı + alt metin)
  - `kart-akisi` — durum kolonları (çalışılıyor/incelemede) kart yığını
  - `musteride` — müşteride bekleyen sayısı + liste
  - `bugun-yarin` — termini bugün/yarın olanlar
- **Sonraki tur kütüphanesi:** `marka-yogunlugu`, `cikti-hizi`, `son-teslimler` (galeri), `departman-ozeti`.

## Düzenleme Modu

- "Düzenle" toggle → gridstack düzenlenebilir olur: kart sürükle (⋮ handle), köşeden boyutlandır,
  kaldır (✕). "Alan ekle" → kütüphaneden widget seçici (eklenmemiş tipler listelenir).
- Düzenleme dışı: salt-görüntü, sürükleme kapalı.

## Kalıcılık (kişiye özel)

- Yeni tablo: `dashboard_layouts(user_id text PRIMARY KEY, layout jsonb, updated_at timestamptz)`.
- API: `GET /api/layout` (authGuard → req.user.slack_id'den okur) · `PUT /api/layout` (authGuard, body=layout).
- Layout boşsa → makul varsayılan pano (rol bazlı değil, herkese aynı başlangıç; kişi düzenler).
- Kayıt: düzenleme bitince (veya değişiklikte debounce) PUT. Yükleme: açılışta GET → gridstack'e uygula.

## Mobil

- gridstack `column(1)` (tek kolon) dar ekranda; widget SIRASI korunur (y'ye göre), boyutlandırma web-only.
- Sabit Ody şeridi üstte kalır; widget'lar altında dikey akış. Aynı widget render'ları.

## Sabit Ody (düzenlenemez)

- Üstte her zaman: ince **AI brief şeridi** (proaktif kişisel özet — mevcut /api/chat brief mantığı yeniden
  kullanılır) + "Ody'ye sor" çubuğu (mevcut Ody sohbetini açar). Izgaranın parçası DEĞİL, sabit kabuk.

## Güvenlik / Tutarlılık

- `/api/layout` authGuard arkasında (kişiye özel). `/api/embedded` zaten JWT'li (güvenlik #1).
- Formüller calc.js'ten (tek kaynak) — widget'lar yeniden hesap tanımlamaz (magic-guard korur).
- Mock-veri koruması: v2 de canlı veri yoksa boş gösterir (prod fixture sızıntısı kuralı geçerli).

## Kapsam — 1. Kilometre Taşı (demo ayağa kalksın)

1. `/v2` kabuğu: sol nav + sabit Ody brief şeridi + gridstack ızgara alanı.
2. gridstack entegrasyonu (sürükle/boyutlandır/tek-kolon mobil).
3. 4–5 çekirdek widget (riskli-islerim, kapasitem, kart-akisi, musteride, bugun-yarin).
4. Layout kaydet/yükle (`dashboard_layouts` + `/api/layout`).
5. "Düzenle" modu + "alan ekle" seçici.
6. Canlı veri (mevcut /api/embedded JWT) + login akışı.

**Sonraki turlar:** kalan widget'lar, mobil ince ayar, etkileşim analitiği (ayrı alt-proje),
veriye dayalı varsayılan pano düzeni.

## Açıkça KAPSAM DIŞI (YAGNI)

- Prod dashboard'a dokunma (v2 izole).
- Widget'lar arası canlı düzenleme/yazma (v2 salt-okur; yazma mevcut dashboard/Slack'te kalır).
- Rol bazlı otomatik panolar (herkese aynı başlangıç; kişi düzenler).
