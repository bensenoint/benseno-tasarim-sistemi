# Brief: Benseno Tasarım Sistemi — Özel Emoji Seti

## Bağlam
Benseno, bir tasarım ajansının iş takip sistemi. İşler **Slack thread'lerinde** emoji reaction'larıyla yönetilir (durum değiştirme, öncelik atama, teslim); aynı emojiler **web dashboard'unda** durum/öncelik rozetleri ve ikonlar olarak gösterilir. Bu emojiler estetik değil **işlevsel** — anlam taşır. Amaç: bunları markaya özel, tutarlı bir set ile değiştirmek.

İki yüzeyde görünürler:
- **Slack:** custom emoji (reaction + mesaj içi). Kare, ~128×128px; küçük boyutta (16–22px) okunaklı olmalı.
- **Dashboard:** durum/öncelik rozetleri, küçük ikonlar (11–20px). Hem açık hem koyu temada çalışmalı.

> **GÜNCELLEME (önemli):** "Çalışılıyor" artık **tüm departmanlar için TEK emoji**. Eski sistemde işi alan kişinin departmanına göre 🎨 (tasarım) / ✍️ (editör) / 🤖 (AI) ayrımı vardı — bu kaldırıldı. Departman bilgisi zaten işe atanan kişiden türetiliyor (emojiden değil), dolayısıyla bilgi kaybı yok. Yeni sette **tek "çalışılıyor / işi aldım" emojisi** olacak.

---

## 1) DURUM emojileri (iş akışı — en kritik grup)
Bir işin yaşam döngüsü, sırayla ilerler:

| # | Emoji | Slack adı | Anlam / amaç |
|---|------|-----------|--------------|
| 1 | 🎨 | `:art:` (tek) | **Çalışılıyor / İşi aldım** — kişi işi üstlendi, başladı. **Tüm departmanlar için tek emoji.** |
| 2 | 🔄 | `:arrows_clockwise:` | **Devam ediyor** — iş hâlâ aktif (yeniden teyit) |
| 3 | 👀 | `:eyes:` | **İncelemede** — iş gözden geçiriliyor / revize sunuldu |
| 4 | ⏸️ | `:double_vertical_bar:` | **Beklemede** — müşteri/onay/materyal bekleniyor |
| 5 | ✏️ | `:pencil2:` | **Revizyon** — düzeltme isteği geldi |
| 6 | ✈️ | `:airplane:` | **Müşteriye yollandı** — müşteri onayında |
| 7 | ✅ | `:white_check_mark:` | **Tamamlandı** — iş bitti |
| 8 | 🔃 | `:arrows_counterclockwise:` | **Yeniden açıldı** — tamamlanmış iş tekrar çalışmaya alındı |
| 9 | 📎 | `:paperclip:` | **Final teslim** — bu mesajdaki dosyalar işin final çıktısı, galeriye kaydedilir |

> Tasarım notu: 1 (Çalışılıyor) ve 2 (Devam ediyor) yakın kavramlar; ikisi de "iş aktif" demek. İstenirse görsel olarak akraba (aynı aile, küçük varyasyon) tasarlanabilir. 8 (Yeniden açıldı) "tamamlandı"yı geri alma jesti — tersine dönüş hissi vermeli.

## 2) ÖNCELİK emojileri (renk-kodlu şiddet skalası)
| Emoji | Slack adı | Anlam |
|------|-----------|-------|
| 🔴 | `:red_circle:` | **Acil** (en yüksek) |
| 🟠 | `:large_orange_circle:` | **Yüksek** |
| 🟡 | `:large_yellow_circle:` | **Normal** (varsayılan) |
| 🟢 | `:large_green_circle:` | **Düşük** |

> Kırmızı→yeşil renk geçişi (şiddet skalası) korunmalı.

## 3) META / UI emojileri (dashboard + bildirim)
| Emoji | Amaç |
|------|------|
| 🔔 | Bildirim (okunmamış sayacı) |
| ⚠️ | Termin riski — teslime az kaldı, iş hâlâ aktif |
| ⭐ | Yıldız puanı (iş kalite değerlendirmesi 1–5) |
| 📡 | Marka günlük takibi |
| ⛓️ | Sıralı iş zinciri (çok kişili, el değiştirmeli iş) |
| 💰 | Finansal bilgi (maliyet/satış/fatura/ödeme) |
| 🗑️ | Sil · ↩ Geri al |
| 🛟 | Geri bildirim/destek formu |
| 🤖 | "Ody" — sistem asistanı maskotu |

## 4) Teslim durumu rozetleri (renk noktası — dashboard "Tamamlananlar")
🟢 **Zamanında** · 🟡 **Uzatılarak teslim** · 🔴 **Gecikmeli**

---

## Metin kısayolları (görsel değil — bağlam için)
Kullanıcılar emoji yerine thread'e şu kelimeleri yazabiliyor (aynı durum geçişini tetikler). Emoji değişse de bu kelime kısayolları korunacak:

`devam et` / `devam ediyor` → Çalışılıyor · `iş incelemede` → İncelemede · `iş beklemede` / `bekle` → Beklemede · `revizyon var` / `revize et` → Revizyon · `revize: @kişi` → zinciri geri sar (sıralı iş) · `müşteriye yollandı` → Müşteri Onayı · `termin 15.06 17:00` → termin değiştir · `iş tamamlandı` → Tamamlandı · `yeniden aç` / `geri aç` → Yeniden açıldı · `bloke et` → Blokeli · `acil/yüksek/normal/düşük öncelik` → öncelik · `maliyet X satış Y` / `fatura ok` / `ödeme ok` → finansal · `help` → destek formu

---

## İstenen çıktı (Claude Design'dan)
1. **9 durum + 4 öncelik** emojisi için özel tasarım (öncelikli set). İdeal olarak **3 meta/UI** ikonu da (🔔 ⚠️ ⭐) aynı dilde.
2. Her biri: kare **SVG + 128px PNG**; açık/koyu tema uyumlu; **16px'te okunaklı**.
3. Slack custom emoji adlarıyla 1:1 eşleşme tablosu (örn. `bns-calisiliyor`, `bns-incelemede`, `bns-acil`, `bns-tamamlandi`, `bns-final` …).
4. Tutarlı stil kılavuzu (renk paleti, çizgi/dolu kuralı, köşe yarıçapı).

## Kısıtlar
- Anlam **renkten bağımsız da** ayırt edilebilmeli (form farkı şart — erişilebilirlik).
- 🔴→🟢 öncelik skalası, ✅/✈️/⏸️ durum mantığı korunmalı.
- Marka paleti: birincil **#24479E (logo mavisi)**; sıcak vurgular kırmızı/turuncu/sarı/yeşil.
- "Çalışılıyor" **tek emoji** (departman ayrımı yok).

---

**Ayrı not — Ody maskot ifadeleri:** Dashboard asistanı "Ody"nin ruh halleri (neşeli, meşgul, kızgın, düşünüyor, uyuyor, coşkulu, sıkılmış, üzgün) **SVG ile kod içinde çizilen yüz ifadeleri** — Slack emojisi değil. Custom seti Ody'nin estetiğiyle uyumlu istersen Claude Design'a "Ody maskotuyla aynı görsel dil" notunu ekle; ama Ody yüzleri bu emoji setinin parçası değil, ayrı bir bileşendir.

---

### Kod tarafı notu (uygulama)
Mevcut kodda 🎨 / ✍️ / 🤖 üçü de `calisiliyor` durumuna eşleniyor. Tek-emoji modeline geçişte: yeni custom "çalışılıyor" emoji adı `calisiliyor`a eşlenecek; departman ayrımı kaldırılacak (departman, atanan kişiden türetilmeye devam eder). Bu değişiklik custom emojiler hazır olduğunda `scripts/slack-bot.js` (DURUM_MAP + EMOJI_DURUM), Yardım ekranı ve `/yardim` çıktısında uygulanacak.
