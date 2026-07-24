# Yeni Projeyi Ody'ye Bağlama (örn. Arşiv)

Ody-core bağımsız bir servistir; projeler ona **MCP kaynağı** olarak bağlanır.
Bir kaynak = projenin kendi sunduğu tek bir `/mcp` endpoint'i. Ody sohbet başında
tüm kaynakların araçlarını toplar (`kaynakadi__arac`), tek soruda birden fazla
sistemden veri çekip harmanlayabilir. Bir kaynak çökerse Ody kalanlarla devam eder.

## Adımlar (3 adım, ~15 dk)

**1. Projene MCP endpoint'i ekle**
- `ody-provider.js` dosyasını projene kopyala, `npm i @modelcontextprotocol/sdk`.
- Araçlarını tanımla (yukarıdaki dosyanın başındaki örnek). Kurallar:
  - Araç adları kısa ve Türkçe: `dosya_ara`, `is_gecmisi`...
  - Sayısal/olgusal her şey araçtan dönmeli — Ody asla kendisi saymaz.
  - `kimlik` parametresi (`{kullanici:{slack_id,name,role}, isAdmin}`) ile
    yetki kontrolünü KENDİ tarafında yap.
  - `sistemBilgisi` metni Ody'nin prompt'una girer: sistemin ne olduğunu,
    araçların ne zaman kullanılacağını anlat (tasarim örneği: chat-bilgi.md).
- Endpoint'i bir token'la koru (`guard`), token'ı Railway env'ine koy.

**2. ody-core'a kaynağı kaydet**
```sql
INSERT INTO kaynaklar(ad, base_url, token_env)
VALUES ('arsiv', 'https://<arsiv-servisi>/mcp', 'ARSIV_MCP_TOKEN');
```
ve ody-core servisine `ARSIV_MCP_TOKEN` env değişkenini ekle
(değeri 1. adımdaki guard token'ı). ody-core'u yeniden başlat (veya 10 dk bekle — cache).

**3. Doğrula**
```bash
curl -s https://ody-core-production.up.railway.app/kaynaklar -H "x-ody-token: $ODY_SERVICE_TOKEN"
# → {"kaynaklar":[{"ad":"tasarim","arac_sayisi":18},{"ad":"arsiv","arac_sayisi":N}]}
```
Sonra Ody'ye çapraz bir soru sor: "arşivdeki Hasvet dosyaları ile aktif Hasvet işlerini karşılaştır".

## Notlar
- `_` ile başlayan araçlar LLM'e görünmez (iç kullanım — örn. `_kimlik`).
- Kaynak silme/pasifleştirme: `UPDATE kaynaklar SET aktif=false WHERE ad='...'`.
- Ody'nin modeli/kişiliği/hafızası ody-core'dadır — projeler yalnız VERİ sunar.
