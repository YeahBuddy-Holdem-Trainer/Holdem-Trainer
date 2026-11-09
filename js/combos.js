/* ---------- combinatorics trainer ----------
   Counting hand combinations: a pair has 6, a suited hand 4, an offsuit hand 12. Cards you can see
   (your hand and the board) remove combos. Four question types, from basics to bluff share:
     basics   - combos of one hand with nothing removed
     removal  - combos of one hand after your cards and the board take some away
     range    - total combos in a small range on a board
     bluffs   - what share of a value + bluff range is bluffs */
const CB_TYPES = { basics: 'Basics', removal: 'Card removal', range: 'Range on a board', bluffs: 'Bluff share' };
const CB_RANKNAME = { A: 'Aces', K: 'Kings', Q: 'Queens', J: 'Jacks', T: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' };
let cb = null;

/* labels: "QQ" pair, "AKs" suited, "AKo" offsuit, "AK" any */
const cbCombos = l => l.length === 2 && l[0] !== l[1] ? [...labelCombos(l + 's'), ...labelCombos(l + 'o')] : labelCombos(l);
const cbLive = (l, dead) => cbCombos(l).filter(([a, b]) => !dead.has(a) && !dead.has(b));
const cbRankLive = (r, dead) => { const i = R.indexOf(r); let n = 0; for (let s = 0; s < 4; s++) if (!dead.has(i * 4 + s)) n++; return n; };
const cbName = l => l.length === 2 && l[0] === l[1] ? `${l} (pocket ${CB_RANKNAME[l[0]].toLowerCase()})` : l.length === 2 ? `${l} (suited or offsuit)` : l[2] === 's' ? `${l} (suited)` : `${l} (offsuit)`;
const cbLabel = (hi, lo, kind) => { const a = R[Math.max(hi, lo)], b = R[Math.min(hi, lo)]; return a === b ? a + a : a + b + (kind === 'any' ? '' : kind === 's' ? 's' : 'o'); };

/* the arithmetic, written out */
function cbWhy(l, dead) {
  const n = cbLive(l, dead).length;
  if (l[0] === l[1]) { const k = cbRankLive(l[0], dead);
    return `${k} ${CB_RANKNAME[l[0]].toLowerCase()} left: ${k} × ${Math.max(0, k - 1)} ÷ 2 = <b>${n}</b>`; }
  const a = cbRankLive(l[0], dead), b = cbRankLive(l[1], dead), hi = R.indexOf(l[0]), lo = R.indexOf(l[1]);
  const suits = [0, 1, 2, 3].filter(s => !dead.has(hi * 4 + s) && !dead.has(lo * 4 + s)), sTxt = suits.map(s => SYM[s]).join(' ') || 'none';
  if (l[2] === 's') return `suits where both cards are still live: ${sTxt} = <b>${n}</b>`;
  if (l[2] === 'o') return `${a} ${l[0]} × ${b} ${l[1]} = ${a * b}, minus ${suits.length} suited = <b>${n}</b>`;
  return `${a} ${l[0]} × ${b} ${l[1]} = <b>${n}</b>`;
}

function cbRandLabel(kinds) {
  const k = pick(kinds), hi = 1 + Math.floor(Math.random() * 12);
  if (k === 'pair') return R[hi] + R[hi];
  const lo = Math.floor(Math.random() * hi); return cbLabel(hi, lo, k);
}
function cbDeal(nBoard) { const d = shuffled(); return { hero: d.slice(0, 2), board: d.slice(2, 2 + nBoard) }; }

const CB_GEN = {
  basics() {
    const l = cbRandLabel(['pair', 'pair', 's', 's', 'o', 'o', 'any']);
    return { type: 'basics', q: `How many combos of <b>${cbName(l)}</b> are there, with no cards removed?`, hero: [], board: [],
      answer: cbCombos(l).length, unit: 'combos',
      why: `<p>${cbWhy(l, new Set())}</p><p class="small muted">Remember: pairs 6, suited 4, offsuit 12, any unpaired hand 16.</p>` };
  },
  removal() {
    const { hero, board } = cbDeal(Math.random() < .5 ? 3 : 0), dead = new Set([...hero, ...board]);
    const seen = [...hero, ...board].map(c => c >> 2);
    let l;
    for (let t = 0; t < 30; t++) {   /* mostly hands that share a rank with a card you can see */
      if (Math.random() < .75) { const r1 = pick(seen), r2 = Math.random() < .35 ? r1 : Math.floor(Math.random() * 13);
        l = r1 === r2 ? R[r1] + R[r1] : cbLabel(r1, r2, pick(['s', 'o', 'any'])); }
      else l = cbRandLabel(['pair', 's', 'o', 'any']);
      if (cbLive(l, dead).length !== cbCombos(l).length || t > 25) break;
    }
    return { type: 'removal', q: `${board.length ? 'With your hand and this flop' : 'Holding this hand'}, how many combos of <b>${cbName(l)}</b> can your opponent have?`,
      hero, board, answer: cbLive(l, dead).length, unit: 'combos',
      why: `<p>Without any cards removed there are ${cbCombos(l).length}. Count the cards still unseen:</p><p>${cbWhy(l, dead)}</p>` };
  },
  range() {
    const { hero, board } = cbDeal(3), dead = new Set([...hero, ...board]);
    const br = board.map(c => c >> 2).sort((a, b) => b - a), top = br[0];
    const opts = [R[br[0]] + R[br[0]], R[br[1]] + R[br[1]], R[br[2]] + R[br[2]], 'AA', 'KK', 'QQ',
      cbLabel(12, top === 12 ? 11 : top, 'any'), cbLabel(top, br[1], 'any'), cbLabel(12, 11, 'any'), cbLabel(11, 10, 's')];
    const labels = [...new Set(shuffle(opts))].filter(l => cbCombos(l).length).slice(0, 3 + (Math.random() < .5 ? 1 : 0));
    const rows = labels.map(l => ({ l, n: cbLive(l, dead).length })), tot = rows.reduce((a, x) => a + x.n, 0);
    return { type: 'range', q: `Your opponent's range here is <b>${labels.join(', ')}</b>. With your hand and this flop, how many combos is that in total?`,
      hero, board, answer: tot, unit: 'combos',
      why: `<dl class="math">${rows.map(x => `<dt>${x.l}</dt><dd>${cbWhy(x.l, dead)}</dd>`).join('')}<dt>Total</dt><dd><b>${tot}</b> combos</dd></dl>` };
  },
  bluffs() {
    const { hero, board } = cbDeal(3), dead = new Set([...hero, ...board]);
    const br = board.map(c => c >> 2).sort((a, b) => b - a), onBoard = new Set(br);
    const value = [R[br[0]] + R[br[0]], ...(Math.random() < .6 ? [R[br[1]] + R[br[1]]] : []), cbLabel(br[0] === 12 ? 11 : 12, br[0], 'any')]
      .filter((l, i, a) => a.indexOf(l) === i && cbLive(l, dead).length);
    const bluffPool = [];
    for (let hi = 11; hi >= 3; hi--) for (let lo = hi - 1; lo >= hi - 2 && lo >= 0; lo--) if (!onBoard.has(hi) && !onBoard.has(lo)) bluffPool.push(cbLabel(hi, lo, 's'));
    const bluffs = shuffle(bluffPool).slice(0, 2 + Math.floor(Math.random() * 3)).filter(l => cbLive(l, dead).length);
    const v = value.map(l => ({ l, n: cbLive(l, dead).length })), b = bluffs.map(l => ({ l, n: cbLive(l, dead).length }));
    const nv = v.reduce((a, x) => a + x.n, 0), nb = b.reduce((a, x) => a + x.n, 0), ans = Math.round(nb / (nv + nb) * 100);
    return { type: 'bluffs', q: `On this flop your opponent bets with value hands <b>${value.join(', ')}</b> and bluffs <b>${bluffs.join(', ')}</b>. What percent of their betting range is bluffs?`,
      hero, board, answer: ans, unit: '%', tol: 3,
      why: `<dl class="math">${v.map(x => `<dt>Value ${x.l}</dt><dd>${cbWhy(x.l, dead)}</dd>`).join('')}${b.map(x => `<dt>Bluff ${x.l}</dt><dd>${cbWhy(x.l, dead)}</dd>`).join('')}
        <dt>Share</dt><dd>${nb} bluffs ÷ (${nv} value + ${nb} bluffs) = <b>${pct(nb / (nv + nb), 0)}</b></dd></dl>
        <p class="small muted">For reference: a pot-size bet on the river is balanced with about 33% bluffs (1 bluff for every 2 value hands), a half-pot bet with about 25%. Well above that and calling gets better; well below and folding does.</p>` };
  }
};

function newCB() {
  const sel = $('cb-type').value, type = sel === 'mixed' ? pick(Object.keys(CB_GEN)) : sel;
  cb = { ...CB_GEN[type](), done: false, t0: Date.now() };
  $('cb-kind').textContent = CB_TYPES[cb.type];
  $('cb-q').innerHTML = cb.q;
  $('cb-cards').hidden = !cb.hero.length;
  $('cb-hero').innerHTML = cb.hero.length ? cardsHTML(cb.hero) : '';
  $('cb-board-wrap').hidden = !cb.board.length;
  $('cb-board').innerHTML = cb.board.length ? cardsHTML(cb.board) : '';
  $('cb-ans').value = ''; $('cb-unit').textContent = cb.unit; $('cb-sub').disabled = false;
  $('cb-out').innerHTML = '<p class="small muted">Type your answer and check it.</p>';
}
$('cb-form').onsubmit = e => {
  e.preventDefault(); if (!cb || cb.done) return;
  const raw = $('cb-ans').value.trim(); if (raw === '' || isNaN(+raw)) { $('cb-ans').focus(); return; }
  cb.done = true; $('cb-sub').disabled = true;
  const g = +raw, miss = Math.abs(g - cb.answer), ok = miss <= (cb.tol || 0);
  const st = stats.combos = stats.combos || { n: 0, c: 0, streak: 0, best: 0 };
  st.n++; if (ok) { st.c++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; save(); cbStats();
  logEvent({ drill: 'Combinatorics', spot: CB_TYPES[cb.type], hand: names(cb.hero) + (cb.board.length ? ' | ' + names(cb.board) : ''), answer: g, expected: cb.answer, correct: ok, error: cb.unit === '%' ? miss : '', detail: '', ms: Date.now() - cb.t0 });
  $('cb-out').innerHTML = `<div class="verdict ${ok ? 'good' : 'bad'}"><strong>${ok ? (miss ? 'Close enough' : 'Correct') : 'Not quite'}</strong><span>You said <b>${g}${cb.unit === '%' ? '%' : ''}</b>; the answer is <b>${cb.answer}${cb.unit === '%' ? '%' : ' combos'}</b>.</span></div>${cb.why}`;
  $('cb-next').focus();
};
$('cb-next').onclick = newCB;
$('cb-type').onchange = newCB;
function cbStats() { const s = stats.combos || { n: 0, c: 0, streak: 0, best: 0 };
  $('cb-n').textContent = s.n; $('cb-acc').textContent = s.n ? pct(s.c / s.n, 0) : '–'; $('cb-streak').textContent = s.streak; $('cb-best').textContent = s.best; }
function cbInit() { cbStats(); newCB(); }

/* a multiple-choice version for the daily challenge and assessment */
QGEN['Combinatorics'] = function () {
  const type = pick(['basics', 'removal', 'removal', 'range', 'bluffs']), q = CB_GEN[type](), a = q.answer;
  const cands = q.unit === '%' ? [a - 15, a - 10, a + 10, a + 15, a - 20, a + 20].filter(x => x > 0 && x < 100) : [a - 1, a + 1, a - 2, a + 2, a - 3, a + 3, a + 6, a - 6].filter(x => x >= 0);
  const opts = [a]; for (const c of shuffle(cands)) if (opts.length < 4 && !opts.includes(c)) opts.push(c);
  const o = shuffle(opts);
  return { drill: 'Combinatorics', spot: CB_TYPES[type], hand: names(q.hero) + (q.board.length ? ' | ' + names(q.board) : ''),
    prompt: `${q.hero.length ? `<div class="hand-row"><div><span class="lbl">You</span><div class="cards">${cardsHTML(q.hero)}</div></div>${q.board.length ? `<div><span class="lbl">Board</span><div class="cards">${cardsHTML(q.board)}</div></div>` : ''}</div>` : ''}<p>${q.q}</p>`,
    opts: o.map(x => x + (q.unit === '%' ? '%' : '')), correct: o.indexOf(a), short: CB_TYPES[type], explain: q.why };
};
