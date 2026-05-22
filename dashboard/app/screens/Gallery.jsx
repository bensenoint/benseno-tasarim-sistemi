// app/screens/Gallery.jsx — image grid of completed outputs.

function GalleryScreen({ data }) {
  const items = data.completed.slice(0, 18);
  return (
    <div className="bn-tab-in">
      <PageHead
        title="Galeri"
        subtitle="tamamlanmış brief'lerin görsel çıktıları · Slack thread'lerinden"
      />
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap: 12}}>
        {items.map((c, i) => <GalleryTile key={c.id} c={c} idx={i}/>)}
      </div>
    </div>
  );
}

function GalleryTile({ c, idx }) {
  const [hovered, setHovered] = React.useState(false);
  const seed = (c.no || 0) + idx;
  const pattern = idx % 5;
  const slackUrl = c.slack_url || "#";
  return (
    <div
      onClick={() => slackUrl !== "#" && window.open(slackUrl, "_blank")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:"1px solid var(--line)", borderRadius: 10, background:"var(--surface)",
        overflow:"hidden", cursor: slackUrl !== "#" ? "pointer" : "default",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "var(--shadow-2)" : "none",
        transition: "transform 120ms, box-shadow 120ms"
      }}>
      <div style={{
        aspectRatio:"4/3", background: `linear-gradient(135deg, ${c.brand.color} 0%, ${shade(c.brand.color, -0.25)} 100%)`,
        position:"relative", overflow:"hidden"
      }}>
        <svg viewBox="0 0 200 150" style={{width:"100%", height:"100%", position:"absolute"}}>
          {pattern === 0 && Array.from({length: 8}).map((_, i) => (
            <circle key={i} cx={20 + (i % 4) * 50} cy={30 + Math.floor(i / 4) * 60}
              r={10 + (seed + i) % 8} fill="rgba(255,255,255,0.25)"/>
          ))}
          {pattern === 1 && Array.from({length: 6}).map((_, i) => (
            <rect key={i} x={5 + i * 30} y={30 + ((seed + i) % 6) * 10} width={20} height={80}
              fill="rgba(255,255,255,0.2)"/>
          ))}
          {pattern === 2 && (
            <g fill="rgba(255,255,255,0.22)">
              <path d="M0 90 Q 50 60 100 90 T 200 90 V 150 H 0 Z"/>
              <path d="M0 110 Q 60 90 120 110 T 200 110 V 150 H 0 Z" opacity="0.5"/>
            </g>
          )}
          {pattern === 3 && (
            <g stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none">
              {Array.from({length: 7}).map((_, i) => (
                <line key={i} x1="0" y1={i * 22} x2="200" y2={i * 22 - 30}/>
              ))}
            </g>
          )}
          {pattern === 4 && (
            <text x="100" y="90" fill="rgba(255,255,255,0.3)" textAnchor="middle"
              fontSize="64" fontFamily="serif" fontStyle="italic">
              {c.brand.name.charAt(0)}
            </text>
          )}
        </svg>
        <div style={{
          position:"absolute", left: 10, bottom: 10,
          background:"rgba(0,0,0,0.6)", color:"#fff",
          padding:"4px 8px", borderRadius: 4,
          font:"500 11px/1 var(--font-mono)"
        }}>#{c.no}</div>
        {hovered && slackUrl !== "#" && (
          <div style={{
            position:"absolute", inset:0, background:"rgba(0,0,0,0.45)",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"opacity 120ms"
          }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background:"rgba(255,255,255,0.95)", borderRadius:8,
              padding:"8px 14px", font:"600 12px/1 var(--font-sans)", color:"var(--ink)"
            }}>
              <I.Slack size={13}/> Slack'te gör
            </div>
          </div>
        )}
      </div>
      <div style={{padding:"10px 12px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginBottom: 6}}>
          <BrandChip brand={c.brand} size="sm"/>
          <Avatar user={c.lead} size={18}/>
        </div>
        <div style={{font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
          {c.baslik}
        </div>
        <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-4)", marginTop: 4}}>
          tamamlandı · {c.sure} sa
        </div>
      </div>
    </div>
  );
}

function shade(hex, amt) {
  // amt: positive lighten, negative darken; amt ∈ [-1,1]
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) : v) * amt)));
  return "#" + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

window.GalleryScreen = GalleryScreen;
window.GalleryTile = GalleryTile;
