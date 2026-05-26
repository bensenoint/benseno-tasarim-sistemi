'use strict';

/**
 * Benseno Slack Bot — v1.0
 * Socket Mode ile çalışır, public URL gerekmez.
 * Komutlar: /brief-durum, /kapasite
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

// ─── /brief-durum ─────────────────────────────────────────────────────────────

app.command('/brief-durum', async ({ command, ack, respond, client }) => {
  await ack();

  const userId  = command.user_id;
  const filtre  = command.text.trim().toLowerCase();
  const yonetici = MANAGER_IDS.has(userId);

  try {
    const markdown = await fetchCanvas(client);
    let briefs = parseAktifIsler(markdown);

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
    const markdown = await fetchCanvas(client);
    const briefs   = parseAktifIsler(markdown);

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

// ─── Aşama D: Reaction Override (anlık) ───────────────────────────────────────

app.event('reaction_added', async ({ event, client }) => {
  // Yönetici değilse yoksay
  if (!MANAGER_IDS.has(event.user)) return;
  // Öncelik reaction'ı değilse yoksay
  if (!PRIORITY_REACTIONS.has(event.reaction)) return;
  // Mesaj tipinde değilse yoksay (dosya, canvas üzeri olabilir)
  if (event.item.type !== 'message') return;

  const emoji    = REACTION_EMOJI[event.reaction];
  const ts       = event.item.ts;
  const channel  = event.item.channel;
  const yonetici = event.user;
  const saat     = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

  log(`Reaction override: ${emoji} — ${yonetici} @ ${ts}`);

  // Brief Sync skill'ini çağır: override'ı işlesin, Canvas'ı güncellesin
  try {
    const prompt = `Skill: benseno-reaction-override — brief_ts: ${ts} kanal: ${channel} emoji: ${emoji} yonetici: ${yonetici} saat: ${saat}`;
    execFile('/bin/sh', ['-c', `/opt/homebrew/bin/claude -p "${prompt}" --print --dangerously-skip-permissions < /dev/null`],
      { cwd: PROJECT_DIR, timeout: 300000, env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH } },
      (err, stdout, stderr) => {
        if (err) log(`reaction-override hata: ${err.message}`);
        else log(`reaction-override tamamlandı: ${stdout.slice(0, 100)}`);
      }
    );
  } catch (err) {
    log(`reaction-override spawn hata: ${err.message}`);
  }
});

// ─── Öneri 3: Brief Tamamlama Action ──────────────────────────────────────────

app.action('brief_tamamla', async ({ body, ack, client }) => {
  await ack();

  const userId  = body.user.id;
  const briefNo = body.actions[0].value; // brief numarası

  log(`brief_tamamla: ${briefNo} — ${userId}`);

  // Brief Sync'i çağır — tamamlandı işlemi
  execFile('/bin/sh',
    ['-c', `/opt/homebrew/bin/claude -p "Skill: benseno-brief-tamamla — no: ${briefNo} tasarimci: ${userId}" --print --dangerously-skip-permissions < /dev/null`],
    { cwd: PROJECT_DIR, timeout: 300000, env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH } },
    async (err, stdout) => {
      if (err) {
        await client.chat.postEphemeral({ channel: body.channel?.id || userId, user: userId, text: `❌ İşaretleme başarısız: ${err.message}` });
      } else {
        await client.chat.postEphemeral({ channel: body.channel?.id || userId, user: userId, text: `✅ Brief tamamlandı olarak işaretlendi! Canvas güncelleniyor...` });
      }
    }
  );
});

app.action('brief_sure_uzat', async ({ body, ack, client }) => {
  await ack();
  await client.chat.postEphemeral({
    channel: body.channel?.id || body.user.id,
    user: body.user.id,
    text: `📅 Süre uzatmak için #marka-brief-form kanalında ilgili brief mesajına yeni deadline'ı reply olarak yaz. Brief Sync otomatik güncelleyecek.`,
  });
});

// save_as_brief shortcut kaldırıldı — Slack Workflow zaten bu işi yapıyor

// ─── Öneri 4: App Home Tab ────────────────────────────────────────────────────

app.event('app_home_opened', async ({ event, client }) => {
  const userId   = event.user;
  const yonetici = MANAGER_IDS.has(userId);

  try {
    const markdown = await fetchCanvas(client);
    const briefs   = parseAktifIsler(markdown);

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

function buildManagerHomeTab(briefs) {
  const acil    = briefs.filter(b => b.oncelik.includes('🔴'));
  // Deadline geçmiş brief'leri tespit et: durum alanında 'GEÇMİŞ' veya deadline tarihi bugünden önce
  const simdi = new Date();
  const gecmis = briefs.filter(b => {
    if (b.durum && b.durum.includes('GEÇMİŞ')) return true;
    if (b.deadline) {
      const d = new Date(b.deadline);
      if (!isNaN(d.getTime()) && d < simdi) return true;
    }
    return false;
  });

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

app.event('message', async ({ event, client }) => {
  // Düzenleme/silme event'lerini yoksay
  if (event.subtype && event.subtype !== 'bot_message') return;
  // Text yoksa yoksay
  if (!event.text) return;

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

// ─── Slack List Güncelleme ────────────────────────────────────────────────────

const LIVE_DATA_PATH   = path.join(PROJECT_DIR, 'dashboard/app/live-data.json');
const SLACK_LIST_SCRIPT = path.join(PROJECT_DIR, 'scripts/create-slack-list.js');
const SLACK_LIST_ID_PATH = path.join(PROJECT_DIR, 'data/.slack-list-id');

// Güncelleme kilidi — Brief Sync 30sn'de bir çalışabilir, çakışmayı önle
let listUpdateRunning = false;

async function updateSlackList(reason) {
  if (listUpdateRunning) {
    log(`Slack List güncelleme zaten çalışıyor, atlandı (${reason})`);
    return;
  }
  listUpdateRunning = true;

  // Mevcut list ID varsa --update, yoksa yeni oluştur
  const listIdExists = fs.existsSync(SLACK_LIST_ID_PATH) &&
    fs.readFileSync(SLACK_LIST_ID_PATH, 'utf8').trim().length > 0;

  const args  = listIdExists ? ['--update'] : [];
  const label = listIdExists ? '--update' : 'yeni list';

  log(`Slack List güncelleniyor (${reason} · ${label})...`);

  try {
    await new Promise((resolve, reject) => {
      // LIST_ID env'e geçir (--update için)
      const env = { ...process.env };
      if (listIdExists) env.LIST_ID = fs.readFileSync(SLACK_LIST_ID_PATH, 'utf8').trim();

      execFile(process.execPath, [SLACK_LIST_SCRIPT, ...args], { cwd: PROJECT_DIR, timeout: 120000, env },
        (err, stdout, stderr) => {
          if (err) { log(`Slack List hata: ${err.message}\n${stderr}`); reject(err); }
          else      { log(`Slack List güncellendi ✅\n${stdout.trim().slice(0, 200)}`); resolve(); }
        }
      );
    });
  } catch (_) {
    // Hata loglandı — devam et
  } finally {
    listUpdateRunning = false;
  }
}

// /slack-list-guncelle — yöneticiye özel manuel tetikleme
app.command('/slack-list-guncelle', async ({ command, ack, respond, client }) => {
  await ack();

  if (!MANAGER_IDS.has(command.user_id)) {
    await respond({ response_type: 'ephemeral', text: '⛔ Bu komut sadece yöneticiler içindir.' });
    return;
  }

  await respond({ response_type: 'ephemeral', text: '🔄 Slack List güncelleniyor…' });

  const listIdExists = fs.existsSync(SLACK_LIST_ID_PATH) &&
    fs.readFileSync(SLACK_LIST_ID_PATH, 'utf8').trim().length > 0;
  const listId = listIdExists ? fs.readFileSync(SLACK_LIST_ID_PATH, 'utf8').trim() : null;

  await updateSlackList('manuel komut');

  const url = listId
    ? `https://benseno.slack.com/lists/T4Y3R6RAN/${listId}`
    : (fs.existsSync(SLACK_LIST_ID_PATH) ? `https://benseno.slack.com/lists/T4Y3R6RAN/${fs.readFileSync(SLACK_LIST_ID_PATH,'utf8').trim()}` : '');

  try {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `✅ Slack List güncellendi!${url ? `\n🔗 ${url}` : ''}`,
    });
  } catch (_) {}
});

// live-data.json değişince otomatik güncelle
// (Brief Sync her :15/:45'te bu dosyayı günceller)
function watchLiveData() {
  if (!fs.existsSync(LIVE_DATA_PATH)) {
    log('live-data.json henüz yok — 60sn sonra tekrar denenecek');
    setTimeout(watchLiveData, 60000);
    return;
  }

  fs.watchFile(LIVE_DATA_PATH, { interval: 15000 }, (curr, prev) => {
    // Dosya değiştiyse (mtime veya boyut farklıysa) güncelle
    if (curr.mtimeMs !== prev.mtimeMs) {
      log('live-data.json değişti → Slack List otomatik güncelleniyor...');
      updateSlackList('live-data.json değişimi');
    }
  });

  log(`live-data.json izleniyor (${LIVE_DATA_PATH})`);
}

// ─── Başlat ───────────────────────────────────────────────────────────────────

(async () => {
  if (!process.env.SLACK_BOT_TOKEN) { console.error('SLACK_BOT_TOKEN eksik'); process.exit(1); }
  if (!process.env.SLACK_APP_TOKEN) { console.error('SLACK_APP_TOKEN eksik (Socket Mode için xapp-... token gerekli)'); process.exit(1); }

  await app.start();
  log('Benseno Slack Bot başlatıldı (Socket Mode)');

  // live-data.json izlemeyi başlat
  watchLiveData();
})();
