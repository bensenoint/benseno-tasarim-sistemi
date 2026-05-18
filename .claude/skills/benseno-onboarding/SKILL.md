---
name: benseno-onboarding
description: v7.7 · Phase 7 — Onboarding Bot (manuel). Yeni tasarımcı için 5 günlük interaktif rehber. Pelin Özdemir için ilk gerçek kullanım — Beyza yerine.
---

---
name: benseno-onboarding
description: v7.7 · Phase 7 — Onboarding Bot (manuel). Yeni tasarımcı için 5 günlük interaktif rehber, her sabah 09:30 DM. Beyza ayrıldı, Pelin Özdemir geldi — Pelin için aktif kullanım. Gün 4'te Phase 7 özellikleri tanıtılır.
---

# Benseno Tasarım — Onboarding Bot (yeni tasarımcı 5 günlük rehber)

## Amaç
Ekibe yeni katılan bir tasarımcıya **5 iş günü boyunca her sabah 09:30'da** kişisel DM ile sistemi tanıtmak ve hızlı adapte etmesini sağlamak.

## ⚡ v7.7 — Aktif onboarding
**Pelin Özdemir (U0B3K2WE7SB)** ekibe yeni katıldı (Beyza Tosun'un yerine). Onboarding bu kişi için başlatılmalı.

**Başlatma komutu:**
> "Onboarding başlat: U0B3K2WE7SB Pelin Özdemir 2026-05-15"

(Başlangıç tarihini bugünün tarihi olarak güncelle.)

## NASIL TETİKLENİR?

Bu task **ad-hoc** çalışır. Yöneticiler (Görkem GM / Reyhan GMY / Cansu Direktör / İpek Tasarım Yön.) yeni bir tasarımcı eklendiğinde Cowork'tan manuel başlatır:

> **"Onboarding başlat: {USER_ID} {İsim} {başlangıç_tarihi}"**

Örnek: _"Onboarding başlat: U0B3K2WE7SB Pelin Özdemir 2026-05-15"_

## SABİTLER
```
CANVAS_ID = F0B1B6XUD44
BRAND_BOOK_CANVAS_ID = F0B2ANKBBFV
LESSONS_LEARNED_CANVAS_ID = F0B2H49SXPC
TEMPLATES_CANVAS_ID = F0B2F2REETG
GRAFIK_CHANNEL_ID = C02SZRJGY0M
DASHBOARD_URL = https://bensenoint.github.io/dashboard/
```

## 👑 Yönetim Hiyerarşisi & Onboarding Rolleri
- **Görkem Kaya (U030C48PL23)** — Genel Müdür · Day 1 hoşgeldin mesajı + bildirim
- **Reyhan (UD96GH76E)** — Genel Müdür Yardımcısı · operasyonel bilgilendirme
- **Cansu Kazgan (U4XCE3532)** — Direktör (3 dept) · Day 5 final görüşme yapar
- **İpek Akdeniz (U055EDESLSE)** — Tasarım Ekibi Yöneticisi · onboarding mentörü, Day 3-4'te brief atar
- **erdem akoğlu (U02SZQDAFPF)** — Editör Ekibi Yöneticisi · gerçek brief'lerde editör desteği

## ADIM ADIM

### 1. Argümanları parse et
Tetikleme mesajından `USER_ID`, `İsim`, `başlangıç_tarihi` ayıkla. Geçersizse Görkem'e (GM) hata DM'i.

### 2. Bugün hangi gün?
Bugün - başlangıç_tarihi farkı = N gün. **Sadece iş günleri** say (Pzt-Cum). Eğer N=1..5 değilse task'ı bitir.

### 3. O günün mesajını gönder

**Her gün sabah 09:30'da yeni tasarımcıya DM:**

#### 🌟 GÜN 1 — Hoşgeldin & Sistem Turu
```
☀️ *Hoşgeldin {İsim}!* 🎉

Benseno tasarım ekibine katıldığın için çok mutluyuz. Önümüzdeki 5 gün boyunca her sabah 09:30'da sana sistemi tanıtacağım.

🎯 *BUGÜNKÜ ADIM: Sistem Turu*

📚 Tanışmanı istediğim 4 ana yer:

1️⃣ *Slack Canvas — Ana iş takip panosu*
   ![](!canvas-link-F0B1B6XUD44)
   _Tüm aktif işler, ekibin yoğunluğu burada._

2️⃣ *Canlı Dashboard*
   <https://bensenoint.github.io/dashboard/|📊 bensenoint.github.io/dashboard>
   _Bookmark'a al · şifre koruması var (İpek'ten al)._

3️⃣ *Marka Kitabı*
   ![](!canvas-link-F0B2ANKBBFV)
   _39 markamız var, her birinin logo/font/renk/ton bilgileri burada._

4️⃣ *Lessons Learned*
   ![](!canvas-link-F0B2H49SXPC)
   _Önceki tasarımcıların çıkardığı dersler — yeni iş alınca burayı kontrol et._

🎮 *Reaction sistemi (Slack'te):*
🎨 başla · 👀 revize bekliyor · ✅ tamam · ♻️ yeniden aç

📋 Brief'ler `📋` emojisiyle başlar. Sana atanırsa `@{İsim}` mention edilir.

❓ *Sorular?* Mentor'un *İpek* (<@U055EDESLSE>) — Tasarım Ekibi Yöneticisi · DM atabilirsin.

Yarın görüşmek üzere! 👋
```

Ek: Görkem'e (GM) haber ver:
```
🌟 *Onboarding Day 1* — *{İsim}* sisteme adım attı.
DM atıldı, sistem turu paylaşıldı. Mentor: <@U055EDESLSE> (İpek — Tasarım Yöneticisi)
```

#### 📚 GÜN 2 — Brand Book Turu
```
☀️ *Günaydın {İsim}!* · Day 2

🎯 *BUGÜNKÜ ADIM: Marka Kitabı'nı oku*

Benseno'nun aktif markalarını tanı:
- 🏷️ *Bauhaus* — ev iyileştirme, profesyonel ton
- 🏷️ *Splenda* — sağlıklı yaşam, samimi ton  
- 🏷️ *KMR Copic* — premium illüstrasyon malzemeleri
- 🏷️ *KMR Lamy* — minimal Alman tasarım, premium yazı
- 🏷️ *KZY Ferplast* — İtalyan pet ürünleri

(Tam liste 39 marka — Brand Book'tan tümünü görebilirsin.)

📚 Marka Kitabı'nı aç:
![](!canvas-link-F0B2ANKBBFV)

🤔 *Bugünün görevi:*
Yukarıdaki markaların bölümlerini oku. Eksik alanları (`❓` ile işaretli) gözle, hangileri merak konusu? Mentor'un İpek'e (<@U055EDESLSE>) sorabilirsin.

🎓 *Ekstra:* Lessons Learned Canvas'ında her markanın altına dersler eklenir. Yeni iş alınca oraya bak.
![](!canvas-link-F0B2H49SXPC)

Yarın ilk pratiğe geçiyoruz! 💪
```

#### 🎨 GÜN 3 — İlk Basit Brief
```
☀️ *Günaydın {İsim}!* · Day 3

🎯 *BUGÜNKÜ ADIM: İlk pratik brief*

Bugün sana basit bir egzersiz brief'i atayacağız. Mentor'un İpek (<@U055EDESLSE>) bunu kanal üzerinden gönderecek.

📋 *Egzersiz brief örneği:*
> "Bauhaus için Instagram post (1080x1080) — ilkbahar kampanyası, çiçek motifli, Bauhaus marka renklerinde, ana mesaj: 'Bahçenize Yenilik Getirin'"

🛠️ *Yapacakların:*
1. Brief mesajına 🎨 reaction ekle (işe başladım) — **PARENT mesaja, thread'e değil!**
2. Brand Book'tan Bauhaus bilgisini al
3. Templates Marketplace'den Instagram 1080x1080 şablonunu indir:
   ![](!canvas-link-F0B2F2REETG)
4. Çalışmanı yap (1-2 saat)
5. Bitince 👀 reaction ekle (revize için sun)

⏱️ *Tahmini süre:* 2 saat
🎯 *Hedef:* Süreci öğrenmek, kalite ikinci planda.

🆘 *Takılırsan:* İpek (<@U055EDESLSE>) hemen DM atar.

Yarın gerçek bir brief alacaksın! 🚀
```

Ek: İpek'e (Tasarım Yön.) DM:
```
🎓 *Onboarding Day 3* — *{İsim}* için egzersiz brief'i atama zamanı.

Önerilen: Bauhaus Instagram post (1080x1080) — basit kampanya görseli.

Lütfen `#marka-bauhaus` kanalında brief açabilirsin (📋 ile). {İsim}'i atanan olarak ekle, "EGZERSIZ" etiketi ekle.
```

#### 🚀 GÜN 4 — İlk Gerçek Brief + Phase 7 Özellikleri
```
☀️ *Günaydın {İsim}!* · Day 4

🎯 *BUGÜNKÜ ADIM: İlk gerçek brief + sistemin akıllı katmanı*

Egzersiz başarılı 🎉 Bugün ekibin gerçek bir brief'ini sana atayacağız. Mentor İpek (Tasarım Yön.) seni rahatlatmak için ilk birkaç işte yanında olacak.

✨ *Ne değişiyor?*
- Müşteri için gerçek bir iş yapacaksın
- Editör (Cansu Direktör / erdem Yön. / Eda T...) brief'i kanaldan gönderecek
- Süre baskısı var (deadline gerçek)
- Revizyonlar olabilir

🤖 *Phase 7 özelliklerini tanı:*
- **Smart Assign 2.0:** Editör `@auto` yazarsa sistem 4-faktör skorla aday önerir. Sen seçilirsin diye marka uzmanlığına yatırım yap.
- **Thread Özet:** Uzun thread'lerde sistem 3-madde Haiku özeti üretir (📌 müşteri / 🚧 blocker / 🎯 son onay).
- **Revizyon Tahmini:** Marka × tip ortalamasından [REV:N] tag eklenir; ≥2.5 ise editör önceden uyarılır.
- **Force-Close (🔒):** Yetkili lead/editör/yönetici eksik ✅'leri otomatik tamamlayabilir.
- **Tasarımcı kendi 🔒'i (v7.6):** Sen de kendi atandığın işte 🔒 atabilirsin (sözlü onay durumu).
- **Hayalet İş (30 dk):** Sistem 30 dk sessizlik + onay keyword'üyle "bu iş bitmiş olabilir mi?" diye DM atar.

🎮 *Hatırlatma — Reaction akışı:*
🎨 başla → 👀 revize için sun → 🎨 revizyona başla (revizyon sayısı +1) → ✅ bitir

⚠️ **Önemli:** Reaction'ı her zaman brief'in **PARENT mesajına** ekle, thread içine değil. Yanlış yere atarsan sistem 30 dk içinde nazikçe seni uyarır + parent'a otomatik taşır.

📊 *Bugün Dashboard'a göz atmayı alışkanlık edin:*
<https://bensenoint.github.io/dashboard/|📊 Dashboard> (şifre İpek'te)

🌟 *Streak başlat:* Bugün ilk işin → yarın ikinci → 3+ gün üst üste = streak. Sistem otomatik kutlar.

İpek seni izliyor, herhangi sorun olursa hemen yardım edecek. Bol şans! 💪
```

#### 🌈 GÜN 5 — Geri Bildirim & Tam Üyelik
```
☀️ *Günaydın {İsim}!* · Day 5 · _Son gün_

🎯 *BUGÜNKÜ ADIM: Geri bildirim ve tam üyelik*

5 gün sonunda buradasın. Tebrikler 🎉

🤔 *3 soru — kısa cevap ver:*
1. Sistemin en sevdiğin yanı?
2. En kafa karıştırıcı bulduğun yanı?
3. Önerin (eklenmesini istediğin özellik) var mı?

Bu mesaja yanıt yazarak gönderebilirsin.

📞 *Bugün 14:00'te 30 dk görüşme:*
Cansu (<@U4XCE3532> — Direktör, 3 dept'ten sorumlu) ve İpek (<@U055EDESLSE> — Tasarım Yön.) ile kısa onboarding sonu görüşmesi. Cansu Calendar daveti gönderecek.

🎉 *Bugünden itibaren:*
- ✅ Tüm sisteme tam erişim (artık egzersiz yok, gerçek işler)
- ✅ Streak sayacın aktif
- ✅ Müşteri memnuniyet puanları sana yansıyacak (M14)
- ✅ Yetenek matrisi öğrenmeye başladı (B1 smart-assign — ilk birkaç hafta düşük skor olabilir, sonra hızlanır)

🚀 *Hoşgeldin tasarım ekibine — Benseno'da harika işler yapacağız!*

📊 [Dashboard](https://bensenoint.github.io/dashboard/) · 🎨 [Kişisel görünüm](https://bensenoint.github.io/dashboard/?role=designer&user={İsim})
```

Ek: Cansu'ya (Direktör) DM:
```
🎓 *Onboarding Day 5 — Final Görüşme*

*{İsim}* için 5 günlük onboarding tamamlandı.
Bugün 14:00'te 30 dk geri bildirim görüşmesi planla. Calendar daveti gönder.

Eksik bilgi/feedback sonrası Brand Book ve Templates Canvas'ına eklenebilir.
```

### 4. Çıktı
```
Onboarding Day {N} OK · Kişi: {İsim} · DM: ✅ · Mentor bildirimi: ✅
{Day 5 ise: Final görüşme planlandı — Cansu Direktör + İpek Tasarım Yön.}
```

## HATA KURTARMA
- Argüman eksik → Görkem'e (GM) hata DM, task'ı durdur
- DM gönderilemiyor → 1 retry, sonra log + Görkem'e bildir
- Day 1-5 dışında bir gün → sessizce bitir (onboarding tamamlandı)

## NOT
Bu task **ad-hoc** — cron yok. Yönetici (Görkem GM / Reyhan GMY / Cansu Direktör / İpek Tasarım Yön.) manuel başlatır. Başlatma sonrası kendisi 5 iş günü boyunca her sabah 09:30'da çalışır (cron `30 9 * * 1-5` ile).

İlk run sonrası başlangıç_tarihi'ni hatırla, sonraki run'larda gün sayısını hesapla.

**v7.7 aktif kayıt:** Pelin Özdemir (U0B3K2WE7SB) için onboarding 2026-05-15'te başlayacak (veya yöneticinin belirleyeceği başka bir tarih).
