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

defs.marka_dokumu = {
  description: 'Bir markanın durumu: aktif/tamamlanan/gecikmiş iş SAYILARI, kanal özeti ve son gün-sonu insight. Yönetici ise ortalama puan da döner.',
  input_schema: { type: 'object', required: ['marka'], properties: { marka: { type: 'string' }, aralik: { type: 'string' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const now = Date.now();
    const q = String(input.marka).toLocaleLowerCase('tr');
    const match = (m) => (m || '').toLocaleLowerCase('tr').includes(q);
    const br = (ctx.ed.bns_brands || []).find(b => match(b.name));
    if (!br) return { bulunamadi: true, adaylar: (ctx.ed.bns_brands || []).map(b => b.name).filter(match).slice(0, 6) };
    const aktifler = (ctx.ed.bns_briefs || []).filter(b => match(b.marka));
    const out = {
      marka: br.name,
      aktif: aktifler.length,
      gecikmis: aktifler.filter(b => b.deadline && b.deadline < now).length,
      tamamlanan: (ctx.ed.bns_completed || []).filter(c => match(c.marka) && inRange(c.bitis, range)).length,
      kanal_ozet: br.kanal_ozet ? br.kanal_ozet.slice(0, 300) : null,
      son_insight: br.son_insight ? br.son_insight.slice(0, 300) : null,
    };
    if (ctx.isAdmin) {
      // bns_ratings'te marka anahtarı yok (markalarda rating saklanmıyor); güvenli null.
      const rb = ctx.ed.bns_ratings && ctx.ed.bns_ratings.marka && ctx.ed.bns_ratings.marka[br.name];
      out.puan = rb ? { avg: rb.avg, cnt: rb.cnt } : null;
    }
    return out;
  },
};

defs.yildiz_karne = {
  description: 'Yıldız puan ortalamaları. kapsam: firma (genel), dept (departman), kisi (bir kişi). dept ve kisi YALNIZ yöneticilere açıktır.',
  input_schema: { type: 'object', required: ['kapsam'], properties: { kapsam: { type: 'string', enum: ['firma', 'dept', 'kisi'] }, key: { type: 'string' } } },
  run(input, ctx) {
    const R = ctx.ed.bns_ratings || {};
    if (input.kapsam === 'firma') return R.firma || { avg: null, cnt: 0 };
    if (!ctx.isAdmin) return { yetki: 'yöneticilere özel' };
    if (input.kapsam === 'dept') return { dept: R.dept || {} };
    if (input.kapsam === 'kisi') {
      const u = _matchUser(ctx.ed, input.key);
      if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.key) };
      const p = R.users && R.users[u.id];
      return { kisi: u.name, puan: p ? { avg: p.avg, cnt: p.cnt } : null };
    }
    return { error: 'geçersiz kapsam' };
  },
};

defs.gecikme_analizi = {
  description: 'Termini geçmiş AKTİF briefler: liste + gecikme gün sayısı + atananlar. Opsiyonel marka filtresi.',
  input_schema: { type: 'object', properties: { marka: { type: 'string' } } },
  run(input, ctx) {
    const now = Date.now();
    const q = input.marka ? input.marka.toLocaleLowerCase('tr') : null;
    const rows = (ctx.ed.bns_briefs || [])
      .filter(b => b.deadline && b.deadline < now && (!q || (b.marka || '').toLocaleLowerCase('tr').includes(q)))
      .map(b => ({ no: b.no, marka: b.marka, baslik: b.baslik, durum: b.durum,
        gecikme_gun: Math.floor((now - b.deadline) / 86400000),
        kisiler: [...(b.workers || []).map(w => w.name), ...(b.leads || []).map(l => l.name + '(lead)')] }))
      .sort((a, b) => b.gecikme_gun - a.gecikme_gun);
    return { toplam: rows.length, isler: rows.slice(0, 40), kirpildi: rows.length > 40 };
  },
};

defs.kapasite = {
  description: 'Kişi başına AKTİF iş yükü (kaç açık brief). Opsiyonel kisi parametresi tek kişiyi döner; yoksa tüm ekip azalan sırada.',
  input_schema: { type: 'object', properties: { kisi: { type: 'string' } } },
  run(input, ctx) {
    const load = {};
    for (const b of (ctx.ed.bns_briefs || [])) {
      for (const p of [...(b.workers || []), ...(b.leads || [])]) {
        if (!p.id) continue;
        (load[p.id] = load[p.id] || { kisi: p.name, aktif: 0, nos: [] });
        load[p.id].aktif++; load[p.id].nos.push(b.no);
      }
    }
    let list = Object.values(load).sort((a, b) => b.aktif - a.aktif);
    if (input.kisi) {
      const u = _matchUser(ctx.ed, input.kisi);
      if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
      list = list.filter(x => x.kisi === u.name);
    }
    return { kisiler: list };
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
