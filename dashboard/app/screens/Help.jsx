// app/screens/Help.jsx — Yardım: emoji kısayolları, kelime kısayolları, Slack komutları
function HelpScreen() {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ font: '700 16px/1 var(--font-sans)', color: 'var(--ink)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>{title}</div>
      {children}
    </div>
  );

  const Row = ({ left, right, sub }) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 160, font: '500 13px/1.4 var(--font-mono)', color: 'var(--ink)', background: 'var(--paper-2)', borderRadius: 5, padding: '4px 8px', flexShrink: 0 }}>{left}</div>
      <div>
        <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--ink-2)' }}>{right}</div>
        {sub && <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  const EmojiRow = ({ emoji, label, desc }) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--paper-2)', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, width: 28, textAlign: 'center', paddingTop: 1 }}>{emoji}</div>
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
        <div style={{ font: '400 13px/1 var(--font-sans)', color: 'var(--ink-3)', marginTop: 4 }}>Kısayollar, komutlar ve emoji referansı</div>
      </div>

      <Section title="📌 Brief Thread Emoji Durumları">
        <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--ink-4)', marginBottom: 12 }}>
          Slack'te bir brief mesajına emoji reaction olarak ekleyin veya thread'e emoji içeren mesaj yazın.
        </div>
        <EmojiRow emoji="✅" label="Tamamlandı" desc="Brief teslim edildi, iş bitti."/>
        <EmojiRow emoji="🚀" label="Başladı / Devam ediyor" desc="İş aktif olarak yürütülüyor."/>
        <EmojiRow emoji="⏸️" label="Beklemede" desc="Müşteri / onay / materyal bekleniyor."/>
        <EmojiRow emoji="✏️" label="Revizyon" desc="Müşteriden düzeltme isteği geldi."/>
        <EmojiRow emoji="🔃" label="Yeniden açıldı" desc="Kapalı bir brief tekrar aktif hale getirildi."/>
        <EmojiRow emoji="❌" label="İptal edildi" desc="Brief iptal, iş yapılmayacak."/>
      </Section>

      <Section title="⌨️ Dashboard Kelime Kısayolları">
        <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--ink-4)', marginBottom: 12 }}>
          Brief thread'ine yazarak durum güncelleyebilirsiniz (tam eşleşme gerekmez, içerdiği yeterli).
        </div>
        <Row left="tamamlandı" right="Brief'i tamamlandı olarak işaretle" sub="Alternatif: bitti, done, hazır, teslimat, gönderildi"/>
        <Row left="başladı" right="Brief'i başladı olarak işaretle" sub="Alternatif: devam ediyor, üzerinde, aktif, başlıyorum, başlıyoruz"/>
        <Row left="iş beklemede" right="Brief'i beklemede olarak işaretle" sub="Alternatif: beklemede, bekliyoruz, bekliyorum, on hold, hold"/>
        <Row left="revizyon" right="Brief'i revizyon olarak işaretle" sub="Alternatif: revizyona aldım, revize, düzeltme"/>
        <Row left="iptal" right="Brief'i iptal et" sub="Alternatif: iptal edildi, cancel"/>
        <Row left="yeniden açıldı" right="Kapalı brief'i yeniden aç" sub="Alternatif: tekrar açıldı, reopen, restarted"/>
      </Section>

      <Section title="🤖 Slack Bot Komutları">
        <Row left="/brief" right="Yeni brief formu aç" sub="Proje adı, marka, açıklama ve atanan kişileri sorar"/>
        <Row left="/maliyet" right="Bir projenin maliyet ve satış bilgisini kaydet"/>
        <Row left="/yardim" right="Bu yardım metnini Slack'te göster"/>
      </Section>

      <Section title="🔍 Filtre İpuçları">
        <Row left="Departman filtresi" right="Sidebar'da 'Departmanlar' bölümünden tasarım, video, sosyal medya vb. açabilirsiniz."/>
        <Row left="Durum filtresi" right="Üst toolbar'daki filtre ikonuyla aktif/tamamlandı/iptal gibi durum seçimi yapabilirsiniz."/>
        <Row left="Kişi filtresi" right="Header'daki kullanıcı listesinden bir kişiyi seçerek o kişiye atanmış briefleri görebilirsiniz."/>
        <Row left="Komut paleti" right="Cmd+K ile hızlı arama — brief adı, marka veya kişiye göre anlık filtre."/>
      </Section>
    </div>
  );
}
