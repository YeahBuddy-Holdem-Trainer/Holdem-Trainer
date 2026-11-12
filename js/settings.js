/* ---------- settings, app-wide clock settings, and the action clock ----------
   APPCFG holds the clock settings an admin sets for everyone (Firestore doc config/app, readable by all,
   writable only by admins). The last copy is cached on this device so the clocks work offline.
   The action clock: a shot clock for each decision, then an optional time bank shared across a lesson
   or a hand. Used by Master-level lessons and, when switched on, by the full-hand trainer. */
const APPCFG_KEY = 'holdem-appcfg-v1';
const APPCFG_DEF = { shot: 20, bankOn: false, bank: 30, fhOn: false, fhShot: 30 };
const APPCFG_LIM = { shot: [5, 120], bank: [5, 300], fhShot: [5, 180] };
let APPCFG = (() => { try { return { ...APPCFG_DEF, ...JSON.parse(localStorage.getItem(APPCFG_KEY)) }; } catch (e) { return { ...APPCFG_DEF }; } })();
function appCfgClean(c) {
  const o = { ...APPCFG_DEF };
  for (const k of Object.keys(APPCFG_DEF)) if (c && c[k] != null) o[k] = typeof APPCFG_DEF[k] === 'boolean' ? !!c[k] : Math.round(+c[k]) || APPCFG_DEF[k];
  for (const [k, [lo, hi]] of Object.entries(APPCFG_LIM)) o[k] = Math.min(hi, Math.max(lo, o[k]));
  return o;
}
function appCfgApply(c) {
  APPCFG = appCfgClean(c);
  try { localStorage.setItem(APPCFG_KEY, JSON.stringify(APPCFG)); } catch (e) {}
  if ($('set-dlg') && $('set-dlg').open) setRender();
}
APPCFG = appCfgClean(APPCFG);
window.addEventListener('appcfg', e => appCfgApply(e.detail));
if (window.__appcfg) appCfgApply(window.__appcfg);

/* ---------- action clock ---------- */
const CLK = { raf: 0, stop: null };
/* host: element to draw in; shot: seconds; bank: { left } shared object or null; onOut: called when time runs out */
function startClock(host, shot, bank, onOut) {
  stopClock(); if (!host) return;
  host.innerHTML = `<div class="act-clock" role="timer" aria-live="off"><div class="act-clock-bar"><i></i></div><span></span></div>`;
  const box = host.firstChild, bar = box.querySelector('i'), lab = box.querySelector('span');
  let phase = 'shot', t0 = performance.now(), dur = shot * 1000;
  const label = left => phase === 'bank' ? `Time bank ${Math.ceil(left / 1000)}s` : `${Math.ceil(left / 1000)}s${bank && bank.left > 0 ? ` <small>· bank ${Math.round(bank.left)}s</small>` : ''}`;
  const tick = () => {
    const left = dur - (performance.now() - t0);
    if (left <= 0) {
      if (phase === 'shot' && bank && bank.left > 0) { phase = 'bank'; t0 = performance.now(); dur = bank.left * 1000; box.classList.add('bank'); CLK.raf = requestAnimationFrame(tick); return; }
      if (phase === 'bank') bank.left = 0;
      CLK.stop = null; box.classList.add('out'); lab.textContent = 'Time'; bar.style.transform = 'scaleX(0)'; onOut(); return;
    }
    bar.style.transform = `scaleX(${left / dur})`; lab.innerHTML = label(left);
    box.classList.toggle('low', phase === 'shot' && left < 5000 && !(bank && bank.left > 0));
    CLK.raf = requestAnimationFrame(tick);
  };
  CLK.stop = () => { cancelAnimationFrame(CLK.raf); if (phase === 'bank') bank.left = Math.max(0, (dur - (performance.now() - t0)) / 1000); };
  tick();
}
function stopClock() { if (CLK.stop) { CLK.stop(); CLK.stop = null; } cancelAnimationFrame(CLK.raf); }

/* ---------- settings dialog ---------- */
function setRender() {
  const admin = !!(window.cloud && cloud.user && cloud.admin), c = APPCFG;
  $('set-units').querySelectorAll('[data-u]').forEach(b => b.setAttribute('aria-pressed', (cfg.units === 'bb') === (b.dataset.u === 'bb')));
  $('set-math').checked = !!cfg.showMath;
  $('set-goal').innerHTML = LN_GOALS.map(([v, t]) => `<option value="${v}"${v === lnGoal() ? ' selected' : ''}>${t}</option>`).join('');
  $('set-clock-sum').innerHTML = `Master-level lessons: <b>${c.shot} s</b> a question. Time bank: <b>${c.bankOn ? c.bank + ' s' : 'off'}</b>. Full hands clock: <b>${c.fhOn ? c.fhShot + ' s a decision' : 'off'}</b>.`;
  $('set-admin').hidden = !admin;
  if (admin) {
    $('set-shot').value = c.shot; $('set-bank-on').checked = c.bankOn; $('set-bank').value = c.bank; $('set-fh-on').checked = c.fhOn; $('set-fh').value = c.fhShot;
    $('set-bank').disabled = !c.bankOn; $('set-fh').disabled = !c.fhOn; $('set-msg').textContent = '';
  }
}
function openSettings() { if ($('acct').open) $('acct').close(); setRender(); $('set-dlg').showModal(); }
$('acct-settings').onclick = openSettings;
$('set-units').addEventListener('click', e => {
  const b = e.target.closest('[data-u]'); if (!b) return; cfg.units = b.dataset.u;
  try { localStorage.setItem(CFGKEY, JSON.stringify(cfg)); } catch (err) {}
  const t = document.querySelector('.units-tog'); if (t) t.outerHTML = unitsSeg();
  newPO(); newCF(); if (currentView === 'log') lgRender(); setRender();
});
$('set-math').onchange = e => { cfg.showMath = e.target.checked; delete cfg.hvrMath; try { localStorage.setItem(CFGKEY, JSON.stringify(cfg)); } catch (err) {}
  document.querySelectorAll('.math-always').forEach(x => x.checked = cfg.showMath); };
$('set-goal').onchange = e => { ln.goal = +e.target.value; lnSave(); lnMini(); if (currentView === 'learn' && !lnPlay) lnRender(); };
$('set-bank-on').onchange = e => { $('set-bank').disabled = !e.target.checked; };
$('set-fh-on').onchange = e => { $('set-fh').disabled = !e.target.checked; };
$('set-save').onclick = async () => {
  const c = appCfgClean({ shot: $('set-shot').value, bankOn: $('set-bank-on').checked, bank: $('set-bank').value, fhOn: $('set-fh-on').checked, fhShot: $('set-fh').value });
  $('set-save').disabled = true; $('set-msg').textContent = 'Saving…';
  try { await cloud.saveConfig(c); appCfgApply(c); $('set-msg').textContent = 'Saved. Everyone gets these settings next time they open the app.'; }
  catch (err) { console.warn(err); $('set-msg').textContent = 'Couldn\'t save. Check that the Firestore rules include the config section.'; }
  $('set-save').disabled = false;
};
$('set-reset').onclick = () => { const c = APPCFG_DEF; $('set-shot').value = c.shot; $('set-bank-on').checked = c.bankOn; $('set-bank').value = c.bank; $('set-fh-on').checked = c.fhOn; $('set-fh').value = c.fhShot; $('set-bank').disabled = !c.bankOn; $('set-fh').disabled = !c.fhOn; $('set-msg').textContent = 'Defaults filled in. Save to apply.'; };
$('set-flags').onclick = () => { $('set-dlg').close(); openFlags(); };
