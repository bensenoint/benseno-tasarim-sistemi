// server/ody-tools.js — Ody'nin deterministik veri tool'ları.
// Tüm tool'lar getEmbedded() yapısal dizileri üzerinde KOD ile sayar; model asla saymaz.

const odySlack = require('./ody-slack');
const { pool } = require('./db');

// NOT: dashboard/app/calc.js benseno-api Docker imajında YOK (yalnız server/ kopyalanır) →
// require edilemez. finans hesabı burada server-local tutulur (calc.js'teki bnsKarMarj/
// bnsFinansOzet ile aynı mantık; ikisi de saf, senkron kalmalı).
const calc = {
  bnsKarMarj(b) {
    const m = (typeof b.maliyet === 'number') ? b.maliyet : null;
    const s = (typeof b.satis === 'number') ? b.satis : null;
    if (m == null && s == null) return { kar: null, marj: null };
    const kar = (s || 0) - (m || 0);
    const marj = (s && s > 0) ? Math.round((kar / s) * 100) : null;
    return { kar, marj };
  },
  // ── iş tipi süre motoru (dashboard/app/calc.js ile SENKRON kopya; imaj kuralı) ──
  bnsMesaiSaatKes(t1, t2) {
    if (!(t2 > t1)) return 0;
    const H = 3600000, GUN = 24 * H, OFF = 3 * H;
    let ms = 0;
    for (let g = Math.floor((t1 + OFF) / GUN); g <= Math.floor((t2 + OFF) / GUN); g++) {
      const w = (g + 4) % 7; if (w === 6 || w === 0) continue;
      const gun0 = g * GUN - OFF;
      const a = Math.max(t1, gun0 + 9 * H), b = Math.min(t2, gun0 + 19 * H);
      if (b > a) ms += b - a;
    }
    return ms / H;
  },
  bnsNetIsSaati(olaylar) {
    const DURAN = { beklemede: 1, musteride: 1, blokeli: 1 };
    const ol = (olaylar || []).filter(o => o && o.ts && o.durum).sort((x, y) => x.ts - y.ts);
    const bi = ol.findIndex(o => o.durum === 'basladi');
    if (bi < 0) return null;
    let toplam = 0, calisiyor = true, t0 = ol[bi].ts;
    for (let j = bi + 1; j < ol.length; j++) {
      const d = ol[j].durum, duran = DURAN[d] === 1, bitti = d === 'tamamlandi';
      if (calisiyor && (duran || bitti)) { toplam += calc.bnsMesaiSaatKes(t0, ol[j].ts); calisiyor = false; }
      else if (!calisiyor && !duran && !bitti) { t0 = ol[j].ts; calisiyor = true; }
      if (bitti) return toplam;
    }
    return null;
  },
  bnsTipSureIstatistik(completed, markaFiltre) {
    const havuz = {};
    (completed || []).forEach(c => {
      if (!c.is_tipi) return;
      if (markaFiltre && c.marka !== markaFiltre) return;
      const h = calc.bnsNetIsSaati(c.durum_olaylari);
      if (h == null || h < 0.25) return;
      (havuz[c.is_tipi] = havuz[c.is_tipi] || []).push(h);
    });
    const out = {};
    Object.keys(havuz).forEach(tip => {
      const v = havuz[tip].sort((a, b) => a - b);
      const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
      out[tip] = { medyan: Math.round(m * 10) / 10, min: Math.round(v[0] * 10) / 10, max: Math.round(v[v.length - 1] * 10) / 10, n: v.length };
    });
    return out;
  },
  bnsTipikSure(tip, marka, completed) {
    if (marka) { const im = calc.bnsTipSureIstatistik(completed, marka)[tip]; if (im && im.n >= 3) return { saat: im.medyan, n: im.n, kaynak: 'tip-marka' }; }
    const it = calc.bnsTipSureIstatistik(completed)[tip];
    if (it && it.n >= 3) return { saat: it.medyan, n: it.n, kaynak: 'tip' };
    const tum = [];
    (completed || []).forEach(c => { const h = calc.bnsNetIsSaati(c.durum_olaylari); if (h != null && h >= 0.25) tum.push(h); });
    if (!tum.length) return { saat: null, n: 0, kaynak: 'genel' };
    tum.sort((a, b) => a - b);
    const g = tum.length % 2 ? tum[(tum.length - 1) / 2] : (tum[tum.length / 2 - 1] + tum[tum.length / 2]) / 2;
    return { saat: Math.round(g * 10) / 10, n: tum.length, kaynak: 'genel' };
  },
  bnsFinansOzet(briefs) {
    let satis = 0, maliyet = 0, kar = 0, faturalanmamis = 0, tahsilEdilmemis = 0;
    (briefs || []).forEach((b) => {
      const km = calc.bnsKarMarj(b);
      if (km.kar != null) kar += km.kar;
      if (typeof b.satis === 'number') { satis += b.satis; if (!b.fatura) faturalanmamis += b.satis; else if (!b.odeme) tahsilEdilmemis += b.satis; }
      if (typeof b.maliyet === 'number') maliyet += b.maliyet;
    });
    const marj = satis > 0 ? Math.round((kar / satis) * 100) : null;
    return { satis, maliyet, kar, marj, faturalanmamis, tahsilEdilmemis };
  },
};

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

// Downvote geri bildirim özeti — kullanıcıların beğenmediği öneri tarzlarını kısa bağlama derler.
function bnsFeedbackOzet(rows) {
  const parts = (rows || []).map(r => (r.reason || r.advice_text || '').trim()).filter(Boolean);
  if (!parts.length) return '';
  const s = parts.slice(0, 8).join(' · ');
  return s.length > 400 ? s.slice(0, 397) + '…' : s;
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
  description: 'Kişi başına AKTİF iş yükü. Yük ROL AĞIRLIKLI: işi yapan=5, lead=2, gözlemci=0 (gözlemcilik gözetimdir, kapasiteye katılmaz — Genel bakış/Departman ile aynı). "yuk" = ağırlıklı toplam, "aktif" = işçi+lead iş sayısı. Liste yük\'e göre azalan. Opsiyonel kisi parametresi tek kişiyi döner.',
  input_schema: { type: 'object', properties: { kisi: { type: 'string' } } },
  run(input, ctx) {
    const W = { worker: 5, lead: 2, observer: 0 };
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

defs.is_tipi_ozet = {
  description: "İş TİPİ bazlı metrikler: tip başına adet (tamamlanan+aktif), tipik süre (medyan, n), en çok yapan markalar/kişiler, gecikme oranı. tip verilirse tek tipin dökümü, verilmezse tüm tiplerin özeti. 'En çok hangi iş tipini yapıyoruz', 'X tipi ne kadar sürüyor' gibi sorular için.",
  input_schema: { type: 'object', properties: { tip: { type: 'string', description: 'iş tipi kodu ya da adı (ops.)' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const tipler = ctx.ed.bns_is_tipleri || [];
    const comp = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range));
    const compAll = ctx.ed.bns_completed || [];
    const briefs = ctx.ed.bns_briefs || [];
    const ist = calc.bnsTipSureIstatistik(compAll);
    let hedef = null;
    if (input.tip) {
      const q = String(input.tip).toLocaleLowerCase('tr');
      hedef = tipler.find(t => t.kod === q || (t.ad || '').toLocaleLowerCase('tr').includes(q));
      if (!hedef) return { bulunamadi: true, tipler: tipler.map(t => t.ad) };
    }
    const satir = (t) => {
      const cs = comp.filter(c => c.is_tipi === t.kod);
      const marka = {}, kisi = {};
      let gec = 0;
      cs.forEach(c => {
        if (c.marka) marka[c.marka] = (marka[c.marka] || 0) + 1;
        (c.workers || []).forEach(w => { if (w && w.name) kisi[w.name] = (kisi[w.name] || 0) + 1; });
        if (c.deadline && c.bitis && c.bitis > c.deadline) gec++;
      });
      const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => k + '(' + n + ')');
      return {
        tip: t.ad, kod: t.kod,
        tamamlanan: cs.length,
        aktif: briefs.filter(b => b.is_tipi === t.kod).length,
        tipik_sure: ist[t.kod] || null,
        markalar: top(marka), kisiler: top(kisi),
        gecikme_orani_pct: cs.length ? Math.round(gec / cs.length * 100) : null,
      };
    };
    if (hedef) return satir(hedef);
    return { kapsam: range ? 'seçili aralık' : 'tüm zamanlar',
      tipler: tipler.map(satir).filter(r => r.tamamlanan || r.aktif).sort((a, b) => (b.tamamlanan + b.aktif) - (a.tamamlanan + a.aktif)) };
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
      is_tipi: b.is_tipi || null,
    };
    if (b.is_tipi) {
      const tk = calc.bnsTipikSure(b.is_tipi, b.marka, ctx.ed.bns_completed || []);
      if (tk.saat != null) out.tipik_sure = { saat: tk.saat, n: tk.n, kaynak: tk.kaynak };
      if (done) { const g = calc.bnsNetIsSaati(b.durum_olaylari); if (g != null) out.gercek_net_saat = Math.round(g * 10) / 10; }
    }
    if (ctx.isAdmin && done) { out.puan = b.rating ?? null; out.puan_sebep = b.rating_sebep || null; }
    // Thread duygu tonu — yalnız yöneticilere (admin || rol='yonetici')
    const me = (ctx.ed.bns_users || []).find(u => u && u.id === (ctx.user && ctx.user.slack_id));
    const yonetici = ctx.isAdmin || (me && me.rol === 'yonetici');
    if (yonetici && b.thread_ton) out.ton = b.thread_ton;
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

defs.slack_sorgu = {
  description: "Slack'ten CANLI bilgi çek (DB'de olmayan taze veri gerektiğinde). mod: " +
    "kanal_mesaj (bir markanın kanalındaki son mesajlar; marka gerekir) | " +
    "thread (bir brief'in #no Slack thread'i ham; no gerekir) | " +
    "arama (anahtar kelimeyle tüm kanallar; SLACK_USER_TOKEN yoksa kapalı; kelime gerekir) | " +
    "kisi_durum (kişinin tatil/izin/çevrimiçi durumu; kisi gerekir). " +
    "Dönen ham veriyi YORUMLA. Kullanıcı yalnız ERİŞTİĞİ kanalların bilgisini görür.",
  input_schema: { type: 'object', required: ['mod'], properties: {
    mod: { type: 'string', enum: ['kanal_mesaj', 'thread', 'arama', 'kisi_durum'] },
    marka: { type: 'string' }, no: { type: 'number' }, kelime: { type: 'string' }, kisi: { type: 'string' },
  } },
  run: async (input, ctx) => {
    const asker = (ctx && ctx.user && ctx.user.slack_id) || '';
    const scope = asker === odySlack.GORKEM ? 'gorkem' : (asker || 'anon');
    const now = Date.now();
    const mod = input.mod;

    if (mod === 'kisi_durum') {
      const pr = resolvePerson(ctx.ed, input.kisi);
      if (!pr.user) return { hata: 'kişi bulunamadı/belirsiz', adaylar: pr.adaylar };
      const person = pr.user;
      const cached = await odySlack.cacheOku('kisi_durum', person.id, 'genel');
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', kisi: person.name, durum: JSON.parse(cached.ham_ozet) };
      const d = await odySlack.kisiDurumu(person.id);
      if (!d) return { hata: 'Slack durum alınamadı' };
      await odySlack.cacheYaz('kisi_durum', person.id, 'genel', JSON.stringify(d));
      return { kaynak: 'slack', kisi: person.name, durum: d };
    }

    const userCh = asker === odySlack.GORKEM ? null : await odySlack.userKanallari(asker);

    if (mod === 'kanal_mesaj') {
      const ch = await odySlack.markaKanalId(input.marka);
      if (!ch) return { hata: 'marka kanalı bulunamadı' };
      if (!odySlack.erisebilirMi(userCh, ch, asker)) return { hata: 'bu kanala erişimin yok' };
      const cached = await odySlack.cacheOku('kanal_mesaj', ch, scope);
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', mesajlar: JSON.parse(cached.ham_ozet) };
      const msgs = await odySlack.kanalMesajlari(ch);
      if (!msgs) return { hata: 'kanal mesajları alınamadı' };
      const slim = msgs.slice(0, 50).map(m => ({ user: m.user, text: (m.text || '').slice(0, 500), ts: m.ts }));
      await odySlack.cacheYaz('kanal_mesaj', ch, scope, JSON.stringify(slim));
      return { kaynak: 'slack', kanal: ch, mesajlar: slim };
    }

    if (mod === 'thread') {
      const b = await odySlack.briefThreadRef(input.no);
      if (!b || !b.slack_channel || !b.slack_ts) return { hata: 'brief thread bulunamadı' };
      if (!odySlack.erisebilirMi(userCh, b.slack_channel, asker)) return { hata: 'bu iş kanalına erişimin yok' };
      const cached = await odySlack.cacheOku('thread', String(input.no), scope);
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', mesajlar: JSON.parse(cached.ham_ozet) };
      const msgs = await odySlack.threadDokumu(b.slack_channel, b.slack_ts);
      if (!msgs) return { hata: 'thread alınamadı' };
      const slim = msgs.slice(0, 50).map(m => ({ user: m.user, text: (m.text || '').slice(0, 500), ts: m.ts }));
      await odySlack.cacheYaz('thread', String(input.no), scope, JSON.stringify(slim));
      return { kaynak: 'slack', no: input.no, mesajlar: slim };
    }

    if (mod === 'arama') {
      const matches = await odySlack.slackArama(input.kelime || '');
      if (matches && matches.disabled) return { hata: 'Slack araması şu an kapalı (SLACK_USER_TOKEN yok)' };
      if (!matches) return { hata: 'arama yapılamadı' };
      const filt = matches.filter(m => odySlack.erisebilirMi(userCh, m.channel && m.channel.id, asker))
        .slice(0, 20).map(m => ({ kanal: m.channel && m.channel.name, user: m.username, text: (m.text || '').slice(0, 400), ts: m.ts }));
      await odySlack.cacheYaz('arama', (input.kelime || '').slice(0, 120), scope, JSON.stringify(filt));
      return { kaynak: 'slack', kelime: input.kelime, sonuc: filt };
    }
    return { hata: 'bilinmeyen mod' };
  },
};

defs.finans_ozet = {
  description: "Kârlılık özeti — YALNIZ yönetici. kapsam: firma (genel kâr/marj/faturalanmamış/tahsil) | marka (bir markanın kârı; marka gerekir). Kâr=satış−maliyet, tamamlanan işlerden (seçili aralık). Maliyet/satış DB'den.",
  input_schema: { type: 'object', required: ['kapsam'], properties: { kapsam: { type: 'string', enum: ['firma', 'marka'] }, marka: { type: 'string' } } },
  run: async (input, ctx) => {
    const me = (ctx.ed.bns_users || []).find(u => u && u.id === (ctx.user && ctx.user.slack_id));
    const yonetici = ctx.isAdmin || (me && me.rol === 'yonetici');
    if (!yonetici) return { hata: 'bu bilgi yöneticilere özel' };
    let done = ctx.ed.bns_completed || [];
    if (input.kapsam === 'marka') {
      const q = String(input.marka || '').toLocaleLowerCase('tr');
      if (!q) return { hata: 'marka gerekli' };
      done = done.filter(c => (c.marka || '').toLocaleLowerCase('tr').includes(q));
      if (!done.length) return { hata: 'marka bulunamadı / tamamlanan iş yok' };
    }
    const o = calc.bnsFinansOzet(done);
    return { kapsam: input.kapsam, marka: input.marka || null, ...o };
  },
};

// Son günlerin insight'ından müşteri-risk seviyesini LLM ile sınıflar → {risk, gerekce}. Hatada null.
async function sinifla(metin) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 120,
        system: "Sana bir markanın son günlerdeki gün-sonu insight'ları verilir. Müşteri-risk seviyesini değerlendir. YALNIZ JSON döndür: {\"risk\":\"dusuk|orta|yuksek\",\"gerekce\":\"tek kısa cümle\"}. Memnuniyetsizlik/aciliyet/revize baskısı artıyorsa risk yükselir. Emin değilsen dusuk.",
        messages: [{ role: 'user', content: metin }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = (j.content && j.content[0] && j.content[0].text) || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const o = JSON.parse(m[0]);
    const risk = ['dusuk', 'orta', 'yuksek'].includes(o.risk) ? o.risk : 'bilinmiyor';
    return { risk, gerekce: String(o.gerekce || '').slice(0, 200) };
  } catch (e) { return null; }
}

defs.marka_risk = {
  description: "Marka sağlık / müşteri-risk trendi (YALNIZ yönetici). Son ~5 günün gün-sonu insight'ından risk seviyesi (dusuk/orta/yuksek) + 1 cümle gerekçe. marka gerekir.",
  input_schema: { type: 'object', required: ['marka'], properties: { marka: { type: 'string' } } },
  run: async (input, ctx) => {
    const me = (ctx.ed.bns_users || []).find(u => u && u.id === (ctx.user && ctx.user.slack_id));
    if (!(ctx.isAdmin || (me && me.rol === 'yonetici'))) return { hata: 'bu bilgi yöneticilere özel' };
    const q = await pool.query(
      `SELECT d.id, d.tarih, d.insight, d.risk_seviye FROM brand_daily d JOIN brands b ON b.id=d.brand_id
       WHERE b.name ILIKE $1 AND d.insight IS NOT NULL ORDER BY d.tarih DESC LIMIT 5`, [`%${input.marka}%`]);
    if (q.rows.length < 2) return { risk: 'yetersiz veri', gerekce: 'son günlerde yeterli insight yok' };
    // Bugünkü (en güncel) satırda risk zaten hesaplandıysa cache'ten dön
    if (q.rows[0].risk_seviye) return { marka: input.marka, risk: q.rows[0].risk_seviye, gerekce: '(önbellek)' };
    const metin = q.rows.map(r => `${r.tarih}: ${r.insight}`).join('\n');
    const parsed = await sinifla(metin);
    if (parsed && parsed.risk && parsed.risk !== 'bilinmiyor') {
      try { await pool.query('UPDATE brand_daily SET risk_seviye=$1 WHERE id=$2', [parsed.risk, q.rows[0].id]); } catch (e) {}
    }
    return { marka: input.marka, risk: (parsed && parsed.risk) || 'bilinmiyor', gerekce: (parsed && parsed.gerekce) || '' };
  },
};

// ── Ody → Slack GÖNDERİM (yazma yeteneği) ────────────────────────────────────
// Güvenlik çerçevesi: imza zorunlu · önizleme+onay SUNUCUDA garanti (reqSeq: onay ancak
// önizlemeden SONRAKİ kullanıcı isteğinde geçerli) · 10 gönderim/saat · TTL 10dk · log.
const slackMod = require('./slack');
const _gonderBekleyen = new Map();   // uid → { mod, aciklama, gonder(), kod, reqSeq, ts0 }
const _gonderSayac = new Map();      // uid → ts[]
function _gonderLimitAsildi(uid) {
  const now = Date.now(), arr = (_gonderSayac.get(uid) || []).filter(t => now - t < 3600000);
  _gonderSayac.set(uid, arr);
  return arr.length >= 10;
}
function _odyIsMgr(ctx) {
  if (ctx.isAdmin) return true;
  const uid = ctx.user && ctx.user.slack_id;
  const u = (ctx.ed.bns_users || []).find(x => x.id === uid);
  return !!(u && (u.rol === 'yonetici' || u.yetki === 'yonetici'));
}
function _odyAd(ctx) {
  const uid = ctx.user && ctx.user.slack_id;
  const u = (ctx.ed.bns_users || []).find(x => x.id === uid);
  return (u && u.name) || (ctx.user && ctx.user.name) || uid || 'kullanıcı';
}

defs.slack_gonder = {
  description: "Slack'e mesaj GÖNDERİM ÖNİZLEMESİ hazırlar (henüz göndermez). YALNIZ kullanıcı açıkça mesaj göndermeni istediğinde çağır. mod: 'thread' (iş no thread'ine — atanan/açan/yönetici) | 'dm' (kişiye — yalnız yönetici) | 'kanal' (marka kanalına — yalnız yönetici). Dönen önizlemeyi kullanıcıya aynen göster ve onay iste.",
  input_schema: { type: 'object', required: ['mod', 'hedef', 'mesaj'], properties: {
    mod: { type: 'string', enum: ['thread', 'dm', 'kanal'] },
    hedef: { type: 'string', description: 'thread: iş no · dm: kişi adı/ID · kanal: marka adı' },
    mesaj: { type: 'string', description: 'gönderilecek metin (en çok 600 karakter)' },
  } },
  run(input, ctx) {
    const uid = ctx.user && ctx.user.slack_id;
    if (!uid) return { hata: 'kimlik çözülemedi' };
    const mesaj = String(input.mesaj || '').trim().slice(0, 600);
    if (!mesaj) return { hata: 'mesaj boş' };
    if (_gonderLimitAsildi(uid)) return { hata: 'saatlik gönderim limiti (10) doldu — bir süre sonra dene' };
    const imzali = `🤖 Ody — ${_odyAd(ctx)} adına:\n${mesaj}`;
    const mgr = _odyIsMgr(ctx);
    let aciklama, gonder;
    if (input.mod === 'thread') {
      const no = parseInt(String(input.hedef).replace(/\D/g, ''), 10);
      const b = (ctx.ed.bns_briefs || []).find(x => x.no === no) || (ctx.ed.bns_completed || []).find(x => x.no === no);
      if (!b) return { hata: `#${no} bulunamadı` };
      if (!b.slack_channel || !b.slack_ts) return { hata: `#${no} işinin Slack thread'i yok` };
      const iliskili = [...(b.workers || []), ...(b.leads || [])].some(p => p && p.id === uid) || b.created_by === uid;
      if (!mgr && !iliskili) return { hata: 'bu işin thread\'ine yalnız atananı, açanı veya yönetici mesaj gönderebilir' };
      aciklama = `#${b.no} ${b.marka || ''} iş thread'i`;
      gonder = () => slackMod.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts, text: imzali });
    } else if (input.mod === 'dm') {
      if (!mgr) return { hata: 'kişiye DM göndermek yöneticilere özeldir' };
      const q = String(input.hedef || '').toLowerCase();
      const kisi = (ctx.ed.bns_users || []).find(x => x.id === input.hedef)
        || (ctx.ed.bns_users || []).find(x => (x.name || '').toLowerCase().includes(q));
      if (!kisi || !/^U/.test(kisi.id)) return { hata: `kişi bulunamadı: ${input.hedef}` };
      aciklama = `${kisi.name} (DM)`;
      gonder = () => slackMod.dm(kisi.id, imzali);
    } else if (input.mod === 'kanal') {
      if (!mgr) return { hata: 'marka kanalına mesaj göndermek yöneticilere özeldir' };
      const kanal = slackMod.channelForBrand ? slackMod.channelForBrand(input.hedef) : null;
      if (!kanal) return { hata: `marka kanalı bulunamadı: ${input.hedef}` };
      aciklama = `${input.hedef} marka kanalı`;
      gonder = () => slackMod.postChannel(kanal, imzali);
    } else return { hata: 'mod thread|dm|kanal olmalı' };
    // İdempotent: bekleyen gönderi varken yeniden önizleme (LLM onay turunda tekrar çağırırsa)
    // orijinal kod ve reqSeq'i KORUR — yoksa onay sayacı her turda sıfırlanıp sonsuz onay döngüsü oluşur.
    // ctx.onay (sunucunun kendisi kullanıcı mesajından tespit etti) → metin ufak değişse bile
    // ESKİ (kullanıcının gördüğü) önizleme geçerlidir; LLM'in yeniden yazdığı varyant onay sürecini bozamaz.
    const eski = _gonderBekleyen.get(uid);
    if (eski && Date.now() - eski.ts0 < 10 * 60 * 1000 && (ctx.onay || (eski.imzali === imzali && eski.aciklama === aciklama))) {
      if (eski.imzali === imzali && eski.aciklama === aciklama) eski.gonder = gonder;
      return { onay_gerekli: true, onay_kodu: eski.kod, nereye: eski.aciklama, onizleme: eski.imzali,
        not: ctx.onay
          ? `Kullanıcı bu gönderiyi ZATEN ONAYLADI. Başka soru sormadan HEMEN slack_gonder_onayla çağır (onay_kodu: ${eski.kod}).`
          : 'Bu önizleme ZATEN oluşturulmuştu ve kullanıcıya gösterildi. Kullanıcı onay verdiyse ŞİMDİ slack_gonder_onayla çağır — yeniden onay isteme.' };
    }
    const kod = String(Math.floor(100000 + Math.random() * 900000));
    _gonderBekleyen.set(uid, { kod, reqSeq: ctx.reqSeq || 0, ts0: Date.now(), aciklama, imzali, gonder });
    return { onay_gerekli: true, onay_kodu: kod, nereye: aciklama, onizleme: imzali,
      not: 'Önizlemeyi kullanıcıya aynen göster ve onay iste. Kullanıcı AÇIK onay (evet/gönder) vermeden slack_gonder_onayla ÇAĞIRMA.' };
  },
};

defs.slack_gonder_onayla = {
  description: "slack_gonder önizlemesini kullanıcı AÇIKÇA onayladıktan sonra gerçek gönderimi yapar. Onay kodunu ver. Kullanıcı onaylamadan asla çağırma.",
  input_schema: { type: 'object', required: ['onay_kodu'], properties: { onay_kodu: { type: 'string' } } },
  async run(input, ctx) {
    const uid = ctx.user && ctx.user.slack_id;
    const p = _gonderBekleyen.get(uid);
    if (!p) return { hata: 'bekleyen gönderi yok — önce slack_gonder ile önizleme oluştur' };
    if (String(input.onay_kodu) !== p.kod) return { hata: 'onay kodu eşleşmiyor' };
    if (Date.now() - p.ts0 > 10 * 60 * 1000) { _gonderBekleyen.delete(uid); return { hata: 'önizleme süresi doldu (10dk) — yeniden oluştur' }; }
    // SUNUCU GARANTİSİ: onay ya önizlemeden SONRAKİ bir kullanıcı isteğinde gelmeli (reqSeq),
    // ya da sunucu kullanıcının SON MESAJINDAN onayı kendisi tespit etmiş olmalı (ctx.onay).
    // İkisi de LLM'in kontrolünde değil → aynı-tur bypass imkânsız.
    if (!(ctx.reqSeq > p.reqSeq || ctx.onay)) return { hata: 'onay, önizlemeyi gösterip kullanıcının AÇIK onayını aldıktan sonraki mesajda verilmeli' };
    _gonderBekleyen.delete(uid);
    if (process.env.ODY_GONDER_TEST === '1') return { test: true, gonderildi: true, nereye: p.aciklama };
    const r = await p.gonder();
    if (r && r.ok === false) return { hata: 'Slack gönderimi başarısız: ' + (r.error || 'bilinmiyor') };
    (_gonderSayac.get(uid) || _gonderSayac.set(uid, []).get(uid)).push(Date.now());
    console.log(`[ody-gonder] ${uid} → ${p.aciklama}`);
    return { gonderildi: true, nereye: p.aciklama };
  },
};

// Bekleyen (taze) gönderi var mı? — api.js sunucu-tarafı onay tespiti için.
function gonderBekliyor(uid) {
  const p = _gonderBekleyen.get(uid);
  return !!(p && Date.now() - p.ts0 < 10 * 60 * 1000);
}

// Anthropic'in beklediği {name, description, input_schema} dizisi + isimle çalıştırıcı.
const TOOLS = Object.entries(defs).map(([name, d]) => ({ name, description: d.description, input_schema: d.input_schema }));

async function runTool(name, input, ctx) {
  const d = defs[name];
  if (!d) return { error: `bilinmeyen tool: ${name}` };
  try { return await d.run(input || {}, ctx); }
  catch (e) { return { error: e.message }; }
}

module.exports = { TOOLS, runTool, gonderBekliyor, defs, _matchUser, resolvePerson, _userCandidates, normRange, inRange, bnsFeedbackOzet };
