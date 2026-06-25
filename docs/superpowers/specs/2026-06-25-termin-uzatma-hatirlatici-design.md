# İşe dönüşte termin uzatma hatırlatıcısı — Tasarım

**Hedef:** Bir iş `beklemede`/`müşteride`'den tamamlanmadan aktife dönünce "termini uzatmak ister misin?" hatırlatıcısı (dashboard + Slack). Hatırlatıcı açıkken yapılan uzatma GECİKME/CEZA sayılmaz.

## Kurallar (onaylı)
1. **Muaf kapsamı:** yalnız hatırlatıcı AÇIKken yapılan ileri-termin uzatması muaf.
2. **Öneri miktarı:** "bekleme/müşteride süresi kadar uzat" tek-tık (principal miktar).
3. **Kalıcılık:** kullanıcı **uzatana** veya **Kapat**'a basana kadar açık kalır.

## Veri modeli (migration 0007)
- `briefs.termin_oneri_at timestamptz` — hatırlatıcı açıldı anı (NULL = kapalı).
- `briefs.termin_oneri_ms bigint` — önerilen uzatma miktarı (bekleme/müşteride süresi, ms).
- `briefs.uzatma_muaf int default 0` — muaf (cezasız) uzatma sayısı (şeffaflık/iz).

## Tetikleyici (writes.js setStatus)
Önceki durum ∈ {beklemede, musteride} **ve** yeni durum ∈ {basladi, calisiliyor, incelemede, revizyon} **ve** tamamlanma değil →
- `termin_oneri_at = now()`, `termin_oneri_ms = now() − (son beklemede/müşteride event ts)`.
- reflectChange ile thread'e hatırlatıcı mesajı + dashboard bell bildirimi (atanana).

## Uzatma (patchBrief deadline)
İleri uzatmada `termin_oneri_at` doluysa → **muaf**: `uzatma_sayisi`/`uzatma_ceza` ARTMAZ, `uzatma_muaf += 1`, `deadline_history` `muaf:true`, `termin_oneri_at = NULL` (kapanır). Doluyken değilse bugünkü cezalı davranış.

## Hesaplar (calc — DEĞİŞİKLİK GEREKMEZ)
- `gecikme` zaten MEVCUT termine göre ölçülür → muaf uzatma terminini ileri taşır → gecikme kendiliğinden azalır (çift sayım yok).
- `uzatildi = uzatma_sayisi > 0` → muaf uzatma sayacı artırmadığı için **false kalır** → "uzatıldı" teslim durumu/rozeti tetiklenmez. Saf muafiyet = penalized sayaçları artırmamak.

## UI
- **BriefDrawer:** `termin_oneri_at` doluysa şerit: "↩️ İşe geri dönüldü — termini uzatmak ister misin?" + [Bekleme kadar uzat (X)] (deadline += termin_oneri_ms) + [Kapat] (flag temizle).
- **Bell:** atanana bildirim.
- **Slack:** thread mesajı (öneri + "bu uzatma gecikme sayılmaz").

## Dismiss
`POST /api/briefs/:id/termin-oneri` {action:'uzat'|'kapat'} — uzat: deadline += ms (muaf), kapat: flag temizle. Slack'te uzatınca da flag kapanır.

## Ody
chat-bilgi.md: hatırlatıcı + muaf uzatma kuralı eklenir.
