'use strict';

/**
 * Benseno Railway Scheduler — tek süreçte cron + always-on Slack bot.
 *
 * Mac'teki launchd job'larının yerini alır. Her cron tetiklemesi ilgili
 * run-*.sh'i DETACHED child process olarak çalıştırır; böylece uzun süren
 * claude işleri Slack bot'unu bloklamaz. Saatler Europe/Istanbul'a göredir.
 *
 * Not: run-*.sh scriptleri kendi içlerinde de saat/gün kontrolü yapar
 * (çift güvenlik) ve değiştirilmeden Mac soğuk-yedeğinde de çalışır.
 */

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const TZ = 'Europe/Istanbul';
const opts = { timezone: TZ };
const GM_ID = 'U030C48PL23'; // Görkem GM — hata bildirimleri

// P1.2 — Watchdog: bir run claude-hatasıyla çıkarsa (exit≠0) Görkem'e DM.
// run-orchestrator.sh artık gerçek claude exit kodunu döndürüyor (eskiden maskeleniyordu).
async function notifyFailure(script, code, dk) {
  const tok = process.env.SLACK_BOT_TOKEN;
  if (!tok) { console.error('[scheduler] hata DM atlandı: SLACK_BOT_TOKEN yok'); return; }
  const ts = new Date().toLocaleString('tr-TR', { timeZone: TZ });
  const text = `🔴 *Benseno scheduler hatası* — \`${script}\` exit=${code} (${dk}dk) · ${ts}\n` +
    'Kontrol: `railway logs` veya `railway ssh "tail -30 logs/orchestrator.log"`.';
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: GM_ID, text }),
    });
    const j = await r.json();
    console.log(`[scheduler] hata DM ${j.ok ? 'gönderildi' : 'BAŞARISIZ: ' + j.error}`);
  } catch (e) {
    console.error(`[scheduler] hata DM exception: ${e.message}`);
  }
}

function run(script) {
  const t0 = Date.now();
  const child = spawn('bash', [path.join('scripts', script)], {
    cwd: PROJ,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (e) => console.error(`[scheduler] HATA ${script} başlatılamadı: ${e.message}`));
  // Detay run scripti logs/*.log dosyasına yazıyor; burada Railway log'unda
  // görünür olsun diye başlangıç + bitiş(exit kodu, süre) işaretliyoruz.
  child.on('exit', (code, sig) => {
    const dk = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[scheduler] bitti: ${script} (exit=${code ?? sig}, ${dk}dk)`);
    if (code !== 0) notifyFailure(script, code ?? sig, dk);
  });
  child.unref();
  console.log(`[scheduler] tetiklendi: ${script} @ ${new Date().toLocaleString('tr-TR', { timeZone: TZ })}`);
}

// Orchestrator — hafta içi 08–17 arası :15 ve :45
cron.schedule('15,45 8-17 * * 1-5', () => run('run-orchestrator.sh'), opts);
// Sabah raporu — hafta içi 07:50
cron.schedule('50 7 * * 1-5', () => run('run-sabah-raporu.sh'), opts);
// Haftalık retro — Cuma 17:00
cron.schedule('0 17 * * 5', () => run('run-haftalik-retro.sh'), opts);
// Aylık strateji — ayın 25–31'i 17:00 (script "bugün ayın son günü mü?" kontrol eder)
cron.schedule('0 17 25-31 * *', () => run('run-aylik-strateji.sh'), opts);
// Log temizliği — her gece 03:30
cron.schedule('30 3 * * *', () => run('run-log-temizle.sh'), opts);

console.log(`[scheduler] 5 cron job kuruldu (TZ=${TZ}). Slack bot başlatılıyor...`);

// Slack bot'u başlat (dosya sonundaki IIFE app.start()'ı çağırır)
require('./slack-bot.js');
