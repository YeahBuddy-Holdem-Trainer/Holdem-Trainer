/* ---------- bet sizing trainer ----------
   You are the preflop raiser and it is your turn to bet or check. Pick a size bucket.
   Two answer keys: "exploit" (from the Hungry Horse / Fitzgerald notes, vs a typical live recreational player)
   and "GTO" (simplified solver-style rules of thumb, not solver output).
   Each scenario fixes the line so far; the hero hand is dealt from the hero's preflop range until it lands in the wanted category. */
const SZB=[
  {id:'check',name:'Check',f:0},{id:'small',name:'Small',f:.33,tag:'⅓ pot'},{id:'medium',name:'Medium',f:.6,tag:'½–⅔ pot'},
  {id:'large',name:'Large',f:.85,tag:'¾–pot'},{id:'over',name:'Overbet',f:1.5,tag:'1.5× pot'},{id:'jam',name:'All in',f:null}];
const SZI=Object.fromEntries(SZB.map((b,i)=>[b.id,i]));
const SZCAT={strong:'Strong: two pair or better',tptk:'Top pair, good kicker (or an overpair)',thin:'Top pair, weak kicker',sdv:'Showdown value: middle pair, bottom pair or an underpair',draw:'A draw: flush draw or open-ended straight draw',air:'Air: no pair and no real draw'};
const SZCAT_SHORT={strong:'strong hand',tptk:'top pair, good kicker',thin:'top pair, weak kicker',sdv:'showdown value',draw:'draw',air:'air'};
const SRC={hack:'ppHlJ984BUA',fix:'S9ZuUUG-YBg',rv:'QcF5jM-iaMk',med:'R9NfdIjKKOc',oop:'Eimf0ExhSjM',val:'QX4SMbCOBrY',ovb:'-gV6_kXew58',spots:'zX8K86Zldic',fe:'dO72Os-XUyE'};
const srcLink=(k,ts,label)=>{const s=ts.split(':').reduce((a,x)=>a*60+ +x,0);return `<a href="https://youtu.be/${SRC[k]}?t=${s}" target="_blank" rel="noopener">${label||'Watch'} ${ts}</a>`};

/* line so far: pot and stack in BB at the decision point */
const SZ_LINES={
  srp:{text:'You open 2.5 BB on the button and the big blind calls.',hero:'BTN',vil:'BB',range:'cash-btn-open',act:0,pot:5.5,stack:97.5},
  oop:{text:'You open 2.5 BB in the cutoff, the button calls and the blinds fold.',hero:'CO',vil:'BTN',range:'cash-co-open',act:0,pot:6.5,stack:97.5},
  tbp:{text:'The cutoff opens 2.5 BB, you 3-bet to 8.5 BB on the button and the cutoff calls.',hero:'BTN',vil:'CO',range:'cash-btn-vs-co-open',act:0,pot:18.5,stack:91.5}};
const SZ_SC=[
  {id:'f-wet',street:'Flop',line:'srp',flop:'wet',label:'Flop · wet board, in position'},
  {id:'f-dry',street:'Flop',line:'srp',flop:'dry',label:'Flop · dry board, in position'},
  {id:'f-ace',street:'Flop',line:'srp',flop:'ace',label:'Flop · dry ace-high board'},
  {id:'f-oop',street:'Flop',line:'oop',flop:'any',label:'Flop · out of position'},
  {id:'f-3bp',street:'Flop',line:'tbp',flop:'wet',label:'Flop · 3-bet pot, wet board'},
  {id:'t-blank',street:'Turn',line:'srp',flop:'wet',turn:'blank',hist:[['flop',3]],label:'Turn · blank after a called flop bet'},
  {id:'t-flush',street:'Turn',line:'srp',flop:'wet',turn:'flush',hist:[['flop',3]],label:'Turn · flush card after a called flop bet'},
  {id:'r-capped',street:'River',line:'srp',flop:'wet',turn:'flush',river:'blank',hist:[['flop',3],['turn',4]],label:'River · blank after a small bet on the flush turn'},
  {id:'r-blank',street:'River',line:'srp',flop:'wet',turn:'blank',river:'blank',hist:[['flop',3],['turn',14]],label:'River · blank after a big turn bet'},
  {id:'r-flush',street:'River',line:'srp',flop:'wet',turn:'blank',river:'flush',hist:[['flop',3],['turn',14]],label:'River · flush completes after a big turn bet'}];

/* answer keys: [best, ok, why]. "ok" counts as correct but is not the top choice. */
const K=(best,ok,why)=>({best:best.split(' '),ok:ok?ok.split(' '):[],why});
const SZKEY={
 'f-wet':{
  x:{all:K('medium','small',`Pick the biggest size where they <b>raise their strong hands and call with their weak ones</b>: about half pot in a single-raised pot. Use it with your whole range; value hands and bluffs want the same thing on the flop. ${srcLink('hack','0:00')} ${srcLink('fix','0:48')}`)},
  g:{strong:K('large','medium','Solvers bet less often on wet boards that hit the caller, and use a bigger size for strong hands and good draws.'),tptk:K('medium','large','A good top pair bets for value and protection, often at a medium-to-large size on wet boards.'),
     thin:K('check','small','Medium-strength hands check often on wet boards so the betting range stays strong.'),sdv:K('check','small','Medium-strength hands check often on wet boards so the betting range stays strong.'),
     draw:K('large','medium','Good draws are natural semi-bluffs and use the bigger size.'),air:K('check','large','With no equity, solvers mostly check on wet boards that favor the caller and bluff only some backdoor hands.')}},
 'f-dry':{
  x:{all:K('small','medium',`On a <b>dry board</b>, go a little smaller with your whole range. They don't have many strong hands to raise, and a small bet keeps their weak pairs and floats in. ${srcLink('hack','0:48')}`)},
  g:{all:K('small','',`On dry boards that favor the raiser, solvers bet small (about ⅓) with almost the whole range.`),sdv:K('small','check','Solvers bet small with most hands here; checking some showdown hands is also fine.'),air:K('small','check','Solvers bet small with most hands here, including air.')}},
 'f-ace':{
  x:{strong:K('over','large',`On <b>static ace-high boards</b> small bets don't work: they won't raise strong hands or call with weak ones. Overbet your strong hands; their aces call anyway. ${srcLink('fix','4:28')} ${srcLink('ovb','1:17')}`),
     tptk:K('over','large',`Overbet top pair good kicker on static ace-high boards: weaker aces still call, and small bets get no extra value. ${srcLink('ovb','3:12')}`),
     thin:K('check','',`Overbet or check here. A weak ace can't take a big bet well, so check and keep the pot under control. ${srcLink('fix','5:57')}`),
     sdv:K('check','',`Overbet or check. Hands with showdown value check: a bet folds out worse hands and gets called by aces. ${srcLink('fix','5:57')}`),
     draw:K('over','check',`Overbet bluffs on these boards come from hands with equity or blockers to their slow-plays (a 7 or 2 in your hand). A draw qualifies. ${srcLink('ovb','3:52')}`),
     air:K('check','',`Pure air checks on static ace-high boards. A small bet doesn't fold their aces, and their small pairs fold anyway. ${srcLink('fix','5:14')}`)},
  g:{all:K('small','',`Solvers bet small (about ⅓) at a high frequency on dry ace-high boards, where the raiser has far more strong aces.`),sdv:K('small','check','Solvers bet small often here; checking some medium hands is fine.'),thin:K('small','check','Solvers bet small often here; checking some medium hands is fine.')}},
 'f-oop':{
  x:{all:K('check','',`Out of position against a recreational player, <b>check your entire range</b>. They stab too much, their bet size gives away their hand, and you check-raise your strong hands and draws. (Against good regulars, bet on boards that favor you.) ${srcLink('oop','7:21')}`)},
  g:{strong:K('small','check','Out of position, solvers check a lot but still bet strong hands small on boards that favor the raiser.'),tptk:K('small','check','Out of position, solvers bet some good top pairs small and check the rest.'),
     thin:K('check','small','Medium hands mostly check out of position.'),sdv:K('check','','Medium hands mostly check out of position.'),draw:K('check','small','Out of position, many draws check to check-raise or realize their equity.'),air:K('check','small','Out of position, most air checks; a few hands bluff small.')}},
 'f-3bp':{
  x:{all:K('small','medium',`In a 3-bet pot the pot is already big in dollars, so <b>30–40% of the pot</b> does the job: their strong hands raise and their weak ones call. Use it with your whole range. ${srcLink('med','1:33')}`)},
  g:{all:K('small','','In 3-bet pots solvers bet small with most of the range, because the low stack-to-pot ratio means small bets still get stacks in.'),sdv:K('small','check','Mostly a small bet; some medium hands check.'),air:K('small','check','Mostly a small bet; some air checks.')}},
 't-blank':{
  x:{strong:K('over','large',`They called a half-pot bet on a wet flop, so they would have raised their sets and two pair: on a blank turn they are <b>capped</b> at top pair and draws, which don't fold to a big bet. <b>Bet big.</b> ${srcLink('val','0:40')} ${srcLink('hack','3:10')}`),
     tptk:K('large','over',`They're capped and their top pairs and draws are inelastic, so get money in now with a big bet. ${srcLink('hack','3:10')}`),
     thin:K('check','',`Check back weak top pair: it's too thin to bet big and gets called by better. Then call their river bets. That's "the best line in poker." ${srcLink('spots','24:54')}`),
     sdv:K('check','',`Check back showdown value and catch their river bluffs: "c-bet the flop small, check back the turn with showdown value, call the river." ${srcLink('spots','24:54')}`),
     draw:K('over','large',`Capped opponent plus deep stacks means lots of fold equity. Bet big with value and bluffs alike; your draw has equity when called. ${srcLink('fe','3:03')}`),
     air:K('over','large',`Capped and deep: blast the turn even with air, then keep firing on blank rivers. Their capped range can't take the pressure. ${srcLink('fe','3:46')}`)},
  g:{strong:K('over','large','Turns polarize: strong hands bet big, especially when the caller is capped.'),tptk:K('large','medium','Good top pairs bet a large size for value.'),thin:K('check','small','Medium hands check to keep the betting range strong.'),sdv:K('check','','Medium hands check.'),draw:K('large','over','Good draws bet big as semi-bluffs.'),air:K('check','large','Most air gives up; some hands bluff big to balance the value bets.')}},
 't-flush':{
  x:{strong:K('small','medium',`The flush card <b>changes the nuts</b>. Bet small with your strong hands: their flushes raise you, and their weak hands keep calling. ${srcLink('hack','4:50')} ${srcLink('fix','10:07')}`),
     tptk:K('small','check',`Bet small on the flush card: it gets called by worse and lets their flushes raise so you can fold. ${srcLink('hack','4:50')}`),
     thin:K('check','small',`Check weak top pair on the flush card; there's little left to value-bet. ${srcLink('fix','12:57')}`),
     sdv:K('check','',`Check showdown value when the nuts change. ${srcLink('fix','12:57')}`),
     draw:K('small','check',`Bet small with bluffs too: flushes raise you off cheaply, and a call caps their range for a big river bluff. ${srcLink('hack','5:36')}`),
     air:K('small','check',`Bet small on the flush card with air to "recap" them: flushes raise, and anything that calls is capped for your river bluff. ${srcLink('fe','5:58')}`)},
  g:{strong:K('large','small','Solvers bet their flushes for value, often at a bigger size.'),tptk:K('check','small','When the caller makes flushes, one pair mostly checks.'),thin:K('check','','One pair checks when the flush comes.'),sdv:K('check','','Medium hands check.'),draw:K('check','small','Draws that missed the flush mostly check.'),air:K('check','','Most air gives up when the caller improves.')}},
 'r-capped':{
  x:{strong:K('medium','large',`Their flushes would have raised your small turn bet, so they're <b>capped at top pair</b>. Value-bet a bit smaller than a bluff (about 60%) so top pair still calls. Bluff and value sizes should differ. ${srcLink('rv','5:51')}`),
     tptk:K('small','medium',`Target their top pair with a small bet; they called twice with one pair and will call again. ${srcLink('fix','16:27')}`),
     thin:K('small','check',`A small bet gets called by worse top pairs and second pairs. ${srcLink('fix','16:27')}`),
     sdv:K('check','',`Check and take the showdown; a bet folds worse and gets called by better.`),
     air:K('over','jam',`Their best hand is usually top pair. <b>Bluff big (1.5–2× pot)</b> so top pair folds; you rarely run into a flush. ${srcLink('rv','5:51')} ${srcLink('hack','8:41')}`)},
  g:{strong:K('large','over','A balanced river uses the same large size for value and bluffs.'),tptk:K('small','check','Thin value bets small or checks.'),thin:K('check','small','Thin hands mostly check.'),sdv:K('check','','Medium hands check.'),air:K('large','check','Bluff with the same size as your value bets, at a balanced frequency.')}},
 'r-blank':{
  x:{strong:K('over','jam large',`Their range is top pair and missed draws, and top pair rarely folds anyway. <b>Take the biggest size it still calls.</b> "If you wouldn't jam a bluff because AJ never folds, jam your value." ${srcLink('hack','7:56')} ${srcLink('val','3:33')}`),
     tptk:K('large','medium',`Value medium-large (about pot) to keep their one-pair hands calling. ${srcLink('fix','18:34')}`),
     thin:K('check','',`Too thin to bet big; check back and win at showdown against missed draws.`),
     sdv:K('check','',`Check and show down; betting folds worse hands.`),
     air:K('over','jam small',`Capped and deep: a big overbet folds their one-pair hands. (A tiny bet that folds missed draws is the other option.) ${srcLink('fe','3:46')} ${srcLink('fix','19:21')}`)},
  g:{strong:K('over','large','Strong hands bet big on blank rivers when the caller is capped.'),tptk:K('medium','large','Good one pair bets a medium size for value.'),thin:K('check','','Thin hands check.'),sdv:K('check','','Medium hands check.'),air:K('over','check','Bluffs use the same big size as the value bets, at a balanced frequency.')}},
 'r-flush':{
  x:{strong:K('over','large',`The draws got there, so they <b>can have strong hands now</b>. Reverse the sizes: big value, small (or no) bluffs. ${srcLink('ovb','7:42')}`),
     tptk:K('check','small',`One pair is now a bluff-catcher. Check, and consider your read before calling a big bet.`),
     thin:K('check','',`Check; you can't get value from a range that just made flushes.`),
     sdv:K('check','',`Check and hope to show down.`),
     air:K('check','small',`Don't bluff big into a range that just made flushes. Give up, or bet tiny to fold their weakest hands. ${srcLink('ovb','9:08')}`)},
  g:{strong:K('large','over','Strong hands still bet for value; flushes bet big.'),tptk:K('check','','One pair checks when the flush comes in.'),thin:K('check','','Thin hands check.'),sdv:K('check','','Medium hands check.'),air:K('large','check','Some air bluffs at the same size as the value bets; most gives up.')}}};
function szAnswer(sc,cat,key){const k=SZKEY[sc.id][key];return k[cat]||k.all}

/* ---------- boards and hands ---------- */
const WET=[['J','9','8'],['9','8','3'],['T','7','6'],['Q','J','6'],['8','7','4'],['J','T','4'],['T','9','5'],['7','6','3']];
const DRY=[['K','8','3'],['Q','7','2'],['K','9','4'],['J','6','2'],['Q','8','3']];
const ACE=[['A','7','2'],['A','8','3'],['A','6','2'],['A','9','4']];
const card=(r,s)=>R.indexOf(r)*4+s;
function szFlop(kind){const t=pick(kind==='wet'?WET:kind==='dry'?DRY:ACE),su=shuffle([0,1,2,3]);
  if(kind==='wet'){const o=shuffle([0,1,2]);const s=[su[0],su[0],su[1]];return{cards:o.map((k,i)=>card(t[k],s[i])),fs:su[0]}}
  return{cards:t.map((r,i)=>card(r,su[i])),fs:null}}
/* a card that changes little: off the flush suit, not pairing, at least 2 ranks from every board card */
function szBlank(board,fs){const used=new Set(board),br=board.map(c=>c>>2);
  const ok=[],top=Math.max(...br);for(let r=0;r<top;r++){if(br.includes(r))continue;if(br.some(b=>Math.abs(b-r)<2))continue;for(let s=0;s<4;s++)if(s!==fs&&!used.has(r*4+s)&&board.filter(c=>(c&3)===s).length<2)ok.push(r*4+s)}
  if(!ok.length)for(let r=0;r<12;r++)for(let s=0;s<4;s++)if(!br.includes(r)&&s!==fs&&!used.has(r*4+s)&&board.filter(c=>(c&3)===s).length<2)ok.push(r*4+s);
  return pick(ok)}
function szFlushCard(board,fs){const used=new Set(board),br=board.map(c=>c>>2),ok=[];for(let r=0;r<13;r++)if(!br.includes(r)&&!used.has(r*4+fs))ok.push(r*4+fs);return pick(ok)}
function szBoard(sc){const kind=sc.flop==='any'?pick(['wet','dry','ace']):sc.flop,f=szFlop(kind),b=f.cards.slice();
  if(sc.turn)b.push(sc.turn==='flush'?szFlushCard(b,f.fs):szBlank(b,f.fs));
  if(sc.river){const fsNow=sc.turn==='flush'?null:f.fs;b.push(sc.river==='flush'?szFlushCard(b,f.fs):szBlank(b,sc.turn==='flush'?f.fs:fsNow))}
  return{board:b,kind}}
function szClassify(hero,board){const v=evalHand(hero.concat(board)),cat=Math.floor(v/B5),bc=Math.floor(evalHand(board)/B5);
  const hr=hero.map(c=>c>>2),br=board.map(c=>c>>2),top=Math.max(...br);
  if(cat>=2&&cat>bc)return 'strong';
  if(cat===1){if(hr[0]===hr[1])return hr[0]>top?'tptk':'sdv';
    const p=hr.find(r=>br.includes(r)),k=hr.find(r=>r!==p);if(p===top)return k>=9?'tptk':'thin';return 'sdv'}
  if(board.length<5){const all=hero.concat(board);
    for(let s=0;s<4;s++)if(all.filter(c=>(c&3)===s).length===4&&hero.some(c=>(c&3)===s))return 'draw';
    const rs=new Set(all.map(c=>c>>2));if(rs.has(12))rs.add(-1);
    for(let lo=-1;lo<=8;lo++){let n=0;for(let r=lo;r<lo+4;r++)if(rs.has(r))n++;if(n===4&&lo+3<12&&lo>-1&&hr.some(r=>r>=lo&&r<lo+4))return 'draw'}}
  return 'air'}
const SZW={strong:.2,tptk:.2,thin:.14,sdv:.16,draw:.15,air:.15};
function szDeal(sc){const line=SZ_LINES[sc.line],spot=SPOTS.find(s=>s.id===line.range);
  const combos=shuffle([...spot.map].filter(([,a])=>a===line.act).flatMap(([l])=>labelCombos(l)));
  for(let outer=0;outer<30;outer++){const cats=Object.keys(SZW).filter(c=>c!=='draw'||sc.street!=='River');
    const want=weightedPick(cats,cats.map(c=>SZW[c]));const {board,kind}=szBoard(sc),dead=new Set(board);
    for(const h of combos){if(dead.has(h[0])||dead.has(h[1]))continue;const c=szClassify(h,board);if(c===want)return{hero:h,board,kind,cat:c}}}
  return null}

/* ---------- drill ---------- */
let sz=null;
stats.sz=stats.sz||{n:0,c:0,streak:0};
function szFilter(){const st=$('sz-street').value;return SZ_SC.filter(s=>st==='mixed'||s.street===st)}
function szPick(){const list=szFilter(),ag=new Map(aggregate(historyRows().filter(r=>r.drill==='Bet sizing')).map(a=>[a.spot,a]));
  return weightedPick(list,list.map(s=>weakWeight(ag.get(s.label))))}
function szKey(){return $('sz-k-gto').getAttribute('aria-pressed')==='true'?'g':'x'}
function szAmounts(pot,stack){return SZB.map(b=>{if(b.id==='check')return 0;if(b.id==='jam')return stack;return Math.min(stack,Math.round(b.f*pot*2)/2)})}
/* build one spot: hand, board, pot, sizes and the table picture */
function szMake(sc){let d=szDeal(sc);if(!d)d=szDeal(sc);
  const line=SZ_LINES[sc.line];let pot=line.pot,stack=line.stack;const hist=[];
  for(const[st,b]of sc.hist||[]){hist.push(`${st==='flop'?'Flop':'Turn'}: you bet ${fmtBB(b)} BB and get called.`);pot+=2*b;stack-=b}
  const amts=szAmounts(pot,stack),spr=stack/pot;
  const avail=SZB.map((b,i)=>b.id==='jam'?spr<=3:b.id==='over'?amts[i]<stack:true);
  const seats={};POS.forEach(p=>seats[p]={state:'folded'});seats[line.hero]={state:'hero',stack:fmtBB(stack)+' BB',tag:'You'};seats[line.vil]={state:'vil',stack:fmtBB(stack)+' BB',tag:sc.line==='oop'?'Waiting':'Checks'};
  const nb=sc.street==='Flop'?3:sc.street==='Turn'?4:5;
  const table={hero:line.hero,seats,center:`<span>${sc.street}</span><b>${fmtBB(pot)} BB</b><span>pot</span>`};
  const text=`Cash game, 100 BB deep, against a typical live recreational player. ${line.text} ${hist.join(' ')} ${sc.line==='oop'?'You act first on the flop.':`The ${POSNAME[line.vil]} checks to you.`}`;
  return{sc,...d,line,pot,stack,amts,avail,nb,table,text}}
/* the buttons that count as best / correct for a spot under a key (all in and overbet merge when stacks are short) */
function szGrade(s,key){const ans=szAnswer(s.sc,s.cat,key),eq=x=>(x==='jam'||x==='over')&&s.stack/s.pot<=2?['jam','over']:[x];
  return{ans,best:ans.best.flatMap(eq),ok:ans.ok.flatMap(eq)}}
function newSZ(force){const sc=force||szPick(),m=szMake(sc),line=m.line,d=m,pot=m.pot,amts=m.amts,avail=m.avail,nb=m.nb;
  sz={...m,done:false,t0:Date.now()};
  renderTable($('sz-table'),m.table);
  $('sz-name').textContent=sc.label;
  $('sz-text').innerHTML=m.text;
  $('sz-board').innerHTML=cardsHTML(d.board.slice(0,nb));$('sz-hand').innerHTML=cardsHTML(d.hero);
  $('sz-acts').innerHTML=SZB.map((b,i)=>avail[i]?`<button class="act ${b.id==='check'?'ghost':''}" data-z="${b.id}">${b.name}${b.id==='check'?'':`<small>${b.tag?b.tag+' · ':''}${fmtBB(amts[i])} BB</small>`}</button>`:'').join('')+`<button class="act ghost" data-znext="1">Skip</button>`;
  $('sz-out').innerHTML=`<p class="small muted">Pick a size. The answer uses the <b>${szKey()==='g'?'GTO baseline':'exploit'}</b> key; you'll see both.</p>`}
/* how costly a choice is: distance in size steps, raised when it gives up clear value or bluffs into strength */
function szCost(choice,ans,cat,sc){const ci=SZI[choice],eq=x=>(x==='jam'||x==='over')&&sz.stack/sz.pot<=2?['jam','over']:[x];
  const best=ans.best.flatMap(eq),ok=ans.ok.flatMap(eq);
  if(best.includes(choice))return 'best';if(ok.includes(choice))return 'ok';
  const d=Math.min(...ans.best.map(b=>Math.abs(SZI[b]-ci)));let t=d<=1?1:d===2?2:3;
  const valueHand=cat==='strong'||cat==='tptk';
  if(valueHand&&choice==='check'&&!ans.best.includes('check'))t=Math.max(t,sc.street==='River'?3:2);
  if((cat==='air'||cat==='sdv'||cat==='thin')&&ans.best.includes('check')&&ci>=SZI.large)t=Math.max(t,sc.street==='Flop'?2:3);
  return ['','small','medium','big'][t]}
const SZCOST={best:['Best size','good'],ok:['Also fine','good'],small:['Small mistake','bad'],medium:['Medium mistake','bad'],big:['Big mistake','bad']};
const SZCOSTTXT={small:'A step off the best size: it costs a little, mostly by getting less value or fewer folds.',medium:'This changes how much you win or lose noticeably in this spot.',big:'This is the kind of error that costs big pots: giving up clear value, or putting a lot of money in with the wrong hand.'};
const bName=id=>SZB[SZI[id]].name;
const ansTxt=a=>a.best.map(bName).join(' / ')+(a.ok.length?` <span class="muted">(also fine: ${a.ok.map(bName).join(', ')})</span>`:'');
function szAnswerPick(choice){const s=sz;if(!s||s.done&&!choice)return;const key=szKey(),ans=szAnswer(s.sc,s.cat,key),other=szAnswer(s.sc,s.cat,key==='x'?'g':'x');
  const cost=szCost(choice,ans,s.cat,s.sc),ok=cost==='best'||cost==='ok';
  if(!s.done){s.done=true;stats.sz.n++;if(ok){stats.sz.c++;stats.sz.streak++}else stats.sz.streak=0;save();szStats();
    logEvent({drill:'Bet sizing',spot:s.sc.label,hand:names(s.hero),answer:bName(choice),expected:ans.best.map(bName).join(' / '),correct:ok,
      detail:`${key==='g'?'GTO':'Exploit'} key · ${SZCAT_SHORT[s.cat]} · ${cost==='best'||cost==='ok'?'no':cost} cost · board ${names(s.board)}`,ms:Date.now()-s.t0})}
  const [title,cls]=SZCOST[cost];
  $('sz-out').innerHTML=`<div class="verdict ${cls}"><strong>${title}</strong><span>Your hand: ${SZCAT[s.cat]}.</span></div>
    ${cost!=='best'&&cost!=='ok'?`<p class="small">${SZCOSTTXT[cost]}</p>`:''}
    <div class="szkey"><h4>${key==='g'?'GTO baseline':'Exploit (your notes)'}: ${ansTxt(ans)}</h4><p class="small">${ans.why}</p></div>
    <div class="szkey alt"><h4>${key==='g'?'Exploit (your notes)':'GTO baseline'}: ${ansTxt(other)}</h4><p class="small">${other.why}</p></div>`;
  $('sz-acts').querySelectorAll('[data-z]').forEach(b=>{b.disabled=true;const id=b.dataset.z;if(ans.best.includes(id))b.classList.add('pickok');else if(id===choice)b.classList.add('pickbad')});
  const nx=$('sz-acts').querySelector('[data-znext]');nx.textContent='Next spot';nx.classList.remove('ghost');
  if(window.innerWidth<780)$('sz-out').scrollIntoView({behavior:'smooth',block:'start'});else nx.focus()}
function szStats(){$('sz-score').textContent=`${stats.sz.c}/${stats.sz.n}`;$('sz-streak').textContent=stats.sz.streak}
$('sz-acts').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.znext)newSZ();else szAnswerPick(b.dataset.z)};
$('sz-street').onchange=()=>newSZ();
['x','gto'].forEach(k=>$('sz-k-'+k).onclick=()=>{$('sz-k-x').setAttribute('aria-pressed',k==='x');$('sz-k-gto').setAttribute('aria-pressed',k==='gto');if(!sz.done)$('sz-out').innerHTML=`<p class="small muted">Pick a size. The answer uses the <b>${k==='gto'?'GTO baseline':'exploit'}</b> key; you'll see both.</p>`});
