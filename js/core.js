/* ---------- helpers & stakes ---------- */
const $=id=>document.getElementById(id);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const randInt=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const roundTo=(x,s)=>Math.max(s,Math.round(x/s)*s);
const pct=(x,d=1)=>(x*100).toFixed(d)+'%';
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let mode='tour',bb=200;
const LEVELS=[[100,200],[200,400],[300,600],[500,1000],[1000,2000],[2500,5000]];
function newStakes(){bb=mode==='cash'?2:pick(LEVELS)[1]}
function money(x){if(cfg.units==='bb'&&bb>0)return fmtBB(x/bb)+' BB';return mode==='cash'?'$'+x.toLocaleString():x.toLocaleString()}
function bbs(x){const g=mode==='cash'?'$1/$2 game':`Blinds ${(bb/2).toLocaleString()}/${bb.toLocaleString()}`;return cfg.units==='bb'?g:`${g} · ${(x/bb).toFixed(1)} BB`}
function makePot(lo,hi){return mode==='cash'?roundTo(randInt(lo*bb,hi*bb),5):roundTo(bb*randInt(lo,hi)+bb*0.5*randInt(0,1),bb/2)}
function makeBet(pot,frac){return mode==='cash'?roundTo(pot*frac,5):roundTo(pot*frac,bb/2)}
const fmtBB=x=>(Math.round(x*10)/10).toString();

/* ---------- per-device stats ---------- */
const KEY='holdem-odds-trainer-v1';
let stats={po:{n:0,c:0,streak:0},cf:{n:0,c:0},se:{n:0,err:0},pf:{n:0,c:0,streak:0},mu:{n:0,c:0,err:0}};
try{const s=JSON.parse(localStorage.getItem(KEY));if(s)for(const k in s)stats[k]=Object.assign(stats[k]||{},s[k])}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(stats))}catch(e){}}

/* ---------- sessions: a new one after 30 idle minutes or a new day ---------- */
const SESSKEY='holdem-odds-session-v1',IDLE=30*60*1000;
let sess={id:'',last:0};
try{Object.assign(sess,JSON.parse(localStorage.getItem(SESSKEY))||{})}catch(e){}
function sessionId(){const now=Date.now(),day=d=>new Date(d).toDateString();
  if(!sess.id||now-sess.last>IDLE||day(now)!==day(sess.last)){
    const d=new Date(now);sess.id=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,6)}`}
  sess.last=now;try{localStorage.setItem(SESSKEY,JSON.stringify(sess))}catch(e){}return sess.id}

/* ---------- answer log & cloud sync ----------
   Every answer goes into `log` (this device) and `queue` (waiting to upload). When someone is signed in,
   js/cloud.js uploads the queue to their account. Signed out, answers stay on this device and upload
   the first time they sign in. */
const LOGKEY='holdem-odds-log-v1',CFGKEY='holdem-odds-cfg-v1';
let cfg={player:''},log=[],queue=[],currentView='';
try{Object.assign(cfg,JSON.parse(localStorage.getItem(CFGKEY))||{})}catch(e){}
try{const s=JSON.parse(localStorage.getItem(LOGKEY));if(s){log=s.log||[];queue=s.queue||[]}}catch(e){}
function persistLog(){try{localStorage.setItem(LOGKEY,JSON.stringify({log:log.slice(-6000),queue:queue.slice(-6000)}))}catch(e){}}
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function logEvent(ev){
  const row={id:newId(),ts:new Date().toISOString(),session:sessionId(),game:mode==='cash'?'Cash':'Tournament',
    drill:'',spot:'',hand:'',answer:'',expected:'',correct:null,error:'',detail:'',ms:'',...ev};
  log.push(row);queue.push(row);persistLog();updateQ();scheduleSync();
  if(currentView==='progress')renderProgress();
}
const signedIn=()=>!!(window.cloud&&window.cloud.user);
let syncTimer=null,syncing=false;
function scheduleSync(delay){clearTimeout(syncTimer);syncTimer=setTimeout(sync,delay??(queue.length>=20?2000:20000))}
async function sync(){
  if(syncing||!queue.length||!signedIn())return;
  syncing=true;const batch=queue.slice(0,400);let ok=false;
  try{await window.cloud.pushEvents(batch);
    const done=new Set(batch.map(r=>r.id));queue=queue.filter(r=>!done.has(r.id));persistLog();ok=true;
    setSync(`Saved to your account at ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`,'good');
  }catch(e){console.warn(e);setSync('Could not reach the server, so results wait on this device and retry in a couple of minutes.','bad')}
  syncing=false;updateQ();if(ok&&queue.length)scheduleSync(500);
}
/* answers downloaded from the account: add the ones this device doesn't have */
function mergeEvents(evs){const key=r=>r.id||(r.ts+'|'+r.drill+'|'+r.spot);const have=new Set(log.map(key));let n=0;
  for(const e of evs){const k=key(e);if(have.has(k))continue;have.add(k);log.push(e);n++}
  if(n){log.sort((a,b)=>a.ts<b.ts?-1:a.ts>b.ts?1:0);persistLog();updateQ();
    if(currentView==='progress')renderProgress();if(currentView==='daily'&&typeof daily!=='undefined'&&!daily)dailyHome()}
  return n}
function setSync(msg,cls){const m=$('sync-msg');if(!m)return;m.textContent=msg;m.className='small syncmsg '+(cls||'')}
function updateQ(){const q=$('sync-q');if(!q)return;
  q.textContent=signedIn()?(queue.length?`${queue.length} result${queue.length>1?'s':''} waiting to upload.`:'Everything is saved to your account.')
    :`${log.length} result${log.length===1?'':'s'} saved on this device only. Sign in to keep them in your account and see them on other devices.`}
setInterval(()=>sync(),120000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')sync()});

/* answer history for focus mode */
const historyRows=()=>log;
const cv=x=>x===true||x==='TRUE'||x==='true'?true:x===false||x==='FALSE'||x==='false'?false:null;
const ERR_DRILLS=['Street equity','Range vs board','Hand vs range','Range vs range','Hand reading'];
function aggregate(rows){const m=new Map();
  for(const r of rows){const k=r.drill+'|'+r.spot;let a=m.get(k);if(!a){a={drill:r.drill,spot:r.spot,n:0,c:0,graded:0,errSum:0,errN:0,miss:{},ms:0};m.set(k,a)}
    a.n++;a.ms+=+r.ms||0;const c=cv(r.correct);
    if(c!==null){a.graded++;if(c)a.c++;else if(r.drill==='Preflop'&&r.hand)a.miss[r.hand]=(a.miss[r.hand]||0)+1;
      if(r.drill==='Range builder'&&r.hand)for(const h of String(r.hand).split(' '))if(h)a.miss[h]=(a.miss[h]||0)+1}
    if(ERR_DRILLS.includes(r.drill)&&r.error!==''&&!isNaN(+r.error)){a.errSum+=+r.error;a.errN++}}
  return[...m.values()]}
/* weight for picking a weak area: unexplored areas get a middle weight */
function weakWeight(a){if(!a||a.graded<5)return .7;return .1+2*(1-a.c/a.graded)}
function weightedPick(list,w){let x=Math.random()*w.reduce((p,q)=>p+q,0);for(let i=0;i<list.length;i++){x-=w[i];if(x<=0)return list[i]}return list[list.length-1]}

/* ---------- poker table (6-max) ---------- */
const POS=['UTG','HJ','CO','BTN','SB','BB'];
const POSNAME={UTG:'under the gun',HJ:'hijack',CO:'cutoff',BTN:'button',SB:'small blind',BB:'big blind'};
/* t: {hero, seats:{POS:{state:'hero'|'vil'|'folded'|'wait', bet, stack, tag}}, center:html}
   Hero sits at the bottom; action runs clockwise on screen. Bets are labels already formatted. */
function renderTable(el,t){
  const hi=POS.indexOf(t.hero);let h='<div class="oval"></div>';
  POS.forEach((p,i)=>{const s=t.seats[p]||{},k=(i-hi+6)%6,a=(90+k*60)*Math.PI/180,cx=Math.cos(a),cy=Math.sin(a);
    const x=50+43*cx,y=50+41*cy;
    h+=`<div class="pseat ${s.state||''}" style="left:${x}%;top:${y}%">${p}<small>${s.stack??''}</small>${s.tag?`<em>${s.tag}</em>`:''}</div>`;
    if(s.bet)h+=`<div class="pbet" style="left:${50+26*cx}%;top:${50+23*cy}%"><i></i>${s.bet}</div>`;
    if(p==='BTN'){const b=a+.42;h+=`<div class="dbtn" style="left:${50+31*Math.cos(b)}%;top:${50+30*Math.sin(b)}%" title="Dealer button">D</div>`}});
  /* hole cards sit beside the player who holds them: t.heroCards, and t.shown = {POS:[cards]} for others */
  const holes=[[t.hero,t.heroCards],...Object.entries(t.shown||{})];
  for(const [p,cards] of holes){if(!cards||!cards.length)continue;const k=(POS.indexOf(p)-hi+6)%6,a=(90+k*60)*Math.PI/180,cx=Math.cos(a),cy=Math.sin(a);
    const sx=50+43*cx,sy=50+41*cy;   /* beside the hero; above side seats; inward from the top seats */
    const [x,y]=k===0?[sx+19,sy]:k===1||k===5?[sx,sy-17]:k===3?[sx+15,sy]:[sx+(cx<0?15:-15),sy];
    h+=`<div class="phole${p===t.hero?' me':''}" style="left:${x}%;top:${y}%">${cardsHTML(cards,'xs')}</div>`}
  h+=`<div class="center">${t.center||''}</div>`;
  el.innerHTML=h;
  el.setAttribute('aria-label',`Table: you are in the ${POSNAME[t.hero]}. `+POS.filter(p=>t.seats[p]&&t.seats[p].tag).map(p=>`${p}: ${t.seats[p].tag}${t.seats[p].bet?' '+t.seats[p].bet:''}`).join(', '));
}
