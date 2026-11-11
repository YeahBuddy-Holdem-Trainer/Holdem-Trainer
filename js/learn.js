/* ---------- Learn: a guided path from Fish to Crusher ----------
   Units of short lessons, unlocked in order. A lesson is a teaching card and 10 questions (pass at 8);
   each unit ends in a 12-question checkpoint (pass at 10) that unlocks the next unit.
   Questions come from the same generators the trainers and the skill check use.
   Chips: +10 for a right answer, -5 for a wrong one (never below zero), plus a bonus for passing.
   Rank follows the most chips you have ever held, so a bad lesson shrinks the stack but never demotes you.
   Progress is saved under LNKEY, which syncs to the cloud with the other settings. */
const LNKEY = 'holdem-learn-v1';
const LN_PASS = { lesson: [10, 8], check: [12, 10] };
const LN_CHIPS = { right: 10, wrong: -5, pass: 50, repass: 10, placed: 30 };
const LN_RANKS = [
  { name: 'Fish', at: 0, icon: '🐟', line: 'Learning the rules of the table.' },
  { name: 'Rookie', at: 300, icon: '🃏', line: 'Knows the basics and starting to see the math.' },
  { name: 'Grinder', at: 1000, icon: '⚙️', line: 'Solid fundamentals, putting in the volume.' },
  { name: 'Regular', at: 2500, icon: '🎯', line: 'Thinks in prices, ranges and positions.' },
  { name: 'Shark', at: 5000, icon: '🦈', line: 'Reads hands and adjusts to opponents.' },
  { name: 'Crusher', at: 9000, icon: '👑', line: 'Plays every street with a plan.' },
];

/* ---------- question makers for lessons ---------- */
const lnHands = (a, b) => `<div class="hands"><div><span class="lbl">You</span><div class="cards">${cardsHTML(a)}</div></div>${b ? `<div><span class="lbl">Villain</span><div class="cards">${cardsHTML(b)}</div></div>` : ''}</div>`;
function lnPF(re) {
  return () => {
    const pool = SPOTS.filter(s => s.game === mode && re.test(s.id)), spot = pick(pool), { label, cards } = dealSpotHand(spot, 0), exp = spot.map.get(label) ?? spot.fold;
    return { drill: 'Preflop', spot: spot.name, hand: label, visual: tableSnap({ ...spotTable(spot), heroCards: cards }),
      prompt: `<p class="spot-text"><b>${spot.name}.</b> ${spotText(spot)}</p>`, opts: spot.acts, correct: exp, short: `${spot.name}, ${label}`, explain: pfWhy(spot, label, exp) };
  };
}
function lnPO(fracs) {
  return () => {
    newStakes(); const pot = makePot(4, 40), bet = makeBet(pot, pick(fracs)), req = bet / (pot + 2 * bet), r = Math.round(req * 100);
    const { opts, correct } = numOpts(r, [Math.round(bet / (pot + bet) * 100), Math.round(bet / pot * 100), r + 7, r - 7, r + 12].filter(x => x > 0 && x < 95));
    return { drill: 'Pot odds', spot: nearestRef(bet / pot) + ' bet', hand: '',
      prompt: `<p class="spot-text">The pot is <b>${money(pot)}</b>. Villain bets <b>${money(bet)}</b> (${Math.round(bet / pot * 100)}% of the pot). What equity do you need to call?</p>`,
      opts: opts.map(o => o + '%'), correct, short: `Pot ${money(pot)}, bet ${money(bet)}`,
      explain: `Your call ÷ the final pot: ${money(bet)} ÷ (${money(pot)} + ${money(bet)} + ${money(bet)}) = <b>${pct(req)}</b>.` };
  };
}
/* rule of 2 and 4: outs × 4 with two cards to come (all in on the flop), outs × 2 with one */
function lnRule() {
  const n = pick([4, 5, 6, 8, 9, 10, 12, 15]), flop = Math.random() < .5, est = n * (flop ? 4 : 2);
  const exact = flop ? 1 - ((47 - n) * (46 - n)) / (47 * 46) : n / 46;
  const { opts, correct } = numOpts(est, [flop ? n * 2 : n * 4, est + 10, est - 10, est + 5, Math.round(n / 52 * 100)].filter(x => x > 0 && x < 100));
  return { drill: 'Rule of 2 and 4', spot: flop ? 'Flop, all in' : 'Turn', hand: n + ' outs',
    prompt: `<p class="spot-text">You have <b>${n} outs</b> ${flop ? 'on the <b>flop</b> and you are all in, so you see the turn <i>and</i> the river' : 'on the <b>turn</b>, with one card to come'}. Roughly what is your equity?</p>`,
    opts: opts.map(o => o + '%'), correct, short: `${n} outs, ${flop ? 'flop all in' : 'turn'}`,
    explain: `${n} × ${flop ? 4 : 2} ≈ <b>${est}%</b>. The exact figure is ${pct(exact)}.${flop && n > 8 ? ' With lots of outs the ×4 shortcut runs a little high.' : ''}` };
}
/* a checkpoint mixes every lesson in its unit */
function lnMix(unitId) { return () => { const u = LN_UNITS.find(x => x.id === unitId); return pick(u.lessons.filter(l => !l.check)).gen(); }; }

/* ---------- the path ---------- */
const LN_UNITS = [
  { id: 'preflop', name: 'Preflop basics', blurb: 'Which hands to play from each seat.', lessons: [
    { id: 'pf-late', name: 'Opening late', icon: '♠', gen: lnPF(/-(co|btn)-open/),
      intro: `<p>When everyone folds to you on the <b>cutoff</b> or <b>button</b>, open-raise a wide range.</p><ul><li>Only a few players are left behind you, so a strong hand is less likely to wake up.</li><li>You'll play the rest of the hand <b>in position</b>, acting last on every street.</li><li>Raise or fold. Don't just call (limp) when you're first in.</li></ul>` },
    { id: 'pf-early', name: 'Opening early', icon: '♣', gen: lnPF(/-(utg|hj|sb)-open/),
      intro: `<p>From <b>UTG</b> and the <b>hijack</b>, many players still act after you, so open a much <b>tighter</b> range: big pairs, strong aces and suited broadways.</p><ul><li>The small blind is a special case: only the big blind is left, but you'll be <b>out of position</b> after the flop.</li><li>Answer with the chart for the game shown, cash or tournament.</li></ul>` },
    { id: 'pf-bb', name: 'Defending the big blind', icon: '♥', gen: lnPF(/-bb-vs-[a-z]+-open/),
      intro: `<p>In the big blind you already have 1 BB in the pot, so calling a raise is <b>cheap</b>. You defend wider than anyone else at the table.</p><ul><li>The later the raiser's seat, the wider their range, and the wider you defend.</li><li>3-bet your strongest hands and a few good bluffs; call with hands that play well.</li></ul>` },
    { id: 'pf-face', name: 'Facing a raise', icon: '♦', gen: lnPF(/-(co|btn|sb)-vs-[a-z]+-open/),
      intro: `<p>When someone has already raised, <b>tighten up</b>. Their range is stronger than a random hand.</p><ul><li>3-bet strong hands for value, plus some bluffs with blockers (like suited aces).</li><li>Call with hands that play well in position. Fold the rest.</li><li>From the small blind, most charts 3-bet or fold, since calling leaves you out of position.</li></ul>` },
    { id: 'pf-check', name: 'Checkpoint', check: true, gen: lnMix('preflop'), intro: `<p>A mix of everything in this unit. Score 10 out of 12 to unlock <b>The price of a call</b>.</p>` },
  ] },
  { id: 'price', name: 'The price of a call', blurb: 'Pot odds, outs and quick equity math.', lessons: [
    { id: 'po-easy', name: 'Pot odds', icon: '%', gen: lnPO([.33, .5, 1]),
      intro: `<p>Pot odds tell you how often you need to win to call.</p><p class="mono-ex">equity needed = your call ÷ (pot + bet + your call)</p><ul><li>Half pot → <b>25%</b></li><li>Pot-size bet → <b>33%</b></li><li>A third of the pot → <b>20%</b></li></ul><p>Memorize these three; most bets are close to one of them.</p>` },
    { id: 'po-any', name: 'Any bet size', icon: '÷', gen: lnPO(FRACS),
      intro: `<p>Same formula, every bet size, from a quarter pot up to twice the pot.</p><ul><li>Bigger bets need more equity: ¾ pot → 30%, 2× pot → 40%.</li><li>The most common slip is dividing by the pot <i>before</i> your call. Your call is part of what you win back.</li></ul>` },
    { id: 'outs', name: 'Counting outs', icon: '+', gen: QGEN['Counting outs'],
      intro: `<p>An <b>out</b> is a card that puts you ahead.</p><ul><li>Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4.</li><li>Two overcards to a pair: about 6.</li><li>Don't count cards that also improve your opponent.</li></ul>` },
    { id: 'rule24', name: 'Rule of 2 and 4', icon: '×', gen: lnRule,
      intro: `<p>A quick way to turn outs into equity:</p><ul><li><b>One card to come</b> (turn to river): outs × 2.</li><li><b>Two cards to come</b> (all in on the flop): outs × 4.</li></ul><p>9 outs on the turn ≈ 18%. 9 outs all in on the flop ≈ 36%.</p>` },
    { id: 'price-check', name: 'Checkpoint', check: true, gen: lnMix('price'), intro: `<p>Pot odds, outs and the rule of 2 and 4 together. Score 10 out of 12 to unlock <b>Making decisions</b>.</p>` },
  ] },
  { id: 'decide', name: 'Making decisions', blurb: 'Put the price and your equity together.', lessons: [
    { id: 'matchups', name: 'Preflop matchups', icon: '⚔', gen: QGEN['Matchups'],
      intro: `<p>A handful of matchups cover most all-in hands:</p><ul><li>Higher pair vs lower pair: about <b>80/20</b>.</li><li>Pair vs two higher cards: a coin flip, about <b>55/45</b>.</li><li>Two higher cards vs two lower: about <b>65/35</b>.</li><li>Dominated (sharing a card, like AK vs AQ): about <b>70/30</b>.</li></ul>` },
    { id: 'callfold', name: 'Call or fold', icon: '✓', gen: QGEN['Call or fold'],
      intro: `<p>Now combine it all. Work out the price (pot odds), estimate your equity (outs and the rule of 2 and 4), then compare.</p><ul><li>Equity higher than the price: <b>call</b>.</li><li>Equity lower: <b>fold</b>.</li><li>You get a read on villain's hand instead of seeing their cards.</li></ul>` },
    { id: 'decide-check', name: 'Checkpoint', check: true, gen: lnMix('decide'), intro: `<p>Matchups and call-or-fold decisions. Score 10 out of 12 to finish Phase 1 of the path.</p>` },
  ] },
];
const LN_SOON = [['Reading ranges', 'Combos, hand vs range, range vs range'], ['Flop play', 'Board texture, c-bets, value and bluffs'], ['Reading hands', 'Narrowing ranges street by street'],
  ['Bigger pots', '3-bet and multiway pots'], ['Exploits', 'Adjusting to nits, stations and maniacs'], ['Tournaments', 'Push/fold and ICM'], ['Capstone', 'Playing full hands']];
const LN_ALL = LN_UNITS.flatMap((u, ui) => u.lessons.map((l, li) => ({ ...l, unit: u, ui, li })));
const lnById = id => LN_ALL.find(l => l.id === id);

/* ---------- saved progress ---------- */
let ln = (() => { try { return JSON.parse(localStorage.getItem(LNKEY)) || {}; } catch (e) { return {}; } })();
ln = { xp: 0, peak: 0, lessons: {}, days: [], n: 0, c: 0, pre: null, ...ln };
function lnSave() { try { localStorage.setItem(LNKEY, JSON.stringify(ln)); } catch (e) {} }
const lnToday = () => new Date().toLocaleDateString('en-CA');
const lnPassed = l => { const r = ln.lessons[l.id]; return !!(r && (r.placed || r.best >= LN_PASS[l.check ? 'check' : 'lesson'][1])); };
function lnOpen(l) {
  if (l.li > 0) return lnPassed(LN_ALL.find(x => x.ui === l.ui && x.li === l.li - 1));
  return l.ui === 0 || lnPassed(LN_ALL.find(x => x.ui === l.ui - 1 && x.check));
}
const lnNext = () => LN_ALL.find(l => lnOpen(l) && !lnPassed(l));
const lnRank = (x = ln.peak) => { let i = 0; LN_RANKS.forEach((r, k) => { if (x >= r.at) i = k; }); return i; };
function lnStreak() {
  const s = new Set(ln.days); let d = new Date(), n = 0;
  if (!s.has(lnToday())) d.setDate(d.getDate() - 1);
  while (s.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function lnAddChips(x) { ln.xp = Math.max(0, ln.xp + x); ln.peak = Math.max(ln.peak, ln.xp); }

/* ---------- chip stacks: the stack grows with right answers and shrinks with wrong ones ---------- */
const LN_DENOM = [[1000, '#C99A2E', '#F3D98B'], [500, '#6B3FA0', '#C9B3E6'], [100, '#1E1E24', '#9A9AA6'], [25, '#1F7A4D', '#BFE3CF'], [5, '#B8322A', '#F2C4BF'], [1, '#EDE7D9', '#2B4F86']];
function lnStacks(xp, h = 120) {
  const per = 12, cols = [];
  let left = Math.round(xp);
  for (const [v, c, e] of LN_DENOM) { let k = Math.floor(left / v); left -= k * v; while (k > 0) { cols.push({ n: Math.min(per, k), c, e, v }); k -= per; } }
  const shown = cols.slice(0, 7), cw = 44, ch = 6, W = Math.max(1, shown.length) * (cw + 6) + 6, H = per * ch + 22, sc = h / H;
  if (!shown.length) return `<svg class="ln-stacks" viewBox="0 0 120 60" width="${120 * sc}" height="${h * .5}" role="img" aria-label="No chips yet"><ellipse cx="60" cy="44" rx="40" ry="9" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="4 4"/><text x="60" y="26" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">No chips yet</text></svg>`;
  const chip = (x, y, c, e) => `<g><rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${c}"/><ellipse cx="${x + cw / 2}" cy="${y + ch}" rx="${cw / 2}" ry="5" fill="${c}"/><rect x="${x + 6}" y="${y + 1}" width="6" height="${ch}" fill="${e}" opacity=".9"/><rect x="${x + cw - 12}" y="${y + 1}" width="6" height="${ch}" fill="${e}" opacity=".9"/><ellipse cx="${x + cw / 2}" cy="${y}" rx="${cw / 2}" ry="5" fill="${c}" stroke="${e}" stroke-width="1.4"/><ellipse cx="${x + cw / 2}" cy="${y}" rx="${cw / 2 - 9}" ry="2.6" fill="none" stroke="${e}" stroke-width="1" stroke-dasharray="3 3"/></g>`;
  let g = '';
  shown.forEach((s, i) => { const x = 6 + i * (cw + 6); for (let k = 0; k < s.n; k++) g += chip(x, H - 12 - (k + 1) * ch, s.c, s.e); });
  return `<svg class="ln-stacks" viewBox="0 0 ${W} ${H}" width="${W * sc}" height="${h}" role="img" aria-label="${Math.round(xp).toLocaleString()} chips">${g}</svg>`;
}

/* ---------- dashboard ---------- */
function lnRankCard(compact) {
  const ri = lnRank(), r = LN_RANKS[ri], nx = LN_RANKS[ri + 1], lo = r.at, frac = nx ? Math.min(1, (ln.peak - lo) / (nx.at - lo)) : 1;
  const done = LN_ALL.filter(lnPassed).length;
  return `<div class="ln-rank${compact ? ' compact' : ''}">
    <div class="ln-badge" aria-hidden="true">${r.icon}</div>
    <div class="ln-rank-txt"><span class="eyebrow">Your rank</span><h2>${r.name}</h2>${compact ? '' : `<p class="small">${r.line}</p>`}
      <div class="ln-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}"><i style="width:${frac * 100}%"></i></div>
      <span class="small">${nx ? `${(nx.at - ln.peak).toLocaleString()} chips to <b>${nx.name}</b>` : 'Top rank reached'} · ${done} of ${LN_ALL.length} lessons</span></div>
    <div class="ln-stack-box">${lnStacks(ln.xp, compact ? 64 : 104)}<b>${Math.round(ln.xp).toLocaleString()}</b><span>chips</span></div>
  </div>`;
}
function lnMini() {
  const box = $('hm-learn'); if (!box) return; const nx = lnNext();
  box.innerHTML = `${lnRankCard(true)}<div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">${LN_ALL.some(lnPassed) ? 'Continue' : 'Start'}: ${esc(nx.unit.name)} · ${esc(nx.name)}</button>` : '<span class="small">Every lesson in the path is passed. More units are coming.</span>'}<a class="linkbtn" href="#learn">Learning dashboard</a></div>`;
}
function lnRender() {
  lnMini(); if (lnPlay) return lnShowPlay();
  $('ln-play').hidden = true; $('ln-dash').hidden = false;
  const nx = lnNext(), qs = ln.n, acc = qs ? ln.c / qs : 0, any = LN_ALL.some(lnPassed);
  const unitStats = LN_UNITS.map(u => { const ls = u.lessons, p = ls.filter(lnPassed).length; return { u, p, t: ls.length }; });
  $('ln-dash').innerHTML = `
  <section class="hero ln-hero">${lnRankCard(false)}
    <div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">${any ? 'Continue' : 'Start'}: ${esc(nx.name)}</button>` : ''}
      <button class="act ghost" type="button" data-ln-pre>${ln.pre ? 'Retake placement test' : 'Placement test'}</button></div>
    ${ln.pre ? '' : `<p class="small">Already play? The placement test unlocks lessons up to your level.</p>`}
  </section>
  <div class="stats ln-stats">
    <div class="stat"><div class="n">${LN_ALL.filter(lnPassed).length}/${LN_ALL.length}</div><span class="small muted">lessons passed</span></div>
    <div class="stat"><div class="n">${qs ? pct(acc, 0) : '–'}</div><span class="small muted">lesson accuracy</span></div>
    <div class="stat"><div class="n">${lnStreak()}</div><span class="small muted">day learning streak</span></div>
    <div class="stat"><div class="n">${qs}</div><span class="small muted">questions answered</span></div>
  </div>
  <div class="ln-path">${LN_UNITS.map((u, ui) => `
    <section class="panel ln-unit" aria-labelledby="ln-u-${u.id}">
      <div class="ln-unit-h"><div><span class="eyebrow">Unit ${ui + 1}</span><h2 id="ln-u-${u.id}">${u.name}</h2><p class="small muted">${u.blurb}</p></div>
        <span class="chip ${unitStats[ui].p === unitStats[ui].t ? 'good' : unitStats[ui].p ? 'ok' : 'new'}">${unitStats[ui].p}/${unitStats[ui].t}</span></div>
      <div class="ln-nodes">${u.lessons.map((l, li) => { const L = LN_ALL.find(x => x.id === l.id), p = lnPassed(L), o = lnOpen(L), r = ln.lessons[l.id], cur = nx && nx.id === l.id;
        return `<button type="button" class="ln-node${p ? ' passed' : o ? ' open' : ' locked'}${cur ? ' current' : ''}${l.check ? ' check' : ''}" data-ln-go="${l.id}" style="--off:${[0, 1, 0, -1][li % 4]}" aria-label="${esc(l.name)}${p ? ', passed' : o ? ', open' : ', locked'}">
          <span class="ln-dot">${p ? '✓' : o ? (l.check ? '🏁' : l.icon) : '🔒'}</span><span class="ln-name">${l.name}</span>
          <span class="ln-best">${r && r.placed && !r.best ? 'Placed' : r && r.attempts ? `Best ${r.best}/${LN_PASS[l.check ? 'check' : 'lesson'][0]}` : cur ? 'Up next' : ''}</span></button>`; }).join('')}</div>
    </section>`).join('')}
    ${LN_SOON.map(([n, b], k) => `<section class="panel ln-unit soon"><div class="ln-unit-h"><div><span class="eyebrow">Unit ${LN_UNITS.length + k + 1}</span><h2>${n}</h2><p class="small muted">${b}</p></div><span class="chip new">Coming soon</span></div></section>`).join('')}
  </div>
  <details class="panel ln-detail"><summary><b>Lesson details</b> <span class="small muted">scores, attempts and last played</span></summary>
    <div style="overflow-x:auto"><table class="ref"><thead><tr><th>Lesson</th><th>Status</th><th>Best</th><th>Attempts</th><th>Accuracy</th><th>Last played</th></tr></thead><tbody>
    ${LN_ALL.map(l => { const r = ln.lessons[l.id] || {}, p = lnPassed(l), o = lnOpen(l);
      return `<tr><td class="t">${l.unit.name} · ${l.name}</td><td><span class="chip ${p ? 'good' : o ? 'ok' : 'new'}">${p ? (r.placed && !r.best ? 'Placed' : 'Passed') : o ? 'Open' : 'Locked'}</span></td><td>${r.attempts ? `${r.best}/${LN_PASS[l.check ? 'check' : 'lesson'][0]}` : '–'}</td><td>${r.attempts || 0}</td><td>${r.n ? pct(r.c / r.n, 0) : '–'}</td><td>${r.last ? new Date(r.last).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="small muted">Rank follows the most chips you've held. Right answers win ${LN_CHIPS.right} chips, wrong ones cost ${-LN_CHIPS.wrong}, and passing a lesson adds ${LN_CHIPS.pass} (${LN_CHIPS.repass} on a repeat).</p>
  </details>`;
}

/* ---------- lesson player ---------- */
let lnPlay = null;
function lnStart(id) {
  const l = lnById(id); if (!l) return;
  if (!lnOpen(l)) { const prev = l.li ? LN_ALL.find(x => x.ui === l.ui && x.li === l.li - 1) : LN_ALL.find(x => x.ui === l.ui - 1 && x.check); lnToast(`Pass “${prev.name}” first to unlock this lesson.`); return; }
  const [n, need] = LN_PASS[l.check ? 'check' : 'lesson'];
  lnPlay = { kind: 'lesson', l, n, need, i: 0, right: 0, chips: 0, stage: 'intro', game: mode };
  if (location.hash !== '#learn') location.hash = '#learn'; else lnShowPlay();
}
function lnPlacement() {
  lnPlay = { kind: 'pre', ui: 0, inUnit: 0, wrong: 0, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, placed: [] };
  if (location.hash !== '#learn') location.hash = '#learn'; else lnShowPlay();
}
const LN_PRE_N = 8, LN_PRE_MISS = 1; /* each unit: 8 questions, at most 1 miss to place out of it */
function lnShowPlay() {
  $('ln-dash').hidden = true; $('ln-play').hidden = false; const P = lnPlay, box = $('ln-play');
  const total = P.kind === 'pre' ? LN_UNITS.length * LN_PRE_N : P.n, done = P.kind === 'pre' ? P.ui * LN_PRE_N + P.inUnit : P.i;
  const head = `<div class="ln-top"><button type="button" class="linkbtn ln-quit" data-ln-quit>✕ Quit</button><div class="ln-bar"><i style="width:${done / total * 100}%"></i></div><span class="ln-pchips" id="ln-pchips">${P.chips >= 0 ? '+' : ''}${P.chips}</span></div>`;
  if (P.stage === 'intro') {
    box.innerHTML = P.kind === 'pre' ? `${head}<section class="panel ln-card"><span class="eyebrow">Placement test</span><h2>Find your starting point</h2>
      <p>Questions run unit by unit, starting with <b>${LN_UNITS[0].name}</b>. Get 7 of 8 in a unit and every lesson in it is unlocked and marked as placed. The test stops at the first unit where you miss two.</p>
      <p class="small muted">Preflop questions use the ${mode === 'cash' ? 'cash' : 'tournament'} charts. Switch Cash/Tournament at the top first if you want the other.</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Begin</button></div></section>`
      : `${head}<section class="panel ln-card"><span class="eyebrow">${esc(P.l.unit.name)} · ${P.l.check ? 'Checkpoint' : 'Lesson ' + (P.l.li + 1)}</span><h2>${esc(P.l.name)}</h2><div class="ln-intro">${P.l.intro}</div>
      <p class="small muted">${P.n} questions · pass with ${P.need}${P.l.unit.id === 'preflop' ? ` · ${mode === 'cash' ? 'cash (100 BB)' : 'tournament'} charts` : ''}</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Start lesson</button></div></section>`;
    return;
  }
  if (P.stage === 'q') {
    const q = P.q;
    box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${P.kind === 'pre' ? `Placement · ${LN_UNITS[P.ui].name}` : esc(P.l.name)} · ${done + 1} of ${P.kind === 'pre' ? 'up to ' + total : total}</span>
      ${q.visual ? `<div class="qz-visual">${q.visual}</div>` : ''}<div class="ln-prompt">${q.prompt}</div>
      <div class="ln-opts">${q.opts.map((o, k) => `<button type="button" class="ln-opt${P.picked != null ? (k === q.correct ? ' right' : k === P.picked ? ' wrong' : ' dim') : ''}" data-k="${k}"${P.picked != null ? ' disabled' : ''}>${o}</button>`).join('')}</div>
      ${P.picked != null ? `<div class="ln-fb ${P.picked === q.correct ? 'good' : 'bad'}"><b>${P.picked === q.correct ? pick(['Nice!', 'Correct.', 'That\'s it.', 'Well played.']) : 'Not quite.'}</b> <span class="ln-delta">${P.picked === q.correct ? '+' + LN_CHIPS.right : LN_CHIPS.wrong} chips</span><p>${q.explain}</p>
        <button class="act" type="button" data-ln-cont>Continue</button></div>` : ''}</section>`;
    if (P.picked != null) box.querySelector('[data-ln-cont]').focus({ preventScroll: true });
    return;
  }
  /* results */
  if (P.kind === 'pre') {
    const names = P.placed.map(ui => LN_UNITS[ui].name);
    box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">Placement result</span>
      <h2>${names.length ? `Placed out of ${names.length} unit${names.length > 1 ? 's' : ''}` : 'Start at the beginning'}</h2>
      <p>${names.length ? `Unlocked: <b>${names.join(', ')}</b>. ` : ''}${P.right} right answers. ${lnNext() ? `Your next lesson is <b>${lnNext().unit.name} · ${lnNext().name}</b>.` : 'Every unit so far is unlocked.'}</p>
      ${lnStacks(ln.xp, 90)}<p class="small">${P.chips >= 0 ? '+' : ''}${P.chips} chips this test · stack ${Math.round(ln.xp).toLocaleString()}</p>
      <div class="row">${lnNext() ? `<button class="act" type="button" data-ln-go="${lnNext().id}">Go to next lesson</button>` : ''}<button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
    return;
  }
  const ok = P.right >= P.need, nx = lnNext();
  box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">${esc(P.l.name)}</span>
    <h2>${ok ? (P.rankUp ? `Rank up: ${LN_RANKS[lnRank()].icon} ${LN_RANKS[lnRank()].name}!` : 'Lesson passed') : 'Not this time'}</h2>
    <p><b>${P.right} of ${P.n}</b> right. ${ok ? (P.first ? `Passing bonus +${LN_CHIPS.pass} chips.` : `Bonus +${LN_CHIPS.repass} chips.`) : `You need ${P.need} to pass. Have another go; the questions change every time.`}</p>
    ${lnStacks(ln.xp, 90)}<p class="small">${P.chips >= 0 ? '+' : ''}${P.chips} chips this lesson · stack ${Math.round(ln.xp).toLocaleString()}</p>
    ${P.miss.length ? `<details class="ln-review"><summary>Review your misses (${P.miss.length})</summary>${P.miss.map(m => `<div><span class="small muted">${esc(m.short)}</span><span>You chose <b>${m.opts[m.picked]}</b>; the answer is <b>${m.opts[m.correct]}</b>.</span><span class="small">${m.explain}</span></div>`).join('')}</details>` : ''}
    <div class="row">${ok && nx ? `<button class="act" type="button" data-ln-go="${nx.id}">Next: ${esc(nx.name)}</button>` : `<button class="act" type="button" data-ln-go="${P.l.id}">${ok ? 'Play again' : 'Try again'}</button>`}<button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
}
function lnDeal() {
  const P = lnPlay; P.picked = null;
  let q; try { q = P.kind === 'pre' ? pick(LN_UNITS[P.ui].lessons.filter(l => !l.check)).gen() : P.l.gen(); } catch (e) { console.warn(e); q = QGEN['Pot odds'](); }
  q.t0 = Date.now(); P.q = q; P.stage = 'q'; lnShowPlay(); window.scrollTo(0, $('v-learn').offsetTop - 70);
}
function lnAnswer(k) {
  const P = lnPlay, q = P.q, ok = k === q.correct; if (P.picked != null) return; P.picked = k;
  const d = ok ? LN_CHIPS.right : LN_CHIPS.wrong, before = ln.xp; lnAddChips(d); P.chips += ln.xp - before;
  ln.n++; if (ok) { ln.c++; P.right++; } else (P.miss = P.miss || []).push({ ...q, picked: k });
  if (!ln.days.includes(lnToday())) ln.days = ln.days.concat(lnToday()).slice(-60);
  if (P.kind === 'lesson') { const r = ln.lessons[P.l.id] = ln.lessons[P.l.id] || { best: 0, attempts: 0, n: 0, c: 0 }; r.n = (r.n || 0) + 1; r.c = (r.c || 0) + (ok ? 1 : 0); }
  else if (!ok) P.wrong++;
  lnSave();
  logEvent({ drill: q.drill, spot: q.spot, hand: q.hand, answer: q.opts[k], expected: q.opts[q.correct], correct: ok, detail: P.kind === 'pre' ? 'Placement test' : 'Lesson: ' + P.l.name, ms: Date.now() - q.t0 });
  lnShowPlay();
}
function lnContinue() {
  const P = lnPlay;
  if (P.kind === 'lesson') { P.i++; if (P.i < P.n) return lnDeal(); return lnFinish(); }
  P.inUnit++; P.i++;
  if (P.wrong > LN_PRE_MISS) return lnPreEnd();
  if (P.inUnit >= LN_PRE_N) {
    P.placed.push(P.ui);
    LN_UNITS[P.ui].lessons.forEach(l => { const r = ln.lessons[l.id] = ln.lessons[l.id] || { best: 0, attempts: 0, n: 0, c: 0 }; if (!r.placed && !lnPassed(LN_ALL.find(x => x.id === l.id))) { r.placed = true; lnAddChips(LN_CHIPS.placed); P.chips += LN_CHIPS.placed; } else r.placed = true; });
    lnSave(); P.ui++; P.inUnit = 0; P.wrong = 0;
    if (P.ui >= LN_UNITS.length) return lnPreEnd();
  }
  lnDeal();
}
function lnPreEnd() { const P = lnPlay; ln.pre = { ts: Date.now(), units: P.placed.length }; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini(); }
function lnFinish() {
  const P = lnPlay, r = ln.lessons[P.l.id], ok = P.right >= P.need, was = lnPassed(P.l), rank0 = lnRank();
  r.attempts++; r.best = Math.max(r.best || 0, P.right); r.last = Date.now(); P.miss = P.miss || [];
  if (ok) { const b = was ? LN_CHIPS.repass : LN_CHIPS.pass; lnAddChips(b); P.chips += b; P.first = !was; }
  P.rankUp = lnRank() > rank0; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini();
}
function lnToast(msg) { const t = $('ln-toast'); t.textContent = msg; t.hidden = false; clearTimeout(lnToast.h); lnToast.h = setTimeout(() => t.hidden = true, 2600); }

document.addEventListener('click', e => {
  const g = e.target.closest('[data-ln-go]'); if (g) { lnStart(g.dataset.lnGo); return; }
  if (e.target.closest('[data-ln-pre]')) return lnPlacement();
  if (!lnPlay) return;
  if (e.target.closest('[data-ln-begin]')) return lnDeal();
  const o = e.target.closest('#ln-play .ln-opt'); if (o) return lnAnswer(+o.dataset.k);
  if (e.target.closest('[data-ln-cont]')) return lnContinue();
  if (e.target.closest('[data-ln-dash]')) { lnPlay = null; return lnRender(); }
  const qb = e.target.closest('[data-ln-quit]');
  if (qb) { if (lnPlay.stage === 'end' || lnPlay.stage === 'intro' || qb.dataset.sure) { lnPlay = null; lnRender(); } else { qb.dataset.sure = '1'; qb.textContent = 'Tap again to quit'; } }
});
