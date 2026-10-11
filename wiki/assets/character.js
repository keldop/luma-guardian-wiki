/* Character profile: one dynamic page for every Guardian.
   character.html?id=blossom  or  character.html?name=Blossom  (also character.html#blossom). */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('characters');
const main=document.getElementById('main');

function resolve(){
  const p=W.params();
  const id=(p.get('id')||location.hash.slice(1)||'').trim();
  const name=(p.get('name')||'').trim();
  return data.byId.get(W.slug(id))||data.byName.get(name.toLowerCase())||data.byId.get(W.slug(name))||null;
}

function notFound(){
  const p=W.params();
  const q=(p.get('name')||p.get('id')||location.hash.slice(1)||'').trim();
  const ql=W.slug(q);
  const near=ql?data.guardians.filter(g=>g.id.includes(ql)||ql.includes(g.id)||g.id[0]===ql[0]).slice(0,8):[];
  document.title='Not found · Luma Guardian Wiki';
  main.innerHTML=`<div class="notfound">
    <h1>${q?`No Guardian called “${esc(q)}”`:'Pick a Guardian'}</h1>
    <p class="muted">${q?'This Guardian has no page yet, or the name is spelled differently.':'This page shows one Guardian at a time. Choose one below.'}</p>
    <p><a class="btn primary" href="characters.html${q?'?q='+encodeURIComponent(q):''}">Search all Guardians</a></p>
  </div>${near.length?`<h2 style="font-size:18px;margin:24px 0 12px">Did you mean</h2><div class="grid">${near.map(W.card).join('')}</div>`:''}`;
}

// A character written up in the story doc but not yet in branches.json still gets a page.
async function storyOnly(){
  const p=W.params();
  const key=(p.get('name')||p.get('id')||location.hash.slice(1)||'').trim().toLowerCase();
  if(!story||!key) return false;
  let name=null,sec=null;
  for(const [n,s] of story.chars) if(n===key||W.slug(n)===W.slug(key)){name=n;sec=s;break;}
  if(!sec) return false;
  const title=Story.cleanHeading(sec.title).replace(/^\(.*?\)\s*/,'');
  document.title=`${title} · Luma Guardian Wiki`;
  const body=await Story.render(sec.md,data,{shift:1});
  main.innerHTML=`
  <div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><a href="lore.html?tab=${sec.tab.slug}">${esc(sec.tab.title)}</a><span class="sep">›</span><span>${esc(title)}</span></div>
  <div class="prof-head"><h1>${esc(title)}</h1><div class="tags"><span class="pill">Story only</span></div></div>
  <article class="prose" style="max-width:860px">
    <p class="muted">This character is written up in the story bible but has no entry in <code>branches.json</code> yet, so there is no infobox or branch data.</p>
    ${body.innerHTML}
  </article>`;
  return true;
}

async function render(g){
  const el=g.element,info=g.info,lore=g.lore||{};
  const used=new Set();
  const take=k=>{used.add(k);return info[k]||'';};
  const was=g.status==='deceased'?'was':'is';
  document.title=`${g.name} · Luma Guardian Wiki`;
  document.querySelector('meta[name="theme-color"]').setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--'+(el==='None'?'none':el.toLowerCase())).trim()||'#2B2253');

  /* branch path: Element › Lumen › Moon › Blossom, each step linked to its Guardian or branch list */
  const chain=g.segs.map((s,i)=>{
    const sub=g.segs.slice(0,i+1).join('-');
    if(i===g.segs.length-1) return {label:s,me:true};
    const owner=i>0&&data.guardians.find(x=>x.path.toLowerCase()===sub.toLowerCase());
    return owner?{label:s,href:W.charUrl(owner)}:{label:s,href:'characters.html?'+(i===0?'element='+encodeURIComponent(s):'branch='+encodeURIComponent(sub)),plain:i>0};
  });
  const branchHtml=g.path?chain.map(c=>c.me?esc(c.label):`<a href="${c.href}">${esc(c.label)}</a>`).join(' › '):`<span class="muted">No branch yet${g.noBranchReason?' ('+esc(g.noBranchReason)+')':''}</span>`;

  const mentorsHtml=g.mentor?W.linkify(g.mentor,data,g):(g.mentors.length?g.mentors.map(m=>`<a href="${W.charUrl(m)}">${esc(m.name)}</a>`).join(', '):'');
  const discHtml=g.disciples.map(d=>{const t=data.byName.get(W.stripParen(d).toLowerCase());return t?`<a href="${W.charUrl(t)}">${esc(d)}</a>`:esc(d);}).join(', ');
  const other=g.sameAs&&data.byName.get(g.sameAs.toLowerCase());

  /* ---------- infobox ---------- */
  const row=(k,v,raw)=>v?`<dt>${esc(k)}</dt><dd>${raw?v:W.linkify(v,data,g)}</dd>`:'';
  const group=(title,rows)=>{const r=rows.join('');return r?`<h4>${title}</h4><dl>${r}</dl>`:'';};
  const awakened=[take('Awakened Date')].filter(Boolean).join('');
  const infobox=`<aside class="infobox el-${el}" aria-label="${esc(g.name)} at a glance">
    <div class="ib-title">${esc(g.name)}</div>
    <div class="ib-img">${lore.image?`<img class="full" src="${esc(lore.image)}" alt="${esc(lore.imageAlt||g.name)}">`:W.avatar(g,160,true)}</div>
    ${lore.caption?`<div class="ib-cap">${esc(lore.caption)}</div>`:''}
    ${group('Biographical',[
      row('Nickname',take('Nickname')),row('Age',take('Age')),row('Gender',take('Gender')),
      row('Zodiac',g.zodiac||take('Zodiac')),row('Ethnicity',take('Ethnicity')),
      row('Occupation',take('Civilian Occupation')),row('Spirit animal',take('Spirit Animal')),
      g.status?row('Status',W.statusPill(g),true):''
    ])}
    ${group('Guardian',[
      row('Element',`<span class="pill el-${el}"><span class="dot"></span>${el==='None'?'Unknown':el}</span>`,true),
      row('Inherited',take('Inherited Element')),
      row('Branch',branchHtml,true),
      row('Rank',g.rank),row('Role',g.role),
      row('Awakening',take('Awakening Type')),row('Awakened',awakened),row('Awakened by',take('Awakened By')),
      row('Item',take('Transformation Item')),row('Power colour',take('Power Color'))
    ])}
    ${group('Affiliation',[
      row('Team',g.team?`<a href="characters.html?team=${encodeURIComponent(W.groupKey(g.team))}">${esc(g.team)}</a>`:'',true),
      row('Guild',g.guild),
      row('Based at',g.base?`<a href="map.html?place=${encodeURIComponent(g.base)}">${esc(g.base)}</a>`:'',true),
      row('Mentor',mentorsHtml,true),row('Disciples',discHtml,true),
      other?row(g.form==='evolved'?'Original form':'Evolved form',`<a href="${W.charUrl(other)}">${esc(other.name)}</a>`,true):''
    ])}
  </aside>`;
  ['Guardian Rank','Primary Role','Team','Guild','Zodiac','Branch Theme','Original Element','Based at'].forEach(k=>used.add(k));

  /* ---------- article ---------- */
  const secs=[];
  const add=(id,title,html)=>{if(html&&html.trim()) secs.push({id,title,html});};

  const overview=lore.summary?W.markup(lore.summary,data):(()=>{
    const bits=[];
    bits.push(`<b>${esc(g.name)}</b> ${was} ${/^[aeiou]/i.test(g.rank||'Guardian')?'an':'a'} ${esc(g.rank||'Guardian')}${el!=='None'?` of the <b>${el}</b> element`:''}${g.segs.length>1?`, in the ${esc(g.segs.slice(1).join(' › '))} branch`:''}.`);
    const m=g.mentors.length?g.mentors.map(x=>`<a href="${W.charUrl(x)}">${esc(x.name)}</a>`).join(' and '):(g.mentor?W.linkify(g.mentor.split(';')[0],data,g):'');
    if(m) bits.push(`Mentored by ${m}.`);
    const aff=[g.team&&`a member of ${esc(g.team)}`,g.guild&&`affiliated with the ${esc(W.groupKey(g.guild))} guild`].filter(Boolean);
    if(aff.length) bits.push(`${esc(g.name)} ${was} ${aff.join(' and ')}${g.base?`, based in ${esc(g.base)}`:''}.`);
    else if(g.base) bits.push(`${esc(g.name)} ${was} based in ${esc(g.base)}.`);
    if(g.disciples.length) bits.push(`${esc(g.name)} has ${g.disciples.length} disciple${g.disciples.length>1?'s':''}.`);
    return `<p class="lead">${bits.join(' ')}</p>`;
  })();

  const sec=story&&story.chars.get(g.name.toLowerCase());
  if(sec){
    const body=await Story.render(sec.md,data,{shift:2,idPrefix:'s-'});
    add('story','Story profile',`<p class="muted src">From the <a href="lore.html?tab=${sec.tab.slug}#${W.slug(Story.cleanHeading(sec.title))}">${esc(sec.tab.title)}</a> section of the story bible.</p>${body.innerHTML}`);
  }
  add('appearance','Appearance',lore.appearance&&W.markup(lore.appearance,data));
  const pers=lore.personality||take('Personality');
  add('personality','Personality',pers&&(lore.personality?W.markup(pers,data):`<p>${W.linkify(pers,data,g)}</p>`));
  add('history','History',lore.history&&W.markup(lore.history,data));

  const facts=(list)=>{const r=list.map(([k,v])=>v?`<dt>${esc(k)}</dt><dd>${W.linkify(v,data,g)}</dd>`:'').join('');return r?`<dl class="facts">${r}</dl>`:'';};
  add('abilities','Abilities and powers',(lore.abilities?W.markup(lore.abilities,data):'')+facts([
    ['Primary role',g.role],['Passed tests',take('Passed Tests')],['Likely role',take('Likely Primary Role')],['Possible future role',take('Possible Future Role')],
    ['Transformation item',info['Transformation Item']],['Power colour',info['Power Color']]
  ]));

  /* lineage */
  let lin='';
  if(g.path){
    lin+=`<div class="lineage el-${el}" aria-label="Branch path">${chain.map((c,i)=>(i?'<span class="arr" aria-hidden="true">›</span>':'')+(c.me?`<span class="node me">${esc(c.label)}</span>`:`<a class="node${c.plain?' plain':''}" href="${c.href}">${i===0?'<span class="dot"></span>':''}${esc(c.label)}</a>`)).join('')}</div>`;
  }
  if(g.mentors.length) lin+=`<h3>Mentored by</h3><div class="grid">${g.mentors.map(W.card).join('')}</div>`;
  if(g.disciples.length) lin+=`<h3>Disciples</h3><div class="grid">${g.disciples.map(d=>{const t=data.byName.get(W.stripParen(d).toLowerCase());return t?W.card(t):W.stub(d);}).join('')}</div>`;
  if(g.segs.length>1){
    const parent=g.segs.slice(0,-1).join('-').toLowerCase();
    const sib=data.guardians.filter(x=>x!==g&&x.segs.length===g.segs.length&&x.segs.slice(0,-1).join('-').toLowerCase()===parent);
    if(sib.length) lin+=`<h3>Same branch</h3><div class="grid">${sib.map(W.card).join('')}</div>`;
  }
  add('lineage','Branch and lineage',lin);

  add('relationships','Relationships',(lore.relationships?W.markup(lore.relationships,data):'')+facts([
    ['Relationship',take('Relationship')],['Family',take('Family')],['Close bonds',take('Close bonds')],
    ...(other?[[g.form==='evolved'?'Original form':'Evolved form',other.name]]:[])
  ]));

  for(const s of (lore.sections||[])) add(W.slug(s.title),s.title,W.markup(s.text||'',data));
  add('trivia','Trivia',lore.trivia&&W.markup(lore.trivia,data));
  const rest=Object.keys(info).filter(k=>!used.has(k)&&!['Transformation Item','Power Color'].includes(k));
  add('more','Other information',facts(rest.map(k=>[k,info[k]])));

  const toc=secs.length>=3?`<details class="toc" open><summary>Contents</summary><ol>${secs.map(s=>`<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ol></details>`:'';

  main.innerHTML=`
  <div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><a href="characters.html">Guardians</a><span class="sep">›</span>${el!=='None'?`<a href="characters.html?element=${el}">${el}</a><span class="sep">›</span>`:''}<span>${esc(g.name)}</span></div>
  <div class="prof-head el-${el}">
    <h1>${esc(g.name)}</h1>
    <div class="tags"><span class="pill el-${el}"><span class="dot"></span>${el==='None'?'No branch yet':el}</span>${g.rank?`<span class="pill">${esc(g.rank)}</span>`:''}${W.statusPill(g)}</div>
  </div>
  <div class="prof el-${el}">
    ${infobox}
    <article class="prose">
      ${lore.quote?`<blockquote class="quote">“${esc(lore.quote)}”${lore.quoteBy?`<cite>— ${esc(lore.quoteBy)}</cite>`:''}</blockquote>`:''}
      ${overview}
      ${toc}
      ${secs.map(s=>`<h2 id="${s.id}">${esc(s.title)}</h2>${s.html}`).join('')}
      <p class="muted" style="font-size:13px;margin-top:32px">Profile data comes from <code>branches.json</code>. Add appearance, history, trivia or an image in <code>wiki/data/lore.json</code> under “${esc(g.name)}”.</p>
    </article>
  </div>`;
  if(location.hash&&location.hash.length>1&&document.getElementById(location.hash.slice(1))) document.getElementById(location.hash.slice(1)).scrollIntoView();
}

let story=null;
try{story=await Story.load();}catch(e){/* story.md is optional */}
const g=resolve();
if(g) await render(g);
else if(!(await storyOnly())) notFound();
})();
