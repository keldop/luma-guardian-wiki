/* Character index: Guardians and civilians, with a type filter, search, element chips and dropdown filters,
   all kept in the URL so a filtered list can be shared (characters.html?type=civilian). */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('characters');
const G=data.guardians.map(g=>Object.assign(g,{kind:'guardian'}));
// Everyone with a character file but no line in branches.json: civilians, and Guardians written up only in the doc.
const seen=new Set();
const extra=[];
for(const ref of data.profiles.values()){
  if(seen.has(ref.file)) continue;
  seen.add(ref.file);
  if((ref.names||[ref.name]).some(n=>data.byName.has(String(n).toLowerCase()))) continue;
  const civ=ref.type==='civilian';
  extra.push({id:W.slug(ref.name),name:ref.name,kind:civ?'civilian':'guardian',element:civ?'None':(ref.element||'None'),
    path:'',team:ref.group||'',guild:'',base:'',zodiac:'',status:'',rank:'',mentor:'',role:ref.subtitle||'',portrait:ref.image||'',lore:{}});
}
const ALL=G.concat(extra);
const p=W.params();
const st={q:p.get('q')||'',type:p.get('type')||'',element:p.get('element')||'',branch:p.get('branch')||'',team:p.get('team')||'',guild:p.get('guild')||'',base:p.get('base')||'',zodiac:p.get('zodiac')||'',status:p.get('status')||'',sort:p.get('sort')||'branch'};

const opts=key=>[...new Set(ALL.map(key).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const SELECTS=[
  ['team','All teams and groups',opts(g=>W.groupKey(g.team))],
  ['guild','All guilds',opts(g=>W.groupKey(g.guild))],
  ['base','All locations',opts(g=>g.base)],
  ['zodiac','All zodiacs',opts(g=>g.zodiac)],
  ['status','Any status',[['active','Active'],['retired','Retired'],['deceased','Deceased']]],
  ['sort','Sort',[['branch','Sort: by branch'],['name','Sort: A–Z'],['element','Sort: by element']]]
];
const guardians=ALL.filter(g=>g.kind==='guardian');
const elCount=e=>guardians.filter(g=>g.element===e).length;
const chips=['',...W.ELEMENTS,'None'].filter(e=>e===''||elCount(e));
const TYPES=[['','Everyone',ALL.length],['guardian','Guardians',guardians.length],['civilian','Civilians',ALL.length-guardians.length]];

const main=document.getElementById('main');
main.innerHTML=`
<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><span>Characters</span></div>
<h1 style="font-size:30px;margin-bottom:6px">Characters</h1>
<p class="muted" style="margin:0 0 16px">Every Guardian and civilian in the archive. Filters are saved in the address bar, so you can share a filtered list.</p>
<div class="chips seg" role="group" aria-label="Type">${TYPES.map(([v,t,n])=>`<button type="button" class="chipbtn" data-type="${v}" aria-pressed="${st.type===v}">${t} <span class="n">${n}</span></button>`).join('')}</div>
<div class="chips" role="group" aria-label="Element" id="elchips">${chips.map(e=>`<button type="button" class="chipbtn${e?' el-'+e:''}" data-el="${e}" aria-pressed="${st.element===e}">${e?'<span class="dot"></span>':''}${e?(e==='None'?'No branch yet':e):'All elements'} <span class="n">${e?elCount(e):guardians.length}</span></button>`).join('')}</div>
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
// Guardians get the usual element-coloured card; civilians a plain one labelled with their role in the story.
function card(g){
  if(g.kind!=='civilian') return W.card(g);
  return `<a class="ccard civ" href="${W.charUrl(g)}" title="${esc(g.role||'')}">${W.avatar(g,48)}<span class="t"><b>${esc(g.name)}</b><small>${esc(g.role||'Civilian')}</small></span></a>`;
}
function render(){
  const q=st.q.trim().toLowerCase();
  // Elements only apply to Guardians, so the element chips are hidden while showing civilians.
  document.getElementById('elchips').hidden=st.type==='civilian';
  // So are guilds, locations, zodiacs and Guardian status.
  for(const k of ['guild','base','zodiac','status']) document.getElementById('f-'+k).hidden=st.type==='civilian';
  const list=ALL.filter(g=>{
    if(st.type&&g.kind!==st.type) return false;
    if(st.element&&(g.kind!=='guardian'||g.element!==st.element)) return false;
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
  const what=st.type==='guardian'?'Guardians':st.type==='civilian'?'civilians':'characters';
  const total=st.type?ALL.filter(g=>g.kind===st.type).length:ALL.length;
  document.getElementById('count').textContent=`${list.length} of ${total} ${what}`;
  document.getElementById('list').innerHTML=list.length?sorted(list).map(card).join(''):`<div class="empty" style="grid-column:1/-1">No ${what} match these filters.</div>`;
}
function update(){
  const u=new URLSearchParams();
  for(const [k,v] of Object.entries(st)) if(v&&!(k==='sort'&&v==='branch')) u.set(k,v);
  history.replaceState(null,'',location.pathname+(u.toString()?'?'+u:''));
  render();
}
const pressAll=()=>{
  main.querySelectorAll('[data-el]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.el===st.element));
  main.querySelectorAll('[data-type]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.type===st.type));
};
main.querySelectorAll('[data-el]').forEach(b=>b.addEventListener('click',()=>{st.element=b.dataset.el;if(st.element&&st.type==='civilian') st.type='';pressAll();update();}));
main.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{st.type=b.dataset.type;if(st.type==='civilian') st.element='';pressAll();update();}));
main.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{st[s.dataset.k]=s.value;update();}));
document.getElementById('fq').addEventListener('input',e=>{st.q=e.target.value;update();});
document.getElementById('reset').addEventListener('click',()=>{for(const k in st) st[k]=k==='sort'?'branch':'';main.querySelectorAll('select').forEach(s=>s.value=st[s.dataset.k]);document.getElementById('fq').value='';pressAll();update();});
render();
})();
