/* Profile fields on every temple page, driven by data/field-schema.json.
   A value shows as filled when the map data holds it or a signed-in volunteer supplied it with a source and a date.
   Volunteer values go live at once (logged, revertable). Data goes through window.Api. Loaded after needs.js. */
(()=>{
let schema=null,schemaError=null;
const schemaP=fetch('data/field-schema.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(s=>{schema=s},e=>{schemaError=e.message});
const today=()=>new Date().toISOString().slice(0,10);

/* record value for a schema "map": one path or a list tried in order. Paths: tags.X (OSM), computed.X (map-derived),
   or a flattened record field (founded, architecture, heritage, tradition, circuits, operatorBody: Wikidata/OSM). */
const km=m=>m<1000?m+' m':(m/1000).toFixed(m<10000?1:0)+' km';
function fmtComputed(key,v){
  if(typeof v==='string')return v;
  if(key==='nearest_airport')return `${v.name}${v.iata?' ('+v.iata+')':''} · ${km(v.dist_m)} straight line`;
  if(v.name!==undefined)return `${v.name} · ${km(v.dist_m)} straight line`;
  if(v.count!==undefined)return `${v.count} mapped within 300 m (nearest ${km(v.nearest_m)})`;
  return JSON.stringify(v);
}
function mapped(t,map){
  for(const path of [].concat(map||[])){
    let v,src,kind='dataset';
    if(path.startsWith('tags.')){v=(t.tags||{})[path.slice(5)];src='OpenStreetMap'}
    else if(path.startsWith('computed.')){const k=path.slice(9);v=t.computed?.[k];if(v!=null)v=fmtComputed(k,v);src='OSM · computed';kind='computed'}
    else{v=t[path];src=['founded','architecture','heritage','circuits','operatorBody'].includes(path)?'Wikidata':'OpenStreetMap'}
    if(Array.isArray(v))v=v.join(', ');
    if(v==null||v===''||/not recorded|not provided/i.test(String(v)))continue;
    v=String(v);
    if(path==='deity'&&t.deityBasis==='INFERRED_from_name'){v=v.replace(/\s*\(inferred from name\)\s*$/,'');return {value:v,source:'Inferred from name',kind:'inferred'}}
    return {value:v,source:src,kind};
  }
  return null;
}

let pend={};
function resolve(t,f,vol){
  const v=vol[f.key];
  if(v)return {kind:'verified',value:v.value,chip:'Volunteer',by:v.by,at:v.at,ref:v.sourceRef,date:v.checkedOn,srcType:v.sourceType};
  const m=mapped(t,f.map);
  if(m)return {kind:m.kind,value:m.value,chip:m.source};
  return null;
}
const showVal=(f,v)=>f.type==='url'&&validURL(v)?`<a href="${esc(safeUrl(v))}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`:esc(v);

window.pfSubmit=async e=>{
  e.preventDefault();const form=e.target,f=new FormData(form),g=k=>String(f.get(k)||'').trim(),id=form.dataset.temple;
  if(!window.requireVolunteer())return;
  try{const res=await Api.saveField({templeId:id,fieldKey:form.dataset.field,value:g('value'),sourceType:g('sourceType'),sourceRef:g('sourceRef'),checkedOn:g('date')});toast(res.pending?'Submitted. An admin will review it before it appears.':'Saved. It is live now, shown as a volunteer value and logged so it can be reverted.');rerender(id,form.dataset.field)}
  catch(err){toast(err.message);if(err.status===401)window.requireVolunteer()}
};
async function rerender(id,fieldKey){
  await detail(id);
  const row=document.querySelector(`[data-pf="${fieldKey}"]`);
  if(row){row.closest('details').open=true;row.scrollIntoView({block:'center'})}
}

function row(t,f,vol){
  const r=resolve(t,f,vol);
  const srcs=f.sources.map(s=>schema.sources[s]).filter(Boolean);
  const value=r?`<span class="pf-value">${showVal(f,r.value)}</span><span class="pf-chip pf-${r.kind}">${esc(r.chip)}</span>${r.kind==='verified'?`<span class="help">${window.volunteerBadge(r.by,r.at)} · Source: ${esc(r.ref)} · checked ${esc(r.date)}</span>`:''}`
    :`<span class="pf-empty">Not filled</span>`;
  const mine=pend[f.key]?`<div class="pf-pending"><span class="pf-chip pf-pending-chip">Pending admin approval</span> ${esc(pend[f.key].value)}<span class="help"> · only you and admins can see this until it is approved</span></div>`:'';
  const input=f.type==='text'||f.type==='list'?`<textarea name="value" rows="2" maxlength="500" required></textarea>`:`<input name="value" type="${f.type==='url'?'url':'text'}" maxlength="300" required>`;
  const form=Api.user?`<details class="pf-add"><summary>${r?'Suggest a correction':'Add a value'}</summary><form data-temple="${esc(t.id)}" data-field="${esc(f.key)}" data-type="${esc(f.type)}" onsubmit="pfSubmit(event)">
  <p class="help pf-sources">Accepted sources: ${esc(srcs.join(' · '))}</p>
  <label>${esc(f.label)}${input}</label>
  <label>Source type<select name="sourceType">${f.sources.map(s=>`<option value="${esc(s)}">${esc(schema.sources[s]||s)}</option>`).join('')}</select></label>
  <label>Source reference<input name="sourceRef" maxlength="300" required placeholder="Link, or where and when you saw it"></label>
  <label>Date you checked it<input name="date" type="date" max="${today()}" required></label>
  <button class="btn small" type="submit">${Api.approvalRequired&&!Api.isAdmin?'Submit for approval':'Save value'}</button><p class="help">${Api.approvalRequired&&!Api.isAdmin?'An admin reviews it before it appears.':'Goes live at once and is logged so it can be reverted.'}</p></form></details>`:`<a class="pf-signin" href="#volunteer" onclick="try{sessionStorage.setItem('td-return',location.hash)}catch{}">Sign in to ${r?'correct':'add'} this</a>`;
  return `<div class="pf-row" data-pf="${esc(f.key)}"><dt>${esc(f.label)}</dt><dd>${value}${mine}${form}</dd></div>`;
}
function section(t,vol){
  const groups=schema.groups.map((g,i)=>{
    const filled=g.fields.filter(f=>resolve(t,f,vol)).length;
    return `<details class="pf-group" ${i<=1?'open':''}><summary><span class="pf-gname">${esc(g.label)}</span><span class="pf-count">${filled} of ${g.fields.length} filled</span></summary><dl class="pf-list">${g.fields.map(f=>row(t,f,vol)).join('')}</dl></details>`;
  }).join('');
  const total=schema.groups.reduce((n,g)=>n+g.fields.length,0),filled=schema.groups.reduce((n,g)=>n+g.fields.filter(f=>resolve(t,f,vol)).length,0);
  return `<section id="profile-fields"><div class="section-top"><h2>Profile fields</h2><span class="muted">${filled} of ${total} filled</span></div><p class="muted pf-lede">Empty fields are shown on purpose. A value appears here only when the map data holds it or a volunteer supplies it with a source and the date it was checked. ${Api.user?'':'Anyone can read; <a href="#volunteer">sign in as a volunteer</a> to add or correct values.'}</p>${groups}</section>`;
}

const baseDetail=detail;
detail=async function(id){
  await baseDetail(id);
  const t=temples().find(x=>x.id===decodeURIComponent(id));if(!t)return;
  await schemaP;
  let vol={};
  pend={};
  try{const fv=await Api.getFields(t.id);(fv.values||[]).forEach(v=>vol[v.key]=v);(fv.pending||[]).forEach(v=>pend[v.key]=v)}catch{/* show the page without volunteer values */}
  if(location.hash.indexOf('temple/')<0||document.querySelector('#profile-fields'))return;
  const anchor=document.querySelector('#nuances')||document.querySelector('#references');if(!anchor)return;
  if(!schema){anchor.insertAdjacentHTML('beforebegin',`<section id="profile-fields"><h2>Profile fields</h2><p class="notice">The field list could not be loaded (${esc(schemaError||'unknown error')}).</p></section>`);return}
  anchor.insertAdjacentHTML('beforebegin',section(t,vol));
  const upd=[...document.querySelectorAll('.detail-head .actions .btn')].find(b=>/suggest an update|correct these details/i.test(b.textContent));
  if(upd){upd.textContent='Correct these details';upd.onclick=()=>{const sec=document.querySelector('#profile-fields');sec.querySelector('.pf-group')?.setAttribute('open','');sec.scrollIntoView()}}
  document.querySelector('.section-nav')?.insertAdjacentHTML('beforeend',`<a href="#temple/${esc(t.id)}" onclick="event.preventDefault();document.querySelector('#profile-fields').scrollIntoView()">Profile fields</a>`);
};
})();
