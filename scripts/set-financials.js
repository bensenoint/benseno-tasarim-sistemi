'use strict';

/**
 * Benseno Maliyet/Satış — DETERMİNİSTİK (LLM değil).
 *
 * SEC-5: Finansal veri (maliyet/satış/fatura/ödeme) PUBLIC GitHub Pages'e ASLA sızmaz.
 * Kaynak-of-truth: DB (briefs tablosu, writes.setFinancials). Slack'teki /maliyet modal'ı bu
 * scripti tetikler (anlık yazım) → DB'ye yazar. Public baked dosyalar (live-data.json,
 * index.html EMBEDDED) finans İÇERMEZ; finans yalnız login-arkası API'den (/api/embedded,
 * SEC-4 girişli kullanıcıya açık) sunulur.
 *
 * data/brief-financials.json yalnızca audit/yedek amaçlı yerel STORE'dur (gitignore'lı,
 * public repo'ya gitmez). Headless Railway'de Slack reaction okunamadığı için data-agent
 * yeniden kurarsa diye --reapply STORE'daki kayıtları DB'ye yeniden uygular.
 *
 * Mod:
 *   node set-financials.js set <no> <by> <patchJSON>   → patch'i STORE'a birleştir + DB'ye yaz
 *   node set-financials.js --reapply                    → STORE'daki tüm kayıtları DB'ye yeniden uygula
 *
 * patch alanları (yalnızca verilenler uygulanır, gerisi korunur):
 *   maliyet/satis: string ("1.500,50"→1500.5) ya da "" → null (temizle)
 *   fatura/odeme: boolean (fatura kesildi mi · ödeme yapıldı mı)
 * Kayıt: { maliyet, satis, fatura, odeme, by, ts }. Dört alan da boş/false → kayıt silinir.
 */

const fs = require('fs');
const path = require('path');
const writes = require('../server/writes');
const { pool } = require('../server/db');

const PROJ = path.join(process.env.HOME, 'benseno-tasarim-sistemi');
const STORE = path.join(PROJ, 'data/brief-financials.json');
const LOG = path.join(PROJ, 'logs/set-financials.log');

function logLine(msg) { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {} console.log('[financials]', msg); }

// "1.500,50" / "1500" / "1.500" / "₺2.000" → number ; "" / "-" / null → null
function parseMoney(s) {
  if (s == null) return null;
  let t = String(s).trim();
  if (t === '' || t === '-' || t === '—') return null;
  t = t.replace(/[^\d.,-]/g, '');          // ₺, boşluk vb. at
  if (t === '' || t === '-') return null;
  const hasC = t.includes(','), hasD = t.includes('.');
  if (hasC && hasD) t = t.replace(/\./g, '').replace(',', '.');           // 1.500,50 → 1500.50
  else if (hasC) t = t.replace(',', '.');                                 // 1500,50 → 1500.50
  else if (hasD && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.500 → 1500 (binlik); 1500.5 ondalık kalır
  const n = Number(t);
  return isNaN(n) ? null : n;
}

function loadStore() { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } }
function saveStore(s) { fs.writeFileSync(STORE, JSON.stringify(s, null, 2)); }

// Bir finans kaydını (no → {maliyet,satis,fatura,odeme,by}) DB'ye yaz. Brief yoksa atla.
async function writeToDb(no, rec) {
  let id;
  try { id = await writes.noToId(+no); }
  catch (e) { logLine(`#${no} DB'de yok, atlandı: ${e.message}`); return false; }
  await writes.setFinancials(id, {
    maliyet: rec.maliyet ?? null,
    satis: rec.satis ?? null,
    fatura: !!rec.fatura,
    odeme: !!rec.odeme,
    by: rec.by || undefined,
    source: 'system',
  });
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const reapply = args.includes('--reapply');
  const fin = loadStore();

  if (reapply) {
    // STORE'daki tüm kayıtları DB'ye yeniden uygula (public'e DEĞİL).
    let n = 0;
    for (const no of Object.keys(fin)) { if (await writeToDb(no, fin[no])) n++; }
    logLine(`reapply: ${n} kayıt DB'ye yeniden uygulandı`);
    return;
  }

  // node set-financials.js set <no> <by> <patchJSON>
  if (args[0] !== 'set') { logLine('kullanım: set-financials.js set <no> <by> <patchJSON>  |  --reapply'); process.exit(1); }
  const key = String(args[1] || '').trim();
  const by = args[2] || null;
  let patch = {}; try { patch = JSON.parse(args[3] || '{}'); } catch { logLine('geçersiz patchJSON'); process.exit(1); }
  if (!key) { logLine('no zorunlu'); process.exit(1); }
  const cur = fin[key] || {};
  const next = { ...cur };
  if ('maliyet' in patch) next.maliyet = parseMoney(patch.maliyet);
  if ('satis'  in patch)  next.satis   = parseMoney(patch.satis);
  if ('fatura' in patch)  next.fatura  = !!patch.fatura;
  if ('odeme'  in patch)  next.odeme   = !!patch.odeme;
  next.by = by; next.ts = Math.floor(Date.now() / 1000);
  const empty = (next.maliyet == null) && (next.satis == null) && !next.fatura && !next.odeme;
  if (empty) { delete fin[key]; logLine(`#${key} finansal kayıt temizlendi (by ${by || '?'})`); }
  else { fin[key] = next; logLine(`#${key} → maliyet=${next.maliyet} satış=${next.satis} fatura=${!!next.fatura} ödeme=${!!next.odeme} (by ${by || '?'})`); }
  saveStore(fin);

  // Finansı DB'ye yaz — public'e ENJEKTE/PUSH ETME (SEC-5). Boş kayıtta null/false yazılır (temizleme).
  await writeToDb(key, empty ? { maliyet: null, satis: null, fatura: false, odeme: false, by } : next);
  logLine(`#${key} finans DB'ye yazıldı`);
}

main().then(() => pool.end()).catch(e => { logLine(`hata: ${e.message}`); pool.end(); process.exit(1); });
