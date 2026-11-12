/* ---------- Learn: a guided path from Fish to Crusher ----------
   Units of short lessons, unlocked in order. A lesson is a teaching card and 10 questions (pass at 8);
   each unit ends in a 12-question checkpoint (pass at 10) that unlocks the next unit.
   Every lesson has three levels: 1 Learn (clear-cut spots), 2 Practice (the full mix), 3 Master (the closest spots,
   on the shot clock an admin sets in Settings, plus an optional time bank).
   Passed lessons come back for review after 1, 3, 7, 14, 30 and 60 days; "Weak spots" mixes the lessons for the
   areas where your answer history (trainers included) is weakest. Passing level 1 unlocks the next lesson; levels 2 and 3 earn stars and more chips.
   Questions come from the same engine the trainers use (evaluator, equity, charts).
   Chips: right answers win chips, wrong ones cost 5 (never below zero), passing adds a bonus.
   Rank follows the most chips you have ever held, so a bad lesson shrinks the stack but never demotes you.
   Progress is saved under LNKEY, which syncs to the cloud with the other settings. */
const LNKEY = 'holdem-learn-v1';
const LN_PASS = { lesson: [10, 8], check: [12, 10] };
const LN_LV = [null,
  { name: 'Learn', line: 'Clear-cut spots to build the habit.', right: 10, pass: 50 },
  { name: 'Practice', line: 'The full mix, like real play.', right: 15, pass: 75 },
  { name: 'Master', line: 'The closest spots, on the shot clock.', right: 20, pass: 100, clock: true }];
const lnLvLine = k => k === 3 ? `The closest spots, ${APPCFG.shot} seconds each${APPCFG.bankOn ? ` plus a ${APPCFG.bank}-second time bank` : ''}.` : LN_LV[k].line;
const LN_RV = [1, 3, 7, 14, 30, 60], LN_DAY = 864e5;   /* review gaps in days */
const LN_CHIPS = { wrong: -5, repass: 10, placed: 30, review: 25 };
const LN_RANKS = [
  { name: 'Fish', at: 0, icon: '🐟', line: 'Learning the rules of the table.' },
  { name: 'Rookie', at: 300, icon: '🃏', line: 'Knows the basics and starting to see the math.' },
  { name: 'Grinder', at: 1000, icon: '⚙️', line: 'Solid fundamentals, putting in the volume.' },
  { name: 'Regular', at: 2500, icon: '🎯', line: 'Thinks in prices, ranges and positions.' },
  { name: 'Shark', at: 5000, icon: '🦈', line: 'Reads hands and adjusts to opponents.' },
  { name: 'Crusher', at: 9000, icon: '👑', line: 'Plays every street with a plan.' },
];

/* ---------- helpers ---------- */
const lnCat = v => Math.floor(v / B5);
const lnSortCards = a => a.slice().sort((x, y) => (y >> 2) - (x >> 2) || (x & 3) - (y & 3));
const lnHandBox = (label, cs) => `<div><span class="lbl">${label}</span><div class="cards">${cardsHTML(cs)}</div></div>`;
/* the best five cards out of 5 to 7 */
function lnBest5(cs) {
  let bv = -1, bh = null; const cur = [];
  const go = i => { if (cur.length === 5) { const v = evalHand(cur); if (v > bv) { bv = v; bh = cur.slice(); } return; }
    for (let k = i; k <= cs.length - (5 - cur.length); k++) { cur.push(cs[k]); go(k + 1); cur.pop(); } };
  go(0);
  const cnt = {}; bh.forEach(c => cnt[c >> 2] = (cnt[c >> 2] || 0) + 1);   /* show the made part first: K K A Q 8, not A K K Q 8 */
  return { v: bv, cards: bh.slice().sort((x, y) => cnt[y >> 2] - cnt[x >> 2] || (y >> 2) - (x >> 2) || (x & 3) - (y & 3)) };
}
/* a random five-card hand of a given category (0 high card ... 8 straight flush) */
function lnMakeCat(k) {
  const s4 = () => Math.floor(Math.random() * 4), ranks = n => shuffle([...Array(13).keys()]).slice(0, n);
  for (;;) {
    let h;
    if (k <= 3) h = shuffled().slice(0, 5);
    else if (k === 4 || k === 8) { const top = 3 + Math.floor(Math.random() * 10), suit = s4(); h = [0, 1, 2, 3, 4].map(i => top - i < 0 ? 12 : top - i).map(r => r * 4 + (k === 8 ? suit : s4())); }
    else if (k === 5) { const suit = s4(); h = ranks(5).map(r => r * 4 + suit); }
    else if (k === 6) { const [t, p] = ranks(2); h = shuffle([0, 1, 2, 3]).slice(0, 3).map(s => t * 4 + s).concat(shuffle([0, 1, 2, 3]).slice(0, 2).map(s => p * 4 + s)); }
    else { const [q, x] = ranks(2); h = [0, 1, 2, 3].map(s => q * 4 + s).concat(x * 4 + s4()); }
    if (lnCat(evalHand(h)) === k) return lnSortCards(h);
  }
}
const LN_ORDER = `<span class="small">Ranking, high to low: ${CAT.slice().reverse().join(' › ')}.</span>`;

/* ---------- Basics ---------- */
function lnRankings(lvl) {
  if (lvl === 1) {
    const mix = [[5, 4], [6, 5], [3, 2], [4, 3], [2, 1], [7, 6], [5, 3]];
    let [a, b] = Math.random() < .6 ? pick(mix) : shuffle([...Array(9).keys()]).slice(0, 2); if (Math.random() < .5) [a, b] = [b, a];
    return { drill: 'Hand rankings', spot: 'Categories', hand: `${CAT[a]} vs ${CAT[b]}`,
      prompt: '<p class="spot-text">Which hand ranks higher?</p>', opts: [CAT[a], CAT[b]], correct: a > b ? 0 : 1, short: `${CAT[a]} vs ${CAT[b]}`,
      explain: `<b>${CAT[Math.max(a, b)]}</b> beats ${CAT[Math.min(a, b)].toLowerCase()}. ${LN_ORDER}` };
  }
  const w = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8];
  let a = pick(w), b = pick(w); while (lvl === 2 && a === b) b = pick(w); if (lvl === 3) b = a;
  const A = lnMakeCat(a); let B = lnMakeCat(b); while (B.some(c => A.includes(c))) B = lnMakeCat(b);
  const va = evalHand(A), vb = evalHand(B), corr = va > vb ? 0 : va < vb ? 1 : 2;
  return { drill: 'Hand rankings', spot: lvl === 3 ? 'Same type' : 'Two hands', hand: `${CAT[a]} vs ${CAT[b]}`,
    prompt: `<div class="hands">${lnHandBox('Hand A', A)}${lnHandBox('Hand B', B)}</div><p class="spot-text">Which hand is stronger?</p>`,
    opts: lvl === 3 ? ['Hand A', 'Hand B', 'They tie'] : ['Hand A', 'Hand B'], correct: corr, short: `${names(A)} vs ${names(B)}`,
    explain: a !== b ? `Hand A is <b>${CAT[a].toLowerCase()}</b>, Hand B is <b>${CAT[b].toLowerCase()}</b>. ${LN_ORDER}`
      : `Both are <b>${CAT[a].toLowerCase()}</b>. ${corr === 2 ? 'Every card that counts is the same rank, so it is a tie (suits never break ties).' : `Compare the cards that make the hand first, then the kickers from highest down: <b>Hand ${corr ? 'B' : 'A'}</b> is higher.`}` };
}
function lnShowdown(lvl) {
  for (;;) {
    const d = shuffled(), hero = d.slice(0, 2), vil = d.slice(2, 4), board = d.slice(4, 9), hv = evalHand(hero.concat(board)), vv = evalHand(vil.concat(board)), ch = lnCat(hv), cv = lnCat(vv);
    if (lvl === 1 && Math.abs(ch - cv) < 2) continue;
    if (lvl === 2 && (ch === cv || Math.max(ch, cv) < 1)) continue;
    if (lvl === 3 && (ch !== cv || ch < 1 || (Math.random() < .3 && hv !== vv))) continue;
    const bh = lnBest5(hero.concat(board)), bvl = lnBest5(vil.concat(board)), corr = hv > vv ? 0 : hv < vv ? 1 : 2;
    return { drill: 'Which hand wins', spot: lvl === 3 ? 'Same type' : 'Showdown', hand: `${names(hero)} vs ${names(vil)}`,
      prompt: `<div class="hands">${lnHandBox('You', hero)}${lnHandBox('Villain', vil)}</div><div class="hands">${lnHandBox('Board', board)}</div><p class="spot-text">Showdown on the river. Who wins?</p>`,
      opts: ['You', 'Villain', 'Split pot'], correct: corr, short: `${names(hero)} vs ${names(vil)} on ${names(board)}`,
      explain: `You: <b>${catName(hv).toLowerCase()}</b> <span class="outs">${cardsHTML(bh.cards, 'xs')}</span><br>Villain: <b>${catName(vv).toLowerCase()}</b> <span class="outs">${cardsHTML(bvl.cards, 'xs')}</span><br>${corr === 2 ? 'The best five cards are the same rank for both players, so the pot is split.' : ch === cv ? 'Same hand type, so the higher cards decide, then kickers.' : 'Each player uses their best five of the seven cards.'}` };
  }
}
const LN_PRE = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'], LN_POST = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
function lnPosTable(hero, ask, folded, center) {
  const seats = {}; POS.forEach(p => seats[p] = { state: folded.includes(p) ? 'folded' : 'wait', tag: folded.includes(p) ? 'Fold' : ask.includes(p) ? '?' : '', bet: 0 });
  seats.SB.bet = .5; seats.BB.bet = 1; return tableSnap({ hero, seats, center: `<span class="small">${center}</span>` });
}
function lnPositions(lvl) {
  const t = pick(lvl === 1 ? ['blind', 'blind', 'pre1', 'behind'] : lvl === 2 ? ['pre', 'post', 'post', 'behind', 'ip'] : ['post', 'ip', 'behind', 'postbehind', 'postbehind']);
  if (t === 'blind') {
    const [role, ans, why] = pick([['posts the small blind', 'SB', 'The small blind sits just left of the button.'], ['posts the big blind', 'BB', 'The big blind sits two seats left of the button.'],
      ['has the dealer button', 'BTN', 'The button is the dealer seat. It acts last on every street after the flop.'], ['is "under the gun"', 'UTG', 'UTG sits left of the big blind and acts first before the flop, with a "gun" of players behind.'],
      ['acts last before the flop', 'BB', 'The big blind acts last preflop because its blind is already in: it gets to close the action.'], ['acts last after the flop', 'BTN', 'The button acts last on the flop, turn and river. That\'s why it is the best seat.'],
      ['sits just right of the button (the cutoff)', 'CO', 'The cutoff "cuts off" the button. It is the second-best seat.'], ['sits two seats right of the button (the hijack)', 'HJ', 'The hijack sits right of the cutoff, between UTG and the cutoff in a 6-player game.']]);
    const opts = shuffle([ans, ...shuffle(POS.filter(p => p !== ans)).slice(0, 3)]);
    return { drill: 'Positions', spot: 'Seats', hand: ans, visual: lnPosTable('CO', [], [], 'The seats, clockwise: UTG, HJ, CO, BTN, SB, BB'),
      prompt: `<p class="spot-text">Which seat ${role}?</p>`, opts, correct: opts.indexOf(ans), short: `Who ${role}`, explain: `<b>${ans}</b> (${POSNAME[ans]}). ${why}` };
  }
  const list = (a, w = 'and') => a.length === 2 ? a.join(` ${w} `) : a.slice(0, -1).join(', ') + ` ${w} ` + a[a.length - 1];
  if (t === 'pre1' || t === 'pre') {
    /* everyone is still in before the flop, so name the seats being compared */
    const set = t === 'pre1' ? shuffle(['UTG', 'BB', 'SB', pick(['HJ', 'CO', 'BTN'])]) : shuffle(POS).slice(0, 3), ans = set.slice().sort((a, b) => LN_PRE.indexOf(a) - LN_PRE.indexOf(b))[0];
    return { drill: 'Positions', spot: 'Order before the flop', hand: set.join(','), visual: lnPosTable('BB', set, [], 'Before the flop'),
      prompt: `<p class="spot-text"><b>Before the flop</b>, which acts first: ${list(set.map(x => `<b>${x}</b>`), 'or')}?</p>`, opts: set, correct: set.indexOf(ans), short: `Preflop first of ${set.slice().sort().join(', ')}`,
      explain: `Before the flop the blinds have already posted, so action starts with UTG: ${LN_PRE.join(' → ')}. Of these, <b>${ans}</b> is earliest.` };
  }
  if (t === 'post' || t === 'postbehind') {
    /* a real hand: these players see the flop, everyone else folded */
    const set = shuffle(POS).slice(0, lvl === 3 ? pick([3, 4]) : 3), inOrder = set.slice().sort((a, b) => LN_POST.indexOf(a) - LN_POST.indexOf(b)), out = POS.filter(p => !set.includes(p));
    const skipped = LN_POST.slice(0, LN_POST.indexOf(inOrder[0])), why = `After the flop, action goes ${LN_POST.join(' → ')}, skipping anyone who folded${skipped.length ? ` (here the ${list(skipped)} folded)` : ''}.`;
    if (t === 'post') return { drill: 'Positions', spot: 'Order after the flop', hand: set.join(','), visual: lnPosTable('BB', set, out, 'On the flop'),
      prompt: `<p class="spot-text">The ${list(set.map(x => `<b>${x}</b>`))} see the flop; everyone else folded. Who acts <b>first</b> on the flop?</p>`, opts: set, correct: set.indexOf(inOrder[0]), short: `Flop first of ${set.slice().sort().join(', ')}`,
      explain: `${why} So <b>${inOrder[0]}</b> acts first and ${inOrder[inOrder.length - 1]} acts last.` };
    const hero = pick(set), ans = inOrder.length - 1 - inOrder.indexOf(hero), opts = [0, 1, 2, 3].slice(0, Math.max(3, set.length));
    return { drill: 'Positions', spot: 'Players after you on the flop', hand: hero, visual: lnPosTable(hero, set.filter(x => x !== hero), out, 'On the flop'),
      prompt: `<p class="spot-text">You're in the <b>${POSNAME[hero]}</b> and see the flop with the ${list(set.filter(x => x !== hero).map(x => `<b>${x}</b>`))}. How many players act <b>after you</b> on the flop?</p>`,
      opts: opts.map(String), correct: opts.indexOf(ans), short: `After the ${hero} with ${set.slice().sort().join(', ')}`,
      explain: `${why} Order on this flop: ${inOrder.join(' → ')}. <b>${ans}</b> act${ans === 1 ? 's' : ''} after you${ans === 0 ? ': you are last to act, in position on everyone' : ''}.` };
  }
  if (t === 'ip') {
    const [a, b] = shuffle(POS).slice(0, 2), ans = LN_POST.indexOf(a) > LN_POST.indexOf(b) ? a : b, oop = ans === a ? b : a;
    return { drill: 'Positions', spot: 'In position', hand: `${a} vs ${b}`, visual: lnPosTable('BB', [a, b], POS.filter(p => p !== a && p !== b), 'Heads up to the flop'),
      prompt: `<p class="spot-text">The <b>${a}</b> and the <b>${b}</b> see a flop heads up. Who is <b>in position</b>?</p>`, opts: [a, b], correct: ans === a ? 0 : 1, short: `${a} vs ${b}`,
      explain: `<b>${ans}</b> is in position: after the flop it acts after the ${oop}, on every street. Order after the flop: ${LN_POST.join(' → ')}.` };
  }
  const hero = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB']), i = LN_PRE.indexOf(hero), ans = 5 - i, opts = shuffle([1, 2, 3, 4, 5].filter(n => n !== ans)).slice(0, 3).concat(ans).sort((x, y) => x - y);
  return { drill: 'Positions', spot: 'Players behind', hand: hero, visual: lnPosTable(hero, [], LN_PRE.slice(0, i), 'Folds to you'),
    prompt: `<p class="spot-text">Everyone folds to you in the <b>${POSNAME[hero]}</b>. How many players are still to act behind you?</p>`, opts: opts.map(String), correct: opts.indexOf(ans), short: `Behind the ${hero}`,
    explain: `<b>${ans}</b>: ${LN_PRE.slice(i + 1).join(', ')}. The more players behind you, the more likely one of them has a strong hand, which is why early seats play tighter.` };
}
function lnNameHand(lvl) {
  const n = lvl === 1 ? 3 : lvl === 2 ? 4 : 5;
  for (;;) {
    const d = shuffled(), hero = d.slice(0, 2), board = d.slice(2, 2 + n), v = evalHand(hero.concat(board)), k = lnCat(v);
    if (lvl === 1 && k === 0 && Math.random() < .7) continue;
    if (lvl === 3 && k < 2 && Math.random() < .75) continue;
    const near = [k - 2, k - 1, k + 1, k + 2].filter(x => x >= 0 && x <= 8), opts = shuffle([k, ...shuffle(near).slice(0, 3)]).sort((a, b) => a - b), b5 = lnBest5(hero.concat(board));
    const boardOnly = n === 5 && evalHand(board) === v;
    return { drill: 'Name your hand', spot: ['Flop', 'Turn', 'River'][n - 3], hand: names(hero),
      prompt: `<div class="hands">${lnHandBox('You', hero)}${lnHandBox(['Flop', 'Turn', 'River'][n - 3], board)}</div><p class="spot-text">What is your best hand?</p>`,
      opts: opts.map(x => CAT[x]), correct: opts.indexOf(k), short: `${names(hero)} on ${names(board)}`,
      explain: `<b>${CAT[k]}</b>: <span class="outs">${cardsHTML(b5.cards, 'xs')}</span>${boardOnly ? ' The board alone makes this hand, so your hole cards don\'t improve it ("the board plays").' : [1, 2, 3, 6, 7].includes(k) && b5.cards.filter(c => b5.cards.filter(x => x >> 2 === c >> 2).length > 1).every(c => board.includes(c)) ? ` The ${CAT[k].toLowerCase()} is all on the board, so every player has it too; your cards only count as kickers.` : ''}` };
  }
}

/* ---------- lesson question makers built on the trainers ---------- */
function lnPF(re, game) {
  return lvl => {
    const pool = SPOTS.filter(s => s.game === (game || mode) && re.test(s.id)), spot = pick(pool), bnd = new Set(spot.boundary || []);
    let label, cards;
    if (lvl === 3 && bnd.size) { label = pick([...bnd]); cards = comboFor(label); }
    else if (lvl === 1) {
      const play = [...spot.map].filter(([l, a]) => a !== spot.fold && !bnd.has(l)).map(([l]) => l);
      if (play.length && Math.random() < .5) { label = pick(play); cards = comboFor(label); }
      else for (let i = 0; i < 300; i++) { cards = shuffled().slice(0, 2); label = labelOf(cards[0], cards[1]); if (!bnd.has(label)) break; }
    } else ({ label, cards } = dealSpotHand(spot, 0));
    if (cards[0] >> 2 < cards[1] >> 2) cards.reverse();
    const exp = spot.map.get(label) ?? spot.fold;
    return { drill: 'Preflop', spot: spot.name, hand: label, visual: tableSnap({ ...spotTable(spot), heroCards: cards }),
      prompt: `<p class="spot-text"><b>${spot.name}.</b> ${spotText(spot)}</p>`, opts: spot.acts, correct: exp, short: `${spot.name}, ${label}`, explain: pfWhy(spot, label, exp) };
  };
}
const lnSpread = (r, lvl, extra = []) => lvl === 3 ? [r + 2, r - 2, r + 3, r - 3, r + 4, ...extra] : lvl === 1 ? [r + 12, r - 12, r + 18, ...extra] : [r + 7, r - 7, r + 12, ...extra];
function lnPO(fr) {
  return lvl => {
    newStakes(); const pot = makePot(4, 40), bet = makeBet(pot, pick(fr[lvl - 1])), req = bet / (pot + 2 * bet), r = Math.round(req * 100);
    const { opts, correct } = numOpts(r, lnSpread(r, lvl, [Math.round(bet / (pot + bet) * 100), Math.round(bet / pot * 100)]).filter(x => x > 0 && x < 95));
    return { drill: 'Pot odds', spot: nearestRef(bet / pot) + ' bet', hand: '',
      prompt: `<p class="spot-text">The pot is <b>${money(pot)}</b>. Villain bets <b>${money(bet)}</b>${lvl < 3 ? ` (${Math.round(bet / pot * 100)}% of the pot)` : ''}. What equity do you need to call?</p>`,
      opts: opts.map(o => o + '%'), correct, short: `Pot ${money(pot)}, bet ${money(bet)}`,
      explain: `Your call ÷ the final pot: ${money(bet)} ÷ (${money(pot)} + ${money(bet)} + ${money(bet)}) = <b>${pct(req)}</b>.` };
  };
}
function lnOuts(lvl) {
  for (;;) {
    const d = shuffled(), hero = d.slice(0, 2), vil = d.slice(2, 4), board = d.slice(4, 8);
    if (evalHand(hero.concat(board)) >= evalHand(vil.concat(board))) continue;
    const outs = outsFor(hero, vil, board), n = outs.length;
    if (lvl === 1 ? ![4, 8, 9].includes(n) : lvl === 3 ? n < 6 || n > 20 : n < 2 || n > 20) continue;
    const { opts, correct } = numOpts(n, (lvl === 3 ? [n - 1, n + 1, n - 2, n + 2, n - 3] : lvl === 1 ? [n - 4, n + 4, n + 5, n - 5] : [n - 4, n - 2, n + 2, n + 4, n + 3, n - 3]).filter(x => x >= 0));
    return { drill: 'Counting outs', spot: n <= 5 ? 'Turn, small draw' : n <= 10 ? 'Turn, medium draw' : 'Turn, big draw', hand: names(hero) + ' vs ' + names(vil),
      prompt: `<div class="hands">${lnHandBox('You', hero)}${lnHandBox('Villain', vil)}</div><div class="hands">${lnHandBox('Turn', board)}</div><p class="spot-text">How many river cards put you ahead?</p>`,
      opts: opts.map(String), correct, short: `${names(hero)} vs ${names(vil)} on ${names(board)}`,
      explain: `${n} outs: <span class="outs">${cardsHTML(outs, 'xs')}</span>` };
  }
}
/* rule of 2 and 4: outs × 4 with two cards to come (all in on the flop), outs × 2 with one */
function lnRule(lvl = 2) {
  const n = pick(lvl === 1 ? [4, 8, 9] : lvl === 2 ? [4, 5, 6, 8, 9, 10, 12] : [5, 6, 7, 10, 11, 12, 14, 15]), flop = lvl === 1 ? false : Math.random() < .5, est = n * (flop ? 4 : 2);
  const exact = flop ? 1 - ((47 - n) * (46 - n)) / (47 * 46) : n / 46;
  const { opts, correct } = numOpts(est, (lvl === 3 ? [flop ? n * 2 : n * 4, est + 4, est - 4, est + 6, est - 6] : [flop ? n * 2 : n * 4, est + 10, est - 10, est + 5, Math.round(n / 52 * 100)]).filter(x => x > 0 && x < 100));
  return { drill: 'Rule of 2 and 4', spot: flop ? 'Flop, all in' : 'Turn', hand: n + ' outs',
    prompt: `<p class="spot-text">You have <b>${n} outs</b> ${flop ? 'on the <b>flop</b> and you are all in, so you see the turn <i>and</i> the river' : 'on the <b>turn</b>, with one card to come'}. Roughly what is your equity?</p>`,
    opts: opts.map(o => o + '%'), correct, short: `${n} outs, ${flop ? 'flop all in' : 'turn'}`,
    explain: `${n} × ${flop ? 4 : 2} ≈ <b>${est}%</b>. The exact figure is ${pct(exact)}.${flop && n > 8 ? ' With lots of outs the ×4 shortcut runs a little high.' : ''}` };
}
function lnMatch(lvl) {
  const pool = lvl === 1 ? MU.filter(m => ['pp-hi', 'pp-overs', 'overs', 'dom'].includes(m.id)) : MU;
  const [h0, h1, c] = dealMatchup(pick(pool).id), first = Math.random() < .5, hero = first ? h0 : h1, vil = first ? h1 : h0, eq = equity(hero, vil, [], 20000).eq;
  const v = Math.min(95, Math.max(5, Math.round(eq * 20) * 5)), { opts, correct } = numOpts(v, (lvl === 3 ? [v - 5, v + 5, v - 10, v + 10] : lvl === 1 ? [v - 30, v + 30, v - 20, v + 20] : [v - 20, v - 10, v + 10, v + 20, v - 15, v + 15]).filter(x => x > 0 && x < 100)), m = MUBY[c.id];
  return { drill: 'Matchups', spot: m.name, hand: names(hero) + ' vs ' + names(vil),
    prompt: `<div class="hands">${lnHandBox('You', hero)}${lnHandBox('Villain', vil)}</div><p class="spot-text">All in preflop. Your equity is closest to:</p>`,
    opts: opts.map(o => o + '%'), correct, short: `${names(hero)} vs ${names(vil)}`,
    explain: (() => { const r = muRule(hero, vil); return `${m.name}: the favorite wins about ${r.rule}%, and you are the ${r.fav === 0 ? 'favorite' : 'underdog'}.${r.note ? ' ' + r.note : ''} Exact: ${pct(eq)}.`; })() };
}
function lnCF(lvl) {
  let c; for (let i = 0; i < 40; i++) { c = genCF(lvl === 1 ? .12 : lvl === 2 ? .03 : .01); if (lvl < 3 || Math.abs(c.e.eq - c.req) < .07) break; }
  const v = cfReview(c);
  return { drill: 'Call or fold', spot: (c.street === 3 ? 'Flop shove' : 'Turn bet') + (c.behind ? ', drawing' : ', ahead'), hand: names(c.hero) + ' vs ' + names(c.vil),
    visual: tableSnap({ ...cfTable(c), heroCards: c.hero, shown: { [c.vp]: ['back', 'back'] } }),
    prompt: `<p class="spot-text">${c.street === 3 ? 'Flop' : 'Turn'}. Villain ${c.street === 3 ? 'shoves' : 'bets'} ${money(c.bet)} into ${money(c.pot)}. Your read: villain has <b>${cfRead(c)}</b>.</p>`,
    opts: ['Call', 'Fold'], correct: v.best === 'Call' ? 0 : 1, short: `${names(c.hero)} vs ${names(c.vil)} on ${names(c.board)}`,
    explain: `Villain had ${names(c.vil)}. You need ${pct(c.req)} and have ${pct(c.e.eq)}${c.behind ? ` (${v.hOuts.length} outs)` : ''}.` };
}

/* ---------- Reading ranges ---------- */
const lnPctOpts = (v, lvl) => numOpts(v, (lvl === 3 ? [v - 5, v + 5, v - 10, v + 10] : lvl === 1 ? [v - 20, v + 20, v - 30, v + 30] : [v - 10, v + 10, v - 20, v + 20, v - 15, v + 15]).filter(x => x > 0 && x < 100));
const lnRound5 = x => Math.min(95, Math.max(5, Math.round(x * 20) * 5));
function lnCB(lvl) {
  const type = pick(lvl === 1 ? ['basics'] : lvl === 2 ? ['basics', 'removal', 'removal', 'range'] : ['removal', 'range', 'bluffs', 'bluffs']), q = CB_GEN[type](), a = q.answer, pc = q.unit === '%';
  const d = pc ? (lvl === 3 ? [5, 10] : [10, 15, 20]) : (lvl === 3 ? [1, 2, 3] : lvl === 1 ? [3, 6] : [2, 3, 6]);
  const cands = d.flatMap(x => [a - x, a + x]).filter(x => x >= 0 && (!pc || x < 100)), opts = [a];
  for (const c of shuffle(cands)) if (opts.length < 4 && !opts.includes(c)) opts.push(c);
  const o = shuffle(opts);
  return { drill: 'Combinatorics', spot: CB_TYPES[type], hand: names(q.hero) + (q.board.length ? ' | ' + names(q.board) : ''),
    prompt: `${q.hero.length ? `<div class="hands">${lnHandBox('You', q.hero)}${q.board.length ? lnHandBox('Board', q.board) : ''}</div>` : ''}<p class="spot-text">${q.q}</p>`,
    opts: o.map(x => x + (pc ? '%' : '')), correct: o.indexOf(a), short: CB_TYPES[type], explain: q.why };
}
function lnRVB(lvl) {
  const r = pick([['cash-btn-open|0', 'button open'], ['cash-bb-vs-btn-open|1', 'big blind call vs a button open'], ['cash-co-open|0', 'cutoff open'], ['cash-bb-vs-co-open|1', 'big blind call vs a cutoff open'], ['cash-utg-open|0', 'UTG open']]);
  const board = shuffled().slice(0, 3), A = rvbAnalyze(presetRange(r[0]), board), actual = A.tpplus / A.n, v = lnRound5(actual), { opts, correct } = lnPctOpts(v, lvl);
  return { drill: 'Range vs board', spot: texture(board).replace(/^\S+ /, ''), hand: names(board),
    prompt: `<div class="hands">${lnHandBox('Flop', board)}</div><p class="spot-text">How often does a <b>${r[1]}</b> range have <b>top pair or better</b> on this flop?</p>`,
    opts: opts.map(o => o + '%'), correct, short: `${r[1]} on ${names(board)}`,
    explain: `${pct(actual)} of the live combos (${A.tpplus} of ${A.n}) have top pair or better; ${pct(A.strong / A.n)} have two pair or better. High cards connect with opening ranges; low, connected boards hit calling ranges more.` };
}
function lnHVR(lvl) {
  const g = mode === 'cash' ? 'cash' : 'tour', spots = SPOTS.filter(s => s.game === g); let s, act, labels;
  for (let t = 0; t < 30; t++) { s = pick(spots); const acts = s.acts.filter((a, i) => i !== s.fold); act = acts.length > 1 ? pick(acts) : null; labels = eqSpotLabels(s.id, act); if (labels.reduce((a, l) => a + combosOf(l), 0) >= 40) break; }
  const street = lvl === 1 ? 0 : lvl === 2 ? (Math.random() < .5 ? 0 : 3) : 3; let hero, board, combos;
  for (let t = 0; t < 50; t++) { const d = shuffled(); hero = d.slice(0, 2); board = d.slice(2, 2 + street); const dead = new Set([...hero, ...board]);
    combos = labels.flatMap(labelCombos).filter(c => !dead.has(c[0]) && !dead.has(c[1])); if (combos.length >= 20) break; }
  const eq = equityVsRange(hero, combos, board, street ? 3000 : 5000).eq, v = lnRound5(eq), { opts, correct } = lnPctOpts(v, lvl);
  return { drill: 'Hand vs range', spot: street ? 'Flop' : 'Preflop', hand: names(hero),
    prompt: `<div class="hands">${lnHandBox('You', hero)}${board.length ? lnHandBox('Flop', board) : ''}</div><p class="spot-text">Villain's range: <b>${esc(eqRangeName(s.id, act))}</b>. Your equity against the <b>whole range</b> is closest to:</p><details class="ln-range"><summary class="small">See the range</summary>${eqGrid(labels)}</details>`,
    opts: opts.map(o => o + '%'), correct, short: `${names(hero)}${board.length ? ' on ' + names(board) : ''} vs ${eqRangeName(s.id, act)}`,
    explain: `Against all ${combos.length} live combos you have <b>${pct(eq)}</b>. Think in parts: which hands in the range you beat, which you flip with, and which crush you, weighted by how many combos each has.` };
}
/* ---------- Flop play ---------- */
function lnTX(k) {
  return lvl => {
    let t, S;
    for (let i = 0; i < 8; i++) { t = txMake(); S = txSolve(t, 5000);
      const edge = k === 'range' ? Math.min(Math.abs(S.eq - .53), Math.abs(S.eq - .47)) : k === 'nuts' ? Math.abs(S.sP - S.sC) : 1;
      if (lvl === 1 ? edge >= .03 || k === 'plan' && S.range !== 'even' : lvl === 3 ? edge < .03 || k === 'plan' && S.range === 'even' : true) break; }
    const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' });
    seats[t.P] = { state: 'hero', tag: 'Raiser', stack: '', bet: '' }; seats[t.C] = { state: 'vil', tag: 'Caller', stack: '', bet: '' };
    const Q = TX_Q[k], ans = S.right[k], why = txWhy(S)[k];
    return { drill: 'Board texture', spot: Q.label, hand: names(t.board), visual: tableSnap({ hero: t.P, seats, center: `<div class="cards">${cardsHTML(t.board, 'xs')}</div><b>${fmtBB(t.sc.pot)} BB</b><span>${t.sc.three ? '3-bet pot' : 'Flop pot'}</span>` }),
      prompt: `<p class="spot-text"><b>${t.sc.name}.</b> ${S.T.word[0].toUpperCase() + S.T.word.slice(1)} flop. ${Q.q}</p>`,
      opts: Q.opts.map(o => o[1]), correct: Q.opts.findIndex(o => o[0] === ans), short: `${t.sc.name}, ${names(t.board)}`, explain: why };
  };
}
/* ---------- Bigger pots ---------- */
function lnPT(kinds) {
  return lvl => {
    const q = PT_GEN[pick(kinds)]();
    let opts, correct;
    if (q.slider) { const v = lnRound5(q.answer); ({ opts, correct } = lnPctOpts(v, lvl)); opts = opts.map(o => o + '%'); } else { opts = q.opts; correct = q.correct; }
    return { drill: '3-bet & multiway', spot: PT_KINDS[q.kind].label, hand: q.label || (q.hero ? names(q.hero) : ''), visual: q.table ? tableSnap(q.table) : '',
      prompt: `<div class="spot-text">${q.prompt}</div>`, opts, correct, short: PT_KINDS[q.kind].label, explain: q.why };
  };
}
/* ---------- Exploits ---------- */
const LN_XP_EASY = ['Tight passive (nit)', 'Loose passive (calling station)', 'Maniac'];
function lnXP(fams) {
  return lvl => {
    let q;
    for (let i = 0; i < 30; i++) { const style = pick(lvl === 1 ? LN_XP_EASY : Object.keys(XP_TYPES)); q = xpMake(style, null, pick(fams));
      const ev = Object.values(q.ev).sort((a, b) => b - a), gap = ev[0] - ev[1];
      if (lvl === 1 ? gap > .1 * q.P : lvl === 3 ? gap > .25 && gap < Math.max(1, .1 * q.P) : gap > .25) break; }
    const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' });
    seats.BTN = { state: 'hero', tag: 'You', stack: '', bet: '' }; seats.BB = { state: 'vil', tag: q.style.split(' (')[0].slice(0, 12), stack: '', bet: q.fam === 'catch' ? fmtBB(q.b) + ' BB' : '' };
    const keys = q.opts.map(o => o[0]), r1 = x => fmtBB(Math.round(x * 10) / 10);
    return { drill: 'Exploit', spot: `${XP_FAM[q.fam]} vs ${q.style}`, hand: names(q.hero),
      visual: tableSnap({ hero: 'BTN', seats, heroCards: q.hero, center: `<div class="cards">${cardsHTML(q.board, 'xs')}</div><b>${fmtBB(q.P)} BB</b><span>pot</span>` }),
      prompt: `<p class="spot-text"><b>Opponent:</b> ${q.style.toLowerCase()}, who ${q.T.blurb.replace(/\.?$/, '.')}</p><p class="spot-text">${q.text}</p>`,
      opts: q.opts.map(o => o[1]), correct: keys.indexOf(q.best), okIdx: keys.map((k, i) => Math.abs(q.ev[k] - q.ev[q.best]) < .25 ? i : -1).filter(i => i >= 0),
      short: `${XP_FAM[q.fam]} vs ${q.style}`,
      explain: `Expected value against this player: ${q.opts.map(([k, t]) => `${t.replace(/ \(.*\)/, '')} <b>${r1(q.ev[k])} BB</b>`).join(', ')}. ${q.balanced}` };
  };
}
/* ---------- Tournaments: ICM ---------- */
function lnICM(lvl) {
  const n = lvl === 1 ? 3 : lvl === 2 ? pick([3, 4]) : pick([4, 5]), pay = { 3: ['50/30/20', '65/35'], 4: ['40/30/20/10', '45/27/18/10', '50/30/20'], 5: ['35/25/18/12/10', '40/30/20/10'] }[n];
  const pk = pick(pay), prizes = ICM_PAY[pk], stacks = Array.from({ length: n }, () => (2 + Math.floor(Math.random() * 37)) * 500), tot = stacks.reduce((a, b) => a + b, 0);
  const eq = icmEquity(stacks, prizes)[0], chip = stacks[0] / tot * 100, v = Math.round(eq);
  const cands = [Math.round(chip), v + 4, v - 4, v + 7, v - 7, v + 2, v - 2].filter(x => x > 0 && x < 100 && Math.abs(x - v) >= (lvl === 3 ? 2 : 3));
  const { opts, correct } = numOpts(v, cands);
  return { drill: 'ICM', spot: `${n} left, ${pk}`, hand: stacks.join('/'),
    prompt: `<p class="spot-text"><b>${n} players left</b>, payouts ${pk} (% of the prize pool). Stacks: <b>you ${stacks[0].toLocaleString()}</b>, ${stacks.slice(1).map(x => x.toLocaleString()).join(', ')}. What share of the prize pool are your chips worth?</p>`,
    opts: opts.map(o => o + '%'), correct, short: `${n} left, stacks ${stacks.join('/')}`,
    explain: `ICM says <b>${eq.toFixed(1)}%</b>. Your share of the chips is ${chip.toFixed(1)}%, but chips aren't money: ${eq < chip ? 'a big stack is worth less than its chip share, because first place pays a capped amount' : 'a short stack is worth more than its chip share, because you already have a shot at the paid places'}.` };
}

/* ---------- Reading hands: one hand, street by street ----------
   The same model as the Hand reading trainer: the opponent opens, you call in the big blind and check to them,
   and each bet or check re-weights every combo by how likely that hand is to act that way.
   Returns a chain of questions (one per street, then the read); the lesson player asks them in order. */
function lnRDHand(lvl, parts = 'all') {
  const g = mode === 'cash' ? 'cash' : 'tour', [openId, callId, vName] = pick(RD_SPOTS[g]), type = lvl === 1 ? pick(['nit', 'aggro']) : pick(Object.keys(RD_TYPES));
  const vLabels = eqSpotLabels(openId), hLabels = eqSpotLabels(callId, 'Call');
  const hero = pick(hLabels.flatMap(labelCombos)), all = vLabels.flatMap(labelCombos).filter(c => !hero.includes(c[0]) && !hero.includes(c[1]));
  const vil = pick(all), board = shuffled().filter(c => !hero.includes(c) && !vil.includes(c)).slice(0, 5);
  const vPos = SPOTS.find(s => s.id === openId).hero, open = SPOTS.find(s => s.id === openId).o || (g === 'cash' ? 2.5 : 2.2);
  let pot = open * 2 + .5 + (g === 'cash' ? 0 : 1), range = all.map(c => ({ c, w: 1, g: null }));
  const share = f => { let a = 0, t = 0; for (const x of range) { t += x.w; if (f(x)) a += x.w; } return t ? a / t : 0; };
  const log = [`${RD_TYPES[type].name} opens to ${fmtBB(open)} BB from the ${vName.toLowerCase()}. You call in the big blind.`], qs = [];
  for (let k = 0; k < 3; k++) {
    const st = ['flop', 'turn', 'river'][k], b = board.slice(0, 3 + k);
    range = range.filter(x => !b.includes(x.c[0]) && !b.includes(x.c[1])); for (const x of range) x.g = rdGroup(x.c, b);
    const before = share(x => RD_TOPPLUS.has(x.g)), bets = Math.random() < rdP(st, rdGroup(vil, b), type), f = x => { const q = rdP(st, x.g, type); return bets ? q : 1 - q; };
    let num = 0, den = 0; for (const x of range) { const w = x.w * f(x); den += w; if (RD_TOPPLUS.has(x.g)) num += w; }
    const after = den ? num / den : 0, size = Math.round(pot * RD_SIZE[st] * 2) / 2;
    const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' });
    seats.BB = { state: 'hero', tag: 'You', stack: '', bet: '' }; seats[vPos] = { state: 'vil', tag: bets ? 'Bets' : 'Checks', stack: '', bet: bets ? fmtBB(size) + ' BB' : '' };
    const visual = tableSnap({ hero: 'BB', seats, heroCards: hero, center: `<div class="cards">${cardsHTML(b, 'xs')}</div><b>${fmtBB(pot)} BB</b><span>pot</span>` });
    const line = `<b>${st[0].toUpperCase() + st.slice(1)}</b> ${names(k ? b.slice(-1) : b)}: you check, they ${bets ? `bet ${fmtBB(size)} BB into ${fmtBB(pot)} BB` : 'check behind'}.`;
    if (parts === 'all' || (parts === 'flop' && k === 0)) {
      const v = lnRound5(after), { opts, correct } = lnPctOpts(v, lvl);
      qs.push({ drill: 'Hand reading', spot: `${st[0].toUpperCase() + st.slice(1)}, ${bets ? 'bet' : 'check'}`, hand: names(b), visual,
        prompt: `<ol class="small rd-log">${log.concat(line).map(t => `<li>${t}</li>`).join('')}</ol><p class="spot-text">Before this action, <b>${pct(before, 0)}</b> of their range was top pair or better. After that ${bets ? 'bet' : 'check'}, what share is?</p>`,
        opts: opts.map(o => o + '%'), correct, short: `${RD_TYPES[type].name}, ${st} ${bets ? 'bet' : 'check'} on ${names(b)}`,
        explain: `<b>${pct(after)}</b>. ${bets ? `A ${st} bet comes more from strong hands and draws${type === 'aggro' ? ', though this player bluffs a lot' : type === 'nit' ? ', and this tight player rarely bluffs' : ''}, so the share of top pair or better ${after > before ? 'goes up' : 'barely moves'}.` : `A check comes more from weak pairs and give-ups, so the share of top pair or better ${after < before ? 'drops' : 'barely moves'}.`}` });
    }
    for (const x of range) x.w *= f(x);
    log.push(line); if (bets) pot += size * 2;
  }
  if (parts === 'all' || parts === 'read') {
    const t = range.reduce((a, x) => a + x.w, 0), m = {}; for (const x of range) { const gg = x.g === 'draw' ? 'air' : x.g; m[gg] = (m[gg] || 0) + x.w; }
    const best = Object.keys(m).sort((a, z) => m[z] - m[a])[0], keys = Object.keys(RD_GROUPS).filter(k => k !== 'draw'), seats = {};
    POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' }); seats.BB = { state: 'hero', tag: 'You', stack: '', bet: '' }; seats[vPos] = { state: 'vil', tag: 'River', stack: '', bet: '' };
    const close = keys.filter(k => k !== best && (m[k] || 0) >= .85 * m[best]);
    qs.push({ drill: 'Hand reading', spot: 'Final read', hand: names(vil), visual: tableSnap({ hero: 'BB', seats, heroCards: hero, center: `<div class="cards">${cardsHTML(board, 'xs')}</div><b>${fmtBB(pot)} BB</b><span>pot</span>` }),
      prompt: `<ol class="small rd-log">${log.map(x => `<li>${x}</li>`).join('')}</ol><p class="spot-text">Putting it all together, what is the <b>most likely</b> kind of hand in their range now?</p>`,
      opts: keys.map(k => k === 'air' ? 'Missed draw or nothing' : RD_GROUPS[k]), correct: keys.indexOf(best), okIdx: close.map(k => keys.indexOf(k)), short: `Read on ${names(board)}`,
      explain: `By the river their range is ${keys.filter(k => (m[k] || 0) > t * .03).sort((a, z) => (m[z] || 0) - (m[a] || 0)).map(k => `${(k === 'air' ? 'missed draws or nothing' : RD_GROUPS[k].toLowerCase())} <b>${pct((m[k] || 0) / t, 0)}</b>`).join(', ')}. They actually had <b>${handLabel(vil)}</b> (${names(vil)}). Reads are about the range: the right read can still lose to the actual hand.` });
  }
  return qs;
}
/* a checkpoint mixes every lesson in its unit, at the checkpoint's level */
function lnMix(unitId) { return lvl => { const u = LN_UNITS.find(x => x.id === unitId); return pick(u.lessons.filter(l => !l.check && l.gen)).gen(lvl); }; }

/* ---------- the path ---------- */
const LN_UNITS = [
  { id: 'basics', name: 'Basics', blurb: 'Hand rankings, showdowns and seats.', lessons: [
    { id: 'ranks', name: 'Hand rankings', icon: '♛', d: 'Hand rankings', gen: lnRankings,
      intro: `<p>Every poker hand is the <b>best five cards</b> a player can make. From strongest to weakest:</p><ol class="ln-ranks"><li><b>Straight flush</b> five in a row, same suit</li><li><b>Four of a kind</b></li><li><b>Full house</b> three of a kind plus a pair</li><li><b>Flush</b> five of one suit</li><li><b>Straight</b> five in a row (A-2-3-4-5 counts)</li><li><b>Three of a kind</b></li><li><b>Two pair</b></li><li><b>One pair</b></li><li><b>High card</b></li></ol><p>The two most mixed up: a <b>flush beats a straight</b>, and a <b>full house beats a flush</b>.</p>` },
    { id: 'showdown', name: 'Which hand wins', icon: '⚖', d: 'Which hand wins', gen: lnShowdown,
      intro: `<p>At showdown each player makes the best five cards out of their two cards and the five on the board.</p><ul><li>You can use both, one, or none of your hole cards.</li><li>Same hand type? Compare the cards that make it, then the <b>kickers</b> (the other cards), highest first.</li><li>If the best five cards match in rank, the pot is <b>split</b>. Suits never break a tie.</li></ul>` },
    { id: 'seats', name: 'Positions', icon: '◉', d: 'Positions', gen: lnPositions,
      intro: `<p>Six seats, clockwise from the first to act: <b>UTG</b> (under the gun), <b>HJ</b> (hijack), <b>CO</b> (cutoff), <b>BTN</b> (button), <b>SB</b> and <b>BB</b> (the blinds).</p><ul><li><b>Before the flop</b> the blinds have posted, so UTG acts first and the big blind last.</li><li><b>After the flop</b> the small blind acts first and the <b>button always acts last</b>.</li><li>Acting after your opponent is being <b>in position</b>. You see what they do before you decide.</li></ul>` },
    { id: 'namehand', name: 'Name your hand', icon: '?', d: 'Name your hand', gen: lnNameHand,
      intro: `<p>Before you can bet well you need to know what you have.</p><ul><li>Combine your two cards with the board and find the best five.</li><li>Check for flushes and straights first; they hide easily.</li><li>A paired board can give you two pair or a full house without your cards helping. If the board alone is your best hand, "the board plays".</li></ul><p class="small">Level 1 uses the flop, level 2 the turn, level 3 the river.</p>` },
    { id: 'basics-check', name: 'Checkpoint', check: true, gen: lnMix('basics'), intro: `<p>A mix of everything in this unit. Score 10 out of 12 to unlock <b>Preflop basics</b>.</p>` },
  ] },
  { id: 'preflop', name: 'Preflop basics', blurb: 'Which hands to play from each seat.', lessons: [
    { id: 'pf-late', name: 'Opening late', icon: '♠', d: 'Preflop', gen: lnPF(/-(co|btn)-open/),
      intro: `<p>When everyone folds to you on the <b>cutoff</b> or <b>button</b>, open-raise a wide range.</p><ul><li>Only a few players are left behind you, so a strong hand is less likely to wake up.</li><li>You'll play the rest of the hand <b>in position</b>, acting last on every street.</li><li>Raise or fold. Don't just call (limp) when you're first in.</li></ul>` },
    { id: 'pf-early', name: 'Opening early', icon: '♣', d: 'Preflop', gen: lnPF(/-(utg|hj|sb)-open/),
      intro: `<p>From <b>UTG</b> and the <b>hijack</b>, many players still act after you, so open a much <b>tighter</b> range: big pairs, strong aces and suited broadways.</p><ul><li>The small blind is a special case: only the big blind is left, but you'll be <b>out of position</b> after the flop.</li><li>Answer with the chart for the game shown, cash or tournament.</li></ul>` },
    { id: 'pf-bb', name: 'Defending the big blind', icon: '♥', d: 'Preflop', gen: lnPF(/-bb-vs-[a-z]+-open/),
      intro: `<p>In the big blind you already have 1 BB in the pot, so calling a raise is <b>cheap</b>. You defend wider than anyone else at the table.</p><ul><li>The later the raiser's seat, the wider their range, and the wider you defend.</li><li>3-bet your strongest hands and a few good bluffs; call with hands that play well.</li></ul>` },
    { id: 'pf-face', name: 'Facing a raise', icon: '♦', d: 'Preflop', gen: lnPF(/-(co|btn|sb)-vs-[a-z]+-open/),
      intro: `<p>When someone has already raised, <b>tighten up</b>. Their range is stronger than a random hand.</p><ul><li>3-bet strong hands for value, plus some bluffs with blockers (like suited aces).</li><li>Call with hands that play well in position. Fold the rest.</li><li>From the small blind, most charts 3-bet or fold, since calling leaves you out of position.</li></ul>` },
    { id: 'pf-check', name: 'Checkpoint', check: true, gen: lnMix('preflop'), intro: `<p>A mix of everything in this unit. Score 10 out of 12 to unlock <b>The price of a call</b>.</p>` },
  ] },
  { id: 'price', name: 'The price of a call', blurb: 'Pot odds, outs and quick equity math.', lessons: [
    { id: 'po-easy', name: 'Pot odds', icon: '%', d: 'Pot odds', gen: lnPO([[.5, 1], [.33, .5, 1], [.33, .5, 1]]),
      intro: `<p>Pot odds tell you how often you need to win to call.</p><p class="mono-ex">equity needed = your call ÷ (pot + bet + your call)</p><ul><li>Half pot → <b>25%</b></li><li>Pot-size bet → <b>33%</b></li><li>A third of the pot → <b>20%</b></li></ul><p>Memorize these three; most bets are close to one of them.</p>` },
    { id: 'po-any', name: 'Any bet size', icon: '÷', d: 'Pot odds', gen: lnPO([FRACS, FRACS, FRACS]),
      intro: `<p>Same formula, every bet size, from a quarter pot up to twice the pot.</p><ul><li>Bigger bets need more equity: ¾ pot → 30%, 2× pot → 40%.</li><li>The most common slip is dividing by the pot <i>before</i> your call. Your call is part of what you win back.</li><li>On level 3 the bet's share of the pot isn't shown, and the choices are close together.</li></ul>` },
    { id: 'outs', name: 'Counting outs', icon: '+', d: 'Counting outs', gen: lnOuts,
      intro: `<p>An <b>out</b> is a card that puts you ahead.</p><ul><li>Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4.</li><li>Two overcards to a pair: about 6.</li><li>Don't count cards that also improve your opponent.</li></ul>` },
    { id: 'rule24', name: 'Rule of 2 and 4', icon: '×', d: 'Rule of 2 and 4', gen: lnRule,
      intro: `<p>A quick way to turn outs into equity:</p><ul><li><b>One card to come</b> (turn to river): outs × 2.</li><li><b>Two cards to come</b> (all in on the flop): outs × 4.</li></ul><p>9 outs on the turn ≈ 18%. 9 outs all in on the flop ≈ 36%.</p>` },
    { id: 'price-check', name: 'Checkpoint', check: true, gen: lnMix('price'), intro: `<p>Pot odds, outs and the rule of 2 and 4 together. Score 10 out of 12 to unlock <b>Making decisions</b>.</p>` },
  ] },
  { id: 'decide', name: 'Making decisions', blurb: 'Put the price and your equity together.', lessons: [
    { id: 'matchups', name: 'Preflop matchups', icon: '⚔', d: 'Matchups', gen: lnMatch,
      intro: `<p>A handful of matchups cover most all-in hands:</p><ul><li>Higher pair vs lower pair: about <b>80/20</b>.</li><li>Pair vs two higher cards: a coin flip, about <b>55/45</b>.</li><li>Two higher cards vs two lower: about <b>65/35</b>.</li><li>Dominated (sharing a card, like AK vs AQ): about <b>73/27</b> with a big kicker, but only about <b>60/40</b> or less when both kickers are small (T6 vs T4), because many boards split.</li></ul>` },
    { id: 'callfold', name: 'Call or fold', icon: '✓', d: 'Call or fold', gen: lnCF,
      intro: `<p>Now combine it all. Work out the price (pot odds), estimate your equity (outs and the rule of 2 and 4), then compare.</p><ul><li>Equity higher than the price: <b>call</b>.</li><li>Equity lower: <b>fold</b>.</li><li>You get a read on villain's hand instead of seeing their cards.</li></ul>` },
    { id: 'decide-check', name: 'Checkpoint', check: true, gen: lnMix('decide'), intro: `<p>Matchups and call-or-fold decisions. Score 10 out of 12 to unlock <b>Reading ranges</b>.</p>` },
  ] },
  { id: 'ranges', name: 'Reading ranges', blurb: 'Combos, and how ranges hit boards.', lessons: [
    { id: 'combos', name: 'Combinatorics', icon: '#', d: 'Combinatorics', gen: lnCB,
      intro: `<p>Ranges are made of <b>combos</b>, the exact two-card hands.</p><ul><li>Pocket pair: <b>6</b> combos. Suited hand: <b>4</b>. Offsuit hand: <b>12</b>.</li><li>Cards you can see remove combos: if an ace is on the board, AA has 3 combos left and AK has 12 − 3 = 9… minus any you hold.</li><li>Counting combos tells you how often a range is value vs a bluff.</li></ul>` },
    { id: 'rvb', name: 'Range vs board', icon: '▦', d: 'Range vs board', gen: lnRVB,
      intro: `<p>A range doesn't hit a flop the way one hand does. Ask what share of the whole range has <b>top pair or better</b>.</p><ul><li>Opening ranges are full of high cards, so A- and K-high flops hit them often.</li><li>Big-blind calling ranges have more small suited and connected hands, so low, connected flops hit them more.</li><li>Most flops miss most hands: often only 25–40% of a range has top pair or better.</li></ul>` },
    { id: 'hvr', name: 'Hand vs range', icon: '◐', d: 'Hand vs range', gen: lnHVR,
      intro: `<p>Your equity against a range is the average over every combo in it, weighted by how many combos each hand has.</p><ul><li>Split the range: hands you beat, coin flips, and hands that crush you.</li><li>Big pairs do well against wide ranges and worse against tight 3-bet ranges.</li><li>Level 1 is preflop; levels 2 and 3 add the flop.</li></ul>` },
    { id: 'ranges-check', name: 'Checkpoint', check: true, gen: lnMix('ranges'), intro: `<p>Combos, range vs board and hand vs range. Score 10 out of 12 to unlock <b>Flop play</b>.</p>` },
  ] },
  { id: 'flop', name: 'Flop play', blurb: 'Who the flop favors, and how to c-bet.', lessons: [
    { id: 'tx-range', name: 'Range advantage', icon: '⇅', d: 'Board texture', gen: lnTX('range'),
      intro: `<p><b>Range advantage</b>: whose whole range has more equity on this flop.</p><ul><li>The preflop raiser usually has it on high-card flops (A, K, Q high).</li><li>The caller catches up on low, connected flops.</li><li>Close to 50/50 counts as <b>about even</b>.</li></ul>` },
    { id: 'tx-nuts', name: 'Nut advantage', icon: '♛', d: 'Board texture', gen: lnTX('nuts'),
      intro: `<p><b>Nut advantage</b>: who has more of the very strongest hands, two pair or better.</p><ul><li>Sets and two pair come from the hands each player kept preflop.</li><li>Big-blind callers often have more low two-pair and straight combos.</li><li>A nut advantage lets you bet bigger.</li></ul>` },
    { id: 'tx-plan', name: 'C-bet plan', icon: '➚', d: 'Board texture', gen: lnTX('plan'),
      intro: `<p>Put the two advantages together:</p><ul><li>Range edge, no nut gap against you, dry board: <b>bet small, often</b>.</li><li>Range and nut edge on a wet board: <b>bet big</b>, less often.</li><li>The caller has the edge, or nobody does: <b>check a lot</b>.</li></ul>` },
    { id: 'sizing', name: 'Bet sizing', icon: '⚖', d: 'Bet sizing', gen: () => { const q = QGEN['Bet sizing'](); q.prompt = q.prompt.replace(/ ?<span class="small muted">\(.*?\)<\/span>/, ''); return q; },
      intro: `<p>Pick a bet size from your hand, the board, and what you want called by.</p><ul><li>Strong hands on wet boards: bet bigger to charge draws.</li><li>Thin value: smaller, so worse hands can call.</li><li>Some spots have more than one good answer; those count as right too.</li></ul>` },
    { id: 'flop-check', name: 'Checkpoint', check: true, gen: lnMix('flop'), intro: `<p>Advantages, c-bet plans and sizing. Score 10 out of 12 to unlock <b>Bigger pots</b>.</p>` },
  ] },
  { id: 'pots', name: 'Bigger pots', blurb: '3-bet pots and pots with three or more players.', lessons: [
    { id: 'pt-size', name: '3-bet sizing', icon: '3', d: '3-bet & multiway', gen: lnPT(['size']),
      intro: `<p>A standard 3-bet is about <b>3× the open in position</b> and <b>4× out of position</b>, plus one more open size for each caller.</p><ul><li>Out of position you make it bigger so you play a smaller stack-to-pot ratio.</li></ul>` },
    { id: 'pt-face', name: 'Facing a 3-bet', icon: '↺', d: '3-bet & multiway', gen: lnPT(['face']),
      intro: `<p>When your open gets 3-bet, continue with the top of your range.</p><ul><li>4-bet the strongest hands and a few blockers.</li><li>Call with hands that play well in position.</li><li>Fold most of the bottom of your opening range.</li></ul>` },
    { id: 'pt-spr', name: 'Stack-to-pot ratio', icon: 'SPR', d: '3-bet & multiway', gen: lnPT(['spr']),
      intro: `<p><b>SPR</b> = effective stack ÷ pot on the flop.</p><ul><li>Under 3: top pair is usually good enough to get all in.</li><li>Over 6: you need stronger hands to stack off.</li><li>3-bet pots have low SPRs, so commitment comes fast.</li></ul>` },
    { id: 'pt-multi', name: 'Multiway pots', icon: '⋔', d: '3-bet & multiway', gen: lnPT(['multieq', 'someone']),
      intro: `<p>Every extra player cuts your equity and raises the chance someone has a strong hand.</p><ul><li>Top pair is much weaker three-way than heads up.</li><li>Bluff less and value-bet tighter in multiway pots.</li></ul>` },
    { id: 'pots-check', name: 'Checkpoint', check: true, gen: lnMix('pots'), intro: `<p>3-bet pots and multiway pots. Score 10 out of 12 to unlock <b>Exploits</b>.</p>` },
  ] },
  { id: 'exploit', name: 'Exploits', blurb: 'Adjust to the player in front of you.', lessons: [
    { id: 'xp-catch', name: 'Bluff-catching', icon: '🛡', d: 'Exploit', gen: lnXP(['catch']),
      intro: `<p>With a bluff-catcher, you call when they bluff often enough to beat the price.</p><ul><li>Call more against maniacs and aggressive players.</li><li>Fold more against nits and passive players: their big bets are rarely bluffs.</li></ul>` },
    { id: 'xp-river', name: 'River value and bluffs', icon: '🎯', d: 'Exploit', gen: lnXP(['thin', 'bluff']),
      intro: `<p>On the river, bet for value when worse hands call, and bluff when better hands fold.</p><ul><li>Calling stations: value-bet thinner, never bluff.</li><li>Nits: bluff more, value-bet only strong hands.</li></ul>` },
    { id: 'xp-cbet', name: 'C-bets by player', icon: '➚', d: 'Exploit', gen: lnXP(['cbet']),
      intro: `<p>A c-bet with nothing works when the player folds enough.</p><ul><li>Nits and tight players fold a lot: c-bet more.</li><li>Stations rarely fold: check and take your equity.</li></ul>` },
    { id: 'exploit-check', name: 'Checkpoint', check: true, gen: lnMix('exploit'), intro: `<p>Exploits across player types. Score 10 out of 12 to unlock <b>Tournaments</b>.</p>` },
  ] },
  { id: 'tourney', name: 'Tournaments', blurb: 'Short stacks, shoves and ICM.', lessons: [
    { id: 'tr-shove', name: 'Open shoving', icon: '⇪', d: 'Preflop', gen: lnPF(/^tour-[a-z]+-shove-/, 'tour'),
      intro: `<p>With about 15 BB or less, raising and folding to a shove wastes chips. Move <b>all in</b> or fold.</p><ul><li>The fewer players behind you and the shorter your stack, the wider you shove.</li><li>Answers use the tournament push/fold charts.</li></ul>` },
    { id: 'tr-call', name: 'Calling a shove', icon: '✓', d: 'Preflop', gen: lnPF(/^tour-[a-z]+-vs-[a-z]+-shove-/, 'tour'),
      intro: `<p>Calling a shove needs a stronger hand than shoving does, because you can't win by making them fold.</p><ul><li>Wider against late-position and short-stack shoves.</li><li>Pot odds help: in the big blind you've already put 1 BB in.</li></ul>` },
    { id: 'tr-reshove', name: 'Re-shoving', icon: '↻', d: 'Preflop', gen: lnPF(/re-shove/, 'tour'),
      intro: `<p>With about 20 BB, re-shoving over a late-position open puts maximum pressure on a wide range.</p><ul><li>Good re-shoves have blockers or play well when called: suited aces, pairs, broadways.</li></ul>` },
    { id: 'tr-icm', name: 'ICM', icon: '$', d: 'ICM', gen: lnICM,
      intro: `<p>Near the money, chips aren't worth their face value. <b>ICM</b> (the independent chip model) turns stacks into shares of the prize pool.</p><ul><li>Big stacks are worth <b>less</b> than their chip share; short stacks <b>more</b>.</li><li>That's why you call shoves tighter near the bubble.</li></ul>` },
    { id: 'tourney-check', name: 'Checkpoint', check: true, gen: lnMix('tourney'), intro: `<p>Push/fold and ICM. Score 10 out of 12 to unlock <b>Reading hands</b>.</p>` },
  ] },
  { id: 'reading', name: 'Reading hands', blurb: 'Narrow their range street by street.', lessons: [
    { id: 'rd-flop', name: 'What a bet says', icon: '👁', d: 'Hand reading', gen: lvl => lnRDHand(lvl, 'flop')[0],
      intro: `<p>Every action changes what a player can have. Start each hand with their opening range, then ask: <b>which hands would do this?</b></p><ul><li>A bet comes more often from strong hands and draws, plus some bluffs.</li><li>A check comes more from weak pairs and hands that gave up.</li><li>Aggressive players bluff more, so their bets say less. Tight players' bets say a lot.</li></ul>` },
    { id: 'rd-streets', name: 'Street by street', icon: '⇶', d: 'Hand reading', pass: [12, 10], gen: lvl => lnRDHand(lvl, 'all'),
      intro: `<p>Now follow whole hands: flop, turn and river, then put them on a hand. Each hand is four questions, three hands a lesson.</p><ul><li>Each street starts from the range that's left after the last one.</li><li>Two bets in a row narrow the range much more than one.</li><li>The read is about the most likely <b>kind</b> of hand, not the exact two cards.</li></ul>` },
    { id: 'rd-read', name: 'Putting them on a hand', icon: '🎯', d: 'Hand reading', gen: lvl => lnRDHand(lvl, 'read')[0],
      intro: `<p>See the whole hand's action, then make the read.</p><ul><li>Bet, bet, bet: mostly strong hands and top pair, plus bluffs from aggressive players.</li><li>Check, check, bet: often a weaker hand going for thin value, or a bluff.</li><li>Close calls between two groups count as right.</li></ul>` },
    { id: 'reading-check', name: 'Checkpoint', check: true, gen: lnMix('reading'), intro: `<p>Hand reading across all streets. Score 10 out of 12 to unlock the <b>Capstone</b>.</p>` },
  ] },
  { id: 'capstone', name: 'Capstone', blurb: 'Full hands, graded decision by decision.', lessons: [
    { id: 'cap-loose', name: 'Loose players', icon: '🐠', cap: { types: ['rec', 'station'], game: 'cash' },
      intro: `<p>Play <b>5 full hands</b> in the Full hand trainer against recreational players and calling stations. Every decision is graded; get <b>80%</b> best or fine to pass.</p><ul><li>Value-bet thinner and bigger; they call too much.</li><li>Bluff rarely.</li></ul>` },
    { id: 'cap-tough', name: 'Tough opponents', icon: '🦈', cap: { types: ['nit', 'aggro'], game: 'cash' },
      intro: `<p>5 full hands against nits and aggressive players.</p><ul><li>Against nits: steal and bluff more, respect their raises.</li><li>Against aggressive players: call down lighter and let them bluff.</li></ul>` },
    { id: 'cap-mixed', name: 'Any opponent', icon: '🎲', cap: { types: ['rec', 'station', 'nit', 'aggro'], game: 'cash' },
      intro: `<p>5 full hands against a random player type each hand. Read the opponent line at the top of the table before you act.</p>` },
    { id: 'cap-tour', name: 'Tournament hands', icon: '🏆', cap: { types: ['rec', 'station', 'nit', 'aggro'], game: 'tour' },
      intro: `<p>5 full tournament hands with shorter stacks and antes. Push/fold and re-shove charts apply when stacks are short.</p>` },
  ] },
];
const LN_SOON = [];
const LN_ALL = LN_UNITS.flatMap((u, ui) => u.lessons.map((l, li) => ({ ...l, unit: u, ui, li })));
const lnById = id => LN_ALL.find(l => l.id === id);

/* ---------- saved progress ----------
   ln.lessons[id] = { best (level 1), b2, b3, attempts, n, c, last, placed } */
let ln = (() => { try { return JSON.parse(localStorage.getItem(LNKEY)) || {}; } catch (e) { return {}; } })();
ln = { xp: 0, peak: 0, lessons: {}, days: [], goalDays: [], n: 0, c: 0, pre: null, ...ln };
function lnSave() { try { localStorage.setItem(LNKEY, JSON.stringify(ln)); } catch (e) {} }
const lnToday = () => new Date().toLocaleDateString('en-CA');
const lnNeed = l => l.pass || (l.cap ? [10, 8] : LN_PASS[l.check ? 'check' : 'lesson']);
const lnBestAt = (r, k) => r ? (k === 1 ? r.best : r['b' + k]) || 0 : 0;
const lnPassed = l => { const r = ln.lessons[l.id]; return !!(r && (r.placed || r.best >= lnNeed(l)[1])); };
const lnLvPassed = (l, k) => k === 1 ? lnPassed(l) : lnBestAt(ln.lessons[l.id], k) >= lnNeed(l)[1];
const lnStars = l => [1, 2, 3].filter(k => lnLvPassed(l, k)).length;
/* a unit opens when the one before it is finished, or once you have played any of its lessons (keeps old progress open) */
const lnTouched = u => u.lessons.some(l => { const r = ln.lessons[l.id]; return r && (r.attempts || r.placed); });
function lnOpen(l) {
  if (l.li > 0) return lnPassed(LN_ALL.find(x => x.ui === l.ui && x.li === l.li - 1));
  return l.ui === 0 || lnPassed(LN_ALL.find(x => x.ui === l.ui - 1 && x.check)) || lnTouched(l.unit);
}
const lnLvOpen = (l, k) => k === 1 ? lnOpen(l) : lnLvPassed(l, k - 1);
const lnNext = () => LN_ALL.find(l => lnOpen(l) && !lnPassed(l));
const lnRank = (x = ln.peak) => { let i = 0; LN_RANKS.forEach((r, k) => { if (x >= r.at) i = k; }); return i; };
/* streak: days in a row you reached the daily goal (or played at all, with the goal off) */
function lnStreak() {
  const s = new Set(lnGoal() ? ln.goalDays : ln.days); let d = new Date(), n = 0;
  if (!s.has(lnToday())) d.setDate(d.getDate() - 1);
  while (s.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function lnAddChips(x) {
  ln.xp = Math.max(0, ln.xp + x); ln.peak = Math.max(ln.peak, ln.xp);
  /* daily goal: chips won today (wins only, losses don't count against it) */
  const d = lnToday(); if (!ln.today || ln.today.d !== d) ln.today = { d, n: 0 };
  if (x > 0) { const was = ln.today.n; ln.today.n += x; const g = lnGoal();
    if (g && was < g && ln.today.n >= g && !ln.goalDays.includes(d)) { ln.goalDays = ln.goalDays.concat(d).slice(-400); setTimeout(() => lnToast(`🔥 Daily goal reached: ${g} chips. Streak ${lnStreak()} day${lnStreak() > 1 ? 's' : ''}!`), 300); } }
}
const LN_GOALS = [[0, 'Off'], [50, 'Casual (50)'], [100, 'Regular (100)'], [200, 'Serious (200)'], [400, 'Intense (400)']];
const lnGoal = () => ln.goal ?? 100;
const lnTodayChips = () => ln.today && ln.today.d === lnToday() ? ln.today.n : 0;

/* ---------- reviews: passed lessons come back after 1, 3, 7, 14, 30 and 60 days ---------- */
const lnMaxLv = l => [3, 2, 1].find(k => lnLvPassed(l, k)) || 1;
function lnDueAt(l) { const r = ln.lessons[l.id] || {}; return r.due ?? ((r.last || (ln.pre && ln.pre.ts) || Date.now()) + (r.placed && !r.last ? 7 : 1) * LN_DAY); }
const lnDue = () => LN_ALL.filter(l => !l.check && !l.cap && lnPassed(l) && lnDueAt(l) <= Date.now());
function lnSchedule(r, step) { r.rv = Math.max(0, Math.min(LN_RV.length - 1, step)); r.due = Date.now() + LN_RV[r.rv] * LN_DAY; }
/* ---------- weak spots: the areas with the lowest accuracy in your recent answers (lessons and trainers) ---------- */
function lnWeak() {
  const rows = historyRows().slice(-1500), out = [];
  const byDrill = {}; for (const l of LN_ALL) if (l.d && !l.check && lnOpen(l)) (byDrill[l.d] = byDrill[l.d] || []).push(l);
  for (const [d, ls] of Object.entries(byDrill)) {
    const xs = rows.filter(r => r.drill === d && cv(r.correct) !== null); if (xs.length < 6) continue;
    const acc = xs.filter(r => cv(r.correct)).length / xs.length; if (acc < .85) out.push({ d, acc, n: xs.length, ls });
  }
  return out.sort((a, b) => a.acc - b.acc).slice(0, 3);
}

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
const lnStarHTML = l => { const s = lnStars(l); return `<span class="ln-stars" aria-label="${s} of 3 levels">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>`; };

/* ---------- dashboard ---------- */
function lnRankCard(compact) {
  const ri = lnRank(), r = LN_RANKS[ri], nx = LN_RANKS[ri + 1], lo = r.at, frac = nx ? Math.min(1, (ln.peak - lo) / (nx.at - lo)) : 1;
  const done = LN_ALL.filter(lnPassed).length;
  return `<div class="ln-rank${compact ? ' compact' : ''}">
    <div class="ln-badge" aria-hidden="true">${r.icon}</div>
    <div class="ln-rank-txt"><span class="eyebrow">Your rank</span><h2>${r.name}</h2>${compact ? '' : `<p class="small">${r.line}</p>`}
      <div class="ln-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}"><i style="width:${frac * 100}%"></i></div>
      <span class="small">${nx ? `${(nx.at - ln.peak).toLocaleString()} chips to <b>${nx.name}</b>` : 'Top rank reached'} · ${done} of ${LN_ALL.length} lessons</span>
      ${lnGoal() ? `<div class="ln-goal"><span>🔥 ${lnStreak()}</span><div class="ln-bar"><i style="width:${Math.min(1, lnTodayChips() / lnGoal()) * 100}%"></i></div><span class="small">${lnTodayChips() >= lnGoal() ? 'Goal done today' : `Today ${lnTodayChips()}/${lnGoal()}`}</span></div>` : ''}</div>
    <div class="ln-stack-box">${lnStacks(ln.xp, compact ? 64 : 104)}<b>${Math.round(ln.xp).toLocaleString()}</b><span>chips</span></div>
  </div>`;
}
function lnMini() {
  const box = $('hm-learn'); if (!box) return; const nx = lnNext(), due = lnDue().length;
  box.innerHTML = `${lnRankCard(true)}<div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">${LN_ALL.some(lnPassed) ? 'Continue' : 'Start'}: ${esc(nx.unit.name)} · ${esc(nx.name)}</button>` : '<span class="small">Every lesson in the path is passed. Go for three stars, or wait for new units.</span>'}${due ? `<button class="act ghost" type="button" data-ln-review>🔁 Review ${due} due</button>` : ''}<a class="linkbtn" href="#learn">Learning dashboard</a></div>`;
}
function lnPracticeCards() {
  const due = lnDue(), weak = lnWeak(), soon = LN_ALL.filter(l => !l.check && lnPassed(l)).map(l => lnDueAt(l)).sort((a, b) => a - b)[0];
  const when = t => { const d = Math.ceil((t - Date.now()) / LN_DAY); return d <= 1 ? 'tomorrow' : `in ${d} days`; };
  return `<div class="ln-practice">
    <section class="panel ln-pc"><span class="eyebrow">🔁 Review</span><h3>${due.length ? `${due.length} lesson${due.length > 1 ? 's' : ''} due` : 'Nothing due'}</h3>
      <p class="small">${due.length ? esc(due.slice(0, 4).map(l => l.name).join(', ')) + (due.length > 4 ? '…' : '') : soon ? `Next review ${when(soon)}. Lessons come back after 1, 3, 7, 14, 30 and 60 days.` : 'Pass a lesson and it comes back for review tomorrow, then at longer gaps.'}</p>
      <div class="row"><button class="act${due.length ? '' : ' ghost'}" type="button" data-ln-review${due.length ? '' : ' disabled'}>Review now</button></div></section>
    <section class="panel ln-pc"><span class="eyebrow">🎯 Weak spots</span><h3>${weak.length ? 'Practice your weakest areas' : 'No weak spots found'}</h3>
      <p class="small">${weak.length ? weak.map(w => `${esc(w.d)} <b>${pct(w.acc, 0)}</b>`).join(' · ') : 'Uses your last 1,500 answers from lessons and trainers. Areas under 85% with at least 6 answers show up here.'}</p>
      <div class="row"><button class="act${weak.length ? '' : ' ghost'}" type="button" data-ln-weak${weak.length ? '' : ' disabled'}>Practice</button></div></section>
  </div>`;
}
function lnRender() {
  lnMini(); if (lnPlay) return lnShowPlay();
  $('ln-play').hidden = true; $('ln-dash').hidden = false;
  const nx = lnNext(), qs = ln.n, acc = qs ? ln.c / qs : 0, any = LN_ALL.some(lnPassed), stars = LN_ALL.reduce((a, l) => a + lnStars(l), 0), dueSet = new Set(lnDue().map(l => l.id));
  $('ln-dash').innerHTML = `
  <section class="hero ln-hero">${lnRankCard(false)}
    <div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">${any ? 'Continue' : 'Start'}: ${esc(nx.name)}</button>` : ''}
      <button class="act ghost" type="button" data-ln-pre>${ln.pre ? 'Retake placement test' : 'Placement test'}</button></div>
    ${ln.pre ? '' : `<p class="small">Already play? The placement test unlocks lessons up to your level.</p>`}
  </section>
  <div class="stats ln-stats">
    <div class="stat"><div class="n">${LN_ALL.filter(lnPassed).length}/${LN_ALL.length}</div><span class="small muted">lessons passed</span></div>
    <div class="stat"><div class="n">${stars}<small>/${LN_ALL.length * 3}</small></div><span class="small muted">stars</span></div>
    <div class="stat"><div class="n">${qs ? pct(acc, 0) : '–'}</div><span class="small muted">lesson accuracy</span></div>
    <div class="stat"><div class="n">${lnStreak()}</div><span class="small muted">${lnGoal() ? 'day goal streak' : 'day streak'}</span></div>
  </div>
  ${any ? lnPracticeCards() : ''}
  <div class="ln-path">${LN_UNITS.map((u, ui) => { const p = u.lessons.filter(l => lnPassed(LN_ALL.find(x => x.id === l.id))).length;
    return `<section class="panel ln-unit" aria-labelledby="ln-u-${u.id}">
      <div class="ln-unit-h"><div><span class="eyebrow">Unit ${ui + 1}</span><h2 id="ln-u-${u.id}">${u.name}</h2><p class="small muted">${u.blurb}</p></div>
        <span class="chip ${p === u.lessons.length ? 'good' : p ? 'ok' : 'new'}">${p}/${u.lessons.length}</span></div>
      <div class="ln-nodes">${u.lessons.map((l0, li) => { const l = LN_ALL.find(x => x.id === l0.id), pa = lnPassed(l), o = lnOpen(l), r = ln.lessons[l.id], cur = nx && nx.id === l.id, due = dueSet.has(l.id);
        return `<button type="button" class="ln-node${pa ? ' passed' : o ? ' open' : ' locked'}${cur ? ' current' : ''}${l.check ? ' check' : ''}${lnStars(l) === 3 ? ' gold' : ''}" data-ln-go="${l.id}" style="--off:${[0, 1, 0, -1][li % 4]}" aria-label="${esc(l.name)}${pa ? `, passed, ${lnStars(l)} of 3 stars${due ? ', due for review' : ''}` : o ? ', open' : ', locked'}">
          <span class="ln-dot">${pa ? (lnStars(l) === 3 ? '♛' : '✓') : o ? (l.check ? '🏁' : l.icon) : '🔒'}${due ? '<em class="ln-due" title="Due for review">🔁</em>' : ''}</span><span class="ln-name">${l.name}</span>
          ${pa ? lnStarHTML(l) : `<span class="ln-best">${r && r.attempts ? `Best ${r.best}/${lnNeed(l)[0]}` : cur ? 'Up next' : ''}</span>`}</button>`; }).join('')}</div>
    </section>`; }).join('')}
    ${LN_SOON.map(([n, b], k) => `<section class="panel ln-unit soon"><div class="ln-unit-h"><div><span class="eyebrow">Unit ${LN_UNITS.length + k + 1}</span><h2>${n}</h2><p class="small muted">${b}</p></div><span class="chip new">Coming soon</span></div></section>`).join('')}
  </div>
  <details class="panel ln-detail"><summary><b>Lesson details</b> <span class="small muted">scores by level, attempts, reviews</span></summary>
    <div style="overflow-x:auto"><table class="ref"><thead><tr><th>Lesson</th><th>Status</th><th>Best L1 · L2 · L3</th><th>Attempts</th><th>Accuracy</th><th>Next review</th></tr></thead><tbody>
    ${LN_ALL.map(l => { const r = ln.lessons[l.id] || {}, p = lnPassed(l), o = lnOpen(l), b = k => lnBestAt(r, k) ? `${lnBestAt(r, k)}/${lnNeed(l)[0]}` : '–', du = p && !l.check ? lnDueAt(l) : 0;
      return `<tr><td class="t">${l.unit.name} · ${l.name}</td><td><span class="chip ${p ? 'good' : o ? 'ok' : 'new'}">${p ? (r.placed && !r.best ? 'Placed' : 'Passed') : o ? 'Open' : 'Locked'}</span> ${p ? lnStarHTML(l) : ''}</td><td>${b(1)} · ${b(2)} · ${b(3)}</td><td>${r.attempts || 0}</td><td>${r.n ? pct(r.c / r.n, 0) : '–'}</td><td>${du ? (du <= Date.now() ? '<b>Due</b>' : new Date(du).toLocaleDateString([], { month: 'short', day: 'numeric' })) : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="small muted">Levels: 1 Learn, 2 Practice, 3 Master (${APPCFG.shot} seconds a question${APPCFG.bankOn ? `, ${APPCFG.bank}-second time bank` : ''}). Right answers win ${LN_LV[1].right} / ${LN_LV[2].right} / ${LN_LV[3].right} chips by level, wrong ones cost ${-LN_CHIPS.wrong}. Passing adds ${LN_LV[1].pass} / ${LN_LV[2].pass} / ${LN_LV[3].pass} the first time, ${LN_CHIPS.repass} on a repeat; a passed review or weak-spots session adds ${LN_CHIPS.review}. Rank follows the most chips you've held.</p>
  </details>`;
}

/* ---------- lesson player ----------
   kinds: 'lesson' (one lesson at one level), 'pre' (placement test), 'review' and 'weak' (a mix of lessons) */
let lnPlay = null;
const lnGoLearn = () => { if (location.hash !== '#learn') location.hash = '#learn'; else lnShowPlay(); };
function lnStart(id, lvl) {
  const l = lnById(id); if (!l) return;
  if (!lnOpen(l)) { const prev = l.li ? LN_ALL.find(x => x.ui === l.ui && x.li === l.li - 1) : LN_ALL.find(x => x.ui === l.ui - 1 && x.check); lnToast(`Pass “${prev.name}” first to unlock this lesson.`); return; }
  if (!lvl) lvl = [1, 2, 3].find(k => lnLvOpen(l, k) && !lnLvPassed(l, k)) || 3;
  const [n, need] = lnNeed(l);
  lnPlay = { kind: 'lesson', l, lvl, n, need, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, miss: [], bank: APPCFG.bankOn ? { left: APPCFG.bank } : null };
  lnGoLearn();
}
function lnPlacement() {
  lnPlay = { kind: 'pre', lvl: 2, ui: 0, inUnit: 0, wrong: 0, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, placed: [], miss: [] };
  lnGoLearn();
}
function lnMixStart(kind) {
  let pool;
  if (kind === 'review') pool = lnDue().map(l => ({ l, lvl: Math.min(2, lnMaxLv(l)) }));
  else pool = lnWeak().flatMap(w => w.ls.map(l => ({ l, lvl: lnPassed(l) ? 2 : 1, d: w.d })));
  if (!pool.length) { lnToast(kind === 'review' ? 'Nothing is due for review right now.' : 'No weak spots yet. Answer more questions first.'); return; }
  pool = shuffle(pool).slice(0, 10);
  lnPlay = { kind, pool, lvl: 2, n: 10, need: 8, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, miss: [], per: {} };
  lnGoLearn();
}
const lnPreUnits = () => LN_UNITS.filter(u => !u.lessons.some(l => l.cap));   /* the capstone is played, not tested */
const LN_PRE_N = 8, LN_PRE_MISS = 1; /* each unit: 8 questions, at most 1 miss to place out of it */
function lnShowPlay() {
  stopClock();
  $('ln-dash').hidden = true; $('ln-play').hidden = false; const P = lnPlay, box = $('ln-play');
  const total = P.kind === 'pre' ? lnPreUnits().length * LN_PRE_N : P.n, done = P.kind === 'pre' ? P.ui * LN_PRE_N + P.inUnit : P.i;
  const head = `<div class="ln-top"><button type="button" class="linkbtn ln-quit" data-ln-quit>✕ Quit</button><div class="ln-bar"><i style="width:${done / total * 100}%"></i></div><span class="ln-pchips" id="ln-pchips">${P.chips >= 0 ? '+' : ''}${P.chips}</span></div>`;
  const title = P.kind === 'review' ? 'Review' : P.kind === 'weak' ? 'Weak spots' : P.kind === 'pre' ? 'Placement test' : P.l.name;
  if (P.stage === 'intro') {
    if (P.kind === 'pre') {
      box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">Placement test</span><h2>Find your starting point</h2>
      <p>Questions run unit by unit, starting with <b>${LN_UNITS[0].name}</b>. Get 7 of 8 in a unit and every lesson in it is unlocked and marked as placed. The test stops at the first unit where you miss two.</p>
      <p class="small muted">Preflop questions use the ${mode === 'cash' ? 'cash' : 'tournament'} charts. Switch Cash/Tournament at the top first if you want the other.</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Begin</button></div></section>`;
      return;
    }
    if (P.kind !== 'lesson') {
      const ls = [...new Map(P.pool.map(x => [x.l.id, x.l])).values()];
      box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${P.kind === 'review' ? '🔁 Review' : '🎯 Weak spots'}</span><h2>${P.kind === 'review' ? 'Keep it fresh' : 'Work on your weakest areas'}</h2>
      <p>${P.kind === 'review' ? 'A mix from the lessons due for review. Each lesson you get mostly right moves to a longer gap; any you miss come back tomorrow.' : 'A mix from the areas where your recent answers are weakest, across lessons and trainers.'}</p>
      <ul class="ln-mixlist">${ls.map(l => `<li><b>${esc(l.name)}</b> <span class="small muted">${esc(l.unit.name)}</span></li>`).join('')}</ul>
      <p class="small muted">${P.n} questions · pass with ${P.need} for a ${LN_CHIPS.review}-chip bonus · no clock</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Start</button></div></section>`;
      return;
    }
    const l = P.l;
    box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${esc(l.unit.name)} · ${l.check ? 'Checkpoint' : 'Lesson ' + (l.li + 1)}</span><h2>${esc(l.name)}</h2><div class="ln-intro">${l.intro}</div>
      <div class="ln-levels" role="group" aria-label="Level">${[1, 2, 3].map(k => { const o = lnLvOpen(l, k), pa = lnLvPassed(l, k);
        return `<button type="button" class="ln-lv${P.lvl === k ? ' on' : ''}" data-ln-lv="${k}"${o ? '' : ' disabled'} aria-pressed="${P.lvl === k}"><b>${o ? (pa ? '★ ' : '') : '🔒 '}Level ${k}</b><span>${LN_LV[k].name}</span></button>`; }).join('')}</div>
      <p class="small muted">${l.cap ? `${['', 'Learn: the full-hand trainer with feedback on every decision.', 'Practice: same hands, higher stakes for your chips.', `Master: the full-hand clock is on (${APPCFG.fhShot} s a decision${APPCFG.bankOn ? `, ${APPCFG.bank} s bank` : ''}).`][P.lvl]} 5 hands · pass with 80% of decisions best or fine` : `${lnLvLine(P.lvl)} ${P.n} questions · pass with ${P.need}`} · ${LN_LV[P.lvl].right} chips a right answer${l.unit.id === 'preflop' || l.d === 'Preflop' && l.unit.id !== 'tourney' ? ` · ${mode === 'cash' ? 'cash (100 BB)' : 'tournament'} charts` : ''}</p>
      <div class="row"><button class="act" type="button" data-ln-begin>${l.cap ? `Play 5 hands at level ${P.lvl}` : `Start level ${P.lvl}`}</button></div></section>`;
    return;
  }
  if (P.stage === 'q') {
    const q = P.q, ans = P.picked != null, ok = ans && lnIsRight(q, P.picked), exact = ans && P.picked === q.correct, clock = P.kind === 'lesson' && LN_LV[P.lvl].clock;
    box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${P.kind === 'pre' ? `Placement · ${LN_UNITS[P.ui].name}` : P.kind === 'lesson' ? `${esc(title)} · Level ${P.lvl}` : `${esc(title)} · ${esc(q._lname)}`} · ${done + 1} of ${P.kind === 'pre' ? 'up to ' + total : total}</span>
      ${clock && !ans ? '<div class="clock-host" id="ln-clock"></div>' : ''}
      ${q.visual ? `<div class="qz-visual">${q.visual}</div>` : ''}<div class="ln-prompt">${q.prompt}</div>
      <div class="ln-opts">${q.opts.map((o, k) => `<button type="button" class="ln-opt${ans ? (k === q.correct ? ' right' : k === P.picked ? (ok ? ' right' : ' wrong') : ' dim') : ''}" data-k="${k}"${ans ? ' disabled' : ''}>${o}</button>`).join('')}</div>
      ${ans ? `<div class="ln-fb ${ok ? 'good' : 'bad'}"><b>${ok ? (exact ? pick(['Nice!', 'Correct.', 'That\'s it.', 'Well played.']) : 'Good enough.') : P.picked === -1 ? 'Out of time.' : 'Not quite.'}</b> <span class="ln-delta">${ok ? '+' + LN_LV[P.lvl].right : LN_CHIPS.wrong} chips</span><p>${!exact && ok ? `Close to the best play, <b>${q.opts[q.correct]}</b>. ` : ''}${q.explain}</p>
        <div class="row ln-fb-row"><button class="act" type="button" data-ln-cont>Continue</button><button type="button" class="linkbtn flag-btn">⚑ Flag this</button></div></div>` : '<div class="ln-flag-row"><button type="button" class="linkbtn flag-btn">⚑ Flag this question</button></div>'}</section>`;
    if (ans) box.querySelector('[data-ln-cont]').focus({ preventScroll: true });
    else if (clock) { const qq = q; startClock($('ln-clock'), APPCFG.shot, P.bank, () => { if (lnPlay && lnPlay.q === qq && lnPlay.picked == null) lnAnswer(-1); }); }
    return;
  }
  /* results */
  if (P.kind === 'pre') {
    const names_ = P.placed.map(ui => LN_UNITS[ui].name), nx = lnNext();
    box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">Placement result</span>
      <h2>${names_.length ? `Placed out of ${names_.length} unit${names_.length > 1 ? 's' : ''}` : 'Start at the beginning'}</h2>
      <p>${names_.length ? `Unlocked: <b>${names_.join(', ')}</b>. ` : ''}${P.right} right answers. ${nx ? `Your next lesson is <b>${nx.unit.name} · ${nx.name}</b>.` : 'Every unit so far is unlocked.'}</p>
      ${lnStacks(ln.xp, 90)}<p class="small">${P.chips >= 0 ? '+' : ''}${P.chips} chips this test · stack ${Math.round(ln.xp).toLocaleString()}</p>
      <div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">Go to next lesson</button>` : ''}<button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
    return;
  }
  const ok = P.kind === 'lesson' && P.l.cap ? P.n > 0 && P.right / P.n >= .8 : P.right >= P.need, missHTML = P.miss.length ? `<details class="ln-review"><summary>Review your misses (${P.miss.length})</summary>${P.miss.map(m => `<div><span class="small muted">${esc(m.short)}</span><span>${m.picked === -1 ? 'Out of time' : `You chose <b>${m.opts[m.picked]}</b>`}; the answer is <b>${m.opts[m.correct]}</b>.</span><span class="small">${m.explain}</span></div>`).join('')}</details>` : '';
  const stackHTML = `${lnStacks(ln.xp, 90)}<p class="small">${P.chips >= 0 ? '+' : ''}${P.chips} chips this ${P.kind === 'lesson' ? 'lesson' : 'session'} · stack ${Math.round(ln.xp).toLocaleString()}</p>`;
  if (P.kind !== 'lesson') {
    box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">${P.kind === 'review' ? '🔁 Review' : '🎯 Weak spots'}</span>
      ${P.rankUp ? lnConfetti() : ''}<h2>${P.rankUp ? `Rank up: ${LN_RANKS[lnRank()].icon} ${LN_RANKS[lnRank()].name}!` : ok ? 'Nicely done' : 'Keep at it'}</h2>
      <p><b>${P.right} of ${P.n}</b> right.${ok ? ` Bonus +${LN_CHIPS.review} chips.` : ''}</p>
      ${P.kind === 'review' ? `<ul class="ln-mixlist">${Object.entries(P.per).map(([id, x]) => { const l = lnById(id), r = ln.lessons[id]; return `<li><b>${esc(l.name)}</b> ${x.c}/${x.n} · <span class="small">${x.up ? `next review in ${LN_RV[r.rv]} day${LN_RV[r.rv] > 1 ? 's' : ''}` : 'back tomorrow'}</span></li>`; }).join('')}</ul>` : ''}
      ${stackHTML}${missHTML}
      <div class="row">${lnDue().length ? `<button class="act" type="button" data-ln-review>Review more (${lnDue().length} due)</button>` : ''}<button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
    return;
  }
  const nx = lnNext(), up = P.lvl < 3 && lnLvOpen(P.l, P.lvl + 1);
  box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">${esc(P.l.name)} · Level ${P.lvl}</span>
    ${P.rankUp || P.unitDone ? lnConfetti() : ''}
    <h2>${ok ? (P.rankUp ? `Rank up: ${LN_RANKS[lnRank()].icon} ${LN_RANKS[lnRank()].name}!` : P.unitDone ? `Unit complete: ${esc(P.unitDone)}!` : P.lvl === 3 ? 'Mastered!' : `Level ${P.lvl} passed`) : 'Not this time'}</h2>
    ${ok ? lnStarHTML(P.l) : ''}
    <p><b>${P.right} of ${P.n}</b> ${P.l.cap ? `decisions best or fine (${P.n ? pct(P.right / P.n, 0) : '–'})` : 'right'}. ${ok ? (P.first ? `Passing bonus +${LN_LV[P.lvl].pass} chips.` : `Bonus +${LN_CHIPS.repass} chips.`) : P.l.cap ? 'You need 80% to pass. Results swing; the decisions are what count.' : `You need ${P.need} to pass. Have another go; the questions change every time.`}</p>
    ${stackHTML}${missHTML}
    <div class="row">${ok && nx && nx.id !== P.l.id ? `<button class="act" type="button" data-ln-go="${nx.id}">Next: ${esc(nx.name)}</button>` : ''}
      ${ok && up ? `<button class="act${nx && nx.id !== P.l.id ? ' ghost' : ''}" type="button" data-ln-go="${P.l.id}" data-ln-lvl="${P.lvl + 1}">Try level ${P.lvl + 1}</button>` : ''}
      ${!ok ? `<button class="act" type="button" data-ln-go="${P.l.id}" data-ln-lvl="${P.lvl}">Try again</button>` : ''}
      <button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
}
const lnIsRight = (q, k) => k === q.correct || (k >= 0 && (q.okIdx || []).includes(k));
function lnDeal() {
  const P = lnPlay; P.picked = null;
  let q, it = null;
  try {
    if (P.queue && P.queue.length) q = P.queue.shift();
    else {
      if (P.kind === 'pre') q = pick(LN_UNITS[P.ui].lessons.filter(l => !l.check)).gen(2);
      else if (P.kind === 'lesson') q = P.l.gen(P.lvl);
      else { it = P.pool[P.i % P.pool.length]; q = it.l.gen(it.lvl); for (const x of [].concat(q)) { x._lid = it.l.id; x._lname = it.l.name; } }
      if (Array.isArray(q)) { P.queue = q.slice(1); q = q[0]; }
      /* don't repeat a question already asked in this session */
      P.seen = P.seen || new Set();
      for (let k = 0; k < 12 && P.seen.has(q.short) && !(P.queue && P.queue.length) && P.kind === 'lesson'; k++) { const r = P.l.gen(P.lvl); q = Array.isArray(r) ? r[0] : r; }
      P.seen.add(q.short);
    }
  } catch (e) { console.warn(e); q = lnRule(2); }
  q.t0 = Date.now(); P.q = q; P.stage = 'q'; lnShowPlay(); window.scrollTo(0, $('v-learn').offsetTop - 70);
}
function lnAnswer(k) {
  const P = lnPlay, q = P.q, ok = lnIsRight(q, k); if (P.picked != null) return; P.picked = k; stopClock();
  const d = ok ? LN_LV[P.lvl].right : LN_CHIPS.wrong, before = ln.xp; lnAddChips(d); P.chips += ln.xp - before;
  ln.n++; if (ok) { ln.c++; P.right++; } else P.miss.push({ ...q, picked: k });
  if (!ln.days.includes(lnToday())) ln.days = ln.days.concat(lnToday()).slice(-60);
  const lid = P.kind === 'lesson' ? P.l.id : q._lid;
  if (lid) { const r = ln.lessons[lid] = ln.lessons[lid] || { best: 0, attempts: 0, n: 0, c: 0 }; r.n = (r.n || 0) + 1; r.c = (r.c || 0) + (ok ? 1 : 0); }
  if (q._lid) { const x = P.per[q._lid] = P.per[q._lid] || { n: 0, c: 0 }; x.n++; if (ok) x.c++; }
  if (P.kind === 'pre' && !ok) P.wrong++;
  lnSave();
  logEvent({ drill: q.drill, spot: q.spot, hand: q.hand, answer: k === -1 ? 'Out of time' : q.opts[k], expected: q.opts[q.correct], correct: ok, detail: P.kind === 'pre' ? 'Placement test' : P.kind === 'lesson' ? `Lesson: ${P.l.name}, level ${P.lvl}` : (P.kind === 'review' ? 'Review: ' : 'Weak spots: ') + q._lname, ms: Date.now() - q.t0 });
  lnShowPlay();
}
function lnContinue() {
  const P = lnPlay;
  if (P.kind !== 'pre') { P.i++; if (P.i < P.n) return lnDeal(); return lnFinish(); }
  P.inUnit++; P.i++;
  if (P.wrong > LN_PRE_MISS) return lnPreEnd();
  if (P.inUnit >= LN_PRE_N) {
    P.placed.push(P.ui);
    LN_UNITS[P.ui].lessons.forEach(l => { const r = ln.lessons[l.id] = ln.lessons[l.id] || { best: 0, attempts: 0, n: 0, c: 0 }; if (!r.placed && !lnPassed(LN_ALL.find(x => x.id === l.id))) { lnAddChips(LN_CHIPS.placed); P.chips += LN_CHIPS.placed; if (r.due == null) lnSchedule(r, 2); } r.placed = true; });
    lnSave(); P.ui++; P.inUnit = 0; P.wrong = 0;
    if (P.ui >= lnPreUnits().length) return lnPreEnd();
    P.queue = null;
  }
  lnDeal();
}
function lnPreEnd() { const P = lnPlay; P.queue = null; ln.pre = { ts: Date.now(), units: P.placed.length }; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini(); }
function lnFinish() {
  const P = lnPlay, ok = P.l && P.l.cap ? P.n > 0 && P.right / P.n >= .8 : P.right >= P.need, rank0 = lnRank();
  if (P.kind === 'lesson') {
    const r = ln.lessons[P.l.id], was = lnLvPassed(P.l, P.lvl) || (P.lvl === 1 && r.best >= P.need);
    r.attempts++; r.last = Date.now();
    const score = P.l.cap ? (P.n ? Math.round(P.right / P.n * 10) : 0) : P.right;   /* capstone: share of good decisions, out of 10 */
    if (P.lvl === 1) r.best = Math.max(r.best || 0, score); else r['b' + P.lvl] = Math.max(r['b' + P.lvl] || 0, score);
    if (ok) { const b = was ? LN_CHIPS.repass : LN_LV[P.lvl].pass; lnAddChips(b); P.chips += b; P.first = !was; if (P.l.check && !was && P.lvl === 1) P.unitDone = P.l.unit.name;
      if (!P.l.check) { if (r.due == null) lnSchedule(r, 0); else lnSchedule(r, r.rv || 0); } }
  } else {
    if (P.kind === 'review') for (const [id, x] of Object.entries(P.per)) { const r = ln.lessons[id]; x.up = x.c / x.n >= .75; lnSchedule(r, x.up ? (r.rv ?? 0) + 1 : 0); }
    if (ok) { lnAddChips(LN_CHIPS.review); P.chips += LN_CHIPS.review; }
  }
  P.rankUp = lnRank() > rank0; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini();
}
/* falling chips for a unit complete or a rank up */
function lnConfetti() { const cs = LN_DENOM.map(d => d[1]); return `<div class="ln-confetti" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${cs[i % cs.length]};animation-delay:${(i % 9) * .12}s;animation-duration:${1.6 + (i % 5) * .25}s"></i>`).join('')}</div>`; }

/* ---------- capstone: five hands in the Full hand trainer, graded decision by decision ---------- */
let lnCap = null;
function lnCapBegin() {
  const P = lnPlay, l = P.l;
  lnCap = { l, lvl: P.lvl, hands: 5, done: 0, dec: 0, ok: 0, chips: 0, prevType: $('fh-type').value };
  lnPlay = null; if (mode !== l.cap.game) setMode(l.cap.game);
  $('fh-seat').value = 'random'; location.hash = '#hand'; fhDeal(); window.scrollTo(0, 0);
}
function lnCapBanner() {
  const b = $('cap-banner'); if (!b) return; if (!lnCap) { b.hidden = true; return; }
  const c = lnCap; b.hidden = false;
  b.innerHTML = `<span class="eyebrow">🎓 Capstone · ${esc(c.l.name)} · Level ${c.lvl}</span><b>Hand ${Math.min(c.done + 1, c.hands)} of ${c.hands}</b><span class="small">Decisions ${c.ok}/${c.dec} best or fine${c.dec ? ` (${pct(c.ok / c.dec, 0)})` : ''} · need 80%</span><button type="button" class="linkbtn" data-ln-capquit>Quit capstone</button>`;
}
const lnFhDeal0 = fhDeal, lnFhGrade0 = fhGrade, lnFhEnd0 = fhEnd;
fhDeal = function () { if (lnCap && lnCap.done >= lnCap.hands) { $('fh-acts').innerHTML = '<button class="act" type="button" data-ln-capdone>See your capstone result</button>'; return; } if (lnCap && lnCap.done < lnCap.hands) $('fh-type').value = pick(lnCap.l.cap.types); lnFhDeal0(); if (lnCap) { fh.capHand = lnCap.done < lnCap.hands; lnCapBanner(); if (fh.capHand && lnCap.lvl === 3) fhClock(); } };
fhGrade = function (g) { lnFhGrade0(g); if (lnCap && fh.capHand) { lnCap.dec++; if (g.ok) lnCap.ok++; const b = ln.xp; lnAddChips(g.ok ? LN_LV[lnCap.lvl].right : LN_CHIPS.wrong); lnCap.chips += ln.xp - b; lnSave(); lnCapBanner(); } };
fhEnd = function (how) { lnFhEnd0(how); if (lnCap && fh.capHand) { lnCap.done++; lnCapBanner();
  if (lnCap.done >= lnCap.hands) { $('fh-acts').innerHTML = '<button class="act" type="button" data-ln-capdone>See your capstone result</button>'; $('fh-acts').querySelector('button').focus(); } } };
function lnCapFinish() {
  const c = lnCap; lnCap = null; lnCapBanner(); $('fh-type').value = c.prevType;
  lnPlay = { kind: 'lesson', l: c.l, lvl: c.lvl, n: c.dec, need: Math.ceil(c.dec * .8), right: c.ok, chips: c.chips, i: c.dec, stage: 'end', miss: [] };
  if (!ln.lessons[c.l.id]) ln.lessons[c.l.id] = { best: 0, attempts: 0, n: 0, c: 0 };
  const r = ln.lessons[c.l.id]; r.n = (r.n || 0) + c.dec; r.c = (r.c || 0) + c.ok;
  lnFinish(); location.hash = '#learn';
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-ln-capdone]')) return lnCapFinish();
  if (e.target.closest('[data-ln-capquit]')) { const c = lnCap; lnCap = null; lnCapBanner(); if (c) $('fh-type').value = c.prevType; stopClock(); $('fh-clock').innerHTML = ''; }
});

function lnToast(msg) { const t = $('ln-toast'); t.textContent = msg; t.hidden = false; clearTimeout(lnToast.h); lnToast.h = setTimeout(() => t.hidden = true, 2600); }

document.addEventListener('click', e => {
  const g = e.target.closest('[data-ln-go]'); if (g) { lnStart(g.dataset.lnGo, +g.dataset.lnLvl || 0); return; }
  if (e.target.closest('[data-ln-pre]')) return lnPlacement();
  if (e.target.closest('[data-ln-review]')) return lnMixStart('review');
  if (e.target.closest('[data-ln-weak]')) return lnMixStart('weak');
  if (!lnPlay) return;
  const lv = e.target.closest('[data-ln-lv]'); if (lv && lnPlay.stage === 'intro') { lnPlay.lvl = +lv.dataset.lnLv; return lnShowPlay(); }
  if (e.target.closest('[data-ln-begin]')) return lnPlay.kind === 'lesson' && lnPlay.l.cap ? lnCapBegin() : lnDeal();
  const o = e.target.closest('#ln-play .ln-opt'); if (o) return lnAnswer(+o.dataset.k);
  if (e.target.closest('[data-ln-cont]')) return lnContinue();
  if (e.target.closest('[data-ln-dash]')) { stopClock(); lnPlay = null; return lnRender(); }
  const qb = e.target.closest('[data-ln-quit]');
  if (qb) { if (lnPlay.stage === 'end' || lnPlay.stage === 'intro' || qb.dataset.sure) { stopClock(); lnPlay = null; lnRender(); } else { qb.dataset.sure = '1'; qb.textContent = 'Tap again to quit'; } }
});
