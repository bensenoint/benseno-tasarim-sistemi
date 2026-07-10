# Fatura Takip Akışı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline — yerleşik karar).

**Goal:** Faturalama iş açılırken seçilir (fee varsayılan, ek işte satış ops.); ek işlerin eksikleri (satış/fatura) tamamlanmada kart + 24s/72s/1hf DM + ayın 25'i toplu listeyle kovalanır; satışsız ek işler rozetle görünür.

## Task 1: Migration 0020 + calc bnsFaturaEksikleri (TDD)
- 0020: fatura_hatirlatma_asama int DEFAULT 0, fatura_kart_ts text, ayarlar(k,v) tablosu.
- formula-test: bnsFaturaEksikleri (ek+satışsız→tutarsiz; ek+satışlı+faturasız→faturasiz; kapsamda/faturalı→yok) + bnsFaturaTopluGunu(ms) (25'i, Cmt/Paz→Cuma).
- calc.js implement + export; ody-tools calc kopyası.

## Task 2: Giriş formları
- NewBrief.jsx: Faturalama toggle (kapsamda varsayılan); ek seçilince satış/maliyet görünür, fee'de gönderilmez. body.ucret_tipi.
- slack-bot /yeni-brief: radio 'Faturalama' (initial fee) + satış(ops)/maliyet(ops) number input'ları ek açıklamalı; submit ucret_tipi+satis+maliyet payload.
- writes.createBrief: d.ucret_tipi verilmişse ONU kullan (marka varsayılanı yalnız verilmediğinde).

## Task 3: Tamamlanma kartı + butonlar
- writes.js setStatus tamamlandi: ek işse kart post (satis var→'fatura kesildi mi' + ✅ butonu; yok→'tutar girilmedi' + 💰 butonu), fatura_kart_ts kaydet; ESKİ ek-iş finans dürtüsü DM'i kaldır. Reopen: kart_ts+asama sıfırla.
- slack-bot: action bns_fatura_kesildi (yetki → POST financials {fatura:true} → kartı ✓ güncelle) + bns_fatura_tutar (yetki → modal: satış zorunlu/maliyet ops/fatura checkbox → POST financials → kart ✓).

## Task 4: scripts/fatura-hatirlatma.js + scheduler
- Eksik sorgusu (DB): ek & completed_at & (satis IS NULL OR fatura=false) & silinmemiş.
- Aşama DM'leri (24/72/168s, asama idempotent; alıcı: lead'ler + rol yönetici).
- Toplu: bnsFaturaTopluGunu + saat 10-11 TR + ayarlar['fatura_toplu_son'] kilidi.
- run-thread-ozet.sh'a satır; --dry destekli.

## Task 5: Görünürlük
- Completed.jsx kâr hücresi: ek+satışsız → "₺ bekliyor" rozeti.
- IsTipleri ekranı ek-satış bölümüne "tutarı girilmemiş N iş" notu.
- firma-brifing olguları+fallback: "bekleyen ek-iş cirosu X₺ (N) · tutarı girilmemiş M".

## Task 6: Doküman + deploy + canlı smoke
- Help.jsx + klavuz + /yardim. CI+build; deploy api + bot + Pages; canlı: test işi ek+satışsız tamamla → kart; buton→modal→kaydet; hatırlatma --dry.
