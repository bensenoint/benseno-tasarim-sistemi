# Profil Kişisel İş Kuyruğu + Otomatik Statü — Tasarım

**Tarih:** 2026-06-24
**Durum:** Onaylandı (tasarım)

## Amaç

Profil sayfasındaki iş listesini, kişinin **işi yapacağı (contributor)** brief'lerden oluşan,
sürükle-bırakla sıralanabilen bir **kişisel iş kuyruğuna** dönüştürmek. Kuyruğun başı =
kişinin "şu an üzerinde çalıştığı" iş = **başlandı**. Bir kişide aynı anda tek aktif iş olur;
yeni bir iş başa alınınca öncekisi otomatik **beklemede**ye çekilir; aktif iş bitince sıradaki
otomatik başa geçip **başlandı** olur. Brief tek `durum`'da kalır (Kanban onu gösterir).

## Statü modeli (karar)

Brief başına tek `durum` KORUNUR. "Başlandı" bir kişinin **aktif (kuyruk başı)** işidir.
Brief, **atananlardan en az biri** onu aktif yaptığı sürece `basladi` kalır; `beklemede`ye
yalnız hiç aktif kişi kalmayınca düşer. (5. madde böylece çok-kişili işlerde tutarlı.)

## Veri modeli

- Yeni kolon: `brief_assignees.kisi_sira int` — her atananın **kişisel kuyruk sırası**
  (brief-içi `sira`'dan FARKLI; o, sıralı-akış contributor sırası). NULL → en sona.
- "Aktif iş" ayrı bayrak DEĞİL: bir kullanıcının kuyruk başı = o kullanıcının **kuyruğa dahil**
  brief'leri içinde en küçük `kisi_sira`'lı olan.

## Kuyruk kapsamı (kritik — rol filtresi)

Bir kullanıcının kuyruğu = o kullanıcının **`contributor` (worker)** rolüyle atandığı ve
durumu kuyruğa-uygun olan brief'ler. Aşağıdakiler kuyruğa GİRMEZ:
- Kullanıcının yalnız **lead** veya **gozlemci** olduğu brief'ler (salt-okunur, sürüklenemez,
  statüleri bu kişinin kuyruğundan etkilenmez).
- Durumu **tamamlandi** veya **musteride** olan brief'ler (kuyruktan düşmüştür; müşteriden
  revizyonla dönerse geri girer).

## "Başa alma" → statü geçişi (işin mevcut durumuna göre)

Bir iş kuyruğun başına çekildiğinde (aktive edildiğinde), brief `durum`'u şuna geçer:

| Mevcut durum | Aktive edilince |
|---|---|
| yeni / calisiliyor (iş planında) / beklemede / blokeli | **basladi** |
| incelemede | **revizyon** (yeniden çalışılıyor) |
| musteride | **revizyon** (mevcut "✈️ sonrası revizyon" akışıyla) |
| tamamlandi | önce **reopen** (mevcut yeniden-açıldı akışı) → **basladi** |

Bu geçişler mevcut `writes.setStatus` davranışlarıyla uyumludur (reopen, revizyon zaten var).
Geçiş `setStatus` üzerinden yapılır → Slack `reflectChange` otomatik bildirir.

## Kurallar

1. **Tek aktif / kişi:** yeni bir iş başa alınınca, kişinin önceki aktif işi **beklemede**ye
   çekilir — ANCAK o brief'te başka bir atanan hâlâ onu aktif yapıyorsa brief `basladi` kalır
   (beklemeye yalnız hiç aktif kişi kalmayınca düşer).
2. **Diğer satırlar** kendi `durum`'larını korur; yalnız kuyruk sırası gösterilir.
3. **Otomatik ilerleme:** bir kişinin aktif işi **tamamlandi** veya **musteride** olunca
   kuyruktan düşer; o kişinin sıradaki kuyruğa-uygun işi otomatik aktive edilir (yukarıdaki
   geçiş tablosuna göre; tipik olarak `basladi`).
4. **Çok kişi:** brief, atananlardan en az biri aktif yaptığı sürece `basladi` (Kanban'da görünür).

## Yetki

- **Yönetici/admin:** herhangi bir kişinin kuyruğunu sıralayabilir (yine yalnız o kişinin
  worker-işleri).
- **Kişinin kendisi:** kendi profilinde, yalnız `contributor` olduğu işler.
- **Lead / gözlemci** rolündeki satırlar herkes için **salt-okunur** (sürükleme kapalı).
- Aktör yetkisi (admin/yönetici VEYA kişinin kendisi) + işteki rol (`contributor` olmalı)
  birlikte kontrol edilir. Sunucu da bu yetkiyi doğrular (yalnız UI değil).

## Mimari

### Backend
- Migration `0005_brief_assignees_kisi_sira.sql`: `ALTER TABLE brief_assignees ADD COLUMN kisi_sira int;`
- Yeni endpoint: `POST /api/users/:uid/queue` (writeGuard/authGuard) body `{ order: [briefId, ...] }`.
  - Yetki: `req.user.id === uid` VEYA `req.user.role === 'admin'`/yönetici.
  - Yalnız `uid`'in `contributor` olduğu brief'lerde `kisi_sira` güncellenir (sıra = order index).
  - Sonra etkilenen brief'lerin durumunu yeniden hesaplar: yeni kuyruk başı → aktive
    (geçiş tablosu, `setStatus` ile); önceki aktif → beklemede (çok-kişi kuralı korunur).
  - Tüm durum yazımları `source: 'dashboard'` → `reflectChange` Slack'e yansıtır.
- Otomatik ilerleme: `setStatus` içinde, bir brief `tamamlandi`/`musteride` olunca, o brief'i
  aktif işi yapan her contributor için sıradaki kuyruk işini aktive eden yardımcı çağrılır
  (echo/sonsuz-döngü koruması: bu iç geçişler `source:'system'`).

### Frontend (Profil)
- "Aktif işler" görünümünde (worker-işleri) satır sürükle-sırala (masaüstü; mobilde kapalı).
  Lead/gözlemci satırları sürüklenemez (görsel olarak kilitli).
- En üstteki (aktif) iş vurgulanır (ör. "● şu an" rozeti).
- Sürükle-bırak sonrası `POST /api/users/:uid/queue` çağrılır; optimistic sıralama + sonra poll.

### Kanban / Slack (değişmez)
- Kanban brief `durum`'unu gösterir → `basladi`/`beklemede`/`revizyon` otomatik yansır.
- Slack bildirimleri mevcut `setStatus → reflectChange` üzerinden (yeni Slack kodu yok).

## Kenar durumlar

- Worker olmayan (lead/gözlemci) satır sürüklenmeye çalışılırsa → engellenir (UI + sunucu).
- Kuyruğa-uygun olmayan (tamamlandi/musteride) işler kuyrukta görünmez; müşteriden revizyonla
  dönen iş yeniden kuyruğa girer (kisi_sira yoksa sona).
- `kisi_sira` ilk kez yoksa: kuyruk varsayılan sırası = mevcut liste sırası (deadline/no);
  ilk sürüklemede somutlaşır.
- Çok-kişili brief: bir contributor başka işe geçince brief, başka aktif contributor varsa
  `basladi` kalır.

## Kapsam dışı (YAGNI)

- Kolon-içi olmayan global iş sıralaması, takım geneli kuyruk panosu.
- Mobil dokunmatik sürükleme.
- Lead/gözlemci işleri için kuyruk/otomatik statü.
- Kişi-bazlı statü kolonu (model gereği brief tek-durum kalır).

## Test

- Backend birim/entegrasyon: queue endpoint yetki (self/admin, worker-only); geçiş tablosu
  (yeni→basladi, musteride→revizyon, tamamlandi→reopen→basladi); tek-aktif demote + çok-kişi
  koruması (başka aktif varsa basladi kalır); otomatik ilerleme (tamamlandi/musteride → sıradaki
  basladi).
- `consistency-check`: `basladi`/`beklemede` türetiminin aktif sayımlarla tutarlılığı.
- Frontend: CI parse + canlı/preview manuel (sürükle → statü + Slack notu; lead/gözlemci kilitli).
