/* Character index: search, element chips and dropdown filters, all kept in the URL so a filtered list can be shared. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('characters');
const G=data.guardians;
const p=W.params();
const st={q:p.get('q')||'',element:p.get('element')||'',branch:p.get('branch')||'',team:p.get('team')||'',guild:p.get('guild')||'',base:p.get('base')||'',zodiac:p.get('zodiac')||'',status:p.get('status')||'',sort:p.get('sort')||'branch'};

const opts=key=>[...new Set(G.map(key).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const SELECTS=[
  ['team','All teams',opts(g=>W.groupKey(g.team))],
  ['guild','All guilds',opts(g=>W.groupKey(g.guild))],
  ['base','All locations',opts(g=>g.base)],
  ['zodiac','All zodiacs',opts(g=>g.zodiac)],
  ['status','Any status',[['active','Active'],['retired','Retired'],['deceased','Deceased']]],
  ['sort','Sort',[['branch','Sort: by branch'],['name','Sort: A–Z'],['element','Sort: by element']]]
];
const elCount=e=>G.filter(g=>g.element===e).length;
const chips=['',...W.ELEMENTS,'None'].filter(e=>e===''||elCount(e));

const main=document.getElementById('main');
main.innerHTML=`
<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><span>Guardians</span></div>
<h1 style="font-size:30px;margin-bottom:6px">Guardians</h1>
<p class="muted" style="margin:0 0 16px">Every Guardian in the archive. Filters are saved in the address bar, so you can share a filtered list.</p>
<div class="chips" role="group" aria-label="Element">${chips.map(e=>`<button type="button" class="chipbtn${e?' el-'+e:''}" data-el="${e}" aria-pressed="${st.element===e}">${e?'<span class="dot"></span>':''}${e?(e==='None'?'No branch yet':e):'All'} <span class="n">${e?elCount(e):G.length}</span></button>`).join('')}</div>
<div class="filters">
  <label class="sr" for="fq">Search</label>
  <input type="search" id="fq" placeholder="Name, team, branch, role…" value="${esc(st.q)}">
  ${SELECTS.map(([k,all,list])=>`<label class="sr" for="f-${k}">${all}</label><select id="f-${k}" data-k="${k}">${k==='sort'?'':`<option value="">${all}</option>`}${list.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${st[k]===v?' selected':''}>${esc(t)}</option>`;}).join('')}</select>`).join('')}
  <button type="button" class="btn" id="reset">Clear</button>
</div>
<div id="branchnote"></div>
<p class="count" id="count" aria-live="polite"></p>
<div class="grid" id="list"></div>`;

const order=new Map((data.raw.branches||[]).map((b,i)=>[b.toLowerCase(),i]));
function sorted(list){
  const a=list.slice();
  if(st.sort==='name') a.sort((x,y)=>x.name.localeCompare(y.name));
  else if(st.sort==='element') a.sort((x,y)=>(W.ELEMENTS.indexOf(x.element)+1||9)-(W.ELEMENTS.indexOf(y.element)+1||9)||x.name.localeCompare(y.name));
  else a.sort((x,y)=>(order.has(x.path.toLowerCase())?order.get(x.path.toLowerCase()):1e6)-(order.has(y.path.toLowerCase())?order.get(y.path.toLowerCase()):1e6)||x.name.localeCompare(y.name));
  return a;
}
function render(){
  const q=st.q.trim().toLowerCase();
  const list=G.filter(g=>{
    if(st.element&&g.element!==st.element) return false;
    if(st.branch&&!(g.path.toLowerCase()===st.branch.toLowerCase()||g.path.toLowerCase().startsWith(st.branch.toLowerCase()+'-'))) return false;
    if(st.team&&W.groupKey(g.team)!==st.team) return false;
    if(st.guild&&W.groupKey(g.guild)!==st.guild) return false;
    if(st.base&&g.base!==st.base) return false;
    if(st.zodiac&&g.zodiac!==st.zodiac) return false;
    if(st.status==='active'&&g.status) return false;
    if(st.status&&st.status!=='active'&&g.status!==st.status) return false;
    if(q){const hay=[g.name,g.team,g.guild,g.path,g.role,g.rank,g.base,g.zodiac,g.mentor].join(' ').toLowerCase();if(!q.split(/\s+/).every(w=>hay.includes(w))) return false;}
    return true;
  });
  document.getElementById('branchnote').innerHTML=st.branch?`<p class="note">Showing the <b>${esc(st.branch.split('-').join(' › '))}</b> branch and its sub-branches. <a href="#" id="clearbranch">Show all branches</a></p>`:'';
  const cb=document.getElementById('clearbranch'); if(cb) cb.onclick=e=>{e.preventDefault();st.branch='';update();};
  document.getElementById('count').textContent=`${list.length} of ${G.length} Guardians`;
  document.getElementById('list').innerHTML=list.length?sorted(list).map(W.card).join(''):'<div class="empty" style="grid-column:1/-1">No Guardian matches these filters.</div>';
}
function update(){
  const u=new URLSearchParams();
  for(const [k,v] of Object.entries(st)) if(v&&!(k==='sort'&&v==='branch')) u.set(k,v);
  history.replaceState(null,'',location.pathname+(u.toString()?'?'+u:''));
  render();
}
main.querySelectorAll('.chipbtn').forEach(b=>b.addEventListener('click',()=>{st.element=b.dataset.el;main.querySelectorAll('.chipbtn').forEach(x=>x.setAttribute('aria-pressed',x===b));update();}));
main.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{st[s.dataset.k]=s.value;update();}));
document.getElementById('fq').addEventListener('input',e=>{st.q=e.target.value;update();});
document.getElementById('reset').addEventListener('click',()=>{for(const k in st) st[k]=k==='sort'?'branch':'';main.querySelectorAll('select').forEach(s=>s.value=st[s.dataset.k]);document.getElementById('fq').value='';main.querySelectorAll('.chipbtn').forEach(x=>x.setAttribute('aria-pressed',x.dataset.el===''));update();});
render();
})();
