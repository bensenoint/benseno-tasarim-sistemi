'use strict';

/** DB → dashboard için hazır JSON (SQL ile; LLM toplama yok). */
const { pool } = require('./db');
const calc = require('./calc-penalty');   // bnsCycleSure (döngü-bazlı süre)

// Tüm brief'ler + atananları (json_agg ile tek sorgu) → hidratlanmış shape
async function allBriefsWithAssignees() {
  const r = await pool.query(`
    SELECT b.id, b.no, b.slack_ts, b.slack_channel, b.slack_url,
           br.name AS marka, br.color AS marka_color,
           b.baslik, b.dept, b.deadline, b.saat, b.durum, b.priority, b.priority_label,
           b.rev, b.maliyet, b.satis, b.fatura, b.odeme, b.musteri_notu, b.tahmini_sure_h,
           b.akis, b.stale, b.created_at, b.created_by, b.completed_at, b.updated_at, b.deleted_at, b.deleted_by,
           b.thread_ozet, b.thread_ozet_at, b.thread_ozet_ts, b.thread_ton, b.insight, b.insight_at, b.uyari_at, b.uyari2_at,
           b.rating, b.rating_by, b.rating_sebep, b.ucret_tipi, b.is_tipi,
           b.deadline_orig, b.uzatma_sayisi, b.uzatma_ceza, b.uzatma_muaf, b.deadline_history,
           b.termin_oneri_at, b.termin_oneri_ms,
           b.image_url, b.started_at, b.basladi_at,
           b.rev_ic, b.rev_musteri, b.gonderim_sayisi, b.son_gonderim_at, b.musteri_bekliyor,
           COALESCE(json_agg(
             json_build_object('id',u.id,'name',u.name,'role',a.role,'dept',u.dept,'initials',u.initials,'color',u.color,'sira',a.sira,'kisi_sira',a.kisi_sira,'onay_at',a.onay_at,'onay_by',a.onay_by,'calisiyor',a.calisiyor)
             ORDER BY a.sira NULLS LAST
           ) FILTER (WHERE u.id IS NOT NULL), '[]') AS assignees
    FROM briefs b
    LEFT JOIN brands br ON br.id = b.marka_id
    LEFT JOIN brief_assignees a ON a.brief_id = b.id
    LEFT JOIN users u ON u.id = a.user_id
    GROUP BY b.id, br.name, br.color
    ORDER BY b.no`);
  return r.rows.map(row => {
    const as = row.assignees || [];
    const workers = as.filter(x => x.role === 'contributor');   // işi yapanlar
    const leads = as.filter(x => x.role === 'lead');            // lead(ler)
    const observers = as.filter(x => x.role === 'gozlemci');    // gözlemciler
    return {
      ...row,
      workers, leads, observers,
      // geriye uyum (getState eski tüketiciler):
      lead: leads[0] || null,
      contributors: workers,
      editors: as.filter(x => x.role === 'editor'),
      gozlemciler: observers,
    };
  });
}

// SEC-4: sensitive=false ise brief'lerden finans (maliyet/satis/fatura/odeme) ve puan
// (rating/rating_by/rating_sebep) alanlarını çıkar. Bot/admin (sensitive=true) tam veri alır.
function stripBriefSensitive(b) {
  const { maliyet, satis, fatura, odeme, rating, rating_by, rating_sebep, ...rest } = b;
  return rest;
}

async function getState({ sensitive = true } = {}) {
  const [users, brands, all, dept, brand, events] = await Promise.all([
    pool.query(`SELECT id,name,rol,dept,yetki,initials,color,title,active,avatar_url,sched_scope FROM users WHERE active ORDER BY rol,name`),
    pool.query(`SELECT id,name,color,wheel_idx,slack_channel,aylik_ucret FROM brands ORDER BY name`),
    allBriefsWithAssignees(),
    // departman yükü (aktif + gecikmiş), kişi sayısı
    pool.query(`
      SELECT u.dept,
        count(DISTINCT u.id)::int people,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride' AND a.role <> 'gozlemci')::int active,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride' AND b.deadline < now() AND a.role <> 'gozlemci')::int overdue,
        count(DISTINCT b.id) FILTER (WHERE b.durum = 'musteride' AND a.role <> 'gozlemci')::int musteride,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int completed30
      FROM users u
      LEFT JOIN brief_assignees a ON a.user_id = u.id
      LEFT JOIN briefs b ON b.id = a.brief_id
        AND NOT (b.completed_at IS NULL AND b.akis = 'sirali' AND a.role = 'contributor'
          AND (a.onay_at IS NOT NULL OR EXISTS (
            SELECT 1 FROM brief_assignees a2
            WHERE a2.brief_id = b.id AND a2.role = 'contributor' AND a2.onay_at IS NULL
              AND COALESCE(a2.sira, 999999) < COALESCE(a.sira, 999999))))
      WHERE u.dept IS NOT NULL AND u.active GROUP BY u.dept`),
    // marka istatistik
    pool.query(`
      SELECT br.name, br.color,
        count(b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride')::int active,
        count(b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int done30,
        count(b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride' AND b.deadline < now())::int overdue,
        round(avg(b.rev) FILTER (WHERE b.completed_at IS NOT NULL), 1) avg_rev,
        round((avg(b.rating) FILTER (WHERE b.rating IS NOT NULL))::numeric, 1)::float rating,
        count(b.id) FILTER (WHERE b.rating IS NOT NULL)::int rating_count
      FROM brands br LEFT JOIN briefs b ON b.marka_id = br.id
      GROUP BY br.name, br.color ORDER BY active DESC, br.name`),
    pool.query(`SELECT e.id, e.brief_id, e.user_id, u.name AS user_name, e.verb, e.detail, e.source, e.ts
                FROM events e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.ts DESC LIMIT 200`),
  ]);

  const deptStats = {};
  for (const r of dept.rows) deptStats[r.dept] = r;
  // SEC-4: admin/bot değilse her brief'ten finans + puan alanlarını çıkar.
  const clean = (arr) => sensitive ? arr : arr.map(stripBriefSensitive);
  return {
    users: users.rows,
    brands: brands.rows,
    briefs: clean(all.filter(b => !b.completed_at && !b.deleted_at)),
    completed: clean(all.filter(b => b.completed_at && !b.deleted_at)),
    deleted: all.filter(b => b.deleted_at),
    deptStats,
    brandStats: brand.rows,
    events: events.rows,
    generated_at: new Date().toISOString(),
    source: 'postgres',
  };
}

// DB → dashboard'ın HAM beklediği bns_* shape (index.html EMBEDDED_DATA + poll ile aynı).
// Dashboard kendi bnsHydrate* hattından geçirir; biz sadece doğru ham alan adlarını üretiriz.
async function getEmbedded({ sensitive = true } = {}) {
  const [all, brands, users, dept] = await Promise.all([
    allBriefsWithAssignees(),
    pool.query(`SELECT name, color, wheel_idx, aylik_ucret FROM brands ORDER BY name`),
    pool.query(`SELECT id,name,rol,dept,yetki,initials,color,avatar_url,sched_scope FROM users WHERE active ORDER BY rol,name`),
    pool.query(`
      SELECT u.dept,
        count(DISTINCT u.id)::int people,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride' AND a.role <> 'gozlemci')::int active,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum <> 'musteride' AND b.deadline < now() AND a.role <> 'gozlemci')::int overdue,
        count(DISTINCT b.id) FILTER (WHERE b.durum = 'musteride' AND a.role <> 'gozlemci')::int musteride,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int completed30
      FROM users u
      LEFT JOIN brief_assignees a ON a.user_id = u.id
      LEFT JOIN briefs b ON b.id = a.brief_id
        AND NOT (b.completed_at IS NULL AND b.akis = 'sirali' AND a.role = 'contributor'
          AND (a.onay_at IS NOT NULL OR EXISTS (
            SELECT 1 FROM brief_assignees a2
            WHERE a2.brief_id = b.id AND a2.role = 'contributor' AND a2.onay_at IS NULL
              AND COALESCE(a2.sira, 999999) < COALESCE(a.sira, 999999))))
      WHERE u.dept IS NOT NULL AND u.active GROUP BY u.dept`),
  ]);
  const ms = (d) => (d ? new Date(d).getTime() : 0);

  // Ekler: brief_id → [{id, name, permalink, mime, is_final}] (galeri proxy id + tip + final işareti)
  const att = await pool.query(`SELECT id, brief_id, filename AS name, url AS permalink, mime, is_final FROM brief_attachments ORDER BY is_final DESC, id`);
  const attByBrief = {};
  for (const a of att.rows) (attByBrief[a.brief_id] ||= []).push({ id: a.id, name: a.name, permalink: a.permalink, mime: a.mime || '', is_final: !!a.is_final });

  // Bekleme süreleri: 'beklemede' durumuna girişten bir sonraki durum değişimine kadar geçen
  // toplam süre (ms). Süre/gecikme hesapları bu süreyi MUAF tutar (saat durur).
  // Hâlâ beklemedeyse completed_at, o da yoksa now() kapatır.
  const pse = await pool.query(`
    SELECT x.brief_id, EXTRACT(EPOCH FROM sum(COALESCE(x.next_ts, b.completed_at, now()) - x.ts)) * 1000 AS ms
    FROM (SELECT brief_id, verb, ts, lead(ts) OVER (PARTITION BY brief_id ORDER BY ts) AS next_ts
          FROM events WHERE verb LIKE 'durum:%') x
    JOIN briefs b ON b.id = x.brief_id
    WHERE x.verb = 'durum:beklemede' GROUP BY x.brief_id`);
  const pauseByBrief = {};
  for (const r of pse.rows) pauseByBrief[r.brief_id] = Math.max(0, Math.round(+r.ms));

  // Statü geçmişi (döngü-bazlı süre için): brief başına sıralı durum event'leri.
  const dse = await pool.query(
    `SELECT brief_id, EXTRACT(EPOCH FROM ts) * 1000 AS ts, substring(verb from 7) AS durum
     FROM events WHERE verb LIKE 'durum:%' ORDER BY brief_id, ts`);
  const eventsByBrief = {};
  for (const r of dse.rows) (eventsByBrief[r.brief_id] ||= []).push({ ts: Math.round(+r.ts), durum: r.durum });
  const NOW_MS = Date.now();
  // Bir brief için döngü-bazlı süre özeti (events yoksa baslangic/bitis fallback).
  const cycleOf = (b) => calc.bnsCycleSure(eventsByBrief[b.id] || [], NOW_MS,
    { baslangic: ms(b.basladi_at || b.started_at), bitis: ms(b.completed_at), beklemeMs: pauseByBrief[b.id] || 0 });

  // Marka → renk (silinenler ekranı marka_color bekliyor)
  const brandColor = {};
  for (const br of brands.rows) brandColor[br.name] = br.color;

  const bns_briefs = all.filter(b => !b.completed_at && !b.deleted_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik, is_tipi: b.is_tipi || null, dept: b.dept || '',
    oncelik: b.priority || '🟡',   // manuel öncelik (🔴🟠🟡🟢) — girilmemişse NORMAL
    workers:   b.workers.map(w => ({ id: w.id, name: w.name, dept: w.dept || '', sira: w.sira ?? null, kisi_sira: w.kisi_sira ?? null, onay: !!w.onay_at, onay_by: w.onay_by || null })),
    akis: b.akis || 'paralel',
    // sıralı zincirde sırası gelen halka (ilk onaysız contributor) — uyarılar ve UI bunun üstünden çalışır
    aktif_halka: (b.akis === 'sirali' && b.workers.length > 1) ? ((b.workers.find(w => !w.onay_at) || {}).id || null) : null,
    leads:     b.leads.map(l => ({ id: l.id, name: l.name })),
    observers: b.observers.map(o => ({ id: o.id, name: o.name })),
    notes: b.musteri_notu || '',
    deadline: ms(b.deadline), durum: b.durum, rev: b.rev || 0,
    deadline_orig: ms(b.deadline_orig), uzatma_sayisi: b.uzatma_sayisi || 0, uzatma_muaf: b.uzatma_muaf || 0, deadline_history: b.deadline_history || [],
    termin_oneri_at: ms(b.termin_oneri_at), termin_oneri_ms: b.termin_oneri_ms != null ? Number(b.termin_oneri_ms) : null,
    rev_ic: b.rev_ic || 0, rev_musteri: b.rev_musteri || 0,
    gonderim_sayisi: b.gonderim_sayisi || 0, son_gonderim_at: ms(b.son_gonderim_at), musteri_bekliyor: !!b.musteri_bekliyor,
    // SEC-4: finans yalnız admin/bot; diğer JWT kullanıcılar için çıkarılır.
    ...(sensitive ? { maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme, ucret_tipi: b.ucret_tipi || null } : {}),
    slack_url: b.slack_url || '#',
    slack_ts: b.slack_ts || null, slack_channel: b.slack_channel || null,
    thread_ozet: b.thread_ozet || null, thread_ozet_at: b.thread_ozet_at || null, thread_ozet_ts: b.thread_ozet_ts || null,
    thread_ton: b.thread_ton || null,
    stale: !!b.stale, created_at: ms(b.created_at), created_by: b.created_by || null, updated_at: ms(b.updated_at), uyari_at: ms(b.uyari_at), uyari2_at: ms(b.uyari2_at),
    attachments: attByBrief[b.id] || [],
    // Statü-giriş olayları (tarih-bazlı KPI: aralıkta o statüye girmiş iş sayımı için)
    durum_olaylari: eventsByBrief[b.id] || [],
  }));

  const bns_completed = all.filter(b => b.completed_at && !b.deleted_at).map(b => { const cyc = cycleOf(b); return ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik, is_tipi: b.is_tipi || null,
    leads:   b.leads.map(l => ({ id: l.id, name: l.name })),
    workers: b.workers.map(w => ({ id: w.id, name: w.name, sira: w.sira ?? null, kisi_sira: w.kisi_sira ?? null, onay: !!w.onay_at })),
    akis: b.akis || 'paralel',
    deadline: ms(b.deadline), baslangic: ms(b.basladi_at || b.started_at), bitis: ms(b.completed_at),
    deadline_orig: ms(b.deadline_orig), uzatma_sayisi: b.uzatma_sayisi || 0, deadline_history: b.deadline_history || [],
    bekleme_ms: pauseByBrief[b.id] || 0,   // süre/gecikme hesabından düşülür (geriye uyum)
    // Döngü-bazlı süre: her açılış→tamamlanış döngüsü ayrı; sureH = toplam (headline), kırılım sure_cycles.
    sure_cycles: cyc.cycles, sureH: cyc.toplamH, sureH_son: cyc.sonH, sureH_toplam: cyc.toplamH,
    rev: b.rev || 0,
    rev_ic: b.rev_ic || 0, rev_musteri: b.rev_musteri || 0,
    // SEC-4: finans + puan alanları yalnız admin/bot; diğer JWT kullanıcılar için çıkarılır.
    ...(sensitive ? { maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme, ucret_tipi: b.ucret_tipi || null,
      rating: b.rating || null, rating_by: b.rating_by || null, rating_sebep: b.rating_sebep || null } : {}),
    slack_url: b.slack_url || '#',
    slack_ts: b.slack_ts || null, slack_channel: b.slack_channel || null,
    thread_ozet: b.thread_ozet || null, thread_ozet_at: b.thread_ozet_at ? ms(b.thread_ozet_at) : null,
    thread_ton: b.thread_ton || null,
    insight: b.insight || null, insight_at: b.insight_at ? ms(b.insight_at) : null,
    image_url: b.image_url || null,
    notes: b.musteri_notu || '',
    attachments: attByBrief[b.id] || [],
    durum_olaylari: eventsByBrief[b.id] || [],
  }); });

  const bns_deleted = all.filter(b => b.deleted_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, marka_color: brandColor[b.marka] || null,
    baslik: b.baslik, is_tipi: b.is_tipi || null, durum: b.durum,
    deleted_at: b.deleted_at, deleted_by: b.deleted_by,
  }));

  const bns_dept_stats = {};
  for (const r of dept.rows) bns_dept_stats[r.dept] = r;

  // Aktivite akışı (Geçmiş ekranı) — son 80 olay, brief/marka bağlamıyla
  const ev = await pool.query(`
    SELECT e.ts, e.user_id, e.verb, e.detail, b.no, b.baslik, br.name AS marka
    FROM events e
    LEFT JOIN briefs b ON b.id = e.brief_id
    LEFT JOIN brands br ON br.id = b.marka_id
    WHERE e.verb NOT LIKE 'slack:%'
    ORDER BY e.ts DESC LIMIT 80`);
  const bns_events = ev.rows.map(e => ({
    t: ms(e.ts), who: e.user_id, verb: e.verb, detail: e.detail,
    no: e.no, baslik: e.baslik, marka: e.marka,
  }));

  // ⭐ Yıldız karnesi — puanlı tamamlanan işlerden canlı ortalamalar (firma/dept/kişi/marka)
  // SEC-4: puan/rating_sebep yalnız admin/bot; diğer JWT kullanıcılar için hiç sorgulanmaz/dönmez.
  let bns_ratings = null, bns_sebep = [], bns_sebep_history = [];
  if (sensitive) try {
    const [firma, deptR, userR, sebep] = await Promise.all([
      pool.query(`SELECT round(avg(rating)::numeric,1)::float avg, count(*)::int cnt FROM briefs WHERE rating IS NOT NULL`),
      // Dept ortalaması katılımcıların departmanından: çok departmanlı işte (örn. tasarım+editör)
      // puan HER İKİ departmana da işler — briefs.dept tek etiketi bunu kaçırıyordu.
      pool.query(`SELECT u.dept, round(avg(b.rating)::numeric,1)::float avg, count(DISTINCT b.id)::int cnt
                  FROM briefs b
                  JOIN brief_assignees a ON a.brief_id=b.id AND a.role IN ('contributor','lead')
                  JOIN users u ON u.id=a.user_id
                  WHERE b.rating IS NOT NULL AND u.dept IS NOT NULL AND u.dept <> 'freelance'
                  GROUP BY u.dept`),
      pool.query(`SELECT a.user_id AS id, round(avg(b.rating)::numeric,1)::float avg, count(DISTINCT b.id)::int cnt
                  FROM briefs b JOIN brief_assignees a ON a.brief_id=b.id AND a.role IN ('contributor','lead')
                  WHERE b.rating IS NOT NULL GROUP BY a.user_id`),
      pool.query(`SELECT type, key, sebep, rating_avg::float, rating_count, updated_at FROM entity_sebep`),
    ]);
    bns_ratings = {
      firma: firma.rows[0] || { avg: null, cnt: 0 },
      dept: Object.fromEntries(deptR.rows.map(r => [r.dept, { avg: r.avg, cnt: r.cnt }])),
      users: Object.fromEntries(userR.rows.map(r => [r.id, { avg: r.avg, cnt: r.cnt }])),
    };
    bns_sebep = sebep.rows;
  } catch (e) { console.error('[queries] ratings okunamadı:', e.message); }
  // Tarihli sebep arşivi AYRI try/catch — tablo henüz yoksa (migration uygulanmadıysa)
  // ratings/sebep akışını ÇÖKERTMESİN (regresyon koruması).
  if (sensitive) try {
    const sebepHist = await pool.query(`SELECT type, key, to_char(gun,'YYYY-MM-DD') AS gun, sebep, rating_avg::float, rating_count
                  FROM entity_sebep_history WHERE gun >= (now() - interval '1 year')::date ORDER BY gun`);
    bns_sebep_history = sebepHist.rows;
  } catch (e) { /* entity_sebep_history yoksa sessiz geç — güncel sebep zaten bns_sebep'te */ }

  // KPI geçmişi (Overview spark grafikleri) — son 48 anlık görüntü, eskiden yeniye
  let bns_history = [];
  try {
    const kh = await pool.query(
      `SELECT ts, active, overdue, today, review, stale, musteride FROM kpi_history ORDER BY ts DESC LIMIT 48`);
    bns_history = kh.rows.reverse().map(h => ({ ts: ms(h.ts), active: h.active, overdue: h.overdue, today: h.today, review: h.review, stale: h.stale, musteride: h.musteride || 0 }));
  } catch (e) { console.error('[queries] kpi_history okunamadı:', e.message); }

  // Marka kanal özetleri + son gün-sonu insight'ı (Marka detay sayfası)
  const bo = await pool.query(`
    SELECT br.name, br.kanal_ozet, br.kanal_ozet_at, d.insight AS son_insight, d.tarih AS son_insight_tarih
    FROM brands br
    LEFT JOIN LATERAL (
      SELECT insight, tarih FROM brand_daily WHERE brand_id = br.id AND insight IS NOT NULL
      ORDER BY tarih DESC LIMIT 1) d ON TRUE`);
  const ozetById = Object.fromEntries(bo.rows.map(r => [r.name, r]));

  // fatura-v2: son 3 ayın retainer kayıtları — yalnız sensitive (SEC-5: finans login-arkası).
  let bns_is_tipleri = [];
  try {
    const it = await pool.query(`SELECT kod, ad, grup, sira FROM is_tipleri WHERE aktif ORDER BY sira`);
    bns_is_tipleri = it.rows;
  } catch (e) { /* migration öncesi boot'ta sessiz geç */ }

  let bns_marka_fatura = [];
  if (sensitive) {
    const mf = await pool.query(
      `SELECT br.name AS marka, mf.ay, mf.tutar::float AS tutar, mf.fatura, mf.odeme
       FROM marka_fatura mf JOIN brands br ON br.id = mf.marka_id
       WHERE mf.ay >= to_char(now() - interval '2 months', 'YYYY-MM') ORDER BY mf.ay DESC`);
    bns_marka_fatura = mf.rows;
  }

  return {
    now: new Date().toISOString(),
    bns_brands: brands.rows.map(b => {
      const o = ozetById[b.name] || {};
      return { name: b.name, color: b.color, wheelIdx: b.wheel_idx,
        ...(sensitive ? { aylik_ucret: b.aylik_ucret != null ? +b.aylik_ucret : null } : {}),
        kanal_ozet: o.kanal_ozet || null, kanal_ozet_at: o.kanal_ozet_at ? ms(o.kanal_ozet_at) : null,
        son_insight: o.son_insight || null, son_insight_tarih: o.son_insight_tarih || null };
    }),
    bns_users: users.rows,
    bns_briefs, bns_completed, bns_deleted, bns_dept_stats, bns_events, bns_history,
    bns_ratings, bns_sebep, bns_sebep_history, bns_marka_fatura, bns_is_tipleri,
    source: 'postgres', generated_at: new Date().toISOString(),
  };
}

// Geçmiş (aktivite log) — sayfalı. Varsayılan: son 30 gün (archive=false). archive=true → daha eski (arşiv).
// before: ts (ms) imleci → bu andan ESKİ olaylar (sayfalama). limit: maks 100.
async function getEvents({ before, limit, archive, from, to } = {}) {
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
  const params = [];
  const conds = [`e.verb NOT LIKE 'slack:%'`];
  const hasFrom = from != null && from !== '' && Number.isFinite(Number(from));
  const hasTo   = to   != null && to   !== '' && Number.isFinite(Number(to));
  if (hasFrom) { params.push(new Date(Number(from))); conds.push(`e.ts >= $${params.length}`); }
  if (hasTo)   { params.push(new Date(Number(to)));   conds.push(`e.ts <= $${params.length}`); }
  // Tarih aralığı verilmemişse 1 ay penceresi (arşiv hariç). from/to verilirse onlar yönetir.
  if (!archive && !hasFrom && !hasTo) conds.push(`e.ts >= now() - interval '30 days'`);
  const beforeMs = Number(before);
  if (Number.isFinite(beforeMs) && beforeMs > 0) { params.push(new Date(beforeMs)); conds.push(`e.ts < $${params.length}`); }
  params.push(lim + 1);   // hasMore tespiti için 1 fazla çek
  const sql = `
    SELECT e.ts, e.user_id, e.verb, e.detail, b.no, b.baslik, br.name AS marka
    FROM events e
    LEFT JOIN briefs b ON b.id = e.brief_id
    LEFT JOIN brands br ON br.id = b.marka_id
    WHERE ${conds.join(' AND ')}
    ORDER BY e.ts DESC
    LIMIT $${params.length}`;
  const r = await pool.query(sql, params);
  const toMs = (d) => (d ? new Date(d).getTime() : null);
  let rows = r.rows.map(e => ({ t: toMs(e.ts), who: e.user_id, verb: e.verb, detail: e.detail, no: e.no, baslik: e.baslik, marka: e.marka }));
  const hasMore = rows.length > lim;
  if (hasMore) rows = rows.slice(0, lim);
  return { events: rows, hasMore, oldestTs: rows.length ? rows[rows.length - 1].t : null, archive: !!archive };
}

module.exports = { getState, getEmbedded, allBriefsWithAssignees, getEvents };
