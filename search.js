/* Search by any aspect: temple name, deity (with aliases), place (with old names), facilities nearby, PIN code, tradition.
   Multi-word queries AND together ("vishnu chennai", "perumal madras", "toilets kerala"). Suggestions appear under the box.
   The index is built once per dataset and reused, never rebuilt per keystroke. Loaded after facilities.js. */
(()=>{
let syn=null;const synP=fetch('data/search-synonyms.json').then(r=>r.json()).then(j=>{syn=j},()=>{syn={deities:{},places:{},facilities:{}}});
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ऀ-෿ ]+/g,' ').replace(/\s+/g,' ').trim();
let idx=null,idxKey='';

/* aliasOf: any word -> all words that mean the same (deity groups and place aliases) */
function aliasMap(){
  const m=new Map(),add=(group,canon)=>{const w=[...new Set(group.map(norm))];w.forEach(x=>m.set(x,{words:w,canon}))};
  for(const [canon,w] of Object.entries(syn.deities))add(w,canon);
  for(const [canon,w] of Object.entries(syn.places))add([canon,...w],canon);
  return m;
}
const FAC=t=>{const c=t.computed||{},g=t.tags||{};return {
  toilets:!!(c.toilets||(g.toilets&&g.toilets!=='no')),water:!!(c.water||g.drinking_water==='yes'),parking:!!c.parking,
  hospital:!!(c.nearest_medical&&c.nearest_medical.dist_m<=1000),rail:!!(c.nearest_rail&&c.nearest_rail.dist_m<=3000),
  bus:!!(c.nearest_bus&&c.nearest_bus.dist_m<=1000),airport:!!(c.nearest_airport&&c.nearest_airport.dist_m<=30000),
  wheelchair:!!(g.wheelchair&&g.wheelchair!=='no'),photo:!!(t.images&&t.images.length)}};

function build(){
  const all=temples(),key=all.length+':'+(nationalRecords.length?nationalRecords[0].id:'');
  if(idx&&idxKey===key)return idx;
  const t0=performance.now(),A=aliasMap(),hay=new Array(all.length),fac=new Array(all.length),names=new Array(all.length);
  const places=new Map(),deityCount=new Map(),facCount={};
  all.forEach((t,i)=>{
    const dist=t.district&&t.district!=='Not recorded'?t.district:'',city=t.city&&t.city!=='Not recorded'?t.city:'';
    const deity=String(t.deity||'').replace(/\s*\(inferred from name\)\s*$/,'').replace(/not recorded|not provided/i,'');
    names[i]=norm(t.name);
    hay[i]=' '+norm([t.name,t.nativeName,...(t.aliases||[]),t.state,dist,city,t.locality,countryOf(t),deity,t.tradition,t.tags?.['addr:postcode'],t.operatorBody,t.circuits].filter(x=>x&&!/not recorded/i.test(String(x))).join(' '));
    const f=fac[i]=FAC(t);for(const k in f)if(f[k])facCount[k]=(facCount[k]||0)+1;
    for(const [kind,v] of [['State',t.state],['District',dist],['Place',city]]){if(!v||/not recorded/i.test(v))continue;const k=norm(v),e=places.get(k)||{label:v,kind,n:0};e.n++;places.set(k,e)}
  });
  // deity group counts
  for(const [canon,words] of Object.entries(syn.deities)){const ws=words.map(norm);let n=0;for(let i=0;i<hay.length;i++)if(ws.some(w=>hay[i].includes(' '+w)))n++;deityCount.set(canon,n)}
  idx={all,hay,fac,names,A,places,deityCount,facCount,ms:Math.round(performance.now()-t0)};idxKey=key;return idx;
}

/* Parse a query into required terms. Multi-word facility phrases are recognised first. */
function parse(q){
  let s=norm(q);const terms=[];
  for(const [fk,f] of Object.entries(syn.facilities))for(const w of [...f.words].sort((a,b)=>b.length-a.length)){
    const n=norm(w);if(n.includes(' ')&&(' '+s+' ').includes(' '+n+' ')){terms.push({fac:fk});s=(' '+s+' ').replace(' '+n+' ',' ').trim()}}
  for(const tok of s.split(' ').filter(Boolean)){
    const fk=Object.keys(syn.facilities).find(k=>syn.facilities[k].words.some(w=>norm(w)===tok));
    if(fk){terms.push({fac:fk});continue}
    terms.push({words:[tok]});
  }
  return terms;
}
function search(q){
  const I=build(),terms=parse(q);if(!terms.length)return null;
  const exp=terms.map(t=>t.fac?t:{words:[...new Set(t.words.flatMap(w=>I.A.get(w)?.words||[w]))]});
  const out=[];
  for(let i=0;i<I.hay.length;i++){
    let score=0,ok=true;
    for(const t of exp){
      if(t.fac){if(!I.fac[i][t.fac]){ok=false;break}score+=1;continue}
      const h=I.hay[i];let hit=false;
      for(const w of t.words)if(h.includes(' '+w)){hit=true;if(I.names[i].includes(w))score+=3;else score+=1;break}
      if(!hit){ok=false;break}
    }
    if(ok)out.push([i,score+(I.all[i].completeness?.score||0)*0.1]);
  }
  out.sort((a,b)=>b[1]-a[1]);
  return out.map(x=>I.all[x[0]]);
}
window.templeSearch=search;

/* Results: intersect the text search with the other filters (state, deity...) */
const baseFilter=filterTemples;
filterTemples=function(){
  if(!String(query||'').trim())return baseFilter();
  const hits=search(query)||[],ids=new Set(hits.map(t=>t.id)),keep=query;query='';
  let rest;try{rest=baseFilter()}finally{query=keep}
  const rank=new Map(hits.map((t,i)=>[t.id,i]));
  return rest.filter(t=>ids.has(t.id)).sort((a,b)=>rank.get(a.id)-rank.get(b.id));
};

/* ---------- suggestions ---------- */
function suggestions(q){
  const I=build(),raw=String(q||''),parts=raw.split(/\s+/),last=norm(parts[parts.length-1]||''),head=parts.slice(0,-1).join(' ');
  if(last.length<2)return [];
  const withHead=label=>(head?head+' ':'')+label,out=[];
  const starts=(k)=>k.split(' ').some(w=>w.startsWith(last));
  // deities (by any alias)
  const dg=[];for(const [canon,words] of Object.entries(syn.deities)){if([canon,...words].some(w=>norm(w).startsWith(last)))dg.push({type:'Deity',label:canon,value:withHead(canon.split(' ')[0].toLowerCase()),n:I.deityCount.get(canon)||0})}
  out.push(...dg.sort((a,b)=>b.n-a.n).slice(0,3));
  // places (current names and old names)
  const pg=[];
  for(const [k,e] of I.places)if(starts(k))pg.push({type:e.kind,label:e.label,value:withHead(e.label),n:e.n});
  for(const [canon,alts] of Object.entries(syn.places))if(alts.some(a=>norm(a).startsWith(last))){const e=I.places.get(norm(canon));if(e)pg.push({type:e.kind,label:`${e.label} (also ${alts.find(a=>norm(a).startsWith(last))})`,value:withHead(e.label),n:e.n})}
  out.push(...pg.sort((a,b)=>b.n-a.n).slice(0,4));
  // facilities
  for(const [k,f] of Object.entries(syn.facilities))if(f.words.some(w=>norm(w).startsWith(last))||norm(f.label).startsWith(last))out.push({type:'Facility',label:f.label,value:withHead(f.words[0]),n:I.facCount[k]||0});
  // temples by name
  const nm=[];if(last.length>=3)for(let i=0;i<I.names.length&&nm.length<4;i++)if(I.names[i].split(' ').some(w=>w.startsWith(last))&&!/^unnamed/.test(I.names[i]))nm.push({type:'Temple',label:I.all[i].name,sub:[I.all[i].district!=='Not recorded'?I.all[i].district:'',I.all[i].state].filter(Boolean).join(', '),id:I.all[i].id});
  out.push(...nm);
  return out.slice(0,10);
}
function attach(input){
  if(!input||input.dataset.sx)return;input.dataset.sx='1';
  const box=document.createElement('ul');box.className='sx-list';box.id='sx-list';box.setAttribute('role','listbox');box.hidden=true;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','sx-list');input.autocomplete='off';
  input.parentElement.style.position='relative';input.parentElement.appendChild(box);
  let items=[],active=-1;
  const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1};
  const paint=()=>{[...box.children].forEach((li,i)=>{li.setAttribute('aria-selected',i===active);li.classList.toggle('on',i===active)});if(active>=0)input.setAttribute('aria-activedescendant','sx-'+active);else input.removeAttribute('aria-activedescendant')};
  const open=()=>{box.innerHTML=items.map((s,i)=>`<li role="option" id="sx-${i}" data-i="${i}" aria-selected="false"><span class="sx-type">${esc(s.type)}</span><span class="sx-label">${esc(s.label)}${s.sub?`<small>${esc(s.sub)}</small>`:''}</span>${s.n!==undefined?`<span class="sx-n">${s.n.toLocaleString()}</span>`:''}</li>`).join('');box.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length))};
  const pick=s=>{close();if(s.id){go('temple/'+encodeURIComponent(s.id));return}input.value=s.value+' ';query=input.value.trim();resultPage=1;updateResults();input.focus();input.dispatchEvent(new Event('input'))};
  input.addEventListener('input',()=>{synP.then(()=>{items=suggestions(input.value);active=-1;open()})});
  input.addEventListener('keydown',e=>{
    if(box.hidden||!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();active=(active+1)%items.length;paint()}
    else if(e.key==='ArrowUp'){e.preventDefault();active=(active-1+items.length)%items.length;paint()}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();pick(items[active])}
    else if(e.key==='Escape'){close()}
  });
  box.addEventListener('mousedown',e=>{const li=e.target.closest('li');if(li){e.preventDefault();pick(items[+li.dataset.i])}});
  input.addEventListener('blur',()=>setTimeout(close,120));
}

/* a one-line summary + related chips under the search results */
const baseUpdate=updateResults;
updateResults=function(){
  baseUpdate();
  let bar=document.querySelector('#search-summary');
  if(!bar){document.querySelector('#count')?.closest('.section-top')?.insertAdjacentHTML('afterend','<div id="search-summary" class="sx-summary" role="status"></div>');bar=document.querySelector('#search-summary')}
  if(!bar)return;
  const q=String(query||'').trim();
  if(!q){bar.innerHTML='';return}
  const res=filterTemples(),by=(f)=>{const m=new Map();res.forEach(t=>{const k=f(t);if(k&&!/not recorded/i.test(k))m.set(k,(m.get(k)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1]).slice(0,5)};
  const dists=by(t=>t.district),deities=by(t=>String(t.deity||'').replace(/\s*\([^)]*\)/g,'').split(',')[0].trim());
  const chips=[...dists.map(([k,n])=>[k,n,'district']),...deities.map(([k,n])=>[k,n,'deity'])].map(([k,n])=>`<button type="button" class="sx-chip" data-add="${esc(k)}">${esc(k)} <span>${n.toLocaleString()}</span></button>`).join('');
  bar.innerHTML=`<p><strong>${res.length.toLocaleString()}</strong> ${res.length===1?'temple matches':'temples match'} “${esc(q)}” <button type="button" class="textbtn" id="sx-clear">Clear search</button></p>${chips?`<div class="sx-chips" aria-label="Narrow the search">${chips}</div>`:''}`;
  bar.querySelector('#sx-clear')?.addEventListener('click',()=>{query='';const i=document.querySelector('.searchbox input[name=q]');if(i)i.value='';resultPage=1;updateResults()});
  bar.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{query=q+' '+b.dataset.add;const i=document.querySelector('.searchbox input[name=q]');if(i)i.value=query;resultPage=1;updateResults()}));
};

const baseDiscover=discover;
discover=function(){baseDiscover();synP.then(()=>attach(document.querySelector('.searchbox input[name=q]')))};
})();
