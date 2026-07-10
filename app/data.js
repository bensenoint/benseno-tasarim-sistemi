// app/data.js
// Dense Friday-morning fixture for Benseno dashboard.
// 19 users · 39 brands · 60 active briefs · 30 completed · activity log.
// Plain script (no Babel). Exposes window.BNS_DATA.

(function () {

// ─── USERS ──────────────────────────────────────────────────────────────────
// Kanonik kullanıcı ismi overlay'i. data-agent bns_users isimleri HALÜSİNE olabiliyor (gerçek
// soyadları uyduruyor: "Eren Yıldız" oysa "Eren Mahzunlar"). İsmi her zaman bu git-tracked
// fixture'dan al; renk/initials/dept agent'tan kalır. İki yerde kullanılır (bu bridge + App.jsx poll).
function bnsMergeUser(u) {
  const c = (typeof BNS_CANON_USERS !== "undefined") ? BNS_CANON_USERS[u.id] : null;
  return { ...u, name: (c && c.name) || u.name, rol: u.rol || u.dept || "" };
}

// Brief-başına dayanıklı map: TEK bir bozuk kayıt (data-agent drift) tüm dashboard'ı çökertmesin.
// Bozuk olanı atla + uyar, gerisini döndür. (Eskiden bir hata tüm bridge'i mock'a düşürüyordu.)
function bnsSafeMap(arr, fn, label) {
  const out = []; let skipped = 0;
  for (let i = 0; i < arr.length; i++) {
    try { out.push(fn(arr[i], i)); }
    catch (e) { skipped++; if (skipped <= 3) try { console.warn("[BNS] " + (label || "hydrate") + " atlandı #" + (arr[i] && arr[i].no) + ": " + e.message); } catch (_) {} }
  }
  if (skipped) try { console.warn("[BNS] " + (label || "hydrate") + ": " + skipped + " kayıt atlandı (gerisi gösteriliyor)"); } catch (_) {}
  return out;
}
try { window.bnsSafeMap = bnsSafeMap; } catch (e) {}

const USERS = [
  // Yöneticiler (5)
  { id: "U030C48PL23", name: "Görkem Kaya",       mono: "GK", rol: "yonetici", title: "Genel Müdür" },
  { id: "UD96GH76E",   name: "Reyhan Nur Pınar",  mono: "RP", rol: "yonetici", title: "GMY" }, // NOTE: kanonik isimler — değiştirme
  { id: "U4XCE3532",   name: "Cansu Kazgan",      mono: "CK", rol: "yonetici", title: "Direktör" },
  { id: "U055EDESLSE", name: "İpek Akdeniz",      mono: "İA", rol: "yonetici", title: "Tasarım Yön." },
  { id: "U02SZQDAFPF", name: "Erdem Akoğlu",      mono: "EA", rol: "yonetici", title: "Editör Yön." },
  // Tasarım (6)
  { id: "U0AN6DD79M0", name: "Aylin Tozkoparan",  mono: "AT", rol: "tasarim" },
  { id: "U06J26R1XCJ", name: "Aykut Arslan",      mono: "AA", rol: "tasarim" },
  { id: "U09BFPBKQG7", name: "Hasan Serdar Arda", mono: "HA", rol: "tasarim" },
  { id: "U0B3K2WE7SB", name: "Pelin Özdemir",     mono: "PÖ", rol: "tasarim", isNew: true },
  { id: "U0AK8U7L57F", name: "İrem Özkan",        mono: "İÖ", rol: "tasarim" },
  { id: "U08HLMHTGEL", name: "Serhat Tokmak",     mono: "ST", rol: "tasarim" },
  // Editör (6)
  { id: "U09BZHR25NG", name: "Eda Tireli",        mono: "ET", rol: "editor" },
  { id: "U07PV0RA9L2", name: "Eda Ayral",         mono: "EY", rol: "editor" },
  { id: "U08NQJ27G5S", name: "Melis Genç",        mono: "MG", rol: "editor" },
  { id: "U05PP70GQTX", name: "Aylin Canel",       mono: "AC", rol: "editor" },
  { id: "U063T8M5HL4", name: "Buse Gürbüzer",     mono: "BG", rol: "editor" },
  { id: "U0AAC3YK20G", name: "Simge Acar",        mono: "SA", rol: "editor" },
  { id: "U0BDQ1MKXRB", name: "Serra Kibar",       mono: "SK", rol: "editor" },
  // AI (1)
  { id: "U0AP31SAA1W", name: "Eren Mahzunlar",    mono: "EM", rol: "ai",     title: "AI Operatör" }
];

const BNS_CANON_USERS = USERS.reduce((m, u) => { m[u.id] = u; return m; }, {});
try { window.bnsMergeUser = bnsMergeUser; window.BNS_CANON_USERS = BNS_CANON_USERS; } catch (e) {}

const ME = USERS[0]; // Görkem default

// ─── BRANDS ─────────────────────────────────────────────────────────────────
const BRAND_NAMES = [
  "X-Spor Akademisi", "Marka Studio", "Yeşil Çiftlik", "Bauhaus TR",
  "Ada Mimarlık", "Kuzey Yayınevi", "Demir Çelik", "Kahve Atölye",
  "Pera Galeri", "Yıldız Lojistik", "Mor Salkım", "Deniz Turizm",
  "Çınar Eğitim", "Boğaziçi Üniversitesi", "İstinye Park", "Atlas Restoran",
  "Vega Mobilya", "Lale Hastanesi", "Anadolu Sigorta", "Karadeniz Balıkçılık",
  "Anka Mücevher", "Marmara Gemicilik", "Toros Otomotiv", "Ege Tarım",
  "Akdeniz Tatil", "Bursa Tekstil", "Konya Un", "Sivas Demir Yolu",
  "Trabzon Çay", "Antalya Turizm", "Adana Pamuk", "Mersin Liman",
  "Eskişehir Seramik", "Samsun Tütün", "Diyarbakır Bal", "Kayseri Halı",
  "Gaziantep Baklava", "Şanlıurfa Tarih", "Van Gölü Tur"
];
function brandHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
  return Math.abs(h) % 16;
}
const WHEEL = [
  "#4E79A7","#F28E2B","#59A14F","#B07AA1","#76B7B2","#E15759","#EDC948","#9C755F",
  "#BAB0AC","#2C7FB8","#D9881F","#6A8E3D","#8E5BA1","#00786F","#C44545","#B79100"
];
const BRANDS = BRAND_NAMES.map((name) => ({
  name, color: WHEEL[brandHash(name)], wheelIdx: brandHash(name)
}));
const BR = Object.fromEntries(BRANDS.map(b => [b.name, b]));

// ─── TIME ───────────────────────────────────────────────────────────────────
// Friday 18 May 2026 · 14:30 İstanbul
const NOW = new Date("2026-05-18T14:30:00+03:00").getTime();
const H = 3600 * 1000;
function prio(deltaH) {
  if (deltaH <= 0)  return { code: "over", label: "GEÇMİŞ", color: "var(--prio-red)" };
  if (deltaH <= 8)  return { code: "red",  label: "ACİL",   color: "var(--prio-red)" };
  if (deltaH <= 24) return { code: "org",  label: "YÜKSEK", color: "var(--prio-orange)" };
  if (deltaH <= 72) return { code: "ylw",  label: "NORMAL", color: "var(--prio-yellow)" };
  return                  { code: "grn",  label: "DÜŞÜK",  color: "var(--prio-green)" };
}

// ─── ACTIVE BRIEFS ──────────────────────────────────────────────────────────
// Carefully tuned distribution:
//   8 overdue (deltaH < 0)
//   12 in "incelemede" (awaiting manager approval)
//   ~12 today (≤24h)
//   ~14 this week
//   ~14 normal
//   Departments balanced: ~28 tasarım, ~22 editör, ~10 AI
//
// Tuple: [marka, baslik, leadId, contribIds[], reviewerId, deltaH, durum, rev]
const A = [
  // — OVERDUE 8 ————————————————————————————————————————————————
  ["Demir Çelik",        "Sürdürülebilirlik raporu kapağı",   "U06J26R1XCJ", ["U0AN6DD79M0"],          "U055EDESLSE", -3,   "calisiliyor", 5],
  ["Toros Otomotiv",     "Bayi sunum kiti — final revize",     "U0AN6DD79M0", [],                       "U055EDESLSE", -1,   "calisiliyor", 4],
  ["Lale Hastanesi",     "Hasta yönlendirme tabela seti",      "U08HLMHTGEL", ["U0AK8U7L57F"],          "U055EDESLSE", -8,   "calisiliyor", 2],
  ["Bursa Tekstil",      "Yaz koleksiyonu lookbook · ed.",     "U09BZHR25NG", ["U07PV0RA9L2"],          "U02SZQDAFPF", -5,   "incelemede",  3],
  ["Konya Un",           "Ambalaj etiket revizesi",            "U06J26R1XCJ", [],                       null,         -16,  "blokeli",     6],
  ["Çınar Eğitim",       "Yıllık katalog · baskı dosyası",     "U0AK8U7L57F", [],                       "U055EDESLSE", -2,   "calisiliyor", 3],
  ["Adana Pamuk",        "Fuar standı görsel kiti",            "U0AP31SAA1W", [],                       null,         -11,  "calisiliyor", 1],
  ["Mersin Liman",       "Operasyon broşürü editörlüğü",       "U08NQJ27G5S", [],                       "U02SZQDAFPF", -6,   "incelemede",  2],

  // — TODAY ≤24h ——————————————————————————————————————————————
  ["X-Spor Akademisi",   "Mart kampanya görselleri",           "U0AN6DD79M0", ["U06J26R1XCJ"],          "U055EDESLSE", 4,    "calisiliyor", 2],
  ["Pera Galeri",        "Açılış davetiye seti",               "U0AK8U7L57F", [],                       null,          7,    "calisiliyor", 1],
  ["Bauhaus TR",         "Bauhaus dergi sayı 12 — editörlük",  "U09BZHR25NG", ["U07PV0RA9L2"],          "U02SZQDAFPF", 18,   "incelemede",  4],
  ["İstinye Park",       "Ramazan dekorasyon konsept",         "U0B3K2WE7SB", [],                       "U055EDESLSE", 12,   "incelemede",  3],
  ["Boğaziçi Üniversitesi","Açılış konuşması metni",           "U07PV0RA9L2", [],                       "U02SZQDAFPF", 22,   "calisiliyor", 1],
  ["Anka Mücevher",      "E-ticaret görsel seti",              "U09BFPBKQG7", [],                       "U055EDESLSE", 16,   "incelemede",  2],
  ["Kahve Atölye",       "Yeni ambalaj sistemi",               "U09BFPBKQG7", ["U0B3K2WE7SB"],          "U055EDESLSE", 20,   "calisiliyor", 1],
  ["Karadeniz Balıkçılık","Sosyal medya seti · 12 post",       "U0AP31SAA1W", [],                       null,          14,   "calisiliyor", 0],
  ["Atlas Restoran",     "Menü tasarımı — yaz",                "U0AK8U7L57F", ["U0AN6DD79M0"],          "U055EDESLSE", 9,    "calisiliyor", 2],
  ["Antalya Turizm",     "Yaz katalog kapak revizyon",         "U06J26R1XCJ", [],                       "U055EDESLSE", 6,    "incelemede",  3],
  ["Marmara Gemicilik",  "Servis rehberi · son okuma",         "U05PP70GQTX", [],                       "U02SZQDAFPF", 23,   "incelemede",  1],
  ["Kayseri Halı",       "Yıllık rapor — kapak",               "U0B3K2WE7SB", [],                       "U055EDESLSE", 11,   "calisiliyor", 1],

  // — THIS WEEK 24–72h ———————————————————————————————————————————
  ["Anadolu Sigorta",    "Q2 sunum şablonu",                   "U05PP70GQTX", [],                       "U02SZQDAFPF", 36,   "calisiliyor", 0],
  ["Ada Mimarlık",       "Portfolyo PDF",                      "U0AN6DD79M0", [],                       null,          62,   "incelemede",  3],
  ["Mor Salkım",         "Yıllık rapor — 48 sayfa",            "U09BZHR25NG", ["U08NQJ27G5S","U063T8M5HL4"], "U02SZQDAFPF", 56, "calisiliyor", 4],
  ["Toros Otomotiv",     "Bayi sunum kiti",                    "U0AN6DD79M0", [],                       null,          44,   "calisiliyor", 1],
  ["Vega Mobilya",       "Showroom afiş seti",                 "U08HLMHTGEL", [],                       "U055EDESLSE", 50,   "calisiliyor", 2],
  ["Trabzon Çay",        "Sezon kampanyası · 6 görsel",        "U0B3K2WE7SB", ["U0AN6DD79M0"],          "U055EDESLSE", 38,   "calisiliyor", 1],
  ["Sivas Demir Yolu",   "Yolculuk rehberi editörlük",         "U07PV0RA9L2", [],                       "U02SZQDAFPF", 64,   "incelemede",  2],
  ["Eskişehir Seramik",  "E-katalog · ürün açıklamaları",      "U063T8M5HL4", [],                       "U02SZQDAFPF", 70,   "calisiliyor", 1],
  ["Anadolu Sigorta",    "İK el kitabı revizyon",              "U08NQJ27G5S", [],                       null,          48,   "incelemede",  3],
  ["Ege Tarım",          "Şirket sunumu güncelleme",           "U05PP70GQTX", [],                       "U02SZQDAFPF", 54,   "calisiliyor", 0],
  ["Gaziantep Baklava",  "Sezon afiş kampanyası",              "U0AN6DD79M0", ["U08HLMHTGEL"],          "U055EDESLSE", 42,   "calisiliyor", 2],
  ["Şanlıurfa Tarih",    "Müze rehber kitapçığı",              "U09BFPBKQG7", ["U0AK8U7L57F"],          "U055EDESLSE", 68,   "calisiliyor", 1],
  ["Diyarbakır Bal",     "Ambalaj görsel revizyon",            "U06J26R1XCJ", [],                       "U055EDESLSE", 32,   "calisiliyor", 2],
  ["Boğaziçi Üniversitesi","Mezuniyet etkinlik görselleri",    "U09BFPBKQG7", [],                       null,          58,   "yeni",        0],

  // — NORMAL 3-7 day —————————————————————————————————————————
  ["Yeşil Çiftlik",      "Yaz menü illüstrasyon seti",         "U0B3K2WE7SB", [],                       "U055EDESLSE", 96,   "yeni",        0],
  ["Marka Studio",       "Marka kılavuzu güncelleme",          "U055EDESLSE", [],                       null,          140,  "blokeli",     2],
  ["Yıldız Lojistik",    "Filo görsel kimlik",                 "U08HLMHTGEL", [],                       null,          120,  "yeni",        0],
  ["Kuzey Yayınevi",     "Roman kapağı serisi · 6 adet",       "U09BFPBKQG7", ["U0AN6DD79M0","U0AK8U7L57F"], "U055EDESLSE", 90, "incelemede", 2],
  ["Deniz Turizm",       "Yaz katalog tasarımı",               "U0AK8U7L57F", ["U06J26R1XCJ"],          "U055EDESLSE", 110,  "yeni",        0],
  ["Akdeniz Tatil",      "Rezervasyon broşürü",                "U07PV0RA9L2", [],                       "U02SZQDAFPF", 88,   "calisiliyor", 1],
  ["Van Gölü Tur",       "İçerik kitapçığı editörlüğü",        "U05PP70GQTX", [],                       null,          150,  "yeni",        0],
  ["Anka Mücevher",      "Katalog baskı dosyası",              "U0AK8U7L57F", [],                       "U055EDESLSE", 84,   "calisiliyor", 0],
  ["Samsun Tütün",       "Sezon raporu kapağı",                "U0AN6DD79M0", [],                       null,          130,  "yeni",        0],
  ["Gaziantep Baklava",  "Ürün fotoğraf yönlendirme",          "U0AP31SAA1W", [],                       "U055EDESLSE", 100,  "calisiliyor", 0],

  // — LOW PRIORITY > 7 day ——————————————————————————————————
  ["Yıldız Lojistik",    "Çalışan onboarding kitabı",          "U063T8M5HL4", [],                       null,          200,  "yeni",        0],
  ["X-Spor Akademisi",   "Antrenör broşürü",                   "U06J26R1XCJ", [],                       "U055EDESLSE", 168,  "yeni",        0],
  ["Lale Hastanesi",     "İK iletişim seti",                   "U08NQJ27G5S", [],                       null,          240,  "yeni",        0],
  ["Marka Studio",       "İç eğitim videosu metni",            "U0AAC3YK20G", [],                       "U02SZQDAFPF", 180,  "yeni",        0],
  ["Mor Salkım",         "Q3 strateji sunumu",                 "U09BZHR25NG", [],                       "U02SZQDAFPF", 216,  "calisiliyor", 1],
  ["Anadolu Sigorta",    "Web içerik denetimi",                "U0AP31SAA1W", [],                       null,          192,  "yeni",        0],
  ["Bauhaus TR",         "Web sayfa içerik düzeni",            "U07PV0RA9L2", [],                       null,          220,  "yeni",        0],
  ["Ada Mimarlık",       "Web galeri yenileme",                "U0B3K2WE7SB", [],                       null,          156,  "yeni",        0],
  ["Demir Çelik",        "Sponsor sunumu",                     "U0AAC3YK20G", [],                       "U02SZQDAFPF", 144,  "calisiliyor", 0],
  ["Pera Galeri",        "Sergi katalog · giriş",              "U07PV0RA9L2", [],                       null,          172,  "yeni",        0],
  ["Vega Mobilya",       "Showroom dijital ekran içerikleri",  "U0AP31SAA1W", [],                       null,          204,  "yeni",        0],
  ["Çınar Eğitim",       "Veli rehberi · sayfa düzeni",        "U0AK8U7L57F", [],                       "U055EDESLSE", 188,  "yeni",        0]
];

// Some incelemede tally — must hit 12. Count current:
//   manual: 5 overdue/today × incelemede + this-week × incelemede ≈ 12 ✓

const briefs = A.map((r, i) => {
  const [marka, baslik, leadId, contribIds, reviewerId, dh, durum, rev] = r;
  const deadline = NOW + dh * H;
  // pseudo-random but stable open time
  const seed = (i * 73 + 13) % 96;
  const acilma = NOW - (seed + 24) * H;
  const stale = dh > 48 && (i % 7 === 0);
  return {
    id: "br_" + (1000 - i),
    no: 142 - i,
    marka,
    brand: BR[marka],
    baslik,
    lead:         USERS.find(u => u.id === leadId),
    contributors: (contribIds || []).map(id => USERS.find(u => u.id === id)),
    reviewer:     reviewerId ? USERS.find(u => u.id === reviewerId) : null,
    acilma,
    deadline,
    durum,
    priority:     prio(dh),
    deltaH:       dh,
    revision:     rev,
    stale,
    slack_url:    "#",
    notes: ""
  };
});

// ─── COMPLETED (30) ─────────────────────────────────────────────────────────
const completedTitles = [
  "Marka kimlik dökümü","Sayfa tasarımı","E-bülten görseli","Kapak çalışması",
  "Sosyal medya seti","Rapor şablonu","Logo varyasyonları","Sunum şablonu",
  "İllüstrasyon seti","Davetiye kartı","Web içerik düzeni","Katalog sayfası"
];
const completed = [];
for (let i = 0; i < 30; i++) {
  const marka = BRAND_NAMES[(i * 5 + 3) % BRAND_NAMES.length];
  const lead  = USERS[(i * 3 + 5) % USERS.length];
  const days  = (i % 14) + 1;
  const sure  = +(Math.abs(Math.sin(i * 7.13)) * 24 + 6).toFixed(1);
  const gecikme = i % 4 === 0 ? +(Math.abs(Math.cos(i)) * 5).toFixed(1) : 0;
  completed.push({
    id: "br_c" + i,
    no: 1000 - i,
    marka,
    brand: BR[marka],
    baslik: completedTitles[i % completedTitles.length],
    lead,
    deadline: NOW - (days * 24 - 6) * H,
    bitis: NOW - (days * 24 - 12) * H,
    basla: NOW - (days * 24 + 36) * H,
    sure,
    gecikme,
    revision: i % 4,
    rating: Math.min(5, 3 + (i % 3))
  });
}

// ─── ACTIVITY LOG ──────────────────────────────────────────────────────────
const activity = [
  { t: NOW - 6*60*1000,  who: "U055EDESLSE", verb: "onayladı", target: "Bauhaus dergi sayı 12 — editörlük" },
  { t: NOW - 14*60*1000, who: "U0AN6DD79M0", verb: "durumu değiştirdi", target: "X-Spor Mart kampanya", meta: "çalışılıyor → incelemede" },
  { t: NOW - 22*60*1000, who: "U06J26R1XCJ", verb: "rev push", target: "Demir Çelik kapak", meta: "rev 05" },
  { t: NOW - 34*60*1000, who: "U030C48PL23", verb: "atadı", target: "Pera Galeri davetiye", meta: "İrem Özkan" },
  { t: NOW - 47*60*1000, who: "U0AP31SAA1W", verb: "tamamladı", target: "Karadeniz · sosyal medya 12 post" },
  { t: NOW - 1.2*H,      who: "U055EDESLSE", verb: "yorum ekledi", target: "Mor Salkım yıllık rapor" },
  { t: NOW - 1.8*H,      who: "U09BZHR25NG", verb: "yeni brief açtı", target: "Anadolu Sigorta · İK el kitabı revizyon" },
  { t: NOW - 2.5*H,      who: "U0B3K2WE7SB", verb: "contributor olarak eklendi", target: "Kahve Atölye ambalaj" },
  { t: NOW - 3.1*H,      who: "U02SZQDAFPF", verb: "reddetti", target: "Konya Un etiket", meta: "rev gerekli" },
  { t: NOW - 4.2*H,      who: "U0AN6DD79M0", verb: "rev push", target: "X-Spor Mart kampanya", meta: "rev 02" },
  { t: NOW - 5.6*H,      who: "U030C48PL23", verb: "deadline değiştirdi", target: "Demir Çelik kapak", meta: "+24 sa" },
  { t: NOW - 7.0*H,      who: "U08HLMHTGEL", verb: "durumu değiştirdi", target: "Lale Hastanesi tabela", meta: "yeni → çalışılıyor" },
  { t: NOW - 9.5*H,      who: "U055EDESLSE", verb: "yorum ekledi", target: "İstinye Park ramazan" },
  { t: NOW - 12*H,       who: "U06J26R1XCJ", verb: "tamamladı", target: "Bursa Tekstil lookbook · ilk pas" },
  { t: NOW - 18*H,       who: "U0AK8U7L57F", verb: "yeni brief açtı", target: "Pera Galeri açılış davetiye" }
];

// ─── DEPT STATS ────────────────────────────────────────────────────────────
// capacity burada yüzde (%) olarak tutulur.
// live-data'dan gelen capacity = slot sayısı (people × limit), bnsCapPct() ile yüzdeye çevrilir.
const deptStats = {
  // capacity = people × 6 (kişi başı limit) → yüzde: active/capacity*100
  tasarim: { name: "Tasarım", people: 6,  active: 28, overdue: 4, capacity: 36, completed30: 84, avgComplete: 26.4, revRate: 18 },
  editor:  { name: "Editör",  people: 6,  active: 22, overdue: 2, capacity: 36, completed30: 71, avgComplete: 34.1, revRate: 22 },
  ai:      { name: "AI",      people: 1,  active: 10, overdue: 2, capacity:  6, completed30: 38, avgComplete: 18.7, revRate: 11 }
};

// NOT: bnsCapPct / bnsPersonCapLimit / bnsPersonCapPct artık calc.js'te (tek doğruluk kaynağı,
// node'da test edilebilir). calc.js index.html'de data.js'ten ÖNCE yüklenir → global olarak gelir.

// Tüm dept stats'ı capacity_pct alanı ile normalize et.
// Canlı API capacity göndermez → people × 6 (kişi başı slot) ile türet.
const DEPT_TR = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
function bnsNormDeptStats(raw) {
  const out = {};
  for (const [k, s] of Object.entries(raw || {})) {
    let capacity = s.capacity || (s.people ? s.people * 6 : 0);
    // Yarım gün çalışanların eksik kapasitesini departmandan düş (Serhat 0.5 → -3 slot).
    if (!s.capacity && typeof bnsDeptCapDeduction === 'function') {
      capacity = Math.max(0, Math.round(capacity - bnsDeptCapDeduction(k)));
    }
    // Canlı API name göndermez (yalnız dept anahtarı) → görünen ad burada eklenir.
    out[k] = { ...s, name: s.name || DEPT_TR[k] || k, capacity, capacity_pct: bnsCapPct({ ...s, capacity }) };
  }
  return out;
}

window.bnsNormDeptStats = bnsNormDeptStats;

// ─── BRAND STATS (for marka tab) ───────────────────────────────────────────
const brandStats = BRANDS.map(b => {
  const active = briefs.filter(x => x.marka === b.name).length;
  const done30 = completed.filter(x => x.marka === b.name).length;
  const seed   = brandHash(b.name);
  return {
    ...b,
    active,
    done30: done30 + (seed % 4),
    medianH: 18 + (seed % 8) * 4,
    madH:    3 + (seed % 4),
    avgRev:  (1 + (seed % 5) * 0.3).toFixed(1),
    rating:  (3.6 + (seed % 6) * 0.18).toFixed(1),
    stale:   active > 0 && seed % 5 === 0
  };
});

// ─── TEAM × BRAND MATRIX ───────────────────────────────────────────────────
// For team-matrix tab — number of completions per user per brand (deterministic)
function matrix() {
  const m = {};
  USERS.forEach(u => {
    m[u.id] = {};
    BRANDS.forEach(b => {
      let v = ((u.id.charCodeAt(2) + b.name.charCodeAt(0) + b.name.length) * 7) % 11;
      if (u.rol === "ai" && (b.wheelIdx % 3) !== 0) v = Math.max(0, v - 4);
      if (u.rol === "yonetici") v = Math.max(0, v - 3);
      m[u.id][b.name] = v < 2 ? 0 : v - 2;
    });
  });
  return m;
}

// Türkçe tarih formatlayıcı — header eyebrow ve footer için
const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const TR_DAYS   = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
function fmtTr(ts, opts) {
  opts = opts || {};
  // TR timezone: UTC+3 fixed, no DST since 2016.
  // Force +3 from UTC epoch — works regardless of host timezone.
  const tr = new Date(ts + 3 * 3600000);
  const day   = tr.getUTCDate();
  const mon   = TR_MONTHS[tr.getUTCMonth()];
  const year  = tr.getUTCFullYear();
  const dow   = TR_DAYS[tr.getUTCDay()];
  const hh    = String(tr.getUTCHours()).padStart(2, "0");
  const mm    = String(tr.getUTCMinutes()).padStart(2, "0");
  if (opts.style === "full")    return `${day} ${mon} ${year} · ${hh}:${mm} (Europe/Istanbul)`;
  if (opts.style === "footer")  return `Son senkron · ${day} ${mon} ${year} · ${hh}:${mm} (Europe/Istanbul)`;
  if (opts.style === "dense")   return `${day} ${mon} ${year} · ${dow} ${hh}:${mm}`;
  // default: editorial eyebrow
  return `${day} ${mon} · ${dow} · ${hh}:${mm} (Europe/Istanbul)`;
}

window.BNS_DATA = {
  USERS, ME, BRANDS, briefs, completed, activity,
  deptStats, brandStats, NOW, WHEEL, brandHash,
  matrix: matrix(),
  fmtTr
};

// ─── LIVE DATA BRIDGE ──────────────────────────────────────────────────────
// Brief Sync skill bu dashboard'a veri akışını EMBEDDED_DATA üzerinden sağlar.
//
//   window.EMBEDDED_DATA.bns_briefs      → sade brief object[] (lookup edilecek)
//   window.EMBEDDED_DATA.bns_completed   → tamamlanan brief object[]
//   window.EMBEDDED_DATA.last_sync       → "2026-05-19T15:25:00+03:00"
//   window.EMBEDDED_DATA.now             → "2026-05-19T15:25:00+03:00" (NOW override)
//
// Sade brief object şekli:
//   { id, no, marka, baslik, leadId, contribIds[], reviewerId,
//     acilma (ISO), deadline (ISO), durum, revision, stale, slack_url, notes }
// Bridge bunu USERS/BR/prio ile zenginleştirir → tam Brief object.
//
// EMBEDDED_DATA yoksa yukarıdaki mock veri kalır.
// Uzun durum açıklamalarını ("⏳ Yeni açıldı (Eda T...") kısa koda normalize eder
function bnsNormalizeDurum(durum, status) {
  // Zaten kısa kod mu?
  const SHORT = ["yeni","calisiliyor","basladi","incelemede","beklemede","revizyon","musteride","blokeli","tamamlandi","tamamlandı"];
  const raw = (durum || status || "").trim();
  const d = raw.toLowerCase();
  if (SHORT.includes(d)) return d === "tamamlandı" ? "tamamlandi" : d;

  // 1. 🎨 teslim / v1-v2 verildi / onay bekleniyor → incelemede (tamamlandi'dan ÖNCE bak)
  if (/🎨[^(]*verildi|🎨[^(]*tamamladı|v\d+\s*verildi|v\d+\s*teslim|resmi onay|onay bekl/i.test(raw)) return "incelemede";

  // 2. Tamamlandı — sadece cümle BAŞINDA güçlü sinyal (yan cümledeki "tamamlandığında" gibi değil)
  if (/^(✅|tamamland[ıi]|bitti|done)/i.test(raw)) return "tamamlandi";

  // 3. Ertelendi / ⏸ → blokeli
  if (/ertelendi|ertelend|⏸|iptal/i.test(raw)) return "blokeli";

  // 4. Blokeli
  if (/blokel[ıi]|blokland[ıi]/i.test(d)) return "blokeli";

  // 5. İncelemede / revize
  if (/incelem|review|revize bekl/i.test(d)) return "incelemede";

  // 6. Çalışılıyor
  if (/çalışıl|calisil|devam|sürd|started/i.test(d)) return "calisiliyor";

  // 7. Yeni / sırada
  if (/⏳|yeni|sırada|açıldı|acildi|dispatch/i.test(d)) return "yeni";

  return "yeni";
}

function bnsHydrateBrief(raw, idx) {
  // acilma: önce raw.acilma, yoksa gecmis'ten ilk ⏳ zaman damgasını çıkar
  let acilma = typeof raw.acilma === "string" ? Date.parse(raw.acilma) : (raw.acilma || null);
  if (!acilma && typeof raw.gecmis === "string") {
    // "⏳18May13:16→..." formatından ilk tarihi çıkar. NOT: data-agent gecmis'i bazen boolean
    // (geçmiş/overdue bayrağı) yazıyor — tip guard olmadan .match() boolean'da patlıyordu.
    const m = raw.gecmis.match(/(\d{1,2})([A-Za-z]{3})(\d{1,2}:\d{2})/);
    if (m) {
      const TR_MON = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11,
                      Oca:0,Sub:1,Şub:1,Nis:3,May:4,Haz:5,Tem:6,Agu:7,Eyl:8,Eki:9,Kas:10,Ara:11};
      const mon = TR_MON[m[2]];
      if (mon != null) {
        const [hh,mm] = m[3].split(":").map(Number);
        acilma = new Date(new Date().getFullYear(), mon, parseInt(m[1]), hh, mm, 0).getTime();
      }
    }
  }
  // Canlı veride raw.acilma/gecmis yok ama created_at (DB açılış zamanı) gelir → asıl kaynak bu.
  if (!acilma && raw.created_at != null) {
    acilma = typeof raw.created_at === "string" ? Date.parse(raw.created_at) : raw.created_at;
  }
  // deadline: "18 May 2026", "1 Haziran 2026", ISO veya ms — hepsini destekle
  let deadlineRaw = raw.deadline || raw.deadlineISO;
  let deadline = 0;
  if (typeof deadlineRaw === "string") {
    // Türkçe tam ay adları ve kısaltmaları → sayıya çevir
    const TR_DL = {Ocak:0,Oca:0,Şubat:1,Şub:1,Mart:2,Mar:2,Nisan:3,Nis:3,Mayıs:4,May:4,
                   Haziran:5,Haz:5,Temmuz:6,Tem:6,Ağustos:7,Agustos:7,Agu:7,
                   Eylül:8,Eyl:8,Ekim:9,Eki:9,Kasım:10,Kasim:10,Kas:10,Aralık:11,Aralik:11,Ara:11};
    const trMatch = deadlineRaw.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğışöü]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (trMatch && TR_DL[trMatch[2]] != null) {
      // Saat belirtilmemişse raw.saat alanından "HH:MM" çıkarmaya çalış
      let finalHH = trMatch[4] != null ? parseInt(trMatch[4]) : null;
      let finalMM = trMatch[5] != null ? parseInt(trMatch[5]) : null;
      if (finalHH == null && raw.saat) {
        const saatM = String(raw.saat).match(/^(\d{1,2}):(\d{2})/);
        if (saatM) { finalHH = parseInt(saatM[1]); finalMM = parseInt(saatM[2]); }
      }
      const [, day, , year] = trMatch;
      deadline = new Date(parseInt(year), TR_DL[trMatch[2]], parseInt(day), finalHH ?? 23, finalMM ?? 59, 0).getTime();
    } else {
      deadline = Date.parse(deadlineRaw) || 0;
    }
  } else {
    deadline = deadlineRaw || 0;
  }
  const liveNow = window.BNS_DATA.NOW || NOW;
  const deltaH  = deadline > 0 ? (deadline - liveNow) / H : 999;
  // Önce live BR (Slack'ten gelen), yoksa mock BR, yoksa fallback
  const liveBr  = (window.BNS_DATA && window.BNS_DATA.BR) || BR;
  const brand   = liveBr[raw.marka] || {
    name: raw.marka,
    color: WHEEL[brandHash(raw.marka)],
    wheelIdx: brandHash(raw.marka)
  };
  const liveUsers = (window.BNS_DATA && window.BNS_DATA.USERS) || USERS;
  // Yeni shape: workers/leads/observers (embedded). Yoksa eski format (escape-hatch live-data.json).
  const resolveU = (x) => {
    const base = liveUsers.find(u => u.id === (x && x.id ? x.id : x)) || (x && x.name ? x : null);
    if (!base) return null;
    // Atanan-özel alanları (kisi_sira/sira) koru — kullanıcı kaydına çözerken düşmesin.
    return (x && typeof x === "object") ? { ...base, kisi_sira: x.kisi_sira ?? null, sira: x.sira ?? (base.sira ?? null), calisiyor: x.calisiyor === true } : base;
  };
  let workers, leads, observers;
  if (raw.workers || raw.leads || raw.observers) {
    workers   = (raw.workers   || []).map(resolveU).filter(Boolean);
    leads     = (raw.leads     || []).map(resolveU).filter(Boolean);
    observers = (raw.observers || []).map(resolveU).filter(Boolean);
  } else {
    // Eski/escape-hatch: leadId/contribIds veya atanan_ids[0]=lead
    const leadId = raw.leadId || (Array.isArray(raw.atanan_ids) && raw.atanan_ids[0]) || null;
    const contribIds = raw.contribIds || (Array.isArray(raw.atanan_ids) ? raw.atanan_ids.slice(1) : []);
    const editorIds = Array.isArray(raw.editor_ids) ? raw.editor_ids : [];
    leads     = leadId ? [liveUsers.find(u => u.id === leadId)].filter(Boolean) : [];
    workers   = [...new Set([...contribIds, ...editorIds].filter(id => id !== leadId))]
                  .map(id => liveUsers.find(u => u.id === id)).filter(Boolean);
    observers = [];
  }
  return {
    id:           raw.id || ("br_live_" + idx),
    no:           raw.no != null ? raw.no : (200 - idx),
    marka:        raw.marka,
    brand,
    baslik:       raw.baslik || raw.is || "",
    workers, leads, observers,
    akis: raw.akis || 'paralel',
    zincir: Array.isArray(raw.workers) ? raw.workers.map(w => w && w.id ? { id: w.id, name: w.name, sira: w.sira ?? null, onay: !!w.onay } : null).filter(Boolean) : [],
    aktif_halka: raw.aktif_halka || null,
    attachments:  Array.isArray(raw.attachments) ? raw.attachments : [],
    // geriye uyum (mevcut görüntüleme kodu): lead=ilk lead, contributors=işi yapanlar
    lead:         leads[0] || null,
    contributors: workers,
    reviewer:     null,
    acilma,
    deadline,
    dept:         raw.dept || "",
    durum:        bnsNormalizeDurum(raw.durum, raw.status),
    durum_raw:    raw.durum || raw.status || "",  // Paralel/Sıralı/🎨 bilgisi için ham durum
    prio:         prio(deltaH),   // prio objesi: {code, label, color}
    // Manuel öncelik (Slack 🔴🟠🟡🟢 / dashboard) — termin aciliyetinden BAĞIMSIZ; boşsa NORMAL
    oncelik:      ({ "🔴": { code: "red", label: "ACİL" }, "🟠": { code: "org", label: "YÜKSEK" },
                     "🟡": { code: "ylw", label: "NORMAL" }, "🟢": { code: "grn", label: "DÜŞÜK" } })[raw.oncelik] || { code: "ylw", label: "NORMAL" },
    priority:     prio(deltaH),   // backwards compat
    deltaH,
    revision:     raw.revision != null ? raw.revision : (raw.rev != null ? parseInt(raw.rev)||0 : 0),
    stale:        !!raw.stale || /stale|pasif|hareketsiz|\*\*\d+g.*pasif/i.test(raw.durum || raw.status || ""),
    updated_at:   raw.updated_at != null ? raw.updated_at : null,   // son hareket (KPI: ort. süredir bu durumda ~ atıl)
    created_at:   raw.created_at != null ? raw.created_at : (typeof acilma === "number" ? acilma : null),
    created_by:   raw.created_by || null,   // işi açan kişi (silme yetkisi: açan her zaman silebilir)
    slack_url:    raw.link ? raw.link.replace(/^\[link\]\((.+)\)$/, "$1") : (raw.slack_url || "#"),
    notes:        raw.notes || raw.saat || "",
    gecmis:       typeof raw.gecmis === "string" ? raw.gecmis : "",   // boolean/null gelebilir → string garanti
    maliyet:      raw.maliyet != null ? raw.maliyet : null,   // ₺ — Slack thread ile girilir
    satis:        raw.satis != null ? raw.satis : null,       // ₺
    fatura:       !!raw.fatura,   // fatura kesildi mi
    odeme:        !!raw.odeme,    // ödeme yapıldı mı
    thread_ozet:    raw.thread_ozet || null,     // AI thread özeti (thread-ozet.js yazar)
    thread_ozet_at: raw.thread_ozet_at || null,
    rev_ic:          raw.rev_ic || 0,            // iç revizyon (✈️ öncesi / sonrası 2.+)
    rev_musteri:     raw.rev_musteri || 0,       // müşteri revizyonu (✈️ sonrası ilk ✏️)
    gonderim_sayisi: raw.gonderim_sayisi || 0,
    son_gonderim_at: raw.son_gonderim_at || null,
    musteri_bekliyor: !!raw.musteri_bekliyor,
    uzatma_sayisi: raw.uzatma_sayisi || 0,           // deadline kaç kez uzatıldı (cezalı)
    uzatma_muaf:   raw.uzatma_muaf || 0,             // muaf (gecikme sayılmayan) uzatma
    uzatildi:      (raw.uzatma_sayisi || 0) > 0,     // aktif iş rozeti (yalnız cezalı uzatma)
    termin_oneri_at: raw.termin_oneri_at != null ? raw.termin_oneri_at : null,  // işe-dönüş hatırlatıcısı açık mı
    termin_oneri_ms: raw.termin_oneri_ms != null ? raw.termin_oneri_ms : null,  // önerilen uzatma miktarı (ms)
    deadline_orig: raw.deadline_orig != null ? raw.deadline_orig : null,   // ilk konan deadline
    deadline_history: Array.isArray(raw.deadline_history) ? raw.deadline_history : [],  // [{eski,yeni,at,by}]
    durum_olaylari: Array.isArray(raw.durum_olaylari) ? raw.durum_olaylari : [],  // [{ts,durum}] statü-giriş olayları (tarih-bazlı KPI sayımı)
    is_tipi: raw.is_tipi || null,
    _kimden_id:   raw._kimden_id || null
  };
}
function bnsHydrateCompleted(raw, idx) {
  const liveUsers = (window.BNS_DATA && window.BNS_DATA.USERS && window.BNS_DATA.USERS.length > 0) ? window.BNS_DATA.USERS : USERS;
  const liveNow = window.BNS_DATA.NOW || NOW;
  const deadline = typeof raw.deadline === "string" ? Date.parse(raw.deadline) : raw.deadline;
  const _baslangicRaw = raw.baslangic ?? raw.basla;
  const baslangic = typeof _baslangicRaw === "string" ? Date.parse(_baslangicRaw) : _baslangicRaw;
  const bitis = typeof raw.bitis === "string" ? Date.parse(raw.bitis) : raw.bitis;
  // Beklemede geçirilen süre muaftır: hem çalışma süresinden hem gecikmeden düşülür (saat durur).
  const beklemeMs = raw.bekleme_ms || 0;
  // Süre/gecikme formülleri calc.js'te (tek doğruluk kaynağı + node testi). raw.sureH/raw.sure
  // veri-kaynağı önceliği burada kalır; saf hesap bnsSureH/bnsGecikmeH'ten gelir.
  const sureH = raw.sureH != null ? raw.sureH : raw.sure != null ? raw.sure : bnsSureH(bitis, baslangic, beklemeMs);
  const gecikmeH = bnsGecikmeH(bitis, beklemeMs, deadline);
  const gecikme  = gecikmeH > 0 ? gecikmeH.toFixed(1) + "h" : "—";
  const brand = BR[raw.marka] || {
    name: raw.marka, color: WHEEL[brandHash(raw.marka)], wheelIdx: brandHash(raw.marka)
  };
  return {
    id: raw.id || ("cb_live_" + idx),
    no: raw.no != null ? raw.no : (300 - idx),
    marka: raw.marka,
    brand,
    baslik: raw.baslik,
    // Canlı API leads/workers dizileri gönderir; eski mock leadId/contribIds — ikisini de destekle
    lead: (() => {
      const lid = raw.leadId || (Array.isArray(raw.leads) && raw.leads[0] && raw.leads[0].id) || null;
      return liveUsers.find(u => u.id === lid) ||
        (lid ? { id: lid, name: (raw.leads && raw.leads[0] && raw.leads[0].name) || raw.leadName || lid.slice(-4), initials: "?", color: "#999", rol: "", dept: "" } : null);
    })(),
    // TÜM lead'ler (co-lead dahil) — bnsIsLead/bnsLeadList için. Yoksa lead'e düşer.
    leads: (Array.isArray(raw.leads) ? raw.leads.map(l => l && l.id).filter(Boolean)
            : (raw.leadId ? [raw.leadId] : []))
      .map(id => liveUsers.find(u => u.id === id) || { id, name: id, initials: "?", color: "#999", rol: "", dept: "" }),
    contributors: (raw.contribIds || (Array.isArray(raw.workers) ? raw.workers.map(w => w && w.id) : []) || [])
      .map(id => liveUsers.find(u => u.id === id)).filter(Boolean),
    deadline,
    baslangic,
    bitis,
    sureH,
    sure_cycles: Array.isArray(raw.sure_cycles) ? raw.sure_cycles : null,  // [{n,basladi,bitis,sureH}] döngü kırılımı
    durum_olaylari: Array.isArray(raw.durum_olaylari) ? raw.durum_olaylari : [],  // [{ts,durum}] statü-giriş olayları (tarih-bazlı KPI sayımı)
    is_tipi: raw.is_tipi || null,
    sureH_son: raw.sureH_son != null ? raw.sureH_son : null,
    sureH_toplam: raw.sureH_toplam != null ? raw.sureH_toplam : (raw.sureH != null ? raw.sureH : null),
    revision: raw.revision != null ? raw.revision : (raw.rev != null ? parseInt(raw.rev)||0 : 0),
    rev_ic: raw.rev_ic || 0, rev_musteri: raw.rev_musteri || 0,
    gecikme,
    gecikmeH,
    uzatma_sayisi: raw.uzatma_sayisi || 0,           // deadline kaç kez uzatıldı
    uzatildi:      (raw.uzatma_sayisi || 0) > 0,
    deadline_orig: raw.deadline_orig != null ? raw.deadline_orig : null,
    deadline_history: Array.isArray(raw.deadline_history) ? raw.deadline_history : [],
    // Teslim durumu: gecikmeli > uzatılarak teslim > zamanında (calc.js tek kaynak)
    delivery_status: bnsDeliveryStatus(bitis, deadline, beklemeMs, (raw.uzatma_sayisi || 0) > 0),
    rating: raw.rating != null ? raw.rating : null,
    rating_by: raw.rating_by || null,   // 'ai' = AI puanı, U... = yönetici override
    rating_sebep: raw.rating_sebep || null, // puanın tek cümlelik AI gerekçesi (yıldız tooltip'i)
    slack_url:  raw.slack_url || "#",
    image_url:  raw.image_url || null,  // Slack thread'indeki ilk görsel (Brief Sync tarafından doldurulur)
    notes: raw.notes || "",
    maliyet: raw.maliyet != null ? raw.maliyet : null,   // ₺ — Slack thread ile girilir
    satis:   raw.satis != null ? raw.satis : null,       // ₺
    fatura:  !!raw.fatura,   // fatura kesildi mi
    odeme:   !!raw.odeme,    // ödeme yapıldı mı
    thread_ozet:    raw.thread_ozet || null,     // AI thread özeti (salt-okunur detayda görünür)
    thread_ozet_at: raw.thread_ozet_at || null,
    insight:        raw.insight || null,         // tamamlanma sonrası AI değerlendirmesi
    insight_at:     raw.insight_at || null
  };
}

// Aktivite akışı + yıldız karnesi + KPI history — ilk yükleme VE her poll'da çağrılır.
// (Poll App.jsx'te ayrı bir merge yapar; bu alanlar oraya kopyalanmasın diye tek yardımcı.)
// Tek bir ham olayı (bns_events / /api/events shape) Geçmiş ekranının beklediği görüntü shape'ine çevirir.
// Hem ilk yükleme (bnsApplyExtras) hem sayfalı /api/events (History) AYNI dönüşümü kullanır → tutarlı.
function bnsMapEvent(e) {
  const STATUS_TR = { yeni:"Yeni", calisiliyor:"İş planında", basladi:"İşe başlandı", incelemede:"İncelemede", beklemede:"Beklemede", revizyon:"Revizyon", musteride:"Müşteri onayı", blokeli:"Blokeli", tamamlandi:"Tamamlandı" };
  const det = e.detail || {};
  const raw = e.verb || "";
  let kind, action, tag = null;
  // Her satırda NET action (ne yapıldı) + SAĞDA uygun etiket (hangi sonuç/alan).
  if (raw.indexOf("durum:") === 0) {
    const st = raw.slice(6) || det.durum || det.yeni_durum || "";
    if (st === "tamamlandi") { kind = "done"; action = "İşi tamamladı"; tag = "Tamamlandı"; }
    else { kind = "status"; action = "Durumu güncelledi"; tag = STATUS_TR[st] || st || "Durum"; }
  } else if (raw === "olusturuldu") { kind = "open"; action = "Yeni brief açtı"; tag = "Yeni"; }
  else if (raw === "düzenlendi") {
    const al = Array.isArray(det.alanlar) ? det.alanlar : [];
    kind = (al.indexOf("işi yapanlar") >= 0) ? "assign" : "edit";
    action = "Düzenledi";
    // Satır sonundaki etiket: hangi alan(lar) düzenlendi (termin / işi yapanlar …)
    tag = al.length ? al.map(a => String(a).charAt(0).toLocaleUpperCase("tr") + String(a).slice(1)).join(", ") : "Düzenleme";
  } else if (raw === "silindi") { kind = "delete"; action = "İşi sildi"; tag = "Silindi"; }
  else if (raw === "geri alındı") { kind = "delete"; action = "İşi geri aldı"; tag = "Geri alındı"; }
  else if (raw === "finans") { kind = "finance"; action = "Finans güncelledi"; tag = "Finans"; }
  else { kind = "other"; action = raw || "İşlem yaptı"; tag = null; }
  return {
    t: e.t, who: e.who || "system",
    no: e.no || null,   // tıklayınca iş detayını açmak için
    kind, action, tag,
    verb: action,        // geriye uyum
    target: e.baslik ? `#${e.no} ${e.baslik}` : (det.baslik || ""),
    brand: e.marka && window.BNS_DATA.BR ? window.BNS_DATA.BR[e.marka] : null,
    meta: "",
  };
}
window.bnsMapEvent = bnsMapEvent;

function bnsApplyExtras(ed) {
  if (!ed) return;
  window.BNS_DATA.activity = (Array.isArray(ed.bns_events) ? ed.bns_events : []).map(bnsMapEvent);
  // ⭐ Yıldız karnesi: canlı ortalamalar + AI sebep açıklamaları
  window.BNS_DATA.ratings = ed.bns_ratings || null;
  window.BNS_DATA.sebepList = Array.isArray(ed.bns_sebep) ? ed.bns_sebep : [];
  // Tarihli sebep arşivi — seçili tarih aralığına göre dönem yorumu için (bnsSebepFor).
  window.BNS_DATA.sebepHistory = Array.isArray(ed.bns_sebep_history) ? ed.bns_sebep_history : [];
  // KPI history (Overview spark grafikleri)
  if (Array.isArray(ed.bns_history) && ed.bns_history.length > 0) {
    window.BNS_DATA.history = ed.bns_history;
  }
}
window.bnsSebep = (type, key) => (window.BNS_DATA.sebepList || []).find(s => s.type === type && s.key === key) || null;
// ms (epoch) → "YYYY-MM-DD" (Europe/Istanbul). gun string'leri kronolojik=leksikografik.
function bnsMsToTRDate(ms) {
  try { return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); }
  catch (e) { return null; }
}
// Tarihe duyarlı sebep çözümleyici: seçili aralığın SONUNDA geçerli olan yorum.
// range = { from, to } (ms). Arşiv yoksa veya range yoksa en güncel snapshot'a düşer.
window.bnsSebepFor = function (type, key, range) {
  var hist = (window.BNS_DATA.sebepHistory || []).filter(function (s) { return s.type === type && s.key === key; });
  if (!hist.length) return window.bnsSebep(type, key);              // arşiv yok → eski davranış
  hist = hist.slice().sort(function (a, b) { return a.gun < b.gun ? -1 : a.gun > b.gun ? 1 : 0; });
  var toStr = range && typeof range.to === "number" ? bnsMsToTRDate(range.to) : null;
  if (!toStr) return hist[hist.length - 1];                        // range yok → en güncel arşiv
  var fromStr = range && typeof range.from === "number" ? bnsMsToTRDate(range.from) : null;
  // 1) Aralık İÇİNDE üretilmiş yorumların en günceli.
  var inRange = hist.filter(function (s) { return s.gun <= toStr && (!fromStr || s.gun >= fromStr); });
  if (inRange.length) return inRange[inRange.length - 1];
  // 2) Aralıkta üretim yoksa: aralık sonunda yürürlükte olan (to'dan önceki en güncel) yorum.
  var before = hist.filter(function (s) { return s.gun <= toStr; });
  if (before.length) return before[before.length - 1];
  // 3) Aralık tüm arşivden eskiyse: en eski mevcut yorum.
  return hist[0];
};
window.bnsApplyExtras = bnsApplyExtras;

// Lead üyeliği — TÜM lead'leri kontrol eder (co-lead dahil), yalnız b.lead (ilk lead) değil.
// Bir işte birden çok lead olabilir; b.lead = leads[0] olduğundan tekil kontrol ikinci lead'i kaçırır.
window.bnsLeadList = function (b) {
  if (!b) return [];
  if (Array.isArray(b.leads) && b.leads.length) return b.leads;
  return b.lead ? [b.lead] : [];
};
window.bnsIsLead = function (b, uid) {
  return !!uid && window.bnsLeadList(b).some(function (l) { return l && l.id === uid; });
};

// Polling için window'a expose et
window.bnsHydrateBrief = bnsHydrateBrief;
window.bnsHydrateCompleted = bnsHydrateCompleted;

try {
  const ed = window.EMBEDDED_DATA;
  if (ed && typeof ed === "object") {
    if (typeof ed.now === "string")       window.BNS_DATA.NOW = Date.parse(ed.now);
    else if (typeof ed.now === "number")  window.BNS_DATA.NOW = ed.now < 1e12 ? ed.now * 1000 : ed.now;
    if (typeof ed.sync_ts === "number")   window.BNS_DATA.NOW = ed.sync_ts < 1e12 ? ed.sync_ts * 1000 : ed.sync_ts;
    // Önce brand list'i override et (briefs hidrasyonu lookup yapacak)
    if (Array.isArray(ed.bns_brands) && ed.bns_brands.length > 0) {
      // Normalize: string[] veya {name,...}[] her ikisini de destekle
      const normalized = ed.bns_brands.map(b =>
        typeof b === "string"
          ? { name: b, color: WHEEL[brandHash(b)], wheelIdx: brandHash(b) }
          : b
      );
      window.BNS_DATA.BRANDS = normalized;
      window.BNS_DATA.BR = Object.fromEntries(normalized.map(b => [b.name, b]));
      // fatura-v2: ay×marka retainer kayıtları (sensitive — login'li embedded'da gelir)
      if (Array.isArray(ed.bns_marka_fatura)) window.BNS_DATA.MARKA_FATURA = ed.bns_marka_fatura;
      if (Array.isArray(ed.bns_is_tipleri)) window.BNS_DATA.IS_TIPLERI = ed.bns_is_tipleri;
      if (Array.isArray(ed.bns_tatiller) && typeof bnsTatilYukle === 'function') { window.BNS_DATA.TATILLER = ed.bns_tatiller; bnsTatilYukle(ed.bns_tatiller); }
    }
    // User list (Slack workspace) — bots/silinmiş hariç tüm aktif kişiler
    if (Array.isArray(ed.bns_users) && ed.bns_users.length > 0) {
      // live-data'da alan adı "dept", mock'ta "rol" — normalize + kanonik isim overlay
      window.BNS_DATA.USERS = ed.bns_users.map(bnsMergeUser);
      // ME varsa koru, yoksa Görkem'i bul, yoksa ilk yönetici
      const meId = window.BNS_DATA.ME?.id;
      const me = ed.bns_users.find(u => u.id === meId) ||
                 ed.bns_users.find(u => u.id === 'U030C48PL23') ||
                 ed.bns_users.find(u => u.rol === 'yonetici') ||
                 ed.bns_users[0];
      if (me) window.BNS_DATA.ME = me;
    }
    if (Array.isArray(ed.bns_briefs) && ed.bns_briefs.length > 0) {
      window.BNS_DATA.briefs = bnsSafeMap(ed.bns_briefs, bnsHydrateBrief, "brief");
      window.BNS_DATA.__source = "live_briefs";
    }
    // Boş liste de gerçektir: canlı payload geldiyse mock tamamlananlara DÜŞME (lansman sonrası temiz başlangıç)
    if (Array.isArray(ed.bns_completed)) {
      window.BNS_DATA.completed = bnsSafeMap(ed.bns_completed, bnsHydrateCompleted, "completed");
    }
    // Aktivite + yıldız karnesi + history — hem ilk yükleme hem POLL aynı yardımcıyı kullanır
    bnsApplyExtras(ed);
    // Silinenler (soft-delete) — düz alanlar, hidrasyon gerekmez
    if (Array.isArray(ed.bns_deleted)) {
      window.BNS_DATA.deleted = ed.bns_deleted;
    }
    // Departman istatistikleri (canlı brief'lerden bot tarafından hesaplandı)
    if (ed.bns_dept_stats && typeof ed.bns_dept_stats === "object" && Object.keys(ed.bns_dept_stats).length > 0) {
      window.BNS_DATA.deptStats = bnsNormDeptStats(ed.bns_dept_stats);
    }
    // Marka istatistikleri (problemli markalar paneli için)
    if (Array.isArray(ed.bns_brand_stats) && ed.bns_brand_stats.length > 0) {
      window.BNS_DATA.brandStats = ed.bns_brand_stats;
    }
    if (typeof ed.last_sync === "string") {
      window.BNS_DATA.lastSync = ed.last_sync;
    }
    if (!window.BNS_DATA.__source) {
      window.BNS_DATA.__source = "mock_with_embedded_present";
    }
    console.info("[BNS] Live data source:", window.BNS_DATA.__source,
                 "| briefs:", window.BNS_DATA.briefs.length,
                 "| completed:", window.BNS_DATA.completed.length,
                 "| NOW:", new Date(window.BNS_DATA.NOW).toISOString());
  } else {
    window.BNS_DATA.__source = "mock";
  }
} catch (err) {
  console.warn("[BNS] live data bridge failed, falling back to mock:", err);
  window.BNS_DATA.__source = "mock_after_error";
}

// ── PROD GÜVENLİĞİ: canlı brief GELMEDİYSE mock fixture'ları GÖSTERME ────────────────
// 3 kez yaşanan olay: poll 401/hata → ekranda demo markalar (Konya Un vb.) gerçek sanıldı.
// Çözüm: prod'da __source 'live_briefs' değilse fixture koleksiyonlarını boşalt (sahte veri
// asla render edilmez; poll başarılı olunca gerçek veri dolar, 401'de App login'e döner).
// localhost'ta mock korunur (çevrimdışı geliştirme).
try {
  var _bnsLocal = typeof location !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname || "");
  if (!_bnsLocal && window.BNS_DATA.__source !== "live_briefs") {
    window.BNS_DATA.briefs = [];
    window.BNS_DATA.completed = [];
    window.BNS_DATA.brandStats = [];
    window.BNS_DATA.activity = [];
    window.BNS_DATA.matrix = {};
    window.BNS_DATA.__source = (window.BNS_DATA.__source || "no_live") + "_sanitized";
    console.warn("[BNS] PROD: canlı brief yok → mock fixture'lar temizlendi (sahte veri gösterilmez). source=" + window.BNS_DATA.__source);
  }
} catch (e) {}

})();

// ── v2 "Panom" köprüsü ──────────────────────────────────────────────────────
// v2 kendi JWT'li poll'unu yapar; EMBEDDED_DATA'yı BNS_DATA'ya uygular.
// Hidrasyon helper'ları (window.bnsHydrateBrief vb.) prod ile AYNI — çift mantık yok.
window.bnsApplyEmbedded = function (ed) {
  if (!ed || typeof ed !== "object") return;
  window.EMBEDDED_DATA = ed;
  var D = window.BNS_DATA = window.BNS_DATA || {};
  var sm = window.bnsSafeMap || function (a, f) { return (a || []).map(f); };
  try {
    if (Array.isArray(ed.bns_brands)) D.BRANDS = ed.bns_brands;
    if (Array.isArray(ed.bns_marka_fatura)) D.MARKA_FATURA = ed.bns_marka_fatura;
    if (Array.isArray(ed.bns_is_tipleri)) D.IS_TIPLERI = ed.bns_is_tipleri;
    if (Array.isArray(ed.bns_tatiller) && typeof bnsTatilYukle === 'function') { D.TATILLER = ed.bns_tatiller; bnsTatilYukle(ed.bns_tatiller); }
    if (Array.isArray(ed.bns_users)) D.USERS = window.bnsMergeUser ? ed.bns_users.map(window.bnsMergeUser) : ed.bns_users;
    if (Array.isArray(ed.bns_briefs)) D.briefs = window.bnsHydrateBrief ? sm(ed.bns_briefs, window.bnsHydrateBrief, "brief") : ed.bns_briefs;
    if (Array.isArray(ed.bns_completed)) D.completed = window.bnsHydrateCompleted ? sm(ed.bns_completed, window.bnsHydrateCompleted, "completed") : ed.bns_completed;
    if (ed.bns_dept_stats) D.deptStats = window.bnsNormDeptStats ? window.bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
    if (typeof window.bnsApplyExtras === "function") window.bnsApplyExtras(ed);
    D.__source = "live_briefs";
  } catch (e) { console.warn("[v2] applyEmbedded hata:", e.message); }
};
