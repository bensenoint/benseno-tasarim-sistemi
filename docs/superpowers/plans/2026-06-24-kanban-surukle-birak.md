# Kanban Sürükle-Bırak ile Statü Değiştirme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kanban panosunda (ana Kanban sekmesi) kartları masaüstünde sürükle-bırak ile başka kolona taşıyıp statüyü değiştirmek; mevcut `onStatusChange` akışını çağırarak sistem-geneli güncelleme + Slack thread bildirimini (reflectChange) yeniden kullanmak.

**Architecture:** Tek dosya (`dashboard/app/screens/Kanban.jsx`). HTML5 native DnD (bağımlılık yok). Drop → `onStatusChange(brief, hedefKolonId)` (zaten var: optimistic setBriefs + /status source=dashboard → reflectChange → Slack). Masaüstü-only; yan-etkili kolonlarda (tamamlandi/musteride) `window.confirm` onayı.

**Tech Stack:** React UMD + esbuild bundle, scripts/ci-check.sh, scripts/build-dashboard.sh, scripts/build-v2.sh, GitHub Pages.

---

## Genel kurallar
- `main` branch; push öncesi `git pull --rebase origin main`.
- Backend/Slack DEĞİŞMEZ — yalnız frontend. API deploy gerekmez; sadece Pages (build + push).
- dashboard/app ve v2/app senkron (Task 2).

---

## Task 1: Kanban.jsx'e sürükle-bırak ekle

**Files:**
- Modify: `dashboard/app/screens/Kanban.jsx`

- [ ] **Step 1: KanbanScreen'e DnD state + isMobile + yardımcılar ekle**

`function KanbanScreen({ data, onOpenBrief, onStatusChange }) {`'in hemen ALTINA (mevcut `const [prioFilter...]` satırından ÖNCE) ekle:

```js
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [dragId, setDragId] = React.useState(null);          // sürüklenen kart id
  const [dragOverCol, setDragOverCol] = React.useState(null); // üzerine gelinen kolon id
```

- [ ] **Step 2: handleDrop yardımcısını ekle (allBriefs/completedAsBriefs tanımlandıktan SONRA, `return (` satırından ÖNCE)**

`if (search.trim()) { ... }` bloğundan (allBriefs filtreleri) sonra, `return (`'dan önce ekle:

```js
  // Sürükle-bırak: hedef kolon = yeni durum. Yan etkili kolonlarda (tamamlandi/musteride) onay sor.
  const SIDE_EFFECT = { tamamlandi: "Tamamlandı", musteride: "Müşteri Onayında" };
  const handleDrop = (colId, e) => {
    if (e) e.preventDefault();
    let payload = null;
    try { payload = JSON.parse(e.dataTransfer.getData("text/bns")); } catch (_) {}
    const id = (payload && payload.id != null) ? payload.id : dragId;
    setDragOverCol(null); setDragId(null);
    if (id == null) return;
    const brief = allBriefs.find(b => b.id === id) || completedAsBriefs.find(c => c.id === id);
    if (!brief || brief.durum === colId) return;   // bulunamadı veya aynı kolon → işlem yok
    if (SIDE_EFFECT[colId] && !window.confirm(`#${brief.no} işini '${SIDE_EFFECT[colId]}' olarak işaretle?`)) return;
    if (typeof onStatusChange === "function") onStatusChange(brief, colId);
  };
```

- [ ] **Step 3: Kolon `<div>`'ine drop handler + hover vurgusu ekle**

Mevcut kolon `<div key={col.id} style={{ ... }}>`'ini şununla değiştir (masaüstünde drop'a izin ver, hover'da vurgula):

```jsx
            <div key={col.id}
              onDragOver={!isMobile ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverCol !== col.id) setDragOverCol(col.id); } : undefined}
              onDragLeave={!isMobile ? (e) => { if (e.currentTarget === e.target) setDragOverCol(c => (c === col.id ? null : c)); } : undefined}
              onDrop={!isMobile ? (e) => handleDrop(col.id, e) : undefined}
              style={{
                background: dragOverCol === col.id ? "var(--ember-tint)" : "transparent",
                border:"1px solid var(--line)",
                outline: dragOverCol === col.id ? "2px dashed var(--ody)" : "none", outlineOffset: -2,
                borderRadius: 0, padding: 10,
                display:"flex", flexDirection:"column", gap: 8,
                minWidth: 0, overflow:"hidden", transition:"background 120ms, outline-color 120ms"
            }}>
```

- [ ] **Step 4: KanbanCard'a draggable + drag event'leri geçir**

Mevcut kart map'ini şununla değiştir:

```jsx
                {items.map(b => <KanbanCard key={b.id} brief={b} onClick={() => onOpenBrief(b)}
                  draggable={!isMobile}
                  dragging={dragId === b.id}
                  onDragStartCard={(e) => { try { e.dataTransfer.setData("text/bns", JSON.stringify({ id: b.id, from: b.durum })); } catch (_) {} e.dataTransfer.effectAllowed = "move"; setDragId(b.id); }}
                  onDragEndCard={() => { setDragId(null); setDragOverCol(null); }}
                />)}
```

- [ ] **Step 5: KanbanCard bileşenini draggable yapacak şekilde güncelle**

`function KanbanCard({ brief, onClick }) {` imzasını ve `<button>`'ı şu şekilde değiştir (yeni prop'lar + draggable + dragging stili):

```jsx
function KanbanCard({ brief, onClick, draggable, dragging, onDragStartCard, onDragEndCard }) {
  return (
    <button onClick={onClick}
      draggable={draggable || undefined}
      onDragStart={draggable ? onDragStartCard : undefined}
      onDragEnd={draggable ? onDragEndCard : undefined}
      style={{
      display:"flex", flexDirection:"column", gap: 6, padding: "10px 10px 8px",
      background:"var(--paper)", border:"1px solid var(--line)", borderRadius: 0,
      cursor: draggable ? "grab" : "pointer", textAlign:"left", color:"var(--ink)",
      width:"100%", minWidth:0, boxSizing:"border-box",
      opacity: dragging ? 0.4 : 1, transition:"opacity 120ms"
    }}>
```

> **Not:** Yalnız `<button onClick={onClick} style={{ ... ` açılışı değişir; kartın iç JSX'i (marka chip, başlık, öncelik, avatar) AYNI kalır. Kapanış `</button>` ve gerisi dokunulmaz.

- [ ] **Step 6: Alt başlığı güncelle (opsiyonel ama tutarlı)**

PageHead `subtitle="durum bazlı kolonlar · drag yerine status menüsü"` → 

```jsx
        subtitle="durum bazlı kolonlar · sürükle-bırak ile statü değiştir (mobilde karta dokun)"
```

- [ ] **Step 7: CI (esbuild JSX parse)**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 8: Commit**

```bash
git add dashboard/app/screens/Kanban.jsx
git commit -m "feat(kanban): sürükle-bırak ile statü değiştirme (Trello tarzı) — drop→onStatusChange; yan-etkili kolonlarda onay; masaüstü-only"
```

---

## Task 2: v2 senkron + build + deploy + doğrulama

**Files:** yok (senkron + çalıştırma)

- [ ] **Step 1: v2 senkron (parite kontrolüyle)**

```bash
cd /Users/gorkemkaya/benseno-tasarim-sistemi
git show HEAD:dashboard/app/screens/Kanban.jsx > /tmp/k.jsx 2>/dev/null
diff -q /tmp/k.jsx v2/app/screens/Kanban.jsx >/dev/null 2>&1 && echo "v2==HEAD ✓" || echo "FARKLI (yine de kopyalanır)"
cp dashboard/app/screens/Kanban.jsx v2/app/screens/Kanban.jsx
```

- [ ] **Step 2: CI + build**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1 && bash scripts/build-dashboard.sh 2>&1 | tail -1 && bash scripts/build-v2.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ` + iki "bundle.js hazır".

- [ ] **Step 3: Commit + push (Pages)**

```bash
git add -A && git commit -m "chore(kanban): DnD — v2 senkron + bundle build" && git pull --rebase origin main && git push
```

- [ ] **Step 4: Pages yayınını bekle + canlı bundle doğrula**

Run:
```bash
until gh api repos/bensenoint/benseno-tasarim-sistemi/pages/builds/latest 2>/dev/null | grep -q '"status":"built"'; do sleep 12; done
until curl -s "https://bensenoint.github.io/benseno-tasarim-sistemi/app/bundle.js?p=$(date +%s)" | grep -q 'text/bns'; do sleep 10; done
echo "CANLI: DnD bundle yayında"
```
Expected: `CANLI: DnD bundle yayında` (`text/bns` dataTransfer anahtarı bundle'da)

- [ ] **Step 5: Manuel doğrulama (kullanıcı/preview)**

Masaüstünde Kanban sekmesinde bir kartı başka kolona sürükle:
- Kart yeni kolona geçmeli; işin Slack thread'ine "durum: <X>" notu düşmeli (reflectChange).
- Tamamlandı/Müşteri Onayında kolonuna bırakınca onay penceresi çıkmalı; iptalde kart yerinde kalmalı.
- Mobilde sürükleme olmamalı; karta dokununca drawer açılmalı (eski davranış).

---

## Self-Review notları

- **Spec kapsama:** DnD UX (T1 S1-S6), drop→onStatusChange (S2/S4/S5), masaüstü-only (`!isMobile` gate, S3/S4/S5), yan-etkili onay (`SIDE_EFFECT`+confirm, S2), görsel geri bildirim (hover outline S3 + dragging opacity S5), Slack/sistem yayılım (mevcut onStatusChange — yeni kod yok), v2/build/deploy/doğrulama (T2) — hepsi karşılanıyor.
- **Tek dosya:** Jobs KanbanView, kolon-içi reorder, mobil touch-DnD bilinçli kapsam dışı (spec).
- **Tip tutarlılığı:** `onStatusChange(brief, colId)` imzası App.jsx'teki `onStatusChange(b, s)` ile uyumlu. `handleDrop`/`SIDE_EFFECT`/`dragId`/`dragOverCol` adları S2-S5 boyunca aynı. KanbanCard prop adları (draggable/dragging/onDragStartCard/onDragEndCard) S4↔S5 eşleşiyor.
- **Risk:** Tamamlandı'ya drop optimistic'te kartı aktif kolonlardan çıkarır; kesin yansıma poll'da gelir (spec'te kabul edildi).
