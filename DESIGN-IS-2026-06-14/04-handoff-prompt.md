# 04 — /make-plan Handoff (REFINE)

````
/make-plan Refine the Benseno prod dashboard based on a Dieter Rams audit (total 26/30).

Verdict paragraph:
> Dashboard sağlam bir iskelete sahip — kullanışlı, anlaşılır, dürüst ve tarih-üstü bir görsel sistem; yalnız kaynak-tüketimi (#9) ve fazlalık (#10) iki noktada rötuş gerektiriyor, bu yüzden yeniden tasarım değil REFINE.

Keep (already strong, do NOT touch in this pass):
- #2 useful (3) — KPI deep-link + bugün/geciken tablosu. Regression: overview KPI'ları hâlâ jobs'a filtreli gidiyor mu.
- #3 aesthetic (3) — token sistemi (serif/sans/mono, 16px grid, ember). Regression: grep tokens.css; orphan inline renk eklenmedi.
- #4 understandable (3) — düz Türkçe etiketler. Regression: "Bugün teslim" hâlâ takvim-bugün.
- #5 unobtrusive (3) — collapsed rail + sessiz topbar.
- #6 honest (3) — etiket↔davranış 1:1.
- #7 long-lasting (3) — trend-üstü görsel dil.
- #8 thorough (3) — empty/loading/error/focus/disabled state'leri.

Fix in priority order:
1. #9 environmentally friendly: dashboard/index.html:11-12'deki GridStack CSS+JS CDN'ini kaldır (Panom gizliyken ölü yük). Panom geri gelince koşullu/lazy yükle. Evidence: index.html:11-12.
2. #9 environmentally friendly: Ody idle `odyBob` animasyonu + tüm geçişler için `@media (prefers-reduced-motion: reduce)` guard'ı ekle. Evidence: tokens.css @keyframes odyBob.
3. #10 as little design: overview KPI kartında sayı + mini sparkline + delta chip sinyal fazlalığını azalt — kart başına tek güçlü sinyal. Evidence: Cards.jsx Kpi (variant=trendchart).
4. #1 innovative: editöryel serif ses + Ody'yi tutarlı yay (boş durumlar, bölüm girişleri) — jenerik chrome yerine.

Out of scope for this refine pass: bilgi mimarisi, route yapısı, marka paleti, Panom (gizli — ayrı iş).

Deliverables for the plan:
- Per-fix: hedef dosya, tam değişiklik, doğrulama adımı (canlı ölçüm/screenshot)
- Token/animasyon değişiklikleri tek yerde (tokens.css)
- Her "Keep" maddesi için regresyon kontrol listesi
- Her değişiklik sonrası npm run deploy dashboard + browser-harness doğrulama

Anti-patterns to guard against (REFINE):
- 3 puanlık alanları yeniden stillemek
- Doğrudan değişim yeterken yeni soyutlama eklemek
- Yapısal yeniden tasarıma kayma (gerekirse o ayrı bir REDESIGN'dır)
````
