# Benseno Tasarım Sistemi — Claude Code Workspace

> **Sistem versiyonu:** v7.13
> **Cowork'ten geçiş tarihi:** 18 Mayıs 2026
> **Production launch:** 18 Mayıs 2026

## Bu Workspace Nedir?
16 kişilik dijital ajansın brief takip sistemi. 5 aktif scheduled task,
1 dashboard, 4 MCP entegrasyonu (Slack, Gmail, Calendar, Drive).

## Önemli Yollar
- Skills: `.claude/skills/`
- Dashboard (local): `dashboard/index.html`
- Dashboard (GitHub Pages): https://bensenoint.github.io/dashboard/
- Dashboard (deploy source): `github-prep/dashboard/`
- Data files: `data/`
- Master Prompt: `docs/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md`
- Log dosyaları: `logs/`
- Wrapper scripts: `scripts/`

## Sistem Sabitleri
- Slack Canvas ID: `F0B1B6XUD44`
- Marka Kitabı Canvas: `F0B2ANKBBFV`
- Lessons Learned Canvas: `F0B2H49SXPC`
- Şablonlar Canvas: `F0B2F2REETG`
- Grafik kanal: `C02SZRJGY0M` (#benseno-grafik)
- GitHub repo: `bensenoint/dashboard`
- Slack Workspace: `T4Y3R6RAN`
- Timezone: `Europe/Istanbul` (UTC+3)
- 39 marka, 16 kişi, 5 yönetici

## Yöneticiler (5 kişi)
| İsim | Slack ID | Rol |
|---|---|---|
| Görkem Kaya | U030C48PL23 | Genel Müdür (gorkem@benseno.com.tr) |
| Reyhan Nur Pınar | UD96GH76E | GMY |
| Cansu Kazgan | U4XCE3532 | Direktör (3 dept) |
| İpek Akdeniz | U055EDESLSE | Tasarım Yöneticisi |
| erdem akoğlu | U02SZQDAFPF | Editör Yöneticisi |

## Tasarım Ekibi (7 kişi)
| İsim | Slack ID | Not |
|---|---|---|
| Aylin Tozkoparan | U0AN6DD79M0 | |
| Aykut Arslan | U06J26R1XCJ | |
| Hasan Serdar Arda | U09BFPBKQG7 | |
| Pelin Özdemir | U0B3K2WE7SB | YENİ — 15 May 2026 katıldı |
| İpek Akdeniz | U055EDESLSE | Hem yönetici hem tasarımcı |
| İrem Özkan | U0AK8U7L57F | |
| Serhat | U08HLMHTGEL | |

## Editör Ekibi (8 kişi)
| İsim | Slack ID | Not |
|---|---|---|
| Cansu Kazgan | U4XCE3532 | Hem Direktör hem editör |
| erdem akoğlu | U02SZQDAFPF | Hem Editör Yön. hem editör |
| Eda Tireli | U09BZHR25NG | Bauhaus uzmanı |
| Eda Ayral | U07PV0RA9L2 | |
| Melis | U08NQJ27G5S | |
| Aylin Canel | U05PP70GQTX | |
| Buse Gürbüzer | U063T8M5HL4 | |
| Simge Acar | U0AAC3YK20G | |

## AI Ekibi (1 kişi)
| İsim | Slack ID |
|---|---|
| Eren Mahzunlar | U0AP31SAA1W |

## Aktif Scheduled Task'lar
| Task | Zamanlama | Script |
|---|---|---|
| benseno-brief-sync | Hft içi :15/:45 (08:00-17:30) | `scripts/run-brief-sync.sh` |
| benseno-gunluk-performans | Hft içi 07:50 | `scripts/run-sabah-raporu.sh` |
| benseno-haftalik-retrospektif | Cuma 17:00 | `scripts/run-haftalik-retro.sh` |
| benseno-aylik-strateji | Ay sonu 17:00 | `scripts/run-aylik-strateji.sh` |
| benseno-onboarding | Manuel | `claude -p "Skill: benseno-onboarding — başlat: {ID} {İsim} {Tarih}"` |

## KRİTİK Çalışma Kuralları (Claude için — ASLA İHLAL ETME)

### Canvas Kuralları
1. `slack_update_canvas` çağrısında **`section_id` parametresini ASLA geçme** — Slack Canvas API bug'ı, blockquote/footer çoğalır
2. Canvas'a **H1 başlık YAZMA** — `# Benseno Tasarım İş Takip Panosu` yazılmamalı, title API tarafından ayrıca set edilir
3. Canvas update'i her zaman **full replace** yap (tüm içerik tek seferde)
4. Aktif İşler tablosu (11 sütun) ile Tamamlanan İşler tablosunu (12 sütun) **KARIŞTRIMA**
   - Ayırt etme: 2. hücrede öncelik emoji (🔴/🟠/🟡/🟢) varsa → Aktif tablo

### Dashboard Kuralları
5. `dashboard/index.html` içindeki `<script>window.EMBEDDED_DATA = {...}</script>` bloğunu **ASLA SILME**
6. `window.cowork` mock bloğunu da koru — bu olmadan ekip "Cowork bridge YOK" hatası görür
7. Brief Sync her run'da sadece `canvas_markdown` alanını update eder, yapının geri kalanı kalır

### GitHub Push Kuralları
8. PAT dosyası: `data/.github-pat` — her push'ta 90 günlük expiry kontrol et
9. PAT süresi dolmadan 7 gün önce Görkem'e DM at
10. PAT-created tarihi: `data/.github-pat-created` (ISO format string)

### Brief Sync Kuralları
11. Brief önceliği **otomatik hesaplanır** (deadline'dan) — form'dan okuma, manuel set etme
12. Yönetici reaction override'ı (🔴/🟠/🟡/🟢) **en son eklenen yönetici kazanır**
13. Slack emoji arama'da unicode değil **shortcode kullan**: `:clipboard:` not `📋`
14. Slack `after:BUGÜN` bugünü dahil etmez — `after:DÜN` veya Unix timestamp kullan
15. UTC → TR çevrimi (+3 saat) zorunlu — Slack form datetime'ı UTC verir
16. `marka_stats.json` mode kontrolü: `silent_log_only` ise DM gönderme, sadece log

### Öncelik Hesabı (v7.12)
- `delta ≤ 0h` → 🔴 Acil + GEÇMİŞ flag
- `delta ≤ 8h` → 🔴 Acil
- `delta ≤ 24h` → 🟠 Yüksek
- `delta ≤ 72h` → 🟡 Normal
- `delta > 72h` → 🟢 Düşük

## MCP Tool İsimleri (Claude Code)
```
mcp__slack__slack_read_canvas
mcp__slack__slack_update_canvas  (section_id KULLANMA!)
mcp__slack__slack_read_channel
mcp__slack__slack_read_thread
mcp__slack__slack_search_public
mcp__slack__slack_search_public_and_private
mcp__slack__slack_send_message
mcp__slack__slack_send_message_draft
mcp__slack__slack_schedule_message
mcp__slack__slack_search_users
mcp__slack__slack_search_channels
mcp__slack__slack_read_user_profile
mcp__slack__slack_create_canvas
mcp__google-calendar__create_event
mcp__google-calendar__list_events
mcp__google-calendar__update_event
mcp__google-calendar__delete_event
mcp__gmail__search_threads
mcp__gmail__get_thread
mcp__gmail__create_draft
mcp__drive__search_files
mcp__drive__read_file_content
```
> Not: MCP tool isimleri `claude mcp list` çıktısına göre değişebilir. Yukarıdakiler beklenen isimler.

## İlk Çalıştırma Sırası
1. `claude mcp list` — Slack ve Google MCP'lerin aktif olduğunu doğrula
2. `claude -p "Canvas F0B1B6XUD44'ü oku, footer'dan LAST_SYNC_TS değerini söyle"`
3. `claude -p "Skill: benseno-brief-sync — dry run, sadece ne yapacağını söyle"`
4. `launchctl list | grep benseno` — tüm job'ların aktif olduğunu doğrula
5. `tail -f logs/brief-sync.log` — canlı log izle

## Detaylı Sistem Bilgisi
Bkz: `docs/CLAUDE_CODE_BENSENO_MASTER_PROMPT.md` — SİSTEMİN TAMAMI orada.
Sorularını cevaplamadan önce ilgili bölümü oku.
