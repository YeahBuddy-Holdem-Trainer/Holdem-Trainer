/* ---------- progress ---------- */
const STATUS={bad:'Needs work',ok:'Getting there',good:'Strong',new:'Too few'};
function grade(a){if(a.errN&&!a.graded){const e=a.errSum/a.errN;return{score:e.toFixed(1)+' pt avg miss',need:a.n<5?-1:Math.min(1,e/15),st:a.n<5?'new':e<=5?'good':e<=10?'ok':'bad'}}
  const acc=a.graded?a.c/a.graded:0;return{score:pct(acc,0)+' correct',need:a.graded<5?-1:1-acc,st:a.graded<5?'new':acc>=.9?'good':acc>=.75?'ok':'bad'}}
const topMiss=a=>Object.entries(a.miss).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([h])=>h).join(', ');
function renderProgress(){const rows=log;
  const ag=aggregate(rows).map(a=>({...a,...grade(a)})).sort((x,y)=>y.need-x.need||y.n-x.n);
  const ns=new Set(rows.map(r=>r.session)).size;
  $('src-note').textContent=`${rows.length} result${rows.length===1?'':'s'} across ${ns} session${ns===1?'':'s'}`;
  const weak=ag.filter(a=>a.st==='bad'||a.st==='ok').slice(0,3);
  $('pg-next').innerHTML=weak.length?`<ol class="next">${weak.map(a=>`<li><b>${a.drill} · ${esc(a.spot)}</b>: ${a.score} over ${a.n} attempts.${topMiss(a)?' Most missed: '+topMiss(a)+'.':''} <button class="linkbtn" data-train="${esc(a.drill)}|${esc(a.spot)}">Train this</button></li>`).join('')}</ol>`
    :`<p class="small muted">${rows.length?'Nothing below 90% yet with 5 or more attempts. Keep drilling, or take the assessment for a quick read on every area.':'No results yet. Take the assessment or answer a few spots in any trainer and they will show up here.'}</p>`;
  $('pg-table').innerHTML=ag.length?`<thead><tr><th>Area</th><th>Attempts</th><th>Score</th><th>Status</th><th>Avg time</th><th>Most missed</th></tr></thead><tbody>${ag.map(a=>`<tr><td class="t">${a.drill} · ${esc(a.spot)}</td><td>${a.n}</td><td>${a.score}</td><td><span class="chip ${a.st}">${STATUS[a.st]}</span></td><td>${(a.ms/a.n/1000).toFixed(1)}s</td><td>${topMiss(a)||'–'}</td></tr>`).join('')}</tbody>`:'';
  updateQ()}
/* account panel in Progress */
$('pg-account').onclick=()=>window.openAccount&&window.openAccount();
$('sync-now').onclick=()=>{if(!signedIn()){window.openAccount&&window.openAccount();return}if(!queue.length){setSync('Everything is already saved.','good');return}sync()};

/* "Train this" links from Progress and the assessment */
function trainTo(drill,spot){const hash=TRAIN_HASH[drill]||'preflop';
  if(drill==='Preflop'){const s=spot&&spotByName(spot);if(s&&s.game!==mode)setMode(s.game);
    $('pf-type').value='all';$('pf-stack').value='all';buildPfSetup(s?s.id:'focus');newPF()}
  if(drill==='Range builder'){const s=spot&&spotByName(spot);if(s&&s.game!==mode)setMode(s.game);setRbMode('test');$('rb-test-spot').value=s?'chart|'+s.id:'random';rbNewTest()}
  if(drill==='Bet sizing'){const sc=SZ_SC.find(x=>x.label===spot);$('sz-street').value=sc?sc.street:'mixed';newSZ(sc)}
  if(drill==='Range vs board'){$('rvb-guess').checked=true;$('rvb-rand').click()}
  if(drill==='Matchups'){const m=MU.find(x=>x.name===spot);$('mu-cat').value=m?m.id:'mixed';newMU()}
  location.hash='#'+hash}
document.addEventListener('click',e=>{const b=e.target.closest('[data-train]');if(!b)return;const [d,...s]=b.dataset.train.split('|');trainTo(d,s.join('|'))});

/* ---------- mode & routing ---------- */
function applyModeLook(m){document.documentElement.dataset.mode=m==='cash'?'cash':'tour';
  $('m-cash').setAttribute('aria-pressed',m==='cash');$('m-tour').setAttribute('aria-pressed',m!=='cash');
  $('qz-game').textContent=m==='cash'?'cash (100 BB, 6-max)':'tournament'}
function setMode(m){mode=m;applyModeLook(m);buildPfSetup();newPF();newPO();newCF();rbBuildSelects();buildPresets();fhtSeatOptions();fhDeal();newHVR();newRVR();newTX();newRD();newPT()}
$('m-cash').onclick=()=>{if(mode!=='cash')setMode('cash')};$('m-tour').onclick=()=>{if(mode==='cash')setMode('tour')};
const VIEWS=['daily','leaks','assessment','progress','pot-odds','call-or-fold','matchups','street-equity','hvr','rvr','calculator','board','sizing','texture','pots','icm','preflop','ranges','combos','hand','reading','exploit','replay','log'];
/* sections: Odds and EV ideas are the same in cash and tournaments; Equity ranges, charts and play differ, so those views show the Cash/Tournament switch */
const SECTIONS={home:['daily','leaks','assessment','progress'],odds:['pot-odds','call-or-fold'],equity:['matchups','street-equity','hvr','rvr','calculator','board'],ev:['sizing','texture','pots','icm'],ranges:['preflop','ranges','combos'],play:['hand','reading','exploit','replay','log']};
const VIEW_LABEL={daily:'Today',leaks:'Leak finder',assessment:'Assessment',progress:'Progress','pot-odds':'Pot odds','call-or-fold':'Call or fold',matchups:'Hand vs hand','street-equity':'Street by street',
  hvr:'Hand vs range',rvr:'Range vs range',calculator:'Calculator',board:'Range vs board',sizing:'Bet sizing',texture:'Board texture',pots:'3-bet & multiway',icm:'ICM (tournament)',preflop:'Preflop charts',ranges:'Range builder',combos:'Combinatorics',hand:'Full hand',reading:'Hand reading',exploit:'Exploit drills',replay:'Replayer',log:'Hand log'};
const MODE_VIEWS=['pots','reading','texture','hvr','rvr','calculator','board','preflop','ranges','hand'];
const UNIT_VIEWS=['pot-odds','call-or-fold','log'];
const secOf=v=>Object.keys(SECTIONS).find(k=>SECTIONS[k].includes(v));
const lastInSec={};
function unitsSeg(){const bb=cfg.units==='bb';return `<div class="seg units" role="group" aria-label="Show amounts as"><button type="button" data-units="money" aria-pressed="${!bb}">$ / chips</button><button type="button" data-units="bb" aria-pressed="${bb}">BB</button></div>`}
function route(){const h=location.hash.slice(1),v=VIEWS.includes(h)?h:'daily';currentView=v;const sec=secOf(v);
  VIEWS.forEach(x=>$('v-'+x).hidden=x!==v);
  if(sec!=='home'){lastInSec[sec]=v;try{localStorage.setItem(LASTVIEWKEY,v)}catch(e){}}
  document.querySelectorAll('.secnav a').forEach(a=>{const s=a.dataset.sec;a.href='#'+(s==='home'?'home':lastInSec[s]||SECTIONS[s][0]);
    if(s===sec)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  document.querySelector('.seg.mode').hidden=!MODE_VIEWS.includes(v);
  const sn=$('subnav');sn.hidden=false;
  sn.innerHTML=`<div class="subtabs">${SECTIONS[sec].map(x=>`<a href="#${x==='daily'?'home':x}"${x===v?' aria-current="page"':''}>${VIEW_LABEL[x]}</a>`).join('')}</div>${UNIT_VIEWS.includes(v)?unitsSeg():''}${sec!=='home'&&v!=='log'?'<button type="button" class="flag-btn flag-sub" aria-label="Flag this spot" title="Flag this spot">⚑</button>':''}`;
  const cur=sn.querySelector('[aria-current]');if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest',inline:'nearest'});
  if(v==='progress')renderProgress();if(v==='daily'&&!daily)dailyHome();if(v==='replay')rpList();if(v==='log')lgRender();if(v==='exploit')xpOpponents();if(v==='leaks')lkRender();
  window.scrollTo(0,0)}
/* $ / BB switch: a fresh spot in the drills, redrawn in the log */
$('subnav').addEventListener('click',e=>{const b=e.target.closest('[data-units]');if(!b)return;cfg.units=b.dataset.units;
  try{localStorage.setItem(CFGKEY,JSON.stringify(cfg))}catch(err){}
  $('subnav').querySelectorAll('[data-units]').forEach(x=>x.setAttribute('aria-pressed',x===b));
  if(currentView==='pot-odds')newPO();if(currentView==='call-or-fold')newCF();if(currentView==='log')lgRender()});
window.addEventListener('hashchange',route);

/* ---------- start ---------- */
poStats();pfStats();muStats();$('cf-score').textContent=`${stats.cf.c}/${stats.cf.n}`;
buildPfSetup();buildPresets();rbInit();rvbInit();fhInit();rpInit();lgInit();eqDrillsInit();cbInit();txInit();rdInit();ptInit();xpInit();icmInit();
newPF();newMU();newPO();newCF();newSE();newSZ();szStats();
$('rpreset').value=presetDef('calc');$('rpreset').dispatchEvent(new Event('change'));setVmode('range');
applyModeLook(mode);route();runCalc();updateQ();sync();
