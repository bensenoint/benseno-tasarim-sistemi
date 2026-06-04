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
           b.akis, b.stale, b.created_at, b.completed_at, b.updated_at,
           COALESCE(json_agg(
             json_build_object('id',u.id,'name',u.name,'role',a.role,'initials',u.initials,'color',u.color)
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
    const lead = as.find(x => x.role === 'lead') || null;
    return {
      ...row,
      lead,
      contributors: as.filter(x => x.role === 'contributor'),
      editors: as.filter(x => x.role === 'editor'),
      gozlemciler: as.filter(x => x.role === 'gozlemci'),
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
    briefs: all.filter(b => !b.completed_at),
    completed: all.filter(b => b.completed_at),
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

  const bns_briefs = all.filter(b => !b.completed_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik, dept: b.dept || '',
    atanan_ids: [b.lead && b.lead.id, ...b.contributors.map(c => c.id)].filter(Boolean),
    editor_ids: b.editors.map(e => e.id),
    deadline: ms(b.deadline), durum: b.durum, rev: b.rev || 0,
    maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme,
    slack_url: b.slack_url || (b.slack_ts ? '#' : '#'),
  }));

  const bns_completed = all.filter(b => b.completed_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik,
    leadId: b.lead && b.lead.id, contribIds: b.contributors.map(c => c.id),
    deadline: ms(b.deadline), bitis: ms(b.completed_at), rev: b.rev || 0,
    maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme,
    slack_url: b.slack_url || '#',
  }));

  const bns_dept_stats = {};
  for (const r of dept.rows) bns_dept_stats[r.dept] = r;

  return {
    now: new Date().toISOString(),
    bns_brands: brands.rows.map(b => ({ name: b.name, color: b.color, wheelIdx: b.wheel_idx })),
    bns_users: users.rows,
    bns_briefs, bns_completed, bns_dept_stats,
    source: 'postgres', generated_at: new Date().toISOString(),
  };
}

module.exports = { getState, getEmbedded, allBriefsWithAssignees };
