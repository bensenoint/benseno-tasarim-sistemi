# Finans Veri-Girişi Mini-Fazı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yönetici BriefDrawer'dan maliyet/satış/fatura/ödeme girebilsin; finanssız iş tamamlanınca thread'e best-effort dürtü düşsün.

**Architecture:** (A) BriefDrawer'a `_isMgr` gate'li FinansBolumu — mevcut `POST /api/briefs/:id/financials`'a drawer fetch deseniyle yazar. (B) `writes.setStatus`'ta `reflectChange` sonrası, `d.durum==='tamamlandi'` ve maliyet+satış null ise `slack.postThread` dürtüsü (mevcut best-effort desen). Migration/endpoint değişikliği yok.

**Tech Stack:** React UMD/JSX, Express/pg (writes.js), server/slack.js `postThread`.

---

## Referans

- Drawer fetch deseni: `apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app'`; `tok = localStorage.getItem('bns_token')`; header `{'content-type':'application/json', Authorization: Bearer tok}`.
- `writes.js` zaten `const slack = require('./slack')` (satır 15); `postThread({channel, thread_ts, text})` kendi içinde `hasToken/channel/ts` guard'lı.
- Ekleme noktası (B): `setStatus` içinde `await reflectChange(id, note, d.source, { by: d.by });` satırından SONRA (resumeMs bildirim bloğu deseni).
- `completed` değişkeni tx closure'ında olabilir → dış scope'ta `d.durum === 'tamamlandi'` kullan.
- Sunucu yetkisi: `assertCanWriteFinancials` (yönetici-only 403) — değişmez.

## Task 1: BriefDrawer FinansBolumu (yönetici-only)

**Files:**
- Modify: `dashboard/app/BriefDrawer.jsx`

- [ ] **Step 1: Bileşeni ekle (BriefDrawer fonksiyonundan ÖNCE, dosya üst düzeyine)**

```jsx
// ─── Finans girişi (yönetici-only) — mevcut /financials endpoint'i; SEC-5: yalnız login-arkası API ───
function FinansBolumu({ b, onUpdate }) {
  const [f, setF] = React.useState({
    maliyet: b.maliyet ?? "", satis: b.satis ?? "", fatura: !!b.fatura, odeme: !!b.odeme });
  const [durum, setDurum] = React.useState(null); // null | 'kaydediliyor' | 'ok' | hata metni
  const kaydet = async () => {
    setDurum('kaydediliyor');
    try {
      const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
      const tok = localStorage.getItem('bns_token');
      const body = { fatura: f.fatura, odeme: f.odeme };
      if (f.maliyet !== "") body.maliyet = +f.maliyet;
      if (f.satis !== "") body.satis = +f.satis;
      const res = await fetch(`${apiBase}/api/briefs/${b.id}/financials`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setDurum(j.error || 'kaydedilemedi'); return; }
      setDurum('ok');
      onUpdate && onUpdate();
      setTimeout(() => setDurum(null), 2000);
    } catch (e) { setDurum('bağlantı hatası'); }
  };
  const inp = { width: 90, font: "400 12px var(--font-sans)", padding: "5px 8px",
    border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)" };
  const lbl = { font: "400 11px/1.4 var(--font-sans)", color: "var(--ink-3)", display: "block", marginBottom: 3 };
  return (
    <div style={{marginTop: 14, padding: 12, border: "1px solid var(--line)", borderRadius: 10}}>
      <div style={{font: "600 12px/1 var(--font-sans)", marginBottom: 10}}>💰 Finans (yönetici)</div>
      <div style={{display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end"}}>
        <div><span style={lbl}>Maliyet (₺)</span>
          <input type="number" min="0" style={inp} value={f.maliyet}
            onChange={e => setF({ ...f, maliyet: e.target.value })}/></div>
        <div><span style={lbl}>Satış (₺)</span>
          <input type="number" min="0" style={inp} value={f.satis}
            onChange={e => setF({ ...f, satis: e.target.value })}/></div>
        <label style={{font: "400 12px var(--font-sans)", display: "flex", gap: 5, alignItems: "center", cursor: "pointer"}}>
          <input type="checkbox" checked={f.fatura} onChange={e => setF({ ...f, fatura: e.target.checked })}/> fatura kesildi</label>
        <label style={{font: "400 12px var(--font-sans)", display: "flex", gap: 5, alignItems: "center", cursor: "pointer"}}>
          <input type="checkbox" checked={f.odeme} onChange={e => setF({ ...f, odeme: e.target.checked })}/> ödeme alındı</label>
        <button onClick={kaydet} disabled={durum === 'kaydediliyor'}
          style={{font: "600 12px var(--font-sans)", padding: "6px 14px", border: "1px solid var(--line)",
            borderRadius: 8, background: "var(--paper-2)", color: "var(--ink)", cursor: "pointer"}}>
          {durum === 'kaydediliyor' ? '…' : 'Kaydet'}</button>
        {durum === 'ok' && <span style={{font: "500 12px var(--font-sans)", color: "var(--ok, #2e9e5b)"}}>✓ kaydedildi</span>}
        {durum && durum !== 'ok' && durum !== 'kaydediliyor' &&
          <span style={{font: "400 11px var(--font-sans)", color: "var(--prio-red)"}}>{durum}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render noktasını bul + ekle**

Run: `grep -n "musteri_bekliyor && !ro" dashboard/app/BriefDrawer.jsx | head -1` — thread_ton/rozet şeridinin olduğu üst bölge. Drawer gövdesinin ALT kısmına (ana içerik bloklarının sonuna; Sil/aksiyon düğmeleri civarı uygun) şunu ekle:
```jsx
      {_isMgr && <FinansBolumu b={b} onUpdate={onUpdate}/>}
```
`_isMgr` ve `onUpdate` drawer scope'unda mevcut. Alt bölge belirsizse: drawer'ın en dış return'ündeki son içerik `</div>`'inden hemen önce yerleştir.

- [ ] **Step 3: CI** — `bash scripts/ci-check.sh` → JSX ✅ + `🟢`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/BriefDrawer.jsx
git commit -m "feat(finans-giris): BriefDrawer Finans bölümü (yönetici-only, /financials)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 2: Tamamlanma dürtüsü (writes.setStatus)

**Files:**
- Modify: `server/writes.js` (reflectChange sonrası)

- [ ] **Step 1: Bloğu ekle**

`await reflectChange(id, note, d.source, { by: d.by });` satırından hemen SONRA:
```js
  // Finans dürtüsü (veri-girişi mini-fazı): tamamlanan işte maliyet+satış boşsa thread'e hatırlat (best-effort).
  if (d.durum === 'tamamlandi') {
    try {
      const fb = (await pool.query(
        `SELECT no, maliyet, satis, slack_channel, slack_ts FROM briefs WHERE id=$1`, [id])).rows[0];
      if (fb && fb.maliyet == null && fb.satis == null) {
        await slack.postThread({ channel: fb.slack_channel, thread_ts: fb.slack_ts,
          text: `💰 #${fb.no} tamamlandı — maliyet/satış girilmedi. Dashboard → iş → Finans, ya da \`/maliyet ${fb.no}\`` });
      }
    } catch (e) { console.error('[setStatus] finans dürtüsü:', e.message); }
  }
```
(postThread token/kanal yoksa kendi içinde sessiz atlar.)

- [ ] **Step 2: Sözdizimi** — `node --check server/writes.js`.

- [ ] **Step 3: Commit**

```bash
git add server/writes.js
git commit -m "feat(finans-giris): tamamlanma dürtüsü — finanssız işte thread notu (best-effort)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 3: Build + preview + iki servis deploy

- [ ] **Step 1: Build** — `bash scripts/build-dashboard.sh`.
- [ ] **Step 2: Preview** — `typeof FinansBolumu === "function"`; konsol temiz. (Kaydet zinciri login gerektirir → canlı kullanıcı onayıyla.)
- [ ] **Step 3: Commit build + deploy + doğrula**

```bash
git add -A && git commit -m "build(finans-giris): bundle senkron

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
bash scripts/deploy.sh api
bash scripts/deploy.sh dashboard
git push origin main
# health 200 + boot temiz
```

## Self-Review

- Spec kapsama: A drawer bölümü (alanlar, ön-dolu, kısmi body, ok/hata durumu) ✓ Task 1; B dürtü (koşul, best-effort, metin) ✓ Task 2; yetki/migration değişmez ✓; SEC-5 ✓ (yalnız API).
- Tip tutarlılığı: `FinansBolumu({b, onUpdate})` tanım↔render; body alanları setFinancials şemasıyla (maliyet/satis/fatura/odeme) uyumlu; `d.durum` dış scope'ta güvenli.
- Placeholder yok; render-anchor için net fallback kuralı verildi.
