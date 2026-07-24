'use strict';
// ── ODY SAĞLAYICI ŞABLONU ───────────────────────────────────────────────────
// Herhangi bir projeyi Ody'ye bağlamak için kopyala. Express uygulamana MCP
// endpoint'i ekler; araçlarını tanımlarsın, Ody gerisini halleder.
//
// Kurulum:  npm i @modelcontextprotocol/sdk
// Kullanım:
//   const { odyProvider } = require('./ody-provider');
//   odyProvider(app, {
//     ad: 'arsiv', surum: '1.0.0',
//     sistemBilgisi: 'Bu sistem Benseno Arşiv... (Ody prompt'una girer)',
//     guard: (req,res,next) => { /* token kontrolü */ next(); },
//     araclar: {
//       dosya_ara: {
//         description: 'Arşivde dosya/iş ara',
//         input_schema: { type:'object', properties:{ q:{type:'string'} }, required:['q'] },
//         run: async (input, kimlik) => ({ sonuclar: [] }),   // kimlik: {kullanici,isAdmin,...}
//       },
//     },
//   });
// Sonra ody-core'un kaynaklar tablosuna bir satır: ad + https://.../mcp + token env adı.
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

function odyProvider(app, { ad, surum = '1.0.0', sistemBilgisi = '', guard = (_q, _s, n) => n(), araclar = {} }) {
  function buildServer() {
    const server = new Server({ name: ad, version: surum },
      { capabilities: { tools: {} }, instructions: sistemBilgisi });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(araclar).map(([name, a]) => ({
        name, description: a.description || '', inputSchema: a.input_schema || { type: 'object', properties: {} },
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      const kimlik = (req.params._meta && req.params._meta.bns) || {};
      const a = araclar[name];
      if (!a) return { content: [{ type: 'text', text: JSON.stringify({ hata: 'bilinmeyen araç: ' + name }) }], isError: true };
      try {
        const out = await a.run(args || {}, kimlik);
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ hata: e.message }) }], isError: true };
      }
    });
    return server;
  }
  app.post('/mcp', guard, async (req, res) => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: 'mcp sunucu hatası' });
    }
  });
  app.get('/mcp', guard, (_q, res) => res.status(405).json({ error: 'stateless mcp: yalnız POST' }));
}

module.exports = { odyProvider };
