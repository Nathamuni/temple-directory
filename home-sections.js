/* Home page for the Global Temple Directory: hero copy, browse by country / state / deity, top rated and most
   upvoted temples (real ratings only), facilities summary. Wraps discover(); loaded after search.js. */
(()=>{
let checklist=null;fetch('data/facilities-checklist.json').then(r=>r.json()).then(j=>{checklist=j},()=>{});
let cache={key:'',browse:null,nearby:null};
let summaryP=null,summaryAt=0;
const summary=()=>{if(!summaryP||Date.now()-summaryAt>20000){summaryAt=Date.now();summaryP=Api.summary().catch(()=>null)}return summaryP};
const byId=()=>{const m=new Map();temples().forEach(t=>m.set(t.id,t));return m};

function stats(){
  const all=temples(),key=all.length+':'+(nationalRecords[0]?.id||'');
  if(cache.key===key)return cache;
  const states=new Map(),deities=new Map(),countries=new Map(),nearby={toilets:0,water:0,parking:0,wheelchair:0,hospital:0};
  for(const t of all){
    states.set(t.state,(states.get(t.state)||0)+1);countries.set(countryOf(t),(countries.get(countryOf(t))||0)+1);
    const d=String(t.deity||'').replace(/\s*\([^)]*\)/g,'').trim();if(d&&!/not recorded|not provided/i.test(d)){const k=d.split(',')[0].trim();if(k)deities.set(k,(deities.get(k)||0)+1)}
    const c=t.computed||{},g=t.tags||{};if(c.toilets||(g.toilets&&g.toilets!=='no'))nearby.toilets++;if(c.water||g.drinking_water==='yes')nearby.water++;if(c.parking)nearby.parking++;if(g.wheelchair&&g.wheelchair!=='no')nearby.wheelchair++;
  }
  const top=m=>[...m].filter(([k])=>k&&!/not recorded/i.test(k)).sort((a,b)=>b[1]-a[1]);
  cache={key,countries:top(countries),states:top(states),deities:top(deities),nearby,total:nationalRecords.length||all.length};
  return cache;
}
const chips=(list,kind,limit,all)=>`<div class="hs-chips">${list.slice(0,all?list.length:limit).map(([k,n])=>`<button type="button" class="hs-chip" data-kind="${kind}" data-v="${esc(k)}">${esc(k)} <span>${n.toLocaleString()}</span></button>`).join('')}</div>${!all&&list.length>limit?`<button type="button" class="textbtn" data-more="${kind}">Show all ${list.length}</button>`:''}`;
const starsHTML=a=>`<span class="fc-avgstars" aria-hidden="true" style="--fill:${(a/5*100).toFixed(0)}%">★★★★★</span>`;

function heroCopy(){
  const hero=document.querySelector('.hero');if(!hero)return;
  const h1=hero.querySelector('h1'),eb=hero.querySelector('.eyebrow'),p=hero.querySelector('p'),strip=hero.querySelector('.strip'),s=stats();
  eb?.remove();
  if(h1)h1.textContent='Global Temple Directory';
  if(p)p.textContent='Find any temple by deity, place or what it offers. Rate its facilities and help keep the data accurate.';
  const input=hero.querySelector('.searchbox input[name=q]');if(input)input.placeholder='Search a temple, deity or place';
  if(strip){
    strip.className='hs-facts';
    strip.innerHTML=`<p class="hs-try">Try <button type="button" data-try="vishnu chennai">vishnu chennai</button> <button type="button" data-try="perumal madras">perumal madras</button> <button type="button" data-try="toilets kerala">toilets kerala</button> <button type="button" data-try="600001">600001</button></p>
      <p class="hs-count"><strong>${s.total.toLocaleString()}</strong> temples across ${s.states.length} states and union territories${s.countries.length>1?` in ${s.countries.length} countries`:''} · kept accurate by volunteers</p>`;
    strip.querySelectorAll('[data-try]').forEach(b=>b.addEventListener('click',()=>{query=b.dataset.try;const i=document.querySelector('.searchbox input[name=q]');if(i)i.value=query;resultPage=1;updateResults();document.querySelector('#directory')?.scrollIntoView({behavior:'smooth'})}));
  }
}

function sectionsHTML(){
  const s=stats(),filtered=query||countryFilter||stateFilter||deityFilter;
  if(filtered)return '';
  return `<section id="home-sections" class="wrap hs">
  <div class="hs-block"><h2>Browse</h2>
    <p class="help">Country</p>${chips(s.countries,'country',6)}
    <p class="help">State or union territory</p><div id="hs-states">${chips(s.states,'state',12)}</div>
    <p class="help">Deity <span class="muted">(many are read from the temple's name)</span></p><div id="hs-deities">${chips(s.deities,'deity',12)}</div></div>
  <div class="hs-block" id="hs-ranked"><h2>Top rated and most upvoted</h2><p class="muted" role="status">Loading ratings…</p></div>
  <div class="hs-block" id="hs-fac"><h2>Cleanliness and facilities</h2><p class="muted" role="status">Loading…</p></div></section>`;
}
async function fillRanked(){
  const el=document.querySelector('#hs-ranked'),fac=document.querySelector('#hs-fac');if(!el&&!fac)return;
  const sm=await summary(),ids=byId();
  if(el){
    const rated=sm?.topRated||[],up=sm?.mostUpvoted||[];
    const item=r=>{const t=ids.get(r.id);return t?`<li><a href="#temple/${encodeURIComponent(t.id)}">${esc(t.name)}</a><span class="help"> · ${esc([t.district&&t.district!=='Not recorded'?t.district:'',t.state].filter(Boolean).join(', '))}</span><span class="hs-score">${starsHTML(r.avg)}<strong>${r.avg.toFixed(1)}</strong> <span class="muted">· ${r.n} ratings</span></span></li>`:''};
    el.innerHTML=`<h2>Top rated and most upvoted</h2>${Api.mode==='server'?'':'<p class="notice">Demo mode: these come from ratings saved in this browser only.</p>'}
    <div class="hs-two"><div><h3>Top rated temples</h3>${rated.length?`<ol class="hs-list">${rated.map(item).join('')}</ol>`:`<p class="muted">No temple has ${sm?.minRatings||3} or more ratings yet. Open a temple and rate its facilities to start the list.</p>`}</div>
    <div><h3>Most upvoted comments</h3>${up.length?`<ul class="hs-list">${up.map(c=>`<li><q>${esc(String(c.text).slice(0,140))}</q><span class="help"> · <a href="#temple/${encodeURIComponent(c.temple_id)}">${esc(c.name)}</a> · ▲ ${c.upvotes}</span></li>`).join('')}</ul>`:'<p class="muted">No comment has been upvoted yet.</p>'}</div></div>`;
  }
  if(fac){
    const items=(checklist?.groups||[]).flatMap(g=>g.items),m=new Map((sm?.items||[]).map(i=>[i.item_key,i])),s=stats(),n=s.nearby,t=sm?.totals||{ratings:0,comments:0,temples:0};
    fac.innerHTML=`<h2>Cleanliness and facilities</h2>
    <div class="hs-two"><div><h3>Visitor ratings</h3>${t.ratings?`<p class="muted">${t.ratings.toLocaleString()} ratings and ${t.comments.toLocaleString()} comments across ${t.temples.toLocaleString()} temples.</p><ul class="hs-list">${items.filter(i=>m.get(i.key)).map(i=>`<li>${esc(i.label)}<span class="hs-score">${starsHTML(m.get(i.key).avg)}<strong>${m.get(i.key).avg.toFixed(1)}</strong> <span class="muted">· ${m.get(i.key).n}</span></span></li>`).join('')}</ul>`:'<p class="muted">No ratings yet. Open a temple and rate what you saw: dustbins, drinking water, toilets and more. No sign-in needed.</p>'}</div>
    <div><h3>Mapped near temples</h3><p class="help">From OpenStreetMap, within 300 m of the temple. Where nothing is mapped, it may simply be missing from the map.</p><ul class="hs-list"><li>Toilets <strong>${n.toilets.toLocaleString()}</strong></li><li>Drinking water <strong>${n.water.toLocaleString()}</strong></li><li>Parking <strong>${n.parking.toLocaleString()}</strong></li><li>Wheelchair access recorded <strong>${n.wheelchair.toLocaleString()}</strong></li></ul><p><a class="textbtn" href="#needs" onclick="event.preventDefault();go('needs')">Open the needs board ↗</a></p></div></div>`;
  }
}
function wire(sec){
  sec.addEventListener('click',e=>{
    const c=e.target.closest('[data-kind]'),more=e.target.closest('[data-more]');
    if(more){const s=stats(),k=more.dataset.more,list=k==='state'?s.states:s.deities;document.querySelector(k==='state'?'#hs-states':'#hs-deities').innerHTML=chips(list,k,0,true);return}
    if(!c)return;
    const k=c.dataset.kind,v=c.dataset.v;
    if(k==='country'){countryFilter=v;stateFilter=''}else if(k==='state'){stateFilter=v}else if(k==='deity'){deityFilter='';query=v}   // a search, so aliases (Perumal = Vishnu) and inferred deities both match
    resultPage=1;discover();document.querySelector('#directory')?.scrollIntoView({behavior:'smooth'});
  });
}

const baseDiscover=discover;
discover=function(){
  baseDiscover();
  heroCopy();
  const dir=document.querySelector('#directory');if(!dir)return;
  const html=sectionsHTML();
  if(html){dir.insertAdjacentHTML('beforebegin',html);const sec=document.querySelector('#home-sections');wire(sec);fillRanked()}
};
document.addEventListener('api:session',()=>{summaryAt=0});
/* Back from a temple page: land on the results (filters are kept in memory), not the top of the page. */
let fromTemple=false;
window.addEventListener('hashchange',()=>{const r=location.hash.slice(1);if(r.startsWith('temple/')){fromTemple=true;return}if(fromTemple&&r==='discover'){fromTemple=false;setTimeout(()=>document.querySelector('#directory')?.scrollIntoView(),0)}});
})();
