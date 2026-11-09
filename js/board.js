/* ---------- range vs board ----------
   Breaks a range into made hands and draws on a 3-5 card board, Flopzilla-style.
   Every unblocked combo is classified once; percentages are of live combos.
   Optional second range for side-by-side comparison, and a "guess first" drill. */
const RVB_MADE=[
  ['fh','Full house or better'],['flush','Flush'],['straight','Straight'],['set','Set'],['trips','Trips'],['twopair','Two pair'],
  ['overpair','Overpair'],['tpgk','Top pair, good kicker'],['tpwk','Top pair, weak kicker'],['ppbelow','Pocket pair below top card'],
  ['middle','Middle pair'],['weak','Bottom pair or weak pocket pair'],['ahigh','Ace high'],['nothing','No pair']];
const RVB_DRAW=[['combo','Combo draw (flush + straight draw)'],['fd','Flush draw'],['oesd','Open-ended straight draw'],['gut','Gutshot'],['air','No pair, no draw']];
const RVB_STRONG=new Set(['fh','flush','straight','set','trips','twopair']);
const RVB_TPPLUS=new Set([...RVB_STRONG,'overpair','tpgk','tpwk']);
const RVB_PAIRS=new Set(['overpair','tpgk','tpwk','ppbelow','middle','weak']);

const rankMask=cs=>cs.reduce((m,c)=>m|1<<(c>>2),0);
/* straight-draw outs: distinct ranks that make a straight using at least one hole card */
function straightOuts(hole,board){const hm=rankMask(hole.concat(board)),bm=rankMask(board);if(sHigh(hm)>=0)return 0;let n=0;
  for(let r=0;r<13;r++){if(hm>>r&1)continue;if(sHigh(hm|1<<r)>=0&&sHigh(bm|1<<r)<0)n++}return n}
function rvbClassify(hole,board){
  const v=evalHand(hole.concat(board)),cat=Math.floor(v/B5),bv=evalHand(board),bc=Math.floor(bv/B5);
  const hr=hole.map(c=>c>>2),br=board.map(c=>c>>2),uniq=[...new Set(br)].sort((a,b)=>b-a),top=uniq[0],pocket=hr[0]===hr[1];
  let made;
  if(cat>=6&&v>bv)made='fh';
  else if(cat===5&&v>bv)made='flush';
  else if(cat===4&&v>bv)made='straight';
  else if(cat===3&&!(bc===3)){made=pocket?'set':'trips'}
  else{
    /* pairs made with hole cards */
    const paired=hr.filter(r=>br.includes(r));
    if(paired.length===2&&!pocket)made='twopair';
    else if(pocket&&!br.includes(hr[0]))made=hr[0]>top?'overpair':hr[0]>(uniq[1]??-1)?'ppbelow':'weak';
    else if(paired.length){const p=Math.max(...paired),k=hr.find(r=>r!==p)??p;
      made=p===top?(k>=9?'tpgk':'tpwk'):p===uniq[1]?'middle':'weak'}
    else made=hr.includes(12)?'ahigh':'nothing'}
  let draw=null;
  if(board.length<5&&!RVB_STRONG.has(made)){const all=hole.concat(board);
    const fd=[0,1,2,3].some(s=>all.filter(c=>(c&3)===s).length===4&&hole.some(c=>(c&3)===s));
    const so=straightOuts(hole,board);
    draw=fd&&so?'combo':fd?'fd':so>=2?'oesd':so===1?'gut':null;
    if(!draw&&(made==='ahigh'||made==='nothing'))draw='air'}
  else if(board.length===5&&(made==='ahigh'||made==='nothing'))draw='air';
  return{made,draw}}
function rvbAnalyze(labels,board){const dead=new Set(board),m={},d={},cells={};let n=0;
  for(const l of labels)for(const h of labelCombos(l)){if(dead.has(h[0])||dead.has(h[1]))continue;const c=rvbClassify(h,board);n++;
    m[c.made]=(m[c.made]||0)+1;if(c.draw)d[c.draw]=(d[c.draw]||0)+1;
    (cells[l]=cells[l]||[]).push(c)}
  const sum=set=>Object.entries(m).filter(([k])=>set.has(k)).reduce((q,[,x])=>q+x,0);
  const draws=['combo','fd','oesd'].reduce((q,k)=>q+(d[k]||0),0);
  return{n,m,d,cells,strong:sum(RVB_STRONG),tpplus:sum(RVB_TPPLUS),pairs:sum(RVB_PAIRS),bigdraws:draws}}

/* ---------- board picker ---------- */
let rvbBoard=[],rvbActive=0,rvbSel='tpplus',rvbGuess=null;
function rvbSlots(){$('rvb-slots').innerHTML=[0,1,2,3,4].map(i=>`<button class="slot ${i===rvbActive?'active':''}" data-i="${i}" aria-label="${['Flop','Flop','Flop','Turn','River'][i]} card ${rvbBoard[i]==null?'empty':names([rvbBoard[i]])}">${cardHTML(rvbBoard[i]??null)}</button>`).join('');
  const used=new Set(rvbBoard.filter(c=>c!=null));
  $('rvb-grid').innerHTML=[0,1,2,3].map(s=>R.split('').reverse().map(r=>{const c=R.indexOf(r)*4+s;return `<button data-c="${c}" class="${isRed(c)?'red':''}" ${used.has(c)?'disabled':''} aria-label="${r}${S[s]}">${rankTxt(R.indexOf(r))}${SYM[s]}</button>`}).join('')).join('')}
$('rvb-slots').onclick=e=>{const b=e.target.closest('.slot');if(!b)return;const i=+b.dataset.i;if(rvbBoard[i]!=null){rvbBoard[i]=null;rvbBoard=rvbBoard.slice(0,i).concat(rvbBoard.slice(i+1))}rvbActive=Math.min(i,rvbBoard.filter(c=>c!=null).length);rvbGuess=null;rvbSlots();rvbRun()};
$('rvb-grid').onclick=e=>{const b=e.target.closest('button[data-c]');if(!b||b.disabled)return;rvbBoard[rvbActive]=+b.dataset.c;rvbBoard=rvbBoard.filter(c=>c!=null);rvbActive=Math.min(rvbBoard.length,4);rvbGuess=null;rvbSlots();rvbRun()};
$('rvb-rand').onclick=()=>{rvbBoard=shuffled().slice(0,3);rvbActive=3;rvbGuess=null;rvbSlots();rvbRun()};
$('rvb-card').onclick=()=>{if(rvbBoard.length<3||rvbBoard.length>=5)return;rvbBoard.push(deckWithout(rvbBoard)[Math.floor(Math.random()*(52-rvbBoard.length))]);rvbActive=Math.min(rvbBoard.length,4);rvbGuess=null;rvbSlots();rvbRun()};

/* board texture in words, used for labels and progress */
function texture(b){const f=b.slice(0,3),suits=new Set(f.map(c=>c&3)).size,ranks=f.map(c=>c>>2).sort((x,y)=>y-x);
  const paired=new Set(ranks).size<3,conn=ranks[0]-ranks[2]<=4&&!paired;
  const hi=ranks[0]===12?'ace-high':ranks[0]>=9?`${R[ranks[0]]}-high`:'low';
  return `${hi} ${suits===1?'monotone':suits===2?'two-tone':'rainbow'}${paired?' paired':conn?' connected':''}`}

/* ---------- output ---------- */
function rvbSelects(){const a=$('rvb-a'),b=$('rvb-b');if(!a)return;const ka=a.value,kb=b.value,h=presetOptionsHTML();
  a.innerHTML=h;b.innerHTML=h.replace('<option value="">Choose a chart range…</option>','<option value="">None (one range only)</option>');
  if([...a.options].some(o=>o.value===ka))a.value=ka;if([...b.options].some(o=>o.value===kb))b.value=kb}
const optText=sel=>sel.value?sel.options[sel.selectedIndex].text:'';
let rvbMax=1;
function rvbRow(key,label,A,B,kind){const pa=A?(kind==='m'?A.m:A.d)[key]||0:0,pb=B?(kind==='m'?B.m:B.d)[key]||0:0;
  if(!pa&&!(B&&pb))return '';const w=x=>`<div class="bar"><div class="w" style="width:${Math.min(100,x/rvbMax*100)}%"></div></div>`;
  return `<tr class="${rvbSel===key?'sel':''}" data-k="${key}"><td>${label}</td><td>${w(pa/A.n)}</td><td class="n">${pct(pa/A.n)}<small>${pa}</small></td>${B?`<td>${w(pb/B.n)}</td><td class="n">${pct(pb/B.n)}<small>${pb}</small></td>`:''}</tr>`}
function rvbSummary(X){return `<div class="rvb-sum"><span><b>${pct(X.tpplus/X.n,0)}</b> top pair or better</span><span><b>${pct(X.strong/X.n,0)}</b> two pair or better</span><span><b>${pct(X.bigdraws/X.n,0)}</b> flush or open-ended draws</span><span><b>${pct((X.d.air||0)/X.n,0)}</b> no pair, no draw</span></div>`}
function inSel(c){if(rvbSel==='tpplus')return RVB_TPPLUS.has(c.made);if(rvbSel==='strong')return RVB_STRONG.has(c.made);return c.made===rvbSel||c.draw===rvbSel}
function rvbGridHTML(A){let h='';for(let i=12;i>=0;i--)for(let j=12;j>=0;j--){const l=gridLabel(i,j),cs=A.cells[l];
    if(!cs){h+=`<span title="${l}: not in range or blocked">${l}</span>`;continue}const k=cs.filter(inSel).length,f=k/cs.length;
    h+=`<span class="${k?'a0':'inr'}" style="${k?`opacity:${.35+.65*f}`:''}" title="${l}: ${k} of ${cs.length} combos">${l}</span>`}
  return `<div class="rgrid" role="img" aria-label="Range grid, highlighted hands match the selected row">${h}</div>`}
function rvbRun(){const out=$('rvb-out'),va=$('rvb-a').value;
  if(rvbBoard.length<3){out.innerHTML='<p class="small muted">Deal or pick at least a flop.</p>';$('rvb-tex').textContent='';return}
  if(!va){out.innerHTML='<p class="small muted">Choose a range.</p>';return}
  $('rvb-tex').textContent=`${texture(rvbBoard)} flop${rvbBoard.length>3?` · ${['','','','','turn','river'][rvbBoard.length]} dealt`:''}`;
  const A=rvbAnalyze(presetRange(va),rvbBoard),vb=$('rvb-b').value,B=vb?rvbAnalyze(presetRange(vb),rvbBoard):null;
  if(!A.n){out.innerHTML='<p class="small">Every hand in that range is blocked by the board.</p>';return}
  if($('rvb-guess').checked&&!rvbGuess){out.innerHTML=`<form id="rvb-gform" class="row" style="align-items:end;gap:8px"><label class="field" for="rvb-gin"><span>Your guess: how often does <b>${esc(optText($('rvb-a')))}</b> have top pair or better here? (%)</span><input type="text" inputmode="decimal" id="rvb-gin" autocomplete="off" style="max-width:120px"></label><button class="act">Check</button></form>`;
    $('rvb-gform').onsubmit=e=>{e.preventDefault();const g=parseFloat($('rvb-gin').value);if(isNaN(g))return;const actual=A.tpplus/A.n*100,err=Math.abs(g-actual);
      rvbGuess={g,actual,err};logEvent({drill:'Range vs board',spot:texture(rvbBoard).replace(/^\S+ /,''),hand:names(rvbBoard),answer:g,expected:+actual.toFixed(1),correct:err<=7.5,error:+err.toFixed(1),detail:optText($('rvb-a'))});rvbRun()};
    $('rvb-gin').focus();return}
  rvbMax=Math.max(...[A,B].filter(Boolean).flatMap(X=>[...Object.values(X.m),...Object.values(X.d)].map(v=>v/X.n)),.01);
  const head=`<tr><th></th><th colspan="2">${esc(optText($('rvb-a')))} <small>${A.n} combos</small></th>${B?`<th colspan="2">${esc(optText($('rvb-b')))} <small>${B.n} combos</small></th>`:''}</tr>`;
  const sec=t=>`<tr class="sec"><td colspan="${B?5:3}">${t}</td></tr>`;
  const groupRow=(key,label)=>{const f=X=>X[key]/X.n;return `<tr class="${rvbSel===key?'sel':''} grp" data-k="${key}"><td><b>${label}</b></td><td><div class="bar"><div class="w" style="width:${f(A)*100}%"></div></div></td><td class="n"><b>${pct(f(A))}</b></td>${B?`<td><div class="bar"><div class="w" style="width:${f(B)*100}%"></div></div></td><td class="n"><b>${pct(f(B))}</b></td>`:''}</tr>`};
  const verdict=rvbGuess?`<div class="verdict ${rvbGuess.err<=7.5?'good':'bad'}"><strong>${rvbGuess.err<=7.5?'Close':'Off by '+rvbGuess.err.toFixed(0)+' pts'}</strong><span>You guessed ${rvbGuess.g}%. Actual: <b>${rvbGuess.actual.toFixed(1)}%</b> top pair or better.</span></div>`:'';
  out.innerHTML=verdict+rvbSummary(A)+(B?`<p class="small muted" style="margin:0">Second range:</p>`+rvbSummary(B)+rvbCompare(A,B):'')
    +`<div style="overflow-x:auto"><table class="rvb">${head}${sec('Made hands')}${groupRow('strong','Two pair or better')}${groupRow('tpplus','Top pair or better')}${RVB_MADE.map(([k,l])=>rvbRow(k,l,A,B,'m')).join('')}${sec(rvbBoard.length<5?'Draws (hands weaker than two pair)':'No pair')}${RVB_DRAW.map(([k,l])=>rvbRow(k,l,A,B,'d')).join('')}</table></div>
    <p class="small muted">Bars for single rows are scaled to the largest row so small shares stay visible. Click a row to highlight those hands in <b>${esc(optText($('rvb-a')))}</b>. Darker means more of that hand's combos fit.</p>${rvbGridHTML(A)}`}
function rvbCompare(A,B){const s=x=>x.strong/x.n,t=x=>x.tpplus/x.n,na=optText($('rvb-a')),nb=optText($('rvb-b')),lines=[];
  const lead=(fa,fb,what)=>{const d=(fa-fb)*100;if(Math.abs(d)<3)return `About even on ${what}.`;return `<b>${esc(d>0?na:nb)}</b> has more ${what} (${pct(Math.max(fa,fb),0)} vs ${pct(Math.min(fa,fb),0)}).`};
  lines.push(lead(s(A),s(B),'two pair or better'));lines.push(lead(t(A),t(B),'top pair or better'));
  return `<p class="small">${lines.join(' ')} The range with more strong hands can bet bigger; a range with few strong hands is "capped" and folds more to pressure.</p>`}
$('rvb-out').onclick=e=>{const tr=e.target.closest('tr[data-k]');if(!tr)return;rvbSel=tr.dataset.k;rvbRun()};
$('rvb-a').onchange=$('rvb-b').onchange=()=>{rvbGuess=null;rvbRun()};
$('rvb-guess').onchange=()=>{rvbGuess=null;rvbRun()};
function rvbInit(){rvbSelects();$('rvb-a').value='cash-btn-open|0';$('rvb-b').value='cash-bb-vs-btn-open|1';rvbBoard=shuffled().slice(0,3);rvbActive=3;rvbSlots();rvbRun()}
