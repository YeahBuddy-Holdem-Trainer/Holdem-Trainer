/* ---------- hand reading by street ----------
   An opponent opens, you call from the big blind, and they act on each street. Their range starts as their
   opening chart. Every check or bet re-weights each combo by how likely that hand is to take that action
   (a simple model: strong hands and draws bet more, weak pairs check more, some air bluffs). You estimate
   what share of the remaining range is top pair or better, see the range narrow, and finally put them on a hand. */
const RD_SPOTS = {
  cash: [['cash-btn-open', 'cash-bb-vs-btn-open', 'Button'], ['cash-co-open', 'cash-bb-vs-co-open', 'Cutoff'], ['cash-utg-open', 'cash-bb-vs-utg-open', 'UTG']],
  tour: [['tour-btn-open-40-bb', 'tour-bb-vs-btn-open-40-bb', 'Button'], ['tour-co-open-40-bb', 'tour-bb-vs-co-open-40-bb', 'Cutoff'], ['tour-utg-open-40-bb', 'tour-bb-vs-utg-open-40-bb', 'UTG']]
};
const RD_GROUPS = { strong: 'Two pair or better', top: 'Top pair or overpair', mid: 'Second pair or underpair', weak: 'Weak pair', draw: 'Draw', air: 'Nothing (air)' };
const RD_TOPPLUS = new Set(['strong', 'top']);
/* chance of betting with each group, by street; aggressive players bluff more */
const RD_BET = {
  flop: { strong: .85, top: .85, mid: .4, weak: .3, draw: .7, air: .45 },
  turn: { strong: .9, top: .65, mid: .2, weak: .1, draw: .55, air: .25 },
  river: { strong: .95, top: .55, mid: .1, weak: .05, draw: .3, air: .3 }
};
const RD_TYPES = { reg: { name: 'Solid regular', air: 1 }, aggro: { name: 'Aggressive player', air: 1.6 }, nit: { name: 'Tight player', air: .45 } };
const RD_SIZE = { flop: .33, turn: .66, river: .75 };
let rd = null;

function rdGroup(hole, board) {
  const { made, draw } = rvbClassify(hole, board);
  if (RVB_STRONG.has(made)) return 'strong';
  if (made === 'overpair' || made === 'tpgk' || made === 'tpwk') return 'top';
  if (board.length < 5 && ['combo', 'fd', 'oesd', 'gut'].includes(draw)) return 'draw';
  if (made === 'middle' || made === 'ppbelow') return 'mid';
  if (made === 'weak') return 'weak';
  return 'air';
}
const rdP = (st, g, type) => Math.min(.95, RD_BET[st][g] * (g === 'air' || (st === 'river' && g === 'draw') ? RD_TYPES[type].air : 1));
const rdShare = (f) => { let a = 0, t = 0; for (const x of rd.range) { t += x.w; if (f(x)) a += x.w; } return t ? a / t : 0; };

function rdGrid(hlLabel) {
  const by = new Map(); for (const x of rd.range) { const o = by.get(x.l) || { w: 0, n: 0 }; o.w += x.w; o.n++; by.set(x.l, o); }
  const mx = Math.max(...[...by.values()].map(o => o.w / o.n), 1e-9); let h = '';
  for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) {
    const l = gridLabel(i, j), o = by.get(l), v = o ? o.w / o.n / mx : 0;
    h += `<span class="${v > .02 ? 'a0' : ''}${l === hlLabel ? ' cur' : ''}" style="${v > .02 ? `opacity:${(.18 + .82 * v).toFixed(2)}` : ''}" title="${l}">${l}</span>`;
  }
  const tot = rd.range.reduce((a, x) => a + x.w, 0);
  return `<div class="rgrid eq-grid" role="img" aria-label="Opponent's range, darker is more likely">${h}</div><p class="small muted">About ${Math.round(tot)} combos left, weighted by how likely each is to have acted this way. Darker means more likely.</p>`;
}
function rdBreakdown() {
  const t = rd.range.reduce((a, x) => a + x.w, 0), m = {};
  for (const x of rd.range) m[x.g] = (m[x.g] || 0) + x.w;
  return `<table class="ref"><tbody>${Object.keys(RD_GROUPS).filter(g => m[g] > t * .005).map(g => `<tr><td class="t">${RD_GROUPS[g]}</td><td>${pct(m[g] / t, 0)}</td></tr>`).join('')}</tbody></table>`;
}

function newRD() {
  const [openId, callId, vName] = pick(RD_SPOTS[mode === 'cash' ? 'cash' : 'tour']), type = pick(Object.keys(RD_TYPES));
  const vLabels = eqSpotLabels(openId), hLabels = eqSpotLabels(callId, 'Call');
  const deck = shuffled(), hero = pick(hLabels.flatMap(labelCombos)), d2 = deck.filter(c => !hero.includes(c));
  const all = vLabels.flatMap(labelCombos).filter(c => !hero.includes(c[0]) && !hero.includes(c[1]));
  const vil = pick(all), board = d2.filter(c => !vil.includes(c)).slice(0, 5);
  const vPos = SPOTS.find(s => s.id === openId).hero, open = SPOTS.find(s => s.id === openId).o || (mode === 'cash' ? 2.5 : 2.2);
  rd = { type, vPos, vName, hero, vil, board, street: 0, pot: open * 2 + .5 + (mode === 'cash' ? 0 : 1), log: [], answers: [], t0: Date.now(), done: false,
    range: all.filter(c => !board.slice(0, 0).includes(c[0])).map(c => ({ c, l: handLabel(c), w: 1, g: null })) };
  rd.log.push(`${RD_TYPES[type].name} opens to ${fmtBB(open)} BB from the ${vName.toLowerCase()}. You call in the big blind.`);
  rdNextStreet();
}
function rdNextStreet() {
  const st = ['flop', 'turn', 'river'][rd.street], nb = [3, 4, 5][rd.street], b = rd.board.slice(0, nb);
  /* drop combos that clash with the new cards, classify the rest on this board */
  rd.range = rd.range.filter(x => !b.includes(x.c[0]) && !b.includes(x.c[1]));
  for (const x of rd.range) x.g = rdGroup(x.c, b);
  const before = rdShare(x => RD_TOPPLUS.has(x.g)), myG = rdGroup(rd.vil, b), bets = Math.random() < rdP(st, myG, rd.type);
  const f = x => { const p = rdP(st, x.g, rd.type); return bets ? p : 1 - p; };
  let num = 0, den = 0; for (const x of rd.range) { const w = x.w * f(x); den += w; if (RD_TOPPLUS.has(x.g)) num += w; }
  const size = Math.round(rd.pot * RD_SIZE[st] * 2) / 2;
  const gm = {}; for (const x of rd.range) { const o = gm[x.g] = gm[x.g] || { w: 0, a: 0, p: rdP(st, x.g, rd.type) }; o.w += x.w; o.a += x.w * f(x); }
  rd.cur = { st, b, bets, size, before, after: den ? num / den : 0, f, gm, wb: rd.range.reduce((a, x) => a + x.w, 0), wa: den };
  rd.log.push(`<b>${st[0].toUpperCase() + st.slice(1)}</b> ${names(b.slice(nb === 3 ? 0 : nb - 1))}${st === 'flop' ? '' : ''}: you check, they ${bets ? `bet ${fmtBB(size)} BB into ${fmtBB(rd.pot)} BB` : 'check behind'}.`);
  rd.asking = 'share';
  rdRender();
}
function rdRender() {
  const c = rd.cur, seats = {}; POS.forEach(p => seats[p] = { state: 'folded', bet: '', tag: '', stack: '' });
  seats.BB = { state: 'hero', tag: 'You', stack: '', bet: '' };
  seats[rd.vPos] = { state: 'vil', tag: c.bets ? 'Bets' : 'Checks', stack: '', bet: c.bets ? fmtBB(c.size) + ' BB' : '' };
  const shown = rd.done ? { [rd.vPos]: rd.vil } : {};
  renderTable($('rd-table'), { hero: 'BB', seats, heroCards: rd.hero, shown, center: `<div class="cards">${cardsHTML(c.b, 'xs')}</div><b>${fmtBB(rd.pot)} BB</b><span>pot</span>` });
  $('rd-log').innerHTML = rd.log.map(t => `<li>${t}</li>`).join('');
  $('rd-type').textContent = `${RD_TYPES[rd.type].name} in the ${rd.vName.toLowerCase()}`;
  const ask = $('rd-ask');
  if (rd.asking === 'share') {
    $('rd-grid').innerHTML = rdGrid(); $('rd-grid-lbl').textContent = `Their range before the ${c.st} action`;
    ask.innerHTML = `<label for="rd-guess"><span class="lbl">After that ${c.bets ? 'bet' : 'check'}, what share of their range is <b>top pair or better</b>? <b id="rd-gv" style="font-family:var(--mono)">${Math.round(c.before * 100)}</b>%</span></label>
      <input type="range" id="rd-guess" min="0" max="100" value="${Math.round(c.before * 100)}">
      <p class="small muted">The slider starts at the share before this action (${pct(c.before, 0)}). Move it the way you think the ${c.bets ? 'bet' : 'check'} changes it.</p>
      <div class="row"><button class="act" type="button" id="rd-lock">Lock in</button></div>`;
    $('rd-guess').oninput = () => { $('rd-gv').textContent = $('rd-guess').value; };
    $('rd-lock').onclick = rdLockShare;
  } else if (rd.asking === 'read') {
    ask.innerHTML = `<p class="lbl">Final read: what do they most likely have?</p><div class="seg rd-read" role="group">${Object.entries(RD_GROUPS).filter(([g]) => g !== 'draw').map(([g, t]) => `<button type="button" data-g="${g}">${g === 'air' ? 'Missed draw or nothing' : t}</button>`).join('')}</div>`;
    ask.querySelectorAll('[data-g]').forEach(b => b.onclick = () => rdFinal(b.dataset.g));
  } else ask.innerHTML = '';
}
function rdMath(c) {
  const rows = Object.entries(c.gm).filter(([, o]) => o.w > c.wb * .005).sort((a, b) => b[1].w - a[1].w);
  const act = c.bets ? 'bets' : 'checks', topA = rows.filter(([g]) => RD_TOPPLUS.has(g)).reduce((s, [, o]) => s + o.a, 0);
  return mathBox(`<p class="small">Each part of their range keeps only the share that would ${c.bets ? 'bet' : 'check'} here. Multiply each group's share of the range by how often that group ${act}, then see what share of the total is top pair or better.</p>
    <div class="tbl-scroll"><table class="ref"><thead><tr><th>Group</th><th>Share before</th><th>× chance it ${act}</th><th>= what's left</th></tr></thead><tbody>
    ${rows.map(([g, o]) => `<tr${RD_TOPPLUS.has(g) ? ' class="me"' : ''}><td class="t">${RD_GROUPS[g]}</td><td>${pct(o.w / c.wb, 0)}</td><td>${pct(c.bets ? o.p : 1 - o.p, 0)}</td><td>${(o.a / c.wb * 100).toFixed(1)}</td></tr>`).join('')}
    <tr><td class="t"><b>Total left</b></td><td></td><td></td><td><b>${(c.wa / c.wb * 100).toFixed(1)}</b></td></tr></tbody></table></div>
    <p class="small">Top pair or better left: ${(topA / c.wb * 100).toFixed(1)} ÷ ${(c.wa / c.wb * 100).toFixed(1)} = <b>${pct(c.after, 0)}</b>.</p>`);
}
function rdLockShare() {
  const c = rd.cur, g = +$('rd-guess').value, miss = Math.abs(g - c.after * 100), ok = miss <= 8;
  rd.answers.push({ st: c.st, g, a: c.after, miss });
  for (const x of rd.range) x.w *= c.f(x);
  logEvent({ drill: 'Hand reading', spot: `${c.st[0].toUpperCase() + c.st.slice(1)}, ${c.bets ? 'bet' : 'check'}`, hand: names(c.b), answer: g, expected: Math.round(c.after * 100), correct: ok, error: Math.round(miss * 10) / 10, detail: RD_TYPES[rd.type].name, ms: Date.now() - rd.t0 });
  $('rd-grid').innerHTML = rdGrid(); $('rd-grid-lbl').textContent = `Their range after the ${c.st} ${c.bets ? 'bet' : 'check'}`;
  $('rd-step').innerHTML = `<div class="rd-fb ${ok ? 'good' : 'bad'}"><b>${ok ? '✓' : '✗'} ${c.st[0].toUpperCase() + c.st.slice(1)}: ${pct(c.after, 0)} top pair or better</b> <span class="muted">(you said ${g}%, it was ${pct(c.before, 0)} before the ${c.bets ? 'bet' : 'check'})</span>${rdBreakdown()}${rdMath(c)}</div>`;
  if (c.bets) rd.pot += c.size * 2;
  if (rd.street < 2) { rd.asking = null; rdRender(); $('rd-ask').innerHTML = `<div class="row"><button class="act" type="button" id="rd-cont">${c.bets ? 'Call and see the ' + ['turn', 'river'][rd.street] : 'See the ' + ['turn', 'river'][rd.street]}</button></div>`;
    $('rd-cont').onclick = () => { $('rd-step').innerHTML = ''; rd.street++; rdNextStreet(); }; $('rd-cont').focus(); }
  else { rd.asking = 'read'; rdRender(); }
}
function rdFinal(guess) {
  const b = rd.board, actual = rdGroup(rd.vil, b), adj = actual === 'draw' ? 'draw' : actual;
  const ok = guess === adj, t = rd.range.reduce((a, x) => a + x.w, 0), m = {}; for (const x of rd.range) m[x.g] = (m[x.g] || 0) + x.w;
  const likely = Object.keys(m).sort((a, z) => m[z] - m[a])[0];
  rd.done = true; rd.asking = null; rdRender();
  const avg = rd.answers.reduce((a, x) => a + x.miss, 0) / rd.answers.length;
  const s = stats.reading = stats.reading || { n: 0, miss: 0, reads: 0 }; s.n++; s.miss += avg; if (ok) s.reads++; save(); rdStats();
  logEvent({ drill: 'Hand reading', spot: 'Final read', hand: names(rd.vil), answer: guess, expected: adj, correct: ok, error: '', detail: RD_TYPES[rd.type].name, ms: Date.now() - rd.t0 });
  const eq = equityVsRange(rd.hero, [rd.vil], b, 1).eq;
  $('rd-out').innerHTML = `<div class="verdict ${ok && avg <= 8 ? 'good' : 'bad'}"><strong>They had ${handLabel(rd.vil)} (${names(rd.vil)})</strong><span>${RD_GROUPS[actual]}${actual === 'draw' ? '' : ''}. Your read: ${ok ? 'right' : 'not quite'}. Average miss on the range estimates: ${avg.toFixed(1)} pts.</span></div>
    <p class="small">By the river the most likely group in their range was <b>${RD_GROUPS[likely].toLowerCase()}</b> (${pct(m[likely] / t, 0)} of it).${likely !== actual ? ' Reads are about the range: the right read can still lose to the actual hand.' : ''}</p>
    ${rdBreakdown()}
    <ol class="small rd-log">${rd.answers.map(x => `<li>${x.st[0].toUpperCase() + x.st.slice(1)}: you said ${x.g}%, the answer was ${pct(x.a, 0)}</li>`).join('')}</ol>
    <p class="small muted">Your ${handLabel(rd.hero)} ${eq > .5 ? 'beat' : eq === .5 ? 'split with' : 'lost to'} their hand. The model: strong hands and draws bet more often, weak pairs check, and ${RD_TYPES[rd.type].name.toLowerCase()}s bluff ${rd.type === 'aggro' ? 'more' : rd.type === 'nit' ? 'less' : 'a normal amount'} with nothing.</p>`;
  $('rd-step').innerHTML = '';
  $('rd-ask').innerHTML = '';
  $('rd-next').focus();
}
$('rd-next').onclick = () => { $('rd-step').innerHTML = ''; $('rd-out').innerHTML = '<p class="small muted">Your result appears here after the final read.</p>'; newRD(); };
function rdStats() { const s = stats.reading || { n: 0, miss: 0, reads: 0 };
  $('rd-n').textContent = s.n; $('rd-avg').textContent = s.n ? (s.miss / s.n).toFixed(1) : '–'; $('rd-reads').textContent = s.n ? pct(s.reads / s.n, 0) : '–'; }
function rdInit() { rdStats(); $('rd-out').innerHTML = '<p class="small muted">Your result appears here after the final read.</p>'; newRD(); }
