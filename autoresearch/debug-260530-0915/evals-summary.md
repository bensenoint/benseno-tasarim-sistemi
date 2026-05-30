# Debug Evals Özeti — 30 May 2026 (Pazartesi yayın öncesi)

## Kapsam: Tüm sistem | Derinlik: deep | Aksiyon: ask-each

## Sonuç: 14 hipotez | 9 confirmed | 5 disproven

### Kritik bug'lar (hepsi düzeltildi + doğrulandı)
1. **launchd duplikasyon** — 7 otomasyon job aktifti, Actions ile çakışıyordu → benseno-disabled/'a taşındı (reboot-safe)
2. **Actions push edemiyor** — permissions yok + PAT dosyası runner'da yok + read-only token → permissions:write + PAT remote + git identity eklendi → **Benseno Bot commit ile doğrulandı**
3. **git commit identity yok** → eklendi
4. **Headless Canvas okuma yok** — data-agent MCP bağımlıydı → curl fallback (files.info+url_private) → **doğrulandı**
5. **3 müdahil job** (startup-recovery/watchdog/gunluk-ozet) yerel state okuyup yanlış DM → kapatıldı

### Bonus
- PAT push → GitHub Pages otomatik rebuild (elle tetikleme derdi bitti)

### Temiz çıkanlar
- Güvenlik: token sızıntısı yok (hiç commit edilmemiş)
- Slack bot token geçerli
- live-data.json / index.html iki kopya senkron
- sabah-raporu TZ guard doğru (TR saati)

### Doğrulanmış uçtan uca zincir
Cron → Actions → curl Canvas oku → live-data.json → PAT push (Benseno Bot) → Pages otomatik rebuild → dashboard canlı (Mac'ten bağımsız)

### Kabul edilen sınırlamalar
- Canvas write-back headless'ta atlanıyor (kozmetik, güvenli karar)
- Slack Bot (Socket Mode: slash/reaction/form) Mac'te kalıyor (always-on, cron'a uymaz)
