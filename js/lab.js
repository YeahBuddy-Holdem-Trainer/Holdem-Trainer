/* ---------- Hand lab and How I play ----------
   Hand lab: set up a spot (villain seat, range, player type, open size, your seat, stack, your cards, an optional
   board) and see how your hand does against every hand in the range, grouped into Ahead / Coin flip /
   Behind but live / Dominated, with combo counts, your overall equity and what calling, 3-betting or shoving is worth.
   How I play: the app deals preflop spots and you choose an action with no right answers shown; it builds your own
   range for each spot, compares it with the charts and describes your style. */

/* hands from strongest to weakest by equity against a random hand (from the equity engine); used to widen or
   narrow a range for a player type */
const LB_ORDER = 'AA KK QQ JJ TT 99 88 77 AKs ATs AQs AJs AKo 66 KQs AQo ATo AJo A8s KJs KQo A9s A7s KTs KJo K9s A9o A5s A4s 55 QTs KTo QJs A8o QJo A6s A7o K8s A3s A5o A6o A2s QTo Q9s A4o K7s JTs K9o JTo A3o J9s K8o K5s K4s K6s 44 A2o Q8s Q9o Q8o K3s K7o Q7s K6o J8s K5o J7s T9s K2s 33 Q4s J9o K4o T8s J8o Q6s T9o Q5s T7s 22 K3o J6s Q6o Q2s Q7o Q3s K2o Q5o T8o 98s J7o J5s J4s T6s 97s Q4o J6o Q3o T7o 98o 87s J5o J3s J2s Q2o 96s T4s 97o T2s T3s 76s T5s J3o 87o J2o 86s 95s T6o J4o 85s 95o 96o T5o 86o T4o 94s 75s T2o 65s 84s T3o 92s 76o 74s 85o 93s 83s 54s 82s 64s 94o 75o 93o 74o 73s 53s 65o 92o 63s 84o 54o 62s 72s 43s 52s 83o 64o 73o 53o 42s 82o 63o 32s 52o 43o 72o 62o 42o 32o'.split(' ');
const LB_RANK = Object.fromEntries(LB_ORDER.map((l, i) => [l, i]));
/* player types: how much wider or tighter than the chart they play, and how much of their range continues
   against an all-in (estimates; see the Hand lab's ? for what they mean) */
const LB_TYPES = {
  reg: { name: 'Solid regular (as charted)', mult: 1, cont: .40 },
  nit: { name: 'Nit', mult: .6, cont: .30 },
  lag: { name: 'Loose aggressive', mult: 1.4, cont: .45 },
  rec: { name: 'Recreational', mult: 1.7, cont: .50 },
  station: { name: 'Calling station', mult: 1.9, cont: .65 },
  maniac: { name: 'Maniac', mult: 2.3, cont: .55 },
};
const LB_BUCKETS = [['ahead', 'Ahead', 'over 55%'], ['flip', 'Coin flip', '45–55%'], ['live', 'Behind but live', '33–45%'], ['dom', 'Dominated', 'under 33%']];
const lbBucket = e => e > .55 ? 'ahead' : e >= .45 ? 'flip' : e >= .33 ? 'live' : 'dom';
const lbCombos = l => combosOf(l);
const lbAll169 = () => { const a = []; for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) a.push(gridLabel(i, j)); return a; };

/* widen or narrow a range for a player type: keep its strongest hands, or add the next strongest ones */
function lbAdjust(labels, mult) {
  if (mult === 1) return labels.slice();
  const tot = labels.reduce((a, l) => a + lbCombos(l), 0), target = Math.min(1326, tot * mult), inR = new Set(labels);
  if (mult < 1) { const out = []; let n = 0; for (const l of labels.slice().sort((a, b) => LB_RANK[a] - LB_RANK[b])) { if (n >= target) break; out.push(l); n += lbCombos(l); } return out; }
  const out = labels.slice(); let n = tot; for (const l of LB_ORDER) { if (n >= target) break; if (!inR.has(l)) { out.push(l); n += lbCombos(l); } } return out;
}
/* the strongest part of a range, by share of combos */
function lbTop(labels, frac) { const tot = labels.reduce((a, l) => a + lbCombos(l), 0), out = []; let n = 0;
  for (const l of labels.slice().sort((a, b) => LB_RANK[a] - LB_RANK[b])) { if (n >= tot * frac) break; out.push(l); n += lbCombos(l); } return out; }

/* ---------- Hand lab ---------- */
const LB_SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
let lb = { cards: [null, null, null, null, null, null, null], active: 0, busy: false };
function lbAutoId(seat, stack) {
  const g = mode === 'cash' ? 'cash' : 'tour', has = id => SPOTS.some(s => s.id === id);
  if (g === 'cash') return `cash-${seat.toLowerCase()}-open`;
  const s = seat.toLowerCase();
  if (stack <= 12 && has(`tour-${s}-shove-10-bb`)) return `tour-${s}-shove-10-bb`;
  if (stack <= 17 && has(`tour-${s}-shove-15-bb`)) return `tour-${s}-shove-15-bb`;
  if (stack <= 30 && has(`tour-${s}-open-25-bb`)) return `tour-${s}-open-25-bb`;
  return `tour-${s}-open-40-bb`;
}
function lbSetup() {
  const vs = $('lb-vseat').value, hs = $('lb-hseat'), keep = hs.value, after = LB_SEATS.slice(LB_SEATS.indexOf(vs) + 1);
  hs.innerHTML = after.map(p => `<option value="${p}">${POSNAME[p]}</option>`).join('');
  hs.value = after.includes(keep) ? keep : after[after.length - 1];
  const g = mode === 'cash' ? 'cash' : 'tour', st = $('lb-stack'); if (!st.dataset.touched || st.dataset.game !== g) { st.value = g === 'cash' ? 100 : 40; st.dataset.game = g; }
  const sel = $('lb-range'), v = sel.value; sel.innerHTML = `<option value="auto">Auto: the chart for the villain's seat and stack</option>` + presetOptionsHTML().replace('<option value="">Choose a chart range…</option>', '') + '<option value="custom">Custom (type it below)</option>';
  sel.value = [...sel.options].some(o => o.value === v) ? v : 'auto'; $('lb-rtext').hidden = sel.value !== 'custom';
  /* match the open size to the chart's, and show when the villain is all in */
  const r = lbRange(), os = $('lb-open');
  if (r.spot && r.spot.o) { const best = [...os.options].reduce((a, o) => Math.abs(+o.value - r.spot.o) < Math.abs(+a.value - r.spot.o) ? o : a); os.value = best.value; }
  os.disabled = r.shove; os.title = r.shove ? 'The villain is all in' : '';
  lbSlots();
}
function lbRange() {
  const v = $('lb-range').value, vs = $('lb-vseat').value, S = +$('lb-stack').value || 100;
  let id = null, labels;
  if (v === 'auto') { id = lbAutoId(vs, S); const s = SPOTS.find(x => x.id === id); labels = s ? [...s.map].filter(([, a]) => a !== s.fold).map(([l]) => l) : []; }
  else if (v === 'custom') labels = [...parseRange($('lb-rtext').value)];
  else { labels = [...presetRange(v)]; id = v.split('|')[0]; }
  const spot = id && SPOTS.find(x => x.id === id), shove = !!(spot && /shove/.test(spot.id) && !/vs/.test(spot.id));
  return { labels, spot, shove, name: v === 'auto' ? (spot ? spot.name : 'No chart for that seat') : v === 'custom' ? 'Custom range' : $('lb-range').selectedOptions[0].textContent };
}
function lbSlots() {
  const lab = ['You', 'You', 'Flop', 'Flop', 'Flop', 'Turn', 'River'], used = new Set(lb.cards.filter(c => c != null));
  const slot = i => `<button type="button" class="slot ${i === lb.active ? 'active' : ''}" data-lbi="${i}" aria-label="${lab[i]} card ${lb.cards[i] == null ? 'empty' : R[lb.cards[i] >> 2] + S[lb.cards[i] & 3]}">${cardHTML(lb.cards[i], 'sm')}</button>`;
  $('lb-slots').innerHTML = `<div><span class="lbl muted">Your cards</span><div class="cards">${slot(0)}${slot(1)}</div></div><div><span class="lbl muted">Board (optional)</span><div class="cards">${[2, 3, 4, 5, 6].map(slot).join('')}</div></div>`;
  $('lb-grid').innerHTML = [0, 1, 2, 3].map(s => R.split('').reverse().map(r => { const c = R.indexOf(r) * 4 + s; return `<button type="button" data-lbc="${c}" class="${isRed(c) ? 'red' : ''}" ${used.has(c) ? 'disabled' : ''} aria-label="${r}${S[s]}">${rankTxt(R.indexOf(r))}${SYM[s]}</button>`; }).join('')).join('');
}
$('lb-slots').addEventListener('click', e => { const b = e.target.closest('[data-lbi]'); if (!b) return; const i = +b.dataset.lbi; if (lb.cards[i] != null) lb.cards[i] = null; lb.active = i; lbSlots(); });
$('lb-grid').addEventListener('click', e => { const b = e.target.closest('[data-lbc]'); if (!b || b.disabled || lb.active == null) return; lb.cards[lb.active] = +b.dataset.lbc;
  const nxt = [0, 1, 2, 3, 4, 5, 6].find(i => lb.cards[i] == null); lb.active = lb.active < 2 && lb.cards[0] != null && lb.cards[1] != null ? null : nxt ?? null; lbSlots(); });
$('lb-rand').onclick = () => { const d = shuffled().filter(c => !lb.cards.slice(2).includes(c)); lb.cards[0] = d[0]; lb.cards[1] = d[1]; lb.active = null; lbSlots(); };
$('lb-clrb').onclick = () => { for (let i = 2; i < 7; i++) lb.cards[i] = null; lb.active = 2; lbSlots(); };
['lb-vseat', 'lb-range'].forEach(id => $(id).addEventListener('change', lbSetup));
$('lb-stack').addEventListener('change', lbSetup);
$('lb-stack').addEventListener('input', e => { e.target.dataset.touched = '1'; });
$('lb-go').onclick = lbRun;

async function lbRun() {
  if (lb.busy) return;
  const hero = lb.cards.slice(0, 2), board = lb.cards.slice(2).filter(c => c != null), out = $('lb-out');
  if (hero.some(c => c == null)) { out.innerHTML = '<p class="small bad">Pick your two cards first (or tap Random hand).</p>'; return; }
  if (board.length && (board.length < 3 || lb.cards.slice(2, 2 + board.length).some(c => c == null))) { out.innerHTML = '<p class="small bad">A board needs at least the three flop cards, in order.</p>'; return; }
  const R0 = lbRange(), T = LB_TYPES[$('lb-type').value]; if (!R0.labels.length) { out.innerHTML = '<p class="small bad">That range is empty. Pick a chart range or type one in.</p>'; return; }
  const labels = lbAdjust(R0.labels, T.mult), dead = new Set([...hero, ...board]), vs = $('lb-vseat').value, hs = $('lb-hseat').value, Sk = Math.max(2, +$('lb-stack').value || 100);
  lb.busy = true; $('lb-go').disabled = true;
  const rows = [], N = board.length ? 1500 : 2500;
  for (let k = 0; k < labels.length; k++) {
    const l = labels[k], cs = labelCombos(l).filter(c => !dead.has(c[0]) && !dead.has(c[1]));
    if (cs.length) { const e = equityVsRange(hero, cs, board, N).eq; rows.push({ l, n: cs.length, raw: lbCombos(l), e, b: lbBucket(e) }); }
    if (k % 6 === 5) { out.innerHTML = `<p class="small muted">Working out every hand in the range… ${Math.round(k / labels.length * 100)}%</p>`; await new Promise(r => setTimeout(r, 0)); }
  }
  lb.busy = false; $('lb-go').disabled = false; setTimeout(() => out.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
  const live = rows.reduce((a, r) => a + r.n, 0), raw = labels.reduce((a, l) => a + lbCombos(l), 0), eq = rows.reduce((a, r) => a + r.e * r.n, 0) / (live || 1);
  const G = Object.fromEntries(LB_BUCKETS.map(([k]) => [k, rows.filter(r => r.b === k).sort((a, b) => b.e - a.e)]));
  /* pot and prices: blinds, ante (tournaments: big-blind ante of 1 BB), the villain's raise */
  const g = mode === 'cash' ? 'cash' : 'tour', ante = g === 'tour' ? 1 : 0, posted = p => p === 'SB' ? .5 : p === 'BB' ? 1 : 0;
  const O = R0.shove ? Sk : Math.min(Sk, +$('lb-open').value), P = 1.5 + ante + O - posted(vs), C = Math.min(O, Sk) - posted(hs), need = C / (P + C);
  const evCall = eq * (P + C) - C;
  /* all in: villain continues with the strongest part of the range */
  const cont = lbTop(labels, T.cont), contSet = new Set(cont), cRows = rows.filter(r => contSet.has(r.l)), cLive = cRows.reduce((a, r) => a + r.n, 0);
  const eqC = cRows.reduce((a, r) => a + r.e * r.n, 0) / (cLive || 1), f = 1 - cLive / (live || 1), A = Sk - posted(hs), potIfCalled = P + A + (Sk - O);
  const evShove = f * P + (1 - f) * (eqC * potIfCalled - A);
  const ip = LG_POST.indexOf(hs) > LG_POST.indexOf(vs), r3 = Math.min(Sk, O * (ip ? 3 : 4)), be3 = (r3 - posted(hs)) / (P + r3 - posted(hs));
  const bb = x => `${x >= 0 ? '+' : '−'}${fmtBB(Math.abs(Math.round(x * 10) / 10))} BB`;
  /* table picture */
  const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: p === 'SB' ? .5 : p === 'BB' ? 1 : 0, tag: '', stack: '' });
  seats[vs] = { state: 'vil', tag: T.name.split(' (')[0], bet: R0.shove ? 'All in' : fmtBB(O), stack: fmtBB(Sk - O) }; seats[hs] = { state: 'hero', tag: 'You', bet: posted(hs) || '', stack: fmtBB(Sk - posted(hs)) };
  const pic = tableSnap({ hero: hs, seats, heroCards: hero, center: `${board.length ? `<div class="cards">${cardsHTML(board, 'xs')}</div>` : ''}<b>${fmtBB(P)} BB</b><span>pot</span>` });
  const grid = (() => { const m = Object.fromEntries(rows.map(r => [r.l, r.b])); let h = '';
    for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) { const l = gridLabel(i, j); h += `<span class="${m[l] ? 'lb-' + m[l] : labels.includes(l) ? 'lb-blocked' : ''}" title="${l}">${l}</span>`; }
    return `<div class="rgrid eq-grid lb-grid" role="img" aria-label="Villain's range coloured by how your hand does">${h}</div>`; })();
  out.innerHTML = `
    <div class="qz-visual">${pic}</div>
    <div class="lb-sum"><div><span class="lbl muted">Your equity</span><b class="lb-big">${pct(eq)}</b></div><div><span class="lbl muted">Against</span><b>${esc(R0.name)}</b><span class="small">${T.mult === 1 ? '' : `adjusted for a ${T.name.toLowerCase()}: `}${raw} combos (${pct(raw / 1326, 0)} of hands), ${live} live after your cards${board.length ? ' and the board' : ''}</span></div></div>
    <table class="ref lb-table"><thead><tr><th>Where you stand</th><th>Combos</th><th>Share</th><th>Your equity</th></tr></thead><tbody>
    ${LB_BUCKETS.map(([k, name, rng]) => { const xs = G[k], n = xs.reduce((a, r) => a + r.n, 0), e = n ? xs.reduce((a, r) => a + r.e * r.n, 0) / n : 0;
      return `<tr class="lb-row-${k}"><td class="t"><i class="lb-dot lb-${k}"></i>${name} <span class="small muted">${rng}</span></td><td>${n}</td><td>${live ? pct(n / live, 0) : '–'}</td><td>${n ? pct(e, 0) : '–'}</td></tr>
        <tr class="lb-hands"><td colspan="4">${xs.length ? xs.map(r => `<span class="lb-h">${r.l} <b>${r.n}</b>${r.n < r.raw ? `<s>${r.raw}</s>` : ''} · ${Math.round(r.e * 100)}%</span>`).join('') : '<span class="small muted">None</span>'}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="small muted">Each hand shows its live combos (crossed-out number: combos before your cards${board.length ? ' and the board' : ''} removed some) and your equity against it. Overall equity = the combo-weighted average: ${LB_BUCKETS.map(([k]) => { const n = G[k].reduce((a, r) => a + r.n, 0), e = n ? G[k].reduce((a, r) => a + r.e * r.n, 0) / n : 0; return n ? `${pct(n / live, 0)} × ${Math.round(e * 100)}` : ''; }).filter(Boolean).join(' + ')} ≈ ${Math.round(eq * 100)}%.</p>
    ${grid}<p class="small lb-legend">${LB_BUCKETS.map(([k, n]) => `<span><i class="lb-dot lb-${k}"></i>${n}</span>`).join('')}<span><i class="lb-dot lb-blocked"></i>Blocked by your cards</span></p>
    ${board.length ? '<p class="small muted">The decision math below is for preflop spots; clear the board to see it.</p>' : `
    <h3 class="lb-h3">What it's worth</h3>
    <dl class="lb-ev">
      <dt>Calling</dt><dd>${R0.shove ? 'Villain is all in. ' : ''}You call <b>${fmtBB(C)} BB</b> to win <b>${fmtBB(P)} BB</b>, so you need <b>${pct(need)}</b> equity. You have ${pct(eq)}: <b class="${eq >= need ? 'good' : 'bad'}">${eq >= need ? 'enough' : 'not enough'}</b>. Showdown value: <b>${bb(evCall)}</b> compared with folding.${R0.shove ? '' : ' Before an all-in, real play adds more betting: being in position and having a hand that makes strong draws help; being out of position or dominated hurts.'}</dd>
      ${R0.shove ? '' : `<dt>3-bet to ${fmtBB(r3)} BB</dt><dd>As a pure bluff it needs villain to fold <b>${pct(be3, 0)}</b> of the time. ${ip ? 'In position' : 'Out of position'} the usual size is ${ip ? '3' : '4'}× the open.</dd>
      <dt>All in for ${fmtBB(Sk)} BB</dt><dd>A ${T.name.toLowerCase()} calls with about the top <b>${Math.round(T.cont * 100)}%</b> of this range (${cLive} combos), so they fold <b>${pct(f, 0)}</b>. Against the calling hands you have <b>${pct(eqC)}</b>. Value: <b class="${evShove >= 0 ? 'good' : 'bad'}">${bb(evShove)}</b>${Sk > 40 ? '. Deep stacks make shoving risky: you only get called by the hands that beat you most.' : '.'}</dd>`}
    </dl>`}`;
}

/* ---------- How I play ---------- */
const HP_KEY = 'holdem-howiplay-v1';
const HP_ACTS = { fold: 'Fold', limp: 'Limp (call 1 BB)', call: 'Call', r2: 'Raise 2×', r25: 'Raise 2.5×', r3: 'Raise 3×', '3b3': '3-bet 3×', '3b4': '3-bet 4×', '4b': '4-bet', allin: 'All in' };
const HP_AGG = new Set(['r2', 'r25', 'r3', '3b3', '3b4', '4b', 'allin']);
let hp = (() => { try { return JSON.parse(localStorage.getItem(HP_KEY)) || {}; } catch (e) { return {}; } })();
hp = { s: {}, n: 0, show: false, kind: 'all', ...hp };
const hpSave = () => { try { localStorage.setItem(HP_KEY, JSON.stringify(hp)); } catch (e) {} };
const hpKind = s => /shove/.test(s.id) ? 'short' : /3-bet$/.test(s.id) ? 'vs3b' : /-vs-/.test(s.id) ? 'facing' : 'open';
const HP_KINDS = { all: 'Everything', open: 'Opening (first in)', facing: 'Facing a raise', vs3b: 'Facing a 3-bet', short: 'Short stack' };
function hpActs(s) {
  const k = hpKind(s);
  if (k === 'open') return ['fold', 'limp', 'r2', 'r25', 'r3', 'allin'];
  if (k === 'facing') return s.acts.includes('Call') ? ['fold', 'call', '3b3', '3b4', 'allin'] : ['fold', 'call', '3b3', '3b4', 'allin'];
  if (k === 'vs3b') return ['fold', 'call', '4b', 'allin'];
  if (/-vs-.*-shove/.test(s.id)) return ['fold', 'call'];
  if (/re-shove/.test(s.id)) return ['fold', 'call', '3b3', 'allin'];
  return ['fold', 'r2', 'allin'];
}
/* chart answer as a category: fold, passive (call) or aggressive (raise, 3-bet, shove) */
const hpChartCat = (s, l) => { const a = s.acts[s.map.get(l) ?? s.fold]; return a === 'Fold' ? 'fold' : a === 'Call' ? 'pass' : 'agg'; };
const hpCat = code => code === 'fold' ? 'fold' : HP_AGG.has(code) ? 'agg' : 'pass';
const hpSpots = () => SPOTS.filter(s => s.game === (mode === 'cash' ? 'cash' : 'tour') && (hp.kind === 'all' || hpKind(s) === hp.kind));
let hpCur = null;
function hpDeal() {
  const pool = hpSpots(); if (!pool.length) { hp.kind = 'all'; return hpDeal(); }
  const s = pick(pool), rec = hp.s[s.id] || {}, all = lbAll169(), cnt = l => Object.values(rec[l] || {}).reduce((a, b) => a + b, 0), lo = Math.min(...all.map(cnt));
  const label = pick(all.filter(l => cnt(l) === lo)), cards = comboFor(label); if (cards[0] >> 2 < cards[1] >> 2) cards.reverse();
  hpCur = { s, label, cards, t0: Date.now(), last: null }; hpShow();
}
function hpShow() {
  const c = hpCur, s = c.s, cov = Object.keys(hp.s[s.id] || {}).length;
  if (!$('hp-kind').children.length) $('hp-kind').innerHTML = Object.entries(HP_KINDS).filter(([k]) => k === 'all' || SPOTS.some(x => x.game === (mode === 'cash' ? 'cash' : 'tour') && hpKind(x) === k)).map(([k, t]) => `<button type="button" data-k="${k}">${t}</button>`).join('');
  $('hp-kind').querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === hp.kind));
  $('hp-show').checked = !!hp.show;
  $('hp-table').innerHTML = tableSnap({ ...spotTable(s), heroCards: c.cards });
  $('hp-text').innerHTML = `<b>${s.name}.</b> ${spotText(s)}`;
  $('hp-acts').innerHTML = hpActs(s).map(k => `<button type="button" class="act${k === 'fold' ? ' ghost' : ''}" data-hp="${k}">${HP_ACTS[k]}</button>`).join('');
  $('hp-meta').textContent = `${hp.n} hands answered · this spot: ${cov} of 169 starting hands covered`;
  $('hp-fb').innerHTML = c.last || '';
}
$('hp-acts').addEventListener('click', e => {
  const b = e.target.closest('[data-hp]'); if (!b || !hpCur) return; const code = b.dataset.hp, c = hpCur, s = c.s;
  const r = hp.s[s.id] = hp.s[s.id] || {}, x = r[c.label] = r[c.label] || {}; x[code] = (x[code] || 0) + 1; hp.n++; hp.last = Date.now(); hpSave();
  const prev = hp.show ? (() => { const ch = s.acts[s.map.get(c.label) ?? s.fold], ok = hpChartCat(s, c.label) === hpCat(code);
    return `<p class="small hp-prev ${ok ? 'good' : 'bad'}">Last hand: ${c.label}, you chose <b>${HP_ACTS[code]}</b>; the chart says <b>${ch}</b>.</p>`; })() : `<p class="small muted hp-prev">Last hand: ${c.label} → ${HP_ACTS[code]}</p>`;
  hpDeal(); hpCur.last = prev; $('hp-fb').innerHTML = prev;
});
$('hp-kind').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; hp.kind = b.dataset.k; hpSave(); hpDeal(); });
$('hp-show').onchange = e => { hp.show = e.target.checked; hpSave(); };
$('hp-tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; hpTab(b.dataset.t); });
function hpTab(t) { $('hp-tabs').querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t)); $('hp-play').hidden = t !== 'play'; $('hp-res').hidden = t !== 'res'; if (t === 'res') hpResults(); }

/* your most common choice for each hand in a spot */
const hpMain = rec => Object.fromEntries(Object.entries(rec).map(([l, x]) => [l, Object.entries(x).sort((a, b) => b[1] - a[1])[0][0]]));
function hpCompare(s) {
  const main = hpMain(hp.s[s.id] || {}), loose = [], tight = [], style = [];
  for (const [l, code] of Object.entries(main)) { const u = hpCat(code), c = hpChartCat(s, l);
    if (u !== 'fold' && c === 'fold') loose.push(l); else if (u === 'fold' && c !== 'fold') tight.push(l); else if (u !== c) style.push([l, code, s.acts[s.map.get(l) ?? s.fold]]); }
  const w = xs => xs.reduce((a, l) => a + lbCombos(Array.isArray(l) ? l[0] : l), 0);
  return { main, loose, tight, style, n: Object.keys(main).length, wLoose: w(loose), wTight: w(tight), wStyle: w(style) };
}
function hpStyle() {
  /* opening spots: how much you play compared with the chart, and how often you raise what you play */
  let up = 0, cp = 0, agg = 0, pas = 0, fN = 0, fCont = 0, fChart = 0, f3 = 0, c3 = 0, n = 0;
  for (const s of SPOTS) { const rec = hp.s[s.id]; if (!rec) continue; const k = hpKind(s), main = hpMain(rec);
    for (const [l, code] of Object.entries(main)) { const w = lbCombos(l), u = hpCat(code), c = hpChartCat(s, l); n++;
      if (k === 'open' || k === 'short' && !/-vs-/.test(s.id)) { if (u !== 'fold') { up += w; u === 'agg' ? agg += w : pas += w; } if (c !== 'fold') cp += w; }
      if (k === 'facing') { fN += w; if (u !== 'fold') fCont += w; if (c !== 'fold') fChart += w; if (u === 'agg') f3 += w; if (c === 'agg') c3 += w; } } }
  if (n < 30) return null;
  const ratio = cp ? up / cp : 1, ag = up ? agg / up : 0;
  const [type, icon, line] = ratio < .75 ? (ag >= .5 ? ['Nit', '🪨', 'You play fewer hands than the charts and mostly raise them. Solid, but you are leaving profitable opens on the table.'] : ['Rock', '🧱', 'Tight and passive: few hands, and you often just call. Raise more of what you play.'])
    : ratio <= 1.25 ? (ag >= .6 ? ['Tight-aggressive (TAG)', '🎯', 'Close to the charts and raising what you play. This is the winning baseline.'] : ['Solid but passive', '🛡', 'About the right hands, but you limp or call where the charts raise. Raising wins the blinds and builds pots with your edge.'])
    : ratio > 1.6 && ag < .4 ? ['Calling station', '📞', 'You play far too many hands and mostly call. Tighten up first, then raise more.']
    : ag >= .6 ? ['Loose-aggressive (LAG)', '🔥', 'You play more hands than the charts and raise them. Profitable for strong post-flop players; costly otherwise.'] : ['Loose-passive (recreational)', '🐟', 'Many hands, often limped or called. The most common leak: tighten up and raise instead of calling.'];
  return { type, icon, line, ratio, ag, up, cp, fCont: fN ? fCont / fN : null, fChart: fN ? fChart / fN : null, f3: fN ? f3 / fN : null, c3: fN ? c3 / fN : null, n };
}
function hpResults() {
  const box = $('hp-res-body'), st = hpStyle(), sel0 = $('hp-spot') ? $('hp-spot').value : '', spots = SPOTS.filter(s => hp.s[s.id]).sort((a, b) => Object.keys(hp.s[b.id]).length - Object.keys(hp.s[a.id]).length);
  if (!spots.length) { box.innerHTML = '<p class="small muted">Play some hands first. Every answer builds your own range for that spot.</p>'; return; }
  const cur = spots.find(s => s.id === sel0) || spots[0];
  const all = spots.map(s => ({ s, c: hpCompare(s) })), leaks = all.flatMap(({ s, c }) => [c.wLoose ? { s, kind: 'loose', w: c.wLoose, ls: c.loose } : null, c.wTight ? { s, kind: 'tight', w: c.wTight, ls: c.tight } : null, c.wStyle ? { s, kind: 'style', w: c.wStyle, ls: c.style.map(x => x[0]) } : null].filter(Boolean)).sort((a, b) => b.w - a.w).slice(0, 5);
  const C = hpCompare(cur), grid = (() => { let h = ''; for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) { const l = gridLabel(i, j), code = C.main[l], cls = code ? 'hp-' + hpCat(code) + (code === 'limp' ? ' hp-limp' : code === 'allin' ? ' hp-allin' : '') : '';
    const diff = code ? (C.loose.includes(l) ? ' hp-loose' : C.tight.includes(l) ? ' hp-tight' : C.style.some(x => x[0] === l) ? ' hp-diff' : '') : ''; h += `<span class="${cls}${diff}" title="${l}${code ? ': ' + HP_ACTS[code] + ' (chart: ' + cur.acts[cur.map.get(l) ?? cur.fold] + ')' : ''}">${l}</span>`; }
    return `<div class="rgrid eq-grid hp-grid">${h}</div>`; })();
  const pc = x => x == null ? '–' : pct(x, 0);
  box.innerHTML = `
    ${st ? `<section class="hp-style"><div class="hp-ico" aria-hidden="true">${st.icon}</div><div><span class="eyebrow">Your style so far</span><h3>${st.type}</h3><p class="small">${st.line}</p>
      <p class="small">First in, you play <b>${st.ratio.toFixed(2)}×</b> as many hands as the charts (counting the hands you've answered), and raise <b>${pc(st.ag)}</b> of what you play.${st.fCont != null ? ` Facing a raise: you continue with <b>${pc(st.fCont)}</b> (charts ${pc(st.fChart)}) and 3-bet <b>${pc(st.f3)}</b> (charts ${pc(st.c3)}).` : ''}</p></div></section>`
      : `<p class="small muted">Answer at least 30 hands to see your style.</p>`}
    ${leaks.length ? `<h3 class="lb-h3">Biggest differences from the charts</h3><ol class="hp-leaks">${leaks.map(x => `<li><b>${x.s.name}</b>: ${x.kind === 'loose' ? 'playing hands the chart folds' : x.kind === 'tight' ? 'folding hands the chart plays' : 'a different action than the chart'} (${x.w} combos): <span class="small">${x.ls.slice(0, 10).join(', ')}${x.ls.length > 10 ? '…' : ''}</span></li>`).join('')}</ol>` : ''}
    <h3 class="lb-h3">Your range for one spot</h3>
    <label class="hp-pick"><span class="small muted">Spot</span><select id="hp-spot">${spots.map(s => `<option value="${s.id}"${s.id === cur.id ? ' selected' : ''}>${esc(s.name)} (${Object.keys(hp.s[s.id]).length}/169)</option>`).join('')}</select></label>
    ${grid}
    <p class="small hp-legend"><span><i class="hp-sw hp-agg"></i>Raise / 3-bet</span><span><i class="hp-sw hp-allin"></i>All in</span><span><i class="hp-sw hp-pass"></i>Call</span><span><i class="hp-sw hp-limp"></i>Limp</span><span><i class="hp-sw hp-fold"></i>Fold</span><span><i class="hp-sw hp-loose"></i>Chart folds</span><span><i class="hp-sw hp-tight"></i>Chart plays</span><span><i class="hp-sw hp-diff"></i>Chart acts differently</span></p>
    <ul class="small hp-list">
      <li><b>Looser than the chart</b> (${C.wLoose} combos): ${C.loose.length ? C.loose.sort((a, b) => LB_RANK[a] - LB_RANK[b]).join(', ') : 'none'}</li>
      <li><b>Tighter than the chart</b> (${C.wTight} combos): ${C.tight.length ? C.tight.sort((a, b) => LB_RANK[a] - LB_RANK[b]).join(', ') : 'none'}</li>
      <li><b>Different action</b> (${C.wStyle} combos): ${C.style.length ? C.style.map(([l, code, ch]) => `${l} (you ${HP_ACTS[code].toLowerCase()}, chart ${ch.toLowerCase()})`).join(', ') : 'none'}</li>
    </ul>
    <p class="small muted">${C.n} of 169 hands answered here; blank cells haven't come up yet. Keep playing this spot to fill the grid.</p>
    <div class="row"><button class="linkbtn" type="button" id="hp-reset">Reset all my answers</button></div>`;
  $('hp-spot').onchange = hpResults;
  $('hp-reset').onclick = e => { if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'Tap again to erase every answer'; return; } hp = { s: {}, n: 0, show: hp.show, kind: hp.kind }; hpSave(); hpResults(); hpDeal(); };
}
function lbInit() { if (!$('lb-type').options.length) $('lb-type').innerHTML = Object.entries(LB_TYPES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join(''); lbSetup(); }
function hpInit() { if (!hpCur || hpCur.s.game !== (mode === 'cash' ? 'cash' : 'tour')) hpDeal(); else hpShow(); }
