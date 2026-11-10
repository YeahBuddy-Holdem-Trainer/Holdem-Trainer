/* ---------- 3-bet pots and multiway pots ----------
   3-bet pots: how big to 3-bet, what to do when your open gets 3-bet (cash charts) or whether to
   3-bet shove at 20 BB (tournament charts), and the stack-to-pot ratio (SPR) after a 3-bet is called.
   Multiway pots: how much your equity drops with more players, and how often somebody has a strong hand. */
const PT_KINDS = {
  size: { label: '3-bet sizing', group: 'three' }, face: { label: 'Facing a 3-bet', group: 'three' }, spr: { label: 'SPR in a 3-bet pot', group: 'three' },
  multieq: { label: 'Equity multiway', group: 'multi' }, someone: { label: 'Does someone have it?', group: 'multi' }
};
const PT_POSN = { UTG: 'UTG', HJ: 'hijack', CO: 'cutoff', BTN: 'button', SB: 'small blind', BB: 'big blind' };
let pt = null;
/* a generic "calls a raise" range for multiway questions: roughly the top 40% of hands */
const PT_CALLR = '22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,54s,A8o+,KTo+,QTo+,JTo';

function ptSeats(roles) { const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' }); for (const [p, r] of Object.entries(roles)) seats[p] = r; return seats; }
function ptMulti(hero, opps, board, n) {   /* hero's share of the pot against several known hands */
  let s = 0, k = 0; const dead0 = [...hero, ...opps.flat(), ...board];
  for (let i = 0; i < n; i++) {
    const dead = new Set(dead0), b = board.slice();
    while (b.length < 5) { const c = Math.floor(Math.random() * 52); if (!dead.has(c)) { dead.add(c); b.push(c); } }
    const h = evalHand(hero.concat(b)), best = Math.max(h, ...opps.map(o => evalHand(o.concat(b))));
    if (h === best) { const ties = 1 + opps.filter(o => evalHand(o.concat(b)) === h).length; s += 1 / ties; } k++;
  }
  return s / k;
}
function ptMultiRange(hero, combos, nOpp, board, n) {   /* hero vs nOpp hands drawn from a range */
  let s = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const opps = [], used = new Set([...hero, ...board]);
    for (let j = 0; j < nOpp; j++) { let c, t = 0; do { c = pick(combos); } while ((used.has(c[0]) || used.has(c[1])) && ++t < 50); used.add(c[0]); used.add(c[1]); opps.push(c); }
    s += ptMulti(hero, opps, board, 1); k++;
  }
  return s / k;
}

const PT_GEN = {
  size() {
    const cash = mode === 'cash', o = cash ? 2.5 : 2.2, opener = pick(['UTG', 'HJ', 'CO', 'BTN']);
    const later = POS.slice(POS.indexOf(opener) + 1), hero = pick(later), caller = Math.random() < .3 ? pick(POS.slice(POS.indexOf(opener) + 1, POS.indexOf(hero)).concat([])) : null;
    const ip = hero !== 'SB' && hero !== 'BB', calls = caller ? 1 : 0, mult = (ip ? 3 : 4) + calls;
    const right = Math.round(o * mult * 2) / 2;
    const cands = [2.5, 3, 4, 5, 6].map(m => Math.round(o * (m + (m >= 3 ? calls : 0)) * 2) / 2).filter((x, i, a) => a.indexOf(x) === i && x !== right);
    const opts = shuffle([right, ...shuffle(cands).slice(0, 3)]);
    const roles = { [opener]: { state: 'vil', tag: 'Opens', stack: '', bet: fmtBB(o) + ' BB' }, [hero]: { state: 'hero', tag: 'You', stack: '', bet: '' } };
    if (caller) roles[caller] = { state: 'vil', tag: 'Calls', stack: '', bet: fmtBB(o) + ' BB' };
    return { kind: 'size', table: { hero, seats: ptSeats(roles), center: `<b>${fmtBB(o * (1 + calls) + 1.5 + (cash ? 0 : 1))} BB</b><span>pot</span>` },
      prompt: `The ${PT_POSN[opener]} opens to ${fmtBB(o)} BB${caller ? `, the ${PT_POSN[caller]} calls,` : ''} and you want to 3-bet from the ${PT_POSN[hero]} (${ip ? 'in position' : 'out of position'} after the flop). What size?`,
      opts: opts.map(x => `${fmtBB(x)} BB (${fmtBB(x / o)}×)`), correct: opts.indexOf(right),
      why: `<p>Standard 3-bet sizes: about <b>3× the open in position</b> and <b>4× out of position</b> (from the blinds), plus <b>one more open's worth for each caller</b>. Here that's ${ip ? 3 : 4}${calls ? ' + 1' : ''} = ${mult}× ${fmtBB(o)} BB ≈ <b>${fmtBB(right)} BB</b>.</p>
        <p class="small muted">Out of position you go bigger so the opener can't call cheaply and play the hand with position on you. Callers add dead money that your 3-bet also has to price out.${cash ? '' : ' At tournament stacks around 25 BB or less, many players 3-bet all in instead.'}</p>` };
  },
  face() {
    const cash = mode === 'cash', ids = cash ? ['cash-utg-open-vs-btn-3-bet', 'cash-co-open-vs-btn-3-bet', 'cash-btn-open-vs-bb-3-bet'] : ['tour-btn-re-shove-vs-co-20-bb', 'tour-sb-re-shove-vs-btn-20-bb', 'tour-bb-re-shove-vs-btn-20-bb'];
    const id = pick(ids), spot = SPOTS.find(s => s.id === id), { label, cards } = dealSpotHand(spot, .15), exp = spot.map.get(label) ?? spot.fold;
    return { kind: 'face', table: { ...spotTable(spot), heroCards: cards }, prompt: `${spotText(spot)} You have <b>${label}</b>. ${cash || spot.acts.includes('Call') ? 'What do you do?' : 'Do you 3-bet all in?'}`,
      opts: spot.acts, correct: exp, label, spot, why: pfWhy(spot, label, exp) + `<p class="small muted">${cash ? 'Against a 3-bet, hands that play badly in a bloated pot (weak offsuit aces, small offsuit broadways) fold; good suited hands and pairs call in position; the strongest hands and a few blockers like A5s 4-bet.' : 'At 20 BB a 3-bet shove wins the 3.5 BB already in the pot often, and still has equity when called. Hands that block calls (aces, kings) and pairs shove; hands that are too weak to shove fold.'}</p>` };
  },
  spr() {
    const cash = mode === 'cash', S = cash ? 100 : pick([40, 40, 30]), o = cash ? 2.5 : 2.2, ip = Math.random() < .5;
    const x = Math.round(o * (ip ? 3 : 4) * 2) / 2, pot = 2 * x + (ip ? 1.5 : .5) + (cash ? 0 : 1), left = S - x, spr = left / pot;
    const right = Math.round(spr * 10) / 10, cands = [spr * .5, spr * 1.6, spr * 2.2, spr * .75, spr + 3].map(v => Math.round(v * 10) / 10).filter(v => Math.abs(v - right) >= .5);
    const opts = shuffle([right, ...shuffle([...new Set(cands)]).slice(0, 3)]);
    return { kind: 'spr', prompt: `${cash ? 'Cash game' : 'Tournament'}, ${S} BB deep${cash ? '' : ' with a 1 BB ante'}. Someone opens to ${fmtBB(o)} BB, ${ip ? 'you 3-bet in position to' : 'the big blind 3-bets to'} ${fmtBB(x)} BB and it's called heads up${ip ? ' (the blinds fold)' : ''}. What is the stack-to-pot ratio (SPR) on the flop?`,
      opts: opts.map(v => fmtBB(v)), correct: opts.indexOf(right),
      why: `<p>Pot on the flop: 2 × ${fmtBB(x)} + ${fmtBB(pot - 2 * x)} dead = <b>${fmtBB(pot)} BB</b>. Stacks behind: ${S} − ${fmtBB(x)} = <b>${fmtBB(left)} BB</b>. SPR = ${fmtBB(left)} ÷ ${fmtBB(pot)} = <b>${fmtBB(right)}</b>.</p>
        <p class="small">What it means: at an SPR of about <b>3 or less</b>, top pair or an overpair is usually happy to get all the money in. Around <b>4 to 6</b>, one pair has to be careful. Above about <b>6</b>, you generally want two pair or better to stack off. 3-bet pots${cash ? '' : ' and short tournament stacks'} have low SPRs, which is why strong one-pair hands go up in value there.</p>` };
  },
  multieq() {
    const cr = [...parseRange(PT_CALLR)].flatMap(labelCombos), board = Math.random() < .5 ? [] : null;
    let hero; do { hero = pick(cr); } while (false);
    const b = board || shuffled().filter(c => !hero.includes(c)).slice(0, 3), nOpp = 1 + Math.floor(Math.random() * 3);
    const live = cr.filter(c => !hero.includes(c[0]) && !hero.includes(c[1]) && !b.includes(c[0]) && !b.includes(c[1]));
    const eqs = [1, 2, 3].map(n => ptMultiRange(hero, live, n, b, 3500)), ans = eqs[nOpp - 1];
    return { kind: 'multieq', slider: true, hero, board: b,
      table: { hero: 'BTN', seats: ptSeats({ BTN: { state: 'hero', tag: 'You', stack: '', bet: '' }, ...Object.fromEntries(['BB', 'CO', 'SB'].slice(0, nOpp).map(p => [p, { state: 'vil', tag: 'In', stack: '', bet: '' }])) }), heroCards: hero, center: b.length ? `<div class="cards">${cardsHTML(b, 'xs')}</div>` : '<span>Preflop</span>' },
      prompt: `You hold <b>${handLabel(hero)}</b> against <b>${nOpp} opponent${nOpp > 1 ? 's' : ''}</b>, each holding a typical hand that calls a raise (about the top 40%)${b.length ? ' on this flop' : ', all in before the flop'}. What's your share of the pot?`,
      answer: ans,
      why: `<table class="ref"><thead><tr><th>Opponents</th><th>Your equity</th><th>Fair share</th></tr></thead><tbody>${eqs.map((e, i) => `<tr${i === nOpp - 1 ? ' class="me"' : ''}><td class="t">${i + 1}</td><td><b>${pct(e, 0)}</b></td><td>${pct(1 / (i + 2), 0)}</td></tr>`).join('')}</tbody></table>
        ${mathBox(`<p class="small">There's no neat formula for multiway equity, but two checks help: your <b>fair share</b> is 1 ÷ (number of players), so ${pct(1 / (nOpp + 1), 0)} with ${nOpp + 1} players. Hands that are big favorites heads up usually lose about a third of their edge with each extra player; hands that make straights, flushes and sets lose less.</p>`)}
        <p class="small">Each extra player takes a slice. ${eqs[0] > .5 ? `Heads up you're a favorite at ${pct(eqs[0], 0)}, but against three you win ${pct(eqs[2], 0)} of the time.` : 'Weak hands lose even more ground.'} Hands that make the nuts (suited aces, pairs for sets, suited connectors) hold up better multiway than one-pair hands like offsuit broadways.</p>` };
  },
  someone() {
    const cr = [...parseRange(PT_CALLR)].flatMap(labelCombos), hero = pick(cr), board = shuffled().filter(c => !hero.includes(c)).slice(0, 3);
    const live = cr.filter(c => !hero.includes(c[0]) && !hero.includes(c[1]) && !board.includes(c[0]) && !board.includes(c[1]));
    const nOpp = 1 + Math.floor(Math.random() * 3);
    const strong = new Set(live.filter(c => RVB_STRONG.has(rvbClassify(c, board).made)).map(c => c.join()));
    const prob = n => { let hit = 0; const N = 6000; for (let i = 0; i < N; i++) { const used = new Set(); let any = false;
      for (let j = 0; j < n; j++) { let c, t = 0; do { c = pick(live); } while ((used.has(c[0]) || used.has(c[1])) && ++t < 50); used.add(c[0]); used.add(c[1]); if (strong.has(c.join())) any = true; }
      if (any) hit++; } return hit / N; };
    const ps = [1, 2, 3].map(prob), ans = ps[nOpp - 1];
    return { kind: 'someone', slider: true, hero, board,
      table: { hero: 'BTN', seats: ptSeats({ BTN: { state: 'hero', tag: 'You', stack: '', bet: '' }, ...Object.fromEntries(['BB', 'CO', 'SB'].slice(0, nOpp).map(p => [p, { state: 'vil', tag: 'In', stack: '', bet: '' }])) }), heroCards: hero, center: `<div class="cards">${cardsHTML(board, 'xs')}</div>` },
      prompt: `${nOpp} opponent${nOpp > 1 ? 's' : ''} called preflop with typical calling hands (about the top 40%). On this flop, what's the chance that <b>at least one of them has two pair or better</b>?`,
      answer: ans,
      why: `<table class="ref"><thead><tr><th>Opponents</th><th>Someone has two pair+</th></tr></thead><tbody>${ps.map((e, i) => `<tr${i === nOpp - 1 ? ' class="me"' : ''}><td class="t">${i + 1}</td><td><b>${pct(e, 0)}</b></td></tr>`).join('')}</tbody></table>
        ${mathBox(`<p class="small">If one caller has two pair or better with chance <i>p</i>, the chance that at least one of <i>n</i> callers does is about <b>1 − (1 − p)<sup>n</sup></b>.</p>
          <p class="small">Here <i>p</i> ≈ ${pct(ps[0], 0)}, so with ${nOpp} caller${nOpp > 1 ? 's' : ''}: 1 − (1 − ${(ps[0]).toFixed(2)})<sup>${nOpp}</sup> = <b>${pct(1 - Math.pow(1 - ps[0], nOpp), 0)}</b> (simulation: ${pct(ans, 0)}; cards the others hold make it slightly different).</p>`)}
        <p class="small">With more players, the chance that <i>somebody</i> connected strongly climbs fast. Multiway, bluff less (someone is likelier to have a hand that won't fold), bet thinner value less, and treat a bet or raise from one of several players as stronger than the same action heads up.</p>` };
  }
};

function newPT() {
  const g = $('pt-group').value, kinds = Object.keys(PT_KINDS).filter(k => g === 'mixed' || PT_KINDS[k].group === g);
  pt = { ...PT_GEN[pick(kinds)](), done: false, t0: Date.now() };
  $('pt-kind').textContent = PT_KINDS[pt.kind].label;
  $('pt-table').hidden = !pt.table; if (pt.table) renderTable($('pt-table'), pt.table);
  $('pt-q').innerHTML = pt.prompt;
  if (pt.slider) {
    $('pt-ans').innerHTML = `<label for="pt-guess"><span class="lbl">Your guess: <b id="pt-gv" style="font-family:var(--mono)">50</b>%</span></label><input type="range" id="pt-guess" min="0" max="100" value="50"><div class="row"><button class="act" type="button" id="pt-lock">Lock in</button></div>`;
    $('pt-guess').oninput = () => { $('pt-gv').textContent = $('pt-guess').value; };
    $('pt-lock').onclick = () => ptAnswer(+$('pt-guess').value);
  } else {
    $('pt-ans').innerHTML = `<div class="row pt-opts">${pt.opts.map((o, i) => `<button class="act ghost" type="button" data-i="${i}">${o}</button>`).join('')}</div>`;
    $('pt-ans').querySelectorAll('[data-i]').forEach(b => b.onclick = () => ptAnswer(+b.dataset.i));
  }
  $('pt-out').innerHTML = '<p class="small muted">Answer to see the explanation.</p>';
}
function ptAnswer(v) {
  if (!pt || pt.done) return; pt.done = true;
  let ok, head, err = '';
  if (pt.slider) { const miss = Math.abs(v - pt.answer * 100); ok = miss <= 7; err = Math.round(miss * 10) / 10;
    head = `<strong>${ok ? (miss < 2 ? 'Spot on' : 'Close') : 'Off by ' + miss.toFixed(0) + ' pts'}</strong><span>You said ${v}%; the answer is ${pct(pt.answer, 0)}.</span>`; }
  else { ok = v === pt.correct; head = `<strong>${ok ? 'Right' : 'Not quite'}</strong><span>${ok ? '' : `You chose ${pt.opts[v]}. `}The answer is <b>${pt.opts[pt.correct]}</b>.</span>`;
    $('pt-ans').querySelectorAll('[data-i]').forEach(b => { b.disabled = true; const i = +b.dataset.i; if (i === pt.correct) b.classList.add('right'); else if (i === v) b.classList.add('wrong'); }); }
  if (pt.slider) $('pt-lock').disabled = true;
  const st = stats.pots = stats.pots || { n: 0, c: 0 }; st.n++; if (ok) st.c++; save(); ptStats();
  logEvent({ drill: '3-bet & multiway', spot: PT_KINDS[pt.kind].label, hand: pt.label || (pt.hero ? names(pt.hero) : ''), answer: pt.slider ? v : pt.opts[v], expected: pt.slider ? Math.round(pt.answer * 100) : pt.opts[pt.correct], correct: ok, error: err, detail: mode === 'cash' ? 'Cash' : 'Tournament', ms: Date.now() - pt.t0 });
  $('pt-out').innerHTML = `<div class="verdict ${ok ? 'good' : 'bad'}">${head}</div>${pt.why}`;
  $('pt-next').focus();
}
$('pt-next').onclick = newPT;
$('pt-group').onchange = newPT;
function ptStats() { const s = stats.pots || { n: 0, c: 0 }; $('pt-n').textContent = s.n; $('pt-acc').textContent = s.n ? pct(s.c / s.n, 0) : '–'; }
function ptInit() { ptStats(); newPT(); }
