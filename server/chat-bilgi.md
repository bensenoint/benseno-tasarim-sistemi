# Benseno Tasarım Sistemi — Kullanım Bilgisi (chatbot referansı)

## Sistem nedir
Slack botu (WT) + Railway API/Postgres + GitHub Pages dashboard. Briefler (işler) Slack'ten veya dashboard'dan açılır, tüm takip iki taraftan senkron yürür. Tek doğru kaynak veritabanıdır.

## Brief açma
- Slack: marka kanalında `/yeni-brief` → form (başlık, termin, işi yapanlar, lead, gözlemci, not, dosya). Marka kanaldan otomatik algılanır.
- Dashboard: sağ üst "+ Yeni brief". Üç kişi seçici de departmana göre gruplu (Tasarım/Editör/AI/Freelance).
- Yeni briefte işi yapanların departman yöneticileri OTOMATİK gözlemci olur ve DM alır. Freelance işlerde gözlemci = işi açanın departman yöneticisi.
- Brief açılınca markanın kanalına mesaj düşer; ilk thread yanıtında herkes @mention'lıdır — iş o thread'de yürür.

## Durum güncelleme (Slack)
İki yol aynı sonucu verir: brief ana mesajına emoji reaction VEYA thread'e o emojiyi/kelimeyi yazmak.
- 🎨/✍️/🤖 = iş kabulü, planıma aldım, çalışıyorum (🎨 tasarım, ✍️ editör, 🤖 AI). 🔄 = devam ediyor.
- 👀 incelemede · ⏸️ beklemede · ✏️ revizyon · ✅ tamamlandı (thread'deki son görsel galeriye kaydedilir) · 🔃 yeniden aç.
- Kelimeler (tam eşleşme): "devam et", "iş incelemede", "iş beklemede", "bekle", "revizyon var", "revize et", "iş tamamlandı", "yeniden aç", "geri aç", "bloke et".
- Öncelik: 🔴 acil · 🟠 yüksek · 🟡 normal · 🟢 düşük (reaction veya "acil öncelik" gibi yazı; atanan veya yönetici).

## Finansal (Slack thread'ine yaz)
"maliyet 1500 satış 4000" · "fatura ok"/"fatura iptal" · "ödeme ok"/"ödeme iptal". Dashboard'a dakikalar içinde yansır. `/maliyet` komutu da var.

## Silme & geri alma
Thread'e "brief sil" yaz, ya da brief ana mesajını Slack'te sil, ya da dashboard detayında 🗑️ Sil (yönetici). Silinen iş Silinenler ekranına gider, geri alınabilir; thread'e silen kişinin adıyla not düşer. "Kalıcı sil" geri alınamaz (yönetici).

## Otomatik takip ve uyarılar (hafta içi 09-19, saatte bir kontrol)
- Cevapsız uyarısı: brief açıldıktan 1 saat sonra durum hâlâ "yeni" ise (başlama emojisi yoksa — thread'e yazmak yetmez) atanana hatırlatma DM'i gider.
- Eskalasyon: 2 saat daha geçerse atanana 2. hatırlatma + departman yöneticisine bilgi DM'i. İşi yapamayacaksan beklemeden yöneticine haber ver.
- Hareketsiz: 24 iş saati (Cmt/Paz + TR resmî tatilleri hariç) hiç hareket olmayan brief "hareketsiz" işaretlenir; hareket gelince kalkar.
- Tatil: Slack durumunu 🌴 / "tatil" / "izin" / "OOO" yapan kişiye uyarı gitmez; tüm atananları tatildeki işte hareketsizlik süresi işlemez.

## AI özetleri ve değerlendirme
- Thread Özeti: her aktif brief'in Slack yazışması saatte bir AI ile özetlenir → brief detayında "💬 Thread Özeti".
- İş Insight: iş tamamlanınca thread'den değerlendirme üretilir (süreç, revize, öğrenimler) → tamamlanan işin detayında "🔍 İş Insight".
- Marka Günlük Takibi: marka kanalının tüm akışı saatte bir özetlenir; her gün 18:45'te günün özeti + gün-sonu insight'ı tarihli arşive yazılır → Marka detayında tabloların altında "Günlük Kanal Takibi" paneli, tarih seçiciyle geçmiş günlere dönülür. Günlük kayıtlar bir önceki günle ilişkilendirilir (dünden sarkan konuların durumu belirtilir).
- Yıldız puanı: AI her tamamlanan işe 1-5 puan verir (5=pürüzsüz/zamanında, 1=ciddi sorun). Yönetici Tamamlananlar'daki yıldızlara tıklayıp override edebilir; override sonrası AI dokunamaz. Karne: firma+departman (Karşılaştırma ekranı, herkese açık), marka (Marka detayı), kişi (Profil, SADECE yönetici görür). Sebep açıklamaları her gün 18:45'te güncellenir.

## Raporlar (hafta içi)
- 07:50 Sabah raporu → #benseno-grafik + 5 yönetici DM.
- 07:55 Kişisel iş özeti → aktif işi olan her çalışana DM (işi yoksa gelmez).
- 17:05 Günlük özet, Cuma 17:10 haftalık retro, ay sonu strateji.

## Dashboard ekranları
Genel Bakış (KPI + bugün/yarın + firma yıldızı; "Bu hafta parlayan" kartı sadece yönetici), Aktif İşler (tablo + detay paneli), Plan/Gantt, Kanban, Tamamlananlar (satıra tıkla → salt-okunur detay: thread özeti, insight, not; yıldız puanlama yönetici), Karşılaştırma (Yıldız Karnesi + departman kıyası), Geçmiş (gerçek olay akışı; satıra tıkla → işin detayı), Galeri, Multi-atama, Marka (liste + detay: yıldız, günlük kanal takibi arşivi), Ekip Matrisi, Profil (kişisel istatistik; admin departman gruplu dropdown'la kişi seçebilir), Yardım, Kullanıcılar & Silinenler (yönetici; silen kişinin adı görünür).
- Giriş kişiye özel kullanıcı adı+şifre; ilk şifre yöneticiden. Görünüm otomatik kendi hesabın; başka görünüme geçmek admin-only.
- Bildirim zili (sağ üst): sana atılan her brief-akışı DM'inin kısa hâli; tıklayınca Slack thread'ine gider.
- Komut paleti: Cmd/Ctrl+K.

## Geri bildirim
Herhangi bir Slack kanalına "help" yaz → "📝 Formu Aç" butonu → başlık + açıklama + görsel → sistem adminlerine DM düşer.

## Ekip
Yöneticiler (admin): Görkem Kaya (GM, AI), Reyhan Nur Pınar (GMY, AI), Cansu Kazgan (Direktör, Editör), İpek Akdeniz (Tasarım Yön.), Erdem Akoğlu (Editör Yön.).
Tasarım: Aykut Arslan, Aylin Tozkoparan, Hasan Serdar Arda, İrem Özkan, Pelin Özdemir, Serhat Tokmak (+İpek).
Editör: Aylin Canel, Buse Gürbüzer, Eda Ayral, Eda Tireli, Melis Genç, Simge Acar (+Cansu, Erdem).
AI: Eren Mahzunlar, Uras Aydınlıoğlu (+Görkem, Reyhan).
Freelance (Slack'te yok, DM almaz, süreci içeriden açan yönetir): Arda Gündoğdu (tasarım), Berke Çırakman (web/teknik), Duru Can (web/reklam/SEO), Enes Çınar (yazılım), Levent Tütüncü (matbaa/promosyon), Mehmet Filiz (yazılım).
