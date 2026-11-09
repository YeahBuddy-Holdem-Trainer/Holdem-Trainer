/* ---------- equity calculator ---------- */
const SLOT_LABELS=['You','You','Villain','Villain','Flop','Flop','Flop','Turn','River'];
const cardFromName=n=>R.indexOf(n[0])*4+S.indexOf(n[1]);
let slots=['Ah','Kh',null,null,'Jh','Tc','2h',null,null].map(n=>n&&cardFromName(n)),active=7,vmode='range';
let vRange=new Set();
function vExact(){return vmode==='exact'}
function renderSlots(){const off=!vExact();const grp=(lab,idx)=>`<div><span class="lbl muted">${lab}</span><div class="cards">${idx.map(i=>`<button class="slot ${i===active?'active':''}" data-i="${i}" aria-label="${SLOT_LABELS[i]} card ${slots[i]==null?'empty':R[slots[i]>>2]+S[slots[i]&3]}" ${off&&(i===2||i===3)?'disabled style="opacity:.3"':''}>${cardHTML(slots[i])}</button>`).join('')}</div></div>`;
  $('slots').innerHTML=grp('You',[0,1])+grp(vmode==='exact'?'Villain':vmode==='range'?'Villain: range below':'Villain: random',[2,3])+grp('Board',[4,5,6,7,8]);
  const used=new Set(slots.filter((c,i)=>c!=null&&!(off&&(i===2||i===3))));
  $('grid').innerHTML=[0,1,2,3].map(s=>R.split('').reverse().map(r=>{const c=R.indexOf(r)*4+s;return `<button data-c="${c}" class="${isRed(c)?'red':''}" ${used.has(c)?'disabled':''} aria-label="${r}${S[s]}">${rankTxt(R.indexOf(r))}${SYM[s]}</button>`}).join('')).join('')}
$('slots').onclick=e=>{const b=e.target.closest('.slot');if(!b||b.disabled)return;const i=+b.dataset.i;if(slots[i]!=null)slots[i]=null;active=i;renderSlots()};
$('grid').onclick=e=>{const b=e.target.closest('button[data-c]');if(!b||b.disabled||active==null)return;slots[active]=+b.dataset.c;
  const order=[0,1,2,3,4,5,6,7,8].filter(i=>vExact()||!(i===2||i===3));active=order.find(i=>slots[i]==null)??null;renderSlots()};
$('clr').onclick=()=>{slots=Array(9).fill(null);active=0;renderSlots();$('calc-out').innerHTML=''};
function setVmode(m){vmode=m;['exact','range','random'].forEach(x=>$('vm-'+x).setAttribute('aria-pressed',x===m));$('range-box').hidden=m!=='range';
  if(!vExact()&&(active===2||active===3))active=[0,1,4,5,6,7,8].find(i=>slots[i]==null)??null;renderSlots()}
['exact','range','random'].forEach(x=>$('vm-'+x).onclick=()=>setVmode(x));

/* range editor */
/* option list shared by the calculator and range vs board */
function presetOptionsHTML(only){const groups={cash:'Cash, 100 BB',tour:'Tournament'};let h='<option value="">Choose a chart range…</option><option value="any">Any two cards</option>';
  if(myRanges.length){h+='<optgroup label="My ranges">';
    for(const r of myRanges.slice().sort((a,b)=>a.name.localeCompare(b.name))){const opts=r.acts.map((a,k)=>[`my|${r.id}|${k}`,`${r.name}: ${a}`]);
      if(r.acts.length>1)opts.push([`my|${r.id}|all`,`${r.name}: ${r.acts.join(' or ')}`]);h+=opts.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}
    h+='</optgroup>'}
  for(const g of(only?[only]:[mode==='cash'?'cash':'tour'])){h+=`<optgroup label="${groups[g]}">`;
    for(const s of SPOTS.filter(x=>x.game===g)){const opts=s.acts.slice(0,-1).map((a,k)=>[`${s.id}|${k}`,`${s.name}: ${a}`]);
      if(s.acts.length>2)opts.push([`${s.id}|all`,`${s.name}: ${s.acts.slice(0,-1).join(' or ')}`]);
      h+=opts.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}
    h+='</optgroup>'}
  return h}
/* default chart ranges for each game type, used when switching Cash/Tournament */
const PRESET_DEF={cash:{calc:'cash-bb-vs-btn-open|all',a:'cash-btn-open|0',b:'cash-bb-vs-btn-open|1'},tour:{calc:'tour-bb-vs-btn-open-40-bb|all',a:'tour-btn-open-40-bb|0',b:'tour-bb-vs-btn-open-40-bb|1'}};
const presetDef=k=>PRESET_DEF[mode==='cash'?'cash':'tour'][k];
function buildPresets(){const keep=$('rpreset').value,h=presetOptionsHTML();
  $('rpreset').innerHTML=h;if([...$('rpreset').options].some(o=>o.value===keep))$('rpreset').value=keep;
  else if(keep&&keep!=='any'){$('rpreset').value=presetDef('calc');$('rpreset').dispatchEvent(new Event('change'))}
  if(typeof rvbSelects==='function')rvbSelects()}
function setRange(set,src){vRange=set;$('rtext').value=rangeToText(set);renderRangeGrid();if(src!=null)$('rpreset').value=src}
function renderRangeGrid(){let h='';for(let i=12;i>=0;i--)for(let j=12;j>=0;j--){const l=gridLabel(i,j);h+=`<button type="button" class="${vRange.has(l)?'a0':''}" data-l="${l}" aria-pressed="${vRange.has(l)}" title="${l}">${l}</button>`}
  $('rgrid').innerHTML=h;const n=[...vRange].reduce((q,l)=>q+combosOf(l),0);$('rinfo').textContent=`${pct(n/1326)} of hands · ${n} combos`}
$('rgrid').onclick=e=>{const b=e.target.closest('button[data-l]');if(!b)return;const l=b.dataset.l;vRange.has(l)?vRange.delete(l):vRange.add(l);$('rpreset').value='';setRange(vRange)};
/* a preset option value -> set of hand labels */
function presetRange(v){if(!v)return new Set();
  if(v==='any'){const all=new Set();for(let i=0;i<13;i++)for(let j=0;j<13;j++)all.add(gridLabel(i,j));return all}
  if(v.startsWith('my|')){const [,id,k]=v.split('|'),r=myRanges.find(x=>x.id===id);if(!r)return new Set();return new Set([...myRangeMap(r)].filter(([,a])=>k==='all'||a===+k).map(([l])=>l))}
  const [id,k]=v.split('|'),s=SPOTS.find(x=>x.id===id);if(!s)return new Set();return new Set([...s.map].filter(([,a])=>k==='all'||a===+k).map(([l])=>l))}
$('rpreset').onchange=e=>{const v=e.target.value;if(!v)return;
  if(v==='any'){const all=new Set();for(let i=0;i<13;i++)for(let j=0;j<13;j++)all.add(gridLabel(i,j));setRange(all,v);return}
  if(v.startsWith('my|')){const [,id,k]=v.split('|'),r=myRanges.find(x=>x.id===id);if(!r)return;
    setRange(new Set([...myRangeMap(r)].filter(([,a])=>k==='all'||a===+k).map(([l])=>l)),v);return}
  const [id,k]=v.split('|'),s=SPOTS.find(x=>x.id===id);const set=new Set([...s.map].filter(([,a])=>k==='all'||a===+k).map(([l])=>l));setRange(set,v)};
$('rapply').onclick=()=>{const set=parseRange($('rtext').value);if(!set.size){$('rinfo').textContent='Could not read that range. Use notation like 22+, A2s+, KTo+, A5s-A2s.';return}$('rpreset').value='';setRange(set)};

function runCalc(){const hero=[slots[0],slots[1]],out=$('calc-out');
  if(hero.includes(null)){out.innerHTML='<p class="small">Add both of your hole cards first.</p>';return}
  const vil=vExact()?[slots[2],slots[3]]:null;
  if(vExact()&&vil.includes(null)){out.innerHTML='<p class="small">Add villain\'s two cards, or switch villain to a range or a random hand.</p>';return}
  let combos=null;
  if(vmode==='range'){if(!vRange.size){out.innerHTML='<p class="small">Choose or build villain\'s range first.</p>';return}combos=[...vRange].flatMap(labelCombos)}
  const flop=slots.slice(4,7),turn=slots[7],river=slots[8],boards=[[]];
  if(!flop.includes(null)){boards.push(flop);if(turn!=null){boards.push(flop.concat(turn));if(river!=null)boards.push(flop.concat(turn,river))}}
  else if(flop.some(c=>c!=null)||turn!=null||river!=null){out.innerHTML='<p class="small">Fill all three flop cards before the turn and river.</p>';return}
  out.innerHTML='<p class="small muted">Running…</p>';
  setTimeout(()=>{const vs=vmode==='range'?`vs ${pct(rangePct(vRange),0)} range`:vmode==='random'?'vs a random hand':'';
    out.innerHTML=boards.map((b,i)=>{const e=combos?equityVsRange(hero,combos,b,25000):equity(hero,vil,b,vil?60000:30000);
      if(!e)return `<p class="small">Every hand in villain's range is blocked by the cards shown.</p>`;
      const cat=(b.length?`You: ${catName(evalHand(hero.concat(b)))}${vil?' · Villain: '+catName(evalHand(vil.concat(b))):''}`:'')+(vs?(b.length?' · ':'')+vs:'')+(e.live?` · ${e.live} combos live`:'');
      return `<div class="st"><span class="nm">${STREETS[i]}</span><div class="bar" title="win ${pct(e.w)}, split ${pct(e.t)}"><div class="w" style="width:${e.w*100}%"></div><div class="t" style="width:${e.t*100}%"></div></div><span class="pct">${pct(e.eq)}</span><span class="cat">${cat}${e.exact?' · exact':' · simulated'}</span></div>`}).join('')},20)}
$('calc').onclick=runCalc;
