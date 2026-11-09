/* ---------- preflop spots ----------
   Starter charts approximating common 6-max baselines. Edit the range strings to match your own study charts.
   Range notation: 77+ · 22-66 · A2s+ · KTo+ · A5s-A2s. When a hand appears in two actions, the first one wins.
   sp(game, type, stack BB, hero, villain, [ranges by action], {o: open size, tb: 3-bet size}) */
const TYPES={open:'Opening',vsopen:'Facing an open',vs3bet:'Facing a 3-bet',shove:'Shove or fold',callshove:'Calling a shove',reshove:'Re-shove'};
function sp(game,type,stack,hero,vil,r,x={}){
  const acts={open:['Raise','Fold'],vsopen:r.length>1?['3-bet','Call','Fold']:['3-bet','Fold'],vs3bet:['4-bet','Call','Fold'],
    shove:['Shove','Fold'],callshove:['Call','Fold'],reshove:r.length>1?['Shove','Call','Fold']:['Shove','Fold']}[type];
  const o=x.o??(game==='cash'?(hero==='SB'||vil==='SB'?3:2.5):stack>=40?2.2:2);
  const sfx=game==='tour'?`, ${stack} BB`:'';
  const name={open:`${hero} open${sfx}`,vsopen:`${hero} vs ${vil} open${sfx}`,vs3bet:`${hero} open vs ${vil} 3-bet${sfx}`,
    shove:`${hero} shove${sfx}`,callshove:`${hero} vs ${vil} shove${sfx}`,reshove:`${hero} re-shove vs ${vil}${sfx}`}[type];
  return{id:(game+'-'+name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),game,type,stack,hero,vil,r,acts,o,tb:x.tb,name}}
const SPOTS=[
 /* cash, 100 BB */
 sp('cash','open',100,'UTG',null,['55+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+,QJo']),
 sp('cash','open',100,'HJ',null,['44+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,87s,76s,65s,A9o+,KTo+,QTo+,JTo']),
 sp('cash','open',100,'CO',null,['22+,A2s+,K6s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,65s,54s,A8o+,A5o,KTo+,QTo+,JTo']),
 sp('cash','open',100,'BTN',null,['22+,A2s+,K2s+,Q3s+,J5s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K8o+,Q9o+,J9o+,T8o+,98o,87o']),
 sp('cash','open',100,'SB',null,['22+,A2s+,K3s+,Q5s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A4o+,K8o+,Q9o+,J9o+,T9o']),
 sp('cash','vsopen',100,'CO','HJ',['TT+,AJs+,KQs,AQo+,A5s-A4s','22+,ATs+,KTs+,QTs+,JTs,T9s,98s,AJo,KQo']),
 sp('cash','vsopen',100,'BTN','UTG',['QQ+,AKs,AKo,A5s','22+,ATs+,KTs+,QTs+,J9s+,T9s,98s,87s,76s,AQo,KQo']),
 sp('cash','vsopen',100,'BTN','CO',['TT+,AJs+,KQs,AQo+,A5s-A4s,K9s,65s','22+,A9s+,KTs+,QTs+,J9s+,T9s,98s,87s,76s,AJo,KQo']),
 sp('cash','vsopen',100,'SB','CO',['88+,A9s+,A5s-A4s,KTs+,QTs+,JTs,AJo+,KQo']),
 sp('cash','vsopen',100,'SB','BTN',['77+,A8s+,A5s-A3s,KTs+,QTs+,JTs,T9s,ATo+,KJo+']),
 sp('cash','vsopen',100,'BB','UTG',['QQ+,AKs,AKo,A5s-A4s','22+,A2s+,K9s+,Q9s+,J9s+,T8s+,97s+,86s+,75s+,64s+,54s,AJo+,KQo']),
 sp('cash','vsopen',100,'BB','CO',['TT+,AJs+,KQs,AQo+,A5s-A3s,K9s,T8s,76s','22+,A2s+,K5s+,Q7s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A7o+,KTo+,QTo+,JTo,T9o']),
 sp('cash','vsopen',100,'BB','BTN',['99+,ATs+,KJs+,AJo+,KQo,A5s-A2s,K8s,Q9s,J9s,T8s,76s,65s','22+,A2s+,K2s+,Q2s+,J5s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K6o+,Q8o+,J8o+,T8o+,97o+,87o,76o']),
 sp('cash','vsopen',100,'BB','SB',['TT+,A9s+,KTs+,QJs,A5s-A2s,K7s,Q8s,J8s,T8s,97s,86s,75s,AJo+,KQo','22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K5o+,Q7o+,J8o+,T8o+,98o,87o']),
 sp('cash','vs3bet',100,'UTG','BTN',['KK+,AKs,A5s','88+,AJs+,KQs,AKo,QJs,JTs'],{tb:7.5}),
 sp('cash','vs3bet',100,'CO','BTN',['QQ+,AKs,AKo,A5s','77+,ATs+,KTs+,QTs+,JTs,T9s,98s,AQo'],{tb:7.5}),
 sp('cash','vs3bet',100,'BTN','BB',['QQ+,AKs,AKo,A5s-A4s','22+,A6s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,76s,65s,ATo+,KJo+'],{tb:10}),
 /* tournament */
 sp('tour','open',40,'UTG',null,['66+,A8s+,A5s,KTs+,QTs+,JTs,T9s,ATo+,KJo+']),
 sp('tour','open',40,'HJ',null,['55+,A4s+,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo']),
 sp('tour','open',40,'CO',null,['33+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,87s,76s,A8o+,KTo+,QTo+,JTo']),
 sp('tour','open',40,'BTN',null,['22+,A2s+,K3s+,Q5s+,J6s+,T6s+,96s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T9o']),
 sp('tour','open',40,'SB',null,['22+,A2s+,K4s+,Q6s+,J7s+,T7s+,97s+,86s+,76s,65s,A5o+,K9o+,QTo+,JTo'],{o:2.5}),
 sp('tour','open',25,'UTG',null,['66+,A9s+,A5s,KTs+,QJs,AJo+,KQo']),
 sp('tour','open',25,'CO',null,['44+,A2s+,K8s+,Q9s+,J9s+,T9s,A9o+,KTo+,QJo']),
 sp('tour','open',25,'BTN',null,['22+,A2s+,K5s+,Q7s+,J7s+,T7s+,97s+,86s+,76s,A3o+,K9o+,Q9o+,J9o+']),
 sp('tour','vsopen',40,'BTN','CO',['TT+,AQs+,AKo,A5s','22+,ATs+,KTs+,QTs+,JTs,T9s,98s,AJo,KQo']),
 sp('tour','vsopen',40,'BB','UTG',['QQ+,AKs,AKo','22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,76s,65s,ATo+,KJo+,QJo']),
 sp('tour','vsopen',40,'BB','CO',['JJ+,AQs+,AKo,A5s','22+,A2s+,K5s+,Q7s+,J7s+,T7s+,96s+,86s+,75s+,65s,54s,A5o+,K9o+,Q9o+,J9o+,T9o']),
 sp('tour','vsopen',40,'BB','BTN',['TT+,AJs+,KQs,AQo+,A5s-A4s','22+,A2s+,K2s+,Q2s+,J4s+,T6s+,95s+,85s+,74s+,63s+,53s+,43s,A2o+,K4o+,Q7o+,J7o+,T7o+,97o+,87o,76o']),
 sp('tour','reshove',20,'BTN','CO',['77+,A8s+,A5s-A4s,KTs+,QJs,ATo+,KQo']),
 sp('tour','reshove',20,'SB','BTN',['55+,A2s+,K9s+,QTs+,JTs,A8o+,KJo+']),
 sp('tour','reshove',20,'BB','BTN',['77+,A8s+,A5s-A4s,KTs+,QJs,ATo+,KQo','22+,A2s+,K2s+,Q5s+,J7s+,T7s+,97s+,86s+,75s+,65s,A2o+,K8o+,Q9o+,J9o+']),
 sp('tour','shove',15,'CO',null,['33+,A2s+,K8s+,Q9s+,J9s+,T9s,A8o+,KJo+']),
 sp('tour','shove',15,'BTN',null,['22+,A2s+,K5s+,Q8s+,J8s+,T8s+,98s,A7o+,A5o,KTo+,QJo']),
 sp('tour','shove',15,'SB',null,['22+,A2s+,K2s+,Q5s+,J7s+,T7s+,97s+,87s,A2o+,K7o+,Q9o+,J9o+']),
 sp('tour','shove',10,'UTG',null,['22+,A2s+,K8s+,Q9s+,J9s+,T9s,A7o+,KTo+,QJo']),
 sp('tour','shove',10,'HJ',null,['22+,A2s+,K6s+,Q8s+,J8s+,T8s+,98s,A4o+,K9o+,QTo+,JTo']),
 sp('tour','shove',10,'CO',null,['22+,A2s+,K3s+,Q6s+,J7s+,T7s+,97s+,87s,A2o+,K8o+,Q9o+,J9o+,T9o']),
 sp('tour','shove',10,'BTN',null,['22+,A2s+,K2s+,Q3s+,J5s+,T6s+,96s+,86s+,75s+,65s,A2o+,K5o+,Q8o+,J8o+,T8o+,98o']),
 sp('tour','shove',10,'SB',null,['22+,A2s+,K2s+,Q2s+,J3s+,T5s+,95s+,85s+,74s+,64s+,53s+,43s,A2o+,K2o+,Q6o+,J7o+,T7o+,97o+,87o']),
 sp('tour','callshove',15,'BB','CO',['55+,A7s+,A5s-A4s,KTs+,QJs,ATo+,KQo']),
 sp('tour','callshove',10,'BB','BTN',['22+,A2s+,K5s+,Q8s+,J9s+,T9s,A2o+,K9o+,QTo+']),
 sp('tour','callshove',10,'BB','SB',['22+,A2s+,K2s+,Q4s+,J7s+,T7s+,97s+,87s,A2o+,K5o+,Q8o+,J9o+,T9o']),
 sp('tour','callshove',10,'SB','BTN',['55+,A7s+,A5s,KTs+,QJs,A9o+,KQo']),
];
SPOTS.forEach(s=>{s.map=new Map();s.r.forEach((str,a)=>parseRange(str).forEach(l=>{if(!s.map.has(l))s.map.set(l,a)}));
  s.fold=s.acts.length-1;const act=l=>s.map.get(l)??s.fold;s.boundary=[];
  for(let i=0;i<13;i++)for(let j=0;j<13;j++){const l=gridLabel(i,j),x=act(l);
    if([[1,0],[-1,0],[0,1],[0,-1]].some(([di,dj])=>{const a=i+di,b=j+dj;return a>=0&&a<13&&b>=0&&b<13&&act(gridLabel(a,b))!==x}))s.boundary.push(l)}});
const spotByName=n=>SPOTS.find(s=>s.name===n);

/* the situation in words, and the table state */
function spotText(s){const st=s.stack,o=fmtBB(s.o);
  switch(s.type){
   case'open':return `Folds to you in the ${POSNAME[s.hero]}. ${st} BB deep. Open to ${o} BB or fold?`;
   case'vsopen':return `The ${POSNAME[s.vil]} opens to ${o} BB${s.hero==='BB'&&s.vil!=='SB'?' and the small blind folds':''}. You are in the ${POSNAME[s.hero]} with ${st} BB.`;
   case'vs3bet':return `You opened to ${o} BB from the ${POSNAME[s.hero]} and the ${POSNAME[s.vil]} 3-bets to ${fmtBB(s.tb)} BB. Everyone else folds.`;
   case'shove':return `Folds to you in the ${POSNAME[s.hero]} with ${st} BB, antes in play. Shove all in or fold?`;
   case'callshove':return `The ${POSNAME[s.vil]} shoves all in for ${st} BB. You are in the ${POSNAME[s.hero]}. Call or fold?`;
   case'reshove':return `The ${POSNAME[s.vil]} opens to ${o} BB. You have ${st} BB in the ${POSNAME[s.hero]}.`;
  }}
function spotTable(s){
  const hi=POS.indexOf(s.hero),vi=s.vil?POS.indexOf(s.vil):-1,st=s.stack,seats={};
  POS.forEach(p=>seats[p]={state:'wait',bet:0,tag:''});seats.SB.bet=.5;seats.BB.bet=1;
  let dead=s.game==='tour'?1:0;
  const fold=i=>{seats[POS[i]].state='folded';seats[POS[i]].tag='Fold'};
  if(s.type==='open'||s.type==='shove'){for(let i=0;i<hi;i++)fold(i)}
  else if(s.type==='vs3bet'){POS.forEach((p,i)=>{if(i!==hi&&i!==vi)fold(i)});seats[s.hero].bet=s.o;seats[s.hero].tag='Opened';seats[s.vil].bet=s.tb;seats[s.vil].tag='3-bets'}
  else{for(let i=0;i<hi;i++)if(i!==vi)fold(i);
    if(s.type==='callshove'){seats[s.vil].bet=st;seats[s.vil].tag='All in'}else{seats[s.vil].bet=s.o;seats[s.vil].tag='Raises'}}
  POS.forEach(p=>{const z=seats[p];if(z.state==='folded'&&z.bet){dead+=z.bet;z.bet=0}});
  seats[s.hero].state='hero';if(!seats[s.hero].tag)seats[s.hero].tag='You';if(s.vil)seats[s.vil].state='vil';
  let pot=dead;POS.forEach(p=>pot+=seats[p].bet);
  POS.forEach(p=>{const z=seats[p];z.stack=fmtBB(st-z.bet)+' BB';z.bet=z.bet?fmtBB(z.bet):''});
  return{hero:s.hero,seats,center:`<span>Pot</span><b>${fmtBB(pot)} BB</b>${s.game==='tour'?'<span>incl. 1 BB ante</span>':''}`}}

/* ---------- preflop trainer ---------- */
let pf;
function pfPool(){const t=$('pf-type').value,st=$('pf-stack').value;
  return SPOTS.filter(s=>s.game===mode&&(t==='all'||s.type===t)&&(st==='all'||String(s.stack)===st))}
function buildPfSetup(keepSpot){
  const inGame=SPOTS.filter(s=>s.game===mode),tSel=$('pf-type'),stSel=$('pf-stack');
  const types=[...new Set(inGame.map(s=>s.type))],tv=types.includes(tSel.value)?tSel.value:'all';
  tSel.innerHTML='<option value="all">All spot types</option>'+types.map(t=>`<option value="${t}">${TYPES[t]}</option>`).join('');tSel.value=tv;
  const stacks=[...new Set(inGame.filter(s=>tv==='all'||s.type===tv).map(s=>s.stack))].sort((a,b)=>b-a);
  $('pf-stack-wrap').hidden=mode==='cash';
  const sv=stacks.map(String).includes(stSel.value)?stSel.value:'all';
  stSel.innerHTML='<option value="all">Any stack</option>'+stacks.map(x=>`<option value="${x}">${x} BB</option>`).join('');stSel.value=sv;
  const sel=$('pf-spot'),keep=keepSpot||sel.value,pool=pfPool();
  sel.innerHTML=`<option value="focus">Focus mode: weak spots first</option><option value="random">Random spot</option>`+pool.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  sel.value=[...sel.options].some(o=>o.value===keep)?keep:'focus'}
function missesFor(spot){return historyRows().filter(r=>r.drill==='Preflop'&&r.spot===spot.name&&cv(r.correct)===false&&r.hand).map(r=>r.hand)}
function focusSpot(list){const ag=new Map(aggregate(historyRows().filter(r=>r.drill==='Preflop')).map(a=>[a.spot,a]));
  return weightedPick(list,list.map(s=>weakWeight(ag.get(s.name))))}
function comboFor(l){const c=labelCombos(l);return pick(c).slice()}
function dealSpotHand(spot,missRate=.2){const miss=missesFor(spot),x=Math.random();let label;
  if(miss.length&&x<missRate)label=pick(miss);else if(x<.6)label=pick(spot.boundary);
  let cards;if(label)cards=comboFor(label);else{const d=shuffled();cards=d.slice(0,2);label=labelOf(cards[0],cards[1])}
  if(cards[0]>>2<cards[1]>>2)cards.reverse();return{label,cards}}
function newPF(){const pool=pfPool(),sel=$('pf-spot').value;
  if(!pool.length){$('pf-text').textContent='No spots match these filters.';return}
  const spot=sel==='focus'?focusSpot(pool):sel==='random'?pick(pool):SPOTS.find(s=>s.id===sel)||pick(pool);
  const {label,cards}=dealSpotHand(spot);
  pf={spot,label,cards,exp:spot.map.get(label)??spot.fold,done:false,t0:Date.now()};
  renderTable($('pf-table'),{...spotTable(spot),heroCards:cards});
  $('pf-name').textContent=spot.name;$('pf-text').textContent=spotText(spot);$('pf-hand').innerHTML=cardsHTML(cards);
  $('pf-acts').innerHTML=spot.acts.map((a,i)=>`<button class="act ${i===spot.fold?'ghost':''}" data-a="${i}">${a}</button>`).join('')+`<button class="act ghost" data-next="1">Skip</button>`;
  $('pf-out').innerHTML=`<p class="small muted">Answer to see the full ${spot.name} chart.</p>`}
function rangeGrid(spot,cur){let h='';for(let i=12;i>=0;i--)for(let j=12;j>=0;j--){const l=gridLabel(i,j),a=spot.map.get(l);
  h+=`<span class="${a!=null?'a'+a:''}${l===cur?' cur':''}" title="${l}: ${spot.acts[a??spot.fold]}">${l}</span>`}return `<div class="rgrid" role="img" aria-label="${spot.name} chart">${h}</div>`}
function chartLegend(s){const tot=a=>[...s.map].filter(([,x])=>x===a).reduce((q,[l])=>q+combosOf(l),0);
  return `<div class="legend">${s.acts.slice(0,-1).map((a,k)=>`<span><i style="background:var(--${k?'chip':'range'})"></i>${a} ${pct(tot(k)/1326)}</span>`).join('')}<span><i style="background:var(--line)"></i>Fold</span></div>`}
/* a one-line reason for the chart's answer */
function pfWhy(s,label,exp){const act=s.acts[exp],pair=label.length===2,suited=label[2]==='s',hiR=R.indexOf(label[0]);
  const shape=pair?'pair':suited?'suited hand':'offsuit hand';
  if(exp===s.fold){
    if(s.type==='open'||s.type==='shove')return `${label} is just outside the ${s.hero} range. Earlier seats have more players left to act behind them, so they need stronger hands.`;
    return `${label} does not do well enough against the ${s.vil}'s range to continue at this price.`}
  if(act==='3-bet'||act==='4-bet'){
    if(label.startsWith('A')&&!pair&&R.indexOf(label[1])<=3&&suited)return `${label} is a bluff ${act.toLowerCase()}: the ace blocks villain's strongest hands and it can still make straights and flushes.`;
    return `${label} is strong enough to raise for value against the ${s.vil}'s range.`}
  if(act==='Call')return s.type==='callshove'?`${label} has enough equity against a ${s.stack} BB shoving range to call at this price.`
    :`${label} plays well enough to continue, but is not strong enough to raise. ${/^[aeiou]/.test(shape)?'An':'A'} ${shape} like this does best seeing a flop.`;
  if(act==='Shove')return `At ${s.stack} BB, ${label} wins enough when called, plus the blinds and antes when everyone folds, to make shoving profitable.`;
  return `${label} is inside the ${s.hero} opening range.`}
function pfAnswer(i){const p=pf,ok=i===p.exp,s=p.spot;
  if(!p.done){p.done=true;stats.pf.n++;if(ok){stats.pf.c++;stats.pf.streak++}else stats.pf.streak=0;save();pfStats();
    logEvent({drill:'Preflop',spot:s.name,hand:p.label,answer:s.acts[i],expected:s.acts[p.exp],correct:ok,detail:names(p.cards),ms:Date.now()-p.t0})}
  $('pf-out').innerHTML=`<div class="verdict ${ok?'good':'bad'}"><strong>${ok?'Correct':'Chart says '+s.acts[p.exp]}</strong><span>${pfWhy(s,p.label,p.exp)}</span></div>
   ${rangeGrid(s,p.label)}${chartLegend(s)}`;
  $('pf-acts').querySelectorAll('[data-a]').forEach(b=>{b.disabled=true;if(+b.dataset.a===p.exp)b.classList.add('pickok');else if(+b.dataset.a===i)b.classList.add('pickbad')});
  const nx=$('pf-acts').querySelector('[data-next]');nx.textContent='Next hand';nx.classList.remove('ghost');nx.focus()}
function pfStats(){$('pf-score').textContent=`${stats.pf.c}/${stats.pf.n}`;$('pf-streak').textContent=stats.pf.streak}
$('pf-acts').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.next)newPF();else pfAnswer(+b.dataset.a)};
$('pf-type').onchange=()=>{buildPfSetup();newPF()};$('pf-stack').onchange=()=>{buildPfSetup();newPF()};$('pf-spot').onchange=newPF;
