/* Real temple photography: hero slideshow of the curated temples, lazy Commons photos for cards.
   Loaded last; wraps discover(), card(), templeMedia() and updateResults() without editing them. */
(()=>{
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NEARBY_NOTE='Photograph geotagged close to this temple (up to 150 m) on Wikimedia Commons; it may show a neighbouring building. ';
const BAD_TITLE=/logo|locator|\bmap\b|flag|signboard|sign board|diagram|chart|plan of|stamp|coat of arms|banner|poster|screenshot|\.svg|\.pdf|\.tif/i;
let geo={},geoDirty=false,hero={i:0,timer:null};

/* ---------- hero: real photographs of the curated temples ---------- */
const heroPhotos=()=>seeds.map(s=>({temple:s,im:templeMedia(s).profile})).filter(x=>x.im&&validURL(x.im.url));
function heroMarkup(list){
  const slides=list.map((x,k)=>`<figure class="hero-slide${k===0?' on':''}" data-k="${k}" data-id="${esc(x.temple.id)}" aria-hidden="${k===0?'false':'true'}"><img src="${esc(x.im.url)}" alt="${esc(x.im.caption||x.temple.name)}" ${k===0?'fetchpriority="high"':'loading="lazy"'} referrerpolicy="no-referrer"><figcaption><strong>${esc(x.temple.name)}</strong><span>${esc(x.temple.state)} · Photo: ${esc(x.im.credit||'Wikimedia Commons')}, ${x.im.license_url?`<a href="${esc(safeUrl(x.im.license_url))}" target="_blank" rel="noopener noreferrer">${esc(x.im.license)}</a>`:esc(x.im.license||'')}${x.im.source?` · <a href="${esc(safeUrl(x.im.source))}" target="_blank" rel="noopener noreferrer">Source</a>`:''}</span></figcaption></figure>`).join('');
  const dots=list.map((x,k)=>`<button type="button" class="hero-dot${k===0?' on':''}" data-k="${k}" aria-label="Show ${esc(x.temple.name)}" aria-pressed="${k===0}"></button>`).join('');
  return `<div class="hero-slides">${slides}</div><div class="hero-dots" role="group" aria-label="Featured temples">${dots}</div>`;
}
function showSlide(box,k){
  const slides=box.querySelectorAll('.hero-slide'),dots=box.querySelectorAll('.hero-dot');
  hero.i=(k+slides.length)%slides.length;
  slides.forEach((s,n)=>{const on=n===hero.i;s.classList.toggle('on',on);s.setAttribute('aria-hidden',on?'false':'true')});
  dots.forEach((d,n)=>{const on=n===hero.i;d.classList.toggle('on',on);d.setAttribute('aria-pressed',on)});
}
function mountHero(){
  clearInterval(hero.timer);
  const box=document.querySelector('.hero-art'),list=heroPhotos();
  if(!box||list.length<2)return;
  box.classList.add('hero-photos');box.innerHTML=heroMarkup(list);hero.i=0;
  box.addEventListener('click',e=>{if(!e.target.closest('a,.hero-dot')){const s=e.target.closest('.hero-slide');if(s&&s.dataset.id){location.hash='#temple/'+encodeURIComponent(s.dataset.id);return}}const b=e.target.closest('.hero-dot');if(b){showSlide(box,+b.dataset.k);clearInterval(hero.timer)}});
  const first=box.querySelector('.hero-slide img');
  first?.addEventListener('error',()=>{clearInterval(hero.timer);box.classList.remove('hero-photos');box.innerHTML='<p class="hero-fallback">Temple photographs could not be loaded. Check your connection.</p>'});
  if(!REDUCED){
    const go=()=>{if(!document.body.contains(box)){clearInterval(hero.timer);return}if(!box.matches(':hover,:focus-within'))showSlide(box,hero.i+1)};
    hero.timer=setInterval(go,6500);
  }
}
const baseDiscover=discover;
discover=function(){baseDiscover();mountHero();hydrateVisible()};

/* ---------- cards: no cartoon; real photo or an honest empty state ---------- */
const NO_PHOTO='<span class="no-photo-note">No photograph yet</span>';
const baseCard=card;
card=function(t){
  let h=baseCard(t);
  if(t.district&&t.district!=='Not recorded')h=h.replace('Locality not recorded',esc(t.district)+' district');
  if(h.includes('class="card-photo"')){
    const p=templeMedia(t).profile;  // a nearby (geotagged) photo always carries its attribution, cached or fresh
    if(p?.nearby&&!h.includes('photo-credit'))h=h.replace('</div><div class="card-body">',`<a class="photo-credit" href="${esc(safeUrl(p.source||'#'))}" target="_blank" rel="noopener noreferrer" title="${esc(NEARBY_NOTE)}">Nearby photo · ${esc(p.credit||'Commons')} · ${esc(p.license||'')}</a></div><div class="card-body">`);
    return h;
  }
  return h.replace('<div class="card-art">','<div class="card-art no-photo" data-need="1">').replace(art(),NO_PHOTO);
};

/* detail pages and cards read templeMedia(); give it the nearby photo when nothing better exists */
const baseMedia=templeMedia;
templeMedia=function(t){
  const m=baseMedia(t),g=geo[t.id];
  if(!m.profile&&g)return {...m,profile:{...g,use:'profile',nearby:true,caption:NEARBY_NOTE+(g.caption||'')}};
  return m;
};

/* ---------- Commons geosearch (queued, cached) ---------- */
const queue=[];let running=0;
const pos=t=>Number.isFinite(t.lat)&&Number.isFinite(t.lon)?[t.lat,t.lon]:null;
async function findNearby(t){
  const p=pos(t);if(!p)return null;
  const q=new URLSearchParams({action:'query',list:'geosearch',gscoord:p[0]+'|'+p[1],gsradius:'50',gsnamespace:'6',gslimit:'8',format:'json',origin:'*'});
  const d=await wikiJSON('https://commons.wikimedia.org/w/api.php?'+q);
  const titles=(d.query?.geosearch||[]).map(x=>x.title).filter(x=>/\.(jpe?g|png|webp)$/i.test(x)&&!BAD_TITLE.test(x));
  if(!titles.length)return null;
  const imgs=await fetchCommonsImages(titles.slice(0,4));
  return imgs[0]||null;
}
function pump(){
  while(running<3&&queue.length){
    const id=queue.shift();running++;
    const t=temples().find(x=>x.id===id);
    (t&&!t.nearbySearched?findNearby(t):Promise.resolve(null)).then(im=>{geo[id]=im||0;geoDirty=true;apply(id)},()=>{/* leave uncached so a later visit retries */}).finally(()=>{running--;setTimeout(pump,120)});
  }
}
function apply(id){
  const g=geo[id];if(!g)return;
  document.querySelectorAll('#results .card').forEach(c=>{
    if(c.querySelector('a[href="#temple/'+encodeURIComponent(id)+'"]')===null)return;
    const art=c.querySelector('.card-art.no-photo');if(!art)return;
    art.classList.remove('no-photo');art.removeAttribute('data-need');
    art.querySelector('.no-photo-note')?.remove();
    art.insertAdjacentHTML('beforeend',`<img class="card-photo" src="${esc(g.url)}" alt="${esc((g.caption||'Temple photograph')+' (nearby photograph)')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement?.classList.add('no-photo')"><a class="photo-credit" href="${esc(safeUrl(g.source||'#'))}" target="_blank" rel="noopener noreferrer" title="${esc(NEARBY_NOTE)}">Nearby photo · ${esc(g.credit||'Commons')} · ${esc(g.license||'')}</a>`);
  });
}
function hydrateVisible(){
  document.querySelectorAll('#results .card-art[data-need]').forEach(a=>{
    const href=a.closest('.card')?.querySelector('a[href^="#temple/"]')?.getAttribute('href')||'';
    const id=decodeURIComponent(href.slice(href.indexOf('/')+1));
    if(!id)return;
    if(id in geo){if(geo[id])apply(id);return}
    if(!queue.includes(id)){queue.push(id)}
  });
  pump();
}
const baseUpdate=updateResults;
updateResults=function(){baseUpdate();hydrateVisible()};

/* persist the cache */
(async()=>{try{geo=await dbGet('geo-photos')||{};hydrateVisible()}catch{}})();
setInterval(()=>{if(geoDirty){geoDirty=false;dbPut('geo-photos',geo).catch(()=>{})}},4000);
})();
