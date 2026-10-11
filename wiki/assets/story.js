/* Story bible: reads wiki/data/story.md (made by tools/update-story.ps1 from the Google Doc),
   splits it into one article per doc tab, and finds each Guardian's own section. */
(function(){
"use strict";
const W=window.Wiki;
const MARKED='https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js';
const PURIFY='https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js';

function loadScript(src){
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.append(s);});
}
let libsP=null;
function libs(){return libsP||(libsP=Promise.all([window.marked?0:loadScript(MARKED),window.DOMPurify?0:loadScript(PURIFY)]));}

// Google Docs Markdown quirks: bold inside headings, escaped divider lines.
const cleanHeading=t=>t.replace(/\\-{3,}/g,'').replace(/\*\*/g,'').replace(/~~/g,'').replace(/\\([\[\]()*_#-])/g,'$1').replace(/\s+/g,' ').trim();
function tidy(md){
  return md.split('\n').map(l=>{
    const m=l.match(/^(#{1,6})\s+(.*)$/);
    if(m){const t=cleanHeading(m[2]);return t?m[1]+' '+t:'';}
    if(/^\s*\\?-{3,}\s*$/.test(l)) return '\n---\n';
    return l;
  }).join('\n');
}

let STORY=null;
async function load(){
  if(STORY) return STORY;
  const r=await fetch('data/story.md',{cache:'no-cache'});
  if(!r.ok) throw new Error('data/story.md: '+r.status);
  const text=(await r.text()).replace(/\r\n?/g,'\n');
  const parts=text.split(/^<!--\s*tab:\s*(.*?)\s*-->\s*$/m);
  const tabs=[],used=new Set();
  for(let i=1;i<parts.length;i+=2){
    const title=parts[i].trim();
    let slug=W.slug(title)||'tab';
    while(used.has(slug)) slug+='-2';
    used.add(slug);
    tabs.push({title,slug,md:tidy(parts[i+1]||'')});
  }
  // One section per "Luma <Name>" heading. "Luma Flora / Luma EmberFlora" files under both names.
  const chars=new Map();
  for(const tab of tabs){
    const lines=tab.md.split('\n');
    for(let i=0;i<lines.length;i++){
      const m=lines[i].match(/^(#{1,3})\s+(.*)$/);
      if(!m) continue;
      const names=m[2].replace(/\(.*?\)/g,'').split('/').map(s=>(s.trim().match(/^Luma\s+(\S.*)$/i)||[])[1]).filter(Boolean).map(s=>s.trim());
      if(!names.length) continue;
      let j=i+1;
      while(j<lines.length){const h=lines[j].match(/^(#{1,6})\s/);if(h&&h[1].length<=m[1].length) break;j++;}
      const sec={tab,title:m[2],md:lines.slice(i+1,j).join('\n'),level:m[1].length};
      for(const n of names) if(!chars.has(n.toLowerCase())) chars.set(n.toLowerCase(),sec);
    }
  }
  STORY={tabs,chars,bySlug:new Map(tabs.map(t=>[t.slug,t]))};
  return STORY;
}

/* Render Markdown to a sanitised element. shift moves headings down (# becomes h2 when shift=1). */
async function render(md,data,opt){
  opt=opt||{};
  await libs();
  const shift=opt.shift||0;
  const src=shift?md.replace(/^(#{1,6})(\s)/gm,(m,h,s)=>'#'.repeat(Math.max(1,Math.min(6,h.length+shift)))+s):md;
  const box=document.createElement('div');
  box.innerHTML=DOMPurify.sanitize(marked.parse(src,{gfm:true,breaks:false}));
  // Heading ids, deduplicated.
  const used=new Set(opt.usedIds||[]);
  box.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{
    let id=(opt.idPrefix||'')+(W.slug(h.textContent)||'section'),n=id,k=2;
    while(used.has(n)) n=id+'-'+(k++);
    used.add(n);h.id=n;
  });
  box.querySelectorAll('a[href^="http"]').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
  if(data) linkNames(box,data);
  return box;
}

// Turn "Luma <Name>" in plain text into links to that Guardian's page.
function linkNames(root,data){
  const names=[...data.byName.keys()].sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!names.length) return;
  const re=new RegExp('\\bLuma\\s+('+names.join('|')+')\\b','gi');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('a,code,pre,h1,h2,h3,h4,h5,h6')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[];while(walker.nextNode()) nodes.push(walker.currentNode);
  for(const t of nodes){
    re.lastIndex=0;
    if(!re.test(t.data)) continue;
    re.lastIndex=0;
    const frag=document.createDocumentFragment();let last=0,m;
    while((m=re.exec(t.data))){
      const g=data.byName.get(m[1].toLowerCase());
      frag.append(t.data.slice(last,m.index));
      const a=document.createElement('a');a.href=W.charUrl(g);a.textContent=m[0];frag.append(a);
      last=m.index+m[0].length;
    }
    frag.append(t.data.slice(last));
    t.replaceWith(frag);
  }
}

window.Story={load,render,libs,cleanHeading};
})();
