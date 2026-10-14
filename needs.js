/* Temple needs board, volunteer-reported needs per temple, and nuances/customs. Data goes through window.Api. */
(()=>{

let CATEGORIES=[],AREAS=[],HINTS={},LEGACY={};
const catsP=fetch('data/need-categories.json').then(r=>r.json()).then(j=>{CATEGORIES=j.categories.map(c=>[c.key,c.label]);AREAS=j.areas;LEGACY=j.legacy||{};j.categories.forEach(c=>HINTS[c.key]=c.hint)},()=>{});
const SEVERITY=[['Low','Low · cosmetic or occasional'],['Medium','Medium · regular nuisance or wear'],['High','High · health, safety risk or damage in progress']];
const NOTE_TYPES=['Dress code','Timings and queues','Offerings and prasadam','Festival days','Photography and phones','Footwear and belongings','Etiquette and customs','Accessibility','Best time to visit','Other'];
const STATUS_ORDER=['Open','In progress','Resolved'];
const catName=k=>{k=LEGACY[k]||k;return (CATEGORIES.find(c=>c[0]===k)||[k,k])[1]};

/* General traditions per deity. Practices vary by region, lineage and temple, so every line is framed as general. */
const DEITY_NOTES=[
 ['Shiva',/shiva|siva|mahadev|eshwar|ishwar|nataraj/i,'Mondays are widely observed. Pradosham (the twilight of the 13th lunar day, twice a month) and Maha Shivaratri are major observances. Common offerings are water or milk abhisheka and bilva (bael) leaves.'],
 ['Vishnu',/vishnu|perumal|narayan|venkatesh|balaji|ranganath|vittal|vithoba/i,'Ekadashi (the 11th lunar day) is a common fasting day, and Vaikunta Ekadashi is a major festival. Tulsi leaves are a common offering. Saturdays are especially observed at Venkateswara and Perumal temples.'],
 ['Venkateswara',/venkatesw|tirumala|tirupati/i,'Saturdays are especially observed. Many Venkateswara temples hold an annual Brahmotsavam. Some devotees make a hair-offering vow at certain temples.'],
 ['Ganesha',/ganesh|ganapati|vinayak|pillaiyar/i,'Chaturthi days are observed (Sankashti Chaturthi monthly, Ganesh Chaturthi yearly). Durva grass and modak are common offerings, and Tuesdays are often kept.'],
 ['Hanuman',/hanuman|anjaneya/i,'Tuesdays and Saturdays are widely observed, and Hanuman Jayanti is the main festival. Sindoor, betel-leaf garlands and Hanuman Chalisa recitation are common.'],
 ['Krishna',/krishna|gopal|govind|iskcon|radha/i,'Janmashtami is the main festival and Ekadashi is commonly observed. Tulsi, butter and milk sweets are common offerings.'],
 ['Rama',/\brama?\b|raghunath|sita/i,'Rama Navami is the main festival. Many Rama temples also honour Sita, Lakshmana and Hanuman.'],
 ['Murugan',/murugan|subrahman|subramany|karthikeya|skanda|kumaraswamy/i,'Tuesdays and Krittika star days are observed, with Thaipusam and Skanda Shashti as major festivals, especially in Tamil Nadu. Milk pots and kavadi are offered as vows at some temples.'],
 ['Durga',/durga/i,'Navaratri (nine nights) is the main observance and Durga Puja is central in Bengal. Tuesdays and Fridays are often kept. Red flowers and cloth are common offerings.'],
 ['Kali',/kali\b|kalika/i,'New-moon (Amavasya) nights are significant, and Kali Puja is observed on the new moon around Diwali, especially in Bengal. Tuesdays and Fridays are commonly kept.'],
 ['Lakshmi',/lakshmi|laxmi/i,'Fridays are commonly observed, with Diwali and Varalakshmi Vratam (the Friday before the Shravana full moon, in the south) as major occasions.'],
 ['Saraswati',/saraswati|sarasvati/i,'Vasant Panchami and the final days of Navaratri (Saraswati Puja) are the main occasions. Books and pens are often offered.'],
 ['Ayyappa',/ayyappa|sabarimala/i,'The Mandala–Makaravilakku pilgrimage season runs from about mid-November to mid-January and is traditionally preceded by a 41-day vow. Rules for entry and dress differ between Ayyappa shrines, so confirm locally.'],
 ['Narasimha',/narasimh/i,'Swati star days and Narasimha Jayanti are the main observances.'],
 ['Shani',/shani|sani\b/i,'Saturdays are the main day. Sesame oil lamps and black sesame are common offerings.'],
 ['Surya',/surya|sun /i,'Sundays are observed, with Ratha Saptami as the main festival. Chhath is central in Bihar and eastern Uttar Pradesh.'],
 ['Sai Baba',/sai baba|shirdi/i,'Thursdays are commonly observed, with Guru Purnima and Rama Navami as major occasions.'],
 ['Amman (Tamil goddess)',/amman|mariamman/i,'Fridays and Tuesdays are commonly observed. Festivals during the Tamil month of Aadi (about mid-July to mid-August) are widespread, with neem leaves and porridge (koozh) common offerings.'],
 ['Devi',/\bdevi\b|bhagavath|bhagwati|\bmata\b/i,'Navaratri is the main observance and Fridays are commonly kept. Red flowers and cloth are common offerings.']
];
const deityNotes=t=>{const d=String(t.deity||'');return DEITY_NOTES.filter(n=>n[1].test(d)).slice(0,2)};

/* ---------- helpers ---------- */
const fmtDate=s=>{try{return new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}catch{return s}};
const sel=(name,list,cur='',label)=>`<label>${label}<select name="${name}" required><option value="">Choose…</option>${list.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`;
const chip=s=>`<span class="nd-chip nd-${esc(String(s).toLowerCase().replace(/\s+/g,'-'))}">${esc(s)}</span>`;
const evidenceLink=r=>r.evidence&&validURL(r.evidence)?`<a href="${esc(safeUrl(r.evidence))}" target="_blank" rel="noopener noreferrer">Evidence ↗</a>`:'<span class="muted">None</span>';
const statusSelect=r=>Api.user?`<label class="sr-only" for="st-${esc(r.id)}">Status</label><select id="st-${esc(r.id)}" class="nd-status" data-status="${esc(r.id)}">${STATUS_ORDER.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>`:chip(r.status);
const hasTemple=id=>location.hash.startsWith('#temple/'+encodeURIComponent(id))||location.hash.startsWith('#temple/'+id);

/* ---------- temple page panels ---------- */
function recordedFacts(t){
  const g=t.tags||{},rows=[['Opening hours',g.opening_hours],['Entry fee',g.fee==='no'?'No fee recorded':g.fee==='yes'?'A fee is recorded':g.fee],['Wheelchair access',g.wheelchair],['Drinking water nearby',g.drinking_water],['Toilets recorded',g.toilets],['Heritage listing',g.heritage],['Phone',g.phone||g['contact:phone']]].filter(r=>r[1]);
  return rows.length?`<dl class="facts nd-facts">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="help">From OpenStreetMap tags. Confirm with the temple before you travel; these fields are volunteer-entered.</p>`:'<p class="muted">No visiting details are recorded in the map data for this temple.</p>';
}
function noteForm(t){
  return Api.user?`<details class="nd-form"><summary>Add a note about this temple</summary><form data-temple="${esc(t.id)}" onsubmit="ndSubmitNote(event)">${sel('type',NOTE_TYPES,'','Topic')}<label>What should a visitor know?<textarea name="text" rows="3" minlength="15" maxlength="600" required></textarea></label><label>How do you know?<input name="basis" maxlength="200" required placeholder="e.g. Visited 4 Oct 2026, or temple notice board, or a link"></label><button class="btn small" type="submit">${Api.approvalRequired&&!Api.isAdmin?'Submit for approval':'Publish note'}</button><p class="help">${Api.approvalRequired&&!Api.isAdmin?'An admin reviews it before it appears.':'Goes live at once as a volunteer note and is logged so it can be reverted.'}</p></form></details>`:window.signInNotice();
}
function nuancesPanel(t,notes){
  const dn=deityNotes(t);
  return `<section id="nuances"><div class="section-top"><h2>Nuances, customs and things to do</h2></div>
  <div class="panel nd-panel"><h3>Recorded visiting details</h3>${recordedFacts(t)}</div>
  ${dn.map(([name,,text])=>`<div class="panel nd-panel"><span class="badge">General tradition · ${esc(name)}</span><p>${esc(text)}</p><p class="help">Practices differ by region, lineage and temple. Treat this as general background, not this temple's rules; confirm locally.</p></div>`).join('')||`<div class="panel nd-panel"><h3>Deity customs</h3><p class="muted">The deity of this temple is not recorded, so no general customs are shown. Correct the record if you know it.</p></div>`}
  <div class="panel nd-panel"><h3>Notes from volunteers</h3>${notes.length?notes.map(n=>`<div class="nd-note"><div class="nd-row"><strong>${esc(n.type)}</strong>${n.approval==='pending'?chip('Pending approval'):''}${window.volunteerBadge(n.by,n.at)}</div><p>${esc(n.text)}</p><p class="help">Basis: ${esc(n.basis)}</p></div>`).join(''):'<p class="muted">No notes yet. Dress code, queue times, offering rules and festival-day crowds are the most useful things to add.</p>'}${noteForm(t)}</div>
  <div class="panel nd-panel"><h3>Things you can do</h3><ul class="nd-todo"><li>Rate the <a href="#temple/${encodeURIComponent(t.id)}" onclick="event.preventDefault();document.querySelector('#facilities')?.scrollIntoView()">facilities inside this temple</a>, add a comment or upvote a useful one (no sign-in needed)</li><li><a href="#temple/${encodeURIComponent(t.id)}?report" onclick="ndOpenReport(event)">Report a need around this temple</a> (litter, polluted tank, no toilets…)</li><li><a href="#temple/${encodeURIComponent(t.id)}" onclick="event.preventDefault();document.querySelector('#profile-fields')?.scrollIntoView()">Correct or add details</a> with a source and date</li><li>Confirm timings and rules with the temple directly before sharing them</li></ul></div></section>`;
}
function needsPanel(t,reports){
  const open=reports.filter(r=>r.status!=='Resolved'),byCat={};open.forEach(r=>byCat[r.category]=(byCat[r.category]||0)+1);
  const form=Api.user?`<details class="nd-form" id="nd-report-form"><summary>Report a need</summary><form data-temple="${esc(t.id)}" onsubmit="ndSubmitReport(event)">${sel('category',CATEGORIES,'','What does the temple need?')}<p class="help nd-hint" id="nd-hint">Choose a category to see what to include.</p>${sel('area',AREAS,'','Where in the temple?')}${sel('severity',SEVERITY,'','How serious is it?')}<label>Short title<input name="title" maxlength="100" required placeholder="e.g. Algae and flower waste in the temple tank"></label><label>What did you see?<textarea name="description" rows="3" minlength="20" maxlength="800" required placeholder="Describe what you saw: where, how long it has been like this, and who looks after it (temple office, trust, municipality) if you know."></textarea></label><label>Date you saw it<input name="observedOn" type="date" max="${new Date().toISOString().slice(0,10)}" required></label><label>Photo or evidence link (optional)<input name="evidence" type="url" placeholder="https://…"></label><button class="btn small" type="submit">${Api.approvalRequired&&!Api.isAdmin?'Submit for approval':'Publish report'}</button><p class="help">${Api.approvalRequired&&!Api.isAdmin?'An admin reviews it before it appears.':'Goes live at once as a volunteer report and is logged so it can be reverted.'} It is not sent to temple authorities.</p></form></details>`:`<div id="nd-report-form">${window.signInNotice()}</div>`;
  return `<section id="needs"><div class="section-top"><h2>Needs and community action</h2><a class="textbtn" href="#needs" onclick="event.preventDefault();go('needs')">Open the needs board ↗</a></div>
  <div class="panel nd-panel">${reports.length?`<p><strong>${open.length}</strong> open ${open.length===1?'report':'reports'} · ${reports.length-open.length} resolved${Object.keys(byCat).length?' · '+Object.entries(byCat).map(([k,n])=>esc(catName(k).split(' (')[0])+' '+n).join(', '):''}</p>${reports.map(r=>`<article class="nd-report"><div class="nd-row"><strong>${esc(r.title)}</strong>${r.approval==='pending'?chip('Pending approval'):statusSelect(r)}${chip(r.severity+' severity')}${window.volunteerBadge(r.by,r.at)}</div><p class="help">${esc(catName(r.category))} · ${esc(r.area)} · seen ${esc(fmtDate(r.observedOn))}</p><p>${esc(r.description)}</p><p class="help">${evidenceLink(r)}</p></article>`).join('')}`:'<p class="muted">Nothing has been reported for this temple. If the area around it needs cleaning, repair or better facilities, report it with a date and, if you can, a photo link.</p>'}${form}</div></section>`;
}
window.ndOpenReport=e=>{e.preventDefault();const d=document.querySelector('#nd-report-form');if(!window.requireVolunteer())return;if(d){d.open=true;d.scrollIntoView({block:'center'});d.querySelector('select')?.focus()}};

window.ndSubmitReport=async e=>{
  e.preventDefault();const f=new FormData(e.target),v=Object.fromEntries(f.entries()),id=e.target.dataset.temple;
  try{const res=await Api.addNeed({templeId:id,category:v.category,area:v.area,severity:v.severity,title:v.title,description:v.description,observedOn:v.observedOn,evidence:v.evidence});toast(res.pending?'Submitted. An admin will review it before it appears.':'Report published. It is logged and can be reverted.');await detail(id);document.querySelector('#needs')?.scrollIntoView()}
  catch(err){toast(err.message);if(err.status===401)window.requireVolunteer()}
};
window.ndSubmitNote=async e=>{
  e.preventDefault();const f=new FormData(e.target),v=Object.fromEntries(f.entries()),id=e.target.dataset.temple;
  try{const res=await Api.addNote({templeId:id,type:v.type,text:v.text,basis:v.basis});toast(res.pending?'Submitted. An admin will review it before it appears.':'Note published.');await detail(id);document.querySelector('#nuances')?.scrollIntoView()}
  catch(err){toast(err.message);if(err.status===401)window.requireVolunteer()}
};

const baseDetail=detail;
detail=async function(id){
  baseDetail(id);
  const t=temples().find(x=>x.id===decodeURIComponent(id));if(!t)return;
  await catsP;
  let notes=[],reports=[];
  try{[notes,reports]=await Promise.all([Api.notes(t.id),Api.needs({templeId:t.id})]);reports.forEach(r=>r.category=LEGACY[r.category]||r.category)}catch{/* show the page without community data */}
  if(!hasTemple(t.id)||document.querySelector('#nuances'))return;
  const refs=document.querySelector('#references');if(!refs)return;
  refs.insertAdjacentHTML('beforebegin',nuancesPanel(t,notes)+needsPanel(t,reports));
  document.querySelector('.section-nav')?.insertAdjacentHTML('beforeend',`<a href="#temple/${esc(t.id)}" onclick="event.preventDefault();document.querySelector('#nuances').scrollIntoView()">Nuances</a><a href="#temple/${esc(t.id)}" onclick="event.preventDefault();document.querySelector('#needs').scrollIntoView()">Needs</a>`);
  document.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{try{await Api.setNeedStatus(s.dataset.status,s.value);toast('Status updated.')}catch(err){toast(err.message)}});
  document.querySelector('#nd-report-form select[name=category]')?.addEventListener('change',e=>{const h=document.querySelector('#nd-hint');if(h)h.textContent=HINTS[e.target.value]||'Choose a category to see what to include.'});
  if(location.hash.includes('?report'))setTimeout(()=>window.ndOpenReport({preventDefault(){}}),50);
};

/* ---------- needs board ---------- */
let f={q:'',state:'',category:'',status:'',severity:''},finder='',boardRows=[];
function filtered(){return boardRows.filter(r=>(!f.state||r.state===f.state)&&(!f.category||r.category===f.category)&&(!f.status?true:r.status===f.status)&&(!f.severity||r.severity===f.severity)&&(!f.q||[r.templeName,r.title,r.description,r.district,r.area].join(' ').toLowerCase().includes(f.q.toLowerCase())))}
function finderResults(){
  if(finder.trim().length<3)return '<p class="help">Type at least 3 letters of a temple name, district or state.</p>';
  const q=finder.toLowerCase(),hits=temples().filter(t=>[t.name,t.district,t.state,t.locality].join(' ').toLowerCase().includes(q)).slice(0,8);
  return hits.length?`<ul class="nd-finder-list">${hits.map(t=>`<li><a href="#temple/${encodeURIComponent(t.id)}?report">${esc(t.name)}</a><span class="help"> · ${esc([t.district&&t.district!=='Not recorded'?t.district:'',t.state].filter(Boolean).join(', '))}</span></li>`).join('')}</ul>`:'<p class="help">No temple matches. Try fewer letters.</p>';
}
window.ndFilter=(k,v)=>{f[k]=v;drawBoard()};
window.ndFinder=v=>{finder=v;document.querySelector('#nd-finder-out').innerHTML=finderResults()};
window.ndExport=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({exported:new Date().toISOString(),reports:boardRows},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='temple-needs-reports.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.ndReset=()=>{f={q:'',state:'',category:'',status:'',severity:''};drawBoard()};
async function needsBoard(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav==='needs'));
  app.innerHTML='<div class="wrap page nd-board"><h1>Temple needs board</h1><p class="muted" role="status">Loading reports…</p></div>';window.scrollTo(0,0);
  await catsP;
  try{boardRows=await Api.needs({});boardRows.forEach(r=>r.category=LEGACY[r.category]||r.category)}catch(err){app.innerHTML=`<div class="wrap page"><h1>Temple needs board</h1><p class="notice">${esc(err.message)}</p></div>`;return}
  if((location.hash.slice(1)||'')!=='needs')return;
  drawBoard();
}
function drawBoard(){
  const rows=filtered(),states=[...new Set(boardRows.map(r=>r.state).filter(Boolean))].sort();
  const counts={};boardRows.filter(r=>r.status!=='Resolved').forEach(r=>counts[r.category]=(counts[r.category]||0)+1);
  const o=(list,cur)=>list.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l)}</option>`}).join('');
  app.innerHTML=`<div class="wrap page nd-board"><div class="eyebrow">Community action</div><h1>Temple needs board</h1><p class="muted nd-lede">Places where a temple or its surroundings need cleaning, repair or better facilities for devotees: the tank, the prakaram, toilets, drinking water, the gopuram and more. Reported by volunteers. Each report shows who reported it and when, and every change is logged and can be reverted. ${Api.approvalRequired?'New reports appear after an admin approves them.':'New reports go live at once.'}</p>
  ${Api.mode==='server'?'':'<p class="notice">Demo mode: reports are saved in this browser only.</p>'}
  <div class="panel nd-finder"><h3>Report a need at a temple</h3><label>Find the temple<input type="search" value="${esc(finder)}" oninput="ndFinder(this.value)" placeholder="Temple name, district or state" aria-describedby="nd-finder-out"></label><div id="nd-finder-out" aria-live="polite">${finderResults()}</div>${Api.user?'':window.signInNotice()}</div>
  <div class="nd-counts" role="group" aria-label="Open reports by what the temple needs">${CATEGORIES.map(([k,l])=>`<button class="nd-count ${f.category===k?'on':''}" aria-pressed="${f.category===k}" onclick="ndFilter('category','${f.category===k?'':k}')"><strong>${counts[k]||0}</strong><span>${esc(l.split(' (')[0])}</span></button>`).join('')}</div>
  <div class="filter nd-filter"><label>Search<input type="search" value="${esc(f.q)}" onchange="ndFilter('q',this.value)" placeholder="Temple, area, keyword"></label><label>State<select onchange="ndFilter('state',this.value)"><option value="">All states</option>${o(states,f.state)}</select></label><label>Status<select onchange="ndFilter('status',this.value)"><option value="">Any status</option>${o(STATUS_ORDER,f.status)}</select></label><label>Severity<select onchange="ndFilter('severity',this.value)"><option value="">Any severity</option>${o(SEVERITY.map(s=>s[0]),f.severity)}</select></label><button class="textbtn" onclick="ndReset()">Reset filters</button><button class="textbtn" onclick="ndExport()">Download reports ↧</button></div>
  <p class="muted" role="status">${rows.length} ${rows.length===1?'report':'reports'} shown of ${boardRows.length}.</p>
  ${rows.length?`<table class="nd-table"><caption class="sr-only">Reported temple needs</caption><thead><tr><th scope="col">Temple</th><th scope="col">Location</th><th scope="col">Problem</th><th scope="col">Where</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Seen</th><th scope="col">Evidence</th><th scope="col">Reported by</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row" data-label="Temple"><a href="#temple/${encodeURIComponent(r.templeId)}">${esc(r.templeName)}</a></th><td data-label="Location">${esc([r.district,r.state].filter(Boolean).join(', '))}</td><td data-label="Problem"><strong>${esc(r.title)}</strong><br><span class="help">${esc(catName(r.category))}</span></td><td data-label="Where">${esc(r.area)}</td><td data-label="Severity">${chip(r.severity)}</td><td data-label="Status">${r.approval==='pending'?chip('Pending approval'):statusSelect(r)}</td><td data-label="Seen">${esc(fmtDate(r.observedOn))}</td><td data-label="Evidence">${evidenceLink(r)}</td><td data-label="Reported by">${window.volunteerBadge(r.by,r.at)}</td></tr>`).join('')}</tbody></table>`:`<div class="panel nd-empty"><h3>${boardRows.length?'No reports match these filters':'No needs have been reported yet'}</h3><p>${boardRows.length?'Reset the filters to see every report.':'Find a temple above, or open any temple page and use “Report a need”. Useful reports name the exact spot, say how long it has been like this, and link a photo.'}</p></div>`}</div>`;
  app.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{try{await Api.setNeedStatus(s.dataset.status,s.value);const r=boardRows.find(x=>x.id===s.dataset.status);if(r)r.status=s.value;toast('Status updated.');drawBoard()}catch(err){toast(err.message)}});
}

const baseRender=render;
render=function(){if((location.hash.slice(1)||'')==='needs'){needsBoard()}else baseRender()};
document.querySelector('nav[aria-label="Main navigation"]')?.insertAdjacentHTML('beforeend','<button data-nav="needs" onclick="go(\'needs\')">Needs board</button>');
document.addEventListener('api:session',()=>{const h=location.hash.slice(1);if(h==='needs')needsBoard();else if(h.startsWith('temple/'))detail(h.split('/')[1].split('?')[0])});
if(location.hash.slice(1)==='needs')render();
})();
