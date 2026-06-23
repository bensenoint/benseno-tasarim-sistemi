# Tool-Driven Ody — Tasarım

**Tarih:** 2026-06-23
**Durum:** Onaylandı (tasarım)

## Amaç

Ody'nin (dashboard asistanı) sayım/çıkarım halüsinasyonlarını **kökten** engellemek.
Mevcut yapı tüm canlı veriyi system prompt'a proza olarak döküyor; model bu metin
üzerinde sayım yapınca hata ediyor (İrem'i eksik, Pelin'i fazla saydı). Çözüm: veriyi
modele dökmek yerine **SQL-destekli tool'lar** vermek. Sayılar/olgular modelden değil,
parametreli SQL sorgularından gelir. Böylece her metriği elle hazırlamaya gerek kalmadan
Ody veriyi güvenilir şekilde sorgulayıp yorumlar.

## Mimari — agentic loop

`POST /api/chat` tek-atıştan araç-döngüsüne geçer:

1. **Minimal system prompt**: Ody kimliği, giriş yapan kullanıcı (ad/rol), kişiselleştirme
   ve gizlilik kuralları, kullanım bilgisi (`chat-bilgi.md`), ve şu direktif:
   *"Tüm veri tool'lardan gelir. Sayı/olgu için MUTLAKA tool çağır. Tool dönmediği hiçbir
   sayıyı/olguyu söyleme. Tool boş dönerse 'yok' de."* **Veri dökümü YOK.**
2. **Tool'lar** Anthropic `tools` + `input_schema` ile tanımlı.
3. **Döngü**: Claude'a `messages + tools` gönder. `stop_reason === 'tool_use'` oldukça:
   her `tool_use` bloğunu çalıştır → `tool_result` ekle → tekrar çağır. **Maks 5 tur**
   (runaway koruması). Son metin bloğu kullanıcıya döner.
4. Model: `claude-sonnet-4-6` + **adaptive thinking** (`thinking:{type:'adaptive'}`).

## Veri katmanı — `server/ody-tools.js`

Her tool: `{ name, description, input_schema, run(input, ctx) }`.
`ctx = { userId, slackId, name, isAdmin, range }` (JWT'den; `range` dashboard aralığı).
Tüm sorgular **parametreli, salt-okunur SELECT**; mevcut `pool` kullanılır. Kullanıcı asla
ham SQL göndermez — yalnız yapısal filtreler.

| Tool | Girdi | Döner |
|---|---|---|
| `genel_ozet` | `aralik?` | aktif/gecikmiş/müşteride/bugün-biten/tamamlanan sayıları |
| `brief_sorgula` | `marka?, durum?, kisi?, aralik?, gecikmis?, tamamlandi?` | eşleşen liste (cap 40) + toplam sayı |
| `kisi_dokumu` | `kisi, aralik?` | `tamamlanan:{say,nos}`, `aktif:{say,nos}`, (admin) `puan:{avg,cnt}` |
| `marka_dokumu` | `marka` | aktif/tamamlanan/gecikmiş + kanal özeti + son insight + (admin) puan |
| `yildiz_karne` | `kapsam (firma/dept/kisi), key?` | puan ortalamaları — dept/kişi **admin-özel** |
| `gecikme_analizi` | `aralik?, marka?` | gecikmiş brief listesi + neden |
| `kapasite` | `kisi?` | kişi başına aktif yük / takım kapasitesi |
| `trend` | `metrik, aralik?` | `kpi_history`'den zaman serisi özeti |

**`aralik` sözleşmesi:** `{from,to}` ms; verilmezse `ctx.range`; `ctx.range` da yoksa veya
"tüm zamanlar" (`from<=0 & to>=8.64e15`) ise filtre uygulanmaz. Tamamlananlar `bitis`
tarihine göre filtrelenir; aktif işler aralıktan bağımsız (dashboard ile aynı).

**Kişi/marka eşleştirme:** isim parametresi önce `users`/`brands` tablosunda eşleştirilir
(case-insensitive, Türkçe-güvenli — `id` üzerinden çalışılır; `toLowerCase` ile isim
karşılaştırmaz). Eşleşme yoksa tool `{bulunamadi:true, aday:[...]}` döner.

## Güvenlik / gizlilik

- Tüm SQL parametreli ve salt-okunur (yalnız SELECT). Model yalnız yapısal filtre üretir.
- Gizlilik tool katmanında zorlanır (UI kuralıyla aynı):
  - Puan/performans (`yildiz_karne` dept/kişi, `kisi_dokumu.puan`, `marka_dokumu.puan`)
    yalnız `isAdmin` ise döner; değilse o alanlar boş + tool açıklamasında "yöneticilere özel".
  - Admin olmayan kullanıcı "benim işlerim" sorduğunda kendi `userId`'sine filtrelenir.

## Halüsinasyonun engellenmesi

Sayılar SQL `tool_result` JSON'undan gelir. Sistem direktifi modelin kendi sayım yapmasını
yasaklar. Pelin/İrem türü sayım hataları yapısal olarak imkânsız hale gelir — her veride,
elle hazırlanmış bölüm gerekmeden.

## Eval harness — `scripts/ody-eval.js` + `scripts/ody-evals.json`

- `ody-evals.json`: `[{ q, expect:{ contains?:[], notContains?:[], regex? } }]`.
  Örnek vakalar: "İrem kaç iş tamamladı" → `regex:/\b3\b/` + `contains:["tamamlan"]`;
  "Pelin kaç iş tamamladı" → `regex:/\b1\b/`; admin-olmayan "X'in puanı" →
  `contains:["yöneticilere"]`; "tüm zamanlar İrem" vs aralık farkı.
- `ody-eval.js`: test JWT üretir, her soruyu `/api/chat`'e POST eder, yanıtı `expect` ile
  kıyaslar, pass/fail tablosu basar, başarısızlıkta exit≠0.
- `deploy.sh api` adımına **deploy sonrası best-effort** olarak eklenir (fail → uyarı, deploy'u
  bloklamaz). ~10-12 vaka. `ANTHROPIC_API_KEY` deploy ortamında mevcut.

## Dosyalar

- **Yeni**: `server/ody-tools.js`, `scripts/ody-eval.js`, `scripts/ody-evals.json`
- **Değişen**: `server/api.js` (`/api/chat` döngüye; `chatContext` + kişi-indeksi + range
  dökümü kaldırılır — `getEmbedded` çağrısı tool'lara taşınır), `scripts/deploy.sh` (eval adımı)
- **Frontend değişmez**: zaten `{messages, range}` gönderiyor; `range` tool ctx'ine geçer.

## Hata yönetimi

- Tool çalışırken hata → `tool_result:{error:"..."}` → model nazik fallback ("şu an
  ulaşamadım").
- Döngü 5 turu aşarsa → eldeki son metni dön (veya "isteğini tamamlayamadım").
- Anthropic/ağ hatası → mevcut 502 davranışı korunur.

## Test

- `server/ody-tools.js` runner'ları için birim test: İrem (`U0AK8U7L57F`) → 3 tamamlanan
  (#14,#15,#83); Pelin (`U0B3K2WE7SB`) → 1 tamamlanan (#92), 7 aktif. Gizlilik: admin-olmayan
  ctx ile `yildiz_karne(kişi)` boş/red döner.
- Uçtan uca: eval harness.

## Kapsam dışı (sonraki turlar)

- Yazma/aksiyon tool'ları (brief oluştur/güncelle) — bu tur salt-okunur.
- YILDIZ KARNESİ puanlarının aralığa duyarlı hale getirilmesi (şu an tüm-zaman agregası).
- Çok büyük veri için RAG/streaming — şu anki veri hacmi (60 tamamlanan) için gereksiz.
