/* ---------- pot odds ---------- */
const FRACS=[.25,.33,.5,.66,.75,1,1.25,1.5,2];
const REF=[['¼ pot',.25],['⅓ pot',1/3],['½ pot',.5],['⅔ pot',2/3],['¾ pot',.75],['Pot',1],['1.5× pot',1.5],['2× pot',2]];
const nearestRef=f=>REF.reduce((a,b)=>Math.abs(b[1]-f)<Math.abs(a[1]-f)?b:a)[0];
function genPO(){newStakes();const pot=makePot(4,40),bet=makeBet(pot,pick(FRACS));return{pot,bet,req:bet/(pot+2*bet)}}
let po;
function newPO(){po={...genPO(),done:false,t0:Date.now()};const{pot,bet}=po;
  $('po-pot').textContent=money(pot);$('po-bet').textContent=money(bet);$('po-pot-bb').textContent=bbs(pot);$('po-bet-bb').textContent=`${Math.round(bet/pot*100)}% of pot`;
  $('po-ans').value='';$('po-out').innerHTML='<p class="small muted">Type your answer and press Check. The full math appears here.</p>'}
function poStats(){$('po-score').textContent=`${stats.po.c}/${stats.po.n}`;$('po-streak').textContent=stats.po.streak}
function poMath(p){const{pot,bet,req}=p,total=pot+2*bet;
  return `<dl class="math"><dt>You call</dt><dd>${money(bet)}</dd><dt>To win</dt><dd>${money(pot)} + ${money(bet)} = ${money(pot+bet)}</dd><dt>Final pot</dt><dd>${money(pot)} + ${money(bet)} + ${money(bet)} = ${money(total)}</dd><dt>Equity needed</dt><dd>${money(bet)} ÷ ${money(total)} = ${pct(req)}</dd><dt>As a ratio</dt><dd>${((pot+bet)/bet).toFixed(2)} : 1 → 1 ÷ (${((pot+bet)/bet).toFixed(2)} + 1) = ${pct(req)}</dd></dl>`}
$('po-form').addEventListener('submit',e=>{e.preventDefault();const g=parseFloat($('po-ans').value);if(isNaN(g)){$('po-ans').focus();return}
  const ok=Math.abs(g-po.req*100)<=2.5,miss=Math.abs(g-po.req*100);
  if(!po.done){stats.po.n++;if(ok){stats.po.c++;stats.po.streak++}else stats.po.streak=0;po.done=true;save();poStats();
    logEvent({drill:'Pot odds',spot:nearestRef(po.bet/po.pot)+' bet',answer:g,expected:+(po.req*100).toFixed(1),correct:ok,error:+miss.toFixed(1),detail:`pot ${po.pot}, bet ${po.bet}`,ms:Date.now()-po.t0})}
  const wrongBase=Math.abs(g-po.bet/(po.pot+po.bet)*100)<1.5;
  $('po-out').innerHTML=`<div class="verdict ${ok?'good':'bad'}"><strong>${ok?'Correct':'Off by '+miss.toFixed(1)+' pts'}</strong><span>You need <b>${pct(po.req)}</b> equity to call.</span></div>${poMath(po)}
  ${wrongBase?'<p class="small"><b>Common slip:</b> you divided by the pot before your call. Your own call goes into the final pot too, so add the bet twice.</p>':''}
  <p class="small muted">A ${Math.round(po.bet/po.pot*100)}% pot bet is closest to the ${nearestRef(po.bet/po.pot)} row in the table below.</p>`});
$('po-next').onclick=()=>{newPO();$('po-ans').focus()};
$('ref').innerHTML=REF.map(([n,f])=>`<tr><td class="t">${n}</td><td>${((1+f)/f).toFixed(1)} : 1</td><td>${pct(f/(1+2*f))}</td></tr>`).join('');

/* ---------- call or fold ---------- */
const HU_SEATS=[['BB','BTN'],['SB','BTN'],['BB','CO'],['UTG','BTN'],['HJ','CO'],['SB','CO']];
/* villain acts first postflop (out of position) and bets into you */
function genCF(minGap=0){newStakes();
  for(let outer=0;outer<20;outer++){
    const street=Math.random()<.5?3:4,wantDraw=Math.random()<.75;let s=null;
    for(let tries=0;tries<400;tries++){const d=shuffled(),hero=d.slice(0,2),vil=d.slice(2,4),board=d.slice(4,4+street);
      const behind=evalHand(hero.concat(board))<evalHand(vil.concat(board));
      if(wantDraw&&!behind)continue;const e=equity(hero,vil,board);
      if(wantDraw&&(e.eq<.08||e.eq>.5))continue;s={hero,vil,board,street,e,behind};break}
    if(!s)continue;
    const pot=makePot(6,30),bet=makeBet(pot,pick(street===3?[.5,.75,1,1.5,2]:[.33,.5,.66,.75,1,1.25])),req=bet/(pot+2*bet);
    if(Math.abs(s.e.eq-req)<minGap)continue;
    const [vp,hp]=pick(HU_SEATS);
    return{...s,pot,bet,req,vp,hp}}
}
function cfTable(c){const seats={};POS.forEach(p=>seats[p]={state:'folded',bet:'',tag:'',stack:''});
  seats[c.hp]={state:'hero',tag:'You',stack:'',bet:''};seats[c.vp]={state:'vil',tag:c.street===3?'All in':'Bets',stack:'',bet:money(c.bet)};
  return{hero:c.hp,seats,center:`<div class="cards">${cardsHTML(c.board,'xs')}</div><span>Pot ${money(c.pot)}</span>`}}
let cf;
function newCF(){cf={...genCF(),done:false,t0:Date.now()};
  renderTable($('cf-table'),cfTable(cf));
  $('cf-hero').innerHTML=cardsHTML(cf.hero);$('cf-vil').innerHTML=cardsHTML(cf.vil);
  $('cf-text').textContent=`${cf.street===3?'Flop':'Turn'}. The ${POSNAME[cf.vp]} ${cf.street===3?'shoves all in for':'bets'} ${money(cf.bet)} into ${money(cf.pot)}. You are on the ${POSNAME[cf.hp]}.`;
  ['cf-call','cf-fold'].forEach(id=>{$(id).disabled=false;$(id).classList.remove('pickok','pickbad')});
  $('cf-out').innerHTML='<p class="small muted">Decide, and the outs, exact equity and EV of the call show here.</p>'}
function cfReview(c){
  const hOuts=c.behind?outsFor(c.hero,c.vil,c.board):[],vOuts=c.behind?[]:outsFor(c.vil,c.hero,c.board);
  const mult=c.street===3?4:2,ev=c.e.eq*(c.pot+c.bet)-(1-c.e.eq)*c.bet;
  return{hOuts,vOuts,mult,ev,best:c.e.eq>=c.req?'Call':'Fold',close:Math.abs(c.e.eq-c.req)<.015}}
function cfAnswer(call){const c=cf,v=cfReview(c),right=(v.best==='Call')===call||v.close;
  if(!c.done){stats.cf.n++;if(right)stats.cf.c++;c.done=true;save();$('cf-score').textContent=`${stats.cf.c}/${stats.cf.n}`;
    logEvent({drill:'Call or fold',spot:(c.street===3?'Flop shove':'Turn bet')+(c.behind?', drawing':', ahead'),hand:names(c.hero)+' vs '+names(c.vil),
      answer:call?'Call':'Fold',expected:v.close?'Either':v.best,correct:right,
      detail:`board ${names(c.board)}; equity ${pct(c.e.eq)}; needed ${pct(c.req)}; outs ${c.behind?v.hOuts.length:'-'}`,ms:Date.now()-c.t0})}
  $(v.best==='Call'?'cf-call':'cf-fold').classList.add('pickok');if(!right)$(call?'cf-call':'cf-fold').classList.add('pickbad');
  ['cf-call','cf-fold'].forEach(id=>$(id).disabled=true);
  const est=Math.min(100,v.hOuts.length*v.mult);
  $('cf-out').innerHTML=`<div class="verdict ${right?'good':'bad'}"><strong>${v.close?'Close spot, either is fine':right?v.best+' is right':'Should '+v.best.toLowerCase()}</strong>
  <span>Your equity <b>${pct(c.e.eq)}</b> vs <b>${pct(c.req)}</b> needed.</span></div>
  <ol class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">
   <li>Price: ${money(c.bet)} ÷ (${money(c.pot)} + ${money(c.bet)} + ${money(c.bet)}) = <b>${pct(c.req)}</b> needed.</li>
   ${c.behind?`<li>You have ${catName(evalHand(c.hero.concat(c.board))).toLowerCase()}, villain has ${catName(evalHand(c.vil.concat(c.board))).toLowerCase()}. You count <b>${v.hOuts.length} outs</b>.</li>
   <li>Rule of ${v.mult} (${c.street===3?'two cards to come':'one card to come'}): ${v.hOuts.length} × ${v.mult} ≈ <b>${est}%</b>.</li>`
   :`<li>You are ahead: ${catName(evalHand(c.hero.concat(c.board))).toLowerCase()} vs ${catName(evalHand(c.vil.concat(c.board))).toLowerCase()}. Villain has ${v.vOuts.length} outs, so you are roughly ${Math.max(0,100-v.vOuts.length*v.mult)}%.</li>`}
   <li>Compare: ${c.behind?est:Math.max(0,100-v.vOuts.length*v.mult)}% ${(c.behind?est:100-v.vOuts.length*v.mult)>=c.req*100?'≥':'<'} ${pct(c.req,0)} → ${(c.behind?est:100-v.vOuts.length*v.mult)>=c.req*100?'call':'fold'}. Exact equity is ${pct(c.e.eq)}.</li>
  </ol>
  <dl class="math"><dt>EV of calling</dt><dd>${v.ev>=0?'+':'−'}${money(Math.abs(Math.round(v.ev)))}</dd></dl>
  ${v.hOuts.length?`<div><h3>Your outs</h3><div class="outs">${cardsHTML(v.hOuts,'sm')}</div></div>`:''}
  ${c.street===3&&c.behind?'<p class="small muted">Exact equity also counts runner-runner draws, so it can come out above the rule-of-4 estimate.</p>':''}`}
$('cf-call').onclick=()=>cfAnswer(true);$('cf-fold').onclick=()=>cfAnswer(false);$('cf-next').onclick=newCF;

/* ---------- street equity ---------- */
let se;const STREETS=['Preflop','Flop','Turn','River'],SHOW=[0,3,4,5];
function newSE(){const d=shuffled();se={hero:d.slice(0,2),vil:d.slice(2,4),board:d.slice(4,9),step:0,rows:[],t0:Date.now()};$('se-guess').value=50;$('se-gv').textContent=50;seRender()}
/* the shortcut you could have used at this street */
function seHint(step){const b=se.board.slice(0,SHOW[step]);
  if(step===0){const c=classify(se.hero,se.vil);if(!c)return'Shared ranks: these hands often split, so equity sits closer to 50/50 than the cards suggest.';
    const m=MUBY[c.id],fav=c.fav===0;return `${m.name} (${m.ex}). The favorite wins about ${m.rule}%, and you are the ${fav?'favorite':'underdog'}, so estimate about ${fav?m.rule:100-m.rule}%.`}
  const mult=step===1?4:2,hv=evalHand(se.hero.concat(b)),vv=evalHand(se.vil.concat(b)),ahead=hv>vv;
  const deck=deckWithout([...se.hero,...se.vil,...b]),cmp=c=>evalHand(se.hero.concat(b,c))-evalHand(se.vil.concat(b,c));
  const win=deck.filter(c=>cmp(c)>0).length,tie=deck.filter(c=>cmp(c)===0).length,lose=deck.length-win-tie;
  const pl=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
  const split=e=>e.t>=.005?` Exact: you win ${pct(e.w)} outright and split ${pct(e.t)}. A split pot counts as half a win, so equity = ${pct(e.w)} + ${pct(e.t/2)} = ${pct(e.eq)}.`:'';
  return e=>{let h;
    if(!ahead){const o=win+tie/2,est=Math.min(100,Math.round(o*mult));
      h=hv===vv?`You are tied right now. `:`You are behind. `;
      h+=win||tie?`${pl(win,'card')} put${win===1?'s':''} you ahead${tie?` and ${pl(tie,'card')} make${tie===1?'s':''} a split pot, each worth half an out`:''}. Rule of ${mult}: ${o} × ${mult} ≈ ${est}%.`
        :`No single card puts you ahead, so the rule of ${mult} gives 0%.`;
      if(step===1&&e.w*100>win*mult+1)h+=` The rule of 4 misses runner-runner hands, where you need both the turn and the river to help.`}
    else{const o=lose+tie/2,est=Math.min(100,Math.round(o*mult));
      h=`You are ahead. Villain has ${pl(lose,'out')}${tie?` plus ${pl(tie,'card')} that split, each worth half`:''}. Villain ≈ ${o} × ${mult} = ${est}%, so you ≈ ${100-est}%.`}
    return h+split(e)}}
function seRender(){const s=se.step,shown=se.board.slice(0,SHOW[s]);
  $('se-hero').innerHTML=cardsHTML(se.hero);$('se-vil').innerHTML=cardsHTML(se.vil);
  $('se-board').innerHTML=cardsHTML(shown)+cardsHTML(Array(5-shown.length).fill(null));$('se-street').textContent=STREETS[s];
  const locked=se.rows.length>s||s===3;$('se-sub').disabled=locked;$('se-guess').disabled=locked;$('se-adv').disabled=!locked||s===3;
  $('se-log').innerHTML=se.rows.map(r=>`<div class="st"><span class="nm">${r.nm}</span><div class="bar"><div class="w" style="width:${r.e.w*100}%"></div><div class="t" style="width:${r.e.t*100}%"></div></div><span class="pct">${pct(r.e.eq,0)}</span><span class="cat">You guessed ${r.g}% · ${r.err<1?'spot on':'missed by '+r.err.toFixed(0)+' pts'}<br>Shortcut: ${r.hint}</span></div>`).join('')+(s===3?seResult():'');
  $('se-avg').textContent=stats.se.n?(stats.se.err/stats.se.n).toFixed(1):'–';$('se-n').textContent=stats.se.n}
function seResult(){const a=evalHand(se.hero.concat(se.board)),b=evalHand(se.vil.concat(se.board));
  return `<div class="verdict ${a>b?'good':a<b?'bad':''}"><strong>${a>b?'You win':a<b?'Villain wins':'Split pot'}</strong><span class="small">${catName(a)} vs ${catName(b)}</span></div>`}
$('se-guess').oninput=e=>$('se-gv').textContent=e.target.value;
$('se-form').addEventListener('submit',e=>{e.preventDefault();if(se.rows.length>se.step)return;
  const g=+$('se-guess').value,eq=equity(se.hero,se.vil,se.board.slice(0,SHOW[se.step]),60000),err=Math.abs(g-eq.eq*100);
  se.rows.push({nm:STREETS[se.step],e:eq,g,err,hint:(h=>typeof h==='function'?h(eq):h)(seHint(se.step))});stats.se.n++;stats.se.err+=err;save();
  logEvent({drill:'Street equity',spot:STREETS[se.step],hand:names(se.hero)+' vs '+names(se.vil),answer:g,expected:+(eq.eq*100).toFixed(1),
    error:+err.toFixed(1),detail:'board '+(names(se.board.slice(0,SHOW[se.step]))||'none'),ms:Date.now()-se.t0});seRender()});
$('se-adv').onclick=()=>{se.step++;se.t0=Date.now();seRender()};$('se-new').onclick=newSE;

/* ---------- preflop matchups ---------- */
let mu;
function muPickType(){const sel=$('mu-cat').value;if(sel!=='mixed')return sel;
  const ag=new Map(aggregate(historyRows().filter(r=>r.drill==='Matchups')).map(a=>[a.spot,a]));
  return weightedPick(MU,MU.map(m=>weakWeight(ag.get(m.name)))).id}
function newMU(){const id=muPickType(),[h0,h1,c]=dealMatchup(id),heroFirst=Math.random()<.5;
  mu={hero:heroFirst?h0:h1,vil:heroFirst?h1:h0,c,heroFav:(c.fav===0)===heroFirst,pickedCat:null,done:false,t0:Date.now()};
  mu.hero.sort((a,b)=>b-a);mu.vil.sort((a,b)=>b-a);
  $('mu-hero').innerHTML=cardsHTML(mu.hero);$('mu-vil').innerHTML=cardsHTML(mu.vil);
  $('mu-cats').innerHTML=MU.map(m=>`<button class="act ghost" data-id="${m.id}">${m.name}</button>`).join('');
  $('mu-step2').hidden=true;$('mu-guess').value=50;$('mu-gv').textContent=50;$('mu-sub').disabled=false;$('mu-guess').disabled=false;
  $('mu-out').innerHTML='<p class="small muted">Name the matchup type, then estimate your equity. The rule of thumb and exact number show here.</p>'}
$('mu-cats').onclick=e=>{const b=e.target.closest('button[data-id]');if(!b||mu.pickedCat)return;mu.pickedCat=b.dataset.id;
  $('mu-cats').querySelectorAll('button').forEach(x=>{x.disabled=true;if(x.dataset.id===mu.c.id)x.classList.add('pickok');else if(x.dataset.id===mu.pickedCat)x.classList.add('pickbad')});
  $('mu-step2').hidden=false;$('mu-guess').focus()};
$('mu-guess').oninput=e=>$('mu-gv').textContent=e.target.value;
$('mu-form').addEventListener('submit',e=>{e.preventDefault();if(mu.done||!mu.pickedCat)return;mu.done=true;
  const g=+$('mu-guess').value,eq=equity(mu.hero,mu.vil,[],40000),err=Math.abs(g-eq.eq*100),m=MUBY[mu.c.id],okCat=mu.pickedCat===mu.c.id;
  stats.mu.n++;if(okCat)stats.mu.c++;stats.mu.err+=err;save();muStats();
  logEvent({drill:'Matchups',spot:m.name,hand:names(mu.hero)+' vs '+names(mu.vil),answer:MUBY[mu.pickedCat].name,expected:m.name,correct:okCat,
    error:+err.toFixed(1),detail:`equity ${pct(eq.eq)}; guess ${g}%`,ms:Date.now()-mu.t0});
  $('mu-sub').disabled=true;$('mu-guess').disabled=true;
  const est=mu.heroFav?m.rule:100-m.rule,hs=(mu.hero[0]&3)===(mu.hero[1]&3),vs=(mu.vil[0]&3)===(mu.vil[1]&3);
  const adj=[];if(hs)adj.push('your hand is suited (+2 to 3 pts for you)');if(vs)adj.push('villain is suited (+2 to 3 pts for them)');
  const gap=h=>Math.abs((h[0]>>2)-(h[1]>>2));if(!mu.c.id.startsWith('pp')){if(gap(mu.hero)<=2&&gap(mu.vil)>2)adj.push('your cards are connected (a little extra straight equity)');if(gap(mu.vil)<=2&&gap(mu.hero)>2)adj.push('villain\'s cards are connected');}
  $('mu-out').innerHTML=`<div class="verdict ${okCat?'good':'bad'}"><strong>${okCat?'Right type':'It is '+m.name}</strong><span>${m.why}</span></div>
   <dl class="math"><dt>Rule of thumb</dt><dd>Favorite ≈ ${m.rule}%, so you ≈ ${est}% (${mu.heroFav?'favorite':'underdog'})</dd>${adj.length?`<dt>Adjust</dt><dd style="font-family:var(--body)">${adj.join('; ')}</dd>`:''}<dt>Your guess</dt><dd>${g}%</dd><dt>Exact</dt><dd>${pct(eq.eq)} (win ${pct(eq.w)}, split ${pct(eq.t)})</dd><dt>Miss</dt><dd>${err.toFixed(1)} pts</dd></dl>`});
$('mu-next').onclick=newMU;$('mu-cat').onchange=newMU;
function muStats(){$('mu-score').textContent=`${stats.mu.c}/${stats.mu.n}`;$('mu-avg').textContent=stats.mu.n?(stats.mu.err/stats.mu.n).toFixed(1):'–'}
$('mu-cat').innerHTML='<option value="mixed">Mixed (weak types first)</option>'+MU.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
$('mu-sheet').innerHTML=`<thead><tr><th>Matchup type</th><th>Example</th><th>Favorite wins</th></tr></thead><tbody>${MU.map(m=>`<tr><td class="t">${m.name}</td><td>${m.ex}</td><td>≈ ${m.rule}%</td></tr>`).join('')}</tbody>`;
