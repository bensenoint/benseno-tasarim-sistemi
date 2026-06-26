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
// Kişi çözümleyici — ayrımlı sonuç: {user} | {bulunamadi,adaylar} | {belirsiz,adaylar}.
// id → tam ad → tek alt-dize eşleşmesi çözülür; BİRDEN ÇOK alt-dize eşleşmesi (tam eşleşme yoksa)
// SESSİZCE ilk kişiyi SEÇMEZ → {belirsiz} döner ki Ody hangisini kastettiğini sorsun (yanlış kişi sayma riski yok).
function resolvePerson(ed, kisi) {
  if (!kisi) return { bulunamadi: true, adaylar: [] };
  const users = ed.bns_users || [];
  const byId = users.find(u => u.id === kisi);
  if (byId) return { user: byId };
  const q = String(kisi).toLocaleLowerCase('tr');
  const exact = users.find(u => (u.name || '').toLocaleLowerCase('tr') === q);
  if (exact) return { user: exact };
  const subs = users.filter(u => (u.name || '').toLocaleLowerCase('tr').includes(q));
  if (subs.length === 1) return { user: subs[0] };
  if (subs.length > 1) return { belirsiz: true, adaylar: subs.map(u => u.name).slice(0, 8) };
  return { bulunamadi: true, adaylar: [] };
}

// Geriye dönük uyumluluk: user|null. Belirsizlikte null döner (sessiz yanlış seçim YOK).
function _matchUser(ed, kisi) {
  const r = resolvePerson(ed, kisi);
  return r.user || null;
}

function _userCandidates(ed, kisi) {
  const q = String(kisi || '').toLocaleLowerCase('tr');
  return (ed.bns_users || [])
    .filter(u => (u.name || '').toLocaleLowerCase('tr').includes(q))
    .map(u => u.name).slice(0, 6);
}

// Entity sebep (AI yorum metni) — type: firma|dept|kisi|marka, key: benseno|deptKey|userId/ad|markaAdı.
// range verilirse (tarihli arşiv): aralığın SONUNDA (<=to) yürürlükteki yorum; yoksa güncel snapshot.
function sebepFor(ed, range, type, ...keys) {
  const norm = (k) => String(k == null ? '' : k).toLocaleLowerCase('tr');
  const cur = ed.bns_sebep || [];
  const hist = ed.bns_sebep_history || [];
  const toStr = (range && typeof range.to === 'number') ? new Date(range.to).toISOString().slice(0, 10) : null;
  for (const key of keys) {
    if (key == null) continue;
    const k = norm(key);
    if (toStr) {
      const cands = hist.filter(s => s.type === type && norm(s.key) === k && s.gun <= toStr);
      if (cands.length) { cands.sort((a, b) => (a.gun < b.gun ? 1 : -1)); if (cands[0].sebep) return cands[0].sebep; }
    }
    const row = cur.find(s => s.type === type && norm(s.key) === k);
    if (row && row.sebep) return row.sebep;
  }
  return null;
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
  description: 'Brief ara/filtrele. Filtreler: marka (kısmi), durum (yeni/calisiliyor/basladi/incelemede/musteride/blokeli), kisi (isim, atanan), gecikmis (true), tamamlandi (true→tamamlananlarda arar; aralık uygulanır). Eşleşen işlerin listesi + toplam sayı.',
  input_schema: { type: 'object', properties: {
    marka: { type: 'string' }, durum: { type: 'string' }, kisi: { type: 'string' },
    gecikmis: { type: 'boolean' }, tamamlandi: { type: 'boolean' }, aralik: { type: 'string' },
  } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const now = Date.now();
    let u = null;
    if (input.kisi) {
      const pr = resolvePerson(ctx.ed, input.kisi);
      if (pr.belirsiz) return { belirsiz: true, adaylar: pr.adaylar };
      if (!pr.user) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
      u = pr.user;
    }
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
    const pr = resolvePerson(ctx.ed, input.kisi);
    if (pr.belirsiz) return { belirsiz: true, adaylar: pr.adaylar };
    if (!pr.user) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
    const u = pr.user;
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
      yorum: sebepFor(ctx.ed, normRange(ctx.range), 'marka', br.name),
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
    const rg = normRange(ctx.range);
    if (input.kapsam === 'firma') return { ...(R.firma || { avg: null, cnt: 0 }), yorum: sebepFor(ctx.ed, rg, 'firma', 'benseno') };
    if (!ctx.isAdmin) return { yetki: 'yöneticilere özel' };
    if (input.kapsam === 'dept') {
      const dept = R.dept || {};
      const yorumlar = {};
      for (const k of Object.keys(dept)) yorumlar[k] = sebepFor(ctx.ed, rg, 'dept', k);
      return { dept, yorumlar };
    }
    if (input.kapsam === 'kisi') {
      const pr = resolvePerson(ctx.ed, input.key);
      if (pr.belirsiz) return { belirsiz: true, adaylar: pr.adaylar };
      if (!pr.user) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.key) };
      const u = pr.user;
      const p = R.users && R.users[u.id];
      return { kisi: u.name, puan: p ? { avg: p.avg, cnt: p.cnt } : null, yorum: sebepFor(ctx.ed, rg, 'kisi', u.id, u.name) };
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
  description: 'Kişi başına AKTİF iş yükü. Yük ROL AĞIRLIKLI: işi yapan=5, lead=2, gözlemci=1. "yuk" = ağırlıklı toplam, "aktif" = işçi+lead iş sayısı (gözlemci hariç). Liste yük\'e göre azalan. Opsiyonel kisi parametresi tek kişiyi döner.',
  input_schema: { type: 'object', properties: { kisi: { type: 'string' } } },
  run(input, ctx) {
    const W = { worker: 5, lead: 2, observer: 1 };
    const load = {};
    const bump = (p, w, no, isAktif) => {
      if (!p || !p.id) return;
      const e = (load[p.id] = load[p.id] || { kisi: p.name, aktif: 0, yuk: 0, nos: [] });
      e.yuk += w;
      if (isAktif) { e.aktif++; e.nos.push(no); }
    };
    for (const b of (ctx.ed.bns_briefs || [])) {
      for (const p of (b.workers || [])) bump(p, W.worker, b.no, true);
      for (const p of (b.leads || [])) bump(p, W.lead, b.no, true);
      for (const p of (b.observers || [])) bump(p, W.observer, b.no, false);
    }
    let list = Object.values(load).sort((a, b) => b.yuk - a.yuk);
    if (input.kisi) {
      const pr = resolvePerson(ctx.ed, input.kisi);
      if (pr.belirsiz) return { belirsiz: true, adaylar: pr.adaylar };
      if (!pr.user) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
      list = list.filter(x => x.kisi === pr.user.name);
    }
    return { kisiler: list };
  },
};

defs.trend = {
  description: 'Zaman içinde metrik trendi (kpi geçmişinden). metrik: aktif/gecikmis/bugun/musteride. Son ~48 ölçüm noktasının özeti (ilk, son, min, max).',
  input_schema: { type: 'object', required: ['metrik'], properties: { metrik: { type: 'string', enum: ['aktif', 'gecikmis', 'bugun', 'musteride'] } } },
  run(input, ctx) {
    const map = { aktif: 'active', gecikmis: 'overdue', bugun: 'today', musteride: 'musteride' };
    const field = map[input.metrik];
    const hist = ctx.ed.bns_history || [];
    if (!field || !hist.length) return { hata: 'trend verisi yok' };
    const vals = hist.map(h => h[field]).filter(v => typeof v === 'number');
    if (!vals.length) return { hata: 'metrik bulunamadı' };
    // bns_history eskiden-yeniye sıralı: ilk = en eski, son = en güncel.
    return { metrik: input.metrik, nokta: vals.length, ilk: vals[0], son: vals[vals.length - 1], min: Math.min(...vals), max: Math.max(...vals) };
  },
};

defs.is_detay = {
  description: 'Tek bir işin (#no) DETAYI + NİTEL bağlam: marka, başlık, durum, termin, atananlar, gecikme; ayrıca thread özeti (thread_ozet), tamamlandıysa insight ve (yöneticiye) puan + puan sebebi. Bir işi özetlemek/yorumlamak/öneri vermek için bunu çağır.',
  input_schema: { type: 'object', required: ['no'], properties: { no: { type: 'number', description: 'iş numarası (#no)' } } },
  run(input, ctx) {
    const no = +input.no;
    const act = (ctx.ed.bns_briefs || []).find(b => b.no === no);
    const done = (ctx.ed.bns_completed || []).find(c => c.no === no);
    const b = act || done;
    if (!b) return { bulunamadi: true };
    const now = Date.now();
    const out = {
      no: b.no, marka: b.marka, baslik: b.baslik,
      durum: act ? b.durum : 'tamamlandi',
      termin: b.deadline || null,
      gecikmis: act ? !!(b.deadline && b.deadline < now) : null,
      atananlar: [...(b.workers || []).map(w => w.name), ...(b.leads || []).map(l => l.name + '(lead)')],
      thread_ozet: b.thread_ozet || null,
      insight: done ? (b.insight || null) : null,
    };
    if (ctx.isAdmin && done) { out.puan = b.rating ?? null; out.puan_sebep = b.rating_sebep || null; }
    return out;
  },
};

defs.insightlar = {
  description: 'İşlerin NİTEL özet/insight metinleri — ÖZET, ÖNERİ, YORUM üretmek için (sayı/olgu için DEĞİL). Filtre: marka, kisi, tamamlandi(true→tamamlanan insight\'ları; yoksa aktif thread özetleri), aralik. Her kayıt: no, marka, başlık + özet/insight metni. Sayılar için diğer tool\'ları kullan; bu tool yorumu zenginleştirir.',
  input_schema: { type: 'object', properties: { marka: { type: 'string' }, kisi: { type: 'string' }, tamamlandi: { type: 'boolean' }, aralik: { type: 'string' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    let u = null;
    if (input.kisi) {
      const pr = resolvePerson(ctx.ed, input.kisi);
      if (pr.belirsiz) return { belirsiz: true, adaylar: pr.adaylar };
      if (!pr.user) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
      u = pr.user;
    }
    const mq = input.marka ? input.marka.toLocaleLowerCase('tr') : null;
    const onPerson = (b) => !u || [...(b.workers || []), ...(b.leads || [])].some(p => p.id === u.id);
    const onMarka = (b) => !mq || (b.marka || '').toLocaleLowerCase('tr').includes(mq);
    let rows;
    if (input.tamamlandi) {
      rows = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range) && onPerson(c) && onMarka(c))
        .map(c => ({ no: c.no, marka: c.marka, baslik: c.baslik, insight: (c.insight || '').slice(0, 500) || null, ozet: (c.thread_ozet || '').slice(0, 350) || null }))
        .filter(r => r.insight || r.ozet);
    } else {
      rows = (ctx.ed.bns_briefs || []).filter(b => onPerson(b) && onMarka(b))
        .map(b => ({ no: b.no, marka: b.marka, baslik: b.baslik, durum: b.durum, ozet: (b.thread_ozet || '').slice(0, 350) || null }))
        .filter(r => r.ozet);
    }
    return { toplam: rows.length, kayitlar: rows.slice(0, 25), kirpildi: rows.length > 25 };
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

module.exports = { TOOLS, runTool, defs, _matchUser, resolvePerson, _userCandidates, normRange, inRange };
