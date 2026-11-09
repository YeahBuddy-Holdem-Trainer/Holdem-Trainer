/* ---------- tournament full hands ----------
   Same engine as the cash full hand (js/full-hand.js) after the flop, with tournament stacks and a big-blind ante:
   40 BB and 25 BB hands with opens, calls and 3-bet shoves; 20 BB re-shove spots; 10-15 BB push or fold.
   Preflop choices are graded against the tournament charts, calling an all-in by your equity against their range.
   Values are in chips (big blinds), not prize money: ICM pressure near the bubble isn't modelled here. */
const FHT_SPOTS = {
  btn40: { hero: 'BTN', vil: 'BB', depth: 40, kind: 'open', chart: 'tour-btn-open-40-bb', label: 'Button opens, 40 BB' },
  co40: { hero: 'CO', vil: 'BTN', depth: 40, kind: 'open', chart: 'tour-co-open-40-bb', label: 'Cutoff opens, 40 BB' },
  bb40: { hero: 'BB', vil: 'BTN', depth: 40, kind: 'def', chart: 'tour-bb-vs-btn-open-40-bb', vopen: 'tour-btn-open-40-bb', label: 'Big blind vs button open, 40 BB' },
  btn25: { hero: 'BTN', vil: 'BB', depth: 25, kind: 'open', chart: 'tour-btn-open-25-bb', label: 'Button opens, 25 BB' },
  co25: { hero: 'CO', vil: 'BTN', depth: 25, kind: 'open', chart: 'tour-co-open-25-bb', label: 'Cutoff opens, 25 BB' },
  bb20: { hero: 'BB', vil: 'BTN', depth: 20, kind: 'reshove', chart: 'tour-bb-re-shove-vs-btn-20-bb', vopen: 'tour-btn-open-25-bb', label: 'Big blind vs button open, 20 BB' },
  btn15: { hero: 'BTN', vil: 'BB', depth: 15, kind: 'shove', chart: 'tour-btn-shove-15-bb', label: 'Button push or fold, 15 BB' },
  co10: { hero: 'CO', vil: 'BB', depth: 10, kind: 'shove', chart: 'tour-co-shove-10-bb', label: 'Cutoff push or fold, 10 BB' },
  btn10: { hero: 'BTN', vil: 'BB', depth: 10, kind: 'shove', chart: 'tour-btn-shove-10-bb', label: 'Button push or fold, 10 BB' },
  sb10: { hero: 'SB', vil: 'BB', depth: 10, kind: 'shove', chart: 'tour-sb-shove-10-bb', label: 'Small blind push or fold, 10 BB' },
  bbvbtn10: { hero: 'BB', vil: 'BTN', depth: 10, kind: 'callshove', chart: 'tour-bb-vs-btn-shove-10-bb', vshove: 'tour-btn-shove-10-bb', label: 'Big blind vs button shove, 10 BB' },
  bbvsb10: { hero: 'BB', vil: 'SB', depth: 10, kind: 'callshove', chart: 'tour-bb-vs-sb-shove-10-bb', vshove: 'tour-sb-shove-10-bb', label: 'Big blind vs small blind shove, 10 BB' }
};
const FHT_GROUPS = {
  random: { label: 'Random stack depth', ids: Object.keys(FHT_SPOTS) },
  deep: { label: '40 BB: open, defend, play postflop', ids: ['btn40', 'co40', 'bb40'] },
  mid: { label: '20-25 BB: opens and re-shoves', ids: ['btn25', 'co25', 'bb20'] },
  short: { label: '10-15 BB: push or fold', ids: ['btn15', 'co10', 'btn10', 'sb10', 'bbvbtn10', 'bbvsb10'] }
};
/* how each opponent type plays short-stacked:
   rshove: re-shoves over your open; call: flats your open; open: their button open when you're in the big blind;
   d3j / d3c: shove or call over your 3-bet; callShove: calls your shove; rcall: calls your re-shove; shoveWide: widens their shove range */
const FHT_PRE = {
  rec: { rshove: 'TT+,AQs+,AKo', call: '22-99,A2s+,K2s+,Q5s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T9o,AJo-A2o',
    d3j: 'JJ+,AQs+,AKo', d3c: 'TT-55,ATs-AJs,KJs+,QJs,JTs,AJo+,KQo', callShove: '22+,A2s+,K8s+,Q9s+,J9s+,A7o+,KTo+,QJo', rcall: '99+,AJs+,KQs,AQo+', shove: 0 },
  station: { rshove: 'QQ+,AKs', call: '22-JJ,A2s+,K2s+,Q2s+,J5s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K5o+,Q7o+,J8o+,T8o+,98o,87o,AKo,AQo',
    d3j: 'QQ+,AKs', d3c: 'JJ-22,A2s+,K8s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo', callShove: '22+,A2s+,K2s+,Q5s+,J7s+,T8s+,98s,A2o+,K7o+,Q9o+,J9o+', rcall: '55+,A8s+,KTs+,QJs,ATo+,KQo', shove: 1 },
  nit: { rshove: 'QQ+,AKs,AKo', call: '22-JJ,ATs+,KTs+,QJs,JTs,AJo+,KQo',
    d3j: 'QQ+,AKs,AKo', d3c: 'JJ-99,AQs', callShove: '77+,ATs+,KQs,AJo+', rcall: 'TT+,AQs+,AKo', shove: -1 },
  aggro: { rshove: '66+,A8s+,A5s-A2s,KTs+,QTs+,JTs,ATo+,KQo', call: '22-55,K5s-K9s,Q8s-Q9s,J8s-J9s,T8s+,97s+,86s+,76s,65s,A2o-A9o,KTo-KJo',
    d3j: '88+,ATs+,A5s-A4s,KQs,AJo+', d3c: '77-22,A9s-A6s,KJs-KTs,QJs,JTs,ATo,KQo', callShove: '22+,A2s+,K5s+,Q8s+,J9s+,T9s,A2o+,K9o+,QTo+', rcall: '66+,A8s+,KTs+,ATo+,KQo', shove: 1 }
};
const fhtSpotSet = id => { const s = SPOTS.find(x => x.id === id); return s ? new Set([...s.map].filter(([, a]) => a !== s.fold).map(([l]) => l)) : new Set(); };
const fhtWho = (S, pos) => S.hero === pos ? 'hero' : S.vil === pos ? 'vil' : null;

function fhtSeatOptions() {
  const sel = $('fh-seat'), keep = sel.value, cash = mode === 'cash';
  sel.innerHTML = cash
    ? '<option value="random">Random</option><option value="BTN">Button (vs big blind)</option><option value="CO">Cutoff (vs button)</option><option value="BB">Big blind (vs button)</option>'
    : Object.entries(FHT_GROUPS).map(([k, g]) => `<option value="${k}">${g.label}</option>`).join('') + '<optgroup label="One spot">' + Object.entries(FHT_SPOTS).map(([k, s]) => `<option value="t:${k}">${s.label}</option>`).join('') + '</optgroup>';
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  $('fh-seat-lbl').textContent = cash ? 'Your seat' : 'Spot';
}

function fhtDeal() {
  const type = $('fh-type').value === 'random' ? pick(Object.keys(FH_TYPES)) : $('fh-type').value;
  const v = $('fh-seat').value, key = v.startsWith('t:') ? v.slice(2) : pick((FHT_GROUPS[v] || FHT_GROUPS.random).ids);
  const T = FHT_SPOTS[key], S = { hero: T.hero, vil: T.vil }, chart = SPOTS.find(x => x.id === T.chart), playable = $('fh-play').checked;
  const pushy = T.kind === 'shove' || T.kind === 'callshove';
  let hero, deck;
  for (let tries = 0; tries < 800; tries++) {
    deck = shuffled(); hero = deck.slice(0, 2); const l = handLabel(hero);
    if (!playable) break;
    if (pushy) { if (Math.random() < .55 ? chart.boundary.includes(l) : true) break; else continue; }   /* push/fold: mostly close hands */
    if (chart.map.has(l) && chart.map.get(l) !== chart.fold) break;
  }
  const P = FHT_PRE[type];
  /* the opponent's hand, from the range that fits the spot */
  let vr;
  if (T.kind === 'def' || T.kind === 'reshove') vr = fhRange(T.kind === 'def' && FH_PRE[type].open && type !== 'rec' ? FH_PRE[type].open : [...fhtSpotSet(T.vopen)].join(','), hero);
  else if (T.kind === 'callshove') {   /* looser players shove wider, nits tighter */
    const id = P.shove > 0 ? 'tour-sb-shove-10-bb' : P.shove < 0 ? 'tour-co-shove-10-bb' : T.vshove;
    vr = fhRange([...fhtSpotSet(id)].join(','), hero);
  }
  else if (T.kind === 'open') vr = Math.random() < .85 ? fhRange(P.rshove + ',' + P.call, hero) : null;
  if (!vr || !vr.length) vr = fhRange('22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s,A2o+,K2o+,Q2o+,J2o+,T2o+,92o+,82o+,72o+,62o+,52o+,42o+,32o', hero);
  const vil = pick(vr).c.slice(), rest = deck.filter(c => !hero.includes(c) && c !== vil[0] && c !== vil[1]);
  fh = { type, seat: key, S, tour: true, depth: T.depth, T, hero, vil, board: rest.slice(0, 5), street: 0, pot: 0, inv: { hero: 0, vil: 0 }, stack: { hero: T.depth, vil: T.depth },
    pfr: null, ip: S.hero === 'BB' || (S.hero === 'SB') || (S.hero === 'CO' && S.vil === 'BTN') ? 'vil' : 'hero', log: [], dec: [], done: false, result: null, vw: null,
    t0: Date.now(), ts: new Date().toISOString(), acts: [], streetIn: { hero: 0, vil: 0 } };
  /* big-blind ante, then the blinds; blinds and antes of players not in the hand are dead money */
  const post = (pos, amt, live) => { const w = fhtWho(S, pos); if (!w) { fh.pot += amt; return; } const a = fhPut(w, amt); if (live) fh.streetIn[w] += a; };
  post('BB', 1, false); post('SB', .5, true); post('BB', 1, true);
  fhLog('Preflop', `Tournament, ${T.depth} BB effective, big-blind ante. ${FH_TYPES[type].name} in the ${POSNAME[S.vil]}; you are in the ${POSNAME[S.hero]}.`);
  if (T.kind === 'def' || T.kind === 'reshove') {
    const o = chart.o || 2; fhTo('vil', o); fh.pfr = 'vil';
    fhLog('Preflop', `It folds to the button, who raises to ${fmtBB(o)} BB.${S.hero === 'BB' ? ' The small blind folds.' : ''}`, 'vil');
    return fhAsk(T.kind === 'def' ? 't-def' : 't-reshove');
  }
  if (T.kind === 'callshove') {
    fhTo('vil', fh.stack.vil + fh.streetIn.vil); fh.pfr = 'vil';
    fhLog('Preflop', `${T.vil === 'SB' ? 'It folds to the small blind, who' : 'It folds to the button, who'} moves all in for ${fmtBB(fh.streetIn.vil)} BB.`, 'vil');
    return fhAsk('t-callshove');
  }
  fhAsk(T.kind === 'shove' ? 't-shove' : 't-open');
}

/* buttons for the tournament preflop decisions */
function fhtButtons(kind) {
  const T = fh.T, chart = SPOTS.find(x => x.id === T.chart), toCall = Math.max(0, fh.streetIn.vil - fh.streetIn.hero), all = fh.stack.hero + fh.streetIn.hero;
  if (kind === 't-open') return `<button class="act" data-a="raise">Raise to ${fmtBB(chart.o || 2)} BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  if (kind === 't-def') return `<button class="act" data-a="3bet">3-bet to ${fmtBB(fhtThree())} BB</button><button class="act" data-a="call">Call ${fmtBB(toCall)} BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  if (kind === 't-reshove') return `<button class="act" data-a="shove">All in ${fmtBB(all)} BB</button><button class="act" data-a="call">Call ${fmtBB(toCall)} BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  if (kind === 't-shove') return `<button class="act" data-a="shove">All in ${fmtBB(all)} BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  if (kind === 't-callshove') return `<button class="act" data-a="call">Call all in (${fmtBB(Math.min(toCall, fh.stack.hero))} BB)</button><button class="act ghost" data-a="fold">Fold</button>`;
  return '';
}
const fhtThree = () => Math.min(fh.stack.hero + fh.streetIn.hero, Math.round(fh.streetIn.vil * 4 * 2) / 2);
function fhtAllIn(who) { fhTo(who, fh.stack[who] + fh.streetIn[who]); }

function fhtPre(a) {
  const T = fh.T, S = fh.S, P = FHT_PRE[fh.type], vl = handLabel(fh.vil), vn = POSNAME[S.vil];
  const done = (how) => fhEnd(how);
  if (fh.ask === 't-open') {
    fhChart(T.chart, a, { raise: 'Raise', fold: 'Fold' });
    if (a === 'fold') { fhLog('Preflop', 'You fold.', 'hero'); return done('fold'); }
    const o = SPOTS.find(x => x.id === T.chart).o || 2; fhTo('hero', o); fh.pfr = 'hero';
    fhLog('Preflop', `You raise to ${fmtBB(o)} BB.${S.vil === 'BB' ? ' It folds to the big blind.' : ''}`, 'hero');
    if (parseRange(P.rshove).has(vl)) { fhtAllIn('vil'); fh.pfr = 'vil'; fhLog('Preflop', `The ${vn} moves all in for ${fmtBB(fh.streetIn.vil)} BB.`, 'vil'); fh.vw = fhRange(P.rshove, fh.hero); return fhAsk('pre-jam'); }
    if (parseRange(P.call).has(vl)) { fhTo('vil', o); fhLog('Preflop', `The ${vn} calls.`, 'vil'); fh.vw = fhRange(P.call, fh.hero); return fhFlop(); }
    fhLog('Preflop', `The ${vn} folds.`, 'vil'); return done('vilfold');
  }
  if (fh.ask === 't-def') {
    fhChart(T.chart, a, { '3bet': '3-bet', call: 'Call', fold: 'Fold' });
    if (a === 'fold') { fhLog('Preflop', 'You fold.', 'hero'); return done('fold'); }
    const openR = [...fhtSpotSet(T.vopen)].join(',');
    if (a === 'call') { fhTo('hero', fh.streetIn.vil); fhLog('Preflop', 'You call.', 'hero'); fh.vw = fhRange(openR, fh.hero); return fhFlop(); }
    const x = fhtThree(); fhTo('hero', x); fh.pfr = 'hero'; fhLog('Preflop', `You 3-bet to ${fmtBB(x)} BB.`, 'hero');
    if (parseRange(P.d3j).has(vl)) { fhtAllIn('vil'); fhLog('Preflop', `The button moves all in for ${fmtBB(fh.streetIn.vil)} BB.`, 'vil'); fh.vw = fhRange(P.d3j, fh.hero); return fhAsk('pre-jam'); }
    if (parseRange(P.d3c).has(vl)) { fhTo('vil', x); fhLog('Preflop', 'The button calls.', 'vil'); fh.vw = fhRange(P.d3c, fh.hero); return fhFlop(); }
    fhLog('Preflop', 'The button folds.', 'vil'); return done('vilfold');
  }
  if (fh.ask === 't-reshove') {
    fhChart(T.chart, a, { shove: 'Shove', call: 'Call', fold: 'Fold' });
    if (a === 'fold') { fhLog('Preflop', 'You fold.', 'hero'); return done('fold'); }
    if (a === 'call') { fhTo('hero', fh.streetIn.vil); fhLog('Preflop', 'You call.', 'hero'); fh.vw = fhRange([...fhtSpotSet(T.vopen)].join(','), fh.hero); return fhFlop(); }
    fhtAllIn('hero'); fhLog('Preflop', `You move all in for ${fmtBB(fh.streetIn.hero)} BB.`, 'hero');
    if (parseRange(P.rcall).has(vl)) { fhTo('vil', fh.streetIn.hero); fhLog('Preflop', 'The button calls.', 'vil'); return fhRunout(); }
    fhLog('Preflop', 'The button folds.', 'vil'); return done('vilfold');
  }
  if (fh.ask === 't-shove') {
    fhChart(T.chart, a, { shove: 'Shove', fold: 'Fold' });
    if (a === 'fold') { fhLog('Preflop', 'You fold.', 'hero'); return done('fold'); }
    fhtAllIn('hero'); fhLog('Preflop', `You move all in for ${fmtBB(fh.streetIn.hero)} BB.${S.hero !== 'SB' ? ' The small blind folds.' : ''}`, 'hero');
    if (parseRange(P.callShove).has(vl)) { fhTo('vil', fh.streetIn.hero); fhLog('Preflop', 'The big blind calls.', 'vil'); return fhRunout(); }
    fhLog('Preflop', 'The big blind folds.', 'vil'); return done('vilfold');
  }
  if (fh.ask === 't-callshove') {
    fhChart(T.chart, a, { call: 'Call', fold: 'Fold' });
    if (a === 'fold') { fhLog('Preflop', 'You fold.', 'hero'); return done('fold'); }
    fhTo('hero', fh.streetIn.vil); fhLog('Preflop', 'You call.', 'hero'); return fhRunout();
  }
}
