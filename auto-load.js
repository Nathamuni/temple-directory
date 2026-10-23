/* Loads the bundled dataset (india-temples.json) automatically. No import button.
   A tiny data/dataset-info.json carries the dataset version: the 38 MB file is downloaded only when the browser's
   stored copy is missing or older. Shows progress and offers Retry on failure. Loaded after home-sections.js. */
(()=>{
const bar=document.createElement('div');bar.id='data-status';bar.className='data-status';bar.setAttribute('role','status');bar.hidden=true;
document.querySelector('#app')?.before(bar);
const show=(html,kind='')=>{bar.hidden=false;bar.className='data-status '+kind;bar.innerHTML=html};
const hide=()=>{bar.hidden=true};
const tick=()=>new Promise(r=>setTimeout(r,0));
const mb=n=>(n/1048576).toFixed(1);
let loading=false;

function repaint(){const r=location.hash.slice(1)||'discover';if(r==='discover')discover();else if(r.startsWith('temple/'))render()}

async function download(info,label){
  show(`<strong>${esc(label)}</strong> <progress max="${info.bytes||38e6}" value="0" aria-label="Download progress"></progress> <span class="ds-mb">0 MB</span>`);
  const res=await fetch('india-temples.json');
  if(!res.ok)throw Error('the server answered '+res.status);
  const reader=res.body.getReader(),chunks=[];let got=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);got+=value.length;
    const p=bar.querySelector('progress');if(p){p.value=Math.min(got,p.max);bar.querySelector('.ds-mb').textContent=`${mb(got)} of ${mb(info.bytes||38e6)} MB`}}
  show('<strong>Preparing temples…</strong>');await tick();
  const text=new TextDecoder().decode(await new Blob(chunks).arrayBuffer());await tick();
  const data=JSON.parse(text);await tick();
  const n=await ingest(data);
  try{await dbPut('data-version',info.version)}catch{dataStatus.memoryOnly=true}
  return n;
}

async function start(){
  if(loading)return;loading=true;
  let info=null;try{const r=await fetch('data/dataset-info.json',{cache:'no-store'});if(r.ok)info=await r.json()}catch{}
  let have=[],ver=null;
  try{have=(await dbGetRecords())||[];ver=await dbGet('data-version')}catch{dataStatus.memoryOnly=true}
  nationalRecords=have;
  const current=have.length>=1000&&(!info||ver===info.version);
  if(current){loading=false;repaint();return}
  if(have.length)repaint();                      // show what we already have while the update downloads
  try{
    await download(info||{bytes:38e6,version:'unknown'},have.length?'Updating temple data…':'Loading India temples…');
    show(`${nationalRecords.length.toLocaleString()} temples loaded.${dataStatus.memoryOnly?' Browser storage is unavailable, so they will reload on your next visit.':''}`,'ok');
    setTimeout(hide,3500);repaint();
  }catch(e){
    show(`Could not load the temple dataset (${esc(e.message||'network error')}). The 6 curated temples are still available. <button class="textbtn" id="data-retry">Retry</button>`,'err');
    document.querySelector('#data-retry')?.addEventListener('click',()=>{loading=false;start()});
  }finally{loading=false}
}
start();
})();
