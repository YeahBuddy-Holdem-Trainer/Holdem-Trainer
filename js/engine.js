/* in the app checks page (index.html?test=1) nothing is saved, so running checks can't touch your data */
if(/[?&]test=1/.test(location.search)){Storage.prototype.setItem=function(){};Storage.prototype.removeItem=function(){}}
/* ---------- cards & evaluator ---------- */
const R='23456789TJQKA', S='shdc', SYM=['♠','♥','♦','♣'];
const CAT=['High card','Pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
const B5=13**5;
const isRed=c=>(c&3)===1||(c&3)===2;
const rankTxt=r=>R[r]==='T'?'10':R[r];
function cardHTML(c,cls=''){if(c==='back')return `<span class="card back ${cls}" aria-label="face-down card"></span>`;if(c==null)return `<span class="card empty ${cls}"></span>`;return `<span class="card ${isRed(c)?'red':''} ${cls}"><b>${rankTxt(c>>2)}</b><i>${SYM[c&3]}</i></span>`}
const cardsHTML=(a,cls)=>a.map(c=>cardHTML(c,cls)).join('');
const names=a=>a.map(c=>R[c>>2]+S[c&3]).join(' ');
function sHigh(m){for(let h=12;h>=4;h--)if(((m>>(h-4))&31)===31)return h;return (m&0x100F)===0x100F?3:-1}
function sc(cat,a){let v=cat;for(let i=0;i<5;i++)v=v*13+(a[i]||0);return v}
function evalHand(cs){
  const rc=new Int8Array(13),sm=[0,0,0,0],sn=[0,0,0,0];let rm=0;
  for(const c of cs){const r=c>>2,s=c&3;rc[r]++;sm[s]|=1<<r;sn[s]++;rm|=1<<r}
  let fm=0;for(let s=0;s<4;s++)if(sn[s]>=5){fm=sm[s];const h=sHigh(fm);if(h>=0)return sc(8,[h])}
  let q=-1;const t=[],p=[];
  for(let r=12;r>=0;r--){if(rc[r]===4)q=r;else if(rc[r]===3)t.push(r);else if(rc[r]===2)p.push(r)}
  const top=(ex,n)=>{const o=[];for(let r=12;r>=0&&o.length<n;r--)if(rc[r]&&!ex.includes(r))o.push(r);return o};
  if(q>=0)return sc(7,[q,...top([q],1)]);
  if(t.length&&(t.length>1||p.length))return sc(6,[t[0],Math.max(t[1]??-1,p[0]??-1)]);
  if(fm){const o=[];for(let r=12;r>=0&&o.length<5;r--)if(fm>>r&1)o.push(r);return sc(5,o)}
  const sh=sHigh(rm);if(sh>=0)return sc(4,[sh]);
  if(t.length)return sc(3,[t[0],...top([t[0]],2)]);
  if(p.length>=2)return sc(2,[p[0],p[1],...top([p[0],p[1]],1)]);
  if(p.length)return sc(1,[p[0],...top([p[0]],3)]);
  return sc(0,top([],5));
}
const catName=v=>CAT[Math.floor(v/B5)];
function deckWithout(dead){const s=new Set(dead),d=[];for(let c=0;c<52;c++)if(!s.has(c))d.push(c);return d}
function shuffled(){const d=[...Array(52).keys()];for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}

/* Equity vs a known hand (or a random hand when vil is null).
   Exact when villain is known and at most 2 board cards remain; Monte Carlo otherwise. */
function equity(hero,vil,board,mc=30000){
  const deck=deckWithout([...hero,...(vil||[]),...board]),need=5-board.length;
  let w=0,t=0,n=0;
  const play=(b,v)=>{const a=evalHand(hero.concat(b)),z=evalHand(v.concat(b));n++;if(a>z)w++;else if(a===z)t++};
  let exact=false;
  if(vil&&need<=2){exact=true;
    if(need===0)play(board,vil);
    else if(need===1)for(const c of deck)play(board.concat(c),vil);
    else for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)play(board.concat(deck[i],deck[j]),vil);
  }else{
    const k=need+(vil?0:2),L=deck.length;
    for(let it=0;it<mc;it++){
      for(let i=0;i<k;i++){const j=i+Math.floor(Math.random()*(L-i));const x=deck[i];deck[i]=deck[j];deck[j]=x}
      play(board.concat(deck.slice(0,need)),vil||[deck[need],deck[need+1]]);
    }
  }
  return {w:w/n,t:t/n,l:(n-w-t)/n,eq:(w+t/2)/n,exact};
}
/* Equity vs a range: villain's combo is drawn uniformly from the combos not blocked by known cards. */
function equityVsRange(hero,combos,board,mc=25000){
  const dead=new Set([...hero,...board]);
  const live=combos.filter(([a,b])=>!dead.has(a)&&!dead.has(b));
  if(!live.length)return null;
  const deck=deckWithout([...hero,...board]),L=deck.length,need=5-board.length;
  let w=0,t=0,n=0;
  for(let it=0;it<mc;it++){
    const v=live[Math.floor(Math.random()*live.length)];
    let k=0;
    while(k<need){const j=k+Math.floor(Math.random()*(L-k));const x=deck[j];deck[j]=deck[k];deck[k]=x;if(x!==v[0]&&x!==v[1])k++}
    const b=board.concat(deck.slice(0,need)),a=evalHand(hero.concat(b)),z=evalHand(v.concat(b));
    n++;if(a>z)w++;else if(a===z)t++;
  }
  return {w:w/n,t:t/n,l:(n-w-t)/n,eq:(w+t/2)/n,exact:false,live:live.length};
}
/* cards on the next street that put player a ahead of player b */
function outsFor(a,b,board){const deck=deckWithout([...a,...b,...board]);return deck.filter(c=>evalHand(a.concat(board,c))>evalHand(b.concat(board,c)))}

/* ---------- hand labels & ranges ---------- */
const gridLabel=(i,j)=>i===j?R[i]+R[j]:i>j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const combosOf=l=>l.length===2?6:l[2]==='s'?4:12;
function labelOf(c1,c2){let a=c1>>2,b=c2>>2;if(a<b)[a,b]=[b,a];return a===b?R[a]+R[b]:R[a]+R[b]+((c1&3)===(c2&3)?'s':'o')}
function labelCombos(l){const hi=R.indexOf(l[0]),lo=R.indexOf(l[1]),out=[];
  for(let s1=0;s1<4;s1++)for(let s2=0;s2<4;s2++){
    if(hi===lo){if(s2>s1)out.push([hi*4+s1,lo*4+s2])}
    else if(l[2]==='s'?s1===s2:s1!==s2)out.push([hi*4+s1,lo*4+s2])}
  return out}
/* notation: 77+ · 22-66 · A2s+ · KTo+ · A5s-A2s · AK (both). */
function parseRange(str){const out=new Set();
  for(const t of String(str).toUpperCase().replace(/([SO])\b/g,m=>m.toLowerCase()).split(/[,\s]+/).filter(Boolean)){
    const m=t.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)(\+)?(?:-([2-9TJQKA])([2-9TJQKA])[so]?)?$/);if(!m)continue;
    const a=R.indexOf(m[1]),b=R.indexOf(m[2]);
    if(a===b){let lo=a,hi=m[4]?12:a;if(m[5]){const c=R.indexOf(m[5]);lo=Math.min(a,c);hi=Math.max(a,c)}for(let r=lo;r<=hi;r++)out.add(R[r]+R[r]);continue}
    const hi=Math.max(a,b),lo=Math.min(a,b);let from=lo,to=lo;
    if(m[4])to=hi-1;if(m[6]){const c=R.indexOf(m[6]);from=Math.min(lo,c);to=Math.max(lo,c)}
    for(let k=from;k<=to;k++)for(const sf of(m[3]?[m[3]]:['s','o']))out.add(R[hi]+R[k]+sf)}
  return out}
/* turn a set of labels back into compact notation */
function rangeToText(set){const parts=[];
  let r=12;while(r>=0){if(set.has(R[r]+R[r])){let e=r;while(e-1>=0&&set.has(R[e-1]+R[e-1]))e--;
      parts.push(r===12&&e<12?R[e]+R[e]+'+':e===r?R[r]+R[r]:R[r]+R[r]+'-'+R[e]+R[e]);r=e-1}else r--}
  for(const sf of['s','o'])for(let hi=12;hi>=1;hi--){let k=hi-1;
    while(k>=0){if(set.has(R[hi]+R[k]+sf)){let e=k;while(e-1>=0&&set.has(R[hi]+R[e-1]+sf))e--;
        parts.push(k===hi-1&&e<k?R[hi]+R[e]+sf+'+':e===k?R[hi]+R[k]+sf:R[hi]+R[k]+sf+'-'+R[hi]+R[e]+sf);k=e-1}else k--}}
  return parts.join(',')}
const rangePct=set=>[...set].reduce((q,l)=>q+combosOf(l),0)/1326;

/* ---------- preflop matchup types ---------- */
const MU=[
 {id:'pp-hi',name:'Higher pair vs lower pair',ex:'KK vs 77',rule:81,
  why:'The lower pair is drawing almost entirely to a set: two outs on each card, so roughly 1 time in 5.'},
 {id:'pp-unders',name:'Pair vs two lower cards',ex:'JJ vs 98',rule:85,
  why:'The pair is already ahead and the two lower cards each need to pair, and even then they are often still behind.'},
 {id:'pp-mixed',name:'Pair vs one higher, one lower card',ex:'88 vs A7',rule:70,
  why:'Only the higher card is a real out (3 cards), so the pair holds about 7 times in 10.'},
 {id:'pp-overs',name:'Pair vs two higher cards',ex:'QQ vs AK',rule:53,
  why:'The "coin flip". Six outs over five cards gives the overcards close to half, but the pair stays a slight favorite (QQ vs AKo is about 57%, vs AKs about 54%).'},
 {id:'overs',name:'Two higher cards vs two lower cards',ex:'AK vs 76',rule:65,
  why:'The lower hand has more straight potential, so it does better than you might expect; the higher cards win a bit under two thirds.'},
 {id:'stagger',name:'Each card higher, but overlapping',ex:'AQ vs KJ',rule:63,
  why:'Plays like higher cards vs lower cards: both of the favorite\'s cards outrank the matching card in the other hand.'},
 {id:'inter',name:'High-low vs two middle cards',ex:'AT vs KJ',rule:57,
  why:'The highest card is the edge, but the two middle cards beat the low card, so it stays close.'},
 {id:'dom',name:'Dominated (one shared card)',ex:'AK vs AQ',rule:70,
  why:'The shared card cancels out, so the worse kicker has only three cards to pair. AK vs AQ is about 74%. With two small, close kickers (K3 vs K2) it drops toward 55% because many boards split the pot.'},
];
const MUBY=Object.fromEntries(MU.map(m=>[m.id,m]));
/* Classify two hands. Returns {id, fav} where fav is 0 or 1 (which hand is the favorite) or null. */
function classify(h1,h2){
  const r=h=>{const a=h[0]>>2,b=h[1]>>2;return a>=b?[a,b]:[b,a]};
  const [a1,a2]=r(h1),[b1,b2]=r(h2),p1=a1===a2,p2=b1===b2;
  if(p1&&p2)return a1===b1?null:{id:'pp-hi',fav:a1>b1?0:1};
  if(p1||p2){const [p,x,y,fav]=p1?[a1,b1,b2,0]:[b1,a1,a2,1];
    if(x===p||y===p)return null;
    if(y>p)return{id:'pp-overs',fav};if(x<p)return{id:'pp-unders',fav};return{id:'pp-mixed',fav}}
  if(a1===b1&&a2===b2)return null;
  if(a1===b1||a2===b2||a1===b2||a2===b1){
    if(a1===b1)return{id:'dom',fav:a2>b2?0:1};
    if(a2===b2)return{id:'dom',fav:a1>b1?0:1};
    return null}
  if(a2>b1)return{id:'overs',fav:0};if(b2>a1)return{id:'overs',fav:1};
  if(a1>b1&&a2>b2)return{id:'stagger',fav:0};if(b1>a1&&b2>a2)return{id:'stagger',fav:1};
  if(a1>b1&&a2<b2)return{id:'inter',fav:0};return{id:'inter',fav:1};
}
/* deal two hands matching a matchup type; returns [hand0, hand1, info] */
function dealMatchup(id){
  for(let i=0;i<50000;i++){const d=shuffled(),h=[d.slice(0,2),d.slice(2,4)],c=classify(h[0],h[1]);if(c&&(!id||c.id===id))return[h[0],h[1],c]}
  return null}
