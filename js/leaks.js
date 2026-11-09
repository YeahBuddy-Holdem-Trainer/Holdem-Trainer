/* ---------- leak finder ----------
   Looks for patterns, not just low scores:
     trainer answers  - leaning one way: too tight or too loose preflop, calling or folding too much,
                        betting too small or too big, over- or under-estimating equity, misplaying player types
     your hand log    - results by position and by opponent style, how often you raise vs call first in,
                        your c-bet rate as the preflop raiser, and your average bet sizes by street
   Each finding has a size (how often, and how many hands it's based on) and a link to the trainer that fixes it. */
const LK_AGG = a => /fold/i.test(a) ? 0 : /^(check|call|either)/i.test(a) ? 1 : /^(raise|3-bet|4-bet|shove|bet|all in|jam|over|small|medium|large)/i.test(a) ? 2 : -1;
const LK_SIZE = a => { const i = SZB.findIndex(b => a && a.toLowerCase().startsWith(b.name.toLowerCase())); return i; };
let lkWindow = 'all', lkGame = 'all';

function lkRows() {
  const since = lkWindow === 'all' ? 0 : Date.now() - (+lkWindow) * 864e5;
  return log.filter(r => (!since || new Date(r.ts).getTime() >= since) && (lkGame === 'all' || (r.game || '').toLowerCase().startsWith(lkGame)));
}
function lkFindings(rows) {
  const F = [], add = (sev, title, text, train) => F.push({ sev, title, text, train });
  const by = d => rows.filter(r => r.drill === d);
  /* preflop: tight or loose */
  const pf = by('Preflop').filter(r => !r.correct);
  if (pf.length >= 4) { const tight = pf.filter(r => LK_AGG(r.answer) < LK_AGG(r.expected)).length, loose = pf.filter(r => LK_AGG(r.answer) > LK_AGG(r.expected)).length, n = by('Preflop').length;
    if (tight >= loose * 2 && tight >= 3) add(tight / n, 'Too tight preflop', `${tight} of your ${pf.length} preflop misses were folds or calls where the chart raises. Hands you fold too often: ${lkTop(pf.filter(r => LK_AGG(r.answer) < LK_AGG(r.expected)).map(r => r.hand))}.`, 'preflop');
    if (loose >= tight * 2 && loose >= 3) add(loose / n, 'Too loose preflop', `${loose} of your ${pf.length} preflop misses were plays where the chart folds or flats. Hands you play too often: ${lkTop(pf.filter(r => LK_AGG(r.answer) > LK_AGG(r.expected)).map(r => r.hand))}.`, 'preflop');
    const spots = lkWorst(by('Preflop'), 'spot'); if (spots) add(spots.rate * .6, `Weakest chart: ${spots.k}`, `${pct(spots.rate, 0)} wrong over ${spots.n} answers.`, 'preflop'); }
  /* call or fold */
  const cf = by('Call or fold').filter(r => !r.correct && r.expected !== 'Either'), ncf = by('Call or fold').length;
  if (cf.length >= 3) { const callBad = cf.filter(r => r.answer === 'Call').length, foldBad = cf.length - callBad;
    if (callBad >= foldBad * 1.8) add(callBad / ncf, 'Calling too much', `${callBad} of ${cf.length} call-or-fold mistakes were calls without the right price. Check equity against the price before calling.`, 'call-or-fold');
    else if (foldBad >= callBad * 1.8) add(foldBad / ncf, 'Folding too much', `${foldBad} of ${cf.length} call-or-fold mistakes were folds with enough equity to call.`, 'call-or-fold'); }
  /* bet sizing */
  const sz = by('Bet sizing').filter(r => !r.correct), nsz = by('Bet sizing').length;
  if (sz.length >= 3) { let small = 0, big = 0;
    for (const r of sz) { const a = LK_SIZE(r.answer), e = String(r.expected).split(' / ').map(LK_SIZE).filter(x => x >= 0); if (a < 0 || !e.length) continue;
      if (a < Math.min(...e)) small++; else if (a > Math.max(...e)) big++; }
    if (small >= big * 1.8 && small >= 3) add(small / nsz, 'Betting too small (or checking too much)', `${small} of your ${sz.length} sizing misses were smaller than the best size. Value hands and draws on wet boards usually want more.`, 'sizing');
    if (big >= small * 1.8 && big >= 3) add(big / nsz, 'Betting too big', `${big} of your ${sz.length} sizing misses were bigger than the best size. Thin value and dry boards usually want smaller bets.`, 'sizing'); }
  /* equity estimates: bias */
  for (const [d, view, what] of [['Street equity', 'street-equity', 'your equity'], ['Hand vs range', 'hvr', 'your equity against ranges'], ['Range vs range', 'rvr', 'range equity'], ['Range vs board', 'board', 'range strength on boards'], ['Pot odds', 'pot-odds', 'the equity you need']]) {
    const xs = by(d).filter(r => r.answer !== '' && r.expected !== '' && !isNaN(+r.answer) && !isNaN(+r.expected));
    if (xs.length < 6) continue;
    const bias = xs.reduce((a, r) => a + (+r.answer - +r.expected), 0) / xs.length, mae = xs.reduce((a, r) => a + Math.abs(+r.answer - +r.expected), 0) / xs.length;
    if (Math.abs(bias) >= 4) add(Math.min(1, Math.abs(bias) / 15), `${bias > 0 ? 'Overestimating' : 'Underestimating'} ${what}`, `On average you're ${Math.abs(bias).toFixed(1)} points ${bias > 0 ? 'high' : 'low'} in ${d} (${xs.length} answers, average miss ${mae.toFixed(1)}).`, view);
    else if (mae >= 9) add(Math.min(1, mae / 25), `Rough estimates in ${d}`, `Average miss of ${mae.toFixed(1)} points over ${xs.length} answers, with no steady lean either way.`, view);
  }
  /* hand reading: bets vs checks */
  const hr = by('Hand reading').filter(r => r.error !== '' && !isNaN(+r.error));
  if (hr.length >= 6) { const bets = hr.filter(r => /bet$/.test(r.spot)), checks = hr.filter(r => /check$/.test(r.spot)), avg = a => a.reduce((s, r) => s + +r.error, 0) / (a.length || 1);
    const sb = bets.reduce((s, r) => s + (+r.answer - +r.expected), 0) / (bets.length || 1);
    if (bets.length >= 3 && avg(bets) >= 9) add(Math.min(1, avg(bets) / 25), 'Misreading bets', `When they bet, your estimate of their top-pair-or-better share is off by ${avg(bets).toFixed(0)} points on average${Math.abs(sb) >= 4 ? `, usually ${sb > 0 ? 'too strong' : 'too weak'}` : ''}.`, 'reading');
    if (checks.length >= 3 && avg(checks) >= 9) add(Math.min(1, avg(checks) / 25), 'Misreading checks', `When they check, your estimate is off by ${avg(checks).toFixed(0)} points on average. Checks usually remove most strong hands.`, 'reading'); }
  /* exploit: by style */
  const ex = by('Exploit'); if (ex.length >= 6) { const w = lkWorst(ex.map(r => ({ ...r, k: r.spot.split(' vs ')[1] })), 'k', 3); if (w && w.rate >= .35) add(w.rate * .8, `Misplaying ${w.k.toLowerCase()}s`, `${pct(w.rate, 0)} of your exploit answers against this type were wrong (${w.n} spots).`, 'exploit'); }
  /* simulated full hands */
  const fh = by('Full hand'); if (fh.length >= 8) { const wrong = fh.filter(r => !r.correct), pass = wrong.filter(r => LK_AGG(r.answer) < LK_AGG(r.expected)).length, agg = wrong.filter(r => LK_AGG(r.answer) > LK_AGG(r.expected)).length;
    if (pass >= agg * 1.8 && pass >= 3) add(pass / fh.length, 'Too passive in full hands', `${pass} of ${wrong.length} full-hand mistakes were checks, calls or folds where betting or raising was better.`, 'hand');
    if (agg >= pass * 1.8 && agg >= 3) add(agg / fh.length, 'Too aggressive in full hands', `${agg} of ${wrong.length} full-hand mistakes were bets or raises where checking, calling or folding was better.`, 'hand'); }
  /* everything else: accuracy by trainer */
  const covered = new Set(['Preflop', 'Call or fold', 'Bet sizing', 'Street equity', 'Hand vs range', 'Range vs range', 'Range vs board', 'Pot odds', 'Hand reading', 'Exploit', 'Full hand']);
  for (const d of [...new Set(rows.map(r => r.drill))].filter(d => !covered.has(d))) { const xs = by(d); if (xs.length < 6) continue;
    const rate = xs.filter(r => !r.correct).length / xs.length; const w = lkWorst(xs, 'spot');
    if (rate >= .35) add(rate * .7, `${d}: ${pct(1 - rate, 0)} right`, `Over ${xs.length} answers.${w ? ` Weakest part: ${w.k} (${pct(w.rate, 0)} wrong).` : ''}`, (typeof TRAIN_HASH !== 'undefined' && TRAIN_HASH[d]) || null); }
  return F;
}
function lkTop(xs, n = 6) { const m = {}; xs.forEach(x => m[x] = (m[x] || 0) + 1); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => c > 1 ? `${k} (${c}×)` : k).join(', ') || '–'; }
function lkWorst(rows, key, min = 5) { const m = {}; for (const r of rows) { const k = r[key]; if (!k) continue; m[k] = m[k] || { n: 0, w: 0 }; m[k].n++; if (!r.correct) m[k].w++; }
  const xs = Object.entries(m).filter(([, v]) => v.n >= min).map(([k, v]) => ({ k, n: v.n, rate: v.w / v.n })).sort((a, b) => b.rate - a.rate); return xs[0] && xs[0].rate > 0 ? xs[0] : null; }

/* ---------- the hand log ---------- */
function lkLog() {
  const hs = lgHands.filter(h => lkGame === 'all' || (lkGame === 'cash' ? h.game === 'cash' : h.game !== 'cash')).filter(h => +h.bb > 0);
  const out = { n: hs.length, F: [] }; if (!hs.length) return out;
  const nb = h => (+h.net || 0) / +h.bb;
  out.net = hs.reduce((a, h) => a + nb(h), 0);
  /* by position */
  const pos = {}; for (const h of hs) { const p = h.hero.pos || '?'; pos[p] = pos[p] || { n: 0, net: 0 }; pos[p].n++; pos[p].net += nb(h); }
  out.pos = LG_POS.filter(p => pos[p]).map(p => ({ p, ...pos[p] }));
  /* by opponent style */
  const sty = {}; for (const h of hs) for (const s of new Set(h.players.map(p => (lgPlayer(p.pid) || {}).style).filter(Boolean))) { sty[s] = sty[s] || { n: 0, net: 0 }; sty[s].n++; sty[s].net += nb(h); }
  out.sty = Object.entries(sty).map(([s, v]) => ({ s, ...v })).sort((a, b) => a.net - b.net);
  /* first action preflop, c-bets, sizes */
  let rf = 0, cf = 0, cbOpp = 0, cb = 0; const sizes = { flop: [], turn: [], river: [] };
  for (const h of hs) {
    const r = lgReplay(h), pre = r.streets.pre.rows, first = pre.find(x => x.who === 'hero');
    const before = first ? pre.slice(0, pre.indexOf(first)) : [], raised = before.some(x => ['bet', 'raise', 'allin'].includes(x.act));
    if (first && !raised) { if (['bet', 'raise', 'allin'].includes(first.act)) rf++; else if (first.act === 'call') cf++; }
    const aggr = [...pre].reverse().find(x => ['bet', 'raise', 'allin'].includes(x.act));
    const flop = r.streets.flop.rows, heroF = flop.find(x => x.who === 'hero');
    if (aggr && aggr.who === 'hero' && heroF) { const bf = flop.slice(0, flop.indexOf(heroF)); if (!bf.some(x => ['bet', 'raise', 'allin'].includes(x.act))) { cbOpp++; if (['bet', 'allin'].includes(heroF.act)) cb++; } }
    for (const st of ['flop', 'turn', 'river']) for (const x of r.streets[st].rows) if (x.who === 'hero' && x.pct != null) sizes[st].push(x.pct);
  }
  Object.assign(out, { rf, cf, cbOpp, cb, sizes });
  const F = out.F, add = (sev, title, text, train) => F.push({ sev, title, text, train });
  if (rf + cf >= 6 && cf / (rf + cf) > .4) add(cf / (rf + cf), 'Calling first in too often', `When the action folded or limped to you, you called or limped ${cf} times and raised ${rf} times. Raising first in wins more pots preflop and gives you the initiative.`, 'preflop');
  if (cbOpp >= 6) { const r = cb / cbOpp; if (r < .35) add(.35 - r + .3, 'Not c-betting enough', `As the preflop raiser you bet the flop ${cb} of ${cbOpp} times (${pct(r, 0)}). Against one caller, small c-bets on boards that favor you win a lot of pots.`, 'texture');
    if (r > .88) add(r - .88 + .3, 'C-betting nearly always', `As the preflop raiser you bet the flop ${cb} of ${cbOpp} times (${pct(r, 0)}). Checking boards that favor the caller protects your checking range.`, 'texture'); }
  for (const st of ['flop', 'turn', 'river']) { const xs = sizes[st]; if (xs.length < 5) continue; const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (st === 'flop' && avg > .85) add(.4, 'Big flop bets', `Your flop bets average ${pct(avg, 0)} of the pot (${xs.length} bets). Most flop bets work at a third to two thirds of the pot.`, 'sizing');
    if (avg < .3) add(.35, `Small ${st} bets`, `Your ${st} bets average ${pct(avg, 0)} of the pot (${xs.length} bets). Bigger bets get more value from strong hands later in the hand.`, 'sizing'); }
  const worstSty = out.sty.find(s => s.n >= 3 && s.net < 0); if (worstSty) add(Math.min(1, -worstSty.net / worstSty.n / 20 + .3), `Losing to ${worstSty.s.toLowerCase()}s`, `${fmtBB(Math.round(worstSty.net * 10) / 10)} BB over ${worstSty.n} logged hands against this style. Drill the adjustments against them.`, 'exploit');
  const worstPos = out.pos.filter(p => p.n >= 4).sort((a, b) => a.net / a.n - b.net / b.n)[0]; if (worstPos && worstPos.net < 0) add(.3, `Losing from the ${worstPos.p}`, `${fmtBB(Math.round(worstPos.net * 10) / 10)} BB over ${worstPos.n} logged hands from this seat.`, 'preflop');
  return out;
}

function lkRender() {
  const rows = lkRows(), F = lkFindings(rows), L = lkLog(), all = [...F, ...L.F].sort((a, b) => b.sev - a.sev);
  const card = f => `<div class="lk-item"><div><b>${f.title}</b><p class="small">${f.text}</p></div>${f.train ? `<a class="act ghost" href="#${f.train}">Train</a>` : ''}</div>`;
  $('lk-top').innerHTML = all.length ? all.slice(0, 6).map(card).join('')
    : `<p class="small muted">${rows.length + L.n < 30 ? `Not enough to go on yet: ${rows.length} trainer answers and ${L.n} logged hands${lkWindow !== 'all' ? ' in this period' : ''}. Leaks show up after a few dozen answers in each trainer and 10 or more logged hands.` : 'No clear leaks in this data. Keep training and logging hands; this updates as you go.'}</p>`;
  $('lk-more').innerHTML = all.length > 6 ? `<h3>More</h3>${all.slice(6).map(card).join('')}` : '';
  /* trainer summary */
  const ag = aggregate(rows).filter(a => a.n >= 5).map(a => ({ ...a, ...grade(a) })).sort((a, b) => b.need - a.need).slice(0, 8);
  $('lk-train').innerHTML = ag.length ? `<table class="ref"><thead><tr><th>Trainer · spot</th><th>Answers</th><th>Score</th></tr></thead><tbody>${ag.map(a => `<tr><td class="t">${a.drill} · ${esc(a.spot)}</td><td>${a.n}</td><td>${a.score}</td></tr>`).join('')}</tbody></table>` : '<p class="small muted">No trainer answers in this period yet.</p>';
  /* hand log summary */
  if (!L.n) { $('lk-log').innerHTML = '<p class="small muted">No logged hands with the big blind filled in yet. Log hands from real games under Play > Hand log.</p>'; return; }
  const sz = st => L.sizes[st].length ? `${pct(L.sizes[st].reduce((a, b) => a + b, 0) / L.sizes[st].length, 0)} <span class="muted">(${L.sizes[st].length})</span>` : '–';
  $('lk-log').innerHTML = `<div class="stats"><div class="stat"><div class="n">${L.n}</div><span class="small muted">hands logged</span></div><div class="stat"><div class="n ${L.net >= 0 ? 'good' : 'bad'}">${L.net >= 0 ? '+' : ''}${fmtBB(Math.round(L.net * 10) / 10)}</div><span class="small muted">BB won</span></div>
      <div class="stat"><div class="n">${L.rf + L.cf ? pct(L.rf / (L.rf + L.cf), 0) : '–'}</div><span class="small muted">raise first in</span></div><div class="stat"><div class="n">${L.cbOpp ? pct(L.cb / L.cbOpp, 0) : '–'}</div><span class="small muted">flop c-bet (${L.cbOpp})</span></div></div>
    <table class="ref"><thead><tr><th>Your average bet</th><th>Flop</th><th>Turn</th><th>River</th></tr></thead><tbody><tr><td class="t">Share of the pot</td><td>${sz('flop')}</td><td>${sz('turn')}</td><td>${sz('river')}</td></tr></tbody></table>
    <table class="ref"><thead><tr><th>Position</th><th>Hands</th><th>BB won</th></tr></thead><tbody>${L.pos.map(p => `<tr><td class="t">${p.p}</td><td>${p.n}</td><td>${p.net >= 0 ? '+' : ''}${fmtBB(Math.round(p.net * 10) / 10)}</td></tr>`).join('')}</tbody></table>
    ${L.sty.length ? `<table class="ref"><thead><tr><th>Against</th><th>Hands</th><th>BB won</th></tr></thead><tbody>${L.sty.map(s => `<tr><td class="t">${s.s}</td><td>${s.n}</td><td>${s.net >= 0 ? '+' : ''}${fmtBB(Math.round(s.net * 10) / 10)}</td></tr>`).join('')}</tbody></table>` : '<p class="small muted">Tag players in your logged hands to see results by opponent style.</p>'}
    <p class="small muted">Logged hands are the ones you chose to record, so they lean toward big and tricky pots. Treat results as a guide, not a win rate.</p>`;
}
$('lk-window').onchange = () => { lkWindow = $('lk-window').value; lkRender(); };
$('lk-game').onchange = () => { lkGame = $('lk-game').value; lkRender(); };
