'use strict';
/**
 * rapor-mail.js — Kişisel e-posta raporları (bildirim reformu 2026-09-30).
 * Her aktif kullanıcıya TEK mail; kapsam sırası: KENDİSİ → DEPARTMANI → FİRMA GENELİ.
 * Yöneticilerde (rol/yetki='yonetici') firma bölümü tam kapsamlıdır; diğerlerinde özet.
 *
 * Modlar:
 *   --mod=sabah       hafta içi 08:00 — bugün yapılacaklar
 *   --mod=aksam       hafta içi 18:30 — bugün yapılanlar
 *   --mod=hafta-plan  Pzt 08:05      — bu hafta yapılacaklar
 *   --mod=hafta-ozet  Cum 17:30      — bu hafta yapılanlar
 *   --mod=ay-bas      ayın 1'i 08:10 — bu ay planı
 *   --mod=ay-son      ay sonu 17:40  — bu ay yapılanlar (script son gün kontrolü yapar)
 *
 * Test: BNS_REPORT_LIVE!=1 → mail GÖNDERİLMEZ, önizleme Görkem'e Slack DM.
 * E-postası olmayan kullanıcı sessizce atlanır. RESEND_API_KEY yoksa çıkar.
 */
const { trDate, deltaLabel, token, post, fetchEmbedded, GORKEM, DASHBOARD_URL, H, DAY } = require('./rapor-lib');
const { mailGonder, raporHtml, hasKey } = require('../server/mail');
const { pool } = require('../server/db');

const MOD = (process.argv.find(a => a.startsWith('--mod=')) || '--mod=sabah').slice(6);
const LIVE = process.env.BNS_REPORT_LIVE === '1';
// Örnekleme: --ornek=U1,U2 → yalnız bu kişilerin maili üretilir; içerik stdout'a düz
// metin basılır ve --ornek-alici=adres verilmişse HTML kopyası ORAYA gönderilir
// (asıl sahibine GİTMEZ). İçerik onayı/denetimi için.
const ORNEK = ((process.argv.find(a => a.startsWith('--ornek=')) || '').slice(8) || '').split(',').filter(Boolean);
const ORNEK_ALICI = (process.argv.find(a => a.startsWith('--ornek-alici=')) || '').slice(14) || null;
const TZ = 'Europe/Istanbul';

const trNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
function haftaBasi(d) { const x = new Date(d); const g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); x.setHours(0, 0, 0, 0); return x; }
function ayBasi(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function gunBasi(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

// Mod → {baslik, pencere:[bas,bit], yon:'plan'|'ozet'}
function modAyar() {
  const now = trNow();
  const gb = gunBasi(now).getTime(), hb = haftaBasi(now).getTime(), ab = ayBasi(now).getTime();
  switch (MOD) {
    case 'sabah':      return { baslik: 'Bugün Yapılacaklar', yon: 'plan', bas: gb, bit: gb + DAY };
    case 'aksam':      return { baslik: 'Bugün Yapılanlar', yon: 'ozet', bas: gb, bit: gb + DAY };
    case 'hafta-plan': return { baslik: 'Bu Hafta Yapılacaklar', yon: 'plan', bas: hb, bit: hb + 7 * DAY };
    case 'hafta-ozet': return { baslik: 'Bu Hafta Yapılanlar', yon: 'ozet', bas: hb, bit: hb + 7 * DAY };
    case 'ay-bas':     return { baslik: 'Bu Ay Planı', yon: 'plan', bas: ab, bit: ab + 32 * DAY };
    case 'ay-son':     return { baslik: 'Bu Ay Yapılanlar', yon: 'ozet', bas: ab, bit: ab + 32 * DAY };
    default: throw new Error('bilinmeyen mod: ' + MOD);
  }
}

const AKTIF = new Set(['yeni', 'basladi', 'calisiliyor', 'incelemede', 'kontrole', 'revizyon', 'beklemede', 'musteride']);
const uyeMi = (b, uid) => (b.workers || []).some(w => w && w.id === uid) || (b.leads || []).some(l => l && l.id === uid);

function isSatiri(b, tamamlandi) {
  if (tamamlandi) return `✅ #${b.no} ${b.marka || ''} — ${b.baslik || ''}`;
  const dh = b.deadline ? (b.deadline - Date.now()) / H : null;
  const dl = dh == null ? 'termin yok' : deltaLabel(dh);
  const uy = dh != null && dh <= 0 ? ' ⚠️ GECİKMİŞ' : '';
  return `#${b.no} ${b.marka || ''} — ${b.baslik || ''} · ${b.durum} · ${dl}${uy}`;
}

function planIsleri(briefs, ayar) {
  // Plan: aktif işler; günlük modda termini bugünde/geçmişte olanlar öne, terminsizler dahil.
  return briefs
    .filter(b => AKTIF.has(b.durum))
    .filter(b => MOD === 'sabah' ? true : (!b.deadline || b.deadline < ayar.bit))
    .sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
}
function ozetIsleri(completed, ayar) {
  return completed
    .filter(b => b.bitis && b.bitis >= ayar.bas && b.bitis < ayar.bit)
    .sort((a, b) => b.bitis - a.bitis);
}

async function main() {
  if (!hasKey() && LIVE) { console.error('RESEND_API_KEY yok — mail gönderilemez'); process.exit(1); }
  // ay-son: yalnız ayın son günü çalış (cron 25-31 tetikler)
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

  const kaynak = ayar.yon === 'plan' ? planIsleri(briefs, ayar) : ozetIsleri(completed, ayar);
  const tamam = ayar.yon === 'ozet';

  let sent = 0, skippedNoMail = 0; const preview = [];
  for (const u of users) {
    if (ORNEK.length && !ORNEK.includes(u.id)) continue;
    const email = emails.get(u.id);
    const yonetici = u.rol === 'yonetici' || u.yetki === 'yonetici' || u.id === GORKEM;
    const deptUyeleri = new Set(users.filter(x => x.dept === u.dept).map(x => x.id));

    const benim = kaynak.filter(b => uyeMi(b, u.id));
    const deptIs = kaynak.filter(b => !uyeMi(b, u.id) &&
      [...(b.workers || []), ...(b.leads || [])].some(p => p && deptUyeleri.has(p.id)));
    const digerleri = kaynak.filter(b => !benim.includes(b) && !deptIs.includes(b));

    const gecikmis = kaynak.filter(b => !tamam && b.deadline && b.deadline < Date.now());
    const firmaSatirlar = yonetici
      ? digerleri.map(b => isSatiri(b, tamam))
      : [
          `${ayar.yon === 'plan' ? 'Aktif' : 'Tamamlanan'} iş: ${kaynak.length} · ${tamam ? '' : `gecikmiş: ${gecikmis.length}`}`.trim(),
          ...(tamam ? [] : gecikmis.slice(0, 8).map(b => '⚠️ ' + isSatiri(b, false))),
        ];

    const bolumler = [
      { baslik: `👤 Senin işlerin (${benim.length})`, satirlar: benim.map(b => isSatiri(b, tamam)) },
      { baslik: `📁 Departmanın — ${u.dept || '—'} (${deptIs.length})`, satirlar: deptIs.slice(0, yonetici ? 100 : 15).map(b => isSatiri(b, tamam)) },
      { baslik: `🏢 Firma geneli${yonetici ? ` (${digerleri.length})` : ''}`, satirlar: firmaSatirlar },
    ];
    // Hiç içerik yoksa mail atma (boş sabah maili istemiyoruz)
    if (!benim.length && !deptIs.length && !kaynak.length) continue;

    const subject = `Benseno · ${ayar.baslik} — ${trDate()}`;
    const html = raporHtml({
      baslik: ayar.baslik, tarih: `${u.name || u.id} · ${trDate()}`,
      bolumler, dip: `Dashboard: ${DASHBOARD_URL}`,
    });

    if (ORNEK.length) {
      // Düz metin döküm: içerik denetimi
      console.log(`\n════ ÖRNEK · ${ayar.baslik} · ${u.name} ════`);
      for (const bo of bolumler) {
        console.log(`\n${bo.baslik}`);
        if (!bo.satirlar.length) console.log('  — kayıt yok —');
        for (const s of bo.satirlar) console.log('  • ' + (typeof s === 'string' ? s : s.t));
      }
      if (ORNEK_ALICI) {
        const r = await mailGonder({ to: ORNEK_ALICI, subject: `[ÖRNEK · ${u.name}] ${subject}`, html });
        console.log(r.ok ? `\n(HTML kopya → ${ORNEK_ALICI})` : `\n(HTML kopya HATA: ${r.error})`);
      }
      sent++; continue;
    }
    if (!LIVE) { preview.push(`### ${u.name} (${email || 'e-posta YOK'})\n${bolumler.map(b => b.baslik + ': ' + b.satirlar.length + ' satır').join(' | ')}`); sent++; continue; }
    if (!email) { skippedNoMail++; continue; }
    const r = await mailGonder({ to: email, subject, html });
    if (r.ok) { sent++; console.log(`mail OK → ${u.name} <${email}>`); }
    else console.error(`mail HATA → ${u.name}: ${r.error}`);
  }

  if (!LIVE && preview.length) {
    const tok = token();
    if (tok) await post(tok, GORKEM, `🧪 *rapor-mail önizleme (${MOD})*\n\n` + preview.join('\n'));
  }
  console.log(`rapor-mail ${MOD} ${LIVE ? 'CANLI' : 'TEST'} — ${sent} mail, ${skippedNoMail} e-postasız atlandı`);
  await pool.end();
}
main().catch(e => { console.error('rapor-mail hata:', e.message); process.exit(1); });
