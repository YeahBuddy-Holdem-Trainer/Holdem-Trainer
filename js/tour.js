/* ---------- first-launch tour ----------
   Dims the page and highlights one part of the app at a time with a short card (Back / Next / Skip).
   Shown once per device; Settings has "Replay the tour". Skipped in test mode (?test=1). */
const TOUR_KEY = 'holdem-tour-v1';
const TOUR = [
  { title: 'Welcome to the Hold\'em Trainer 👋', text: 'A 30-second tour of where everything lives. You can skip it and replay it any time from Settings.', next: 'Show me around' },
  { sel: '.secnav', title: 'Sections', text: '<b>Home</b>: your daily challenge and progress. <b>Learn</b>: guided lessons. <b>Odds, Equity, EV, Ranges</b> and <b>Play</b>: the trainers, from quick math drills to full hands.' },
  { sel: '.secnav a[data-sec="learn"]', title: 'New? Start here', text: 'The <b>Learn</b> path goes from hand rankings to tournament ICM. Lessons unlock as you pass them, you earn chips, and you rank up from Fish to Crusher. Already play? Take the placement test.' },
  { hash: 'learn', sel: '.seg.mode', title: 'Cash or Tournament', text: 'Switches the charts, stack sizes and examples everywhere it matters. Trainers that work the same in both don\'t change.' },
  { hash: 'pot-odds', sel: '#subnav .subtabs', title: 'Trainers', text: 'Each section has a few trainers. Tap a tab to switch; on a phone, swipe the row for more.' },
  { hash: 'pot-odds', sel: '#subnav .info-sub', title: 'How it works', text: 'Tap <b>?</b> on any trainer to see what it practises and the math behind the answers.' },
  { hash: 'pot-odds', sel: '#subnav .units-tog', title: 'Dollars or big blinds', text: 'Where amounts matter, tap to show them in $ or BB.' },
  { hash: 'pot-odds', sel: '#subnav .flag-sub', title: 'Flag this', text: 'Something look wrong? Tap <b>⚑</b> and add a note. Flags go to the app\'s owner to check and fix.' },
  { hash: 'daily', sel: '#acct-btn', title: 'Your account', text: 'Sign in with Google or email to save progress across devices. <b>Settings</b> live here too.' },
  { hash: 'daily', title: 'You\'re set', text: 'Where would you like to start?', end: true },
];
let tourI = -1;
function tourDone() { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {} }
function tourStart() { if ($('set-dlg').open) $('set-dlg').close(); tourI = 0; tourShow(); }
function tourEnd() { tourI = -1; $('tour').hidden = true; document.body.classList.remove('touring'); tourDone(); }
function tourShow() {
  const s = TOUR[tourI], box = $('tour');
  if (s.hash && location.hash.slice(1) !== s.hash) { location.hash = '#' + s.hash; setTimeout(tourShow, 250); return; }
  box.hidden = false; document.body.classList.add('touring');
  /* first match that is actually on screen (fixed bars have no offsetParent, so measure instead) */
  const el = s.sel && [...document.querySelectorAll(s.sel)].find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden'; }), vis = !!el;
  $('tour-card').innerHTML = `<span class="eyebrow">${tourI ? `${tourI} of ${TOUR.length - 1}` : 'Quick tour'}</span><h3 id="tour-h">${s.title}</h3><p>${s.text}</p>
    ${s.end ? `<div class="tour-end"><button class="act" type="button" data-tour-go="lesson">Start the first lesson</button><button class="act ghost" type="button" data-tour-go="pre">Take the placement test</button><button class="linkbtn" type="button" data-tour-go="look">Look around</button></div>`
      : `<div class="row tour-btns"><button class="linkbtn" type="button" data-tour="skip">Skip tour</button><span></span>${tourI ? '<button class="act ghost" type="button" data-tour="back">Back</button>' : ''}<button class="act" type="button" data-tour="next">${s.next || 'Next'}</button></div>`}`;
  tourPlace(vis ? el : null);
  ($('tour-card').querySelector('[data-tour="next"], [data-tour-go]') || $('tour-card')).focus({ preventScroll: true });
}
function tourPlace(el) {
  const hole = $('tour-hole'), card = $('tour-card'), W = innerWidth, H = innerHeight;
  if (!el) { hole.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`; card.style.cssText = `left:50%;top:50%;transform:translate(-50%,-50%)`; return; }
  el.scrollIntoView({ block: 'nearest' });
  const r = el.getBoundingClientRect(), pad = 6;
  hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const cw = Math.min(360, W - 24), below = r.bottom + 14 + 220 < H || r.top < H / 2, left = Math.max(12, Math.min(W - cw - 12, r.left + r.width / 2 - cw / 2));
  card.style.cssText = `left:${left}px;width:${cw}px;${below ? `top:${r.bottom + 14}px` : `bottom:${H - r.top + 14}px`};transform:none`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tour]'), g = e.target.closest('[data-tour-go]');
  if (b) { const a = b.dataset.tour; if (a === 'skip') return tourEnd(); tourI += a === 'next' ? 1 : -1; return tourShow(); }
  if (g) { const a = g.dataset.tourGo; tourEnd(); if (a === 'lesson') lnStart(LN_ALL[0].id, 1); else if (a === 'pre') lnPlacement(); return; }
  if (e.target.id === 'tour-cover' && tourI >= 0) e.preventDefault();
});
document.addEventListener('keydown', e => { if (tourI < 0) return; if (e.key === 'Escape') tourEnd(); else if (e.key === 'ArrowRight' && !TOUR[tourI].end) { tourI++; tourShow(); } else if (e.key === 'ArrowLeft' && tourI > 0) { tourI--; tourShow(); } });
addEventListener('resize', () => { if (tourI >= 0) tourShow(); });
$('set-tour').onclick = tourStart;
(() => { let seen = false; try { seen = !!localStorage.getItem(TOUR_KEY); } catch (e) {} if (!seen && !/[?&]test=1/.test(location.search)) setTimeout(tourStart, 700); })();
