/* "Cleanliness and facilities inside the temple": a checklist where each item can be rated 1-5 stars, commented on
   and upvoted (upvote only). No sign-in needed. Data goes through window.Api. Nothing is pre-filled. Loaded after fields.js. */
(()=>{
let list=null,listError=null;
const listP=fetch('data/facilities-checklist.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(j=>{list=j},e=>{listError=e.message});
const VISITOR='td-visitor';
const visitor=()=>{try{return JSON.parse(localStorage.getItem(VISITOR)||'{}')}catch{return {}}};
const saveVisitor=o=>{try{localStorage.setItem(VISITOR,JSON.stringify(o))}catch{/* private mode */}};
const fmt=s=>{try{return new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}catch{return ''}};
let current={templeId:null,data:{}};

const stars=(avg)=>avg==null?'':`<span class="fc-avgstars" aria-hidden="true" style="--fill:${(avg/5*100).toFixed(0)}%">★★★★★</span>`;
function commentHTML(c,id){
  const own=c.mine&&Api.mode==='server';
  return `<li class="fc-comment${c.hidden?' fc-hidden':''}" data-comment="${esc(c.id)}"><p>${esc(c.text)}</p><div class="fc-meta"><span>${esc(c.name||'Visitor')} · ${esc(fmt(c.at))}${c.hidden?' · hidden by an admin':''}</span>
    <button type="button" class="fc-up" data-up="${esc(c.id)}" aria-pressed="${c.upvoted}" ${own||c.hidden?'disabled':''} title="${own?'You cannot upvote your own comment':'Upvote this comment'}"><span aria-hidden="true">▲</span> Upvote <span class="fc-upn">${c.upvotes}</span></button>
    ${Api.isAdmin?`<button type="button" class="textbtn" data-hide="${esc(c.id)}" data-hidden="${c.hidden?'0':'1'}">${c.hidden?'Restore':'Hide'}</button>`:''}</div></li>`;
}
function itemHTML(it,d,tid){
  d=d||{avg:null,count:0,mine:null,comments:[]};
  const n=d.comments.length;
  return `<div class="fc-head"><h4>${esc(it.label)}</h4><span class="fc-avg">${d.count?`${stars(d.avg)}<strong>${d.avg.toFixed(1)}</strong> <span class="muted">· ${d.count} ${d.count===1?'rating':'ratings'}</span>`:'<span class="muted">Not rated yet</span>'}</span></div>
  <p class="help fc-hint">${esc(it.hint)}</p>
  <fieldset class="fc-rate"><legend class="sr-only">Rate ${esc(it.label)} from 1 to 5 stars${d.mine?'. Your rating: '+d.mine:''}</legend><div class="fc-stars">${[5,4,3,2,1].map(v=>`<input type="radio" name="r-${esc(it.key)}" id="r-${esc(it.key)}-${v}" value="${v}" ${d.mine===v?'checked':''}><label for="r-${esc(it.key)}-${v}" title="${v} star${v>1?'s':''}"><span aria-hidden="true">★</span><span class="sr-only">${v} star${v>1?'s':''}</span></label>`).join('')}</div><span class="help fc-mine">${d.mine?`Your rating: ${d.mine} of 5`:'Tap a star to rate'}</span></fieldset>
  <details class="fc-comments" data-key="${esc(it.key)}"><summary>Comments (${n})</summary>
    ${n?`<ul class="fc-list">${d.comments.map(c=>commentHTML(c,tid)).join('')}</ul>`:'<p class="muted fc-none">No comments yet. Say what you saw: condition, timing, anything useful to the next visitor.</p>'}
    <form class="fc-form" data-key="${esc(it.key)}"><label class="sr-only" for="c-${esc(it.key)}">Your comment on ${esc(it.label)}</label><textarea id="c-${esc(it.key)}" name="text" rows="2" minlength="5" maxlength="500" required placeholder="Add a comment (5 to 500 characters)"></textarea><input class="fc-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn small" type="submit">Post comment</button></form>
  </details>`;
}
function sectionHTML(t,data){
  const items=list.groups.flatMap(g=>g.items),rated=items.filter(i=>data[i.key]?.count).length,v=visitor();
  const all=Object.values(data).reduce((a,d)=>({s:a.s+(d.avg||0)*d.count,n:a.n+d.count}),{s:0,n:0});
  return `<section id="facilities"><div class="section-top"><h2>Cleanliness and facilities inside the temple</h2><span class="muted">${rated} of ${items.length} rated${all.n?` · overall ${(all.s/all.n).toFixed(1)} of 5`:''}</span></div>
  <p class="muted fc-lede">Rate what is there and how well it is kept, comment, and upvote useful comments. <strong>No sign-in needed.</strong> ${Api.mode==='server'?'Ratings are shared with every visitor.':'Demo mode: ratings stay in this browser.'} Nothing here is pre-filled.</p>
  <details class="fc-you"><summary>Your name and email (optional)</summary><div class="fc-youbox"><label>Name shown with your comments<input id="fc-name" maxlength="40" value="${esc(v.name||'')}" autocomplete="name"></label><label>Email (never shown publicly)<input id="fc-email" type="email" value="${esc(v.email||'')}" autocomplete="email"></label><label class="fc-consent"><input id="fc-consent" type="checkbox" ${v.consent?'checked':''}> You may contact me about the temples I rate</label></div></details>
  ${list.groups.map((g,i)=>`<div class="fc-group"><h3>${esc(g.label)}</h3>${g.items.map(it=>`<article class="fc-item" data-item="${esc(it.key)}">${itemHTML(it,data[it.key],t.id)}</article>`).join('')}</div>`).join('')}</section>`;
}
const opts=()=>{const n=document.querySelector('#fc-name')?.value.trim(),e=document.querySelector('#fc-email')?.value.trim(),c=!!document.querySelector('#fc-consent')?.checked;saveVisitor({name:n,email:e,consent:c});return {name:n,email:e,consent:c}};
const item=k=>list.groups.flatMap(g=>g.items).find(i=>i.key===k);
function redraw(k){
  const el=document.querySelector(`.fc-item[data-item="${k}"]`);if(!el)return;
  const open=el.querySelector('.fc-comments')?.open;
  el.innerHTML=itemHTML(item(k),current.data[k],current.templeId);
  if(open)el.querySelector('.fc-comments').open=true;
  const head=document.querySelector('#facilities .section-top .muted');
  if(head){const items=list.groups.flatMap(g=>g.items),rated=items.filter(i=>current.data[i.key]?.count).length,all=Object.values(current.data).reduce((a,d)=>({s:a.s+(d.avg||0)*d.count,n:a.n+d.count}),{s:0,n:0});head.textContent=`${rated} of ${items.length} rated${all.n?` · overall ${(all.s/all.n).toFixed(1)} of 5`:''}`}
}
function wire(sec){
  sec.addEventListener('change',async e=>{
    const r=e.target.closest('.fc-stars input');if(!r)return;
    const k=r.closest('.fc-item').dataset.item;
    try{const res=await Api.rate(current.templeId,k,Number(r.value),opts());const d=current.data[k]||={avg:null,count:0,mine:null,comments:[]};d.avg=res.avg;d.count=res.count;d.mine=res.mine;redraw(k);document.querySelector(`.fc-item[data-item="${k}"] input:checked`)?.focus();toast('Thanks for rating.')}
    catch(err){toast(err.message);redraw(k)}
  });
  sec.addEventListener('submit',async e=>{
    const f=e.target.closest('.fc-form');if(!f)return;e.preventDefault();
    const k=f.dataset.key,fd=new FormData(f);
    try{const res=await Api.comment(current.templeId,k,String(fd.get('text')),{...opts(),website:String(fd.get('website')||'')});
      if(res.comment){const d=current.data[k]||={avg:null,count:0,mine:null,comments:[]};d.comments.unshift(res.comment);redraw(k);document.querySelector(`.fc-item[data-item="${k}"] .fc-comments`).open=true;toast('Comment posted.')}}
    catch(err){toast(err.message)}
  });
  sec.addEventListener('click',async e=>{
    const up=e.target.closest('[data-up]'),hide=e.target.closest('[data-hide]');
    if(up&&!up.disabled){
      const k=up.closest('.fc-item').dataset.item;
      try{const res=await Api.upvote(up.dataset.up);const c=current.data[k].comments.find(x=>x.id===up.dataset.up);if(c){c.upvoted=res.upvoted;c.upvotes=res.upvotes}redraw(k)}catch(err){toast(err.message)}
    }
    if(hide){
      const k=hide.closest('.fc-item').dataset.item;
      try{await Api.hideComment(hide.dataset.hide,hide.dataset.hidden==='1');const c=current.data[k].comments.find(x=>x.id===hide.dataset.hide);if(c)c.hidden=hide.dataset.hidden==='1';redraw(k);toast(hide.dataset.hidden==='1'?'Comment hidden. It is in the change log.':'Comment restored.')}catch(err){toast(err.message)}
    }
  });
}

const baseDetail=detail;
detail=async function(id){
  await baseDetail(id);
  const t=temples().find(x=>x.id===decodeURIComponent(id));if(!t)return;
  await listP;await Api.ready;
  if(location.hash.indexOf('temple/')<0||document.querySelector('#facilities'))return;
  const anchor=document.querySelector('#profile-fields')||document.querySelector('#nuances')||document.querySelector('#references');if(!anchor)return;
  if(!list){anchor.insertAdjacentHTML('beforebegin',`<section id="facilities"><h2>Cleanliness and facilities inside the temple</h2><p class="notice">The checklist could not be loaded (${esc(listError||'unknown error')}).</p></section>`);return}
  let data={};try{data=(await Api.community(t.id)).items||{}}catch(err){data={}}
  if(document.querySelector('#facilities'))return;
  current={templeId:t.id,data};
  anchor.insertAdjacentHTML('beforebegin',sectionHTML(t,data));
  wire(document.querySelector('#facilities'));
  document.querySelector('.section-nav')?.insertAdjacentHTML('beforeend',`<a href="#temple/${esc(t.id)}" onclick="event.preventDefault();document.querySelector('#facilities').scrollIntoView()">Facilities</a>`);
};
})();
