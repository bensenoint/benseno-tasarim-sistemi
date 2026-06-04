'use strict';

/**
 * Slack çıkışı (Faz 3 b1.2) — dashboard'dan oluşturulan brief'i markanın kanalına post eder.
 * - Token: process.env.SLACK_BOT_TOKEN (Railway cross-service ref ile gelir).
 * - Test override: BNS_FORCE_CHANNEL set ise TÜM mesajlar oraya gider (ör. #benseno-grafik).
 * - Marka→kanal haritası dashboard'daki MARKA_KANAL ile aynı.
 * Best-effort: Slack hatası brief oluşturmayı BOZMAZ (writes.js try/catch ile çağırır).
 */

const CHANNELS = {
  "Bauhaus": "marka-bauhaus", "Beta": "marka-beta", "Cimporglobal": "marka-cimporglobal",
  "Cureffect": "marka-cureffect", "Egosport": "marka-egosport", "Gürsoy": "marka-gursoy",
  "Hasvet": "marka-hasvet", "Hendex": "marka-hendex", "JNJ": "marka-jnj",
  "JNJ Acuvue ME": "marka-jnj-acuvue-me", "JNJ Vision TR": "marka-jnj-vision-tr",
  "Jungleous": "marka-jungleous", "KMR Amos": "marka-kmr-amos", "KMR Copic": "marka-kmr-copic",
  "KMR Lamy": "marka-kmr-lamy", "KMR Marshmallow": "marka-kmr-marshmallow", "KMR Max": "marka-kmr-max",
  "KMR Panfix": "marka-kmr-panfix", "KMR Serve": "marka-kmr-serve", "Kuzeypet": "marka-kuzeypet",
  "KZY Bark": "marka-kzy-bark", "KZY Everclean": "marka-kzy-everclean", "KZY Ferplast": "marka-kzy-ferplast",
  "KZY Flamingo": "marka-kzy-flamingo", "KZY Simple Solution": "marka-kzy-simplesolution",
  "KZY Supreme": "marka-kzy-supreme", "KZY Vet's Best": "marka-kzy-vetsbest",
  "Marmara Holding": "marka-marmaraholding", "Muffik": "marka-muffik", "Polisan": "marka-polisan",
  "Splenda": "marka-splenda", "Tour2America": "marka-tour2america", "VDM Petdent": "marka-vdm-petdent",
};

function channelForBrand(marka) {
  if (process.env.BNS_FORCE_CHANNEL) return process.env.BNS_FORCE_CHANNEL;   // test override
  const c = CHANNELS[marka];
  return c ? "#" + c : null;
}

function hasToken() { return !!process.env.SLACK_BOT_TOKEN; }

async function slackCall(method, payload) {
  const r = await fetch("https://slack.com/api/" + method, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", authorization: "Bearer " + process.env.SLACK_BOT_TOKEN },
    body: JSON.stringify(payload),
  });
  return r.json();
}

const fmtDate = (ms) => {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

// Brief mesajını kanala post et → {ok, ts, channel, permalink?, error}
async function postBrief({ marka, baslik, no, deadlineMs, dept, akis, leadName, contribNames }) {
  const channel = channelForBrand(marka);
  if (!channel) return { ok: false, error: "kanal_yok", skipped: true };
  if (!hasToken()) return { ok: false, error: "token_yok", skipped: true };

  const lines = [
    `*🆕 Yeni brief · #${no}* — ${marka}`,
    `*${baslik}*`,
    `⏰ ${fmtDate(deadlineMs)}${dept ? `   ·   📁 ${dept}` : ""}${akis ? `   ·   ${akis === "paralel" ? "⇉ paralel" : "→ sıralı"}` : ""}`,
    leadName ? `👤 ${leadName}${contribNames && contribNames.length ? `  ·  ${contribNames.join(", ")}` : ""}` : null,
    `_Dashboard'dan oluşturuldu · iş bu thread'de devam eder._`,
  ].filter(Boolean);

  const res = await slackCall("chat.postMessage", { channel, text: lines.join("\n"), unfurl_links: false });
  if (!res.ok) return { ok: false, error: res.error, channel };
  // Permalink'i ts+channel'dan inşa et (ekstra scope/çağrı gerektirmez).
  const ws = process.env.BNS_SLACK_WORKSPACE || "benseno";
  const permalink = `https://${ws}.slack.com/archives/${res.channel}/p${String(res.ts).replace(".", "")}`;
  return { ok: true, ts: res.ts, channel: res.channel, permalink };
}

// Brief'in Slack thread'ine yanıt (b2 — değişiklikler işin thread'inde devam eder).
async function postThread({ channel, thread_ts, text }) {
  if (!hasToken() || !channel || !thread_ts) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel, thread_ts, text, unfurl_links: false });
  return res.ok ? { ok: true, ts: res.ts } : { ok: false, error: res.error };
}

// Tek kullanıcıya DM (channel=userID → bot DM açar; im:write gerekir).
async function dm(userId, text) {
  if (!hasToken() || !userId) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel: userId, text, unfurl_links: false });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

module.exports = { postBrief, postThread, dm, channelForBrand, hasToken, CHANNELS };
