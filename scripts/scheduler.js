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

function run(script, ...args) {
  const t0 = Date.now();
  const child = spawn('bash', [path.join('scripts', script), ...args], {
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

// ═══ BİLDİRİM REFORMU (2026-09-30) — Görkem kararı: eski rapor/bildirim akışının ═══
// tamamı kapatıldı, yerine e-posta raporları + akıllı bildirimler kuruldu.
// Kapatılanlar: sabah-raporu, kisisel-rapor, dijest (08:30+13:30), ody-icgoru,
// firma-sinyal, firma-brifing, kanal-ozet(Slack), gunluk-ozet, haftalik-retro,
// aylik-strateji, termin-risk (→ akilli-bildirim'e taşındı).
// VERİ ÜRETEN işler bilinçli olarak KALDI: thread-ozet (iş puanları/ton/kpi + fatura
// takibi), kanal-gunsonu (brand_daily arşivi), haftalik-karne, yedek/temizlik/PAT.

// Akıllı bildirimler — hafta içi 09-19 saat başı (:15): termin riski, fiilî gecikme +
// uzatma önerisi, hareketsiz iş, müşteride bekleyen. İdempotent (tip başına bastırma).
cron.schedule('15 9-19 * * 1-5', () => run('run-akilli-bildirim.sh'), opts);

// E-posta raporları (Resend) — kişi başına tek mail: kendisi → departmanı → firma.
cron.schedule('0 8 * * 1-5', () => run('run-rapor-mail.sh', 'sabah'), opts);      // bugün yapılacaklar
cron.schedule('25 17 * * 1-5', () => run('run-rapor-mail.sh', 'aksam'), opts);    // bugün yapılanlar
cron.schedule('5 8 * * 1', () => run('run-rapor-mail.sh', 'hafta-plan'), opts);   // haftalık plan
cron.schedule('26 17 * * 5', () => run('run-rapor-mail.sh', 'hafta-ozet'), opts); // haftalık özet
cron.schedule('10 8 1 * *', () => run('run-rapor-mail.sh', 'ay-bas'), opts);      // ay planı
cron.schedule('27 17 25-31 * *', () => run('run-rapor-mail.sh', 'ay-son'), opts); // ay özeti (script son gün kontrolü yapar)

// Haftalık karneler (kişi/marka/dept/benseno) — Pazartesi 08:30 (veri, dashboard'a yazar)
cron.schedule('30 8 * * 1', () => run('run-haftalik-karne.sh'), opts);
// Thread bakımı (VERİ) — thread_ton, kpi-snapshot, iş puanı, fatura takibi — 09-19 saatte bir
cron.schedule('0 9-19 * * 1-5', () => run('run-thread-ozet.sh'), opts);
// Marka gün-sonu insight — hafta içi 18:45 (brand_daily arşivine yazar)
cron.schedule('45 18 * * 1-5', () => run('run-kanal-gunsonu.sh'), opts);
// Log temizliği — her gece 03:30
cron.schedule('30 3 * * *', () => run('run-log-temizle.sh'), opts);
// PAT süre/geçerlilik kontrolü — Pazartesi 09:00 (P1.3; geçersizse kendi DM'ini atar)
cron.schedule('0 9 * * 1', () => run('check-pat-expiry.sh'), opts);
// Günlük DB yedeği — her gece 04:00 (pg_dump → db_backups, en yeni 2 tutulur, rolling)
cron.schedule('0 4 * * *', () => run('run-yedek.sh'), opts);

console.log(`[scheduler] cron job'lar kuruldu (TZ=${TZ}). Slack bot başlatılıyor...`);

// Slack bot'u başlat (dosya sonundaki IIFE app.start()'ı çağırır)
require('./slack-bot.js');
