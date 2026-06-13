// Ody maskotu — yüz ifadeleri (React.createElement ile çizilen göz/kaş/ağız) + fx partikülleri.
// Prototipten birebir port. fx, anime yerine WAAPI (element.animate) ile bağımlılıksız.
var BNS_NOTIFS = [
  { mood: 'heyecanli', text: 'Sana yeni brief atandı' },
  { mood: 'mutlu', text: 'Bir iş tamamlandı 👏' },
  { mood: 'endiseli', text: 'Bir iş 24 saatin altına düştü' },
  { mood: 'korkmus', text: 'Bir iş gecikti — termin aşıldı!' },
  { mood: 'coskulu', text: 'Bu hafta ekip rekoru kırıldı!' },
  { mood: 'sikilmis', text: 'Son 24 saattir panoda yeni hareket yok…' },
  { mood: 'sakin', text: 'Her şey planında. İçin rahat olsun ☕' },
  { mood: 'mesgul', text: 'Birden çok brief aynı anda işleniyor — yoğun an' },
  { mood: 'neseli', text: 'Müşteriden teşekkür notu geldi 🌟' },
  { mood: 'saskin', text: 'Sürpriz: bir iş beklenenden erken onaylandı!' },
  { mood: 'kizgin', text: 'Bir işte 3. kez revize istendi' },
  { mood: 'uzgun', text: 'Bir brief iptal oldu' },
  { mood: 'uykulu', text: 'Mesai bitti, ortam sakin…' }
];

function bnsRestingMood(m) {
  m = m || {};
  if ((m.overdue || 0) > 0) return 'kizgin';
  if ((m.risk || 0) > 0) return 'endiseli';
  if ((m.cap || 0) >= 90) return 'mesgul';
  if ((m.cap || 0) >= 72) return 'dusunuyor';
  if ((m.aktif || 0) === 0) return 'sikilmis';
  return 'neseli';
}

function bnsOdyFace(mood) {
  var h = React.createElement, W = '#fff', PUP = '#3B2A20';
  var mk = function (k, st) { return h('div', { key: k, style: Object.assign({ background: W, borderRadius: '50%' }, st) }); };
  var left, right, anim = 'odyPop .42s ease', extra = null, gap = 9;
  if (mood === 'mutlu') {
    var arc = function (k) { return h('div', { key: k, style: { width: '13px', height: '7px', borderTop: '3.5px solid ' + W, borderRadius: '13px 13px 0 0' } }); };
    left = arc('l'); right = arc('r');
  } else if (mood === 'coskulu') {
    var star = function (k) { return h('div', { key: k, style: { width: '15px', height: '15px', background: W, clipPath: 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)' } }); };
    left = star('l'); right = star('r'); anim = 'odyBounce .62s ease-in-out infinite';
  } else if (mood === 'heyecanli') {
    var ex = function (k) { return h('div', { key: k, style: { position: 'relative', width: '13px', height: '13px', background: W, borderRadius: '50%' } }, h('div', { key: 'p', style: { position: 'absolute', width: '5px', height: '5px', background: PUP, borderRadius: '50%', left: '4px', top: '5px' } }), h('div', { key: 's', style: { position: 'absolute', width: '3px', height: '3px', background: W, borderRadius: '50%', left: '2px', top: '2px' } })); };
    left = ex('l'); right = ex('r'); anim = 'odyBounce .72s ease-in-out infinite';
  } else if (mood === 'korkmus') {
    var fe = function (k) { return h('div', { key: k, style: { position: 'relative', width: '15px', height: '16px', background: W, borderRadius: '50%' } }, h('div', { key: 'p', style: { position: 'absolute', width: '3.5px', height: '3.5px', background: PUP, borderRadius: '50%', left: '6px', top: '7px' } })); };
    left = fe('l'); right = fe('r'); anim = 'odyShake .22s linear infinite'; gap = 7;
  } else if (mood === 'endiseli') {
    var we = function (k, rot) { return h('div', { key: k, style: { position: 'relative', width: '8px', height: '11px', background: W, borderRadius: '50%', transform: 'rotate(' + rot + 'deg)' } }, h('div', { key: 'p', style: { position: 'absolute', width: '3.5px', height: '3.5px', background: PUP, borderRadius: '50%', left: '2px', top: '1.5px' } })); };
    left = we('l', 15); right = we('r', -15);
    extra = h('div', { key: 'sw', style: { position: 'absolute', top: '9px', right: '15px', width: '5px', height: '7px', background: '#9ecbef', borderRadius: '50% 50% 50% 50% / 65% 65% 40% 40%', animation: 'odyShake .9s ease-in-out infinite' } });
    gap = 10;
  } else if (mood === 'sikilmis') {
    var lid = function (k) { return h('div', { key: k, style: { width: '12px', height: '6px', background: W, borderRadius: '0 0 12px 12px' } }); };
    left = lid('l'); right = lid('r');
  } else if (mood === 'dusunuyor') {
    left = mk('l', { width: '7px', height: '7px', transform: 'translateY(-2px)' }); right = mk('r', { width: '7px', height: '7px', transform: 'translateY(-2px)' });
  } else if (mood === 'dikkat') {
    left = mk('l', { width: '9px', height: '13px', animation: 'blink 4.6s infinite' }); right = mk('r', { width: '9px', height: '13px', animation: 'blink 4.6s infinite' });
  } else if (mood === 'kizgin') {
    left = mk('l', { width: '8px', height: '9px' }); right = mk('r', { width: '8px', height: '9px' });
    extra = h('div', { key: 'x', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, h('div', { key: 'bl', style: { position: 'absolute', top: '15px', left: '15px', width: '13px', height: '4px', background: W, clipPath: 'polygon(0 50%,16% 10%,84% 10%,100% 50%,84% 90%,16% 90%)', transform: 'rotate(20deg)' } }), h('div', { key: 'br', style: { position: 'absolute', top: '15px', left: '30px', width: '13px', height: '4px', background: W, clipPath: 'polygon(0 50%,16% 10%,84% 10%,100% 50%,84% 90%,16% 90%)', transform: 'rotate(-20deg)' } }));
    anim = 'odyShake .24s linear infinite';
  } else if (mood === 'uzgun') {
    left = mk('l', { width: '8px', height: '9px', transform: 'translateY(2px)' }); right = mk('r', { width: '8px', height: '9px', transform: 'translateY(2px)' });
    extra = h('div', { key: 'x', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, h('div', { key: 'bl', style: { position: 'absolute', top: '14px', left: '15px', width: '13px', height: '4px', background: W, clipPath: 'polygon(0 50%,16% 10%,84% 10%,100% 50%,84% 90%,16% 90%)', transform: 'rotate(-16deg)' } }), h('div', { key: 'br', style: { position: 'absolute', top: '14px', left: '30px', width: '13px', height: '4px', background: W, clipPath: 'polygon(0 50%,16% 10%,84% 10%,100% 50%,84% 90%,16% 90%)', transform: 'rotate(16deg)' } }));
  } else if (mood === 'saskin') {
    left = mk('l', { width: '12px', height: '14px' }); right = mk('r', { width: '12px', height: '14px' });
    extra = h('div', { key: 'x', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, h('div', { key: 'bl', style: { position: 'absolute', top: '9px', left: '15px', width: '12px', height: '3.5px', background: W, borderRadius: '4px' } }), h('div', { key: 'br', style: { position: 'absolute', top: '9px', left: '31px', width: '12px', height: '3.5px', background: W, borderRadius: '4px' } }));
    anim = 'odyPop .4s ease';
  } else if (mood === 'uykulu') {
    var lid2 = function (k) { return h('div', { key: k, style: { width: '11px', height: '4px', background: W, borderRadius: '0 0 11px 11px' } }); };
    left = lid2('l'); right = lid2('r');
  } else if (mood === 'neseli') {
    var arc2 = function (k) { return h('div', { key: k, style: { width: '13px', height: '7px', borderTop: '3.5px solid ' + W, borderRadius: '13px 13px 0 0' } }); };
    left = arc2('l'); right = arc2('r'); anim = 'odyBounce .8s ease-in-out infinite';
  } else if (mood === 'mesgul') {
    left = mk('l', { width: '7px', height: '9px', transform: 'translateX(2px)' }); right = mk('r', { width: '7px', height: '9px', transform: 'translateX(2px)' });
  } else {
    left = mk('l', { width: '8px', height: '12px', animation: 'blink 4.6s infinite' }); right = mk('r', { width: '8px', height: '12px', animation: 'blink 4.6s infinite' });
  }
  return h('div', { key: 'f-' + mood, style: { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: gap + 'px', animation: anim || undefined } }, left, right, extra);
}

// fx — partikül (✦, z, !, nokta). WAAPI ile animasyon (anime bağımlılığı yok).
function bnsSpawnFloat(host, txt, color, x, size) {
  if (!host || !host.animate && !document.createElement('div').animate) {}
  if (!host) return;
  var el = document.createElement('div');
  if (txt) { el.textContent = txt; el.setAttribute('style', 'position:absolute; left:50%; top:0; transform:translateX(-50%); pointer-events:none; z-index:60; font-family:Geist,sans-serif; font-weight:800; font-size:' + size + 'px; color:' + color + ';'); }
  else { el.setAttribute('style', 'position:absolute; left:50%; top:2px; transform:translateX(-50%); pointer-events:none; z-index:60; width:' + size + 'px; height:' + (size + 2) + 'px; border-radius:50%; background:' + color + ';'); }
  host.appendChild(el);
  var ty = -(26 + Math.random() * 16);
  try {
    var a = el.animate([
      { transform: 'translateX(-50%) translate(0,0) scale(.5)', opacity: 1 },
      { transform: 'translateX(-50%) translate(' + x + 'px,' + ty + 'px) scale(1.2)', opacity: 0 }
    ], { duration: 850, easing: 'cubic-bezier(.25,.46,.45,.94)' });
    a.onfinish = function () { el.remove(); };
  } catch (e) { setTimeout(function () { el.remove(); }, 850); }
}
function bnsOdyFx(host, mood) {
  if (mood === 'mutlu' || mood === 'neseli') bnsSpawnFloat(host, '✦', '#E0A92B', -12, 15);
  else if (mood === 'coskulu' || mood === 'heyecanli') { for (var i = 0; i < 5; i++) (function (i) { setTimeout(function () { bnsSpawnFloat(host, '✦', '#E0A92B', Math.random() * 46 - 23, 13 + Math.random() * 7); }, i * 120); })(i); }
  else if (mood === 'kizgin' || mood === 'mesgul') { bnsSpawnFloat(host, '', '#9aa3b5', -12, 8); setTimeout(function () { bnsSpawnFloat(host, '', '#9aa3b5', 12, 10); }, 240); }
  else if (mood === 'uykulu') { for (var j = 0; j < 3; j++) (function (j) { setTimeout(function () { bnsSpawnFloat(host, 'z', '#8A93AE', -8 + j * 7, 13); }, j * 430); })(j); }
  else if (mood === 'saskin') bnsSpawnFloat(host, '!', '#D9542B', 0, 20);
}
window.bnsOdyFace = bnsOdyFace;
window.BNS_NOTIFS = BNS_NOTIFS;
window.bnsRestingMood = bnsRestingMood;
window.bnsOdyFx = bnsOdyFx;
