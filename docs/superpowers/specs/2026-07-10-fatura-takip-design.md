# Fatura Takip Akışı — girişte faturalama, tamamlanmada takip (Tasarım)

**Tarih:** 2026-07-10 · **Kararlar (Görkem):** faturalama İŞ AÇILIRKEN sorulur (fee varsayılan) · ek işte satış OPSİYONEL (belli değilse boş) · tamamlanmada eksik (satış yok / fatura yok) kart + hatırlatma zinciriyle kovalanır · yetki lead/açan/yönetici · eski tamamlanma finans dürtüsü kalkar · dış tedarik = ek iş (maliyet alanı).

## Akış
1. **Giriş:** Slack /yeni-brief + dashboard NewBrief'te zorunlu "Faturalama" (kapsamda='🔒 Aylık fee' varsayılan / ek='➕ Ek iş'). Ek seçilirse satış (ops.) + maliyet (ops.) girilebilir. createBrief: ucret_tipi artık formdan gelir (verilmezse mevcut marka-retainer varsayılanı korunur — eski kuyruk/dış istemci güvenliği).
2. **Tamamlanma (yalnız ucret_tipi='ek'):** thread'e kart —
   - satis!=null: "➕ Ek iş (X₺) tamamlandı — fatura kesildi mi?" → [✅ Fatura kesildi] butonu.
   - satis==null: "➕ Ek iş tamamlandı — satış tutarı girilmedi" → [💰 Tutarı gir] butonu → modal (satış ZORUNLU, maliyet ops., 'fatura kesildi' checkbox).
   Buton yetkisi: lead/açan/yönetici (statusYetki kalıbı); yetkisize ephemeral/DM uyarı. Reopen → kart geçersiz (zincir durur; yeni tamamlanmada yeni kart).
3. **Hatırlatma zinciri:** eksik = (ek && tamamlanmış && (satis IS NULL || fatura=false)). Tamamlanma anından 24s → 72s → 168s sonra işin lead'lerine + yöneticilere (rol='yonetici') DM. Aşama alanıyla idempotent; eksik kapanınca durur.
4. **Ayın 25'i toplu liste:** her ayın 25'i 10:00 TR (Cmt/Paz ise önceki Cuma) tüm eksik ek işler tek DM (lead'ler kendi işleri; yöneticiler tümü): "faturasız toplam X₺ (N iş) · tutarı girilmemiş M iş".
5. **Görünürlük:** Tamamlananlar tablosu + İş Tipleri ekranında satışsız ek işlere "₺ bekliyor" rozeti; firma brifingine "bekleyen ek-iş cirosu X₺ · tutarı girilmemiş N" satırı.

## Teknik
- **Migration 0020:** `briefs.fatura_hatirlatma_asama int DEFAULT 0` (0=yok,1=24s,2=72s,3=1hf gönderildi), `briefs.fatura_kart_ts text` (thread kartı ts — güncelleme/iptal için).
- **writes.js:** setStatus tamamlandi dalı → mevcut finans dürtüsü YERİNE kart atma (source'a bakılmaksızın; slack.postThread). updateFinancials zaten satis/fatura günceller → eksik kapanınca asama sıfırlanmaz (geçmiş bilgi) ama zincir sorgusu eksik şartıyla süzer. Reopen → fatura_kart_ts NULL + asama 0.
- **slack-bot.js:** buton action'ları `bns_fatura_kesildi` (POST financials fatura=true) + `bns_fatura_tutar_gir` (modal aç → submit POST financials satis[+maliyet][+fatura]); yetki kontrolü embedded'dan. /yeni-brief modalına "Faturalama" radio (initial fee) + mevcut satış/maliyet alanları korunur.
- **NewBrief.jsx:** Faturalama toggle (fee varsayılan); ek seçilince satış/maliyet alanları görünür (zaten formda var — koşullu gösterime alınır), fee'de gizli/gönderilmez.
- **scripts/fatura-hatirlatma.js:** saatlik çalışır (run-thread-ozet.sh'a eklenir). (a) Aşama DM'leri: eksik işlerde tamamlanma yaşı eşiği geçen ve asama'sı geride olanlara DM, asama güncellenir (idempotent). (b) Toplu liste: bugün 'toplu gün' ise (ayın 25'i; 25 Cmt/Paz ise önceki Cuma) ve saat 10-11 TR penceresindeyse gönderir; tekrarı önlemek için migration 0020'deki `ayarlar(k text PRIMARY KEY, v text)` mini tablosunda 'fatura_toplu_son'='YYYY-MM-DD' işareti tutulur.
- **Kaldırılan:** writes.js'teki mevcut ek-iş tamamlanma finans dürtüsü DM'i (kartla ikame).
- **Rozet:** Completed.jsx kâr hücresi: ek && satis==null → "₺ bekliyor"; IsTipleri ekranı tip×ek-satış bölümüne "tutarı girilmemiş N" notu; firma-brifing olguları + fallback satırı.
- **calc:** bnsFinansOzet değişmez (satis null zaten sayılmıyor). Yeni saf yardımcı `bnsFaturaEksikleri(completed)` → {faturasiz:[{no,marka,satis}], tutarsiz:[...]} — ekran+brifing+Ody paylaşır (server kopyası ody-tools calc'ına).
- **Ody:** finans_ozet/is_detay zaten var; brifing satırı yeter (ayrı araç yok — YAGNI).

## Güvenlik
- Butonlar yetki kontrollü; finans yazımları mevcut assertCanWriteFinancials/financials endpoint'inden (değişmez). SEC-5: satış tutarları yalnız login-arkası; thread kartındaki tutar Slack'te görünür — Slack zaten iç kanal, mevcut /maliyet komutuyla aynı seviye (kabul).

## Kapsam dışı
- Fee işlerde herhangi bir tamamlanma kartı; fatura PDF/numara takibi; muhasebe entegrasyonu.

## Test
- calc bnsFaturaEksikleri birim testleri; writes setStatus kart tetikleme (ODY/SLACK_TEST bayrağıyla); hatırlatma script'i aşama mantığı (sahte tarihli kuru koşu); 25'i hafta sonu kuralı (Cmt/Paz→Cuma) saf fonksiyon testi.

## Başarı ölçütü
Yeni brief faturalama seçmeden açılamaz; ek işler tamamlanınca kart düşer; eksikler 24s/72s/1hf DM'leriyle ve 25'i toplu listeyle kovalanır, kapanınca susar; satışsız ek işler rozetle görünür; fee işlerde hiçbir bildirim yok.
