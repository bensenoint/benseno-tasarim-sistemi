# Kanban Sürükle-Bırak ile Statü Değiştirme — Tasarım

**Tarih:** 2026-06-24
**Durum:** Onaylandı (tasarım)

## Amaç

Kanban panosunda (ana Kanban sekmesi) bir işi başka bir kolona **sürükle-bırak** ile
taşıyınca statüsünün sistem genelinde değişmesi ve işin Slack thread'ine durum-değişikliği
bildirimi düşmesi — Trello benzeri akış.

## Anahtar içgörü: backend + Slack zaten hazır

Statü değişiminin sistem-geneli yayılımı ve Slack bildirimi MEVCUT akışta var:

`onStatusChange(brief, durum)` (App.jsx) → optimistic `setBriefs` (tüm ekranlar anında
güncellenir) + `bnsPersistBriefChange` → `POST /api/briefs/:id/status` (`source: 'dashboard'`)
→ `writes.setStatus` → `reflectChange(...)` işin **Slack thread'ine "durum: X" notu** düşürür
(StatusMenu ile birebir aynı yol). Drag-drop yalnız bu fonksiyonu çağırır — yeni backend/Slack
kodu YOK.

## Kapsam: yalnız `dashboard/app/screens/Kanban.jsx`

Tek dosya değişir. Jobs içindeki ikincil `KanbanView` (4 kolon) ve mobil touch-DnD kapsam
dışı. `KanbanScreen` zaten `onStatusChange` prop'unu alıyor (App.jsx:590).

## Etkileşim tasarımı (HTML5 native DnD, bağımlılık yok)

- **Kart (`KanbanCard`):** masaüstünde `draggable=true`; `onDragStart` ile
  `dataTransfer.setData("text/bns", JSON.stringify({ id: brief.id, from: brief.durum }))`.
  Sürükleme sırasında kart `opacity` düşer (dragging state).
- **Kolon konteyneri:** `onDragOver` (preventDefault → drop'a izin + hover vurgusu),
  `onDragLeave` (vurgu kaldır), `onDrop` (durumu uygula).
- **Drop mantığı:** hedef kolon `col.id` = yeni durum. `from === col.id` ise işlem yok.
  Brief'i bul (aktif `allBriefs` veya `completedAsBriefs` içinden id ile), `onStatusChange(brief, col.id)` çağır.
- **Masaüstü-only:** `draggable` ve drop yalnız `!isMobile` (`useIsMobile()`); mobilde kart
  davranışı bugünkü gibi (tıkla → drawer). Mobilde `draggable` verilmez.
- **Görsel geri bildirim:** sürüklenen kart `opacity:.5`; üzerine gelinen kolon kenarlığı/zemini
  vurgulu (ör. `outline: 2px dashed var(--ody)` veya zemin `var(--ember-tint)`).

## Yan-etkili geçişlerde onay

Hedef kolon `tamamlandi` veya `musteride` ise drop'ta küçük onay sorulur
(`window.confirm("#<no> işini '<KolonEtiketi>' olarak işaretle?")`). Onaylanırsa
`onStatusChange` çağrılır; iptalde kart yerinde kalır (hiçbir şey yapılmaz). Diğer tüm
kolonlar anında uygulanır (onaysız).

## Veri akışı / optimistic

`onStatusChange` mevcut optimistic `setBriefs` ile kartı anında yeni kolona taşır. Tamamlandı'ya
bırakınca brief aktiften çıkıp completed listesine geçer; optimistic ara anda kart aktif
kolonlardan kalkar, kesin yansıma bir sonraki poll'da (30sn / `window.bnsRefresh`) gelir. Geri
açma (Tamamlandı'dan başka kolona sürükleme): hedef kolonun durumu uygulanır; backend
`completed_at`'i temizler.

## Hata yönetimi

- Geçersiz/kolon-dışı drop veya parse edilemeyen `dataTransfer` → yok say.
- `from === hedef` → yok say.
- Persist hatası → `onStatusChange`/`bnsPersistBriefChange`'in mevcut toast'u + poll düzeltir
  (best-effort; backend kaynak-doğruluğu).

## Kapsam dışı (YAGNI)

- Jobs içindeki `KanbanView` (ikincil 4-kolon görünüm).
- Kolon-içi yeniden sıralama (Trello reorder) — yalnız statü değişimi.
- Mobil dokunmatik sürükleme.
- Slack'e özel "panodan taşındı" mesajı — mevcut `reflectChange` notu kullanılır.

## Test

- DnD mantığı küçük (drop → durum çöz → onay gate → `onStatusChange`); `onStatusChange`/
  `setStatus`/`reflectChange` zaten mevcut testler + consistency-check kapsamında.
- Otomatik DnD testi kırılgan olduğundan: `scripts/ci-check.sh` (esbuild JSX parse) +
  canlı/preview manuel doğrulama (kart sürükle → kolon değişir → Slack thread'inde durum notu;
  Tamamlandı/Müşteride'de onay çıkar).
