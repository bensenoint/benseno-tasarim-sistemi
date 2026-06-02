'use strict';

/**
 * Benseno Gecikme Escalation — DETERMİNİSTİK (LLM değil).
 *
 * live-data.json'daki brief'lerden gecikme süresini KENDİSİ hesaplar, eşik geçen
 * brief'ler için lead'e/yöneticilere DM atar. İdempotency: data/escalation-state.json
 * ({ts}:{template} bir kez). Storm koruması: --seed modu mevcut backlog'u GÖNDERMEDEN
 * "uyarıldı" işaretler → sonraki run'lar yalnızca YENİ eşik geçişlerini bildirir.
 *
 * Mod:  node escalation.js            → dry-run (hesapla + yazdır, GÖNDERME)
 *       node escalation.js --send     → gerçek DM gönder
 *       node escalation.js --seed     → backlog'u gönderMEDEN sent işaretle (storm önleme)
 *
 * Eşikler (gecikme saatine göre, her biri 1 kez):
 *   ≥1sa  → Şablon30 lead'e · ≥24sa → Şablon31 sorumlu yöneticiye
 *   ≥48sa → Şablon32 5 yöneticiye + #benseno-grafik · ≥72sa → Şablon29 lead'e (blokeli)
 */

const fs = require('fs');
const path = require('path');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const LIVE = path.join(PROJ, 'dashboard/app/live-data.json');
const STATE = path.join(PROJ, 'data/escalation-state.json');
const GRAFIK_CHANNEL = 'C02SZRJGY0M';
const MANAGERS = ['U030C48PL23', 'UD96GH76E', 'U4XCE3532', 'U055EDESLSE', 'U02SZQDAFPF'];
const MGR_BY_DEPT = { tasarim: 'U055EDESLSE', editor: 'U02SZQDAFPF', ai: 'U030C48PL23' };

const MONTHS = {
  ocak:1, şubat:2, subat:2, mart:3, nisan:4, mayıs:5, mayis:5, may:5,
  haziran:6, haz:6, temmuz:7, tem:7, ağustos:8, agustos:8, ağu:8,
  eylül:9, eylul:9, eyl:9, ekim:10, eki:10, kasım:11, kasim:11, kas:11, aralık:12, aralik:12, ara:12,
};

const MODE = process.argv.includes('--send') ? 'send'
           : process.argv.includes('--seed') ? 'seed' : 'dry';

function log(...a) { console.log('[escalation]', ...a); }

// link "...p1779099416366989" → "1779099416.366989"
function tsFromLink(link) {
  const m = (link || '').match(/\/p(\d{16})/);
  if (!m) return null;
  const d = m[1];
  return d.slice(0, 10) + '.' + d.slice(10);
}

// deadline "18 May 2026" + saat "16:00 TR ..." → unix saniye (yoksa null)
function deadlineUnix(deadline, saat) {
  const dm = (deadline || '').trim().match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!dm) return null;
  const day = +dm[1], mon = MONTHS[dm[2].toLowerCase()], year = +dm[3];
  if (!mon) return null;
  const sm = (saat || '').match(/(\d{1,2}):(\d{2})/);
  const hh = sm ? +sm[1] : 23, mm = sm ? +sm[2] : 59;
  // TR (UTC+3) → UTC epoch
  return Math.floor(Date.UTC(year, mon - 1, day, hh - 3, mm) / 1000);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); }

function computeOverdue() {
  const d = JSON.parse(fs.readFileSync(LIVE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const out = [];
  for (const b of (d.bns_briefs || [])) {
    const durum = (b.durum || '').toLowerCase();
    if (durum.includes('tamamland')) continue;
    const dl = deadlineUnix(b.deadline, b.saat);
    if (dl == null) continue;
    const gecikme_h = Math.floor((now - dl) / 3600);
    if (gecikme_h < 1) continue; // gecikmemiş
    out.push({
      ts: tsFromLink(b.link),
      no: b.no, marka: b.marka, is: b.is,
      lead_id: (b.atanan_ids || [])[0] || null,
      dept: b.dept || '',
      gecikme_h, deadline: b.deadline, saat: (b.saat || '').split('⚠')[0].trim(),
      link: (b.link || '').match(/\((https?:[^)]+)\)/)?.[1] || '',
    });
  }
  return out.sort((a, b) => b.gecikme_h - a.gecikme_h);
}

function thresholdsFor(h) {
  const t = [];
  if (h >= 1) t.push(30);
  if (h >= 24) t.push(31);
  if (h >= 48) t.push(32);
  if (h >= 72) t.push(29);
  return t;
}

// active|silent_log_only — silent ise gönderme
function currentMode() {
  try { return JSON.parse(fs.readFileSync(path.join(PROJ, 'data/notification-flags.json'), 'utf8')).mode || 'active'; }
  catch { return 'active'; }
}

function botToken() {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  try { return fs.readFileSync(path.join(PROJ, 'data/.slack-bot-token'), 'utf8').trim(); } catch { return ''; }
}

async function sendMsg(channel, text) {
  const tok = botToken();
  if (!tok) { log('  ⚠️ SLACK_BOT_TOKEN yok'); return false; }
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });
    const j = await r.json();
    if (!j.ok) log(`  ⚠️ postMessage hata (${channel}): ${j.error}`);
    return !!j.ok;
  } catch (e) { log(`  ⚠️ postMessage exception: ${e.message}`); return false; }
}

// Bir eşik için (recipients[], text) döndürür
function templateFor(t, b) {
  const link = b.link ? `\n<${b.link}|Brief'e git>` : '';
  const mgr = MGR_BY_DEPT[b.dept] || 'UD96GH76E';
  if (t === 30) return { to: b.lead_id ? [b.lead_id] : [], ch: null,
    text: `⏰ *${b.marka} · ${b.is}* gecikiyor. Deadline ${b.gecikme_h} saat önce geçti. Bugün bitirebilir misin? Zorlanıyorsan yöneticine haber ver.${link}` };
  if (t === 31) return { to: [mgr], ch: null,
    text: `⚠️ *Müdahale gerekiyor — ${b.marka}* · *${b.is}* ${b.gecikme_h} saattir gecikiyor.\n👤 Atanan: <@${b.lead_id}> · 📅 ${b.deadline}\nÖneri: atananla iletişime geç veya yeniden ata.${link}` };
  if (t === 32) return { to: MANAGERS, ch: GRAFIK_CHANNEL,
    text: `🚨 *Kritik gecikme — ${b.marka}* · *${b.is}* ${b.gecikme_h} saattir teslim edilmedi.\n👤 Atanan: <@${b.lead_id}> · 📅 ${b.deadline}` };
  if (t === 29) return { to: b.lead_id ? [b.lead_id] : [], ch: null,
    text: `🔴 *${b.marka} · ${b.is}* blokeli olarak işaretlendi (${b.gecikme_h}sa gecikme).\n*Ne engel var?* İlerletmek için neye/kime ihtiyacın var? Çözüldüyse brief'e ✅ koy.${link}` };
  return { to: [], ch: null, text: '' };
}

(async function main() {
  const overdue = computeOverdue();
  const mode = currentMode();
  log(`mod=${MODE} · sistem_mode=${mode} · gecikmiş brief: ${overdue.length}`);
  if (MODE === 'send' && mode === 'silent_log_only') { log('silent_log_only → gönderim yok, çıkılıyor'); return; }
  const state = loadState();
  let sent = 0, seeded = 0;
  for (const b of overdue) {
    if (!b.ts) { log(`  ⚠️ ts yok, atlanıyor: ${b.marka} · ${b.is}`); continue; }
    const already = state[b.ts] || [];
    const due = thresholdsFor(b.gecikme_h).filter(t => !already.includes(t));
    if (!due.length) continue;
    if (MODE === 'seed') {
      state[b.ts] = [...new Set([...already, ...thresholdsFor(b.gecikme_h)])];
      seeded += due.length;
      continue;
    }
    for (const t of due) {
      if (MODE === 'send') {
        const { to, ch, text } = templateFor(t, b);
        let ok = true;
        for (const u of to) ok = (await sendMsg(u, text)) && ok;
        if (ch) ok = (await sendMsg(ch, text)) && ok;
        if (ok) { state[b.ts] = [...new Set([...(state[b.ts] || []), t])]; sent++; log(`  ✓ Şablon${t} → ${b.marka} · ${b.is} (${b.gecikme_h}sa)`); }
        else log(`  ✗ Şablon${t} GÖNDERİLEMEDİ → ${b.marka} (state'e yazılmadı, sonraki run dener)`);
      } else {
        log(`  PLAN Şablon${t} → ${b.marka} · ${b.is} (${b.gecikme_h}sa, lead ${b.lead_id || '?'})`);
        sent++;
      }
    }
  }
  if (MODE === 'seed') { saveState(state); log(`✓ seed: ${seeded} eşik kaydedildi (GÖNDERİLMEDİ), ${Object.keys(state).length} brief izleniyor`); pushState(); }
  else if (MODE === 'send') { saveState(state); log(`gönderilen DM grubu: ${sent}`); if (sent > 0) pushState(); }
  else log(`planlanan: ${sent} (dry-run, gönderilmedi)`);
})();

// escalation-state.json'u git'e push et (idempotency redeploy'da kaybolmasın) — rebase-retry, shell yok
// Eşzamanlı reaction script push'larıyla yarışmasın diye paylaşımlı kilit (tüm scriptler aynı dosya).
function pushState() {
  const { execFileSync } = require('child_process');
  const git = (...args) => execFileSync('git', args, { cwd: PROJ, stdio: 'pipe' });
  const GIT_LOCK = '/tmp/benseno-git.lock';
  const withGitLock = (fn) => {
    for (let i = 0; i < 60; i++) {
      try { fs.mkdirSync(GIT_LOCK); try { return fn(); } finally { try { fs.rmdirSync(GIT_LOCK); } catch {} } }
      catch {
        try { if (Date.now() - fs.statSync(GIT_LOCK).mtimeMs > 60000) { fs.rmdirSync(GIT_LOCK); continue; } } catch {}
        try { execFileSync('sleep', ['0.1']); } catch {}
      }
    }
    return fn();
  };
  withGitLock(() => {
    try {
      git('add', 'data/escalation-state.json');
      try { git('diff', '--cached', '--quiet'); return; } catch { /* staged değişiklik var */ }
      git('commit', '-m', 'escalation: state güncellendi (DM idempotency)');
      for (let i = 0; i < 5; i++) {
        try { git('pull', '--rebase', '-X', 'theirs', 'origin', 'main'); git('push', 'origin', 'main'); log('  ✓ escalation-state push edildi'); return; }
        catch { try { git('rebase', '--abort'); } catch {} log(`  push denemesi ${i + 1} başarısız, tekrar...`); }
      }
      log('  ⚠️ escalation-state push edilemedi (state lokal kaldı — sonraki döngü toparlar)');
    } catch (e) { log(`  ⚠️ pushState hata: ${e.message}`); }
  });
}
