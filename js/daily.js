/* ---------- daily challenge ----------
   10 questions a day across every trainer, weighted toward your weakest areas, with feedback after each.
   A day counts toward the streak once all 10 are answered. Days are read from the answer log
   (detail "Daily challenge"), so the streak follows your account across devices.
   Progress through today's set is kept on this device so you can stop and come back. */
const DAILY_N=10,DAILYKEY='holdem-daily-v1',DAILY_TAG='Daily challenge';
const DAILY_AREAS=['Preflop','Matchups','Pot odds','Counting outs','Call or fold','Bet sizing','Range vs board','Combinatorics'];
const dayKey=d=>{d=new Date(d);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dayKey(d)};

/* extra question types for the daily set */
QGEN['Bet sizing']=function(){const sc=pick(SZ_SC),s=szMake(sc),key=szKey(),g=szGrade(s,key);
  const ids=SZB.filter((b,i)=>s.avail[i]).map(b=>b.id),opts=ids.map(id=>{const i=SZI[id];return SZB[i].name+(id==='check'?'':` (${fmtBB(s.amts[i])} BB)`)});
  const okIdx=ids.map((id,k)=>g.best.includes(id)||g.ok.includes(id)?k:-1).filter(k=>k>=0);
  return{drill:'Bet sizing',spot:sc.label,hand:names(s.hero),visual:tableSnap(s.table),
    prompt:`<p class="spot-text">${s.text}</p><p>What size do you bet? <span class="small muted">(${key==='g'?'GTO baseline':'Exploit'} key; switch it on the Bet sizing tab)</span></p>`,
    opts,correct:ids.indexOf(g.best.find(x=>ids.includes(x))),okIdx,short:`${sc.label}, ${SZCAT_SHORT[s.cat]}`,
    explain:`Your hand: ${SZCAT[s.cat]}. ${g.ans.why}`}};
QGEN['Range vs board']=function(){const r=pick([['cash-btn-open|0','BTN open'],['cash-bb-vs-btn-open|1','BB call vs a BTN open'],['cash-co-open|0','CO open'],['cash-bb-vs-co-open|1','BB call vs a CO open']]);
  const board=shuffled().slice(0,3),A=rvbAnalyze(presetRange(r[0]),board),actual=A.tpplus/A.n*100,v=Math.min(95,Math.max(5,Math.round(actual/5)*5));
  const {opts,correct}=numOpts(v,[v-20,v-10,v+10,v+20,v-15,v+15].filter(x=>x>0&&x<100));
  return{drill:'Range vs board',spot:texture(board).replace(/^\S+ /,''),hand:names(board),error:Math.abs(v-actual),
    prompt:`<div><span class="lbl">Flop</span><div class="cards">${cardsHTML(board)}</div></div><p>How often does the <b>${r[1]}</b> range have top pair or better on this flop?</p>`,
    opts:opts.map(o=>o+'%'),correct,short:`${r[1]} on ${names(board)}`,
    explain:`${pct(actual/100)} of the live combos have top pair or better; ${pct(A.strong/A.n)} have two pair or better.`}};

/* which areas to ask about: weaker areas more often, at most 3 of any one */
function dailyPlan(){const rows=historyRows().slice(-3000),w=DAILY_AREAS.map(a=>{const xs=rows.filter(r=>r.drill===a&&cv(r.correct)!==null);
    if(xs.length<5)return .7;const acc=xs.filter(r=>cv(r.correct)).length/xs.length;return .15+2*(1-acc)});
  const plan=[];while(plan.length<DAILY_N){const a=weightedPick(DAILY_AREAS,w);if(plan.filter(x=>x===a).length<3)plan.push(a)}return plan}

let daily=null;
function dailyLoad(){try{const s=JSON.parse(localStorage.getItem(DAILYKEY));if(s&&s.date===dayKey(Date.now()))return s}catch(e){}return null}
function dailySave(){try{localStorage.setItem(DAILYKEY,JSON.stringify({date:daily.date,plan:daily.plan,i:daily.i,answers:daily.answers}))}catch(e){}}

/* days with a finished challenge, from the answer log */
function dailyDays(){const m=new Map();
  for(const r of log){if(r.detail!==DAILY_TAG||!r.ts)continue;const k=dayKey(r.ts),x=m.get(k)||{n:0,c:0,seen:new Set()};
    const id=r.ts+'|'+r.hand+'|'+r.answer;if(x.seen.has(id))continue;x.seen.add(id);x.n++;if(cv(r.correct))x.c++;m.set(k,x)}
  const done=new Map();for(const[k,x]of m)if(x.n>=DAILY_N)done.set(k,x);return done}
function streaks(done){const today=dayKey(Date.now());let cur=0,k=done.has(today)?today:addDays(today,-1);while(done.has(k)){cur++;k=addDays(k,-1)}
  const keys=[...done.keys()].sort();let best=0,run=0,prev=null;for(const k2 of keys){run=prev&&addDays(prev,1)===k2?run+1:1;best=Math.max(best,run);prev=k2}
  return{cur,best,today:done.has(today)}}

function dailyHome(){const done=dailyDays(),st=streaks(done),today=dayKey(Date.now()),saved=dailyLoad();
  const status=st.today?`Done for today: <b>${done.get(today).c}/${done.get(today).n}</b>. Come back tomorrow to keep the streak going.`
    :saved&&saved.i>0?`In progress: ${saved.i} of ${DAILY_N} answered.`:'Questions from every trainer, weighted toward the areas you miss most.';
  $('dl-status').innerHTML=status;
  $('dl-streak').textContent=st.cur;$('dl-best').textContent=st.best;
  $('dl-streak-note').textContent=st.cur&&!st.today?'Play today to keep it alive.':st.cur?'Nice work.':'Finish today\'s set to start one.';
  $('dl-go').textContent=st.today?'Play a practice round':saved&&saved.i>0?'Continue':'Start today\'s challenge';
  let cal='';for(let i=6;i>=0;i--){const k=addDays(today,-i),x=done.get(k),dt=new Date(k+'T12:00:00');
    cal+=`<span class="${x?(x.c/x.n>=.8?'d2':'d1'):''}${k===today?' now':''}" title="${dt.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'})}${x?`: ${x.c}/${x.n}`:': not played'}">${dt.toLocaleDateString([],{weekday:'short'}).slice(0,2)}</span>`}
  $('dl-cal').innerHTML=cal;homeRender()}

/* ---------- home dashboard ---------- */
const LASTVIEWKEY='holdem-last-view';
function homeRender(){const h=new Date().getHours(),name=(cfg.player||'').trim().split(/\s+/)[0];
  $('hm-hi').textContent=`Good ${h<12?'morning':h<17?'afternoon':'evening'}${name?', '+name:''}`;
  $('hm-date').textContent=new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  /* work on next: weakest areas with enough attempts */
  const rows=log,ag=aggregate(rows).map(a=>({...a,...grade(a)})).filter(a=>a.st==='bad'||a.st==='ok').sort((x,y)=>y.need-x.need).slice(0,3);
  $('hm-next').innerHTML=ag.length?ag.map(a=>`<div><span><b>${a.drill} · ${esc(a.spot)}</b><small>${a.score}</small></span><button class="linkbtn" data-train="${esc(a.drill)}|${esc(a.spot)}">Train</button></div>`).join('')
    :`<p class="small muted">${rows.length?'Nothing below 90% yet with 5 or more attempts. Keep going.':'Answer a few spots in any trainer and your weakest areas show up here.'}</p>`;
  /* last full hand */
  let hs=[];try{hs=JSON.parse(localStorage.getItem(FHKEY))||[]}catch(e){}
  const L=hs[hs.length-1];
  if(!L)$('hm-last').innerHTML='<p class="small muted">No hands played yet.</p><div class="row"><button class="act" data-go="#hand">Play a hand</button></div>';
  else{const net=L.result?L.result.net:0,bad=L.dec.filter(d=>!d.ok).length;
    $('hm-last').innerHTML=`<div class="cards">${cardsHTML(L.hero,'sm')}</div><div><b>${(L.S||FH_SEATS[L.seat]).hero} vs ${FH_TYPES[L.type].name}</b><div class="small muted"><span style="color:var(--${net>=0?'good':'bad'});font-weight:700">${net>=0?'+':''}${fmtBB(Math.round(net*10)/10)} BB</span> · ${bad?`${bad} decision${bad===1?'':'s'} to review`:'no mistakes'}</div></div>
      <div class="row"><button class="act ghost" id="hm-replay">Replay</button><button class="act" data-go="#hand">Play a hand</button></div>`;
    $('hm-replay').onclick=()=>{rpOpen(0);location.hash='#replay'}}
  let lv='';try{lv=localStorage.getItem(LASTVIEWKEY)||''}catch(e){}
  const c=$('hm-continue');c.hidden=!lv||!VIEWS.includes(lv)||lv==='daily';if(!c.hidden){c.textContent='Continue: '+VIEW_LABEL[lv];c.onclick=()=>location.hash='#'+lv}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)location.hash=b.dataset.go});

function dailyStart(){const saved=dailyLoad(),st=streaks(dailyDays());
  if(st.today)daily={date:dayKey(Date.now()),plan:dailyPlan(),i:0,answers:[],practice:true};
  else daily=saved&&saved.i<DAILY_N?{...saved,practice:false}:{date:dayKey(Date.now()),plan:dailyPlan(),i:0,answers:[],practice:false};
  $('dl-home').hidden=true;$('dl-done').hidden=true;$('dl-run').hidden=false;dailyShow()}
function dailyShow(){const area=daily.plan[daily.i];$('dl-opts').innerHTML='<span class="small muted">Dealing…</span>';$('dl-fb').innerHTML='';$('dl-next').hidden=true;
  setTimeout(()=>{let q;try{q=QGEN[area]()}catch(e){q=QGEN['Pot odds']()}q.area=area;q.t0=Date.now();daily.q=q;
    $('dl-count').textContent=`${daily.practice?'Practice · ':''}Question ${daily.i+1} of ${DAILY_N}`;$('dl-area').textContent=area;$('dl-bar').style.width=(daily.i/DAILY_N*100)+'%';
    $('dl-visual').innerHTML=q.visual||'';$('dl-prompt').innerHTML=q.prompt;
    $('dl-opts').innerHTML=q.opts.map((o,k)=>`<button class="act ${q.opts.length<=3?'':'ghost'}" data-k="${k}">${o}</button>`).join('')},10)}
$('dl-opts').onclick=e=>{const b=e.target.closest('button[data-k]');if(!b||!daily||!daily.q)return;const q=daily.q,k=+b.dataset.k,okSet=q.okIdx||[q.correct],ok=okSet.includes(k);daily.q=null;
  daily.answers.push({area:q.area,short:q.short,ok,picked:q.opts[k],right:q.opts[q.correct]});
  logEvent({drill:q.drill,spot:q.spot,hand:q.hand,answer:q.opts[k],expected:q.opts[q.correct],correct:ok,error:q.error!=null?+q.error.toFixed(1):'',detail:daily.practice?'Daily practice':DAILY_TAG,ms:Date.now()-q.t0});
  daily.i++;if(!daily.practice)dailySave();
  $('dl-opts').querySelectorAll('button').forEach((x,i)=>{x.disabled=true;if(i===q.correct)x.classList.add('pickok');else if(okSet.includes(i))x.classList.add('pickok');else if(i===k)x.classList.add('pickbad')});
  $('dl-fb').innerHTML=`<div class="verdict ${ok?'good':'bad'}"><strong>${ok?'Correct':'Not quite'}</strong><span class="small">${q.explain}</span></div>`;
  $('dl-next').hidden=false;$('dl-next').textContent=daily.i<DAILY_N?'Next question':'See results';$('dl-next').focus()};
$('dl-next').onclick=()=>{if(daily.i<DAILY_N)dailyShow();else dailyEnd()};
function dailyEnd(){$('dl-run').hidden=true;$('dl-done').hidden=false;const A=daily.answers,c=A.filter(a=>a.ok).length;
  if(!daily.practice)try{localStorage.removeItem(DAILYKEY)}catch(e){}
  const st=streaks(dailyDays());
  $('dl-result').innerHTML=`<div class="stats"><div class="stat"><div class="n">${c}/${A.length}</div><span class="small muted">correct</span></div>${daily.practice?'':`<div class="stat"><div class="n">${st.cur}</div><span class="small muted">day streak</span></div>`}</div>
    <ol class="dl-list">${A.map(a=>`<li class="${a.ok?'ok':'no'}"><span>${a.ok?'✓':'✗'}</span><span><b>${a.area}</b> · ${esc(a.short)}${a.ok?'':`<br><span class="small muted">You: ${a.picked} · Answer: ${a.right}</span>`}</span>${a.ok?'':`<button class="linkbtn" data-train="${esc(a.area)}|">Train</button>`}</li>`).join('')}</ol>
    <p class="small muted">${daily.practice?'Practice rounds count in Progress but not toward the streak.':'Today counts toward your streak. Your answers also feed Focus mode in each trainer.'}</p>`;
  daily=null;dailyHome()}
$('dl-go').onclick=dailyStart;$('dl-home-btn').onclick=()=>{$('dl-done').hidden=true;$('dl-home').hidden=false;dailyHome()};
$('dl-quit').onclick=()=>{daily=null;$('dl-run').hidden=true;$('dl-home').hidden=false;dailyHome()};
