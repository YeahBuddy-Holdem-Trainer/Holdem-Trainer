/* ---------- accounts and cloud saving (Firebase) ----------
   Sign-in: Google or email and password. Firebase keeps people signed in on a device until they sign out.
   Storage layout in Firestore, all under users/{uid}/ so the rules can keep each person to their own data:
     days/{yyyy-mm-dd}   one document per day holding that day's answers (few reads, few writes)
     state/{key}         saved ranges, hands, daily progress, stats and settings, one document each
   The device copy (localStorage) stays the working copy; this file uploads changes and downloads
   what other devices saved. If sign-in isn't configured yet, the app simply runs on this device. */
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.14.0/';
const SYNC_KEYS = ['holdem-odds-trainer-v1', 'holdem-ranges-v1', 'holdem-hands-v1', 'holdem-daily-v1', 'holdem-odds-cfg-v1', 'holdem-log-v1', 'holdem-players-v1'];
const DEVICE_KEYS = ['holdem-odds-log-v1', 'holdem-odds-session-v1', 'holdem-last-view', 'holdem-last-pull'];
const OWNER = 'holdem-owner', PULL = 'holdem-last-pull', GUEST_OK = 'holdem-guest-ok';

const $ = id => document.getElementById(id);
const cloud = window.cloud = { user: null, enabled: false };
const rawSet = Storage.prototype.setItem;
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { rawSet.call(localStorage, k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- account dialog ---------- */
const dlg = $('acct');
let signUp = false;
window.openAccount = () => { renderAccount(); if (!dlg.open) dlg.showModal(); };
$('acct-btn').onclick = window.openAccount;
function msg(t, cls) { const m = $('au-msg'); m.textContent = t || ''; m.className = 'small ' + (cls || ''); }
function setTab(up) {
  signUp = up;
  $('au-tab-in').setAttribute('aria-pressed', !up); $('au-tab-up').setAttribute('aria-pressed', up);
  $('au-name-wrap').hidden = !up; $('au-forgot').hidden = up;
  $('au-pass').autocomplete = up ? 'new-password' : 'current-password';
  $('au-submit').textContent = up ? 'Create account' : 'Sign in'; msg('');
}
$('au-tab-in').onclick = () => setTab(false);
$('au-tab-up').onclick = () => setTab(true);
$('au-guest').onclick = () => { ls.set(GUEST_OK, '1'); dlg.close(); };

function renderAccount() {
  const u = cloud.user;
  $('acct-off').hidden = cloud.enabled;
  $('acct-out').hidden = !cloud.enabled || !!u;
  $('acct-in').hidden = !cloud.enabled || !u;
  if (u) {
    $('acct-email').textContent = u.email || 'Signed in with Google';
    $('acct-name').value = (typeof cfg !== 'undefined' && cfg.player) || u.displayName || '';
  }
}
function renderButton() {
  const b = $('acct-btn'), u = cloud.user;
  if (u) {
    const nm = (typeof cfg !== 'undefined' && cfg.player) || u.displayName || u.email || '?';
    b.innerHTML = `<span class="av">${nm.trim()[0].toUpperCase()}</span>`;
    b.setAttribute('aria-label', 'Account: ' + (u.email || nm));
  } else {
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="lbl">Sign in</span>';
    b.setAttribute('aria-label', 'Sign in');
  }
  const who = $('pg-who');
  if (who) who.textContent = !cloud.enabled ? 'Sign-in is not set up yet, so everything is saved on this device only.'
    : u ? `Signed in as ${u.email || nm(u)}. Your training is saved to your account.` : 'Not signed in. Your training is saved on this device only.';
  if (typeof updateQ === 'function') updateQ();
}
const nm = u => u.displayName || 'your Google account';

/* ---------- start ---------- */
const configured = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE');
if (!configured) { renderButton(); }
else start().catch(e => {
  console.error(e); cloud.enabled = false; renderButton();
  const off = $('acct-off'); if (off) off.innerHTML = '<h2>Couldn\'t reach sign-in</h2><p class="small">The sign-in service didn\'t load (' + (e && (e.code || e.message) || 'unknown error') + '). Check your connection and reload. Until then everything is saved on this device.</p>';
});

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app), db = F.getFirestore(app);
  cloud.enabled = true;
  const ref = (...p) => F.doc(db, 'users', cloud.user.uid, ...p);
  const col = name => F.collection(db, 'users', cloud.user.uid, name);

  /* ---- uploads ---- */
  const dirty = new Set(); let stTimer = null, suppress = false;
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === localStorage && !suppress && cloud.user && SYNC_KEYS.includes(k)) {
      dirty.add(k); clearTimeout(stTimer); stTimer = setTimeout(pushState, 4000);
    }
  };
  async function pushState() {
    if (!cloud.user || !dirty.size) return;
    const keys = [...dirty]; dirty.clear();
    try {
      await Promise.all(keys.map(k => {
        const v = ls.get(k);
        if (v == null) return F.deleteDoc(ref('state', k));
        if (v.length > 900000) { console.warn('Too large to save to the account:', k); return null; }
        return F.setDoc(ref('state', k), { v, t: F.serverTimestamp() });
      }));
    } catch (e) { keys.forEach(k => dirty.add(k)); console.warn(e); }
  }
  const dayOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  cloud.pushEvents = async batch => {
    const byDay = new Map();
    for (const r of batch) { const k = dayOf(r.ts || Date.now()); if (!byDay.has(k)) byDay.set(k, []); const { player, ...rest } = r; byDay.get(k).push(rest); }
    await Promise.all([...byDay].map(([day, evs]) =>
      F.setDoc(ref('days', day), { events: F.arrayUnion(...evs), t: F.serverTimestamp() }, { merge: true })));
  };

  /* ---- downloads: only documents changed since the last download ---- */
  async function pull() {
    const last = +(ls.get(PULL) || 0), since = F.Timestamp.fromMillis(last);
    const [st, dy] = await Promise.all([
      F.getDocs(F.query(col('state'), F.where('t', '>', since))),
      F.getDocs(F.query(col('days'), F.where('t', '>', since)))]);
    let maxT = last, changed = false; const seen = new Set();
    st.forEach(d => {
      const x = d.data(); seen.add(d.id); maxT = Math.max(maxT, x.t ? x.t.toMillis() : 0);
      if (dirty.has(d.id) || ls.get(d.id) === x.v) return;
      suppress = true; ls.set(d.id, x.v); suppress = false; changed = true;
    });
    const evs = []; dy.forEach(d => { const x = d.data(); maxT = Math.max(maxT, x.t ? x.t.toMillis() : 0); evs.push(...(x.events || [])); });
    if (evs.length && typeof mergeEvents === 'function') mergeEvents(evs);
    ls.set(PULL, String(maxT));
    return { changed, seen };
  }
  function clearDevice() { [...SYNC_KEYS, ...DEVICE_KEYS].forEach(ls.del); }
  async function flush() { clearTimeout(stTimer); await pushState(); if (typeof sync === 'function') await sync(); }
  cloud.flush = flush;
  window.addEventListener('pagehide', () => { pushState(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushState(); });

  /* ---- who is signed in ---- */
  A.onAuthStateChanged(auth, async u => {
    const owner = ls.get(OWNER) || 'guest';
    if (u) {
      cloud.user = u;
      if (owner !== 'guest' && owner !== u.uid) {          /* someone else's data is on this device */
        clearDevice(); ls.set(OWNER, u.uid); await pull(); location.reload(); return;
      }
      if (owner === 'guest') {                             /* first sign-in here: keep what was done signed out */
        ls.set(OWNER, u.uid); ls.del(PULL);
        const { changed, seen } = await pull();
        SYNC_KEYS.forEach(k => { if (!seen.has(k) && ls.get(k) != null) dirty.add(k); });
        if (!cfg.player && u.displayName) { cfg.player = u.displayName.split(' ')[0]; localStorage.setItem('holdem-odds-cfg-v1', JSON.stringify(cfg)); }
        await flush();
        if (changed) { location.reload(); return; }
      } else {
        const { changed } = await pull();
        sync();
        if (changed) { location.reload(); return; }
      }
      if (dlg.open) dlg.close();
    } else {
      cloud.user = null;
      if (owner !== 'guest') { clearDevice(); ls.set(OWNER, 'guest'); location.reload(); return; }
      if (!ls.get(GUEST_OK)) window.openAccount();
    }
    renderButton(); renderAccount();
    if (typeof homeRender === 'function' && currentView === 'daily') homeRender();
  });

  /* ---- sign-in actions ---- */
  const friendly = e => ({
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/missing-password': 'Enter a password.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/email-already-in-use': 'There is already an account with that email. Choose Sign in instead.',
    'auth/invalid-credential': 'The email or password is wrong.',
    'auth/wrong-password': 'The email or password is wrong.',
    'auth/user-not-found': 'No account uses that email. Choose Create account.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes, or reset your password.',
    'auth/network-request-failed': 'Can\'t reach the server. Check your connection.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/unauthorized-domain': 'This web address isn\'t allowed to sign in yet. Add it under Authentication > Settings > Authorized domains in Firebase.'
  }[e.code] || 'Something went wrong: ' + (e.code || e.message));

  $('au-google').onclick = async () => {
    msg('Opening Google…');
    const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await A.signInWithPopup(auth, p); msg(''); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, p);
      msg(friendly(e), 'bad');
    }
  };
  $('au-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('au-email').value.trim(), pass = $('au-pass').value, name = $('au-name').value.trim();
    $('au-submit').disabled = true; msg(signUp ? 'Creating your account…' : 'Signing in…');
    try {
      if (signUp) {
        const c = await A.createUserWithEmailAndPassword(auth, email, pass);
        if (name) { await A.updateProfile(c.user, { displayName: name }); cfg.player = name.split(' ')[0]; localStorage.setItem('holdem-odds-cfg-v1', JSON.stringify(cfg)); }
      } else await A.signInWithEmailAndPassword(auth, email, pass);
      msg('');
    } catch (err) { msg(friendly(err), 'bad'); }
    $('au-submit').disabled = false;
  });
  $('au-forgot').onclick = async () => {
    const email = $('au-email').value.trim();
    if (!email) { msg('Type your email above first, then choose Forgot password.', 'bad'); return; }
    try { await A.sendPasswordResetEmail(auth, email); msg('Check your email for a link to set a new password.', 'good'); }
    catch (e) { msg(friendly(e), 'bad'); }
  };
  $('acct-save-name').onclick = () => {
    cfg.player = $('acct-name').value.trim(); localStorage.setItem('holdem-odds-cfg-v1', JSON.stringify(cfg));
    renderButton(); if (typeof homeRender === 'function') homeRender(); $('acct-name-msg').textContent = 'Saved.';
  };
  $('acct-signout').onclick = async () => {
    $('acct-signout').disabled = true; $('acct-signout').textContent = 'Saving and signing out…';
    try { await flush(); } catch (e) {}
    await A.signOut(auth);
  };
}
