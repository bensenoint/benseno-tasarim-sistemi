# Dashboard Authentication & Help System — Design Spec

**Tarih:** 2026-06-08  
**Durum:** Onaylandı  
**Kapsam:** Dashboard login sistemi + Slack `/yardim` komutu + Dashboard yardım bölümü

---

## 1. Özet

Mevcut dashboard'da kimlik doğrulama istemci tarafında hard-coded hash ile yapılıyor (`index.html`). Bu spec, per-user JWT tabanlı bir auth sistemine geçişi ve hem Slack hem dashboard'da yardım içeriklerini tanımlıyor.

---

## 2. Kimlik Doğrulama Mimarisi

### 2.1 Veri Modeli

```sql
CREATE TABLE dashboard_users (
  id          SERIAL PRIMARY KEY,
  slack_id    TEXT UNIQUE NOT NULL,          -- Slack User ID (U0123…)
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  password_hash TEXT NOT NULL,               -- bcrypt, cost=12
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);
```

- İlk kullanıcı (bootstrap) migration ile seeder'dan eklenir.
- `slack_id` bağlantısı sayesinde Slack kimliğiyle eşleştirme yapılabilir.

### 2.2 Token Akışı

```
POST /api/auth/login { slack_id, password }
  → bcrypt.compare()
  → JWT imzala (secret: BNS_JWT_SECRET, exp: 7d)
  → { token, user: { id, name, role } }

Dashboard → localStorage.setItem('bns_token', token)
Her istek → Authorization: Bearer <token>
```

- Token 7 gün geçerli; süresi dolarsa login ekranına yönlendir.
- Cross-origin: Railway API `ALLOWED_ORIGINS`'e GitHub Pages eklenmiş durumda.

### 2.3 Endpoint'ler

| Method | Path | Açıklama |
|--------|------|---------|
| POST | `/api/auth/login` | Giriş, JWT döner |
| GET | `/api/auth/me` | Token doğrula, user bilgisi döner |
| POST | `/api/auth/logout` | İstemci tarafı (localStorage temizle) |
| GET | `/api/users` | Kullanıcı listesi (admin only) |
| POST | `/api/users` | Yeni kullanıcı ekle (admin only) |
| PATCH | `/api/users/:id` | Şifre/rol güncelle (admin only) |

### 2.4 Guard Middleware

```js
function authGuard(req, res, next) {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'giriş gerekli' });
  try {
    req.user = jwt.verify(token, process.env.BNS_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'geçersiz token' });
  }
}
function adminGuard(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'yönetici gerekli' });
  next();
}
```

### 2.5 Mevcut Write Guard

`BNS_WRITE_TOKEN` ile korunan write endpoint'leri (`/api/briefs/…`) **değişmez** — bu token bot tarafından kullanılır. Yeni `authGuard` sadece dashboard endpoint'lerine eklenir.

---

## 3. Login Ekranı (Dashboard)

- Benseno navy logosu üstte, ortalı kart layout.
- Alan: `slack_id` (text) + `password` (password).
- Hata: "Kullanıcı adı veya şifre hatalı" (ikisini ayrıştırma — bilgi sızdırma riski).
- Başarılı giriş → `localStorage.setItem('bns_token')` → dashboard ana görünümüne yönlendir.
- Token varsa ve geçerliyse login ekranı atlanır.

---

## 4. Admin Paneli

- Dashboard'da "Kullanıcılar" sekmesi (sadece `role=admin` kullanıcılara görünür).
- Kullanıcı listesi: isim, slack_id, rol, son giriş.
- Yeni kullanıcı ekle: slack_id + geçici şifre + rol seç.
- Şifre sıfırla butonu (admin kendi kullanıcılarını sıfırlayabilir).

---

## 5. Migration & Bootstrap

```sql
-- Migration: dashboard_users tablosu
-- Seeder: ilk admin kullanıcı (Görkem)
-- BNS_BOOTSTRAP_PASSWORD env değişkeninden alınır
-- Sonraki çalıştırmalarda zaten varsa skip
```

- `BNS_BOOTSTRAP_PASSWORD` Railway'de env variable olarak tanımlanır.
- Production'da migration Railway deploy hook'u ile otomatik çalışır.

---

## 6. Slack `/yardim` Komutu

✅ **Tamamlandı** — Bu spec yazılırken zaten implement edildi.

- Ephemeral mesaj, Block Kit.
- Komutlar + Emoji kısayolları + Kelime kısayolları bölümleri.
- `/yardim` Slack App Config'e kayıtlı.

---

## 7. Dashboard Yardım Bölümü

- Dashboard'da sağ üst köşede `?` ikonu veya "Yardım" sekmesi.
- İçerik: kelime/emoji kısayolları referansı, dashboard nasıl kullanılır, brief yaşam döngüsü.
- Tasarım: modal veya yan panel (slide-over).
- Güncelleme: kod değişikliği gerektirmez — içerik markdown/HTML olarak sabit.

---

## 8. Silinenler (Kapsam Dışı — Ayrı Spec)

Soft-delete (`deleted_at` column) ve "Silinenler" dashboard sekmesi ayrı bir spec'te ele alınacak.

---

## 9. Bağımlılıklar

| Paket | Amaç |
|-------|------|
| `jsonwebtoken` | JWT imzalama/doğrulama |
| `bcryptjs` | Şifre hash'leme |

Her ikisi de Railway'de `server/package.json`'a eklenecek.

---

## 10. Güvenlik Notları

- `BNS_JWT_SECRET` en az 32 karakter rastgele string; Railway env'de saklanır, commit edilmez.
- `BNS_BOOTSTRAP_PASSWORD` güçlü geçici şifre; ilk girişte değiştirilir.
- bcrypt cost=12 (Railway'in CPU bütçesi için yeterli).
- Token payload'ında sadece `{ id, slack_id, role }` — hassas veri yok.
