// dashboard/app/live-data.js — Work Tracking Slack Bot tarafından yazıldı.
// Bot her 30 saniyede + her reaction/yeni brief event'inde bu dosyayı yeniden üretir.
// Kaynak: Slack Canvas F0B1B6XUD44 (parse + brief queue birleşim)
// data.js içindeki LIVE DATA BRIDGE bu objeyi okur, BNS_DATA'yı override eder.

window.EMBEDDED_DATA = {
  "now": "2026-05-20T06:05:25.408Z",
  "last_sync": "2026-05-20T06:05:25.408Z",
  "source": "work-tracking-bot",
  "reason": "interval",
  "bns_briefs": [
    {
      "id": "br_live_1779099416366989",
      "no": 1,
      "marka": "JNJ Vision TR",
      "baslik": "24 Haziran Kontakt Lens Davetiyesi",
      "leadId": "U0AN6DD79M0",
      "contribIds": [
        "U4XCE3532",
        "U02SZQDAFPF",
        "U055EDESLSE",
        "U030C48PL23",
        "U0AAC3YK20G",
        "U09BZHR25NG"
      ],
      "reviewerId": "U08NQJ27G5S",
      "acilma": "2026-05-18T10:16:56.366+00:00",
      "deadline": "2026-05-18T16:00:00+03:00",
      "durum": "incelemede",
      "revision": 1,
      "stale": false,
      "slack_url": "https://benseno.slack.com/archives/C4Y58FEUU/p1779099416366989",
      "notes": "👀 Revize bekliyor (v2 teslim 18May17:22 · Melis 17:26 \"İletiyorum\" → bakanlık onayı bekleniyor · son aktivite 1g 14sa 53dk önce) · <@U08NQJ27G5S>",
      "_oncelik": "\ud83d"
    },
    {
      "id": "br_live_1779104369515529",
      "no": 2,
      "marka": "Hasvet",
      "baslik": "MENTEŞE VETERİNER KLİNİĞİ CAM GİYDİRME",
      "leadId": "U4XCE3532",
      "contribIds": [
        "U055EDESLSE",
        "U02SZQDAFPF",
        "U030C48PL23",
        "U063T8M5HL4",
        "U0AAC3YK20G"
      ],
      "reviewerId": "U08NQJ27G5S",
      "acilma": "2026-05-18T11:39:29.515+00:00",
      "deadline": "2026-05-21T16:00:00+03:00",
      "durum": "yeni",
      "revision": 0,
      "stale": false,
      "slack_url": "https://benseno.slack.com/archives/C081GAK936J/p1779104369515529",
      "notes": "⏳ Sırada (tasarımcı atanmadı — İpek dispatch bekleniyor · sabah aksiyon DM'sinde öncelikli) · <@U08NQJ27G5S>",
      "_oncelik": "\ud83d"
    },
    {
      "id": "br_live_1779167651759819",
      "no": 3,
      "marka": "Bauhaus",
      "baslik": "bahar kampanyası (%10 indirim · Sosyal Medya Post)",
      "leadId": "U06J26R1XCJ",
      "contribIds": [
        "U09BZHR25NG"
      ],
      "reviewerId": "U030C48PL23",
      "acilma": "2026-05-19T05:14:11.759+00:00",
      "deadline": "2026-05-20T10:00:00+03:00",
      "durum": "yeni",
      "revision": 0,
      "stale": true,
      "slack_url": "https://benseno.slack.com/archives/C4Y43AW2E/p1779167651759819",
      "notes": "⏳ Sırada (Aykut başlamayı bekliyor · 🎨 reaction yok · 🔴 manuel override Görkem 19May08:26 + STALE 🔴 · 24sa 5dk pasif · sabah eskalasyon DM 5 yönetici) · <@U030C48PL23>",
      "_oncelik": "\ud83d"
    },
    {
      "id": "br_live_1779167921567269",
      "no": 4,
      "marka": "Bauhaus",
      "baslik": "🚨 mayıs kampanyası (%20 indirim · Sosyal Medya Post)",
      "leadId": "U055EDESLSE",
      "contribIds": [
        "U030C48PL23"
      ],
      "reviewerId": "U030C48PL23",
      "acilma": "2026-05-19T05:18:41.567+00:00",
      "deadline": "2026-05-21T13:00:00+03:00",
      "durum": "yeni",
      "revision": 0,
      "stale": true,
      "slack_url": "https://benseno.slack.com/archives/C4Y43AW2E/p1779167921567269",
      "notes": "⏳ Sırada (🚨 Kim alanı disiplin ihlali · Görkem+İpek'e DM gönderildi, cevap yok · 24sa 1dk pasif · İpek dispatch bekleniyor) · <@U030C48PL23>",
      "_oncelik": "\ud83d"
    },
    {
      "id": "br_live_1779187350819039",
      "no": 5,
      "marka": "Bauhaus",
      "baslik": "Broşür (Print · AI · Eren self-assign)",
      "leadId": "U0AP31SAA1W",
      "contribIds": [],
      "reviewerId": "U0AP31SAA1W",
      "acilma": "2026-05-19T10:42:30.819+00:00",
      "deadline": "2026-05-21T13:42:00+03:00",
      "durum": "yeni",
      "revision": 0,
      "stale": false,
      "slack_url": "https://benseno.slack.com/archives/C4Y43AW2E/p1779187350819039",
      "notes": "⏳ Yeni açıldı (Eren self-assign · sabah günaydın DM'sinde başlama hatırlatması) · <@U0AP31SAA1W>",
      "_oncelik": "\ud83d"
    }
  ],
  "bns_completed": [
    {
      "id": "cb_live_1779104723477199",
      "no": 1,
      "marka": "Bauhaus",
      "baslik": "Gökhan Ünver - İngilizce Altyazı /2",
      "leadId": "U09BFPBKQG7",
      "contribIds": [
        "U06J26R1XCJ"
      ],
      "reviewerId": null,
      "acilma": null,
      "baslangic": null,
      "bitis": null,
      "deadline": "2026-05-19T12:00:00+03:00",
      "sureH": 2.75,
      "revision": 0,
      "rating": null,
      "slack_url": "https://benseno.slack.com/archives/C4Y43AW2E/p1779104723477199",
      "notes": "Erken teslim (deadline'dan 18+ saat önce)"
    }
  ],
  "bns_brands": [
    {
      "name": "Bauhaus",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C4Y43AW2E",
      "channel_name": "marka-bauhaus"
    },
    {
      "name": "Beta",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C03QUBW5659",
      "channel_name": "marka-beta"
    },
    {
      "name": "Cimporglobal",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C08N311GBHP",
      "channel_name": "marka-cimporglobal"
    },
    {
      "name": "Cureffect",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C05DF8RFQ77",
      "channel_name": "marka-cureffect"
    },
    {
      "name": "Dermaqual",
      "color": "#8E5BA1",
      "wheelIdx": 12,
      "channel_id": "C08QEE4GPFW",
      "channel_name": "marka-dermaqual"
    },
    {
      "name": "Efor Eforçay",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C07MY8EFG0Z",
      "channel_name": "marka-efor-eforçay"
    },
    {
      "name": "Egosport",
      "color": "#9C755F",
      "wheelIdx": 7,
      "channel_id": "C0ANY1ZMH2A",
      "channel_name": "marka-egosport"
    },
    {
      "name": "Gursoy",
      "color": "#2C7FB8",
      "wheelIdx": 9,
      "channel_id": "CCVCC4KQU",
      "channel_name": "marka-gursoy"
    },
    {
      "name": "Hasvet",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C081GAK936J",
      "channel_name": "marka-hasvet"
    },
    {
      "name": "JNJ",
      "color": "#EDC948",
      "wheelIdx": 6,
      "channel_id": "C01ERQV89R9",
      "channel_name": "marka-jnj"
    },
    {
      "name": "JNJ Acuvue Me",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "CCUS6KJG0",
      "channel_name": "marka-jnj-acuvue-me"
    },
    {
      "name": "JNJ Vision TR",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C4Y58FEUU",
      "channel_name": "marka-jnj-vision-tr"
    },
    {
      "name": "Jungleous",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C0ANHBGKJQJ",
      "channel_name": "marka-jungleous"
    },
    {
      "name": "KMR Amos",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C01ERJUEECA",
      "channel_name": "marka-kmr-amos"
    },
    {
      "name": "KMR Copic",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C0AJW8X06KB",
      "channel_name": "marka-kmr-copic"
    },
    {
      "name": "KMR Lamy",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "CCVJ74S1G",
      "channel_name": "marka-kmr-lamy"
    },
    {
      "name": "KMR Lamy Faq",
      "color": "#9C755F",
      "wheelIdx": 7,
      "channel_id": "C083EB519E2",
      "channel_name": "marka-kmr-lamy-faq"
    },
    {
      "name": "KMR Marshmallow",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C099PUJB4QZ",
      "channel_name": "marka-kmr-marshmallow"
    },
    {
      "name": "KMR Max",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C088BEZEH8F",
      "channel_name": "marka-kmr-max"
    },
    {
      "name": "KMR Panfix",
      "color": "#BAB0AC",
      "wheelIdx": 8,
      "channel_id": "C0A5CQ7RSJJ",
      "channel_name": "marka-kmr-panfix"
    },
    {
      "name": "KMR Scase",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C05MC1ECLKB",
      "channel_name": "marka-kmr-scase"
    },
    {
      "name": "KMR Serve",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C03M070G8HY",
      "channel_name": "marka-kmr-serve"
    },
    {
      "name": "Krups",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C04RSD57ZMK",
      "channel_name": "marka-krups"
    },
    {
      "name": "Kuzeypet",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C03MCS7R0KB",
      "channel_name": "marka-kuzeypet"
    },
    {
      "name": "KZY Bark",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C0A5TTK1W64",
      "channel_name": "marka-kzy-bark"
    },
    {
      "name": "KZY Everclean",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C01EJSS20K0",
      "channel_name": "marka-kzy-everclean"
    },
    {
      "name": "KZY Ferplast",
      "color": "#2C7FB8",
      "wheelIdx": 9,
      "channel_id": "C01FFE7DYL8",
      "channel_name": "marka-kzy-ferplast"
    },
    {
      "name": "KZY Flamingo",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C0A5CEXDGC9",
      "channel_name": "marka-kzy-flamingo"
    },
    {
      "name": "KZY Simplesolution",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C01F47Z7LSD",
      "channel_name": "marka-kzy-simplesolution"
    },
    {
      "name": "KZY Supreme",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C05KKSV6EF7",
      "channel_name": "marka-kzy-supreme"
    },
    {
      "name": "KZY Vetsbest",
      "color": "#BAB0AC",
      "wheelIdx": 8,
      "channel_id": "C042SGZ4N3W",
      "channel_name": "marka-kzy-vetsbest"
    },
    {
      "name": "Marmaraholding",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C09EWGL9249",
      "channel_name": "marka-marmaraholding"
    },
    {
      "name": "Muffik",
      "color": "#EDC948",
      "wheelIdx": 6,
      "channel_id": "C092B2GCDAT",
      "channel_name": "marka-muffik"
    },
    {
      "name": "Polisan",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C047C3MCW9G",
      "channel_name": "marka-polisan"
    },
    {
      "name": "Splenda",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C02SZRFPARK",
      "channel_name": "marka-splenda"
    },
    {
      "name": "Tour2america",
      "color": "#8E5BA1",
      "wheelIdx": 12,
      "channel_id": "C05J5PXBPGS",
      "channel_name": "marka-tour2america"
    },
    {
      "name": "Vdm Petdent",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C0AQLPY4TUM",
      "channel_name": "marka-vdm-petdent"
    }
  ],
  "bns_dept_stats": {
    "tasarim": {
      "name": "Tasarım",
      "people": 7,
      "active": 4,
      "overdue": 1,
      "capacity": 29,
      "completed30": 0,
      "avgComplete": null,
      "revRate": null
    },
    "editor": {
      "name": "Editör",
      "people": 8,
      "active": 0,
      "overdue": 0,
      "capacity": 0,
      "completed30": 0,
      "avgComplete": null,
      "revRate": null
    },
    "ai": {
      "name": "AI",
      "people": 1,
      "active": 1,
      "overdue": 0,
      "capacity": 50,
      "completed30": 0,
      "avgComplete": null,
      "revRate": null
    }
  },
  "bns_brand_stats": [
    {
      "name": "Bauhaus",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C4Y43AW2E",
      "channel_name": "marka-bauhaus",
      "active": 3,
      "done30": 0,
      "overdue": 0,
      "stale": true,
      "problem_label": "STALE 🔴"
    },
    {
      "name": "Beta",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C03QUBW5659",
      "channel_name": "marka-beta",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Cimporglobal",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C08N311GBHP",
      "channel_name": "marka-cimporglobal",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Cureffect",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C05DF8RFQ77",
      "channel_name": "marka-cureffect",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Dermaqual",
      "color": "#8E5BA1",
      "wheelIdx": 12,
      "channel_id": "C08QEE4GPFW",
      "channel_name": "marka-dermaqual",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Efor Eforçay",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C07MY8EFG0Z",
      "channel_name": "marka-efor-eforçay",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Egosport",
      "color": "#9C755F",
      "wheelIdx": 7,
      "channel_id": "C0ANY1ZMH2A",
      "channel_name": "marka-egosport",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Gursoy",
      "color": "#2C7FB8",
      "wheelIdx": 9,
      "channel_id": "CCVCC4KQU",
      "channel_name": "marka-gursoy",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Hasvet",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C081GAK936J",
      "channel_name": "marka-hasvet",
      "active": 1,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "JNJ",
      "color": "#EDC948",
      "wheelIdx": 6,
      "channel_id": "C01ERQV89R9",
      "channel_name": "marka-jnj",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "JNJ Acuvue Me",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "CCUS6KJG0",
      "channel_name": "marka-jnj-acuvue-me",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "JNJ Vision TR",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C4Y58FEUU",
      "channel_name": "marka-jnj-vision-tr",
      "active": 1,
      "done30": 0,
      "overdue": 1,
      "stale": false,
      "problem_label": "1 geciken"
    },
    {
      "name": "Jungleous",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C0ANHBGKJQJ",
      "channel_name": "marka-jungleous",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Amos",
      "color": "#4E79A7",
      "wheelIdx": 0,
      "channel_id": "C01ERJUEECA",
      "channel_name": "marka-kmr-amos",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Copic",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C0AJW8X06KB",
      "channel_name": "marka-kmr-copic",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Lamy",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "CCVJ74S1G",
      "channel_name": "marka-kmr-lamy",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Lamy Faq",
      "color": "#9C755F",
      "wheelIdx": 7,
      "channel_id": "C083EB519E2",
      "channel_name": "marka-kmr-lamy-faq",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Marshmallow",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C099PUJB4QZ",
      "channel_name": "marka-kmr-marshmallow",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Max",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C088BEZEH8F",
      "channel_name": "marka-kmr-max",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Panfix",
      "color": "#BAB0AC",
      "wheelIdx": 8,
      "channel_id": "C0A5CQ7RSJJ",
      "channel_name": "marka-kmr-panfix",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Scase",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C05MC1ECLKB",
      "channel_name": "marka-kmr-scase",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KMR Serve",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C03M070G8HY",
      "channel_name": "marka-kmr-serve",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Krups",
      "color": "#F28E2B",
      "wheelIdx": 1,
      "channel_id": "C04RSD57ZMK",
      "channel_name": "marka-krups",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Kuzeypet",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C03MCS7R0KB",
      "channel_name": "marka-kuzeypet",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Bark",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C0A5TTK1W64",
      "channel_name": "marka-kzy-bark",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Everclean",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C01EJSS20K0",
      "channel_name": "marka-kzy-everclean",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Ferplast",
      "color": "#2C7FB8",
      "wheelIdx": 9,
      "channel_id": "C01FFE7DYL8",
      "channel_name": "marka-kzy-ferplast",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Flamingo",
      "color": "#E15759",
      "wheelIdx": 5,
      "channel_id": "C0A5CEXDGC9",
      "channel_name": "marka-kzy-flamingo",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Simplesolution",
      "color": "#B79100",
      "wheelIdx": 15,
      "channel_id": "C01F47Z7LSD",
      "channel_name": "marka-kzy-simplesolution",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Supreme",
      "color": "#00786F",
      "wheelIdx": 13,
      "channel_id": "C05KKSV6EF7",
      "channel_name": "marka-kzy-supreme",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "KZY Vetsbest",
      "color": "#BAB0AC",
      "wheelIdx": 8,
      "channel_id": "C042SGZ4N3W",
      "channel_name": "marka-kzy-vetsbest",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Marmaraholding",
      "color": "#59A14F",
      "wheelIdx": 2,
      "channel_id": "C09EWGL9249",
      "channel_name": "marka-marmaraholding",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Muffik",
      "color": "#EDC948",
      "wheelIdx": 6,
      "channel_id": "C092B2GCDAT",
      "channel_name": "marka-muffik",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Polisan",
      "color": "#76B7B2",
      "wheelIdx": 4,
      "channel_id": "C047C3MCW9G",
      "channel_name": "marka-polisan",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Splenda",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C02SZRFPARK",
      "channel_name": "marka-splenda",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Tour2america",
      "color": "#8E5BA1",
      "wheelIdx": 12,
      "channel_id": "C05J5PXBPGS",
      "channel_name": "marka-tour2america",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    },
    {
      "name": "Vdm Petdent",
      "color": "#6A8E3D",
      "wheelIdx": 11,
      "channel_id": "C0AQLPY4TUM",
      "channel_name": "marka-vdm-petdent",
      "active": 0,
      "done30": 0,
      "overdue": 0,
      "stale": false,
      "problem_label": null
    }
  ]
};
