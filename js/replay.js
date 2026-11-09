/* ---------- hand replayer ----------
   Steps through hands saved by full-hand practice (last 50, this device).
   Each log line holds a snapshot (pot, stacks, bets, board), so any step can be drawn on the table.
   Decisions are attached to the log line of the action you took. */
let rpHands=[],rpCur=null,rpStep=0,rpShowVil=false;
function rpLoad(){try{rpHands=(JSON.parse(localStorage.getItem(FHKEY))||[]).slice().reverse()}catch(e){rpHands=[]}}
const rpWhen=ts=>{const d=new Date(ts);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
function rpList(){rpLoad();const only=$('rp-miss').checked,el=$('rp-list');
  const list=rpHands.map((h,i)=>({h,i})).filter(({h})=>!only||h.dec.some(d=>!d.ok));
  if(!rpHands.length){el.innerHTML='<p class="small muted">No saved hands yet. Play a few in <a href="#hand">Full hand</a> and they will show up here.</p>';return}
  if(!list.length){el.innerHTML='<p class="small muted">No hands with mistakes. Nice.</p>';return}
  el.innerHTML=list.map(({h,i})=>{const bad=h.dec.filter(d=>!d.ok).length,net=h.result?h.result.net:0;
    return `<button type="button" class="rp-item ${rpCur===h?'on':''}" data-i="${i}"><span class="cards">${cardsHTML(h.hero,'xs')}</span><span><b>${FH_SEATS[h.seat].hero} vs ${FH_TYPES[h.type].name}</b><small>${rpWhen(h.ts)} · ${h.dec.length} decision${h.dec.length===1?'':'s'}${bad?`, <span class="bad">${bad} to review</span>`:''}</small></span><span class="rp-net ${net>=0?'good':'bad'}">${net>=0?'+':''}${fmtBB(Math.round(net*10)/10)}</span></button>`}).join('')}
$('rp-list').onclick=e=>{const b=e.target.closest('.rp-item');if(!b)return;rpOpen(+b.dataset.i)};
$('rp-miss').onchange=rpList;

function rpOpen(i){rpLoad();rpCur=rpHands[i]||null;rpStep=0;rpShowVil=false;$('rp-vil-show').checked=false;
  $('rp-view').hidden=!rpCur;$('rp-empty').hidden=!!rpCur;rpList();if(rpCur){rpDraw();if(window.innerWidth<780)$('rp-view').scrollIntoView({behavior:'smooth'})}}
function rpDraw(){const h=rpCur,L=h.log,e=L[rpStep],S=FH_SEATS[h.seat],sn=e.s||null,last=rpStep===L.length-1,showV=rpShowVil||last;
  const seats={};POS.forEach(p=>seats[p]={state:'folded'});
  seats[S.hero]={state:'hero',stack:sn?fmtBB(sn.h)+' BB':'',tag:'You',bet:sn&&sn.bh?fmtBB(sn.bh)+' BB':''};
  seats[S.vil]={state:'vil',stack:sn?fmtBB(sn.v)+' BB':'',tag:{rec:'Rec',station:'Station',nit:'Nit',aggro:'Aggro'}[h.type],bet:sn&&sn.bv?fmtBB(sn.bv)+' BB':''};
  renderTable($('rp-table'),{hero:S.hero,seats,heroCards:h.hero,shown:showV?{[S.vil]:h.vil}:{},center:`<div class="cards">${e.board.length?cardsHTML(e.board,'xs'):''}</div><b>${fmtBB(e.pot)} BB</b><span>pot</span>`});
  $('rp-title').textContent=`${S.hero} vs ${FH_TYPES[h.type].name} · ${rpWhen(h.ts)}`;
  $('rp-hero').innerHTML=cardsHTML(h.hero);$('rp-vil').innerHTML=showV?cardsHTML(h.vil):cardsHTML([null,null]);
  $('rp-pos').textContent=`Step ${rpStep+1} of ${L.length} · ${e.street}`;
  $('rp-log').innerHTML=L.map((x,k)=>{const d=h.dec.find(q=>q.logIdx===k);return `<li class="${x.who}${k===rpStep?' cur':''}${k>rpStep?' fut':''}" data-k="${k}">${esc(x.text)}${d?` <span class="chip ${d.ok?'good':'bad'}">${d.ok?'✓':FH_COST[d.cost][0]}</span>`:''}</li>`}).join('');
  const cur=$('rp-log').querySelector('.cur');if(cur)cur.scrollIntoView({block:'nearest'});
  ['rp-first','rp-prev'].forEach(id=>$(id).disabled=rpStep===0);['rp-next','rp-last'].forEach(id=>$(id).disabled=last);
  const d=h.dec.find(q=>q.logIdx===rpStep);
  $('rp-dec').innerHTML=d?`<div class="verdict ${FH_COST[d.cost][1]}"><strong>${FH_COST[d.cost][0]}</strong><span class="small muted">${d.spot}: you chose ${d.choice}${d.cost==='best'?'':` · best: ${d.best}`}</span></div>${d.why?`<p class="small">${d.why}</p>`:''}${d.ev?fhEvTable(d.ev):''}`
    :last&&h.result?`<div class="verdict ${h.result.net>=0?'good':'bad'}"><strong>${h.result.net>=0?'+':''}${fmtBB(Math.round(h.result.net*10)/10)} BB</strong><span class="small">${h.dec.filter(x=>x.ok).length} of ${h.dec.length} decisions best or fine.</span></div>`
    :'<p class="small muted">Step forward to the next decision. Lines with a ✓ or a mistake tag are your decisions.</p>';
  const nextDec=h.dec.find(q=>q.logIdx>rpStep);$('rp-jump').hidden=!nextDec;
  $('rp-calc').textContent=showV?'Calculator: vs their cards':'Calculator: vs a random hand'}
function rpGo(k){if(!rpCur)return;rpStep=Math.max(0,Math.min(rpCur.log.length-1,k));rpDraw()}
$('rp-first').onclick=()=>rpGo(0);$('rp-prev').onclick=()=>rpGo(rpStep-1);$('rp-next').onclick=()=>rpGo(rpStep+1);$('rp-last').onclick=()=>rpGo(1e9);
$('rp-jump').onclick=()=>{const d=rpCur.dec.find(q=>q.logIdx>rpStep);if(d)rpGo(d.logIdx)};
$('rp-log').onclick=e=>{const li=e.target.closest('li[data-k]');if(li)rpGo(+li.dataset.k)};
$('rp-vil-show').onchange=e=>{rpShowVil=e.target.checked;rpDraw()};
document.addEventListener('keydown',e=>{if(currentView!=='replay'||!rpCur||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
  if(e.key==='ArrowRight'){rpGo(rpStep+1);e.preventDefault()}if(e.key==='ArrowLeft'){rpGo(rpStep-1);e.preventDefault()}});
/* send the spot to the other tools */
$('rp-calc').onclick=()=>{const h=rpCur,e=h.log[rpStep],showV=rpShowVil||rpStep===h.log.length-1;
  slots=[h.hero[0],h.hero[1],showV?h.vil[0]:null,showV?h.vil[1]:null,...[0,1,2,3,4].map(i=>e.board[i]??null)];active=null;
  setVmode(showV?'exact':'random');location.hash='#calculator';runCalc()};
$('rp-board').onclick=()=>{const e=rpCur.log[rpStep];if(e.board.length<3){$('rp-board-msg').textContent='Step to the flop or later first.';return}
  rvbBoard=e.board.slice();rvbActive=Math.min(rvbBoard.length,4);rvbGuess=null;rvbSlots();rvbRun();location.hash='#board'};
$('rp-del').onclick=e=>{const b=e.target;if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Confirm delete';setTimeout(()=>{delete b.dataset.armed;b.textContent='Delete this hand'},4000);return}
  try{const a=JSON.parse(localStorage.getItem(FHKEY))||[];const k=a.findIndex(x=>x.ts===rpCur.ts);if(k>=0)a.splice(k,1);localStorage.setItem(FHKEY,JSON.stringify(a))}catch(err){}
  rpCur=null;$('rp-view').hidden=true;$('rp-empty').hidden=false;delete b.dataset.armed;b.textContent='Delete this hand';rpList()};
function rpInit(){rpList();$('rp-view').hidden=true}
