/* ---------- assessment quiz ---------- */
const QPLAN={Preflop:10,Matchups:5,'Pot odds':5,'Counting outs':5,'Call or fold':5};
function tableSnap(t){const d=document.createElement('div');d.className='ptable';renderTable(d,t);return d.outerHTML}
function numOpts(correct,cands){const opts=[correct];for(const c of shuffle(cands))if(opts.length<4&&!opts.some(o=>Math.abs(o-c)<2))opts.push(c);
  const s=shuffle(opts);return{opts:s,correct:s.indexOf(correct)}}
const QGEN={
  'Preflop'(){const spot=pick(SPOTS.filter(s=>s.game===mode)),{label,cards}=dealSpotHand(spot,0),exp=spot.map.get(label)??spot.fold;
    return{drill:'Preflop',spot:spot.name,hand:label,visual:tableSnap({...spotTable(spot),heroCards:cards}),
      prompt:`<p class="spot-text">${spotText(spot)}</p>`,
      opts:spot.acts,correct:exp,short:`${spot.name}, ${label}`,explain:pfWhy(spot,label,exp)}},
  'Matchups'(){const [h0,h1,c]=dealMatchup(pick(MU).id),first=Math.random()<.5,hero=first?h0:h1,vil=first?h1:h0,eq=equity(hero,vil,[],20000).eq;
    const v=Math.min(95,Math.max(5,Math.round(eq*20)*5)),{opts,correct}=numOpts(v,[v-20,v-10,v+10,v+20,v-15,v+15].filter(x=>x>0&&x<100)),m=MUBY[c.id];
    return{drill:'Matchups',spot:m.name,hand:names(hero)+' vs '+names(vil),
      prompt:`<div class="hands"><div><span class="lbl">You</span><div class="cards">${cardsHTML(hero)}</div></div><div><span class="lbl">Villain</span><div class="cards">${cardsHTML(vil)}</div></div></div><p>All in preflop. Your equity is closest to:</p>`,
      opts:opts.map(o=>o+'%'),correct,short:`${names(hero)} vs ${names(vil)}`,
      explain:`${m.name}: the favorite wins about ${m.rule}%, and you are the ${(c.fav===0)===first?'favorite':'underdog'}. Exact: ${pct(eq)}.`}},
  'Pot odds'(){const p=genPO(),r=Math.round(p.req*100),wrong1=Math.round(p.bet/(p.pot+p.bet)*100),wrong2=Math.round(p.bet/p.pot*100);
    const {opts,correct}=numOpts(r,[wrong1,wrong2<95?wrong2:r+12,r+7,r-7,r+12].filter(x=>x>0&&x<100));
    return{drill:'Pot odds',spot:nearestRef(p.bet/p.pot)+' bet',hand:'',
      prompt:`<p class="spot-text">The pot is <b>${money(p.pot)}</b>. Villain bets <b>${money(p.bet)}</b>. What equity do you need to call?</p>`,
      opts:opts.map(o=>o+'%'),correct,short:`Pot ${money(p.pot)}, bet ${money(p.bet)}`,
      explain:`${money(p.bet)} ÷ (${money(p.pot)} + ${money(p.bet)} + ${money(p.bet)}) = ${pct(p.req)}. Your own call counts in the final pot.`}},
  'Counting outs'(){for(;;){const d=shuffled(),hero=d.slice(0,2),vil=d.slice(2,4),board=d.slice(4,8);
      if(evalHand(hero.concat(board))>=evalHand(vil.concat(board)))continue;const outs=outsFor(hero,vil,board),n=outs.length;if(n<2||n>20)continue;
      const {opts,correct}=numOpts(n,[n-4,n-2,n+2,n+4,n+3,n-3].filter(x=>x>=0));
      return{drill:'Counting outs',spot:n<=5?'Turn, small draw':n<=10?'Turn, medium draw':'Turn, big draw',hand:names(hero)+' vs '+names(vil),
        prompt:`<div class="hands"><div><span class="lbl">You</span><div class="cards">${cardsHTML(hero)}</div></div><div><span class="lbl">Villain</span><div class="cards">${cardsHTML(vil)}</div></div></div><div><span class="lbl">Turn</span><div class="cards">${cardsHTML(board)}</div></div><p>How many river cards put you ahead?</p>`,
        opts:opts.map(String),correct,short:`${names(hero)} vs ${names(vil)} on ${names(board)}`,
        explain:`${n} outs: <span class="outs">${cardsHTML(outs,'xs')}</span>`}}},
  'Call or fold'(){const c=genCF(.03),v=cfReview(c);
    return{drill:'Call or fold',spot:(c.street===3?'Flop shove':'Turn bet')+(c.behind?', drawing':', ahead'),hand:names(c.hero)+' vs '+names(c.vil),
      visual:tableSnap({...cfTable(c),heroCards:c.hero,shown:{[c.vp]:c.vil}}),
      prompt:`<p class="spot-text">${c.street===3?'Flop':'Turn'}. Villain ${c.street===3?'shoves':'bets'} ${money(c.bet)} into ${money(c.pot)}.</p>`,
      opts:['Call','Fold'],correct:v.best==='Call'?0:1,short:`${names(c.hero)} vs ${names(c.vil)} on ${names(c.board)}`,
      explain:`You need ${pct(c.req)} and have ${pct(c.e.eq)}${c.behind?` (${v.hOuts.length} outs)`:''}.`}},
};
let qz=null;
function startQuiz(){const plan=shuffle(Object.entries(QPLAN).flatMap(([a,n])=>Array(n).fill(a)));
  qz={plan,i:0,answers:[],game:mode};$('qz-start').hidden=true;$('qz-result').hidden=true;$('qz-run').hidden=false;showQ()}
function showQ(){const area=qz.plan[qz.i];$('qz-opts').innerHTML='<span class="small muted">Dealing…</span>';
  setTimeout(()=>{const q=QGEN[area]();q.area=area;q.t0=Date.now();qz.q=q;
    $('qz-count').textContent=`Question ${qz.i+1} of ${qz.plan.length}`;$('qz-area').textContent=area;$('qz-bar').style.width=(qz.i/qz.plan.length*100)+'%';
    $('qz-visual').innerHTML=q.visual||'';$('qz-prompt').innerHTML=q.prompt;
    $('qz-opts').innerHTML=q.opts.map((o,k)=>`<button class="act ${q.opts.length<=3?'':'ghost'}" data-k="${k}">${o}</button>`).join('')},10)}
$('qz-opts').onclick=e=>{const b=e.target.closest('button[data-k]');if(!b||!qz||!qz.q)return;const q=qz.q,k=+b.dataset.k,ok=k===q.correct;qz.q=null;
  qz.answers.push({...q,picked:k,ok});
  logEvent({drill:q.drill,spot:q.spot,hand:q.hand,answer:q.opts[k],expected:q.opts[q.correct],correct:ok,detail:'Assessment',ms:Date.now()-q.t0});
  qz.i++;if(qz.i<qz.plan.length)showQ();else endQuiz()};
const TRAIN_HASH={'Preflop':'preflop','Matchups':'matchups','Pot odds':'pot-odds','Counting outs':'call-or-fold','Call or fold':'call-or-fold','Street equity':'street-equity','Range builder':'ranges','Bet sizing':'sizing','Range vs board':'board','Full hand':'hand'};
function endQuiz(){$('qz-run').hidden=true;$('qz-result').hidden=false;const A=qz.answers,total=A.filter(a=>a.ok).length;
  const areas=Object.keys(QPLAN).map(a=>{const xs=A.filter(x=>x.area===a),c=xs.filter(x=>x.ok).length;return{a,n:xs.length,c,acc:xs.length?c/xs.length:0}});
  const st=acc=>acc>=.9?'good':acc>=.7?'ok':'bad';
  const pfMiss=A.filter(x=>x.area==='Preflop'&&!x.ok);
  const weak=areas.filter(x=>x.acc<.8).sort((x,y)=>x.acc-y.acc);
  $('qz-summary').innerHTML=`<div class="stats"><div class="stat"><div class="n">${total}/${A.length}</div><span class="small muted">correct (${pct(total/A.length,0)})</span></div></div>
   <div style="overflow-x:auto"><table class="ref"><thead><tr><th>Area</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>${areas.map(x=>`<tr><td class="t">${x.a}</td><td>${x.c}/${x.n}</td><td><span class="chip ${st(x.acc)}">${STATUS[st(x.acc)]}</span></td><td><button class="linkbtn" data-train="${esc(x.a)}|">Train this</button></td></tr>`).join('')}</tbody></table></div>
   <div><h3>Work on next</h3>${weak.length?`<ol class="next">${weak.slice(0,3).map(x=>`<li><b>${x.a}</b>: ${x.c} of ${x.n}.${x.a==='Preflop'&&pfMiss.length?` Missed spots: ${[...new Set(pfMiss.map(m=>m.spot))].slice(0,4).join(', ')}.`:''} <button class="linkbtn" data-train="${esc(x.a)}|">Train this</button></li>`).join('')}</ol>`:'<p class="small">Every area scored 80% or better. Retake later or switch between Cash and Tournament to test the other spots.</p>'}</div>
   <p class="small muted">Results are logged to your history, so Focus mode in each trainer now leans toward the spots you missed.</p>`;
  const wrong=A.filter(x=>!x.ok);
  $('qz-review').innerHTML=wrong.length?wrong.map(x=>`<div><span class="small muted">${x.area} · ${esc(x.short)}</span><span>You chose <b>${x.opts[x.picked]}</b>; the answer is <b>${x.opts[x.correct]}</b>.</span><span class="small">${x.explain}</span></div>`).join(''):'<p class="small">No misses to review.</p>'}
$('qz-go').onclick=startQuiz;$('qz-again').onclick=startQuiz;
$('qz-quit').onclick=()=>{qz=null;$('qz-run').hidden=true;$('qz-start').hidden=false};
