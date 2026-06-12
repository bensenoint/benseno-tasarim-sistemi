'use strict';

/**
 * Slack çıkışı (Faz 3 b1.2) — dashboard'dan oluşturulan brief'i markanın kanalına post eder.
 * - Token: process.env.SLACK_BOT_TOKEN (Railway cross-service ref ile gelir).
 * - Test override: BNS_FORCE_CHANNEL set ise TÜM mesajlar oraya gider (ör. #benseno-grafik).
 * - Marka→kanal haritası dashboard'daki MARKA_KANAL ile aynı.
 * Best-effort: Slack hatası brief oluşturmayı BOZMAZ (writes.js try/catch ile çağırır).
 */

const CHANNELS = {
  // "Benseno" markalardan bağımsız genel kanaldır: henüz anlaşılmamış müşteri
  // adayları ve örnek çalışmalar buradan brief açılarak yürütülür.
  "Benseno": "benseno",
  "Bauhaus": "marka-bauhaus", "Beta": "marka-beta", "Cimporglobal": "marka-cimporglobal",
  "Cureffect": "marka-cureffect", "Egosport": "marka-egosport", "Gürsoy": "marka-gursoy",
  "Hasvet": "marka-hasvet", "JnJ": "marka-jnj",
  // "Hendex" kanalı bilinçli olarak haritada yok (bot davet edilmedi, kullanıcı talebi) —
  // marka dashboard'da durur, Slack çıkışı/özeti yapılmaz.
  "JnJ ACU ME": "marka-jnj-acuvue-me", "JnJ Vision TR": "marka-jnj-vision-tr",
  "Jungleous": "marka-jungleous",
  "KMR Amos": "marka-kmr-amos", "KMR Copic": "marka-kmr-copic", "KMR LAMY": "marka-kmr-lamy",
  "KMR Marshmallow": "marka-kmr-marshmallow", "KMR Max": "marka-kmr-max",
  "KMR Panfix": "marka-kmr-panfix", "KMR Serve": "marka-kmr-serve", "Kuzey Pet": "marka-kuzeypet",
  "KZY Bark": "marka-kzy-bark",
  "KZY Ever Clean": "marka-kzy-everclean", "KZY Ferplast": "marka-kzy-ferplast",
  "KZY Flamingo": "marka-kzy-flamingo", "KZY Simple Solution": "marka-kzy-simplesolution",
  "KZY Supreme": "marka-kzy-supreme", "KZY VetsBest": "marka-kzy-vetsbest",
  "Marmara Holding": "marka-marmaraholding", "Muffik": "marka-muffik", "Polisan": "marka-polisan",
  "Şefika Store": "marka-sefikastore",
  "Splenda": "marka-splenda", "TTA": "marka-tour2america", "VDM Petdent": "marka-vdm-petdent",
};

function channelForBrand(marka) {
  if (process.env.BNS_FORCE_CHANNEL) return process.env.BNS_FORCE_CHANNEL;   // test override
  const c = CHANNELS[marka];
  return c ? "#" + c : null;
}

function hasToken() { return !!process.env.SLACK_BOT_TOKEN; }

// Mesajlarda görünen bot adı. Slack profil önbelleği güncellenmesi gecikebildiği için
// chat:write.customize ile her mesajda override ediyoruz (anında doğru ad görünür).
const BOT_NAME = process.env.BNS_BOT_NAME || "WT";

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
async function postBrief({ marka, baslik, no, deadlineMs, dept, akis, leadName, contribNames, observerNames, not, acan }) {
  const channel = channelForBrand(marka);
  if (!channel) return { ok: false, error: "kanal_yok", skipped: true };
  if (!hasToken()) return { ok: false, error: "token_yok", skipped: true };

  // Ana kanal mesajı: SADECE iş açıklaması (başlık). Briefin kalanı ilk thread yanıtı olur.
  const res = await slackCall("chat.postMessage", { channel, text: `*${baslik}*`, username: BOT_NAME, unfurl_links: false });
  if (!res.ok) return { ok: false, error: res.error, channel };

  // Detaylar (deadline, kişiler, not, dipnot) → ilk thread yanıtı olarak düşer.
  // Kişiler <@U...> mention olarak gelir (writes.js hazırlar) — herkes thread'i Slack'te takip edebilsin.
  const detail = [
    `⏰ ${fmtDate(deadlineMs)}${dept ? `   ·   📁 ${dept}` : ""}${akis ? `   ·   ${akis === "paralel" ? "⇉ paralel" : "→ sıralı"}` : ""}`,
    contribNames && contribNames.length ? `🛠 ${contribNames.join(" · ")}` : null,
    leadName ? `👤 Lead: ${leadName}` : null,
    observerNames && observerNames.length ? `👁 ${observerNames.join(" · ")}` : null,
    not ? `📝 ${not}` : null,
    acan ? `✍️ Açan: ${acan}` : null,
    `_Dashboard'dan oluşturuldu · iş bu thread'de devam eder._`,
  ].filter(Boolean).join("\n");
  // Best-effort: thread yanıtı atılamasa bile brief oluşturma bozulmaz.
  await slackCall("chat.postMessage", { channel: res.channel, thread_ts: res.ts, text: detail, username: BOT_NAME, unfurl_links: false });

  // Permalink'i ts+channel'dan inşa et (ekstra scope/çağrı gerektirmez).
  const ws = process.env.BNS_SLACK_WORKSPACE || "benseno";
  // thread_ts+cid parametreleri Slack'in mesajı thread paneli olarak açmasını sağlar.
  const permalink = `https://${ws}.slack.com/archives/${res.channel}/p${String(res.ts).replace(".", "")}?thread_ts=${res.ts}&cid=${res.channel}`;
  return { ok: true, ts: res.ts, channel: res.channel, permalink };
}

// Brief'in Slack thread'ine yanıt (b2 — değişiklikler işin thread'inde devam eder).
async function postThread({ channel, thread_ts, text }) {
  if (!hasToken() || !channel || !thread_ts) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel, thread_ts, text, username: BOT_NAME, unfurl_links: false });
  return res.ok ? { ok: true, ts: res.ts } : { ok: false, error: res.error };
}

// Her brief-akışı DM'i dashboard bildirimi olarak da kaydedilir (best-effort, DM'i bozmaz).
// Bildirim KISA tutulur (ilk satır, ~110 karakter); tıklayınca thread permalink'ine,
// permalink yoksa WT DM sohbetine gider.
const WT_DM_LINK = 'https://benseno.slack.com/app_redirect?channel=U0B5AGDEZRN';
function shortNotifText(text) {
  const firstLine = String(text).split('\n').find(l => l.trim()) || '';
  const plain = firstLine
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2').replace(/<([^>]+)>/g, '')   // linkleri at/sadeleştir
    .replace(/[*_~`]/g, '').trim();                                     // markdown'ı soy
  return plain.length > 110 ? plain.slice(0, 107) + '…' : plain;
}
async function logNotification(userId, text) {
  try {
    const { pool } = require('./db');
    const link = (String(text).match(/<(https:\/\/[^|>\s]+)/) || [])[1] || WT_DM_LINK;
    await pool.query('INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3)',
      [userId, shortNotifText(text), link]);
  } catch (e) { console.error('[slack] notification log hata:', e.message); }
}

// Tek kullanıcıya DM (channel=userID → bot DM açar; im:write gerekir).
async function dm(userId, text) {
  if (!hasToken() || !userId) return { ok: false, skipped: true };
  // FR... = freelancer (Slack'te yok) — DM sessizce atlanır, takip dashboard'dan yapılır.
  if (!/^U/.test(userId)) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel: userId, text, username: BOT_NAME, unfurl_links: false });
  if (res.ok) logNotification(userId, text);   // await yok — DM akışını geciktirmesin
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// Dosyayı Slack'e yükle + brief thread'ine iliştir (external upload flow). buf: Buffer.
async function uploadFile({ channel, thread_ts, filename, buf, title }) {
  if (!hasToken() || !channel) return { ok: false, skipped: true };
  const tok = process.env.SLACK_BOT_TOKEN;
  // 1) upload URL al
  const g = await fetch("https://slack.com/api/files.getUploadURLExternal", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Bearer ${tok}` },
    body: new URLSearchParams({ filename, length: String(buf.length) }),
  }).then(r => r.json());
  if (!g.ok) return { ok: false, error: g.error };
  // 2) bytes'ı upload_url'e yükle
  const up = await fetch(g.upload_url, { method: "POST", body: buf });
  if (!up.ok) return { ok: false, error: "upload_post_" + up.status };
  // 3) tamamla + thread'e paylaş
  const c = await slackCall("files.completeUploadExternal", {
    files: [{ id: g.file_id, title: title || filename }],
    channel_id: channel, thread_ts,
  });
  if (!c.ok) return { ok: false, error: c.error };
  const f = (c.files && c.files[0]) || {};
  return { ok: true, file_id: g.file_id, permalink: f.permalink || null, name: filename };
}

module.exports = { postBrief, postThread, dm, uploadFile, channelForBrand, hasToken, CHANNELS };
