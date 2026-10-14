/* Contribution form fixes: a light "Related temple" picker for 41,000 temples. Loaded last. */
(()=>{
const opt=(t,target)=>`<option value="${esc(t.id)}" ${target===t.id?'selected':''}>${esc(t.name)}${t.district&&t.district!=='Not recorded'?' · '+esc(t.district):''}${t.state?' · '+esc(t.state):''}</option>`;
window.contributeOptions=target=>{
  const all=temples(),sel=target&&all.find(t=>t.id===target);
  const list=[...(sel?[sel]:[]),...all.filter(t=>t.id!==target).slice(0,8)];
  return list.map(t=>opt(t,target)).join('');
};
const base=contribute;
contribute=function(){
  base();
  const select=document.querySelector('select#temple');if(!select)return;
  select.insertAdjacentHTML('beforebegin','<input type="search" id="temple-find" autocomplete="off" placeholder="Search a temple by name, district or state (3+ letters)" aria-label="Search for the related temple" style="margin-bottom:8px">');
  const keep=[...select.options].filter(o=>o.value==='new').map(o=>o.outerHTML).join('')||'<option value="new">Temple not listed yet</option>';
  document.querySelector('#temple-find').addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase();if(q.length<3)return;
    const cur=select.value,hits=temples().filter(t=>[t.name,t.district,t.state,t.locality].join(' ').toLowerCase().includes(q)).slice(0,30);
    select.innerHTML='<option value="">'+(hits.length?hits.length+' match'+(hits.length===1?'':'es')+' · choose one':'No match')+'</option>'+hits.map(t=>opt(t,cur)).join('')+keep;
  });
};
})();
