# BENSENO TASARIM SİSTEMİ — KULLANICI KILAVUZU
## Claude Design Sunum Brief'i

---

## SUNUM HAKKINDA GENEL BİLGİ

**Sunum adı:** Benseno Tasarım Sistemi — Kullanıcı Kılavuzu  
**Hedef kitle:** Benseno ekibi (16 kişi) — tasarımcılar, editörler, AI ekibi ve yöneticiler  
**Amaç:** Ekip üyelerinin sistemi bağımsız kullanabilmesi için adım adım kılavuz  
**Format:** Sunum (slide deck) — basılabilir veya Slack'te paylaşılabilir  
**Ton:** Profesyonel ama samimi, Türkçe, kısa cümleler  
**Marka renkleri:** Siyah + Amber/Altın ton (#E8A045) + Koyu zemin  
**Logo:** "benseno" wordmark (küçük harf, minimal)  

---

## SLIDE 1 — KAPAK

**Başlık:** Benseno Tasarım Sistemi  
**Alt başlık:** Nasıl Çalışır? Ekip Kılavuzu  
**Versiyon:** v7.13 · Mayıs 2026  
**Görsel öneri:** Karanlık zemin üzerinde Slack + takvim + dashboard ikonları birbirine bağlı bir akış şeması

---

## SLIDE 2 — SİSTEM NEDİR? (1 dakikada özet)

**Başlık:** Sistem Ne İşe Yarar?

**3 Ana Soruya Cevap Verir:**

🎯 **"Bu brief kimde, ne durumda?"**  
→ Slack Canvas'ta anlık görürsün

📊 **"Ekip iş yükü nasıl dağılıyor?"**  
→ Dashboard'da grafik olarak görürsün

📬 **"Yeni iş aldım, ne yapmalıyım?"**  
→ DM gelir, takvime düşer, zaten bilirsin

**Alt metin:** "Hiçbir manuel takip yok. Sadece brief'i aç ve reaction'larla ilerlet."

**Görsel öneri:** Üç ikon yan yana — Canvas logosu, grafik çubuk, zil

---

## SLIDE 3 — KİM NE YAPAR? (Roller)

**Başlık:** Rollere Göre Sistem Kullanımı

| Rol | Sistemde Ne Yapar |
|---|---|
| ✍️ **Editör** | Brief açar (Slack form), durumu takip eder |
| 🎨 **Tasarımcı** | Reaction koyarak iş durumunu günceller |
| 🤖 **AI Ekibi** | Brief açar, reaction ile ilerletir |
| 👔 **Yönetici** | Sabah raporunu okur, öncelik override'ı koyar |

**3 Departman:**
- 🎨 Tasarım (7 kişi): Aylin, Aykut, Hasan Serdar, Pelin, İpek, İrem, Serhat
- ✍️ Editör (8 kişi): Cansu, Erdem, Eda T, Eda A, Melis, Aylin C, Buse, Simge
- 🤖 AI (1 kişi): Eren

---

## SLIDE 4 — BRİEF AÇMAK (Editörler için)

**Başlık:** Brief Nasıl Açılır?

**Adım 1:** İlgili marka kanalına git  
*(Örnek: #marka-bauhaus, #marka-jnj, #marka-egosport)*

**Adım 2:** Kanal bookmarkında 📋 Yeni Brief Aç'a tıkla

**Adım 3:** Formu doldur (7 alan):

```
🎀 İş:        Bahar kampanyası 3 IG post
⏰ Deadline:  21 Mayıs 17:00
👷 Atanan:    @Aylin, @Hasan
🏷️ Tip:       Sosyal Medya Post
🔄 Akış:      Paralel
🔗 Referans:  (Drive linki)
💬 Not:       Detaylar mail'de
```

**Adım 4:** Gönder — sistem otomatik devralır ✅

**Önemli not:** Departman emoji'si (📋/✍️/🤖) ile başlayan mesajlar sistem tarafından brief olarak tanınır.

**Görsel öneri:** Ekran görüntüsü mockup'ı — Slack form alanları dolu hâlde

---

## SLIDE 5 — OTOMATIK ATAMA (Smart Assign)

**Başlık:** "@auto" ile Akıllı Atama

Kimi atayacağını bilmiyorsan:

1. Atanan alanına **@auto** yaz
2. Sistem en az işi olan tasarımcıyı **otomatik atar**
3. Atanan kişiye DM gider, takvimine düşer

**Atama kuralları:**
- En az aktif brief → önce o
- Eşit iş yükünde → son tamamlama süresine göre
- Yönetici sonradan değiştirebilir

**Görsel öneri:** Soru işareti → sistem → kişi silüeti akışı

---

## SLIDE 6 — DURUM GÜNCELLEMEKİ (Tasarımcılar için)

**Başlık:** Reaction ile İş Durumunu Güncelle

Hiç mesaj yazmana gerek yok. Sadece brief mesajına **reaction** ekle:

| Reaction | Anlam | Canvas'ta |
|---|---|---|
| 🎨 | Tasarıma başladım | ⏳ Sırada → 🎨 Tasarımda |
| 👀 | Revize için gönderdim | 🎨 Tasarımda → 👀 Revizede |
| ✅ | Tamamlandı | Tamamlanan tablosuna taşınır |
| ⭐+sayı | Müşteri puanı (opsiyonel) | Memnuniyet skoru kaydedilir |
| 🎓 | Ders çıkardım | Lessons Learned Canvas'a yazılır |

**Nasıl çalışır?** Sistem her 15 dakikada bir (saat :15 ve :45'te) Slack'i tarar ve reaction değişikliklerini Canvas'a yansıtır.

**Görsel öneri:** Brief mesajı + sağ tarafta reaction emoji'leri sıralı, oklar Canvas güncellemesini gösteriyor

---

## SLIDE 7 — REVİZYON DÖNGÜSÜ

**Başlık:** Revizyon Döngüsü Nasıl İşler?

```
İş Başla → 🎨 ekle
    ↓
Müşteriye sun → 👀 ekle  
    ↓
Revize istedi → 🎨 ekle (tekrar)
    ↓
Tekrar sun → 👀 ekle
    ↓
Onaylandı → ✅ ekle
```

Her 👀 → 🎨 geçişi **otomatik revizyon sayacını** artırır.  
Dashboard'da revizyon sayısı marka bazında takip edilir.

**İpucu:** Bir brief'te birden fazla kişi varsa, hepsi ✅ verince tamamlanmış sayılır.

---

## SLIDE 8 — ÖNCELİK SİSTEMİ

**Başlık:** Öncelik Nasıl Hesaplanır?

Sistem deadline'a göre **otomatik** öncelik atar:

| Öncelik | Kural | Renk |
|---|---|---|
| 🔴 **Acil** | 8 saat veya geçmiş | Kırmızı |
| 🟠 **Yüksek** | 8–24 saat kaldı | Turuncu |
| 🟡 **Normal** | 24–72 saat kaldı | Sarı |
| 🟢 **Düşük** | 72 saatten fazla | Yeşil |

**Yöneticiler önceliği override edebilir:**  
Brief mesajına 🔴/🟠/🟡/🟢 reaction koy → sistem hemen günceller.  
*(En son yönetici override'ı geçerlidir)*

**Görsel öneri:** Zaman çizelgesi — sağdan sola kırmızıya koyulaşan gradient, emoji'ler üzerinde

---

## SLIDE 9 — SLACK CANVAS (Canlı Takip Panosu)

**Başlık:** Canvas — Her Şeyi Bir Yerde Gör

**Nerede?** #benseno-grafik kanalında sabitlenmiş Canvas

**İçeriği:**
1. **İş Yükü Tablosu** — Tasarım / Editör / AI ayrı ayrı, her kişinin aktif iş sayısı
2. **Aktif İşler** — Tüm açık brief'ler, önceliğe göre sıralı (13 sütun)
3. **Tamamlanan İşler** — Kapatılan brief'ler, süre ve puan ile birlikte

**Her 30 dakikada bir otomatik güncellenir.**  
(Saat :15 ve :45'te — hafta içi 08:00–17:30 arası)

**Sütunlar (Aktif İşler):**  
`# | Dept | Marka | İş | Atanan | Editör | Öncelik | Deadline | Süre | Durum | Rev | Geçmiş | Link`

**Görsel öneri:** Canvas ekran görüntüsü mockup'ı — tablo satırları, öncelik emoji'leri renkli

---

## SLIDE 10 — DASHBOARD (Analitik Panel)

**Başlık:** Dashboard — Derinlemesine Analiz

**Adres:** https://bensenoint.github.io/benseno-tasarim-sistemi/

**17 Sekme içerir:**

| Sekme | İçerik |
|---|---|
| 📊 Genel Bakış | KPI kartları, özet grafikler |
| 📋 İşler Listesi | Filtrelenebilir tablo, arama |
| 🃏 Kart Görünümü | Görsel brief kartları |
| 📅 Takvim | Aylık deadline görünümü |
| 📌 Kanban | Sütun bazlı iş akışı |
| 📈 Gantt | Zaman çizelgesi |
| 👥 Tasarım | Tasarım ekibi detay |
| ✍️ Editör | Editör ekibi detay |
| 🤖 AI | AI ekibi detay |
| 🏢 Marka | Marka bazlı performans |
| 🔥 Isı Haritası | Günlük yoğunluk görünümü |
| 📊 Marka Stats | Davranış öğrenme tablosu |
| ⚡ Yaklaşan | Deadline'ı yakın işler |
| ⚠️ Gecikmeli | Süresi geçmiş brief'ler |
| 📉 KPI Yönetim | Uyarı eşiklerini ayarla |
| 📜 Geçmiş | Timeline görünümü |
| 🔗 Çapraz Dept | Departmanlar arası karşılaştırma |

**Her brief sync'te otomatik güncellenir.**

**Görsel öneri:** Dashboard ekranından birkaç sekme mockup'ı, amber/koyu tema

---

## SLIDE 11 — SABAH RAPORU (Yöneticiler için)

**Başlık:** Her Sabah 07:50'de Ne Gelir?

**Yöneticilere DM olarak gelir:**

```
📊 Benseno Günlük Performans Raporu — 20 Mayıs 2026

Genel Durum:
• Aktif Brief: 12  |  Acil: 2  |  Gecikmeli: 0
• Bugün Deadline: 3 brief

Tasarım Ekibi (En yoğun → En az):
1. Aylin Tozkoparan — 3 aktif iş 🔴 1 acil
2. Hasan Serdar Arda — 2 aktif iş 🟡
3. Pelin Özdemir — 1 aktif iş 🟢

Dikkat Gerektiren:
⚠️ Bauhaus kampanyası — 4 saat kaldı, tasarım başlamadı
```

**Tüm ekibe:** 07:50'de #benseno-grafik'e kısa özet mesajı gönderilir.

**Görsel öneri:** Telefon DM ekranı mockup'ı — sabah güneşi ikonu

---

## SLIDE 12 — HAFTALIK VE AYLIK RAPORLAR

**Başlık:** Otomatik Raporlama Takvimi

**Her Cuma 17:00 — Haftalık Retrospektif:**
- Bu hafta tamamlanan brief sayısı
- Ortalama tamamlama süresi
- En çok revizyon isteyen marka
- Departman karşılaştırması
- Cansu Direktör'e özel özet DM

**Her Ay Sonu 17:00 — Aylık Strateji Raporu:**
- Aylık performans trendi
- Marka bazlı istatistikler
- Revizyon oranı yükselen markalar
- Kapasite önerileri
- 5 yöneticiye ayrı ayrı DM

**Tüm raporlar otomatik üretilir.** Kimse birşey yapmak zorunda değil.

---

## SLIDE 13 — YENİ ÜYELER (Onboarding)

**Başlık:** Yeni Ekip Üyesi Katılımı

Yeni biri katıldığında yönetici tek komut çalıştırır:

```
Skill: benseno-onboarding — başlat: [Slack ID] [İsim] [Başlangıç Tarihi]
```

**Sistem otomatik olarak:**
1. ✅ Slack kanallarına davet eder (39 marka kanalı dahil)
2. ✅ Hoşgeldin DM'i gönderir (kılavuz + Canvas linki)
3. ✅ Dashboard'a ekler
4. ✅ İlk haftayı gözlemci modunda tutar
5. ✅ Brief Sync'e dahil eder

**Örnek — Pelin Özdemir (15 Mayıs 2026):**  
Tüm bu adımlar 3 dakikada tamamlandı.

---

## SLIDE 14 — SIKÇA YAPILAN HATALAR

**Başlık:** Bunları Yapmayın ⚠️

❌ **Brief'i kanal dışında açmak**  
→ Sistem kanaldan markayı tanır. Yanlış kanalda açılan brief karışır.

❌ **Reaction yerine mesaj yazmak**  
→ "Başladım", "Bitti" yazmak işe yaramaz. Reaction şart.

❌ **Deadline'ı geçmişte vermek**  
→ Sistem ⚠️ GEÇMİŞ TARİH flag'i atar, yöneticiye uyarı gider.

❌ **Canvas'ı elle düzenlemek**  
→ Bir sonraki sync'te üzerine yazılır. Canvas salt-okunur gibi düşün.

❌ **Saat vermeden deadline yazmak**  
→ "21 Mayıs" değil, "21 Mayıs 17:00" — sistem saati de kullanır.

✅ **Doğru:** Form doldur → Reaction koy → Sistem halleder

---

## SLIDE 15 — MARKA DAVRANIŞI ÖĞRENMESİ (E3)

**Başlık:** Sistem Markalardan Öğreniyor

v7.13 ile gelen E3 özelliği:

**Ne yapar?**  
Her markanın geçmiş brief verilerini analiz eder ve yeni brief'ler için **deadline uyarısı** üretir.

**Örnek:**
```
📊 Bauhaus — Geçmiş 15 brief ortalama tamamlama: 18 saat
⚠️ Bu brief'in deadline'ı 12 saat — tarihsel ortalama aşılabilir!
```

**Şu an:** Haziran 2026'ya kadar sessiz modda çalışıyor (sadece log kaydeder, uyarı göndermez)  
**Haziran 2026'dan itibaren:** Uyarılar aktif hale gelecek

---

## SLIDE 16 — DASHBOARD ERİŞİMİ

**Başlık:** Dashboard'a Nasıl Giriş Yapılır?

**Adres:** https://bensenoint.github.io/benseno-tasarim-sistemi/

**Şifre:** *(yöneticinizden alın — SHA-256 hash ile korumalı)*

**Mobil uyumlu:** Telefonda da açılır, tüm sekmeler çalışır

**Güncelleme sıklığı:** Her 15-30 dakikada otomatik

**İpuçları:**
- `Cmd+K` (Mac) / `Ctrl+K` (Windows): Hızlı arama
- Sekmelerde filtre çipleri: Önceliğe, departmana, markaya göre filtrele
- Sağ üst: 🔔 bildirimler, 📋 kayıtlı görünümler

**Görsel öneri:** QR kodu dashboard URL'sine — "Telefonuna ekle" call-to-action

---

## SLIDE 17 — TEKNİK ALTYAPI (Bilgi amaçlı)

**Başlık:** Arka Planda Neler Oluyor?

Merak edenler için:

```
Slack Workflow Form
    ↓ (brief açılır)
Claude AI (Brief Sync — her :15/:45)
    ↓ tarar, parse eder, atar
Slack Canvas (F0B1B6XUD44)
    ↓ günceller
GitHub (bensenoint/benseno-tasarim-sistemi)
    ↓ push eder
GitHub Pages → Dashboard
    ↓
Sen görürsün ✅
```

**Entegrasyonlar:**
- 💬 Slack (Canvas, Kanallar, DM)
- 📅 Google Calendar (Görkem'in takvimi)
- 📧 Gmail (raporlar için)
- 🗂️ Google Drive (referans dosyaları)
- 🐙 GitHub (dashboard deploy)

**Çalışma saatleri:** Hafta içi 08:00–17:30 arası otomatik çalışır.  
Hafta sonu ve mesai dışı → sistem bekler.

---

## SLIDE 18 — HIZLI BAŞVURU KARTI

**Başlık:** Cebinizdeki Kılavuz

**Brief Açmak:**  
Marka kanalı → Bookmark → 📋 Yeni Brief Aç

**Durum Güncellemek:**  
🎨 Başladım · 👀 Revizede · ✅ Bitti

**Canvas Görmek:**  
#benseno-grafik → Canvas sekmesi

**Dashboard:**  
bensenoint.github.io/benseno-tasarim-sistemi

**Sorun mu var?**  
@Görkem veya @Cansu'ya DM at

---

## SLIDE 19 — TEŞEKKÜR / KAPANIŞ

**Başlık:** Sistem Sizin İçin Çalışıyor

**Ana mesaj:**  
"Karmaşık takip, manuel rapor, 'bu brief nerede?' sorusu yok.  
Siz iş yapın, sistem takip etsin."

**Versiyon:** v7.13  
**Geliştirici:** Görkem Kaya  
**Destek:** gorkem@benseno.com.tr  

---

## TASARIM YÖNERGELERİ (Claude Design için)

### Renk Paleti
- **Arka plan:** #0D0C0B (derin siyah)
- **Kart zemini:** #161412 (koyu kahve-siyah)
- **Ana vurgu:** #E8A045 (amber/altın)
- **Metin birincil:** #F0ECE4 (krem beyaz)
- **Metin ikincil:** #C8BFB5 (açık gri)
- **Muted:** #7A6F62 (koyu gri)
- **Kırmızı:** #E55C4A
- **Yeşil:** #5CB87A
- **Mavi:** #5B9CF6

### Tipografi
- **Başlıklar:** Syne (bold, geometric)
- **Veri/Kod:** JetBrains Mono
- **Gövde metin:** Inter

### Görsel Dil
- Koyu zemin üzerinde parlak amber vurgular
- İnce çizgi ayırıcılar (border: #2A2420)
- Emoji'ler büyük ve belirgin kullanılsın
- Tablolarda zebra şeritler (çok hafif)
- Akış diyagramları: oklar amber renkte
- İkon seti: minimal, çizgisel

### Slide Boyutu
16:9 (1920×1080) — ekran sunumu için ideal

### Sayfa Numaraları
Sağ alt köşede, amber renkle: "03 / 19" formatında

---

*Bu brief Claude Design'a aktarılmak üzere hazırlanmıştır.*  
*Benseno Tasarım Sistemi v7.13 — Mayıs 2026*
