'use strict';

/**
 * mail.js — Resend üzerinden e-posta gönderimi (bildirim reformu 2026-09-30).
 * - RESEND_API_KEY env yoksa sessizce atlar (best-effort; rapor akışını bozmaz).
 * - Gönderen: BNS_MAIL_FROM (varsayılan rapor@benseno.com.tr — Resend'de domain doğrulaması gerekir).
 */

const FROM = process.env.BNS_MAIL_FROM || 'Benseno Sistem <rapor@benseno.com.tr>';

function hasKey() { return !!process.env.RESEND_API_KEY; }

async function mailGonder({ to, subject, html }) {
  if (!hasKey()) return { ok: false, skipped: true, error: 'RESEND_API_KEY yok' };
  if (!to || !subject || !html) return { ok: false, error: 'eksik alan' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.message || `http_${r.status}` };
}

// Ortak rapor şablonu — bölümler: [{ baslik, satirlar: [string|{t,alt}] }]
function raporHtml({ baslik, tarih, bolumler, dip }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bolumHtml = (bolumler || []).map(b => `
    <h2 style="font:600 15px/1.4 -apple-system,Segoe UI,sans-serif;color:#24479E;margin:22px 0 8px;border-bottom:1px solid #e5e9f2;padding-bottom:6px">${esc(b.baslik)}</h2>
    ${b.satirlar && b.satirlar.length
      ? `<ul style="margin:0;padding-left:18px">${b.satirlar.map(s => {
          const t = typeof s === 'string' ? s : s.t;
          const alt = typeof s === 'object' && s.alt ? `<div style="color:#8a90a2;font-size:12px;margin-top:1px">${esc(s.alt)}</div>` : '';
          return `<li style="font:400 13.5px/1.55 -apple-system,Segoe UI,sans-serif;color:#2b2f3a;margin:5px 0">${esc(t)}${alt}</li>`;
        }).join('')}</ul>`
      : `<p style="font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#8a90a2;margin:4px 0">— kayıt yok —</p>`}`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;padding:24px 12px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 30px;border:1px solid #e5e9f2">
    <div style="font:700 18px/1.3 -apple-system,Segoe UI,sans-serif;color:#1a1e2b">${esc(baslik)}</div>
    <div style="font:400 12.5px/1.4 -apple-system,Segoe UI,sans-serif;color:#8a90a2;margin-top:3px">${esc(tarih)}</div>
    ${bolumHtml}
    <div style="font:400 11.5px/1.5 -apple-system,Segoe UI,sans-serif;color:#b0b5c4;margin-top:26px;border-top:1px solid #eef1f7;padding-top:10px">
      ${esc(dip || 'Bu rapor Benseno Tasarım Sistemi tarafından otomatik gönderildi.')}</div>
  </div></body></html>`;
}

module.exports = { mailGonder, raporHtml, hasKey };
