'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = () => {
  if (!process.env.BNS_JWT_SECRET) throw new Error('BNS_JWT_SECRET env eksik');
  return process.env.BNS_JWT_SECRET;
};
// SEC-9: 7d → 24h. Mevcut (eski) token'lar süresi dolana dek çalışmaya devam eder — ani logout yok.
const TTL = '24h';

function signToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: TTL });
}

function verifyToken(token) {
  // SEC-9: algoritma pinleme — yalnız HS256 kabul (alg confusion önlenir).
  return jwt.verify(token, SECRET(), { algorithms: ['HS256'] }); // throws on invalid/expired
}

function authGuard(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'giriş gerekli' });
  try {
    req.user = verifyToken(token);
    // SEC-P1 (portal, 30 Eyl): müşteri token'ları personel API'lerine GİREMEZ.
    // Müşteriler yalnız /api/portal/* uçlarını kullanır (musteriGuard).
    if (req.user && req.user.role === 'musteri') return res.status(403).json({ error: 'bu uç portal hesaplarına kapalı' });
    next();
  } catch {
    res.status(401).json({ error: 'geçersiz veya süresi dolmuş token' });
  }
}

// Portal (müşteri) guard — yalnız role='musteri' token kabul eder; marka kimliği token'dan gelir.
function musteriGuard(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'giriş gerekli' });
  try {
    const u = verifyToken(token);
    if (u.role !== 'musteri' || !u.marka_id) return res.status(403).json({ error: 'portal hesabı gerekli' });
    req.musteri = u;   // { role:'musteri', mid: hesap id, marka_id, email }
    next();
  } catch {
    res.status(401).json({ error: 'geçersiz veya süresi dolmuş token' });
  }
}

function adminGuard(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'yönetici yetkisi gerekli' });
  next();
}

module.exports = { signToken, verifyToken, authGuard, adminGuard, musteriGuard, bcrypt };
