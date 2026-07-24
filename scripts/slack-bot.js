'use strict';

/**
 * Benseno Slack Bot — v1.0
 * Socket Mode ile çalışır, public URL gerekmez.
 * Komutlar: /brief-durum, /kapasite, /maliyet
 * Events: reaction_added (yönetici öncelik override), app_home_opened
 * Actions: brief_tamamla, brief_sure_uzat
 */

const { App } = require('@slack/bolt');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

// ─── Sabitler ────────────────────────────────────────────────────────────────

const PROJECT_DIR = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const CANVAS_ID   = 'F0B1B6XUD44';
const GRAFIK_CH   = 'C02SZRJGY0M';

// DB API (Faz 3 — /yeni-brief modalı buraya POST eder). global fetch (Node 18+).
const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');
// Mesajlarda görünen bot adı (chat:write.customize ile override — Slack profil önbelleğini bypass eder).
const BOT_NAME = process.env.BNS_BOT_NAME || 'WT';
// Kanal adı → marka (ör. "marka-bauhaus" → "Bauhaus"). /yeni-brief markayı
// komutun çalıştığı kanaldan bulur — kullanıcı ayrıca marka seçmez.
// server/slack.js CHANNELS tek kaynak; buradan ters harita kurarız.
const { CHANNELS: BRAND_CHANNELS } = require(path.join(PROJECT_DIR, 'server', 'slack.js'));
const CHANNEL_TO_BRAND = {};
for (const [brand, ch] of Object.entries(BRAND_CHANNELS)) CHANNEL_TO_BRAND[ch] = brand;
// "#marka-bauhaus" / "marka-bauhaus" → "Bauhaus" | null
function brandFromChannelName(name) {
  if (!name) return null;
  return CHANNEL_TO_BRAND[String(name).replace(/^#/, '')] || null;
}

// DB'ye best-effort yazma (b3 — Slack aksiyonları DB'ye de düşsün). Hata bot'u BOZMAZ.
// ── Çevrimdışı yazma kuyruğu (DB-tabanlı, dosya yedekli) ─────────────────────
// API erişilemezken idempotent yazmalar KALICI olarak bot_write_queue tablosuna alınır
// (Postgres API'den bağımsız ayakta; deploy/rebuild'e dayanır → hiç kayıp yok). DB de
// erişilemezse data/.write-queue.jsonl'e düşer, DB dönünce tabloya taşınır. API canlanınca
// FIFO replay + DELETE. Yeni-brief POST'u idempotent DEĞİL → kuyruğa ALINMAZ (replay kopya yaratır).
const _fs = require('fs'), _path = require('path');
const QUEUE_FILE = _path.join(__dirname, '../data/.write-queue.jsonl');
let _pool;  // server/db.js havuzu (lazy; DATABASE_URL/data/.db-url'den)
function dbPool() {
  if (_pool !== undefined) return _pool || null;
  try { _pool = require('../server/db.js').pool; } catch (e) { _pool = null; log('[kuyruk] DB havuzu yok: ' + e.message); }
  return _pool || null;
}
function fileAppend(it) { try { _fs.appendFileSync(QUEUE_FILE, JSON.stringify(it) + '\n'); } catch (e) {} }
function fileReadAll() { try { return _fs.readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse); } catch (e) { return []; } }
function fileClear() { try { _fs.unlinkSync(QUEUE_FILE); } catch (e) {} }
function isQueueable(method, urlPath) { return !(method === 'POST' && urlPath === '/api/briefs'); }

async function sendWrite(method, urlPath, body) {
  try {
    const r = await fetch(`${API_BASE}${urlPath}`, {
      method, headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' }, body: JSON.stringify(body),
    });
    const err = r.ok ? null : ((await r.json().catch(() => ({}))).error || '');
    return { ok: r.ok, status: r.status, err };
  } catch (e) { return { ok: false, status: 0, err: e.message }; }
}
async function enqueueWrite(method, urlPath, body) {
  const pool = dbPool();
  if (pool) {
    try { await pool.query('INSERT INTO bot_write_queue(method,url_path,body) VALUES($1,$2,$3)', [method, urlPath, body ?? null]); return 'db'; }
    catch (e) { log('[kuyruk] DB insert hata, dosyaya: ' + e.message); }
  }
  fileAppend({ method, urlPath, body, at: Date.now() }); return 'dosya';
}
let _flushing = false;
async function flushQueue() {
  if (_flushing) return; _flushing = true;
  try {
    const pool = dbPool();
    if (!pool) {  // DB yok → yalnız dosyadan dene
      const items = fileReadAll(); if (!items.length) return;
      let i = 0; for (; i < items.length; i++) { const r = await sendWrite(items[i].method, items[i].urlPath, items[i].body); if (!r.ok && (r.status === 0 || r.status >= 500)) break; }
      const rest = items.slice(i); fileClear(); rest.forEach(fileAppend); return;
    }
    // 1) Dosya yedeğini tabloya taşı (DB ayağa kalkmışsa)
    const fitems = fileReadAll();
    if (fitems.length) { for (const it of fitems) { try { await pool.query('INSERT INTO bot_write_queue(method,url_path,body,created_at) VALUES($1,$2,$3,to_timestamp($4/1000.0))', [it.method, it.urlPath, it.body ?? null, it.at || Date.now()]); } catch (e) {} } fileClear(); log(`[kuyruk] ${fitems.length} dosya-kaydı tabloya taşındı`); }
    // 2) Tabloyu FIFO replay et (kronolojik: dosyadan taşınan eski kayıtlar önce)
    for (;;) {
      const q = await pool.query('SELECT id, method, url_path, body FROM bot_write_queue ORDER BY created_at, id LIMIT 1');
      if (!q.rows.length) break;
      const it = q.rows[0];
      const res = await sendWrite(it.method, it.url_path, it.body);
      if (res.ok) { await pool.query('DELETE FROM bot_write_queue WHERE id=$1', [it.id]); log(`[kuyruk] ✓ ${it.method} ${it.url_path}`); }
      else if (res.status === 0 || res.status >= 500) break;  // API hâlâ çevrimdışı → dur
      else { await pool.query('DELETE FROM bot_write_queue WHERE id=$1', [it.id]); log(`[kuyruk] ✗ kalıcı hata, atıldı: ${it.method} ${it.url_path} → ${res.status} ${res.err || ''}`); }
    }
  } catch (e) { log('[kuyruk] flush hata: ' + e.message); }
  finally { _flushing = false; }
}
async function dbWrite(method, urlPath, body) {
  const res = await sendWrite(method, urlPath, body);
  if (res.ok) { log(`DB ${method} ${urlPath} ✓`); flushQueue(); return true; }   // başarı → bekleyenleri de boşalt
  const transient = res.status === 0 || res.status >= 500;   // ağ hatası / API çökük
  if (transient && isQueueable(method, urlPath)) {
    const where = await enqueueWrite(method, urlPath, body);
    log(`DB ${method} ${urlPath} → ${res.status || 'ağ'} · KUYRUĞA ALINDI (${where}) — API dönünce işlenecek`);
  } else {
    log(`DB ${method} ${urlPath} → ${res.status} ${res.err || ''} (kuyruğa alınmadı)`);
  }
  return false;
}
// TR para metni → sayı ("1.500,50"→1500.5, "1500"→1500). Boş/geçersiz → null.
function parseTRMoney(s) {
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

const MANAGER_IDS = new Set([
  'U030C48PL23', // Görkem Kaya
  'UD96GH76E',   // Reyhan Nur Pınar
  'U4XCE3532',   // Cansu Kazgan
  'U055EDESLSE', // İpek Akdeniz
  'U02SZQDAFPF', // erdem akoğlu
]);

// Tasarım ekibi (kapasite hesabında sadece bunlar sayılır)
const TASARIMCI_IDS = new Set([
  'U0AN6DD79M0', // Aylin Tozkoparan
  'U06J26R1XCJ', // Aykut Arslan
  'U09BFPBKQG7', // Hasan Serdar Arda
  'U0B3K2WE7SB', // Pelin Özdemir
  'U055EDESLSE', // İpek Akdeniz (hem yönetici hem tasarımcı)
  'U0AK8U7L57F', // İrem Özkan
  'U08HLMHTGEL', // Serhat
]);

// Editör ekibi (kapasite hesabında ayrı bölüm)
const EDITOR_IDS = new Set([
  'U02SZQDAFPF', // Erdem Akoğlu (hem yönetici hem editör)
  'U07PV0RA9L2', // Eda Ayral
  'U08NQJ27G5S', // Melis
  'U063T8M5HL4', // Buse Gürbüzer
  'U05PP70GQTX', // Aylin Caner
  'U0AAC3YK20G', // Simge Acar
]);

// AI ekibi (kapasite hesabında ayrı bölüm)
const AI_IDS = new Set([
  'U0AP31SAA1W', // Eren Mahzunlar
]);

// Tasarımcı görünen isimleri (kapasite tablosunda)
const TASARIMCI_ISIM = {
  'U0AN6DD79M0': 'Aylin Tozkoparan',
  'U06J26R1XCJ': 'Aykut Arslan',
  'U09BFPBKQG7': 'Hasan Serdar Arda',
  'U0B3K2WE7SB': 'Pelin Özdemir ✨',
  'U055EDESLSE': 'İpek Akdeniz',
  'U0AK8U7L57F': 'İrem Özkan',
  'U08HLMHTGEL': 'Serhat',
};

// Editör görünen isimleri
const EDITOR_ISIM = {
  'U02SZQDAFPF': 'Erdem Akoğlu',
  'U07PV0RA9L2': 'Eda Ayral',
  'U08NQJ27G5S': 'Melis',
  'U063T8M5HL4': 'Buse Gürbüzer',
  'U05PP70GQTX': 'Aylin Caner',
  'U0AAC3YK20G': 'Simge Acar',
};

// AI görünen isimleri
const AI_ISIM = {
  'U0AP31SAA1W': 'Eren Mahzunlar',
};

const PRIORITY_REACTIONS = new Set([
  'red_circle', 'large_orange_circle', 'large_yellow_circle', 'large_green_circle',
  'bso-acil', 'bso-yuksek', 'bso-normal', 'bso-dusuk',
]);

const REACTION_EMOJI = {
  red_circle:          '🔴',
  large_orange_circle: '🟠',
  large_yellow_circle: '🟡',
  large_green_circle:  '🟢',
  // Benseno özel öncelik emojileri → kanonik renk karakterine eşlenir (dashboard aynı mantık).
  'bso-acil':   '🔴',
  'bso-yuksek': '🟠',
  'bso-normal': '🟡',
  'bso-dusuk':  '🟢',
};

// Slack'teki marka listesi (otomatik tamamlama için)
const MARKALAR = [
  'Bauhaus','Aygaz','Boyner','Çiçek Sepeti','Garanti BBVA','Koton',
  'LC Waikiki','MediaMarkt','Migros','Odeabank','Yapı Kredi','Zara',
].sort();

// ─── App Başlatma ─────────────────────────────────────────────────────────────

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN,
  appToken:   process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel:   'warn',
  // Mac uyku/uyanma döngüsünde WebSocket kopuyor — ping timeout'ı artırarak
  // gereksiz yeniden bağlanma ve "pong not received" uyarılarını azalt
  clientOptions: {
    retryConfig: { retries: 5, minTimeout: 2000, maxTimeout: 30000, randomize: true }
  }
});

// ─── Canvas Parse Yardımcıları ────────────────────────────────────────────────

/**
 * Canvas içeriğini claude CLI + MCP üzerinden okur.
 * Bu yol Brief Sync ile aynı mekanizmayı kullanır, scope sorunu yok.
 *
 * Cache stratejisi: data/canvas_cache.md TTL içindeyse onu döner (~anlık).
 * Yoksa claude CLI ile canvas'ı çeker (~60-150 sn) ve cache'i günceller.
 * Brief Sync :15/:45'te zaten canvas okuyup günceller — bu cache de doğal olarak
 * o ritimle tazelenir (Brief Sync ileride aynı dosyaya yazabilir).
 */
const CANVAS_CACHE_PATH = path.join(PROJECT_DIR, 'data/canvas_cache.md');
const CANVAS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 dk — Brief Sync ritmiyle uyumlu

async function fetchCanvas(_client) {
  // 1) Cache her zaman önce dön (Brief Sync zaten :15/:45'te günceller)
  try {
    const stat = fs.statSync(CANVAS_CACHE_PATH);
    const age = Date.now() - stat.mtimeMs;
    if (age < CANVAS_CACHE_TTL_MS) {
      return fs.readFileSync(CANVAS_CACHE_PATH, 'utf8');
    }
    // Cache var ama eski — yine de dön (Claude CLI'den daha güvenilir)
    const staleContent = fs.readFileSync(CANVAS_CACHE_PATH, 'utf8');
    if (staleContent && staleContent.length > 100) {
      log(`canvas cache stale (${Math.round(age/60000)}dk) — stale cache döndürülüyor`);
      return staleContent;
    }
  } catch (_) { /* cache yok */ }

  // 2) Cache yoksa boş string dön — Claude CLI'yi çağırma (çalışmıyor)
  log('canvas cache yok — boş döndürülüyor, Brief Sync bekleniyor');
  return '';
}

/**
 * Canvas markdown'ındaki Aktif İşler tablosunu parse eder.
 *
 * Gerçek sütun düzeni (canvas'tan alındı):
 * 0:no | 1:Dept | 2:Marka | 3:İş | 4:Atanan | 5:Editör | 6:Öncelik | 7:Deadline | 8:Saat | 9:Durum | 10:Rev | 11:Geçmiş | 12:Link
 *
 * Döner: [{no, dept, marka, konu, atanan, editor, oncelik, deadline, saat, durum}]
 */
function parseAktifIsler(markdown) {
  const briefs = [];
  const lines  = markdown.split('\n');

  let inAktif      = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // "Aktif İşler" başlığını bul — Türkçe İ (U+0130) için toLower ile karşılaştır
    if (!trimmed.startsWith('|') && trimmed.toLowerCase().includes('aktif')) {
      const low = trimmed.toLowerCase();
      if (low.includes('aktif i') || low.includes('aktif ı') || low.includes('aktif işler') || low.includes('aktif işler')) {
        inAktif = true;
        continue;
      }
    }
    // Tamamlanan veya Thread Özetleri başlığına gelinince dur
    if (inAktif && !trimmed.startsWith('|')) {
      const low = trimmed.toLowerCase();
      if (low.includes('tamamlanan') || low.includes('thread özet') || low.includes('thread özet')) break;
    }

    if (!inAktif) continue;
    if (!trimmed.startsWith('|')) continue;

    // Separator satırını atla (--- içeren)
    if (/^\|[\s\-|: ]+\|$/.test(trimmed)) continue;

    const cells = trimmed.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    if (cells.length < 7) continue;

    // Başlık satırını atla (Dept / Marka / Öncelik kelimeleri varsa)
    if (/dept|marka|öncelik|deadline/i.test(cells[1] || '')) { headerPassed = true; continue; }
    if (!headerPassed) continue;

    const [no, dept, marka, konu, atanan, editor, oncelik, deadline, saat, durum] = cells;

    // Öncelik sütununda (6. kolon) emoji yoksa bu satır geçersiz
    if (!/[🔴🟠🟡🟢]/.test(oncelik || '')) continue;
    // Marka boşsa atla
    if (!marka || marka === '---') continue;

    briefs.push({ no, dept, marka, konu, atanan: atanan || '', editor: editor || '', oncelik, deadline: deadline || '', saat: saat || '', durum: durum || '' });
  }

  return briefs;
}

/**
 * Atanan sütunundaki Slack ID'lerini çıkartır: "<@U0AN6DD79M0>" → ["U0AN6DD79M0"]
 */
function extractUserIds(atananStr) {
  const matches = atananStr.matchAll(/<@(U[A-Z0-9]+)>/g);
  return [...matches].map(m => m[1]);
}

/**
 * Brief listesini Block Kit section bloklarına dönüştürür.
 */
function briefsToBlocks(briefs, baslik) {
  if (briefs.length === 0) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: `_${baslik} için aktif iş bulunamadı._` } }];
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: baslik, emoji: true } },
    { type: 'divider' },
  ];

  for (const b of briefs) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${b.oncelik} *${b.marka}* — ${b.konu}\n⏰ ${b.deadline} ${b.saat}  |  👤 ${b.atanan || '_atanmamış_'}\n📌 ${b.durum || '—'}`,
      },
    });
  }

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Toplam: *${briefs.length}* aktif iş` }] });
  return blocks;
}

/**
 * Aktif brief'leri CANLI DB'den (/api/embedded) okur — live-data.json artık güncellenmiyor
 * (orchestrator kaldırıldı), bu yüzden bayat veriydi. atanan = işi yapanlar (workers);
 * /kapasite yükü buradan sayıldığı için lead/gözlemci dahil edilmez. "<@ID>" (extractUserIds uyumlu).
 */
async function loadBriefs() {
  try {
    // /api/embedded korumalı → server-to-server write token ile kimliklen.
    const _wt = process.env.BNS_WRITE_TOKEN;
    const r = await fetch(`${API_BASE}/api/embedded`, {
      cache: 'no-store',
      headers: _wt ? { 'x-bns-token': _wt } : {},
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const fmt = (ms, opts) => { try { return new Date(ms).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', ...opts }); } catch { return ''; } };
    return (d.bns_briefs || []).map(b => ({
      no: b.no,
      dept: b.dept || '',
      marka: b.marka || '',
      konu: b.baslik || '',
      atanan: (b.workers || []).map(w => `<@${w.id}>`).join(' '),
      oncelik: '',
      deadline: b.deadline ? fmt(b.deadline, { day: '2-digit', month: 'short' }) : '',
      saat: b.deadline ? fmt(b.deadline, { hour: '2-digit', minute: '2-digit' }) : '',
      durum: b.durum || '',
    }));
  } catch (err) {
    log(`loadBriefs hata: ${err.message}`);
    return [];
  }
}

// ─── Durum değişikliği yetkisi (Slack) ────────────────────────────────────────
// Emoji/kelime ile durum değiştirme yalnız atanan (worker/lead) + açan + yönetici
// (dashboard bnsBriefActionPerms / P3.4c ile aynı politika). Gerekçe: kanaldaki
// herhangi birinin gündelik 🚀/✅ reaction'ı iş durumunu sessizce değiştiriyordu.
// Hata/bulunamama → engelleme YAPMA (fail-open: meşru akış API hıçkırığına kurban gitmesin).
async function statusYetki(userId, briefTs) {
  if (MANAGER_IDS.has(userId)) return { ok: true };
  try {
    const _wt = process.env.BNS_WRITE_TOKEN;
    const r = await fetch(`${API_BASE}/api/embedded`, { cache: 'no-store', headers: _wt ? { 'x-bns-token': _wt } : {} });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const b = (d.bns_briefs || []).find(x => x.slack_ts === briefTs);
    if (!b) return { ok: true }; // brief eşleşmedi → eski davranış
    const u = (d.bns_users || []).find(x => x.id === userId);
    if (u && (u.rol === 'yonetici' || u.yetki === 'yonetici')) return { ok: true };
    if (b.created_by === userId) return { ok: true };
    const atanan = [...(b.workers || []), ...(b.leads || [])].some(p => p && p.id === userId);
    if (!atanan) log(`statusYetki RED detay: ${userId} → #${b.no} | workers=${(b.workers || []).map(p => p && p.id).join(',')} leads=${(b.leads || []).map(p => p && p.id).join(',')} by=${b.created_by}`);
    return atanan ? { ok: true } : { ok: false, no: b.no, marka: b.marka || '' };
  } catch (e) { log(`statusYetki hata (fail-open): ${e.message}`); return { ok: true }; }
}
// Yetkisiz denemede kişiye kısa DM — sessiz kafa karışıklığı olmasın.
async function statusYetkiRed(client, userId, chk, durum) {
  log(`durum REDDEDİLDİ: ${userId} → #${chk.no} ${durum} (atanan/açan/yönetici değil)`);
  try {
    await client.chat.postMessage({ channel: userId, username: BOT_NAME,
      text: `⛔ *#${chk.no} ${chk.marka}* işinin durumunu değiştirme yetkin yok — durumu yalnız işin atananı, açanı veya bir yönetici değiştirebilir. (Emoji/reaction'ın işleme alınmadı.)` });
  } catch (e) { log(`yetki-red DM hatası: ${e.message}`); }
}

// ─── /brief-durum ─────────────────────────────────────────────────────────────

app.command('/brief-durum', async ({ command, ack, respond, client }) => {
  await ack();

  const userId  = command.user_id;
  const filtre  = command.text.trim().toLowerCase();
  const yonetici = MANAGER_IDS.has(userId);

  try {
    let briefs = await loadBriefs();

    // Marka filtresi varsa uygula
    if (filtre) {
      briefs = briefs.filter(b => b.marka.toLowerCase().includes(filtre));
    }

    // Tasarımcıysa sadece kendi işlerini gör (Slack ID ile eşleştir)
    if (!yonetici && !filtre) {
      briefs = briefs.filter(b => extractUserIds(b.atanan).includes(userId));
    }

    const baslik = filtre
      ? `${filtre.toUpperCase()} — Aktif İşler`
      : yonetici ? 'Tüm Aktif İşler' : 'Aktif İşlerim';

    await respond({
      response_type: 'ephemeral',
      blocks: briefsToBlocks(briefs, baslik),
    });

  } catch (err) {
    log(`/brief-durum hata: ${err.message}`);
    await respond({ response_type: 'ephemeral', text: `❌ Veriler yüklenemedi: ${err.message}` });
  }
});

// ─── /kapasite ────────────────────────────────────────────────────────────────

app.command('/kapasite', async ({ command, ack, respond, client }) => {
  await ack();

  if (!MANAGER_IDS.has(command.user_id)) {
    await respond({ response_type: 'ephemeral', text: '⛔ Bu komut sadece yöneticiler içindir.' });
    return;
  }

  try {
    const briefs   = await loadBriefs();

    // Tasarımcı sayımı
    const tasarimciSayim = {};
    for (const id of TASARIMCI_IDS) tasarimciSayim[id] = 0;

    // Editör sayımı
    const editorSayim = {};
    for (const id of EDITOR_IDS) editorSayim[id] = 0;

    // AI sayımı
    const aiSayim = {};
    for (const id of AI_IDS) aiSayim[id] = 0;

    // Brief'lerdeki kişileri say
    let atanmamis = 0;
    for (const b of briefs) {
      const ids = extractUserIds(b.atanan);
      const tasarimciIds = ids.filter(id => TASARIMCI_IDS.has(id));
      const editorIds    = ids.filter(id => EDITOR_IDS.has(id));
      const aiIds        = ids.filter(id => AI_IDS.has(id));

      if (tasarimciIds.length === 0 && editorIds.length === 0 && aiIds.length === 0) {
        atanmamis++;
      }
      for (const id of tasarimciIds) tasarimciSayim[id] = (tasarimciSayim[id] || 0) + 1;
      for (const id of editorIds)    editorSayim[id]    = (editorSayim[id]    || 0) + 1;
      for (const id of aiIds)        aiSayim[id]        = (aiSayim[id]        || 0) + 1;
    }

    function satirOlustur(sayim, isimMap) {
      return Object.entries(sayim)
        .sort((a, b) => a[1] - b[1])
        .map(([id, n]) => {
          const isim = isimMap[id] || id;
          const bar  = '█'.repeat(n) + '░'.repeat(Math.max(0, 5 - n));
          const flag = n === 0 ? '  ← _müsait_' : n >= 4 ? '  ← ⚠️ yoğun' : '';
          return `\`${bar}\` *${n}* iş  —  ${isim}${flag}`;
        })
        .join('\n');
    }

    const tasarimciSatir = satirOlustur(tasarimciSayim, TASARIMCI_ISIM);
    const editorSatir    = satirOlustur(editorSayim, EDITOR_ISIM);
    const aiSatir        = satirOlustur(aiSayim, AI_ISIM);

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '📊 Ekip Kapasitesi', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: '*🎨 Tasarım*' } },
      { type: 'section', text: { type: 'mrkdwn', text: tasarimciSatir || '_Aktif iş yok_' } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: '*✍️ Editör*' } },
      { type: 'section', text: { type: 'mrkdwn', text: editorSatir || '_Aktif iş yok_' } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: '*🤖 AI*' } },
      { type: 'section', text: { type: 'mrkdwn', text: aiSatir || '_Aktif iş yok_' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Toplam aktif: *${briefs.length}* brief${atanmamis > 0 ? ` · ⚠️ Atanmamış: ${atanmamis}` : ''}` }] },
    ];

    await respond({ response_type: 'ephemeral', blocks });

  } catch (err) {
    log(`/kapasite hata: ${err.message}`);
    await respond({ response_type: 'ephemeral', text: `❌ Veriler yüklenemedi: ${err.message}` });
  }
});

// /yeni-brief kaldırıldı — Slack Workflow zaten bu işi yapıyor

// ─── /maliyet — Brief bazında maliyet + satış girişi (modal) ──────────────────
// Dashboard statik (GitHub Pages) olduğu için kaydı Slack üzerinden alıyoruz: modal submit →
// deterministik set-financials.js → brief-financials.json + live-data + push. Herkes girebilir.
app.command('/maliyet', async ({ command, ack, client }) => {
  await ack();
  try {
    // Komut metni varsa brief no'yu ön-doldur: "/maliyet 27"
    const preNo = (command.text || '').trim().replace(/[^\d]/g, '');
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'maliyet_modal',
        title: { type: 'plain_text', text: 'Maliyet / Satış' },
        submit: { type: 'plain_text', text: 'Kaydet' },
        close: { type: 'plain_text', text: 'İptal' },
        blocks: [
          { type: 'input', block_id: 'no_b', label: { type: 'plain_text', text: 'Brief No (#)' },
            element: { type: 'plain_text_input', action_id: 'no', initial_value: preNo, placeholder: { type: 'plain_text', text: 'ör. 27' } } },
          { type: 'input', block_id: 'maliyet_b', optional: true, label: { type: 'plain_text', text: 'Maliyet (₺)' },
            element: { type: 'plain_text_input', action_id: 'maliyet', placeholder: { type: 'plain_text', text: 'ör. 1500 — boş = temizle' } } },
          { type: 'input', block_id: 'satis_b', optional: true, label: { type: 'plain_text', text: 'Satış (₺)' },
            element: { type: 'plain_text_input', action_id: 'satis', placeholder: { type: 'plain_text', text: 'ör. 4000 — boş = temizle' } } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Sadece sayı gir. Her ikisi de boşsa kayıt temizlenir. Birkaç dk içinde dashboard\'a yansır.' }] },
        ],
      },
    });
  } catch (err) { log(`/maliyet modal aç hata: ${err.message}`); }
});

// Modal submit → set-financials.js (no maliyet satis by). Doğrulama: no zorunlu + sayı.
app.view('maliyet_modal', async ({ ack, body, view, client }) => {
  const v = view.state.values;
  const noRaw      = (v.no_b?.no?.value || '').trim();
  const maliyetRaw = (v.maliyet_b?.maliyet?.value || '').trim();
  const satisRaw   = (v.satis_b?.satis?.value || '').trim();
  const no = noRaw.replace(/[^\d]/g, '');
  if (!no) { await ack({ response_action: 'errors', errors: { no_b: 'Geçerli bir brief no gir (ör. 27).' } }); return; }
  // sayı doğrulama (boş kabul — temizler)
  const bad = s => s !== '' && isNaN(Number(s.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')));
  if (bad(maliyetRaw)) { await ack({ response_action: 'errors', errors: { maliyet_b: 'Sadece sayı gir.' } }); return; }
  if (bad(satisRaw))   { await ack({ response_action: 'errors', errors: { satis_b: 'Sadece sayı gir.' } }); return; }
  await ack();
  const by = body.user?.id || '';
  try {
    await execFileAsync('node', [`${PROJECT_DIR}/scripts/set-financials.js`, 'set', no, by, JSON.stringify({ maliyet: maliyetRaw, satis: satisRaw })],
      { cwd: PROJECT_DIR, timeout: 120000 });
    log(`/maliyet → #${no} maliyet="${maliyetRaw}" satış="${satisRaw}" (by ${by})`);
    // Girene özel onay DM'i
    try {
      const txt = (maliyetRaw === '' && satisRaw === '')
        ? `✅ Brief #${no} maliyet/satış kaydı temizlendi.`
        : `✅ Brief #${no} kaydedildi — maliyet: ${maliyetRaw || '—'}₺ · satış: ${satisRaw || '—'}₺. Birkaç dk içinde dashboard'da görünür.`;
      await client.chat.postMessage({ channel: by, text: txt, username: BOT_NAME });
    } catch {}
  } catch (err) {
    log(`/maliyet set-financials hata: ${err.message}`);
    try { await client.chat.postMessage({ channel: by, text: `❌ Brief #${no} kaydedilemedi: ${err.message}`, username: BOT_NAME }); } catch {}
  }
});

// ─── "help" geri bildirim formu (buton → modal → adminlere DM) ─────────────────
// Sorun/öneri bildirimleri bu kişilere DM olarak düşer.
const FEEDBACK_ADMINS = ['U030C48PL23', 'UD96GH76E'];   // Görkem, Reyhan

// ── Fazlı işler: thread'de 'faz ekle' → kart → modal → POST /faz ──
app.action('bns_faz_ac', async ({ ack, body, client, action }) => {
  await ack();
  let v = {}; try { v = JSON.parse(action.value || '{}'); } catch {}
  try {
    const tipler = await isTipleriGetir();
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal', callback_id: 'bns_faz_modal',
        private_metadata: JSON.stringify(v),
        title: { type: 'plain_text', text: 'Yeni Faz Aç' },
        submit: { type: 'plain_text', text: 'Faz Aç' }, close: { type: 'plain_text', text: 'İptal' },
        blocks: [
          { type: 'context', elements: [{ type: 'mrkdwn', text: `🧩 Kaynak iş: *#${v.no}* — faz AYRI iştir: atananlar, iş tipi ve faturalama bu form üzerinde yeniden seçilir; yeni thread açılır.` }] },
          { type: 'input', block_id: 'baslik_b', optional: true, label: { type: 'plain_text', text: 'Başlık (boş = otomatik "… — Faz N")' },
            element: { type: 'plain_text_input', action_id: 'baslik' } },
          { type: 'input', block_id: 'deadline_b', label: { type: 'plain_text', text: 'Termin — zorunlu' },
            element: { type: 'datetimepicker', action_id: 'deadline' } },
          { type: 'input', block_id: 'workers_b', label: { type: 'plain_text', text: 'İşi yapan(lar) — zorunlu' },
            element: { type: 'multi_users_select', action_id: 'workers' } },
          ...(tipler.length ? [{ type: 'input', block_id: 'is_tipi_b', label: { type: 'plain_text', text: 'İş Tipi' },
            element: { type: 'static_select', action_id: 'is_tipi', placeholder: { type: 'plain_text', text: 'Tip seç' },
              option_groups: [...new Set(tipler.map(t => t.grup))].map(g => ({
                label: { type: 'plain_text', text: g },
                options: tipler.filter(t => t.grup === g).map(t => ({ text: { type: 'plain_text', text: t.ad }, value: t.kod })),
              })) } }] : []),
          { type: 'input', block_id: 'fatura_b', label: { type: 'plain_text', text: 'Faturalama' },
            element: { type: 'radio_buttons', action_id: 'ucret_tipi', options: [
              { text: { type: 'plain_text', text: '🔒 Aylık fee — retainer kapsamında' }, value: 'kapsamda' },
              { text: { type: 'plain_text', text: '➕ Ek iş — ayrıca faturalanır' }, value: 'ek' },
            ] } },
        ],
      },
    });
  } catch (e) { log(`faz modal hata: ${e.message}`); }
});
app.view('bns_faz_modal', async ({ ack, body, view, client }) => {
  const v = view.state.values;
  const dtSec = v.deadline_b?.deadline?.selected_date_time || null;
  if (!dtSec) { await ack({ response_action: 'errors', errors: { deadline_b: 'Termin seç.' } }); return; }
  await ack();
  let meta = {}; try { meta = JSON.parse(view.private_metadata || '{}'); } catch {}
  const uid = body.user?.id;
  const r = await sendWriteRaw('POST', `/api/briefs/${meta.id}/faz`, {
    by: uid, deadline: new Date(dtSec * 1000).toISOString(),
    baslik: (v.baslik_b?.baslik?.value || '').trim() || undefined,
    worker_ids: v.workers_b?.workers?.selected_users || [],
    is_tipi: v.is_tipi_b?.is_tipi?.selected_option?.value || undefined,
    ucret_tipi: v.fatura_b?.ucret_tipi?.selected_option?.value || undefined,
  });
  const msg = r.ok
    ? `🧩 Faz ${r.json.faz_no} açıldı: *#${r.json.no}*${r.json.slack && r.json.slack.permalink ? `\n${r.json.slack.permalink}` : ''}`
    : `❌ Faz açılamadı: ${r.json.error || r.status}`;
  try { await client.chat.postMessage({ channel: uid, text: msg, username: BOT_NAME }); } catch {}
  log(`[faz] ${meta.id} by ${uid} → ${r.status}`);
});

// ── WIP=1: durum yazıcı — basladi'da çakışma (409) olursa thread'e onay kartı ──
// Diğer durumlar/başarısızlıklar eski dbWrite yolundan (kuyruk semantiği) akar.
async function wipStatusYaz(briefTs, kanal, body) {
  if (body.durum !== 'basladi') { dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, body); return; }
  const r = await sendWriteRaw('POST', `/api/briefs/by-ts/${briefTs}/status`, body);
  if (r.status === 409 && r.json && r.json.cakisma) {
    const c = r.json.cakisma;
    try {
      await app.client.chat.postMessage({
        channel: kanal, thread_ts: briefTs, username: BOT_NAME,
        text: `⚠️ <@${body.by}> şu an #${c.no} üzerinde çalışıyorsun — bu işe başlarsan #${c.no} beklemeye alınacak.`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn',
            text: `⚠️ <@${body.by}> şu an *#${c.no} ${c.marka || ''}* işinde çalışıyorsun.\nBu işe başlarsan *#${c.no} beklemeye alınacak* (tek aktif iş kuralı).` } },
          { type: 'actions', elements: [
            { type: 'button', style: 'primary', action_id: 'bns_wip_onay',
              value: JSON.stringify({ ts: briefTs, by: body.by }), text: { type: 'plain_text', text: '✅ Onayla — başla' } },
            { type: 'button', action_id: 'bns_wip_vazgec',
              value: JSON.stringify({ by: body.by }), text: { type: 'plain_text', text: '✖ Vazgeç' } },
          ] },
        ],
      });
    } catch (e) { log(`wip kart hata: ${e.message}`); }
    return;
  }
  if (!r.ok) dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, body);   // kuyruk semantiği korunur
}
// sendWrite gövde döndürmüyor — WIP için ham sürüm
async function sendWriteRaw(method, urlPath, body) {
  try {
    const r = await fetch(`${API_BASE}${urlPath}`, {
      method, headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' }, body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  } catch (e) { return { ok: false, status: 0, json: {} }; }
}
app.action('bns_wip_onay', async ({ ack, body, client, action }) => {
  await ack();
  let v = {}; try { v = JSON.parse(action.value || '{}'); } catch {}
  const uid = body.user?.id;
  if (uid !== v.by) {
    try { await client.chat.postMessage({ channel: uid, text: '⛔ Bu onay yalnız 🚀 koyan kişiye ait.', username: BOT_NAME }); } catch {}
    return;
  }
  const r = await sendWriteRaw('POST', `/api/briefs/by-ts/${v.ts}/status`, { durum: 'basladi', by: uid, source: 'slack', zorla: true });
  const metin = r.ok
    ? `✅ Başladın — önceki işin beklemeye alındı (tek aktif iş).`
    : `❌ Uygulanamadı: ${r.json.error || r.status}`;
  try { await client.chat.update({ channel: body.channel?.id, ts: body.message?.ts, text: metin,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: metin } }] }); } catch {}
  log(`[wip] onay ${v.ts} by ${uid} → ${r.status}`);
});
app.action('bns_wip_vazgec', async ({ ack, body, client, action }) => {
  await ack();
  let v = {}; try { v = JSON.parse(action.value || '{}'); } catch {}
  const uid = body.user?.id;
  if (uid !== v.by) return;
  try { await client.chat.update({ channel: body.channel?.id, ts: body.message?.ts,
    text: '✖ Vazgeçildi — mevcut işinde devam ediyorsun.',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '✖ Vazgeçildi — mevcut işinde devam ediyorsun.' } }] }); } catch {}
});

// ── Fatura-takip butonları — yetki SUNUCUDA (fatura-aksiyon 403 → kibar uyarı) ──
async function faturaAksiyonCagir(briefId, body) {
  const r = await fetch(`${API_BASE}/api/briefs/${briefId}/fatura-aksiyon`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}
function faturaKartKapat(client, kanal, ts, metin) {
  return client.chat.update({ channel: kanal, ts, text: metin,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: metin } }] }).catch(() => {});
}
app.action('bns_fatura_kesildi', async ({ ack, body, client, action }) => {
  await ack();
  const uid = body.user?.id, briefId = +action.value;
  const r = await faturaAksiyonCagir(briefId, { by: uid, fatura: true });
  if (!r.ok) {
    const msg = r.status === 403 ? '⛔ Fatura işaretini yalnız lead, işi açan ya da yönetici koyabilir.' : `❌ ${r.error || 'işaretlenemedi'}`;
    try { await client.chat.postMessage({ channel: uid, text: msg, username: BOT_NAME }); } catch {}
    return;
  }
  const tut = r.satis != null ? ` (${Number(r.satis).toLocaleString('tr-TR')}₺)` : '';
  await faturaKartKapat(client, body.channel?.id, body.message?.ts, `✅ #${r.no} ek iş${tut} — fatura kesildi (<@${uid}>). Takip kapandı.`);
  log(`[fatura] #${r.no} kesildi (by ${uid})`);
});
app.action('bns_fatura_tutar', async ({ ack, body, client, action }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal', callback_id: 'bns_fatura_tutar_modal',
        private_metadata: JSON.stringify({ briefId: +action.value, kanal: body.channel?.id, ts: body.message?.ts }),
        title: { type: 'plain_text', text: 'Ek İş — Satış Tutarı' },
        submit: { type: 'plain_text', text: 'Kaydet' }, close: { type: 'plain_text', text: 'İptal' },
        blocks: [
          { type: 'input', block_id: 'satis_b', label: { type: 'plain_text', text: 'Satış (₺) — zorunlu' },
            element: { type: 'plain_text_input', action_id: 'satis', placeholder: { type: 'plain_text', text: 'ör. 4500' } } },
          { type: 'input', block_id: 'maliyet_b', optional: true, label: { type: 'plain_text', text: 'Maliyet (₺) — ops. (dış tedarik vb.)' },
            element: { type: 'plain_text_input', action_id: 'maliyet' } },
          { type: 'input', block_id: 'fatura_b', optional: true, label: { type: 'plain_text', text: 'Fatura' },
            element: { type: 'checkboxes', action_id: 'fatura', options: [
              { text: { type: 'plain_text', text: 'Fatura kesildi' }, value: 'kesildi' }] } },
        ],
      },
    });
  } catch (e) { log(`fatura tutar modal hata: ${e.message}`); }
});
app.view('bns_fatura_tutar_modal', async ({ ack, body, view, client }) => {
  const v = view.state.values;
  const paraOku2 = (x) => { const n = parseFloat(String(x || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  const satis = paraOku2(v.satis_b?.satis?.value);
  if (!satis) { await ack({ response_action: 'errors', errors: { satis_b: 'Geçerli bir tutar gir (ör. 4500).' } }); return; }
  await ack();
  let meta = {}; try { meta = JSON.parse(view.private_metadata || '{}'); } catch {}
  const uid = body.user?.id;
  const maliyet = paraOku2(v.maliyet_b?.maliyet?.value);
  const kesildi = (v.fatura_b?.fatura?.selected_options || []).some(o => o.value === 'kesildi');
  const r = await faturaAksiyonCagir(meta.briefId, { by: uid, satis, ...(maliyet != null ? { maliyet } : {}), fatura: kesildi });
  if (!r.ok) {
    const msg = r.status === 403 ? '⛔ Tutarı yalnız lead, işi açan ya da yönetici girebilir.' : `❌ ${r.error || 'kaydedilemedi'}`;
    try { await client.chat.postMessage({ channel: uid, text: msg, username: BOT_NAME }); } catch {}
    return;
  }
  const tutTxt = Number(r.satis).toLocaleString('tr-TR') + '₺';
  if (kesildi) {
    await faturaKartKapat(client, meta.kanal, meta.ts, `✅ #${r.no} ek iş (${tutTxt}) — tutar girildi ve fatura kesildi (<@${uid}>). Takip kapandı.`);
  } else {
    // Tutar girildi ama fatura yok → kartı 'fatura kesildi mi' haline çevir (takip sürer).
    await client.chat.update({ channel: meta.kanal, ts: meta.ts,
      text: `➕ #${r.no} ek iş (${tutTxt}) — fatura kesildi mi?`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `➕ #${r.no} ek iş (*${tutTxt}*) — tutar girildi (<@${uid}>). Fatura kesildi mi?` } },
        { type: 'actions', elements: [{ type: 'button', style: 'primary', action_id: 'bns_fatura_kesildi', value: String(meta.briefId), text: { type: 'plain_text', text: '✅ Fatura kesildi' } }] },
      ] }).catch(() => {});
  }
  log(`[fatura] #${r.no} tutar ${tutTxt} (fatura=${kesildi}, by ${uid})`);
});

app.action('bns_feedback_open', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal', callback_id: 'bns_feedback_submit',
        title: { type: 'plain_text', text: 'Sorun / Öneri Bildir' },
        submit: { type: 'plain_text', text: 'Gönder' },
        close: { type: 'plain_text', text: 'Vazgeç' },
        blocks: [
          { type: 'input', block_id: 'baslik_b',
            label: { type: 'plain_text', text: 'Başlık' },
            element: { type: 'plain_text_input', action_id: 'baslik', max_length: 120,
              placeholder: { type: 'plain_text', text: 'Kısaca ne oldu / önerin ne?' } } },
          { type: 'input', block_id: 'aciklama_b',
            label: { type: 'plain_text', text: 'Açıklama' },
            element: { type: 'plain_text_input', action_id: 'aciklama', multiline: true, max_length: 2000,
              placeholder: { type: 'plain_text', text: 'Detaylı anlat: ne yapmaya çalışıyordun, ne bekledin, ne oldu…' } } },
          { type: 'input', block_id: 'gorsel_b', optional: true,
            label: { type: 'plain_text', text: 'Görsel (ekran görüntüsü vb.)' },
            element: { type: 'file_input', action_id: 'gorsel', max_files: 3 } },
        ],
      },
    });
  } catch (e) { log(`feedback modal hata: ${e.message}`); }
});

app.view('bns_feedback_submit', async ({ ack, body, view, client }) => {
  await ack();
  const v = view.state.values;
  const baslik = (v.baslik_b?.baslik?.value || '').trim();
  const aciklama = (v.aciklama_b?.aciklama?.value || '').trim();
  const files = v.gorsel_b?.gorsel?.files || [];
  const by = body.user?.id || '';
  const fileLinks = files.map(f => f.permalink || f.url_private).filter(Boolean);
  const text = [
    `🛟 *Uygulama geri bildirimi* — <@${by}>`,
    `*${baslik}*`,
    aciklama,
    ...fileLinks.map(u => `📎 ${u}`),
  ].filter(Boolean).join('\n');
  let sent = 0;
  for (const admin of FEEDBACK_ADMINS) {
    try { await client.chat.postMessage({ channel: admin, text, username: BOT_NAME }); sent++; }
    catch (e) { log(`feedback admin DM hata (${admin}): ${e.message}`); }
  }
  log(`feedback: ${by} → ${sent} admine iletildi ("${baslik.slice(0, 50)}")`);
  // Gönderene teyit
  try { await client.chat.postMessage({ channel: by, username: BOT_NAME,
    text: `✅ Geri bildirimin sistem adminlerine iletildi — teşekkürler!\n*${baslik}*` }); } catch {}
});

// ─── /yardim — Komut rehberi (sadece yazan görür) ──────────────────────────────
app.command('/yardim', async ({ command, ack, respond }) => {
  await ack();
  await respond({
    response_type: 'ephemeral',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📖 Komut Rehberi', emoji: true } },

      // Komutlar
      { type: 'section', text: { type: 'mrkdwn', text: '*Komutlar*' } },
      { type: 'section', text: { type: 'mrkdwn', text:
        '`/yeni-brief` — Marka kanalında yeni brief açar\n' +
        '🏷️ Yeni briefte *iş tipi* seçimi zorunlu — sistem tip başına gerçek süreleri öğrenir (İş Tipleri ekranı)\n' +
        '`/brief-durum` — Sana atanmış aktif brifleri listeler\n' +
        '`/kapasite` — Ekip kapasitesini gösterir _(Yönetici)_\n' +
        '`/maliyet` — Brief maliyet/satış bilgisi girer'
      }},

      { type: 'divider' },

      // Emoji kısayolları
      { type: 'section', text: { type: 'mrkdwn', text: '*Emoji kısayolları* — brief mesajına reaction ekle VEYA thread\'e tek emoji yaz. Klasik VE Benseno özel emojileri birlikte kullanılabilir; ikisi de aynı sonucu verir. _Yetki: durumu yalnız işin atananı, açanı veya yönetici değiştirebilir._' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text:
          '*Durum (klasik · Benseno):*\n' +
          '🎨/✍️/🤖 · :bso-calisiliyor: → İş planında\n' +
          '🚀 → İşe başlandı\n' +
          '🔄 · :bso-devam: → Devam ediyor\n' +
          '👀 · :bso-incelemede: → İncelemede\n' +
          '⏸️ · :bso-beklemede: → Beklemede\n' +
          '✏️ · :bso-revizyon: → Revizyon\n' +
          '✈️ · :bso-musteriye: → Müşteriye\n' +
          '✅ · :bso-tamamlandi: → Tamamlandı\n' +
          '🔃 · :bso-yeniden-acildi: → Yeniden aç\n' +
          '📎 · :bso-galeri-muhru: → Final teslim (galeri)' },
        { type: 'mrkdwn', text:
          '*Öncelik (klasik · Benseno):*\n' +
          '🔴 · :bso-acil: → Acil\n' +
          '🟠 · :bso-yuksek: → Yüksek\n' +
          '🟡 · :bso-normal: → Normal\n' +
          '🟢 · :bso-dusuk: → Düşük' },
      ]},
      { type: 'context', elements: [{ type: 'mrkdwn', text: '📎/:bso-galeri-muhru: *Final teslim:* dosya içeren bir mesaja koy → o mesajdaki tüm dosyalar (görsel/PDF/video) işin final teslimi olarak galeriye kaydedilir (✅ otomatik son-görselden farklı: hangi dosyaların gireceğini sen seçersin). İş planında için departman ayrımı yok — sistem departmanı atananlardan alır.' }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '⏰ *Deadline uzatma puanı düşürür:* terminine ne kadar yakın uzatırsan o kadar çok (>48sa -0.5 · 24-48sa -1.0 · <24sa -1.5 · termin geçmişse -2.0). Tamamlananlarda Zamanında/Uzatılarak/Gecikmeli olarak işaretlenir.' }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '⛓️ *Sıralı iş:* brief "Sıralı" açıldıysa ✅ yalnızca SENİN halkanı onaylar; iş sıradaki kişiye geçer ve herkes onaylamadan kapanmaz. Sonraki halka ✏️ koyarsa iş bir önceki halkaya (veya `revize: @kişi` ile seçilen halkaya) geri döner.' }] },

      { type: 'divider' },

      // Kelime kısayolları
      { type: 'section', text: { type: 'mrkdwn', text: '*Kelime kısayolları* — brief thread\'ine tam olarak şunu yaz' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text:
          '`devam et` → Devam Ediyor\n' +
          '`iş incelemede` → İncelemede\n' +
          '`iş beklemede` → Beklemede\n' +
          '`revizyon var` · `revize et` → Revizyon\n' +
          '`revize: @kişi` → Zinciri o halkaya geri sarar (sıralı iş)\n' +
          '`termin 15.06 17:00` → Termini değiştirir (saat yoksa 18:00)\n' +
          '`müşteriye yollandı` → ✈️ Müşteri Onayında\n' +
          '`iş tamamlandı` → Tamamlandı\n' +
          '`yeniden aç` · `geri aç` → Yeniden Açıldı\n' +
          '`bloke et` → Blokeli'
        },
        { type: 'mrkdwn', text:
          '*Öncelik:*\n' +
          '`acil öncelik` → 🔴\n' +
          '`yüksek öncelik` → 🟠\n' +
          '`normal öncelik` → 🟡\n' +
          '`düşük öncelik` → 🟢'
        },
      ]},

      { type: 'divider' },

      // Bildirimler & Dashboard
      { type: 'section', text: { type: 'mrkdwn', text:
        '*Bildirimler & Dashboard*\n' +
        '• Günlük dijest *08:30* + *13:30* (öğle) — biriken bildirimler toplu gelir; acil işler (termin/atama) *anında* DM.\n' +
        '• Bildirim tercihleri & sessiz saat: Dashboard → *Profil* → *⚙️*.\n' +
        '• Dashboard\'dan aksiyon: *Başladım* / *İlerlet* / *Termini uzat* / *Hatırlat* — artık *atananlar da* kullanabilir; Slack\'e gerek yok, thread\'e de yansır.\n' +
        '• Ody sabahları riskli işlerin varsa tek satır 💡 içgörü verir (dashboard + DM; tercihten kapatılır).\n' +
        '• *⭐ Performansım:* kendi profilinde KENDİ işlerinin puanını + AI\'ın sebebini + son 6 ay trendini görürsün.\n' +
        '• *Yönetici:* firma risk sinyalleri hafta içi *09:00 + 15:00* DM (kapasite/geciken/marka-risk/kalite/gecikme öngörüsü/burnout) · Pazartesi *08:00* haftalık Ody brifingi · brief detayında 💰 Finans girişi (maliyet/satış/fatura/ödeme).'
      }},

      { type: 'divider' },

      // Diğer
      { type: 'section', text: { type: 'mrkdwn', text: '*Diğer*' } },
      { type: 'section', text: { type: 'mrkdwn', text:
        '`help` — herhangi bir kanala yaz → sorun/öneri bildirim formu (adminlere gider)\n' +
        '🌴 — Slack durumunu 🌴/tatil/izin yap → uyarı DM\'leri sana gelmez\n' +
        '🤖 — Dashboard sağ alttaki asistana kullanım ve iş/marka/kişi soruları sorabilirsin — üye olduğun kanallardan CANLI Slack bilgisi de çeker ("X kanalında son ne konuşuldu?", "Ali tatilde mi?")\n' +
        '⏰ — İşi 1 saat içinde planına al (🎨/✍️/🤖), yoksa hatırlatma; 2 saat sonra yöneticine bilgi gider'
      }},

      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Dashboard: <https://bensenoint.github.io|bensenoint.github.io>' }] },
    ],
  });
});

// ─── /yeni-brief — Slack'ten deterministik brief açma (Faz 3, LLM'siz) ────────
// Block Kit modal → POST /api/briefs → DB + markanın kanalına post. Slash command'ı
// Slack app config'inde (api.slack.com/apps → Slash Commands) /yeni-brief olarak kayıtlı olmalı.
// İş tipleri (modal seçenekleri) — 10dk cache'li; API düşükse boş döner, modal tip alanını atlar.
let _isTipleriCache = { ts: 0, tipler: [] };
async function isTipleriGetir() {
  if (Date.now() - _isTipleriCache.ts < 10 * 60 * 1000 && _isTipleriCache.tipler.length) return _isTipleriCache.tipler;
  try {
    const r = await fetch(`${API_BASE}/api/is-tipleri`, { headers: { 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' } });
    const j = await r.json();
    if (Array.isArray(j.tipler) && j.tipler.length) _isTipleriCache = { ts: Date.now(), tipler: j.tipler };
  } catch (e) { log(`is-tipleri getir hata: ${e.message}`); }
  return _isTipleriCache.tipler;
}

app.command('/yeni-brief', async ({ command, ack, client, respond }) => {
  await ack();
  // Marka kanaldan belirlenir — komut hangi marka kanalında çalıştıysa o marka.
  const marka = brandFromChannelName(command.channel_name);
  if (!marka) {
    try { await respond({ response_type: 'ephemeral', text: '⚠️ /yeni-brief komutunu bir *marka kanalında* (ör. #marka-bauhaus) çalıştır — brief o marka için açılır.' }); } catch {}
    return;
  }
  try {
    const tipler = await isTipleriGetir();
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'yeni_brief_modal',
        private_metadata: JSON.stringify({ marka }),   // submit handler markayı buradan okur
        title: { type: 'plain_text', text: 'Yeni Brief' },
        submit: { type: 'plain_text', text: 'Oluştur' },
        close: { type: 'plain_text', text: 'İptal' },
        blocks: [
          { type: 'context', elements: [{ type: 'mrkdwn', text: `📁 Marka: *${marka}* _(kanaldan belirlendi)_` }] },
          { type: 'input', block_id: 'baslik_b', label: { type: 'plain_text', text: 'Başlık / İş' },
            element: { type: 'plain_text_input', action_id: 'baslik', placeholder: { type: 'plain_text', text: 'ör. Sosyal medya paketi — Mayıs' } } },
          ...(tipler.length ? [{ type: 'input', block_id: 'is_tipi_b', label: { type: 'plain_text', text: 'İş Tipi — zorunlu' },
            element: { type: 'static_select', action_id: 'is_tipi', placeholder: { type: 'plain_text', text: 'Tip seç' },
              option_groups: [...new Set(tipler.map(t => t.grup))].map(g => ({
                label: { type: 'plain_text', text: g },
                options: tipler.filter(t => t.grup === g).map(t => ({ text: { type: 'plain_text', text: t.ad }, value: t.kod })),
              })) } }] : []),
          { type: 'input', block_id: 'fatura_b', label: { type: 'plain_text', text: 'Faturalama' },
            element: { type: 'radio_buttons', action_id: 'ucret_tipi',
              options: [
                { text: { type: 'plain_text', text: '🔒 Aylık fee — retainer kapsamında' }, value: 'kapsamda' },
                { text: { type: 'plain_text', text: '➕ Ek iş — ayrıca faturalanır' }, value: 'ek' },
              ] } },
          { type: 'input', block_id: 'satis_b', optional: true, label: { type: 'plain_text', text: 'Satış (₺) — yalnız ek işte; belli değilse boş bırak, iş bitince sistem sorar' },
            element: { type: 'plain_text_input', action_id: 'satis', placeholder: { type: 'plain_text', text: 'ör. 4500' } } },
          { type: 'input', block_id: 'maliyet_b', optional: true, label: { type: 'plain_text', text: 'Maliyet (₺) — ops. (dış tedarik vb.)' },
            element: { type: 'plain_text_input', action_id: 'maliyet', placeholder: { type: 'plain_text', text: 'ör. 1200' } } },
          { type: 'input', block_id: 'deadline_b', label: { type: 'plain_text', text: 'Deadline (tarih + saat) — zorunlu' },
            element: { type: 'datetimepicker', action_id: 'deadline' } },
          { type: 'input', block_id: 'workers_b', label: { type: 'plain_text', text: 'İşi yapan(lar)' },
            element: { type: 'multi_users_select', action_id: 'workers', placeholder: { type: 'plain_text', text: 'Kişi(ler) — sıralı akışta seçim sırası = zincir sırası' } } },
          { type: 'input', block_id: 'akis_b', optional: true, label: { type: 'plain_text', text: 'Çalışma şekli (birden çok kişi varsa)' },
            element: { type: 'radio_buttons', action_id: 'akis',
              initial_option: { text: { type: 'plain_text', text: '🔀 Paralel — herkes aynı anda çalışır' }, value: 'paralel' },
              options: [
                { text: { type: 'plain_text', text: '🔀 Paralel — herkes aynı anda çalışır' }, value: 'paralel' },
                { text: { type: 'plain_text', text: '⛓️ Sıralı — seçim sırasına göre el değiştirir, herkes ✅ vermeden iş kapanmaz' }, value: 'sirali' },
              ] } },
          { type: 'input', block_id: 'leads_b', optional: true, label: { type: 'plain_text', text: 'Lead(ler) — son kontrol (boş = briefi açan)' },
            element: { type: 'multi_users_select', action_id: 'leads', placeholder: { type: 'plain_text', text: 'Kişi(ler) (ops.)' } } },
          { type: 'input', block_id: 'gozlemci_b', optional: true, label: { type: 'plain_text', text: 'Gözlemciler (dept yöneticisi otomatik)' },
            element: { type: 'multi_users_select', action_id: 'gozlemci', placeholder: { type: 'plain_text', text: 'Kişi(ler) (ops.)' } } },
          { type: 'input', block_id: 'dosya_b', optional: true, label: { type: 'plain_text', text: 'Dosyalar' },
            element: { type: 'file_input', action_id: 'dosya' } },
          { type: 'input', block_id: 'not_b', optional: true, label: { type: 'plain_text', text: 'Müşteri notu / açıklama' },
            element: { type: 'plain_text_input', action_id: 'aciklama', multiline: true } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Brief DB\'ye yazılır ve markanın kanalına thread olarak düşer.' }] },
        ],
      },
    });
  } catch (err) { log(`/yeni-brief modal aç hata: ${err.message}`); }
});

// Modal submit → POST /api/briefs (source=dashboard → kanal postu + slack_ts tetiklenir).
app.view('yeni_brief_modal', async ({ ack, body, view, client }) => {
  const v = view.state.values;
  let marka = '';
  try { marka = (JSON.parse(view.private_metadata || '{}').marka) || ''; } catch {}
  const baslik = (v.baslik_b?.baslik?.value || '').trim();
  if (!baslik) { await ack({ response_action: 'errors', errors: { baslik_b: 'Başlık gir.' } }); return; }
  const workers = v.workers_b?.workers?.selected_users || [];
  if (!workers.length) { await ack({ response_action: 'errors', errors: { workers_b: 'En az bir işi yapan seç.' } }); return; }
  if (!(v.fatura_b?.ucret_tipi?.selected_option?.value)) { await ack({ response_action: 'errors', errors: { fatura_b: 'Faturalama seç: aylık fee mi, ek iş mi?' } }); return; }
  await ack();
  const by      = body.user?.id || '';
  const dtSec   = v.deadline_b?.deadline?.selected_date_time || null;  // Unix saniye (tarih+saat)
  const leads   = v.leads_b?.leads?.selected_users || [];
  const gozlemci = v.gozlemci_b?.gozlemci?.selected_users || [];
  const akis = v.akis_b?.akis?.selected_option?.value || 'paralel';
  const fileIds = (v.dosya_b?.dosya?.files || []).map(f => f.id);
  const aciklama = (v.not_b?.aciklama?.value || '').trim();
  const isTipi = v.is_tipi_b?.is_tipi?.selected_option?.value || undefined;
  const ucretTipi = v.fatura_b?.ucret_tipi?.selected_option?.value || null;
  const paraOku = (x) => { const n = parseFloat(String(x || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const satis = ucretTipi === 'ek' ? paraOku(v.satis_b?.satis?.value) : undefined;
  const maliyetG = ucretTipi === 'ek' ? paraOku(v.maliyet_b?.maliyet?.value) : undefined;
  const payload = {
    marka, baslik, is_tipi: isTipi, ucret_tipi: ucretTipi,
    satis, maliyet: maliyetG,
    deadline: dtSec ? new Date(dtSec * 1000).toISOString() : null,
    worker_ids: workers,
    akis,
    lead_ids: leads.length ? leads : undefined,
    gozlemci_ids: gozlemci.length ? gozlemci : undefined,
    musteri_notu: aciklama || undefined,
    by, source: 'dashboard',   // !== 'slack' → createBrief markanın kanalına post eder
  };
  try {
    const r = await fetch(`${API_BASE}/api/briefs`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' }, body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error === 'doğrulama'
      ? 'doğrulama: ' + (j.issues || []).map(i => (i.path || []).join('.')).join(', ')
      : (j.error || ('HTTP ' + r.status)));
    log(`/yeni-brief → #${j.no} ${marka} (by ${by})`);
    // Dosyalar (file_input) zaten Slack'te → brief thread'ine permalink + DB meta (best-effort)
    if (fileIds.length && j.id && j.slack && j.slack.ts) {
      for (const fid of fileIds) {
        try {
          const info = await client.files.info({ file: fid });
          const perma = info.file?.permalink || '';
          const fname = info.file?.name || 'dosya';
          await client.chat.postMessage({ channel: j.slack.channel, thread_ts: j.slack.ts, text: `📎 ${perma}`, username: BOT_NAME });
          await fetch(`${API_BASE}/api/briefs/${j.id}/attachments-meta`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: perma, filename: fname, by }),
          }).catch(() => {});
        } catch (e) { log(`dosya iliştir hata: ${e.message}`); }
      }
    }
    const link = j.slack && j.slack.permalink ? `\n${j.slack.permalink}` : '';
    try { await client.chat.postMessage({ channel: by, text: `✅ Brief *#${j.no}* oluşturuldu — ${marka}: ${baslik}${link}`, username: BOT_NAME }); } catch {}
  } catch (err) {
    log(`/yeni-brief POST hata: ${err.message}`);
    try { await client.chat.postMessage({ channel: by, text: `❌ Brief oluşturulamadı: ${err.message}`, username: BOT_NAME }); } catch {}
  }
});

// ─── Aşama D: Reaction Override (anlık) ───────────────────────────────────────

// Reaction bir thread YANITINA konmuşsa parent (brief) ts'ini döndür — aksi halde
// by-ts araması yanıtın ts'iyle yapılır ve brief bulunamaz (Bug 1). Standalone mesajda ts'i aynen döner.
// "15.06 17:00" / "15.06.2026" / "bugün 14:30" / "yarın" → TR saatiyle ISO (+03:00).
// Saat verilmezse 18:00. Yıl verilmemiş ve tarih geçmişse bir sonraki yıl alınır.
function parseTerminTR(raw) {
  const s = raw.trim().toLowerCase();
  const p = (n) => String(n).padStart(2, '0');
  const bugunTR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD
  let m = s.match(/^(bug[uü]n|yar[ıi]n)(?:\s+(\d{1,2})[:.](\d{2}))?$/);
  if (m) {
    let [y, mo, d] = bugunTR().split('-').map(Number);
    if (m[1].startsWith('yar')) { const t = new Date(Date.UTC(y, mo - 1, d + 1)); y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; d = t.getUTCDate(); }
    return `${y}-${p(mo)}-${p(d)}T${p(m[2] ? +m[2] : 18)}:${m[3] || '00'}:00+03:00`;
  }
  m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?:\s+(\d{1,2})[:.](\d{2}))?$/);
  if (!m) return null;
  const gun = +m[1], ay = +m[2];
  if (gun < 1 || gun > 31 || ay < 1 || ay > 12) return null;
  let yil = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +bugunTR().slice(0, 4);
  const iso = () => `${yil}-${p(ay)}-${p(gun)}T${p(m[4] ? +m[4] : 18)}:${m[5] || '00'}:00+03:00`;
  if (!m[3] && Date.parse(iso()) < Date.now()) yil++;   // yılsız geçmiş tarih → gelecek yıl
  return iso();
}

// Açılışta Slack profil fotoğraflarını DB'ye senkronla (best-effort, bloklamaz).
// Avatar dashboard'da kişi rozetlerinde kullanılır; foto yoksa renkli baş harf kalır.
async function syncAvatars(client) {
  try {
    const r = await client.users.list({ limit: 500 });
    let n = 0;
    for (const m of r.members || []) {
      const img = m.profile && (m.profile.image_192 || m.profile.image_72);
      if (!img || m.deleted || m.is_bot) continue;
      if (await dbWrite('PATCH', `/api/users-avatar/${m.id}`, { avatar_url: img })) n++;
    }
    log(`avatar senkron: ${n} kullanıcı güncellendi`);
  } catch (e) { log(`avatar senkron hata: ${e.message}`); }
}

async function resolveBriefTs(client, channel, ts) {
  try {
    const r = await client.conversations.replies({ channel, ts, limit: 1 });
    const m = r.messages && r.messages[0];
    if (m && m.thread_ts) return m.thread_ts;   // reply → parent; parent-with-replies → kendi ts'i
  } catch (e) { log(`resolveBriefTs hata: ${e.message}`); }
  return ts;
}

// ✅ anında: thread'in son görselini bulup DB'ye kaydet (galeri için, best-effort)
async function captureThreadImage(client, channel, briefTs) {
  try {
    const r = await client.conversations.replies({ channel, ts: briefTs, limit: 200 });
    const msgs = r.messages || [];
    // Mesajlar eski→yeni sıralı; her görsel bulunduğunda üzerine yaz → son = en yeni
    let lastImageUrl = null;
    for (const msg of msgs) {
      if (!msg.files || !msg.files.length) continue;
      const imgFile = msg.files.find(f => f.mimetype && f.mimetype.startsWith('image/'));
      if (imgFile && imgFile.url_private) lastImageUrl = imgFile.url_private;
    }
    if (!lastImageUrl) { log(`captureImage: thread'de görsel yok (${briefTs})`); return; }
    log(`captureImage: son görsel bulundu → kaydediliyor`);
    await dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}/set-image`, { image_url: lastImageUrl });
  } catch (e) {
    log(`captureImage hata: ${e.message}`);
  }
}

// 📎 ile işaretlenen MESAJIN tüm dosyalarını (resim+diğer tip) brief'in FINAL teslimi yapar.
// Final = onaylanan/işaretlenen dosya (thread'deki son resim değil) — kullanıcı kontrolünde.
async function captureFinalDeliverables(client, channel, msgTs, briefTs, byUser) {
  const r = await client.conversations.replies({ channel, ts: briefTs, limit: 200 });
  const msg = (r.messages || []).find(m => m.ts === msgTs);
  const files = (msg && msg.files) || [];
  const items = files.map(f => ({ url: f.url_private, filename: f.name || 'dosya', mime: f.mimetype || '' })).filter(x => x.url);
  if (!items.length) {
    await client.chat.postMessage({ channel, thread_ts: briefTs, username: BOT_NAME,
      text: '📎 Final işareti için *dosya içeren* bir mesaja koy — bu mesajda dosya yok.' });
    return;
  }
  await dbWrite('POST', `/api/briefs/by-ts/${briefTs}/final-deliverables`, { items, by: byUser });
  await client.chat.postMessage({ channel, thread_ts: briefTs, username: BOT_NAME,
    text: `📎 *Final teslim kaydedildi* — ${items.length} dosya: ${items.map(i => i.filename).join(', ')}. Galeride görünecek.` });
}

app.event('reaction_added', async ({ event, client }) => {
  // Mesaj tipinde değilse yoksay (dosya, canvas üzeri olabilir)
  if (event.item.type !== 'message') return;

  // ✅/durum/öncelik reaction'ları brief'in ANA mesajına bağlıdır. Kullanıcı thread
  // yanıtına koyduysa parent ts'e çöz (Bug 1) — tüm handler'lar bunu kullanır.
  const briefTs = await resolveBriefTs(client, event.item.channel, event.item.ts);

  // ✅ Brief tamamlama (atanan/editör/yönetici — yetkiyi script kontrol eder).
  // Deterministik: brief'i bns_briefs→bns_completed taşır + push. MCP/claude gerektirmez.
  if (event.reaction === 'white_check_mark' || event.reaction === 'bso-tamamlandi') {
    const chk = await statusYetki(event.user, briefTs);
    if (!chk.ok) { await statusYetkiRed(client, event.user, chk, 'tamamlandi'); return; }
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`✅ tamamlama: ${briefTs} — ${event.user}`);
    // Thread'deki son görseli onay öncesi yakala → galeri için image_url'e kaydet
    captureThreadImage(client, event.item.channel, briefTs).catch(() => {});
    // DB: brief'i slack_ts ile bul → tamamlandı (reflectChange thread onayını düşürür).
    dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum: 'tamamlandi', by: event.user, source: 'slack' });
    return;
  }

  // 📎 Final teslim işareti: bu mesaja ekli TÜM dosyaları (resim+diğer) brief'in final teslimi yap → galeri.
  if (event.reaction === 'paperclip' || event.reaction === 'bso-galeri-muhru') {
    if (!briefTs) return;
    log(`📎 final teslim işareti: ${event.item.ts} @ ${briefTs} — ${event.user}`);
    captureFinalDeliverables(client, event.item.channel, event.item.ts, briefTs, event.user).catch(e => log(`final teslim hata: ${e.message}`));
    return;
  }

  // Durum geçişi (atanan/editör/yönetici — yetkiyi script kontrol eder). Departmana özel
  // başla emojileri: 🎨 art (tasarım) · ✍️ writing_hand (editör) · 🤖 robot_face (AI) · 👀 eyes (revize sun).
  // Yeni: ✏️ pencil2 (revizyon) · ⏸️ double_vertical_bar (beklemede) · 🔃 arrows_counterclockwise (yeniden aç)
  // Deterministik, MCP gerektirmez. Skin-tone varyantını normalize et (✍️🏽 vb).
  const reactionBase = event.reaction.replace(/::skin-tone-\d+$/, '');
  const DURUM_MAP = {
    art: 'calisiliyor', writing_hand: 'calisiliyor', robot_face: 'calisiliyor',
    rocket: 'basladi',
    outbox_tray: 'kontrole', mailbox_with_mail: 'kontrole',   // 📤/📬 yapan işi kontrole yolladı
    'bso-kontrole': 'kontrole',
    eyes: 'incelemede',
    double_vertical_bar: 'beklemede',
    pencil2: 'revizyon', pencil: 'revizyon',
    arrows_counterclockwise: 'calisiliyor',  // yeniden aç: tamamlandı → devam ediyor
    arrows_clockwise: 'calisiliyor',         // 🔄 devam ediyor (/yardim'da belgeli)
    airplane: 'musteride', small_airplane: 'musteride',  // ✈️ müşteriye yollandı (müşteri onayında)
    // Benseno özel emoji seti (bso-) — departman ayrımı yok, tek "çalışılıyor"; dept atananlardan gelir.
    'bso-calisiliyor': 'calisiliyor', 'bso-devam': 'calisiliyor', 'bso-yeniden-acildi': 'calisiliyor',
    'bso-incelemede': 'incelemede', 'bso-beklemede': 'beklemede',
    'bso-revizyon': 'revizyon', 'bso-musteriye': 'musteride',
  };
  if (reactionBase in DURUM_MAP) {
    const durum = DURUM_MAP[reactionBase];
    const chk = await statusYetki(event.user, briefTs);
    if (!chk.ok) { await statusYetkiRed(client, event.user, chk, durum); return; }
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`durum reaction: :${reactionBase}: → ${durum} @ ${briefTs} — ${event.user}`);
    // DB: emoji → durum kodu (reflectChange thread onayını düşürür).
    wipStatusYaz(briefTs, event.item.channel, { durum, by: event.user, source: 'slack' });
    return;
  }

  // Öncelik override (🔴/🟠/🟡/🟢) — atanan + yönetici koyabilir (v7.13: artık sadece yönetici değil).
  // DB'ye yazılır; dashboard birkaç dk içinde yansıtır.
  if (!PRIORITY_REACTIONS.has(event.reaction)) return;

  const emoji    = REACTION_EMOJI[event.reaction];
  log(`öncelik reaction: ${emoji} — ${event.user} @ ${briefTs}`);
  // DB: priority emoji (reflectChange thread onayını düşürür) — kelime yolu ile aynı.
  dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}`, { priority: emoji, by: event.user, source: 'slack' });
});

// Brief tamamlama: ✅ reaction ile (yukarıdaki reaction_added handler → DB status).
// Eski brief_tamamla / brief_sure_uzat Block Kit buton handler'ları KALDIRILDI:
// hiçbir mesaj bu butonları render etmiyordu (ölü kod) + brief_tamamla bozuk MCP claude -p
// desenini kullanıyordu. Tamamlama artık ✅ reaction üzerinden deterministik çalışıyor.

// ─── Öneri 4: App Home Tab ────────────────────────────────────────────────────

app.event('app_home_opened', async ({ event, client }) => {
  const userId   = event.user;
  const yonetici = MANAGER_IDS.has(userId);

  try {
    const briefs   = await loadBriefs();

    let blocks;
    if (yonetici) {
      blocks = buildManagerHomeTab(briefs);
    } else {
      const profile = await client.users.info({ user: userId });
      const displayName = (profile.user.profile.display_name || profile.user.real_name || '').toLowerCase();
      const benimIslerim = briefs.filter(b => extractUserIds(b.atanan).includes(userId));
      blocks = buildDesignerHomeTab(displayName, benimIslerim);
    }

    await client.views.publish({ user_id: userId, view: { type: 'home', blocks } });
  } catch (err) {
    log(`app_home_opened hata: ${err.message}`);
    await client.views.publish({
      user_id: userId,
      view: { type: 'home', blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ Veriler yüklenemedi: ${err.message}` } }] },
    });
  }
});

// Türkçe deadline ("2 Haziran 2026" + "10:00 TR") geçmiş mi? (JS new Date() Türkçe ayı parse edemez)
const TR_AYLAR = { ocak:0, şubat:1, subat:1, mart:2, nisan:3, mayıs:4, mayis:4, may:4, haziran:5, haz:5, temmuz:6, tem:6, ağustos:7, agustos:7, eylül:8, eylul:8, ekim:9, eki:9, kasım:10, kasim:10, aralık:11, aralik:11 };
function deadlineGecti(deadline, saat) {
  const dm = (deadline || '').trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!dm) return false;
  const mon = TR_AYLAR[dm[2].toLowerCase()];
  if (mon == null) return false;
  const sm = (saat || '').match(/(\d{1,2}):(\d{2})/);
  const hh = sm ? +sm[1] : 23, mm = sm ? +sm[2] : 59;
  return Date.UTC(+dm[3], mon, +dm[1], hh - 3, mm) < Date.now(); // TR=UTC+3
}

function buildManagerHomeTab(briefs) {
  const acil    = briefs.filter(b => b.oncelik.includes('🔴'));
  // Gecikmiş: deadline gerçekten geçmiş (Türkçe parse) VEYA durum 'GEÇMİŞ' diyor
  const gecmis = briefs.filter(b => (b.durum && b.durum.includes('GEÇMİŞ')) || deadlineGecti(b.deadline, b.saat));

  // marka_stats.json'dan E3 mod durumunu oku
  let e3Durum = 'bilinmiyor';
  try {
    const stats = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'data/marka_stats.json'), 'utf8'));
    e3Durum = stats.config.current_mode === 'active' ? '🟢 Aktif' : `🟡 ${stats.config.current_mode}`;
  } catch (_) {}

  const tarih = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });

  return [
    { type: 'header', text: { type: 'plain_text', text: '📊 Genel Durum — ' + tarih, emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Aktif Brief:*\n${briefs.length}` },
        { type: 'mrkdwn', text: `*Acil (🔴):*\n${acil.length}` },
        { type: 'mrkdwn', text: `*Gecikmiş:*\n${gecmis.length}` },
        { type: 'mrkdwn', text: `*E3 Mod:*\n${e3Durum}` },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: acil.length === 0 ? '_Acil brief yok_ ✅' : acil.map(b => `🔴 *${b.marka}* — ${b.konu}  ⏰ ${b.deadline}`).join('\n') } },
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Detaylar için Slack Canvas\'a bak veya `/brief-durum` yaz.' }] },
  ];
}

function buildDesignerHomeTab(displayName, briefs) {
  const tarih = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
  return [
    { type: 'header', text: { type: 'plain_text', text: `🎨 ${displayName} — ${tarih}`, emoji: true } },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: briefs.length === 0
          ? '_Aktif işin yok_ ✅'
          : briefs.map(b => `${b.oncelik} *${b.marka}* — ${b.konu}\n⏰ ${b.deadline} ${b.saat}  |  📌 ${b.durum || '—'}`).join('\n\n'),
      },
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Toplam: *${briefs.length}* aktif iş  |  \`/brief-durum\` ile sorgula` }] },
  ];
}

// ─── Log Yardımcısı ────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const line = `[${ts}] ${msg}`;
  // Sadece dosyaya yaz — run-slack-bot.sh stdout'u zaten log'a yönlendiriyor,
  // console.log kullanılırsa her satır çift yazılır.
  try {
    fs.appendFileSync(path.join(PROJECT_DIR, 'logs/slack-bot.log'), line + '\n');
  } catch (_) { process.stderr.write(line + '\n'); }
}

// link "...p1779099416366989" → "1779099416.366989" (thread_ts ile eşleşir)
function tsFromLink(link) {
  const m = (link || '').match(/\/p(\d{16})/);
  return m ? m[1].slice(0, 10) + '.' + m[1].slice(10) : null;
}

// Brief thread'ine yazılan finansal mesajı işler — brief ts'i doğrudan API /by-ts endpoint'i ile çözülür.
// live-data.json bağımlılığı kaldırıldı (WT brief'leri orada yok; DB'yi doğrudan kullan).
// Anahtar kelimeler (yalnızca geçenler güncellenir, gerisi korunur):
//   maliyet 1500 · satış 4000 · "fatura ok"→kesildi · "fatura iptal"→geri · "ödeme ok"→yapıldı · "ödeme iptal"→geri
async function handleFinancialsThread(event, client) {
  const parentTs = event.thread_ts;
  const text = event.text || '';
  const by = event.user || '';
  const reply = (t) => client.chat.postMessage({ channel: event.channel, thread_ts: parentTs, text: t, username: BOT_NAME }).catch(() => {});

  // Sadece geçen alanları patch'e koy
  const patch = {};
  const mM = text.match(/maliyet[:\s]*₺?\s*([\d.,]+)/i); if (mM) patch.maliyet = mM[1];
  const sM = text.match(/sat[ıi][şs][:\s]*₺?\s*([\d.,]+)/i); if (sM) patch.satis = sM[1];
  if (/fatura\s*(ok|kesildi|tamam|evet|✅)/i.test(text)) patch.fatura = true;
  else if (/fatura\s*(iptal|yok|geri|sil|hay[ıi]r|❌)/i.test(text)) patch.fatura = false;
  if (/[öo]deme\s*(ok|yap[ıi]ld[ıi]|al[ıi]nd[ıi]|tamam|evet|✅)/i.test(text)) patch.odeme = true;
  else if (/[öo]deme\s*(iptal|yok|geri|sil|hay[ıi]r|❌)/i.test(text)) patch.odeme = false;

  if (Object.keys(patch).length === 0) {
    await reply('ℹ️ Format: `maliyet 1500 satış 4000` · `fatura ok` · `ödeme ok` · geri almak için `fatura iptal` / `ödeme iptal`.');
    return;
  }

  const dbFin = { by, source: 'slack' };
  if (patch.maliyet !== undefined) dbFin.maliyet = parseTRMoney(patch.maliyet);
  if (patch.satis !== undefined) dbFin.satis = parseTRMoney(patch.satis);
  if (patch.fatura !== undefined) dbFin.fatura = patch.fatura;
  if (patch.odeme !== undefined) dbFin.odeme = patch.odeme;

  // DB'ye yaz; false dönerse brief bu ts'e bağlı değil (404) veya hata
  const ok = await dbWrite('POST', `/api/briefs/by-ts/${parentTs}/financials`, dbFin);
  if (!ok) {
    await reply('⚠️ Bu thread bir brief mesajına bağlı değil (ya da brief henüz sisteme düşmedi). Bilgiyi *brief mesajının* altında thread olarak yaz.');
    return;
  }

  log(`thread financials → ts=${parentTs} patch=${JSON.stringify(patch)} (by ${by})`);
  const m = (v) => (v == null) ? '—' : Number(v).toLocaleString('tr-TR') + '₺';
  const flag = (v) => v === true ? '✅' : v === false ? '❌' : '—';
  const lines = [];
  if (dbFin.maliyet !== undefined) lines.push(`Maliyet: ${m(dbFin.maliyet)}`);
  if (dbFin.satis !== undefined) lines.push(`Satış: ${m(dbFin.satis)}`);
  if (patch.fatura !== undefined) lines.push(`Fatura: ${flag(patch.fatura)}`);
  if (patch.odeme !== undefined) lines.push(`Ödeme: ${flag(patch.odeme)}`);
  await reply(`✅ Finansal bilgi güncellendi:\n${lines.map(l => `• ${l}`).join('\n')}\n_Güncellemek için bu thread'e tekrar yaz. Birkaç dk içinde dashboard'a yansır._`);
}

// ── Serhat Tokmak yarım gün (hafta içi 08:00-13:00) — mesai dışı mention hatırlatması ──
const SERHAT_ID = 'U08HLMHTGEL';
function serhatMusaitMi() {
  // Europe/Istanbul duvar saati: hafta içi 08:00-13:00 arası müsait.
  const tr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const gun = tr.getDay();           // 0=Pazar .. 6=Cumartesi
  if (gun === 0 || gun === 6) return false;
  const saat = tr.getHours();
  return saat >= 8 && saat < 13;
}
const serhatHatirlatmaCache = new Map(); // thread_ts → son hatırlatma (ms) — spam önler
const SERHAT_HATIRLATMA_ARALIK = 30 * 60 * 1000; // aynı thread'de en fazla 30 dk'da bir

app.event('message', async ({ event, client }) => {
  // Slack thread silinince ilgili brief'i soft-delete yap
  if (event.subtype === 'message_deleted') {
    const deletedTs = event.deleted_ts;
    if (deletedTs) {
      log(`message_deleted: ${deletedTs}`);
      dbWrite('DELETE', `/api/briefs/by-ts/${deletedTs}`, { by: 'slack:deleted' }).catch(() => {});
    }
    return;
  }
  // Diğer düzenleme event'lerini yoksay
  if (event.subtype && event.subtype !== 'bot_message') return;
  // Text yoksa yoksay
  if (!event.text) return;

  // ── ODY DM DİYALOĞU ─────────────────────────────────────────────────────────
  // Bot'a gelen DM'ler Ody beynine gider: okur, kaydeder, yetki dahilinde aksiyon alır.
  // Döngü koruması: bot mesajları ve subtype'lar yukarıda elendi. "help" istisnası korunur.
  if (event.channel_type === 'im' && !event.bot_id && !/^help$/i.test(event.text.trim())) {
    log(`ody-dm ← ${event.user}: ${String(event.text).slice(0, 80)}`);
    try {
      const ODY_URL = process.env.ODY_URL || 'https://ody-core-production.up.railway.app';
      const r = await fetch(`${ODY_URL}/dm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ody-token': process.env.ODY_SERVICE_TOKEN || '' },
        body: JSON.stringify({ slack_id: event.user, text: event.text }),
        signal: AbortSignal.timeout(90000),   // LLM + tool turları 30sn+ sürebilir
      });
      const j = await r.json().catch(() => ({}));
      const reply = r.ok && j.reply ? j.reply : 'Şu an yanıt veremiyorum — birazdan tekrar dener misin? 🙏';
      // Yanıt kullanıcının mesajının THREAD'ine gider — konuşma tek zincirde kalır,
      // bildirim trafiğiyle karışmaz. Thread içinden devam edilirse aynı zincirde sürer.
      await client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts || event.ts, username: BOT_NAME, text: reply });
    } catch (e) {
      log(`ody-dm hata: ${e.message}`);
      client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts || event.ts, username: BOT_NAME,
        text: 'Şu an yanıt veremiyorum — birazdan tekrar dener misin? 🙏' }).catch(() => {});
    }
    return;
  }

  // ── Serhat mesai dışında mention'landıysa thread'e nazik hatırlatma ─────────
  // (yarım gün: hafta içi 08:00-13:00). Kendi mesajını ve bot mesajlarını atla; spam önlemek
  // için aynı thread'de 30 dk'da bir.
  if (!event.bot_id && event.user !== SERHAT_ID && event.text.includes(`<@${SERHAT_ID}>`) && !serhatMusaitMi()) {
    const key = event.thread_ts || event.ts;
    if (Date.now() - (serhatHatirlatmaCache.get(key) || 0) > SERHAT_HATIRLATMA_ARALIK) {
      serhatHatirlatmaCache.set(key, Date.now());
      client.chat.postMessage({
        channel: event.channel, thread_ts: key, username: BOT_NAME,
        text: ':wave: Serhat şu anda burada değil — yarım gün çalışıyor (hafta içi *08:00–13:00*). Mesajını mesai saatinde görüp dönecektir.',
      }).catch(() => {});
    }
  }

  // ── "help" → uygulama sorun/öneri bildirim formu ───────────────────────────
  // Herhangi bir kanalda tek başına "help" yazılırsa form butonu sunulur
  // (mesaj event'inde trigger_id olmadığı için modal ancak buton tıklamasıyla açılabilir).
  if (!event.bot_id && /^help$/i.test(event.text.trim())) {
    try {
      await client.chat.postMessage({
        channel: event.channel, thread_ts: event.thread_ts || event.ts, username: BOT_NAME,
        text: 'Uygulamayla ilgili sorun bildirmek ya da öneri sunmak için formu aç.',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '🛟 *Uygulama Geri Bildirimi*\nYaşadığın sorunu ya da önerini sistem adminlerine iletmek için formu doldur.' } },
          { type: 'actions', elements: [
            { type: 'button', action_id: 'bns_feedback_open', style: 'primary',
              text: { type: 'plain_text', text: '📝 Formu Aç' } },
          ] },
        ],
      });
    } catch (e) { log(`help formu butonu hata: ${e.message}`); }
    return;
  }

  // ── Thread'e yazılan durum emojisi (reaction'a alternatif) ──────────────────
  // Kullanıcı uzun bir thread'de ilk mesaja kaydırmadan durum bildirmek isteyebilir.
  // Thread yanıtına sadece 👀 / 🎨 / ✍️ / 🤖 / ✅ / ⏸️ / ✏️ / 🔃 yazılırsa DB'deki brief durumu güncellenir.
  // "Her iki tarafta da işleyebilmeli" — reaction veya metin emoji, sonuç aynı.
  // NOT: thread_ts = thread'in ANA mesajının ts'i (= brief slack_ts). Çözüm gerekmez.
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id) {
    const trimmed = (event.text || '').trim();

    // ── "proje: <ad>" — arşiv klasörünü üst işe/kampanyaya taşı (F3 köprüsü) ──
    // Sadece arşiv kaydı (arsiv_work_id) olan brief thread'lerinde yanıt verir;
    // kayıt yoksa sessizce yoksayılır (başka botların/konuşmaların thread'i olabilir).
    const projeMatch = trimmed.match(/^\s*proje\s*[:：]\s*(.+)/i);
    if (projeMatch) {
      const projeAd = projeMatch[1].trim();
      const briefTs = event.thread_ts;
      try {
        const pool = dbPool();
        const row = pool ? (await pool.query(
          'SELECT no, arsiv_work_id FROM briefs WHERE slack_ts=$1', [briefTs])).rows[0] : null;
        if (row && row.arsiv_work_id) {
          log(`proje taşıma: "${projeAd}" → work ${row.arsiv_work_id} (#${row.no}) — ${event.user}`);
          const arsiv = require('../server/arsiv.js');
          const res = await arsiv.reassign(row.arsiv_work_id, projeAd);
          const msg = !res ? '⚠️ Taşınamadı, Arşiv servisine ulaşılamadı.'
            : res.already ? `ℹ️ Bu iş zaten *${projeAd}* altında.`
            : (res.failed && res.failed.length && !(res.moved && res.moved.length))
              ? '⚠️ Taşınamadı, Arşiv servisine ulaşılamadı.'
              : `✅ *${projeAd}* üst işine taşındı.`;
          await client.chat.postMessage({ channel: event.channel, thread_ts: briefTs, text: msg, username: BOT_NAME });
        }
      } catch (e) { log(`proje taşıma hata: ${e.message}`); }
      return;
    }
    // Her emoji için Unicode (VS-16 dahil/hariç) VE Slack shortcode formunu yakala —
    // Slack, yazıyla girilen emojiyi event.text'te ':eyes:' gibi shortcode olarak iletebilir.
    const EMOJI_DURUM = [
      { emoji: '👀', durum: 'incelemede' }, { emoji: ':eyes:', durum: 'incelemede' },
      { emoji: '🎨', durum: 'calisiliyor' }, { emoji: ':art:', durum: 'calisiliyor' },
      { emoji: '✍️', durum: 'calisiliyor' },
      { emoji: '✍',  durum: 'calisiliyor' },   // VS-16 olmadan yazılabilir
      { emoji: ':writing_hand:', durum: 'calisiliyor' },
      { emoji: '🤖', durum: 'calisiliyor' }, { emoji: ':robot_face:', durum: 'calisiliyor' },
      { emoji: '🚀', durum: 'basladi' },
      { emoji: '📤', durum: 'kontrole' }, { emoji: ':outbox_tray:', durum: 'kontrole' }, { emoji: ':rocket:', durum: 'basladi' },
      { emoji: '✅', durum: 'tamamlandi'  }, { emoji: ':white_check_mark:', durum: 'tamamlandi' },
      { emoji: '⏸️', durum: 'beklemede'   },
      { emoji: '⏸',  durum: 'beklemede'   },   // VS-16 olmadan
      { emoji: ':double_vertical_bar:', durum: 'beklemede' },
      { emoji: '✏️', durum: 'revizyon'    },
      { emoji: '✏',  durum: 'revizyon'    },   // VS-16 olmadan
      { emoji: ':pencil2:', durum: 'revizyon' }, { emoji: ':pencil:', durum: 'revizyon' },
      { emoji: '🔃', durum: 'calisiliyor' },   // yeniden aç: tamamlananı devam ediyora çek
      { emoji: ':arrows_counterclockwise:', durum: 'calisiliyor' },
      { emoji: '🔄', durum: 'calisiliyor' },   // devam ediyor (/yardim'da belgeli)
      { emoji: ':arrows_clockwise:', durum: 'calisiliyor' },
      { emoji: '✈️', durum: 'musteride' },     // müşteriye yollandı (müşteri onayında)
      { emoji: '✈',  durum: 'musteride' },     // VS-16 olmadan
      { emoji: ':airplane:', durum: 'musteride' }, { emoji: ':small_airplane:', durum: 'musteride' },
      // Benseno özel emoji seti (thread'e yazıyla girilirse de yakala)
      { emoji: ':bso-calisiliyor:', durum: 'calisiliyor' },
      { emoji: ':bso-devam:', durum: 'calisiliyor' },
      { emoji: ':bso-yeniden-acildi:', durum: 'calisiliyor' },
      { emoji: ':bso-incelemede:', durum: 'incelemede' },
      { emoji: ':bso-beklemede:', durum: 'beklemede' },
      { emoji: ':bso-revizyon:', durum: 'revizyon' },
      { emoji: ':bso-musteriye:', durum: 'musteride' },
      { emoji: ':bso-tamamlandi:', durum: 'tamamlandi' },
    ];
    const eMatch = EMOJI_DURUM.find(e => trimmed.startsWith(e.emoji));
    if (eMatch) {
      const briefTs = event.thread_ts;  // thread reply'da thread_ts = brief ana mesajı ts'i
      const chk = await statusYetki(event.user, briefTs);
      if (!chk.ok) { await statusYetkiRed(client, event.user, chk, eMatch.durum); return; }
      log(`durum metin-emoji: ${eMatch.emoji} → ${eMatch.durum} | ${briefTs} — ${event.user}`);
      // DB'ye yaz (best-effort). writes.setStatus → reflectChange thread'e onay düşürür.
      wipStatusYaz(briefTs, event.channel, { durum: eMatch.durum, by: event.user, source: 'slack' });
      return;
    }

    // ── Thread'e yazılan öncelik emojisi (reaction'a alternatif) ──────────────
    const EMOJI_ONCELIK = [
      { emoji: '🔴', val: '🔴' }, { emoji: ':red_circle:', val: '🔴' },
      { emoji: '🟠', val: '🟠' }, { emoji: ':large_orange_circle:', val: '🟠' },
      { emoji: '🟡', val: '🟡' }, { emoji: ':large_yellow_circle:', val: '🟡' },
      { emoji: '🟢', val: '🟢' }, { emoji: ':large_green_circle:', val: '🟢' },
    ];
    const pMatch = EMOJI_ONCELIK.find(e => trimmed.startsWith(e.emoji));
    if (pMatch) {
      const briefTs = event.thread_ts;
      log(`öncelik metin-emoji: ${pMatch.val} | ${briefTs} — ${event.user}`);
      dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}`, { priority: pMatch.val, by: event.user, source: 'slack' });
      return;
    }

    // ── Thread'e yazılan durum/öncelik anahtar kelimeleri ─────────────────────
    // Örnek: "devam et", "tamamlandı", "acil öncelik" — emoji bulmaya gerek yok.
    const norm = trimmed.toLowerCase().replace(/[!.,\s]+$/, ''); // sondaki noktalama temizle
    const KEYWORD_MAP = [
      // Durum
      { key: 'devam et',       type: 'durum',    value: 'calisiliyor' },
      { key: 'devam ediyor',   type: 'durum',    value: 'calisiliyor' },
      { key: 'kontrole yolladım',   type: 'durum', value: 'kontrole' },
      { key: 'kontrole yolladim',   type: 'durum', value: 'kontrole' },
      { key: 'incelemeye yolladım', type: 'durum', value: 'kontrole' },
      { key: 'incelemeye yolladim', type: 'durum', value: 'kontrole' },
      { key: 'iş incelemede',   type: 'durum',    value: 'incelemede'  },
      { key: 'iş inceleme',     type: 'durum',    value: 'incelemede'  }, // sık yazılan kısa varyant
      { key: 'is incelemede',   type: 'durum',    value: 'incelemede'  }, // ASCII varyant
      { key: 'iş beklemede',    type: 'durum',    value: 'beklemede'   },
      { key: 'bekle',          type: 'durum',    value: 'beklemede'   },
      { key: 'revizyon var',   type: 'durum',    value: 'revizyon'    },
      { key: 'revize et',      type: 'durum',    value: 'revizyon'    },
      { key: 'iş tamamlandı',  type: 'durum',    value: 'tamamlandi'  },
      { key: 'is tamamlandi',  type: 'durum',    value: 'tamamlandi'  }, // ASCII varyant
      { key: 'yeniden aç',     type: 'durum',    value: 'calisiliyor' },
      { key: 'geri aç',        type: 'durum',    value: 'calisiliyor' },
      { key: 'bloke et',       type: 'durum',    value: 'blokeli'     },
      { key: 'faz ekle',       type: 'faz' },
      { key: 'yeni faz',       type: 'faz' },
      { key: 'müşteriye yollandı',  type: 'durum', value: 'musteride' },
      { key: 'müşteriye gönderildi', type: 'durum', value: 'musteride' },
      { key: 'musteriye yollandi',  type: 'durum', value: 'musteride' }, // ASCII varyant
      // Öncelik
      { key: 'acil öncelik',   type: 'priority', value: '🔴' },
      { key: 'acil oncelik',   type: 'priority', value: '🔴' }, // ASCII varyant
      { key: 'yüksek öncelik', type: 'priority', value: '🟠' },
      { key: 'yuksek oncelik', type: 'priority', value: '🟠' },
      { key: 'normal öncelik', type: 'priority', value: '🟡' },
      { key: 'normal oncelik', type: 'priority', value: '🟡' },
      { key: 'düşük öncelik',  type: 'priority', value: '🟢' },
      { key: 'dusuk oncelik',  type: 'priority', value: '🟢' },
    ];
    // "revize: @kişi" / "revizyon @kişi" — sıralı zincirde belirli halkaya geri sarar
    const revHedef = trimmed.match(/^reviz(?:e|yon)\s*:?\s*<@([A-Z0-9]+)(?:\|[^>]*)?>/i);
    if (revHedef) {
      const briefTs = event.thread_ts;
      log(`hedefli revizyon: @${revHedef[1]} | ${briefTs} — ${event.user}`);
      dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum: 'revizyon', hedef: revHedef[1], by: event.user, source: 'slack' });
      return;
    }

    // "termin uzat" — işe-dönüş hatırlatıcısı açıksa, beklemeye girerken teslime KALAN süre kadar MUAF uzatır (dönüş anından itibaren).
    if (/^(?:termin(?:i|ı)?\s+uzat|bekleme\s+kadar\s+uzat)$/i.test(trimmed)) {
      const briefTs = event.thread_ts;
      log(`termin uzat (muaf): ${briefTs} — ${event.user}`);
      const ok = await dbWrite('POST', `/api/briefs/by-ts/${briefTs}/termin-oneri-uzat`, { by: event.user });
      try {
        const msg = ok ? '✅ Termin bekleme süresi kadar uzatıldı — bu uzatma *gecikme sayılmaz*.'
          : 'ℹ️ Uzatma hatırlatıcısı açık değil (iş beklemede/müşterideden yeni dönmemiş). Belirli bir tarihe almak için: `termin 15.06 17:00`.';
        await client.chat.postMessage({ channel: event.channel, thread_ts: briefTs, text: msg, username: BOT_NAME });
      } catch {}
      return;
    }
    // "termin 15.06 17:00" / "deadline yarın 14:30" — termini günceller (saat yoksa 18:00)
    const tMatch = trimmed.match(/^(?:termin|deadline)\s*:?\s+(.+)$/i);
    if (tMatch) {
      const iso = parseTerminTR(tMatch[1]);
      const briefTs = event.thread_ts;
      if (iso) {
        log(`termin keyword: ${tMatch[1]} → ${iso} | ${briefTs} — ${event.user}`);
        dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}`, { deadline: iso, by: event.user, source: 'slack', slack_ts: event.event_ts });
      } else {
        try { await client.chat.postMessage({ channel: event.channel, thread_ts: briefTs,
          text: '⚠️ Termin formatını anlayamadım. Örnek: `termin 15.06 17:00` · `termin 15.06.2026` · `termin yarın 14:30` (saat yoksa 18:00 alınır).', username: BOT_NAME }); } catch {}
      }
      return;
    }

    const kMatch = KEYWORD_MAP.find(({ key }) => norm === key);
    if (kMatch) {
      const briefTs = event.thread_ts;
      if (kMatch.type === 'faz') {
        // Yeni faz kartı — buton modal açar (mesaj event'inde trigger_id yok)
        try {
          const bi = await fetch(`${API_BASE}/api/embedded`, { headers: { 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' } })
            .then(r => r.json()).then(ed => [...(ed.bns_briefs || []), ...(ed.bns_completed || [])].find(x => x.slack_ts === briefTs || x.thread_ozet_ts === briefTs));
          const hedefBrief = bi || null;
          await client.chat.postMessage({
            channel: event.channel, thread_ts: briefTs, username: BOT_NAME,
            text: 'Yeni faz açmak için butona bas.',
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', text: `🧩 *Yeni faz* — bu işin devamı ayrı bir iş olarak (kendi thread ve terminiyle) açılır.` } },
              { type: 'actions', elements: [{ type: 'button', style: 'primary', action_id: 'bns_faz_ac',
                value: JSON.stringify({ id: hedefBrief ? hedefBrief.id : null, no: hedefBrief ? hedefBrief.no : '?' }),
                text: { type: 'plain_text', text: '🧩 Faz aç' } }] },
            ],
          });
        } catch (e) { log(`faz kart hata: ${e.message}`); }
      } else if (kMatch.type === 'durum') {
        const chk = await statusYetki(event.user, briefTs);
        if (!chk.ok) { await statusYetkiRed(client, event.user, chk, kMatch.value); return; }
        log(`durum keyword: "${kMatch.key}" → ${kMatch.value} | ${briefTs} — ${event.user}`);
        wipStatusYaz(briefTs, event.channel, { durum: kMatch.value, by: event.user, source: 'slack', slack_ts: event.event_ts });
      } else {
        log(`öncelik keyword: "${kMatch.key}" → ${kMatch.value} | ${briefTs} — ${event.user}`);
        dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}`, { priority: kMatch.value, by: event.user, source: 'slack', slack_ts: event.event_ts });
      }
      return;
    }

    // ── "brief sil" / "bu brief'i sil" — soft delete ─────────────────────
    if (/^(bu\s+)?(brief[''i]*|[iı][şs]i?)\s*(sil|kald[ıi]r)$/i.test(norm)) {
      const briefTs = event.thread_ts;
      log(`brief sil: ${briefTs} — ${event.user}`);
      const ok = await dbWrite('DELETE', `/api/briefs/by-ts/${briefTs}`, { by: event.user });
      // Başarı notunu writes.deleteBrief thread'e düşürür (dashboard silmesiyle aynı mesaj).
      if (!ok) {
        await client.chat.postMessage({
          channel: event.channel, thread_ts: briefTs,
          text: '❌ Brief silinemedi (bulunamadı veya zaten silinmiş).',
        });
      }
      return;
    }
  }

  // ── Thread'e yazılan maliyet/satış girişi (brief no otomatik çözülür) ──
  // Reply (parent değil) + insan (bot değil) + maliyet/satış anahtar kelimesi → finansal işle.
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id &&
      /(maliyet|sat[ıi][şs]|fatura|[öo]deme)/i.test(event.text)) {
    await handleFinancialsThread(event, client);
    return;
  }

  // Eski free-text/Workflow brief formatı kaldırıldı — brief açmanın tek yolu /yeni-brief.
});

// ─── Başlat ───────────────────────────────────────────────────────────────────

(async () => {
  if (!process.env.SLACK_BOT_TOKEN) { console.error('SLACK_BOT_TOKEN eksik'); process.exit(1); }
  if (!process.env.SLACK_APP_TOKEN) { console.error('SLACK_APP_TOKEN eksik (Socket Mode için xapp-... token gerekli)'); process.exit(1); }

  await app.start();
  log('Benseno Slack Bot başlatıldı (Socket Mode)');
  syncAvatars(app.client);   // best-effort, açılışı bloklamaz
  flushQueue();              // restart sonrası bekleyen yazmaları (DB+dosya) işle
  setInterval(flushQueue, 30_000);  // API çökük→canlı geçişinde periyodik boşaltma
})();
