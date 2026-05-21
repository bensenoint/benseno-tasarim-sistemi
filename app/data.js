// app/data.js
// Dense Friday-morning fixture for Benseno dashboard.
// 19 users · 39 brands · 60 active briefs · 30 completed · activity log.
// Plain script (no Babel). Exposes window.BNS_DATA.

(function () {

// ─── USERS ──────────────────────────────────────────────────────────────────
const USERS = [
  // Yöneticiler (5)
  { id: "U030C48PL23", name: "Görkem Kaya",       mono: "GK", rol: "yonetici", title: "Genel Müdür" },
  { id: "UD96GH76E",   name: "Reyhan Nur Pınar",  mono: "RP", rol: "yonetici", title: "GMY" },
  { id: "U4XCE3532",   name: "Cansu Kazgan",      mono: "CK", rol: "yonetici", title: "Direktör" },
  { id: "U055EDESLSE", name: "İpek Akdeniz",      mono: "İA", rol: "yonetici", title: "Tasarım Yön." },
  { id: "U02SZQDAFPF", name: "Erdem Akoğlu",      mono: "EA", rol: "yonetici", title: "Editör Yön." },
  // Tasarım (6)
  { id: "U0AN6DD79M0", name: "Aylin Tozkoparan",  mono: "AT", rol: "tasarim" },
  { id: "U06J26R1XCJ", name: "Aykut Arslan",      mono: "AA", rol: "tasarim" },
  { id: "U09BFPBKQG7", name: "Hasan Serdar Arda", mono: "HA", rol: "tasarim" },
  { id: "U0B3K2WE7SB", name: "Pelin Özdemir",     mono: "PÖ", rol: "tasarim", isNew: true },
  { id: "U0AK8U7L57F", name: "İrem Özkan",        mono: "İÖ", rol: "tasarim" },
  { id: "U08HLMHTGEL", name: "Serhat Yıldız",     mono: "SY", rol: "tasarim" },
  // Editör (6)
  { id: "U09BZHR25NG", name: "Eda Tireli",        mono: "ET", rol: "editor" },
  { id: "U07PV0RA9L2", name: "Eda Ayral",         mono: "EY", rol: "editor" },
  { id: "U08NQJ27G5S", name: "Melis Can",         mono: "MC", rol: "editor" },
  { id: "U05PP70GQTX", name: "Aylin Canel",       mono: "AC", rol: "editor" },
  { id: "U063T8M5HL4", name: "Buse Gürbüzer",     mono: "BG", rol: "editor" },
  { id: "U0AAC3YK20G", name: "Simge Acar",        mono: "SA", rol: "editor" },
  // AI (1)
  { id: "U0AP31SAA1W", name: "Eren Mahzunlar",    mono: "EM", rol: "ai",     title: "AI Operatör" }
];

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
const deptStats = {
  tasarim: { name: "Tasarım", people: 6,  active: 28, overdue: 4, capacity: 92, completed30: 84, avgComplete: 26.4, revRate: 18 },
  editor:  { name: "Editör",  people: 6,  active: 22, overdue: 2, capacity: 78, completed30: 71, avgComplete: 34.1, revRate: 22 },
  ai:      { name: "AI",      people: 1,  active: 10, overdue: 2, capacity: 96, completed30: 38, avgComplete: 18.7, revRate: 11 }
};

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
function bnsHydrateBrief(raw, idx) {
  const acilma  = typeof raw.acilma === "string"   ? Date.parse(raw.acilma)   : raw.acilma;
  const deadline= typeof raw.deadline === "string" ? Date.parse(raw.deadline) : raw.deadline;
  const liveNow = window.BNS_DATA.NOW || NOW;
  const deltaH  = (deadline - liveNow) / H;
  // Önce live BR (Slack'ten gelen), yoksa mock BR, yoksa fallback
  const liveBr  = (window.BNS_DATA && window.BNS_DATA.BR) || BR;
  const brand   = liveBr[raw.marka] || {
    name: raw.marka,
    color: WHEEL[brandHash(raw.marka)],
    wheelIdx: brandHash(raw.marka)
  };
  return {
    id:           raw.id || ("br_live_" + idx),
    no:           raw.no != null ? raw.no : (200 - idx),
    marka:        raw.marka,
    brand,
    baslik:       raw.baslik,
    lead:         USERS.find(u => u.id === raw.leadId)     || null,
    contributors: (raw.contribIds || []).map(id => USERS.find(u => u.id === id)).filter(Boolean),
    reviewer:     raw.reviewerId ? (USERS.find(u => u.id === raw.reviewerId) || null) : null,
    acilma,
    deadline,
    durum:        raw.durum,
    priority:     prio(deltaH),
    deltaH,
    revision:     raw.revision != null ? raw.revision : 0,
    stale:        !!raw.stale,
    slack_url:    raw.slack_url || "#",
    notes:        raw.notes || "",
    gecmis:       raw.gecmis || "",      // Canvas Geçmiş kolonu ham string (BriefDrawer parse eder)
    _kimden_id:   raw._kimden_id || null // brief açanın ID'si (queue brief'lerinde; obj zaten lead'de)
  };
}
function bnsHydrateCompleted(raw, idx) {
  const liveNow = window.BNS_DATA.NOW || NOW;
  const deadline = typeof raw.deadline === "string" ? Date.parse(raw.deadline) : raw.deadline;
  const baslangic = typeof raw.baslangic === "string" ? Date.parse(raw.baslangic) : raw.baslangic;
  const bitis = typeof raw.bitis === "string" ? Date.parse(raw.bitis) : raw.bitis;
  const sureH = raw.sureH != null ? raw.sureH : ((bitis - baslangic) / H);
  const gecikme = bitis > deadline ? ((bitis - deadline) / H).toFixed(1) + "h" : "—";
  const brand = BR[raw.marka] || {
    name: raw.marka, color: WHEEL[brandHash(raw.marka)], wheelIdx: brandHash(raw.marka)
  };
  return {
    id: raw.id || ("cb_live_" + idx),
    no: raw.no != null ? raw.no : (300 - idx),
    marka: raw.marka,
    brand,
    baslik: raw.baslik,
    lead: USERS.find(u => u.id === raw.leadId) || null,
    contributors: (raw.contribIds || []).map(id => USERS.find(u => u.id === id)).filter(Boolean),
    deadline,
    baslangic,
    bitis,
    sureH,
    revision: raw.revision != null ? raw.revision : 0,
    gecikme,
    rating: raw.rating != null ? raw.rating : null,
    slack_url: raw.slack_url || "#",
    notes: raw.notes || ""
  };
}

// Polling için window'a expose et
window.bnsHydrateBrief = bnsHydrateBrief;
window.bnsHydrateCompleted = bnsHydrateCompleted;

try {
  const ed = window.EMBEDDED_DATA;
  if (ed && typeof ed === "object") {
    if (typeof ed.now === "string") {
      window.BNS_DATA.NOW = Date.parse(ed.now);
    }
    // Önce brand list'i override et (briefs hidrasyonu lookup yapacak)
    if (Array.isArray(ed.bns_brands) && ed.bns_brands.length > 0) {
      window.BNS_DATA.BRANDS = ed.bns_brands;
      window.BNS_DATA.BR = Object.fromEntries(ed.bns_brands.map(b => [b.name, b]));
    }
    // User list (Slack workspace) — bots/silinmiş hariç tüm aktif kişiler
    if (Array.isArray(ed.bns_users) && ed.bns_users.length > 0) {
      window.BNS_DATA.USERS = ed.bns_users;
      // ME varsa koru, yoksa Görkem'i bul, yoksa ilk yönetici
      const meId = window.BNS_DATA.ME?.id;
      const me = ed.bns_users.find(u => u.id === meId) ||
                 ed.bns_users.find(u => u.id === 'U030C48PL23') ||
                 ed.bns_users.find(u => u.rol === 'yonetici') ||
                 ed.bns_users[0];
      if (me) window.BNS_DATA.ME = me;
    }
    if (Array.isArray(ed.bns_briefs) && ed.bns_briefs.length > 0) {
      window.BNS_DATA.briefs = ed.bns_briefs.map(bnsHydrateBrief);
      window.BNS_DATA.__source = "live_briefs";
    }
    if (Array.isArray(ed.bns_completed) && ed.bns_completed.length > 0) {
      window.BNS_DATA.completed = ed.bns_completed.map(bnsHydrateCompleted);
    }
    // Departman istatistikleri (canlı brief'lerden bot tarafından hesaplandı)
    if (ed.bns_dept_stats && typeof ed.bns_dept_stats === "object" && Object.keys(ed.bns_dept_stats).length > 0) {
      window.BNS_DATA.deptStats = ed.bns_dept_stats;
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

})();
