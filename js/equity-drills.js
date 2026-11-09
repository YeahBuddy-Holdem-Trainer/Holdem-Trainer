/* ---------- equity drills: hand vs range and range vs range ----------
   Ranges come from the preflop charts for the game type you've chosen (cash 100 BB, or tournament stacks),
   so the Cash/Tournament switch changes which ranges you practise against. Guess the equity, then see the
   answer and why: which parts of the range you beat, flip against or trail, or how each part of a range does. */
const EQ_GOOD = 6;   /* points of error that still count as close */

/* chart ranges as combos: a spot and one of its actions (by name), or every non-fold action */
function eqSpotLabels(id, act) {
  const s = SPOTS.find(x => x.id === id); if (!s) return [];
  const k = act ? s.acts.indexOf(act) : -1;
  return [...s.map].filter(([, a]) => k >= 0 ? a === k : a !== s.fold).map(([l]) => l);
}
const eqActName = (s, a) => ({ 'Raise': 'opens', 'Shove': 'shoves', 'Call': 'calls', '3-bet': '3-bets' }[a] || a.toLowerCase());
function eqRangeName(id, act) {
  const s = SPOTS.find(x => x.id === id);
  return `${s.name}${act ? ` (${act.toLowerCase()} range)` : ''}`;
}
function eqGrid(labels, hl) {
  const set = new Set(labels); let h = '';
  for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) { const l = gridLabel(i, j); h += `<span class="${set.has(l) ? 'a0' : ''}${hl && hl.has(l) ? ' cur' : ''}" title="${l}">${l}</span>`; }
  const n = labels.reduce((a, l) => a + combosOf(l), 0);
  return `<div class="rgrid eq-grid" role="img" aria-label="Range of ${n} combos">${h}</div><p class="small muted">${pct(n / 1326, 0)} of hands · ${n} combos</p>`;
}
const eqStreetPick = sel => { const v = $(sel).value; return v === 'mixed' ? (Math.random() < .5 ? 0 : 3) : +v; };
function eqStats(key) { stats[key] = stats[key] || { n: 0, err: 0, close: 0 }; return stats[key]; }
function eqShowStats(key, p) { const s = eqStats(key); $(p + '-n').textContent = s.n; $(p + '-avg').textContent = s.n ? (s.err / s.n).toFixed(1) : '–'; $(p + '-close').textContent = s.n ? pct(s.close / s.n, 0) : '–'; }
function eqVerdict(guess, actual) {
  const miss = Math.abs(guess - actual * 100), ok = miss <= EQ_GOOD;
  return { miss, ok, html: `<div class="verdict ${ok ? 'good' : 'bad'}"><strong>${ok ? (miss < 2 ? 'Spot on' : 'Close') : 'Off by ' + miss.toFixed(0) + ' pts'}</strong><span>You guessed <b>${guess}%</b>; the answer is <b>${pct(actual)}</b>.</span></div>` };
}

/* ---------- hand vs range ---------- */
let hvr = null;
function newHVR() {
  const g = mode === 'cash' ? 'cash' : 'tour', spots = SPOTS.filter(s => s.game === g);
  let s, act, labels;
  for (let t = 0; t < 30; t++) {   /* a villain range: one action of a chart, at least 3% of hands */
    s = pick(spots); const acts = s.acts.filter((a, i) => i !== s.fold); act = acts.length > 1 ? pick(acts) : null;
    labels = eqSpotLabels(s.id, act); if (labels.reduce((a, l) => a + combosOf(l), 0) >= 40) break;
  }
  const street = eqStreetPick('hvr-street');
  let hero, board, combos;
  for (let t = 0; t < 50; t++) {
    const d = shuffled(); hero = d.slice(0, 2); board = d.slice(2, 2 + street);
    const dead = new Set([...hero, ...board]);
    combos = labels.flatMap(labelCombos).filter(c => !dead.has(c[0]) && !dead.has(c[1]));
    if (combos.length >= 20) break;
  }
  hvr = { s, act, labels, hero, board, combos, done: false, t0: Date.now() };
  $('hvr-range').textContent = `Villain's range: ${eqRangeName(s.id, act)}`;
  $('hvr-grid').innerHTML = eqGrid(labels);
  $('hvr-hero').innerHTML = cardsHTML(hero);
  $('hvr-board').innerHTML = board.length ? cardsHTML(board) : cardsHTML([null, null, null]);
  $('hvr-street-lbl').textContent = board.length ? 'Flop' : 'Preflop (no board yet)';
  $('hvr-guess').value = 50; $('hvr-gv').textContent = 50; $('hvr-sub').disabled = false;
  $('hvr-out').innerHTML = '<p class="small muted">Slide to your equity guess against the whole range, then lock it in.</p>';
}
$('hvr-guess').oninput = () => { $('hvr-gv').textContent = $('hvr-guess').value; };
$('hvr-next').onclick = newHVR;
$('hvr-street').onchange = newHVR;
$('hvr-form').onsubmit = e => {
  e.preventDefault(); if (!hvr || hvr.done) return; hvr.done = true; $('hvr-sub').disabled = true;
  $('hvr-out').innerHTML = '<p class="small muted">Working it out…</p>';
  setTimeout(() => {
    const guess = +$('hvr-guess').value, r = equityVsRange(hvr.hero, hvr.combos, hvr.board, 20000);
    /* by hand class: quick equity against each label in the range */
    const by = new Map(); for (const c of hvr.combos) { const l = handLabel(c); if (!by.has(l)) by.set(l, []); by.get(l).push(c); }
    const rows = [...by].map(([l, cs]) => { const e = equityVsRange(hvr.hero, cs, hvr.board, 400); return { l, n: cs.length, eq: e ? e.eq : 0 }; });
    const tot = rows.reduce((a, x) => a + x.n, 0), grp = f => rows.filter(f), share = g => g.reduce((a, x) => a + x.n, 0) / tot;
    const ahead = grp(x => x.eq >= .58), flip = grp(x => x.eq > .42 && x.eq < .58), behind = grp(x => x.eq <= .42);
    const list = g => g.sort((a, b) => b.n - a.n).slice(0, 8).map(x => x.l).join(', ') + (g.length > 8 ? '…' : '');
    const v = eqVerdict(guess, r.eq), st = eqStats('hvr'); st.n++; st.err += v.miss; if (v.ok) st.close++; save(); eqShowStats('hvr', 'hvr');
    logEvent({ drill: 'Hand vs range', spot: `${hvr.board.length ? 'Flop' : 'Preflop'} · ${hvr.s.name}`, hand: names(hvr.hero), answer: guess, expected: Math.round(r.eq * 1000) / 10, correct: v.ok, error: Math.round(v.miss * 10) / 10, detail: hvr.act || '', ms: Date.now() - hvr.t0 });
    const hl = handLabel(hvr.hero);
    $('hvr-out').innerHTML = `${v.html}
      <p class="small">${hl} against this ${tot}-combo range${hvr.board.length ? ` on ${names(hvr.board)}` : ' before the flop'}. Win ${pct(r.w, 0)}, tie ${pct(r.t, 0)}.</p>
      <dl class="math">
        <dt>You're ahead of</dt><dd>${pct(share(ahead), 0)} of the range${ahead.length ? ` <span class="muted">(${list(ahead)})</span>` : ''}</dd>
        <dt>Close to a flip vs</dt><dd>${pct(share(flip), 0)}${flip.length ? ` <span class="muted">(${list(flip)})</span>` : ''}</dd>
        <dt>Behind</dt><dd>${pct(share(behind), 0)}${behind.length ? ` <span class="muted">(${list(behind)})</span>` : ''}</dd>
      </dl>
      <p class="small muted">Shortcut: think of the range as a few groups, guess your equity against each, and weight by how many combos each group has. Pairs are 6 combos, suited hands 4 and offsuit hands 12.</p>`;
    $('hvr-grid').innerHTML = eqGrid(hvr.labels, new Set(behind.map(x => x.l)));
    $('hvr-next').focus();
  }, 20);
};

/* ---------- range vs range ---------- */
const RVR_PAIRS = {
  cash: [
    [['cash-btn-open', 'Raise'], ['cash-bb-vs-btn-open', '3-bet'], 'Button open vs big blind 3-bet'],
    [['cash-btn-open', 'Raise'], ['cash-bb-vs-btn-open', 'Call'], 'Button open vs big blind call'],
    [['cash-co-open', 'Raise'], ['cash-btn-vs-co-open', '3-bet'], 'Cutoff open vs button 3-bet'],
    [['cash-utg-open', 'Raise'], ['cash-bb-vs-utg-open', 'Call'], 'UTG open vs big blind call'],
    [['cash-utg-open', 'Raise'], ['cash-btn-vs-utg-open', '3-bet'], 'UTG open vs button 3-bet'],
    [['cash-sb-open', 'Raise'], ['cash-bb-vs-sb-open', '3-bet'], 'Small blind open vs big blind 3-bet'],
    [['cash-co-open', 'Raise'], ['cash-bb-vs-co-open', 'Call'], 'Cutoff open vs big blind call']
  ],
  tour: [
    [['tour-btn-shove-10-bb', 'Shove'], ['tour-bb-vs-btn-shove-10-bb', 'Call'], 'Button 10 BB shove vs big blind call'],
    [['tour-sb-shove-10-bb', 'Shove'], ['tour-bb-vs-sb-shove-10-bb', 'Call'], 'Small blind 10 BB shove vs big blind call'],
    [['tour-co-shove-15-bb', 'Shove'], ['tour-bb-vs-co-shove-15-bb', 'Call'], 'Cutoff 15 BB shove vs big blind call'],
    [['tour-btn-shove-10-bb', 'Shove'], ['tour-sb-vs-btn-shove-10-bb', 'Call'], 'Button 10 BB shove vs small blind call'],
    [['tour-btn-open-40-bb', 'Raise'], ['tour-bb-vs-btn-open-40-bb', '3-bet'], 'Button open vs big blind 3-bet, 40 BB'],
    [['tour-btn-open-40-bb', 'Raise'], ['tour-bb-vs-btn-open-40-bb', 'Call'], 'Button open vs big blind call, 40 BB'],
    [['tour-btn-open-25-bb', 'Raise'], ['tour-bb-re-shove-vs-btn-20-bb', 'Shove'], 'Button open vs big blind re-shove, 20-25 BB'],
    [['tour-co-open-40-bb', 'Raise'], ['tour-bb-vs-co-open-40-bb', 'Call'], 'Cutoff open vs big blind call, 40 BB']
  ]
};
function rvrSim(A, B, board, N) {
  const cls = c => { const l = handLabel(c); return l.length === 2 ? 'Pairs' : l[2] === 's' ? 'Suited' : 'Offsuit'; };
  const tally = {}; let s = 0, n = 0;
  for (let i = 0; i < N; i++) {
    const a = pick(A), b = pick(B);
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
    const dead = new Set([...a, ...b, ...board]), full = board.slice();
    while (full.length < 5) { const c = Math.floor(Math.random() * 52); if (!dead.has(c)) { dead.add(c); full.push(c); } }
    const x = evalHand(a.concat(full)), y = evalHand(b.concat(full)), r = x > y ? 1 : x === y ? .5 : 0;
    s += r; n++; const k = cls(a); tally[k] = tally[k] || { s: 0, n: 0 }; tally[k].s += r; tally[k].n++;
  }
  return { eq: s / n, tally, n };
}
let rvr = null;
function newRVR() {
  const g = mode === 'cash' ? 'cash' : 'tour', [a, b, name] = pick(RVR_PAIRS[g]);
  const la = eqSpotLabels(a[0], a[1]), lb = eqSpotLabels(b[0], b[1]);
  const street = eqStreetPick('rvr-street'), board = shuffled().slice(0, street), dead = new Set(board);
  const ok = c => !dead.has(c[0]) && !dead.has(c[1]);
  rvr = { a, b, name, la, lb, board, A: la.flatMap(labelCombos).filter(ok), B: lb.flatMap(labelCombos).filter(ok), done: false, t0: Date.now() };
  $('rvr-title').textContent = name;
  $('rvr-a-name').textContent = 'Range A: ' + eqRangeName(a[0], a[1]); $('rvr-b-name').textContent = 'Range B: ' + eqRangeName(b[0], b[1]);
  $('rvr-a-grid').innerHTML = eqGrid(la); $('rvr-b-grid').innerHTML = eqGrid(lb);
  $('rvr-board').innerHTML = board.length ? cardsHTML(board) : cardsHTML([null, null, null]);
  $('rvr-street-lbl').textContent = board.length ? 'Flop' : 'Preflop (no board yet)';
  $('rvr-guess').value = 50; $('rvr-gv').textContent = 50; $('rvr-sub').disabled = false;
  $('rvr-out').innerHTML = '<p class="small muted">Guess range A\'s equity against range B, then lock it in.</p>';
}
$('rvr-guess').oninput = () => { $('rvr-gv').textContent = $('rvr-guess').value; };
$('rvr-next').onclick = newRVR;
$('rvr-street').onchange = newRVR;
$('rvr-form').onsubmit = e => {
  e.preventDefault(); if (!rvr || rvr.done) return; rvr.done = true; $('rvr-sub').disabled = true;
  $('rvr-out').innerHTML = '<p class="small muted">Working it out…</p>';
  setTimeout(() => {
    const guess = +$('rvr-guess').value, r = rvrSim(rvr.A, rvr.B, rvr.board, 30000);
    const v = eqVerdict(guess, r.eq), st = eqStats('rvr'); st.n++; st.err += v.miss; if (v.ok) st.close++; save(); eqShowStats('rvr', 'rvr');
    logEvent({ drill: 'Range vs range', spot: `${rvr.board.length ? 'Flop' : 'Preflop'} · ${rvr.name}`, hand: rvr.board.length ? names(rvr.board) : '', answer: guess, expected: Math.round(r.eq * 1000) / 10, correct: v.ok, error: Math.round(v.miss * 10) / 10, detail: '', ms: Date.now() - rvr.t0 });
    const nA = rvr.A.length, cnt = k => rvr.A.filter(c => { const l = handLabel(c); return k === 'Pairs' ? l.length === 2 : k === 'Suited' ? l[2] === 's' : l[2] === 'o'; }).length;
    const rows = ['Pairs', 'Suited', 'Offsuit'].filter(k => r.tally[k]).map(k => `<tr><td class="t">${k}</td><td>${pct(cnt(k) / nA, 0)}</td><td>${pct(r.tally[k].s / r.tally[k].n, 0)}</td></tr>`).join('');
    const shove = /shove/i.test(rvr.name) && !rvr.board.length;
    $('rvr-out').innerHTML = `${v.html}
      <p class="small">Range A has <b>${pct(r.eq)}</b>, range B has <b>${pct(1 - r.eq)}</b>${rvr.board.length ? ` on ${names(rvr.board)}` : ' preflop'}.</p>
      <table class="ref"><thead><tr><th>Range A's hands</th><th>Share of A</th><th>A's equity</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted">${shove ? 'The calling range is usually ahead of the shoving range: the shover makes money when the other player folds, so they can shove much wider than anyone can call.'
        : r.eq < .45 ? 'The narrower, stronger range is ahead. That is why the wider range has to fold, call or 3-bet carefully against it.'
        : r.eq > .55 ? 'Range A is ahead here, so range B has to rely on position, folds and playability.'
        : 'These ranges are close to even, so position and skill after the flop decide who wins more.'}</p>`;
    $('rvr-next').focus();
  }, 20);
};
function eqDrillsInit() { eqShowStats('hvr', 'hvr'); eqShowStats('rvr', 'rvr'); newHVR(); newRVR(); }
