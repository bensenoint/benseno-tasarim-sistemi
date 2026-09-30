'use strict';
/**
 * portal-hesap.js — Müşteri portal hesabı aç/pasifle (Faz 1: hesapları Görkem adına biz açıyoruz).
 *   node scripts/portal-hesap.js --ekle --email=x@marka.com --marka="JnJ Vision TR" [--ad="Ad Soyad"]
 *   node scripts/portal-hesap.js --pasif --email=x@marka.com
 *   node scripts/portal-hesap.js --liste
 * Geçici şifre üretilir ve stdout'a yazılır; müşteri ilk girişte değiştirmek zorundadır.
 */
const crypto = require('crypto');
const { pool } = require('../server/db');
const { bcrypt } = require('../server/auth');

const arg = (n) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

(async () => {
  if (process.argv.includes('--liste')) {
    const r = await pool.query(`SELECT m.email, m.ad, br.name AS marka, m.aktif, m.last_login
      FROM musteri_kullanicilar m JOIN brands br ON br.id=m.marka_id ORDER BY br.name, m.email`);
    console.table(r.rows);
  } else if (process.argv.includes('--pasif')) {
    const r = await pool.query('UPDATE musteri_kullanicilar SET aktif=false WHERE email=$1 RETURNING email', [arg('email')]);
    console.log(r.rows[0] ? `pasife alındı: ${r.rows[0].email}` : 'hesap bulunamadı');
  } else if (process.argv.includes('--ekle')) {
    const email = String(arg('email') || '').toLowerCase();
    const marka = arg('marka');
    if (!email || !marka) { console.error('--email ve --marka gerekli'); process.exit(1); }
    const br = await pool.query('SELECT id FROM brands WHERE name=$1', [marka]);
    if (!br.rows[0]) { console.error('marka bulunamadı: ' + marka); process.exit(1); }
    const gecici = crypto.randomBytes(9).toString('base64url');   // ~12 karakter
    const hash = await bcrypt.hash(gecici, 10);
    await pool.query(
      `INSERT INTO musteri_kullanicilar (email, sifre_hash, marka_id, ad, sifre_degistir)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (email) DO UPDATE SET sifre_hash=$2, marka_id=$3, ad=COALESCE($4, musteri_kullanicilar.ad), aktif=true, sifre_degistir=true`,
      [email, hash, br.rows[0].id, arg('ad')]);
    console.log(`hesap hazır → ${email} (${marka})\ngeçici şifre: ${gecici}\n(ilk girişte değiştirmesi zorunlu)`);
  } else {
    console.log('kullanım: --ekle --email=.. --marka=".." [--ad=".."] | --pasif --email=.. | --liste');
  }
  await pool.end();
})().catch(e => { console.error('hata:', e.message); process.exit(1); });
