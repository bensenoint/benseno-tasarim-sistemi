# P2-B · Ody Proaktif — Günlük Tek-Satır İçgörü — Tasarım Spec'i

> Tarih: 2026-07-06 · Faz: P2-B · EFOR: M · Altyapı: mevcut (/api Anthropic, notifications, notify_prefs, scheduler, dijest) · Risk: orta (kalite/aşırı-tetik → deterministik kapı + sıkı prompt ile azaltıldı)

## Problem

Ody bugün yalnız sorulunca cevaplıyor. En değerli anlar ise kullanıcının soru sormayı
akıl etmediği anlar. Amaç: günde bir, kişiye özel, sorulmadan gelen tek satır içgörü
("Bu hafta 2 işin riske giriyor: Splenda #22").

## Kullanıcı kararları (onaylı)

1. **Üretim:** Tam LLM (Anthropic Sonnet) — cümleyi Ody yazar.
2. **Zaman/yer:** Sabah cron'da üretilir; hem **Slack DM** hem **dashboard Ody balonunda** aynı içgörü.
3. **Tetik eşiği:** Yalnız kayda değer durumda konuşur; sinyal yoksa **susar** (o gün DM/içgörü yok).
4. **Tercih:** Varsayılan AÇIK + kapatma (Profil → ⚙️ Bildirim tercihleri). Dashboard balonu tercihe bakmaz; **yalnız DM** tercihe tabi.

## Akış (mimari)

Yeni script **`scripts/ody-icgoru.js`**, `scheduler.js`'ten hafta içi ~08:15'te (dijest 08:30'dan önce) çağrılır. Dijest'in kullandığı aynı veri anlık görüntüsünü (bns_users + briefs; deadline + assignees) yükler. Her U-id'li kullanıcı için:

1. **Deterministik sinyal (LLM'siz):** kişinin ilişkili aktif brief'lerinden hesapla:
   - `geciken` = deltaH ≤ 0 olan aktif işler
   - `riskli` = 0 < deltaH ≤ 24 olan işler
   - `bugun` = deadline'ı bugün olan işler
   - her kategori için ilgili brief referansları (#no, marka, baslik).
2. **Kapı:** `geciken + riskli + bugun === 0` → **atla** (üretme, gönderme, yazma).
3. **İdempotenlik:** bugün bu kullanıcı için zaten `tip='ody_icgoru'` içgörü üretildiyse → atla.
4. **LLM (Sonnet):** sinyal + brief listesi ile tek cümle ürettir (prompt aşağıda). Boş/başarısız → atla (çöp yok).
5. **Yaz + gönder:**
   - `notifications` tablosuna `tip='ody_icgoru'`, `aciliyet='normal'`, `text=<cümle>`, `brief_id=<tek odak iş varsa>`, `dijest_at=now()` (dijest tekrar toplamasın) ile ekle.
   - `notify_prefs.ody_icgoru ≠ false` ise Slack DM gönder (kendi başına, dijestten ayrı).

## LLM prompt (kalite güvencesi)

Sistem mesajı (öz):
> "Sen Ody, Benseno iş asistanısın. Aşağıdaki GERÇEK sinyallere dayanarak {ad}'e **tek cümle**, sıcak ve eyleme yönelik bir içgörü yaz. YALNIZ verilen verileri kullan — sayı uydurma, veri ekleme. En fazla 140 karakter. Türkçe. En kritik işe somut atıf ver (#no marka). Selamlama/emoji ekleme."

Girdi (user mesajı): JSON — `{ ad, geciken:[{no,marka,baslik,gun}], riskli:[...], bugun:[...] }`.
Model: `claude-sonnet-4-6` (api.js ile aynı, ucuz). `max_tokens: 80`. Yanıt tek satıra indirgenir (ilk satır, trim, 140 char kırp).

## Kanallar

- **Dashboard:** `tip='ody_icgoru'` bildirimi mevcut Ody balonu/advicePeek + rozet tarafından otomatik gösterilir. İkon eşlemesi: `ody_icgoru → 💡`. Tercihe bakılmaz.
- **Slack DM:** yalnız `notify_prefs.ody_icgoru ≠ false` iken. İçgörü satırı `dijest_at=now()` damgalı → 08:30 dijesti tekrar toplamaz; Ody'nin ayrı proaktif nudge'ı olarak gider.

## Tercih (kapatma)

- **Migration `0011_ody_icgoru_pref.sql`:** `ALTER TABLE notify_prefs ADD COLUMN IF NOT EXISTS ody_icgoru BOOLEAN DEFAULT true;`
- `/api/notify-prefs` GET varsayılanına ve POST kabul alanlarına `ody_icgoru` eklenir; `notify.js` varsayılan objesi de içerir.
- Profil → ⚙️ NotifPrefsCard'a **"Ody günlük içgörü"** anahtarı (varsayılan açık).

## Zamanlama

`scheduler.js`'e yeni cron: hafta içi ~08:15 (dijest'ten önce). `run-ody-icgoru.sh` (dijest script kalıbıyla) veya doğrudan node çağrısı.

## Dosyalar

- **Yeni:** `scripts/ody-icgoru.js`, `scripts/run-ody-icgoru.sh`, `server/migrations/0011_ody_icgoru_pref.sql`
- **Değişir:** `server/scheduler.js` (cron), `server/api.js` (/api/notify-prefs alanı), `server/notify.js` (varsayılan pref objesi), dashboard NotifPrefsCard bileşeni (anahtar), Chrome.jsx (`ody_icgoru → 💡` ikon eşlemesi).

## Kapsam dışı (sonraya)

- Yönetici için ekip-düzeyi içgörü (bu sürüm yalnız kişisel).
- Kapasite-aşımı / trend gibi ekstra sinyaller (ilk sürüm: geciken/riskli/bugün).
- Sessiz-saat penceresi (dijest zaten sabah; ayrı pencere gerekmez).
- İçgörü geçmişi/analitiği (ody_advice_feedback benzeri geri bildirim ileride bağlanabilir).

## Test

- **Birim (LLM'siz):** `ody-icgoru.js` içindeki saf sinyal/kapı fonksiyonu dışa verilir; `scripts/ody-icgoru.test.js`:
  - sinyal yoksa `null` döner (kapı çalışır),
  - geciken/riskli/bugün doğru sınıflanır + doğru brief'ler seçilir,
  - en kritik iş (en çok geciken) atıf için seçilir.
- **Kuru-çalıştırma:** `node scripts/ody-icgoru.js --dry` → LLM/DM yapmadan hesaplanan sinyali + prompt'u yazdırır.
- **CI:** `bash scripts/ci-check.sh` (parse + formül tek-tanım; içgörü sinyali calc değil, guard'ı tetiklemez) + `node --test scripts/ody-icgoru.test.js`.
- **Preview:** dashboard Ody balonunda 💡 içgörü bildirimi görünür; ⚙️ tercih anahtarı çalışır.
