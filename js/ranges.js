/* ---------- range builder ----------
   Build: paint a range with up to two actions (index 0 = raise-type, 1 = call), save it on this device,
   compare it with a chart, and use it in the equity calculator.
   Test yourself: paint a chart from memory, then check it against the chart.
   A range is a Map of hand label -> action index. Hands not in the map are folds. */
const RBKEY='holdem-ranges-v1';
let myRanges=[];
try{const s=JSON.parse(localStorage.getItem(RBKEY));if(Array.isArray(s))myRanges=s}catch(e){}
function saveMyRanges(){try{localStorage.setItem(RBKEY,JSON.stringify(myRanges))}catch(e){}}
const myRangeMap=r=>new Map(Object.entries(r.map).map(([l,a])=>[l,+a]));
const ALL_LABELS=[];for(let i=12;i>=0;i--)for(let j=12;j>=0;j--)ALL_LABELS.push(gridLabel(i,j));

const rbB={map:new Map(),acts:['Raise','Call'],undo:[],brush:0,editId:null};
const rbT={map:new Map(),acts:['Raise'],undo:[],brush:0,s:null,logged:false,t0:0,marks:null};
let rbMode='build',rbPaint=null;
const rbCur=()=>rbMode==='build'?rbB:rbT;

/* combos per action, and the hands where two ranges disagree */
const comboSum=labels=>labels.reduce((q,l)=>q+combosOf(l),0);
function rangeDiff(map,spot){const add=[],miss=[],diff=[];
  for(const l of ALL_LABELS){const a=map.get(l),b=spot.map.get(l);
    if(a==null&&b==null)continue;if(b==null)add.push(l);else if(a==null)miss.push(l);else if(a!==b)diff.push(l)}
  const union=ALL_LABELS.filter(l=>map.has(l)||spot.map.has(l));
  const u=comboSum(union),wrong=comboSum(add.concat(miss,diff));
  return{add,miss,diff,score:u?1-wrong/u:1,marks:new Set(add.concat(miss,diff))}}

/* ---------- grid ---------- */
function rbCellClass(l,st){const a=st.map.get(l);return (a!=null?'a'+a:'')+(st.marks&&st.marks.has(l)?' df':'')}
function rbCellTitle(l,st){const a=st.map.get(l);let t=`${l}: ${a!=null?st.acts[a]:'Fold'}`;
  if(rbMode==='test'&&st.marks&&st.marks.has(l)&&st.s){const b=st.s.map.get(l);t+=` · chart: ${st.s.acts[b??st.s.fold]}`}return t}
function rbRender(){const st=rbCur();
  $('rb-grid').innerHTML=ALL_LABELS.map(l=>`<button type="button" class="${rbCellClass(l,st)}" data-l="${l}" title="${rbCellTitle(l,st)}" aria-label="${rbCellTitle(l,st)}">${l}</button>`).join('');
  rbBrushes();rbLegend()}
function rbUpdateCell(l){const st=rbCur(),b=$('rb-grid').querySelector(`[data-l="${l}"]`);if(!b)return;
  b.className=rbCellClass(l,st);b.title=rbCellTitle(l,st);b.setAttribute('aria-label',b.title)}
function rbBrushes(){const st=rbCur();if(st.brush>=st.acts.length)st.brush=0;
  $('rb-brush').innerHTML=st.acts.map((a,k)=>`<button type="button" data-b="${k}" aria-pressed="${st.brush===k}"><i class="sw" style="background:var(--${k?'chip':'range'})"></i>${esc(a)}</button>`).join('')
    +`<button type="button" data-b="-1" aria-pressed="${st.brush===-1}">Erase</button>`}
function rbLegend(){const st=rbCur(),tot=[...st.map.keys()];
  const per=st.acts.map((a,k)=>{const c=comboSum(tot.filter(l=>st.map.get(l)===k));return `<span><i style="background:var(--${k?'chip':'range'})"></i>${esc(a)} ${pct(c/1326)} · ${c} combos</span>`});
  const all=comboSum(tot);
  $('rb-legend').innerHTML=per.join('')+`<span><i style="background:var(--line)"></i>Fold ${pct(1-all/1326)}</span>`+(st.acts.length>1?`<span>Played ${pct(all/1326)}</span>`:'')}
function rbPush(){const st=rbCur();st.undo.push(new Map(st.map));if(st.undo.length>60)st.undo.shift()}
function rbChanged(){const st=rbCur();
  if(rbMode==='build'){st.marks=null;rbCompare();rbNotation();$('rb-save-msg').textContent=''}
  else if(rbT.marks){rbT.marks=null;rbRender();$('rb-test-out').innerHTML='<p class="small muted">Changed since your last check. Press Check again to re-score; only your first check counts in Progress.</p>';return}
  rbLegend()}

/* click-and-drag painting; a drag that starts on a hand already holding the brush's action erases */
function rbApply(l){const st=rbCur();if(rbPaint<0)st.map.delete(l);else st.map.set(l,rbPaint);rbUpdateCell(l)}
const rbGrid=$('rb-grid');
rbGrid.addEventListener('pointerdown',e=>{const b=e.target.closest('button[data-l]');if(!b||e.button>0)return;e.preventDefault();
  const st=rbCur(),l=b.dataset.l;rbPush();rbPaint=st.brush>=0&&st.map.get(l)===st.brush?-1:st.brush;rbApply(l);
  try{rbGrid.setPointerCapture(e.pointerId)}catch(err){}});
rbGrid.addEventListener('pointermove',e=>{if(rbPaint==null)return;const el=document.elementFromPoint(e.clientX,e.clientY);
  const b=el&&el.closest?el.closest('#rb-grid button[data-l]'):null;if(b)rbApply(b.dataset.l)});
const rbEnd=()=>{if(rbPaint==null)return;rbPaint=null;rbChanged()};
rbGrid.addEventListener('pointerup',rbEnd);rbGrid.addEventListener('pointercancel',rbEnd);window.addEventListener('pointerup',rbEnd);
/* keyboard: Enter or Space on a hand toggles it with the current brush */
rbGrid.addEventListener('click',e=>{if(e.detail!==0)return;const b=e.target.closest('button[data-l]');if(!b)return;
  const st=rbCur(),l=b.dataset.l;rbPush();rbPaint=st.brush>=0&&st.map.get(l)===st.brush?-1:st.brush;rbApply(l);rbPaint=null;rbChanged()});
$('rb-brush').onclick=e=>{const b=e.target.closest('[data-b]');if(!b)return;rbCur().brush=+b.dataset.b;rbBrushes()};
$('rb-undo').onclick=()=>{const st=rbCur();if(!st.undo.length)return;st.map=st.undo.pop();st.marks=null;rbRender();rbChanged()};
$('rb-clear').onclick=()=>{const st=rbCur();if(!st.map.size)return;rbPush();st.map=new Map();rbRender();rbChanged()};

/* ---------- build mode ---------- */
function chartOptions(selectedGame){const groups={cash:'Cash, 100 BB',tour:'Tournament'},order=selectedGame==='tour'?['tour','cash']:['cash','tour'];
  return order.map(g=>`<optgroup label="${groups[g]} charts">${SPOTS.filter(s=>s.game===g).map(s=>`<option value="chart|${s.id}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}
function rbBuildSelects(){
  const mine=myRanges.length?`<optgroup label="My ranges">${myRanges.map(r=>`<option value="my|${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>`:'';
  $('rb-load').innerHTML='<option value="">Choose…</option><option value="empty">Empty grid</option>'+mine+chartOptions(mode);
  const keep=$('rb-cmp').value;$('rb-cmp').innerHTML='<option value="">Nothing</option>'+chartOptions(mode);$('rb-cmp').value=keep;
  const tk=$('rb-test-spot').value;
  $('rb-test-spot').innerHTML=`<option value="random">Random ${mode==='cash'?'cash':'tournament'} chart (weak spots first)</option>`+chartOptions(mode);
  $('rb-test-spot').value=[...$('rb-test-spot').options].some(o=>o.value===tk)?tk:'random'}
$('rb-load').onchange=e=>{const v=e.target.value;e.target.value='';if(!v)return;rbPush();
  if(v==='empty'){rbB.map=new Map();rbB.acts=['Raise','Call'];rbB.editId=null;$('rb-name').value=''}
  else if(v.startsWith('my|')){const r=myRanges.find(x=>x.id===v.slice(3));if(!r)return;rbB.map=myRangeMap(r);rbB.acts=r.acts.slice();rbB.editId=r.id;$('rb-name').value=r.name}
  else{const s=SPOTS.find(x=>x.id===v.slice(6));rbB.map=new Map(s.map);rbB.acts=s.acts.slice(0,-1);if(rbB.acts.length<2)rbB.acts.push(rbB.acts[0]==='Call'?'Raise':'Call');rbB.editId=null;$('rb-name').value='My '+s.name;
    if(!$('rb-cmp').value)$('rb-cmp').value='chart|'+s.id}
  rbB.brush=0;rbRender();rbChanged()};
function rbNotation(){if(rbMode!=='build')return;
  $('rb-notation').innerHTML=rbB.acts.map((a,k)=>{const set=new Set([...rbB.map].filter(([,x])=>x===k).map(([l])=>l));
    return `<div class="row" style="align-items:end;gap:8px"><label class="field" for="rb-nt-${k}" style="flex:1 1 220px"><span>${esc(a)} range</span><input type="text" id="rb-nt-${k}" value="${esc(rangeToText(set))}" spellcheck="false" autocomplete="off"></label><button class="act ghost" type="button" data-nt="${k}">Apply</button></div>`}).join('')
    +'<p class="small muted" id="rb-nt-msg">Type notation like 22+, A2s+, KTo+, A5s-A2s and press Apply to replace that action\'s hands.</p>'}
$('rb-notation').onclick=e=>{const b=e.target.closest('[data-nt]');if(!b)return;const k=+b.dataset.nt,txt=$('rb-nt-'+k).value.trim(),set=parseRange(txt);
  if(txt&&!set.size){$('rb-nt-msg').textContent='Could not read that. Use notation like 22+, A2s+, KTo+, A5s-A2s.';return}
  rbPush();for(const[l,a]of[...rbB.map])if(a===k)rbB.map.delete(l);set.forEach(l=>rbB.map.set(l,k));rbRender();rbChanged()};
function listHands(arr,max=24){return arr.length>max?arr.slice(0,max).join(', ')+` and ${arr.length-max} more`:arr.join(', ')}
function diffHTML(d,map,acts,spot,you){const parts=[];
  if(d.add.length)parts.push(`<li><b>${you} play, chart folds (${d.add.length}):</b> ${listHands(d.add)}</li>`);
  if(d.miss.length)parts.push(`<li><b>Chart plays, ${you.toLowerCase()} fold (${d.miss.length}):</b> ${listHands(d.miss.map(l=>`${l} (${spot.acts[spot.map.get(l)]})`))}</li>`);
  if(d.diff.length)parts.push(`<li><b>Different action (${d.diff.length}):</b> ${listHands(d.diff.map(l=>`${l} (${acts[map.get(l)]} vs ${spot.acts[spot.map.get(l)]})`))}</li>`);
  return parts.length?`<ul class="rb-diff">${parts.join('')}</ul>`:'<p class="small">Identical to the chart.</p>'}
function rbCompare(){const v=$('rb-cmp').value;if(!v){rbB.marks=null;$('rb-cmp-out').innerHTML='';rbRender();return}
  const s=SPOTS.find(x=>x.id===v.slice(6)),d=rangeDiff(rbB.map,s);rbB.marks=d.marks;rbRender();
  const cc=a=>comboSum([...s.map].filter(([,x])=>x===a).map(([l])=>l));
  $('rb-cmp-out').innerHTML=`<p>${pct(d.score,0)} match with <b>${esc(s.name)}</b> (${s.acts.slice(0,-1).map((a,k)=>`${a} ${pct(cc(k)/1326)}`).join(', ')}). Hands that differ have a red outline.</p>${diffHTML(d,rbB.map,rbB.acts,s,'You')}`}
$('rb-cmp').onchange=rbCompare;

/* saving and the saved list */
const rangeSummary=r=>{const m=myRangeMap(r);return r.acts.map((a,k)=>`${a} ${pct(comboSum([...m].filter(([,x])=>x===k).map(([l])=>l))/1326)}`).join(' · ')};
const rangeText=r=>{const m=myRangeMap(r);return r.name+'\n'+r.acts.map((a,k)=>`${a}: ${rangeToText(new Set([...m].filter(([,x])=>x===k).map(([l])=>l)))||'(none)'}`).join('\n')};
$('rb-save').onclick=()=>{const name=$('rb-name').value.trim(),msg=$('rb-save-msg');
  if(!name){msg.textContent='Give the range a name first.';msg.className='small bad';$('rb-name').focus();return}
  if(!rbB.map.size){msg.textContent='Paint at least one hand before saving.';msg.className='small bad';return}
  let r=myRanges.find(x=>x.id===rbB.editId&&x.name===name)||myRanges.find(x=>x.name.toLowerCase()===name.toLowerCase());const isNew=!r;
  if(!r){r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5)};myRanges.push(r)}
  Object.assign(r,{name,acts:rbB.acts.slice(),map:Object.fromEntries(rbB.map),updated:new Date().toISOString()});rbB.editId=r.id;
  saveMyRanges();rbBuildSelects();rbSavedList();buildPresets();
  msg.textContent=`${isNew?'Saved':'Updated'} "${name}" on this device. It is now in the equity calculator under My ranges.`;msg.className='small good'};
function rbSavedList(){const el=$('rb-saved');
  if(!myRanges.length){el.innerHTML='<p class="small muted">Nothing saved yet. Ranges you save stay on this device.</p>';return}
  el.innerHTML=myRanges.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<div><b>${esc(r.name)}</b><span class="small muted">${rangeSummary(r)}</span>
    <span class="row" style="gap:10px"><button class="linkbtn" data-rl="${r.id}">Edit</button><button class="linkbtn" data-rc="${r.id}">Use in calculator</button><button class="linkbtn" data-rx="${r.id}">Copy text</button><button class="linkbtn" data-rd="${r.id}">Delete</button></span></div>`).join('')}
$('rb-saved').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.rl){$('rb-load').value='my|'+d.rl;$('rb-load').dispatchEvent(new Event('change'));$('rb-grid').scrollIntoView({block:'nearest',behavior:'smooth'})}
  if(d.rc){const r=myRanges.find(x=>x.id===d.rc);$('rpreset').value=`my|${r.id}|${r.acts.length>1?'all':0}`;$('rpreset').dispatchEvent(new Event('change'));setVmode('range');location.hash='#calculator'}
  if(d.rx){const r=myRanges.find(x=>x.id===d.rx);try{await navigator.clipboard.writeText(rangeText(r));b.textContent='Copied'}catch(err){b.textContent='Copy blocked here';$('rb-save-msg').textContent=rangeText(r).replace(/\n/g,' · ');$('rb-save-msg').className='small'}setTimeout(()=>b.textContent='Copy text',1800)}
  if(d.rd){if(b.dataset.armed){myRanges=myRanges.filter(x=>x.id!==d.rd);if(rbB.editId===d.rd)rbB.editId=null;saveMyRanges();rbBuildSelects();rbSavedList();buildPresets()}
    else{b.dataset.armed='1';b.textContent='Confirm delete';b.style.color='var(--bad)';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Delete';b.style.color=''}},4000)}}};

/* ---------- test yourself ---------- */
function rbPickSpot(){const v=$('rb-test-spot').value;if(v!=='random')return SPOTS.find(x=>x.id===v.slice(6));
  const list=SPOTS.filter(s=>s.game===mode&&(!rbT.s||s!==rbT.s||SPOTS.filter(x=>x.game===mode).length<2));
  const ag=new Map(aggregate(historyRows().filter(r=>r.drill==='Range builder')).map(a=>[a.spot,a]));
  return weightedPick(list,list.map(s=>weakWeight(ag.get(s.name))))}
function rbNewTest(){const s=rbPickSpot();Object.assign(rbT,{s,map:new Map(),acts:s.acts.slice(0,-1),undo:[],brush:0,logged:false,marks:null,t0:Date.now()});
  $('rb-test-name').textContent=s.name;$('rb-test-text').textContent=spotText(s);
  $('rb-check').textContent='Check';
  $('rb-test-out').innerHTML=`<p class="small muted">Paint the ${esc(s.name)} chart from memory, then press Check. Anything left empty is a fold.</p>`;rbRender()}
function rbCheck(){const s=rbT.s,d=rangeDiff(rbT.map,s),ok=d.score>=.9;rbT.marks=d.marks;rbRender();
  if(!rbT.logged){rbT.logged=true;
    logEvent({drill:'Range builder',spot:s.name,hand:d.add.concat(d.miss,d.diff).slice(0,12).join(' '),answer:pct(d.score,0)+' match',expected:'90%+',correct:ok,
      detail:`${d.marks.size} hands off: ${d.add.length} extra, ${d.miss.length} missing, ${d.diff.length} wrong action`,ms:Date.now()-rbT.t0})}
  const verdict=d.score>=.98?'Spot on':ok?'Close enough':d.score>=.75?'Getting there':'Keep studying';
  $('rb-test-out').innerHTML=`<div class="verdict ${ok?'good':'bad'}"><strong>${pct(d.score,0)} match</strong><span>${verdict}. ${d.marks.size?`${d.marks.size} hand${d.marks.size>1?'s':''} differ from the chart; they have a red outline on your grid.`:'Every hand matches the chart.'}</span></div>
    ${diffHTML(d,rbT.map,rbT.acts,s,'You')}<p class="small muted">The chart:</p>${rangeGrid(s)}${chartLegend(s)}`;
  $('rb-check').textContent='Check again'}
$('rb-check').onclick=rbCheck;$('rb-next').onclick=rbNewTest;$('rb-test-spot').onchange=rbNewTest;

/* ---------- mode ---------- */
function setRbMode(m){rbMode=m;$('rb-m-build').setAttribute('aria-pressed',m==='build');$('rb-m-test').setAttribute('aria-pressed',m==='test');
  $('rb-test-head').hidden=$('rb-test-actions').hidden=$('rb-side-test').hidden=m!=='test';$('rb-side-build').hidden=m!=='build';
  if(m==='test'&&!rbT.s)rbNewTest();else rbRender();if(m==='build'){rbNotation();rbLegend()}}
$('rb-m-build').onclick=()=>setRbMode('build');$('rb-m-test').onclick=()=>setRbMode('test');
function rbInit(){rbBuildSelects();rbSavedList();rbNotation();rbRender()}
