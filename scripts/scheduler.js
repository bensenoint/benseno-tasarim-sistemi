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
    // check-pat-expiry kendi DM'ini atıyor (exit 1 = PAT geçersiz) → çift DM olmasın
    if (code !== 0 && script !== 'check-pat-expiry.sh') notifyFailure(script, code ?? sig, dk);
  });
  child.unref();
  console.log(`[scheduler] tetiklendi: ${script} @ ${new Date().toLocaleString('tr-TR', { timeZone: TZ })}`);
}

// Orchestrator KALDIRILDI (Cutover tamam, 4 Haz): canvas→live-data pipeline emekli;
// raporlar /api/embedded (DB) okuyor, briefler /yeni-brief ile DB'ye düşüyor.
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';
// Sabah raporu — hafta içi 07:50
cron.schedule('50 7 * * 1-5', () => run('run-sabah-raporu.sh'), opts);
// Kişisel: V2'de dijest (08:30 sabah + 13:30 öğle), eski sistemde 07:55 kisisel rapor.
if (NOTIFY_V2) {
  cron.schedule('15 8 * * 1-5', () => run('run-ody-icgoru.sh'), opts);
  cron.schedule('30 8 * * 1-5', () => run('run-dijest.sh'), opts);
  cron.schedule('30 13 * * 1-5', () => run('run-dijest-ogle.sh'), opts);
  // P3.3a: firma-seviyesi proaktif sinyaller (kapasite/geciken/marka-risk/kişi-kalite) — 09:00 + 15:00
  cron.schedule('0 9 * * 1-5', () => run('run-firma-sinyal.sh'), opts);
  cron.schedule('0 15 * * 1-5', () => run('run-firma-sinyal.sh'), opts);
  // P3.3c: haftalık GM brifingi (Opus sentezi) — Pazartesi 08:00
  cron.schedule('0 8 * * 1', () => run('run-firma-brifing.sh'), opts);
} else {
  cron.schedule('55 7 * * 1-5', () => run('run-kisisel-rapor.sh'), opts);
}
// Termin riski — hafta içi 09-19 SAAT BAŞI (:15), tüm aktif briefleri tarar; teslime ≤24sa
// olanı thread'e uyarır. Idempotent (20sa): her saat kontrol eder ama aynı işi spam'lemez.
cron.schedule('15 9-19 * * 1-5', () => run('run-termin-risk.sh'), opts);
// Saatlik kanal/thread özetleri: V2'de KAPALI (gürültü kaynağı).
if (!NOTIFY_V2) {
  // Thread özeti + tamamlanan iş insight'ı — hafta içi 09-19 arası saatte bir
  cron.schedule('0 9-19 * * 1-5', () => run('run-thread-ozet.sh'), opts);
  // Marka kanal özeti — hafta içi 09-19 arası saatte bir, yarım saat kaydırmalı (xx:30)
  cron.schedule('30 9-19 * * 1-5', () => run('run-kanal-ozet.sh'), opts);
}
// Marka gün-sonu insight — hafta içi 18:45 (brand_daily arşivine yazar)
cron.schedule('45 18 * * 1-5', () => run('run-kanal-gunsonu.sh'), opts);
// 17:00 raporları kaydırıldı (aynı anda spawn olmasın → çift-claude/push yarışı yok):
// Günlük sistem özeti — hafta içi 17:05, sadece Görkem'e (P2.3)
cron.schedule('5 17 * * 1-5', () => run('run-gunluk-ozet.sh'), opts);
// Haftalık retro — Cuma 17:10
cron.schedule('10 17 * * 5', () => run('run-haftalik-retro.sh'), opts);
// Aylık strateji — ayın 25–31'i 17:15 (script "bugün ayın son günü mü?" kontrol eder)
cron.schedule('15 17 25-31 * *', () => run('run-aylik-strateji.sh'), opts);
// Log temizliği — her gece 03:30
cron.schedule('30 3 * * *', () => run('run-log-temizle.sh'), opts);
// PAT süre/geçerlilik kontrolü — Pazartesi 09:00 (P1.3; geçersizse kendi DM'ini atar)
cron.schedule('0 9 * * 1', () => run('check-pat-expiry.sh'), opts);
// Günlük DB yedeği — her gece 04:00 (pg_dump → db_backups, en yeni 2 tutulur, rolling)
cron.schedule('0 4 * * *', () => run('run-yedek.sh'), opts);

console.log(`[scheduler] cron job'lar kuruldu (TZ=${TZ}). Slack bot başlatılıyor...`);

// Slack bot'u başlat (dosya sonundaki IIFE app.start()'ı çağırır)
require('./slack-bot.js');
