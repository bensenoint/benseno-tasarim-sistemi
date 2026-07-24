'use strict';
// ── MCP KAYNAK YÖNETİCİSİ ────────────────────────────────────────────────────
// Kayıtlı kaynaklara (kaynaklar tablosu) MCP istemcisi olarak bağlanır; araç
// listelerini "kaynak__arac" önekiyle birleştirir (Anthropic araç adı regex'i
// nokta kabul etmez → çift alt çizgi). 10 dk cache. Erişilemeyen kaynak o tur
// ATLANIR — Ody kalan kaynaklarla bağımsız devam eder.
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { pool } = require('./db');

const CACHE_MS = 10 * 60 * 1000;
let _cache = { ts: 0, kaynaklar: [] };   // [{ad, client, tools:[...], instructions}]

async function _baglan(row) {
  const headers = {};
  const tok = row.token_env && process.env[row.token_env];
  if (tok) headers['x-bns-token'] = tok;
  const client = new Client({ name: 'ody-core', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(row.base_url), {
    requestInit: { headers },
  });
  await client.connect(transport);
  const t = await client.listTools();
  return {
    ad: row.ad, client,
    instructions: (client.getInstructions && client.getInstructions()) || '',
    tools: t.tools.map(x => ({
      name: `${row.ad}__${x.name}`,
      description: `[${row.ad}] ${x.description || ''}`,
      input_schema: x.inputSchema || { type: 'object', properties: {} },
    })),
  };
}

// Aktif kaynakları yükle (cache'li). force=true cache'i yok sayar.
async function yukle(force = false) {
  if (!force && Date.now() - _cache.ts < CACHE_MS && _cache.kaynaklar.length) return _cache.kaynaklar;
  // Eski bağlantıları kapat
  for (const k of _cache.kaynaklar) { try { await k.client.close(); } catch (e) {} }
  // ODY_KAYNAKLAR env'i (JSON dizi) DB'yi ezer — yerel test/acil durum için.
  const rows = process.env.ODY_KAYNAKLAR
    ? JSON.parse(process.env.ODY_KAYNAKLAR)
    : (await pool.query(`SELECT ad, base_url, token_env FROM kaynaklar WHERE aktif`)).rows;
  const out = [];
  for (const row of rows) {
    try { out.push(await _baglan(row)); }
    catch (e) { console.warn(`[kaynak] ${row.ad} erişilemedi — atlanıyor:`, e.message); }
  }
  _cache = { ts: Date.now(), kaynaklar: out };
  return out;
}

// Birleşik araç listesi (Anthropic formatı). "_" ile başlayan araçlar İÇ kullanımdır
// (kimlik çözümü vb.) — LLM'e verilmez, calistir() ile yine çağrılabilir.
async function araclar() {
  return (await yukle()).flatMap(k => k.tools)
    .filter(t => !t.name.slice(t.name.indexOf('__') + 2).startsWith('_'));
}

// Kaynak instructions blokları (sistem prompt'una eklenir)
async function sistemBilgileri() {
  return (await yukle())
    .filter(k => k.instructions)
    .map(k => `# SİSTEM KULLANIM BİLGİSİ (${k.ad})\n${k.instructions}`)
    .join('\n\n');
}

// "kaynak__arac" çağrısını ilgili MCP sunucusuna yönlendir. meta → _meta.bns.
async function calistir(fullName, args, meta) {
  const i = fullName.indexOf('__');
  if (i < 0) return { hata: 'bilinmeyen araç: ' + fullName };
  const kaynakAd = fullName.slice(0, i), arac = fullName.slice(i + 2);
  const k = (await yukle()).find(x => x.ad === kaynakAd);
  if (!k) return { hata: `kaynak erişilemez: ${kaynakAd}` };
  const cagri = () => k.client.callTool(
    { name: arac, arguments: args || {}, _meta: { bns: meta } },
    undefined, { timeout: 60000 });
  let res;
  try { res = await cagri(); }
  catch (e) {
    // Bağlantı düşmüş olabilir → kaynağı tazele, bir kez daha dene
    console.warn(`[kaynak] ${kaynakAd} çağrı hatası, yeniden bağlanılıyor:`, e.message);
    await yukle(true);
    const k2 = _cache.kaynaklar.find(x => x.ad === kaynakAd);
    if (!k2) return { hata: `kaynak erişilemez: ${kaynakAd}` };
    try {
      res = await k2.client.callTool({ name: arac, arguments: args || {}, _meta: { bns: meta } }, undefined, { timeout: 60000 });
    } catch (e2) { return { hata: `araç çalıştırılamadı: ${e2.message}` }; }
  }
  // MCP text içeriği JSON string'dir (sunucu JSON.stringify ile döner) — geri çöz.
  const text = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  try { return JSON.parse(text); } catch (e) { return { metin: text }; }
}

module.exports = { yukle, araclar, sistemBilgileri, calistir };
