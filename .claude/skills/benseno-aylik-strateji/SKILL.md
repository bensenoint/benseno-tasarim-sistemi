---
name: benseno-aylik-strateji
description: v7.5 · Phase 7 — Aylık Strateji (ay sonu 17:00). 5 yöneticiye kapsamlı stratejik özet (GM/GMY/Direktör/2 Yön.). Marka kârlılık, kapasite forecast, trend grafikler, strateji önerileri.
---

---
name: benseno-aylik-strateji
description: v7.5 · Phase 7 — Aylık Strateji (ay sonu 17:00). Yöneticilere kapsamlı stratejik özet PDF (Drive): marka kârlılık, kapasite forecast, trend grafikler, Phase 7 KPI'ları, strateji önerileri. 5 yöneticiye DM bildirim.
---

# Benseno Tasarım — Aylık Stratejik Özet (Ay Sonu)

## SABİTLER
```
CANVAS_ID = F0B1B6XUD44
GRAFIK_CHANNEL_ID = C02SZRJGY0M
DRIVE_FOLDER_ID = 14gzFxG5gnigWLPh3Qc1pNTNS14u3BMMK
DASHBOARD_URL = https://bensenoint.github.io/dashboard/
TZ = Europe/Istanbul
```

## 👑 YÖNETİCİLER (5 kişi — DM gider)
Hiyerarşi sırasıyla:
1. **Görkem Kaya (U030C48PL23)** — Genel Müdür · şirket ortağı · stratejik kararlar
2. **Reyhan Nur Pınar (UD96GH76E)** — Genel Müdür Yardımcısı · şirket ortağı · operasyonel öncelikler
3. **Cansu Kazgan (U4XCE3532)** — Direktör · Tasarım/Editör/AI ekiplerinin tümünden sorumlu
4. **İpek Akdeniz (U055EDESLSE)** — Tasarım Ekibi Yöneticisi
5. **erdem akoğlu (U02SZQDAFPF)** — Editör Ekibi Yöneticisi

## ADIMLAR

### 0. Tarih kontrolü
Bugün ayın **son iş günü** (son Pazartesi-Cuma) mü? Değilse **çıkış yap, hiçbir şey yapma**:
- Bugün Cumartesi/Pazar → çıkış
- Bu ay'ın geri kalan günlerinde Pazartesi-Cuma var mı? Varsa çıkış
- Sadece son iş günü (örn. 31 Mayıs Pazar ise 29 Mayıs Cuma) devam

### 1. Canvas oku
`slack_read_canvas` F0B1B6XUD44. Aktif + Tamamlanan parse et.

### 2. Aylık veri seti
Ayın 1'inden bugüne. Tamamlananlar (Bitiş ts ay içinde), brief'ler (Geçmiş başlangıcı ay içinde).

### 3. Analiz
**Aylık metrikler:** toplam tamamlanan, toplam saat, toplam revizyon, top 3 marka/tasarımcı/editör, kapasite kullanımı %, geçen ay karşılaştırma, müşteri memnuniyet (M14), reopen sayısı (M16)

**Risk göstergeleri:** revizyon spike marka, sürekli yoğun tasarımcı, SLA breach sayısı

**Departman bazlı detay:**
- 🎨 Tasarım Ekibi (İpek Yön.): 7 kişi, top performer, kalite skoru, mentörlük notları
- ✍️ Editör Ekibi (erdem Yön.): 8 kişi, brief kalitesi trendi, atama dağılımı  
- 🤖 AI (Eren): 8 tip dağılımı, cross-dept başarı oranı

### 4. Markdown rapor üret (rolüne göre özelleştirilmiş)

#### Görkem (GM) — STRATEJİK
Yüksek seviye: ciro, kapasite, müşteri memnuniyeti trendi, ekip büyüme önerisi.

#### Reyhan (GMY) — OPERASYONEL + STRATEJİK
Operasyonel: kapasite kullanımı, ekip dağılımı, müşteri ilişkileri özeti.

#### Cansu (Direktör) — 3 DEPARTMAN DETAY
Tüm 16 kişinin performans detayı, departmanlar arası karşılaştırma, kalite metrikleri.

#### İpek (Tasarım Yön.) — TASARIM ODAKLI
7 tasarımcının aylık detayı, marka uzmanlık matrisi, ekip içi mentörlük notları.

#### erdem (Editör Yön.) — EDİTÖR ODAKLI
8 editörün brief kalitesi, atama doğruluğu, müşteri-editör koordinasyon.

### 5. **Drive'a yükle (timestamp'li)**
`mcp__9fa2c5d0-..._create_file`:
- title: `Aylik-Strateji-{YYYY-MM-DD}-{HHMM}.md` (örn. `Aylik-Strateji-2026-05-29-1700.md`)
- contentMimeType: `text/markdown`
- parentId: 14gzFxG5gnigWLPh3Qc1pNTNS14u3BMMK

### 6. 5 yöneticiye DM (rol-özelleştirilmiş içerik)
Her birine kendi rolüne uygun versiyon. DM içeriğinde:
- Detaylı analiz Drive linkinde
- Canlı dashboard: https://bensenoint.github.io/dashboard/

### 7. #benseno-grafik kanalına özet (kısa, herkese)
Ekip geneli özet + Drive raporu linki + Dashboard URL.

### Hata
- Canvas erişim hatası: log + DM yöneticilere (5 kişi)
- Drive upload fail: log
- Tarih kontrolü: log + retry yarın
