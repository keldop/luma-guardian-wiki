/* Lore: topic articles grouped by data/lore-layout.json, a team directory, and full-text search.
   lore.html = all articles, lore.html?a=crystals = one article, lore.html?q=astral = search.
   Old links (lore.html?tab=<doc tab>) still work. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('lore');
const main=document.getElementById('main');
let lore;
try{lore=await Story.loadLore();}
catch(e){main.innerHTML=`<div class="err"><b>The story file is missing.</b><br>${esc(e.message)}<br><span class="muted">Create it with wiki/tools/update-story.ps1 (see wiki/README.md).</span></div>`;return;}

const p=W.params();
const want=p.get('a')||p.get('tab')||'';
const art=lore.bySlug.get(want)||lore.bySlug.get(lore.fromTab.get(want)||'');
const q=(p.get('q')||'').trim();
const url=a=>'lore.html?a='+a.slug;

const firstText=md=>{for(const l of md.split('\n')){const t=l.replace(/[#*_>~`\\]/g,'').trim();if(t.length>40&&!/^\[?https?:/.test(t)&&!/^Members:/.test(t)) return t;}return '';};
const sidebar=()=>`<aside class="lore-side" aria-label="Lore articles">
  <form class="lore-search" action="lore.html" role="search"><label class="sr" for="lq">Search the lore</label><input type="search" id="lq" name="q" placeholder="Search the lore…" value="${esc(q)}"></form>
  <label class="sr" for="lsel">Article</label>
  <select id="lsel" class="lore-select"><option value="">All articles</option>${lore.groups.map(g=>`<optgroup label="${esc(g.title)}">${g.articles.map(a=>`<option value="${a.slug}"${art===a?' selected':''}>${esc(a.title)}</option>`).join('')}</optgroup>`).join('')}</select>
  <nav class="lore-nav"><a href="lore.html"${!art&&!q?' aria-current="page"':''}>All articles</a>${lore.groups.map(g=>`<span class="lore-group">${esc(g.title)}</span>${g.articles.map(a=>`<a href="${url(a)}"${art===a?' aria-current="page"':''}>${esc(a.title)}</a>`).join('')}`).join('')}</nav>
</aside>`;
const crumbs=(group,leaf)=>`<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span>${leaf?`<a href="lore.html">Lore</a><span class="sep">›</span>${group?`<span>${esc(group)}</span><span class="sep">›</span>`:''}<span>${esc(leaf)}</span>`:'<span>Lore</span>'}</div>`;
const shell=(group,leaf,inner)=>{main.innerHTML=`${crumbs(group,leaf)}<div class="lore">${sidebar()}<article class="prose lore-body">${inner}</article></div>`;
  const s=document.getElementById('lsel');s.addEventListener('change',()=>{location.href=s.value?'lore.html?a='+s.value:'lore.html';});};

// Contents box. With only a few main sections, their sub-sections are listed under them.
function tocFor(root){
  const label=h=>esc(h.dataset.label||h.textContent);
  const h2=[...root.querySelectorAll('h2')];
  const all=[...root.querySelectorAll('h2,h3')];
  let items,count;
  if(h2.length>=2&&h2.length<6&&all.length>h2.length){
    items=h2.map(h=>{
      const subs=[];
      for(let i=all.indexOf(h)+1;i<all.length&&all[i].tagName==='H3';i++) subs.push(all[i]);
      return `<li><a href="#${h.id}">${label(h)}</a>${subs.length?`<ol>${subs.map(s=>`<li><a href="#${s.id}">${label(s)}</a></li>`).join('')}</ol>`:''}</li>`;
    }).join('');
    count=all.length;
  }else{
    const heads=h2.length>=2?h2:[...root.querySelectorAll('h3')];
    items=heads.map(h=>`<li><a href="#${h.id}">${label(h)}</a></li>`).join('');
    count=heads.length;
  }
  return count>=3?`<details class="toc" ${count>14?'':'open'}><summary>Contents (${count})</summary><ol>${items}</ol></details>`:'';
}
function pager(a){
  const i=lore.articles.indexOf(a),prev=lore.articles[i-1],next=lore.articles[i+1];
  return `<nav class="pager">${prev?`<a href="${url(prev)}">← ${esc(prev.title)}</a>`:'<span></span>'}${next?`<a href="${url(next)}">${esc(next.title)} →</a>`:''}</nav>`;
}
const jump=()=>{if(location.hash){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t) t.scrollIntoView();}};

// A card for anyone: a Guardian from branches.json, or a character file (doc-only Guardian or civilian).
function personCard(n){
  const gd=data.byName.get(n.toLowerCase());
  if(gd) return W.card(gd);
  const ref=data.profiles.get(n.toLowerCase());
  const sub=ref?(ref.subtitle||(ref.type==='civilian'?'Civilian':'Guardian')):'No profile yet';
  const img=ref&&ref.image?`<img src="${esc(W.asset(ref.image))}" alt="" loading="lazy">`:esc(n[0].toUpperCase());
  return `<a class="ccard el-None${ref?'':' noprof'}" href="character.html?name=${encodeURIComponent(n)}" title="${esc(sub)}"><span class="ava el-None" style="--s:48px" aria-hidden="true">${img}</span><span class="t"><b>${esc(n)}</b><small>${esc(sub)}</small></span></a>`;
}
// Team or civilian directory: each group's intro from the doc (a family list, for families) plus member cards.
async function directoryHtml(list){
  const out=[];
  for(const g of list){
    const intro=g.intro.trim()?(await Story.render(g.intro,data)).innerHTML:'';
    const cards=g.members.map(personCard).join('');
    // Names listed after the write-ups (family members without a profile yet).
    const notes=g.notes&&g.notes.trim()?`${cards?'<h3 class="dir-more">Also in this group</h3>':''}${(await Story.render(g.notes,data)).innerHTML}`:'';
    out.push(`<h2 id="${W.slug(g.name)}" data-label="${esc(g.name)}">${esc(g.name)}${g.base?` <span class="pill">${esc(g.base)}</span>`:''}</h2>${intro}${cards?`<div class="grid team-grid">${cards}</div>`:''}${notes}`);
  }
  return out.join('');
}
const LEADS={teams:"Every team and group in the story. Each Guardian's full write-up is on their profile page.",
  civilians:'The people around the Guardians: co-workers, classmates and families. Click a name for their profile.'};

async function showArticle(){
  document.title=`${art.title} · Lore · Luma Guardian Wiki`;
  shell(art.group.title,art.title,`<h1 class="lore-title">${esc(art.title)}</h1><div class="loading">Loading…</div>`);
  const box=main.querySelector('.lore-body');
  let body;
  if(art.special){
    body=document.createElement('div');
    body.innerHTML=`<p class="lead">${esc(LEADS[art.special]||'')}</p>`+await directoryHtml(lore.dirs[art.special]);
  }else{
    body=await Story.render(art.md,data);
    // "Luma X" headings link to that Guardian's profile.
    body.querySelectorAll('h2,h3,h4').forEach(hd=>{
      const m=hd.textContent.replace(/\(.*?\)/g,'').trim().match(/^Luma\s+(\S.*)$/i);
      const g=m&&data.byName.get(m[1].split('/')[0].trim().toLowerCase());
      if(g){hd.dataset.label=hd.textContent;hd.insertAdjacentHTML('beforeend',` <a class="hlink" href="${W.charUrl(g)}">Wiki profile →</a>`);}
    });
  }
  box.querySelector('.loading').remove();
  box.insertAdjacentHTML('beforeend',tocFor(body));
  box.append(body);
  box.insertAdjacentHTML('beforeend',pager(art));
  jump();
}

async function showSearch(){
  document.title=`“${q}” · Lore · Luma Guardian Wiki`;
  shell('','Search',`<h1 class="lore-title">Search: “${esc(q)}”</h1><div class="loading">Searching…</div>`);
  const words=q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=[];
  for(const a of lore.articles){
    const body=await Story.render(a.md,null);
    // Split each article into sections at its headings, then score each section.
    let cur={head:null,text:''};const secs=[cur];
    for(const n of body.children){
      if(/^H[1-6]$/.test(n.tagName)){cur={head:n,text:''};secs.push(cur);}
      else cur.text+=' '+n.textContent;
    }
    for(const s of secs){
      const ht=s.head?s.head.textContent:a.title;
      const hay=(ht+' '+s.text).toLowerCase();
      if(!words.every(w=>hay.includes(w))) continue;
      const score=words.reduce((n,w)=>n+(ht.toLowerCase().includes(w)?10:0)+hay.split(w).length-1,0);
      const at=Math.max(0,s.text.toLowerCase().indexOf(words[0])-80);
      hits.push({a,id:s.head&&s.head.id,ht,score,snip:s.text.slice(at,at+220).trim()});
    }
  }
  hits.sort((x,y)=>y.score-x.score);
  const hl=s=>{let h=esc(s);for(const w of words) h=h.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>');return h;};
  const box=main.querySelector('.lore-body');
  box.querySelector('.loading').remove();
  const guardians=data.guardians.filter(g=>words.every(w=>g.name.toLowerCase().includes(w)));
  box.insertAdjacentHTML('beforeend',
    (guardians.length?`<h2 style="font-size:17px;margin:4px 0 10px">Guardians</h2><div class="grid" style="margin-bottom:22px">${guardians.slice(0,6).map(W.card).join('')}</div>`:'')+
    `<p class="count">${hits.length} section${hits.length===1?'':'s'} found</p>`+
    (hits.length?`<ol class="hits">${hits.slice(0,80).map(h=>`<li><a href="${url(h.a)}${h.id?'#'+h.id:''}"><b>${hl(h.ht)}</b><small>${esc(h.a.group.title)} › ${esc(h.a.title)}</small></a>${h.snip?`<p>…${hl(h.snip)}…</p>`:''}</li>`).join('')}</ol>`:'<div class="empty">Nothing in the lore matches that.</div>'));
}

function showIndex(){
  document.title='Lore · Luma Guardian Wiki';
  shell('','',`<h1 class="lore-title">Lore</h1>
    <p class="muted" style="margin:0 0 6px">The story bible, organised by topic. Each Guardian's own write-up is on their <a href="characters.html">profile page</a>.</p>
    ${lore.groups.map(g=>`<section class="lore-sec"><h2>${esc(g.title)}</h2>${g.blurb?`<p class="muted">${esc(g.blurb)}</p>`:''}
      <div class="lore-cards">${g.articles.map(a=>{
        const d=a.special&&lore.dirs[a.special];
        const n=d?d.length:(a.md.match(/^##\s/gm)||[]).length;
        const s=d?d.map(t=>t.name).join(', '):firstText(a.md);
        return `<a class="lore-card" href="${url(a)}"><b>${esc(a.title)}</b><span>${esc(s.length>140?s.slice(0,137)+'…':s)}</span>${n?`<small>${n} ${d?'group':'section'}${n===1?'':'s'}</small>`:''}</a>`;}).join('')}</div></section>`).join('')}`);
}

if(q) await showSearch(); else if(art) await showArticle(); else showIndex();
})();
