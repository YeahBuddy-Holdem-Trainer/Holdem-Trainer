/* ---------- hand log and player notes ----------
   Log real hands street by street: who acted, what they did and how much. The log works out the pot
   before every action, so each bet shows its size as a share of the pot and each raise as a multiple.
   Players get a style and dated notes; tag them in a hand and their page lists every hand you logged with them.
   Saved in localStorage (holdem-log-v1, holdem-players-v1); js/cloud.js copies both to the account. */
const LGKEY = 'holdem-log-v1', PLKEY = 'holdem-players-v1';
const LG_POS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const LG_POST = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'];
const LG_STREETS = [['pre', 'Preflop', 0], ['flop', 'Flop', 3], ['turn', 'Turn', 1], ['river', 'River', 1]];
const LG_ACTS = [['fold', 'Fold'], ['check', 'Check'], ['call', 'Call'], ['bet', 'Bet'], ['raise', 'Raise to'], ['allin', 'All-in to']];
const LG_STYLES = ['Unknown', 'Tight aggressive (TAG)', 'Loose aggressive (LAG)', 'Tight passive (nit)', 'Loose passive (calling station)', 'Maniac', 'Recreational'];

let lgHands = [], lgPlayers = [];
try { const s = JSON.parse(localStorage.getItem(LGKEY)); if (Array.isArray(s)) lgHands = s; } catch (e) {}
try { const s = JSON.parse(localStorage.getItem(PLKEY)); if (Array.isArray(s)) lgPlayers = s; } catch (e) {}
const lgSaveHands = () => { try { localStorage.setItem(LGKEY, JSON.stringify(lgHands)); } catch (e) {} };
const lgSavePlayers = () => { try { localStorage.setItem(PLKEY, JSON.stringify(lgPlayers)); } catch (e) {} };
const lgToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lgPlayer = id => lgPlayers.find(p => p.id === id);
const lgDate = d => new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

/* page state: tab = hands | players; screen = list | hand | edit | player */
let lg = { tab: 'hands', screen: 'list', id: null, filter: '', confirm: null }, lgDraft = null;

/* ---------- amounts: $ / chips or big blinds ---------- */
function lgAmt(x, h) {
  if (x == null || isNaN(x)) return '';
  if (cfg.units === 'bb' && h.bb > 0) return fmtBB(x / h.bb) + ' BB';
  const n = Math.round(x * 100) / 100, s = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (n < 0 ? '−' : '') + (h.game === 'cash' ? '$' : '') + s;
}
const lgSigned = (x, h) => (x > 0 ? '+' : '') + lgAmt(x, h);

/* ---------- replay the action to get pots and sizes ---------- */
function lgReplay(h) {
  let pot = +h.ante || 0; const out = {}, put = { hero: 0 }, folded = new Set();
  const actors = [{ id: 'hero', pos: h.hero.pos }, ...h.players.map(p => ({ id: p.pid, pos: p.pos }))];
  for (const [st] of LG_STREETS) {
    const inS = {}; let bet = 0; const rows = [];
    if (st === 'pre') {
      for (const [pos, amt] of [['SB', +h.sb || 0], ['BB', +h.bb || 0]]) {
        const a = actors.find(x => x.pos === pos); pot += amt; bet = Math.max(bet, amt);
        if (a) { inS[a.id] = amt; put[a.id] = (put[a.id] || 0) + amt; }
      }
    }
    const startPot = pot;
    for (const a of (h.streets[st] || [])) {
      const cur = inS[a.who] || 0, potBefore = pot; let add = 0, to = cur, pct = null, x = null;
      if (a.act === 'call') { add = Math.max(0, bet - cur); to = cur + add; }
      else if (a.act === 'bet' || a.act === 'raise' || a.act === 'allin') {
        to = Math.max(+a.to || 0, cur); add = to - cur;
        if (bet === 0 || (st === 'pre' && bet <= (+h.bb || 0) && a.act === 'bet')) pct = potBefore > 0 ? add / potBefore : null;
        else if (bet > 0) x = to / bet;
      }
      if (a.act === 'fold') folded.add(a.who);
      pot += add; inS[a.who] = cur + add; put[a.who] = (put[a.who] || 0) + add; if (to > bet) bet = to;
      rows.push({ ...a, add, to, potBefore, pct, x, facing: bet });
    }
    out[st] = { rows, startPot, pot, bet };
  }
  return { streets: out, pot, put, folded };
}
const lgName = (h, who) => {
  if (who === 'hero') return 'You';
  if (String(who).startsWith('new:')) { const p = h.players.find(x => x.pid === who); return (p && (p.newName || '').trim()) || 'New player'; }
  return (lgPlayer(who) || { name: 'Removed player' }).name;
};
const lgPosOf = (h, who) => who === 'hero' ? h.hero.pos : ((h.players.find(p => p.pid === who) || {}).pos || '');
function lgSizeTxt(r, h) {
  if (r.pct != null) return `${Math.round(r.pct * 100)}% pot`;
  if (r.x != null) return `${(Math.round(r.x * 10) / 10)}x`;
  return '';
}
function lgActTxt(r, h) {
  const n = lgName(h, r.who), p = lgPosOf(h, r.who), who = `<b>${esc(n)}</b>${p ? ` <span class="muted">(${p})</span>` : ''}`;
  const sz = lgSizeTxt(r, h), tag = sz ? ` <span class="lg-size">${sz}</span>` : '';
  switch (r.act) {
    case 'fold': return `${who} folds`;
    case 'check': return `${who} checks`;
    case 'call': return `${who} calls ${lgAmt(r.add, h)}`;
    case 'bet': return `${who} bets ${lgAmt(r.to, h)}${tag}`;
    case 'raise': return `${who} raises to ${lgAmt(r.to, h)}${tag}`;
    case 'allin': return `${who} goes all-in for ${lgAmt(r.to, h)}${tag}`;
  }
  return who;
}

/* ---------- card picker ---------- */
let lgPickCb = null;
function lgPick(used, cb) {
  lgPickCb = cb; const d = $('lg-cards');
  $('lg-cards-grid').innerHTML = [0, 1, 2, 3].map(s => `<div class="lg-suit">${[...R].reverse().map((r, i) => {
    const c = (12 - i) * 4 + s; return `<button type="button" data-c="${c}" class="${isRed(c) ? 'red' : ''}" ${used.includes(c) ? 'disabled' : ''} aria-label="${rankTxt(12 - i)} of ${['spades', 'hearts', 'diamonds', 'clubs'][s]}">${rankTxt(12 - i)}${SYM[s]}</button>`;
  }).join('')}</div>`).join('');
  d.showModal();
}
$('lg-cards-grid').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; $('lg-cards').close(); if (lgPickCb) lgPickCb(+b.dataset.c); });
$('lg-cards-clear').onclick = () => { $('lg-cards').close(); if (lgPickCb) lgPickCb(null); };
function lgUsed(h) { return [...h.hero.cards, ...h.board, ...h.players.flatMap(p => p.cards || [])].filter(c => c != null); }
const lgSlot = (c, key) => `<button type="button" class="lg-slot" data-slot="${key}" aria-label="${c == null ? 'Choose a card' : 'Change card'}">${c == null ? '<span class="card empty sm"></span>' : cardHTML(c, 'sm')}</button>`;

/* ---------- top-level render ---------- */
function lgRender() {
  document.querySelectorAll('#lg-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === lg.tab));
  document.querySelectorAll('#lg-units button').forEach(b => b.setAttribute('aria-pressed', (cfg.units === 'bb') === (b.dataset.u === 'bb')));
  const el = $('lg-body');
  if (lg.screen === 'edit') return lgEditor(el);
  if (lg.screen === 'hand') return lgHandPage(el);
  if (lg.screen === 'player') return lgPlayerPage(el);
  return lg.tab === 'players' ? lgPlayersList(el) : lgHandsList(el);
}
$('lg-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; lg = { ...lg, tab: b.dataset.tab, screen: 'list', id: null }; lgRender(); });
$('lg-units').addEventListener('click', e => {
  const b = e.target.closest('[data-u]'); if (!b) return; cfg.units = b.dataset.u;
  try { localStorage.setItem(CFGKEY, JSON.stringify(cfg)); } catch (err) {} lgRender();
});
$('lg-new').onclick = () => lgOpenEditor(null);
function lgGo(screen, id) { lg = { ...lg, screen, id, confirm: null }; lgRender(); window.scrollTo(0, 0); }

/* ---------- hands list ---------- */
function lgHandRow(h) {
  const r = lgReplay(h), names = h.players.map(p => lgName(h, p.pid)).join(', ');
  const net = h.net == null || h.net === '' ? '' : `<b class="${+h.net >= 0 ? 'good' : 'bad'}">${lgSigned(+h.net, h)}</b>`;
  return `<button type="button" class="rp-item" data-hand="${h.id}">
    <span class="cards">${h.hero.cards.length ? cardsHTML(h.hero.cards, 'sm') : '<span class="card empty sm"></span><span class="card empty sm"></span>'}</span>
    <span><b>${esc(h.hero.pos || '?')} · ${h.game === 'cash' ? 'Cash' : 'Tournament'} ${lgAmt(+h.sb, h)}/${lgAmt(+h.bb, h)}</b>
      <small>${lgDate(h.date)}${h.where ? ' · ' + esc(h.where) : ''}${names ? ' · vs ' + esc(names) : ''} · pot ${lgAmt(r.pot, h)}</small></span>
    <span>${net}</span></button>`;
}
function lgHandsList(el) {
  const list = lgHands.filter(h => !lg.filter || h.players.some(p => p.pid === lg.filter)).sort((a, b) => (b.date + b.t) > (a.date + a.t) ? 1 : -1);
  const opts = `<option value="">All players</option>` + lgPlayers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}" ${p.id === lg.filter ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const tot = list.reduce((a, h) => a + (+h.net || 0), 0), sameUnits = list.length && list.every(h => h.game === list[0].game);
  el.innerHTML = `<div class="panel">
    <div class="row" style="justify-content:space-between"><h2 class="ph">Your hands</h2>
      ${lgPlayers.length ? `<label class="field inline" for="lg-filter"><span>Played with</span><select id="lg-filter">${opts}</select></label>` : ''}</div>
    ${list.length ? `<p class="small muted">${list.length} hand${list.length === 1 ? '' : 's'}${sameUnits && cfg.units !== 'bb' ? ` · net ${lgSigned(tot, list[0])}` : ''}</p>
      <div class="rp-list" style="max-height:none">${list.map(lgHandRow).join('')}</div>`
      : `<p class="small muted">${lgHands.length ? 'No hands with that player yet.' : 'No hands logged yet. Choose <b>Log a hand</b> after a hand you want to remember: a big pot, a tough spot, or a hand against a regular.'}</p>`}
  </div>`;
  const f = $('lg-filter'); if (f) f.onchange = () => { lg.filter = f.value; lgRender(); };
}
$('lg-body').addEventListener('click', e => {
  const h = e.target.closest('[data-hand]'); if (h) { lgGo('hand', h.dataset.hand); return; }
  const p = e.target.closest('[data-player]'); if (p) { lg.tab = 'players'; lgGo('player', p.dataset.player); }
});

/* ---------- one hand ---------- */
function lgHandPage(el) {
  const h = lgHands.find(x => x.id === lg.id); if (!h) return lgGo('list');
  const r = lgReplay(h);
  const streets = LG_STREETS.map(([st, label, n], i) => {
    const s = r.streets[st], board = i === 0 ? [] : h.board.slice(0, [0, 3, 4, 5][i]);
    if (!s.rows.length && (i === 0 || board.slice(-n).every(c => c == null))) return '';
    return `<div class="lg-street"><h3>${label} <span class="muted">· pot ${lgAmt(s.startPot, h)}</span></h3>
      ${i ? `<div class="cards">${board.map(c => cardHTML(c, 'sm')).join('')}</div>` : ''}
      ${s.rows.length ? `<ol class="lg-acts">${s.rows.map(x => `<li>${lgActTxt(x, h)}</li>`).join('')}</ol>` : '<p class="small muted">No action logged.</p>'}</div>`;
  }).join('');
  const shown = h.players.filter(p => (p.cards || []).some(c => c != null));
  el.innerHTML = `<div class="panel">
    <div class="row"><button type="button" class="linkbtn" id="lg-back">← All hands</button></div>
    <div class="lg-head">
      <div class="cards">${h.hero.cards.length ? cardsHTML(h.hero.cards) : ''}</div>
      <div><h2 class="ph">${esc(h.hero.pos || '')} · ${h.game === 'cash' ? 'Cash' : 'Tournament'} ${lgAmt(+h.sb, h)}/${lgAmt(+h.bb, h)}${+h.ante ? ` (ante ${lgAmt(+h.ante, h)})` : ''}</h2>
        <p class="small muted">${lgDate(h.date)}${h.where ? ' · ' + esc(h.where) : ''}${h.hero.stack ? ` · your stack ${lgAmt(+h.hero.stack, h)}` : ''}</p></div>
      ${h.net !== '' && h.net != null ? `<div class="lg-net ${+h.net >= 0 ? 'good' : 'bad'}">${lgSigned(+h.net, h)}</div>` : ''}
    </div>
    ${h.players.length ? `<div class="lg-chips">${h.players.map(p => { const pl = lgPlayer(p.pid);
      return `<button type="button" class="lg-chip" data-player="${p.pid}"><b>${esc(pl ? pl.name : 'Removed player')}</b> ${p.pos || ''}${p.stack ? ' · ' + lgAmt(+p.stack, h) : ''}${pl && pl.style && pl.style !== 'Unknown' ? `<small>${esc(pl.style)}</small>` : ''}</button>`; }).join('')}</div>` : ''}
    ${streets}
    ${shown.length ? `<div class="lg-street"><h3>Showdown</h3>${shown.map(p => `<p><b>${esc(lgName(h, p.pid))}</b> showed <span class="cards" style="display:inline-flex;vertical-align:middle">${cardsHTML(p.cards.filter(c => c != null), 'sm')}</span></p>`).join('')}</div>` : ''}
    <p class="small"><b>Final pot ${lgAmt(r.pot, h)}</b> · you put in ${lgAmt(r.put.hero || 0, h)}</p>
    ${h.notes ? `<div class="lg-note">${esc(h.notes).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="row"><button type="button" class="act" id="lg-edit">Edit</button>
      <button type="button" class="act ghost" id="lg-del">${lg.confirm === h.id ? 'Tap again to delete' : 'Delete'}</button></div>
  </div>`;
  $('lg-back').onclick = () => lgGo('list');
  $('lg-edit').onclick = () => lgOpenEditor(h);
  $('lg-del').onclick = () => {
    if (lg.confirm !== h.id) { lg.confirm = h.id; lgRender(); return; }
    lgHands = lgHands.filter(x => x.id !== h.id); lgSaveHands(); lgGo('list');
  };
}

/* ---------- editor ---------- */
function lgOpenEditor(h) {
  lgDraft = h ? JSON.parse(JSON.stringify(h)) : {
    id: null, date: lgToday(), game: mode === 'cash' ? 'cash' : 'tour', sb: '', bb: '', ante: '', where: '',
    hero: { pos: 'BTN', stack: '', cards: [] }, players: [], board: [null, null, null, null, null],
    streets: { pre: [], flop: [], turn: [], river: [] }, net: '', notes: ''
  };
  if (!h) { const last = lgHands.slice().sort((a, b) => b.t - a.t)[0]; if (last) Object.assign(lgDraft, { game: last.game, sb: last.sb, bb: last.bb, ante: last.ante, where: last.where }); }
  lgGo('edit', h ? h.id : null);
}
const lgActors = d => [{ id: 'hero', pos: d.hero.pos }, ...d.players.filter(p => p.pid).map(p => ({ id: p.pid, pos: p.pos }))];
function lgNextActor(d, st) {
  const order = st === 'pre' ? LG_POS : LG_POST, folded = new Set();
  for (const s of ['pre', 'flop', 'turn', 'river']) { for (const a of d.streets[s]) if (a.act === 'fold') folded.add(a.who); if (s === st) break; }
  const live = lgActors(d).filter(a => !folded.has(a.id)).sort((a, b) => order.indexOf(a.pos) - order.indexOf(b.pos));
  if (!live.length) return 'hero';
  const acts = d.streets[st], last = acts[acts.length - 1];
  if (!last) return live[0].id;
  const i = live.findIndex(a => a.id === last.who); return live[(i + 1) % live.length].id;
}
function lgEditor(el) {
  const d = lgDraft, used = lgUsed(d);
  const posSel = (v, attr) => `<select ${attr}>${['', ...LG_POS].map(p => `<option value="${p}" ${p === v ? 'selected' : ''}>${p || 'Position'}</option>`).join('')}</select>`;
  const plOpts = v => `<option value="">Choose a player…</option>${lgPlayers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''} ${p.id !== v && d.players.some(x => x.pid === p.id) ? 'disabled' : ''}>${esc(p.name)}${p.style && p.style !== 'Unknown' ? ' · ' + esc(p.style) : ''}</option>`).join('')}<option value="new" ${v === 'new' ? 'selected' : ''}>+ New player…</option>`;
  const actors = lgActors(d), r = lgReplay(d);
  el.innerHTML = `<form id="lg-form" class="lg-form" novalidate>
  <div class="panel">
    <div class="row" style="justify-content:space-between"><h2 class="ph">${d.id ? 'Edit hand' : 'Log a hand'}</h2><button type="button" class="linkbtn" id="lg-cancel">Cancel</button></div>
    <div class="lg-grid">
      <label class="field" for="lg-date"><span>Date</span><input type="date" id="lg-date" value="${d.date}"></label>
      <div class="field"><span>Game</span><div class="seg" role="group" aria-label="Game"><button type="button" data-game="cash" aria-pressed="${d.game === 'cash'}">Cash</button><button type="button" data-game="tour" aria-pressed="${d.game !== 'cash'}">Tournament</button></div></div>
      <label class="field" for="lg-sb"><span>Small blind</span><input type="text" inputmode="decimal" id="lg-sb" value="${d.sb}" placeholder="50"></label>
      <label class="field" for="lg-bb"><span>Big blind</span><input type="text" inputmode="decimal" id="lg-bb" value="${d.bb}" placeholder="100"></label>
      <label class="field" for="lg-ante"><span>Ante, total (optional)</span><input type="text" inputmode="decimal" id="lg-ante" value="${d.ante}" placeholder="0"></label>
      <label class="field" for="lg-where"><span>Where</span><input type="text" id="lg-where" value="${esc(d.where)}" placeholder="Thursday league"></label>
    </div>
  </div>
  <div class="panel">
    <h2 class="ph">You</h2>
    <div class="lg-grid">
      <label class="field" for="lg-hpos"><span>Position</span>${posSel(d.hero.pos, 'id="lg-hpos"')}</label>
      <label class="field" for="lg-hstack"><span>Stack at the start</span><input type="text" inputmode="decimal" id="lg-hstack" value="${d.hero.stack}"></label>
      <div class="field"><span>Your cards</span><div class="cards">${lgSlot(d.hero.cards[0] ?? null, 'h0')}${lgSlot(d.hero.cards[1] ?? null, 'h1')}</div></div>
    </div>
  </div>
  <div class="panel">
    <h2 class="ph">Players in the hand</h2>
    <p class="small muted">Add the players who put money in. Folds before the flop don't need to be added.</p>
    <div class="lg-players">${d.players.map((p, i) => `<div class="lg-prow" data-i="${i}">
      <label class="field" for="lg-p${i}"><span>Player</span><select id="lg-p${i}" data-f="pid">${plOpts(String(p.pid).startsWith('new:') ? 'new' : p.pid)}</select></label>
      ${String(p.pid).startsWith('new:') ? `<label class="field" for="lg-pn${i}"><span>Name</span><input type="text" id="lg-pn${i}" data-f="newName" value="${esc(p.newName || '')}" placeholder="Bill"></label>
        <label class="field" for="lg-ps${i}"><span>Style</span><select id="lg-ps${i}" data-f="newStyle">${LG_STYLES.map(s => `<option ${s === p.newStyle ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
      <label class="field" for="lg-pp${i}"><span>Position</span>${posSel(p.pos, `id="lg-pp${i}" data-f="pos"`)}</label>
      <label class="field" for="lg-pk${i}"><span>Stack</span><input type="text" inputmode="decimal" id="lg-pk${i}" data-f="stack" value="${p.stack || ''}"></label>
      <div class="field"><span>Cards shown</span><div class="cards">${lgSlot((p.cards || [])[0] ?? null, `p${i}-0`)}${lgSlot((p.cards || [])[1] ?? null, `p${i}-1`)}</div></div>
      <button type="button" class="linkbtn lg-x" data-rmp="${i}" aria-label="Remove this player">Remove</button>
    </div>`).join('')}</div>
    <div class="row"><button type="button" class="act ghost" id="lg-addp">+ Add player</button></div>
  </div>
  <div class="panel">
    <h2 class="ph">Action</h2>
    <p class="small muted">Blinds are posted for you. Enter amounts in dollars or chips; for a bet or raise, enter the total for that street (a raise to 300 is 300). Calls work themselves out.</p>
    ${LG_STREETS.map(([st, label, n], si) => {
      const s = r.streets[st], bIdx = [[], [0, 1, 2], [3], [4]][si];
      return `<div class="lg-street"><h3>${label} <span class="muted">· pot <span data-pot="${st}">${lgAmt(s.startPot, d) || 0}</span></span></h3>
      ${bIdx.length ? `<div class="cards">${bIdx.map(k => lgSlot(d.board[k], 'b' + k)).join('')}</div>` : ''}
      <div class="lg-acts-edit">${d.streets[st].map((a, ai) => { const row = s.rows[ai] || {};
        return `<div class="lg-arow" data-st="${st}" data-ai="${ai}">
          <select data-a="who" aria-label="Who acted">${actors.map(x => `<option value="${x.id}" ${x.id === a.who ? 'selected' : ''}>${esc(lgName(d, x.id))}${x.pos ? ' (' + x.pos + ')' : ''}</option>`).join('')}</select>
          <select data-a="act" aria-label="Action">${LG_ACTS.map(([v, t]) => `<option value="${v}" ${v === a.act ? 'selected' : ''}>${t}</option>`).join('')}</select>
          ${['bet', 'raise', 'allin'].includes(a.act) ? `<input type="text" inputmode="decimal" data-a="to" value="${a.to ?? ''}" aria-label="Amount" placeholder="Amount">` : `<span class="small muted lg-auto">${a.act === 'call' ? lgAmt(row.add || 0, d) : ''}</span>`}
          <span class="lg-size">${lgSizeTxt(row, d)}</span>
          <button type="button" class="linkbtn lg-x" data-rma="${st}|${ai}" aria-label="Remove this action">✕</button>
        </div>`; }).join('')}</div>
      <button type="button" class="linkbtn" data-adda="${st}">+ Add ${label.toLowerCase()} action</button>
      </div>`;
    }).join('')}
    <p class="small"><b id="lg-endpot">Pot at the end: ${lgAmt(r.pot, d) || 0}</b> · you put in <span id="lg-putin">${lgAmt(r.put.hero || 0, d) || 0}</span></p>
  </div>
  <div class="panel">
    <h2 class="ph">Result</h2>
    <div class="lg-grid">
      <label class="field" for="lg-net"><span>You won or lost (use − for a loss)</span><input type="text" inputmode="decimal" id="lg-net" value="${d.net}"></label>
      <div class="field"><span>Fill in</span><div class="row"><button type="button" class="act ghost" id="lg-won">Won the pot (+${lgAmt(r.pot - (r.put.hero || 0), d) || 0})</button><button type="button" class="act ghost" id="lg-lost">Lost (−${lgAmt(r.put.hero || 0, d) || 0})</button></div></div>
    </div>
    <label class="field" for="lg-notes"><span>Notes</span><textarea id="lg-notes" rows="3" placeholder="What you were thinking, reads, what you'd do differently">${esc(d.notes)}</textarea></label>
    <p class="small bad" id="lg-err" role="alert"></p>
    <div class="row"><button type="submit" class="act">Save hand</button><button type="button" class="act ghost" id="lg-cancel2">Cancel</button></div>
  </div></form>`;
  lgWireEditor();
}
function lgCollect() {
  const d = lgDraft, v = id => $(id).value.trim();
  Object.assign(d, { date: v('lg-date') || lgToday(), sb: v('lg-sb'), bb: v('lg-bb'), ante: v('lg-ante'), where: v('lg-where'), net: v('lg-net'), notes: $('lg-notes').value });
  d.hero.pos = $('lg-hpos').value; d.hero.stack = v('lg-hstack');
  document.querySelectorAll('.lg-arow').forEach(row => { const a = d.streets[row.dataset.st][+row.dataset.ai];
    row.querySelectorAll('[data-a]').forEach(f => { a[f.dataset.a] = f.dataset.a === 'to' ? f.value.replace(/[^0-9.]/g, '') : f.value; }); });
  document.querySelectorAll('.lg-prow').forEach(row => { const p = d.players[+row.dataset.i];
    row.querySelectorAll('[data-f]').forEach(f => {
      if (f.dataset.f !== 'pid') { p[f.dataset.f] = f.value; return; }
      const old = p.pid, nv = f.value === 'new' ? (String(old).startsWith('new:') ? old : 'new:' + newId()) : f.value;
      if (nv !== old) for (const s in d.streets) d.streets[s].forEach(a => { if (a.who === old) a.who = nv; });
      p.pid = nv;
    }); });
}
const lgRedraw = () => { const y = window.scrollY; lgRender(); window.scrollTo(0, y); };
/* update pots, sizes and call amounts in place while typing, so the field being typed in isn't replaced */
function lgCalc() {
  const d = lgDraft, r = lgReplay(d);
  for (const [st] of LG_STREETS) {
    const s = r.streets[st], h = document.querySelector(`[data-pot="${st}"]`); if (h) h.textContent = lgAmt(s.startPot, d) || 0;
    document.querySelectorAll(`.lg-arow[data-st="${st}"]`).forEach(row => { const x = s.rows[+row.dataset.ai] || {};
      const sz = row.querySelector('.lg-size'); if (sz) sz.textContent = lgSizeTxt(x, d);
      const au = row.querySelector('.lg-auto'); if (au) au.textContent = x.act === 'call' ? lgAmt(x.add || 0, d) : ''; });
  }
  $('lg-endpot').textContent = `Pot at the end: ${lgAmt(r.pot, d) || 0}`; $('lg-putin').textContent = lgAmt(r.put.hero || 0, d) || 0;
  $('lg-won').textContent = `Won the pot (+${lgAmt(r.pot - (r.put.hero || 0), d) || 0})`; $('lg-lost').textContent = `Lost (−${lgAmt(r.put.hero || 0, d) || 0})`;
}
function lgWireEditor() {
  const d = lgDraft, form = $('lg-form');
  ['lg-cancel', 'lg-cancel2'].forEach(id => $(id).onclick = () => lgGo(d.id ? 'hand' : 'list', d.id));
  form.querySelectorAll('[data-game]').forEach(b => b.onclick = () => { lgCollect(); d.game = b.dataset.game; lgRedraw(); });
  /* structural changes redraw; typing in amounts updates sizes on change */
  form.addEventListener('change', e => { if (e.target.matches('select')) { lgCollect(); lgRedraw(); } });
  form.addEventListener('input', e => { if (e.target.matches('input[inputmode="decimal"]')) { lgCollect(); lgCalc(); } });
  $('lg-addp').onclick = () => { lgCollect(); const taken = new Set([d.hero.pos, ...d.players.map(p => p.pos)]);
    d.players.push({ pid: '', pos: LG_POS.find(p => !taken.has(p)) || '', stack: '', cards: [] }); lgRedraw(); };
  form.querySelectorAll('[data-rmp]').forEach(b => b.onclick = () => { lgCollect(); const p = d.players.splice(+b.dataset.rmp, 1)[0];
    for (const s in d.streets) d.streets[s] = d.streets[s].filter(a => a.who !== p.pid); lgRedraw(); });
  form.querySelectorAll('[data-adda]').forEach(b => b.onclick = () => { lgCollect(); const st = b.dataset.adda, r = lgReplay(d).streets[st];
    const who = lgNextActor(d, st), inS = r.rows.filter(x => x.who === who).reduce((a, x) => a + x.add, 0) + (st === 'pre' ? (lgPosOf(d, who) === 'BB' ? +d.bb || 0 : lgPosOf(d, who) === 'SB' ? +d.sb || 0 : 0) : 0);
    d.streets[st].push({ who, act: r.bet > inS ? 'call' : 'check', to: '' }); lgRedraw(); });
  form.querySelectorAll('[data-rma]').forEach(b => b.onclick = () => { lgCollect(); const [st, i] = b.dataset.rma.split('|'); d.streets[st].splice(+i, 1); lgRedraw(); });
  form.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { lgCollect(); const k = b.dataset.slot;
    lgPick(lgUsed(d), c => {
      if (k[0] === 'h') { const i = +k[1]; d.hero.cards[i] = c; d.hero.cards = d.hero.cards.slice(0, 2); if (c == null) d.hero.cards = d.hero.cards.filter(x => x != null); }
      else if (k[0] === 'b') d.board[+k.slice(1)] = c;
      else { const [pi, ci] = k.slice(1).split('-').map(Number); const p = d.players[pi]; p.cards = p.cards || []; p.cards[ci] = c; }
      const y = window.scrollY; lgRender(); window.scrollTo(0, y);
    }); });
  $('lg-won').onclick = () => { lgCollect(); const r = lgReplay(d); d.net = String(Math.round((r.pot - (r.put.hero || 0)) * 100) / 100); $('lg-net').value = d.net; };
  $('lg-lost').onclick = () => { lgCollect(); const r = lgReplay(d); d.net = String(-(Math.round((r.put.hero || 0) * 100) / 100)); $('lg-net').value = d.net; };
  form.onsubmit = e => {
    e.preventDefault(); lgCollect();
    const err = m => { $('lg-err').textContent = m; };
    if (!(+d.bb > 0)) return err('Enter the big blind so pot sizes can be worked out.');
    for (const p of d.players) {
      if (String(p.pid).startsWith('new:') && !(p.newName || '').trim()) return err('Give the new player a name, or remove that row.');
      if (!p.pid) return err('Choose a player for each row, or remove the empty row.');
    }
    /* create new players, then point their actions at the new ids */
    for (const p of d.players) if (String(p.pid).startsWith('new:')) {
      const name = p.newName.trim(), ex = lgPlayers.find(x => x.name.toLowerCase() === name.toLowerCase());
      const id = ex ? ex.id : newId();
      if (!ex) lgPlayers.push({ id, name, style: p.newStyle || 'Unknown', notes: [], t: Date.now() });
      for (const s in d.streets) d.streets[s].forEach(a => { if (a.who === p.pid) a.who = id; });
      p.pid = id; delete p.newName; delete p.newStyle;
    }
    lgSavePlayers();
    d.hero.cards = d.hero.cards.filter(c => c != null);
    for (const s in d.streets) d.streets[s] = d.streets[s].filter(a => a.who && a.act);
    if (!d.id) { d.id = newId(); d.t = Date.now(); lgHands.push(d); } else { const i = lgHands.findIndex(x => x.id === d.id); lgHands[i] = d; }
    lgSaveHands(); lgDraft = null; lgGo('hand', d.id);
  };
}

/* ---------- players ---------- */
function lgStats(pid) { const hs = lgHands.filter(h => h.players.some(p => p.pid === pid)); return { hs, n: hs.length }; }
function lgPlayersList(el) {
  const list = lgPlayers.slice().sort((a, b) => a.name.localeCompare(b.name));
  el.innerHTML = `<div class="panel">
    <div class="row" style="justify-content:space-between"><h2 class="ph">Players</h2><button type="button" class="act ghost" id="lg-addpl">+ Add player</button></div>
    <form id="lg-plnew" class="lg-grid" hidden>
      <label class="field" for="lg-nn"><span>Name</span><input type="text" id="lg-nn" placeholder="Bill"></label>
      <label class="field" for="lg-ns"><span>Style</span><select id="lg-ns">${LG_STYLES.map(s => `<option>${s}</option>`).join('')}</select></label>
      <div class="field"><span>&nbsp;</span><button type="submit" class="act">Save player</button></div>
    </form>
    ${list.length ? `<div class="rp-list" style="max-height:none">${list.map(p => { const s = lgStats(p.id), last = (p.notes || []).slice(-1)[0];
      return `<button type="button" class="rp-item" data-player="${p.id}"><span class="lg-av">${esc(p.name.trim()[0] || '?').toUpperCase()}</span>
        <span><b>${esc(p.name)}</b><small>${esc(p.style || 'Unknown')} · ${s.n} hand${s.n === 1 ? '' : 's'} · ${(p.notes || []).length} note${(p.notes || []).length === 1 ? '' : 's'}${last ? ' · “' + esc(last.text.slice(0, 50)) + (last.text.length > 50 ? '…' : '') + '”' : ''}</small></span></button>`; }).join('')}</div>`
      : '<p class="small muted">No players yet. Add the people you play with, or add them while logging a hand.</p>'}
  </div>`;
  $('lg-addpl').onclick = () => { $('lg-plnew').hidden = false; $('lg-nn').focus(); };
  $('lg-plnew').onsubmit = e => { e.preventDefault(); const name = $('lg-nn').value.trim(); if (!name) return;
    lgPlayers.push({ id: newId(), name, style: $('lg-ns').value, notes: [], t: Date.now() }); lgSavePlayers(); lgRender(); };
}
function lgPlayerPage(el) {
  const p = lgPlayer(lg.id); if (!p) return lgGo('list');
  const { hs } = lgStats(p.id), sorted = hs.slice().sort((a, b) => (b.date + b.t) > (a.date + a.t) ? 1 : -1);
  const notes = (p.notes || []).slice().reverse();
  el.innerHTML = `<div class="panel">
    <div class="row"><button type="button" class="linkbtn" id="lg-pback">← All players</button></div>
    <div class="lg-grid">
      <label class="field" for="lg-pname"><span>Name</span><input type="text" id="lg-pname" value="${esc(p.name)}"></label>
      <label class="field" for="lg-pstyle"><span>Style</span><select id="lg-pstyle">${LG_STYLES.map(s => `<option ${s === p.style ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    </div>
    <h3>Notes</h3>
    <form id="lg-noteform" class="lg-noteform"><label class="field" for="lg-note"><span>Add a note</span><textarea id="lg-note" rows="2" placeholder="Opens wide on the button, folds to 3-bets"></textarea></label>
      <div class="row"><button type="submit" class="act">Add note</button></div></form>
    ${notes.length ? `<ul class="lg-notes">${notes.map(n => `<li><span class="small muted">${lgDate(n.d)}</span><p>${esc(n.text).replace(/\n/g, '<br>')}</p><button type="button" class="linkbtn lg-x" data-rmn="${n.id}">Delete</button></li>`).join('')}</ul>` : '<p class="small muted">No notes yet.</p>'}
    <h3>Hands with ${esc(p.name)}</h3>
    ${sorted.length ? `<div class="rp-list" style="max-height:none">${sorted.map(lgHandRow).join('')}</div>` : '<p class="small muted">No logged hands with this player yet.</p>'}
    <div class="row"><button type="button" class="act ghost" id="lg-pdel">${lg.confirm === p.id ? 'Tap again to delete this player' : 'Delete player'}</button></div>
  </div>`;
  $('lg-pback').onclick = () => lgGo('list');
  $('lg-pname').onchange = () => { const v = $('lg-pname').value.trim(); if (v) { p.name = v; lgSavePlayers(); } };
  $('lg-pstyle').onchange = () => { p.style = $('lg-pstyle').value; lgSavePlayers(); };
  $('lg-noteform').onsubmit = e => { e.preventDefault(); const t = $('lg-note').value.trim(); if (!t) return;
    (p.notes = p.notes || []).push({ id: newId(), d: lgToday(), text: t }); lgSavePlayers(); lgRender(); };
  el.querySelectorAll('[data-rmn]').forEach(b => b.onclick = () => { p.notes = p.notes.filter(n => n.id !== b.dataset.rmn); lgSavePlayers(); lgRender(); });
  $('lg-pdel').onclick = () => {
    if (lg.confirm !== p.id) { lg.confirm = p.id; lgRender(); return; }
    lgPlayers = lgPlayers.filter(x => x.id !== p.id); lgSavePlayers(); lgGo('list');
  };
}
function lgInit() { lgRender(); }
