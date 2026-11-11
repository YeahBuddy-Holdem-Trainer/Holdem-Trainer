/* ---------- flags: report a spot that looks wrong ----------
   "Flag this" (in the answer pop-ups and next to the trainer tabs) saves the current spot to a shared
   Firestore collection, flags/, with the player's note. Anyone signed in can send a flag; only admins
   (listed in admins/{uid}, set up by hand in the Firebase console) can read, resolve or delete them. */
const FLAG_STATE = { hand: 'fh', 'street-equity': 'se', hvr: 'hvr', rvr: 'rvr', texture: 'tx', reading: 'rd', pots: 'pt', exploit: 'xp', combos: 'cb', sizing: 'sz', 'call-or-fold': 'cf', 'pot-odds': 'po', matchups: 'mu', preflop: 'pf', daily: 'daily' };

function flagSnapshot() {
  const v = currentView, view = $('v-' + v), pops = [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'flag-dlg');
  const txt = el => el ? el.innerText.replace(/\n{3,}/g, '\n\n').trim() : '';
  let state = '';
  try { const g = FLAG_STATE[v] && window.eval(FLAG_STATE[v]);
    if (g) state = JSON.stringify(g, (k, x) => typeof x === 'function' ? undefined : x).slice(0, 11000); } catch (e) {}
  const text = (pops.map(txt).join('\n\n---\n\n') + '\n\n---\n\n' + txt(view && (view.querySelector('.stage') || view))).trim().slice(0, 7900);
  return { view: v, title: VIEW_LABEL[v] || v, game: mode === 'cash' ? 'Cash' : 'Tournament', text, state, version: APP_VERSION };
}
let flagSnap = null;
function openFlag() {
  flagSnap = flagSnapshot();
  $('flag-what').textContent = `${flagSnap.title} · ${flagSnap.game}`;
  const can = !!(window.cloud && cloud.user && cloud.sendFlag);
  $('flag-in').hidden = !can; $('flag-out').hidden = can;
  $('flag-msg').textContent = ''; $('flag-note').value = ''; $('flag-send').disabled = false;
  $('flag-dlg').showModal(); if (can) $('flag-note').focus();
}
document.addEventListener('click', e => { if (e.target.closest('.flag-btn')) openFlag(); });
$('flag-cancel').onclick = () => $('flag-dlg').close();
$('flag-signin').onclick = () => { $('flag-dlg').close(); window.openAccount && window.openAccount(); };
$('flag-send').onclick = async () => {
  const note = $('flag-note').value.trim(); if (!note) { $('flag-msg').textContent = 'Add a few words about what looks wrong.'; $('flag-note').focus(); return; }
  $('flag-send').disabled = true; $('flag-msg').textContent = 'Sending…';
  const name = (cfg.player || (cloud.user.displayName || '').split(' ')[0] || 'Player').slice(0, 40);
  try { await cloud.sendFlag({ ...flagSnap, note: note.slice(0, 1500), name }); $('flag-msg').textContent = 'Thanks, your flag was sent.'; setTimeout(() => $('flag-dlg').close(), 1200); }
  catch (err) { console.warn(err); $('flag-send').disabled = false; $('flag-msg').textContent = 'Couldn\'t send it. Check your connection and try again.'; }
};

/* ---------- review (admins) ---------- */
let flagsAll = [], flagsShow = 'open';
async function openFlags() {
  $('flags-list').innerHTML = '<p class="small muted">Loading…</p>'; $('flags-dlg').showModal();
  try { flagsAll = await cloud.listFlags(); flagsRender(); }
  catch (e) { $('flags-list').innerHTML = '<p class="small bad">Couldn\'t load flags. Check that the Firestore rules include the flags section and that your account is listed in admins.</p>'; }
}
function flagsRender() {
  document.querySelectorAll('#flags-filter [data-s]').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === flagsShow));
  const xs = flagsAll.filter(f => flagsShow === 'all' || (flagsShow === 'open' ? f.status !== 'done' : f.status === 'done'));
  $('flags-list').innerHTML = xs.length ? xs.map(f => `<details class="flag-item" data-id="${f.id}">
      <summary><b>${esc(f.title || f.view)}</b> <span class="muted small">${esc(f.game || '')} · ${f.ms ? new Date(f.ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''} · ${esc(f.name || 'Player')}${f.status === 'done' ? ' · resolved' : ''}</span><br><span class="small">${esc(f.note || '')}</span></summary>
      <pre class="flag-text">${esc(f.text || '')}</pre>
      ${f.state ? `<details><summary class="small">Technical details</summary><pre class="flag-text">${esc(f.state)}</pre></details>` : ''}
      <div class="row"><button class="act ghost" type="button" data-act="${f.status === 'done' ? 'open' : 'done'}">${f.status === 'done' ? 'Reopen' : 'Mark resolved'}</button><button class="linkbtn lg-x" type="button" data-act="del">Delete</button><button class="linkbtn" type="button" data-act="copy">Copy</button></div>
    </details>`).join('') : `<p class="small muted">No ${flagsShow === 'all' ? '' : flagsShow === 'open' ? 'open ' : 'resolved '}flags.</p>`;
}
$('flags-filter').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { flagsShow = b.dataset.s; flagsRender(); } });
$('flags-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const id = b.closest('[data-id]').dataset.id, f = flagsAll.find(x => x.id === id);
  if (b.dataset.act === 'copy') { try { await navigator.clipboard.writeText(`${f.title} · ${f.game}\nNote: ${f.note}\n\n${f.text}\n\n${f.state || ''}`); b.textContent = 'Copied'; } catch (err) {} return; }
  if (b.dataset.act === 'del') { if (b.textContent !== 'Tap again to delete') { b.textContent = 'Tap again to delete'; return; } await cloud.deleteFlag(id); flagsAll = flagsAll.filter(x => x.id !== id); return flagsRender(); }
  await cloud.setFlag(id, b.dataset.act); f.status = b.dataset.act; flagsRender();
});
$('acct-flags').onclick = () => { $('acct').close(); openFlags(); };
