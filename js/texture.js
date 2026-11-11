/* ---------- board texture and c-bet plan ----------
   A preflop raiser and a caller see a flop. Three questions, all about ranges rather than one hand:
     1. Range advantage: whose whole range has more equity on this flop?
     2. Nut advantage: who has more of the strongest hands (two pair or better)?
     3. C-bet plan for the raiser: bet small often, bet big, or check often.
   Equity is simulated from the chart ranges; strong-hand shares use the Range vs board classifier.
   The c-bet answer is a rule of thumb built from those two advantages and how wet the board is. */
const TX_SPOTS = {
  cash: [
    { pfr: ['cash-btn-open', 'Raise'], call: ['cash-bb-vs-btn-open', 'Call'], name: 'Button opens, big blind calls', pot: 5.5 },
    { pfr: ['cash-co-open', 'Raise'], call: ['cash-bb-vs-co-open', 'Call'], name: 'Cutoff opens, big blind calls', pot: 5.5 },
    { pfr: ['cash-utg-open', 'Raise'], call: ['cash-bb-vs-utg-open', 'Call'], name: 'UTG opens, big blind calls', pot: 5.5 },
    { pfr: ['cash-co-open', 'Raise'], call: ['cash-btn-vs-co-open', 'Call'], name: 'Cutoff opens, button calls', pot: 6 },
    { pfr: ['cash-sb-open', 'Raise'], call: ['cash-bb-vs-sb-open', 'Call'], name: 'Small blind opens, big blind calls', pot: 6 },
    { pfr: ['cash-bb-vs-btn-open', '3-bet'], call: ['cash-btn-open-vs-bb-3-bet', 'Call'], name: 'Big blind 3-bets, button calls', pot: 22, three: true }
  ],
  tour: [
    { pfr: ['tour-btn-open-40-bb', 'Raise'], call: ['tour-bb-vs-btn-open-40-bb', 'Call'], name: 'Button opens, big blind calls (40 BB)', pot: 5.9 },
    { pfr: ['tour-co-open-40-bb', 'Raise'], call: ['tour-bb-vs-co-open-40-bb', 'Call'], name: 'Cutoff opens, big blind calls (40 BB)', pot: 5.9 },
    { pfr: ['tour-utg-open-40-bb', 'Raise'], call: ['tour-bb-vs-utg-open-40-bb', 'Call'], name: 'UTG opens, big blind calls (40 BB)', pot: 5.9 },
    { pfr: ['tour-co-open-40-bb', 'Raise'], call: ['tour-btn-vs-co-open-40-bb', 'Call'], name: 'Cutoff opens, button calls (40 BB)', pot: 6.4 }
  ]
};
const TX_Q = {
  range: { label: 'Range advantage', q: 'Whose whole range has more equity on this flop?', opts: [['pfr', 'Raiser'], ['even', 'About even'], ['call', 'Caller']] },
  nuts: { label: 'Nut advantage', q: 'Who has more of the strongest hands (two pair or better)?', opts: [['pfr', 'Raiser'], ['even', 'About even'], ['call', 'Caller']] },
  plan: { label: 'C-bet plan', q: "What's the raiser's best default plan?", opts: [['small', 'Bet small (25-33%) often'], ['big', 'Bet big (66-75%) less often'], ['check', 'Check often']] }
};
let tx = null;
const txSpot = id => SPOTS.find(s => s.id === id);
function txTexture(board) {
  const ranks = board.map(c => c >> 2).sort((a, b) => b - a), suits = new Set(board.map(c => c & 3)).size;
  const paired = new Set(ranks).size < 3, gap = ranks[0] - ranks[2];
  const conn = !paired && (gap <= 4 || (ranks[0] === 12 && ranks[1] <= 3));
  const wet = suits === 1 || (suits === 2 && conn) || (conn && gap <= 4 && ranks[2] >= 3);
  return { ranks, suits, paired, conn, wet, high: ranks[0], word: texture(board) };
}

function newTX() {
  const list = TX_SPOTS[mode === 'cash' ? 'cash' : 'tour'].filter(x => txSpot(x.pfr[0]) && txSpot(x.call[0])), sc = pick(list);
  const board = shuffled().slice(0, 3), dead = new Set(board), ok = c => !dead.has(c[0]) && !dead.has(c[1]);
  const lp = eqSpotLabels(sc.pfr[0], sc.pfr[1]), lc = eqSpotLabels(sc.call[0], sc.call[1]);
  const P = txSpot(sc.pfr[0]).hero, C = txSpot(sc.call[0]).hero;
  tx = { sc, board, lp, lc, P, C, A: lp.flatMap(labelCombos).filter(ok), B: lc.flatMap(labelCombos).filter(ok), ans: {}, done: false, t0: Date.now() };
  /* table: the raiser at the bottom, the caller in their seat */
  const seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' });
  seats[P] = { state: 'hero', tag: 'Raiser', stack: '', bet: '' }; seats[C] = { state: 'vil', tag: 'Caller', stack: '', bet: '' };
  renderTable($('tx-table'), { hero: P, seats, center: `<div class="cards">${cardsHTML(board, 'xs')}</div><b>${fmtBB(sc.pot)} BB</b><span>${sc.three ? '3-bet pot' : 'Flop pot'}</span>` });
  $('tx-spot').textContent = sc.name + '. The flop comes:';
  $('tx-qs').innerHTML = Object.entries(TX_Q).map(([k, q]) => `<fieldset class="tx-q" data-k="${k}"><legend><b>${q.label}.</b> ${q.q}</legend>
    <div class="opts${q.opts.some(([, t]) => t.length > 14) ? ' stack' : ''}" role="group">${q.opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div></fieldset>`).join('');
  $('tx-sub').disabled = true;
  $('tx-out').innerHTML = '<p class="small muted">Answer all three, then check.</p>';
}
$('tx-qs').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !tx || tx.done) return;
  const fs = b.closest('.tx-q'); tx.ans[fs.dataset.k] = b.dataset.v;
  fs.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('tx-sub').disabled = Object.keys(tx.ans).length < 3;
});
$('tx-next').onclick = newTX;
$('tx-sub').onclick = () => {
  if (!tx || tx.done || Object.keys(tx.ans).length < 3) return; tx.done = true; $('tx-sub').disabled = true;
  $('tx-out').innerHTML = '<p class="small muted">Working it out…</p>';
  setTimeout(() => {
    const eq = rvrSim(tx.A, tx.B, tx.board, 16000).eq, aP = rvbAnalyze(tx.lp, tx.board), aC = rvbAnalyze(tx.lc, tx.board);
    const sP = aP.strong / aP.n, sC = aC.strong / aC.n, tP = aP.tpplus / aP.n, tC = aC.tpplus / aC.n, T = txTexture(tx.board);
    const ip = LG_POST.indexOf(tx.P) > LG_POST.indexOf(tx.C);
    const range = eq >= .53 ? 'pfr' : eq < .47 ? 'call' : 'even';
    const nuts = sP - sC >= .03 && sP >= sC * 1.4 ? 'pfr' : sC - sP >= .03 && sC >= sP * 1.4 ? 'call' : 'even';
    const plan = range === 'call' ? 'check'
      : nuts === 'call' && range !== 'pfr' ? 'check'
      : nuts === 'pfr' && T.wet ? 'big'
      : range === 'pfr' ? (nuts === 'call' && T.wet ? 'check' : 'small')
      : !T.wet && ip ? 'small' : 'check';
    const right = { range, nuts, plan }, parts = Object.keys(right).map(k => ({ k, ok: tx.ans[k] === right[k] })), nOk = parts.filter(p => p.ok).length;
    const st = stats.texture = stats.texture || { n: 0, parts: 0, all: 0 }; st.n++; st.parts += nOk; if (nOk === 3) st.all++; save(); txStats();
    for (const p of parts) logEvent({ drill: 'Board texture', spot: TX_Q[p.k].label, hand: names(tx.board), answer: tx.ans[p.k], expected: right[p.k], correct: p.ok, error: '', detail: tx.sc.name, ms: Date.now() - tx.t0 });
    const word = (k, v) => (TX_Q[k].opts.find(o => o[0] === v) || [, v])[1];
    const why = {
      range: `The raiser's range has <b>${pct(eq)}</b> equity against the caller's${range === 'pfr' ? ', a clear edge' : range === 'call' ? ': the caller is ahead' : ', close to even'}. ${T.high >= 10 && range === 'pfr' ? 'High cards favor the raiser, whose range has more big cards.' : T.high <= 7 ? 'Low boards hit the caller\'s wider range of small pairs and connectors.' : ''}`,
      nuts: `Two pair or better: raiser <b>${pct(sP)}</b>, caller <b>${pct(sC)}</b>. Top pair or better: raiser ${pct(tP)}, caller ${pct(tC)}.`,
      plan: plan === 'small' ? (range === 'pfr' ? 'With the range edge and no big nut gap against you, a small bet with most of the range wins the pot often and is hard for the caller to fight.' : 'Ranges are close, but on a dry board and in position a small bet still works: the caller has few strong hands or good draws to fight back with.')
        : plan === 'big' ? 'With both the range edge and more of the strongest hands on a board where draws are coming, betting bigger with a polarized range charges the draws and builds the pot for the nuts.'
        : 'When the caller has the range or nut advantage, or nobody has an edge, betting the whole range loses money. Check a lot, and bet only strong hands and good draws.'
    };
    $('tx-out').innerHTML = `<div class="verdict ${nOk === 3 ? 'good' : 'bad'}"><strong>${nOk} of 3 right</strong><span>${T.word[0].toUpperCase() + T.word.slice(1)} flop: ${names(tx.board)}. The raiser is ${ip ? 'in position' : 'out of position'}.</span></div>
      ${parts.map(p => `<div class="tx-r ${p.ok ? 'good' : 'bad'}"><p><b>${p.ok ? '✓' : '✗'} ${TX_Q[p.k].label}: ${word(p.k, right[p.k])}</b>${p.ok ? '' : ` <span class="muted">(you said ${word(p.k, tx.ans[p.k])})</span>`}</p><p class="small">${why[p.k]}</p></div>`).join('')}
      ${mathBox(`<ul class="small math-steps"><li><b>Range advantage</b> is a simulation of the raiser's whole range against the caller's whole range on this flop (both run out to the river): <b>${pct(eq)}</b> for the raiser. At the table, compare how much of each range has top pair or better: raiser ${aP.tpplus} of ${aP.n} combos (${pct(tP, 0)}), caller ${aC.tpplus} of ${aC.n} (${pct(tC, 0)}).</li>
        <li><b>Nut advantage</b> counts combos: two pair or better is ${aP.strong} of the raiser's ${aP.n} combos (${pct(sP)}) and ${aC.strong} of the caller's ${aC.n} (${pct(sC)}). Here it counts as an edge when one side has at least 3 points more <i>and</i> 1.4 times as many.</li>
        <li><b>C-bet plan</b> follows from those two answers and the board: ${T.wet ? 'this board is wet (flush or straight draws possible)' : 'this board is dry (few draws)'}, and the raiser is ${ip ? 'in position' : 'out of position'}.</li></ul>`)}
      <p class="small muted">Range and nut numbers come from the ${mode === 'cash' ? 'cash' : 'tournament'} charts. The c-bet plan is a rule of thumb from those two advantages and whether the board is ${T.wet ? 'wet (draws around)' : 'dry'}; real solver strategies mix sizes.</p>`;
    $('tx-next').focus();
  }, 20);
};
function txStats() { const s = stats.texture || { n: 0, parts: 0, all: 0 };
  $('tx-n').textContent = s.n; $('tx-acc').textContent = s.n ? pct(s.parts / (s.n * 3), 0) : '–'; $('tx-all').textContent = s.n ? pct(s.all / s.n, 0) : '–'; }
function txInit() { txStats(); newTX(); }
