# Ody-Core: Bağımsız, MCP Tabanlı Asistan Servisi — Tasarım

**Karar (Görkem onaylı):** Tam MCP standardı · tek seferde taşıma (eval kapısı + anında geri dönüş) · Ody'nin kendi Postgres'i.

## Amaç
Ody'yi benseno-api'nin içinden çıkarıp kendi başına çalışan, birden fazla projeye
(tasarım sistemi, arşiv programı, gelecektekiler) MCP üzerinden bağlanan modüler bir
servise dönüştürmek. Ody tek soruda birden fazla kaynaktan veri çekip birleştirebilmeli;
bir kaynak çökse bile kalanlarla çalışmaya devam etmeli.

## Mimari

```
dashboard ─┐                       ┌─ benseno-api /mcp   (tasarim.* araçları)
Slack bot ─┼─→  ody-core (Railway) ┼─ arşiv-api  /mcp    (arsiv.*  araçları)
brifingler ┘    · kendi Postgres   └─ gelecek projeler...
                · MCP istemcisi (host)
                · model kademesi + kişilik + hafıza
```

### ody-core servisi
- **Railway'de üçüncü servis**, repo içinde `ody-core/` klasörü, kendi Dockerfile'ı
  (yalnız `ody-core/` içerir — server/ imaj kuralıyla aynı disiplin).
- **Kendi Postgres'i** (Railway eklentisi): `sohbet_log`, `kullanici_hafiza`,
  `kaynaklar(ad, base_url, token_env, aktif)`, `maliyet_log`. Mevcut `ody_chat_log`
  ve hafıza verisi tek seferlik taşınır.
- **MCP istemcisi:** açılışta + her sohbet başında (10 dk cache) kayıtlı kaynaklara
  bağlanır (`streamable HTTP`), `tools/list` toplar; araç adları `kaynakadi.araç`
  önekiyle birleştirilir. Erişilemeyen kaynak o sohbette atlanır (log'lanır).
- **HTTP API:** `POST /chat` (dashboard, JWT paylaşımlı sır ile doğrulanır),
  `POST /dm` (Slack köprüsü, servis token), `GET /health`, `GET /kaynaklar` (admin).
- Çekirdekte kalanlar: kademeli model (veri=Haiku, sentez=Sonnet, "opus"=Opus,
  hataya Sonnet düşüşü), boş-cevap güvenliği, sunucu-tarafı onay tespiti (ctx.onay),
  BUGÜN tarihi, Türkçe kişilik prompt'u, DM geçmişi (10 msj/2 saat).
- `ANTHROPIC_API_KEY` yalnız bu serviste.

### benseno-api = MCP sunucusu
- `server/mcp.js`: mevcut `ody-tools.js` araçlarını MCP protokolüne sarar
  (`@modelcontextprotocol/sdk`, streamable HTTP, `/mcp` path'i, `x-bns-token` koruması).
- Araç kodu ve calc.js kopya kuralları DEĞİŞMEZ; yalnız sarmalama eklenir.
- Kimlik: ody-core her `tools/call`'a `_meta.kullanici` (slack_id, rol) ekler;
  yetki kontrolü kaynakta (mevcut ctx mantığı) kalır.
- Sunucu tanıtımında `sistem_bilgisi` metni döner → Ody prompt'unu kaynaklara göre kurar.

### Sağlayıcı şablonu
- `ody-core/provider-sablonu/`: yeni projede MCP sunucusu açmayı ~10 satıra indiren
  yardımcı + arşiv projesi için bağlantı dokümanı.

## Tek-seferde geçiş (güvenlik ağıyla)
1. ody-core canlıya alınır, tasarim kaynağı bağlanır.
2. **Eval kapısı:** 11 vakalık Ody eval seti ody-core'a karşı 11/11 geçmeden trafik dönmez.
3. Kesim: dashboard `ODY_URL` → ody-core; Slack bot DM köprüsü → ody-core;
   zamanlanmış brifingler LLM çağrılarını ody-core üzerinden yapar.
4. benseno-api'deki eski `/api/chat` + `/api/ody-dm` 410 + yönlendirme döner
   (1 hafta sonra silinir). Geri dönüş = env'i eski adrese çevirmek.

## Fazlar
1. ody-core iskeleti: DB + migration'lar + MCP istemci + model kademesi + /chat
2. benseno-api /mcp sunucusu (araç sarmalama + kimlik + sistem bilgisi)
3. Veri taşıma (geçmiş+hafıza) + eval 11/11
4. Kesim akşamı (dashboard, Slack, brifingler) + eski uçlar 410
5. Sağlayıcı şablonu + arşiv bağlantı dokümanı

## Kapsam dışı (bilinçli)
- Arşiv programının kendisi (ayrı proje; burada yalnız şablon hazırlanır).
- Dış MCP istemcilerine (Claude Desktop vb.) açılım — protokol hazır, yetkilendirme
  tasarımı ayrı faz.
