# Tek Aktif İş — kişi başına WIP=1 (Tasarım)

**Tarih:** 2026-07-10 · **Kararlar (Görkem):** çalışma = 'basladi' · revizyon otomatik çalışma SAYILMAZ (kişi 🚀 ile yeniden girer) · Slack'te butonlu onay kartı (geçiş bekletilir) · dashboard'da onay penceresi · çok kişili işte kural yalnız tetikleyene · paralel akışta aynı işte eş zamanlı çalışma serbest · profilde kişi-bazlı "sen: beklemede" rozeti.

## Kural
Bir kişi aynı anda en fazla 1 işte FİİLEN çalışabilir. Fiilî çalışma kişi-bazlı izlenir: `brief_assignees.calisiyor boolean` (migration 0021; kişi başına birden çok brief'te true OLAMAZ — uygulama garantisi, kısıt yok).

## Kişi-bazlı 🚀 anlambilimi
- 🚀 (reaction/kelime/dashboard'dan basladi geçişi) = koyan kişi (işin atananı ise) o işin AKTİF ÇALIŞANI olur (calisiyor=true).
- İş zaten 'basladi' iken başka bir atananın 🚀'si → durum DEĞİŞMEZ, yalnız o kişinin calisiyor işareti açılır ("ben de başladım"). Bugün no-op olan reaction anlam kazanır.
- İş kişinin elinden çıkınca (incelemede/musteride/beklemede/blokeli/tamamlandi durumuna geçiş) → o işteki TÜM calisiyor işaretleri kapanır. Revizyon'a dönüş de kapatır (kişi 🚀 ile yeniden girer); revizyon thread notuna "çalışmaya başlarken 🚀 koy" ipucu eklenir.
- Tetikleyen atanan değilse (yönetici başlatıyorsa): işin İLK worker'ı aktif çalışan sayılmaz — kimseye calisiyor açılmaz, iş durumu değişir (kişiler kendi 🚀'siyle girer). Tek worker'lı işte kolaylık: tek worker'a otomatik açılır (kapıdan geçerek).

## Tek-iş kapısı (sunucuda; kaynak fark etmez)
`baslat(briefId, kisi)` çekirdeği: kişinin calisiyor=true olduğu BAŞKA brief var mı?
- YOK → uygula: bu briefte calisiyor=true (+ iş 'basladi' değilse durum geçişi).
- VAR → `{cakisma: {no, baslik, marka}}` döner; uygulanmaz. Çağıran onay akışını yürütür:
  - **Slack:** bot thread'e onay kartı — "⚠️ #X şu an çalıştığın iş — buna başlarsan #X beklemeye alınacak [✅ Onayla] [✖ Vazgeç]" (yalnız tetikleyen tıklayabilir). Onay → tek işlemde: eski işte kişinin işareti kapanır; eski işte BAŞKA calisiyor yoksa iş 'beklemede'ye alınır (Ody imzalı not: "🤖 Ody: {ad} #Y'ye başladığı için beklemeye alındı"); başka aktif çalışan varsa eski işin durumu DEĞİŞMEZ (yalnız kişi ayrılır). Yeni iş basladi + calisiyor.
  - **Dashboard:** aynı çekirdek; API 409 + cakisma döner → UI onay penceresi → onaylı çağrı (`zorla:true`).
- **Otomatik kuyruk ilerlemesi (system):** kişinin aktif işi varsa otomatik BAŞLATMAZ; iş 'calisiliyor'da (planda) bırakılır + kişiye DM: "sıradaki işin hazır; başlamak için 🚀". Çakışma yoksa mevcut davranış (Ody imzalı otomatik başlatma) sürer ve calisiyor açılır.

## Görünürlük
- İşin durumu her yerde brief-seviyesi kalır (paralel işte biri çalışıyorsa 'basladi' görünür).
- **Profil sayfası:** kişinin satırındaki 'basladi' işte kişi calisiyor DEĞİLSE rozet: "çalışılıyor · sen: beklemede".
- Embedded: workers dizisine `calisiyor` alanı eklenir (queries.js json_build_object).

## Süre motoru etkisi
Paralellik imkânsızlaşınca bnsNetIsSaati gerçek eforu ölçer; ayrıca doğruluk artışı için V2'de net saat kişi-oturumlarından (calisiyor aç/kapa olayları) hesaplanabilir — bu fazda durum_olaylari tabanlı hesap DEĞİŞMEZ (kapsam dışı).

## Geçiş
Mevcut çoklu-basladi veriye dokunulmaz; kural yeni geçişlerde işler. Migration'da mevcut 'basladi' işlerin TEK worker'lılarına calisiyor=true backfill edilir (çok worker'lılara edilmez — kim çalışıyor bilinmiyor).

## Kapsam dışı
Kapasite formülü değişmez · oturum-tabanlı süre ölçümü (V2) · incelemede/revizyon durum akışlarında başka değişiklik yok.

## Test
Kapı çekirdeği birim testleri (çakışma yok/var; çok kişili aynı iş serbest; eski işte başka aktif varken durum korunur; system kuyruğu çakışmada başlatmaz). Canlı smoke: test işleriyle onay kartı + profil rozeti.
