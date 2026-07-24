// ── ODY SAĞLAYICISI (ESM sürümü) ────────────────────────────────────────────
// "type":"module" projeler için. CommonJS projede ody-provider.cjs kullan.
// Kullanım için README.md'ye bak. npm i @modelcontextprotocol/sdk gerekir.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export function odyProvider(app, { ad, surum = "1.0.0", sistemBilgisi = "", guard = (_q, _s, n) => n(), araclar = {} }) {
  function buildServer() {
    const server = new Server({ name: ad, version: surum },
      { capabilities: { tools: {} }, instructions: sistemBilgisi });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(araclar).map(([name, a]) => ({
        name, description: a.description || "", inputSchema: a.input_schema || { type: "object", properties: {} },
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      const kimlik = (req.params._meta && req.params._meta.bns) || {};
      const a = araclar[name];
      if (!a) return { content: [{ type: "text", text: JSON.stringify({ hata: "bilinmeyen araç: " + name }) }], isError: true };
      try {
        const out = await a.run(args || {}, kimlik);
        return { content: [{ type: "text", text: JSON.stringify(out) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ hata: e.message }) }], isError: true };
      }
    });
    return server;
  }
  app.post("/mcp", guard, async (req, res) => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: "mcp sunucu hatası" });
    }
  });
  app.get("/mcp", guard, (_q, res) => res.status(405).json({ error: "stateless mcp: yalnız POST" }));
}
