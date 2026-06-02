'use strict';

/**
 * Benseno Brief Durum Geçişi — DETERMİNİSTİK (LLM değil).
 *
 * Tasarımcılar durumu brief mesajına reaction koyarak ilerletiyor:
 *   🎨 (art)  = tasarıma başladım  → "🎨 Tasarımda"   (👀'den sonra 🎨 = REVİZE başladı, sayaç++)
 *   👀 (eyes) = revize için sundum → "👀 Revizede"
 *   ✅        = tamamlandı          → complete-brief.js (ayrı)
 * Railway headless'ta MCP yok + data-agent reactions.get curl'ü tanımlı değil → bu geçişler
 * hiç okunmuyordu → durum donuk kalıyordu. Bu script onları slack-bot event'inden anlık işler.
 *
 * Mod:
 *   node brief-status.js <brief_ts> <art|eyes> <by_user> [saat]   → INSTANT
 *   node brief-status.js --reapply                                → her döngüde durum/rev'i zorla
 *
 * Kalıcılık: data/status-overrides.json { "<ts>": {state, rev, durum, by, at} }
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const LIVE_ROOT = path.join(PROJ, 'app/live-data.json');
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const STATE = path.join(PROJ, 'data/status-overrides.json');
const LOG = path.join(PROJ, 'logs/brief-status.log');
const MANAGERS = ['U030C48PL23', 'UD96GH76E', 'U4XCE3532', 'U055EDESLSE', 'U02SZQDAFPF'];

function logLine(msg) {
  try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  console.log('[brief-status]', msg);
}
function tsFromLink(link) { const m = (link || '').match(/\/p(\d{16})/); return m ? m[1].slice(0, 10) + '.' + m[1].slice(10) : null; }
function loadState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } }
function readLive() { return JSON.parse(fs.readFileSync(LIVE, 'utf8')); }
function writeLive(live) {
  fs.writeFileSync(LIVE, JSON.stringify(live, null, 2));
  try { if (fs.existsSync(LIVE_ROOT)) fs.writeFileSync(LIVE_ROOT, JSON.stringify(live, null, 2)); } catch {}
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
const COMMIT_FILES = ['dashboard/app/live-data.json', 'dashboard/index.html', 'index.html', 'app/live-data.json', 'data/status-overrides.json'];
function pushFiles(msg) {
  if (process.env.RO_NO_PUSH === '1') { logLine('RO_NO_PUSH=1 → push atlandı (test)'); return; }
  const git = (...a) => execFileSync('git', a, { cwd: PROJ, stdio: 'pipe' });
  try {
    git('add', ...COMMIT_FILES);
    try { git('diff', '--cached', '--quiet'); return; } catch {}
    git('commit', '-m', msg);
    for (let i = 0; i < 3; i++) {
      try { git('pull', '--rebase', '-X', 'theirs', 'origin', 'main'); git('push', 'origin', 'main'); logLine('✓ push edildi'); return; }
      catch { try { git('rebase', '--abort'); } catch {} logLine(`push denemesi ${i + 1} başarısız, tekrar...`); }
    }
    logLine('⚠️ push edilemedi (lokal kaldı)');
  } catch (e) { logLine(`⚠️ pushFiles hata: ${e.message}`); }
}

// Departmana özel "çalışıyor/başladı" reaction'ları → durum state'i
const WORK = { art: '🎨 Tasarımda', writing_hand: '✍️ Editörde', robot_face: "🤖 AI'da" };

// state='review' → 👀, aksi halde workLabel (🎨/✍️/🤖). rev>0 ise "· rev N" ekle.
function durumEtiketi(state, rev, workLabel) {
  const base = state === 'review' ? '👀 Revizede' : (workLabel || '🎨 Tasarımda');
  return rev > 0 ? `${base} · rev ${rev}` : base;
}

// brief'e durum/rev uygula
function applyStatus(brief, st) {
  brief.durum = st.durum;
  brief.rev = st.rev;
}

function main() {
  const argv = process.argv.slice(2);

  // ── REAPPLY ───────────────────────────────────────────────────────────────
  if (argv[0] === '--reapply') {
    const state = loadState();
    const tsList = Object.keys(state);
    if (!tsList.length) { logLine('reapply: durum override yok, no-op'); return; }
    let live; try { live = readLive(); } catch { logLine('reapply: live-data okunamadı'); return; }
    let n = 0;
    for (const b of (live.bns_briefs || [])) {
      const ts = tsFromLink(b.link);
      if (!ts || !state[ts]) continue;
      const st = state[ts];
      if (b.durum !== st.durum || b.rev !== st.rev) { applyStatus(b, st); n++; }
    }
    if (n === 0) { logLine(`reapply: ${tsList.length} durum override zaten uygulanmış, değişiklik yok`); return; }
    writeLive(live); injectEmbedded(live);
    pushFiles(`brief-status: ${n} brief durumu override'a geri zorlandı`);
    logLine(`reapply: ${n} brief durumu yeniden uygulandı`);
    return;
  }

  // ── INSTANT (🎨/✍️/🤖/👀 event) ─────────────────────────────────────────────
  let [ts, emoji, byUser, saat] = argv;
  if (!ts || !emoji || !byUser) { logLine('kullanım: brief-status.js <ts> <art|writing_hand|robot_face|eyes> <by_user> [saat]'); process.exit(1); }
  emoji = emoji.replace(/::skin-tone-\d+$/, ''); // ✍️ skin-tone varyantlarını normalize et
  if (!WORK[emoji] && emoji !== 'eyes') { logLine(`geçersiz emoji: ${emoji}`); process.exit(0); }

  let live; try { live = readLive(); } catch { logLine('live-data okunamadı'); process.exit(0); }
  const brief = (live.bns_briefs || []).find(b => tsFromLink(b.link) === ts);
  if (!brief) { logLine(`ts=${ts} aktif brief değil (tamamlanmış olabilir) → no-op`); process.exit(0); }

  // Yetki: atanan + editör + yönetici
  const allowed = new Set([...(brief.atanan_ids || []), ...(brief.editor_ids || []), ...MANAGERS]);
  if (!allowed.has(byUser)) { logLine(`yetkisiz reaction: ${byUser} brief #${brief.no}'e atanmamış → yoksayıldı`); process.exit(0); }

  const state = loadState();
  const prev = state[ts] || { state: 'new', rev: 0 };
  let newState, rev = prev.rev || 0, workLabel = prev.workLabel || '🎨 Tasarımda';

  if (WORK[emoji]) {
    if (prev.state === 'review') rev = rev + 1;  // 👀 → çalışma = REVİZE başladı (sayaç++)
    newState = 'work';
    workLabel = WORK[emoji];
  } else { // eyes
    newState = 'review';
  }

  const durum = durumEtiketi(newState, rev, workLabel);
  state[ts] = { state: newState, workLabel, rev, durum, by: byUser, at: new Date().toISOString(), no: brief.no, marka: brief.marka };
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); } catch {}
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));

  applyStatus(brief, state[ts]);
  writeLive(live); injectEmbedded(live);
  pushFiles(`brief-status: ${brief.marka}·${brief.is} → ${durum} (${byUser})`);
  logLine(`✓ #${brief.no} ${brief.marka} · ${brief.is}: ${prev.durum || prev.state} → ${durum} (${byUser} @ ${saat || ''})`);
}

main();
