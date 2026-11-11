/* ---------- Learn: a guided path from Fish to Crusher ----------
   Units of short lessons, unlocked in order. A lesson is a teaching card and 10 questions (pass at 8);
   each unit ends in a 12-question checkpoint (pass at 10) that unlocks the next unit.
   Every lesson has three levels: 1 Learn (clear-cut spots), 2 Practice (the full mix), 3 Master (the closest spots,
   20 seconds per question). Passing level 1 unlocks the next lesson; levels 2 and 3 earn stars and more chips.
   Questions come from the same engine the trainers use (evaluator, equity, charts).
   Chips: right answers win chips, wrong ones cost 5 (never below zero), passing adds a bonus.
   Rank follows the most chips you have ever held, so a bad lesson shrinks the stack but never demotes you.
   Progress is saved under LNKEY, which syncs to the cloud with the other settings. */
const LNKEY = 'holdem-learn-v1';
const LN_PASS = { lesson: [10, 8], check: [12, 10] };
const LN_LV = [null,
  { name: 'Learn', line: 'Clear-cut spots to build the habit.', right: 10, pass: 50 },
  { name: 'Practice', line: 'The full mix, like real play.', right: 15, pass: 75 },
  { name: 'Master', line: 'The closest spots, 20 seconds each.', right: 20, pass: 100, time: 20 }];
const LN_CHIPS = { wrong: -5, repass: 10, placed: 30 };
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
  const t = pick(lvl === 1 ? ['blind', 'blind', 'pre1'] : lvl === 2 ? ['pre', 'post', 'behind'] : ['post', 'ip', 'ip', 'behind']);
  if (t === 'blind') {
    const [role, ans, why] = pick([['posts the small blind', 'SB', 'The small blind sits just left of the button.'], ['posts the big blind', 'BB', 'The big blind sits two seats left of the button.'], ['has the dealer button', 'BTN', 'The button is the dealer seat. It acts last on every street after the flop.']]);
    const opts = shuffle([ans, ...shuffle(POS.filter(p => p !== ans)).slice(0, 3)]);
    return { drill: 'Positions', spot: 'Seats', hand: ans, visual: lnPosTable('CO', [], [], 'The seats, clockwise: UTG, HJ, CO, BTN, SB, BB'),
      prompt: `<p class="spot-text">Which seat ${role}?</p>`, opts, correct: opts.indexOf(ans), short: `Who ${role}`, explain: `<b>${ans}</b> (${POSNAME[ans]}). ${why}` };
  }
  if (t === 'pre1' || t === 'pre' || t === 'post') {
    const order = t === 'post' ? LN_POST : LN_PRE, set = t === 'pre1' ? shuffle(['UTG', 'BB', 'SB', pick(['HJ', 'CO', 'BTN'])]) : shuffle(POS).slice(0, lvl === 3 ? 4 : 3);
    const ans = set.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    return { drill: 'Positions', spot: t === 'post' ? 'Order after the flop' : 'Order before the flop', hand: set.join(','), visual: lnPosTable('BB', set, [], t === 'post' ? 'After the flop' : 'Before the flop'),
      prompt: `<p class="spot-text">${t === 'post' ? '<b>After the flop</b>' : '<b>Before the flop</b>'}, which of these seats acts first?</p>`, opts: set, correct: set.indexOf(ans), short: `${t === 'post' ? 'Postflop' : 'Preflop'} first of ${set.join(', ')}`,
      explain: t === 'post' ? `After the flop, action starts left of the button: ${LN_POST.join(' → ')}. So <b>${ans}</b> is first, and the button always acts last.` : `Before the flop the blinds have already posted, so action starts with UTG: ${LN_PRE.join(' → ')}. <b>${ans}</b> acts first here.` };
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
function lnPF(re) {
  return lvl => {
    const pool = SPOTS.filter(s => s.game === mode && re.test(s.id)), spot = pick(pool), bnd = new Set(spot.boundary || []);
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
    explain: `${m.name}: the favorite wins about ${m.rule}%, and you are the ${(c.fav === 0) === first ? 'favorite' : 'underdog'}. Exact: ${pct(eq)}.` };
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
/* a checkpoint mixes every lesson in its unit, at the checkpoint's level */
function lnMix(unitId) { return lvl => { const u = LN_UNITS.find(x => x.id === unitId); return pick(u.lessons.filter(l => !l.check)).gen(lvl); }; }

/* ---------- the path ---------- */
const LN_UNITS = [
  { id: 'basics', name: 'Basics', blurb: 'Hand rankings, showdowns and seats.', lessons: [
    { id: 'ranks', name: 'Hand rankings', icon: '♛', gen: lnRankings,
      intro: `<p>Every poker hand is the <b>best five cards</b> a player can make. From strongest to weakest:</p><ol class="ln-ranks"><li><b>Straight flush</b> five in a row, same suit</li><li><b>Four of a kind</b></li><li><b>Full house</b> three of a kind plus a pair</li><li><b>Flush</b> five of one suit</li><li><b>Straight</b> five in a row (A-2-3-4-5 counts)</li><li><b>Three of a kind</b></li><li><b>Two pair</b></li><li><b>One pair</b></li><li><b>High card</b></li></ol><p>The two most mixed up: a <b>flush beats a straight</b>, and a <b>full house beats a flush</b>.</p>` },
    { id: 'showdown', name: 'Which hand wins', icon: '⚖', gen: lnShowdown,
      intro: `<p>At showdown each player makes the best five cards out of their two cards and the five on the board.</p><ul><li>You can use both, one, or none of your hole cards.</li><li>Same hand type? Compare the cards that make it, then the <b>kickers</b> (the other cards), highest first.</li><li>If the best five cards match in rank, the pot is <b>split</b>. Suits never break a tie.</li></ul>` },
    { id: 'seats', name: 'Positions', icon: '◉', gen: lnPositions,
      intro: `<p>Six seats, clockwise from the first to act: <b>UTG</b> (under the gun), <b>HJ</b> (hijack), <b>CO</b> (cutoff), <b>BTN</b> (button), <b>SB</b> and <b>BB</b> (the blinds).</p><ul><li><b>Before the flop</b> the blinds have posted, so UTG acts first and the big blind last.</li><li><b>After the flop</b> the small blind acts first and the <b>button always acts last</b>.</li><li>Acting after your opponent is being <b>in position</b>. You see what they do before you decide.</li></ul>` },
    { id: 'namehand', name: 'Name your hand', icon: '?', gen: lnNameHand,
      intro: `<p>Before you can bet well you need to know what you have.</p><ul><li>Combine your two cards with the board and find the best five.</li><li>Check for flushes and straights first; they hide easily.</li><li>A paired board can give you two pair or a full house without your cards helping. If the board alone is your best hand, "the board plays".</li></ul><p class="small">Level 1 uses the flop, level 2 the turn, level 3 the river.</p>` },
    { id: 'basics-check', name: 'Checkpoint', check: true, gen: lnMix('basics'), intro: `<p>A mix of everything in this unit. Score 10 out of 12 to unlock <b>Preflop basics</b>.</p>` },
  ] },
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
    { id: 'po-easy', name: 'Pot odds', icon: '%', gen: lnPO([[.5, 1], [.33, .5, 1], [.33, .5, 1]]),
      intro: `<p>Pot odds tell you how often you need to win to call.</p><p class="mono-ex">equity needed = your call ÷ (pot + bet + your call)</p><ul><li>Half pot → <b>25%</b></li><li>Pot-size bet → <b>33%</b></li><li>A third of the pot → <b>20%</b></li></ul><p>Memorize these three; most bets are close to one of them.</p>` },
    { id: 'po-any', name: 'Any bet size', icon: '÷', gen: lnPO([FRACS, FRACS, FRACS]),
      intro: `<p>Same formula, every bet size, from a quarter pot up to twice the pot.</p><ul><li>Bigger bets need more equity: ¾ pot → 30%, 2× pot → 40%.</li><li>The most common slip is dividing by the pot <i>before</i> your call. Your call is part of what you win back.</li><li>On level 3 the bet's share of the pot isn't shown, and the choices are close together.</li></ul>` },
    { id: 'outs', name: 'Counting outs', icon: '+', gen: lnOuts,
      intro: `<p>An <b>out</b> is a card that puts you ahead.</p><ul><li>Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4.</li><li>Two overcards to a pair: about 6.</li><li>Don't count cards that also improve your opponent.</li></ul>` },
    { id: 'rule24', name: 'Rule of 2 and 4', icon: '×', gen: lnRule,
      intro: `<p>A quick way to turn outs into equity:</p><ul><li><b>One card to come</b> (turn to river): outs × 2.</li><li><b>Two cards to come</b> (all in on the flop): outs × 4.</li></ul><p>9 outs on the turn ≈ 18%. 9 outs all in on the flop ≈ 36%.</p>` },
    { id: 'price-check', name: 'Checkpoint', check: true, gen: lnMix('price'), intro: `<p>Pot odds, outs and the rule of 2 and 4 together. Score 10 out of 12 to unlock <b>Making decisions</b>.</p>` },
  ] },
  { id: 'decide', name: 'Making decisions', blurb: 'Put the price and your equity together.', lessons: [
    { id: 'matchups', name: 'Preflop matchups', icon: '⚔', gen: lnMatch,
      intro: `<p>A handful of matchups cover most all-in hands:</p><ul><li>Higher pair vs lower pair: about <b>80/20</b>.</li><li>Pair vs two higher cards: a coin flip, about <b>55/45</b>.</li><li>Two higher cards vs two lower: about <b>65/35</b>.</li><li>Dominated (sharing a card, like AK vs AQ): about <b>70/30</b>.</li></ul>` },
    { id: 'callfold', name: 'Call or fold', icon: '✓', gen: lnCF,
      intro: `<p>Now combine it all. Work out the price (pot odds), estimate your equity (outs and the rule of 2 and 4), then compare.</p><ul><li>Equity higher than the price: <b>call</b>.</li><li>Equity lower: <b>fold</b>.</li><li>You get a read on villain's hand instead of seeing their cards.</li></ul>` },
    { id: 'decide-check', name: 'Checkpoint', check: true, gen: lnMix('decide'), intro: `<p>Matchups and call-or-fold decisions. Score 10 out of 12 to finish this part of the path.</p>` },
  ] },
];
const LN_SOON = [['Reading ranges', 'Combos, hand vs range, range vs range'], ['Flop play', 'Board texture, c-bets, value and bluffs'], ['Reading hands', 'Narrowing ranges street by street'],
  ['Bigger pots', '3-bet and multiway pots'], ['Exploits', 'Adjusting to nits, stations and maniacs'], ['Tournaments', 'Push/fold and ICM'], ['Capstone', 'Playing full hands']];
const LN_ALL = LN_UNITS.flatMap((u, ui) => u.lessons.map((l, li) => ({ ...l, unit: u, ui, li })));
const lnById = id => LN_ALL.find(l => l.id === id);

/* ---------- saved progress ----------
   ln.lessons[id] = { best (level 1), b2, b3, attempts, n, c, last, placed } */
let ln = (() => { try { return JSON.parse(localStorage.getItem(LNKEY)) || {}; } catch (e) { return {}; } })();
ln = { xp: 0, peak: 0, lessons: {}, days: [], n: 0, c: 0, pre: null, ...ln };
function lnSave() { try { localStorage.setItem(LNKEY, JSON.stringify(ln)); } catch (e) {} }
const lnToday = () => new Date().toLocaleDateString('en-CA');
const lnNeed = l => LN_PASS[l.check ? 'check' : 'lesson'];
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
const lnStarHTML = l => { const s = lnStars(l); return `<span class="ln-stars" aria-label="${s} of 3 levels">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>`; };

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
  box.innerHTML = `${lnRankCard(true)}<div class="row">${nx ? `<button class="act" type="button" data-ln-go="${nx.id}">${LN_ALL.some(lnPassed) ? 'Continue' : 'Start'}: ${esc(nx.unit.name)} · ${esc(nx.name)}</button>` : '<span class="small">Every lesson in the path is passed. Go for three stars, or wait for new units.</span>'}<a class="linkbtn" href="#learn">Learning dashboard</a></div>`;
}
function lnRender() {
  lnMini(); if (lnPlay) return lnShowPlay();
  $('ln-play').hidden = true; $('ln-dash').hidden = false;
  const nx = lnNext(), qs = ln.n, acc = qs ? ln.c / qs : 0, any = LN_ALL.some(lnPassed), stars = LN_ALL.reduce((a, l) => a + lnStars(l), 0);
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
    <div class="stat"><div class="n">${lnStreak()}</div><span class="small muted">day streak</span></div>
  </div>
  <div class="ln-path">${LN_UNITS.map((u, ui) => { const p = u.lessons.filter(l => lnPassed(LN_ALL.find(x => x.id === l.id))).length;
    return `<section class="panel ln-unit" aria-labelledby="ln-u-${u.id}">
      <div class="ln-unit-h"><div><span class="eyebrow">Unit ${ui + 1}</span><h2 id="ln-u-${u.id}">${u.name}</h2><p class="small muted">${u.blurb}</p></div>
        <span class="chip ${p === u.lessons.length ? 'good' : p ? 'ok' : 'new'}">${p}/${u.lessons.length}</span></div>
      <div class="ln-nodes">${u.lessons.map((l0, li) => { const l = LN_ALL.find(x => x.id === l0.id), pa = lnPassed(l), o = lnOpen(l), r = ln.lessons[l.id], cur = nx && nx.id === l.id;
        return `<button type="button" class="ln-node${pa ? ' passed' : o ? ' open' : ' locked'}${cur ? ' current' : ''}${l.check ? ' check' : ''}${lnStars(l) === 3 ? ' gold' : ''}" data-ln-go="${l.id}" style="--off:${[0, 1, 0, -1][li % 4]}" aria-label="${esc(l.name)}${pa ? `, passed, ${lnStars(l)} of 3 stars` : o ? ', open' : ', locked'}">
          <span class="ln-dot">${pa ? (lnStars(l) === 3 ? '♛' : '✓') : o ? (l.check ? '🏁' : l.icon) : '🔒'}</span><span class="ln-name">${l.name}</span>
          ${pa ? lnStarHTML(l) : `<span class="ln-best">${r && r.attempts ? `Best ${r.best}/${lnNeed(l)[0]}` : cur ? 'Up next' : ''}</span>`}</button>`; }).join('')}</div>
    </section>`; }).join('')}
    ${LN_SOON.map(([n, b], k) => `<section class="panel ln-unit soon"><div class="ln-unit-h"><div><span class="eyebrow">Unit ${LN_UNITS.length + k + 1}</span><h2>${n}</h2><p class="small muted">${b}</p></div><span class="chip new">Coming soon</span></div></section>`).join('')}
  </div>
  <details class="panel ln-detail"><summary><b>Lesson details</b> <span class="small muted">scores by level, attempts and last played</span></summary>
    <div style="overflow-x:auto"><table class="ref"><thead><tr><th>Lesson</th><th>Status</th><th>Best L1 · L2 · L3</th><th>Attempts</th><th>Accuracy</th><th>Last played</th></tr></thead><tbody>
    ${LN_ALL.map(l => { const r = ln.lessons[l.id] || {}, p = lnPassed(l), o = lnOpen(l), b = k => lnBestAt(r, k) ? `${lnBestAt(r, k)}/${lnNeed(l)[0]}` : '–';
      return `<tr><td class="t">${l.unit.name} · ${l.name}</td><td><span class="chip ${p ? 'good' : o ? 'ok' : 'new'}">${p ? (r.placed && !r.best ? 'Placed' : 'Passed') : o ? 'Open' : 'Locked'}</span> ${p ? lnStarHTML(l) : ''}</td><td>${b(1)} · ${b(2)} · ${b(3)}</td><td>${r.attempts || 0}</td><td>${r.n ? pct(r.c / r.n, 0) : '–'}</td><td>${r.last ? new Date(r.last).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="small muted">Levels: 1 Learn, 2 Practice, 3 Master (20 seconds a question). Right answers win ${LN_LV[1].right} / ${LN_LV[2].right} / ${LN_LV[3].right} chips by level, wrong ones cost ${-LN_CHIPS.wrong}. Passing adds ${LN_LV[1].pass} / ${LN_LV[2].pass} / ${LN_LV[3].pass} the first time, ${LN_CHIPS.repass} on a repeat. Rank follows the most chips you've held.</p>
  </details>`;
}

/* ---------- lesson player ---------- */
let lnPlay = null, lnTimer = null;
function lnStart(id, lvl) {
  const l = lnById(id); if (!l) return;
  if (!lnOpen(l)) { const prev = l.li ? LN_ALL.find(x => x.ui === l.ui && x.li === l.li - 1) : LN_ALL.find(x => x.ui === l.ui - 1 && x.check); lnToast(`Pass “${prev.name}” first to unlock this lesson.`); return; }
  if (!lvl) lvl = [1, 2, 3].find(k => lnLvOpen(l, k) && !lnLvPassed(l, k)) || 3;
  const [n, need] = lnNeed(l);
  lnPlay = { kind: 'lesson', l, lvl, n, need, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, miss: [] };
  if (location.hash !== '#learn') location.hash = '#learn'; else lnShowPlay();
}
function lnPlacement() {
  lnPlay = { kind: 'pre', lvl: 2, ui: 0, inUnit: 0, wrong: 0, i: 0, right: 0, chips: 0, stage: 'intro', game: mode, placed: [], miss: [] };
  if (location.hash !== '#learn') location.hash = '#learn'; else lnShowPlay();
}
const LN_PRE_N = 8, LN_PRE_MISS = 1; /* each unit: 8 questions, at most 1 miss to place out of it */
function lnShowPlay() {
  clearTimeout(lnTimer);
  $('ln-dash').hidden = true; $('ln-play').hidden = false; const P = lnPlay, box = $('ln-play');
  const total = P.kind === 'pre' ? LN_UNITS.length * LN_PRE_N : P.n, done = P.kind === 'pre' ? P.ui * LN_PRE_N + P.inUnit : P.i;
  const head = `<div class="ln-top"><button type="button" class="linkbtn ln-quit" data-ln-quit>✕ Quit</button><div class="ln-bar"><i style="width:${done / total * 100}%"></i></div><span class="ln-pchips" id="ln-pchips">${P.chips >= 0 ? '+' : ''}${P.chips}</span></div>`;
  if (P.stage === 'intro') {
    if (P.kind === 'pre') {
      box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">Placement test</span><h2>Find your starting point</h2>
      <p>Questions run unit by unit, starting with <b>${LN_UNITS[0].name}</b>. Get 7 of 8 in a unit and every lesson in it is unlocked and marked as placed. The test stops at the first unit where you miss two.</p>
      <p class="small muted">Preflop questions use the ${mode === 'cash' ? 'cash' : 'tournament'} charts. Switch Cash/Tournament at the top first if you want the other.</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Begin</button></div></section>`;
      return;
    }
    const l = P.l;
    box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${esc(l.unit.name)} · ${l.check ? 'Checkpoint' : 'Lesson ' + (l.li + 1)}</span><h2>${esc(l.name)}</h2><div class="ln-intro">${l.intro}</div>
      <div class="ln-levels" role="group" aria-label="Level">${[1, 2, 3].map(k => { const o = lnLvOpen(l, k), pa = lnLvPassed(l, k);
        return `<button type="button" class="ln-lv${P.lvl === k ? ' on' : ''}" data-ln-lv="${k}"${o ? '' : ' disabled'} aria-pressed="${P.lvl === k}"><b>${o ? (pa ? '★ ' : '') : '🔒 '}Level ${k}</b><span>${LN_LV[k].name}</span></button>`; }).join('')}</div>
      <p class="small muted">${LN_LV[P.lvl].line} ${P.n} questions · pass with ${P.need} · ${LN_LV[P.lvl].right} chips a right answer${l.unit.id === 'preflop' ? ` · ${mode === 'cash' ? 'cash (100 BB)' : 'tournament'} charts` : ''}</p>
      <div class="row"><button class="act" type="button" data-ln-begin>Start level ${P.lvl}</button></div></section>`;
    return;
  }
  if (P.stage === 'q') {
    const q = P.q, ans = P.picked != null, ok = ans && P.picked === q.correct, tm = LN_LV[P.lvl].time;
    box.innerHTML = `${head}<section class="panel ln-card"><span class="eyebrow">${P.kind === 'pre' ? `Placement · ${LN_UNITS[P.ui].name}` : `${esc(P.l.name)} · Level ${P.lvl}`} · ${done + 1} of ${P.kind === 'pre' ? 'up to ' + total : total}</span>
      ${tm && !ans ? `<div class="ln-timer" aria-hidden="true"><i style="animation-duration:${tm}s"></i></div>` : ''}
      ${q.visual ? `<div class="qz-visual">${q.visual}</div>` : ''}<div class="ln-prompt">${q.prompt}</div>
      <div class="ln-opts">${q.opts.map((o, k) => `<button type="button" class="ln-opt${ans ? (k === q.correct ? ' right' : k === P.picked ? ' wrong' : ' dim') : ''}" data-k="${k}"${ans ? ' disabled' : ''}>${o}</button>`).join('')}</div>
      ${ans ? `<div class="ln-fb ${ok ? 'good' : 'bad'}"><b>${ok ? pick(['Nice!', 'Correct.', 'That\'s it.', 'Well played.']) : P.picked === -1 ? 'Out of time.' : 'Not quite.'}</b> <span class="ln-delta">${ok ? '+' + LN_LV[P.lvl].right : LN_CHIPS.wrong} chips</span><p>${q.explain}</p>
        <button class="act" type="button" data-ln-cont>Continue</button></div>` : ''}</section>`;
    if (ans) box.querySelector('[data-ln-cont]').focus({ preventScroll: true });
    else if (tm) { const qq = q; lnTimer = setTimeout(() => { if (lnPlay && lnPlay.q === qq && lnPlay.picked == null) lnAnswer(-1); }, tm * 1000); }
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
  const ok = P.right >= P.need, nx = lnNext(), up = P.lvl < 3 && lnLvOpen(P.l, P.lvl + 1);
  box.innerHTML = `${head}<section class="panel ln-card ln-end"><span class="eyebrow">${esc(P.l.name)} · Level ${P.lvl}</span>
    <h2>${ok ? (P.rankUp ? `Rank up: ${LN_RANKS[lnRank()].icon} ${LN_RANKS[lnRank()].name}!` : P.lvl === 3 ? 'Mastered!' : `Level ${P.lvl} passed`) : 'Not this time'}</h2>
    ${ok ? lnStarHTML(P.l) : ''}
    <p><b>${P.right} of ${P.n}</b> right. ${ok ? (P.first ? `Passing bonus +${LN_LV[P.lvl].pass} chips.` : `Bonus +${LN_CHIPS.repass} chips.`) : `You need ${P.need} to pass. Have another go; the questions change every time.`}</p>
    ${lnStacks(ln.xp, 90)}<p class="small">${P.chips >= 0 ? '+' : ''}${P.chips} chips this lesson · stack ${Math.round(ln.xp).toLocaleString()}</p>
    ${P.miss.length ? `<details class="ln-review"><summary>Review your misses (${P.miss.length})</summary>${P.miss.map(m => `<div><span class="small muted">${esc(m.short)}</span><span>${m.picked === -1 ? 'Out of time' : `You chose <b>${m.opts[m.picked]}</b>`}; the answer is <b>${m.opts[m.correct]}</b>.</span><span class="small">${m.explain}</span></div>`).join('')}</details>` : ''}
    <div class="row">${ok && nx && nx.id !== P.l.id ? `<button class="act" type="button" data-ln-go="${nx.id}">Next: ${esc(nx.name)}</button>` : ''}
      ${ok && up ? `<button class="act${nx && nx.id !== P.l.id ? ' ghost' : ''}" type="button" data-ln-go="${P.l.id}" data-ln-lvl="${P.lvl + 1}">Try level ${P.lvl + 1}</button>` : ''}
      ${!ok ? `<button class="act" type="button" data-ln-go="${P.l.id}" data-ln-lvl="${P.lvl}">Try again</button>` : ''}
      <button class="act ghost" type="button" data-ln-dash>Back to path</button></div></section>`;
}
function lnDeal() {
  const P = lnPlay; P.picked = null;
  let q; try { q = P.kind === 'pre' ? pick(LN_UNITS[P.ui].lessons.filter(l => !l.check)).gen(2) : P.l.gen(P.lvl); } catch (e) { console.warn(e); q = lnRule(2); }
  q.t0 = Date.now(); P.q = q; P.stage = 'q'; lnShowPlay(); window.scrollTo(0, $('v-learn').offsetTop - 70);
}
function lnAnswer(k) {
  const P = lnPlay, q = P.q, ok = k === q.correct; if (P.picked != null) return; P.picked = k; clearTimeout(lnTimer);
  const d = ok ? LN_LV[P.lvl].right : LN_CHIPS.wrong, before = ln.xp; lnAddChips(d); P.chips += ln.xp - before;
  ln.n++; if (ok) { ln.c++; P.right++; } else P.miss.push({ ...q, picked: k });
  if (!ln.days.includes(lnToday())) ln.days = ln.days.concat(lnToday()).slice(-60);
  if (P.kind === 'lesson') { const r = ln.lessons[P.l.id] = ln.lessons[P.l.id] || { best: 0, attempts: 0, n: 0, c: 0 }; r.n = (r.n || 0) + 1; r.c = (r.c || 0) + (ok ? 1 : 0); }
  else if (!ok) P.wrong++;
  lnSave();
  logEvent({ drill: q.drill, spot: q.spot, hand: q.hand, answer: k === -1 ? 'Out of time' : q.opts[k], expected: q.opts[q.correct], correct: ok, detail: P.kind === 'pre' ? 'Placement test' : `Lesson: ${P.l.name}, level ${P.lvl}`, ms: Date.now() - q.t0 });
  lnShowPlay();
}
function lnContinue() {
  const P = lnPlay;
  if (P.kind === 'lesson') { P.i++; if (P.i < P.n) return lnDeal(); return lnFinish(); }
  P.inUnit++; P.i++;
  if (P.wrong > LN_PRE_MISS) return lnPreEnd();
  if (P.inUnit >= LN_PRE_N) {
    P.placed.push(P.ui);
    LN_UNITS[P.ui].lessons.forEach(l => { const r = ln.lessons[l.id] = ln.lessons[l.id] || { best: 0, attempts: 0, n: 0, c: 0 }; if (!r.placed && !lnPassed(LN_ALL.find(x => x.id === l.id))) { lnAddChips(LN_CHIPS.placed); P.chips += LN_CHIPS.placed; } r.placed = true; });
    lnSave(); P.ui++; P.inUnit = 0; P.wrong = 0;
    if (P.ui >= LN_UNITS.length) return lnPreEnd();
  }
  lnDeal();
}
function lnPreEnd() { const P = lnPlay; ln.pre = { ts: Date.now(), units: P.placed.length }; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini(); }
function lnFinish() {
  const P = lnPlay, r = ln.lessons[P.l.id], ok = P.right >= P.need, was = lnLvPassed(P.l, P.lvl) || (P.lvl === 1 && r.best >= P.need), rank0 = lnRank();
  r.attempts++; r.last = Date.now();
  if (P.lvl === 1) r.best = Math.max(r.best || 0, P.right); else r['b' + P.lvl] = Math.max(r['b' + P.lvl] || 0, P.right);
  if (ok) { const b = was ? LN_CHIPS.repass : LN_LV[P.lvl].pass; lnAddChips(b); P.chips += b; P.first = !was; }
  P.rankUp = lnRank() > rank0; lnSave(); P.stage = 'end'; lnShowPlay(); lnMini();
}
function lnToast(msg) { const t = $('ln-toast'); t.textContent = msg; t.hidden = false; clearTimeout(lnToast.h); lnToast.h = setTimeout(() => t.hidden = true, 2600); }

document.addEventListener('click', e => {
  const g = e.target.closest('[data-ln-go]'); if (g) { lnStart(g.dataset.lnGo, +g.dataset.lnLvl || 0); return; }
  if (e.target.closest('[data-ln-pre]')) return lnPlacement();
  if (!lnPlay) return;
  const lv = e.target.closest('[data-ln-lv]'); if (lv && lnPlay.stage === 'intro') { lnPlay.lvl = +lv.dataset.lnLv; return lnShowPlay(); }
  if (e.target.closest('[data-ln-begin]')) return lnDeal();
  const o = e.target.closest('#ln-play .ln-opt'); if (o) return lnAnswer(+o.dataset.k);
  if (e.target.closest('[data-ln-cont]')) return lnContinue();
  if (e.target.closest('[data-ln-dash]')) { clearTimeout(lnTimer); lnPlay = null; return lnRender(); }
  const qb = e.target.closest('[data-ln-quit]');
  if (qb) { if (lnPlay.stage === 'end' || lnPlay.stage === 'intro' || qb.dataset.sure) { clearTimeout(lnTimer); lnPlay = null; lnRender(); } else { qb.dataset.sure = '1'; qb.textContent = 'Tap again to quit'; } }
});
