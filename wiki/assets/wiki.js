/* Luma Guardian Wiki: shared data loading, header, theme toggle, search and helpers.
   Every page calls Wiki.boot('<page>') and gets the loaded data back. */
(function(){
"use strict";

const ELEMENTS=['Fire','Earth','Water','Air'];
// The wiki folder, worked out from this script's own address, so links work wherever the site is hosted.
const BASE=new URL('..',document.currentScript.src).href;
const EMPTY=new Set(['','-','–','—','none','n/a','na','?','unknown','tbd','undecided']);

function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const clean=v=>{v=String(v==null?'':v).trim().replace(/[;,]+$/,'').trim();return EMPTY.has(v.toLowerCase())?'':v;};
const groupKey=v=>clean(String(v||'').replace(/\(.*?\)/g,''));
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const stripParen=s=>String(s||'').replace(/\(.*?\)/g,'').trim();

/* ---------- theme ---------- */
function isDark(){
  const t=document.documentElement.getAttribute('data-theme');
  if(t) return t==='dark';
  return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;
}
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  lsSet('luma.theme.v1',t);
  document.dispatchEvent(new CustomEvent('themechange',{detail:{dark:t==='dark'}}));
  const b=$('#themebtn'); if(b) b.setAttribute('aria-label',t==='dark'?'Switch to light mode':'Switch to dark mode');
}
if(window.matchMedia){
  const mq=matchMedia('(prefers-color-scheme: dark)');
  const f=()=>{ if(!document.documentElement.getAttribute('data-theme')) document.dispatchEvent(new CustomEvent('themechange',{detail:{dark:mq.matches}})); };
  mq.addEventListener?mq.addEventListener('change',f):mq.addListener(f);
}

/* ---------- icons ---------- */
const ICON={
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sun:'<svg class="theme-ico-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg class="theme-ico-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};
// Classical element triangles.
function glyph(el){
  const up='M12 3 22 20H2Z',dn='M12 21 2 4h20Z';
  const p=el==='Fire'?up:el==='Water'?dn:el==='Air'?up+' M5.5 14h13':el==='Earth'?dn+' M5.5 10h13':'M12 3a9 9 0 1 0 0.01 0Z';
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="${p}"/></svg>`;
}

/* ---------- header / footer ---------- */
function chrome(active){
  const links=[['home','index.html','Home'],['characters','characters.html','Characters'],['lore','lore.html','Lore'],['map','map.html','Map'],['tree','tree.html','Branch tree'],['create','create.html','Create']].map(([k,h,t])=>[k,new URL(h,BASE).href,t]);
  const head=document.createElement('header');
  head.className='topbar';
  head.innerHTML=`<div class="in">
    <button class="iconbtn menubtn" id="menubtn" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${ICON.menu}</button>
    <a class="brand" href="${BASE}index.html"><span class="mark" aria-hidden="true">✦</span><span class="txt">Luma Guardian Wiki</span></a>
    <nav class="nav" id="nav" aria-label="Main">${links.map(([k,h,t])=>`<a href="${h}"${k===active?' aria-current="page"':''}>${t}</a>`).join('')}</nav>
    <form class="search" role="search" id="searchform" action="${BASE}characters.html">
      ${ICON.search}
      <label class="sr" for="q">Search Guardians</label>
      <input id="q" name="q" type="search" placeholder="Search Guardians…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list">
      <ul class="sugg" id="sugg" role="listbox"></ul>
    </form>
    <button class="iconbtn" id="themebtn" aria-label="${isDark()?'Switch to light mode':'Switch to dark mode'}" title="Toggle dark mode">${ICON.sun}${ICON.moon}</button>
  </div>`;
  document.body.prepend(head);
  const foot=document.createElement('footer');
  foot.className='foot';
  foot.innerHTML=`Luma Guardian Wiki · Character data from <a href="${BASE}data/branches.json">branches.json</a> · <a href="${BASE}tree.html">Branch tree</a>`;
  document.body.append(foot);
  $('#themebtn').addEventListener('click',()=>setTheme(isDark()?'light':'dark'));
  const mb=$('#menubtn'),nav=$('#nav');
  mb.addEventListener('click',()=>{const o=nav.classList.toggle('open');mb.setAttribute('aria-expanded',o);});
  document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!mb.contains(e.target)){nav.classList.remove('open');mb.setAttribute('aria-expanded','false');}});
}

function wireSearch(data){
  const input=$('#q'),list=$('#sugg');
  let sel=-1,items=[];
  const close=()=>{list.classList.remove('open');input.setAttribute('aria-expanded','false');sel=-1;};
  const render=()=>{
    const q=input.value.trim().toLowerCase();
    if(!q){close();return;}
    const starts=[],has=[];
    for(const g of data.guardians){
      const n=g.name.toLowerCase();
      if(n.startsWith(q)) starts.push(g);
      else if(n.includes(q)||g.team.toLowerCase().includes(q)||g.path.toLowerCase().includes(q)) has.push(g);
    }
    items=starts.concat(has).slice(0,8);
    sel=-1;
    list.innerHTML=items.length?items.map((g,i)=>`<li role="presentation"><a role="option" id="sg${i}" href="${charUrl(g)}" class="el-${g.element}">${avatar(g,26)}<span>${esc(g.name)}</span><small>${esc(g.team||g.element)}</small></a></li>`).join('')
      :`<li class="muted" style="padding:8px 10px">No Guardian matches “${esc(input.value)}”.</li>`;
    list.classList.add('open');input.setAttribute('aria-expanded','true');
  };
  const mark=()=>list.querySelectorAll('a').forEach((a,i)=>{a.setAttribute('aria-selected',i===sel);if(i===sel){input.setAttribute('aria-activedescendant',a.id);a.scrollIntoView({block:'nearest'});}});
  input.addEventListener('input',render);
  input.addEventListener('focus',()=>{if(input.value)render();});
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'&&items.length){e.preventDefault();sel=(sel+1)%items.length;mark();}
    else if(e.key==='ArrowUp'&&items.length){e.preventDefault();sel=(sel-1+items.length)%items.length;mark();}
    else if(e.key==='Escape'){close();}
    else if(e.key==='Enter'){
      const exact=data.guardians.find(g=>g.name.toLowerCase()===input.value.trim().toLowerCase());
      const pick=sel>=0?items[sel]:exact;
      if(pick){e.preventDefault();location.href=charUrl(pick);}
    }
  });
  document.addEventListener('click',e=>{if(!$('#searchform').contains(e.target))close();});
}

/* ---------- data ---------- */
async function getJSON(url,fallback){
  try{
    const r=await fetch(url,{cache:'no-cache'});
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return await r.json();
  }catch(e){
    if(fallback!==undefined) return fallback;
    throw e;
  }
}

function normalise(raw,config,lore){
  const hide=new Set([...(raw.hiddenFields||[]),...(config.hideFields||[])].map(s=>s.toLowerCase()));
  const loreBy={};
  for(const k of Object.keys(lore||{})) if(!k.startsWith('_')) loreBy[k.toLowerCase()]=lore[k];
  const used=new Set();
  const guardians=(raw.guardians||[]).map(r=>{
    const info={};
    for(const [k,v] of Object.entries(r.info||{})) if(!hide.has(k.toLowerCase())&&clean(v)) info[k]=String(v).trim();
    const path=clean(r.path);
    const segs=path?path.split('-').map(s=>s.trim()).filter(Boolean):[];
    let element=segs[0]||clean(r.element)||clean(info['Original Element'])||'';
    element=ELEMENTS.find(e=>e.toLowerCase()===element.toLowerCase())||'None';
    let id=slug(r.name);
    if(used.has(id)){let n=2;while(used.has(id+'-'+n))n++;id+='-'+n;}
    used.add(id);
    return {
      id,name:String(r.name).trim(),path,segs,element,
      rank:clean(r.rank)||clean(info['Guardian Rank']),
      mentor:clean(r.mentor),
      role:clean(r.role)||clean(info['Primary Role']),
      team:clean(r.team)||clean(info['Team']),
      guild:clean(r.guild)||clean(info['Guild']),
      zodiac:clean(r.zodiac)||clean(info['Zodiac']),
      base:clean(r.base)||clean(info['Based at']),
      status:clean(r.status).toLowerCase(),
      disciples:(r.disciples||[]).map(clean).filter(Boolean),
      sameAs:clean(r.sameAs),form:clean(r.form),
      noBranchReason:path?'':clean(r.reason),
      info,lore:loreBy[String(r.name).toLowerCase()]||{}
    };
  });
  const byName=new Map(guardians.map(g=>[g.name.toLowerCase(),g]));
  const byId=new Map(guardians.map(g=>[g.id,g]));
  // Reverse lookup: who lists this Guardian as a disciple.
  for(const g of guardians) g.mentors=[];
  for(const m of guardians) for(const d of m.disciples){
    const t=byName.get(stripParen(d).toLowerCase());
    if(t&&!t.mentors.includes(m)) t.mentors.push(m);
  }
  const names=guardians.map(g=>g.name).sort((a,b)=>b.length-a.length);
  const nameRe=names.length?new RegExp('\\b(?:Luma\\s+)?('+names.map(reEsc).join('|')+')\\b','g'):null;
  return {raw,config,guardians,byName,byId,nameRe,hide,zodiacRoots:raw.zodiacRoots||{}};
}

let DATA=null;
async function load(){
  if(DATA) return DATA;
  const config=await getJSON(BASE+'data/wiki.json',{});
  const [raw,lore,locations,chars]=await Promise.all([
    getJSON(new URL(config.dataUrl||'data/branches.json',BASE).href),
    getJSON(BASE+'data/lore.json',{}),
    getJSON(BASE+'data/locations.json',{places:[]}),
    getJSON(BASE+'data/characters/index.json',{characters:[]})
  ]);
  DATA=normalise(raw,config,lore);
  DATA.locations=locations;
  // Character files (data/characters/<name>.json) listed in the index, found by any of the character's names.
  DATA.profileFields=chars.fields||[];
  DATA.profiles=new Map();
  for(const c of chars.characters||[]) for(const n of c.names||[c.name]) DATA.profiles.set(String(n).toLowerCase(),c);
  for(const g of DATA.guardians){
    g.profileRef=DATA.profiles.get(g.name.toLowerCase())||null;
    g.portrait=g.profileRef&&g.profileRef.image||'';
  }
  return DATA;
}

// One character's full file, from an index entry.
function loadCharacter(ref){return ref?getJSON(BASE+'data/characters/'+ref.file,null):Promise.resolve(null);}
const asset=src=>src?new URL(src,BASE).href:'';

/* ---------- render helpers ---------- */
function charUrl(g){return BASE+'character.html?id='+encodeURIComponent(typeof g==='string'?slug(g):g.id);}
function initials(n){const p=String(n).replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/);return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase();}
function avatar(g,size,sq){
  const img=(g.lore&&g.lore.image)||g.portrait;
  return `<span class="ava${sq?' sq':''} el-${g.element}" style="--s:${size||56}px" aria-hidden="true">${img?`<img src="${esc(new URL(img,BASE).href)}" alt="" loading="lazy">`:esc(initials(g.name))}</span>`;
}
function subtitle(g){return [g.role,g.team].filter(Boolean).join(' · ')||g.rank||g.element;}
function card(g){
  const gone=g.status==='deceased'||g.status==='retired';
  return `<a class="ccard el-${g.element}${gone?' gone':''}" href="${charUrl(g)}">${avatar(g,48)}<span class="t"><b>${esc(g.name)}${g.status==='deceased'?' †':''}</b><small>${esc(subtitle(g))}</small></span></a>`;
}
function stub(name){
  return `<span class="ccard noprof el-None" title="No profile yet"><span class="ava el-None" style="--s:48px" aria-hidden="true">${esc(initials(name))}</span><span class="t"><b>${esc(name)}</b><small>No profile yet</small></span></span>`;
}
function statusPill(g){return g.status?`<span class="pill st-${esc(g.status)}">${esc(g.status[0].toUpperCase()+g.status.slice(1))}</span>`:'';}
// Escape text, then link every known Guardian name (with or without the "Luma" prefix).
function linkify(text,data,skip){
  let s=esc(text);
  if(!data.nameRe) return s;
  return s.replace(data.nameRe,(m,n)=>{
    const g=data.byName.get(n.toLowerCase());
    if(!g||(skip&&g===skip)) return m;
    return `<a href="${charUrl(g)}">${m}</a>`;
  });
}
// Tiny markup for lore.json: blank line = paragraph, "- " = list item, **bold**, *italic*, [[Name]] or [[Name|label]].
function markup(text,data){
  const inline=t=>esc(t)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(m,n,l)=>{const g=data.byName.get(n.trim().toLowerCase());return g?`<a href="${charUrl(g)}">${l||n}</a>`:(l||n);})
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  const src=Array.isArray(text)?text.map(t=>'- '+t).join('\n'):String(text||'');
  return src.split(/\n\s*\n/).map(block=>{
    const lines=block.split('\n').filter(l=>l.trim());
    if(lines.length&&lines.every(l=>/^\s*[-*]\s+/.test(l))) return '<ul>'+lines.map(l=>'<li>'+inline(l.replace(/^\s*[-*]\s+/,''))+'</li>').join('')+'</ul>';
    return '<p>'+lines.map(inline).join('<br>')+'</p>';
  }).join('');
}
function params(){return new URLSearchParams(location.search);}
function pickDaily(list){
  if(!list.length) return null;
  const d=new Date();const k=d.getFullYear()*1000+Math.floor((d-new Date(d.getFullYear(),0,0))/864e5);
  return list[k%list.length];
}

async function boot(active){
  chrome(active);
  const main=$('#main');
  try{
    const data=await load();
    wireSearch(data);
    return data;
  }catch(e){
    if(!main) throw e;
    main.innerHTML=`<div class="err"><b>Could not load the Guardian data.</b><br>${esc(e.message)}<br><span class="muted">If you opened this file by double-click, run a local server instead (see wiki/README.md). On GitHub Pages it loads on its own.</span></div>`;
    throw e;
  }
}

window.Wiki={ELEMENTS,boot,load,loadCharacter,asset,getJSON,esc,slug,clean,groupKey,stripParen,charUrl,avatar,card,stub,statusPill,linkify,markup,glyph,params,pickDaily,subtitle,isDark,lsGet,lsSet,$};
})();
