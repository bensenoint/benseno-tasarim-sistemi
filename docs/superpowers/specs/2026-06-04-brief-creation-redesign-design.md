# Brief Oluşturma Akışı — Yeniden Tasarım (Tasarım Dokümanı)

**Tarih:** 2026-06-04 · **Durum:** Onaylandı, implementasyon planı bekliyor

## Amaç

Brief oluşturma akışını rol-temelli yeniden modelle ve dosya yükleme ekle. Değişiklik
Slack `/yeni-brief` modalı, dashboard formu + görüntüleme, API, DB rol kullanımı ve docs'a
tutarlı yansır.

**Önemli bağlam:** DB sıfır-veri (0 brief). Migrasyon yok → roller temiz baştan tanımlanır.

## Gereksinimler (kullanıcıdan)

1. Departman seçimi kalkar; brief'in departmanı **işi yapan kişi(ler)in** dept'inden türetilir.
2. **Lead = işi en son kontrol edecek/sorumlu kişi** (işi yapan değil). Çoklu olabilir. İşi veren
   (oluşturan) doğal/otomatik lead; ek lead eklenebilir.
3. **İşi yapan(lar)** ayrı alan; departmanlarına göre (tasarım/editör/AI) gruplanmış kişilerden seçilir. Çoklu.
4. **Gözlemciler** — işle alakası olmayan, sadece bilgi alan kişiler (ör. markadaki diğer çalışanlar). Çoklu.
5. **Dosya yükleme** — Slack brief thread'ine yüklenir, URL'ler `brief_attachments`'a kaydedilir.

## Karar özeti

| Konu | Karar |
|------|-------|
| Lead kardinalite | Çoklu, opsiyonel (boşsa oluşturan tek lead) |
| Rol indirgeme | 3 rol: işi-yapan / lead / gözlemci. `editor` rolü + `reviewer` kavramı kalkar |
| Dosya hedefi | Slack thread (files.uploadV2) + `brief_attachments` |
| Dosya zamanı | Formda seçilir, brief oluşup thread açılınca API yükler |
| Çapraz-dept | Brief çoklu-dept (worker dept'leri birleştirilir) |

## 1. Veri modeli

`brief_assignees` tablosu (şema değişmez) rollerin **kullanımı** yeniden tanımlanır:

| Rol (DB) | Yeni anlam | Kardinalite |
|----------|-----------|-------------|
| `contributor` | İşi yapan(lar) | ≥1 (zorunlu) |
| `lead` | Lead(ler) — son kontrol/sorumlu | ≥1 (oluşturan otomatik) |
| `gozlemci` | Gözlemciler — bilgi amaçlı | 0+ |
| `editor` | **Kullanılmaz** (dept'tir, rol değil) | — |

- `briefs.dept` = işi yapanların distinct dept'leri, virgül-join (ör. `"tasarim,editor"`).
  Kaynak: `users.dept`. Boş worker dept'i atlanır.
- `reviewer`→`gozlemci` eşlemesi (önceki oturumda eklenen) **geri alınır**; `gozlemci` artık gözlemci.
- `brief_attachments` (mevcut tablo, FK brief+user): kolonlar yüklenen dosya için `slack_file_id`,
  `url_private`/`permalink`, `name`, `by`. (Mevcut kolonlar incelenip eksikse migration eklenir.)

## 2. API (`server/`)

**Schema (`writes.js` Zod):** `briefCreate` ve `briefPatch`:
- `worker_ids: z.array(zUserId).min(1)` (create'te zorunlu) / opsiyonel (patch)
- `lead_ids: z.array(zUserId).optional()` — create'te boşsa `[by]`
- `gozlemci_ids: z.array(zUserId).optional()`
- `atanan_ids`, `editor_ids` **kaldırılır**.
- `dept` alanı create/patch body'den kalkar (türetilir).

**`setAssignees(client, briefId, {worker_ids, lead_ids, gozlemci_ids})`:** verilen her rol grubunu
TAM değiştirir (`DELETE ... WHERE role=ANY(...)` + INSERT). `contributor`/`lead`/`gozlemci`.

**Dept türetme:** worker_ids → `users.dept` distinct → virgül-join → `briefs.dept`.

**`createBrief`:** `lead_ids` boşsa `[d.by]`. Slack post'unda lead/işi-yapan isimleri güncellenir.

**`getEmbedded` (`queries.js`):** `bns_briefs[]` yeni shape:
- `workers: [{id,name,dept}]`, `leads: [{id,name}]`, `observers: [{id,name}]`
- Eski `atanan_ids`/`editor_ids`/`reviewerId` **kaldırılır**.
- `dept` türetilen değer.
- `bns_completed[]` benzer (workers/leads).
- Geriye dönük: dashboard tamamen yeni shape okuyacak (eş zamanlı güncellenir).

**Attachments endpoint:** `POST /api/briefs/:id/attachments` (multipart, `multer`):
- Brief'in `slack_ts`+`slack_channel`'ına `files.uploadV2` ile yükler (thread_ts).
- Her dosya için `brief_attachments`'a satır (`slack_file_id`, `permalink`, `name`, `by`).
- Best-effort: Slack yüklenmezse 502 + hata; brief yine durur.
- `getEmbedded` brief'e `attachments: [{name, permalink}]` ekler.

## 3. Dashboard formu (`dashboard/app/NewBrief.jsx`)

- **Departman bloğu kaldırılır.**
- **İşi yapan(lar):** departmana göre gruplu (Tasarım / Editör / AI başlıkları) çoklu seçim. `users.dept` ile gruplanır.
- **Lead(ler):** çoklu seçim; `ME` otomatik ekli, çıkarılabilir.
- **Gözlemciler:** çoklu seçim.
- **Dosyalar:** `<input type=file multiple>`.
- Submit akışı: `POST /api/briefs` (JSON: worker_ids/lead_ids/gozlemci_ids) → dönen `id` ile
  dosya varsa `POST /api/briefs/:id/attachments` (multipart) → `bnsRefresh()`.

## 4. Slack `/yeni-brief` modalı (`scripts/slack-bot.js`)

- Departman bloğu kalkar.
- 3 ayrı `multi_users_select`: İşi yapanlar / Lead'ler / Gözlemciler.
- Block Kit `file_input` (opsiyonel).
- `view_submission`: workers/leads/observers → DB; lead boşsa submitter. Dosyalar (file_input → file IDs)
  thread'e iliştirilir + `brief_attachments`.

## 5. Görüntüleme (dashboard)

- **`BriefDrawer.jsx` "Atama" bölümü** 3 gruba ayrılır: İşi yapan (dept rozeti) · Lead · Gözlemci.
  Düzenleme aksiyonları `bnsPersistBriefChange` ile ilgili role yazar (`worker_ids`/`lead_ids`/`gozlemci_ids` PATCH).
- **`data.js` hydrate:** yeni shape (`workers`/`leads`/`observers`) → brief objesi. Eski `lead`/`contributors`/`reviewer` alanları yeni modele map'lenir (lead = leads[0] gösterim kolaylığı + tam liste).
- **Kartlar/tablolar/kanban (`Cards.jsx`, `BriefTable.jsx`, screens):** atanan gösterimi yeni rollere göre (işi yapanlar ön planda, lead ayrı işaret).
- **Dosyalar:** Drawer'da ekleri (permalink) listeler.

## 6. Docs + temizlik

- `docs/kullanim-klavuzu.html` / `.md`: yeni alanlar + departman-otomatik + dosya.
- `SESSION-HANDOFF.md`: yeni rol modeli.
- Önceki reviewer→gozlemci notları güncellenir.

## Deploy

Üç yüzey: **API** (stamp-trick → benseno-api), **bot** (`slack-bot.js` push → redeploy, `node --check` şart),
**dashboard** (`build-dashboard.sh` + push → Pages). Sıra: API önce (yeni embedded shape), sonra dashboard+bot.

## Test / doğrulama

1. API: `POST /api/briefs` (worker_ids/lead_ids/gozlemci_ids) → embedded'da workers/leads/observers + türetilen dept doğru.
2. Attachments: bir dosya → thread'de görünür + embedded'da attachments.
3. Slack modal: 3 seçici + dosya → DB + thread.
4. Dashboard: form → brief + dosya; drawer 3 rolü gösterir/düzenler.
5. Smoke: uçtan uca `/yeni-brief` → dashboard → düzenle → ✅.

## Kapsam dışı (YAGNI)

- Cloud storage (S3/R2) — Slack yeterli.
- Rol-bazlı yetkilendirme değişikliği — mevcut writeGuard korunur.
- Geçmiş veri migrasyonu — sıfır-veri.
