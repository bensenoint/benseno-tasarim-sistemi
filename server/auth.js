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
    next();
  } catch {
    res.status(401).json({ error: 'geçersiz veya süresi dolmuş token' });
  }
}

function adminGuard(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'yönetici yetkisi gerekli' });
  next();
}

module.exports = { signToken, verifyToken, authGuard, adminGuard, bcrypt };
