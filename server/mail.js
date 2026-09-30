'use strict';

/**
 * mail.js — Rapor e-postaları (bildirim reformu 2026-09-30).
 * Yöntem (Görkem kararı, 30 Eyl): DNS'e dokunmamak için Google Workspace SMTP
 * (Gmail + uygulama şifresi). Resend desteği alternatif olarak duruyor.
 *
 * Env (bot servisi):
 *   GMAIL_USER          — gönderen hesap (ör. gorkem@benseno.com.tr)
 *   GMAIL_APP_PASSWORD  — Google "uygulama şifresi" (16 hane; 2 Adımlı Doğrulama şart)
 *   BNS_MAIL_FROM       — görünen ad+adres (vars: "Benseno Sistem <GMAIL_USER>")
 *   RESEND_API_KEY      — (alternatif) set edilirse ve Gmail yoksa Resend kullanılır
 *
 * Best-effort: anahtar yoksa sessizce atlar, rapor akışını bozmaz.
 * Limit notu: Workspace SMTP ~2.000 mail/gün — mevcut hacmin çok üzerinde.
 */

function gmailVar() { return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }
function resendVar() { return !!process.env.RESEND_API_KEY; }
function hasKey() { return gmailVar() || resendVar(); }

const FROM = () => process.env.BNS_MAIL_FROM ||
  (process.env.GMAIL_USER ? `Benseno Sistem <${process.env.GMAIL_USER}>` : 'Benseno Sistem <rapor@benseno.com.tr>');

let _transport = null;
function transport() {
  if (_transport) return _transport;
  const nodemailer = require('nodemailer');   // lazy: yalnız gönderim anında yüklenir
  _transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return _transport;
}

async function mailGonder({ to, subject, html }) {
  if (!to || !subject || !html) return { ok: false, error: 'eksik alan' };
  if (gmailVar()) {
    try {
      const info = await transport().sendMail({ from: FROM(), to, subject, html });
      return { ok: true, id: info.messageId };
    } catch (e) { return { ok: false, error: e.message }; }
  }
  if (resendVar()) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM(), to: [to], subject, html }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.message || `http_${r.status}` };
  }
  return { ok: false, skipped: true, error: 'GMAIL_USER/GMAIL_APP_PASSWORD (veya RESEND_API_KEY) yok' };
}

// Ortak rapor şablonu — bölümler: [{ baslik, satirlar: [string|{t,alt}] }]
function raporHtml({ baslik, tarih, bolumler, dip }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bolumHtml = (bolumler || []).map(b => `
    <h2 style="font:600 15px/1.4 -apple-system,Segoe UI,sans-serif;color:#24479E;margin:22px 0 8px;border-bottom:1px solid #e5e9f2;padding-bottom:6px">${esc(b.baslik)}</h2>
    ${b.metin
      ? String(b.metin).split(/\n{2,}/).map(p =>
          `<p style="font:400 14px/1.65 -apple-system,Segoe UI,sans-serif;color:#2b2f3a;margin:0 0 12px">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')
      : ''}
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
