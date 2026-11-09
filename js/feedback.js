/* ---------- answer explanations in a pop-up ----------
   Each trainer still writes its feedback into its own box (po-out, cf-out, ...). This file watches those
   boxes. When an answer lands, the box is replaced on the page by a short result line, and the full
   explanation moves into a pop-up: it opens by itself when the answer is wrong, and from "Why?" when right. */
const FB_BOXES = {
  'po-out': '#po-next', 'cf-out': '#cf-next', 'mu-out': '#mu-next', 'pf-out': '#pf-acts [data-next]',
  'sz-out': '#sz-acts [data-znext]', 'hvr-out': '#hvr-next', 'cb-out': '#cb-next', 'tx-out': '#tx-next', 'rvr-out': '#rvr-next', 'dl-fb': '#dl-next', 'rb-test-out': null, 'fh-out': null
};
const fbDlg = $('fb-dlg'), fbBody = $('fb-body');
let fbOpenId = null;

function fbOpen(id) {
  const box = $(id); if (!box) return;
  if (fbOpenId && fbOpenId !== id) fbClose();
  fbOpenId = id; fbBody.appendChild(box); box.classList.add('fb-show');
  const nextSel = FB_BOXES[id], nx = nextSel && document.querySelector(nextSel);
  $('fb-next').hidden = !nx || nx.hidden || nx.disabled;
  $('fb-next').textContent = nx ? (nx.textContent.trim() || 'Next') : 'Next';
  if (!fbDlg.open) fbDlg.showModal();
}
function fbClose() {
  if (!fbOpenId) return;
  const box = $(fbOpenId), wrap = document.querySelector(`.fb-wrap[data-for="${fbOpenId}"]`);
  if (box && wrap) { box.classList.remove('fb-show'); wrap.appendChild(box); }
  fbOpenId = null; if (fbDlg.open) fbDlg.close();
}
fbDlg.addEventListener('close', fbClose);
$('fb-close').onclick = () => fbDlg.close();
$('fb-next').onclick = () => {
  const sel = FB_BOXES[fbOpenId], nx = sel && document.querySelector(sel);
  fbDlg.close(); if (nx) nx.click();
};

function fbUpdate(id) {
  const box = $(id), wrap = document.querySelector(`.fb-wrap[data-for="${id}"]`), chip = wrap && wrap.querySelector('.fb-chip');
  if (!box || !chip) return;
  const v = box.querySelector('.verdict');
  if (!v) {                                   /* no answer yet: show the box's own hint text in place */
    chip.hidden = true; wrap.classList.remove('fb-on');
    if (fbOpenId === id) fbClose();
    return;
  }
  const good = v.classList.contains('good'), bad = v.classList.contains('bad');
  const title = (v.querySelector('strong') || v).textContent.trim();
  chip.className = 'fb-chip ' + (good ? 'good' : bad ? 'bad' : '');
  chip.querySelector('.fb-t').textContent = (good ? '✓ ' : bad ? '✗ ' : '') + title;
  chip.hidden = false; wrap.classList.add('fb-on');
  if (bad && fbOpenId !== id && !box.closest('[hidden]')) fbOpen(id);
  else if (fbOpenId === id) fbOpen(id);    /* refresh the Next button */
}

for (const id of Object.keys(FB_BOXES)) {
  const box = $(id); if (!box) continue;
  const wrap = document.createElement('div'); wrap.className = 'fb-wrap'; wrap.dataset.for = id;
  wrap.innerHTML = `<div class="fb-chip" hidden><span class="fb-t"></span><button type="button" class="linkbtn">See why</button></div>`;
  box.parentNode.insertBefore(wrap, box); wrap.appendChild(box);
  wrap.querySelector('button').onclick = () => fbOpen(id);
  new MutationObserver(() => fbUpdate(id)).observe(box, { childList: true, subtree: true, characterData: true });
  fbUpdate(id);
}
