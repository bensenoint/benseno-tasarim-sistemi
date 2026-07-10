// app/screens/Help.jsx — Yardım: Slack komutları, emoji/kelime kısayolları, kapasite, tarih filtresi, brief yönetimi.
// Kaynak: scripts/slack-bot.js (reaction_added DURUM_MAP, EMOJI_DURUM, KEYWORD_MAP, REACTION_EMOJI, finansal regex, brief sil)
//         + dashboard/app/calc.js (rol ağırlıklı kapasite) + ekranlar (Detay bakış, Departmanlar özet, Geçmiş, Marka).
function HelpScreen() {
  const Section = ({ title, children, note }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ font: 'italic 500 18px/1.15 var(--font-display)', color: 'var(--ink)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>{title}</div>
      {note && <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--ink-4)', marginBottom: 12 }}>{note}</div>}
      {children}
    </div>
  );

  const Row = ({ left, right, sub }) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 150, font: '500 12px/1.4 var(--font-mono)', color: 'var(--ink)', background: 'var(--paper-2)', borderRadius: 4, padding: '4px 8px', flexShrink: 0 }}>{left}</div>
      <div>
        <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--ink-2)' }}>{right}</div>
        {sub && <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  // emoji: görünür klasik emoji(ler). alt: Benseno özel emoji kodu(ları) (:bso-…:) — Slack'te ikisi de aynı işi yapar.
  const EmojiRow = ({ emoji, alt, label, desc }) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 20, lineHeight: 1.1, flexShrink: 0, width: 70, textAlign: 'center', paddingTop: 1 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--ink)', marginBottom: 3 }}>{label}</div>
        <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--ink-3)' }}>{desc}</div>
        {alt && <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ font: '400 10px/1 var(--font-sans)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Benseno emojisi</span>
          {(Array.isArray(alt) ? alt : [alt]).map((a, i) => (
            <span key={i} style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--ink-2)', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px' }}>{a}</span>
          ))}
        </div>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ font: 'italic 500 24px/1.15 var(--font-display)', color: 'var(--ink)' }}>Yardım</div>
        <div style={{ font: '400 13px/1 var(--font-sans)', color: 'var(--ink-3)', marginTop: 4 }}>Slack komutları, kısayollar, kapasite ve brief yönetimi</div>
      </div>

      <Section title="🏷️ İş Tipleri & Süre Öğrenme" note="Her işe bir iş tipi atanır (19 tip: SM görseli, baskı-POP, video, ambalaj, SM planı...). Sistem, 🚀 işe başlandı işaretli işlerin GERÇEK çalışma süresinden (beklemede/müşteride ve mesai dışı süreler düşülür) tip başına tipik süreyi öğrenir — her teslimle güncellenir.">
        <Row left="Yeni işte tip" right="/yeni-brief formunda zorunlu seçim; Slack'te seçilmezse form uyarır" sub="API'ye tipsiz düşen işlere başlıktan otomatik tahmin atanır"/>
        <Row left="Tip değiştirme" right="Dashboard'da iş detayı (drawer) → 🏷️ İş tipi menüsü"/>
        <Row left="İş Tipleri ekranı" right="Menü → İş Tipleri: tip×adet, tip×marka, tip×kişi, öğrenilen süreler (medyan · aralık · n), gecikme oranı, aylık trend" sub="n<3 olan tiplerde 'veri birikiyor' gösterilir. Süre verisi 🚀 işaretine bağlıdır — işe başlarken işaretlemek veriyi besler."/>
        <Row left="Ody'ye sor" right="'En çok hangi iş tipini yapıyoruz?', 'SM planı tipik ne kadar sürüyor?', '#85 nedir?' (tip + tipik süre gösterir)"/>
      </Section>

      <Section title="🤖 Slack Komutları" note="Slack'te herhangi bir kanalda yazın.">
        <Row left="/yeni-brief" right="Marka kanalında yeni brief açar" sub="Form: başlık, marka (kanaldan otomatik), termin, işi yapanlar, lead, gözlemci, not, dosya"/>
        <Row left="/brief-durum" right="Sana atanmış aktif briefleri listeler"/>
        <Row left="/kapasite" right="Ekip kapasitesini gösterir" sub="Yönetici"/>
        <Row left="/maliyet" right="Bir brief'in maliyet/satış bilgisini girer"/>
        <Row left="/yardim" right="Komut rehberini Slack içinde gösterir"/>
        <Row left="help" right="Herhangi bir kanala 'help' yaz → sorun/öneri bildirim formu (sistem adminlerine DM)"/>
      </Section>

      <Section title="📌 Brief Durum Emojileri" note="Brief thread'ine reaction olarak ekleyin VEYA thread'e o emojiyle başlayan bir mesaj yazın — ikisi de aynı sonucu verir. Hem KLASİK emojiler hem BENSENO özel emojileri (:bso-…:) çalışır. YETKİ: durumu yalnız işin atananı (yapan/lead), açanı veya yönetici değiştirebilir — başkasının emoji/reaction'ı işleme alınmaz (kişiye DM ile bildirilir).">
        <EmojiRow emoji="🎨 ✍️ 🤖" alt={[':bso-calisiliyor:']} label="İş kabulü / İş planında" desc="İşi planına aldım (🎨 tasarım · ✍️ editör · 🤖 AI). Açıldıktan sonra 1 saat içinde bu emojiyi koyman beklenir."/>
        <EmojiRow emoji="🚀" label="İşe başlandı" desc="Fiilen çalışmaya başladım."/>
        <EmojiRow emoji="🔄" alt={[':bso-devam:']} label="Devam ediyor" desc="İş hâlâ aktif olarak sürüyor."/>
        <EmojiRow emoji="👀" alt={[':bso-incelemede:']} label="İncelemede" desc="İş gözden geçiriliyor / revize sunuldu."/>
        <EmojiRow emoji="⏸️" alt={[':bso-beklemede:']} label="Beklemede" desc="Müşteri / onay / materyal bekleniyor."/>
        <EmojiRow emoji="✏️" alt={[':bso-revizyon:']} label="Revizyon" desc="Düzeltme isteği geldi. ✈️'dan sonraki İLK ✏️ müşteri revizyonu, diğerleri iç revizyon sayılır."/>
        <EmojiRow emoji="✈️" alt={[':bso-musteriye:']} label="Müşteriye yollandı" desc="İş müşteri onayına gönderildi → 'Müşteride' durumuna geçer; aktif yük/kapasite ve hareketsizlik hesabından çıkar. (Detay bakış'ta 'Müşteride' filtresinde görünür.) Müşteri revizyonla dönünce otomatik aktif listeye döner."/>
        <EmojiRow emoji="✅" alt={[':bso-tamamlandi:']} label="Tamamlandı" desc="İş bitti. Thread'deki son görsel otomatik olarak galeriye kaydedilir."/>
        <EmojiRow emoji="📎" alt={[':bso-galeri-muhru:']} label="Final teslim (galeri)" desc="Dosya içeren bir mesaja koy → o mesajdaki TÜM dosyalar (görsel + PDF/video vb.) işin final teslimi olarak galeriye kaydedilir. ✅'in otomatik 'son görsel'inden farkı: hangi dosyaların gireceğini SEN seçersin. Dosyasız mesaja koyarsan bot uyarır."/>
        <EmojiRow emoji="🔃" alt={[':bso-yeniden-acildi:']} label="Yeniden açıldı" desc="Tamamlanmış brief'i tekrar 'devam ediyor' durumuna çeker."/>
      </Section>

      <Section title="🚦 Öncelik Emojileri" note="Brief'e reaction olarak ekleyin (atanan veya yönetici). Klasik renk emojileri ve Benseno özel emojileri birlikte çalışır.">
        <EmojiRow emoji="🔴" alt={[':bso-acil:']} label="Acil" desc="En yüksek öncelik."/>
        <EmojiRow emoji="🟠" alt={[':bso-yuksek:']} label="Yüksek" desc=""/>
        <EmojiRow emoji="🟡" alt={[':bso-normal:']} label="Normal" desc=""/>
        <EmojiRow emoji="🟢" alt={[':bso-dusuk:']} label="Düşük" desc=""/>
      </Section>

      <Section title="⌨️ Kelime Kısayolları" note="Brief thread'ine TAM olarak şu kelimeyi yazın (içinde geçmesi yetmez — birebir eşleşme gerekir). Türkçe karaktersiz (ASCII) varyantları da çalışır.">
        <Row left="devam et · devam ediyor" right="Devam ediyor (çalışılıyor)"/>
        <Row left="iş incelemede · iş inceleme" right="İncelemede"/>
        <Row left="iş beklemede · bekle" right="Beklemede"/>
        <Row left="revizyon var · revize et" right="Revizyon"/>
        <Row left="müşteriye yollandı · müşteriye gönderildi" right="✈️ Müşteride"/>
        <Row left="revize: @kişi" right="⛓️ Sıralı işte zinciri o halkaya geri sarar"/>
        <Row left="termin 15.06 17:00" right="Termini değiştirir — 'termin yarın 14:30' da olur; saat yoksa 18:00" sub="Dashboard'da brief detayında Deadline'a tıklayarak da değiştirilir."/>
        <Row left="iş tamamlandı" right="Tamamlandı"/>
        <Row left="yeniden aç · geri aç" right="Yeniden açıldı (çalışılıyor)"/>
        <Row left="bloke et" right="Blokeli"/>
        <Row left="acil öncelik" right="🔴 Acil" sub="yüksek öncelik → 🟠 · normal öncelik → 🟡 · düşük öncelik → 🟢"/>
      </Section>

      <Section title="💰 Finansal Bilgi" note="Brief thread'ine yazın. Dashboard'a birkaç dakika içinde yansır.">
        <Row left="maliyet 1500 satış 4000" right="Maliyet ve satış tutarını kaydeder" sub="Tek tek de yazılabilir: 'maliyet 1500' / 'satış 4000'"/>
        <Row left="/maliyet" right="Slack komutuyla da girilebilir — veri DB'ye kaydedilir"/>
        <Row left="fatura ok" right="Fatura kesildi olarak işaretler" sub="Geri almak için: fatura iptal"/>
        <Row left="ödeme ok" right="Ödeme alındı olarak işaretler" sub="Geri almak için: ödeme iptal"/>
        <Row left="💰 Drawer'dan giriş" right="Brief detayında (çekmece) 'Finans' bölümü: maliyet/satış/fatura/ödeme doğrudan girilir — Slack'e gerek yok" sub="Yalnız yönetici görür ve girebilir. Kâr/marj hesapları (Marka detayı, Tamamlananlar, haftalık brifing) bu veriden beslenir."/>
        <Row left="Tamamlanma hatırlatması" right="Bir iş finans girilmeden tamamlanırsa thread'e otomatik '💰 maliyet/satış girilmedi' notu düşer" sub="Veri girildikçe hatırlatma kendiliğinden kesilir."/>
        <Row left="🔒 Gizlilik" right="Maliyet/satış bilgisi dashboard'da YALNIZ giriş yaptıktan sonra görünür — herkese açık (login'siz) sayfada gösterilmez" sub="Slack tarafı değişmez: /maliyet ve thread'e maliyet/satış yazımı hâlâ çalışır, veri DB'ye kaydedilir; giriş yapan kullanıcılar dashboard'da görür. Kâr/marj yalnız yöneticiye gösterilir."/>
      </Section>

      <Section title="📊 Kapasite & İş Yükü" note="Bir kişinin/departmanın yükü ROL AĞIRLIKLI hesaplanır — her işteki rolü kadar yük sayılır.">
        <Row left="İşi yapan = 5" right="İşi fiilen yapan (worker) en yüksek ağırlık"/>
        <Row left="Lead = 1" right="İşin lead'i (sorumlusu) düşük ağırlık"/>
        <Row left="Gözlemci = 0" right="Gözlemcilik gözetimdir, ÜRETİM yükü değil → kapasiteye KATILMAZ" sub="Bu yüzden her işe gözlemci eklenen yöneticiler yapay olarak %100 görünmez. Genel bakış, Departman ve Profil aynı kuralı kullanır."/>
        <Row left="Kapasite %" right="Ağırlıklı yük, kişinin limitine göre yüzdeye çevrilir" sub="Limit: yönetici 10 · editör 8 · tasarım/AI/freelance 6 (yarım gün çalışanda yarıya iner)."/>
        <Row left="Tarihe duyarlı" right="Geçmiş bir tarih aralığı seçilirse kapasite/aktif yük, o tarihte açık olan işlerden geri-hesaplanır" sub="Bugünü kapsayan aralıkta güncel durumu gösterir."/>
        <Row left="📅 Kapasite v2 (yeni)" right="Zamana yayılmış model: işin değeri başlangıç→teslim penceresine bölünür; güne düşen pay = kalan değer / kalan iş günü" sub="Başlanmamış işte pay deadline yaklaştıkça BÜYÜR; başlanınca düzenli çalışmada sabit akar; beklemede/müşteride/blokeli günlere pay binmez (kalan emek döneceği güne sıkışır); geciken işin tüm kalan değeri bugüne biner; teslimde yük düşer, yeniden açılan iş tam değerle döner. %100 AŞILABİLİR (aşırı yük görünsün diye). Profil'de 'Kapasite v2' KPI + 5 iş günü projeksiyon şeridi; Departman ekranlarında 'v2 bugün' değeri — deneme döneminde eski %'nin yanında."/>
        <Row left="Deadline zorunlu" right="Terminsiz iş açılamaz — v2 model terminsiz yükü hesaplayamaz" sub="Slack /yeni-brief formunda da zorunlu alandır."/>
      </Section>

      <Section title="🗓️ Tarih Aralığı Filtresi" note="Üstteki 📅 düğmesi — tüm raporlama ekranlarını seçili döneme göre süzer.">
        <Row left="Hazır aralıklar" right="Bugün · Dün · Son 7/30/90 gün · Bu yıl · Tüm zamanlar"/>
        <Row left="Özel aralık" right="Başlangıç–bitiş tarihi seç"/>
        <Row left="Neyi etkiler" right="Tamamlanan işler, yıldız ortalamaları, dönemsel özet, geçmiş, galeri, marka detayı, departman karnesi" sub="Aktif iş LİSTELERİ her zaman güncel kalır (tarihten bağımsız)."/>
        <Row left="Kanban" right="Kanban'da tarih filtresi pasiftir (anlık akış gösterir)"/>
      </Section>

      <Section title="🔔 Otomatik Takip & Uyarılar" note="Sistem işlerin sahipsiz kalmasını engellemek için otomatik kontroller yapar (hafta içi 09-19, saatte bir).">
        <Row left="1 saat" right="Brief açıldıktan 1 saat sonra hâlâ başlama emojisi (🎨/✍️/🤖 · :bso-calisiliyor:) konmadıysa atanana hatırlatma DM'i gider" sub="Thread'e yazı yazmak yeterli değil — işi planına aldığını emoji ile bildir."/>
        <Row left="+2 saat" right="Hâlâ planına alınmadıysa: atanana 2. hatırlatma + departman yöneticisine bilgi DM'i" sub="İşi yapamayacaksan beklemeden yöneticine haber ver."/>
        <Row left="24 iş saati" right="Hareket olmayan brief 'Hareketsiz' işaretlenir (dashboard rozeti)" sub="Cmt/Paz + TR resmî tatilleri sayılmaz; hareket gelince işaret otomatik kalkar."/>
        <Row left="🌴 Tatil" right="Slack durumunu 🌴 / 'tatil' / 'izin' / 'OOO' yaparsan uyarılar sana gelmez" sub="Tüm atananları tatildeki brieflerde hareketsizlik süresi de işlemez."/>
      </Section>

      <Section title="🔔 Bildirimler & Tercihler" note="Bildirimler günlük dijeste toplanır; sadece acil olanlar anında gelir. Rozetler dashboard'da, tercihler Profil ⚙️'de.">
        <Row left="Günlük dijest" right="Hafta içi 08:30 (sabah) + 13:30 (öğle) — biriken bildirimler tek DM'de toplu gelir" sub="Öğle dijesti tercihten kapatılabilir."/>
        <Row left="Acil = anında DM" right="Termin riski + yeni atama anında DM gelir; diğer her şey dijeste toplanır"/>
        <Row left="Sessiz saat" right="Gece penceresinde (varsayılan 19:00–08:00) anlık DM gelmez — dijeste kalır" sub="Aralık Profil ⚙️'den ayarlanır."/>
        <Row left="İş/marka rozetleri" right="Dashboard'da okunmamış bildirim sayısını gösteren rozetler"/>
        <Row left="Bildirim popover" right="Rozete tıkla → bildirim listesi açılır; okunmamış/okunmuş ayrı; açınca okundu sayılır; bir bildirime tıklayınca ilgili brief detayı açılır" sub="Boşluğa tıkla veya Esc ile kapanır."/>
        <Row left="⚙️ Tercihler" right="Profil ekranında sağ üstteki ⚙️ (Ayarlar) → 'Bildirim tercihleri': Öğle dijesti aç/kapa · Termin/atama/bloke anlık aç/kapa · Sessiz saat aralığı · Ody günlük içgörü aç/kapa · Firma risk sinyalleri aç/kapa (yönetici)" sub="Yalnız kendi profilinde görünür."/>
      </Section>

      <Section title="⚡ Dashboard'dan Aksiyon" note="Brief kartlarında, brief detay çekmecesinde ve Profil→Bugün'de: Slack'e geçmeden durumu güncelle. Her aksiyon Slack thread'ine de yansır. Butonlar yetkiye göre görünür.">
        <Row left="🚀 Başladım" right="İşe başladığını işaretler" sub="Atanan kişide görünür."/>
        <Row left="⏭️ İlerlet" right="İşi bir sonraki hedef statüye taşır → [hedef statü]" sub="Atanan kişide görünür."/>
        <Row left="⏱️ Termini uzat" right="Termini +[süre] uzatır — bekleme telafisidir (muaf uzatma, puan düşürmez)" sub="Atanan (işi yapan/lead) / açan / yönetici görebilir; yalnız bekleme/müşteride'den dönen işte aktiftir."/>
        <Row left="🔔 Hatırlat" right="İş için hatırlatma kurar (thread'e not + atananlara bildirim)" sub="Atanan (işi yapan/lead) / açan / yönetici görebilir. Aynı işe 10 dk içinde ikinci hatırlatma gönderilmez."/>
        <Row left="⏳ Öngörülen gecikme" right="Rozet: işin geçmiş tamamlanma hızına ve revize/termin durumuna göre 'deadline yetişmeyebilir' erken uyarısı" sub="Brief detayında; atanan + yönetici görür. Reaktif 24sa termin riskinden farklı — ERKEN tahmindir."/>
      </Section>

      <Section title="👋 Yeni Başlayanlar" note="Sistemi ilk kez kullananlar için yönlendirme; deneyimliler için üst çubuktaki '?' ile her zaman tekrar açılabilir.">
        <Row left="Tanıtım turu" right="İlk giriş 4 adımlık tur — hiç işi olmayan yeni kullanıcıda bir kez otomatik açılır" sub="Üst çubuktaki '?' ile herkes tekrar açabilir."/>
        <Row left="Hoş geldin kartı" right="Hiç işin yokken profilde 'Hoş geldin' kartı görünür"/>
        <Row left="Boş ekran yönlendirmesi" right="Boş ekranlarda 'ne yapmalısın' yönlendirmesi çıkar"/>
        <Row left="🗓️ Bugün" right="Profil'de 'Bugün' açılır bölümü: sıradaki iş + bugün deadline + geciken" sub="Yalnız kendi profilinde görünür. Dashboard aksiyon butonları burada da çalışır."/>
      </Section>

      <Section title="⭐ Yıldız Puanlama & Karne" note="Her tamamlanan işe AI, thread'inden 1-5 kalite puanı verir (5=pürüzsüz/zamanında, 1=ciddi sorun).">
        <Row left="AI puanı" right="İş tamamlanınca otomatik verilir — Tamamlananlar'da yıldızların yanında 'AI' rozeti görünür"/>
        <Row left="Deadline uzatma cezası" right="Bir işin deadline'ı ileri tarihe alınırsa AI puanından otomatik düşülür — deadline'a ne kadar YAKIN uzatılırsa o kadar çok" sub="48sa'dan fazla kala -0.5 · 24-48sa arası (48 dahil) -1.0 · 24sa ve altı -1.5 · deadline GEÇTİKTEN sonra -2.0. Birden fazla uzatmada en kötüsü sayılır. Yönetici override'ı etkilenmez."/>
        <Row left="Teslim durumu" right="Tamamlananlar'da 'Teslim' kolonu: 🟢 Zamanında · 🟡 Uzatılarak teslim · 🔴 Gecikmeli"/>
        <Row left="Yönetici override" right="Tamamlananlar'daki yıldızlara tıklayarak puanı değiştir (yönetici)" sub="Override sonrası AI o işe bir daha dokunmaz."/>
        <Row left="Yıldız Karnesi" right="Departmanlar özet sayfasında + her departman sayfasında: firma & departman puan ortalamaları (seçili tarih aralığına göre)" sub="Genel Bakış'taki 'BENSENO ⭐' rozeti de Departmanlar özet'e götürür. Marka puanı Marka detayında; başkalarının kişi puanları yalnız yöneticiye. KENDİ puanlarını herkes kendi profilinde görür (bkz. ⭐ Performansım)."/>
        <Row left="Değerlendirme (aç)" right="Karnedeki 'Değerlendirme' satırını AÇINCA, seçili döneme özel AI yorumu o an üretilir" sub="Sayfa/tarih değişiminde otomatik çalışmaz (maliyet yok); açtığında üretir, tarih değişince yeniden. Sayısal veriler her zaman DB'den."/>
        <Row left="⛓️ Sıralı iş" right="Brief 'Sıralı' açılırsa işi yapanlar seçim sırasına göre zincir olur: ✅ yalnız sıradaki halkayı onaylar, herkes onaylamadan iş kapanmaz" sub="✏️ zinciri geri sarar; 'revize: @kişi' belirli halkaya döndürür. Uyarılar ve yük yalnız sırası gelen kişiye işler."/>
      </Section>

      <Section title="⭐ Performansım — Kendi Puanların & Trend" note="Kendi profilinde (yalnız sana görünür): kendi işlerinin puanı, AI'ın yazılı sebebi ve aylık gelişimin.">
        <Row left="Performansım kartı" right="Tamamlanan sayısı · ort. puan · zamanında % · ort. revize · ort. döngü · iş/hafta + en çok çalıştığın markalar" sub="Profil'de, Bugün bölümünün altında. Tamamlanan işin yoksa görünmez."/>
        <Row left="İşlerim ve puanlarım" right="Son 20 tamamlanan işin ⭐ puanı — yıldızların üzerine gelince AI'ın yazılı SEBEBİNİ görürsün" sub="'Neden 3 yıldız aldım' artık cevaplı. Puanlar salt-okunur: yalnız yönetici değiştirebilir. Başkalarının puanlarını göremezsin."/>
        <Row left="Son 6 ay trendi" right="Aylık mini çubuklar + tablo: ay bazında iş sayısı, ort. puan, zamanında %, ort. döngü" sub="'Geçen aylara göre iyileşiyor muyum' tek bakışta. En az 2 dolu ay veri olunca görünür."/>
      </Section>

      <Section title="📡 Firma Sinyalleri & Haftalık Brifing (yönetici)" note="Sistem firma-geneli riskleri kendiliğinden yöneticilere bildirir — sormana gerek kalmaz.">
        <Row left="09:00 + 15:00 sinyal taraması" right="Hafta içi günde 2 kez: kapasite >%85 · geciken iş >5 · marka müşteri-risk yükselişi · kişi kalite-düşüşü · öngörülen gecikme (marka bazında toplu) · burnout projeksiyonu (gelecek 5 gün ≥%120 doluluk)" sub="Yalnız yöneticilere DM + dashboard bildirimi. Aynı sinyal günde 1 kez gelir; sessiz saate uyar."/>
        <Row left="Pazartesi 08:00 brifing" right="Ody haftalık GM brifingi: tüm sinyalleri + finans özetini yorumlayıp 'bu hafta neye dikkat' DM'i gönderir" sub="En güçlü modelle sentezlenir; finans verisi girilmemişse bunu açıkça belirtir (uydurmaz)."/>
        <Row left="Aç/kapa" right="Profil ⚙️ → Bildirim tercihleri → 'Firma risk sinyalleri (yönetici)'" sub="Kapatınca hem sinyaller hem haftalık brifing sana gelmez."/>
      </Section>

      <Section title="📡 Marka Günlük Takibi" note="Marka detay sayfasında, tabloların altında.">
        <Row left="Kanal Özeti" right="Marka kanalının tüm akışının (thread'ler dahil) AI özeti — saatte bir güncellenir"/>
        <Row left="Gün Sonu Insight" right="Hafta içi 18:45'te günün değerlendirmesi (tempo, sürtünme, müşteri sinyalleri) arşive yazılır"/>
        <Row left="Tarih filtresi" right="'Şu an (canlı)' veya geçmiş bir günü seç → o günün özeti + insight'ı" sub="Günlük kayıtlar bir önceki günle ilişkilendirilir — dünden sarkan konuların bugünkü durumu belirtilir."/>
      </Section>

      <Section title="🤖 Ody — Sistem Asistanı, Bildirimler & Ruh Halleri" note="Sağ altta yüzen maskot. Sürükleyerek istediğin yere taşıyabilirsin; pencere küçülünce kendini görünür alana çeker.">
        <Row left="Soru sor" right="Ody'ye tıkla → kullanım soruları + marka/iş/kişi bazlı canlı veri soruları + öneri/değerlendirme" sub="Sayısal yanıtlar her zaman DB'den; kişi puanlarını sadece yöneticilere söyler. Sentez/öneri sorularında daha güçlü modele yükselir."/>
        <Row left="💬 Canlı Slack bilgisi" right="Ody gerektiğinde Slack'ten canlı bilgi çeker: kanal son mesajları, iş thread'i, arama, kişinin durumu/tatilde mi" sub="Yalnız SENİN üye olduğun kanalların bilgisini verir (erişim filtresi). Örn: 'X kanalında son ne konuşuldu?', 'Ali tatilde mi?'"/>
        <Row left="📉 Yönetici araçları" right="Yöneticiler Ody'den kârlılık özeti ('bu ay marka kârlılığı?') ve marka müşteri-risk trendi ('X markasında ilişki nasıl gidiyor?') isteyebilir" sub="Finans ve risk yanıtları yalnız yöneticiye."/>
        <Row left="👍👎 Öğrenme" right="Ody'nin önerilerine verdiğin 👎'ler (sebepleriyle) sonraki önerilerine yön verir — beğenilmeyen tarzı tekrarlamaz"/>
        <Row left="📤 Slack'e mesaj" right="'Ody, #85 thread'ine yaz: revizyon yarına sarkıyor' → Ody önizlemeyi gösterir, SEN onaylayınca gönderir" sub="Mesajlar '🤖 Ody — {adın} adına' imzasıyla gider. Thread'e: atanan/açan/yönetici · kişiye DM ve marka kanalı: yalnız yönetici. Saatte en çok 10 gönderim."/>
        <Row left="💬 Slack DM diyaloğu" right="Slack'te bota (WT) DM yazarsan Ody okur, kaydeder ve yetkin dahilinde aksiyon alır — durum sorma, iş listesi, mesaj iletme hepsi DM'den de çalışır" sub="Konuşma bağlamı 2 saat hatırlanır. Yetkiler dashboard ile aynıdır."/>
        <Row left="Sohbet kalır" right="Paneli kapatıp başka iş halledip tekrar açtığında sohbet kaldığı yerden devam eder" sub="'sohbeti temizle' ile sıfırlanır."/>
        <Row left="🔔 Bildirimler" right="Çan Ody'de; okunmamış sayısı üstteki kırmızı rozette görünür" sub="Paneli açtığın an okundu sayılır. Bir bildirime tıklayınca ilgili Slack thread'i açılır."/>
        <Row left="📋 Günlük özet" right="Ody'yi açınca bugünkü kişisel iş özetini bir kez gösterir"/>
        <Row left="💡 Günlük içgörü" right="Ody sabahları, kayda değer durumda (riskli/geciken/bugün biten işin varsa) günde bir tek satır 💡 içgörü verir — dashboard bildirimi + Slack DM" sub="Kayda değer bir şey yoksa susar. Profil ⚙️ Bildirim tercihlerinden 'Ody günlük içgörü' ile kapatılabilir."/>
        <Row left="😊 Ruh halleri" right="Ody senin kişisel iş akışına göre ifade değiştirir; üzerine gelince nedenini yazar" sub="meşgul=işin çok · kızgın=2'den fazla geciken · düşünüyor=yeni iş · mutlu=iş tamamladın · uyuyor=1 saattir bildirim yok"/>
      </Section>

      <Section title="💬 Thread Özeti & Raporlar">
        <Row left="Thread Özeti" right="Her brief'in Slack yazışmaları AI ile özetlenir — brief detayında '💬 Thread Özeti' bölümü" sub="Hafta içi saatte bir güncellenir; yeni mesaj yoksa değişmez."/>
        <Row left="07:50 sabah raporu" right="Firma geneli günlük durum raporu — #benseno-grafik kanalına + 5 yöneticiye DM" sub="Kişisel dijestten ayrıdır; yönetim özeti niteliğindedir."/>
        <Row left="08:30 dijest" right="Sabah dijesti — dünden bugüne biriken bildirimlerin tek DM'de toplu özeti; aktif işi olan herkese" sub="İşin yoksa DM gelmez. Detay: '🔔 Bildirimler & Tercihler'."/>
        <Row left="13:30 dijest" right="Öğle dijesti — sabahtan beri biriken bildirimlerin ikinci toplu özeti" sub="Profil ⚙️ Bildirim tercihlerinden kapatılabilir."/>
        <Row left="Acil = anında DM" right="Termin riski + yeni atama gibi acil bildirimler dijeste beklemeden ANINDA DM gelir; gerisi dijeste toplanır"/>
      </Section>

      <Section title="👁️ Otomatik Gözlemci" note="Yeni brief açıldığında işi yapanların departman yöneticileri otomatik gözlemci olarak eklenir; bildirim ilk thread yanıtındaki mention ile gelir. (Gözlemcilik kapasiteye yük olarak EKLENMEZ.)">
        <Row left="Tasarım" right="İpek Akdeniz"/>
        <Row left="Editör" right="Cansu Kazgan, Erdem Akoğlu"/>
        <Row left="AI" right="Görkem Kaya, Reyhan Nur Pınar"/>
        <Row left="Freelance" right="İşi açan kişinin departman yöneticisi" sub="Freelancerlar Slack'te olmadığı için DM/uyarı almaz; süreci içeriden açan kişi yönetir."/>
      </Section>

      <Section title="🗑️ Brief Silme & Geri Alma" note="Silme kalıcı değildir — silinen briefler 'Silinenler' ekranına taşınır ve geri alınabilir.">
        <Row left="brief sil" right="Slack: thread'e 'brief sil' yazın → brief Silinenler'e taşınır" sub="Bot onay mesajı düşer."/>
        <Row left="Thread'i sil" right="Slack: brief ana mesajını silerseniz brief otomatik Silinenler'e taşınır"/>
        <Row left="🗑️ Sil (dashboard)" right="Brief detay panelinde sol alttaki Sil butonu" sub="Yönetici"/>
        <Row left="↩ Geri al" right="Silinenler ekranından brief'i aktif listeye geri getirir" sub="Yönetici"/>
        <Row left="🗑️ Kalıcı sil" right="Silinenler ekranından brief'i tamamen siler — GERİ ALINAMAZ" sub="Yönetici"/>
      </Section>

      <Section title="🔍 Dashboard İpuçları">
        <Row left="Detay bakış" right="Tüm işlerin filtrelenebilir listesi (eski 'Aktif işler'). Statü/kişi/marka filtreleri + 100 satır/sayfa" sub="Genel bakış KPI kartlarına tıklayınca ilgili filtreyle açılır. 'Müşteride' işler de burada bir filtre."/>
        <Row left="Departmanlar özet" right="4 departmanın karşılaştırması + ortak Yıldız Karnesi (tarihe duyarlı)"/>
        <Row left="Departman sayfaları" right="Sıra: iş listesi → Yıldız Karnesi → Departman ekibi + Dönemsel özet" sub="Sol menüden Tasarım / Editör / AI / Freelance."/>
        <Row left="Marka detayı" right="Tek 'Durum' filtresi (aktif alt-statüler + Müşteride + Tamamlanan); Yıldız Karnesi listenin altında. Tamamlanan işlere tıklayıp salt-okunur detayı açabilirsin"/>
        <Row left="💰 Kâr/marj (yönetici)" right="Marka detayında kâr/marj + faturalanmamış/tahsil edilmemiş; Tamamlananlar'da kâr KPI'ı ve kolonu" sub="Yalnız yönetici görür; maliyet/satış girildikçe dolar (bkz. 💰 Finansal Bilgi)."/>
        <Row left="😐😟🙂🔥 Ton rozeti (yönetici)" right="Brief detayında thread'in duygu tonu rozeti — müşteri iletişiminin havası tek bakışta" sub="Yalnız yönetici görür."/>
        <Row left="Geçmiş" right="Her satırda kim ne yaptı + sağda etiket (statü/alan); tüm aksiyon türlerini filtreleyen menü + tarih filtresi + 100/sayfa" sub="Olay satırına tıkla → ilgili işin detayı açılır."/>
        <Row left="Galeri" right="Her teslimde iki link: 💬 Slack thread · 🔍 iş detayı. Görsele tıkla → önizleme. Takvim filtresine uyumlu"/>
        <Row left="Komut paleti" right="Cmd+K (Mac) / Ctrl+K — brief adı, marka veya kişiye göre hızlı arama"/>
        <Row left="Sol menü" right="İkon şeridi halinde durur; üzerine gelince açılır (‹‹ / ›› ile sabitlenir)"/>
        <Row left="Görünüm" right="Açılışta görünüm otomatik sana ayarlanır" sub="Başka birinin görünümüne geçmek sadece yönetici hesaplarda mümkün."/>
        <Row left="Yönetim" right="Sol menü → Yönetim → Silinenler / Kullanıcılar (yönetici)"/>
        <Row left="Yardım" right="Sol menüden bu ekrana her zaman ulaşabilirsiniz"/>
      </Section>
    </div>
  );
}
