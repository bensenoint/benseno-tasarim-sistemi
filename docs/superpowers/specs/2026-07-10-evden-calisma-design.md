# Evden Çalışma Günleri (Tasarım)

**Tarih:** 2026-07-10 · **Kararlar (Görkem):** firma geneli evden günler takvimde ayrı türle tutulur · iş günü matematiğini ETKİLEMEZ (normal mesai) · admin Takvim ekranından eklenir · ileride yönetici-özel raporlar: kişi/departman/firma verim kıyası + iş bazlı evden-vs-ofis süre kıyası. Bilinen günler: 3 Tem (Cum), 10 Tem (Cum), 14 Tem (Sal) — devamı admin girer.

## Veri
- Migration 0023: `ALTER TABLE tatiller ADD COLUMN tur text NOT NULL DEFAULT 'tatil'` ('tatil'|'evden') + 3 evden seed. Embedded bns_tatiller tur alanını taşır. API POST tur kabul eder (evden'de yarim=false zorlanır).

## calc.js (+ody-tools senkron)
- bnsTatilYukle: tur='evden' kayıtları AYRI sete (BNS_EVDEN); katsayı/iş günü ETKİLENMEZ.
- `bnsEvdenGunMu(day)`; `bnsMesaiSaatKesBolu(t1,t2) → {evden, ofis}` (mesai dilimini günün türüne göre kovaya yazar); `bnsNetIsSaatiBolu(olaylar) → {evden, ofis} | null` (bnsNetIsSaati'nin kovalı ikizi — RAPOR ALTYAPISI; bu fazda ekran yok).

## Takvim ekranı
- Ekleme satırına tür seçici (🏛 Resmî tatil / 🏠 Evden çalışma); evden seçilince yarım gizli. Listede evden kayıtları mavi "evden" rozeti; tür filtre çipleri (Tümü/Tatil/Evden).

## Kapsam dışı (rapor fazı — veri birikince tek komut uzakta)
Yönetici raporları: kişi×evden/ofis net saat & teslim, departman/firma kıyası, iş bazlı süre kıyası; Ody aracı. Not: 3 Tem'den itibaren durum_olaylari zaten var → raporlar GERİYE DÖNÜK hesaplanabilir.

## Test
formula-test: evden günü iş günü kalır (katsayı 1); bnsMesaiSaatKesBolu evden/ofis ayrımı; bnsNetIsSaatiBolu toplamı = bnsNetIsSaati.
