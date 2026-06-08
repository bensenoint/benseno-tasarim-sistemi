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
async function dbWrite(method, urlPath, body) {
  try {
    const r = await fetch(`${API_BASE}${urlPath}`, {
      method, headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' }, body: JSON.stringify(body),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); log(`DB ${method} ${urlPath} → ${r.status} ${j.error || ''}`); return false; }
    log(`DB ${method} ${urlPath} ✓`);
    return true;
  } catch (e) { log(`DB ${method} ${urlPath} hata: ${e.message}`); return false; }
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
  'U09BZHR25NG', // Eda Tireli
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
  'U09BZHR25NG': 'Eda Tireli',
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
]);

const REACTION_EMOJI = {
  red_circle:          '🔴',
  large_orange_circle: '🟠',
  large_yellow_circle: '🟡',
  large_green_circle:  '🟢',
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
    const r = await fetch(`${API_BASE}/api/embedded`, { cache: 'no-store' });
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
        '`/brief-durum` — Sana atanmış aktif brifleri listeler\n' +
        '`/kapasite` — Ekip kapasitesini gösterir _(Yönetici)_\n' +
        '`/maliyet` — Brief maliyet/satış bilgisi girer'
      }},

      { type: 'divider' },

      // Emoji kısayolları
      { type: 'section', text: { type: 'mrkdwn', text: '*Emoji kısayolları* — brief thread\'ine tek emoji yaz' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: '🔄 → Devam Ediyor\n👀 → İncelemede\n⏸️ → Beklemede\n✅ → Tamamlandı\n✏️ → Revizyon\n🔃 → Yeniden Aç' },
        { type: 'mrkdwn', text: '*Öncelik:*\n🔴 → Acil\n🟠 → Yüksek\n🟡 → Normal\n🟢 → Düşük' },
      ]},

      { type: 'divider' },

      // Kelime kısayolları
      { type: 'section', text: { type: 'mrkdwn', text: '*Kelime kısayolları* — brief thread\'ine tam olarak şunu yaz' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text:
          '`devam et` → Devam Ediyor\n' +
          '`iş incelemede` → İncelemede\n' +
          '`iş beklemede` → Beklemede\n' +
          '`revizyon var` · `revize et` → Revizyon\n' +
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

      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Dashboard: <https://bensenoint.github.io|bensenoint.github.io>' }] },
    ],
  });
});

// ─── /yeni-brief — Slack'ten deterministik brief açma (Faz 3, LLM'siz) ────────
// Block Kit modal → POST /api/briefs → DB + markanın kanalına post. Slash command'ı
// Slack app config'inde (api.slack.com/apps → Slash Commands) /yeni-brief olarak kayıtlı olmalı.
app.command('/yeni-brief', async ({ command, ack, client, respond }) => {
  await ack();
  // Marka kanaldan belirlenir — komut hangi marka kanalında çalıştıysa o marka.
  const marka = brandFromChannelName(command.channel_name);
  if (!marka) {
    try { await respond({ response_type: 'ephemeral', text: '⚠️ /yeni-brief komutunu bir *marka kanalında* (ör. #marka-bauhaus) çalıştır — brief o marka için açılır.' }); } catch {}
    return;
  }
  try {
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
          { type: 'input', block_id: 'deadline_b', optional: true, label: { type: 'plain_text', text: 'Deadline (tarih + saat)' },
            element: { type: 'datetimepicker', action_id: 'deadline' } },
          { type: 'input', block_id: 'workers_b', label: { type: 'plain_text', text: 'İşi yapan(lar)' },
            element: { type: 'multi_users_select', action_id: 'workers', placeholder: { type: 'plain_text', text: 'Kişi(ler) — departman buradan belirlenir' } } },
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
  await ack();
  const by      = body.user?.id || '';
  const dtSec   = v.deadline_b?.deadline?.selected_date_time || null;  // Unix saniye (tarih+saat)
  const leads   = v.leads_b?.leads?.selected_users || [];
  const gozlemci = v.gozlemci_b?.gozlemci?.selected_users || [];
  const fileIds = (v.dosya_b?.dosya?.files || []).map(f => f.id);
  const aciklama = (v.not_b?.aciklama?.value || '').trim();
  const payload = {
    marka, baslik,
    deadline: dtSec ? new Date(dtSec * 1000).toISOString() : null,
    worker_ids: workers,
    lead_ids: leads.length ? leads : undefined,
    gozlemci_ids: gozlemci.length ? gozlemci : undefined,
    musteri_notu: aciklama || undefined,
    by, source: 'dashboard',   // !== 'slack' → createBrief markanın kanalına post eder
  };
  try {
    const r = await fetch(`${API_BASE}/api/briefs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
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

app.event('reaction_added', async ({ event, client }) => {
  // Mesaj tipinde değilse yoksay (dosya, canvas üzeri olabilir)
  if (event.item.type !== 'message') return;

  // ✅/durum/öncelik reaction'ları brief'in ANA mesajına bağlıdır. Kullanıcı thread
  // yanıtına koyduysa parent ts'e çöz (Bug 1) — tüm handler'lar bunu kullanır.
  const briefTs = await resolveBriefTs(client, event.item.channel, event.item.ts);

  // ✅ Brief tamamlama (atanan/editör/yönetici — yetkiyi script kontrol eder).
  // Deterministik: brief'i bns_briefs→bns_completed taşır + push. MCP/claude gerektirmez.
  if (event.reaction === 'white_check_mark') {
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`✅ tamamlama: ${briefTs} — ${event.user}`);
    // Thread'deki son görseli onay öncesi yakala → galeri için image_url'e kaydet
    captureThreadImage(client, event.item.channel, briefTs).catch(() => {});
    execFile('node', [`${PROJECT_DIR}/scripts/complete-brief.js`, briefTs, event.user, saat],
      { cwd: PROJECT_DIR, timeout: 120000, env: process.env },
      (err, stdout, stderr) => {
        if (err) log(`complete-brief hata: ${err.message} ${(stderr || '').slice(0, 200)}`);
        else log(`complete-brief: ${(stdout || '').trim().split('\n').pop()}`);
      });
    // DB'ye de (b3, best-effort): brief'i slack_ts ile bul → tamamlandı.
    dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum: 'tamamlandi', by: event.user, source: 'slack' });
    return;
  }

  // Durum geçişi (atanan/editör/yönetici — yetkiyi script kontrol eder). Departmana özel
  // başla emojileri: 🎨 art (tasarım) · ✍️ writing_hand (editör) · 🤖 robot_face (AI) · 👀 eyes (revize sun).
  // Yeni: ✏️ pencil2 (revizyon) · ⏸️ double_vertical_bar (beklemede) · 🔃 arrows_counterclockwise (yeniden aç)
  // Deterministik, MCP gerektirmez. Skin-tone varyantını normalize et (✍️🏽 vb).
  const reactionBase = event.reaction.replace(/::skin-tone-\d+$/, '');
  const DURUM_MAP = {
    art: 'calisiliyor', writing_hand: 'calisiliyor', robot_face: 'calisiliyor',
    eyes: 'incelemede',
    double_vertical_bar: 'beklemede',
    pencil2: 'revizyon', pencil: 'revizyon',
    arrows_counterclockwise: 'calisiliyor',  // yeniden aç: tamamlandı → devam ediyor
  };
  if (reactionBase in DURUM_MAP) {
    const durum = DURUM_MAP[reactionBase];
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`durum reaction: :${reactionBase}: → ${durum} @ ${briefTs} — ${event.user}`);
    execFile('node', [`${PROJECT_DIR}/scripts/brief-status.js`, briefTs, reactionBase, event.user, saat],
      { cwd: PROJECT_DIR, timeout: 120000, env: process.env },
      (err, stdout, stderr) => {
        if (err) log(`brief-status hata: ${err.message} ${(stderr || '').slice(0, 200)}`);
        else log(`brief-status: ${(stdout || '').trim().split('\n').pop()}`);
      });
    // DB'ye de (b3, best-effort): emoji → durum kodu.
    dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum, by: event.user, source: 'slack' });
    return;
  }

  // Öncelik override (🔴/🟠/🟡/🟢) — atanan + yönetici koyabilir (v7.13: artık sadece yönetici değil).
  // Yetkiyi reaction-override.js kontrol eder (brief atananları ∪ editör ∪ yöneticiler).
  if (!PRIORITY_REACTIONS.has(event.reaction)) return;

  const emoji    = REACTION_EMOJI[event.reaction];
  const ts       = briefTs;
  const channel  = event.item.channel;
  const yonetici = event.user;
  const saat     = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

  log(`Reaction override: ${emoji} — ${yonetici} @ ${ts}`);

  // Deterministik script (LLM değil): live-data priority'yi anında günceller, EMBEDDED_DATA'yı
  // enjekte eder, priority-overrides.json'a yazar (kalıcı), git push. MCP/claude gerektirmez.
  try {
    execFile('node', [`${PROJECT_DIR}/scripts/reaction-override.js`, ts, emoji, yonetici, saat],
      { cwd: PROJECT_DIR, timeout: 120000, env: process.env },
      (err, stdout, stderr) => {
        if (err) log(`reaction-override hata: ${err.message} ${(stderr || '').slice(0, 200)}`);
        else log(`reaction-override: ${(stdout || '').trim().split('\n').pop()}`);
      }
    );
  } catch (err) {
    log(`reaction-override spawn hata: ${err.message}`);
  }
});

// Brief tamamlama: ✅ reaction ile (yukarıdaki reaction_added handler → complete-brief.js).
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

// ─── Öneri 5: Brief Validation (Ephemeral) ───────────────────────────────────
//
// Marka kanallarında Workflow brief mesajı geldiğinde anında validate eder.
// Sadece brief açana görünen ephemeral uyarı gönderir.
//
// Tespit edilen sorunlar:
//   1. Deadline geçmişte → işlenmeyecek uyarısı
//   2. Aynı gün brief + saat yok → saat ekle uyarısı
//   3. Tasarımcı atanmamış → bilgilendirme

/**
 * Slack'te gelen brief mesajından alanları parse eder.
 * Workflow mesajları emoji başlıklı satırlardan oluşur:
 *   🔔 İş: ...
 *   ⏰ Süre: May 21st, 2026 at 10:00 AM UTC
 *   👤 Kim: @İpek, @Görkem Kaya
 *   🐷 Kimden: @Görkem Kaya
 */
function parseBriefMesaji(text) {
  if (!text) return null;

  // Workflow brief'i tanı: en az İş + Süre alanı olmalı
  const isMatch   = text.match(/[İI]ş\s*[:\-]\s*(.+)/i);
  const sureMatch = text.match(/Süre\s*[:\-]\s*(.+)/i);
  if (!isMatch || !sureMatch) return null;

  const kimMatch    = text.match(/Kim\s*[:\-]\s*(.+)/i);
  const kimdenMatch = text.match(/Kimden\s*[:\-]\s*<@(U[A-Z0-9]+)>/i);

  return {
    is:        isMatch[1].trim(),
    sureStr:   sureMatch[1].trim(),
    kim:       kimMatch ? kimMatch[1].trim() : '',
    kimdenId:  kimdenMatch ? kimdenMatch[1] : null,
  };
}

/**
 * "May 21st, 2026 at 10:00 AM UTC" gibi stringleri Date'e çevirir.
 * Saat bilgisi yoksa null döner (aynı gün uyarısı için).
 */
function parseSure(sureStr) {
  // "at HH:MM" veya "at H:MM AM/PM" içeriyorsa saat var
  const saatVar = /at \d+:\d+/i.test(sureStr);

  const d = new Date(sureStr);
  if (isNaN(d.getTime())) return { date: null, saatVar: false };

  return { date: d, saatVar };
}

// ─── Brief Queue ─────────────────────────────────────────────────────────────
// Bot yeni brief mesajlarını data/brief-queue.json'a yazar.
// Brief Sync çalışırken Slack kanallarını taramak yerine bu dosyayı okur — token tasarrufu.

const BRIEF_QUEUE_PATH = path.join(PROJECT_DIR, 'data/brief-queue.json');

function queueeEkle(entry) {
  try {
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(BRIEF_QUEUE_PATH, 'utf8')); } catch (_) {}
    // Aynı ts zaten varsa ekleme (duplicate önleme)
    if (queue.some(e => e.ts === entry.ts && e.channel === entry.channel)) return;
    queue.push(entry);
    fs.writeFileSync(BRIEF_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');
    log(`Brief queue'ya eklendi: ${entry.channel} @ ${entry.ts} — "${entry.is}"`);
  } catch (err) {
    log(`Brief queue yazma hatası: ${err.message}`);
  }
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

app.event('message', async ({ event, client }) => {
  // Düzenleme/silme event'lerini yoksay
  if (event.subtype && event.subtype !== 'bot_message') return;
  // Text yoksa yoksay
  if (!event.text) return;

  // ── Thread'e yazılan durum emojisi (reaction'a alternatif) ──────────────────
  // Kullanıcı uzun bir thread'de ilk mesaja kaydırmadan durum bildirmek isteyebilir.
  // Thread yanıtına sadece 👀 / 🎨 / ✍️ / 🤖 / ✅ / ⏸️ / ✏️ / 🔃 yazılırsa DB'deki brief durumu güncellenir.
  // "Her iki tarafta da işleyebilmeli" — reaction veya metin emoji, sonuç aynı.
  // NOT: thread_ts = thread'in ANA mesajının ts'i (= brief slack_ts). Çözüm gerekmez.
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id) {
    const trimmed = (event.text || '').trim();
    // Her emoji için hem tam Unicode (variation selector dahil) hem çıplak formu yakala.
    const EMOJI_DURUM = [
      { emoji: '👀', durum: 'incelemede' },
      { emoji: '🎨', durum: 'calisiliyor' },
      { emoji: '✍️', durum: 'calisiliyor' },
      { emoji: '✍',  durum: 'calisiliyor' },   // VS-16 olmadan yazılabilir
      { emoji: '🤖', durum: 'calisiliyor' },
      { emoji: '✅', durum: 'tamamlandi'  },
      { emoji: '⏸️', durum: 'beklemede'   },
      { emoji: '⏸',  durum: 'beklemede'   },   // VS-16 olmadan
      { emoji: '✏️', durum: 'revizyon'    },
      { emoji: '✏',  durum: 'revizyon'    },   // VS-16 olmadan
      { emoji: '🔃', durum: 'calisiliyor' },   // yeniden aç: tamamlananı devam ediyora çek
    ];
    const eMatch = EMOJI_DURUM.find(e => trimmed.startsWith(e.emoji));
    if (eMatch) {
      const briefTs = event.thread_ts;  // thread reply'da thread_ts = brief ana mesajı ts'i
      log(`durum metin-emoji: ${eMatch.emoji} → ${eMatch.durum} | ${briefTs} — ${event.user}`);
      // DB'ye yaz (best-effort). writes.setStatus → reflectChange thread'e onay düşürür.
      dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum: eMatch.durum, by: event.user, source: 'slack' });
      return;
    }

    // ── Thread'e yazılan durum/öncelik anahtar kelimeleri ─────────────────────
    // Örnek: "devam et", "tamamlandı", "acil öncelik" — emoji bulmaya gerek yok.
    const norm = trimmed.toLowerCase().replace(/[!.,\s]+$/, ''); // sondaki noktalama temizle
    const KEYWORD_MAP = [
      // Durum
      { key: 'devam et',       type: 'durum',    value: 'calisiliyor' },
      { key: 'devam ediyor',   type: 'durum',    value: 'calisiliyor' },
      { key: 'iş incelemede',   type: 'durum',    value: 'incelemede'  },
      { key: 'iş beklemede',    type: 'durum',    value: 'beklemede'   },
      { key: 'bekle',          type: 'durum',    value: 'beklemede'   },
      { key: 'revizyon var',   type: 'durum',    value: 'revizyon'    },
      { key: 'revize et',      type: 'durum',    value: 'revizyon'    },
      { key: 'iş tamamlandı',  type: 'durum',    value: 'tamamlandi'  },
      { key: 'is tamamlandi',  type: 'durum',    value: 'tamamlandi'  }, // ASCII varyant
      { key: 'yeniden aç',     type: 'durum',    value: 'calisiliyor' },
      { key: 'geri aç',        type: 'durum',    value: 'calisiliyor' },
      { key: 'bloke et',       type: 'durum',    value: 'blokeli'     },
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
    const kMatch = KEYWORD_MAP.find(({ key }) => norm === key);
    if (kMatch) {
      const briefTs = event.thread_ts;
      if (kMatch.type === 'durum') {
        log(`durum keyword: "${kMatch.key}" → ${kMatch.value} | ${briefTs} — ${event.user}`);
        dbWrite('POST', `/api/briefs/by-ts/${briefTs}/status`, { durum: kMatch.value, by: event.user, source: 'slack' });
      } else {
        log(`öncelik keyword: "${kMatch.key}" → ${kMatch.value} | ${briefTs} — ${event.user}`);
        dbWrite('PATCH', `/api/briefs/by-ts/${briefTs}`, { priority: kMatch.value, by: event.user, source: 'slack' });
      }
      return;
    }
  }

  // ── "brief sil" / "bu brief'i sil" — soft delete ────────────────────────
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id &&
      /^(bu\s+)?(brief[''i]*|[iı][şs]i?)\s*(sil|kald[ıi]r)$/i.test(norm)) {
    const briefTs = event.thread_ts;
    log(`brief sil: ${briefTs} — ${event.user}`);
    const ok = await dbWrite('DELETE', `/api/briefs/by-ts/${briefTs}`, { by: event.user });
    await client.chat.postMessage({
      channel: event.channel, thread_ts: briefTs,
      text: ok ? '🗑️ Brief silindi. Dashboard → Silinenler ekranından geri alınabilir.' : '❌ Brief silinemedi (bulunamadı veya yetki yok).',
    });
    return;
  }

  // ── Thread'e yazılan maliyet/satış girişi (brief no otomatik çözülür) ──
  // Reply (parent değil) + insan (bot değil) + maliyet/satış anahtar kelimesi → finansal işle.
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id &&
      /(maliyet|sat[ıi][şs]|fatura|[öo]deme)/i.test(event.text)) {
    await handleFinancialsThread(event, client);
    return;
  }

  // Brief mi? (bot_id olsa da workflow brief'leri dahil)
  const brief = parseBriefMesaji(event.text);
  if (!brief) return; // Brief mesajı değil

  // Kendi botumuzun mesajlarını yoksay (sonsuz döngü önleme)
  if (event.bot_id && !brief.kimdenId) return;

  const kimdenId = brief.kimdenId || event.user;
  if (!kimdenId) return;

  const channel = event.channel;

  // ── Queue'ya ekle (Brief Sync kanal taramasını bypass eder) ──
  queueeEkle({
    ts:         event.ts,
    channel,
    text:       event.text,
    user:       event.user || kimdenId,
    is:         brief.is,
    queued_at:  new Date().toISOString(),
  });

  const uyarilar = [];

  // 1) Deadline parse
  const { date: deadline, saatVar } = parseSure(brief.sureStr);
  const simdi = new Date();
  const trBugün = new Date(simdi.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));

  if (deadline) {
    // Deadline geçmişte mi?
    if (deadline < simdi) {
      const gunFarki = Math.round((simdi - deadline) / (1000 * 60 * 60 * 24));
      uyarilar.push(
        `⚠️ *Deadline geçmişte!* Brief şu an işlenmeyecek.\n` +
        `Deadline ${gunFarki > 0 ? gunFarki + ' gün önce geçti' : 'geçti'}. ` +
        `Tarihi güncelleyip yeniden gönder.`
      );
    } else {
      // Aynı gün ama saat girilmemiş mi?
      const deadlineTR = new Date(deadline.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
      const ayniGun = (
        deadlineTR.getFullYear() === trBugün.getFullYear() &&
        deadlineTR.getMonth()    === trBugün.getMonth() &&
        deadlineTR.getDate()     === trBugün.getDate()
      );
      if (ayniGun && !saatVar) {
        uyarilar.push(
          `⚠️ *Bugün için brief ama saat belirtilmemiş.*\n` +
          `Aynı günlük briflerde saat zorunlu. Brief mesajına reply olarak saat ekle (örn: "14:00").`
        );
      }
    }
  }

  // 2) Tasarımcı atanmamış mı?
  const kimStr = brief.kim;
  const mentionVar = /<@U[A-Z0-9]+>/.test(kimStr);
  if (!kimStr || !mentionVar) {
    uyarilar.push(
      `ℹ️ *Tasarımcı atanmamış.*\n` +
      `Brief Canvas'a eklendi ama "Kim" alanı boş. ` +
      `Canvas'taki satıra 👤 ile tasarımcı adını ekle.`
    );
  }

  if (uyarilar.length === 0) return; // Her şey tamam, uyarı gönderme

  const mesaj = uyarilar.join('\n\n');
  log(`Brief validation uyarısı → ${kimdenId}: ${uyarilar.length} sorun`);

  try {
    await client.chat.postEphemeral({
      channel,
      user: kimdenId,
      text: mesaj,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📋 Brief Kontrolü — ${brief.is}*\n\n${mesaj}` },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: '_Sadece sen görüyorsun · Brief Sync her :15/:45\'te çalışır_' }],
        },
      ],
    });
  } catch (err) {
    log(`brief-validation ephemeral hata: ${err.message}`);
  }
});

// ─── Başlat ───────────────────────────────────────────────────────────────────

(async () => {
  if (!process.env.SLACK_BOT_TOKEN) { console.error('SLACK_BOT_TOKEN eksik'); process.exit(1); }
  if (!process.env.SLACK_APP_TOKEN) { console.error('SLACK_APP_TOKEN eksik (Socket Mode için xapp-... token gerekli)'); process.exit(1); }

  await app.start();
  log('Benseno Slack Bot başlatıldı (Socket Mode)');
})();
