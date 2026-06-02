'use strict';

/**
 * Benseno Reaction Override — DETERMİNİSTİK (LLM değil).
 *
 * Yönetici brief mesajına 🔴/🟠/🟡/🟢 koyduğunda önceliği günceller. Railway headless'ta
 * MCP yok + data-agent reactions.get curl'ü tanımlı değil → eski yol (benseno-reaction-override
 * skill + data-agent 3g) production'da hiç çalışmıyordu. Bu script onun yerini alır.
 *
 * İki mod:
 *   node reaction-override.js <brief_ts> <emoji> <yonetici_id> [saat]
 *        → INSTANT: slack-bot reaction_added handler'ından çağrılır. live-data priority'yi
 *          anında günceller, EMBEDDED_DATA'yı index.html'e enjekte eder (anlık dashboard),
 *          data/priority-overrides.json'a yazar (kalıcı), git push.
 *   node reaction-override.js --reapply
 *        → her orchestrator döngüsünde çağrılır. Persisted override'ları TAZE live-data'ya
 *          yeniden uygular (data-agent auto-priority'si geri almasın). Değişiklik yoksa no-op.
 *
 * Kalıcılık: priority-overrides.json { "<ts>": {emoji, by, at} }. Override > auto-priority.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const LIVE_ROOT = path.join(PROJ, 'app/live-data.json');     // public kopya (varsa)
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const OVERRIDES = path.join(PROJ, 'data/priority-overrides.json');
const LOG = path.join(PROJ, 'logs/reaction-override.log');

const LABELS = { '🔴': '🔴 Acil', '🟠': '🟠 Yüksek', '🟡': '🟡 Normal', '🟢': '🟢 Düşük' };

function logLine(msg) {
  try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  console.log('[reaction-override]', msg);
}

function tsFromLink(link) {
  const m = (link || '').match(/\/p(\d{16})/);
  return m ? m[1].slice(0, 10) + '.' + m[1].slice(10) : null;
}

function loadOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')); } catch { return {}; }
}

// live-data'ya override'ları uygula (priority + label). gecmis'e DOKUNMA (her döngüde şişmesin).
// Sadece priority farklıysa değiştir (idempotent). Değişen brief sayısını döndürür.
function applyOverrides(live, ov) {
  let changed = 0;
  for (const b of (live.bns_briefs || [])) {
    const ts = tsFromLink(b.link);
    if (!ts || !ov[ts]) continue;
    const emoji = ov[ts].emoji;
    if (!LABELS[emoji]) continue;
    if (b.priority !== emoji) {
      b.priority = emoji;
      b.priority_label = LABELS[emoji];
      changed++;
    }
  }
  return changed;
}

// EMBEDDED_DATA bloğunu index.html'lere enjekte et (anlık dashboard). dashboard-agent ile
// birebir aynı blok formatı → sonraki regex replace'i bozmaz.
function injectEmbedded(live) {
  const body = 'window.EMBEDDED_DATA = ' + JSON.stringify(live, null, 2) + ';';
  const re = /window\.EMBEDDED_DATA = \{[\s\S]*?\n\};/;
  for (const f of IDX) {
    let html;
    try { html = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!re.test(html)) { logLine(`⚠️ EMBEDDED_DATA bloğu yok: ${path.basename(f)}`); continue; }
    fs.writeFileSync(f, html.replace(re, () => body)); // fn replacer → $ kaçışı sorunu yok
  }
}

function writeLive(live) {
  fs.writeFileSync(LIVE, JSON.stringify(live, null, 2));
  try { if (fs.existsSync(LIVE_ROOT)) fs.writeFileSync(LIVE_ROOT, JSON.stringify(live, null, 2)); } catch {}
}

// değişen dosyaları push et — rebase-retry, shell yok (escalation.js ile aynı desen)
function pushFiles(files, msg) {
  if (process.env.RO_NO_PUSH === '1') { logLine('RO_NO_PUSH=1 → push atlandı (test)'); return; }
  const git = (...a) => execFileSync('git', a, { cwd: PROJ, stdio: 'pipe' });
  try {
    git('add', ...files);
    try { git('diff', '--cached', '--quiet'); return; } catch { /* staged değişiklik var */ }
    git('commit', '-m', msg);
    for (let i = 0; i < 3; i++) {
      try { git('pull', '--rebase', '-X', 'theirs', 'origin', 'main'); git('push', 'origin', 'main'); logLine('✓ push edildi'); return; }
      catch { try { git('rebase', '--abort'); } catch {} logLine(`push denemesi ${i + 1} başarısız, tekrar...`); }
    }
    logLine('⚠️ push edilemedi (lokal kaldı)');
  } catch (e) { logLine(`⚠️ pushFiles hata: ${e.message}`); }
}

const COMMIT_FILES = ['dashboard/app/live-data.json', 'dashboard/index.html', 'index.html', 'app/live-data.json', 'data/priority-overrides.json'];

function main() {
  const argv = process.argv.slice(2);

  // ── REAPPLY MODU (her döngü) ──────────────────────────────────────────────
  if (argv[0] === '--reapply') {
    const ov = loadOverrides();
    if (!Object.keys(ov).length) { logLine('reapply: override yok, no-op'); return; }
    let live;
    try { live = JSON.parse(fs.readFileSync(LIVE, 'utf8')); } catch { logLine('reapply: live-data okunamadı'); return; }
    const n = applyOverrides(live, ov);
    if (n === 0) { logLine(`reapply: ${Object.keys(ov).length} override zaten uygulanmış, değişiklik yok`); return; }
    writeLive(live); injectEmbedded(live);
    pushFiles(COMMIT_FILES, `reaction-override: ${n} override yeniden uygulandı (auto-priority geri alımı önlendi)`);
    logLine(`reapply: ${n} brief önceliği override'a geri zorlandı`);
    return;
  }

  // ── INSTANT MODU (event) ──────────────────────────────────────────────────
  const [ts, emoji, mgr, saatArg] = argv;
  if (!ts || !emoji || !mgr) { logLine('kullanım: reaction-override.js <ts> <emoji> <yonetici> [saat]'); process.exit(1); }
  if (!LABELS[emoji]) { logLine(`geçersiz emoji: ${emoji}`); process.exit(0); }

  let live;
  try { live = JSON.parse(fs.readFileSync(LIVE, 'utf8')); } catch { logLine('live-data okunamadı'); process.exit(0); }

  const brief = (live.bns_briefs || []).find(b => tsFromLink(b.link) === ts);
  if (!brief) { logLine(`UYARI: brief_ts=${ts} için eşleşme yok — işlem iptal (Canvas'a dokunulmadı)`); process.exit(0); }

  // override dosyasına kaydet (kalıcılık)
  const ov = loadOverrides();
  ov[ts] = { emoji, by: mgr, at: new Date().toISOString() };
  try { fs.mkdirSync(path.dirname(OVERRIDES), { recursive: true }); } catch {}
  fs.writeFileSync(OVERRIDES, JSON.stringify(ov, null, 1));

  const before = brief.priority;
  applyOverrides(live, ov);

  // gecmis'e override işareti ekle (yalnızca instant — bir kez)
  const saat = saatArg || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
  brief.gecmis = (brief.gecmis ? brief.gecmis + ' · ' : '') + `${emoji}Yön${saat}`;

  writeLive(live); injectEmbedded(live);
  pushFiles(COMMIT_FILES, `reaction-override: ${brief.marka}·${brief.is} → ${emoji} (yön ${mgr})`);
  logLine(`✓ ${brief.marka} · ${brief.is}: ${before || '?'} → ${emoji} (yönetici ${mgr} @ ${saat})`);
}

main();
