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
 * Brief'leri dashboard/app/live-data.json'dan okur (parseAktifIsler şekliyle uyumlu).
 * canvas_cache.md Railway'de yok (gitignored/dockerignored) → bunun yerine git'te
 * tracked + her boot reset --hard ile gelen + her orchestrator run'ında tazelenen
 * live-data.json'u kaynak alıyoruz. atanan: "<@ID> <@ID>" (extractUserIds uyumlu).
 */
function loadBriefs() {
  try {
    const raw = fs.readFileSync(path.join(PROJECT_DIR, 'dashboard/app/live-data.json'), 'utf8');
    const d = JSON.parse(raw);
    return (d.bns_briefs || []).map(b => ({
      no: b.no,
      dept: b.dept || '',
      marka: b.marka || '',
      konu: b.is || '',
      atanan: (b.atanan_ids || []).map(id => `<@${id}>`).join(' '),
      oncelik: b.priority || '',
      deadline: b.deadline || '',
      saat: b.saat || '',
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
    let briefs = loadBriefs();

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
    await respond({ response_type: 'ephemeral', text: `❌ Canvas okunamadı: ${err.message}` });
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
    const briefs   = loadBriefs();

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
    await respond({ response_type: 'ephemeral', text: `❌ Canvas okunamadı: ${err.message}` });
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
    await execFileAsync('node', [`${PROJECT_DIR}/scripts/set-financials.js`, no, maliyetRaw, satisRaw, by],
      { cwd: PROJECT_DIR, timeout: 120000 });
    log(`/maliyet → #${no} maliyet="${maliyetRaw}" satış="${satisRaw}" (by ${by})`);
    // Girene özel onay DM'i
    try {
      const txt = (maliyetRaw === '' && satisRaw === '')
        ? `✅ Brief #${no} maliyet/satış kaydı temizlendi.`
        : `✅ Brief #${no} kaydedildi — maliyet: ${maliyetRaw || '—'}₺ · satış: ${satisRaw || '—'}₺. Birkaç dk içinde dashboard'da görünür.`;
      await client.chat.postMessage({ channel: by, text: txt });
    } catch {}
  } catch (err) {
    log(`/maliyet set-financials hata: ${err.message}`);
    try { await client.chat.postMessage({ channel: by, text: `❌ Brief #${no} kaydedilemedi: ${err.message}` }); } catch {}
  }
});

// ─── Aşama D: Reaction Override (anlık) ───────────────────────────────────────

app.event('reaction_added', async ({ event, client }) => {
  // Mesaj tipinde değilse yoksay (dosya, canvas üzeri olabilir)
  if (event.item.type !== 'message') return;

  // ✅ Brief tamamlama (atanan/editör/yönetici — yetkiyi script kontrol eder).
  // Deterministik: brief'i bns_briefs→bns_completed taşır + push. MCP/claude gerektirmez.
  if (event.reaction === 'white_check_mark') {
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`✅ tamamlama: ${event.item.ts} — ${event.user}`);
    execFile('node', [`${PROJECT_DIR}/scripts/complete-brief.js`, event.item.ts, event.user, saat],
      { cwd: PROJECT_DIR, timeout: 120000, env: process.env },
      (err, stdout, stderr) => {
        if (err) log(`complete-brief hata: ${err.message} ${(stderr || '').slice(0, 200)}`);
        else log(`complete-brief: ${(stdout || '').trim().split('\n').pop()}`);
      });
    return;
  }

  // Durum geçişi (atanan/editör/yönetici — yetkiyi script kontrol eder). Departmana özel
  // başla emojileri: 🎨 art (tasarım) · ✍️ writing_hand (editör) · 🤖 robot_face (AI) · 👀 eyes (revize sun).
  // Deterministik, MCP gerektirmez. Skin-tone varyantını normalize et (✍️🏽 vb).
  const reactionBase = event.reaction.replace(/::skin-tone-\d+$/, '');
  if (['art', 'writing_hand', 'robot_face', 'eyes'].includes(reactionBase)) {
    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    log(`durum reaction: :${reactionBase}: ${event.item.ts} — ${event.user}`);
    execFile('node', [`${PROJECT_DIR}/scripts/brief-status.js`, event.item.ts, reactionBase, event.user, saat],
      { cwd: PROJECT_DIR, timeout: 120000, env: process.env },
      (err, stdout, stderr) => {
        if (err) log(`brief-status hata: ${err.message} ${(stderr || '').slice(0, 200)}`);
        else log(`brief-status: ${(stdout || '').trim().split('\n').pop()}`);
      });
    return;
  }

  // Öncelik override (🔴/🟠/🟡/🟢) — atanan + yönetici koyabilir (v7.13: artık sadece yönetici değil).
  // Yetkiyi reaction-override.js kontrol eder (brief atananları ∪ editör ∪ yöneticiler).
  if (!PRIORITY_REACTIONS.has(event.reaction)) return;

  const emoji    = REACTION_EMOJI[event.reaction];
  const ts       = event.item.ts;
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
    const briefs   = loadBriefs();

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

// Thread parent ts'ine göre brief no'sunu bul (aktif + tamamlanan). Yoksa null.
function resolveBriefByTs(parentTs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'dashboard/app/live-data.json'), 'utf8'));
    for (const list of [d.bns_briefs || [], d.bns_completed || []]) {
      for (const b of list) {
        if (tsFromLink(b.link) === parentTs) return { no: b.no, baslik: b.baslik || b.is || '' };
      }
    }
  } catch (e) { log(`resolveBriefByTs hata: ${e.message}`); }
  return null;
}

const FIN_STORE = path.join(PROJECT_DIR, 'data/brief-financials.json');

// Brief thread'ine yazılan "maliyet 1500 satış 4000" tipi mesajı işler.
// Brief, thread parent ts'inden otomatik çözülür (kullanıcı no girmez). Kısmi güncelleme:
// sadece "maliyet X" yazılırsa satış korunur (mevcut değerle birleştirilir).
async function handleFinancialsThread(event, client) {
  const parentTs = event.thread_ts;
  const text = event.text || '';
  const by = event.user || '';
  const reply = (t) => client.chat.postMessage({ channel: event.channel, thread_ts: parentTs, text: t }).catch(() => {});

  const found = resolveBriefByTs(parentTs);
  if (!found) { await reply('ℹ️ Bu thread bir brief mesajına bağlı değil (ya da brief henüz sisteme düşmedi). Maliyet/satışı *brief mesajının* altında thread olarak yaz.'); return; }

  const mMatch = text.match(/maliyet[:\s]*₺?\s*([\d.,]+)/i);
  const sMatch = text.match(/sat[ıi][şs][:\s]*₺?\s*([\d.,]+)/i);
  if (!mMatch && !sMatch) {
    await reply(`ℹ️ Format: \`maliyet 1500 satış 4000\` (ikisi birlikte) veya tek tek \`maliyet 1500\` / \`satış 4000\`. Brief #${found.no}.`);
    return;
  }

  // Mevcut store ile birleştir (verilmeyen alan korunur)
  let store = {}; try { store = JSON.parse(fs.readFileSync(FIN_STORE, 'utf8')); } catch {}
  const cur = store[String(found.no)] || {};
  const maliyetArg = mMatch ? mMatch[1] : (cur.maliyet != null ? String(cur.maliyet) : '');
  const satisArg   = sMatch ? sMatch[1] : (cur.satis   != null ? String(cur.satis)   : '');

  try {
    await execFileAsync('node', [`${PROJECT_DIR}/scripts/set-financials.js`, String(found.no), maliyetArg, satisArg, by],
      { cwd: PROJECT_DIR, timeout: 120000 });
    log(`thread financials → #${found.no} maliyet="${maliyetArg}" satış="${satisArg}" (by ${by})`);
    const fmt = (v) => (v === '' || v == null) ? '—' : v + '₺';
    await reply(`✅ *${found.baslik}* (#${found.no}) kaydedildi — maliyet: ${fmt(maliyetArg)} · satış: ${fmt(satisArg)}.\nGüncellemek için bu thread'e tekrar yaz (ör. \`maliyet 2000\`). Birkaç dk içinde dashboard'a yansır.`);
  } catch (err) {
    log(`thread financials hata: ${err.message}`);
    await reply(`❌ Kaydedilemedi (#${found.no}): ${err.message}`);
  }
}

app.event('message', async ({ event, client }) => {
  // Düzenleme/silme event'lerini yoksay
  if (event.subtype && event.subtype !== 'bot_message') return;
  // Text yoksa yoksay
  if (!event.text) return;

  // ── Thread'e yazılan maliyet/satış girişi (brief no otomatik çözülür) ──
  // Reply (parent değil) + insan (bot değil) + maliyet/satış anahtar kelimesi → finansal işle.
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id &&
      /(maliyet|sat[ıi][şs])/i.test(event.text)) {
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
