'use strict';
// ── MCP SUNUCUSU (tasarim kaynağı) ──────────────────────────────────────────
// ody-tools araçlarını MCP protokolüyle (streamable HTTP, stateless) yayınlar.
// Ody-core buraya MCP istemcisi olarak bağlanır; araç kodu ody-tools.js'te KALIR,
// burada yalnız sarmalanır (calc.js kopya/imaj kuralları değişmez).
//
// Kimlik & onay: ody-core her tools/call'a _meta.bns ekler:
//   { kullanici:{id,slack_id,name,role}, isAdmin, range, reqSeq, son_mesaj }
// ctx (user/isAdmin/range/ed/reqSeq/onay) BURADA kurulur — sunucu-tarafı onay
// tespiti (slack_gonder döngü kırıcı) kaynakta yaşamaya devam eder.
//
// Koruma: x-bns-token (writeGuard ile aynı sır). Instructions = chat-bilgi.md
// (sistem kullanım bilgisi) → Ody prompt'unu kaynağa göre kurar.
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const odyTools = require('./ody-tools');
const { getEmbedded } = require('./queries');

const CHAT_BILGI = (() => {
  try { return require('fs').readFileSync(require('path').join(__dirname, 'chat-bilgi.md'), 'utf8'); }
  catch (e) { console.error('[mcp] chat-bilgi okunamadı:', e.message); return ''; }
})();

// Onay ifadesi tespiti — api.js'teki sunucu-tarafı kuralla birebir aynı.
function onayMi(sonMesaj, slackId) {
  const s = String(sonMesaj || '').trim();
  try {
    return odyTools.gonderBekliyor(slackId)
      && s.length <= 60
      && /(^|\s)(evet|onay(l[ıi]yorum|la)?|g[öo]nder(ebil[a-zçğıöşü]*)?|olur|tamam(d[ıi]r)?|yes|ok(ey)?|send)\b/i.test(s)
      && !/(g[öo]nderme|onaylam[ıi]yorum|hay[ıi]r|iptal|dur|vazge[çc])/i.test(s);
  } catch (e) { return false; }
}

function buildServer() {
  const server = new Server(
    { name: 'benseno-tasarim', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: CHAT_BILGI }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...odyTools.TOOLS.map(t => ({
        name: t.name, description: t.description, inputSchema: t.input_schema,
      })),
      // Ody-core'un Slack DM kimlik çözümü için (LLM'e görünmesi zararsız ama gereksiz;
      // öncelikle ody-core /dm tarafı çağırır): slack_id → {name, rol, admin}
      { name: '_kimlik', description: 'Slack kullanıcısını sistemde tanı (iç kullanım): slack_id → ad/rol',
        inputSchema: { type: 'object', properties: { slack_id: { type: 'string' } }, required: ['slack_id'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const meta = (req.params._meta && req.params._meta.bns) || {};
    const user = meta.kullanici || { id: null, slack_id: null, name: 'bilinmiyor', role: 'user' };
    const ed = await getEmbedded();
    try { odyTools.tatilYukle(ed.bns_tatiller || []); } catch (e) {}
    const ctx = {
      user, isAdmin: !!meta.isAdmin,
      range: meta.range || null, ed,
      reqSeq: Number(meta.reqSeq) || 0,
      onay: onayMi(meta.son_mesaj, user.slack_id),
    };
    try {
      if (name === '_kimlik') {
        const sid = String((args || {}).slack_id || '');
        const kisi = (ed.bns_users || []).find(x => x.id === sid);
        const out = kisi
          ? { bulundu: true, name: kisi.name, rol: kisi.rol || null,
              admin: kisi.rol === 'yonetici' || kisi.yetki === 'yonetici' }
          : { bulundu: false };
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      }
      const out = await odyTools.runTool(name, args || {}, ctx);
      return { content: [{ type: 'text', text: JSON.stringify(out) }] };
    } catch (e) {
      console.error('[mcp] tool hata:', name, e.message);
      return { content: [{ type: 'text', text: JSON.stringify({ hata: e.message }) }], isError: true };
    }
  });
  return server;
}

// Stateless mount: her POST kendi transport'unu kurar (oturum takibi yok — Ody-core
// her sohbette initialize + list + call yapar; 10 dk araç cache'i istemci tarafında).
function mountMcp(app, guard) {
  app.post('/mcp', guard, async (req, res) => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error('[mcp] istek hatası:', e.message);
      if (!res.headersSent) res.status(500).json({ error: 'mcp sunucu hatası' });
    }
  });
  // GET/DELETE (oturumlu istemciler için) — stateless modda desteklenmez.
  app.get('/mcp', guard, (_req, res) => res.status(405).json({ error: 'stateless mcp: yalnız POST' }));
  app.delete('/mcp', guard, (_req, res) => res.status(405).json({ error: 'stateless mcp: yalnız POST' }));
}

module.exports = { mountMcp };
