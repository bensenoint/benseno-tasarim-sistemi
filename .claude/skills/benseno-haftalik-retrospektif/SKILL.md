---
name: benseno-haftalik-retrospektif
description: v7.6 · Phase 7 — Haftalık Retrospektif (Cuma 17:00). v7.13 ile uyumlu — marka_stats.json haftalık yeniden hesaplama + GitHub push + Cansu Direktör DM özet. Mode otomatik geçiş (silent → active 1 Haziran).
---

# Benseno Tasarım — Haftalık Retrospektif (Cuma 17:00)

## v7.6 değişiklik
- **Yeni Adım 3: marka_stats.json refresh** — Brief Sync v7.13 E3 sistemi için haftalık veri yenileme.
- Tüm Tamamlanan İşler'i okur, marka × deadline_days ve marka × complete_days hesaplar.
- Medyan + MAD ve Ortalama + Std olarak hem hem her marka için yazılır.
- `trend_4w` listesi son 4 haftalık median_complete_days değerleriyle güncellenir (kayan pencere).
- Sonuç `~/benseno-tasarim-sistemi/data/marka_stats.json`'a yazılır.
- GitHub repo'nun `dashboard/marka_stats.json` dosyasına da kopyalanır + push edilir.
- Cansu Direktör'e özet DM gönderilir.

## SABİTLER
```
CANVAS_ID = F0B1B6XUD44
GRAFIK_CHANNEL_ID = C02SZRJGY0M
DASHBOARD_URL = https://bensenoint.github.io/benseno-tasarim-sistemi/
TZ = Europe/Istanbul
```

## 👑 YÖNETİCİLER (5 kişi)
- **Görkem (U030C48PL23)** — Genel Müdür
- **Reyhan (UD96GH76E)** — Genel Müdür Yardımcısı
- **Cansu (U4XCE3532)** — Direktör (Tasarım/Editör/AI)
- **İpek (U055EDESLSE)** — Tasarım Yöneticisi
- **erdem (U02SZQDAFPF)** — Editör Yöneticisi

## ADIMLAR

### 1. Canvas oku ve hafta verisi topla
`slack_read_canvas` F0B1B6XUD44. Son 7 günün analizini yap (tamamlanan, brief, gecikmeler, streakler).

### 2. Mesaj gönder + Dashboard linki
`slack_send_message` → #benseno-grafik (mevcut format korundu).

Mesaj footer'a ekle:
```
📊 Detaylı analiz: https://bensenoint.github.io/benseno-tasarim-sistemi/ (Raporlama sekmesi)
```

### 2b. Haftanın Yıldızları mesajı — #benseno-grafik (YENİ v7.14)

Canvas'taki tamamlanan brief'leri analiz ederek bu haftanın öne çıkan kişilerini belirle ve **ayrı bir Slack mesajı** olarak #benseno-grafik'e gönder.

**Hesaplamalar:**
- **En çok tamamlayan:** Lead olarak en fazla brief bitiren kişi (bu hafta)
- **En hızlı teslim:** Ortalama sureH en düşük olan kişi (en az 2 brief tamamlamış olmalı)
- **0 gecikme:** Bu hafta tamamladığı tüm brief'lerde gecikme olmayan kişi(ler)
- **Streak:** Geçen haftaya göre tamamlama sayısını artıran kişi

**Eşitlik durumu:** Aynı brief sayısında en hızlı ortalama kazanır.

**Slack mesaj formatı:**
```
🌟 *Haftanın Yıldızları — {tarih aralığı}*

🏆 *En çok tamamlayan:* {isim} · {N} brief
⚡ *En hızlı teslim:* {isim} · {ort_sure} sa ortalama
✅ *0 gecikme:* {isim(ler)} · hepsi zamanında teslim

{Eğer streak varsa:}
📈 *Hız kazandı:* {isim} (geçen hafta {N-1} → bu hafta {N} brief)

_{toplam_kişi} kişi bu hafta {toplam_brief} brief tamamladı. Harika iş! 🎉_
```

**Koşullar:**
- Bu hafta hiç tamamlanan brief yoksa mesaj gönderme
- Tüm kategorilerde aynı kişi varsa tek satırda listele (tekrar etme)
- Kişi adı Slack User ID'den çözümle (`slack_read_user_profile`)
- Mesaj ayrı bir `slack_send_message` çağrısı — retro mesajından sonra gönder

### 3. marka_stats.json refresh (v7.6 — E3)

**Amaç:** Brief Sync v7.13 E3 sisteminin her hafta güncel istatistiklerle çalışması.

**Adımlar:**

1. **Veri toplama:** Canvas Tamamlanan İşler tablosundaki son 90 günlük brief'leri filtrele. Her brief için:
   - `marka` (Marka sütunu)
   - `brief_open_date` (Başlangıç sütunu veya ilk 🎨 reaction)
   - `brief_complete_date` (Bitiş sütunu veya ✅ reaction)
   - `deadline_set_date` (Brief açılışında verilen Süre/Deadline)
   - `deadline_days = (deadline_set_date - brief_open_date) / 86400` (gün)
   - `complete_days = (brief_complete_date - brief_open_date) / 86400` (gün)

2. **Marka bazında grupla:** Her marka için liste topla.

3. **Hesapla (n >= 1 her marka için):**
   - `n = brief sayısı`
   - **Medyan + MAD:**
     - `median_deadline_days = median(deadline_days_list)`
     - `mad_deadline_days = median(|x - median| for x in list)`
     - `median_complete_days = median(complete_days_list)`
   - **Ortalama + Std:**
     - `mean_deadline_days = mean(deadline_days_list)`
     - `std_deadline_days = stdev(deadline_days_list)`
     - `mean_complete_days = mean(complete_days_list)`
   - **Delta:** `deadline_vs_real_delta = median_deadline_days - median_complete_days`
   - **Güven:**
     - `n >= 10` → `confidence = "high"`
     - `3 <= n < 10` → `confidence = "medium"`
     - `n < 3` → `confidence = "low"`
   - **trend_4w:** Son 4 haftalık median_complete_days değerleri (kayan pencere — bu hafta öncekiler + bu hafta). Eski trend'in 1. elemanını at, sona yenisini ekle.
   - **last_brief_date:** En son tamamlanan brief'in tarihi (ISO 8601)

4. **marka_stats.json güncelle:**
   - `last_updated = now ISO 8601`
   - `last_updated_unix = now_unix`
   - `next_refresh = now + 7 days` (sonraki Cuma 17:00)
   - `global.brands_with_any_data = n>=1 marka sayısı`
   - `global.brands_with_uyari_active = n>=3 marka sayısı`
   - `global.brands_with_high_confidence = n>=10 marka sayısı`
   - `brands` objesi yeniden yazılır.
   - **Mode kontrolü:** Eğer `config.current_mode == "silent_log_only"` AND `now >= config.active_from (2026-06-01)` ise `current_mode = "active"` olarak güncelle.

5. **GitHub'a push (ANA REPO):**
   - `data/marka_stats.json`'ı güncelle (yukarıdaki `brands` + mode değişikliğiyle).
   - `github-prep/dashboard` KULLANMA — o eski/terk edilmiş `bensenoint/dashboard` reposu, bulutta yok (gitignored) + canlı sistem değil. Push ana repodan yapılır:
   ```bash
   cd ~/benseno-tasarim-sistemi
   git add data/marka_stats.json
   git commit -m "v7.13 weekly marka_stats refresh ({tarih})"
   git pull --rebase origin main && git push origin main || { git pull --rebase origin main && git push origin main; }
   ```
   - Hata durumunda Görkem'e DM

6. **Cansu Direktör'e özet DM:**
```
📊 *Haftalık Marka Stats Refresh (E3)*

Veri toplama tamamlandı:
• Toplam izlenen marka: {N}
• Yüksek güven (n≥10): {H}
• Orta güven (3≤n<10): {M}
• Yetersiz veri (n<3): {L}

Mode: {silent_log_only | active}
{Eğer aktif geçiş olduysa: "🎉 E3 bugün ACTIVE moda geçti! Brief Sync uyarıları aktif."}

Sapan markalar (son hafta):
📈 Hızlanan: {hızlanan_listesi}
🐌 Yavaşlayan: {yavaşlayan_listesi}

Dashboard'da detay: https://bensenoint.github.io/benseno-tasarim-sistemi/ (Marka Raporu sekmesi)
```

7. **Çıktı log'una ekle:**
```
v7.6 Marka stats: işlenen_brief={N} marka={M} high_conf={H} medium_conf={M} mode={silent_log_only|active} github_push={ok|fail}
```

### 4. Eski snapshot temizlik bildirimi (her Cuma — opsiyonel)

v7.5'te Drive arşivi kullanılmıyor (GitHub Pages tek dosyada canlı). Git history tüm geçmiş commit'leri tutar. Manuel temizlik gerekmez.

Eski Drive klasöründe (https://drive.google.com/drive/folders/14gzFxG5gnigWLPh3Qc1pNTNS14u3BMMK) v7.5 öncesi snapshot'lar varsa Görkem'e bildirim:

```
🗑️ Eski Drive Snapshot'ları (v7.5 öncesi)

GitHub Pages geçişi öncesi {N} eski snapshot Drive'da kalmış olabilir.
Disk yeri için temizleyebilirsin:
👉 https://drive.google.com/drive/folders/14gzFxG5gnigWLPh3Qc1pNTNS14u3BMMK

Live dashboard artık GitHub Pages'te: https://bensenoint.github.io/benseno-tasarim-sistemi/
```

Eski dosya yoksa veya az ise sessiz kal.

### 5. Hata
Canvas erişim hatası: `⚠️ Haftalık retrospektif üretilemedi.` Görkem'e DM (GM olarak).
marka_stats.json yazma hatası: `⚠️ Marka stats refresh başarısız.` Cansu+Görkem'e DM.
GitHub push hatası (401/403): PAT yenileme gerekli — Görkem'e DM (PAT yenileme talimatı ile).