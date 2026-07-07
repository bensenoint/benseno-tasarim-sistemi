'use strict';

/**
 * Benseno EMBEDDED Normalizer — DETERMİNİSTİK güvenlik adımı.
 *
 * Sorun: data-agent (LLM) index.html'deki window.EMBEDDED_DATA bloğuna `canvas_markdown` alanını
 * BACKTICK template-literal olarak gömüyor. İçeriğinde bir gün ` ` ya da ${...} geçerse tarayıcı
 * tüm EMBEDDED'ı parse edemez → dashboard mock fixture'a düşer (hydrate guard'larından ÖNCE).
 *
 * Çözüm: EMBEDDED'ı her döngü sonunda live-data.json'dan JSON.stringify ile yeniden yaz. Bu:
 *   - canvas_markdown'ı (ölü alan, dashboard kullanmıyor) tamamen düşürür,
 *   - saf JSON üretir (backtick/template yok → kırılmaz),
 *   - LLM'in nasıl yazdığına bağlı değil (deterministik).
 * live-data.json zaten data-agent tarafından geçerli JSON dosyası olarak yazılıyor (backtick sorunu yok).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const IDX = [path.join(PROJ, 'dashboard/index.html'), path.join(PROJ, 'index.html')];
const LOG = path.join(PROJ, 'logs/reinject-embedded.log');

function logLine(msg) { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {} console.log('[reinject]', msg); }

const GIT_LOCK = '/tmp/benseno-git.lock';
function withGitLock(fn) {
  for (let i = 0; i < 60; i++) {
    try { fs.mkdirSync(GIT_LOCK); try { return fn(); } finally { try { fs.rmdirSync(GIT_LOCK); } catch {} } }
    catch { try { if (Date.now() - fs.statSync(GIT_LOCK).mtimeMs > 60000) { fs.rmdirSync(GIT_LOCK); continue; } } catch {} try { execFileSync('sleep', ['0.1']); } catch {} }
  }
  return fn();
}

function main() {
  let live; try { live = JSON.parse(fs.readFileSync(LIVE, 'utf8')); } catch { logLine('live-data okunamadı'); return; }
  // SEC-5 savunma derinliği: finansal alanlar (maliyet/satis/fatura/odeme) PUBLIC EMBEDDED'a
  // ASLA gömülmez — kaynağı ne olursa olsun burada sökülür. Finans yalnız login-arkası API'den sunulur.
  const strip = (arr) => Array.isArray(arr) && arr.forEach(b => { delete b.maliyet; delete b.satis; delete b.fatura; delete b.odeme; });
  strip(live.bns_briefs); strip(live.bns_completed);
  // Saf JSON EMBEDDED — backtick/template YOK. canvas_markdown live-data'da olmadığı için doğal olarak düşer.
  const body = 'window.EMBEDDED_DATA = ' + JSON.stringify(live, null, 2) + ';';
  // </script> ile anchor'lı: blok ister satır-içi (…"};) ister girintili (\n};) bitsin yakalar.
  // Eski /…\n\};/ regex'i agent'ın satır-içi yazdığı bloğu kaçırıp ham-newline SyntaxError'ını bırakıyordu.
  const re = /window\.EMBEDDED_DATA = \{[\s\S]*?\};(?=\s*<\/script>)/;

  let changed = 0;
  for (const f of IDX) {
    let html; try { html = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!re.test(html)) { logLine(`⚠️ EMBEDDED bloğu yok: ${path.basename(f)}`); continue; }
    // Halihazırda backtick/canvas_markdown içeriyor mu (normalize gerekli mi)?
    const cur = html.match(re)[0];
    const fragile = /canvas_markdown|`/.test(cur);
    const next = html.replace(re, () => body);
    if (next !== html) { fs.writeFileSync(f, next); changed++; if (fragile) logLine(`${path.basename(f)}: kırılgan EMBEDDED (backtick/canvas_markdown) → saf JSON'a normalize edildi`); }
  }

  if (changed === 0) { logLine('EMBEDDED zaten normal (saf JSON) — değişiklik yok'); return; }

  if (process.env.RO_NO_PUSH === '1') { logLine('RO_NO_PUSH=1 → push atlandı (test)'); return; }
  const git = (...a) => execFileSync('git', a, { cwd: PROJ, stdio: 'pipe' });
  withGitLock(() => {
    try {
      git('add', 'dashboard/index.html', 'index.html');
      try { git('diff', '--cached', '--quiet'); return; } catch {}
      git('commit', '-m', 'reinject: EMBEDDED saf JSON\'a normalize (canvas_markdown backtick riski kapatıldı)');
      for (let i = 0; i < 5; i++) {
        try { git('pull', '--rebase', '-X', 'theirs', 'origin', 'main'); git('push', 'origin', 'main'); logLine('✓ push edildi'); return; }
        catch { try { git('rebase', '--abort'); } catch {} logLine(`push denemesi ${i + 1} başarısız, tekrar...`); }
      }
      logLine('⚠️ push edilemedi (lokal kaldı)');
    } catch (e) { logLine(`⚠️ push hata: ${e.message}`); }
  });
}

main();
