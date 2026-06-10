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
        <EmojiRow emoji="✏️" label="Revizyon" desc="Düzeltme isteği geldi."/>
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

      <Section title="🗑️ Brief Silme & Geri Alma" note="Silme kalıcı değildir — silinen briefler 'Silinenler' ekranına taşınır ve geri alınabilir.">
        <Row left="brief sil" right="Slack: thread'e 'brief sil' yazın → brief Silinenler'e taşınır" sub="Bot onay mesajı düşer."/>
        <Row left="Thread'i sil" right="Slack: brief ana mesajını silerseniz brief otomatik Silinenler'e taşınır"/>
        <Row left="🗑️ Sil (dashboard)" right="Brief detay panelinde sol alttaki Sil butonu" sub="Yönetici"/>
        <Row left="↩ Geri al" right="Silinenler ekranından brief'i aktif listeye geri getirir" sub="Yönetici"/>
        <Row left="🗑️ Kalıcı sil" right="Silinenler ekranından brief'i tamamen siler — GERİ ALINAMAZ" sub="Yönetici"/>
      </Section>

      <Section title="🔍 Dashboard İpuçları">
        <Row left="Komut paleti" right="Cmd+K (Mac) / Ctrl+K — brief adı, marka veya kişiye göre hızlı arama"/>
        <Row left="Departman" right="Sol menüden Tasarım / Editör / AI departman görünümleri"/>
        <Row left="Silinenler" right="Sol menü → Yönetim → Silinenler (yönetici)"/>
        <Row left="Yardım" right="Sol menüden bu ekrana her zaman ulaşabilirsiniz"/>
      </Section>
    </div>
  );
}
