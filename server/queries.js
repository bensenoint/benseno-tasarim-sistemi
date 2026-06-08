'use strict';

/** DB → dashboard için hazır JSON (SQL ile; LLM toplama yok). */
const { pool } = require('./db');

// Tüm brief'ler + atananları (json_agg ile tek sorgu) → hidratlanmış shape
async function allBriefsWithAssignees() {
  const r = await pool.query(`
    SELECT b.id, b.no, b.slack_ts, b.slack_channel, b.slack_url,
           br.name AS marka, br.color AS marka_color,
           b.baslik, b.dept, b.deadline, b.saat, b.durum, b.priority, b.priority_label,
           b.rev, b.maliyet, b.satis, b.fatura, b.odeme, b.musteri_notu, b.tahmini_sure_h,
           b.akis, b.stale, b.created_at, b.completed_at, b.updated_at, b.deleted_at, b.deleted_by,
           COALESCE(json_agg(
             json_build_object('id',u.id,'name',u.name,'role',a.role,'dept',u.dept,'initials',u.initials,'color',u.color)
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

async function getState() {
  const [users, brands, all, dept, brand, events] = await Promise.all([
    pool.query(`SELECT id,name,rol,dept,yetki,initials,color,title,active FROM users WHERE active ORDER BY rol,name`),
    pool.query(`SELECT id,name,color,wheel_idx,slack_channel FROM brands ORDER BY name`),
    allBriefsWithAssignees(),
    // departman yükü (aktif + gecikmiş), kişi sayısı
    pool.query(`
      SELECT u.dept,
        count(DISTINCT u.id)::int people,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL)::int active,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.deadline < now())::int overdue,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int completed30
      FROM users u
      LEFT JOIN brief_assignees a ON a.user_id = u.id
      LEFT JOIN briefs b ON b.id = a.brief_id
      WHERE u.dept IS NOT NULL GROUP BY u.dept`),
    // marka istatistik
    pool.query(`
      SELECT br.name, br.color,
        count(b.id) FILTER (WHERE b.completed_at IS NULL)::int active,
        count(b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int done30,
        count(b.id) FILTER (WHERE b.completed_at IS NULL AND b.deadline < now())::int overdue,
        round(avg(b.rev) FILTER (WHERE b.completed_at IS NOT NULL), 1) avg_rev
      FROM brands br LEFT JOIN briefs b ON b.marka_id = br.id
      GROUP BY br.name, br.color ORDER BY active DESC, br.name`),
    pool.query(`SELECT e.id, e.brief_id, e.user_id, u.name AS user_name, e.verb, e.detail, e.source, e.ts
                FROM events e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.ts DESC LIMIT 200`),
  ]);

  const deptStats = {};
  for (const r of dept.rows) deptStats[r.dept] = r;
  return {
    users: users.rows,
    brands: brands.rows,
    briefs: all.filter(b => !b.completed_at && !b.deleted_at),
    completed: all.filter(b => b.completed_at && !b.deleted_at),
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
async function getEmbedded() {
  const [all, brands, users, dept] = await Promise.all([
    allBriefsWithAssignees(),
    pool.query(`SELECT name, color, wheel_idx FROM brands ORDER BY name`),
    pool.query(`SELECT id,name,rol,dept,yetki,initials,color FROM users WHERE active ORDER BY rol,name`),
    pool.query(`
      SELECT u.dept,
        count(DISTINCT u.id)::int people,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL)::int active,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.deadline < now())::int overdue,
        count(DISTINCT b.id) FILTER (WHERE b.completed_at >= now() - interval '30 days')::int completed30
      FROM users u
      LEFT JOIN brief_assignees a ON a.user_id = u.id
      LEFT JOIN briefs b ON b.id = a.brief_id
      WHERE u.dept IS NOT NULL GROUP BY u.dept`),
  ]);
  const ms = (d) => (d ? new Date(d).getTime() : 0);

  // Ekler: brief_id → [{name, permalink}]
  const att = await pool.query(`SELECT brief_id, filename AS name, url AS permalink FROM brief_attachments ORDER BY id`);
  const attByBrief = {};
  for (const a of att.rows) (attByBrief[a.brief_id] ||= []).push({ name: a.name, permalink: a.permalink });

  // Marka → renk (silinenler ekranı marka_color bekliyor)
  const brandColor = {};
  for (const br of brands.rows) brandColor[br.name] = br.color;

  const bns_briefs = all.filter(b => !b.completed_at && !b.deleted_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik, dept: b.dept || '',
    workers:   b.workers.map(w => ({ id: w.id, name: w.name, dept: w.dept || '' })),
    leads:     b.leads.map(l => ({ id: l.id, name: l.name })),
    observers: b.observers.map(o => ({ id: o.id, name: o.name })),
    notes: b.musteri_notu || '',
    deadline: ms(b.deadline), durum: b.durum, rev: b.rev || 0,
    maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme,
    slack_url: b.slack_url || '#',
    attachments: attByBrief[b.id] || [],
  }));

  const bns_completed = all.filter(b => b.completed_at && !b.deleted_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik,
    leads:   b.leads.map(l => ({ id: l.id, name: l.name })),
    workers: b.workers.map(w => ({ id: w.id, name: w.name })),
    deadline: ms(b.deadline), bitis: ms(b.completed_at), rev: b.rev || 0,
    maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme,
    slack_url: b.slack_url || '#',
    attachments: attByBrief[b.id] || [],
  }));

  const bns_deleted = all.filter(b => b.deleted_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, marka_color: brandColor[b.marka] || null,
    baslik: b.baslik, durum: b.durum,
    deleted_at: b.deleted_at, deleted_by: b.deleted_by,
  }));

  const bns_dept_stats = {};
  for (const r of dept.rows) bns_dept_stats[r.dept] = r;

  return {
    now: new Date().toISOString(),
    bns_brands: brands.rows.map(b => ({ name: b.name, color: b.color, wheelIdx: b.wheel_idx })),
    bns_users: users.rows,
    bns_briefs, bns_completed, bns_deleted, bns_dept_stats,
    source: 'postgres', generated_at: new Date().toISOString(),
  };
}

module.exports = { getState, getEmbedded, allBriefsWithAssignees };
