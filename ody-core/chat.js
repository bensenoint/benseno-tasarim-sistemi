'use strict';
// ── ODY SOHBET ÇEKİRDEĞİ (çok-kaynaklı) ─────────────────────────────────────
// server/api.js odyChatRun'ın MCP portu. Davranış birebir korunur:
//  · kademeli model: veri=Haiku, sentez=Sonnet, "opus" geçerse Opus, hataya Sonnet düşüşü
//  · boş-cevap güvenliği (düşünme kapalı retry)
//  · kişi-bazlı öğrenme (kendi sohbet_log geçmişi; çapraz kişi sızıntısı yok)
//  · sohbet logu best-effort
// Farklar: araçlar MCP kaynaklarından gelir (tasarim__*, arsiv__*); sistem kullanım
// bilgisi kaynakların instructions'ından kurulur; onay tespiti KAYNAKTA yapılır
// (_meta.bns.son_mesaj ile) — reqSeq burada üretilip iletilir.
const { pool } = require('./db');
const kaynaklar = require('./kaynaklar');

const chatReqSeq = new Map();   // kullanıcı → gönderim onay sırası

async function odyChatRun({ user, isAdmin, msgs, range, kanal }) {
  const _seqKey = user.slack_id || String(user.id);
  const reqSeq = (chatReqSeq.get(_seqKey) || 0) + 1; chatReqSeq.set(_seqKey, reqSeq);
  const sonMesaj = String([...msgs].reverse().find(m => m.role !== 'assistant')?.content || '').trim();
  const meta = {
    kullanici: { id: user.id || null, slack_id: user.slack_id || null, name: user.name || null, role: user.role || 'user' },
    isAdmin: !!isAdmin, range: range || null, reqSeq, son_mesaj: sonMesaj.slice(0, 200),
  };

  // ── Kaynak araçları + sistem bilgileri (10 dk cache'li) ──
  const [TOOLS, sistemBilgi] = await Promise.all([kaynaklar.araclar(), kaynaklar.sistemBilgileri()]);

  // ── Kişi-bazlı öğrenme (kendi geçmişi) ──
  let userMemory = '';
  try {
    const lg = await pool.query(
      `SELECT soru FROM sohbet_log WHERE (user_id=$1 OR user_id=$2) AND soru IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`, [String(user.id || ''), user.slack_id || '']);
    const sorular = [...new Set(lg.rows.map(r => String(r.soru).trim()).filter(Boolean))].slice(0, 10);
    if (sorular.length) {
      userMemory = `\n\n## BU KİŞİYE ÖZEL ÖĞRENME (gizli, ${user.name})\n` +
        `${user.name} geçmişte şunları sordu — sık ilgilendiği konuları TANI; benzer soru gelirse hızlı ve isabetli davran, doğru tool'u doğrudan çağır:\n- ` +
        sorular.join('\n- ');
    }
  } catch (e) { /* best-effort */ }

  // PROMPT CACHE MİMARİSİ: system iki bloktur — (1) SABİT blok (kişilik + kurallar +
  // kaynak sistem bilgileri; kullanıcıdan/günden bağımsız, cache_control taşır) ve
  // (2) DEĞİŞKEN blok (tarih + kişi + hiyerarşi + kişisel hafıza). Araç listesi de
  // cache'lenir. Böylece ~19k tokenlik tekrar eden girdi cache'ten okunur (~%90 indirim).
  const sysSabit =
    `Senin adın Ody. Sadece bir yapay zekâ asistanı değil; Benseno'nun sistemlerine bağlı bir ÇALIŞAN ve DANIŞMANSIN. Birden fazla sisteme bağlısın; araç adları "sistem__arac" biçimindedir (örn. tasarim__genel_ozet). Soru hangi sistemi ilgilendiriyorsa o sistemin araçlarını kullan; gerektiğinde BİRDEN FAZLA sistemden veri çekip HARMANLA.\n` +
    `Konuştuğun kişiye ismiyle, sıcak ve yardımsever, Türkçe ve öz konuş; fırsat varsa proaktif öneri sun.\n\n` +
    `## SAYILAR DAİMA VERİTABANINDAN\n` +
    `Sayısal her şey SADECE araçlardan gelir. Bir sayı/olgu söylemeden ÖNCE ilgili aracı çağır; sonucu BİREBİR kullan — asla kendin sayma, tahmin etme. Araç boş/0 dönerse açıkça "yok" de.\n\n` +
    `## YORUM/ÖNERİ İÇİN NİTEL VERİYİ HARMANLA\n` +
    `Özet/öneri/değerlendirme istendiğinde kuru sayı verme; nitel araçları çağırıp sayısal verilerle harmanla, neden-sonuç kur, somut öneri sun.\n\n` +
    `## BELİRSİZLİK & YARDIM EDEMEME\n` +
    `Araç {belirsiz:true, adaylar:[...]} dönerse kendin seçme — SOR. Karşılayamadığında nedenini söyle, alternatif öner.\n\n` +
    `Kullanıcı Slack'e mesaj GÖNDERMENİ isterse ilgili gönderim aracını çağır; önizlemeyi AYNEN göster ve onay iste. Onaydan sonra YALNIZ onaylama aracını çağır — gönderim aracını tekrar çağırma, ikinci kez onay isteme.\n\n` +
    sistemBilgi;
  const sysDegisken =
    `BUGÜN: ${new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} (${new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)}). Tarih hesaplarında ('geçen Cuma', 'bu hafta') bunu baz al.\n\n` +
    `Şu an seninle konuşan kişi: ${user.name}${isAdmin ? ' (yönetici)' : ''}.\n` +
    `## HİYERARŞİ AMA BİLGİSİZ BIRAKMA\n` +
    (isAdmin
      ? `Bu kişi yönetici: tüm kişi/departman/marka puanlarına ve kıyaslara erişebilir.\n`
      : `Bu kişi yönetici DEĞİL: başka kişilerin puanı/performans kıyası gibi yönetici-özel bilgileri PAYLAŞMA; kendi işlerini ve genel bilgileri serbestçe ver. Veremediğinde nedenini açıkla, alternatif öner.\n`) +
    `Kişiye özel sorularda kisi olarak "${user.name}" ile araç çağır.` +
    userMemory;
  const system = [
    { type: 'text', text: sysSabit, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: sysDegisken },
  ];
  // Araç listesi cache'i: son araca breakpoint (prefix: tools → system → messages)
  const TOOLS_C = TOOLS.length
    ? [...TOOLS.slice(0, -1), { ...TOOLS[TOOLS.length - 1], cache_control: { type: 'ephemeral' } }]
    : TOOLS;

  const convo = msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));

  // ── Kademeli model seçimi (api.js ile birebir) ──
  const HAIKU = 'claude-haiku-4-5';
  const SONNET = 'claude-sonnet-4-6';
  const OPUS = process.env.ODY_OPUS_MODEL || 'claude-opus-4-7';
  const SYNTH_RE = /(analiz|değerlendir|degerlendir|yorumla|\byorum\b|öner|oner|tavsiye|özetle|ozetle|\bözet\b|\bozet\b|strateji|karşılaştır|karsilastir|kıyas|kiyas|sentez|neden|niçin|nicin|niye|nasıl gidiyor|nasil gidiyor|performans|risk|plan)/i;
  // Bildirim danışman yorumları YÜKSEK HACİMLİ otomatik çağrılardır (günde ~100) —
  // "değerlendir" içerse de Haiku'ya sabitlenir (bağlam prompt'ta hazır, sayı üretmez).
  const BILDIRIM_RE = /^Şu bildirim geldi/i;
  // Günlük brief de yüksek hacimli otomatik çağrıdır (her panel açılışı) — sayılar
  // araçtan geldiği için Haiku yeterli (2026-08-05 maliyet dökümü kararı).
  const BRIEF_RE = /^Bugünkü kısa kişisel özet/i;
  let model = /opus/i.test(sonMesaj) ? OPUS
    : (BILDIRIM_RE.test(sonMesaj) || BRIEF_RE.test(sonMesaj)) ? HAIKU
    : (SYNTH_RE.test(sonMesaj) ? SONNET : HAIKU);
  // Bildirim yorumunda ARAÇ YOK: gereken bağlam istemde hazır geliyor; Haiku'nun
  // "bir de DB'ye bakayım" turları istek sayısını 2-3 katına çıkarıyordu.
  const araclarKapali = BILDIRIM_RE.test(sonMesaj);
  let modelUsed = model;

  let final = '';
  const toolsUsed = [];
  let turnsUsed = 0;
  const MAX_TURNS = 5;
  const aiCall = (mdl, withTools, think) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: mdl, max_tokens: 4000, system,
      // Haiku adaptive thinking desteklemez — thinking yalnız Sonnet/Opus'ta açılır.
      ...(think === false || /haiku/i.test(mdl) ? {} : { thinking: { type: 'adaptive' } }),
      ...(withTools ? { tools: TOOLS_C } : {}),
      messages: convo,
    }),
  });
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    turnsUsed = turn + 1;
    const withTools = !araclarKapali && turn < MAX_TURNS - 1 && TOOLS.length > 0;
    let r = await aiCall(model, withTools);
    let j = await r.json().catch(() => ({}));
    if (!r.ok && model !== SONNET) {
      console.warn('[chat] ' + model + ' düştü → sonnet:', j.error?.message || r.status);
      model = SONNET; modelUsed = SONNET;
      r = await aiCall(model, withTools);
      j = await r.json().catch(() => ({}));
    }
    if (!r.ok) { console.error('[chat] AI hata:', j.error?.message || r.status); const err = new Error('asistan şu an yanıt veremiyor'); err.status = 502; throw err; }
    try { if (j.usage) pool.query(`INSERT INTO maliyet_log(model,girdi_tok,cikti_tok,kanal,cache_okuma,cache_yazma) VALUES($1,$2,$3,$4,$5,$6)`,
      [model, j.usage.input_tokens || 0, j.usage.output_tokens || 0, kanal || 'dashboard',
       j.usage.cache_read_input_tokens || 0, j.usage.cache_creation_input_tokens || 0]).catch(() => {}); } catch (e) {}
    const blocks = j.content || [];
    final = blocks.filter(c => c.type === 'text').map(c => c.text).join('').trim();
    if (j.stop_reason !== 'tool_use') break;
    convo.push({ role: 'assistant', content: blocks });
    const toolResults = [];
    for (const b of blocks) {
      if (b.type !== 'tool_use') continue;
      toolsUsed.push(b.name);
      const out = await kaynaklar.calistir(b.name, b.input, meta);
      toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
    }
    convo.push({ role: 'user', content: toolResults });
  }
  // Boş-cevap güvenliği: düşünme KAPALI + araçsız bir çağrı → model metin üretmek zorunda.
  if (!final) {
    try {
      const r2 = await aiCall(SONNET, false, false);
      const j2 = await r2.json().catch(() => ({}));
      if (r2.ok) { final = (j2.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim(); modelUsed = SONNET; }
      else console.error('[chat] boş-cevap retry başarısız:', j2.error?.message || r2.status);
    } catch (e) { console.error('[chat] boş-cevap retry hata:', e.message); }
  }
  const reply = final || 'İsteğini tam karşılayamadım, tekrar dener misin?';
  const soru = String(msgs[msgs.length - 1]?.content || '').slice(0, 2000);
  pool.query(
    `INSERT INTO sohbet_log(user_id, user_name, role, soru, tools, tool_sayisi, turlar, yanit, kanal, model)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)`,
    [user.id || user.slack_id || null, user.name || null, user.role || null,
     soru, JSON.stringify(toolsUsed), toolsUsed.length, turnsUsed, reply.slice(0, 4000), kanal || 'dashboard', modelUsed]
  ).catch(e => console.error('[chat] log yazılamadı:', e.message));
  return reply;
}

module.exports = { odyChatRun };
