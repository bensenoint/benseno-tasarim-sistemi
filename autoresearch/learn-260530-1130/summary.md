# Learn Özeti — 30 May 2026

**Mod:** init (mimari+operasyon) · **Kapsam:** tüm sistem · **Derinlik:** kapsamlı

## Üretilen
- `docs/MIMARI-VE-OPERASYON.md` — 8 bölüm kapsamlı mimari + operasyon rehberi

## Kapsanan
1. Sistem genel bakış (3 yüzey: Canvas, Dashboard, Slack DM)
2. Hibrit bulut/Mac mimarisi (diyagram + ne nerede)
3. Bileşenler: 11 skill, 4 workflow, 3 aktif/7 disabled launchd, 5 data dosyası, dashboard
4. Doğrulanmış uçtan uca veri akışı (9 adım)
5. Kritik göç öğrenimleri (headless curl, push auth 3-parça, TZ, launchctl reboot)
6. Operasyon (manuel tetikleme, build/deploy, izleme, sorun giderme tablosu)
7. Bakım takvimi (PAT, Node24, E3)
8. İlgili doküman bağlantıları

## Doğrulama: pass (tüm iddialar gerçekle eşleşti)
- Cron zamanlamaları workflow'larla birebir
- permissions:write + git identity mevcut
- Aktif launchd = 3 (doc ile uyumlu)
