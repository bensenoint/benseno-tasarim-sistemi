# Benseno "Panom" — Tasarım Brief'i (Claude Design için)

## Bağlam
Bir tasarım/prodüksiyon ajansının **iç iş takip dashboard'ını** yeniden tasarlamak istiyorum.
Ekran adı **"Panom"** — her çalışanın kendine göre düzenleyebildiği, kart/widget tabanlı kişisel bir pano.
Mevcut sistem fonksiyonel olarak çalışıyor ama görsel olarak güçlü değil. Modern, sofistike,
**mobilde çok başarılı** ama **yoğun kullanım masaüstünde** olacak bir tasarım istiyorum.

Çıktı olarak **çalışan bir HTML/React artifact** (tek dosya, mock veriyle) bekliyorum: hem masaüstü
hem mobil görünüm, gerçek etkileşimler (sürükle-bırak, düzenle modu), 5 widget dolu veri ile.

---

## Kullanıcı & amaç
- **Kullanıcılar:** tasarımcılar, editörler, AI ekibi, freelancer'lar ve yöneticiler (~25 kişi).
- **Amaç:** kişi sabah panoyu açınca "bugün neye odaklanmalıyım, neyim riskte, ne kadar doluyum"
  sorularına 5 saniyede cevap alsın. Bilgi yoğun ama sakin, ferah bir his.
- **Ton:** sıcak, premium, editöryel. Kurumsal-soğuk DEĞİL. Marka rengi sıcak bir kiremit/ember turuncusu.

---

## Tasarım dili (markaya sadık kalınmalı)
- **Renkler (açık tema):** zemin `#FAF9F6`, kart `#FFFFFF`, hairline `#ECEAE3`, ana metin `#16161A`,
  ikincil `#5B5B66`, soluk `#8A8A94`. Marka aksanı **ember `#C24A2C`**.
- **Öncelik renkleri:** acil/risk kırmızı `#D7263D`, yüksek turuncu `#E2670A`, normal sarı `#B5A013`,
  düşük yeşil `#2E8F66` (her birinin %10-14 opaklıkta arka plan tint'i var).
- **Koyu tema da olmalı** (zemin `#1C1C22`, kart `#18181D`, ember `#E4623F`). Renkler CSS değişkeni olsun.
- **Tipografi:** gövde **Geist** (sans), büyük rakamlar/başlıklar **Instrument Serif** (display serif —
  KPI sayıları ve "Panom" başlığı bununla çok güzel duruyor), sayısal meta **Geist Mono**.
- **Form:** yumuşak (kart radius ~16px), ince hairline sınırlar, çok hafif gölge, hover'da 1px kalkma.
  Gradient/neon YOK; doku ve tipografiyle derinlik.

---

## Mimari: kişiye özel widget panosu
- 12 kolonlu **sürükle-bırak ızgara** (gridstack benzeri). Her widget `{tip, x, y, genişlik, yükseklik}`.
- **Düzenle modu** toggle'ı: açıkken kartlar sürüklenip köşeden boyutlandırılabilir, "+ alan ekle" ile
  kütüphaneden yeni widget eklenir, kart kaldırılabilir. Kapalıyken salt-görüntü, sakin.
- Düzen **kişiye özel** kaydedilir (kullanıcı kendi panosunu kurar). Mobilde **tek kolona** iner,
  widget sırası korunur.
- Her kart: küçük renkli **nokta + BÜYÜK HARF başlık + sağda sayı rozeti**; içerik altında.

---

## Widget'lar (fonksiyon + veri + görsel beklenti)
Aşağıdaki 5 çekirdek widget'ı gerçek mock veriyle tasarla. Hepsi salt-okur (tıklayınca detay açılabilir
ama veri girişi yok).

### 1) Riskli işlerim
- **Fonksiyon:** giriş yapan kişinin üstünde olup **termine ≤24 saat kalan veya gecikmiş** aktif işleri.
- **Veri/satır:** `#iş no`, iş başlığı, kalan/geçen süre (ör. `6sa` veya gecikmişse `12sa ↑`).
- **Görsel:** her satır kırmızı sol bar + çok hafif kırmızı tint; en acil üstte. Boşsa "risk yok 👍".

### 2) Kapasitem
- **Fonksiyon:** kişinin doluluk yüzdesi = aktif iş sayısı ÷ rol kapasitesi (yönetici 10, editör 8,
  tasarım/AI/freelance 6). Müşteride bekleyen ve tamamlanan işler aktif sayılmaz.
- **Görsel:** çok büyük serif yüzde rakamı (ör. **%50**), yanında `5/10`, altında **dolum çubuğu**
  (≥%90 kırmızı, ≥%70 turuncu, altı yeşil). Tek bakışta "doluyum/boşum" hissi.

### 3) Çalışılıyor
- **Fonksiyon:** şu an "çalışılıyor" durumundaki tüm işler (ekip geneli, en güncel akış).
- **Veri/satır:** marka renk noktası + iş başlığı + marka adı.
- **Görsel:** temiz liste, marka renkleriyle ritim; uzun listede kart içi kaydırma.

### 4) Müşteride
- **Fonksiyon:** müşteri onayı/dönüşü bekleyen iş sayısı + kısa liste.
- **Görsel:** büyük serif sayı (mor aksan), altında ilk birkaç işin listesi (marka noktalı).

### 5) Bugün ve yarın
- **Fonksiyon:** termini **48 saat içinde** olan, tamamlanmamış/müşteride olmayan işler, en yakın üstte.
- **Veri/satır:** `#no`, başlık, kalan saat (≤8sa kırmızı, ≤24sa turuncu, üstü sarı).

> **Sonraki tur widget'ları** (şimdilik sadece kütüphanede görünsün, tasarlanması şart değil):
> marka yoğunluğu, çıktı hızı (haftalık tamamlanan), son teslimler galerisi, departman özeti.

---

## Ody — sürüklenebilir avatar asistan (sistem kimliği)
- Ekranın istediği köşesine taşınabilen **yüzen avatar buton** (bir maskot/karakter — sisteme kimlik katıyor).
- Konum kişiye özel kaydedilir. Tıklayınca açılan panelde **proaktif kişisel brief** ("Merhaba Görkem 👋,
  bugün 5 aktif işin var, #2 Gürsoy ve #22 Marmara çalışılıyor…") + "Ody'ye sor" sohbet alanı.
- Yeni iş/risk olunca avatarda **okunmadı rozeti**. Izgaranın parçası DEĞİL — her zaman üstte yüzer.
- Bu öğenin karakterini/avatarını da tasarla (markaya uygun, dostane). İstersek mood/durum gösterebilir
  (meşgul / sakin / risk-uyarısı).

---

## Etkileşimler (mutlaka çalışsın)
- Düzenle aç/kapa; düzenlemede sürükle + köşeden boyutlandır + "+ alan ekle" seçici + kart kaldır.
- Düzen değişince kaydedilme hissi (kalıcılık — mock'ta localStorage yeter).
- Mobil: tek kolon, dokunmatik-dostu hedefler, üstte Ody.
- Hover/focus durumları, kart kaldırma animasyonu, çubuk dolum animasyonu.

---

## İstediğim "alışılmadık/özel" dokunuşlar (özgürsün)
- Bilgi hiyerarşisini tipografiyle kur (serif KPI'lar editöryel bir karakter veriyor).
- Sakin ama "canlı" hissettiren mikro-etkileşimler (sayı sayma, çubuk dolumu, kart yerleşme).
- Boş durumlar için karakterli, sıcak mesajlar.
- Yoğun veride ferahlık: bol boşluk, net ritim, az çizgi.
- Tek bir güçlü aksan rengi (ember) + öncelik renkleri; gerisi nötr.

## Kapsam dışı
- Backend/gerçek veri entegrasyonu yok (mock yeter). Veri yazma/düzenleme yok (salt-okur).
- Rol bazlı otomatik panolar yok (herkese aynı başlangıç, kişi kendi düzenler).

## Teslim
Tek dosya çalışan artifact: **masaüstü + mobil** görünüm, açık+koyu tema, 5 widget dolu mock veriyle,
düzenle modu ve sürüklenebilir Ody çalışır halde. Önce 2-3 görsel yön öner, sonra seçtiğimi geliştir.
