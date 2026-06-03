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

module.exports = { getState, allBriefsWithAssignees };
