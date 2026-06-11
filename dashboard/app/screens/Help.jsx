// app/screens/Help.jsx — Yardım: Slack komutları, emoji/kelime kısayolları, finansal, silme/geri alma.
// Kaynak: scripts/slack-bot.js (reaction_added DURUM_MAP, EMOJI_DURUM, KEYWORD_MAP, finansal regex, brief sil + message_deleted)
function HelpScreen() {
  const Section = ({ title, children, note }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ font: '700 16px/1 var(--font-sans)', color: 'var(--ink)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>{title}</div>
      {note && <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--ink-4)', marginBottom: 12 }}>{note}</div>}
      {children}
    </div>
  );

  const Row = ({ left, right, sub }) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 150, font: '500 12px/1.4 var(--font-mono)', color: 'var(--ink)', background: 'var(--paper-2)', borderRadius: 5, padding: '4px 8px', flexShrink: 0 }}>{left}</div>
      <div>
        <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--ink-2)' }}>{right}</div>
        {sub && <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  const EmojiRow = ({ emoji, label, desc }) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, width: 52, textAlign: 'center', paddingTop: 1 }}>{emoji}</div>
      <div>
        <div style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--ink)', marginBottom: 2 }}>{label}</div>
        <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--ink-3)' }}>{desc}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ font: '700 20px/1 var(--font-sans)', color: 'var(--ink)' }}>Yardım</div>
        <div style={{ font: '400 13px/1 var(--font-sans)', color: 'var(--ink-3)', marginTop: 4 }}>Slack komutları, kısayollar ve brief yönetimi</div>
      </div>

      <Section title="🤖 Slack Komutları" note="Slack'te herhangi bir kanalda yazın.">
        <Row left="/yeni-brief" right="Marka kanalında yeni brief açar" sub="Form: başlık, marka (kanaldan otomatik), termin, işi yapanlar, lead, gözlemci, not, dosya"/>
        <Row left="/brief-durum" right="Sana atanmış aktif briefleri listeler"/>
        <Row left="/kapasite" right="Ekip kapasitesini gösterir" sub="Yönetici"/>
        <Row left="/maliyet" right="Bir brief'in maliyet/satış bilgisini girer"/>
        <Row left="/yardim" right="Komut rehberini Slack içinde gösterir"/>
      </Section>

      <Section title="📌 Brief Durum Emojileri" note="Brief thread'ine emoji reaction olarak ekleyin VEYA thread'e o emojiyle başlayan bir mesaj yazın — ikisi de aynı sonucu verir.">
        <EmojiRow emoji="🎨 ✍️ 🤖" label="İş Kabulü / Çalışılıyor" desc="İşi kabul ettim, başladım (🎨 tasarım · ✍️ editör · 🤖 AI). 🔄 de devam ediyor demektir."/>
        <EmojiRow emoji="👀" label="İncelemede" desc="İş gözden geçiriliyor / revize sunuldu."/>
        <EmojiRow emoji="⏸️" label="Beklemede" desc="Müşteri / onay / materyal bekleniyor."/>
        <EmojiRow emoji="✏️" label="Revizyon" desc="Düzeltme isteği geldi. ✈️'dan sonraki İLK ✏️ müşteri revizyonu, diğerleri iç revizyon sayılır."/>
        <EmojiRow emoji="✈️" label="Müşteriye Yollandı" desc="İş müşteri onayına gönderildi. İş 'Müşteri Onayı' sayfasına taşınır; aktif yük/kapasite ve hareketsizlik hesabından çıkar. Müşteri revizyonla dönünce otomatik aktif listeye geri gelir."/>
        <EmojiRow emoji="✅" label="Tamamlandı" desc="İş bitti. Thread'deki son görsel otomatik olarak galeriye kaydedilir."/>
        <EmojiRow emoji="🔃" label="Yeniden açıldı" desc="Tamamlanmış brief'i tekrar çalışılıyor durumuna çeker."/>
      </Section>

      <Section title="🚦 Öncelik Emojileri" note="Brief'e reaction olarak ekleyin (atanan veya yönetici).">
        <EmojiRow emoji="🔴" label="Acil" desc="En yüksek öncelik."/>
        <EmojiRow emoji="🟠" label="Yüksek" desc=""/>
        <EmojiRow emoji="🟡" label="Normal" desc=""/>
        <EmojiRow emoji="🟢" label="Düşük" desc=""/>
      </Section>

      <Section title="⌨️ Kelime Kısayolları" note="Brief thread'ine TAM olarak şu kelimeyi yazın (içinde geçmesi yetmez — birebir eşleşme gerekir).">
        <Row left="devam et · devam ediyor" right="Çalışılıyor"/>
        <Row left="iş incelemede" right="İncelemede"/>
        <Row left="iş beklemede · bekle" right="Beklemede"/>
        <Row left="revizyon var · revize et" right="Revizyon"/>
        <Row left="müşteriye yollandı" right="✈️ Müşteri Onayında"/>
        <Row left="iş tamamlandı" right="Tamamlandı"/>
        <Row left="yeniden aç · geri aç" right="Yeniden açıldı (çalışılıyor)"/>
        <Row left="bloke et" right="Blokeli"/>
        <Row left="acil öncelik" right="🔴 Acil" sub="yüksek öncelik → 🟠 · normal öncelik → 🟡 · düşük öncelik → 🟢"/>
      </Section>

      <Section title="💰 Finansal Bilgi" note="Brief thread'ine yazın. Dashboard'a birkaç dakika içinde yansır.">
        <Row left="maliyet 1500 satış 4000" right="Maliyet ve satış tutarını kaydeder" sub="Tek tek de yazılabilir: 'maliyet 1500' / 'satış 4000'"/>
        <Row left="fatura ok" right="Fatura kesildi olarak işaretler" sub="Geri almak için: fatura iptal"/>
        <Row left="ödeme ok" right="Ödeme alındı olarak işaretler" sub="Geri almak için: ödeme iptal"/>
      </Section>

      <Section title="🔔 Otomatik Takip & Uyarılar" note="Sistem işlerin sahipsiz kalmasını engellemek için otomatik kontroller yapar (hafta içi 09-19, saatte bir).">
        <Row left="1 saat" right="Brief açıldıktan 1 saat sonra hâlâ başlama emojisi (🎨/✍️/🤖) konmadıysa atanana hatırlatma DM'i gider" sub="Thread'e yazı yazmak yeterli değil — işi planına aldığını emoji ile bildir."/>
        <Row left="+2 saat" right="Hâlâ planına alınmadıysa: atanana 2. hatırlatma + departman yöneticisine bilgi DM'i" sub="İşi yapamayacaksan beklemeden yöneticine haber ver."/>
        <Row left="24 iş saati" right="Hareket olmayan brief 'Hareketsiz' işaretlenir (dashboard rozeti)" sub="Cmt/Paz + TR resmî tatilleri sayılmaz; hareket gelince işaret otomatik kalkar."/>
        <Row left="🌴 Tatil" right="Slack durumunu 🌴 / 'tatil' / 'izin' / 'OOO' yaparsan uyarılar sana gelmez" sub="Tüm atananları tatildeki brieflerde hareketsizlik süresi de işlemez."/>
      </Section>

      <Section title="⭐ Yıldız Puanlama & Karne" note="Her tamamlanan işe AI, thread'inden 1-5 kalite puanı verir (5=pürüzsüz/zamanında, 1=ciddi sorun).">
        <Row left="AI puanı" right="İş tamamlanınca otomatik verilir — Tamamlananlar'da yıldızların yanında 'AI' rozeti görünür"/>
        <Row left="Yönetici override" right="Tamamlananlar'daki yıldızlara tıklayarak puanı değiştir (yönetici)" sub="Override sonrası AI o işe bir daha dokunmaz."/>
        <Row left="Karne" right="Karşılaştırma ekranı → '⭐ Yıldız Karnesi': firma + departman ortalamaları ve sebep açıklamaları" sub="Genel Bakış'taki 'BENSENO ⭐' rozeti de oraya götürür. Marka puanı Marka detayında; kişi puanı sadece yöneticiye, Profil'de."/>
        <Row left="Sebep" right="'Neden bu ortalama' açıklamaları her gün 18:45'te insight'lardan üretilir"/>
      </Section>

      <Section title="📡 Marka Günlük Takibi" note="Marka detay sayfasında, tabloların altında.">
        <Row left="Kanal Özeti" right="Marka kanalının tüm akışının (thread'ler dahil) AI özeti — saatte bir güncellenir"/>
        <Row left="Gün Sonu Insight" right="Her gün 18:45'te günün değerlendirmesi (tempo, sürtünme, müşteri sinyalleri) arşive yazılır"/>
        <Row left="Tarih filtresi" right="'Şu an (canlı)' veya geçmiş bir günü seç → o günün özeti + insight'ı" sub="Günlük kayıtlar bir önceki günle ilişkilendirilir — dünden sarkan konuların bugünkü durumu belirtilir."/>
      </Section>

      <Section title="🤖 Sistem Asistanı & Geri Bildirim">
        <Row left="🤖 Asistan" right="Sağ alttaki balon — kullanım soruları + marka/iş/kişi bazlı canlı veri soruları + öneri" sub="Kişi puanlarını sadece yöneticilere söyler."/>
        <Row left="help (Slack)" right="Herhangi bir kanala 'help' yaz → sorun/öneri formu (başlık + açıklama + görsel) → sistem adminlerine DM"/>
        <Row left="🔔 Bildirim zili" right="Sana atılan her brief-akışı DM'inin kısa hâli — tıklayınca ilgili Slack thread'i açılır"/>
      </Section>

      <Section title="💬 Thread Özeti & Raporlar">
        <Row left="Thread Özeti" right="Her brief'in Slack yazışmaları AI ile özetlenir — brief detayında '💬 Thread Özeti' bölümü" sub="Hafta içi saatte bir güncellenir; yeni mesaj yoksa değişmez."/>
        <Row left="07:50 hafta içi" right="Sabah raporu — #benseno-grafik + 5 yönetici DM"/>
        <Row left="07:55 hafta içi" right="Kişisel iş özeti — aktif işi olan herkese kendi brief listesi DM olarak" sub="İşin yoksa DM gelmez."/>
      </Section>

      <Section title="👁️ Otomatik Gözlemci" note="Yeni brief açıldığında işi yapanların departman yöneticileri otomatik gözlemci olarak eklenir ve DM alır.">
        <Row left="Tasarım" right="İpek Akdeniz"/>
        <Row left="Editör" right="Cansu Kazgan, Erdem Akoğlu"/>
        <Row left="AI" right="Görkem Kaya, Reyhan Nur Pınar"/>
        <Row left="Freelance" right="İşi açan kişinin departman yöneticisi" sub="Freelancerlar Slack'te olmadığı için DM/uyarı almaz; süreci içeriden açan kişi yönetir."/>
      </Section>

      <Section title="🗑️ Brief Silme & Geri Alma" note="Silme kalıcı değildir — silinen briefler 'Silinenler' ekranına taşınır ve geri alınabilir. Silinince brief thread'ine not düşer, geri alınınca da.">
        <Row left="brief sil" right="Slack: thread'e 'brief sil' yazın → brief Silinenler'e taşınır" sub="Bot onay mesajı düşer."/>
        <Row left="Thread'i sil" right="Slack: brief ana mesajını silerseniz brief otomatik Silinenler'e taşınır"/>
        <Row left="🗑️ Sil (dashboard)" right="Brief detay panelinde sol alttaki Sil butonu" sub="Yönetici"/>
        <Row left="↩ Geri al" right="Silinenler ekranından brief'i aktif listeye geri getirir" sub="Yönetici"/>
        <Row left="🗑️ Kalıcı sil" right="Silinenler ekranından brief'i tamamen siler — GERİ ALINAMAZ" sub="Yönetici"/>
      </Section>

      <Section title="🔍 Dashboard İpuçları">
        <Row left="Komut paleti" right="Cmd+K (Mac) / Ctrl+K — brief adı, marka veya kişiye göre hızlı arama"/>
        <Row left="Tamamlananlar" right="Satıra tıkla → işin salt-okunur detayı (thread özeti, iş insight'ı, not)" sub="Hiçbir alan değiştirilemez; sadece yıldız puanı yönetici tarafından güncellenebilir."/>
        <Row left="Geçmiş" right="Olay satırına tıkla → ilgili işin detayı açılır (aktifse normal, tamamlanmışsa salt-okunur)"/>
        <Row left="Departman" right="Sol menüden Tasarım / Editör / AI / Freelance departman görünümleri"/>
        <Row left="Görünüm" right="Açılışta görünüm otomatik olarak sana ayarlanır" sub="Başka birinin görünümüne geçmek sadece yönetici hesaplarda mümkündür."/>
        <Row left="Silinenler" right="Sol menü → Yönetim → Silinenler (yönetici)"/>
        <Row left="Yardım" right="Sol menüden bu ekrana her zaman ulaşabilirsiniz"/>
      </Section>
    </div>
  );
}
