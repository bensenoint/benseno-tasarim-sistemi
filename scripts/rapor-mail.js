'use strict';
/**
 * rapor-mail.js — Kişisel e-posta raporları (bildirim reformu 2026-09-30, anlatı revizyonu).
 * Görkem kararı (30 Eyl): iş LİSTESİ değil, kişiye özel ANLATI — özet, yorum, takdir,
 * aksayan noktalar, somut öneri ve yük/zaman uyarısı. Listeler dashboard linkinin arkasında.
 *
 * Yapı: olgular deterministik hesaplanır (sayı uydurma yok) → Sonnet kişiye "sen" diye
 * hitap eden 3-5 paragraflık değerlendirme yazar → mail = anlatı + en kritik 3 madde + link.
 * LLM yoksa/hata verirse sayısal kısa özete düşer (mail yine gider).
 *
 * Modlar: --mod=sabah|aksam|hafta-plan|hafta-ozet|ay-bas|ay-son
 * Test: BNS_REPORT_LIVE!=1 → mail gitmez, önizleme Görkem'e Slack DM.
 * Örnekleme: --ornek=U1,U2 (yalnız bu kişiler; stdout'a döküm) + --ornek-alici=adres
 * (HTML kopya oraya gider, asıl sahibine GİTMEZ).
 */
const { trDate, deltaLabel, token, post, fetchEmbedded, GORKEM, DASHBOARD_URL, H, DAY } = require('./rapor-lib');
const { mailGonder, raporHtml, hasKey } = require('../server/mail');
const { pool } = require('../server/db');

const MOD = (process.argv.find(a => a.startsWith('--mod=')) || '--mod=sabah').slice(6);
const LIVE = process.env.BNS_REPORT_LIVE === '1';
const ORNEK = ((process.argv.find(a => a.startsWith('--ornek=')) || '').slice(8) || '').split(',').filter(Boolean);
const ORNEK_ALICI = (process.argv.find(a => a.startsWith('--ornek-alici=')) || '').slice(14) || null;
const TZ = 'Europe/Istanbul';

const trNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
function haftaBasi(d) { const x = new Date(d); const g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); x.setHours(0, 0, 0, 0); return x; }
function ayBasi(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function gunBasi(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function modAyar() {
  const now = trNow();
  const gb = gunBasi(now).getTime(), hb = haftaBasi(now).getTime(), ab = ayBasi(now).getTime();
  switch (MOD) {
    case 'sabah':      return { baslik: 'Güne Bakış', kapsam: 'bugün', yon: 'plan', bas: gb, bit: gb + DAY };
    case 'aksam':      return { baslik: 'Gün Sonu Değerlendirmesi', kapsam: 'bugün', yon: 'ozet', bas: gb, bit: gb + DAY };
    case 'hafta-plan': return { baslik: 'Haftaya Bakış', kapsam: 'bu hafta', yon: 'plan', bas: hb, bit: hb + 7 * DAY };
    case 'hafta-ozet': return { baslik: 'Hafta Değerlendirmesi', kapsam: 'bu hafta', yon: 'ozet', bas: hb, bit: hb + 7 * DAY };
    case 'ay-bas':     return { baslik: 'Aya Bakış', kapsam: 'bu ay', yon: 'plan', bas: ab, bit: ab + 32 * DAY };
    case 'ay-son':     return { baslik: 'Ay Değerlendirmesi', kapsam: 'bu ay', yon: 'ozet', bas: ab, bit: ab + 32 * DAY };
    default: throw new Error('bilinmeyen mod: ' + MOD);
  }
}

const EYLEME_ACIK = new Set(['yeni', 'basladi', 'calisiliyor', 'incelemede', 'kontrole', 'revizyon']);
const uyeMi = (b, uid) => (b.workers || []).some(w => w && w.id === uid) || (b.leads || []).some(l => l && l.id === uid);
const kisa = (b) => ({ no: b.no, is: `${b.marka || ''} — ${(b.baslik || '').slice(0, 70)}`, durum: b.durum,
  termin: b.deadline ? deltaLabel((b.deadline - Date.now()) / H) : 'termin yok' });

// ── Olgular: kişi + departman + firma (deterministik; LLM yalnız bunları yorumlar) ──
function olgular(u, users, briefs, completed, ayar, yonetici) {
  const deptU = new Set(users.filter(x => x.dept === u.dept).map(x => x.id));
  const now = Date.now();

  const benimAktif = briefs.filter(b => uyeMi(b, u.id));
  const eylem = benimAktif.filter(b => EYLEME_ACIK.has(b.durum));
  const beklemede = benimAktif.filter(b => !EYLEME_ACIK.has(b.durum));   // musteride + beklemede
  const gecikmis = benimAktif.filter(b => b.deadline && b.deadline < now && b.durum !== 'musteride');
  const bugunTermin = benimAktif.filter(b => b.deadline && b.deadline >= now && b.deadline < ayar.bit);
  const pencereTamam = completed.filter(b => uyeMi(b, u.id) && b.bitis >= ayar.bas && b.bitis < ayar.bit);
  // Son tamamlanan işlerinden puanlılar (kişinin KENDİ işleri — takdir/ders malzemesi)
  const sonPuanli = completed.filter(b => uyeMi(b, u.id) && b.rating != null && b.bitis >= now - 14 * DAY)
    .sort((a, b) => b.bitis - a.bitis).slice(0, 6)
    .map(b => ({ no: b.no, is: `${b.marka || ''} — ${(b.baslik || '').slice(0, 60)}`, puan: b.rating, sebep: (b.rating_sebep || '').slice(0, 140) }));

  const deptAktif = briefs.filter(b => [...(b.workers || []), ...(b.leads || [])].some(p => p && deptU.has(p.id)));
  const deptGecik = deptAktif.filter(b => b.deadline && b.deadline < now && b.durum !== 'musteride');
  const deptTamam = completed.filter(b => b.bitis >= ayar.bas && b.bitis < ayar.bit &&
    [...(b.workers || []), ...(b.leads || [])].some(p => p && deptU.has(p.id)));

  const firmaGecik = briefs.filter(b => b.deadline && b.deadline < now && b.durum !== 'musteride');
  const musteride = briefs.filter(b => b.durum === 'musteride');
  const firmaTamam = completed.filter(b => b.bitis >= ayar.bas && b.bitis < ayar.bit);

  const f = {
    kisi: { ad: u.name, rol: yonetici ? 'yönetici' : 'ekip üyesi', departman: u.dept },
    kendi_durumu: {
      aktif_is: benimAktif.length,
      eyleme_acik: eylem.length,
      musteride_veya_beklemede: beklemede.length,
      gecikmis_sayi: gecikmis.length,
      gecikmisler: gecikmis.sort((a, b) => a.deadline - b.deadline).slice(0, 5).map(kisa),
      [ayar.kapsam + '_terminli']: bugunTermin.map(kisa).slice(0, 8),
      [ayar.kapsam + '_tamamladigi']: pencereTamam.slice(0, 12).map(b => ({ no: b.no, is: `${b.marka || ''} — ${(b.baslik || '').slice(0, 60)}`, puan: b.rating ?? null })),
      son_is_puanlari: sonPuanli,
    },
    departman: {
      ad: u.dept, kisi_sayisi: deptU.size, aktif_is: deptAktif.length,
      gecikmis: deptGecik.length, [ayar.kapsam + '_tamamlanan']: deptTamam.length,
    },
    firma: {
      aktif_is: briefs.length, gecikmis: firmaGecik.length, musteri_donusu_bekleyen: musteride.length,
      [ayar.kapsam + '_tamamlanan']: firmaTamam.length,
    },
  };
  if (yonetici) {
    // Yönetici: firma resmi derin — en kritik gecikmişler + marka kırılımı (adet)
    const markaGecik = {};
    for (const b of firmaGecik) markaGecik[b.marka || '?'] = (markaGecik[b.marka || '?'] || 0) + 1;
    f.firma.en_kritik_gecikmisler = firmaGecik.sort((a, b) => a.deadline - b.deadline).slice(0, 8).map(kisa);
    f.firma.gecikmis_marka_kirilimi = Object.fromEntries(Object.entries(markaGecik).sort((a, b) => b[1] - a[1]).slice(0, 8));
  }
  return f;
}

// ── LLM anlatı (Sonnet) — sayı uydurma yasak, "sen" hitabı, madde listesi yok ──
async function anlati(facts, ayar, yonetici) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const sys =
    `Bir tasarım/reklam ajansının (Benseno) iş takip sisteminin kişisel rapor yazarısın. ` +
    `Kişiye adıyla ve "sen" diye hitap et; samimi, motive edici ama net ve dürüst bir ton kullan. ` +
    `Rapor türü: ${ayar.baslik} (${ayar.kapsam}, ${ayar.yon === 'plan' ? 'önündeki işlere bakış' : 'yapılanların değerlendirmesi'}). ` +
    `ÇIKTIYI TAM OLARAK ŞU ÜÇ BÖLÜM AYRAÇLARIYLA yaz (ayraç satırları aynen, başka başlık/madde işareti YOK, her bölüm 1-2 kısa akıcı paragraf):\n` +
    `===KISI===\nkişinin kendi durumu — iyi giden bir şeyi somut örnekle takdir et (puan/tamamlama varsa oradan), aksayan varsa açıkça söyle ve UYGULANABILIR bir öneri ver (örn. "şu işin termini geçmiş, uzatma iste ya da bugün kapat"); yük fazlaysa ("eyleme açık" iş sayısı 6+) zamanın yetişmeyebileceğini söyle ve önceliklendirme öner.\n` +
    `===DEPARTMAN===\ndepartmanının kısa resmi ve varsa ekipçe yapılacak şey.\n` +
    `===FIRMA===\nfirma genelinin kısa resmi${yonetici ? ' — bu kişi YÖNETİCİ: bu bölümü derinleştir, kritik gecikmişleri ve marka kırılımını yorumla, yönetsel aksiyon öner' : ''}.\n` +
    `KESIN KURALLAR: Yalnız verilen olgulardaki sayı ve işleri kullan, HİÇBİR ŞEY uydurma. İş adlarını kısaltarak anabilirsin. ` +
    `"musteride" = müşteri dönüşü bekliyor (kişinin suçu değil), "gecikmis" = termin geçti. ` +
    `UZUNLUK: toplam EN FAZLA 200 kelime — kısa ve vurucu yaz, her cümleyi bitir, asla yarıda kesme.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5', max_tokens: 1100,
        system: sys,
        messages: [{ role: 'user', content: `Tarih: ${trDate()}\nOlgular (JSON):\n` + JSON.stringify(facts, null, 1) }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('  (anlatı hata: ' + (j.error?.message || r.status) + ')'); return null; }
    const txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return txt || null;
  } catch (e) { console.error('  (anlatı exception: ' + e.message + ')'); return null; }
}

// LLM yoksa kısa sayısal yedek metin
function yedekMetin(f, ayar) {
  const k = f.kendi_durumu;
  return `${ayar.kapsam === 'bugün' ? 'Bugün' : ayar.kapsam} itibarıyla ${k.aktif_is} aktif işin var; ${k.eyleme_acik} tanesi eyleme açık, ${k.musteride_veya_beklemede} tanesi müşteri/bekleme aşamasında.` +
    (k.gecikmis_sayi ? ` ${k.gecikmis_sayi} işin termini geçmiş görünüyor — termin revizesi ya da kapanış için göz at.` : '') +
    ` Departmanında ${f.departman.aktif_is} aktif iş var (${f.departman.gecikmis} gecikmiş). Firma genelinde ${f.firma.aktif_is} aktif, ${f.firma.gecikmis} gecikmiş iş bulunuyor.`;
}

// Anlatının altına eklenecek en kritik 3 satır (somut referans — liste değil, işaret)
function kritikSatirlar(f) {
  const L = [];
  for (const g of (f.kendi_durumu.gecikmisler || []).slice(0, 3))
    L.push(`⚠️ #${g.no} ${g.is} · ${g.durum} · ${g.termin}`);
  return L;
}

async function main() {
  if (!hasKey() && LIVE) { console.error('mail anahtarı yok (GMAIL/RESEND) — çıkılıyor'); process.exit(1); }
  if (MOD === 'ay-son') {
    const now = trNow(); const yarin = new Date(now.getTime() + DAY);
    if (yarin.getDate() !== 1) { console.log('ay-son: bugün ayın son günü değil, çıkılıyor'); return; }
  }
  const ayar = modAyar();
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const completed = d.bns_completed || [];
  const users = (d.bns_users || []).filter(u => /^U/.test(u.id) && u.active !== false);
  const em = await pool.query(`SELECT id, email FROM users WHERE email IS NOT NULL AND email <> ''`);
  const emails = new Map(em.rows.map(r => [r.id, r.email]));

  let sent = 0, skippedNoMail = 0; const preview = [];
  for (const u of users) {
    if (ORNEK.length && !ORNEK.includes(u.id)) continue;
    const email = emails.get(u.id);
    if (!email && LIVE && !ORNEK.length) { skippedNoMail++; continue; }   // LLM masrafına girmeden atla
    const yonetici = u.rol === 'yonetici' || u.yetki === 'yonetici' || u.id === GORKEM;

    const f = olgular(u, users, briefs, completed, ayar, yonetici);
    // Akşam/özet modunda hiç hareket yoksa VE gecikmiş de yoksa mail atma (boş değerlendirme olmaz)
    const tamamKey = ayar.kapsam + '_tamamladigi';
    if (ayar.yon === 'ozet' && !(f.kendi_durumu[tamamKey] || []).length && !f.kendi_durumu.gecikmis_sayi && !f.kendi_durumu.eyleme_acik) continue;

    const metin = (await anlati(f, ayar, yonetici)) || yedekMetin(f, ayar);
    const kritik = kritikSatirlar(f);

    // Anlatıyı 3 bölüme ayır (===KISI=== / ===DEPARTMAN=== / ===FIRMA===); ayraç yoksa tek bölüm.
    const parca = (etiket) => {
      const m = metin.match(new RegExp(`===${etiket}===\\s*([\\s\\S]*?)(?====[A-ZĞÜŞİÖÇ]+===|$)`));
      return m ? m[1].trim() : null;
    };
    const pKisi = parca('KISI'), pDept = parca('DEPARTMAN'), pFirma = parca('FIRMA');
    const bolumler = pKisi ? [
      { baslik: `👤 Senin ${ayar.yon === 'plan' ? 'günün' : 'değerlendirmen'}`, metin: pKisi },
      ...(pDept ? [{ baslik: `📁 Departmanın — ${u.dept || ''}`, metin: pDept }] : []),
      ...(pFirma ? [{ baslik: '🏢 Firma geneli', metin: pFirma }] : []),
    ] : [{ baslik: `💬 ${ayar.baslik}`, metin }];
    bolumler.push(
      ...(kritik.length ? [{ baslik: '⏰ Gözden kaçmasın', satirlar: kritik }] : []),
      { baslik: '🔗 Tüm işlerin ve detaylar', satirlar: [`Dashboard: ${DASHBOARD_URL}`] });
    const subject = `Benseno · ${ayar.baslik} — ${trDate()}`;
    const html = raporHtml({ baslik: ayar.baslik, tarih: `${u.name || u.id} · ${trDate()}`, bolumler, dip: `Dashboard: ${DASHBOARD_URL}` });

    if (ORNEK.length) {
      console.log(`\n════ ÖRNEK · ${ayar.baslik} · ${u.name} ════`);
      for (const bo of bolumler) {
        console.log(`\n${bo.baslik}`);
        if (bo.metin) console.log(bo.metin);
        for (const s of (bo.satirlar || [])) console.log('  ' + (typeof s === 'string' ? s : s.t));
      }
      if (ORNEK_ALICI) {
        const r = await mailGonder({ to: ORNEK_ALICI, subject: `[ÖRNEK · ${u.name}] ${subject}`, html });
        console.log(r.ok ? `\n(HTML kopya → ${ORNEK_ALICI})` : `\n(HTML kopya HATA: ${r.error})`);
      }
      sent++; continue;
    }
    if (!LIVE) { preview.push(`### ${u.name} (${email || 'e-posta YOK'})\n${metin}`); sent++; continue; }
    if (!email) { skippedNoMail++; continue; }
    const r = await mailGonder({ to: email, subject, html });
    if (r.ok) { sent++; console.log(`mail OK → ${u.name} <${email}>`); }
    else console.error(`mail HATA → ${u.name}: ${r.error}`);
  }

  if (!LIVE && !ORNEK.length && preview.length) {
    const tok = token();
    if (tok) await post(tok, GORKEM, `🧪 *rapor-mail önizleme (${MOD})*\n\n` + preview.join('\n\n———\n\n'));
  }
  console.log(`rapor-mail ${MOD} ${LIVE ? 'CANLI' : 'TEST'} — ${sent} mail, ${skippedNoMail} e-postasız atlandı`);
  await pool.end();
}
main().catch(e => { console.error('rapor-mail hata:', e.message); process.exit(1); });
