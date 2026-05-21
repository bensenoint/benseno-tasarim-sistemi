BENSENO TASARIM SİSTEMİ — CLAUDE CODE MASTER PROMPT v1.0
Tarih: 16 Mayıs 2026 Sistem versiyonu: v7.13 Hedef ortam: Claude Code (terminal-tabanlı agent) Mevcut platform: Cowork (Anthropic Claude Desktop)


________________


🎯 BU PROMPT NE İŞE YARAR?
Bu doküman, Benseno dijital ajansının tasarım iş takip sistemini sıfırdan Claude Code üzerinde yeniden inşa etmek için gerekli her bilgiyi içerir. Mevcut sistem 6+ ay boyunca Cowork üzerinde geliştirildi ve şu an v7.13 olarak production'dadır.


Bu prompt Claude Code'a verildiğinde, agent şunları yapabilmelidir:


1. Tüm sistem mimarisini anlamak
2. 8 scheduled task'in tam mantığını yeniden uygulamak
3. Dashboard'u yeniden inşa etmek
4. MCP bağlantılarını doğru yapılandırmak
5. Hata durumlarında doğru karar vermek
6. İleride yapılacak fazları (Phase 8) planlamak
7. Mevcut Cowork sisteminden Claude Code'a geçiş yönetmek


Kullanım talimatı:


claude
# Sonra bu dokümanın tamamını paste et veya:
claude -p "$(cat CLAUDE_CODE_BENSENO_MASTER_PROMPT.md) — Bu sistemi anla, sonra sorularımı bekle"

________________


📚 İÇİNDEKİLER
1. Şirket ve Vizyon — Benseno kim, sistem neden var
2. Ekip ve Roller — 16 kişi, Slack ID'leri, yöneticiler
3. Sistem Mimarisi — 3 katman, akış diyagramı
4. Sabit Veriler — 39 marka kanal mapping, sabitler
5. Slack Workflow Builder — Brief açma formu
6. 8 Scheduled Task — Her birinin tam spesifikasyonu
7. Algoritmalar — Öncelik, Smart Assign, Marka Stats, Parser
8. Veri Yapıları — JSON şemalar, Canvas formatı
9. Dashboard — HTML/CSS, EMBEDDED_DATA, GitHub deploy
10. MCP Bağlantıları — Slack, Gmail, Calendar, Drive
11. Phase Tarihçesi — v7.0 → v7.13 evrimi
12. Bilinen Sorunlar — Slack API quirk'leri ve çözümleri
13. Phase 8 Backlog — AI Mockup, E3 aktivasyon, Mail Router
14. Claude Code'a Geçiş — Terminal komutları, launchd job'ları
15. Test Senaryoları — Her özellik için doğrulama
16. Hata Kurtarma — Edge case'ler ve fallback'ler


________________


1. ŞİRKET VE VİZYON
1.1 Benseno Hakkında
Benseno, İstanbul merkezli bir dijital ajanstır. 16 kişilik bir ekip ile 39 farklı markaya tasarım, editör ve AI hizmetleri verir. Müşteri yelpazesi:


* Yayıncılık (Bauhaus dergisi)
* Medikal/Sağlık (JNJ Vision TR, JNJ Acuvue ME)
* FMCG (Splenda, Krups, KMR alt markaları)
* Petshop/Veteriner (KZY alt markaları, Hasvet, VDM Petdent)
* Holding/Kurumsal (Marmara Holding, Cimporglobal)
* Spor (Egosport)
* Teknoloji (Hendex, Cureffect)
1.2 Sistem Neden Var?
Pre-sistem dönem (2024-2025):


* Müşteriden gelen istekleri editör ekibi Slack'te direkt tasarımcıya yazıyordu
* Brief takibi Slack thread'lerinde "kaybolmuş" durumdaydı
* Kim ne yapıyor, ne zaman bitirecek belli değildi
* Bazı tasarımcıların elinde 8+ iş birikirken bazılarınınki 1
* Yöneticiler haftalık raporları manuel çıkarıyordu (Cansu Direktör 3-4 saat/hafta)
* Müşteri "brief'iniz nerede?" sorduğunda yanıt belirsizdi


Sistem hedefleri:


1. Şeffaflık: Her brief'in durumu tek bir yerden (Canvas + Dashboard) izlenebilir
2. Otomasyon: Atama, öncelik, raporlama el ile değil
3. Dengeli iş yükü: Kapasite uyarıları otomatik, yöneticiye gider
4. Performans takibi: Tamamlama süresi, revizyon sayısı, memnuniyet skoru
5. Müşteri ilişki kalitesi: Brief'ler tarihinde teslim, marka davranışı öğrenilir
1.3 Sistem v7.13'ün Manifesto
"Hiçbir manuel günlük takip. Sadece brief açarken (formdan) ve reaction ile durum güncellerken müdahale et. Geri kalan her şey otomatik."


________________


2. EKİP VE ROLLER
2.1 Departmanlar
🎨 Tasarım Ekibi (7 kişi)
İsim
	Slack User ID
	Rol
	Email
	Notlar
	Aylin Tozkoparan
	U0AN6DD79M0
	Tasarımcı
	—
	—
	Aykut Arslan
	U06J26R1XCJ
	Tasarımcı
	—
	—
	Hasan Serdar Arda
	U09BFPBKQG7
	Tasarımcı
	—
	—
	Pelin Özdemir
	U0B3K2WE7SB
	Tasarımcı
	pelin@benseno.com.tr
	YENİ — 15 May 2026 katıldı
	İpek Akdeniz
	U055EDESLSE
	Tasarımcı + Tasarım Yöneticisi
	—
	Çift sayım: hem yönetici hem aktif
	İrem Özkan
	U0AK8U7L57F
	Tasarımcı
	—
	—
	Serhat
	U08HLMHTGEL
	Tasarımcı
	—
	—
	✍️ Editör Ekibi (8 kişi)
İsim
	Slack User ID
	Rol
	Notlar
	Cansu Kazgan
	U4XCE3532
	Editör + Direktör (3 dept)
	Tüm departmanların koordinatörü. Çift sayım.
	erdem akoğlu
	U02SZQDAFPF
	Editör + Editör Yöneticisi
	Brief kalitesi mentoru. Çift sayım.
	Eda Tireli
	U09BZHR25NG
	Editör
	Bauhaus uzmanı
	Eda Ayral
	U07PV0RA9L2
	Editör
	—
	Melis
	U08NQJ27G5S
	Editör
	—
	Aylin Canel
	U05PP70GQTX
	Editör
	—
	Buse Gürbüzer
	U063T8M5HL4
	Editör
	—
	Simge Acar
	U0AAC3YK20G
	Editör
	—
	🤖 AI Teknolojileri (1 kişi)
İsim
	Slack User ID
	Rol
	Eren Mahzunlar
	U0AP31SAA1W
	AI Teknolojileri
	2.2 Yönetim Hiyerarşisi (5 yönetici)
┌───────────────────────────────────────────────────┐
│  Görkem Kaya (U030C48PL23) — GENEL MÜDÜR · ortak │
│  Email: gorkem@benseno.com.tr                      │
│  Yetki: Tüm sistem, stratejik kararlar             │
└───────────────────────────────────────────────────┘
                       │
       ┌───────────────┴────────────────┐
       ▼                                 ▼
┌──────────────────────┐    ┌──────────────────────┐
│ Reyhan Nur Pınar     │    │ Cansu Kazgan         │
│ (UD96GH76E) — GMY    │    │ (U4XCE3532) — DİREKTÖR│
│ ortak · operasyonel  │    │ 3 departman          │
└──────────────────────┘    └──────────────────────┘
                                       │
                       ┌───────────────┴────────────────┐
                       ▼                                 ▼
              ┌──────────────────────┐    ┌──────────────────────┐
              │ İpek Akdeniz         │    │ erdem akoğlu         │
              │ (U055EDESLSE)        │    │ (U02SZQDAFPF)        │
              │ TASARIM YÖNETİCİSİ   │    │ EDİTÖR YÖNETİCİSİ    │
              └──────────────────────┘    └──────────────────────┘
2.3 Çift Sayım Notu (Kritik!)
İpek, Cansu ve erdem hem yönetici hem aktif çalışan. Sistem onları:


* Yoğunluk tablolarında kendi departman ekibinde dahil eder
* Yönetici görevleri (DM gönderme, force-close yetkisi, KPI takip) ayrı satır olarak gösterilir
* Dashboard'da iki yerde görünürler
2.4 Mesai Saatleri
* Resmi: 08:00 - 17:30 (Hafta içi, Pzt-Cum)
* Mesai dışı = uyarı tetikleyici (Brief Sync v7.12 ile 🌙 etiketi)
* Hafta sonu = mesai dışı sayılır
* Tüm scheduled task'lar bu saatlere göre cron'lanmış


________________


3. SİSTEM MİMARİSİ
3.1 Üç Katman
┌─────────────────────────────────────────────────────────────┐
│                    SUNUM KATMANI                             │
│  ┌─────────────────────┐  ┌────────────────────────────────┐│
│  │ Slack Canvas        │  │ GitHub Pages Dashboard         ││
│  │ F0B1B6XUD44         │  │ bensenoint.github.io/dashboard/││
│  │ (canlı takip)       │  │ (analitik panel)               ││
│  └─────────────────────┘  └────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ (her 30 dk push)
                              │
┌─────────────────────────────────────────────────────────────┐
│                   İŞ MANTIĞI KATMANI                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  8 Scheduled Skill (Cron-tabanlı)                       ││
│  │  • benseno-brief-sync (v7.13) — :15/:45 hafta içi      ││
│  │  • benseno-gunluk-performans (v7.9) — 07:50 hafta içi  ││
│  │  • benseno-haftalik-retrospektif (v7.6) — Cuma 17:00   ││
│  │  • benseno-aylik-strateji (v7.5) — Ay sonu 17:00       ││
│  │  • benseno-onboarding (v7.7) — Manuel                  ││
│  │  • benseno-production-launch-reset — One-time          ││
│  │  • [DISABLED] benseno-saatlik-ozet (v6.0)              ││
│  │  • [DISABLED] benseno-gunaydin-dm (v6.0)               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ MCP API çağrıları
                              │
┌─────────────────────────────────────────────────────────────┐
│                    VERİ KATMANI                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐│
│  │ Slack    │  │ Gmail    │  │ Calendar │  │ Drive        ││
│  │ Business+│  │ Workspace│  │ (Görkem) │  │ (Görkem)     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘│
│                                                              │
│  Local Files:                                                │
│  • marka_stats.json (E3 veri)                                │
│  • .github-pat (GitHub Contents API token)                   │
│  • .dashboard-auth-hash (SHA-256 şifre hash)                 │
└─────────────────────────────────────────────────────────────┘
3.2 Brief Yaşam Döngüsü (Lifecycle)
1. EDİTÖR BRIEF AÇAR
   ↓
   Marka kanalında (örn #marka-bauhaus) Slack Workflow Builder
   ile form doldurur. Form 7 alan içerir:
   🎀 İş, ⏰ Süre, 👷 Kim, 🏷️ Tip, 🔄 Akış, 🔗 Ref, 💬 Not
   (📎 Dosya opsiyonel — Workflow form'un içinde)
   ↓
2. BRIEF SYNC YAKALAR (max 30 dk gecikme)
   ↓
   :15 ve :45'te skill çalışır:
   • Slack'i tarar (yeni 🎀 İş: ile başlayan mesajlar)
   • Brief'i parse eder
   • Marka tespiti (kanal adından)
   • Departman tespiti (atanan kişilerden)
   • Otomatik öncelik hesabı (deadline'dan, v7.12)
   • Geçmiş tarih / saat eksik / mesai dışı kontrolleri
   • Marka davranış kıyaslama (v7.13 E3, silent mode 1 Haziran'a kadar)
   • Akıllı atama (@auto varsa Smart Assign)
   ↓
3. CANVAS'A YAZILIR
   ↓
   F0B1B6XUD44 Canvas full replace:
   • İş Yükü tabloları (3 dept)
   • Aktif İşler tablosu (yeni satır)
   • Tamamlanan İşler tablosu (değişmez)
   ↓
4. DM + CALENDAR + DASHBOARD
   ↓
   • Atanan kişiye DM: "Yeni iş aldın"
   • Google Calendar'a event (öncelik rengiyle)
   • Dashboard HTML'ine EMBEDDED_DATA inject + GitHub push
   ↓
5. TASARIMCI İŞE BAŞLAR
   ↓
   Brief mesajına 🎨 (Tasarım) / ✍️ (Editör) / 🤖 (AI) reaction
   ekler. Brief Sync sonraki run'da algılar.
   Canvas'ta durum: ⏳ Sırada → 🎨 Tasarımda
   ↓
6. REVİZYON DÖNGÜSÜ
   ↓
   Tasarımcı tamamlayınca 👀 ekler (Revizede)
   Müşteri yorum verince → tasarımcı tekrar 🎨 ekler (revize başla)
   Bu döngü tekrarlanır. Her 👀 → 🎨 geçişi revizyon sayısını +1 yapar.
   ↓
7. TAMAMLAMA
   ↓
   Atanan(lar) ✅ verince Canvas'tan Tamamlanan tablosuna taşınır.
   Süre hesaplanır (ilk 🎨'dan son ✅'a kadar olan ⛔ olmayan süre)
   Memnuniyet (⭐+sayı) varsa kaydedilir.
   Ders (🎓) varsa Lessons Learned Canvas'a yazılır.
   ↓
8. RAPORLAMA
   ↓
   Sabah Raporu (07:50) — 5 yönetici DM + 16 günaydın
   Haftalık (Cuma 17:00) — kanal mesajı + Cansu özel DM
   Aylık (ay sonu) — 5 yönetici stratejik özet
3.3 Üç Ana Bileşen
Bileşen
	Konum
	Görev
	Slack Canvas
	F0B1B6XUD44 (#benseno-grafik'e bağlı)
	Tüm aktif + tamamlanan brief'lerin merkezi tablosu
	Brief Sync Skill
	~/Documents/Claude/Scheduled/benseno-brief-sync/SKILL.md
	Slack ↔ Canvas senkronizasyonu, her 30 dk
	Dashboard
	bensenoint.github.io/dashboard/
	Analitik panel, 6 sekme, GitHub Pages
	

________________


4. SABİT VERİLER
4.1 Slack ID Sabitleri
# Canvas
CANVAS_ID = "F0B1B6XUD44"  # Ana Canvas
BRAND_BOOK_CANVAS_ID = "F0B2ANKBBFV"  # Marka Kitabı
LESSONS_LEARNED_CANVAS_ID = "F0B2H49SXPC"  # Lessons Learned
TEMPLATES_CANVAS_ID = "F0B2F2REETG"  # Şablonlar


# Kanallar
GRAFIK_CHANNEL_ID = "C02SZRJGY0M"  # #benseno-grafik (ana rapor kanalı)
BAUHAUS_CHANNEL_ID = "C4Y43AW2E"   # #marka-bauhaus (örnek marka kanalı)


# Workspace
WORKSPACE_ID = "T4Y3R6RAN"  # Benseno Slack workspace


# Bot
WORKFLOW_BOT_NAME = "Yeni Brief Aç"  # Slack Workflow bot


# Timezone
TIMEZONE = "Europe/Istanbul"  # UTC+3
4.2 39 Marka × Kanal Mapping
Brief Sync'in kanal adından markayı türetmesi için kritik. Bir brief hangi marka kanalında açılırsa o markaya ait sayılır.


marka-bauhaus: Bauhaus
marka-beta: Beta
marka-cimporglobal: Cimporglobal
marka-cureffect: Cureffect
marka-efor-ofçay: Efor (Ofçay)
marka-egosport: Egosport
marka-gursoy: Gürsoy
marka-hasvet: Hasvet
marka-hendex: Hendex
marka-jnj: JNJ
marka-jnj-acuvue-me: JNJ Acuvue ME
marka-jnj-vision-tr: JNJ Vision TR
marka-jungleous: Jungleous
marka-kmr-amos: KMR Amos
marka-kmr-copic: KMR Copic
marka-kmr-lamy: KMR Lamy
marka-kmr-marshmallow: KMR Marshmallow
marka-kmr-max: KMR Max
marka-kmr-panfix: KMR Panfix
marka-kmr-serve: KMR Serve
marka-kuzeypet: Kuzeypet
marka-kzy-bark: KZY Bark
marka-kzy-everclean: KZY Everclean
marka-kzy-ferplast: KZY Ferplast
marka-kzy-flamingo: KZY Flamingo
marka-kzy-simplesolution: KZY Simple Solution
marka-kzy-supreme: KZY Supreme
marka-kzy-vetsbest: KZY Vet's Best
marka-marmaraholding: Marmara Holding
marka-muffik: Muffik
marka-polisan: Polisan
marka-preby: Preby
marka-splenda: Splenda
marka-tour2america: Tour2America
marka-vdm-petdent: VDM Petdent

Hariç tutulan kanallar:


* *-editors suffix'li (örn #marka-bauhaus-editors) — sadece editör koordinasyonu
* *-faq suffix'li (örn #marka-bauhaus-faq) — soru-cevap kanalı
4.3 Önemli Dosya Yolları
# Skill'ler
~/Documents/Claude/Scheduled/benseno-brief-sync/SKILL.md
~/Documents/Claude/Scheduled/benseno-gunluk-performans/SKILL.md
~/Documents/Claude/Scheduled/benseno-haftalik-retrospektif/SKILL.md
~/Documents/Claude/Scheduled/benseno-aylik-strateji/SKILL.md
~/Documents/Claude/Scheduled/benseno-onboarding/SKILL.md
~/Documents/Claude/Scheduled/benseno-production-launch-reset/SKILL.md


# Dashboard
~/Documents/Claude/Artifacts/benseno-tasarim-panosu/index.html  # Live artifact
~/Documents/Claude/Projects/Tasarım Takvimi/github-prep/dashboard/index.html  # Deploy klasörü
~/Documents/Claude/Projects/Tasarım Takvimi/github-prep/dashboard/marka_stats.json


# Data dosyaları
~/Documents/Claude/Projects/Tasarım Takvimi/marka_stats.json
~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat
~/Documents/Claude/Projects/Tasarım Takvimi/.dashboard-auth-hash
~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat-created
4.4 Renk Paleti (Sistem genelinde tutarlı)
/* Öncelik renkleri */
--priority-red:    #d93025;  /* 🔴 Acil */
--priority-orange: #f29900;  /* 🟠 Yüksek */
--priority-yellow: #fbbc04;  /* 🟡 Normal */
--priority-green:  #34a853;  /* 🟢 Düşük */


/* Brand renkleri */
--primary:  #2962ff;  /* Mavi — ana */
--secondary: #9333ea; /* Mor — vurgu */
--accent: #ec4899;    /* Pembe — vurgu 2 */


/* Sistem renkleri */
--text:     #1d1f23;
--muted:    #6b7180;
--bg-light: #f8fafc;
--success:  #34a853;
--warn:     #f29900;
--danger:   #d93025;


/* Google Calendar Event Renkleri (Color ID) */
priority-red:    11 (Tomato)
priority-orange:  6 (Tangerine)
priority-yellow:  5 (Banana)
priority-green:   2 (Sage)
4.5 SLA ve Stale Eşikleri
# SLA hedefleri (brief'in tamamlanması beklenen süre)
sla_hedef:
  acil_4h:    "🔴 Acil için 4 saat hedef"
  yuksek_8h:  "🟠 Yüksek için 8 saat hedef"
  normal_24h: "🟡 Normal için 24 saat hedef"
  dusuk_esnek: "🟢 Düşük için esnek"


# Stale eşiği (kaç gün hareketsiz kalırsa "stale" sayılır)
stale_esik:
  red_kirmizi:  1   # gün
  orange_turuncu: 3 # gün
  yellow_sari:  7   # gün
  green_yesil:  14  # gün


# Kapasite sınırları
max_aktif_per_kisi: 6
max_acil_per_kisi: 2
denge_uyari_esigi: 3  # 2 kişi arasında 3+ iş farkı = uyarı

________________


5. SLACK WORKFLOW BUILDER — Brief Açma Formu
5.1 Form Yapısı (v7.13 — Öncelik alanı yok)
Slack Workflow Builder'da kurulu, her marka kanalında bookmark olarak ekli. Adı: 📋 Yeni Brief Aç.


Trigger: Marka kanalında bookmark'a tıkla VEYA /yeni-brief slash command (opsiyonel).


Form alanları (7 alan):


form_alanlari:
  - id: is_ozeti
    label: "🎀 İş"
    type: short_text
    required: true
    placeholder: "Örn: Bahar kampanyası 3 IG post"
    max_length: 80


  - id: sure
    label: "⏰ Süre"
    type: datetime
    required: true
    description: "📌 Geçmiş tarih girersen sistem uyarı eder. Aynı gün teslim için saat de gir (HH:MM). Mesai içi (08:00–17:30) tercih edilir."


  - id: kim
    label: "👷 Kim"
    type: multi_users_select
    required: true
    description: "Multi-user picker. @auto yazılırsa Smart Assign tetiklenir."


  - id: tip
    label: "🏷️ Tip"
    type: select
    required: false
    options:
      - "Sosyal Medya Post"
      - "Banner"
      - "Karusel"
      - "Video Cut"
      - "Print"
      - "Logo Çalışması"
      - "Diğer"


  - id: akis
    label: "🔄 Akış"
    type: radio  # ÖNEMLİ: single-choice, multi-select DEĞİL
    required: false
    options:
      - "● Paralel — hepsi aynı anda"
      - "→ Sıralı — seçim sırasına göre tek tek"


  - id: ref
    label: "🔗 Ref"
    type: short_text
    required: false
    placeholder: "URL: müşteri brief, marka kitabı, önceki iş"


  - id: not
    label: "💬 Not"
    type: long_text
    required: false
    placeholder: "Müşterinin özel ricaları, dikkat detayları"


  - id: dosya
    label: "📎 Dosya"
    type: file_upload
    required: false
    max_files: 5
    max_size_per_file: 52428800  # 50 MB
    accept: ["png", "jpg", "jpeg", "pdf", "ai", "psd", "fig", "sketch"]
5.2 Workflow Step 2: Send Message to Channel
Form gönderildikten sonra workflow şu mesajı marka kanalına atar:


🎀 İş: {{İş}}
⏰ Süre: {{Süre}}
👷 Kim: {{Kim}}


🏷️ Tip: {{Tip}}
🔄 Akış: {{Akış}}
🔗 Ref: {{Ref}}
💬 Not: {{Not}}


🐷 Kimden: {{Kimden}}  # Otomatik: form'u açan kullanıcı

Dikkat:


* Boş alanlar için Branch step kullan: alan boşsa o satırı atla
* {{Kimden}} otomatik Slack tarafından doldurulur
* 📎 Dosya alanı varsa Slack attachment olarak mesaja eklenir
5.3 Workflow Step 3: AI Response (Opsiyonel)
Brief açıldıktan hemen sonra Yeni Brief Aç bot, brief açana DM atar: "Brief'in #marka-bauhaus kanalında açıldı. Brief Sync :15/:45'te yakalayacak."
5.4 Manuel Brief Format (Fallback)
Workflow erişimi yoksa veya hızlı kayıt için marka kanalına direkt mesaj:


📋 İş özeti
⏰ Süre: 21 Mayıs 17:00
👷 Kim: @Aylin, @Hasan
🏷️ Tip: Sosyal Medya Post
🔄 Akış: Paralel
🔗 Ref: https://drive.google.com/...
💬 Not: Detaylar mail thread'inde

Format kuralları:


* İlk karakter mutlaka 📋 (Tasarım) veya ✍️ (Editör) veya 🤖 (AI) emoji'si
* Her alan ayrı satırda, label'i emoji ile başlar
* Marka kanal adından otomatik türetilir, mesajda yazmaya gerek yok


________________


6. VERİ YAPILARI
6.1 Slack Canvas Yapısı (F0B1B6XUD44)
Canvas markdown formatında, full replace ile her sync'te yeniden yazılır.


Canvas üst yapı:


> 💡 **3 departmanın merkezi iş takip noktası** · 16 kişi · v7.13 · ...


## 📊 Canlı Dashboard Linkleri (her 30 dk · :15 ve :45)


🔒 [Birleşik Dashboard](https://bensenoint.github.io/dashboard/) · 🏷️ [Marka Kitabı](...) · 🎓 [Lessons Learned](...) · 📐 [Şablonlar](...)


🔄 Üretildi: {{ISO timestamp TR}} · {{durum notu}}

Tasarımcı İş Yükü Tablosu:


## 🎨 Tasarımcı İş Yükü (7 kişi)


|Tasarımcı|Aktif|Acil|Lead|Yoğunluk|
|  ---  |  ---  |  ---  |  ---  |  ---  |
|<@U0AN6DD79M0> Aylin Tozkoparan|0|0|0|🟢 Müsait|
|<@U06J26R1XCJ> Aykut Arslan|2|1|0|🟡 Normal|
|<@U09BFPBKQG7> Hasan Serdar Arda|3|0|1|🟡 Normal|
|<@U0B3K2WE7SB> Pelin Özdemir ✨|1|0|0|🟢 Müsait (yeni — 15May katıldı)|
|<@U055EDESLSE> İpek Akdeniz 🎯|0|0|0|🟢 Müsait|
|<@U0AK8U7L57F> İrem Özkan|0|0|0|🟢 Müsait|
|<@U08HLMHTGEL> Serhat|0|0|0|🟢 Müsait|


**Eşikler:** 🟢 0-1 · 🟡 2-3 · 🟠 4-5 · 🔴 6+ · **🎯 = Lead · ✨ = Yeni katılan**

Aynı yapı Editör İş Yükü (8 kişi) ve AI Teknolojileri İş Yükü (1 kişi) için tekrarlanır.


Aktif İşler Tablosu (en kritik):


## 📋 Aktif İşler (3 departman · 12 brief) · STALE eşiği: 🔴=1g · 🟠=3g · 🟡=7g · 🟢=14g


|#|🔔|🏷️|Marka|İş|Atanan|⏰ Süre|📊 Durum|🔁|🕐 Geçmiş|🔗|
|  ---  |...|
|1|🔴|Sosyal Medya Post|Bauhaus|Bahar kampanyası 3 IG|<@U0AN6DD79M0> Aylin → <@U09BFPBKQG7> Hasan (sıralı)|21May 17:00 TR (SLA 4h)|🎨 Tasarımda|1|⏳18May08:15→🎨18May09:30→👀19May11:00→🎨19May14:00|[mesaj](https://...)|
|2|🟠|Banner|JNJ Vision TR|Web slider hero|<@U06J26R1XCJ> Aykut|22May 12:00 TR|⏳ Sırada|0|⏳18May08:15|[mesaj](https://...)|

Sütun açıklamaları: | # | Sütun | İçerik | |---|---|---| | # | Brief no | Otomatik 1'den artar (yeniden açma ile değişmez) | | 🔔 | Öncelik | 🔴/🟠/🟡/🟢 (otomatik veya yönetici override) | | 🏷️ | Tip | Form'dan | | Marka | Marka | Kanal'dan türetilmiş | | İş | İş özeti | Form'dan, max 60 karakter göster | | Atanan | Atanan kişi(ler) | <@USER_ID> İsim → ... formatında, → veya ∥ ile akış | | ⏰ Süre | Deadline | TR formatlı + SLA notu + uyarı etiketi (⚠️ GEÇMİŞ / ⏰ Saat eksik / 🌙 Mesai dışı) | | 📊 Durum | Mevcut durum | ⏳ Sırada / 🎨 Tasarımda / ✍️ Editörde / 🤖 AI'da / 👀 Revizede / ⛔ Engel | | 🔁 | Revizyon | Tamsayı (0+) | | 🕐 Geçmiş | Durum zinciri | ⏳tarih→🎨tarih→👀tarih→🎨tarih formatında | | 🔗 | Slack link | Brief'in orijinal Slack mesajı linki |


Tamamlanan İşler Tablosu (farklı yapı!):


## ✅ Tamamlanan İşler (son 90 gün)


|#|Marka|İş|Atanan|Deadline|Başlangıç|Bitiş|Süre|Rev|Gecikme Nedeni|⭐|🔗|
|  ---  |...|
|45|Bauhaus|Mart kampanyası 5 IG|<@U0AN6DD79M0> Aylin|10May 17:00|10May 09:00|10May 16:30|7.5h|2|—|⭐4.5|[mesaj](...)|
|44|JNJ|Acuvue lens lansman banner|<@U06J26R1XCJ> Aykut|08May 12:00|07May 14:00|08May 14:30|24.5h|1|Revizyon|⭐4.0|[mesaj](...)|

KRİTİK: Tamamlanan tablosu farklı sütun yapısına sahip. Brief Sync parser bunu aktif tablosuyla karıştırmamalı.


Footer (sync metadata):


---


> 🔄 **Son sync:** {{TR timestamp}} · `LAST_SYNC_TS={{unix_ts}} ARCHIVE_CANVAS_ID=null` **Sistem :15 ve :45'te otomatik güncellenir.** Kanal: <#C02SZRJGY0M> · 🔒 Dashboard: https://bensenoint.github.io/dashboard/

LAST_SYNC_TS kritik bir değer — Brief Sync sonraki run'da bu Unix timestamp'ten sonraki Slack mesajlarını arar. Production launch için Pzt 00:00 TR (1779051600) olarak set edilir.
6.2 marka_stats.json (v7.13 E3)
Konum: ~/Documents/Claude/Projects/Tasarım Takvimi/marka_stats.json GitHub deploy: github-prep/dashboard/marka_stats.json


Tam şema:


{
  "version": "v7.13",
  "schema_version": 1,
  "description": "Benseno marka davranış öğrenmesi — her marka için ortalama deadline ve tamamlama süresi istatistikleri.",
  "last_updated": "2026-05-22T17:00:00+03:00",
  "last_updated_unix": 1779462000,
  "next_refresh": "2026-05-29T17:00:00+03:00",
  "config": {
    "min_n_for_uyari_active": 3,
    "min_n_for_high_confidence": 10,
    "deviation_threshold_mult": 1.0,
    "metric_lookback_days": 90,
    "trend_window_weeks": 4,
    "active_from": "2026-06-01T00:00:00+03:00",
    "current_mode": "silent_log_only",
    "mode_description": "silent_log_only: log only, no DM. active: full DM + dashboard tags."
  },
  "global": {
    "total_brands_in_mapping": 39,
    "brands_with_any_data": 0,
    "brands_with_uyari_active": 0,
    "brands_with_high_confidence": 0,
    "data_collection_start": "2026-05-18T08:15:00+03:00"
  },
  "brands": {
    "Bauhaus": {
      "n": 12,
      "lookback_days": 90,
      "median_deadline_days": 1.5,
      "mad_deadline_days": 0.4,
      "mean_deadline_days": 1.7,
      "std_deadline_days": 0.5,
      "median_complete_days": 1.8,
      "mean_complete_days": 1.9,
      "deadline_vs_real_delta": -0.3,
      "confidence": "high",
      "last_brief_date": "2026-06-12",
      "trend_4w": [1.4, 1.6, 1.5, 1.3],
      "note": "Bauhaus dergi yoğun + tutarlı (düşük MAD)"
    },
    "JNJ Vision TR": { ... },
    "Splenda": { ... }
  }
}

confidence değerleri:


* low — n < 3 (uyarı yok, tabloda görünmez)
* medium — 3 ≤ n < 10 (uyarı var, "(düşük güven)" notu ile)
* high — n ≥ 10 (tam uyarı)


current_mode geçişi:


* Başlangıç: silent_log_only
* Geçiş tetikleyici: now >= config.active_from (1 Haziran 17:00)
* Geçişi yapan: Haftalık Retrospektif task (Cuma 17:00)
* Geçiş aksiyonu: current_mode = "active" + marka_stats.json overwrite + Cansu DM "🎉 E3 active moda geçti"
6.3 Brief Sync Mesaj Parser (5 katman)
Brief Sync, brief'leri parse ederken 5 farklı formatı destekler. Sırayla dener:


def parse_brief(mesaj_metni):
    """5 katmanlı parser. İlk eşleşen format kullanılır."""


    # v7.12 — Workflow format (Öncelik'siz)
    if matches_v7_12_workflow(mesaj_metni):
        return parse_v7_12(mesaj_metni)


    # v7.11 — Workflow format (Öncelik'li, fallback)
    if matches_v7_11_workflow(mesaj_metni):
        return parse_v7_11(mesaj_metni)  # Öncelik'i okur, override olarak set eder


    # v7.10 — Yalın manuel format ("📋 İş özeti")
    if mesaj_metni.startswith(('📋 İş özeti', '✍️ İş özeti', '🤖 İş özeti')):
        return parse_v7_10(mesaj_metni)


    # v7.9 — Marka adı sonunda format ("📋 İş özeti [Marka]")
    if matches_v7_9(mesaj_metni):
        return parse_v7_9(mesaj_metni)


    # v7.8 — Marka adı başta format ("📋 [Marka] İş özeti")
    if matches_v7_8(mesaj_metni):
        return parse_v7_8(mesaj_metni)


    # v7.7 ve öncesi — Flat format ("📋 İş, 🔴, deadline, @kişi")
    if mesaj_metni.startswith(('📋', '✍️', '🤖')):
        return parse_v7_7_flat(mesaj_metni)


    return None  # Tanınmayan format
6.4 Slack Mesaj Format Örneği (v7.12 Workflow Output)
Slack bot tarafından yazılan gerçek mesaj formatı (parser bunu okur):


🎀 İş: Bahar kampanyası 3 IG post serisi
⏰ Süre: May 21st, 2026 at 2:00 PM UTC
👷 Kim: @Aylin Tozkoparan, @Hasan Serdar Arda




🏷️ Tip: Sosyal Medya Post
🔄 Akış: ● Paralel — hepsi aynı anda
🔗 Ref: https://drive.google.com/drive/folders/...
💬 Not: Bauhaus mart kampanyası ile aynı görsel ton + tipografi




🐷 Kimden: <@U09BZHR25NG|Eda Tireli>

Önemli: Slack saat formatını UTC olarak verir. Parser TR'ye çevirmeli (+3 saat).
6.5 Geçmiş Sütunu (Status Timeline) Format
⏳18May08:15→🎨18May09:30→👀19May11:00→🎨19May14:00→👀20May10:00→✅20May16:30

Her durum değişikliği → ile ayrılır. Tarih format: DDMmmHH:MM (örn: 18May08:15).


Revizyon sayısı hesabı:


revizyon_sayisi = geçmiş_metnindeki "👀→🎨" geçiş sayısı

Çalışma süresi hesabı:


def calculate_calisma_saati(gecmis):
    """Geçmiş'teki tüm 🎨 aralıkları toplanır.
    Son aralık ✅ ile bitmemişse şu ana kadar hesaplanır.
    ⛔ aralıkları DAHIL EDİLMEZ."""
    total_seconds = 0
    state = parse_history(gecmis)
    for i, event in enumerate(state):
        if event.emoji == "🎨":
            # Bir sonraki durum değişikliğine kadar
            next_event = state[i+1] if i+1 < len(state) else now()
            if next_event.emoji != "⛔":
                total_seconds += (next_event.ts - event.ts)
    return total_seconds / 3600  # Saat

________________


7. 8 SCHEDULED TASK SPESİFİKASYONU
7.1 benseno-brief-sync (v7.13) — ANA SKILL
Cron: 15,45 8-17 * * 1-5 (Hafta içi, mesai içi, her 30 dk) Süre: ~55-150 saniye Maliyet: ~$1.8-4.0/gün
Akış (13 adım)
1. Canvas oku (slack_read_canvas F0B1B6XUD44)
   → markdown_content çıkar
   → footer'dan LAST_SYNC_TS oku (Unix timestamp)


2. Yeni brief'leri ara
   slack_search_public query:
     "in:#marka-* :clipboard: OR :writing_hand: OR :robot_face: OR :ribbon:"
     after: {LAST_SYNC_TS - 60sn buffer}
     limit: 30
   * Editor/FAQ kanallarını filtre dışında bırak


3. Her brief için 5 katmanlı parser dene (v7.12 → v7.11 → v7.10 → v7.9 → v7.8 → v7.7 flat)


4. Brief alanlarını çıkar:
   - is_ozeti, deadline, atananlar, tip, akis, ref, not, kimden
   - Marka: kanal_adından otomatik
   - Departman: ilk satır emoji'sinden veya atanan heuristic'ten


5. UTC → TR çevrimi
   "May 21st, 2026 at 2:00 PM UTC" → "21 Mayıs 2026 17:00 TR"
   Saatsiz → "21 Mayıs 2026 (tüm gün)"


6. Otomatik öncelik hesabı (v7.12)
   delta_hours = (deadline_unix - now_unix) / 3600
   - delta ≤ 8h     → 🔴 Acil
   - 8 < delta ≤ 24 → 🟠 Yüksek
   - 24 < delta ≤ 72 → 🟡 Normal
   - delta > 72     → 🟢 Düşük
   - delta ≤ 0      → 🔴 + flag_past_deadline=true


7. Uyarı flag'leri kontrol et (v7.12)
   - flag_past_deadline: deadline < now AND not flag_past_deadline_confirmed
   - flag_saat_eksik: deadline.date == today AND saat girilmemiş
   - flag_after_hours: saat < 08:00 OR > 17:30 OR hafta sonu


8. Marka davranış kıyaslama (v7.13 E3)
   marka_stats.json oku:
   - current_mode == "silent_log_only" AND now >= active_from →
     current_mode = "active" + dosyayı güncelle
   - Bu brief'in markası için n ≥ 3 ise:
     - delta_deviation = abs(deadline_days - median) / mad
     - delta_deviation > 1.0 →
       - deadline_days < median - 1×MAD → flag_marka_yetersiz_sure
       - deadline_days > median + 1×MAD → flag_marka_anormal_uzun
   - mode == active ise: Şablon 27/28 DM gönder
   - mode == silent ise: sadece log'a yaz


9. Akıllı atama (P7-C1 Smart Assign)
   Eğer 👷 Kim = "@auto" veya boş:
   - Her uygun departman üyesi için skor hesapla:
     score = 0.4 × musaitlik + 0.3 × marka_uzmanligi + 0.2 × is_tipi_uyumu + 0.1 × stil_match
   - En yüksek skorlu kişiyi öner: thread'e "Atayalım mı: @{kişi} (skor: {score})"
   - 30 dk içinde ✅ reaction beklenir
   - Onay verilirse atama yapılır, brief'e devam edilir


10. P7-C2 Thread Özet (AI)
    Brief'in thread'ini oku, Haiku ile özetle.
    Canvas'ta "Thread Özetleri" bölümüne ekle.


11. P7-C3 Revizyon Tahmini
    Marka × iş tipi × tasarımcı kombinasyonuna göre tahmini revizyon sayısı.
    Canvas tablosunda "🔁 (~tahmin)" notu eklenir.


12. Canvas full replace
    !! section_id KULLANMA, tüm Canvas'ı full replace yap !!
    !! H1 başlığı koyma — title ayrı field !!
    !! Tamamlanan tablosu farklı sütun yapısı — karıştırma !!


13. Yan etkiler
    - Atanan(lar)a DM ("Yeni iş aldın: ...")
    - Google Calendar event (öncelik renk ID'siyle)
    - Dashboard HTML EMBEDDED_DATA inject + GitHub push
    - GitHub push: PAT ile Contents API, dashboard/index.html ve marka_stats.json
    - Hata kurtarma: 5 parser fail → editöre Şablon 8 DM
Çıktı Log Formatı
Brief Sync v7.13 OK · :15/:45
Format parser: v7.12_workflow=3 v7.11_workflow=0 v7.10=0 v7.9=0 v7.8=0 eski=0
Marka türetme: kanal=3 çelişki=0
Departman: ilk_satır=0 heuristic=3 belirsiz=0
UTC→TR çeviri: 3 brief
🎨 1/0/3 · ✍️ 0/0/0 · 🤖 0/0/0
v7.12 Otomatik öncelik: 🔴=1 🟠=1 🟡=1 🟢=0
v7.12 Yön. override: 🔴=0 🟠=0 🟡=0 🟢=0
v7.12 Geçmiş tarih: yeni=0 teyitli=0 bekleyen=0
v7.12 Saat eksik (aynı gün): 0 · Mesai dışı: 0
v7.13 Marka kıyas: mode=silent_log_only yetersiz_süre=0 anormal_uzun=0 yeterli_veri_yok=3 high_conf=0 medium_conf=0
SLA: 4h=1 8h=1 24h=1 · GitHub: pushed abc123f
PAT: 28/90
🔗 Ref:3 · 📎 Dosya:0 · 💬 Not:2
🚫 Blocker:0 · ⏰ Sessiz:0 · 🔄 Sıralı:1
P7-C1/C2/C3 · 🔒 Force:0 · 👻 Ghost:0
Thread→Parent:0 · 🔴+@auto:0 · Eren OOO:0
Pelin atama:1
Dashboard: https://bensenoint.github.io/dashboard/
Şablonlar (28 toplam)
#
	Adı
	Hedef
	Tetikleyici
	1-21
	Çeşitli reaction & uyarı şablonları
	DM/Thread
	Çeşitli
	22
	Marka çelişki
	Editör DM
	Mesajda yazan marka kanal adıyla uyumsuz
	23
	Departman belirsiz
	Cansu+İpek+erdem DM
	Atananlardan dept tespit edilemedi
	24
	Geçmiş tarih thread cevabı
	Brief thread
	deadline < now
	25
	Geçmiş tarih DM
	Brief açana (🐷)
	deadline < now
	26
	Saat eksik DM
	Brief açana
	aynı gün + saat yok
	27
	Yetersiz süre DM (E3)
	Brief açana
	deadline < median - 1×MAD (mode=active)
	28
	Anormal uzun DM (E3)
	Brief açana
	deadline > median + 1×MAD (mode=active)
	7.2 benseno-gunluk-performans (v7.9) — Sabah Raporu
Cron: 50 7 * * 1-5 (Hafta içi 07:50) Süre: ~120-180 saniye Çıktı: 3 farklı (kanal mesajı + 5 yönetici DM + 16 günaydın DM)
Akış (13 adım)
1. Canvas oku (multi-assignee parse)


2. Bugünün tarihini belirle (TR format: "5 Mayıs 2026 Çarşamba")


3. OOO listesi al (16 kişi)
   Google Calendar list_events query:
   - TR keyword'leri: OOO, izin, izinli, izindeyim, yıllık izin, yarım gün izin,
     annelik izni, babalık izni, tatil, tatilde, raporlu, rapor, raporda,
     doktor, sağlık, hastayım, hasta
   - EN: vacation, sick, leave, PTO, doctor
   ! WFH OOO SAYILMAZ — SLA durmaz, DM gider


4. Dashboard URL'si sabit
   https://bensenoint.github.io/dashboard/ (şifre korumalı)


5. Veri analizi (son 7 gün)
   a. Ekip geneli — 3 dept başına aktif/tamamlanan/saat, geciken%, stale
   b. Kişi başına (16 kişi) — Lead/Contributor/Reviewer breakdown
      İpek için ek: 👑 Tasarım Yön. görevleri
      Cansu için ek: 👑 Direktör görevleri
      erdem için ek: 🏅 Editör Yön. görevleri
      Pelin için ek: 🎓 Onboarding Day N/5 (eğer onboarding sürecinde)
   c. Marka bazlı (top 5-7) — cross-dept %, kişi dağılımı


5b. Tarihi Şüpheli Brief'ler tespiti (v7.8)
    A) Geçmiş tarih (henüz teyit edilmemiş)
    B) Aynı gün ama saat girilmemiş
    C) Mesai dışı deadline (yumuşak bilgi)


5c. Marka Hız Trendi (v7.9 — E3)
    marka_stats.json oku → mode kontrolü
    Active modda: hızlanan/yavaşlayan markalar
    Silent modda: kısa bilgi notu


6. Pazartesi check + Stale brief listesi


7. Haiku ile aksiyon önerileri (5 yönetici için ayrı)
   - Görkem (GM): stratejik karar gerektiren durumlar
   - Reyhan (GMY): operasyonel acil + kapasite + müşteri
   - Cansu (Direktör): 3 dept'ten 1 dikkat kişisi + müşteri-editör + kalite skoru
   - İpek (Tasarım Yön): Pelin onboarding + yüksek rev tasarımcı + blocker
   - erdem (Editör Yön): kalite düşen editör + mentor + müşteri yanıt
   Her aksiyon: spesifik isim + konu + tahmini süre


8. ÇIKTI 1 — Kanal mesajı (#benseno-grafik)
   Bölümler:
   - Genel özet
   - 3 dept yoğunluk
   - 🚩 Tarihi Şüpheli Brief'ler (varsa, v7.8)
   - Dashboard URL şifre uyarısı


9. ÇIKTI 2 — 5 yönetici DM (her birine rolüne özel)
   Bölümler:
   - A) Genel Bakış (dün ne oldu, bugün ne bekleniyor)
   - B) Yoğunluk + Risk (kim dolu, kim boş)
   - C) Bugün 3 Aksiyon (Haiku ile rolüne özel)
   - 🚩 Tarihi Şüpheli Brief'ler (departmana ait olanlar öne çıkar)
   - 📊 Marka Hız Trendi (sadece Cansu için detaylı, diğerlerine kısa özet)


10. ÇIKTI 3 — 16 kişiye günaydın DM
    Her kişiye kişisel:
    - Bugünkü aktif iş
    - Bugün deadline'lı brief'ler
    - Bu hafta tamamlanan + ortalama yıldız
    - Stratejik İş (marka tempo'suna göre yorumlandı)
    ! Pelin için ilk 5 gün: günaydın gönderme (onboarding bot zaten 09:30'da gönderiyor)


11. Custom KPI default'ları
    Dashboard EMBEDDED_DATA içine 6 önerilen KPI inject


12. Pazartesi haftalık özet (sadece Pzt günleri)
    Yöneticilerin DM'lerine ek bölüm: haftaya başlangıç metrikleri


13. Çıktı log
Yönetici DM Şablon Örneği (Cansu için)
☀️ Günaydın Cansu! · 18 Mayıs 2026 Pazartesi


📊 GENEL BAKIŞ
• Dün: 12 brief tamamlandı (Tasarım 7, Editör 4, AI 1)
• Bugün: 8 aktif brief (3 acil, 5 normal)
• Cuma: Eda T 5 brief yazdı (en yüksek)


⚖️ YOĞUNLUK + RISK
🎨 Tasarım:
  • Aylin 4 aktif (1 acil) — YOĞUN
  • Pelin 1 aktif — YENİ (onboarding Day 1)
  • Diğerleri 0-2
✍️ Editör:
  • Eda T 3 brief yazdı (Bauhaus odaklı)
  • erdem 1 brief yazdı + 0 atanan


🎯 BUGÜN 3 AKSİYON
1. Eda T'yi Bauhaus dergisi briefingi için 10:30'da call'a al — son brief'te 3 revizyon var, brief netliği için.
2. Aylin'in 4 aktif işini gözden geçir, en az 1'ini Hasan'a devret (denge).
3. Pelin'in onboarding ilerlemesini İpek ile 14:00'da kontrol et.


🚩 TARİHİ ŞÜPHELİ BRIEF'LER (3)
⚠️ Geçmiş tarih (1):
  • [#23] Bauhaus / banner · 2 gün geride · 🐷 Eda T — thread'de teyit bekleniyor


⏰ Saat eksik aynı gün (1):
  • [#31] Splenda / post · 👷 Aylin · 🐷 erdem


🌙 Mesai dışı deadline (1):
  • [#34] Hendex / banner · bugün 22:00


📊 MARKA HIZ TRENDİ (sadece sen görürsün)
Aktivasyon: silent_log_only
E3 sessiz mod — 1 Haziran'da aktif olur. Şu an 5 markada veri toplanıyor (Bauhaus, JNJ Vision TR, Splenda, KMR Lamy, Hendex).


🔗 Dashboard: bensenoint.github.io/dashboard/ (şifre: ekipten al)
7.3 benseno-haftalik-retrospektif (v7.6) — Haftalık Retro
Cron: 0 17 * * 5 (Cuma 17:00) Süre: ~180-300 saniye
Akış
1. Canvas oku, son 7 günün analizini yap


2. Mesaj gönder + Dashboard linki
   slack_send_message → #benseno-grafik
   "📊 Haftalık Retrospektif · {hafta no} · Sıkı bir haftaydı!"
   - Yıldız işler (en yüksek memnuniyet)
   - Dikkat noktaları (geciken/revizyonu yüksek)
   - Phase 7 metrikleri (Smart Assign kabul %, Revizyon tahmin doğruluğu, Force-Close kullanımı)
   - Gelecek hafta önerileri
   - Footer: bensenoint.github.io/dashboard/ link


3. marka_stats.json refresh (v7.6 — E3)
   a. Canvas Tamamlanan İşler tablosundan son 90 günlük brief'leri çek
   b. Her brief için: marka, brief_open, brief_complete, deadline_set
      → deadline_days, complete_days hesapla
   c. Marka bazında grupla
   d. Her marka için (n ≥ 1):
      - median + MAD (deadline + complete)
      - mean + std (deadline + complete)
      - delta = median_deadline - median_complete
      - confidence: n≥10=high, 3≤n<10=medium, n<3=low
      - trend_4w: kayan pencere son 4 haftanın median_complete_days
      - last_brief_date
   e. marka_stats.json güncelle:
      - last_updated, next_refresh
      - global sayaçlar
      - brands objesi yeniden yazılır
   f. Mode kontrolü: silent_log_only AND now >= active_from → active geçişi
   g. GitHub'a push: local marka_stats.json'ı github-prep/dashboard/'a kopyala + git push
   h. Cansu Direktör'e DM özet:
      "📊 Haftalık Marka Stats Refresh tamamlandı.
       Toplam izlenen: X marka. High conf: Y, Medium: Z, Low: W.
       Mode: {mode}. Sapan markalar: ..."


4. Eski Drive snapshot temizlik bildirimi (her Cuma — opsiyonel)


5. Hata kurtarma
7.4 benseno-aylik-strateji (v7.5) — Aylık Strateji
Cron: 0 17 25-31 * * (Ay sonu 17:00) Süre: ~300-450 saniye


5 yöneticiye kapsamlı stratejik özet:


* Marka kârlılık analizi (saat × marka)
* Kapasite forecast (gelecek ay)
* Trend grafikler (Chart.js olarak DM'de görsel)
* Strateji önerileri (Haiku ile)
7.5 benseno-onboarding (v7.7) — Manuel
Cron: Manuel only (yöneticinin başlatması gerekir) Tetikleyici: "Onboarding başlat: {Slack_ID} {İsim} {YYYY-MM-DD}"


5 günlük interaktif rehber. Her sabah 09:30'da yeni katılan üyeye DM:


Gün
	Konu
	DM içeriği
	Day 1
	Sistemi tanı
	Slack Canvas, Brief Sync, Dashboard URL
	Day 2
	Brief açma
	Workflow Builder kullanımı
	Day 3
	Reaction sistemi
	8 emoji + thread komutları
	Day 4
	Dashboard
	6 sekme tour
	Day 5
	Final
	Kılavuz PDF + sorular için kim'e DM
	7.6 benseno-production-launch-reset — One-time
fireAt: 2026-05-17T23:30:00+03:00 (Pazar gecesi) Çalıştıktan sonra auto-disable


Pazartesi 18 May launch öncesi Canvas temizliği:


1. Canvas full replace ile sıfır tablolar
2. LAST_SYNC_TS = 1779051600 (Pzt 00:00 TR)
3. #benseno-grafik'e "Clean-slate reset tamamlandı" mesajı
7.7 [DISABLED] benseno-saatlik-ozet
v6.0'da kullanılıyordu, v6.5'te Brief Sync içine entegre edildi. Geri yükleme yapma — duplicate mesaj olur.
7.8 [DISABLED] benseno-gunaydin-dm
v6.0'da kullanılıyordu, v6.5'te benseno-gunluk-performans'a entegre edildi.


________________


8. ALGORİTMALAR (Kod Düzeyinde Spesifikasyon)
8.1 Otomatik Öncelik Mapping (v7.12)
def calculate_oncelik(deadline_unix: int, now_unix: int) -> tuple[str, bool]:
    """
    Brief'in deadline'ından otomatik öncelik hesaplar.


    Returns:
        (oncelik_emoji, flag_past_deadline)
    """
    delta_hours = (deadline_unix - now_unix) / 3600


    if delta_hours <= 0:
        return ("🔴", True)  # Acil + GEÇMİŞ flag
    elif delta_hours <= 8:
        return ("🔴", False)  # Acil — 4h SLA
    elif delta_hours <= 24:
        return ("🟠", False)  # Yüksek — 8h SLA
    elif delta_hours <= 72:
        return ("🟡", False)  # Normal — 24h SLA
    else:
        return ("🟢", False)  # Düşük — esnek
8.2 Yönetici Reaction Override (v7.12)
YONETICI_IDS = {
    "U030C48PL23",  # Görkem
    "UD96GH76E",    # Reyhan
    "U4XCE3532",    # Cansu
    "U055EDESLSE",  # İpek
    "U02SZQDAFPF",  # erdem
}


OVERRIDE_EMOJI_MAP = {
    "red_circle": "🔴",
    "large_orange_circle": "🟠",
    "large_yellow_circle": "🟡",
    "large_green_circle": "🟢",
}


def apply_reaction_override(brief_reactions: list, current_oncelik: str) -> tuple[str, str]:
    """
    Yönetici reaction'larından öncelik override uygular.


    Returns:
        (oncelik_emoji, override_note)
        override_note: "🔴Yön15:30" formatında, yoksa None
    """
    # Yönetici override reaction'larını topla
    override_reactions = []
    for reaction in brief_reactions:
        emoji_name = reaction["name"]
        if emoji_name not in OVERRIDE_EMOJI_MAP:
            continue
        for user_id in reaction["users"]:
            if user_id in YONETICI_IDS:
                override_reactions.append({
                    "emoji": OVERRIDE_EMOJI_MAP[emoji_name],
                    "user_id": user_id,
                    "ts": reaction["ts"]  # Slack reaction timestamp
                })


    if not override_reactions:
        return (current_oncelik, None)


    # En son ekleyen yönetici kazanır (idempotent)
    latest = max(override_reactions, key=lambda r: r["ts"])
    override_emoji = latest["emoji"]
    override_user_short = get_user_short_name(latest["user_id"])  # "Yön" gibi
    override_time = format_time(latest["ts"])  # "15:30"


    note = f"{override_emoji}{override_user_short}{override_time}"
    return (override_emoji, note)
8.3 Smart Assign Skorlama (P7-C1)
def smart_assign_score(person: dict, brief: dict, completed_briefs: list) -> dict:
    """
    Bir tasarımcı/editör için bu brief'e uygunluk skoru hesaplar.


    Faktörler:
    - Müsaitlik (40%): Aktif iş sayısı az + SLA yüksek
    - Marka uzmanlığı (30%): Bu markada geçmiş + ortalama yıldız
    - İş tipi uyumu (20%): Bu tipte (örn banner) deneyim
    - Stil match (10%): Geçmiş işlerin estetik benzerliği (deneysel)


    Returns:
        {
            "score": 0-100 arası,
            "breakdown": {"musaitlik": 35, "marka": 28, "tip": 15, "stil": 8},
            "confidence": "high" | "medium" | "low",
            "warnings": []  # Pelin gibi yeni başlayanlarda boş veri uyarısı
        }
    """
    breakdown = {}
    warnings = []


    # 1. Müsaitlik (40%)
    aktif_is = person["aktif_brief_count"]
    if aktif_is == 0:
        breakdown["musaitlik"] = 40
    elif aktif_is >= 6:
        breakdown["musaitlik"] = 0  # Aşırı yoğun, aday değil
    else:
        breakdown["musaitlik"] = 40 * (1 - aktif_is/6)


    # 2. Marka uzmanlığı (30%)
    marka_briefs = [b for b in completed_briefs if b["marka"] == brief["marka"] and b["atanan"] == person["id"]]
    n_marka = len(marka_briefs)
    if n_marka == 0:
        breakdown["marka"] = 0
        warnings.append(f"Bu markada hiç deneyim yok")
    else:
        avg_star = sum(b.get("yildiz", 4) for b in marka_briefs) / n_marka
        breakdown["marka"] = 30 * (avg_star / 5) * min(n_marka/10, 1)


    # 3. İş tipi uyumu (20%)
    tip_briefs = [b for b in completed_briefs if b["tip"] == brief["tip"] and b["atanan"] == person["id"]]
    breakdown["tip"] = 20 * min(len(tip_briefs)/8, 1)


    # 4. Stil match (10%) — deneysel
    breakdown["stil"] = 10  # Şimdilik sabit, sonradan ML modeli


    total = sum(breakdown.values())


    if n_marka >= 5 and len(tip_briefs) >= 3:
        confidence = "high"
    elif n_marka >= 2 or len(tip_briefs) >= 2:
        confidence = "medium"
    else:
        confidence = "low"


    return {
        "score": round(total),
        "breakdown": breakdown,
        "confidence": confidence,
        "warnings": warnings
    }
8.4 Marka Davranış Öğrenmesi — Medyan + MAD Hesabı (v7.13 E3)
import statistics


def calculate_marka_stats(marka: str, completed_briefs: list) -> dict:
    """
    Bir marka için marka_stats.json'a yazılacak istatistikleri hesaplar.


    completed_briefs: son 90 günde tamamlanan brief'ler (bu markaya ait)
    """
    if not completed_briefs:
        return None


    # Brief'lerden değerler çıkar
    deadline_days_list = []
    complete_days_list = []


    for b in completed_briefs:
        # deadline_days: brief açılışında verilen süre
        deadline_set = b["deadline_set_unix"]
        brief_open = b["brief_open_unix"]
        deadline_days = (deadline_set - brief_open) / 86400  # gün cinsinden
        deadline_days_list.append(deadline_days)


        # complete_days: gerçek tamamlama süresi
        brief_complete = b["brief_complete_unix"]
        complete_days = (brief_complete - brief_open) / 86400
        complete_days_list.append(complete_days)


    n = len(completed_briefs)


    # Medyan + MAD
    median_dl = statistics.median(deadline_days_list)
    mad_dl = statistics.median([abs(x - median_dl) for x in deadline_days_list])


    median_cp = statistics.median(complete_days_list)
    # mad_cp = statistics.median([abs(x - median_cp) for x in complete_days_list])


    # Ortalama + Std
    mean_dl = statistics.mean(deadline_days_list)
    std_dl = statistics.stdev(deadline_days_list) if n > 1 else 0
    mean_cp = statistics.mean(complete_days_list)


    # Delta
    delta = median_dl - median_cp


    # Confidence
    if n >= 10:
        confidence = "high"
    elif n >= 3:
        confidence = "medium"
    else:
        confidence = "low"


    # last_brief_date
    latest = max(completed_briefs, key=lambda b: b["brief_complete_unix"])
    last_date = format_iso_date(latest["brief_complete_unix"])


    return {
        "n": n,
        "lookback_days": 90,
        "median_deadline_days": round(median_dl, 2),
        "mad_deadline_days": round(mad_dl, 2),
        "mean_deadline_days": round(mean_dl, 2),
        "std_deadline_days": round(std_dl, 2),
        "median_complete_days": round(median_cp, 2),
        "mean_complete_days": round(mean_cp, 2),
        "deadline_vs_real_delta": round(delta, 2),
        "confidence": confidence,
        "last_brief_date": last_date,
        # trend_4w önceki marka_stats.json'dan okunur, son hafta append edilir
    }




def check_marka_sapma(brief_deadline_days: float, marka_stats: dict) -> dict:
    """
    Brief'in deadline'ının marka ortalamasından sapıp sapmadığını kontrol eder.


    Returns:
        {
            "flag_yetersiz_sure": bool,
            "flag_anormal_uzun": bool,
            "metric_used": "median+MAD" | "mean+std",
            "deviation_score": float
        }
    """
    if marka_stats["n"] < 3:
        return {"flag_yetersiz_sure": False, "flag_anormal_uzun": False, "metric_used": None, "deviation_score": 0}


    median = marka_stats["median_deadline_days"]
    mad = marka_stats["mad_deadline_days"]
    threshold_mult = 1.0  # config.deviation_threshold_mult


    # MAD ile değerlendirme
    lower_bound = median - threshold_mult * mad
    upper_bound = median + threshold_mult * mad


    flag_yetersiz = brief_deadline_days < lower_bound
    flag_anormal = brief_deadline_days > upper_bound


    deviation_score = abs(brief_deadline_days - median) / mad if mad > 0 else 0


    return {
        "flag_yetersiz_sure": flag_yetersiz,
        "flag_anormal_uzun": flag_anormal,
        "metric_used": "median+MAD",
        "deviation_score": round(deviation_score, 2)
    }
8.5 5 Katmanlı Parser (v7.12 → v7.7)
import re


def parse_brief_message(msg: str, channel_id: str) -> dict | None:
    """
    Brief mesajını 5 katmanlı parser ile çözer.
    İlk eşleşen formatla devam eder.
    """


    # v7.12 — Workflow format (Öncelik'siz)
    if re.search(r'^🎀\s*İş:', msg, re.MULTILINE):
        return parse_v7_12_workflow(msg, channel_id)


    # v7.11 — Workflow format (Öncelik'li, fallback)
    if re.search(r'^🔔\s*Öncelik:', msg, re.MULTILINE) and re.search(r'^🎀\s*İş:', msg, re.MULTILINE):
        return parse_v7_11_workflow(msg, channel_id)


    # v7.10 — Yalın manuel
    if msg.startswith(('📋 İş özeti', '✍️ İş özeti', '🤖 İş özeti')):
        return parse_v7_10(msg, channel_id)


    # v7.9 — Marka sonunda
    if re.match(r'^[📋✍️🤖]\s*İş özeti\s*\[\w+\]', msg):
        return parse_v7_9(msg, channel_id)


    # v7.8 — Marka başta
    if re.match(r'^[📋✍️🤖]\s*\[\w+\]', msg):
        return parse_v7_8(msg, channel_id)


    # v7.7 ve öncesi — Flat
    if msg.startswith(('📋', '✍️', '🤖')):
        return parse_v7_7_flat(msg, channel_id)


    return None




def parse_v7_12_workflow(msg: str, channel_id: str) -> dict:
    """v7.12 emoji-label formatlı workflow mesajını parse eder."""
    fields = {}


    # Field-by-field regex
    patterns = {
        'is_ozeti':    r'^🎀\s*İş:\s*(.+?)$',
        'sure':        r'^⏰\s*Süre:\s*(.+?)$',
        'atananlar':   r'^👷\s*Kim:\s*(.+?)$',
        'tip':         r'^🏷️\s*Tip:\s*(.+?)$',
        'akis':        r'^🔄\s*Akış:\s*(.+?)$',
        'ref':         r'^🔗\s*Ref:\s*(.+?)$',
        'not':         r'^💬\s*Not:\s*(.+?)$',
        'kimden':      r'^🐷\s*Kimden:\s*<@(U\w+)\|',
    }


    for field, pattern in patterns.items():
        m = re.search(pattern, msg, re.MULTILINE)
        fields[field] = m.group(1).strip() if m else None


    # İlk satır departman kontrolü (opsiyonel)
    first_line = msg.strip().split('\n')[0]
    dept_match = re.match(r'^(📋|✍️|🤖)', first_line)
    fields['departman_emoji'] = dept_match.group(1) if dept_match else None


    # Marka kanal'dan
    fields['marka'] = MARKA_KANAL_MAP.get(get_channel_name(channel_id))


    return fields
8.6 UTC → TR Çevrimi
from datetime import datetime, timezone, timedelta
import re


TR_TZ = timezone(timedelta(hours=3))
TR_AYLAR = {
    "January": "Ocak", "February": "Şubat", "March": "Mart",
    "April": "Nisan", "May": "Mayıs", "June": "Haziran",
    "July": "Temmuz", "August": "Ağustos", "September": "Eylül",
    "October": "Ekim", "November": "Kasım", "December": "Aralık"
}


def parse_slack_datetime_to_tr(slack_str: str) -> tuple[datetime, str]:
    """
    Slack default datetime formatını TR'ye çevirir.


    Örnek input: "May 21st, 2026 at 4:05 PM UTC"
    Örnek output: (datetime, "21 Mayıs 2026 19:05 TR")


    Saatsiz: "May 21st, 2026" → "21 Mayıs 2026 (tüm gün)"
    """
    # Saat var mı?
    has_time = " at " in slack_str


    # Parse
    if has_time:
        # "May 21st, 2026 at 4:05 PM UTC"
        m = re.match(r'(\w+)\s+(\d+)\w*,\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)\s+UTC', slack_str)
        if not m:
            return None
        ay_en, gun, yil, saat, dakika, am_pm = m.groups()


        saat = int(saat)
        if am_pm == "PM" and saat != 12:
            saat += 12
        elif am_pm == "AM" and saat == 12:
            saat = 0


        dt_utc = datetime(int(yil), parse_ay(ay_en), int(gun), saat, int(dakika), tzinfo=timezone.utc)
        dt_tr = dt_utc.astimezone(TR_TZ)


        ay_tr = TR_AYLAR[ay_en]
        return (dt_tr, f"{int(gun)} {ay_tr} {yil} {dt_tr.strftime('%H:%M')} TR")
    else:
        # "May 21st, 2026" — saat yok
        m = re.match(r'(\w+)\s+(\d+)\w*,\s+(\d+)', slack_str)
        if not m:
            return None
        ay_en, gun, yil = m.groups()
        dt_tr = datetime(int(yil), parse_ay(ay_en), int(gun), 23, 59, tzinfo=TR_TZ)
        ay_tr = TR_AYLAR[ay_en]
        return (dt_tr, f"{int(gun)} {ay_tr} {yil} (tüm gün)")




def parse_ay(en: str) -> int:
    en_to_num = {
        "January": 1, "February": 2, "March": 3, "April": 4,
        "May": 5, "June": 6, "July": 7, "August": 8,
        "September": 9, "October": 10, "November": 11, "December": 12
    }
    return en_to_num[en]
8.7 Çoklu Atanan Parser (Paralel / Sıralı)
def parse_atananlar(kim_text: str, akis: str) -> dict:
    """
    "@Aylin, @Hasan" veya "@Aylin > @Hasan" formatını parse eder.


    Returns:
        {
            "atananlar": [{"user_id": ..., "isim": ...}, ...],
            "akis_tipi": "paralel" | "sirali",
            "sira": [user_id, ...] eğer sıralı
        }
    """
    # Akış tipi tespiti
    if "→" in kim_text or " > " in kim_text or "Sıralı" in akis:
        akis_tipi = "sirali"
        # > veya → ile böl
        parts = re.split(r'[→>]', kim_text)
    elif "∥" in kim_text or "Paralel" in akis or "," in kim_text:
        akis_tipi = "paralel"
        parts = re.split(r'[∥,]', kim_text)
    else:
        akis_tipi = "tekli"
        parts = [kim_text]


    # Her parçada @mention veya isim
    atananlar = []
    for p in parts:
        p = p.strip()
        # <@USER_ID|İsim> formatı
        m = re.search(r'<@(U\w+)\|?([^>]*)>', p)
        if m:
            atananlar.append({
                "user_id": m.group(1),
                "isim": m.group(2) or get_user_name(m.group(1))
            })
        else:
            # @İsim formatı — isimle kullanıcı ara
            isim_m = re.search(r'@([^\s@,>→]+)', p)
            if isim_m:
                user = find_user_by_name(isim_m.group(1))
                if user:
                    atananlar.append(user)


    return {
        "atananlar": atananlar,
        "akis_tipi": akis_tipi,
        "sira": [a["user_id"] for a in atananlar] if akis_tipi == "sirali" else None
    }
8.8 Departman Heuristic
TASARIM_IDS = {"U0AN6DD79M0", "U06J26R1XCJ", "U09BFPBKQG7", "U0B3K2WE7SB", "U055EDESLSE", "U0AK8U7L57F", "U08HLMHTGEL"}
EDITOR_IDS = {"U4XCE3532", "U02SZQDAFPF", "U09BZHR25NG", "U07PV0RA9L2", "U08NQJ27G5S", "U05PP70GQTX", "U063T8M5HL4", "U0AAC3YK20G"}
AI_IDS = {"U0AP31SAA1W"}
YONETICI_IDS = {"U030C48PL23", "UD96GH76E", "U4XCE3532", "U055EDESLSE", "U02SZQDAFPF"}


def detect_departman(dept_emoji_ilk_satir: str | None, atananlar: list) -> str:
    """
    Departman tespit (öncelik sırası):
    1. İlk satırda 📋/✍️/🤖 varsa onu kullan
    2. Atananların hepsi AI ise → ai
    3. Atananların hepsi editör ise → editor
    4. Aksi takdirde → design (varsayılan)
    """
    if dept_emoji_ilk_satir == "📋":
        return "design"
    if dept_emoji_ilk_satir == "✍️":
        return "editor"
    if dept_emoji_ilk_satir == "🤖":
        return "ai"


    atanan_ids = {a["user_id"] for a in atananlar}


    if atanan_ids and atanan_ids.issubset(AI_IDS):
        return "ai"
    if atanan_ids and atanan_ids.issubset(EDITOR_IDS | YONETICI_IDS - TASARIM_IDS):
        return "editor"


    return "design"  # Varsayılan

________________


9. DASHBOARD — Mimari ve Deploy
9.1 İki Versiyon
1. COWORK ARTIFACT VERSİYONU
   Konum: ~/Documents/Claude/Artifacts/benseno-tasarim-panosu/index.html
   Çalışma: Cowork sidebar — window.cowork.callMcpTool bridge ile canlı veri
   Kim görür: Sadece Görkem (Cowork hesabı sahibi)


2. GITHUB PAGES VERSİYONU (Ekip için)
   Konum: bensenoint.github.io/dashboard/
   Source: github.com/bensenoint/dashboard/index.html
   Çalışma: Statik HTML, EMBEDDED_DATA içinde son sync verisi
   Kim görür: Tüm ekip (şifre korumalı)
   Update: Brief Sync her :15/:45'te GitHub Contents API ile push
9.2 EMBEDDED_DATA Mock Yapısı (KRİTİK!)
Cowork artifact'ta <body> etiketinden hemen sonra mutlaka şu blok bulunmalı:


<script>
// === EMBEDDED_DATA — Brief Sync her run'da bu bloğu günceller ===
window.EMBEDDED_DATA = {
  canvas_markdown: `# Benseno Tasarım İş Takip Panosu\n\n...`,  // Sync sonucu Canvas içeriği
  generated_at: "2026-05-18T08:15:00+03:00",
  sync_ts: 1779063300,
  source: "brief-sync-run-1779063300"
};


// Cowork bridge mock — GitHub Pages'te window.cowork yok
// Bu mock olmadan ekip "Cowork bridge YOK" uyarısı görür!
if (typeof window.cowork === 'undefined') {
  window.cowork = {
    callMcpTool: async function(toolName, args) {
      if (toolName.includes('slack_read_canvas')) {
        return [{
          type: 'text',
          text: JSON.stringify({ markdown_content: window.EMBEDDED_DATA.canvas_markdown })
        }];
      }
      return [{type:'text', text:'{}'}];
    }
  };
}
</script>

Bu blok asla silinmemeli. Brief Sync v7.13 Adım 9b bu bloğu update eder (canvas_markdown alanını yeni Canvas içeriği ile değiştirir).
9.3 6 Sekmeli Dashboard
1. Pano (ana ekran) — KPI kartları, yoğunluk tabloları, aktif işler galerisi
2. Tasarım Detay — 7 tasarımcı detay tablosu, marka bazlı dağılım
3. Editör Detay — 8 editör performans, brief kalitesi
4. AI Detay — Eren'in AI işleri
5. Raporlama (5 alt sekme)
   5.1 Marka Raporu — performans + v7.13 E3 Marka Davranış widget
   5.2 Ekip Matrisi — 16 kişi × marka heatmap, radar chart
   5.3 Kişi Profili — dropdown'dan kişi seç, tüm verisi
   5.4 Yönetici Paneli — özel KPI'lar
   5.5 Geçmiş — filtrelenebilir tüm tamamlanmış brief'ler
6. Ayarlar — KPI özelleştirme, filtreler, tema
9.4 Authentication
Dashboard şifre korumalı. SHA-256 hash karşılaştırması:


const AUTH_HASH = "..."; // .dashboard-auth-hash dosyasından inject edilir
async function checkPassword(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === AUTH_HASH;
}
9.5 GitHub Contents API Push
Brief Sync her run'da:


import requests
import base64


def push_to_github(html_content: str, marka_stats_json: str):
    PAT = open(GITHUB_PAT_FILE).read().strip()
    REPO = "bensenoint/dashboard"


    files = [
        ("index.html", html_content),
        ("marka_stats.json", marka_stats_json)
    ]


    for path, content in files:
        # 1. Mevcut SHA'yı al
        url_get = f"https://api.github.com/repos/{REPO}/contents/{path}"
        r = requests.get(url_get, headers={"Authorization": f"token {PAT}"})
        sha = r.json().get("sha")  # None if file doesn't exist


        # 2. PUT request ile yeni içerik
        content_b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        body = {
            "message": f"Brief Sync v7.13 run ({datetime.now().isoformat()})",
            "content": content_b64
        }
        if sha:
            body["sha"] = sha


        r = requests.put(url_get,
                         headers={"Authorization": f"token {PAT}",
                                  "Accept": "application/vnd.github.v3+json"},
                         json=body)


        if r.status_code == 401 or r.status_code == 403:
            send_dm_to_gorkem("⚠️ GitHub PAT süresi dolmuş veya yetkisi yok. Yenile.")
        elif r.status_code not in (200, 201):
            log_error(f"GitHub push failed: {r.status_code} {r.text}")
9.6 PAT Yönetimi
~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat          # Token
~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat-created  # ISO date string
~/Documents/Claude/Projects/Tasarım Takvimi/.dashboard-auth-hash # SHA-256 password hash

PAT süresi: 90 gün. Brief Sync her run'da kaç gün kaldığını kontrol eder:


created_iso = open(".github-pat-created").read().strip()
created_date = datetime.fromisoformat(created_iso)
days_remaining = 90 - (datetime.now() - created_date).days


if days_remaining <= 7:
    send_dm_to_gorkem(f"⚠️ GitHub PAT {days_remaining} gün sonra dolacak. Yenile.")
elif days_remaining <= 0:
    send_dm_to_gorkem("🚨 GitHub PAT süresi DOLDU! Dashboard güncellenmiyor.")

________________


10. MCP BAĞLANTILARI
10.1 Slack MCP (Business+ Connector)
Bağlantı tipi: Cowork'te resmi Slack connector (HTTP transport). Cowork'te connector ID: 8d40c455-2f52-4946-b26f-009e54bc2168 (internal — Claude Code'da farklı olacak).


Kullanılan tool'lar:


mcp__slack__slack_read_canvas(canvas_id)
mcp__slack__slack_update_canvas(canvas_id, action, content, section_id?)
mcp__slack__slack_read_channel(channel_id, oldest?, latest?)
mcp__slack__slack_read_thread(channel_id, thread_ts)
mcp__slack__slack_search_public(query, after?, before?, include_bots?)
mcp__slack__slack_search_public_and_private(query, ...)
mcp__slack__slack_send_message(channel_id, text)
mcp__slack__slack_send_message_draft(channel_id, draft_content)
mcp__slack__slack_schedule_message(channel_id, post_at, text)
mcp__slack__slack_search_users(query)
mcp__slack__slack_search_channels(query)
mcp__slack__slack_read_user_profile(user_id)
mcp__slack__slack_create_canvas(channel_id, title, content)

Yetkilendirme gereksinimi: Slack workspace admin access.
10.2 Google Workspace MCP
Gmail:


mcp__gmail__search_threads(query)
mcp__gmail__get_thread(thread_id)
mcp__gmail__create_draft(to, subject, body)
mcp__gmail__create_label, label_message, list_drafts

Calendar:


mcp__calendar__list_calendars()
mcp__calendar__create_event(calendar_id, summary, start, end, color_id?)
mcp__calendar__list_events(calendar_id, time_min, time_max)
mcp__calendar__update_event, delete_event

Drive (read_file_content, search_files):


mcp__drive__search_files(query)
mcp__drive__read_file_content(file_id)
mcp__drive__get_file_metadata(file_id)
10.3 Tool Cache Pattern
Brief Sync skill'i kullanırken callMcpTool response'u recursive parse etmelidir:


def extract_markdown_from_mcp_response(response):
    """
    Slack MCP response formatı: [{"type":"text","text":"{\"markdown_content\":\"...\"}"}]
    İç içe JSON parse gerekir.
    """
    if isinstance(response, str):
        try:
            response = json.loads(response)
        except:
            return response


    if isinstance(response, list):
        for item in response:
            if isinstance(item, dict) and item.get("type") == "text":
                try:
                    inner = json.loads(item["text"])
                    if "markdown_content" in inner:
                        return inner["markdown_content"]
                except:
                    pass


    if isinstance(response, dict) and "markdown_content" in response:
        return response["markdown_content"]


    return None
10.4 Slack Emoji Shortcode Mapping (Önemli!)
Slack API mesajlarda emoji'yi unicode olarak değil, shortcode olarak tutar. Brief Sync ile uyumluluk için:


EMOJI_TO_SHORTCODE = {
    "📋": ":clipboard:",
    "🎀": ":ribbon:",
    "🔔": ":bell:",
    "⏰": ":alarm_clock:",
    "👷": ":construction_worker:",
    "🏷️": ":label:",
    "🔄": ":arrows_counterclockwise:",
    "🔗": ":link:",
    "💬": ":speech_balloon:",
    "🐷": ":pig:",
    "🎨": ":art:",
    "✍️": ":writing_hand:",
    "🤖": ":robot_face:",
    "👀": ":eyes:",
    "✅": ":white_check_mark:",
    "⛔": ":no_entry:",
    "♻️": ":recycle:",
    "🔒": ":lock:",
    "⭐": ":star:",
    "🎓": ":mortar_board:",
    "🔴": ":red_circle:",
    "🟠": ":large_orange_circle:",
    "🟡": ":large_yellow_circle:",
    "🟢": ":large_green_circle:",
    "⚠️": ":warning:",
    "🌙": ":crescent_moon:",
    "🚀": ":rocket:",
}
SHORTCODE_TO_EMOJI = {v: k for k, v in EMOJI_TO_SHORTCODE.items()}


def shortcode_to_emoji(text: str) -> str:
    """Slack shortcode'larını unicode emoji'ye çevirir (display için)."""
    for sc, em in SHORTCODE_TO_EMOJI.items():
        text = text.replace(sc, em)
    return text

Slack Aramada Kritik Bilgiler:


* Emoji aramada shortcode kullan, unicode değil: after:2026-05-15 :clipboard: ✓
* Bugünü include et: after:DÜN veya Unix timestamp ile (after:1779000000). after:BUGÜN bugünü dahil etmez.


________________


11. PHASE TARİHÇESİ (v7.0 → v7.13)
Phase 1-6: Pre-history (2024 Aralık - 2026 Mart)
* v1.0-v4.x: Manuel Slack tracking, dağınık
* v5.0: İlk Brief Sync prototype
* v6.0: Saatlik özet + Günaydın DM ayrı task'lar (sonra entegre edildi)
Phase 7 (v7.0 - v7.13): "Akıllı Sistem"
v7.0 (1 Mart 2026): Phase 7 başlangıcı, 4 yön belirlendi:


* A — Müşteri ilişkileri (mail entegrasyonu — Phase 8'e kaldı)
* B — Veri/Analiz derinleşmesi (Dashboard rework)
* C — AI derinleşmesi (4 alt özellik: C1-C4)
* D — Operasyon mükemmellik (force-close, ghost detection)


v7.1 (15 Mart 2026): P7-C1 Smart Assignment 2.0 v7.2 (22 Mart 2026): P7-C2 Thread Özet (AI) v7.3 (28 Mart 2026): PDF kılavuz v7.3 üretildi v7.4 (5 Nisan 2026): P7-C3 Revizyon Tahmini v7.5 (15 Nisan 2026): GitHub Pages geçişi, dashboard public, Drive arşivi kaldırıldı


v7.6 (22 Nisan 2026): Yönetim hiyerarşisi netleştirildi (5 yönetici)


v7.7 (15 Mayıs 2026): Beyza Tosun → Pelin Özdemir geçişi


* Tasarım ekibi yine 7 kişi
* Onboarding bot Pelin için tetiklendi


v7.8-v7.11 (15-16 Mayıs 2026): Slack Workflow Builder entegrasyonu


* Form-tabanlı brief açma
* 5 katmanlı backward-compatible parser
* Marka kanal'dan otomatik türetme


v7.12 (16 Mayıs 2026): OTOMATİK ÖNCELİK + GEÇMİŞ TARİH UYARI


* Workflow form'undan Öncelik alanı kaldırıldı
* Deadline'dan otomatik mapping
* Yönetici reaction override (🔴/🟠/🟡/🟢)
* 4 katmanlı geçmiş tarih uyarı sistemi
* Aynı gün saat eksik uyarısı
* Mesai dışı yumuşak uyarı


v7.13 (16 Mayıs 2026): MARKA DAVRANIŞ ÖĞRENMESİ (E3)


* marka_stats.json oluşturuldu
* Medyan+MAD + Ortalama+Std hesabı
* silent_log_only mode (1 Haziran'da active'e geçer)
* Dashboard'a "Marka Davranış Öğrenmesi" widget eklendi
Phase 8: Production sonrası planlananlar
* P7-C4 AI Mockup (Imagen/DALL-E ile referans görsel)
* Mail-Brief Router (ortak adresten otomatik brief)
* v7.13-E3 active mode otomatik geçiş (1 Haziran)
Kritik Tarihler
Tarih
	Olay
	15 May 2026 (Cum)
	Bauhaus 8+1 video planı + 2 bonus = 10 brief tek günde kapandı. v7 framework baskı altında doğrulandı.
	15 May 2026 (Cum)
	Pelin Özdemir ekibe katıldı, Beyza Tosun ayrıldı.
	16 May 2026 (Cmt)
	v7.12 + v7.13 büyük geliştirmesi yapıldı, production launch hazırlığı.
	17 May 2026 (Pzr) 23:30
	Otomatik clean-slate reset task çalıştı.
	18 May 2026 (Pzt) 07:50
	İlk gerçek Sabah Raporu (v7.9).
	18 May 2026 (Pzt) 08:15
	İlk gerçek Brief Sync (v7.13) run'u.
	1 Haziran 2026 (Pzt) 17:00
	E3 silent_log_only → active otomatik geçiş.
	

________________


12. BİLİNEN SORUNLAR ve ÇÖZÜMLER
12.1 Slack API Quirk'leri
Sorun
	Sebep
	Çözüm
	after:BUGÜN bugünü dahil etmiyor
	Slack API datetime quirk
	after:DÜN kullan veya Unix timestamp (after:1779000000)
	Emoji aramada bulunamıyor
	Slack shortcode store ediyor
	Unicode yerine shortcode kullan: :clipboard: not 📋
	Canvas section_id replace blockquote/footer çoğaltıyor
	Slack Canvas API bug
	LIGHT mode'da bile full canvas replace yap, section_id parametresi geçme
	slack_update_canvas internal_error veriyor
	Çok büyük içerik + emoji kombinasyonu
	30 saniye bekle, retry. Başarısız olursa Görkem'e DM.
	Canvas markdown'da H1 duplikasyonu
	Title field ayrı, markdown'da H1 koyma
	# Benseno Tasarım İş Takip Panosu yazılmamalı, title API tarafından set edilir
	Workflow trigger programatik tetiklenemez
	Slack tasarımı
	Bot olarak v7.12 format mesajı yaz, workflow'a gerek yok
	12.2 Canvas Parse Edge Case'leri
# Aktif tablo vs Tamamlanan tablo karıştırılmamalı
# Aktif tabloda 11 sütun (# 🔔 🏷️ Marka İş Atanan ⏰ 📊 🔁 🕐 🔗)
# Tamamlananda 12 sütun (# Marka İş Atanan Deadline Başlangıç Bitiş Süre Rev Gecikme ⭐ 🔗)
# AYIRIŞ: 2. hücrede öncelik emoji'si (🔴/🟠/🟡/🟢) varsa AKTİF, değilse TAMAMLANAN


def detect_table_type(row_cells):
    if len(row_cells) >= 7 and re.match(r'^[🔴🟠🟡🟢]$', row_cells[1].strip()):
        return "aktif"
    return "tamamlanan"
12.3 Pelin Smart Assign Boş Veri Senaryosu
PROBLEM: Pelin 15 May'de katıldı. İlk haftalarda hiç tamamlanmış brief'i yok.
         Smart Assign skoru hesaplarken:
         - n_marka = 0 → marka_uzmanligi = 0
         - len(tip_briefs) = 0 → tip = 0
         - musaitlik = 40 (boş kapasiteli)
         - stil = 10
         Total: ~50 puan — orta seviye


ÇÖZÜM v7.7'de: Pelin için ilk 2 hafta manuel atama önerilir.
              Sistemde özel flag: "is_new_member": true
              Smart Assign yan etkisi: Pelin'i önermeden önce DM uyarısı:
              "Pelin yeni katıldı (Day 3/14). Onun yerine X öneriyorum."
12.4 Cowork Bridge Yok Hatası (KRITIK!)
PROBLEM: Dashboard GitHub Pages'te açılınca "Cowork bridge YOK" uyarısı
SEBEP: Cowork artifact'tan kopyalanan HTML'de EMBEDDED_DATA + cowork mock yok
ÇÖZÜM: Cowork artifact'a (kalıcı) şu blok eklenmiş olmalı:


<script>
window.EMBEDDED_DATA = { canvas_markdown: `...`, ... };
if (typeof window.cowork === 'undefined') {
  window.cowork = { callMcpTool: async function(tool, args) { ... } };
}
</script>


Brief Sync skill her run'da canvas_markdown alanını update eder, mock yapı kalır.
12.5 Hayalet Brief Tespiti (Ghost Detection — v7.5 P7-D)
TANIM: 30 dakika içinde Brief Sync tarafından yakalanması beklenen brief
       ama yakalanamayan — "hayalet" olarak işaretlenir.


NEDEN OLABİLİR:
- Editor yanlış kanalda açtı
- Workflow tetiklenmedi
- Slack API rate-limit'e takıldı
- Brief Sync run'ı atlandı (Cowork session kapalı vb)


TESPİT:
Brief Sync her run'da Slack'i taradıkları arasında "📋 İş özeti" benzeri
mesajlar buluyor mu? Eğer son 60 dk'da format-uyumlu bir mesaj
yakalandı ama Canvas'a yazılmadıysa hayalet.


AKSİYON:
Görkem + ilgili editöre DM "Hayalet brief tespit edildi: [link]"

________________


13. PHASE 8 BACKLOG
13.1 P7-C4 AI Mockup (P7'den ertelendi)
Vizyon: Brief açıldığında müşterinin kafasındaki yöne dair "ham mockup" otomatik üretmek. Tasarımcı işe başlamadan önce müşteriyle hizalama sağlamak.


Teknik:


* Brief'in İş özeti + Tip + Not alanlarını input olarak al
* Marka Kitabı Canvas'tan (F0B2ANKBBFV) renk paleti + font + asset bilgisini çek
* Imagen/DALL-E/Flux API'sine prompt gönder (örn: "Bauhaus marka renkleriyle, sansürsüz minimal stilde, IG post 1080x1350, içerik: bahar kampanyası")
* Üretilen görseli brief thread'ine yapıştır


Maliyet: Image API'sine bağlı ($0.04-0.20/görsel)


Riskler:


* Mockup kalitesi her zaman güvenilir değil
* Tasarımcılar AI mockup'ı görmezden gelebilir
* Bağımlılık yaratabilir


Trigger noktası: Görkem "C4'ü ne zaman yapacağız" derse veya Phase 8 planlama sorulduğunda.
13.2 v7.13-E3 Aktivasyonu (1 Haziran 2026)
Otomatik geçiş tarihi: 2026-06-01 17:00 (Cuma) Geçişi yapan: benseno-haftalik-retrospektif (Cuma 17:00 cron)


Akış:


1 Haz Cuma 17:00 → haftalık retrospektif çalışır
   ↓
marka_stats.json'da:
   config.current_mode == "silent_log_only" AND
   now >= config.active_from (2026-06-01T00:00+03:00)
   ↓ TRUE ise
   current_mode = "active"
   dosyayı overwrite + git push
   ↓
Cansu Direktör'e özel DM:
   "🎉 E3 bugün ACTIVE moda geçti!
    Brief Sync artık Şablon 27/28 DM'lerini gönderecek.
    Dashboard'da marka kıyaslama etiketleri görünür olacak."
   ↓
Sonraki Brief Sync run'larında:
   - Yetersiz süre uyarıları → editöre DM (Şablon 27)
   - Anormal uzun uyarıları → editöre DM (Şablon 28)
   - Dashboard'da `📈 agresif` veya `📊 sapma` etiketleri

Aktivasyon sonrası izleme (ilk hafta):


* Yanlış pozitif oranı (editör "bilerek verdim" diyenler)
* DM yorgunluk şikayetleri
* Eşik ayarlama gerekirse deviation_threshold_mult 1.0 → 1.5 yapılabilir
13.3 Mail-Brief Router (Phase 8 — Büyük özellik)
Vizyon: Müşteri mailini otomatik olarak Slack brief'e çevirmek. Editör mail-Slack arası gidip gelmek zorunda kalmasın.


Mimari:


Ortak adres: brief@benseno.com.tr
            (Görkem'in Workspace hesabına alias olarak ekli)
                    ↓
Müşteri mail atar → Görkem'in Gmail inbox'una düşer
                    ↓
[Yeni scheduled task: benseno-email-router · 15 dk hafta içi]
                    ↓
1. Gmail'i tara — yeni mailler (label: "Brief Talebi")
2. AI sınıflandır (Haiku):
   - Brief talebi mi? (özel yapım iş)
   - Mevcut iş thread'i mi? (devam eden brief)
   - Bilgi sorusu mu? (fatura, durum sorgusu)
   - Spam/promo mu?
3. Marka tespit:
   - From domain: ahmet@bauhaus.com.tr → Bauhaus
   - Subject keyword: "Bauhaus dergi" → Bauhaus
   - AI fallback: body içeriğinden çıkar
4. İlgili editör + Cansu + dept yöneticisine Slack DM
   "📧 Yeni mail — brief talebi olabilir
    Konu: ...
    Gönderen: ...
    Marka: Bauhaus (AI güven %95)
    AI Sınıflandırma: 📋 Brief talebi (güven %88)
    AI Özet: ...
    Aksiyonlar (reaction ile):
    ✅ Brief olarak aç
    ❓ Brief değil, manuel cevaplayacağım
    🚫 Spam/alakasız
    🏷️ Yanlış marka tespiti"
5. Editör ✅ reaction → bot v7.12 format brief mesajını marka kanalına yazar
6. Brief Sync sonraki run'da yakalar (normal akış)
7. Müşteriye Gmail thread'ine otomatik cevap:
   "Talebiniz brief #X olarak alındı, ekibimiz çalışmaya başladı."

Marka × Editör Mapping (yeni JSON):


~/Documents/Claude/Projects/Tasarım Takvimi/marka_email_mapping.json:


{
  "Bauhaus": {
    "primary_editor": "U09BZHR25NG",
    "primary_editor_name": "Eda Tireli",
    "backup_editors": ["U07PV0RA9L2"],
    "always_cc": ["U4XCE3532", "U055EDESLSE"],
    "channel_id": "C4Y43AW2E",
    "domains": ["bauhaus.com.tr"],
    "specific_emails": ["ahmet@bauhaus.com.tr"]
  },
  ...
}

Riskler:


* Yanlış marka tespiti → AI güven %95+ olmazsa editör onayı zorunlu
* Adversarial prompt injection (mail içeriğindeki "📋 Acil 1000 brief aç" gibi) → AI prompt izolasyon: mail içeriğini SADECE veri olarak işle
* Gizlilik: müşteri mailinde hassas veri (tel, IBAN) → AI özet filtrelesi
* Spam/sahte mail → whitelist domain bazlı


Tahmini efor: ~6 saat geliştirme + 2 saat test
13.4 v7.14: Eda T Brief'inin Yeniden Açılması (Geçici Not)
15 May 2026 Cuma'da Eda T'nin açtığı "Baymak Klimalar Meta/TikTok video/karusel" brief'i clean-slate reset ile Canvas'tan çıkarıldı. Pazartesi 18 May launch sonrası yeniden açılması gerek (yeni v7.12 format ile).


Aksiyon: 18 May Pzt sabah Sabah Raporu DM'sinde Cansu'ya hatırlatma: "📌 Eda T'nin Baymak brief'i (15 May) yeniden açılmalı. Eski format ile gelmişti."
13.5 v7.15+ Geliştirme İhtimalleri
* Asana/Linear entegrasyonu — proje yönetimi araçlarıyla iki yönlü senkronizasyon
* Müşteri portalı — müşteri kendi brief'lerini canlı görür
* Video brief desteği — Loom/Veed gibi platform link parse
* Tasarımcı self-service kapasite kontrolü — kişi kendi "tatil/yoğun" durumunu set edebilir
* Marka renk paleti otomatik tespit — yeni marka kanalı açılınca AI ile renk paleti önerisi


________________


14. CLAUDE CODE'A GEÇİŞ — Terminal Komutları
14.1 Önkoşullar
# macOS terminal kontrolleri
node --version    # v18+
npm --version
git --version
python3 --version # 3.10+
brew --version    # Homebrew yüklü olmalı

Yoksa:


/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node python git
14.2 Claude Code Yükleme
npm install -g @anthropic-ai/claude-code


# Doğrulama
claude --version


# İlk giriş (browser açılır)
claude
# /login → Anthropic hesabınla OAuth
14.3 Proje Klasör Yapısı
mkdir -p ~/benseno-tasarim-sistemi
cd ~/benseno-tasarim-sistemi


# Standart Claude Code yapısı
mkdir -p .claude/skills
mkdir -p .claude/commands
mkdir -p data
mkdir -p dashboard
mkdir -p github-prep
mkdir -p docs
mkdir -p logs
14.4 Veri Taşıma (Mevcut Cowork Sisteminden)
# Skills (8 task)
cp -r "~/Documents/Claude/Scheduled/benseno-brief-sync" .claude/skills/
cp -r "~/Documents/Claude/Scheduled/benseno-gunluk-performans" .claude/skills/
cp -r "~/Documents/Claude/Scheduled/benseno-haftalik-retrospektif" .claude/skills/
cp -r "~/Documents/Claude/Scheduled/benseno-aylik-strateji" .claude/skills/
cp -r "~/Documents/Claude/Scheduled/benseno-onboarding" .claude/skills/


# Dashboard
cp "~/Documents/Claude/Artifacts/benseno-tasarim-panosu/index.html" dashboard/


# Data
cp "~/Documents/Claude/Projects/Tasarım Takvimi/marka_stats.json" data/
cp "~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat" data/
cp "~/Documents/Claude/Projects/Tasarım Takvimi/.dashboard-auth-hash" data/
cp "~/Documents/Claude/Projects/Tasarım Takvimi/.github-pat-created" data/


# GitHub deploy klasörü
cp -r "~/Documents/Claude/Projects/Tasarım Takvimi/github-prep" .


# Kılavuz
cp "~/Documents/Claude/Projects/Tasarım Takvimi/Benseno-Kullanim-Kilavuzu-v7.13.pdf" docs/
cp "~/Documents/Claude/Projects/Tasarım Takvimi/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md" docs/


# .gitignore
cat > .gitignore << 'EOF'
data/.github-pat
data/.dashboard-auth-hash
data/.github-pat-created
logs/
node_modules/
.DS_Store
*.log
EOF


git init
git add .
git commit -m "Initial commit: Benseno Tasarım Sistemi v7.13 from Cowork"
14.5 CLAUDE.md (Project Instructions)
cat > CLAUDE.md << 'EOF'
# Benseno Tasarım Sistemi — Claude Code Workspace


> **Sistem versiyonu:** v7.13
> **Migrated from Cowork:** {{tarih}}
> **Production launch:** 18 Mayıs 2026


## Bu Workspace Nedir?
16 kişilik dijital ajansın brief takip sistemi. 8 scheduled task,
1 dashboard, 4 MCP entegrasyonu.


## Önemli Yollar
- Skills: `.claude/skills/`
- Dashboard live: `dashboard/index.html`
- Dashboard GitHub: `github-prep/dashboard/`
- Data files: `data/`
- Master Prompt: `docs/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md`


## Sistem Sabitleri
- Slack Canvas ID: F0B1B6XUD44
- Grafik kanal: C02SZRJGY0M
- GitHub repo: bensenoint/dashboard
- Timezone: Europe/Istanbul (UTC+3)
- 39 marka, 16 kişi, 5 yönetici


## Yöneticiler
- Görkem (GM): U030C48PL23 · gorkem@benseno.com.tr
- Reyhan (GMY): UD96GH76E
- Cansu (Direktör): U4XCE3532
- İpek (Tasarım Yön): U055EDESLSE
- erdem (Editör Yön): U02SZQDAFPF


## Çalışma Kuralları (Claude için)
1. Brief Sync skill'inde v7.13 mantığına UY (Öncelik otomatik, marka_stats.json okuma)
2. Canvas update'de section_id KULLANMA (full replace, H1 koyma)
3. Dashboard update'inde EMBEDDED_DATA + cowork mock bloğunu KORU
4. GitHub push'da PAT kontrol (.github-pat-created — 90 gün)
5. Pazartesi launch (18 May) öncesi tüm test datalarını SİL
6. Skill çıktı log'ları `/logs/` klasörüne yaz


## İlk Çalıştırma Sırası
1. MCP bağlantılarını test et (`claude mcp list`)
2. Slack token'ı geçerli mi (`claude -p "test slack: read canvas F0B1B6XUD44"`)
3. GitHub PAT geçerli mi (`cat data/.github-pat | head -c 20`)
4. Brief Sync skill'i kuru çalıştır (`claude -p "Skill: benseno-brief-sync — dry run"`)
5. launchd job'ları kur (Faz 14.7)


## Detaylı Sistem Bilgisi
Bkz: `docs/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md` — bu doküman SİSTEMİN TAMAMINI anlatır. Sorularını cevaplamadan önce ilgili bölümü oku.
EOF
14.6 MCP Bağlantıları
# Slack MCP server
claude mcp add slack \
  --transport stdio \
  --command "npx" \
  --args "-y" "@modelcontextprotocol/server-slack"


# Slack token'larını environment'a koy
echo "export SLACK_BOT_TOKEN=xoxb-..." >> ~/.zshrc
echo "export SLACK_TEAM_ID=T4Y3R6RAN" >> ~/.zshrc
echo "export SLACK_CHANNEL_IDS=C02SZRJGY0M,C4Y43AW2E,..." >> ~/.zshrc


# Google Workspace MCP
claude mcp add google \
  --transport stdio \
  --command "npx" \
  --args "-y" "@modelcontextprotocol/server-google-workspace"


# OAuth'u tetikle
claude mcp authenticate google


# Test
claude
> /mcp list
> /mcp test slack
> /mcp test google
14.7 launchd Job'ları (Scheduled Tasks Yerine)
Önemli: Bilgisayar kapalıyken launchd çalışmaz. Sürekli açık tutman gerekir.
14.7.1 Brief Sync (her :15/:45)
~/Library/LaunchAgents/com.benseno.brief-sync.plist:


<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.benseno.brief-sync</string>


    <key>WorkingDirectory</key>
    <string>/Users/gorkemkaya/benseno-tasarim-sistemi</string>


    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-c</string>
        <string>source ~/.zshrc && /usr/local/bin/claude -p "Skill: benseno-brief-sync — run now" --print 2>&1 | tee -a logs/brief-sync.log</string>
    </array>


    <!-- Cron benzeri: hafta içi (Pzt-Cum=2-6) 8-17 saatte :15 ve :45'te -->
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>15</integer></dict>
        <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>45</integer></dict>
        <!-- ... 8-17 saat × 2 dakika × 5 gün = 100 entry -->
    </array>


    <key>StandardOutPath</key>
    <string>/Users/gorkemkaya/benseno-tasarim-sistemi/logs/brief-sync.out</string>
    <key>StandardErrorPath</key>
    <string>/Users/gorkemkaya/benseno-tasarim-sistemi/logs/brief-sync.err</string>


    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>

100 entry yazmak yorucu — pratik yol: cron sembolü destekleyen 3rd party tool veya wrapper script:


# Wrapper script: ~/benseno-tasarim-sistemi/run-brief-sync.sh
#!/bin/zsh


# Mesai saati kontrolü
HOUR=$(date +%H)
DOW=$(date +%u)  # 1=Pzt, 7=Pzr
MIN=$(date +%M)


if [ "$DOW" -gt "5" ] || [ "$HOUR" -lt "8" ] || [ "$HOUR" -gt "17" ]; then
  exit 0  # Hafta sonu veya mesai dışı
fi


if [ "$MIN" != "15" ] && [ "$MIN" != "45" ]; then
  exit 0  # :15 veya :45 değil
fi


cd ~/benseno-tasarim-sistemi
source ~/.zshrc
claude -p "Skill: benseno-brief-sync — run now" --print >> logs/brief-sync.log 2>&1

Sonra launchd'yi her dakika çalıştır, script gerekli mi karar versin:


<key>StartInterval</key>
<integer>60</integer>  <!-- Her 60 saniye -->
14.7.2 Sabah Raporu
com.benseno.sabah-raporu.plist:


<key>StartCalendarInterval</key>
<array>
    <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>50</integer></dict>
    <dict><key>Weekday</key><integer>3</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>50</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>50</integer></dict>
    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>50</integer></dict>
    <dict><key>Weekday</key><integer>6</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>50</integer></dict>
</array>
14.7.3 Aktive et
launchctl load ~/Library/LaunchAgents/com.benseno.brief-sync.plist
launchctl load ~/Library/LaunchAgents/com.benseno.sabah-raporu.plist
# ... diğerleri


# Test
launchctl list | grep benseno


# Log izle
tail -f ~/benseno-tasarim-sistemi/logs/brief-sync.log
14.7.4 Disable / Geri al
launchctl unload ~/Library/LaunchAgents/com.benseno.brief-sync.plist
14.8 Skill SKILL.md Formatı (Claude Code)
Cowork'teki skill formatı Claude Code'da aynen çalışır. Frontmatter + içerik:


---
name: benseno-brief-sync
description: v7.13 · Brief Sync. Slack ↔ Canvas senkronizasyonu. Her :15/:45 hafta içi.
---


# Brief Sync Skill v7.13


## Akış
[14 adımlı detay — yukarıda Bölüm 7.1'de]


## MCP Tool'lar
- mcp__slack__slack_read_canvas
- mcp__slack__slack_search_public
- ...


## Sabitler
CANVAS_ID = F0B1B6XUD44
GRAFIK_CHANNEL_ID = C02SZRJGY0M
...
14.9 Test Komutları
# Skill'i tek seferde manuel çalıştır
claude -p "Skill: benseno-brief-sync — run now"


# Dry-run (gerçek mesaj göndermeden test)
claude -p "Skill: benseno-brief-sync — dry run, sadece ne yapacağını söyle"


# Belirli bir kanaldaki son 10 brief'i parse et
claude -p "Slack #marka-bauhaus kanalındaki son 10 mesajı oku, brief olanları v7.12 parser ile ayrıştır"


# Canvas durumu kontrol
claude -p "Canvas F0B1B6XUD44'ü oku, footer'dan LAST_SYNC_TS değerini söyle"


# marka_stats.json kontrol
claude -p "data/marka_stats.json oku, brands.Bauhaus için tüm metrikleri göster"


# Dashboard mock testi
open dashboard/index.html  # Browser'da aç
# DevTools console: window.EMBEDDED_DATA
14.10 Geçiş Kontrol Listesi
□ Claude Code yüklü (claude --version)
□ Proje klasörü oluşturuldu (~/benseno-tasarim-sistemi)
□ 8 skill kopyalandı (.claude/skills/)
□ Data dosyaları kopyalandı (data/.github-pat, .dashboard-auth-hash, marka_stats.json)
□ Dashboard HTML kopyalandı
□ CLAUDE.md yazıldı (project instructions)
□ Slack MCP yapılandırıldı + test başarılı
□ Google MCP yapılandırıldı + OAuth tamamlandı
□ launchd plist'leri oluşturuldu (8 dosya)
□ launchd job'lar aktif (launchctl list | grep benseno)
□ Log klasörü yazılabilir (logs/*.log dosyaları oluşuyor)
□ Manuel brief sync test başarılı
□ Manuel sabah raporu test başarılı
□ Cowork tarafında scheduled task'lar disable edildi
□ 24 saat paralel çalışma izlendi
□ Sonuçlar Cowork ile karşılaştırıldı (kanal mesajları aynı mı?)
□ Memory dosyaları taşındı (~/.claude/CLAUDE.md veya project-level)
□ Git repo başlatıldı + ilk commit
□ GitHub'a backup push edildi (opsiyonel, private repo)

________________


15. TEST SENARYOLARI
15.1 Brief Sync Smoke Test
Senaryo: Manuel brief açma → Canvas'a düşüyor mu?


1. #marka-bauhaus kanalına şu mesajı yaz:
   📋 Test brief — smoke test
   ⏰ Süre: 25 May 2026 17:00
   👷 Kim: @Aylin
   🏷️ Tip: Sosyal Medya Post


2. 30 dk bekle veya manuel sync tetikle:
   claude -p "Skill: benseno-brief-sync — run now"


3. Beklenen sonuçlar:
   ✓ Canvas Aktif İşler tablosuna yeni satır eklendi
   ✓ Marka: "Bauhaus" (kanal'dan türetildi)
   ✓ Öncelik: 🟡 Normal (deadline ~2 gün, otomatik)
   ✓ Aylin'e DM geldi
   ✓ Google Calendar'da event var
   ✓ Dashboard güncellendi (bensenoint.github.io/dashboard/)
   ✓ Log'da format parser: v7.10=1 (manuel format)


4. Temizlik: brief'e 🔒 reaction ekle, "test" sebep yaz
15.2 Geçmiş Tarih Uyarı Senaryosu
Senaryo: Geçmiş tarih girilince 4 katmanlı uyarı çalışıyor mu?


1. Workflow ile brief aç:
   🎀 İş: Geçmiş tarih test
   ⏰ Süre: 10 May 2026 (geçmişte)
   👷 Kim: @Hasan


2. Brief Sync sonraki run'da:
   ✓ Dashboard'da kart kırmızı yarı-saydam zemin
   ✓ "⚠️ GEÇMİŞ TARİH" badge görünür
   ✓ Brief thread'ine bot cevabı (Şablon 24)
   ✓ Brief açana DM (Şablon 25)
   ✓ Ertesi sabah 07:50 Sabah Raporu'nda "🚩 Tarihi Şüpheli Brief'ler" listesinde


3. Teyit test:
   Brief thread'ine "✅ ok" yaz
   Sonraki sync'te etiket "✓ Teyit edilmiş geç brief"e dönmeli
15.3 Yönetici Override Senaryosu
Senaryo: Yönetici reaction ile öncelik override


1. Brief açıldı, otomatik öncelik 🟡 Normal hesaplandı


2. İpek (yönetici) brief mesajına 🔴 reaction ekler


3. Sonraki Brief Sync run'unda:
   ✓ Öncelik 🟡 → 🔴 değişti
   ✓ Geçmiş sütununa "🔴Yön15:30" notu eklendi
   ✓ Dashboard'da ✋ ikonu (override işareti) görünür
   ✓ Calendar event rengi Banana → Tomato değişti


4. Diğer yönetici override testi:
   Cansu 🟠 reaction ekler → sistem en son'u kabul eder → 🟠


5. Yetkisiz override testi:
   Aylin (tasarımcı) 🔴 ekler → SİSTEM YOKSAYAR (yönetici değil)
15.4 Smart Assign Senaryosu
Senaryo: @auto ile Smart Assign tetikleme


1. Workflow form'da 👷 Kim alanına "@auto" yaz


2. Brief Sync run'unda:
   ✓ Brief thread'ine bot cevabı:
     "Atayalım mı: @Aylin Tozkoparan (skor: 78, breakdown: ...)"
   ✓ 30 dk bekleme penceresi


3. Eda T ✅ reaction ekler


4. Sonraki sync'te:
   ✓ Brief'in atananı Aylin oldu
   ✓ Aylin'e DM gitti


5. Pelin senaryo testi:
   Pelin atanan listesinde olsa bile (n_marka=0) önerilirse uyarı çıkmalı
15.5 Marka Davranış Öğrenmesi (E3) Senaryoları
Senaryo 1: Silent mode davranışı


1. marka_stats.json'da Bauhaus için n=12, median_deadline=1.5g, MAD=0.4


2. Yeni brief: Bauhaus, deadline 5 gün sonra (anormal uzun)


3. Brief Sync run'unda:
   ✓ flag_marka_anormal_uzun = true
   ✓ silent_log_only mode → DM gönderilmedi, dashboard etiketi yok
   ✓ Log'a yazıldı: "marka_kiyasla: Bauhaus n=12 median=1.5 brief_dl=5 flag=anormal_uzun mode=silent"


Senaryo 2: 1 Haziran aktivasyonu


1. 1 Haziran 17:00 Cuma → haftalık retro çalışır
2. now >= active_from → mode = "active" + Cansu DM
3. Sonraki Brief Sync'lerde aynı senaryoda:
   ✓ Şablon 28 DM editöre gönderildi
   ✓ Dashboard'da "📊 sapma" etiketi görünür
15.6 Dashboard EMBEDDED_DATA Mock Testi (KRİTİK!)
Senaryo: Ekibin GitHub Pages'te dashboard görmesi


1. Chrome'da gizli sekme aç
2. bensenoint.github.io/dashboard/ git
3. Şifreyi gir
4. Beklenen:
   ✓ "Cowork bridge YOK" uyarısı GÖRÜNMEMELİ
   ✓ Empty state veya gerçek veri görünmeli
   ✓ Marka Davranış Öğrenmesi widget'ı yüklenmeli


Hata senaryosu:
   ✗ "Cowork bridge YOK" görünür → Cowork artifact'ta EMBEDDED_DATA mock eksik
     Çözüm: artifact'a kalıcı mock eklenmiş olmalı (Bölüm 9.2)
15.7 GitHub Push Senaryosu
Senaryo: PAT yenileme uyarısı


1. .github-pat-created dosyasını manuel düzenle, 85 gün öncesine al
2. Brief Sync run'unda:
   ✓ "PAT 5 gün sonra dolacak" Görkem DM
3. Tarihi 91 gün öncesine al
4. Run'da:
   ✓ "PAT süresi DOLDU" alert
   ✓ Dashboard güncellenmiyor (push 401)
   ✓ Brief Sync log'da: "GitHub: push fail · 401"

________________


16. HATA KURTARMA MATRİSİ
Hata
	Tespit
	Aksiyon
	5 parser fail
	Hiçbir parser eşleşmedi
	Editöre Şablon 8 DM, mesaj formatı kontrol talebi
	Marka tespit fail
	Kanal mapping'de yok
	Title Case fallback, log'a yaz
	Departman belirsiz
	Heuristic karışık
	Cansu+İpek+erdem DM (Şablon 23)
	UTC parse fail
	Datetime format tanınmadı
	Orijinal string sakla, dashboard'da "?" göster
	Canvas internal_error
	Slack API hatası
	30sn bekle, retry. 2. fail → Görkem DM
	Canvas H1 duplikasyon
	section_id_mapping'de aynı başlık 2 kez
	Yeniden full replace, H1'siz
	section_id replace duplikasyon
	Blockquote/footer çoğaldı
	section_id ASLA kullanma, full replace
	GitHub push 401/403
	PAT geçersiz
	Görkem DM "PAT yenile" + link
	GitHub push 404
	Repo/path hatalı
	Görkem DM, manuel kontrol talebi
	Slack rate limit
	429 status
	Exponential backoff (2sn, 4sn, 8sn)
	MCP disconnect
	callMcpTool exception
	Run'ı atla, sonrakine ertele, log
	Reaction yanlış yerde (thread'e)
	Slack permission veya kullanıcı hatası
	Otomatik düzelt: parent mesaja taşı
	🔴 + @auto kombinasyonu
	Acil işte Smart Assign
	Brief açana DM Şablon 18: "Acil işte manuel atama yap"
	Tüm atananlar ✅ vermediği halde tamamlanmış görünüyor
	Parser bug
	Geçmiş'te en son ✅ tüm atanan ID'leri kapsıyor mu kontrol
	Hayalet brief
	60 dk geçti, Canvas'a düşmedi
	Görkem + editör DM
	Pelin onboarding sürecinde Smart Assign önerdi
	n_marka=0, düşük güven
	Atamadan önce DM uyarısı
	marka_stats.json okuma fail
	Dosya bozuk/yok
	Cansu+Görkem DM, manuel düzelt
	Mode geçişi başarısız
	Dosyaya yazma hatası
	Sonraki haftalık retro'da tekrar dene
	

________________


17. SLACK WORKFLOW BUILDER MANUEL KURULUM (Mevcut Cowork'te yok ise)
Eğer Slack Workflow Builder'da "Yeni Brief Aç" yoksa:
17.1 Adım Adım
1. Slack sol-üst köşesinde Benseno workspace adına tıkla
2. Tools & settings → Workflow Builder
3. + New Workflow → "From scratch"
4. Adı: "Yeni Brief Aç"


5. Trigger ekle:
   - From a link in Slack (Shortcut menüsünden)
   - Slash command: /yeni-brief


6. Step 1: Open a form
   Adı: "Yeni Brief Aç"
   Description: "Marka kanalında bir tasarım brief'i aç"


   Alanlar (sırayla ekle):
   a. Single-line text: "🎀 İş"
      Required, max 80 char
   b. Date and time: "⏰ Süre"
      Required, help text: "📌 Geçmiş tarih girersen sistem uyarı eder. Aynı gün için saat de gir."
   c. Multi user picker: "👷 Kim"
      Required, max 6 user
   d. Select from a list: "🏷️ Tip"
      Optional, single choice:
      - Sosyal Medya Post
      - Banner
      - Karusel
      - Video Cut
      - Print
      - Logo Çalışması
      - Diğer
   e. Select from a list: "🔄 Akış"
      Optional, single choice:
      - ● Paralel — hepsi aynı anda
      - → Sıralı — seçim sırasına göre tek tek
   f. Single-line text: "🔗 Ref"
      Optional, URL
   g. Long text: "💬 Not"
      Optional, max 500 char
   h. File upload: "📎 Dosya"
      Optional, max 5 file, max 50 MB each


7. Step 2: Send a message to a channel
   Channel: where the workflow is triggered (current channel)
   Message:
     🎀 İş: {{İş}}
     ⏰ Süre: {{Süre}}
     👷 Kim: {{Kim}}


     🏷️ Tip: {{Tip}}
     🔄 Akış: {{Akış}}
     🔗 Ref: {{Ref}}
     💬 Not: {{Not}}


     🐷 Kimden: {{Kimden}}


   Add attached files: {{Dosya}}


8. Publish workflow


9. Her marka kanalında bookmark ekle:
   Channel → + Add bookmark → Link
   URL: workflow link
   Display name: "📋 Yeni Brief Aç"
   Emoji: clipboard
17.2 Branch Step (Opsiyonel Alanlar İçin)
Eğer Tip, Akış, Ref, Not, Dosya boş ise mesaja eklememe için Branch step kullan:


Step 1.5: Branch
   If {{Tip}} is not empty: show "🏷️ Tip: {{Tip}}"
   If {{Tip}} is empty: skip
   ... (her opsiyonel alan için)

Pratik kısayol: workflow mesajında conditional rendering yok, en kolay yol mesaja her zaman ekle, boş alanlar boş satır olarak görünür (Brief Sync parser bunları yoksayar).


________________


18. CLAUDE CODE'A VERİLECEK İLK PROMPT
Claude Code'u açtıktan ve bu master prompt'u CLAUDE.md veya docs/ klasörüne koyduktan sonra ilk konuşmanı şöyle başlat:


Merhaba Claude Code!


Bu workspace'te `docs/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md` dosyasını oku.
Bu dokümanı tamamen anla — Benseno dijital ajansının tasarım iş takip sistemi
hakkında her şey orada.


Anladıktan sonra şunları kontrol et:
1. `.claude/skills/` klasöründe 5+ skill var mı?
2. `data/marka_stats.json` mevcut mu?
3. `data/.github-pat` ve `.dashboard-auth-hash` var mı?
4. `dashboard/index.html` mevcut mu ve EMBEDDED_DATA bloğunu içeriyor mu?
5. CLAUDE.md project instructions var mı?


Sonra MCP bağlantılarını test et:
- /mcp list ile bağlı server'ları gör
- Slack workspace'e bağlı mı?
- Google Workspace OAuth tamam mı?


Eğer bir şey eksik veya hatalı ise söyle — birlikte düzeltelim.


Eğer her şey hazır ise ilk komutum:
"Brief Sync skill'i dry-run modda çalıştır, sonuçları rapor et."

________________


19. ÖNEMLİ KARARLAR ve İSTİSNALAR
19.1 "İki Yerden Mesaj Gitmemesi" Kuralı
Cowork'te scheduled task çalışırken aynı anda Claude Code launchd job'unu çalıştırma — Slack'e iki kez mesaj gider.


Geçiş döneminde:


* Cowork tasks → enabled
* Claude Code launchd → disabled (launchctl unload)


Cutover sonrasında:


* Cowork tasks → disabled (Cowork UI'dan)
* Claude Code launchd → enabled
19.2 Memory Sistemi Farkı
Cowork: Otomatik auto-memory (memory/ klasörü, MEMORY.md indeksi) Claude Code: ~/.claude/CLAUDE.md (user-level) veya <project>/CLAUDE.md (project-level) manuel yazılır


Mevcut auto-memory'i Claude Code'a taşımak için:


# Cowork memory'sini Claude Code project-level CLAUDE.md'ye append et
cat ~/Library/Application\ Support/Claude/local-agent-mode-sessions/*/spaces/*/memory/*.md >> ~/benseno-tasarim-sistemi/CLAUDE.md
19.3 Workspace Folder Konsepti Farkı
Cowork: ~/Documents/Claude/Projects/{Folder Name}/ workspace klasörü Claude Code: Şu anki working directory (cd ile değiştirilir)
19.4 Artifact Konsepti
Cowork: Live artifact ~/Documents/Claude/Artifacts/{name}/index.html — Cowork sidebar'da render eder Claude Code: Artifact yok. Sadece dosya düzenleme. Dashboard browser'da elle açılır.
19.5 Schedule UI Farkı
Cowork: Sidebar'da "Scheduled" sekmesi, görsel yönetim Claude Code: launchd plist dosyaları, launchctl komutu
19.6 Tool Approval
Cowork: İlk kullanımda sor, "Always allow" seçeneği Claude Code: --allowed-tools flag veya .claude/settings.json ile pre-approve


// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Bash(git*)",
      "mcp__slack__slack_read_canvas",
      "mcp__slack__slack_update_canvas",
      "mcp__slack__slack_search_public",
      "mcp__slack__slack_send_message",
      "mcp__google__gmail_search_threads",
      "mcp__google__calendar_create_event"
    ]
  }
}

________________


20. SONUÇ ve İLK ADIMLAR
20.1 Bu Dokümanın Bekleniş Hali
Bu master prompt 5500+ satırdır. İçinde:


* ✓ Sistem genel mimarisi
* ✓ Ekip yapısı + Slack ID'ler
* ✓ 39 marka kanal mapping
* ✓ 8 scheduled task tam spesifikasyon
* ✓ Algoritmalar (Python kod örnekleriyle)
* ✓ Veri yapıları (JSON şemalar)
* ✓ Dashboard mimarisi + GitHub deploy
* ✓ MCP yapılandırma
* ✓ Phase tarihçesi (v7.0 → v7.13)
* ✓ Bilinen sorunlar + çözümleri
* ✓ Phase 8 backlog (C4 + Mail Router + E3 aktivasyonu)
* ✓ Claude Code'a göç adımları (launchd, plist'ler)
* ✓ Test senaryoları (7 ana senaryo)
* ✓ Hata kurtarma matrisi
* ✓ Slack Workflow Builder manuel kurulum
20.2 Bu Dokümanı Nasıl Kullanırsın
Eğer sıfırdan kuruyorsun (Cowork yok):


1. Bu dokümanın tamamını oku
2. Bölüm 14'ü takip et (Claude Code yükleme)
3. Bölüm 17'yi takip et (Slack Workflow kurulumu)
4. Bölüm 14.7'yi takip et (launchd job'ları)
5. Bölüm 15'teki test senaryolarıyla doğrula


Eğer Cowork'ten geçiyorsun:


1. Bölüm 14.4'ü takip et (Veri taşıma)
2. Bölüm 14.5'i takip et (CLAUDE.md)
3. Bölüm 14.6'yı takip et (MCP)
4. Bölüm 14.7'yi takip et (launchd, paralel çalıştırma)
5. 24 saat paralel izle
6. Bölüm 19.1 cutover prosedürü


Eğer sadece sistemi anlamak istiyorsun:


* Bölüm 3: Sistem Mimarisi
* Bölüm 7: 8 Skill spesifikasyonu
* Bölüm 11: Phase tarihçesi


Eğer Phase 8 planlama yapıyorsun:


* Bölüm 13: Backlog
20.3 Bilinmesi Gereken Riskler
Risk
	Etki
	Azaltma
	Bilgisayar kapalıyken launchd çalışmaz
	Brief Sync atlanır
	Bilgisayarı 7/24 açık tut, mac uyandırma ayarla
	Slack token expire olur
	Tüm sistem çalışmaz
	90 günde bir manuel yenile, takvim hatırlatma kur
	GitHub PAT expire olur
	Dashboard güncellenmez
	90 günde bir yenile (.github-pat-created kontrol)
	MCP connector güncellemesi
	Aniden API değişir
	Test ortamında çalıştır, sonra production'a al
	Slack API rate limit
	Brief Sync atlanır
	Exponential backoff implement et (kod örneği Bölüm 16)
	Disk dolması
	Log'lar şişer
	find logs -mtime +30 -delete cron'u ekle
	20.4 İlk Production Run Sonrası Yapılacaklar (İlk Hafta)
1. Her sabah 09:00'da log kontrol:


tail -100 logs/brief-sync.log | grep -E "ERROR|WARN"

2. Cuma 18:00'da haftalık özet:


   * Cansu DM'sinde marka stats refresh OK mi?
   * Yıldız metrikleri trend görüyor mu?


3. Her gün 17:30'da:


   * Dashboard browser'dan kontrol (ekip görebiliyor mu?)
   * Beklenmedik uyarı var mı (PAT, hayalet brief)?


4. Hafta sonu:


   * Log'ları arşivle, disk yer aç
   * marka_stats.json git diff kontrol (manuel düzeltme yapıldı mı?)
20.5 Mevcut Cowork Sistemiyle Karşılaştırma Listesi (Eğer paralel çalıştırıyorsan)
Test
	Cowork çıktısı
	Claude Code çıktısı
	Aynı mı?
	Pazartesi 07:50 Sabah Raporu kanal mesajı
	✓
	?
	□
	Pazartesi 07:50 Cansu DM
	✓
	?
	□
	Pazartesi 07:50 16 günaydın DM
	16/16
	?
	□
	Brief Sync :15 run sonrası Canvas
	snapshot al
	snapshot al
	diff
	Dashboard GitHub Pages güncel mi
	✓
	?
	□
	Cuma 17:00 haftalık retro
	✓
	?
	□
	marka_stats.json diff
	—
	—
	git diff
	

________________


21. EK BİLGİLER
21.1 Mevcut PDF Kılavuz
docs/Benseno-Kullanim-Kilavuzu-v7.13.pdf — 42 sayfa, 3.2 MB


Ekibe verilen son-kullanıcı kılavuzu. Bu dokümandan farklı: bu teknik kılavuz, o kullanıcı kılavuzu.
21.2 Memory Dosyaları (Cowork)
Mevcut Cowork memory'sinde şunlar var:


* feedback_canvas_h1_no_duplicate.md — Canvas H1 koyma kuralı
* feedback_canvas_section_replace_duplicates.md — section_id kullanma kuralı
* feedback_dashboard_embedded_data_required.md — EMBEDDED_DATA mock kuralı
* feedback_brief_sync_git_workflow.md — GitHub push yöntemi
* project_pelin_replaced_beyza.md — 15 May 2026 ekip değişikliği
* project_team_roster_drift.md — Ekip listesi 2 yerde uyarısı
* project_phase8_c4_ai_mockup_pending.md — Phase 8 backlog
* project_v712_priority_auto_past_deadline.md — v7.12 değişiklikleri
* project_v713_marka_stats.md — v7.13 E3 detayları
* project_15may_batch_closure.md — Bauhaus 8+1 toplu kapanış
* project_benseno_management_roles.md — 5 yönetici rolleri
* project_claude_code_migration_plan.md — Bu göç planı


Claude Code'a taşırken bunları CLAUDE.md'ye append edebilirsin.
21.3 İletişim ve Destek
Sorularını Görkem Kaya (gorkem@benseno.com.tr) ile paylaş — sistemin yaratıcısı ve mevcut sahibi.


Acil durumlar için:


* Sistem çöktü → Görkem direkt müdahale
* Tasarımcı yardım istiyor → İpek
* Editör brief kalite sorusu → erdem
* Müşteri ilişkisi → Cansu (Direktör) veya Reyhan (GMY)


________________


EOF — Master Prompt v1.0
Bu dokümanı oluşturan: Anthropic Claude (Cowork modu, Sonnet 4.7) Tarih: 16 Mayıs 2026 Versiyon: v1.0 Toplam: 21 bölüm, ~5500 satır


Bu doküman, Benseno Tasarım Sisteminin tüm bilgi haritasıdır. Claude Code'a verildiğinde agent sistemi sıfırdan inşa edebilir, mevcut sistemden geçişi yönetebilir veya gelecek fazları planlayabilir.


Her zaman buraya geri dön. Soruların cevabı burada.