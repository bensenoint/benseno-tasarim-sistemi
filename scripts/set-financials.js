'use strict';

/**
 * Benseno Maliyet/Satış — DETERMİNİSTİK (LLM değil).
 *
 * Brief bazında finansal veri (maliyet + satış) tutar. Slack'teki /maliyet modal'ı bu scripti
 * tetikler (anlık yazım). Kaynak-of-truth: data/brief-financials.json { "<no>": {maliyet,satis,by,ts} }.
 * Değerler hem bns_briefs (aktif) hem bns_completed (tamamlanan) içine `no` ile enjekte edilir,
 * EMBEDDED_DATA'ya basılır ve push edilir. Headless Railway'de Slack reaction okunamadığı için
 * (priority-overrides ile aynı mantık) data-agent yeniden kurarsa diye --reapply her döngüde geri uygular.
 *
 * Mod:
 *   node set-financials.js <no> <maliyet> <satis> <by>   → tek brief'i ayarla + push
 *   node set-financials.js --reapply                      → fin store'u taze live-data'ya geri uygula
 *
 * maliyet/satis: boş ("" veya "-") → null (alanı temizler). TR para formatı kabul ("1.500,50" → 1500.5).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const LIVE_ROOT = path.join(PROJ, 'app/live-data.json');
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const STORE = path.join(PROJ, 'data/brief-financials.json');
const LOG = path.join(PROJ, 'logs/set-financials.log');

function logLine(msg) { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {} console.log('[financials]', msg); }

// "1.500,50" / "1500" / "₺2.000" → number ; "" / "-" / null → null
function parseMoney(s) {
  if (s == null) return null;
  let t = String(s).trim();
  if (t === '' || t === '-' || t === '—') return null;
  t = t.replace(/[^\d.,-]/g, '');          // ₺, boşluk vb. at
  if (t === '' || t === '-') return null;
  // TR: '.' binlik, ',' ondalık varsayımı — ama tek ayraç '.' ise ondalık olabilir
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isNaN(n) ? null : n;
}

function loadStore() { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } }
function saveStore(s) { fs.writeFileSync(STORE, JSON.stringify(s, null, 2)); }

// fin store'u live-data'daki aktif + tamamlanan brief'lere `no` ile enjekte et. Değişiklik sayısı döner.
function applyToLive(live, fin) {
  let changed = 0;
  const lists = [live.bns_briefs || [], live.bns_completed || []];
  for (const list of lists) {
    for (const b of list) {
      const f = fin[String(b.no)];
      const m = f ? (f.maliyet ?? null) : null;
      const s = f ? (f.satis ?? null) : null;
      if (b.maliyet !== m) { b.maliyet = m; changed++; }
      if (b.satis !== s)   { b.satis = s; changed++; }
    }
  }
  return changed;
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
const COMMIT_FILES = ['dashboard/app/live-data.json', 'dashboard/index.html', 'index.html', 'app/live-data.json', 'data/brief-financials.json'];
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
  const args = process.argv.slice(2);
  const reapply = args.includes('--reapply');
  let live; try { live = JSON.parse(fs.readFileSync(LIVE, 'utf8')); } catch { logLine('live-data okunamadı'); return; }
  const fin = loadStore();

  if (!reapply) {
    // node set-financials.js <no> <maliyet> <satis> <by>
    const [no, maliyetRaw, satisRaw, by] = args;
    if (no == null) { logLine('kullanım: set-financials.js <no> <maliyet> <satis> <by>  |  --reapply'); process.exit(1); }
    const key = String(no).trim();
    const maliyet = parseMoney(maliyetRaw);
    const satis = parseMoney(satisRaw);
    // hem maliyet hem satış null → kaydı sil (temizle)
    if (maliyet == null && satis == null) { delete fin[key]; logLine(`#${key} finansal kayıt temizlendi (by ${by || '?'})`); }
    else { fin[key] = { maliyet, satis, by: by || null, ts: Math.floor(Date.now() / 1000) }; logLine(`#${key} → maliyet=${maliyet} satış=${satis} (by ${by || '?'})`); }
    saveStore(fin);
  }

  const changed = applyToLive(live, fin);
  if (changed === 0) { logLine(reapply ? '0 değişiklik (reapply, steady-state) — push yok' : 'live-data zaten güncel — push yok'); if (!reapply) push('financials: brief-financials.json güncellendi'); return; }
  fs.writeFileSync(LIVE, JSON.stringify(live, null, 2));
  try { if (fs.existsSync(LIVE_ROOT)) fs.writeFileSync(LIVE_ROOT, JSON.stringify(live, null, 2)); } catch {}
  injectEmbedded(live);
  push(reapply ? 'financials: reapply (taze live-data\'ya maliyet/satış geri uygulandı)' : 'financials: maliyet/satış güncellendi');
  logLine(`${changed} alan güncellendi (live-data + EMBEDDED)`);
}

main();
