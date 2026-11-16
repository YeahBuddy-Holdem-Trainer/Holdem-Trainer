/* ---------- How I play: a real table ----------
   A 6- or 9-handed no-limit game. Every seat is dealt cards and plays them by its player type: preflop from the
   charts (widened or narrowed for the type), after the flop by hand strength. You play one seat; your decisions are
   logged for analysis. The engine handles blinds, the big-blind ante in tournaments, min-raise rules, all-ins,
   side pots and split pots.
   Players are kept in position order (UTG first ... BB last); preflop action starts at UTG, later streets at the SB. */
const G_POS = { 6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'], 9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] };
/* player types. open: width of their opening range vs the chart; k3/kc: 3-bet and call widths facing a raise;
   agg: how often they bet when checked to; bluff: how much of that is with weak hands; callPost: extra calling after the
   flop; limp: share of non-raising hands they limp (recreational players) */
const G_TYPES = {
  reg: { name: 'Regular', tag: 'REG', open: 1, k3: 1, kc: 1, agg: 1, bluff: 1, callPost: 0, limp: 0 },
  nit: { name: 'Nit', tag: 'NIT', open: .65, k3: .6, kc: .7, agg: .7, bluff: .4, callPost: -.15, limp: 0 },
  lag: { name: 'Loose-aggressive', tag: 'LAG', open: 1.4, k3: 1.7, kc: 1.2, agg: 1.3, bluff: 1.5, callPost: 0, limp: 0 },
  rec: { name: 'Recreational', tag: 'REC', open: 1.5, k3: .5, kc: 1.7, agg: .75, bluff: .7, callPost: .12, limp: .55 },
  station: { name: 'Calling station', tag: 'STATION', open: 1.7, k3: .3, kc: 2.3, agg: .5, bluff: .3, callPost: .28, limp: .7 },
  maniac: { name: 'Maniac', tag: 'MANIAC', open: 2.2, k3: 2.6, kc: 1.3, agg: 1.8, bluff: 2.5, callPost: .05, limp: 0 },
};
const G_MIX = { mixed: { reg: 3, rec: 3, nit: 1.5, lag: 1.5, station: 1, maniac: .5 }, loose: { rec: 4, station: 3, maniac: 1, reg: 1 }, tough: { reg: 4, lag: 3, nit: 2, rec: 1 } };
const gPickType = mix => { const w = G_MIX[mix] || G_MIX.mixed, t = Object.values(w).reduce((a, b) => a + b, 0); let r = Math.random() * t; for (const [k, v] of Object.entries(w)) { if ((r -= v) <= 0) return k; } return 'reg'; };
/* hand strength as a share of all hands: AA is 0.005, 72o is 1 */
const G_PCT = (() => { const o = {}; let n = 0; for (const l of LB_ORDER) { n += combosOf(l); o[l] = n / 1326; } return o; })();
const gR = x => Math.round(x * 10) / 10;

/* ---------- chart widths ---------- */
const gSeat6 = (pos, n) => n === 6 ? pos : ({ UTG: 'UTG', 'UTG+1': 'UTG', 'UTG+2': 'UTG', LJ: 'UTG' })[pos] || pos;
const gNineTight = (pos, n) => n === 9 ? ({ UTG: .7, 'UTG+1': .8, 'UTG+2': .9 })[pos] || 1 : 1;
const gChart = id => SPOTS.find(s => s.id === id);
const gWidth = (s, acts) => s ? [...s.map].filter(([, a]) => acts.includes(s.acts[a])).reduce((t, [l]) => t + combosOf(l), 0) / 1326 : 0;
/* opening chart for a seat at this stack: id, width, and whether it is a shove chart */
function gOpenChart(pos, n, game, stack) {
  const s = gSeat6(pos, n).toLowerCase();
  if (game === 'cash') { const c = gChart(`cash-${s}-open`); return { id: c && c.id, w: gWidth(c, ['Raise']) * gNineTight(pos, n), shove: false }; }
  const ids = stack <= 12 ? [`tour-${s}-shove-10-bb`, `tour-${s}-shove-15-bb`] : stack <= 17 ? [`tour-${s}-shove-15-bb`, `tour-${s}-shove-10-bb`] : stack <= 30 ? [`tour-${s}-open-25-bb`, `tour-${s}-open-40-bb`] : [`tour-${s}-open-40-bb`];
  for (const id of ids) { const c = gChart(id); if (c) return { id, w: gWidth(c, ['Raise', 'Shove']) * gNineTight(pos, n), shove: /shove/.test(id) }; }
  /* no chart for this seat (e.g. HJ at 15 BB): use the nearest earlier seat's, a bit tighter */
  const c = gChart(`tour-co-${stack <= 17 ? 'shove-15-bb' : 'open-40-bb'}`); return { id: null, w: gWidth(c, ['Raise', 'Shove']) * .8 * gNineTight(pos, n), shove: stack <= 17 };
}

/* ---------- the hand ---------- */
let g = null;   /* the hand in play */
function gNewHand(cfg) {
  const n = cfg.n, pos = G_POS[n], deck = shuffled(), S = cfg.stack, tour = cfg.game === 'tour';
  const players = pos.map((p, i) => ({ i, pos: p, type: cfg.seats[i] || 'reg', hero: i === cfg.heroIdx, stack: S, hole: [deck[2 * i], deck[2 * i + 1]], folded: false, allin: false, bet: 0, total: 0, acted: false }));
  g = { cfg, n, players, deck: deck.slice(2 * n), board: [], street: 0, curBet: 0, minInc: 1, raises: 0, opens: 0, cur: -1, log: [], pfAgg: -1, lastAgg: -1, done: false, result: null, heroAuto: false, ante: tour ? 1 : 0, dec: [], t0: Date.now() };
  const sb = players[n - 2], bb = players[n - 1];
  gPut(sb, Math.min(.5, sb.stack)); gPut(bb, Math.min(1, bb.stack));
  if (tour) { const a = Math.min(1, bb.stack); bb.stack -= a; bb.total += a; if (!bb.stack) bb.allin = true; }   /* big-blind ante: dead money */
  g.curBet = 1; g.minInc = 1;
  gLog(-1, `Blinds .5 / 1${tour ? ', big-blind ante 1' : ''}.`);
  g.cur = gNextFrom(-1);
  return g;
}
function gPut(p, x) { x = Math.min(x, p.stack); p.stack = gR(p.stack - x); p.bet = gR(p.bet + x); p.total = gR(p.total + x); if (p.stack <= 1e-9) { p.stack = 0; p.allin = true; } }
const gPot = () => gR(g.players.reduce((a, p) => a + p.total, 0));
const gIn = () => g.players.filter(p => !p.folded);
const gCanAct = p => !p.folded && !p.allin;
const gToCall = p => gR(Math.max(0, g.curBet - p.bet));
const gName = p => p.hero ? 'You' : p.pos;
function gLog(who, text) { g.log.push({ st: g.street, who, text }); }
/* street order: preflop UTG..BB; after the flop SB, BB, UTG..BTN */
function gOrder() { const n = g.n; return g.street === 0 ? [...Array(n).keys()] : [n - 2, n - 1, ...Array(n - 2).keys()]; }
function gNextFrom(idx) {
  const ord = gOrder(), start = idx < 0 ? 0 : ord.indexOf(idx) + 1;
  for (let k = 0; k < ord.length; k++) { const p = g.players[ord[(start + k) % ord.length]]; if (gCanAct(p) && (!p.acted || p.bet < g.curBet - 1e-9)) return p.i; }
  return -1;
}
/* legal raise: at least the last raise size more than the current bet, unless all in */
function gMinTo(p) { return gR(Math.min(p.stack + p.bet, g.curBet + g.minInc)); }
function gAct(p, act, to) {
  const tc = gToCall(p);
  if (act === 'check' && tc > 0) act = 'call';
  if (act === 'fold' && tc <= 0) act = 'check';
  if (act === 'fold') { p.folded = true; gLog(p.i, `${gName(p)} fold${p.hero ? '' : 's'}.`); }
  else if (act === 'check') { gLog(p.i, `${gName(p)} check${p.hero ? '' : 's'}.`); }
  else if (act === 'call') { const x = Math.min(tc, p.stack); gPut(p, x); gLog(p.i, `${gName(p)} ${g.street === 0 && g.curBet === 1 && !g.raises ? (p.hero ? 'limp' : 'limps') : p.hero ? 'call' : 'calls'} ${fmtBB(x)}${p.allin ? ' and is all in' : ''}.`); }
  else { /* bet / raise / all in, to a total for this street */
    let T = act === 'allin' ? p.stack + p.bet : Math.max(to || 0, gMinTo(p)); T = gR(Math.min(T, p.stack + p.bet));
    if (T <= g.curBet + 1e-9) return gAct(p, 'call');
    const inc = T - g.curBet, wasBet = g.curBet === 0 || (g.street === 0 && g.curBet === 1 && !g.raises && false);
    gPut(p, T - p.bet);
    const word = g.curBet === 0 ? 'bet' : g.street === 0 ? (g.raises === 0 ? (p.hero ? 'raise to' : 'raises to') : g.raises === 1 ? (p.hero ? '3-bet to' : '3-bets to') : (p.hero ? `${g.raises + 2}-bet to` : `${g.raises + 2}-bets to`)) : (p.hero ? 'raise to' : 'raises to');
    gLog(p.i, `${gName(p)} ${word === 'bet' ? (p.hero ? 'bet' : 'bets') : word} ${fmtBB(T)}${p.allin ? ' (all in)' : ''}.`);
    if (inc >= g.minInc - 1e-9) { g.minInc = gR(inc); for (const q of g.players) if (q !== p) q.acted = false; }   /* a full raise reopens the betting */
    g.curBet = T; g.raises++; g.lastAgg = p.i; if (g.street === 0) g.pfAgg = p.i;
  }
  p.acted = true;
  if (gIn().length === 1) return gFinish();
  const nx = gNextFrom(p.i);
  if (nx < 0) return gEndStreet();
  g.cur = nx;
}
function gEndStreet() {
  for (const p of g.players) { p.bet = 0; p.acted = false; }
  g.curBet = 0; g.minInc = 1; g.raises = 0; g.lastAgg = -1;
  if (g.street === 3) return gFinish();
  if (g.cfg.only === 0 && g.street === 0) { g.street = 1; g.done = true; g.stopped = true; g.result = null; return; }   /* preflop-only training */
  g.street++; const add = g.street === 1 ? 3 : 1; g.board.push(...g.deck.splice(0, add));
  gLog(-1, `${['', 'Flop', 'Turn', 'River'][g.street]}: ${names(g.street === 1 ? g.board : g.board.slice(-1))} (pot ${fmtBB(gPot())}).`);
  const can = g.players.filter(gCanAct);
  if (can.length <= 1) { while (g.board.length < 5) g.board.push(g.deck.shift()); g.street = 3; return gFinish(); }   /* everyone else all in: run it out */
  g.cur = gNextFrom(-1);
}
/* award the pot: by folds, or at showdown with side pots for all-ins */
function gFinish() {
  g.done = true; const ps = g.players, live = gIn(), won = new Map(ps.map(p => [p.i, 0]));
  if (live.length === 1) { won.set(live[0].i, gPot()); gLog(live[0].i, `${gName(live[0])} win${live[0].hero ? '' : 's'} ${fmtBB(gPot())}.`); g.showdown = false; }
  else {
    while (g.board.length < 5) g.board.push(g.deck.shift());
    const val = new Map(live.map(p => [p.i, evalHand(p.hole.concat(g.board))]));
    const levels = [...new Set(ps.map(p => p.total).filter(x => x > 0))].sort((a, b) => a - b); let prev = 0;
    for (const L of levels) {
      const amt = ps.reduce((a, p) => a + Math.max(0, Math.min(p.total, L) - prev), 0), elig = live.filter(p => p.total >= L - 1e-9);
      if (amt > 0) { const pool = elig.length ? elig : live, best = Math.max(...pool.map(p => val.get(p.i))), w = pool.filter(p => val.get(p.i) === best);
        for (const p of w) won.set(p.i, won.get(p.i) + amt / w.length); }
      prev = L;
    }
    g.showdown = true;
    for (const p of live) gLog(p.i, `${gName(p)} show${p.hero ? '' : 's'} ${names(p.hole)}: ${catName(val.get(p.i)).toLowerCase()}.`);
    for (const p of ps) if (won.get(p.i) > 1e-9) gLog(p.i, `${gName(p)} win${p.hero ? '' : 's'} ${fmtBB(Math.round(won.get(p.i) * 100) / 100)}.`);
  }
  /* exact amounts (a split pot can leave half-chips), rounded only for display */
  g.result = Object.fromEntries(ps.map(p => [p.i, won.get(p.i) - p.total]));
  for (const p of ps) p.stack = p.stack + won.get(p.i);
}

/* ---------- opponents ---------- */
function gEffStack(p) { const others = g.players.filter(q => q !== p && !q.folded).map(q => q.stack + q.bet); return Math.min(p.stack + p.bet, Math.max(...others, 0)); }
function gBot(p) {
  const T = G_TYPES[p.type] || G_TYPES.reg, tc = gToCall(p), pot = gPot(), stack = p.stack + p.bet;
  const sized = to => to >= stack * .4 + p.bet * 0 ? { act: 'allin' } : { act: 'raise', to: gR(to) };
  if (g.street === 0) {
    const l = handLabel(p.hole), pc = G_PCT[l], game = g.cfg.game, eff = gEffStack(p), oc = gOpenChart(p.pos, g.n, game, eff), r = g.raises;
    const limpers = g.players.filter(q => !q.folded && q.bet === 1 && q.i < g.n - 1 && !r).length - (p.pos === 'BB' ? 0 : 0);
    if (r === 0) {   /* unopened or limped */
      if (p.pos === 'BB') return pc < .08 * T.k3 + .02 ? sized(3 + limpers * 1) : { act: 'check' };
      const w = oc.w * T.open, iso = limpers ? w * .7 : w;
      if (oc.shove && pc < w) return { act: 'allin' };
      if (pc < iso) { if (T.limp && !limpers && Math.random() < T.limp * .8 && pc > .03) return { act: 'call' }; return sized((p.pos === 'SB' ? 3 : game === 'tour' ? 2.2 : 2.5) + limpers + (p.type === 'maniac' ? 1 : 0)); }
      if (T.limp && pc < Math.min(.6, w * 1.9) && Math.random() < T.limp) return { act: 'call' };
      if (p.pos === 'SB' && limpers && pc < .45 && T.kc >= 1) return { act: 'call' };
      return { act: 'fold' };
    }
    const raiser = g.players[g.pfAgg], callers = g.players.filter(q => !q.folded && q !== raiser && q !== p && q.bet === g.curBet).length;
    if (r === 1) {   /* facing one raise */
      if (raiser.allin || g.curBet >= eff * .5) { const w = Math.min(.25, gOpenChart(raiser.pos, g.n, game, eff).w * .55) * T.kc * (p.pos === 'BB' ? 1.3 : 1); return pc < w ? { act: 'call' } : { act: 'fold' }; }
      const me6 = gSeat6(p.pos, g.n).toLowerCase(), op6 = gSeat6(raiser.pos, g.n).toLowerCase(), ch = gChart(game === 'cash' ? `cash-${me6}-vs-${op6}-open` : `tour-${me6}-vs-${op6}-open-40-bb`);
      const wo = gOpenChart(raiser.pos, g.n, game, eff).w;
      let w3 = ch ? gWidth(ch, ['3-bet']) : wo * .22, wc = ch ? gWidth(ch, ['3-bet', 'Call']) : wo * (p.pos === 'BB' ? 1.1 : p.pos === 'SB' ? .3 : .55);
      if (eff <= 22 && game === 'tour') { return pc < wo * .3 * T.k3 ? { act: 'allin' } : pc < (p.pos === 'BB' ? wo * .5 : 0) * T.kc ? { act: 'call' } : { act: 'fold' }; }
      w3 *= T.k3; wc = Math.max(w3, wc * T.kc * (1 - .12 * callers));
      if (pc < w3 || (T.bluff > 1.2 && pc < wc * 1.4 && Math.random() < .06 * T.bluff)) { const ip = ['BTN', 'CO'].includes(p.pos), to = g.curBet * (ip ? 3 : 4) + g.curBet * callers; return sized(to); }
      return pc < wc ? { act: 'call' } : { act: 'fold' };
    }
    if (r === 2) { const w4 = .026 * T.k3, wc = .07 * T.kc * (eff > 60 ? 1 : .6); if (pc < w4) return sized(g.curBet * 2.3); return pc < wc ? { act: 'call' } : { act: 'fold' }; }
    return pc < .018 * Math.max(1, T.k3 * .8) ? { act: 'allin' } : pc < .03 * T.kc && tc < stack * .3 ? { act: 'call' } : { act: 'fold' };
  }
  /* after the flop: hand strength tier, how many players, and the type's habits */
  const tier = fhTier(p.hole, g.board), m = gIn().length - 1, pfr = g.pfAgg === p.i, rnd = Math.random();
  if (tc <= 0) {
    const base = { monster: .75, strong: .65, medium: .35, draw: .45, gut: .2, weak: .15, air: .18 }[tier];
    let pr = base * T.agg; if (['air', 'gut', 'weak'].includes(tier)) pr = pr * T.bluff / Math.max(1, m * 1.5) + (pfr && m === 1 && g.street === 1 ? .25 * T.bluff : 0);
    if (rnd < Math.min(.95, pr)) { const f = ['air', 'gut', 'weak'].includes(tier) ? .4 : tier === 'draw' ? .55 : p.type === 'rec' && tier === 'strong' ? .4 : .66; const to = gR(Math.max(1, pot * f * (p.type === 'maniac' ? 1.3 : 1))); return to >= p.stack * .6 ? { act: 'allin' } : { act: 'raise', to }; }
    return { act: 'check' };
  }
  const f = tc / Math.max(1, pot - tc), raised = g.raises > 1;
  let call = { monster: .5, strong: .9 - .1 * f, medium: .72 - .3 * f, draw: .72 - .25 * f, gut: .32 - .2 * f, weak: .28 - .25 * f, air: .05 }[tier], raise = { monster: .45, strong: .08, medium: 0, draw: .08, gut: 0, weak: 0, air: .03 }[tier];
  if (['medium', 'weak', 'gut'].includes(tier)) call -= .1 * (m - 1);
  call += T.callPost; raise *= T.agg * (tier === 'air' ? T.bluff : 1);
  if (raised) { call = tier === 'monster' ? .5 : tier === 'strong' ? .55 + T.callPost : tier === 'draw' ? .3 + T.callPost : T.callPost > .2 ? .2 : .03; raise = tier === 'monster' ? .45 : 0; }
  if (tc >= p.stack * .9) { raise = 0; call = tier === 'monster' ? .98 : tier === 'strong' ? .7 + T.callPost : tier === 'draw' ? .35 + T.callPost : T.callPost > .2 ? .15 : .02; }
  if (rnd < raise) { const to = gR(g.curBet * 3); return to >= p.stack * .4 + p.bet ? { act: 'allin' } : { act: 'raise', to }; }
  if (rnd < raise + Math.max(0, Math.min(.98, call))) return { act: 'call' };
  return { act: 'fold' };
}
/* run opponents (and you, when the app plays for you) until it's your turn or the hand ends */
function gRunBots(sync = true) {
  let guard = 0;
  while (!g.done && guard++ < 500) { const p = g.players[g.cur]; if (p.hero && !g.heroAuto) return; const d = gBot(p); gAct(p, d.act, d.to); }
}
/* the app plays your seat as a regular until the street you're training (flop, turn or river) */
function gLeadIn(cfg, tries = 300) {
  for (let t = 0; t < tries; t++) {
    gNewHand(cfg); g.heroAuto = true;
    let guard = 0;
    while (!g.done && guard++ < 500) { const p = g.players[g.cur]; if (p.hero && g.street >= cfg.start) break; const d = gBot(p); gAct(p, d.act, d.to); }
    const h = g.players[cfg.heroIdx];
    if (!g.done && !h.folded && g.street === cfg.start && g.players[g.cur].hero) { g.heroAuto = false; g.leadIn = g.log.length; return g; }
  }
  gNewHand(cfg); g.heroAuto = false; return g;   /* couldn't reach it: play the hand from the start */
}

/* ---------- How I play: the table on screen ---------- */
const G_STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
const G_MODES = { pre: ['Preflop', 0], flop: ['Flop', 1], turn: ['Turn', 2], river: ['River', 3], full: ['Full hand', 0] };
let gs = null;   /* the session: table types by physical seat (0 = you), your position, settings */
function gCfgDefault() { return { only: 'full', n: 9, mix: 'mixed', stack: mode === 'cash' ? 100 : 40, speed: 'normal' }; }
function gSetupRender() {
  const c = hp.gcfg = { ...gCfgDefault(), ...(hp.gcfg || {}) }, game = mode === 'cash' ? 'cash' : 'tour';
  if (game === 'cash' && ![40, 100, 200].includes(c.stack)) c.stack = 100; if (game === 'tour' && ![10, 15, 25, 40].includes(c.stack)) c.stack = 40;
  const seg = (id, opts, v) => `<div class="seg" data-g="${id}" role="group">${opts.map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${String(k) === String(v)}">${t}</button>`).join('')}</div>`;
  $('g-setup').innerHTML = `
    <h3 class="lb-h3">Sit down at a ${game === 'cash' ? 'cash' : 'tournament'} table</h3>
    <p class="small">Every seat gets cards and plays them like its player type. Your decisions are saved for <b>My results</b>; nothing is graded while you play.</p>
    <div class="g-opt"><span class="lbl">What to train</span>${seg('only', Object.entries(G_MODES).map(([k, [t]]) => [k, t]), c.only)}
      <p class="small muted">${c.only === 'pre' ? 'Each hand stops when the preflop betting ends.' : c.only === 'full' ? 'Play every hand from the deal to the end.' : `The app plays your seat by the charts until you're in a hand on the ${G_MODES[c.only][0].toLowerCase()}, then you play it out.`}</p></div>
    <div class="g-opt"><span class="lbl">Table</span>${seg('n', [[6, '6-handed'], [9, '9-handed']], c.n)}</div>
    <div class="g-opt"><span class="lbl">Opponents</span>${seg('mix', [['mixed', 'Mixed'], ['loose', 'Loose (recreational, stations)'], ['tough', 'Tough (regulars, aggressive)']], c.mix)}</div>
    <div class="g-opt"><span class="lbl">Starting stacks</span>${seg('stack', (game === 'cash' ? [40, 100, 200] : [10, 15, 25, 40]).map(v => [v, v + ' BB']), c.stack)}</div>
    <div class="g-opt"><span class="lbl">Speed</span>${seg('speed', [['normal', 'Normal'], ['fast', 'Fast']], c.speed)}</div>
    <div class="row"><button class="act" type="button" id="g-start">Sit down</button></div>`;
}
$('g-setup').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'), s = b && b.closest('[data-g]');
  if (s) { const k = s.dataset.g, v = b.dataset.v; hp.gcfg[k] = ['n', 'stack'].includes(k) ? +v : v; hpSave(); gSetupRender(); return; }
  if (e.target.closest('#g-start')) gStart();
});
function gStart() {
  const c = hp.gcfg; gs = { n: c.n, types: [null, ...Array.from({ length: c.n - 1 }, () => gPickType(c.mix))], heroIdx: Math.floor(Math.random() * c.n), hands: 0, net: 0 };
  $('g-setup').hidden = true; $('g-game').hidden = false; gDeal();
}
function gDeal() {
  const c = hp.gcfg, n = gs.n, game = mode === 'cash' ? 'cash' : 'tour';
  gs.heroIdx = (gs.heroIdx - 1 + n) % n;   /* the button moves: you move one seat earlier */
  const seats = []; for (let k = 0; k < n; k++) seats[(gs.heroIdx + k) % n] = k === 0 ? 'reg' : gs.types[k];
  const cfg = { n, game, stack: c.stack, seats, heroIdx: gs.heroIdx, start: G_MODES[c.only][1], only: c.only === 'pre' ? 0 : null };
  if (cfg.start > 0) gLeadIn(cfg); else gNewHand(cfg);
  g.id = Date.now(); g.mode = c.only; gs.hands++;
  gShow(); gAdvance();
}
const gDelay = () => hp.gcfg.speed === 'fast' ? 140 : 480;
/* opponents act one at a time (with a short pause), then it's your turn or the hand is over */
function gAdvance() {
  clearTimeout(gs.tm);
  if (g.done) return gHandOver();
  const p = g.players[g.cur];
  if (p.hero) { gShow(); return; }
  const heroOut = g.players[g.cfg.heroIdx].folded;
  gs.tm = setTimeout(() => { const d = gBot(p); gAct(p, d.act, d.to); if (heroOut) { gRunBots(); return gHandOver(); } gShow(); gAdvance(); }, heroOut ? 0 : gDelay());
}
/* seat positions around an oval; physical seat 0 (you) at the bottom, then clockwise */
/* seat spots (x, y in %): 6-handed uses fixed spots so side seats stay clear of the board; 9-handed uses an ellipse */
const G_SPOTS6 = [[50, 89], [9, 68], [9, 28], [50, 10], [91, 28], [91, 68]];
function gSeatXY(k, n) {
  let x, y;
  if (n === 6) [x, y] = G_SPOTS6[k];
  else { const a = Math.PI / 2 + k * 2 * Math.PI / n; x = 50 + 44 * Math.cos(a); y = 50 + 40 * Math.sin(a); }
  /* the bet chip sits between the seat and the middle */
  return { x, y, bx: 50 + (x - 50) * .56, by: 50 + (y - 50) * (y < 50 ? .5 : .6) };
}
function gShow() {
  const n = g.n, H = g.players[g.cfg.heroIdx], sd = g.done && g.showdown;
  let h = `<div class="rt-felt"><div class="rt-center"><div class="cards">${cardsHTML(g.board, 'xs')}</div><b>${fmtBB(gPot())} BB</b><span>pot</span></div>`;
  for (let k = 0; k < n; k++) {
    const p = g.players[(g.cfg.heroIdx + k) % n], xy = gSeatXY(k, n), T = G_TYPES[p.type], show = p.hero || (sd && !p.folded), act = !g.done && g.cur === p.i;
    h += `<div class="rt-seat${p.hero ? ' me' : ''}${p.folded ? ' out' : ''}${act ? ' acting' : ''}" style="left:${xy.x}%;top:${xy.y}%">
      <span class="rt-pos">${p.pos}${p.pos === 'BTN' ? ' <i class="rt-d">D</i>' : ''}</span>${show && !p.hero ? '' : `<span class="rt-tag">${p.hero ? 'You' : T.tag}</span>`}
      <span class="rt-cards">${p.folded && !p.hero ? '' : show ? cardsHTML(p.hole, 'xs') : '<span class="rt-backs"><i></i><i></i></span>'}</span>
      <span class="rt-stack">${p.allin && !g.done ? 'ALL IN' : fmtBB(p.stack)}</span></div>`;
    if (p.bet > 0) h += `<div class="rt-bet" style="left:${xy.bx}%;top:${xy.by}%"><i></i>${fmtBB(p.bet)}</div>`;
  }
  $('g-table').className = `rt rt-${n}`; $('g-table').innerHTML = h + '</div>';
  const mine = !g.done && g.players[g.cur] === H;
  $('g-info').innerHTML = `<b>${G_MODES[g.mode][0]}</b> · ${n}-handed · you're <b>${H.pos}</b> with ${names(H.hole)} · ${G_STREETS[Math.min(g.street, 3)]}`;
  /* the hand so far (the part the app played for you is marked) */
  $('g-log').innerHTML = g.log.map((x, i) => `<li class="${x.who === g.cfg.heroIdx ? 'me' : ''}${g.leadIn && i < g.leadIn ? ' auto' : ''}">${x.text}</li>`).join('');
  $('g-log').scrollTop = 1e6;
  if (!mine) { $('g-acts').innerHTML = g.done ? '' : `<p class="small muted">${gName(g.players[g.cur])} to act…</p>`; return; }
  const tc = gToCall(H), stack = H.stack + H.bet, minTo = gMinTo(H), pot = gPot(), steps = [];
  if (stack > g.curBet + 1e-9) { steps.push(minTo); for (let v = Math.floor(minTo * 2) / 2 + .5; v < stack - 1e-9; v += v >= 30 ? 1 : .5) steps.push(gR(v)); if (steps[steps.length - 1] >= stack - 1e-9) steps.pop(); }
  const potTo = gR(g.curBet + (pot + tc)), pre = g.street === 0;
  const presets = (pre ? (g.raises === 0 ? [[2, '2×'], [2.5, '2.5×', 1], [3, '3×'], [potTo, 'Pot']] : [[g.curBet * 3, '3×', 1], [g.curBet * 4, '4×'], [potTo, 'Pot']])
    : (g.curBet === 0 ? [[pot / 3, '⅓'], [pot / 2, '½', 1], [pot * .75, '¾'], [pot, 'Pot']] : [[g.curBet * 2.5, '2.5×', 1], [g.curBet * 3, '3×'], [potTo, 'Pot']]))
    .filter(([v]) => v >= minTo - 1e-9 && v < stack).map(([to, label, def]) => ({ to: gR(to), label, def }));
  betBar($('g-acts'), { toCall: Math.min(tc, H.stack), canCheck: tc <= 0, steps: steps.filter(v => v >= minTo - 1e-9), presets, allin: stack, raiseWord: g.curBet === 0 ? 'Bet' : 'Raise to', onAct: (k, to) => gHero(k, to) });
}
/* your decision: log it, then play on */
function gHero(kind, to) {
  const H = g.players[g.cfg.heroIdx], act = kind === 'allin' ? 'allin' : kind === 'raise' ? 'raise' : kind;
  gRecord(H, act, kind === 'allin' ? H.stack + H.bet : to);
  gAct(H, act, to); gShow(); gAdvance();
}
function gHandOver() {
  clearTimeout(gs.tm); gShow(); const H = g.players[g.cfg.heroIdx];
  const counted = g.mode === 'full' && !g.stopped, net = g.result ? g.result[H.i] : 0;
  gSaveHand(H, counted ? net : null);
  if (counted) gs.net = gR(gs.net + net);
  const msg = g.stopped ? `Preflop over: ${H.folded ? 'you folded' : `you're in a ${gIn().length}-way pot`}.`
    : H.folded ? (net < 0 ? `You folded and lost <b class="bad">${fmtBB(-net)} BB</b>.` : 'You folded.') : `${net > 0 ? `You won <b class="good">${fmtBB(net)} BB</b>` : net < 0 ? `You lost <b class="bad">${fmtBB(-net)} BB</b>` : 'You broke even'}${g.showdown ? ' at showdown' : ''}.`;
  $('g-acts').innerHTML = `<div class="g-over"><p>${msg}${hp.gcfg.only === 'full' ? ` <span class="small muted">Session: ${gs.hands} hands, ${gs.net >= 0 ? '+' : ''}${fmtBB(gs.net)} BB</span>` : ''}</p><button class="act" type="button" id="g-next">Next hand</button></div>`;
  $('g-next').onclick = gDeal; $('g-next').focus({ preventScroll: true });
}
$('g-res').onclick = () => { hpTab('res'); scrollTo(0, 0); };
$('g-change').onclick = () => { if (gs) clearTimeout(gs.tm); gs = null; $('g-game').hidden = true; $('g-setup').hidden = false; gSetupRender(); };

/* ---------- logging ---------- */
/* the preflop situation: unopened, limped, facing a raise (with or without callers), facing a 3-bet, 4-bet+ */
function gSit(H) {
  if (g.street > 0) return null;
  if (g.raises === 0) return g.players.some(q => q.bet >= 1 && q.i < g.n - 2 && !q.folded) ? 'limp' : 'unop';
  if (g.raises === 1) return g.players.some(q => !q.folded && q !== H && q.i !== g.pfAgg && q.bet === g.curBet) ? 'vs1c' : 'vs1';
  return g.raises === 2 ? 'vs3' : 'vs4';
}
function gRecord(H, act, to) {
  const tc = gToCall(H), pot = gPot(), sit = gSit(H), np = gIn().length, l = handLabel(H.hole);
  const d = { h: g.id, m: g.mode, n: g.n, st: g.street, pos: H.pos, np, tc: gR(tc), pot, l, act, to: to ? gR(to) : null, frac: g.street && to ? gR((to - g.curBet) / Math.max(1, pot)) : null,
    sit, tier: g.street ? fhTier(H.hole, g.board) : null, pfr: g.pfAgg === H.i, vsCb: g.street === 1 && tc > 0 && g.raises === 1 && g.lastAgg === g.pfAgg && g.pfAgg !== H.i, cbOpp: g.street === 1 && tc <= 0 && g.pfAgg === H.i && g.raises === 0, game: g.cfg.game };
  g.dec.push(d);
  const G = hp.g = hp.g || { d: [], h: [], hh: [] }; G.d.push(d); if (G.d.length > 2500) G.d.splice(0, G.d.length - 2500);
  /* feed the chart grids: first in, facing one raise with no callers, or facing a 3-bet after opening */
  if (g.street === 0) { const sp = gChartSpot(H, sit); if (sp) { const code = gCode(sp.kind, act, to, sp); const r = hp.s[sp.id] = hp.s[sp.id] || {}, x = r[l] = r[l] || {}; x[code] = (x[code] || 0) + 1; hp.n++; } }
  hpSave();
}
function gChartSpot(H, sit) {
  const game = g.cfg.game, me = H.pos, ok6 = p => g.n === 6 || ['HJ', 'CO', 'BTN', 'SB', 'BB'].includes(p), m6 = gSeat6(me, g.n).toLowerCase();
  if (!ok6(me)) return null;
  if (sit === 'unop') { const oc = gOpenChart(me, g.n, game, gEffStack(H)); return oc.id && ok6(me) ? { id: oc.id, kind: oc.shove ? 'short' : 'open' } : null; }
  const r = g.players[g.pfAgg]; if (!r || !ok6(r.pos)) return null; const o6 = gSeat6(r.pos, g.n).toLowerCase();
  if (sit === 'vs1') { const id = game === 'cash' ? `cash-${m6}-vs-${o6}-open` : r.allin ? null : `tour-${m6}-vs-${o6}-open-40-bb`; const c = id && gChart(id); return c ? { id, kind: 'facing', cur: g.curBet } : null; }
  if (sit === 'vs3' && game === 'cash') { const id = `cash-${m6}-open-vs-${o6}-3-bet`, c = gChart(id); return c ? { id, kind: 'vs3b', cur: g.curBet } : null; }
  return null;
}
function gCode(kind, act, to, sp) { if (act === 'fold') return 'fold'; if (act === 'call' || act === 'check') return kind === 'open' ? 'limp' : 'call'; if (act === 'allin') return 'allin'; return hpSizeCode(kind, to, sp.cur || 1, 1e9); }
function gSaveHand(H, net) {
  const G = hp.g = hp.g || { d: [], h: [], hh: [] }, pre = g.dec.filter(d => d.st === 0), sawFlop = !H.folded && g.board.length >= 3 && g.street >= 1 || g.dec.some(d => d.st >= 1);
  const vpip = g.mode !== 'pre' && g.mode !== 'full' ? null : pre.some(d => d.act === 'call' || d.act === 'raise' || d.act === 'allin');
  G.h.push({ id: g.id, m: g.mode, n: g.n, pos: H.pos, net, vpip, pfr: g.mode === 'pre' || g.mode === 'full' ? pre.some(d => d.act === 'raise' || d.act === 'allin') : null, flop: sawFlop && !g.stopped, sd: !!g.showdown && !H.folded, won: g.result ? g.result[H.i] > 0 : false, np: gIn().length, game: g.cfg.game });
  if (G.h.length > 3000) G.h.splice(0, G.h.length - 3000);
  G.hh.unshift({ id: g.id, t: `${g.n}-handed · you ${H.pos} · ${names(H.hole)}${net != null ? ` · ${net >= 0 ? '+' : ''}${fmtBB(net)} BB` : ''}`, log: g.log.map(x => (x.who === H.i ? '► ' : '') + x.text) });
  G.hh = G.hh.slice(0, 30); hpSave();
}

/* ---------- analysis ---------- */
function gStats() {
  const G = hp.g || { d: [], h: [] }, H = G.h, D = G.d, P = (a, b) => b ? a / b : null;
  const pf = H.filter(h => h.vpip != null), full = H.filter(h => h.m === 'full' && h.net != null);
  const pre = D.filter(d => d.st === 0), post = D.filter(d => d.st > 0), agg = x => x.act === 'raise' || x.act === 'allin';
  const op3 = pre.filter(d => d.sit === 'vs1' || d.sit === 'vs1c'), unop = pre.filter(d => d.sit === 'unop'), f3 = pre.filter(d => d.sit === 'vs3');
  const cb = post.filter(d => d.cbOpp), vcb = post.filter(d => d.vsCb), flop = H.filter(h => h.flop);
  const byPos = {}; for (const h of pf) { const x = byPos[h.pos] = byPos[h.pos] || { n: 0, v: 0, r: 0 }; x.n++; if (h.vpip) x.v++; if (h.pfr) x.r++; }
  return { hands: H.length, pfN: pf.length, vpip: P(pf.filter(h => h.vpip).length, pf.length), pfr: P(pf.filter(h => h.pfr).length, pf.length),
    limp: P(unop.filter(d => d.act === 'call').length, unop.length), three: P(op3.filter(agg).length, op3.length), op3: op3.length, ft3: P(f3.filter(d => d.act === 'fold').length, f3.length), f3n: f3.length,
    cbet: P(cb.filter(agg).length, cb.length), cbN: cb.length, fcb: P(vcb.filter(d => d.act === 'fold').length, vcb.length), vcbN: vcb.length,
    af: P(post.filter(agg).length, post.filter(d => d.act === 'call').length), wtsd: P(flop.filter(h => h.sd).length, flop.length), wsd: P(H.filter(h => h.sd && h.won).length, H.filter(h => h.sd).length),
    bb100: full.length ? full.reduce((a, h) => a + h.net, 0) / full.length * 100 : null, fullN: full.length, byPos, post, n9: pf.filter(h => h.n === 9).length > pf.length / 2 };
}
function gStyle(s) {
  if (s.pfN < 40 || s.vpip == null) return null;
  const v = s.vpip * 100, r = s.pfr * 100, ratio = v ? r / v : 0, nine = s.n9, lo = nine ? 13 : 16, hi = nine ? 22 : 27;
  if (v < lo) return ['Nit', '🪨', `You play ${Math.round(v)}% of hands. Tight is fine, but under about ${lo}% you pass up profitable spots, and observant players stop paying you off.`];
  if (v > 38 && ratio < .35) return ['Calling station', '📞', `You play ${Math.round(v)}% of hands and raise only ${Math.round(r)}%. Calling a lot is the most expensive habit in poker.`];
  if (v > hi) return ratio >= .6 ? ['Loose-aggressive (LAG)', '🔥', `You play ${Math.round(v)}% and raise ${Math.round(r)}%. Profitable with strong post-flop skills; costly otherwise.`] : ['Loose-passive (recreational)', '🐟', `You play ${Math.round(v)}% but raise only ${Math.round(r)}%. Tighten up and raise instead of calling.`];
  return ratio >= .65 ? ['Tight-aggressive (TAG)', '🎯', `You play ${Math.round(v)}% and raise ${Math.round(r)}%: the winning baseline (about ${lo}–${hi}% of hands at this table size).`] : ['Solid but passive', '🛡', `About the right number of hands (${Math.round(v)}%), but you raise only ${Math.round(r)}%. Raise more of what you play.`];
}
function gResultsHTML() {
  const s = gStats(); if (!s.hands) return '<p class="small muted">Sit down at a table on the Play tab. Every decision you make there shows up here.</p>';
  const pc = x => x == null ? '–' : pct(x, 0), st = gStyle(s), ref = s.n9 ? { v: '13–22%', r: '10–18%' } : { v: '16–27%', r: '13–22%' };
  const row = (name, v, ref, n) => `<tr><td class="t">${name}</td><td><b>${pc(v)}</b>${n != null ? ` <span class="small muted">(${n})</span>` : ''}</td><td class="small muted">${ref}</td></tr>`;
  const tierRows = (sel) => Object.entries(HP_TIER).map(([t, name]) => { const xs = s.post.filter(d => d.tier === t && sel(d)), fi = xs.filter(d => d.tc <= 0), fa = xs.filter(d => d.tc > 0), A = d => d.act === 'raise' || d.act === 'allin';
    if (!xs.length) return ''; return `<tr><td class="t">${name}</td><td>${fi.length ? `<b>${pc(fi.filter(A).length / fi.length)}</b> <span class="small muted">(${fi.length})</span>` : '–'}</td><td>${fa.length ? `<b>${pc(fa.filter(d => d.act === 'fold').length / fa.length)}</b>` : '–'}</td><td>${fa.length ? `<b>${pc(fa.filter(A).length / fa.length)}</b> <span class="small muted">(${fa.length})</span>` : '–'}</td></tr>`; }).join('');
  const posOrder = G_POS[9].concat(['UTG']), bp = Object.entries(s.byPos).sort((a, b) => G_POS[9].indexOf(a[0]) - G_POS[9].indexOf(b[0]));
  return `${st ? `<section class="hp-style"><div class="hp-ico" aria-hidden="true">${st[1]}</div><div><span class="eyebrow">Your style at the table</span><h3>${st[0]}</h3><p class="small">${st[2]}</p></div></section>` : `<p class="small muted">Play at least 40 hands with preflop decisions (Preflop or Full hand) to see your style.</p>`}
    <p class="small">${s.hands} hands logged${s.fullN ? ` · full hands won <b>${s.bb100 >= 0 ? '+' : ''}${fmtBB(Math.round(s.bb100))} BB per 100 hands</b> over ${s.fullN} (results swing a lot over small samples)` : ''}.</p>
    <h3 class="lb-h3">Your numbers</h3>
    <table class="ref"><thead><tr><th>Stat</th><th>You</th><th>Typical winning range</th></tr></thead><tbody>
    ${row('VPIP: hands you voluntarily play', s.vpip, ref.v, s.pfN)}${row('PFR: hands you raise preflop', s.pfr, ref.r)}${row('Limp when first in', s.limp, '0–5%')}
    ${row('3-bet when facing a raise', s.three, '6–12%', s.op3)}${row('Fold to a 3-bet', s.ft3, '40–60%', s.f3n)}
    ${row('C-bet on the flop as the raiser', s.cbet, '50–70%', s.cbN)}${row('Fold to a flop c-bet', s.fcb, '35–55%', s.vcbN)}
    <tr><td class="t">Aggression: (bets + raises) ÷ calls after the flop</td><td><b>${s.af == null ? '–' : s.af.toFixed(1)}</b></td><td class="small muted">2–4</td></tr>
    ${row('Went to showdown, of flops seen', s.wtsd, '25–33%')}${row('Won at showdown', s.wsd, '50–55%')}
    </tbody></table>
    <p class="small muted">"Typical winning range" is a rough guide from common tracking-software benchmarks for ${s.n9 ? 'full-ring (9-handed)' : '6-handed'} games, not a rule.</p>
    ${bp.length ? `<h3 class="lb-h3">By position</h3><table class="ref"><thead><tr><th>Seat</th><th>Hands</th><th>VPIP</th><th>PFR</th></tr></thead><tbody>${bp.map(([p, x]) => `<tr><td class="t">${p}</td><td>${x.n}</td><td>${pc(x.v / x.n)}</td><td>${pc(x.r / x.n)}</td></tr>`).join('')}</tbody></table><p class="small muted">Expect VPIP to rise from early seats to the button; the blinds defend wider but raise less.</p>` : ''}
    ${s.post.length ? `<h3 class="lb-h3">After the flop, by hand strength</h3>
    ${['Heads-up', 'Multiway'].map((t, k) => { const rows = tierRows(d => k ? d.np > 2 : d.np <= 2); return rows ? `<p class="small"><b>${t} pots</b></p><div style="overflow-x:auto"><table class="ref"><thead><tr><th>Your hand</th><th>Checked to you: bet</th><th>Facing a bet: fold</th><th>Facing a bet: raise</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''; }).join('')}
    <p class="small muted">Good habits to compare against: bet strong hands most of the time, fold weak pairs and air to big bets (especially multiway), and bluff less as more players see the flop.</p>` : ''}
    ${(hp.g.hh || []).length ? `<h3 class="lb-h3">Recent hands</h3>${hp.g.hh.slice(0, 15).map(x => `<details class="g-hh"><summary class="small">${esc(x.t)}</summary><ol class="small">${x.log.map(t => `<li>${t}</li>`).join('')}</ol></details>`).join('')}` : ''}`;
}
