/* Lore: one article per tab of the story doc, plus full-text search across all of them. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('lore');
const main=document.getElementById('main');
let story;
try{story=await Story.load();}
catch(e){main.innerHTML=`<div class="err"><b>The story file is missing.</b><br>${esc(e.message)}<br><span class="muted">Create it with wiki/tools/update-story.ps1 (see wiki/README.md).</span></div>`;return;}

const p=W.params();
const tab=story.bySlug.get(p.get('tab')||'');
const q=(p.get('q')||'').trim();

const firstText=md=>{for(const l of md.split('\n')){const t=l.replace(/[#*_>~`\\]/g,'').trim();if(t.length>40&&!/^\[?https?:/.test(t)) return t;}return '';};
const sidebar=()=>`<aside class="lore-side" aria-label="Lore articles">
  <form class="lore-search" action="lore.html" role="search"><label class="sr" for="lq">Search the lore</label><input type="search" id="lq" name="q" placeholder="Search the lore…" value="${esc(q)}"></form>
  <label class="sr" for="lsel">Article</label>
  <select id="lsel" class="lore-select"><option value="">All articles</option>${story.tabs.map(t=>`<option value="${t.slug}"${tab===t?' selected':''}>${esc(t.title)}</option>`).join('')}</select>
  <nav class="lore-nav"><a href="lore.html"${!tab&&!q?' aria-current="page"':''}>All articles</a>${story.tabs.map(t=>`<a href="lore.html?tab=${t.slug}"${tab===t?' aria-current="page"':''}>${esc(t.title)}</a>`).join('')}</nav>
</aside>`;
const crumbs=extra=>`<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span>${extra?`<a href="lore.html">Lore</a><span class="sep">›</span><span>${esc(extra)}</span>`:'<span>Lore</span>'}</div>`;

function wire(){
  const s=document.getElementById('lsel');
  s.addEventListener('change',()=>{location.href=s.value?'lore.html?tab='+s.value:'lore.html';});
}

async function showTab(){
  document.title=`${tab.title} · Lore · Luma Guardian Wiki`;
  main.innerHTML=`${crumbs(tab.title)}<div class="lore">${sidebar()}<article class="prose lore-body"><h1 class="lore-title">${esc(tab.title)}</h1><div class="loading">Loading…</div></article></div>`;
  wire();
  // Shift headings so the article's top level becomes h2, whatever level the doc used.
  const top=Math.min(...(tab.md.match(/^#{1,6}(?=\s)/gm)||['##']).map(h=>h.length));
  const body=await Story.render(tab.md,data,{shift:2-top});
  // A tab often opens with a heading that repeats its own name.
  const h=body.firstElementChild;
  if(h&&/^H[1-6]$/.test(h.tagName)&&W.slug(h.textContent)===tab.slug) h.remove();
  // "Luma X" headings get a link to that Guardian's wiki profile.
  body.querySelectorAll('h2,h3,h4').forEach(hd=>{
    const m=hd.textContent.replace(/\(.*?\)/g,'').trim().match(/^Luma\s+(\S.*)$/i);
    const g=m&&data.byName.get(m[1].split('/')[0].trim().toLowerCase());
    if(g) hd.insertAdjacentHTML('beforeend',` <a class="hlink" href="${W.charUrl(g)}">Wiki profile →</a>`);
  });
  let heads=[...body.querySelectorAll('h2')];
  if(heads.length<2) heads=[...body.querySelectorAll('h3')];
  const art=main.querySelector('.lore-body');
  art.querySelector('.loading').remove();
  if(heads.length>=3){
    art.insertAdjacentHTML('beforeend',`<details class="toc" ${heads.length>14?'':'open'}><summary>Contents (${heads.length})</summary><ol>${heads.map(h=>`<li><a href="#${h.id}">${esc(h.textContent.replace(/Wiki profile →/,'').trim())}</a></li>`).join('')}</ol></details>`);
  }
  art.append(body);
  const i=story.tabs.indexOf(tab),prev=story.tabs[i-1],next=story.tabs[i+1];
  art.insertAdjacentHTML('beforeend',`<nav class="pager">${prev?`<a href="lore.html?tab=${prev.slug}">← ${esc(prev.title)}</a>`:'<span></span>'}${next?`<a href="lore.html?tab=${next.slug}">${esc(next.title)} →</a>`:''}</nav>`);
  if(location.hash){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t) t.scrollIntoView();}
}

async function showSearch(){
  document.title=`“${q}” · Lore · Luma Guardian Wiki`;
  main.innerHTML=`${crumbs('Search')}<div class="lore">${sidebar()}<section class="lore-body"><h1 class="lore-title">Search: “${esc(q)}”</h1><div class="loading">Searching…</div></section></div>`;
  wire();
  const words=q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=[];
  for(const t of story.tabs){
    const body=await Story.render(t.md,null,{shift:1});
    // Split each article into sections at its headings, then score each section.
    let cur={head:null,text:''};const secs=[cur];
    for(const n of body.children){
      if(/^H[1-6]$/.test(n.tagName)){cur={head:n,text:''};secs.push(cur);}
      else cur.text+=' '+n.textContent;
    }
    for(const s of secs){
      const ht=s.head?s.head.textContent:t.title;
      const hay=(ht+' '+s.text).toLowerCase();
      if(!words.every(w=>hay.includes(w))) continue;
      const score=words.reduce((a,w)=>a+(ht.toLowerCase().includes(w)?10:0)+hay.split(w).length-1,0);
      const at=Math.max(0,s.text.toLowerCase().indexOf(words[0])-80);
      hits.push({t,id:s.head&&s.head.id,ht,score,snip:s.text.slice(at,at+220).trim()});
    }
  }
  hits.sort((a,b)=>b.score-a.score);
  const hl=s=>{let h=esc(s);for(const w of words) h=h.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>');return h;};
  const sec=main.querySelector('.lore-body');
  sec.querySelector('.loading').remove();
  const guardians=data.guardians.filter(g=>words.every(w=>g.name.toLowerCase().includes(w)));
  sec.insertAdjacentHTML('beforeend',
    (guardians.length?`<h2 style="font-size:17px;margin:4px 0 10px">Guardians</h2><div class="grid" style="margin-bottom:22px">${guardians.slice(0,6).map(W.card).join('')}</div>`:'')+
    `<p class="count">${hits.length} section${hits.length===1?'':'s'} found</p>`+
    (hits.length?`<ol class="hits">${hits.slice(0,80).map(h=>`<li><a href="lore.html?tab=${h.t.slug}${h.id?'#'+h.id:''}"><b>${hl(h.ht)}</b><small>${esc(h.t.title)}</small></a>${h.snip?`<p>…${hl(h.snip)}…</p>`:''}</li>`).join('')}</ol>`:'<div class="empty">Nothing in the lore matches that.</div>'));
}

function showIndex(){
  document.title='Lore · Luma Guardian Wiki';
  main.innerHTML=`${crumbs('')}<div class="lore">${sidebar()}<section class="lore-body">
    <h1 class="lore-title">Lore</h1>
    <p class="muted" style="margin:0 0 18px">The story bible: world rules, power system, organisations, events and every character write-up, one article per section of the story document.</p>
    <div class="lore-cards">${story.tabs.map(t=>{const n=(t.md.match(/^#{1,2}\s/gm)||[]).length;const s=firstText(t.md);return `<a class="lore-card" href="lore.html?tab=${t.slug}"><b>${esc(t.title)}</b><span>${esc(s.length>140?s.slice(0,137)+'…':s)}</span><small>${n} section${n===1?'':'s'}</small></a>`;}).join('')}</div>
  </section></div>`;
  wire();
}

if(q) await showSearch(); else if(tab) await showTab(); else showIndex();
})();
