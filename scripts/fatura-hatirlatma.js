'use strict';
/**
 * fatura-hatirlatma.js — Ek işlerin fatura eksiklerini kovalar (saatlik; run-thread-ozet.sh).
 * (a) Aşama DM'leri: tamamlanmış ek işte eksik (satış yok VEYA fatura yok) → tamamlanma
 *     yaşı 24s/72s/1hf eşiğini geçince lead'ler + yöneticilere DM (asama alanı idempotent).
 * (b) Toplu liste: ayın 25'i (Cmt/Paz ise önceki Cuma) 10-11 TR penceresinde tüm eksikler
 *     tek DM; tekrar kilidi ayarlar['fatura_toplu_son'].
 * Kart yoksa da çalışır (drawer'dan ek'e çevrilen eski işler dahil). Eksik kapanınca susar.
 *   node scripts/fatura-hatirlatma.js [--dry]
 */
const { pool } = require('../server/db');
const { token, post, DASHBOARD_URL } = require('./rapor-lib');
const C = require('../dashboard/app/calc.js');

const DRY = process.argv.includes('--dry');
const ASAMALAR = [24 * 3600e3, 72 * 3600e3, 168 * 3600e3];   // 1→24s, 2→72s, 3→1hf

async function eksikleriGetir() {
  const r = await pool.query(`
    SELECT b.id, b.no, b.baslik, b.satis, b.fatura, b.completed_at, b.fatura_hatirlatma_asama AS asama,
           b.created_by, b.slack_url, br.name AS marka,
           COALESCE((SELECT array_agg(a.user_id) FROM brief_assignees a
                     WHERE a.brief_id = b.id AND a.role = 'lead'), '{}') AS leads
    FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id
    WHERE b.completed_at IS NOT NULL AND b.deleted_at IS NULL
      AND b.ucret_tipi = 'ek' AND (b.satis IS NULL OR b.fatura = false)`);
  return r.rows;
}
async function yoneticiler() {
  const r = await pool.query(`SELECT id FROM users WHERE (rol='yonetici' OR yetki='yonetici') AND active IS NOT FALSE`);
  return r.rows.map(x => x.id);
}
function eksikMetni(b) {
  // İş adı kuralı: yalın #numara yerine adıyla — "#12 "Katalog kapak" Marka"
  const ad = `#${b.no}${b.baslik ? ` "${String(b.baslik).slice(0, 60)}"` : ''}`;
  return b.satis == null
    ? `${ad} ${b.marka || ''} — *satış tutarı girilmedi*`
    : `${ad} ${b.marka || ''} — *${Number(b.satis).toLocaleString('tr-TR')}₺ faturasız*`;
}

(async () => {
  const now = Date.now();
  const tok = token();
  // Tatil takvimi: toplu-gün hesabı (bnsFaturaTopluGunu) tatil-bilinçli çalışsın
  try {
    const tt = await pool.query(`SELECT to_char(gun,'YYYY-MM-DD') AS gun, ad, yarim FROM tatiller`);
    C.bnsTatilYukle(tt.rows);
  } catch (e) { /* migration öncesi sessiz */ }
  const eksikler = await eksikleriGetir();
  const mgrs = await yoneticiler();

  // (a) aşama DM'leri
  for (const b of eksikler) {
    const yas = now - new Date(b.completed_at).getTime();
    let hedefAsama = 0;
    for (let i = 0; i < ASAMALAR.length; i++) if (yas >= ASAMALAR[i]) hedefAsama = i + 1;
    if (hedefAsama <= (b.asama || 0)) continue;
    const etiket = ['', '24 saat', '3 gün', '1 hafta'][hedefAsama];
    const txt = `🧾 *Fatura takibi* (${etiket}): ${eksikMetni(b)}\n` +
      (b.satis == null
        ? `Tutarı gir: iş thread'indeki 💰 buton ya da dashboard → iş → Finans.`
        : `Fatura kesildiyse thread'deki ✅ butonu ya da dashboard → Finans → "fatura kesildi".`) +
      (b.slack_url ? `\n${b.slack_url}` : '');
    const alicilar = [...new Set([...(b.leads || []), b.created_by, ...mgrs].filter(Boolean))];
    if (DRY) { console.log(`[dry] aşama ${hedefAsama} → #${b.no} → ${alicilar.join(',')}`); continue; }
    for (const uid of alicilar) { try { await post(tok, uid, txt); } catch (e) { console.error('dm hata', uid, e.message); } }
    await pool.query('UPDATE briefs SET fatura_hatirlatma_asama=$1 WHERE id=$2', [hedefAsama, b.id]);
    console.log(`[fatura-hatirlatma] aşama ${hedefAsama} → #${b.no} (${alicilar.length} kişi)`);
  }

  // (b) ayın toplu listesi
  const bugun = C.bnsGunKey(now);
  const topluGun = C.bnsFaturaTopluGunu(now);
  const saatTR = new Date(now).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' });
  if (bugun === topluGun && +saatTR >= 10 && +saatTR < 12) {
    const kilit = await pool.query(`SELECT v FROM ayarlar WHERE k='fatura_toplu_son'`);
    if ((kilit.rows[0] || {}).v !== bugun) {
      if (eksikler.length) {
        const faturasiz = eksikler.filter(b => b.satis != null);
        const tutarsiz = eksikler.filter(b => b.satis == null);
        const toplam = faturasiz.reduce((s, b) => s + Number(b.satis), 0);
        const satirlar = [
          `🧾 *Aylık fatura takip listesi* — faturasız ek işler`,
          ...(faturasiz.length ? ['', `*Faturasız (toplam ${toplam.toLocaleString('tr-TR')}₺):*`,
            ...faturasiz.map(b => `• ${eksikMetni(b)}${b.slack_url ? ` — ${b.slack_url}` : ''}`)] : []),
          ...(tutarsiz.length ? ['', `*Tutarı girilmemiş (${tutarsiz.length} iş):*`,
            ...tutarsiz.map(b => `• ${eksikMetni(b)}${b.slack_url ? ` — ${b.slack_url}` : ''}`)] : []),
          '', `Dashboard: ${DASHBOARD_URL}`,
        ].join('\n');
        // yöneticiler TÜM listeyi; lead'ler yalnız kendi işlerini alır
        const leadIsleri = new Map();
        eksikler.forEach(b => [...new Set([...(b.leads || []), b.created_by].filter(Boolean))]
          .forEach(uid => { if (!mgrs.includes(uid)) (leadIsleri.get(uid) || leadIsleri.set(uid, []).get(uid)).push(b); }));
        if (DRY) { console.log(`[dry] toplu → yöneticiler(${mgrs.length}) + ${leadIsleri.size} lead · ${eksikler.length} iş`); }
        else {
          for (const uid of mgrs) { try { await post(tok, uid, satirlar); } catch (e) { console.error('toplu dm', uid, e.message); } }
          for (const [uid, isler] of leadIsleri) {
            const m = `🧾 *Aylık fatura takibi* — sorumlusu olduğun eksik ek işler:\n` + isler.map(b => `• ${eksikMetni(b)}${b.slack_url ? ` — ${b.slack_url}` : ''}`).join('\n');
            try { await post(tok, uid, m); } catch (e) { console.error('toplu lead dm', uid, e.message); }
          }
        }
      }
      if (!DRY) await pool.query(`INSERT INTO ayarlar(k,v) VALUES('fatura_toplu_son',$1)
        ON CONFLICT (k) DO UPDATE SET v=$1`, [bugun]);
      console.log(`[fatura-hatirlatma] toplu liste günü: ${eksikler.length} eksik${DRY ? ' (dry)' : ''}`);
    }
  }
  await pool.end().catch(() => {});
  console.log(`[fatura-hatirlatma] bitti — ${eksikler.length} eksik iş tarandı${DRY ? ' (dry)' : ''}`);
})().catch(e => { console.error('[fatura-hatirlatma] hata:', e.message); process.exit(1); });
