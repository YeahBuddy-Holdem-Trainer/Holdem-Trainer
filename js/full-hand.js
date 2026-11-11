/* ---------- full-hand practice ----------
   Play one heads-up hand, preflop to river, against an opponent type.
   The opponent plays from a simple model: its hand strength tier on the current board, its type's tendencies, and the bet size.
   Preflop decisions are graded against the charts. Postflop decisions are graded by expected value one street ahead:
   for each option we simulate the opponent's range (narrowed by the model through their actions so far) and their responses. */
const FH_TYPES={
  rec:{name:'Typical recreational player',desc:'Calls too much preflop, rarely 3-bets, raises strong hands on wet boards, stabs small when checked to, and bets big mostly with strong hands.',
    tip:'Bet big into their capped ranges, give up bluffs when they bet big, and call down lighter against their small stabs.'},
  station:{name:'Calling station',desc:'Calls with almost anything that has a piece of the board and rarely raises or bluffs.',
    tip:'Value-bet thinner and bigger, and almost never bluff.'},
  nit:{name:'Nit',desc:'Plays few hands, bets and raises only with strong hands, and folds to pressure.',
    tip:'Bluff more, value-bet thinner less often, and fold when they show aggression.'},
  aggro:{name:'Aggressive player',desc:'Bluffs and raises often, and barrels draws and air.',
    tip:'Call down lighter, let them bluff into you, and raise strong hands for value.'}};
/* preflop ranges by opponent type. vs: response to your open (3-bet / call). open: their button open. d3: response to your 3-bet (4-bet jam / call). j4: jams over your 4-bet. */
const FH_PRE={
  rec:{vs3:'QQ+,AKs,AKo',vsc:'22-JJ,A2s+,K2s+,Q5s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A7o+,KTo+,QTo+,JTo,AQs-A2s',open:null,d3j:'KK+',d3c:'QQ-66,ATs+,KJs+,QJs,JTs,T9s,98s,AJo+,KQo',j4:'KK+,AKs'},
  station:{vs3:'KK+',vsc:'22-QQ,A2s+,K2s+,Q2s+,J5s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K7o+,Q8o+,J8o+,T8o+,98o,87o,AKs,AKo',open:'22+,A2s+,K2s+,Q2s+,J4s+,T6s+,95s+,85s+,74s+,63s+,53s+,43s,A2o+,K5o+,Q7o+,J8o+,T8o+,97o+,87o,76o',d3j:'KK+',d3c:'QQ-22,A2s+,K8s+,Q9s+,J9s+,T9s,98s,87s,ATo+,KJo+,QJo',j4:'KK+'},
  nit:{vs3:'QQ+,AKs,AKo',vsc:'22-JJ,ATs+,KTs+,QJs,JTs,AQo',open:'44+,A8s+,KTs+,QTs+,JTs,ATo+,KJo+',d3j:'QQ+,AKs,AKo',d3c:'JJ-99,AQs',j4:'QQ+,AKs,AKo'},
  aggro:{vs3:'TT+,AJs+,KQs,AQo+,A5s-A2s,K9s,T8s,76s,65s',vsc:'22-99,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,54s,ATo+,KTo+,QTo+,JTo',open:'22+,A2s+,K2s+,Q2s+,J4s+,T5s+,95s+,84s+,74s+,63s+,53s+,43s,A2o+,K6o+,Q8o+,J8o+,T8o+,97o+,87o,76o',d3j:'QQ+,AKs,AKo,A5s,A4s',d3c:'JJ-55,ATs+,KTs+,QTs+,JTs,T9s,98s,87s,AQo,KQo',j4:'JJ+,AKs,AKo,AQs'}};
const FH_SEATS={BTN:{hero:'BTN',vil:'BB',open:'cash-btn-open',vs3:'cash-btn-open-vs-bb-3-bet'},CO:{hero:'CO',vil:'BTN',open:'cash-co-open',vs3:'cash-co-open-vs-btn-3-bet'},BB:{hero:'BB',vil:'BTN',def:'cash-bb-vs-btn-open'}};
const FH_SZ={small:.33,medium:.6,large:.85,over:1.4};

/* opponent hand strength tier on a board */
function fhTier(c,board){const {made,draw}=rvbClassify(c,board);
  if(RVB_STRONG.has(made))return 'monster';if(made==='overpair'||made==='tpgk')return 'strong';
  const big=draw==='combo'||draw==='fd'||draw==='oesd';
  if(['tpwk','ppbelow','middle'].includes(made))return big?'draw':'medium';if(big)return 'draw';if(made==='weak')return 'weak';if(draw==='gut')return 'gut';return 'air'}
/* facing a bet: [call, raise] at about half pot */
const FH_FACE={
  rec:{monster:[.45,.55],strong:[.9,.08],medium:[.7,0],weak:[.35,0],draw:[.75,.1],gut:[.35,0],air:[.06,.02]},
  station:{monster:[.75,.25],strong:[.97,.02],medium:[.93,0],weak:[.7,0],draw:[.9,.03],gut:[.6,0],air:[.25,0]},
  nit:{monster:[.5,.5],strong:[.85,.05],medium:[.45,0],weak:[.1,0],draw:[.6,.05],gut:[.12,0],air:[.02,0]},
  aggro:{monster:[.3,.7],strong:[.75,.2],medium:[.65,.05],weak:[.35,.05],draw:[.5,.35],gut:[.3,.15],air:[.08,.15]}};
function fhFacing(type,tier,f,isRaise){let [c,r]=FH_FACE[type][tier];
  if(tier!=='monster'&&tier!=='strong')c*=Math.min(1.1,Math.max(.3,type==='station'?1.1-.2*f:1.25-.5*f));
  /* strong hands (overpair, top pair good kicker) only fold to big bets with deep stacks: almost never to a small bet,
     and never when the stacks are short compared with the pot (a nit doesn't fold top pair top kicker for 2 BB) */
  if(tier==='strong'&&!isRaise){const spr=fh&&fh.pot?fh.stack.vil/fh.pot:9,fold=(1-c-r)*Math.min(1,Math.pow(f/.75,2))*(spr<3?0:spr<6?.5:1);c=1-r-fold}
  if(isRaise){c=Math.min(1,c+r);r=0;if(tier!=='monster'&&tier!=='strong')c*=.7}
  c=Math.min(c,1-r);return{fold:1-c-r,call:c,raise:r}}
/* checked to or first to act: [bet probability, size] */
const FH_BET={
  rec:{monster:[.8,'large'],strong:[.7,'large'],medium:[.5,'small'],weak:[.45,'small'],draw:[.6,'small'],gut:[.4,'small'],air:[.45,'small']},
  station:{monster:[.7,'medium'],strong:[.45,'medium'],medium:[.15,'small'],weak:[.05,'small'],draw:[.1,'small'],gut:[.05,'small'],air:[.05,'small']},
  nit:{monster:[.85,'large'],strong:[.55,'medium'],medium:[.15,'small'],weak:[.05,'small'],draw:[.25,'medium'],gut:[.05,'small'],air:[.08,'small']},
  aggro:{monster:[.85,'over'],strong:[.75,'large'],medium:[.55,'medium'],weak:[.5,'medium'],draw:[.85,'large'],gut:[.6,'large'],air:[.6,'large']}};
function fhBetProb(type,tier,role){let [p,size]=FH_BET[type][tier];
  if(role==='donk')p*=type==='aggro'?.4:tier==='monster'?.3:.12;
  if(role==='cbet'&&['weak','air','gut','medium'].includes(tier))p=Math.min(.9,p*1.4);
  return{p,size}}

const fhKey=c=>c[0]<c[1]?c[0]*52+c[1]:c[1]*52+c[0];
function fhRange(str,dead){const d=new Set(dead);return [...parseRange(str)].flatMap(labelCombos).filter(c=>!d.has(c[0])&&!d.has(c[1])).map(c=>({c,w:1}))}
function fhSpotRange(id,act,dead){const s=SPOTS.find(x=>x.id===id),d=new Set(dead);return [...s.map].filter(([,a])=>a===act).flatMap(([l])=>labelCombos(l)).filter(c=>!d.has(c[0])&&!d.has(c[1])).map(c=>({c,w:1}))}

let fh=null;
const FHKEY='holdem-hands-v1';
stats.fh=stats.fh||{hands:0,dec:0,good:0,net:0};

/* ---------- dealing and preflop ---------- */
function fhDeal(){$('fh-out').innerHTML='<p class="small muted">Feedback on each decision appears here.</p>';if(mode!=='cash')return fhtDeal();
  const type=$('fh-type').value==='random'?pick(Object.keys(FH_TYPES)):$('fh-type').value;
  const seat=$('fh-seat').value==='random'?pick(['BTN','CO','BB']):$('fh-seat').value,S=FH_SEATS[seat],playable=$('fh-play').checked;
  let hero,vil,deck;
  for(let tries=0;tries<500;tries++){deck=shuffled();hero=deck.slice(0,2);
    if(playable){const l=handLabel(hero),sp=SPOTS.find(x=>x.id===(S.open||S.def));if(!sp.map.has(l))continue}break}
  const pre=FH_PRE[type],deadH=new Set(hero);
  /* the opponent's hand: from the range that continues, most of the time */
  let vrange;
  if(seat==='BB')vrange=pre.open?fhRange(pre.open,hero):fhSpotRange('cash-btn-open',0,hero);
  else vrange=Math.random()<.85?fhRange(pre.vs3+','+pre.vsc,hero):fhRange('22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s,A2o+,K2o+,Q2o+,J2o+,T2o+,92o+,82o+,72o+,62o+,52o+,42o+,32o',hero);
  vil=pick(vrange).c.slice();
  const rest=deck.filter(c=>!deadH.has(c)&&c!==vil[0]&&c!==vil[1]);
  fh={type,seat,S,hero,vil,board:rest.slice(0,5),street:0,pot:.5,inv:{hero:0,vil:0},stack:{hero:100,vil:100},
    pfr:null,ip:seat==='BB'?'vil':seat==='BTN'?'hero':'vil',log:[],dec:[],done:false,result:null,vw:null,t0:Date.now(),ts:new Date().toISOString(),acts:[]};
  /* blinds: the small blind is dead money; the big blind is posted by whichever player sits there */
  fh.streetIn={hero:0,vil:0};
  if(S.hero==='BB'){fhPut('hero',1);fh.streetIn.hero=1}else if(S.vil==='BB'){fhPut('vil',1);fh.streetIn.vil=1}else fh.pot+=1;
  fhLog('Preflop',`${FH_TYPES[type].name} in the ${POSNAME[S.vil]}. You are in the ${POSNAME[S.hero]}, 100 BB deep.`);
  if(seat==='BB'){fhVilOpen()}else fhAsk('pre-open')}
function fhPut(who,amt){amt=Math.min(amt,fh.stack[who]);fh.stack[who]-=amt;fh.inv[who]+=amt;fh.pot+=amt;return amt}
/* raise to a total of x this street (preflop totals include blinds) */
function fhTo(who,x){const add=fhPut(who,Math.max(0,x-fh.streetIn[who]));fh.streetIn[who]+=add}
function fhLog(street,text,who){fh.log.push({street,text,who:who||'',board:fh.street?fh.board.slice(0,[0,3,4,5][fh.street]):[],pot:fh.pot,
  s:{h:fh.stack.hero,v:fh.stack.vil,bh:fh.streetIn?fh.streetIn.hero:0,bv:fh.streetIn?fh.streetIn.vil:0}})}
function fhVilOpen(){fhTo('vil',2.5);fh.pfr='vil';fhLog('Preflop','Folds to the button, who opens to 2.5 BB. The small blind folds.','vil');fhAsk('pre-def')}

/* ---------- hero decision points ---------- */
function fhAsk(kind){fh.ask=kind;fhRender();
  const b=$('fh-acts'),toCall=fh.streetIn?Math.max(0,fh.streetIn.vil-fh.streetIn.hero):0;let h='';
  if(kind.startsWith('t-'))h=fhtButtons(kind);
  else if(kind==='pre-open')h=`<button class="act" data-a="raise">Raise to 2.5 BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  else if(kind==='pre-def')h=`<button class="act" data-a="3bet">3-bet to 10 BB</button><button class="act" data-a="call">Call 1.5 BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  else if(kind==='pre-vs3')h=`<button class="act" data-a="4bet">4-bet to ${fh.seat==='CO'?20:22} BB</button><button class="act" data-a="call">Call ${fmtBB(toCall)} BB</button><button class="act ghost" data-a="fold">Fold</button>`;
  else if(kind==='pre-jam')h=`<button class="act" data-a="call">Call all in (${fmtBB(Math.min(toCall,fh.stack.hero))} BB)</button><button class="act ghost" data-a="fold">Fold</button>`;
  else{const opts=fhOptions();h=opts.map(o=>`<button class="act ${o.id==='fold'||o.id==='check'?'ghost':''}" data-a="${o.id}">${o.label}</button>`).join('')}
  b.innerHTML=h}
function fhOptions(){const P=fh.pot,toCall=Math.max(0,fh.streetIn.vil-fh.streetIn.hero),st=fh.stack.hero,o=[];
  if(!toCall){o.push({id:'check',label:'Check',kind:'check'});
    for(const k of['small','medium','large','over']){const b=Math.round(FH_SZ[k]*P*2)/2;if(b<st)o.push({id:k,label:`${SZB[SZI[k]].name} ${fmtBB(b)} BB`,kind:'bet',amt:b})}
    if(st<=3*P)o.push({id:'jam',label:`All in ${fmtBB(st)} BB`,kind:'bet',amt:st})}
  else{o.push({id:'fold',label:'Fold',kind:'fold'});o.push({id:'call',label:`Call ${fmtBB(Math.min(toCall,st))} BB`,kind:'call',amt:Math.min(toCall,st)});
    if(!fh.raised&&st>toCall){const R=Math.round((fh.streetIn.vil*3+(P-fh.streetIn.vil-fh.streetIn.hero)*.5)*2)/2,add=R-fh.streetIn.hero;
      if(add<st*.6)o.push({id:'raise',label:`Raise to ${fmtBB(R)} BB`,kind:'raise',to:R});o.push({id:'jam',label:`All in ${fmtBB(st+fh.streetIn.hero)} BB`,kind:'raise',to:st+fh.streetIn.hero})}}
  return o}
$('fh-acts').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b||!fh||fh.done)return;$('fh-acts').innerHTML='';const a=b.dataset.a;
  if(fh.ask.startsWith('t-'))fhtPre(a);else if(fh.ask.startsWith('pre'))fhPre(a);else fhPost(a)};

/* chart grading for preflop */
const handLabel=c=>{const a=c[0]>>2,b=c[1]>>2,hi=Math.max(a,b),lo=Math.min(a,b);return a===b?R[a]+R[b]:R[hi]+R[lo]+((c[0]&3)===(c[1]&3)?'s':'o')};
function fhChart(id,choice,map){const s=SPOTS.find(x=>x.id===id),l=handLabel(fh.hero),exp=s.acts[s.map.get(l)??s.fold];
  const ok=map[choice]===exp;fhGrade({street:'Preflop',spot:s.name,choice:map[choice],best:exp,ok,cost:ok?'best':'chart',why:ok?`The ${s.name} chart ${exp==='Fold'?'folds':'plays'} ${l} this way.`:`The ${s.name} chart says <b>${exp}</b> with ${l}. ${pfWhy(s,l,s.acts.indexOf(exp))}`})}
function fhPre(a){const S=fh.S,pre=FH_PRE[fh.type],l=handLabel(fh.hero);
  if(fh.ask==='pre-open'){fhChart(S.open,a,{raise:'Raise',fold:'Fold'});
    if(a==='fold'){fhLog('Preflop','You fold.','hero');return fhEnd('fold')}
    fhTo('hero',2.5);fh.pfr='hero';fhLog('Preflop',`You raise to 2.5 BB.${S.vil==='BTN'?'':' It folds to the big blind.'}`,'hero');
    const vl=handLabel(fh.vil);
    if(parseRange(pre.vs3).has(vl)){const x=S.vil==='BB'?10:8.5;fhTo('vil',x);fh.pfr='vil';fhLog('Preflop',`The ${POSNAME[S.vil]} 3-bets to ${x} BB.`,'vil');fh.vw=fhRange(pre.vs3,fh.hero);return fhAsk('pre-vs3')}
    if(parseRange(pre.vsc).has(vl)){fhTo('vil',2.5);fhLog('Preflop',`The ${POSNAME[S.vil]} calls.`,'vil');fh.vw=fhRange(pre.vsc,fh.hero);return fhFlop()}
    fhLog('Preflop',`The ${POSNAME[S.vil]} folds.`,'vil');return fhEnd('vilfold')}
  if(fh.ask==='pre-def'){fhChart(S.def,a,{'3bet':'3-bet',call:'Call',fold:'Fold'});
    if(a==='fold'){fhLog('Preflop','You fold.','hero');return fhEnd('fold')}
    const openR=pre.open||[...SPOTS.find(x=>x.id==='cash-btn-open').map.keys()].join(',');
    if(a==='call'){fhTo('hero',2.5);fhLog('Preflop','You call.','hero');fh.vw=fhRange(openR,fh.hero);return fhFlop()}
    fhTo('hero',10);fh.pfr='hero';fhLog('Preflop','You 3-bet to 10 BB.','hero');const vl=handLabel(fh.vil);
    if(parseRange(pre.d3j).has(vl)){fhTo('vil',100);fhLog('Preflop','The button moves all in.','vil');fh.vw=fhRange(pre.d3j,fh.hero);return fhAsk('pre-jam')}
    if(parseRange(pre.d3c).has(vl)){fhTo('vil',10);fhLog('Preflop','The button calls.','vil');fh.vw=fhRange(pre.d3c,fh.hero);return fhFlop()}
    fhLog('Preflop','The button folds.','vil');return fhEnd('vilfold')}
  if(fh.ask==='pre-vs3'){fhChart(S.vs3,a,{'4bet':'4-bet',call:'Call',fold:'Fold'});
    if(a==='fold'){fhLog('Preflop','You fold.','hero');return fhEnd('fold')}
    if(a==='call'){fhTo('hero',fh.streetIn.vil);fhLog('Preflop','You call.','hero');return fhFlop()}
    const x=fh.seat==='CO'?20:22;fhTo('hero',x);fh.pfr='hero';fhLog('Preflop',`You 4-bet to ${x} BB.`,'hero');
    if(parseRange(pre.j4).has(handLabel(fh.vil))){fhTo('vil',100);fhLog('Preflop',`The ${POSNAME[S.vil]} moves all in.`,'vil');fh.vw=fhRange(pre.j4,fh.hero);return fhAsk('pre-jam')}
    fhLog('Preflop',`The ${POSNAME[S.vil]} folds.`,'vil');return fhEnd('vilfold')}
  if(fh.ask==='pre-jam'){const raw=fh.streetIn.vil-fh.streetIn.hero,toCall=Math.min(raw,fh.stack.hero),eq=fhEq(fh.vw,[],5000),evC=eq*(fh.pot-(raw-toCall)+toCall)-toCall,best=evC>0?'call':'fold',ok=a===best;
    const loss=Math.abs(evC);fhGrade({street:'Preflop',spot:'Facing an all-in',choice:a==='call'?'Call':'Fold',best:best==='call'?'Call':'Fold',ok,cost:ok?'best':fhCostTier(loss,fh.pot),
      why:`You need ${pct(toCall/(fh.pot-(raw-toCall)+toCall))} equity to call; against this player's all-in range you have about ${pct(eq)}. Calling is worth ${evC>=0?'+':''}${fmtBB(Math.round(evC*10)/10)} BB.`,ev:[['Call',evC],['Fold',0]]});
    if(a==='fold'){fhLog('Preflop','You fold.','hero');return fhEnd('fold')}
    fhTo('hero',fh.streetIn.vil);fhLog('Preflop','You call all in.','hero');return fhRunout()}}

/* ---------- postflop ---------- */
function fhFlop(){fh.street=1;fhStreet()}
function fhStreet(){fh.streetIn={hero:0,vil:0};fh.raised=false;fh.checks=0;fh.lastAgg=null;
  const nm=['','Flop','Turn','River'][fh.street];fhLog(nm,`${nm}: ${names(fh.board.slice(0,[0,3,4,5][fh.street]))} · pot ${fmtBB(fh.pot)} BB`);
  if(fh.stack.hero<=0||fh.stack.vil<=0)return fhRunout();
  fh.toAct=fh.ip==='hero'?'vil':'hero';fhNext()}
function fhNext(){if(fh.done)return;if(fh.toAct==='vil')setTimeout(fhVil,350);else fhAsk('post')}
const fhBoardNow=()=>fh.board.slice(0,[0,3,4,5][fh.street]);
function fhStreetName(){return ['Preflop','Flop','Turn','River'][fh.street]}
/* opponent action */
function fhVil(){const board=fhBoardNow(),tier=fhTier(fh.vil,board),toCall=fh.streetIn.hero-fh.streetIn.vil,P=fh.pot,nm=fhStreetName();
  if(toCall>0){const f=toCall/(P-toCall),pr=fhFacing(fh.type,tier,f,fh.raised),x=Math.random();
    let act=x<pr.fold?'fold':x<pr.fold+pr.call?'call':'raise';if(act==='raise'&&fh.stack.vil<=toCall)act='call';
    if(act!=='fold')fhNarrow(c=>{const q=fhFacing(fh.type,fhTier(c,board),f,fh.raised);return act==='call'?q.call:q.raise});
    if(act==='fold'){fhLog(nm,`The ${POSNAME[fh.S.vil]} folds.`,'vil');return fhEnd('vilfold')}
    if(act==='call'){const put=fhPut('vil',toCall);fh.streetIn.vil+=put;fhLog(nm,`The ${POSNAME[fh.S.vil]} calls ${fmtBB(put)} BB${fh.stack.vil<=0?' and is all in':''}.`,'vil');return fhCloseStreet()}
    const R=Math.min(fh.streetIn.hero*3+(P-fh.streetIn.hero-fh.streetIn.vil)*.5,fh.stack.vil+fh.streetIn.vil);fhTo('vil',Math.round(R*2)/2);fh.raised=true;fh.lastAgg='vil';
    fhLog(nm,`The ${POSNAME[fh.S.vil]} raises to ${fmtBB(fh.streetIn.vil)} BB.`,'vil');fh.toAct='hero';return fhNext()}
  const role=fh.ip==='vil'?(fh.pfr==='vil'?'cbet':'stab'):(fh.pfr==='vil'?'cbet':'donk'),bp=fhBetProb(fh.type,tier,role),x=Math.random();
  const bets=x<bp.p;
  fhNarrow(c=>{const q=fhBetProb(fh.type,fhTier(c,board),role);return bets?(q.size===bp.size?q.p:0):1-q.p});
  if(!bets){fh.checks++;fhLog(nm,`The ${POSNAME[fh.S.vil]} checks.`,'vil');if(fh.checks>=2)return fhCloseStreet();fh.toAct='hero';return fhNext()}
  const b=Math.min(Math.round(FH_SZ[bp.size]*P*2)/2,fh.stack.vil);fhTo('vil',b);fh.lastAgg='vil';
  fhLog(nm,`The ${POSNAME[fh.S.vil]} bets ${fmtBB(b)} BB (${SZB[SZI[bp.size]].name.toLowerCase()}).`,'vil');fh.toAct='hero';fhNext()}
/* multiply the opponent's range weights by the chance each combo takes the action seen */
function fhNarrow(f){const board=new Set(fhBoardNow());let s=0;for(const x of fh.vw){if(board.has(x.c[0])||board.has(x.c[1])){x.w=0;continue}x.w*=f(x.c);s+=x.w}
  if(s<=1e-9)for(const x of fh.vw)if(!board.has(x.c[0])&&!board.has(x.c[1]))x.w=1}
function fhRefund(){for(const[a,b]of[['hero','vil'],['vil','hero']]){const d=fh.streetIn[a]-fh.streetIn[b];if(d>0&&fh.stack[b]<=0){fh.stack[a]+=d;fh.inv[a]-=d;fh.pot-=d;fh.streetIn[a]-=d}}}
function fhCloseStreet(){fhRefund();if(fh.street>=3)return fhShowdown();if(fh.stack.hero<=0||fh.stack.vil<=0)return fhRunout();fh.street++;fhStreet()}

/* equity of the hero against the weighted range, running out the rest of the board */
function fhSample(vw,board){const live=vw.filter(x=>x.w>0&&!board.includes(x.c[0])&&!board.includes(x.c[1])&&!fh.hero.includes(x.c[0])&&!fh.hero.includes(x.c[1]));
  const tot=live.reduce((s,x)=>s+x.w,0),cum=[];let a=0;for(const x of live){a+=x.w;cum.push(a)}
  return()=>{const r=Math.random()*tot;let lo=0,hi=cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<r)lo=m+1;else hi=m}return live[lo]}}
function fhRun(combo,board){const need=5-board.length;if(!need)return board;const dead=new Set([...fh.hero,...combo,...board]),out=board.slice();
  while(out.length<5){const c=Math.floor(Math.random()*52);if(!dead.has(c)){dead.add(c);out.push(c)}}return out}
function fhResult(combo,full){const a=evalHand(fh.hero.concat(full)),b=evalHand(combo.concat(full));return a>b?1:a===b?.5:0}
function fhEq(vw,board,N=3000){const smp=fhSample(vw,board);let s=0;for(let i=0;i<N;i++){const x=smp();s+=fhResult(x.c,fhRun(x.c,board))}return s/N}

/* expected value of each option, one street ahead */
function fhEvaluate(opts){const board=fhBoardNow(),P=fh.pot,hIn=fh.streetIn.hero,vIn=fh.streetIn.vil,smp=fhSample(fh.vw,board),N=4000,tierC=new Map();
  const tierOf=c=>{const k=fhKey(c);if(!tierC.has(k))tierC.set(k,fhTier(c,board));return tierC.get(k)};
  const acc=opts.map(()=>({f:0,c:0,cr:0,r:0,rr:0,all:0}));
  for(let i=0;i<N;i++){const x=smp(),r=fhResult(x.c,fhRun(x.c,board)),t=tierOf(x.c);
    opts.forEach((o,k)=>{const A=acc[k];A.all+=r;
      if(o.kind==='bet'){const q=fhFacing(fh.type,t,o.amt/P,false);A.f+=q.fold;A.c+=q.call;A.cr+=q.call*r;A.r+=q.raise;A.rr+=q.raise*r}
      else if(o.kind==='raise'){const add=o.to-vIn,q=fhFacing(fh.type,t,add/(P+add),true);A.f+=q.fold;A.c+=q.call;A.cr+=q.call*r}})}
  return opts.map((o,k)=>{const A=acc[k],eq=A.all/N;let ev,fold=null,eqc=null;
    if(o.kind==='check')ev=eq*P;
    else if(o.kind==='fold')ev=0;
    else if(o.kind==='call')ev=eq*(P+o.amt)-o.amt;
    else if(o.kind==='bet'){const b=o.amt,Rv=Math.max(b,Math.min(b*3+P*.5,fh.stack.vil)),tot=Math.min(Rv,fh.stack.hero),eqr=A.r?A.rr/A.r:0,evr=Math.max(-b,eqr*(P+2*tot)-tot);
      ev=(A.f/N)*P+(A.cr/N)*(P+2*b)-(A.c/N)*b+(A.r/N)*evr;fold=A.f/N;eqc=A.c?A.cr/A.c:null}
    else{const put=o.to-hIn,vadd=o.to-vIn;ev=(A.f/N)*P+(A.cr/N)*(P+put+vadd)-(A.c/N)*put;fold=A.f/N;eqc=A.c?A.cr/A.c:null}
    return{...o,ev,fold,eqc,eq}})}
function fhMath(res){const P=fh.pot,r1=x=>fmtBB(Math.round(x*10)/10);
  const line=o=>{if(o.kind==='fold')return `<li><b>${o.label}:</b> EV = 0 (you put nothing more in).</li>`;
    if(o.kind==='check')return `<li><b>${o.label}:</b> EV ≈ equity × pot = ${pct(o.eq,0)} × ${r1(P)} = <b>${r1(o.ev)} BB</b>.</li>`;
    if(o.kind==='call')return `<li><b>${o.label}:</b> EV = equity × (pot + call) − call = ${pct(o.eq,0)} × (${r1(P)} + ${r1(o.amt)}) − ${r1(o.amt)} = <b>${r1(o.ev)} BB</b>.</li>`;
    const b=o.kind==='bet'?o.amt:o.to-fh.streetIn.hero;
    return `<li><b>${o.label}:</b> EV ≈ fold% × pot + call% × (equity when called × final pot − your bet) = ${pct(o.fold,0)} × ${r1(P)} + ${pct(1-o.fold,0)} × (${pct(o.eqc||0,0)} × ${r1(P+2*b)} − ${r1(b)}) ≈ ${r1(o.fold*P+(1-o.fold)*((o.eqc||0)*(P+2*b)-b))} BB <span class="muted">(the table's ${r1(o.ev)} BB also counts the times they raise)</span>.</li>`};
  return mathBox(`<p class="small">Expected value (EV) is what an option wins or loses on average, in big blinds, counted from now. Your equity comes from your hand against their likely range on this board; how often they fold or call comes from the opponent type.</p><ul class="small math-steps">${res.map(line).join('')}</ul>`)}
function fhCostTier(loss,P){if(loss<=Math.max(.3,.05*P))return 'fine';if(loss<=.15*P)return 'small';if(loss<=.35*P)return 'medium';return 'big'}

function fhPost(a){const opts=fhOptions(),res=fhEvaluate(opts),pick_=res.find(o=>o.id===a),best=res.reduce((p,q)=>q.ev>p.ev?q:p),loss=best.ev-pick_.ev,cost=pick_.id===best.id?'best':fhCostTier(loss,fh.pot);
  const nm=fhStreetName(),facing=fh.streetIn.vil>fh.streetIn.hero,spot=`${nm} · ${facing?(fh.raised?'facing a raise':'facing a bet'):fh.toAct==='hero'&&fh.ip!=='hero'&&!fh.checks?'first to act':'checked to you'}`;
  const ok=cost==='best'||cost==='fine';
  fhGrade({street:nm,spot,choice:pick_.label,best:best.label,ok,cost,ev:res.map(o=>[o.label,o.ev,o.fold,o.eqc]),why:fhWhy(pick_,best,res,facing),math:fhMath(res)});
  const o=pick_;
  if(o.kind==='fold'){fhLog(nm,'You fold.','hero');return fhEnd('fold')}
  if(o.kind==='check'){fh.checks++;fhLog(nm,'You check.','hero');if(fh.checks>=2||fh.ip==='hero')return fhCloseStreet();fh.toAct='vil';return fhNext()}
  if(o.kind==='call'){fhPut('hero',o.amt);fh.streetIn.hero+=o.amt;fhLog(nm,`You call ${fmtBB(o.amt)} BB.`,'hero');return fhCloseStreet()}
  if(o.kind==='bet'){fhTo('hero',o.amt);fh.lastAgg='hero';fhLog(nm,`You bet ${fmtBB(o.amt)} BB.`,'hero')}
  else{fhTo('hero',o.to);fh.raised=true;fh.lastAgg='hero';fhLog(nm,`You raise to ${fmtBB(o.to)} BB.`,'hero')}
  fh.toAct='vil';fhNext()}
function fhWhy(p,b,res,facing){const t=FH_TYPES[fh.type],eq=res[0].eq;let s=`Against this ${t.name.toLowerCase()}'s likely range here, your hand has about <b>${pct(eq)}</b> equity. `;
  if(p.id===b.id)s+=`${p.label} is the best option against how they play.`;
  else s+=`<b>${b.label}</b> earns ${fmtBB(Math.round((b.ev-p.ev)*10)/10)} BB more on average than ${p.label.toLowerCase()}. `;
  if(!facing&&b.kind==='bet'&&b.fold!=null)s+=` At that size they fold about ${pct(b.fold,0)} of the time${b.eqc!=null?` and you have ${pct(b.eqc,0)} when called`:''}.`;
  if(facing){const call=res.find(o=>o.kind==='call');if(call){const P=fh.pot;s+=` You need ${pct(call.amt/(P+call.amt))} equity to call.`}}
  return s+` <span class="muted">${t.tip}</span>`}

/* ---------- grading, showdown, end ---------- */
const FH_COST={best:['Best','good'],fine:['Fine','good'],small:['Small mistake','bad'],medium:['Medium mistake','bad'],big:['Big mistake','bad'],chart:['Off the chart','bad']};
function fhGrade(g){g.logIdx=fh.log.length;fh.dec.push(g);stats.fh.dec++;if(g.ok)stats.fh.good++;save();fhStats();
  logEvent({drill:'Full hand',spot:g.spot,hand:names(fh.hero),answer:g.choice,expected:g.best,correct:g.ok,detail:`${FH_TYPES[fh.type].name} · ${g.cost} · ${fh.seat}`,ms:Date.now()-fh.t0});
  const [t,cls]=FH_COST[g.cost];
  $('fh-out').innerHTML=`<div class="verdict ${cls}"><strong>${t}</strong><span class="small muted">${g.spot}: you chose ${g.choice}${g.ok&&g.cost==='best'?'':` · best: ${g.best}`}</span></div><p class="small">${g.why}</p>${g.ev?fhEvTable(g.ev):''}${g.math||''}`;
  fhRender()}
function fhEvTable(ev){const has=ev.some(r=>r[2]!=null);return `<table class="ref fh-ev"><thead><tr><th>Option</th><th>EV</th>${has?'<th>They fold</th><th>Your equity when called</th>':''}</tr></thead><tbody>${ev.map(r=>`<tr><td class="t">${r[0]}</td><td>${r[1]>=0?'+':''}${fmtBB(Math.round(r[1]*10)/10)} BB</td>${has?`<td>${r[2]!=null?pct(r[2],0):'–'}</td><td>${r[3]!=null?pct(r[3],0):'–'}</td>`:''}</tr>`).join('')}</tbody></table>`}
function fhRunout(){fhRefund();fh.street=3;fhLog('River',`Board runs out: ${names(fh.board)}`);fhShowdown()}
function fhShowdown(){const a=evalHand(fh.hero.concat(fh.board)),b=evalHand(fh.vil.concat(fh.board));
  fhLog('Showdown',`Showdown: you have ${catName(a).toLowerCase()}, the ${POSNAME[fh.S.vil]} shows ${names(fh.vil)} (${catName(b).toLowerCase()}).`);
  fhEnd(a>b?'win':a===b?'chop':'lose')}
function fhEnd(how){fh.done=true;const P=fh.pot;let net;
  if(how==='fold')net=-fh.inv.hero;else if(how==='vilfold'||how==='win')net=P-fh.inv.hero;else if(how==='chop')net=P/2-fh.inv.hero;else net=-fh.inv.hero;
  fh.result={how,net};stats.fh.hands++;stats.fh.net=(stats.fh.net||0)+net;save();fhStats();
  const good=fh.dec.filter(d=>d.ok).length,lossy=fh.dec.filter(d=>!d.ok);
  const msg={fold:'You folded.',vilfold:'They folded.',win:'You win at showdown.',chop:'Split pot.',lose:'They win at showdown.'}[how];
  $('fh-acts').innerHTML=`<button class="act" id="fh-next">Next hand</button>`;$('fh-next').onclick=fhDeal;$('fh-next').focus();
  $('fh-sum').innerHTML=`<div class="verdict ${net>=0?'good':'bad'}"><strong>${net>=0?'+':''}${fmtBB(Math.round(net*10)/10)} BB</strong><span>${msg} Opponent held <b>${names(fh.vil)}</b>. Decisions: ${good} of ${fh.dec.length} best or fine.</span></div>
    ${fh.dec.length?`<ol class="dl-list">${fh.dec.map(d=>`<li class="${d.ok?'ok':'no'}"><span>${d.ok?'✓':'✗'}</span><span><b>${d.spot}</b>: ${d.choice}${d.ok?'':` <span class="small muted">(best: ${d.best}; ${FH_COST[d.cost][0].toLowerCase()})</span>`}</span></li>`).join('')}</ol>`:''}
    <p class="small muted">Results swing with the cards; judge yourself by the decisions, not the chips. <button class="linkbtn" id="fh-replay">Replay this hand</button></p>`;
  fhSave();fhRender(true);$('fh-replay').onclick=()=>{rpOpen(0);location.hash='#replay'}}
function fhSave(){try{const a=JSON.parse(localStorage.getItem(FHKEY))||[];a.push({ts:fh.ts,type:fh.type,seat:fh.seat,S:fh.S,tour:!!fh.tour,depth:fh.depth||100,hero:fh.hero,vil:fh.vil,board:fh.board,log:fh.log,dec:fh.dec.map(d=>({street:d.street,spot:d.spot,choice:d.choice,best:d.best,ok:d.ok,cost:d.cost,why:d.why,ev:d.ev?d.ev.map(r=>[r[0],Math.round(r[1]*100)/100,r[2]==null?null:Math.round(r[2]*1000)/1000,r[3]==null?null:Math.round(r[3]*1000)/1000]):null,logIdx:d.logIdx})),result:fh.result});
  if(typeof rpList==='function')rpList();
  localStorage.setItem(FHKEY,JSON.stringify(a.slice(-50)))}catch(e){}}
function fhStats(){$('fh-hands').textContent=stats.fh.hands;$('fh-good').textContent=stats.fh.dec?pct(stats.fh.good/stats.fh.dec,0):'–';$('fh-net').textContent=(stats.fh.net>=0?'+':'')+fmtBB(Math.round((stats.fh.net||0)*10)/10)}

/* ---------- drawing ---------- */
function fhRender(showVil){const S=fh.S,seats={};POS.forEach(p=>seats[p]={state:'folded'});
  const bet=w=>fh.streetIn&&fh.streetIn[w]?fmtBB(fh.streetIn[w])+' BB':'';
  seats[S.hero]={state:'hero',stack:fmtBB(fh.stack.hero)+' BB',tag:'You',bet:bet('hero')};
  seats[S.vil]={state:'vil',stack:fmtBB(fh.stack.vil)+' BB',tag:{rec:'Rec',station:'Station',nit:'Nit',aggro:'Aggro'}[fh.type],bet:bet('vil')};
  const board=fh.street?fh.board.slice(0,[0,3,4,5][fh.street]):[];
  renderTable($('fh-table'),{hero:S.hero,seats,heroCards:fh.hero,shown:fh.done&&showVil?{[S.vil]:fh.vil}:{},center:`<div class="cards">${board.length?cardsHTML(board,'xs'):''}</div><b>${fmtBB(fh.pot)} BB</b><span>pot</span>`});
  $('fh-hand').innerHTML=cardsHTML(fh.hero);$('fh-vil').innerHTML=fh.done&&showVil?cardsHTML(fh.vil):cardsHTML([null,null]);
  $('fh-opp').innerHTML=`<b>${FH_TYPES[fh.type].name}.</b> ${FH_TYPES[fh.type].desc}`;
  $('fh-log').innerHTML=fh.log.map(l=>`<li class="${l.who}">${esc(l.text)}</li>`).join('');$('fh-log').scrollTop=1e6;
  if(!fh.done)$('fh-sum').innerHTML=''}
function fhInit(){fhtSeatOptions();fhStats();fhDeal()}
$('fh-deal').onclick=fhDeal;
