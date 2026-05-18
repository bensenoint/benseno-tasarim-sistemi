---
name: benseno-gunluk-performans
description: v7.9 · Sabah Raporu (07:50 hafta içi). v7.13 Brief Sync ile uyumlu — "🚩 Tarihi Şüpheli Brief'ler" + "📊 Marka Hız Trendi" (E3) bölümleri. Cansu Direktör DM'sine marka hız trendi. Kanal mesajı + 5 yönetici DM + 16 kişi günaydın.
---

# Benseno — Sabah Raporu v7.9 (07:50 hafta içi)

## v7.9 değişiklik
- **"📊 Marka Hız Trendi" yeni bölüm:** marka_stats.json okunur, son hafta içinde ortalaması anormal değişen markalar (1× MAD/std üstü sapma) listelenir.
- **Cansu (Direktör 3 dept) DM'sine ek satır** — kalite skoru düşen marka × tip kontrolü ile birlikte hız trendi de.
- Mode kontrolü: `marka_stats.json.config.current_mode == "active"` ise tam bölüm görünür; `silent_log_only` ise sadece "📊 E3 sessiz mod — 1 Haziran'da aktif olur (şu an {N} markada veri toplanıyor)" notu.
- Çıktı log'una: `Marka hız trendi: aktivasyon={mode} izlenen_marka={N} sapan_marka={S}`

## v7.8 değişiklik
- **"🚩 Tarihi Şüpheli Brief'ler" yeni bölüm:** Brief Sync v7.12 ile uyumlu. Şu kategorideki brief'leri günlük raporlamada öne çıkarır:
  - Geçmiş tarih (`flag_past_deadline = true` AND `flag_past_deadline_confirmed = false`)
  - Aynı gün ama saat girilmemiş (`flag_saat_eksik = true`)
  - Mesai dışı deadline (`flag_after_hours = true` — yumuşak bilgi)
- **Kanal mesajına (ÇIKTI 1)** ve **5 yönetici DM'ine (ÇIKTI 2)** bu bölüm eklenir.
- **Çıktı log'una** yeni metrik satırı eklenir: `Tarihi Şüpheli: geçmiş={A} saat_eksik={B} mesai_dışı={C}`

## v7.7 değişiklik (önceki)
- **Ekip:** Beyza Tosun (U06J4L6AVHS) ekipten ayrıldı; yerine **Pelin Özdemir (U0B3K2WE7SB)** geldi.
- Tasarım ekibi yine 7 kişi. Pelin için ilk haftalarda Smart Assign marka uzmanlığı = 0 (zaman içinde birikecek).

## v7.6 değişiklikler (önceki)
- Cron 07:50 (Brief Sync 08:15'ten 25 dk önce, yarış durumu yok)
- Yönetici DM'lerine "Bugün senin için 3 aksiyon" bölümü
- Genişletilmiş OOO keyword
- Custom KPI 6 default
- Yöneticiler (Cansu/İpek/erdem) çift sayım açıklaması

Tek görev — 3 çıktı:
1. `#benseno-grafik` kanal mesajı
2. 5 yöneticiye **rolüne göre özelleştirilmiş + "bugün 3 aksiyon"** DM
3. 16 kişiye departmana göre günaydın DM

## SABİTLER
```
CANVAS_ID = F0B1B6XUD44
GRAFIK_CHANNEL_ID = C02SZRJGY0M
TZ = Europe/Istanbul (UTC+3)
PRIMARY_CALENDAR = gorkem@benseno.com.tr
DASHBOARD_URL = https://bensenoint.github.io/dashboard/
```

## 3 DEPARTMAN — 16 kişi

### 🎨 Tasarım (7) 
Aylin (U0AN6DD79M0), Aykut (U06J26R1XCJ), Hasan Serdar (U09BFPBKQG7), **Pelin Özdemir (U0B3K2WE7SB)** ⭐ yeni, **İpek 🎯 Tasarım Yön.** (U055EDESLSE), İrem (U0AK8U7L57F), Serhat (U08HLMHTGEL)

### ✍️ Editör (8)
**Cansu 👑 Direktör — 3 dept** (U4XCE3532), **erdem 🏅 Editör Yön.** (U02SZQDAFPF), Eda Tireli (U09BZHR25NG), Eda Ayral (U07PV0RA9L2), Melis (U08NQJ27G5S), Aylin Canel (U05PP70GQTX), Buse (U063T8M5HL4), Simge (U0AAC3YK20G)

### 🤖 AI Teknolojileri (1)
Eren Mahzunlar (U0AP31SAA1W)

### 👑 Yöneticiler (5)
1. Görkem (U030C48PL23) — Genel Müdür · şirket ortağı
2. Reyhan (UD96GH76E) — Genel Müdür Yardımcısı · şirket ortağı
3. Cansu (U4XCE3532) — Direktör (3 dept)
4. İpek (U055EDESLSE) — Tasarım Yöneticisi
5. erdem (U02SZQDAFPF) — Editör Yöneticisi

**⚠️ ÇİFT SAYIM AÇIKLAMASI:** İpek, Cansu, erdem hem yönetici hem aktif çalışan. Yoğunluk tablolarında bu kişiler **kendi departman ekibinde dahil**. Yönetici görevleri (DM, force-close, KPI takip) **ayrı satır** olarak gösterilir.

**🆕 PELİN ÖZDEMİR notları:** Onboarding bot'unu yöneticilerden biri (İpek/Cansu) başlatabilir. İlk 5 gün boyunca her sabah 09:30 DM ile sistem tanıtımı alır. Smart Assign skor hesabında ilk haftalar marka uzmanlığı düşük olabileceği için manuel atama öner; sistem zaman içinde Pelin'in marka tarihini biriktirir.

## OOO KEYWORD LİSTESİ (Brief Sync ile senkron)
TR: OOO, izin, izinli, izindeyim, yıllık izin, yarım gün izin, annelik izni, babalık izni, tatil, tatilde, raporlu, rapor, raporda, doktor, sağlık, hastayım, hasta
EN: vacation, sick, leave, PTO, doctor

**WFH OOO DEĞİLDİR** — SLA durmaz, DM gider.

## ADIMLAR

### 1. Canvas oku — multi-assignee parse
`slack_read_canvas` F0B1B6XUD44. Aktif (13 sütun) + Tamamlanan.

### 2. Bugünün tarihini belirle
TR: "5 Mayıs 2026 Çarşamba". `T_now`, `T_today_start`, `T_yesterday_start`.

### 3. OOO listesi al (16 kişi) — genişletilmiş keyword
PRIMARY_CALENDAR'da `list_events`. Yukarıdaki keyword listesinden eşleşme + 16 kişi isim. **WFH OOO sayılmaz.**

### 4. Dashboard URL'si
Sabit: `https://bensenoint.github.io/dashboard/` (şifre korumalı).

### 5. Veri analizi (son 7 gün) — TEK SEFERDE

#### a. Ekip geneli
- 🎨/✍️/🤖 dept başına: aktif/tamamlanan/saat
- Paylaşımlı, cross-dept, blocker, sessiz onay
- Geciken / Zamanında %
- Stale brief'ler (öncelik bazlı eşik: 🔴>1g, 🟠>3g, 🟡>7g, 🟢>14g)

#### b. Kişi başına (16 kişi)
**🎨 Tasarımcı (7) — İpek YÖN. dahil ama yönetici görevleri ayrı satır:**
Aktif iş, lead/C/R breakdown, bugün deadline, paylaşımlı/cross-dept, dün bitirdiği, streak, yoğunluk, blocker.

İpek için ek: 👑 Tasarım Yöneticisi görevleri (kaç DM, force-close, KPI uyarı)

**Pelin için ek (v7.7):** Eğer Pelin onboarding sürecinde ise (5 günden az) DM'sine onboarding ilerleme ek bilgi ekle:
> "🎓 Onboarding Day {N}/5 — bugünkü görev: {benseno-onboarding skill'inden}"

**✍️ Editör (8) — Cansu+erdem dahil:**
Yazdığı brief, atanan iş, lead/C/R, rev sayısı.

Cansu için ek: 👑 Direktör görevleri
erdem için ek: 🏅 Editör Yön. görevleri

**🤖 AI (Eren):**
Aktif, cross-dept'ten paylaşımlı, sıralı akış bekleyen.

#### c. Marka bazlı (en aktif 5-7)
3 dept toplamı, cross-dept %, kişi dağılımı.

### 5b. Tarihi Şüpheli Brief'ler tespiti (v7.8)
Brief Sync v7.12 Canvas'taki Aktif İşler tablosunda flag'leri (sütun veya etiket) okuyarak 3 kategori topla:

**Kategori A — Geçmiş tarih (henüz teyit edilmemiş):**
- Flag: `past_deadline AND NOT past_deadline_confirmed`
- Dashboard'da `⚠️ GEÇMİŞ` etiketi
- Liste: `[Brief#] [Marka] [İş] · deadline: {X} gün geride · 🐷 {Kimden}`

**Kategori B — Aynı gün ama saat girilmemiş:**
- Flag: `saat_eksik AND deadline.date == today`
- Dashboard'da `⏰ Saat eksik` etiketi
- Liste: `[Brief#] [Marka] [İş] · 👷 {Atanan} · 🐷 {Kimden}`

**Kategori C — Mesai dışı deadline (yumuşak bilgi):**
- Flag: `after_hours` (saat < 08:00 veya > 17:30 veya hafta sonu)
- Dashboard'da `🌙 Mesai dışı` etiketi
- Liste: `[Brief#] [Marka] [İş] · {deadline saati}`

Bu listeler ÇIKTI 1 ve ÇIKTI 2'ye eklenir (aşağı bak).

### 5c. Marka Hız Trendi (v7.9 — E3)
1. `marka_stats.json` dosyasını oku
2. `config.current_mode` kontrolü:
   - `silent_log_only`: sadece kısa bilgi notu, detaylı analiz yok
   - `active`: tam analiz aşağıda
3. **Tam analiz (active mode):**
   - Her marka için `trend_4w` (son 4 haftalık median_complete_days listesi) son değer ile önceki hafta arasındaki farkı hesapla
   - Markanın `mad_deadline_days × deviation_threshold_mult` (varsayılan 1×) üzerinde değişim varsa "sapan marka" listesine ekle
   - Hızlanan markalar (negatif değişim) ve yavaşlayan markalar (pozitif değişim) ayrı listelenir
4. **Çıktı:**
   - **Hızlanan markalar (📈 daha çabuk bitiyor):** Cansu için "Müşteri memnuniyeti artışı olabilir" notu
   - **Yavaşlayan markalar (🐌 sürekli geciken):** Cansu için "Brief kalitesi mi düştü, kapasite mi azaldı?" sorusu
5. Sadece Cansu (Direktör — 3 dept) DM'sine ekle. Diğer yöneticilere yalnız özet sayı görünür ("Sapan marka sayısı: 3").

### 6. Pazartesi check + Stale Brief
Bugün Pzt mi? Stale brief'ler öncelik bazlı eşikle.

### 7. Aksiyon Önerileri Üretici (Haiku ile, 5 yönetici için ayrı)

**Görkem (GM):** Stratejik karar gerektiren durumlar.

**Reyhan (GMY):** Operasyonel acil durumlar + müşteri etkileşimleri + kapasite uyarıları.

**Cansu (Direktör — 3 dept):** En çok dikkat gerektiren ekip üyesi (her dept'ten 1) + müşteri-editör koordinasyon + kalite skoru düşen marka × tip.

**İpek (Tasarım Yön.):** Yardıma ihtiyacı olan tasarımcı (özellikle Pelin onboarding sürecindeyse) + yüksek revizyon Tasarım briefleri + blocker'daki tasarım işleri.

**erdem (Editör Yön.):** Brief kalitesi düşen editör + mentor konuşulması gereken editör + müşteri yanıt bekleyen brief'ler.

Aksiyonlar **spesifik isim + konu + tahmini süre** içermeli.

### 8. ÇIKTI 1 — Kanal mesajı (#benseno-grafik)
[önceki format korundu, Dashboard URL şifre uyarısı dahil]

**v7.8 ek bölüm (mevcut bölümlere ek olarak, varsa ekle):**

```
🚩 *Tarihi Şüpheli Brief'ler* (varsa)
⚠️ Geçmiş tarih ({geçmiş_sayı}):
  • [#23] Bauhaus / banner · 2 gün geride · 🐷 Cansu — [thread'de teyit bekleniyor]
  • [#27] JNJ / story · 1 gün geride · 🐷 Eda T — [thread'de teyit bekleniyor]
⏰ Aynı gün ama saat yok ({saat_eksik_sayı}):
  • [#31] Splenda / post · 👷 Aylin · 🐷 erdem
🌙 Mesai dışı deadline ({mesai_dışı_sayı}) — bilgi:
  • [#34] Hendex / banner · bugün 22:00
```

Eğer 3 kategori de boşsa bu bölümü hiç ekleme. Sadece dolu kategorileri göster.

### 9. ÇIKTI 2 — 5 yöneticiye DM
3 bölümlü: A) Genel Bakış · B) Yoğunluk + Risk · C) Bugün 3 Aksiyon (Haiku ile rolüne özel).

**v7.8 ek (her yönetici DM'sine):** "🚩 Tarihi Şüpheli Brief'ler" bölümü Kanal mesajıyla aynı içerikte eklenir. Yönetici kendi departmanına ait brief'leri öne çıkarır (Cansu için 3 dept'inden tümü, İpek için Tasarım, erdem için Editör). Aksiyon önerisinde Haiku bu listeyi kullanır: "Cansu, Bauhaus #23 brief'i geçmiş tarih — Eda T ile bugün 10:00'da teyit konuşması."

**v7.9 ek (sadece Cansu DM'sine):**

```
📊 *Marka Hız Trendi (son 4 hafta · E3)*
Aktivasyon: {silent_log_only | active}
{ silent_log_only ise:
"E3 sessiz mod — 1 Haziran'da aktif olur. Şu an {N} markada veri toplanıyor."
}
{ active ise:

📈 Hızlanan markalar ({hızlanan_sayı}) — müşteri memnuniyeti artışı olabilir:
  • Bauhaus: 2.1g → 1.6g (medyan tamamlama, son hafta -24%)
  • KMR Lamy: 1.8g → 1.3g (-28%)

🐌 Yavaşlayan markalar ({yavaşlayan_sayı}) — kalite mi kapasite mi?:
  • Splenda: 2.3g → 3.1g (+35%)
  • Hendex: 1.9g → 2.7g (+42%)

Bu işaretler son 4 haftalık trendden — anlık dalgalanma olabilir. Devam ederse aksiyon al.
}
```

Diğer yöneticilere kısa özet: "📊 E3: {N} marka izlemde, {S} sapma var." (detay link verilmez)

#### Görkem (Genel Müdür) DM — STRATEJİK + 3 AKSİYON
#### Reyhan (Genel Müdür Yardımcısı) — OPERASYONEL + 3 AKSİYON
#### Cansu (Direktör — 3 dept) — TÜM EKİP DETAY + 3 AKSİYON
#### erdem (Editör Yön.) — EDİTÖR MENTÖRLÜK + 3 AKSİYON
#### İpek (Tasarım Yön.) — TASARIM ODAKLI + 3 AKSİYON

**v7.7 not:** Pelin onboarding sürecinde ise İpek'in DM'inde özel satır:
> "🎓 *Pelin onboarding Day {N}/5* — bugünkü modül: {modül adı}. Onboarding bot otomatik atadı. Sorun olursa intercept et."

### 10. ÇIKTI 3 — 16 kişiye kişisel günaydın DM
[önceki format]

**Pelin için ilk 5 gün:** Standart günaydın DM gönderme — onboarding bot zaten 09:30'da DM atıyor, çakışma olmasın. Standart günaydın 6. gün başlar.

### 11. Custom KPI Default'ları
Dashboard EMBEDDED_DATA içine 6 önerilen KPI inject (önceki gibi).

### 12. Pazartesi haftalık özet (Pzt) — yöneticilerin DM'lerine ek
[önceki format]

### 13. Çıktı
```
Sabah Raporu v7.9 OK · 3 Çıktı
1. Kanal mesajı: ✅
2. Yönetici DM: 5/5 (her birine 3 aksiyon)
3. Günaydın DM: {N}/16 (izinde: {M}, onboarding: {O})
{Pzt: Haftalık özet eklendi}
Aksiyonlar: Haiku ile {N} üretildi
Stale brief'ler: 🔴={N1} 🟠={N2} 🟡={N3} 🟢={N4}
Tarihi Şüpheli: geçmiş={A} saat_eksik={B} mesai_dışı={C}
🆕 Marka hız trendi: mode={silent_log_only|active} izlenen={N} hızlanan={H} yavaşlayan={Y}
🆕 Pelin Day: {N/5 veya tamamlandı}
Dashboard: https://bensenoint.github.io/dashboard/
```

## HATA KURTARMA
- Canvas erişim hatası → Görkem'e (GM) acil DM
- Atanan parse fail → tek atanan kabul
- OOO list fail → izinde liste boş, log
- Haiku aksiyon üretici fail → manuel template fallback
- Tek bir DM fail → log, devam
- Kanal mesajı fail → log, DM'lere devam
- Beyza eski ID atanmış aktif iş tespiti → Cansu+İpek'e DM "Beyza ayrıldı, yeniden ata"