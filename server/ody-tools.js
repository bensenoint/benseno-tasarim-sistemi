// server/ody-tools.js — Ody'nin deterministik veri tool'ları.
// Tüm tool'lar getEmbedded() yapısal dizileri üzerinde KOD ile sayar; model asla saymaz.

const MAXMS = 8.64e15;

// "Tüm zamanlar" preset'ini null'a indirger.
function normRange(range) {
  if (!range) return null;
  if (range.from <= 0 && range.to >= MAXMS) return null;
  if (typeof range.from !== 'number' || typeof range.to !== 'number') return null;
  return { from: range.from, to: range.to };
}

// Tamamlanan iş aralıkta mı (bitiş tarihine göre). range null → her zaman dahil.
function inRange(bitis, range) {
  if (!range) return true;
  return bitis != null && bitis >= range.from && bitis <= range.to;
}

// İsimden kullanıcı eşleştir (Türkçe-güvenli, id üzerinden). Bulunamazsa null.
function _matchUser(ed, kisi) {
  if (!kisi) return null;
  const users = ed.bns_users || [];
  const byId = users.find(u => u.id === kisi);
  if (byId) return byId;
  const q = String(kisi).toLocaleLowerCase('tr');
  const exact = users.find(u => (u.name || '').toLocaleLowerCase('tr') === q);
  if (exact) return exact;
  return users.find(u => (u.name || '').toLocaleLowerCase('tr').includes(q)) || null;
}

function _userCandidates(ed, kisi) {
  const q = String(kisi || '').toLocaleLowerCase('tr');
  return (ed.bns_users || [])
    .filter(u => (u.name || '').toLocaleLowerCase('tr').includes(q))
    .map(u => u.name).slice(0, 6);
}

// ── Tool tanımları ───────────────────────────────────────────────────────────
const defs = {};

defs.genel_ozet = {
  description: 'Sistemin genel durumu: aktif, gecikmiş, müşteride bekleyen, bugün biten ve (seçili aralıkta) tamamlanan iş SAYILARI. Argümansız çağrılabilir.',
  input_schema: { type: 'object', properties: { aralik: { type: 'string', description: 'opsiyonel; verilmezse dashboard aralığı' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const briefs = ctx.ed.bns_briefs || [];
    const completed = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range));
    const now = Date.now();
    const startToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
    return {
      aktif: briefs.length,
      gecikmis: briefs.filter(b => b.deadline && b.deadline < now).length,
      musteride: briefs.filter(b => b.durum === 'musteride').length,
      bugun_biten: completed.filter(c => c.bitis >= startToday).length,
      tamamlanan: completed.length,
      kapsam: range ? `${new Date(range.from).toISOString().slice(0,10)}..${new Date(range.to).toISOString().slice(0,10)}` : 'tüm zamanlar',
    };
  },
};

defs.brief_sorgula = {
  description: 'Brief ara/filtrele. Filtreler: marka (kısmi), durum (yeni/calisiliyor/incelemede/musteride/blokeli), kisi (isim, atanan), gecikmis (true), tamamlandi (true→tamamlananlarda arar; aralık uygulanır). Eşleşen işlerin listesi + toplam sayı.',
  input_schema: { type: 'object', properties: {
    marka: { type: 'string' }, durum: { type: 'string' }, kisi: { type: 'string' },
    gecikmis: { type: 'boolean' }, tamamlandi: { type: 'boolean' }, aralik: { type: 'string' },
  } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const now = Date.now();
    const u = input.kisi ? _matchUser(ctx.ed, input.kisi) : null;
    if (input.kisi && !u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
    const hasPerson = (b) => !u || [...(b.workers || []), ...(b.leads || [])].some(p => p.id === u.id);
    let rows;
    if (input.tamamlandi) {
      rows = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range) && hasPerson(c)
        && (!input.marka || (c.marka || '').toLocaleLowerCase('tr').includes(input.marka.toLocaleLowerCase('tr'))));
      rows = rows.map(c => ({ no: c.no, marka: c.marka, baslik: c.baslik, durum: 'tamamlandi', bitis: c.bitis, puan: c.rating ?? null,
        kisiler: [...(c.workers || []).map(w => w.name), ...(c.leads || []).map(l => l.name + '(lead)')] }));
    } else {
      rows = (ctx.ed.bns_briefs || []).filter(b => hasPerson(b)
        && (!input.durum || b.durum === input.durum)
        && (!input.gecikmis || (b.deadline && b.deadline < now))
        && (!input.marka || (b.marka || '').toLocaleLowerCase('tr').includes(input.marka.toLocaleLowerCase('tr'))));
      rows = rows.map(b => ({ no: b.no, marka: b.marka, baslik: b.baslik, durum: b.durum, termin: b.deadline,
        gecikmis: !!(b.deadline && b.deadline < now),
        kisiler: [...(b.workers || []).map(w => w.name), ...(b.leads || []).map(l => l.name + '(lead)')] }));
    }
    return { toplam: rows.length, isler: rows.slice(0, 40), kirpildi: rows.length > 40 };
  },
};

defs.kisi_dokumu = {
  description: 'Bir kişinin iş dökümü: tamamlanan (seçili aralık) ve aktif (her zaman) iş SAYILARI ve numaraları. Yönetici ise ortalama puan da döner. Kişi performansı/iş sayısı için YETKİLİ kaynak.',
  input_schema: { type: 'object', required: ['kisi'], properties: { kisi: { type: 'string', description: 'kişi adı veya id' }, aralik: { type: 'string' } } },
  run(input, ctx) {
    const u = _matchUser(ctx.ed, input.kisi);
    if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
    const range = normRange(ctx.range);
    const on = (arr) => arr.some(p => p.id === u.id);
    const tamam = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range) && on([...(c.workers || []), ...(c.leads || [])])).map(c => c.no).sort((a, b) => a - b);
    const aktif = (ctx.ed.bns_briefs || []).filter(b => on([...(b.workers || []), ...(b.leads || [])])).map(b => b.no).sort((a, b) => a - b);
    const out = { kisi: u.name, tamamlanan: { say: tamam.length, nos: tamam }, aktif: { say: aktif.length, nos: aktif } };
    if (ctx.isAdmin) {
      const p = ctx.ed.bns_ratings && ctx.ed.bns_ratings.users && ctx.ed.bns_ratings.users[u.id];
      out.puan = p ? { avg: p.avg, cnt: p.cnt } : null;
    }
    return out;
  },
};

// Anthropic'in beklediği {name, description, input_schema} dizisi + isimle çalıştırıcı.
const TOOLS = Object.entries(defs).map(([name, d]) => ({ name, description: d.description, input_schema: d.input_schema }));

async function runTool(name, input, ctx) {
  const d = defs[name];
  if (!d) return { error: `bilinmeyen tool: ${name}` };
  try { return await d.run(input || {}, ctx); }
  catch (e) { return { error: e.message }; }
}

module.exports = { TOOLS, runTool, defs, _matchUser, _userCandidates, normRange, inRange };
