# Ody Bağlantı Paketi

Herhangi bir Node/Express projesini Ody'ye **MCP kaynağı** olarak bağlar.
Tek komut:

```bash
node ody-core/paket/kur.js /yol/projeye <kaynak-adi>
# örn: node ody-core/paket/kur.js ~/benseno-arsiv arsiv
```

Kurulum script'i:
1. Projenin modül tipini algılar (`"type":"module"` → ESM, değilse CommonJS) ve
   doğru `ody-provider` sürümünü kopyalar,
2. `@modelcontextprotocol/sdk` bağımlılığını kurar,
3. Güvenli bir bağlantı token'ı üretir,
4. Örnek araçlı bir `ody-araclar` dosyası oluşturur (varsa dokunmaz),
5. ody-core'a kayıt adımlarını (SQL + env) ekrana yazar.

Senin yapacağın: `odyBaglan(app)` satırını sunucuna eklemek, araçlarını tanımlamak,
token'ı iki tarafın env'ine koymak. Ayrıntılar: `../provider-sablonu/BAGLANTI.md`.

## Dosyalar
- `ody-provider.cjs` — CommonJS sağlayıcı
- `ody-provider.mjs` — ESM sağlayıcı
- `kur.js` — kurulum script'i

## Araç yazma kuralları (özet)
- Sayısal/olgusal her şey araçtan dönmeli — Ody asla kendisi saymaz.
- `kimlik` parametresiyle (`{kullanici:{slack_id,name,role}, isAdmin}`) yetkiyi
  KENDİ tarafında denetle; hassas veriyi role bakmadan döndürme.
- `sistemBilgisi` Ody'nin prompt'una girer: sistemin ne olduğunu ve hangi araç
  ne zaman kullanılmalı, kısa ve net anlat.
- `_` ile başlayan araç adları LLM'e görünmez (iç kullanım).
