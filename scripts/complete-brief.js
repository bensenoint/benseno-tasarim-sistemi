'use strict';

/**
 * Benseno Brief Tamamlama — DETERMİNİSTİK (LLM değil).
 *
 * Ekip tamamlamayı brief mesajına ✅ reaction koyarak yapıyor. Railway headless'ta MCP yok +
 * data-agent reactions.get curl'ü tanımlı değil → ✅ hiç okunmuyordu → brief tamamlanmıyor,
 * aktif kalıyor ve SÜREKLİ gecikme escalation DM'i atıyordu (gerçek kişilere spam).
 *
 * İki mod:
 *   node complete-brief.js <brief_ts> <by_user> [saat]
 *        → INSTANT: slack-bot ✅ reaction → brief'i bns_briefs'ten bns_completed'e taşı,
 *          EMBEDDED_DATA inject, data/completion-overrides.json'a yaz (kalıcı), push.
 *   node complete-brief.js --reapply
 *        → her orchestrator döngüsünde: data-agent Canvas'ı okuyup tamamlanmış brief'i
 *          aktif olarak geri getirdiyse (headless'ta ✅ okuyamadığı için), bu script onu
 *          tekrar completed'e taşır. Yetki: atanan/editör/yönetici.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const LIVE_ROOT = path.join(PROJ, 'app/live-data.json');
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const STATE = path.join(PROJ, 'data/completion-overrides.json');
const LOG = path.join(PROJ, 'logs/complete-brief.log');
const MANAGERS = ['U030C48PL23', 'UD96GH76E', 'U4XCE3532', 'U055EDESLSE', 'U02SZQDAFPF'];
const MAX_COMPLETED = 20;

const MONTHS = {
  ocak:1, şubat:2, subat:2, mart:3, nisan:4, mayıs:5, mayis:5, may:5,
  haziran:6, haz:6, temmuz:7, tem:7, ağustos:8, agustos:8, ağu:8,
  eylül:9, eylul:9, eyl:9, ekim:10, eki:10, kasım:11, kasim:11, kas:11, aralık:12, aralik:12, ara:12,
};

function logLine(msg) {
  try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  console.log('[complete-brief]', msg);
}

function tsFromLink(link) {
  const m = (link || '').match(/\/p(\d{16})/);
  return m ? m[1].slice(0, 10) + '.' + m[1].slice(10) : null;
}

// deadline "18 May 2026" + saat "16:00 TR" → unix MS (TR UTC+3), yoksa null
function deadlineMs(deadline, saat) {
  const dm = (deadline || '').trim().match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!dm) return null;
  const day = +dm[1], mon = MONTHS[dm[2].toLowerCase()], year = +dm[3];
  if (!mon) return null;
  const sm = (saat || '').match(/(\d{1,2}):(\d{2})/);
  const hh = sm ? +sm[1] : 23, mm = sm ? +sm[2] : 59;
  return Date.UTC(year, mon - 1, day, hh - 3, mm);
}

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

const COMMIT_FILES = ['dashboard/app/live-data.json', 'dashboard/index.html', 'index.html', 'app/live-data.json', 'data/completion-overrides.json'];
// Eşzamanlı reaction script'leri git push'ta yarışmasın diye paylaşımlı kilit (tüm scriptler aynı dosya)
const GIT_LOCK = '/tmp/benseno-git.lock';
function withGitLock(fn) {
  for (let i = 0; i < 60; i++) {
    try { fs.mkdirSync(GIT_LOCK); try { return fn(); } finally { try { fs.rmdirSync(GIT_LOCK); } catch {} } }
    catch {
      try { if (Date.now() - fs.statSync(GIT_LOCK).mtimeMs > 60000) { fs.rmdirSync(GIT_LOCK); continue; } } catch {}
      try { execFileSync('sleep', ['0.1']); } catch {}
    }
  }
  return fn();
}
function pushFiles(msg) {
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
      logLine('⚠️ push edilemedi (lokal kaldı — sonraki döngü toparlar)');
    } catch (e) { logLine(`⚠️ pushFiles hata: ${e.message}`); }
  });
}

function buildCompletedRecord(b, byUser, nowMs) {
  const atanan = b.atanan_ids || [];
  return {
    no: b.no,
    marka: b.marka,
    baslik: b.is,
    leadId: atanan[0] || byUser || null,
    contribIds: [...atanan.slice(1), ...((b.editor_ids) || [])],
    deadline: deadlineMs(b.deadline, b.saat),
    baslangic: null,
    bitis: nowMs,
    revision: b.rev || 0,
    rating: null,
    slack_url: (b.link || '').match(/\((https?:[^)]+)\)/)?.[1] || '',
    image_url: '',
    notes: `✅ ${byUser || ''}`.trim(),
  };
}

// Bir brief'i bns_briefs'ten bns_completed'e taşı. Taşındıysa true.
function moveToCompleted(live, ts, byUser, nowMs) {
  live.bns_briefs = live.bns_briefs || [];
  live.bns_completed = live.bns_completed || [];
  const idx = live.bns_briefs.findIndex(b => tsFromLink(b.link) === ts);
  if (idx === -1) return false; // aktifte yok (zaten tamamlanmış olabilir)
  const [b] = live.bns_briefs.splice(idx, 1);
  // zaten completed'de varsa tekrar ekleme
  if (!live.bns_completed.some(c => String(c.no) === String(b.no))) {
    live.bns_completed.unshift(buildCompletedRecord(b, byUser, nowMs));
    live.bns_completed = live.bns_completed.slice(0, MAX_COMPLETED);
  }
  return true;
}

function main() {
  const argv = process.argv.slice(2);
  const nowMs = Date.now();

  // ── REAPPLY ───────────────────────────────────────────────────────────────
  if (argv[0] === '--reapply') {
    const state = loadState();
    const tsList = Object.keys(state);
    if (!tsList.length) { logLine('reapply: tamamlama override yok, no-op'); return; }
    let live; try { live = readLive(); } catch { logLine('reapply: live-data okunamadı'); return; }
    let moved = 0;
    for (const ts of tsList) {
      const s = state[ts];
      // Geriye uyumluluk: eski format (done/required yok) = tamamlanmış kabul et.
      const isDone = s.done === true || (s.done === undefined && !(Array.isArray(s.required) && s.required.length));
      if (isDone) {
        // tamamlanmış → completed'de tut (data-agent aktif geri getirdiyse taşı)
        if (moveToCompleted(live, ts, s.by, s.at_ms || nowMs)) moved++;
      } else if (Array.isArray(s.required) && s.required.length) {
        // kısmi onay → aktif brief'te kısmi durumu zorla (data-agent ezmesin)
        const b = (live.bns_briefs || []).find(x => tsFromLink(x.link) === ts);
        const dur = `✅ kısmi onay (${(s.acked || []).length}/${s.required.length})`;
        if (b && b.durum !== dur) { b.durum = dur; moved++; }
      }
    }
    if (moved === 0) { logLine(`reapply: ${tsList.length} tamamlama zaten uygulanmış, değişiklik yok`); return; }
    writeLive(live); injectEmbedded(live);
    pushFiles(`complete-brief: ${moved} tamamlanmış brief tekrar completed'e taşındı (resurrection önlendi)`);
    logLine(`reapply: ${moved} brief completed'e geri taşındı`);
    return;
  }

  // ── INSTANT (✅ event) ──────────────────────────────────────────────────────
  const [ts, byUser, saat] = argv;
  if (!ts || !byUser) { logLine('kullanım: complete-brief.js <ts> <by_user> [saat]'); process.exit(1); }

  let live; try { live = readLive(); } catch { logLine('live-data okunamadı'); process.exit(0); }

  const brief = (live.bns_briefs || []).find(b => tsFromLink(b.link) === ts);
  if (!brief) {
    // aktifte yok → zaten tamamlanmış ya da brief değil. Idempotent çık.
    logLine(`ts=${ts} aktif brief değil (zaten tamamlanmış olabilir) → no-op`);
    process.exit(0);
  }

  // Yetki: atanan + editör + yönetici tamamlayabilir
  const allowed = new Set([...(brief.atanan_ids || []), ...(brief.editor_ids || []), ...MANAGERS]);
  if (!allowed.has(byUser)) {
    logLine(`yetkisiz ✅: ${byUser} brief #${brief.no}'e atanmamış/yönetici değil → yoksayıldı`);
    process.exit(0);
  }

  // Çoklu atanan: kılavuz kuralı "hepsi ✅ verince tamamlanır". required = Atanan'lar
  // (yoksa editörler, o da yoksa boş → tek ✅ tamamlar). Yönetici (atanan değilse) force-complete.
  const required = (brief.atanan_ids && brief.atanan_ids.length) ? brief.atanan_ids.slice()
                 : (brief.editor_ids && brief.editor_ids.length) ? brief.editor_ids.slice() : [];
  const isManager = MANAGERS.includes(byUser);

  const state = loadState();
  const cur = state[ts] || { acked: [] };
  const acked = new Set(cur.acked || []);
  let done;
  if (isManager && !required.includes(byUser)) {
    done = true; // yönetici (atanan değil) → force-complete
  } else {
    acked.add(byUser);
    done = required.length === 0 ? true : required.every(u => acked.has(u));
  }

  state[ts] = { acked: [...acked], required, done, by: byUser, at: new Date().toISOString(), at_ms: nowMs, no: brief.no, marka: brief.marka };
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); } catch {}
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));

  const label = `${brief.marka} · ${brief.is}`;
  if (done) {
    moveToCompleted(live, ts, byUser, nowMs);
    writeLive(live); injectEmbedded(live);
    pushFiles(`complete-brief: ${label} ✅ tamamlandı (${byUser})`);
    logLine(`✓ #${brief.no} ${label} → TAMAMLANDI (✅ ${byUser} @ ${saat || ''})`);
  } else {
    // kısmi onay — henüz tüm atananlar ✅ vermedi
    brief.durum = `✅ kısmi onay (${acked.size}/${required.length})`;
    writeLive(live); injectEmbedded(live);
    pushFiles(`complete-brief: ${label} ✅ kısmi (${acked.size}/${required.length}) — ${byUser}`);
    logLine(`◐ #${brief.no} ${label} → kısmi onay ${acked.size}/${required.length} (✅ ${byUser})`);
  }
}

main();
