# Zamana Yayılmış Kapasite Modeli (Tasarım)

**Tarih:** 2026-07-08
**Faz:** Kapasite v2 (P3.5). Mevcut düz rol-ağırlıklı modelin yerini alacak temel formül değişimi.
**Karar sahibi:** Görkem — kurallar bu tasarımda birebir onun tarifidir.

---

## Amaç

Kapasite, süreden bağımsız düz sayaç olmaktan çıkar ("işte worker'san 5 birim"), **zamana yayılmış** hâle gelir: işin değeri başlangıç→teslim penceresine bölünür, güne düşen pay hesaplanır. Kapasite bir **zaman serisi** olur — "bugün %90, Perşembe %140" görünür; geçmiş aralık soruları o günlerin toplamıyla cevaplanır.

## Çekirdek model

**İş değeri `V`:** rol ağırlığı (worker **5**, lead **1** — canlıdaki güncel değerler, gözlemci 0; kişinin en yüksek rolü).
**Kalan değer `R`:** başlangıçta `R = V`; yalnız **çalışılan günlerde** tüketilir.

**Bir günün payı:**
```
pay(gün) = R(gün) / o günden deadline'a kalan iş günü
```

**R'nin akışı (durum kuralları):**

| Durum sınıfı | Durumlar | O güne pay biner mi? | R eksilir mi? |
|---|---|---|---|
| **Başlanmamış** | `yeni`, `calisiliyor` (iş planında) | **Evet** | **Hayır** (R tam kalır → gün geçtikçe pay BÜYÜR: 5/5=1 → ertesi gün 5/4=1.25) |
| **Çalışılan** | `basladi`, `revizyon`, **`incelemede`** (iş durmuyorsa çalışılıyordur — Görkem kararı) | **Evet** | **Evet**: `R -= pay` (düzenli çalışmada pay sabit akar) |
| **Duran** | `beklemede`, `musteride`, `blokeli` | **Hayır** | **Hayır** (R korunur; dönüşte kalan gün azaldığından pay yükselir — bekleme telafisi mevcut "termini uzat (muaf)" ile dengelenir) |
| **Bitti** | `tamamlandi` | Hayır | — |

**Overdue:** deadline geçtiyse `kalan iş günü = 1` sabitlenir → **tüm kalan değer her gün bugüne biner** (geciken iş günü ezer — istenen sinyal).

## Gün ve kapasite tanımı

- **İş günü:** hafta içi, Europe/Istanbul (Cmt/Paz bölene ve pay gününe girmez — hareketsizlik hesabıyla aynı ilke).
- **Günlük kişi kapasitesi:** mevcut limitler birim/gün olarak yeniden yorumlanır: yönetici **10**, editör **8**, tasarım/AI/freelance **6** birim/gün; yarı-zamanlı faktör aynen (`bnsCapFactor`).
- **Doluluk:**
```
gün doluluk %   = Σ pay(o gün, kişinin işleri) / günlük kapasite
aralık doluluk % = Σ pay(aralıktaki tüm günler) / (günlük kapasite × aralıktaki iş günü)
```
(Not: doluluk %100'ü AŞABİLİR ve aşmalı — aşırı yük tam da görünmek istenen şey. Mevcut min(100,…) kırpması bu modelde yok.)

## Kurallar

1. **Deadline zorunlu:** Brief oluşturmada deadline'sız kayıt reddedilir (Slack modal + `/api/briefs` validasyonu). **Mevcut deadline'sız işler:** tek seferlik `açılış + 5 iş günü` varsayılanı atanır + yöneticiye "elle düzelt" listesi DM'lenir.
2. **Geçmiş tarihli giriş:** İş geçmiş bir başlangıç tarihiyle girilirse paylar o tarihten itibaren **retroaktif** işler — tarihsel görünümler (tarihe-duyarlı ekranlar) o günlerde iş sistemdeymiş gibi hesaplar. Hesap event-tabanlı (durum olayları `durum_olaylari` + `created_at`/`deadline`) olduğundan her bakışta yeniden türetilir; ek tablo gerekmez.
3. **R'nin türetilmesi:** R saklanmaz; her hesap anında işin durum olayları üzerinden gün gün simüle edilir (deterministik, saf fonksiyon — CI'da kilitlenebilir). Girdi: `created_at`, `deadline`, `durum_olaylari[{ts,durum}]`, rol ağırlığı.

## Yüzeyler (kademeli geçiş)

| Aşama | Yüzey | Değişim |
|---|---|---|
| 1 | **calc çekirdeği** | `bnsGunlukPay(b, u, günMs)` + `bnsKisiGunDoluluk(briefs, u, günMs)` + `bnsKisiAralikDoluluk(briefs, u, basMs, bitMs)` — saf, testli |
| 2 | **Kişi kapasite kartları** (Profil, Departman, Ekip matrisi) | Yeni % + 5-günlük mini projeksiyon şeridi; eski düz % bir süre yanında ("eski model" etiketiyle) — güven kalibrasyonu |
| 3 | **Departman/firma kapasitesi** | Kişi doluluklarının toplamından (aynı çekirdek) |
| 4 | **Firma-sinyal kapasite eşiği + burnout** | Firma sinyali yeni gün-doluluğuna geçer; **burnout projeksiyonu bu modelin özel hali olduğundan emekli edilir** (sinyal "gelecek 5 günde ≥%120 gün var mı"ya dönüşür — aynı eşik, daha doğru taban) |

## Test (formula-test)

- Başlanmamış iş: 5 gün→pay 1.0; 1 gün geçince (başlanmadı) pay 1.25 (R sabit, kalan gün 4).
- Çalışılan iş: gün gün R tüketimi → düzenli çalışmada pay sabit; 2 gün çalışıp beklemeye giren işte R korunur, dönüşte pay yükselir.
- `incelemede` çalışılan sayılır (pay + tüketim).
- beklemede/müşteride/blokeli günlerine pay binmez.
- Overdue: kalan değerin tamamı bugüne biner.
- Hafta sonu: bölene ve pay gününe girmez (Cuma→Pzt sınır testi).
- Aralık doluluk: 2 işli sentetik hafta senaryosu, elle hesaplanan beklenen %.
- Retroaktif: geçmiş `created_at`'li iş, geçmiş gün sorgusunda pay üretir.

## Kapsam dışı

- `tahmini_sure_h` entegrasyonu (V hâlâ rol ağırlığı; saat-bazlı değer ayrı bir evrim).
- Eski modelin tamamen silinmesi — Aşama 2-4 canlıda doğrulanana dek yan yana yaşar; söküm ayrı iş.
- Tatil takvimi (resmî tatiller) bölene dahil değil — v1'de yalnız hafta sonu; tatiller sonra eklenebilir.

## Başarı ölçütü

Çekirdek testleri geçer; kişi kartında yeni % + 5-gün şeridi canlı; "bugün vs Perşembe" farkı gerçek veride görünür; firma-sinyal/burnout yeni tabana geçmiş; deadline'sız iş girişi imkânsız.
