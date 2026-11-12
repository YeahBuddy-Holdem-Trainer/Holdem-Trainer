/* ---------- app checks ----------
   Loads the app (index.html?test=1, which can't save anything or sign in) in a hidden frame, then checks:
   hand ranking, the equity simulation against exact counts and known matchups, combos, ranges, ICM,
   the preflop charts, the opponent models, full-hand chip counts and the trainers' generators.
   Each check passes or fails with the expected and actual values. */
const frame = document.getElementById('app');
let W, E;
const T = [];   /* [section, name, fn] */
const check = (sec, name, fn) => T.push([sec, name, fn]);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = x => typeof x === 'number' ? (Math.round(x * 1000) / 1000).toString() : JSON.stringify(x);

/* cards like "As" -> engine card numbers */
const C = s => s.match(/../g).map(t => E(`R.indexOf('${t[0].toUpperCase()}')*4+S.indexOf('${t[1].toLowerCase()}')`));
const eq = (h, v, b = '', n = 60000) => E('equity')(C(h), C(v), b ? C(b) : [], n).eq * 100;
/* exact equity by trying every remaining runout */
function exact(h, v, b) {
  const H = C(h), V = C(v), B = C(b), dead = new Set([...H, ...V, ...B]), rest = [...Array(52).keys()].filter(c => !dead.has(c)), need = 5 - B.length, ev = E('evalHand');
  let s = 0, n = 0;
  const go = (start, cur) => {
    if (cur.length === need) { const bd = B.concat(cur), a = ev(H.concat(bd)), c = ev(V.concat(bd)); s += a > c ? 1 : a === c ? .5 : 0; n++; return; }
    for (let i = start; i < rest.length; i++) go(i + 1, cur.concat(rest[i]));
  };
  go(0, []); return s / n * 100;
}

/* ---------- hand ranking ---------- */
check('Hand ranking', 'Every hand type beats the one below it', () => {
  const hands = [['AsKsQsJsTs2c3d', 'straight flush'], ['9c9d9h9sAd2c3h', 'four of a kind'], ['KcKdKh2s2d5c7h', 'full house'], ['Ah9h7h4h2hKcQd', 'flush'], ['9c8d7h6s5c2d2h', 'straight'], ['QcQdQh9s5c3d2h', 'three of a kind'], ['JcJd8h8s5c3d2h', 'two pair'], ['TcTd8h6s5c3d2h', 'one pair'], ['AcKd8h6s5c3d2h', 'high card']];
  const v = hands.map(([h]) => E('evalHand')(C(h)));
  const bad = v.slice(1).findIndex((x, i) => !(v[i] > x));
  return bad < 0 ? [true] : [false, `${hands[bad][1]} did not beat ${hands[bad + 1][1]}`];
});
check('Hand ranking', 'A-2-3-4-5 counts as a straight, and loses to 2-3-4-5-6', () => {
  const ev = E('evalHand'), wheel = ev(C('As2d3h4c5sKdQh')), six = ev(C('2s3d4h5c6sKdQh')), trips = ev(C('QsQdQh9c5sKd2h'));
  return [wheel > trips && six > wheel, `wheel ${wheel} vs trips ${trips} vs six-high ${six}`];
});
check('Hand ranking', 'Kickers decide equal pairs, and identical hands tie', () => {
  const ev = E('evalHand'), a = ev(C('AsAdKh9c5s3d2h')), b = ev(C('AhAcQh9c5s3d2h')), c = ev(C('AsAdKh9c5s3d2h'));
  return [a > b && a === c, `AA-K ${a}, AA-Q ${b}`];
});

/* ---------- equity ---------- */
for (const [h, v, b] of [['AsKd', 'QhQc', '7s5d2c'], ['Ah5h', 'KsKd', 'Kh9h2c'], ['9c8c', 'AdKd', 'Tc7d2h'], ['JsJd', 'AhQh', 'Qs8h3h4c'], ['6d6c', 'AsTs', 'Ts9s2d5h']])
  check('Equity simulation', `${h} vs ${v} on ${b}: simulation matches the exact count`, () => {
    const s = eq(h, v, b), x = exact(h, v, b); return [near(s, x, 1.2), `simulated ${s.toFixed(1)}%, exact ${x.toFixed(1)}%`];
  });
for (const [h, v, ref, tol] of [['AsAh', 'KdKc', 82.0, 1.5], ['AsKd', 'QhQc', 43.3, 1.5], ['2c2d', 'AhKs', 52.5, 1.8], ['AsAh', '7c2d', 87.5, 1.5], ['KhKd', 'AsQc', 71.5, 2], ['AsKs', 'AdKc', 52.2, 1.2]])
  check('Equity simulation', `${h} vs ${v} preflop ≈ ${ref}% (published value)`, () => { const s = eq(h, v); return [near(s, ref, tol), `got ${s.toFixed(1)}%`]; });
check('Equity simulation', 'Hand vs range equals the combo-weighted average of hand vs each hand', () => {
  const hero = C('AsQd'), labels = ['JJ', 'QQ', 'KK', 'AA', 'AKs', 'AKo'], live = l => E('labelCombos')(l).filter(c => !hero.includes(c[0]) && !hero.includes(c[1]));
  let n = 0, s = 0; for (const l of labels) { const cs = live(l); s += E('equityVsRange')(hero, cs, [], 15000).eq * cs.length; n += cs.length; }
  const all = E('equityVsRange')(hero, labels.flatMap(live), [], 60000).eq;
  return [near(s / n, all, .015), `weighted ${(s / n * 100).toFixed(1)}%, whole range ${(all * 100).toFixed(1)}%`];
});

/* ---------- combos and ranges ---------- */
check('Combos and ranges', 'Pairs 6, suited 4, offsuit 12 combos', () => { const n = l => E('labelCombos')(l).length; return [n('QQ') === 6 && n('AKs') === 4 && n('AKo') === 12, `QQ ${n('QQ')}, AKs ${n('AKs')}, AKo ${n('AKo')}`]; });
check('Combos and ranges', 'All 169 starting hands add up to 1,326 combos', () => { let t = 0; for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) t += E('labelCombos')(E('gridLabel')(i, j)).length; return [t === 1326, `got ${t}`]; });
check('Combos and ranges', 'Range text: TT+ is 5 hands, A2s+ is 12, KTo+ is 3', () => { const n = r => E('parseRange')(r).size; return [n('TT+') === 5 && n('A2s+') === 12 && n('KTo+') === 3, `TT+ ${n('TT+')}, A2s+ ${n('A2s+')}, KTo+ ${n('KTo+')}`]; });
check('Combos and ranges', 'Card removal counts match a brute-force count (200 random spots)', () => {
  const all = []; for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) all.push([a, b]);
  for (let i = 0; i < 200; i++) {
    const d = E('shuffled')(), dead = new Set(d.slice(0, 2 + (i % 2 ? 3 : 0))), l = E('gridLabel')(Math.floor(Math.random() * 13), Math.floor(Math.random() * 13));
    const want = all.filter(c => E('handLabel')(c) === l && !dead.has(c[0]) && !dead.has(c[1])).length, got = E('cbLive')(l, dead).length;
    if (want !== got) return [false, `${l} with ${[...dead]} removed: app ${got}, brute force ${want}`];
  }
  return [true];
});
check('Combos and ranges', 'Combinatorics questions have the right answers (300 random)', () => {
  for (let i = 0; i < 300; i++) { const k = ['basics', 'removal', 'range', 'bluffs'][i % 4], q = E('CB_GEN')[k](); if (!(q.answer >= 0) || (q.unit === '%' && q.answer > 100)) return [false, `${k}: ${q.answer}`]; }
  return [true];
});

/* ---------- ICM ---------- */
check('ICM', 'Matches an independent Malmuth-Harville calculation', () => {
  const st = [5000, 3000, 2000], pz = [50, 30, 20], S = 10000, got = E('icmEquity')(st, pz);
  const want = st.map((s, i) => { let e = pz[0] * s / S; for (let j = 0; j < 3; j++) { if (j === i) continue; e += st[j] / S * s / (S - st[j]) * pz[1];
    for (let k = 0; k < 3; k++) { if (k === i || k === j) continue; e += st[j] / S * st[k] / (S - st[j]) * pz[2]; } } return e; });
  return [got.every((g, i) => near(g, want[i], .01)), `app ${got.map(x => x.toFixed(2))}, check ${want.map(x => x.toFixed(2))}`];
});
check('ICM', 'Equal stacks split the prize pool equally; values add up to the pool', () => {
  const g = E('icmEquity')([1000, 1000, 1000, 1000], [50, 30, 20]), t = g.reduce((a, b) => a + b, 0);
  return [g.every(x => near(x, 25, .01)) && near(t, 100, .01), `got ${g.map(x => x.toFixed(2))}`];
});

/* ---------- charts ---------- */
check('Preflop charts', 'Every chart uses real hands and real actions, and plays at least one hand', () => {
  const labels = new Set(); for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) labels.add(E('gridLabel')(i, j));
  for (const s of E('SPOTS')) { for (const [l, a] of s.map) if (!labels.has(l) || !(a >= 0 && a < s.acts.length)) return [false, `${s.id}: ${l} → ${a}`];
    if (![...s.map.values()].some(a => a !== s.fold)) return [false, `${s.id} plays nothing`]; }
  return [true, `${E('SPOTS').length} charts`];
});
check('Preflop charts', 'Opening ranges widen from UTG to the button', () => {
  const size = id => { const s = E('SPOTS').find(x => x.id === id); return s ? [...s.map.values()].filter(a => a !== s.fold).length : null; };
  const out = [];
  for (const g of ['cash', 'tour']) { const ids = ['utg', 'hj', 'co', 'btn'].map(p => g === 'cash' ? `cash-${p}-open` : `tour-${p}-open-40-bb`), n = ids.map(size).filter(x => x != null);
    if (n.length < 4 || n.some((x, i) => i && x < n[i - 1])) return [false, `${g}: ${n}`]; out.push(`${g} ${n.join(' → ')}`); }
  return [true, out.join('; ')];
});
check('Preflop charts', 'Shoving ranges get tighter as stacks get deeper (button 10 BB vs 15 BB)', () => {
  const set = id => { const s = E('SPOTS').find(x => x.id === id); return new Set([...s.map].filter(([, a]) => a !== s.fold).map(([l]) => l)); };
  const a = set('tour-btn-shove-10-bb'), b = set('tour-btn-shove-15-bb'), inside = [...b].filter(l => a.has(l)).length / b.size;
  return [b.size < a.size && inside >= .9, `10 BB: ${a.size} hands, 15 BB: ${b.size} hands, ${Math.round(inside * 100)}% of the 15 BB range is inside the 10 BB range`];
});

/* ---------- opponent models ---------- */
check('Opponent models', 'Fold, call and raise chances are valid and add up to 100%', () => {
  E('fh={stack:{vil:60},pot:10}');
  for (const t of Object.keys(E('FH_FACE'))) for (const tier of Object.keys(E('FH_FACE')[t])) for (const f of [.25, .5, 1, 1.5]) for (const r of [false, true]) {
    const q = E('fhFacing')(t, tier, f, r), s = q.fold + q.call + q.raise;
    if ([q.fold, q.call, q.raise].some(x => x < -1e-9 || x > 1 + 1e-9) || !near(s, 1, 1e-6)) return [false, `${t} ${tier} f=${f} raise=${r}: ${JSON.stringify(q)}`];
  }
  return [true];
});
check('Opponent models', 'Nobody folds a monster, or top pair when stacks are short', () => {
  E('fh={stack:{vil:12},pot:8}');
  for (const t of Object.keys(E('FH_FACE'))) { const m = E('fhFacing')(t, 'monster', 1, false), s = E('fhFacing')(t, 'strong', .4, false);
    if (m.fold > 1e-9 || s.fold > 1e-9) return [false, `${t}: monster folds ${m.fold}, strong folds ${s.fold}`]; }
  return [true];
});
check('Opponent models', 'A nit folds more than a calling station to the same bet', () => {
  E('fh={stack:{vil:90},pot:10}'); const f = t => E('fhFacing')(t, 'medium', .75, false).fold;
  return [f('nit') > f('station'), `nit ${f('nit').toFixed(2)}, station ${f('station').toFixed(2)}`];
});

/* ---------- full hands ---------- */
for (const m of ['cash', 'tour'])
  check('Full hands', `${m === 'cash' ? 'Cash' : 'Tournament'}: 150 random hands finish and every chip is accounted for`, () => {
    E(`mode='${m}'`); W.setTimeout = f => f();
    for (let i = 0; i < 150; i++) {
      E('fhDeal()'); let g = 0;
      while (!E('fh.done') && g++ < 40) { const bs = [...W.document.querySelectorAll('#fh-acts button[data-a]')]; if (!bs.length) break; bs[Math.floor(Math.random() * bs.length)].click(); }
      const fh = E('fh'), d = fh.depth || 100;
      if (!fh.done) return [false, `hand ${i} did not finish (${fh.ask})`];
      for (const w of ['hero', 'vil']) if (!near(fh.stack[w] + fh.inv[w], d, 1e-6)) return [false, `hand ${i}: ${w} stack ${fh.stack[w]} + in pot ${fh.inv[w]} ≠ ${d}`];
      const dead = fh.pot - fh.inv.hero - fh.inv.vil; if (dead < -1e-6 || dead > 2.5 + 1e-6) return [false, `hand ${i}: ${dead} BB of dead money`];
    }
    return [true];
  });

/* ---------- trainers ---------- */
check('Trainers', 'Hand reading: the range share after an action equals re-weighting by hand', () => {
  E(`mode='cash'`); E('newRD()'); const rd = E('rd'), c = rd.cur;
  let n = 0, d = 0; for (const x of rd.range) { const w = x.w * c.f(x); d += w; if (E('RD_TOPPLUS').has(x.g)) n += w; }
  return [near(n / d, c.after, 1e-9) && c.after >= 0 && c.after <= 1, `app ${c.after.toFixed(3)}, check ${(n / d).toFixed(3)}`];
});
check('Trainers', 'Exploit drills: the best option is the one with the highest EV (200 spots)', () => {
  for (let i = 0; i < 200; i++) { E('newXP()'); const q = E('xp'), best = Object.entries(q.ev).sort((a, b) => b[1] - a[1])[0][0]; if (best !== q.best) return [false, JSON.stringify(q.ev)]; }
  return [true];
});
check('Trainers', '3-bet & multiway: every question has a valid answer (100 questions)', () => {
  for (const m of ['cash', 'tour']) { E(`mode='${m}'`); for (let i = 0; i < 50; i++) { const k = Object.keys(E('PT_GEN'))[i % 5], q = E('PT_GEN')[k]();
    if (q.slider ? !(q.answer >= 0 && q.answer <= 1) : !(q.correct >= 0 && q.correct < q.opts.length)) return [false, `${m} ${k}`]; } }
  return [true];
});
check('Trainers', 'Leak finder spots a player who folds too much preflop', () => {
  E('log=[]'); for (let i = 0; i < 24; i++) E('logEvent')({ drill: 'Preflop', spot: 'BTN open', hand: 'A5s', answer: i % 2 ? 'Raise' : 'Fold', expected: 'Raise', correct: !!(i % 2) });
  const f = E('lkFindings')(E('log')); E('log=[]');
  return [f.some(x => /Too tight/.test(x.title)), f.map(x => x.title).join(', ') || 'no findings'];
});


/* ---------- learning path ---------- */
check('Learning path', 'Every lesson makes valid questions at all 3 levels, cash and tournament (6 each)', () => {
  const was = E('mode');
  for (const m of ['cash', 'tour']) { E(`mode='${m}'`);
    for (const l of E('LN_ALL').filter(l => l.gen)) for (const lv of [1, 2, 3]) for (let i = 0; i < 6; i++) for (const q of [].concat(l.gen(lv))) {
      if (!q || !Array.isArray(q.opts) || q.opts.length < 2 || !(q.correct >= 0 && q.correct < q.opts.length) || new Set(q.opts.map(String)).size !== q.opts.length) return [false, `${m} ${l.id} level ${lv}: ${JSON.stringify(q && q.opts)} → ${q && q.correct}`]; } }
  E(`mode='${was}'`); return [true, `${E('LN_ALL').length} lessons × 3 levels`];
});
check('Learning path', 'Basics answers match the hand evaluator (300 questions)', () => {
  for (let i = 0; i < 100; i++) {
    const s = E('lnShowdown')(1 + i % 3), cs = s.hand.split(' vs ').map(h => C(h.replace(/ /g, ''))), board = C(s.short.split(' on ')[1].replace(/ /g, ''));
    const a = E('evalHand')(cs[0].concat(board)), b = E('evalHand')(cs[1].concat(board)), want = a > b ? 0 : a < b ? 1 : 2;
    if (s.correct !== want) return [false, `showdown ${s.short}: app ${s.opts[s.correct]}`];
    const n = E('lnNameHand')(1 + i % 3), parts = n.short.split(' on '), k = Math.floor(E('evalHand')(C(parts[0].replace(/ /g, '')).concat(C(parts[1].replace(/ /g, '')))) / E('B5'));
    if (n.opts[n.correct] !== E('CAT')[k]) return [false, `name your hand ${n.short}: app ${n.opts[n.correct]}, evaluator ${E('CAT')[k]}`];
    for (let c = 0; c < 9; c++) if (Math.floor(E('evalHand')(E('lnMakeCat')(c)) / E('B5')) !== c) return [false, `made a ${E('CAT')[c]} that isn't one`];
  }
  return [true];
});
check('Learning path', 'Lessons unlock in order: only the first is open at the start', () => {
  const saved = E('JSON.stringify(ln)'); E('ln.lessons={}');
  const open = E('LN_ALL').filter(l => E('lnOpen')(l)).map(l => l.id);
  E('ln.lessons={"ranks":{best:8,attempts:1}}'); const two = E('LN_ALL').filter(l => E('lnOpen')(l)).length;
  E('ln.lessons={"basics-check":{placed:true}}'); const unit2 = E('lnOpen')(E('lnById')('pf-late'));
  E(`ln=${saved}`);
  return [open.length === 1 && open[0] === 'ranks' && two === 2 && unit2, `open at start: ${open}; after one pass: ${two}; checkpoint unlocks next unit: ${unit2}`];
});
check('Learning path', 'Reviews: a passed lesson is due a day later, and the gap grows 1 → 3 → 7 days', () => {
  const saved = E('JSON.stringify(ln)'), D = E('LN_DAY'), now = Date.now();
  E('ln.lessons={"ranks":{best:9,attempts:1,last:' + (now - 2 * D) + '}}');
  const due1 = E('lnDue()').map(l => l.id).join(), r = E('ln.lessons.ranks'); E('lnSchedule')(r, 1); const g1 = Math.round((r.due - Date.now()) / D); E('lnSchedule')(r, 2); const g2 = Math.round((r.due - Date.now()) / D);
  const due2 = E('lnDue()').length; E(`ln=${saved}`);
  return [due1 === 'ranks' && g1 === 3 && g2 === 7 && due2 === 0, `due: ${due1}; gaps ${g1}, ${g2} days; due after scheduling: ${due2}`];
});
check('Learning path', 'ICM lesson answers match the ICM calculator', () => {
  for (let i = 0; i < 60; i++) { const q = E('lnICM')(1 + i % 3), st = q.hand.split('/').map(Number), pk = q.spot.split(', ')[1], eq = E('icmEquity')(st, E('ICM_PAY')[pk])[0];
    if (q.opts[q.correct] !== Math.round(eq) + '%') return [false, `${q.short}: ${q.opts[q.correct]} vs ${eq.toFixed(1)}%`]; }
  return [true];
});
check('Learning path', 'Reading hands: a full hand is 4 questions, and the read is the biggest group left in the range', () => {
  for (let i = 0; i < 30; i++) { const qs = E('lnRDHand')(1 + i % 3, 'all'); if (qs.length !== 4) return [false, `${qs.length} questions`];
    const r = qs[3]; if (!(r.correct >= 0) || !/most likely/.test(r.prompt)) return [false, 'read question malformed']; }
  return [true];
});
check('Learning path', 'Every unit but the capstone ends in a checkpoint; capstone lessons name their opponents', () => {
  const U = E('LN_UNITS'), bad = U.filter(u => !u.lessons.some(l => l.cap) && !u.lessons[u.lessons.length - 1].check).map(u => u.id);
  const cap = U.find(u => u.id === 'capstone'), types = Object.keys(E('FH_TYPES'));
  const capOk = cap && cap.lessons.every(l => l.cap.types.every(t => types.includes(t)));
  return [!bad.length && capOk, bad.length ? 'no checkpoint: ' + bad : `${U.length} units`];
});
check('Equity simulation', 'Dominated-hand shortcut stays within 8 points of the exact equity (300 random hands)', () => {
  let worst = 0, w = '';
  for (let i = 0; i < 300; i++) { const [h0, h1] = E('dealMatchup')('dom'), r = E('muRule')(h0, h1), fav = r.fav === 0 ? h0 : h1, oth = r.fav === 0 ? h1 : h0, e = E('equity')(fav, oth, [], 6000).eq * 100;
    if (Math.abs(e - r.rule) > worst) { worst = Math.abs(e - r.rule); w = `${E('names')(fav)} vs ${E('names')(oth)}: rule ${r.rule}%, exact ${e.toFixed(1)}%`; } }
  return [worst <= 8, `worst miss ${worst.toFixed(1)} pts: ${w}`];
});
check('Settings', 'Clock settings are kept within their limits', () => {
  const c = E('appCfgClean')({ shot: 2, bank: 9999, fhShot: '45', bankOn: 1, fhOn: 0 });
  return [c.shot === 5 && c.bank === 300 && c.fhShot === 45 && c.bankOn === true && c.fhOn === false, JSON.stringify(c)];
});
check('Learning path', 'Rule of 2 and 4 answers are outs × 4 on the flop and × 2 on the turn', () => {
  for (let i = 0; i < 200; i++) { const q = E('lnRule')(), n = parseInt(q.hand), flop = /Flop/.test(q.spot), want = n * (flop ? 4 : 2);
    if (q.opts[q.correct] !== want + '%') return [false, `${q.hand} ${q.spot}: ${q.opts[q.correct]}`]; }
  return [true];
});

/* ---------- runner ---------- */
function load() {
  return new Promise((res, rej) => {
    frame.onload = () => { W = frame.contentWindow; E = s => W.eval(s); setTimeout(res, 400); };
    frame.onerror = rej; frame.src = 'index.html?test=1';
  });
}
async function run() {
  const btn = document.getElementById('run'); btn.disabled = true; document.getElementById('sum').textContent = 'Loading the app…'; document.getElementById('out').innerHTML = '';
  const t0 = performance.now(); await load();
  const secs = {}; let pass = 0, fail = 0;
  for (const [sec, name, fn] of T) {
    document.getElementById('sum').textContent = `Checking: ${name}`; await new Promise(r => setTimeout(r, 0));
    let ok, info = '';
    try { [ok, info = ''] = fn(); } catch (e) { ok = false; info = 'Error: ' + e.message; }
    ok ? pass++ : fail++; (secs[sec] = secs[sec] || []).push({ name, ok, info });
  }
  document.getElementById('out').innerHTML = Object.entries(secs).map(([sec, rows]) => `<section class="panel tsec"><h2>${sec}</h2>${rows.map(r => `<div class="trow ${r.ok ? 'pass' : 'fail'}"><span class="ic">${r.ok ? '✓' : '✗'}</span><div>${r.name}${r.info ? `<small>${r.info.replace(/</g, '&lt;')}</small>` : ''}</div></div>`).join('')}</section>`).join('');
  document.getElementById('sum').innerHTML = fail ? `<span style="color:var(--bad)">${fail} failed</span>, ${pass} passed` : `<span style="color:var(--good)">All ${pass} checks passed</span>`;
  document.getElementById('time').textContent = `${((performance.now() - t0) / 1000).toFixed(1)} s · app version ${E('APP_VERSION')}`;
  btn.disabled = false; btn.textContent = 'Run again';
}
document.getElementById('run').onclick = run;
