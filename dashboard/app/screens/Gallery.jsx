// app/screens/Gallery.jsx — tamamlanan işlerin FINAL teslimleri (resim + diğer dosya tipleri) + AI özeti.
// Final teslim = Slack thread'inde 📎 ile işaretlenen dosya(lar) → brief_attachments(is_final).
// Dosyalar /api/attachment/:id proxy'sinden servis edilir (Slack url_private bot token'ıyla).

function GalleryScreen({ data, onOpenCompleted }) {
  const all = data.completed || [];   // üst global takvim filtresine süzülü tamamlananlar
  const [onlyFinal, setOnlyFinal] = React.useState(false);
  const [brandSel, setBrandSel] = React.useState("");
  const withFinal = all.filter(c => (c.attachments || []).some(a => a.is_final) || c.image_url);
  // Marka seçenekleri — tamamlanan işlerin markaları (alfabetik, tekil)
  const brandNames = React.useMemo(() => {
    const seen = {};
    for (const c of all) { const n = c.brand?.name || c.marka; if (n) seen[n] = true; }
    return Object.keys(seen).sort((a, b) => a.localeCompare(b, "tr"));
  }, [all]);
  let items = onlyFinal ? withFinal : all;
  if (brandSel) items = items.filter(c => (c.brand?.name || c.marka) === brandSel);
  const fldStyle = { padding:"6px 9px", border:"1px solid var(--line)", borderRadius:6, background:"var(--surface)", color:"var(--ink)", font:"400 12px/1.2 var(--font-sans)", cursor:"pointer" };
  return (
    <div className="bn-tab-in">
      <PageHead
        title="Galeri"
        subtitle={`tamamlanan işlerin final teslimleri · ${withFinal.length}/${all.length} işte teslim var · thread'de 📎 ile işaretle`}
        actions={<>
          <select value={brandSel} onChange={e => setBrandSel(e.target.value)} title="Markaya göre filtrele"
            style={{ ...fldStyle, maxWidth: 180 }}>
            <option value="">Tüm markalar ({all.length})</option>
            {brandNames.map(n => (
              <option key={n} value={n}>{n} ({all.filter(c => (c.brand?.name || c.marka) === n).length})</option>
            ))}
          </select>
          <button onClick={() => setOnlyFinal(v => !v)}
            style={{ ...fldStyle, background: onlyFinal ? "var(--ember)" : "var(--surface)", color: onlyFinal ? "#fff" : "var(--ink-3)", borderColor: onlyFinal ? "var(--ember)" : "var(--line)" }}>
            {onlyFinal ? "✓ yalnız teslimli" : "yalnız teslimli göster"}
          </button>
        </>}
      />
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap: 14}}>
        {items.map((c, i) => <GalleryTile key={c.id} c={c} idx={i} onOpen={onOpenCompleted}/>)}
      </div>
      {items.length === 0 && (
        <div style={{padding:"40px 0", textAlign:"center", color:"var(--ink-4)", font:"400 13px/1.4 var(--font-sans)"}}>
          Henüz final teslim işaretlenmemiş. Slack thread'inde final dosyaya 📎 reaction'ı koy.
        </div>
      )}
    </div>
  );
}

function fileGlyph(mime, name) {
  const m = (mime || "").toLowerCase(), n = (name || "").toLowerCase();
  if (/pdf/.test(m) || n.endsWith(".pdf")) return "📕";
  if (/zip|rar|compress/.test(m) || /\.(zip|rar|7z)$/.test(n)) return "🗜️";
  if (/video/.test(m) || /\.(mp4|mov|webm)$/.test(n)) return "🎞️";
  if (/(illustrator|postscript)/.test(m) || /\.(ai|eps)$/.test(n)) return "🎨";
  if (/photoshop/.test(m) || /\.psd$/.test(n)) return "🖌️";
  if (/word|document/.test(m) || /\.docx?$/.test(n)) return "📄";
  if (/sheet|excel/.test(m) || /\.xlsx?$/.test(n)) return "📊";
  return "📎";
}
function isImageFile(a) {
  return /^image\//.test(a.mime || "") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.name || "");
}

function GalleryTile({ c, idx, onOpen }) {
  const [hovered, setHovered] = React.useState(false);
  const seed = (c.no || 0) + idx;
  const pattern = idx % 5;
  const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
  const brandColor = c.brand?.color || c.marka_color ||
    (window.WHEEL && window.brandHash ? window.WHEEL[window.brandHash(c.marka||'')] : null) || '#888';
  const brandName = c.brand?.name || c.marka || '?';

  // Final teslimler (📎). Yoksa eski tek-görsel (image_url) yedeği.
  const finals = (c.attachments || []).filter(a => a.is_final);
  const hero = finals[0] || null;
  const heroIsImage = hero ? isImageFile(hero) : !!c.image_url;
  const heroSrc = hero ? `${apiBase}/api/attachment/${hero.id}` : (c.image_url ? `${apiBase}/api/img/${c.id}` : null);
  const extra = finals.length > 1 ? finals.length - 1 : 0;
  const ozet = c.thread_ozet || c.insight || null;
  const slackUrl = c.slack_url || "#";

  // Görsel/dosya önizleme (resim açılır, dosya iner). İki ayrı link altta: Slack thread + İş detayı.
  const previewFile = () => { if (heroSrc) window.open(heroSrc, "_blank"); };
  const openSlack = (e) => { e.stopPropagation(); if (slackUrl !== "#") window.open(slackUrl, "_blank"); };
  const openDetail = (e) => { e.stopPropagation(); if (onOpen) onOpen(c); };

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        border:"1px solid var(--line)", borderRadius: 0, background:"var(--surface)",
        overflow:"hidden",
        transform: hovered ? "translateY(-2px)" : "none",
        borderColor: hovered ? "var(--line-strong)" : "var(--line)",
        transition: "transform 120ms, border-color 120ms"
      }}>
      <div onClick={previewFile} title={heroSrc ? "Önizleme / indir" : undefined}
        style={{aspectRatio:"4/3", background:`linear-gradient(135deg, ${brandColor} 0%, ${shade(brandColor,-0.25)} 100%)`, position:"relative", overflow:"hidden", cursor: heroSrc ? "pointer" : "default"}}>
        {heroSrc && heroIsImage ? (
          <img src={heroSrc} alt={c.baslik} loading="lazy"
            style={{width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0}}
            onError={e => { e.target.style.display = "none"; }}/>
        ) : hero ? (
          // Resim olmayan final dosya → tip ikonu + ad
          <div style={{position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#fff"}}>
            <div style={{fontSize:44}}>{fileGlyph(hero.mime, hero.name)}</div>
            <div style={{font:"600 11px/1.2 var(--font-sans)", maxWidth:"85%", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{hero.name}</div>
            <div style={{font:"500 10px/1 var(--font-sans)", opacity:0.85}}>indirmek için tıkla</div>
          </div>
        ) : (
          // Teslim yok → placeholder + ipucu
          <>
            <svg viewBox="0 0 200 150" style={{width:"100%", height:"100%", position:"absolute"}}>
              {pattern === 0 && Array.from({length: 8}).map((_, i) => (<circle key={i} cx={20 + (i % 4) * 50} cy={30 + Math.floor(i / 4) * 60} r={10 + (seed + i) % 8} fill="rgba(255,255,255,0.25)"/>))}
              {pattern === 1 && Array.from({length: 6}).map((_, i) => (<rect key={i} x={5 + i * 30} y={30 + ((seed + i) % 6) * 10} width={20} height={80} fill="rgba(255,255,255,0.2)"/>))}
              {pattern === 2 && (<g fill="rgba(255,255,255,0.22)"><path d="M0 90 Q 50 60 100 90 T 200 90 V 150 H 0 Z"/><path d="M0 110 Q 60 90 120 110 T 200 110 V 150 H 0 Z" opacity="0.5"/></g>)}
              {pattern === 3 && (<g stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none">{Array.from({length: 7}).map((_, i) => (<line key={i} x1="0" y1={i * 22} x2="200" y2={i * 22 - 30}/>))}</g>)}
              {pattern === 4 && (<text x="100" y="90" fill="rgba(255,255,255,0.3)" textAnchor="middle" fontSize="64" fontFamily="serif" fontStyle="italic">{brandName.charAt(0)}</text>)}
            </svg>
            <div style={{position:"absolute", right:10, top:10, background:"rgba(0,0,0,0.5)", color:"#fff", padding:"3px 7px", borderRadius:4, font:"500 10px/1 var(--font-sans)"}}>📎 final yok</div>
          </>
        )}
        <div style={{position:"absolute", left: 10, bottom: 10, background:"rgba(0,0,0,0.6)", color:"#fff", padding:"4px 8px", borderRadius: 4, font:"500 11px/1 var(--font-mono)"}}>#{c.no}</div>
        {extra > 0 && (
          <div style={{position:"absolute", right: 10, bottom: 10, background:"rgba(0,0,0,0.6)", color:"#fff", padding:"4px 8px", borderRadius: 4, font:"600 11px/1 var(--font-sans)"}}>+{extra} dosya</div>
        )}
      </div>
      <div style={{padding:"10px 12px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginBottom: 6}}>
          <BrandChip brand={c.brand} size="sm"/>
          <Avatar user={c.lead} size={18}/>
        </div>
        <div style={{font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.baslik}</div>
        {ozet && (
          <div style={{font:"400 11px/1.4 var(--font-sans)", color:"var(--ink-3)", marginTop: 5,
            display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{ozet}</div>
        )}
        <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-4)", marginTop: 6}}>
          tamamlandı{c.sureH != null && c.sureH > 0 ? " · " + c.sureH.toFixed(1) + " sa" : ""}{finals.length ? " · 📎 " + finals.length + " teslim" : ""}
        </div>
        {/* İki tıklanır link: Slack thread'i + iş detayı */}
        <div style={{display:"flex", gap:8, marginTop:9}}>
          {slackUrl !== "#" && (
            <button onClick={openSlack} title="Slack thread'ini aç" style={{
              flex:1, padding:"6px 8px", border:"1px solid var(--line)", borderRadius:6, cursor:"pointer",
              background:"var(--surface)", color:"var(--ink-3)", font:"500 11px/1 var(--font-sans)", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5}}>
              💬 Slack thread
            </button>
          )}
          {onOpen && (
            <button onClick={openDetail} title="İş detayını aç" style={{
              flex:1, padding:"6px 8px", border:"1px solid var(--line)", borderRadius:6, cursor:"pointer",
              background:"var(--surface)", color:"var(--ink-3)", font:"500 11px/1 var(--font-sans)", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5}}>
              🔍 İş detayı
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function shade(hex, amt) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) : v) * amt)));
  return "#" + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

window.GalleryScreen = GalleryScreen;
window.GalleryTile = GalleryTile;
