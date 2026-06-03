'use strict';

/**
 * Benseno Deterministik Recalc — boş orchestrator döngülerinde claude yerine.
 *
 * Yeni brief yokken (brief-queue boş) orchestrator claude'u atlar; bunun yerine bu script
 * deadline-bazlı auto-priority'yi (data-agent 3f eşikleri) deterministik günceller. Böylece
 * zaman geçtikçe öncelikler/geçişler LLM'siz güncel kalır. Manager/atanan reaction override'ları
 * (priority-overrides.json) KORUNUR (auto-priority onları ezmez). Değişiklik varsa push eder.
 *
 * 3f eşikleri (delta_h = (deadline - now)/3600):
 *   ≤8 → 🔴 Acil · 8<Δ≤24 → 🟠 Yüksek · 24<Δ≤72 → 🟡 Normal · >72 → 🟢 Düşük
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const LIVE_ROOT = path.join(PROJ, 'app/live-data.json');
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const PRIO_OVERRIDES = path.join(PROJ, 'data/priority-overrides.json');
const LOG = path.join(PROJ, 'logs/recalc.log');

const MONTHS = {
  ocak:1, şubat:2, subat:2, mart:3, nisan:4, mayıs:5, mayis:5, may:5,
  haziran:6, haz:6, temmuz:7, tem:7, ağustos:8, agustos:8, ağu:8,
  eylül:9, eylul:9, eyl:9, ekim:10, eki:10, kasım:11, kasim:11, kas:11, aralık:12, aralik:12, ara:12,
};

function logLine(msg) { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {} console.log('[recalc]', msg); }
function tsFromLink(link) { const m = (link || '').match(/\/p(\d{16})/); return m ? m[1].slice(0, 10) + '.' + m[1].slice(10) : null; }

// deadline "18 May 2026" + saat "16:00 TR" → unix saniye (TR=UTC+3), yoksa null
function deadlineUnix(deadline, saat) {
  const dm = (deadline || '').trim().match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!dm) return null;
  const day = +dm[1], mon = MONTHS[dm[2].toLowerCase()], year = +dm[3];
  if (!mon) return null;
  const sm = (saat || '').match(/(\d{1,2}):(\d{2})/);
  const hh = sm ? +sm[1] : 23, mm = sm ? +sm[2] : 59;
  return Math.floor(Date.UTC(year, mon - 1, day, hh - 3, mm) / 1000);
}

// 3f auto-priority → {emoji, label}
function autoPriority(deltaH) {
  if (deltaH <= 8)  return { e: '🔴', l: '🔴 Acil' };
  if (deltaH <= 24) return { e: '🟠', l: '🟠 Yüksek' };
  if (deltaH <= 72) return { e: '🟡', l: '🟡 Normal' };
  return { e: '🟢', l: '🟢 Düşük' };
}

function injectEmbedded(live) {
  const body = 'window.EMBEDDED_DATA = ' + JSON.stringify(live, null, 2) + ';';
  const re = /window\.EMBEDDED_DATA = \{[\s\S]*?\n\};/;
  for (const f of IDX) {
    let html; try { html = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!re.test(html)) { logLine(`⚠️ EMBEDDED_DATA bloğu yok: ${path.basename(f)}`); continue; }
    fs.writeFileSync(f, html.replace(re, () => body));
  }
}

const GIT_LOCK = '/tmp/benseno-git.lock';
function withGitLock(fn) {
  for (let i = 0; i < 60; i++) {
    try { fs.mkdirSync(GIT_LOCK); try { return fn(); } finally { try { fs.rmdirSync(GIT_LOCK); } catch {} } }
    catch { try { if (Date.now() - fs.statSync(GIT_LOCK).mtimeMs > 60000) { fs.rmdirSync(GIT_LOCK); continue; } } catch {} try { execFileSync('sleep', ['0.1']); } catch {} }
  }
  return fn();
}
const COMMIT_FILES = ['dashboard/app/live-data.json', 'dashboard/index.html', 'index.html', 'app/live-data.json'];
function push(msg) {
  if (process.env.RO_NO_PUSH === '1') { logLine('RO_NO_PUSH=1 → push atlandı (test)'); return; }
  const git = (...a) => execFileSync('git', a, { cwd: PROJ, stdio: 'pipe' });
  withGitLock(() => {
    try {
      git('add', ...COMMIT_FILES);
      try { git('diff', '--cached', '--quiet'); return; } catch {}
      git('commit', '-m', msg);
      for (let i = 0; i < 5; i++) {
        try { git('pull', '--rebase', '-X', 'theirs', 'origin', 'main'); git('push', 'origin', 'main'); logLine('✓ push edildi'); return; }
        catch { try { git('rebase', '--abort'); } catch {} logLine(`push denemesi ${i + 1} başarısız, tekrar...`); }
      }
      logLine('⚠️ push edilemedi (lokal kaldı)');
    } catch (e) { logLine(`⚠️ push hata: ${e.message}`); }
  });
}

function main() {
  let live; try { live = JSON.parse(fs.readFileSync(LIVE, 'utf8')); } catch { logLine('live-data okunamadı'); return; }
  let ov = {}; try { ov = JSON.parse(fs.readFileSync(PRIO_OVERRIDES, 'utf8')); } catch {}
  const now = Math.floor(Date.now() / 1000);
  let changed = 0;
  for (const b of (live.bns_briefs || [])) {
    // Tamamlanmış brief bns_completed'e taşınır; bns_briefs hepsi AKTİF. durum metninde
    // "tamamlandı" geçmesi (ör. "copy edit tamamlandı") brief'i bitmiş yapmaz — sadece durum
    // BAŞINDA ✅/Tamamlandı varsa atla (substring değil).
    if (/^(✅|tamamland)/i.test((b.durum || '').trim())) continue;
    const ts = tsFromLink(b.link);
    if (ts && ov[ts]) continue;                                            // manager/atanan override KORUNUR
    const dl = deadlineUnix(b.deadline, b.saat);
    if (dl == null) continue;                                              // deadline parse edilemiyor
    const deltaH = (dl - now) / 3600;
    const ap = autoPriority(deltaH);
    if (b.priority !== ap.e || b.priority_label !== ap.l) {
      b.priority = ap.e; b.priority_label = ap.l; changed++;
    }
  }
  if (changed === 0) { logLine('0 öncelik değişikliği (steady-state) — push yok'); return; }
  fs.writeFileSync(LIVE, JSON.stringify(live, null, 2));
  try { if (fs.existsSync(LIVE_ROOT)) fs.writeFileSync(LIVE_ROOT, JSON.stringify(live, null, 2)); } catch {}
  injectEmbedded(live);
  push(`recalc: ${changed} brief auto-priority güncellendi (deterministik, boş döngü)`);
  logLine(`${changed} brief önceliği güncellendi`);
}

main();
