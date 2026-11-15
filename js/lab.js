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

/* ---------- Hand lab ----------
   Layout: settings (collapsed), the villain's range as a grid you can tap to edit, your cards and board, then results.
   Up to four opponents: the first opens, the others call. 6- or 9-handed seats. Heads-up results group each hand of the
   range by your equity against it; multiway results come from a simulation dealing every opponent a hand from their range. */
const LB_SEAT6 = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'], LB_SEAT9 = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
/* 9-handed early seats have no chart of their own: they use the UTG chart, tightened (an estimate) */
const LB_NINE = { UTG: ['UTG', .7], 'UTG+1': ['UTG', .8], 'UTG+2': ['UTG', .9], LJ: ['UTG', 1] };
const LB_POSTFLOP = s => ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'].indexOf(s);
let lb = { cards: [null, null, null, null, null, null, null], active: 0, size: 6, stack: null, open: 2.5, hero: 'BTN', opps: [{ seat: 'CO', range: 'auto', text: '', type: 'reg', edit: null }], view: 0, cache: {}, timer: 0, run: 0 };
const lbSeats = () => lb.size === 9 ? LB_SEAT9 : LB_SEAT6;
const lbGame = () => mode === 'cash' ? 'cash' : 'tour';
function lbChartLabels(id) { const s = SPOTS.find(x => x.id === id); return s ? [...s.map].filter(([, a]) => a !== s.fold).map(([l]) => l) : []; }
function lbAutoId(seat, stack) {
  const g = lbGame(), s = (LB_NINE[seat] ? LB_NINE[seat][0] : seat).toLowerCase(), has = id => SPOTS.some(x => x.id === id);
  if (g === 'cash') return `cash-${s}-open`;
  if (stack <= 12 && has(`tour-${s}-shove-10-bb`)) return `tour-${s}-shove-10-bb`;
  if (stack <= 17 && has(`tour-${s}-shove-15-bb`)) return `tour-${s}-shove-15-bb`;
  if (stack <= 30 && has(`tour-${s}-open-25-bb`)) return `tour-${s}-open-25-bb`;
  return has(`tour-${s}-open-40-bb`) ? `tour-${s}-open-40-bb` : `tour-utg-open-40-bb`;
}
/* one opponent's range: its base (chart, preset or typed) adjusted for type, or the version you edited on the grid */
function lbOppRange(o, k) {
  const S = lbStack(); let base, name, spot = null, shove = false;
  if (o.range === 'auto') {
    const id = lbAutoId(o.seat, S); spot = SPOTS.find(x => x.id === id); base = lbChartLabels(id);
    if (LB_NINE[o.seat] && LB_NINE[o.seat][1] < 1) base = lbAdjust(base, LB_NINE[o.seat][1]);
    shove = !!(spot && /shove/.test(spot.id) && !/vs/.test(spot.id));
    let how = '';
    if (k > 0) {
      /* a caller: the chart's calling range against this raiser if there is one, else the seat's open range minus the
         hands that would 3-bet (its strongest fifth) */
      const g = lbGame(), me = (LB_NINE[o.seat] ? LB_NINE[o.seat][0] : o.seat).toLowerCase(), rs = (LB_NINE[lb.opps[0].seat] ? 'utg' : lb.opps[0].seat.toLowerCase());
      const vs = SPOTS.filter(x => x.game === g && x.id.startsWith(`${g}-${me}-vs-`) && /open/.test(x.id) && x.acts.includes('Call')), cs = vs.find(x => x.id.includes(`-vs-${rs}-`)) || (me === 'bb' || me === 'sb' ? vs.find(x => /-vs-btn-/.test(x.id)) || vs[0] : null);
      if (cs) { spot = cs; base = [...cs.map].filter(([, a]) => cs.acts[a] === 'Call').map(([l]) => l); how = cs.id.includes(`-vs-${rs}-`) ? `${cs.name}, calls` : `${cs.name} calls, closest chart`; }
      else { const top = new Set(lbTop(base, .2)); base = base.filter(l => !top.has(l)); how = `${spot ? spot.name : 'chart'}, minus 3-bet hands`; }
    }
    name = k ? `${o.seat} calls (${how})` : `${o.seat} ${shove ? 'shoves' : 'opens'} (${LB_NINE[o.seat] && LB_NINE[o.seat][1] < 1 ? 'UTG chart, tightened' : spot ? spot.name : 'chart'})`;
  } else if (o.range === 'custom') { base = [...parseRange(o.text)]; name = 'Custom range'; }
  else { base = [...presetRange(o.range)]; spot = SPOTS.find(x => x.id === o.range.split('|')[0]); name = (document.querySelector(`#lb-r${k} option[value="${o.range}"]`) || {}).textContent || 'Chart range'; }
  const T = LB_TYPES[o.type] || LB_TYPES.reg;
  const labels = o.edit ? o.edit.slice() : lbAdjust(base, T.mult);
  return { labels, spot, shove: k === 0 && shove, name: o.edit ? 'Your edited range' : name, T, base };
}
const lbStack = () => Math.max(2, lb.stack ?? (lbGame() === 'cash' ? 100 : 40));
function lbSummary() {
  const o0 = lb.opps[0], T = LB_TYPES[o0.type];
  return `${o0.seat} ${lbOppRange(o0, 0).shove ? 'shoves' : `opens ${fmtBB(lb.open)}×`} · ${T.name.split(' (')[0].toLowerCase()}${lb.opps.length > 1 ? ` · +${lb.opps.length - 1} caller${lb.opps.length > 2 ? 's' : ''}` : ''} · you: ${lb.hero} · ${fmtBB(lbStack())} BB · ${lb.size}-handed`;
}
function lbForm() {
  const seats = lbSeats(), rangeOpts = presetOptionsHTML().replace('<option value="">Choose a chart range…</option>', '');
  const used = lb.opps.map(o => o.seat), heroOK = s => !used.includes(s) && seats.indexOf(s) > seats.indexOf(lb.opps[0].seat);
  if (!heroOK(lb.hero)) lb.hero = seats.filter(heroOK).pop() || 'BB';
  $('lb-set-sum').textContent = lbSummary();
  $('lb-size').querySelectorAll('[data-n]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === lb.size));
  $('lb-stack').value = lbStack(); $('lb-open').value = lb.open; $('lb-open').disabled = lbOppRange(lb.opps[0], 0).shove;
  $('lb-hseat').innerHTML = seats.filter(heroOK).map(p => `<option value="${p}"${p === lb.hero ? ' selected' : ''}>${p}</option>`).join('');
  $('lb-opps').innerHTML = lb.opps.map((o, k) => `<div class="lb-opp" data-k="${k}"><span class="lb-role">${k ? 'Caller ' + k : 'Raiser'}</span>
    <label><span class="lbl">Seat</span><select data-f="seat">${seats.filter(p => p !== 'BB' || k).map(p => `<option${p === o.seat ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
    <label><span class="lbl">Player type</span><select data-f="type">${Object.entries(LB_TYPES).map(([v, t]) => `<option value="${v}"${v === o.type ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label>
    <label class="lb-wide"><span class="lbl">Range</span><select data-f="range" id="lb-r${k}"><option value="auto">Auto: chart for the seat${k ? ' (calling)' : ''}</option>${rangeOpts}<option value="custom">Custom (type it)</option></select></label>
    ${o.range === 'custom' ? `<input type="text" class="lb-rtext" data-f="text" value="${esc(o.text)}" placeholder="e.g. 66+, A8s+, KTs+, KJo+" aria-label="Custom range">` : ''}
    ${k ? '<button type="button" class="linkbtn" data-f="del">Remove</button>' : ''}</div>`).join('');
  lb.opps.forEach((o, k) => { const s = $('lb-r' + k); s.value = [...s.options].some(x => x.value === o.range) ? o.range : 'auto'; });
  $('lb-add').hidden = lb.opps.length >= 4;
}
function lbSlots() {
  const lab = ['You', 'You', 'Flop', 'Flop', 'Flop', 'Turn', 'River'], used = new Set(lb.cards.filter(c => c != null));
  const slot = i => `<button type="button" class="slot ${i === lb.active ? 'active' : ''}" data-lbi="${i}" aria-label="${lab[i]} card ${lb.cards[i] == null ? 'empty' : R[lb.cards[i] >> 2] + S[lb.cards[i] & 3]}">${cardHTML(lb.cards[i], 'sm')}</button>`;
  $('lb-slots').innerHTML = `<div><span class="lbl muted">Your cards</span><div class="cards">${slot(0)}${slot(1)}</div></div><div><span class="lbl muted">Board (optional)</span><div class="cards">${[2, 3, 4, 5, 6].map(slot).join('')}</div></div>`;
  $('lb-grid').hidden = lb.active == null;
  $('lb-grid').innerHTML = [0, 1, 2, 3].map(s => R.split('').reverse().map(r => { const c = R.indexOf(r) * 4 + s; return `<button type="button" data-lbc="${c}" class="${isRed(c) ? 'red' : ''}" ${used.has(c) ? 'disabled' : ''} aria-label="${r}${S[s]}">${rankTxt(R.indexOf(r))}${SYM[s]}</button>`; }).join('')).join('');
}
/* ---- equity, cached per hand so editing the range only adds the new hands ---- */
function lbEq(hero, board, l) {
  if (Object.keys(lb.cache).length > 6000) lb.cache = {};
  const key = hero.join(',') + '|' + board.join(',') + '|' + l; if (key in lb.cache) return lb.cache[key];
  const dead = new Set([...hero, ...board]), cs = labelCombos(l).filter(c => !dead.has(c[0]) && !dead.has(c[1]));
  return lb.cache[key] = cs.length ? { n: cs.length, e: equityVsRange(hero, cs, board, board.length ? 1500 : 2500).eq } : { n: 0, e: 0 };
}
/* hero against several ranges at once: deal each opponent a hand from their range, run out the board */
function lbMulti(hero, board, ranges, N = 12000) {
  const dead0 = new Set([...hero, ...board]), pools = ranges.map(ls => ls.flatMap(labelCombos).filter(c => !dead0.has(c[0]) && !dead0.has(c[1])));
  if (pools.some(p => !p.length)) return null;
  let share = 0, win = 0, tie = 0, n = 0;
  for (let it = 0; it < N; it++) {
    const used = new Set(dead0), hands = []; let ok = true;
    for (const p of pools) { let h, t = 0; do { h = p[(Math.random() * p.length) | 0]; } while ((used.has(h[0]) || used.has(h[1])) && ++t < 30); if (t >= 30) { ok = false; break; } used.add(h[0]); used.add(h[1]); hands.push(h); }
    if (!ok) continue;
    const b = board.slice(); while (b.length < 5) { const c = (Math.random() * 52) | 0; if (!used.has(c)) { used.add(c); b.push(c); } }
    const hv = evalHand(hero.concat(b)); let best = hv, cnt = 1, heroBest = true;
    for (const h of hands) { const v = evalHand(h.concat(b)); if (v > best) { best = v; cnt = 1; heroBest = false; } else if (v === best) cnt++; }
    n++; if (heroBest) { share += 1 / cnt; if (cnt === 1) win++; else tie++; }
  }
  return n ? { eq: share / n, win: win / n, tie: tie / n, n } : null;
}
function lbQueue(ms = 250) { clearTimeout(lb.timer); lb.timer = setTimeout(lbRun, ms); }
function lbRangeGrid(R1, hero, board) {
  const inR = new Set(R1.labels), rows = {};
  if (hero.every(c => c != null)) for (const l of R1.labels) { const x = lbEq(hero, board, l); if (x.n) rows[l] = lbBucket(x.e); }
  let h = '';
  for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) { const l = gridLabel(i, j), cls = inR.has(l) ? (rows[l] ? 'lb-' + rows[l] : hero.every(c => c != null) ? 'lb-blocked' : 'a0') : '';
    h += `<button type="button" class="${cls}" data-lbl="${l}" aria-pressed="${inR.has(l)}" title="${l}${inR.has(l) ? ' (in range: tap to remove)' : ' (tap to add)'}">${l}</button>`; }
  const n = R1.labels.reduce((a, l) => a + lbCombos(l), 0);
  $('lb-rgrid').innerHTML = h;
  $('lb-rinfo').innerHTML = `<b>${esc(R1.name)}</b> · ${n} combos (${pct(n / 1326, 0)} of hands)${R1.T.mult !== 1 && !lb.opps[lb.view].edit ? ` · ${R1.T.name.toLowerCase()} adjustment` : ''}`;
  $('lb-reset').hidden = !lb.opps[lb.view].edit;
  $('lb-otabs').innerHTML = lb.opps.length > 1 ? lb.opps.map((o, k) => `<button type="button" data-v="${k}" aria-pressed="${k === lb.view}">${k ? 'Caller ' + k : 'Raiser'} · ${o.seat}</button>`).join('') : '';
  $('lb-otabs').hidden = lb.opps.length < 2;
}
async function lbRun() {
  const run = ++lb.run, hero = lb.cards.slice(0, 2), board = lb.cards.slice(2).filter(c => c != null), out = $('lb-out');
  if (lb.view >= lb.opps.length) lb.view = 0;
  const RS = lb.opps.map((o, k) => lbOppRange(o, k)), R1 = RS[lb.view];
  lbForm();
  if (hero.some(c => c == null)) { lbRangeGrid(R1, hero, board); out.innerHTML = '<p class="small muted">Pick your two cards (or tap Random hand) to see how they do against this range.</p>'; return; }
  if (board.length && (board.length < 3 || lb.cards.slice(2, 2 + board.length).some(c => c == null))) { lbRangeGrid(R1, [null, null], []); out.innerHTML = '<p class="small bad">A board needs at least the three flop cards, in order.</p>'; return; }
  if (RS.some(r => !r.labels.length)) { lbRangeGrid(R1, hero, board); out.innerHTML = '<p class="small bad">A range is empty. Pick a chart range, type one, or tap hands on the grid.</p>'; return; }
  /* work out every hand (cached), a few at a time so the page stays responsive */
  const todo = [...new Set(RS.flatMap(r => r.labels))].filter(l => !((hero.join(',') + '|' + board.join(',') + '|' + l) in lb.cache));
  for (let k = 0; k < todo.length; k++) { lbEq(hero, board, todo[k]); if (k % 6 === 5) { out.innerHTML = `<p class="small muted">Working out every hand… ${Math.round(k / todo.length * 100)}%</p>`; await new Promise(r => setTimeout(r, 0)); if (run !== lb.run) return; } }
  lbRangeGrid(R1, hero, board);
  const per = RS.map(R => { const rows = R.labels.map(l => ({ l, raw: lbCombos(l), ...lbEq(hero, board, l) })).filter(r => r.n).map(r => ({ ...r, b: lbBucket(r.e) }));
    const live = rows.reduce((a, r) => a + r.n, 0), eq = rows.reduce((a, r) => a + r.e * r.n, 0) / (live || 1); return { R, rows, live, eq, raw: R.labels.reduce((a, l) => a + lbCombos(l), 0) }; });
  const multi = RS.length > 1 ? lbMulti(hero, board, RS.map(r => r.labels)) : null;
  if (run !== lb.run) return;
  const eqAll = multi ? multi.eq : per[0].eq, n = RS.length;
  /* pot: blinds, ante (tournaments: 1 BB big-blind ante), the open, and each caller */
  const ante = lbGame() === 'tour' ? 1 : 0, posted = p => p === 'SB' ? .5 : p === 'BB' ? 1 : 0, Sk = lbStack(), shove = RS[0].shove;
  const O = shove ? Sk : Math.min(Sk, lb.open), P = 1.5 + ante + O * n - lb.opps.reduce((a, o) => a + posted(o.seat), 0), C = O - posted(lb.hero), need = C / (P + C), evCall = eqAll * (P + C) - C;
  const bb = x => `${x >= 0 ? '+' : '−'}${fmtBB(Math.abs(Math.round(x * 10) / 10))} BB`;
  const table = (x, k) => { const G = Object.fromEntries(LB_BUCKETS.map(([b]) => [b, x.rows.filter(r => r.b === b).sort((a, z) => z.e - a.e)]));
    return `<table class="ref lb-table"><thead><tr><th>Where you stand</th><th>Combos</th><th>Share</th><th>Your equity</th></tr></thead><tbody>
    ${LB_BUCKETS.map(([b, name, rng]) => { const xs = G[b], m = xs.reduce((a, r) => a + r.n, 0), e = m ? xs.reduce((a, r) => a + r.e * r.n, 0) / m : 0;
      return `<tr><td class="t"><i class="lb-dot lb-${b}"></i>${name} <span class="small muted">${rng}</span></td><td>${m}</td><td>${x.live ? pct(m / x.live, 0) : '–'}</td><td>${m ? pct(e, 0) : '–'}</td></tr>
      <tr class="lb-hands"><td colspan="4">${xs.length ? xs.map(r => `<span class="lb-h">${r.l} <b>${r.n}</b>${r.n < r.raw ? `<s>${r.raw}</s>` : ''} · ${Math.round(r.e * 100)}%</span>`).join('') : '<span class="small muted">None</span>'}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="small muted">Live combos per hand (crossed out: before your cards${board.length ? ' and the board' : ''} blocked some). Equity = combo-weighted average: ${LB_BUCKETS.map(([b]) => { const m = G[b].reduce((a, r) => a + r.n, 0), e = m ? G[b].reduce((a, r) => a + r.e * r.n, 0) / m : 0; return m ? `${pct(m / x.live, 0)} × ${Math.round(e * 100)}` : ''; }).filter(Boolean).join(' + ')} ≈ ${Math.round(x.eq * 100)}%.</p>`; };
  /* seat strip in place of a table picture (works for 6 or 9 seats) */
  const strip = `<div class="lb-strip">${lbSeats().map(p => { const k = lb.opps.findIndex(o => o.seat === p), me = p === lb.hero;
    return `<span class="lb-seat${me ? ' me' : k >= 0 ? ' opp' : ''}"><b>${p}</b><small>${me ? 'You' : k === 0 ? (shove ? 'All in' : `Opens ${fmtBB(O)}`) : k > 0 ? 'Calls' : 'Folds'}</small></span>`; }).join('')}</div>`;
  let ev = '';
  if (!board.length) {
    const T = RS[0].T, cont = new Set(lbTop(RS[0].labels, T.cont)), cRows = per[0].rows.filter(r => cont.has(r.l)), cLive = cRows.reduce((a, r) => a + r.n, 0), eqC = cRows.reduce((a, r) => a + r.e * r.n, 0) / (cLive || 1), f = 1 - cLive / (per[0].live || 1);
    const A = Sk - posted(lb.hero), evShove = f * P + (1 - f) * (eqC * (P + A + (Sk - O)) - A), ip = LB_POSTFLOP(lb.hero) > LB_POSTFLOP(lb.opps[0].seat), r3 = Math.min(Sk, O * (ip ? 3 : 4) + O * (n - 1)), be3 = (r3 - posted(lb.hero)) / (P + r3 - posted(lb.hero));
    ev = `<h3 class="lb-h3">What it's worth</h3><dl class="lb-ev">
      <dt>Calling</dt><dd>You call <b>${fmtBB(C)} BB</b> to win <b>${fmtBB(P)} BB</b>${n > 1 ? ` (${n} opponents in)` : ''}, so you need <b>${pct(need)}</b>. You have ${pct(eqAll)}: <b class="${eqAll >= need ? 'good' : 'bad'}">${eqAll >= need ? 'enough' : 'not enough'}</b>. Showdown value: <b>${bb(evCall)}</b> compared with folding.${n > 1 ? ' Multiway pots pay more when you hit, but you will rarely see a showdown with one pair.' : ' Real hands have more betting: position and strong draws help; being dominated hurts.'}</dd>
      ${shove ? '' : `<dt>3-bet to ${fmtBB(r3)} BB</dt><dd>As a pure bluff it needs ${n > 1 ? '<b>everyone</b>' : 'the raiser'} to fold <b>${pct(be3, 0)}</b> of the time${n > 1 ? ', which is much harder with callers in (a "squeeze")' : ''}.</dd>`}
      ${n === 1 && !shove ? `<dt>All in for ${fmtBB(Sk)} BB</dt><dd>A ${T.name.toLowerCase()} calls with about the top <b>${Math.round(T.cont * 100)}%</b> of this range (${cLive} combos) and folds <b>${pct(f, 0)}</b>. Against the calling hands you have <b>${pct(eqC)}</b>. Value: <b class="${evShove >= 0 ? 'good' : 'bad'}">${bb(evShove)}</b>.</dd>` : ''}
    </dl>`;
  }
  out.innerHTML = `${strip}
    <div class="lb-sum"><div><span class="lbl muted">Your equity${n > 1 ? ` vs all ${n}` : ''}</span><b class="lb-big">${pct(eqAll)}</b></div>
      ${n > 1 ? `<div><span class="lbl muted">Fair share</span><b>${pct(1 / (n + 1), 0)}</b><span class="small">with ${n + 1} players, each "deserves" this much</span></div><div><span class="lbl muted">Win / split</span><b>${pct(multi.win, 0)} / ${pct(multi.tie, 0)}</b></div>`
        : `<div><span class="lbl muted">Against</span><b>${esc(per[0].R.name)}</b><span class="small">${per[0].raw} combos (${pct(per[0].raw / 1326, 0)} of hands), ${per[0].live} live</span></div>`}</div>
    ${n > 1 ? `<p class="small muted">Multiway equity comes from ${multi.n.toLocaleString()} simulated deals, each opponent holding a hand from their own range. Heads-up breakdowns against each player follow; your equity against everyone together is lower than against any one of them.</p>` : ''}
    ${per.map((x, k) => n > 1 ? `<details class="lb-each"${k === lb.view ? ' open' : ''}><summary><b>${k ? 'Caller ' + k : 'Raiser'} · ${lb.opps[k].seat}</b>: heads up you have ${pct(x.eq)} <span class="small muted">(${esc(x.R.name)}, ${x.live} live combos)</span></summary>${table(x, k)}</details>` : table(x, k)).join('')}
    ${ev}`;
}
/* ---- events ---- */
$('lb-slots').addEventListener('click', e => { const b = e.target.closest('[data-lbi]'); if (!b) return; const i = +b.dataset.lbi; if (lb.cards[i] != null) { lb.cards[i] = null; lbQueue(); } lb.active = lb.active === i ? null : i; lbSlots(); });
$('lb-grid').addEventListener('click', e => { const b = e.target.closest('[data-lbc]'); if (!b || b.disabled || lb.active == null) return; lb.cards[lb.active] = +b.dataset.lbc;
  const nxt = [0, 1].find(i => lb.cards[i] == null) ?? (lb.active >= 2 ? [2, 3, 4, 5, 6].find(i => lb.cards[i] == null && i > lb.active) : null); lb.active = nxt ?? null; lbSlots(); lbQueue(); });
$('lb-rand').onclick = () => { const d = shuffled().filter(c => !lb.cards.slice(2).includes(c)); [lb.cards[0], lb.cards[1]] = (d[0] >> 2) >= (d[1] >> 2) ? [d[0], d[1]] : [d[1], d[0]]; lb.active = null; lbSlots(); lbQueue(0); };
$('lb-clrb').onclick = () => { for (let i = 2; i < 7; i++) lb.cards[i] = null; lb.active = 2; lbSlots(); lbQueue(); };
$('lb-rgrid').addEventListener('click', e => { const b = e.target.closest('[data-lbl]'); if (!b) return; const o = lb.opps[lb.view], cur = lbOppRange(o, lb.view).labels, l = b.dataset.lbl;
  o.edit = cur.includes(l) ? cur.filter(x => x !== l) : cur.concat(l); lbQueue(150); });
$('lb-reset').onclick = () => { lb.opps[lb.view].edit = null; lbQueue(0); };
$('lb-otabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; lb.view = +b.dataset.v; lbQueue(0); });
$('lb-size').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; lb.size = +b.dataset.n; const seats = lbSeats(); lb.opps.forEach(o => { if (!seats.includes(o.seat)) o.seat = 'CO'; }); lbQueue(0); });
$('lb-stack').addEventListener('change', e => { lb.stack = Math.max(2, Math.min(300, +e.target.value || 40)); lbQueue(0); });
$('lb-open').addEventListener('change', e => { lb.open = +e.target.value; lbQueue(0); });
$('lb-hseat').addEventListener('change', e => { lb.hero = e.target.value; lbQueue(0); });
$('lb-add').onclick = () => { const seats = lbSeats(), used = new Set([...lb.opps.map(o => o.seat), lb.hero]); const s = seats.slice(seats.indexOf(lb.opps[0].seat) + 1).find(p => !used.has(p)) || seats.find(p => !used.has(p));
  if (s) { lb.opps.push({ seat: s, range: 'auto', text: '', type: 'rec', edit: null }); lb.view = lb.opps.length - 1; } lbQueue(0); };
$('lb-opps').addEventListener('change', e => { const el = e.target.closest('[data-f]'), row = e.target.closest('[data-k]'); if (!el || !row) return; const o = lb.opps[+row.dataset.k], f = el.dataset.f;
  o[f] = el.value; if (f !== 'type' || true) o.edit = null; if (f === 'seat' && +row.dataset.k === 0) { const s = SPOTS.find(x => x.id === lbAutoId(o.seat, lbStack())); if (s && s.o) lb.open = [2, 2.2, 2.5, 3, 4].reduce((a, v) => Math.abs(v - s.o) < Math.abs(a - s.o) ? v : a); }
  lbQueue(0); });
$('lb-opps').addEventListener('click', e => { const b = e.target.closest('[data-f="del"]'); if (!b) return; lb.opps.splice(+b.closest('[data-k]').dataset.k, 1); lb.view = 0; lbQueue(0); });
function lbInit() { if (lb.stack == null || lb.game !== lbGame()) { lb.stack = lbGame() === 'cash' ? 100 : 40; lb.game = lbGame(); const s = SPOTS.find(x => x.id === lbAutoId(lb.opps[0].seat, lb.stack)); if (s && s.o) lb.open = [2, 2.2, 2.5, 3, 4].reduce((a, v) => Math.abs(v - s.o) < Math.abs(a - s.o) ? v : a); } lbSlots(); lbQueue(0); }
const lbSetup = lbInit;

/* ---------- bet controls like a poker site: Fold · Check/Call · Raise (slider with − and +) · All in ----------
   steps: the raise amounts the slider can stop on (BB, "raise to"); onAct(kind, to) gets 'fold', 'call', 'check',
   'raise' (with the amount) or 'allin'. */
/* dataA: instead of calling onAct, give each button the full-hand trainer's data-a so its own click handler acts */
function betBar(host, { toCall = 0, canCheck = false, steps = [], allin = null, raiseWord = 'Raise to', presets = [], onAct, ids = null, dataA = null }) {
  const has = steps.length > 0; let i = 0;
  if (has) { const d = presets.find(p => p.def); if (d) i = steps.reduce((b, v, k) => Math.abs(v - d.to) < Math.abs(steps[b] - d.to) ? k : b, 0); }
  host.innerHTML = `<div class="betbar">
    <div class="bb-main">${canCheck ? '' : '<button type="button" class="act ghost bb-fold" data-bb="fold">Fold</button>'}
      <button type="button" class="act ghost bb-call" data-bb="${canCheck ? 'check' : 'call'}">${canCheck ? 'Check' : `Call ${fmtBB(toCall)}`}</button>
      ${has ? '<button type="button" class="act bb-raise" data-bb="raise"></button>' : ''}
      ${allin != null ? `<button type="button" class="act bb-allin" data-bb="allin">All in ${fmtBB(allin)}</button>` : ''}</div>
    ${has && steps.length > 1 ? `<div class="bb-slide"><button type="button" class="bb-step" data-st="-1" aria-label="Smaller">−</button><input type="range" min="0" max="${steps.length - 1}" step="1" value="${i}" aria-label="Raise amount"><button type="button" class="bb-step" data-st="1" aria-label="Bigger">+</button></div>
    ${presets.length ? `<div class="bb-pre">${presets.map(p => `<button type="button" data-to="${p.to}">${p.label}</button>`).join('')}</div>` : ''}` : ''}</div>`;
  const rng = host.querySelector('input[type=range]'), rb = host.querySelector('.bb-raise');
  if (dataA) host.querySelectorAll('[data-bb]').forEach(b => { if (b.dataset.bb !== 'raise') b.dataset.a = dataA[b.dataset.bb]; });
  const paint = () => { if (!rb) return; const v = steps[i]; rb.innerHTML = `${raiseWord} <b>${fmtBB(v)}</b>`; if (dataA && ids) rb.dataset.a = ids[i]; if (rng) rng.value = i; };
  paint();
  if (rng) rng.oninput = () => { i = +rng.value; paint(); };
  host.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { i = Math.max(0, Math.min(steps.length - 1, i + +b.dataset.st)); paint(); });
  host.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { const t = +b.dataset.to; i = steps.reduce((a, v, k) => Math.abs(v - t) < Math.abs(steps[a] - t) ? k : a, 0); paint(); });
  if (!dataA) host.querySelectorAll('[data-bb]').forEach(b => b.addEventListener('click', () => onAct && onAct(b.dataset.bb, b.dataset.bb === 'raise' ? steps[i] : null)));
}
/* the full-hand trainer's options as site-style controls; its bet sizes are the ones the trainer grades */
function betBarFH(host, opts) {
  const pass = opts.find(o => o.id === 'check' || o.id === 'call'), fold = opts.find(o => o.id === 'fold'), jam = opts.find(o => o.id === 'jam'), agg = opts.filter(o => o.kind === 'bet' && o.id !== 'jam' || o.id === 'raise');
  const to = o => o.to ?? o.amt;
  betBar(host, { toCall: pass && pass.amt || 0, canCheck: !fold, steps: agg.map(to), ids: agg.map(o => o.id), allin: jam ? to(jam) : null, raiseWord: fold ? 'Raise to' : 'Bet',
    presets: agg.length > 1 && !fold ? agg.map(o => ({ to: to(o), label: o.label.replace(/ [\d.]+ BB$/, '') })) : [],
    dataA: { fold: 'fold', check: 'check', call: 'call', allin: 'jam' } });
}

/* ---------- How I play ---------- */
const HP_KEY = 'holdem-howiplay-v1';
const HP_ACTS = { fold: 'Fold', limp: 'Limp', call: 'Call', r2: 'Raise (2× or less)', r25: 'Raise (about 2.5×)', r3: 'Raise (3× or more)', '3b3': '3-bet (up to 3.5×)', '3b4': '3-bet (bigger)', '4b': '4-bet', allin: 'All in' };
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
  /* poker-site controls: what it costs to call, and raise sizes from a min-raise to all in */
  const k = hpKind(s), St = s.stack || 100, posted = s.hero === 'SB' ? .5 : s.hero === 'BB' ? 1 : 0, facingShove = /-vs-.*-shove/.test(s.id);
  const cur = k === 'vs3b' ? (s.tb || s.o * 3) : k === 'open' || k === 'short' && !/vs/.test(s.id) ? 1 : s.o, mine = k === 'vs3b' ? s.o : posted;
  const minTo = k === 'vs3b' ? cur * 2 : k === 'open' || (k === 'short' && !/vs/.test(s.id)) ? 2 : cur * 2, steps = [];
  if (!facingShove) { steps.push(Math.round(minTo * 10) / 10); for (let v = Math.floor(minTo * 2) / 2 + .5; v < St - .01; v += St > 60 && v >= 20 ? 1 : .5) steps.push(v); }   /* the min-raise, then half-BB steps (1 BB above 20 BB when deep) */
  const pot = 1.5 + (s.game === 'tour' ? 1 : 0) + (k === 'vs3b' ? s.o + s.tb : k === 'facing' || /vs/.test(s.id) ? cur : 0);
  const presets = k === 'vs3b' ? [{ to: cur * 2.2, label: '2.2×', def: 1 }, { to: cur * 2.5, label: '2.5×' }] : k === 'facing' || /re-shove/.test(s.id) ? [{ to: cur * 3, label: '3×', def: 1 }, { to: cur * 4, label: '4×' }, { to: pot * 2 + cur, label: 'Pot' }]
    : [{ to: 2, label: '2×' }, { to: 2.5, label: '2.5×', def: 1 }, { to: 3, label: '3×' }, { to: 3.5 + (s.game === 'tour' ? 1 : 0), label: 'Pot' }];
  betBar($('hp-acts'), { toCall: facingShove ? Math.min(St, s.o) - posted : cur - mine, canCheck: false, steps, presets: presets.filter(p => p.to < St), allin: facingShove ? null : St, raiseWord: k === 'facing' || /re-shove/.test(s.id) ? '3-bet to' : k === 'vs3b' ? '4-bet to' : 'Raise to',
    onAct: (kind, to) => hpAnswer(kind === 'fold' ? 'fold' : kind === 'call' ? (k === 'open' || k === 'short' && !/vs/.test(s.id) ? 'limp' : 'call') : kind === 'allin' ? 'allin' : hpSizeCode(k, to, cur, St), to) });
  $('hp-meta').textContent = `${hp.n} hands answered · this spot: ${cov} of 169 starting hands covered`;
  $('hp-fb').innerHTML = c.last || '';
}
/* a raise size as one of the comparison groups (opens 2× / 2.5× / 3×+, 3-bets 3× / 4×+, 4-bets) */
function hpSizeCode(k, to, cur, St) { if (to >= St - .01) return 'allin'; if (k === 'vs3b') return '4b'; if (k === 'open' || k === 'short') return to <= 2.1 ? 'r2' : to <= 2.7 ? 'r25' : 'r3'; return to <= cur * 3.5 ? '3b3' : '3b4'; }
function hpAnswer(code, to) {
  if (!hpCur) return; const c = hpCur, s = c.s;
  const r = hp.s[s.id] = hp.s[s.id] || {}, x = r[c.label] = r[c.label] || {}; x[code] = (x[code] || 0) + 1; hp.n++; hp.last = Date.now();
  if (to) { const z = hp.z = hp.z || {}; (z[s.id] = z[s.id] || []).push(to); if (z[s.id].length > 200) z[s.id].shift(); }
  hpSave();
  const prev = hp.show ? (() => { const ch = s.acts[s.map.get(c.label) ?? s.fold], ok = hpChartCat(s, c.label) === hpCat(code);
    return `<p class="small hp-prev ${ok ? 'good' : 'bad'}">Last hand: ${c.label}, you chose <b>${HP_ACTS[code]}${to && code !== 'allin' ? ' (' + fmtBB(to) + ' BB)' : ''}</b>; the chart says <b>${ch}</b>.</p>`; })() : `<p class="small muted hp-prev">Last hand: ${c.label} → ${HP_ACTS[code]}${to && code !== 'allin' ? ' ' + fmtBB(to) + ' BB' : ''}</p>`;
  hpDeal(); hpCur.last = prev; $('hp-fb').innerHTML = prev;
}
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
  if (!spots.length) { box.innerHTML = `<p class="small muted">Play some preflop spots first. Every answer builds your own range for that spot.</p><h3 class="lb-h3">Full hands</h3>${hpFullResults()}`; return; }
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
    <h3 class="lb-h3">Full hands</h3>${hpFullResults()}
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
function hpInit() { hpMode(hp.mode || 'pre'); if (!hpCur || hpCur.s.game !== (mode === 'cash' ? 'cash' : 'tour')) hpDeal(); else hpShow(); }

/* ---------- How I play: full hands ----------
   Plays in the Full hand trainer with grading hidden; each decision is saved with the hand's strength (the same tiers the
   opponent model uses) and compared, in My results, with the trainer's best play. */
const HP_TIER = { monster: 'Two pair or better', strong: 'Overpair or top pair, good kicker', medium: 'Top pair weak kicker, middle pair', draw: 'Strong draw', gut: 'Gutshot', weak: 'Weak pair', air: 'Nothing' };
const hpKindOf = l => /^fold/i.test(l) ? 'fold' : /^check/i.test(l) ? 'check' : /^call/i.test(l) ? 'call' : /^all in/i.test(l) ? 'allin' : 'bet';
function hpMode(m) { hp.mode = m; hpSave(); $('hp-mode').querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m)); $('hp-pre').hidden = m !== 'pre'; $('hp-full').hidden = m !== 'full';
  const n = (hp.fh || []).length; $('hp-fcount').textContent = n ? `${hp.fhHands || 0} hands, ${n} decisions recorded so far` : ''; }
$('hp-mode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) hpMode(b.dataset.m); });
function hpBanner() { const b = $('hp-banner'), f = window.hpFull; if (!f) { b.hidden = true; return; } b.hidden = false;
  b.innerHTML = `<span class="eyebrow">📋 How I play · full hands</span><b>${f.hands} hand${f.hands === 1 ? '' : 's'} · ${f.dec} decisions recorded</b><span class="small">No grades shown: play the way you normally would.</span><button type="button" class="linkbtn" data-hpf="res">See my results</button><button type="button" class="linkbtn" data-hpf="stop">Stop</button>`; }
function hpFullStop() { const f = window.hpFull; if (!f) return; window.hpFull = null; $('v-hand').classList.remove('hp-quiet'); $('fh-type').value = f.prevType; $('fh-play').checked = f.prevPlay; hpBanner(); }
$('hp-fstart').onclick = () => {
  window.hpFull = { type: $('hp-ftype').value, hands: 0, dec: 0, prevType: $('fh-type').value, prevPlay: $('fh-play').checked };
  $('v-hand').classList.add('hp-quiet'); $('fh-type').value = window.hpFull.type; $('fh-play').checked = false;
  location.hash = '#hand'; fhDeal(); hpBanner(); window.scrollTo(0, 0);
};
document.addEventListener('click', e => { const b = e.target.closest('[data-hpf]'); if (!b) return; const a = b.dataset.hpf; hpFullStop(); if (a === 'res') { location.hash = '#howiplay'; setTimeout(() => hpTab('res'), 50); } });
{ const g0 = fhGrade, e0 = fhEnd;
  fhGrade = function (g) { g0(g); const f = window.hpFull; if (!f || !fh) return;
    const tier = g.street === 'Preflop' ? 'pre' : fhTier(fh.hero, fhBoardNow());
    (hp.fh = hp.fh || []).push({ st: g.street, face: /facing/.test(g.spot), tier, you: hpKindOf(g.choice), best: hpKindOf(g.best), ok: g.ok, t: fh.type });
    if (hp.fh.length > 3000) hp.fh.shift(); f.dec++; hpSave(); hpBanner(); };
  fhEnd = function (how) { e0(how); const f = window.hpFull; if (!f) return; f.hands++; hp.fhHands = (hp.fhHands || 0) + 1; hpSave(); hpBanner(); }; }
function hpFullResults() {
  const xs = hp.fh || []; if (!xs.length) return '<p class="small muted">No full hands yet. Choose <b>Full hands</b> on the Play tab.</p>';
  const agg = k => k === 'bet' || k === 'allin', P = (a, b) => b ? Math.round(a / b * 100) : null, post = xs.filter(x => x.tier !== 'pre'), pre = xs.filter(x => x.tier === 'pre');
  const rows = Object.entries(HP_TIER).map(([t, name]) => {
    const fi = post.filter(x => x.tier === t && !x.face), fa = post.filter(x => x.tier === t && x.face);
    return { t, name, fiN: fi.length, bet: P(fi.filter(x => agg(x.you)).length, fi.length), betB: P(fi.filter(x => agg(x.best)).length, fi.length),
      faN: fa.length, fold: P(fa.filter(x => x.you === 'fold').length, fa.length), foldB: P(fa.filter(x => x.best === 'fold').length, fa.length), rz: P(fa.filter(x => agg(x.you)).length, fa.length), rzB: P(fa.filter(x => agg(x.best)).length, fa.length) };
  }).filter(r => r.fiN + r.faN);
  const cell = (a, b, n) => n ? `<b>${a}%</b> <span class="small muted">vs ${b}%</span>` : '<span class="small muted">–</span>';
  const gaps = [];
  for (const r of rows) {
    if (r.fiN >= 5 && Math.abs(r.bet - r.betB) >= 20) gaps.push(`With <b>${r.name.toLowerCase()}</b> and no bet to face, you bet <b>${r.bet}%</b>; the best play bets ${r.betB}%.`);
    if (r.faN >= 5 && Math.abs(r.fold - r.foldB) >= 20) gaps.push(`With <b>${r.name.toLowerCase()}</b> facing a bet, you fold <b>${r.fold}%</b>; the best play folds ${r.foldB}%.`);
  }
  return `<p class="small">${hp.fhHands || 0} hands · ${xs.length} decisions · <b>${P(xs.filter(x => x.ok).length, xs.length)}%</b> were the best play or close to it${pre.length ? ` · preflop ${P(pre.filter(x => x.ok).length, pre.length)}% matched the charts` : ''}.</p>
    ${gaps.length ? `<ul class="small hp-list">${gaps.map(g => `<li>${g}</li>`).join('')}</ul>` : ''}
    <div style="overflow-x:auto"><table class="ref hp-ftable"><thead><tr><th>Your hand (after the flop)</th><th>Checked to you / first: you bet</th><th>Facing a bet: you fold</th><th>Facing a bet: you raise</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="t">${r.name}</td><td>${cell(r.bet, r.betB, r.fiN)}<br><span class="small muted">${r.fiN} spots</span></td><td>${cell(r.fold, r.foldB, r.faN)}<br><span class="small muted">${r.faN} spots</span></td><td>${cell(r.rz, r.rzB, r.faN)}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted">"vs" is how often the trainer's best play does the same in those exact spots. Small samples swing a lot; aim for a few dozen spots per row.</p>`;
}
