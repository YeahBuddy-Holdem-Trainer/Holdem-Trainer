/* ---------- ICM calculator ----------
   Malmuth-Harville model: the chance a player finishes first is their share of the chips; given who finished
   first, the rest repeat the same rule for the next place. Computed exactly with a memo over the set of players left.
   The all-in tool compares folding with calling a shove, in prize money rather than chips. */
const ICM_PAY={'50/30/20':[50,30,20],'65/35':[65,35],'40/30/20/10':[40,30,20,10],'45/27/18/10':[45,27,18,10],'35/25/18/12/10':[35,25,18,12,10],'100':[100]};
let icmPlayers=[{name:'You',stack:3000},{name:'Player 2',stack:2500},{name:'Player 3',stack:2000},{name:'Player 4',stack:1500},{name:'Player 5',stack:1000}],icmHero=0,icmShover=1;

function icmEquity(stacks,prizes){const n=stacks.length,memo=new Map();
  function rec(mask){if(memo.has(mask))return memo.get(mask);const eq=new Array(n).fill(0);let left=0,tot=0;
    for(let i=0;i<n;i++)if(mask>>i&1){left++;tot+=stacks[i]}
    const place=n-left;if(place>=prizes.length||!left){memo.set(mask,eq);return eq}
    const live=[];for(let i=0;i<n;i++)if(mask>>i&1)live.push(i);
    for(const i of live){const p=tot>0?stacks[i]/tot:1/left;if(!p)continue;eq[i]+=p*prizes[place];const sub=rec(mask&~(1<<i));for(let j=0;j<n;j++)eq[j]+=p*sub[j]}
    memo.set(mask,eq);return eq}
  /* players with no chips finish below everyone with chips, sharing those places evenly */
  const res=rec((1<<n)-1),zero=stacks.map((s,i)=>s>0?-1:i).filter(i=>i>=0);
  if(zero.length){const alive=n-zero.length,places=prizes.slice(alive,alive+zero.length),avg=places.reduce((a,b)=>a+b,0)/zero.length;for(const i of zero)res[i]=avg||0}
  return res}
function icmPrizes(){const pool=+$('icm-pool').value||0;let pct=$('icm-pay').value==='custom'?$('icm-custom').value.split(/[,\s/]+/).map(Number).filter(x=>x>0):ICM_PAY[$('icm-pay').value];
  const sum=pct.reduce((a,b)=>a+b,0)||1;return{pool,pct,prizes:pct.map(p=>p/sum*pool)}}
const money$=x=>'$'+(Math.round(x*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

function icmRows(){$('icm-rows').innerHTML=icmPlayers.map((p,i)=>`<tr>
  <td><input type="text" value="${esc(p.name)}" data-i="${i}" data-f="name" aria-label="Player ${i+1} name" class="icm-name"></td>
  <td><input type="text" inputmode="numeric" value="${p.stack}" data-i="${i}" data-f="stack" aria-label="${esc(p.name)} stack" class="icm-stack"></td>
  <td class="c"><input type="radio" name="icm-h" value="${i}" ${i===icmHero?'checked':''} aria-label="${esc(p.name)} is you"></td>
  <td class="c"><input type="radio" name="icm-s" value="${i}" ${i===icmShover?'checked':''} aria-label="${esc(p.name)} shoves"></td>
  <td class="c">${icmPlayers.length>2?`<button class="linkbtn" data-rm="${i}" aria-label="Remove ${esc(p.name)}">✕</button>`:''}</td></tr>`).join('');
  $('icm-add').disabled=icmPlayers.length>=9}
$('icm-rows').addEventListener('input',e=>{const t=e.target;if(t.dataset.f==='name')icmPlayers[+t.dataset.i].name=t.value;
  if(t.dataset.f==='stack')icmPlayers[+t.dataset.i].stack=Math.max(0,+t.value.replace(/[^0-9.]/g,'')||0);icmCalc()});
$('icm-rows').addEventListener('change',e=>{const t=e.target;if(t.name==='icm-h')icmHero=+t.value;if(t.name==='icm-s')icmShover=+t.value;icmAutoCall();icmCalc()});
$('icm-rows').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(!b)return;const i=+b.dataset.rm;icmPlayers.splice(i,1);
  if(icmHero>=icmPlayers.length)icmHero=0;if(icmShover>=icmPlayers.length||icmShover===icmHero)icmShover=icmHero===0?1:0;icmRows();icmAutoCall();icmCalc()});
$('icm-add').onclick=()=>{if(icmPlayers.length>=9)return;icmPlayers.push({name:'Player '+(icmPlayers.length+1),stack:1500});icmRows();icmCalc()};
$('icm-pay').onchange=()=>{$('icm-custom-wrap').hidden=$('icm-pay').value!=='custom';icmCalc()};
['icm-pool','icm-custom','icm-pot','icm-call','icm-eq'].forEach(id=>$(id).addEventListener('input',icmCalc));
function icmAutoCall(){const h=icmPlayers[icmHero],s=icmPlayers[icmShover];if(h&&s)$('icm-call').value=Math.min(h.stack,s.stack)}

function icmCalc(){const {pool,pct:pc,prizes}=icmPrizes(),stacks=icmPlayers.map(p=>p.stack),tot=stacks.reduce((a,b)=>a+b,0);
  if(!prizes.length||!pool){$('icm-out').innerHTML='<p class="small">Enter a prize pool and at least one paid place.</p>';$('icm-allin').innerHTML='';return}
  const eq=icmEquity(stacks,prizes);
  $('icm-out').innerHTML=`<table class="ref"><thead><tr><th>Player</th><th>Chips</th><th>Chip share</th><th>ICM value</th><th>Share of prizes</th></tr></thead><tbody>${icmPlayers.map((p,i)=>`<tr${i===icmHero?' class="me"':''}><td class="t">${esc(p.name)}</td><td>${p.stack.toLocaleString()}</td><td>${pct(tot?p.stack/tot:0)}</td><td><b>${money$(eq[i])}</b></td><td>${pct(eq[i]/pool)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">Payouts: ${prizes.map((x,k)=>`${k+1}${['st','nd','rd'][k]||'th'} ${money$(x)}`).join(' · ')}. Big stacks are worth less than their chip share and short stacks more, because you can only win first place once.</p>`;
  icmAllIn(stacks,prizes,eq)}

function icmAllIn(stacks,prizes,eq0){const out=$('icm-allin'),h=icmHero,s=icmShover;
  if(h===s){out.innerHTML='<p class="small">Pick a different player as the shover.</p>';return}
  const P0=Math.max(0,+$('icm-pot').value||0),C=Math.max(0,Math.min(+$('icm-call').value||0,stacks[h])),matched=Math.min(stacks[s],C);
  if(!matched){out.innerHTML='<p class="small">Enter how much you have to call.</p>';return}
  const after=(dh,ds)=>stacks.map((x,i)=>i===h?x+dh:i===s?x+ds:x);
  const fold=icmEquity(after(0,P0),prizes)[h],win=icmEquity(after(P0+matched,-matched),prizes)[h],lose=icmEquity(after(-matched,P0+matched),prizes)[h];
  const needICM=(fold-lose)/(win-lose),needChip=matched/(P0+2*matched),bf=(fold-lose)/(win-fold),prem=needICM-needChip;
  const eqIn=parseFloat($('icm-eq').value),haveEq=!isNaN(eqIn);
  const evCall=haveEq?eqIn/100*win+(1-eqIn/100)*lose:null;
  out.innerHTML=`<dl class="math"><dt>Fold</dt><dd>${money$(fold)}</dd><dt>Call and win</dt><dd>${money$(win)}</dd><dt>Call and lose</dt><dd>${money$(lose)}</dd></dl>
    <div class="stats"><div class="stat"><div class="n">${pct(needICM)}</div><span class="small muted">equity needed with ICM</span></div><div class="stat"><div class="n">${pct(needChip)}</div><span class="small muted">needed in chips only</span></div><div class="stat"><div class="n">${bf.toFixed(2)}</div><span class="small muted">bubble factor</span></div></div>
    <p class="small">ICM adds <b>${(prem*100).toFixed(1)} points</b> to the equity you need. A bubble factor of ${bf.toFixed(2)} means losing this pot costs you ${bf.toFixed(2)}× as much prize money as winning it gains.</p>
    ${haveEq?`<div class="verdict ${evCall>=fold?'good':'bad'}"><strong>${evCall>=fold?'Call':'Fold'}</strong><span>With ${eqIn.toFixed(1)}% equity, calling is worth ${money$(evCall)} against ${money$(fold)} for folding (${evCall>=fold?'+':''}${money$(evCall-fold).replace('$-','−$')}).${eqIn/100>=needChip&&evCall<fold?' In a cash game this would be a call; the payout structure makes it a fold.':''}</span></div>`:'<p class="small muted">Enter your equity below, or work it out from your hand and their shoving range.</p>'}`}

/* equity from a hand and a range, using the trainer's equity engine */
function icmLabelCombo(t){t=t.trim();const m=t.match(/^([2-9TJQKA])([shdc])([2-9TJQKA])([shdc])$/i);
  if(m){const a=R.indexOf(m[1].toUpperCase())*4+S.indexOf(m[2].toLowerCase()),b=R.indexOf(m[3].toUpperCase())*4+S.indexOf(m[4].toLowerCase());return a!==b&&a>=0&&b>=0?[a,b]:null}
  const set=parseRange(t);if(set.size!==1)return null;return labelCombos([...set][0])[0]}
$('icm-eqcalc').onclick=()=>{const hand=icmLabelCombo($('icm-hand').value),rng=presetRange($('icm-range').value),msg=$('icm-eqmsg');
  if(!hand){msg.textContent='Enter a hand like AKs, 77 or AhKd.';return}if(!rng.size){msg.textContent='Choose their shoving range.';return}
  msg.textContent='Working…';setTimeout(()=>{const e=equityVsRange(hand,[...rng].flatMap(labelCombos),[],30000);
    if(!e){msg.textContent='Your hand blocks that whole range.';return}$('icm-eq').value=(e.eq*100).toFixed(1);msg.textContent=`${names(hand)} has ${pct(e.eq)} against that range.`;icmCalc()},20)};
function icmInit(){icmRows();icmAutoCall();const h=presetOptionsHTML().replace('Choose a chart range…','Choose their shoving range…');$('icm-range').innerHTML=h;
  const shove=SPOTS.find(s=>s.type==='shove'&&s.hero==='BTN');if(shove)$('icm-range').value=shove.id+'|0';icmCalc()}
