#!/usr/bin/env node
/**
 * create-slack-list.js
 * Canvas'taki aktif brief'leri Slack List olarak oluşturur / günceller.
 *
 * Kullanım:
 *   node scripts/create-slack-list.js            → yeni list oluştur + doldur
 *   node scripts/create-slack-list.js --update    → mevcut list'i temizle + yeniden doldur
 *   LIST_ID=F0B... node scripts/create-slack-list.js --update  → belirtilen list'i güncelle
 *
 * Gereksinimler:
 *   - data/.slack-bot-token  (xoxb-...)
 *   - data/marka_stats.json  veya  dashboard/app/live-data.json
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const PROJ = path.resolve(__dirname, '..');
const BOT_TOKEN = fs.readFileSync(path.join(PROJ, 'data/.slack-bot-token'), 'utf8').trim();
// User token: liste oluşturma + kayıt yazma için (bot token field değeri yazamıyor)
const USER_TOKEN_PATH = path.join(PROJ, 'data/.slack-user-token');
const USER_TOKEN = fs.existsSync(USER_TOKEN_PATH)
  ? fs.readFileSync(USER_TOKEN_PATH, 'utf8').trim()
  : BOT_TOKEN;

// Veri kaynağı: live-data.json (Brief Sync'in son çıktısı) ya da canvas_cache fallback
function loadBriefs() {
  const liveDataPath = path.join(PROJ, 'dashboard/app/live-data.json');
  const canvasCachePath = path.join(PROJ, 'data/canvas_cache.md');

  if (fs.existsSync(liveDataPath)) {
    const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
    const briefs = raw.bns_briefs || [];
    console.log(`📂 Kaynak: live-data.json → ${briefs.length} aktif brief`);
    return { briefs, completed: raw.bns_completed || [], lastSync: raw.last_sync || '' };
  }

  // Fallback: canvas_cache.md'den parse
  console.log('⚠️  live-data.json yok, canvas_cache.md parse ediliyor...');
  return { briefs: parseCanvasCache(canvasCachePath), completed: [], lastSync: '' };
}

function parseCanvasCache(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const briefs = [];
  const lines = text.split('\n');
  for (const line of lines) {
    // Satır format: * **Marka — Başlık** (Lead, DD Ay HH:MM TR · ...
    const m = line.match(/^\*\s+\*\*(.*?)\*\*/);
    if (m) briefs.push({ baslik: m[1], marka: '', priority: '🟡', durum: 'yeni' });
  }
  return briefs;
}

// Slack API helper
function slackApi(method, body, useUserToken = false) {
  return new Promise((resolve, reject) => {
    const token = useUserToken ? USER_TOKEN : BOT_TOKEN;
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'slack.com',
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Brief'i Slack List record adına dönüştür
function briefToName(b) {
  const prio = b.priority || '🟡';
  const marka = (b.brand?.name || b.marka || '').trim();
  const baslik = (b.baslik || b.title || '').trim();
  const lead = b.lead?.name || '';
  const durum = statusLabel(b.durum || '');

  // Lead: ilk isim yeterli
  const leadFirst = lead.split(' ')[0];

  // Deadline
  let dl = '';
  if (b.deadline) {
    try {
      const d = new Date(b.deadline);
      const TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      dl = `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch(_) {}
  }

  // Format: emoji · Marka · Başlık · Lead · Deadline · Durum
  const parts = [prio, marka, baslik];
  if (leadFirst) parts.push(`👤 ${leadFirst}`);
  if (dl) parts.push(`⏰ ${dl}`);
  if (durum) parts.push(durum);
  return parts.join(' · ');
}

function statusLabel(durum) {
  const map = {
    'yeni': '🆕 Yeni', 'tasarimda': '🎨 Tasarımda', 'incelemede': '👀 İncelemede',
    'onaylandi': '✅ Onaylandı', 'revizyon': '🔄 Revizyon', 'bekliyor': '⏸ Bekliyor'
  };
  return map[durum] || durum;
}

// Mevcut list'teki tüm kayıtları sil
async function clearList(listId) {
  console.log('🗑  Mevcut kayıtlar siliniyor...');
  // lists.records.list
  const res = await slackApi('lists.records.list', { list_id: listId, limit: 200 });
  if (!res.ok) { console.log('  records.list →', res.error); return; }
  const records = res.records || [];
  console.log(`  ${records.length} kayıt bulundu`);
  for (const rec of records) {
    const del = await slackApi('lists.records.delete', { list_id: listId, id: rec.id });
    process.stdout.write(del.ok ? '.' : 'x');
  }
  if (records.length > 0) console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const doUpdate = args.includes('--update');
  const existingId = process.env.LIST_ID || '';

  const { briefs, completed, lastSync } = loadBriefs();

  if (briefs.length === 0) {
    console.error('❌ Brief verisi bulunamadı. Brief Sync önce çalıştırılmalı.');
    process.exit(1);
  }

  let listId = existingId;

  if (!listId || !doUpdate) {
    // Yeni list oluştur
    const now = new Date();
    const listName = `Benseno Aktif İşler — ${now.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][now.getMonth()]} ${now.getFullYear()}`;
    console.log(`📋 Yeni list oluşturuluyor: "${listName}"...`);
    const created = await slackApi('lists.create', { name: listName }, true);
    if (!created.ok) {
      console.error('❌ list oluşturulamadı:', created.error);
      process.exit(1);
    }
    listId = created.list.id;
    const url = created.list.permalink || '';
    console.log(`✅ List oluşturuldu: ${listId}`);
    console.log(`🔗 URL: ${url}`);

    // List ID'yi kaydet (bir sonraki --update için)
    fs.writeFileSync(path.join(PROJ, 'data/.slack-list-id'), listId);
  } else {
    console.log(`♻️  Mevcut list güncelleniyor: ${listId}`);
    await clearList(listId);
  }

  // Brief'leri önceliğe göre sırala: 🔴 → 🟠 → 🟡 → 🟢
  const prioOrder = { '🔴': 0, '🟠': 1, '🟡': 2, '🟢': 3 };
  const sorted = [...briefs].sort((a, b) =>
    (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9)
  );

  console.log(`\n📝 ${sorted.length} brief ekleniyor...`);
  let added = 0, failed = 0;

  for (const brief of sorted) {
    const name = briefToName(brief);
    const res = await slackApi('lists.records.create', {
      list_id: listId,
      values: { name: { value: name } }
    }, true);
    if (res.ok) { added++; process.stdout.write('✓'); }
    else         { failed++; process.stdout.write('✗'); console.error(` [${brief.marka}] ${res.error}`); }
    // Rate limit: 10 req/sn
    await new Promise(r => setTimeout(r, 110));
  }
  console.log('');

  // Tamamlananlar bölümü (son 10)
  const recentDone = (completed || []).slice(0, 10);
  if (recentDone.length > 0) {
    console.log(`\n✅ Son ${recentDone.length} tamamlanan ekleniyor...`);
    for (const b of recentDone) {
      const name = briefToName({ ...b, priority: '✅' });
      await slackApi('lists.records.create', {
        list_id: listId,
        values: { name: { value: name } }
      }, true);
      process.stdout.write('✓');
      await new Promise(r => setTimeout(r, 110));
    }
    console.log('');
  }

  console.log(`\n🎉 Tamamlandı! ${added} aktif + ${recentDone.length} tamamlanan kayıt eklendi.`);
  if (failed > 0) console.log(`⚠️  ${failed} kayıt başarısız.`);
  console.log(`📎 List: https://benseno.slack.com/lists/T4Y3R6RAN/${listId}`);

  if (lastSync) console.log(`⏱  Veri kaynağı sync: ${lastSync}`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
