# Benseno Tasarım Sistemi — Kullanım Bilgisi (chatbot referansı)

## Sistem nedir
Slack botu (WT) + Railway API/Postgres + GitHub Pages dashboard. Briefler (işler) Slack'ten veya dashboard'dan açılır, tüm takip iki taraftan senkron yürür. Tek doğru kaynak veritabanıdır.

## Brief açma
- Slack: marka kanalında `/yeni-brief` → form. "Benseno" markası özeldir: #benseno kanalına bağlıdır ve henüz anlaşılmamış müşteri adayları / örnek çalışmalar için kullanılır — markadan bağımsız işler oradan açılır. (başlık, termin, işi yapanlar, lead, gözlemci, not, dosya). Marka kanaldan otomatik algılanır.
- Dashboard: sağ üst "+ Yeni brief". Üç kişi seçici de departmana göre gruplu (Tasarım/Editör/AI/Freelance).
- Yeni briefte işi yapanların departman yöneticileri OTOMATİK gözlemci olur; ilk thread yanıtındaki mention'la bildirim alırlar (ayrıca DM gitmez — tek kanal). Freelance işlerde gözlemci = işi açanın departman yöneticisi.
- Brief açılınca markanın kanalına mesaj düşer; ilk thread yanıtında herkes @mention'lıdır — iş o thread'de yürür.

## Durum güncelleme (Slack)
İki yol aynı sonucu verir: brief ana mesajına emoji reaction VEYA thread'e o emojiyi/kelimeyi yazmak.
- 🎨/✍️/🤖 = işi kabul → **"İş planında"** statüsü (planıma aldım) (🎨 tasarım, ✍️ editör, 🤖 AI). 🔄 = devam ediyor. NOT: "Çalışılıyor" eski etiketti; artık her yerde **"İş planında"** denir.
- 🚀 **"İşe başlandı"**: kişi planladığı işe GERÇEKTEN başladı (İş planında'dan sonraki adım; çalışma süresi buradan işler). Statü sırası: Yeni → İş planında → İşe başlandı → İncelemede → (Beklemede / Revizyon / Müşteride / Blokeli) → Tamamlandı.
- 👀 incelemede · ⏸️ beklemede · ✏️ revizyon · ✅ tamamlandı (thread'deki son görsel galeriye kaydedilir) · 🔃 yeniden aç.
- ✈️ = müşteriye yollandı (kelime: "müşteriye yollandı"). İş "Müşteri Onayı" sayfasına taşınır; aktif yük/kapasite/hareketsizlikten çıkar. KURAL: ✈️ sonrası İLK ✏️ müşteri revizyonu, diğerleri iç revizyon. Müşteri revizyonuyla iş otomatik aktif listeye döner. Revizyonlar tablolarda iç/müşteri ayrı gösterilir.
- Kelimeler (tam eşleşme): "devam et", "iş incelemede", "iş beklemede", "bekle", "revizyon var", "revize et", "müşteriye yollandı", "iş tamamlandı", "yeniden aç", "geri aç", "bloke et".
- Öncelik: 🔴 acil · 🟠 yüksek · 🟡 normal · 🟢 düşük (reaction veya "acil öncelik" gibi yazı; atanan veya yönetici).

## Kişisel iş sırası (iş kuyruğu)
Profilde ve Kanban'da işler sürükle-bırakla sıralanır = kişinin "önce hangisini yapacağı" sırası. En üstteki iş otomatik **"İşe başlandı"** olur; bir iş başa alınınca önceki başlandı işi (başka aktif çalışan yoksa) **beklemeye** düşer. Birden fazla kişi çalışıyorsa, biri aşağı çekse de başka aktif çalışan varsa iş başladı kalır. Sıralamayı kimler yapabilir: **Görkem / Reyhan / Cansu** tüm departmanlar; **İpek** yalnız tasarım, **Erdem** yalnız editör işleri (başka departmanla ortak iş olsa bile); ayrıca herkes **kendi** kuyruğunu sıralayabilir. Profilde varsayılan sıralama bu iş-yapma sırasıdır. Kanban'da kart sürükleyerek hem sıralama hem statü değişimi yapılır (kolonlar arası = statü; Müşteri Onayında/Blokeli/Tamamlandı kolonları iş-sırasına göre sıralanmaz).

## Çalışma süresi (döngü-bazlı)
Bir işe harcanan süre statü geçmişinden (events) hesaplanır. **Sayılan** (çalışma) statüler: İşe başlandı + İnceleme + Revizyon. **Sayılmayan / düşülen** (saat durur): Yeni, İş planında, Beklemede, **Müşteride**, **Blokeli**. "İşe başlandı" girilmemişse ilk anlamlı statü değişimi başlangıç sayılır (başladı'yı unutmak süreyi bozmaz). Bir iş **Tamamlandı**'dan sonra tekrar açılırsa AYRI bir döngü sayılır; her döngünün süresi ayrı tutulur, toplam da hesaplanır (iş detayında "⏱ Çalışma Süresi" bloğu — her döngü ayrı + Toplam; tablolarda süre = toplam, çok-döngülü işte `·N🔁` işareti). Müşteriye yollanan iş (✈️) süreden ve aktif yükten düşülür ama aynı döngü devam eder (müşteri revizyonu gelince).

## İşe dönüşte termin uzatma hatırlatıcısı
Bir iş `beklemede` veya `müşteride`'den tamamlanmadan tekrar aktife dönünce, dashboard'da (iş detayında şerit + bell) ve Slack thread'inde "termini uzatmak ister misin?" hatırlatıcısı çıkar; önerilen miktar = ne kadar beklediği/müşteride kaldığı. Bu hatırlatıcı AÇIKKEN yapılan termin uzatması **muaf**tır: gecikme sayılmaz, yıldız puanına ceza yazmaz, "uzatıldı" rozetini tetiklemez (deadline_history'de `muaf:true`, `uzatma_muaf` sayacında izlenir). Hatırlatıcı, kullanıcı uzatınca veya "Kapat"a basınca kapanır. Hatırlatıcı KAPALIYKEN yapılan normal uzatmalar bugünkü gibi cezalıdır.

## Sıralı onay zinciri (⛓️)
Brief açarken (Slack formu veya dashboard) "Sıralı" seçilirse işi yapanlar SEÇİM SIRASINA göre zincir olur (ör. Melis → İpek → Levent). ✅ yalnızca sıradaki halkayı onaylar; iş otomatik sonraki kişiye geçer (DM gider) ve HERKES onaylamadan tamamlanmaz. ✏️ zinciri bir önceki onaylı halkaya geri sarar; "revize: @kişi" yazılırsa o halkaya döner (o halka ve sonrasının onayı düşer). Freelance halkası yerine brief'teki herhangi biri onay verebilir (vekâleten not düşülür). Sıralı işte cevapsız uyarısı ve kapasite yükü yalnız sırası gelen halkaya işler. Seçim yapılmaz veya "Paralel" seçilirse her şey bugünkü gibi çalışır. Bu akış yalnızca yeni açılan brieflerde geçerlidir. Brief detayında ⛓️ zincir şeridi halkaların durumunu gösterir (✓ onaylı, ▶ sırada).

## Finansal (Slack thread'ine yaz)
"maliyet 1500 satış 4000" · "fatura ok"/"fatura iptal" · "ödeme ok"/"ödeme iptal". Termin değiştirme: thread'e "termin 15.06 17:00" (veya "termin yarın 14:30"; saat yoksa 18:00) — dashboard'da da brief detayında Deadline'a tıklayıp değiştirilebilir. Dashboard'a dakikalar içinde yansır. `/maliyet` komutu da var.

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
- Yıldız puanı: AI her tamamlanan işe 1-5 puan verir (5=pürüzsüz/zamanında, 1=ciddi sorun). Yönetici Tamamlananlar'daki yıldızlara tıklayıp override edebilir; override sonrası AI dokunamaz. Tabloda yıldızın üzerine gelince puanın tek cümlelik gerekçesi (tooltip) görünür. Karne: firma+departman (Karşılaştırma ekranı, herkese açık), marka (Marka detayı), kişi (Profil, SADECE yönetici görür). Sebep açıklamaları her gün 18:45'te güncellenir.

## Raporlar (hafta içi)
- 07:50 Sabah raporu → #benseno-grafik + 5 yönetici DM.
- 07:55 Kişisel iş özeti → aktif işi olan her çalışana DM (işi yoksa gelmez).
- 17:05 Günlük özet, Cuma 17:10 haftalık retro, ay sonu strateji.

## Dashboard ekranları
Genel Bakış (KPI + bugün/yarın + firma yıldızı; "Bu hafta parlayan" kartı sadece yönetici), Aktif İşler (tablo + detay paneli), Plan/Gantt, Kanban, Tamamlananlar (satıra tıkla → salt-okunur detay: thread özeti, insight, not; yıldız puanlama yönetici), Karşılaştırma (Yıldız Karnesi + departman kıyası), Geçmiş (gerçek olay akışı; satıra tıkla → işin detayı), Müşteri Onayı (✈️ müşteri dönüşü bekleyen işler: bekleme süresi, gönderim sayısı, iç/müşteri revize), Galeri, Multi-atama, Marka (liste + detay: yıldız, günlük kanal takibi arşivi), Ekip Matrisi, Profil (kişisel istatistik; admin departman gruplu dropdown'la kişi seçebilir), Yardım, Kullanıcılar & Silinenler (yönetici; silen kişinin adı görünür).
- Sağ alttaki 🤖 balon = Ody (sistem asistanı): kiminle konuştuğunu bilir, "bugün hangi işlerim var?" sorusuna giriş yapan kişinin işleriyle cevap verir.
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
