/* Character profile: one dynamic page for every Guardian.
   character.html?id=blossom  or  character.html?name=Blossom  (also character.html#blossom).
   Fields come from data/characters/<name>.json (built from the characters doc); structure
   (branch, mentors, disciples) comes from data/branches.json. Empty fields are never shown. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('characters');
const main=document.getElementById('main');

let lore=null;
try{lore=await Story.loadLore();}catch(e){/* story.md is optional */}

const keyOf=()=>{const p=W.params();return (p.get('name')||p.get('id')||location.hash.slice(1)||'').trim();};
function resolve(){
  const p=W.params();
  const id=(p.get('id')||location.hash.slice(1)||'').trim();
  const name=(p.get('name')||'').trim();
  return data.byId.get(W.slug(id))||data.byName.get(name.toLowerCase())||data.byId.get(W.slug(name))||null;
}

// The team a character is listed under in the story, linked to its place in Lore › Teams and Groups.
// Civilians link to their group in Lore › Civilians instead.
function teamLink(name,civ){
  const dir=civ?'civilians':'teams';
  const t=lore&&(lore.dirs[dir]||[]).find(x=>x.members.some(m=>m.toLowerCase()===name.toLowerCase()));
  return t?{name:t.name,href:`lore.html?a=${dir}#${W.slug(t.name)}`}:null;
}

// A character with a file in data/characters/ but not in branches.json: build the same shape so it gets a full page.
async function fromProfileOnly(){
  const k=W.slug(keyOf());if(!k) return null;
  let ref=null;
  for(const [n,e] of data.profiles) if(W.slug(n)===k){ref=e;break;}
  const c=ref&&await W.loadCharacter(ref);
  if(!c) return null;
  const pf=c.profile||{};
  const path=String(pf['Branch Theme']||'').replace(/[–—]/g,'-').replace(/\s+/g,'');
  const segs=path?path.split('-').filter(Boolean):[];
  const el=W.ELEMENTS.find(e=>e.toLowerCase()===(segs[0]||String(pf['Original Element']||'').split(/[\s-]/)[0]).toLowerCase())||'None';
  const status=String((c.other&&c.other.Status)||'').toLowerCase().match(/deceased|retired/);
  return {id:W.slug(c.name),name:c.name,path,segs,element:el,rank:'',role:'',team:'',guild:'',zodiac:'',base:'',mentor:'',
    status:status?status[0]:'',disciples:[],mentors:[],sameAs:'',form:'',noBranchReason:'',info:{},lore:{},profile:c,storyOnly:true};
}

function notFound(){
  const q=keyOf(),ql=W.slug(q);
  const near=ql?data.guardians.filter(g=>g.id.includes(ql)||ql.includes(g.id)||g.id[0]===ql[0]).slice(0,8):[];
  document.title='Not found · Luma Guardian Wiki';
  main.innerHTML=`<div class="notfound">
    <h1>${q?`No Guardian called “${esc(q)}”`:'Pick a Guardian'}</h1>
    <p class="muted">${q?'This Guardian has no page yet, or the name is spelled differently.':'This page shows one Guardian at a time. Choose one below.'}</p>
    <p><a class="btn primary" href="characters.html${q?'?q='+encodeURIComponent(q):''}">Search all Guardians</a></p>
  </div>${near.length?`<h2 style="font-size:18px;margin:24px 0 12px">Did you mean</h2><div class="grid">${near.map(W.card).join('')}</div>`:''}`;
}

// Text from the doc: one paragraph per line, Guardian names and web links turned into links.
function inline(s,g){
  return String(s).split(/(<?https?:\/\/[^\s>]+>?)/).map(part=>{
    const u=part.match(/^<?(https?:\/\/[^\s>]+)>?$/);
    return u?`<a href="${esc(u[1])}" target="_blank" rel="noopener noreferrer">${esc(u[1])}</a>`:W.linkify(part,data,g);
  }).join('');
}
// One paragraph per line; runs of "- item" lines become a bullet list.
function paras(s,g){
  let html='',items=[];
  const flush=()=>{if(items.length){html+=`<ul>${items.map(x=>`<li>${inline(x,g)}</li>`).join('')}</ul>`;items=[];}};
  for(const l of String(s).split(/\n+/).map(x=>x.trim()).filter(Boolean)){
    const b=l.match(/^[-*•]\s*(.+)$/);
    if(b) items.push(b[1]); else {flush();html+=`<p>${inline(l,g)}</p>`;}
  }
  flush();
  return html;
}

async function render(g){
  const c=g.profile||await W.loadCharacter(g.profileRef),pf=(c&&c.profile)||{};
  // Civilians use the Civilian template: no element, branch or Guardian fields.
  const civ=!!(c&&c.type==='civilian');
  const gallery=((c&&c.gallery)||[]).filter(x=>x&&x.src);
  const has=v=>Array.isArray(v)?v.some(x=>String(x).trim()):!!W.clean(v);
  // A Profile Template field, or the same field in branches.json when the profile has none.
  const P=(field,...fallback)=>{
    const v=pf[field];
    if(has(v)) return Array.isArray(v)?v.filter(x=>String(x).trim()):String(v).trim();
    for(const f of fallback){const b=g.info[f];if(W.clean(b)) return String(b).trim();}
    return '';
  };
  g.rank=P('Guardian Rank')||g.rank;g.role=P('Primary Role')||g.role;g.team=P('Team')||g.team;
  g.guild=P('Guild')||g.guild;g.zodiac=P('Zodiac')||g.zodiac;g.mentor=P('Mentor')||g.mentor;
  // Guardian Status ("Deceased — Executed by ...") sets the status badge; Active needs no badge.
  const gstatus=P('Guardian Status');
  if(gstatus){const k=gstatus.split(/[\s—–,;(-]/)[0].toLowerCase();g.status=k==='active'?'':k;}
  const base=P('Stationed at','Based at')||g.base||(c&&c.base)||'';
  const el=g.element,lore=g.lore||{};
  const was=g.status==='deceased'?'was':'is';
  const title=g.name;
  document.title=`${title} · Luma Guardian Wiki`;
  document.querySelector('meta[name="theme-color"]').setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--'+(el==='None'?'none':el.toLowerCase())).trim()||'#2B2253');

  /* branch path: Element › Lumen › Moon › Blossom, each step linked to its Guardian or branch list */
  const chain=g.segs.map((s,i)=>{
    const sub=g.segs.slice(0,i+1).join('-');
    if(i===g.segs.length-1) return {label:s,me:true};
    const owner=i>0&&data.guardians.find(x=>x.path.toLowerCase()===sub.toLowerCase());
    return owner?{label:s,href:W.charUrl(owner)}:{label:s,href:'characters.html?'+(i===0?'element='+encodeURIComponent(s):'branch='+encodeURIComponent(sub)),plain:i>0};
  });
  const branchHtml=g.path?chain.map(x=>x.me?esc(x.label):`<a href="${x.href}">${esc(x.label)}</a>`).join(' › '):(g.storyOnly?'':`<span class="muted">No branch yet${g.noBranchReason?' ('+esc(g.noBranchReason)+')':''}</span>`);
  const mentorsHtml=g.mentor?inline(g.mentor,g):(g.mentors.length?g.mentors.map(m=>`<a href="${W.charUrl(m)}">${esc(m.name)}</a>`).join(', '):'');
  const discText=P('Disciple');
  const discHtml=discText?inline(discText,g):g.disciples.map(d=>{const t=data.byName.get(W.stripParen(d).toLowerCase());return t?`<a href="${W.charUrl(t)}">${esc(d)}</a>`:esc(d);}).join(', ');
  const other=g.sameAs&&data.byName.get(g.sameAs.toLowerCase());
  const evolved=P('Evolved Guardian Name');

  /* ---------- infobox ---------- */
  const row=(k,v,raw)=>v?`<dt>${esc(k)}</dt><dd>${raw?v:inline(v,g)}</dd>`:'';
  const group=(name,rows)=>{const r=rows.join('');return r?`<h4>${name}</h4><dl>${r}</dl>`:'';};
  const infobox=`<aside class="infobox el-${el}" aria-label="${esc(title)} at a glance">
    <div class="ib-title">${esc(title)}</div>
    ${(()=>{
      // Portrait: lore.json image, then the file's "image", then the first gallery picture.
      const src=lore.image||(c&&c.image)||(gallery[0]&&gallery[0].src);
      const cap=lore.caption||(!lore.image&&!(c&&c.image)&&gallery[0]&&gallery[0].caption)||'';
      return `<div class="ib-img">${src?`<img class="full" src="${esc(W.asset(src))}" alt="${esc(lore.imageAlt||title)}">`:W.avatar(g,160,true)}</div>${cap?`<div class="ib-cap">${esc(cap)}</div>`:''}`;
    })()}
    ${civ?group('Biographical',[
      row('Alignment','Civilian',true),
      row('Full name',P('Full Name')),row('Nickname',P('Nickname')),
      row('Gender',P('Gender')),row('Sexuality',P('Sexuality')),
      row('Age',P('Age (counted as of 2025)')),row('Date of birth',P('Date of Birth')),
      row('Ethnicity',P('Ethnicity')),row('Zodiac',esc(P('Zodiac')),true),
      row('Home country',P('Home Country')),row('Hometown',P('Hometown')),
      row('Languages',P('Languages')),row('Education',P('Education')),
      row('Occupation',P('Occupation')),row('Department',P('Department')),row('Spirit animal',P('Spirit Animal'))
    ])+group('Connections',[
      row('Role in story',P('Role in Story')),row('Relationship',P('Relationship')),
      row('Family',P('Family')),row('Close bonds',P('Close bonds'))
    ]):''}
    ${civ?'':group('Biographical',[
      row('Civilian name',P('Civilian Name','Civilian Name')),row('Nickname',P('Nickname','Nickname')),
      row('Gender',P('Gender','Gender')),row('Sexuality',P('Sexuality')),
      row('Age',P('Age (counted as of 2025)','Age')),row('Date of birth',P('Date of Birth','Date of Birth')),
      row('Ethnicity',P('Ethnicity','Ethnicity')),row('Zodiac',esc(g.zodiac||''),true),
      row('Home country',P('Home Country')),row('Hometown',P('Hometown')),
      row('Languages',P('Languages')),row('Education',P('Education')),
      row('Occupation',P('Civilian Occupation','Civilian Occupation')),row('Spirit animal',P('Spirit Animal','Spirit Animal'))
    ])}
    ${civ?'':group('Guardian',[
      el!=='None'?row('Element',`<span class="pill el-${el}"><span class="dot"></span>${el}</span>`,true):row('Element',P('Original Element','Original Element')),
      row('Inherited',P('Inherited Element','Inherited Element')),
      row('Branch',branchHtml,true),
      row('Rank',g.rank),
      row('Status',gstatus?esc(gstatus):(g.status?W.statusPill(g):''),true),
      row('Duty',P('Duty Status')),
      row('Star index',esc(P('Star Index')),true),row('Role',g.role),
      row('Awakening',P('Awakening Type','Awakening Type')),row('Awakened',P('Awakened Date','Awakened Date')),
      row('Awakened by',P('Awakened by','Awakened By')),row('Full-fledged',P('Full-Fledged Date')),
      row('Evolved',P('Evolution Date')),
      row('Item',P('Transformation Item','Transformation Item')),row('Power colour',P('Power Color','Power Color')),
      row('Artefact',P('Artefact'))
    ])}
    ${civ?'':group('Affiliation',[
      row('Team',g.team?`<a href="characters.html?team=${encodeURIComponent(W.groupKey(g.team))}">${esc(g.team)}</a>`:'',true),
      row('Guild',g.guild),
      row('Stationed at',base?`<a href="map.html?place=${encodeURIComponent(base)}">${esc(base)}</a>`:'',true),
      row('Mentor',mentorsHtml,true),row('Disciples',discHtml,true),
      other?row(g.form==='evolved'?'Original form':'Evolved form',`<a href="${W.charUrl(other)}">${esc(other.name)}</a>`,true):row('Evolved form',evolved)
    ])}
  </aside>`;

  /* ---------- article ---------- */
  const secs=[];
  const add=(id,name,html)=>{if(html&&html.trim()) secs.push({id,title:name,html});};
  const facts=list=>{const r=list.map(([k,v])=>W.clean(v)?`<dt>${esc(k)}</dt><dd>${String(v).includes('\n')?paras(v,g):inline(v,g)}</dd>`:'').join('');return r?`<dl class="facts">${r}</dl>`:'';};
  const sub=(name,v)=>v?`<h3>${esc(name)}</h3>${paras(v,g)}`:'';
  const list=v=>v&&v.length?`<ul>${v.map(x=>`<li>${inline(x,g)}</li>`).join('')}</ul>`:'';

  // Civilians have no opening sentence; the infobox already says who they are.
  const overview=lore.summary?W.markup(lore.summary,data):civ?'':(()=>{
    const bits=[];
    bits.push(`<b>${esc(title)}</b> ${was} ${/^[aeiou]/i.test(g.rank||'Guardian')?'an':'a'} ${esc(g.rank||'Guardian')}${el!=='None'?` of the <b>${el}</b> element`:''}${g.segs.length>1?`, in the ${esc(g.segs.slice(1).join(' › '))} branch`:''}.`);
    const m=g.mentors.length?g.mentors.map(x=>`<a href="${W.charUrl(x)}">${esc(x.name)}</a>`).join(' and '):(g.mentor?inline(g.mentor.split(';')[0],g):'');
    if(m) bits.push(`Mentored by ${m}.`);
    const aff=[g.team&&`a member of ${esc(g.team)}`,g.guild&&`affiliated with the ${esc(W.groupKey(g.guild))} guild`].filter(Boolean);
    if(aff.length) bits.push(`${esc(title)} ${was} ${aff.join(' and ')}${base?`, stationed in ${esc(base)}`:''}.`);
    else if(base) bits.push(`${esc(title)} ${was} stationed in ${esc(base)}.`);
    return `<p class="lead">${bits.join(' ')}</p>`;
  })();
  const core=P('Core Idea of character');

  add('appearance','Appearance',paras(P('Appearance'),g)+sub('Civilian',P('Civilian Appearance'))+sub('Guardian',P('Guardian Appearance'))+(lore.appearance?W.markup(lore.appearance,data):''));
  add('personality','Personality',paras(P('Personality','Personality'),g)+(lore.personality?W.markup(lore.personality,data):'')
    +(P('Personality Example').length?`<h3>In practice</h3>${list(P('Personality Example'))}`:'')
    +sub('When feverish',P('Fever Behaviour'))+sub('When intoxicated',P('Intoxicated Behaviour'))
    +facts([['MBTI',P('MBTI')],['Catchphrase',P('Catchphrase')],['Theme song',P('Theme Song')],['Loves',P('Loves')],['Likes',P('Likes')],
      ['Dislikes',P('Dislikes')],['Hates',P('Hates')],['Hobbies',P('Hobbies')],['Fear',P('Fear')]]));
  add('background','Background',paras(P('Background'),g)+(lore.history?W.markup(lore.history,data):''));
  add('abilities','Abilities and powers',(lore.abilities?W.markup(lore.abilities,data):'')+facts([
    ['Primary role',g.role],['Passed tests',P('Passed Tests','Passed Tests')],['Likely role',g.info['Likely Primary Role']],['Possible future role',g.info['Possible Future Role']],
    ['Signature ability',P('Signature Ability')],['Weapon / medium',P('Weapon/Medium')],['Strengths',P('Strengths')],['Weaknesses',P('Weaknesses')],
    ['Transformation item',P('Transformation Item','Transformation Item')],['Power colour',P('Power Color','Power Color')],['Artefact',P('Artefact')]
  ]));

  /* lineage */
  let lin='';
  if(g.path) lin+=`<div class="lineage el-${el}" aria-label="Branch path">${chain.map((x,i)=>(i?'<span class="arr" aria-hidden="true">›</span>':'')+(x.me?`<span class="node me">${esc(x.label)}</span>`:`<a class="node${x.plain?' plain':''}" href="${x.href}">${i===0?'<span class="dot"></span>':''}${esc(x.label)}</a>`)).join('')}</div>`;
  if(g.mentors.length) lin+=`<h3>Mentored by</h3><div class="grid">${g.mentors.map(W.card).join('')}</div>`;
  if(g.disciples.length) lin+=`<h3>Disciples</h3><div class="grid">${g.disciples.map(d=>{const t=data.byName.get(W.stripParen(d).toLowerCase());return t?W.card(t):W.stub(d);}).join('')}</div>`;
  if(g.segs.length>1&&!g.storyOnly){
    const parent=g.segs.slice(0,-1).join('-').toLowerCase();
    const sib=data.guardians.filter(x=>x!==g&&x.segs.length===g.segs.length&&x.segs.slice(0,-1).join('-').toLowerCase()===parent);
    if(sib.length) lin+=`<h3>Also under ${esc(g.segs[g.segs.length-2])}</h3><div class="grid">${sib.map(W.card).join('')}</div>`;
  }
  add('lineage','Branch and lineage',lin);

  add('relationships','Relationships',(lore.relationships?W.markup(lore.relationships,data):'')+facts([
    ['Relationship',P('Relationship','Relationship')],['Family',P('Family','Family')],['Close bonds',P('Close bonds','Close bonds')],['Rivals',P('Rivals')],
    ...(other?[[g.form==='evolved'?'Original form':'Evolved form',other.name]]:[])
  ]));
  const quotes=P('Quotes');
  // Speeches keep their line breaks, like lines of a poem.
  const speech=(name,v)=>v?`<h3>${esc(name)}</h3><blockquote class="quote speech">${String(v).split(/\n+/).map(l=>inline(l.trim(),g)).join('<br>')}</blockquote>`:'';
  add('speeches','Transformation and awakening',speech('Transformation phrase',P('Transformation Phrase'))+speech('Awakening speech',P('Awakening Speech')));
  add('quotes','Quotes',quotes.length?quotes.map(q=>`<blockquote class="quote">${inline(q,g)}</blockquote>`).join(''):'');

  for(const s of (lore.sections||[])) add(W.slug(s.title),s.title,W.markup(s.text||'',data));
  add('trivia','Trivia',lore.trivia&&W.markup(lore.trivia,data));
  // Labels in the doc that the template does not have, then anything only branches.json knows.
  const extra=Object.entries((c&&c.other)||{});
  if(!c){
    const shown=new Set(['guardian rank','primary role','team','guild','zodiac','branch theme','original element','based at','likely primary role','possible future role']);
    for(const [k,v] of Object.entries(g.info)) if(!shown.has(k.toLowerCase())&&!(k in pf)) extra.push([k,v]);
  }
  add('gallery','Gallery',gallery.length?`<div class="gallery">${gallery.map((x,i)=>`<figure><button type="button" class="gthumb" data-i="${i}" aria-label="View ${esc(x.caption||'image '+(i+1))} larger"><img src="${esc(W.asset(x.src))}" alt="${esc(x.alt||x.caption||title)}" loading="lazy"></button>${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('')}</div>`:'');
  add('more','Other information',facts(extra));

  const t=teamLink(title,civ);
  const toc=secs.length>=3?`<details class="toc" open><summary>Contents</summary><ol>${secs.map(s=>`<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ol></details>`:'';
  const crumbs=civ?`<a href="lore.html?a=civilians">Civilians</a><span class="sep">›</span>`
    :`<a href="characters.html">Guardians</a><span class="sep">›</span>${el!=='None'?`<a href="characters.html?element=${el}">${el}</a><span class="sep">›</span>`:''}`;
  const tags=civ?'<span class="pill">Civilian</span>'
    :`<span class="pill el-${el}"><span class="dot"></span>${el==='None'?'No branch yet':el}</span>${g.rank?`<span class="pill">${esc(g.rank)}</span>`:''}${W.statusPill(g)}`;
  main.innerHTML=`
  <div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span>${crumbs}<span>${esc(title)}</span></div>
  <div class="prof-head el-${el}">
    <h1>${esc(title)}</h1>
    <div class="tags">${tags}${t?`<a class="pill" href="${t.href}">${esc(t.name)}</a>`:''}</div>
  </div>
  <div class="prof el-${el}">
    ${infobox}
    <article class="prose">
      ${lore.quote?`<blockquote class="quote">“${esc(lore.quote)}”${lore.quoteBy?`<cite>— ${esc(lore.quoteBy)}</cite>`:''}</blockquote>`:''}
      ${core?`<blockquote class="quote">${inline(core,g)}</blockquote>`:''}
      ${overview}
      ${toc}
      ${secs.map(s=>`<h2 id="${s.id}">${esc(s.title)}</h2>${s.html}`).join('')}
    </article>
  </div>`;
  if(gallery.length) lightbox(gallery,title);
  if(location.hash&&location.hash.length>1&&document.getElementById(location.hash.slice(1))) document.getElementById(location.hash.slice(1)).scrollIntoView();
}

// Click a gallery picture to see it large; arrow keys or buttons move between pictures, Esc closes.
function lightbox(items,title){
  const dlg=document.createElement('dialog');
  dlg.className='lightbox';
  dlg.innerHTML=`<figure><img alt=""><figcaption></figcaption></figure>
    <button type="button" class="lb-btn lb-prev" aria-label="Previous picture">‹</button>
    <button type="button" class="lb-btn lb-next" aria-label="Next picture">›</button>
    <button type="button" class="lb-btn lb-close" aria-label="Close">×</button>`;
  document.body.append(dlg);
  let i=0;
  const show=n=>{
    i=(n+items.length)%items.length;const x=items[i];
    const img=dlg.querySelector('img');img.src=W.asset(x.src);img.alt=x.alt||x.caption||title;
    dlg.querySelector('figcaption').textContent=[x.caption,items.length>1?`${i+1} / ${items.length}`:''].filter(Boolean).join(' · ');
  };
  dlg.querySelectorAll('.lb-prev,.lb-next').forEach(b=>b.hidden=items.length<2);
  dlg.querySelector('.lb-prev').onclick=()=>show(i-1);
  dlg.querySelector('.lb-next').onclick=()=>show(i+1);
  dlg.querySelector('.lb-close').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg) dlg.close();});
  dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft') show(i-1);if(e.key==='ArrowRight') show(i+1);});
  document.querySelectorAll('.gthumb').forEach(b=>b.addEventListener('click',()=>{show(+b.dataset.i);dlg.showModal();}));
}

const g=resolve()||await fromProfileOnly();
if(g) await render(g); else notFound();
})();
