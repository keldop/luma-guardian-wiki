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
// "Label: value" profile lines, bold or not. Group 1 = label, group 2 = value.
const FIELD=/^\s*(?:\*\*)?([A-Z][A-Za-z /'&,.-]{0,40}?(?:\s*\([^)]*\))?)\s*:\s*(?:\*\*)?\s*(.*?)\s*$/;
const emptyVal=v=>!v.replace(/\*\*/g,'').replace(/\\/g,'').trim()||/^[-–—]+$/.test(v.replace(/[*\\\s]/g,''));
function tidy(md){
  const lines=md.split('\n').map(l=>{
    const m=l.match(/^(#{1,6})\s+(.*)$/);
    if(m){const t=cleanHeading(m[2]);return t?m[1]+' '+t:'';}
    if(/^\s*\\?-{3,}\s*$/.test(l)) return '\n---\n';
    return l;
  });
  const out=[];
  for(let i=0;i<lines.length;i++){
    const f=lines[i].match(FIELD);
    if(!f||/^https?$/i.test(f[1])){out.push(lines[i]);continue;}
    if(emptyVal(f[2])){
      // An empty label is kept only when text follows it (like "Personality:" then a paragraph).
      let j=i+1;while(j<lines.length&&!lines[j].trim()) j++;
      const next=lines[j]||'';
      if(!next||/^#/.test(next)||FIELD.test(next)) continue;
      out.push(`**${f[1]}:**`,'');continue;
    }
    // One field per paragraph, label in bold.
    out.push(`**${f[1]}:** ${f[2].replace(/^\*\*\s*/,'')}`,'');
  }
  return out.join('\n');
}

let STORY=null;
async function load(){
  if(STORY) return STORY;
  const r=await fetch('data/story.md',{cache:'no-cache'});
  if(!r.ok) throw new Error('data/story.md: '+r.status);
  const text=(await r.text()).replace(/\r\n?/g,'\n');
  // From the characters doc: the teams, and tabs without write-ups (Civilians), built by tools/build-characters.ps1.
  let people={teams:[],tabs:[]};
  try{const p=await fetch('data/people.json',{cache:'no-cache'});if(p.ok) people=await p.json();}catch(e){}
  const parts=text.split(/^<!--\s*tab:\s*(.*?)\s*-->\s*$/m);
  const tabs=[],used=new Set();
  for(let i=1;i<parts.length;i+=2){
    const title=parts[i].trim();
    let slug=W.slug(title)||'tab';
    while(used.has(slug)) slug+='-2';
    used.add(slug);
    tabs.push({title,slug,md:tidy(parts[i+1]||'')});
  }
  for(const t of people.tabs||[]){
    let slug=W.slug(t.title)||'tab';
    while(used.has(slug)) slug+='-2';
    used.add(slug);
    tabs.push({title:t.title,slug,md:tidy(t.md||'')});
  }
  STORY={tabs,teams:people.teams||[],civilians:people.civilians||[],bySlug:new Map(tabs.map(t=>[t.slug,t])),byTitle:new Map(tabs.map(t=>[t.title.toLowerCase(),t]))};
  return STORY;
}

/* ---------- Lore articles (data/lore-layout.json) ---------- */
const headLevels=md=>(md.match(/^#{1,6}(?=\s)/gm)||[]).map(h=>h.length);
// Move every heading so the highest one sits at level `top`.
function shiftTo(md,top){
  const ls=headLevels(md);if(!ls.length) return md;
  const d=top-Math.min(...ls);
  return d?md.replace(/^(#{1,6})(\s)/gm,(m,h,s)=>'#'.repeat(Math.max(1,Math.min(6,h.length+d)))+s):md;
}
// Drop a leading heading that only repeats the article or tab name, unless other headings sit
// at its level (then it is a real section, like "# Artefacts" next to "# Planned Artefact").
function dropTitle(md,title){
  const m=md.match(/^\s*(#{1,6})\s+(.*)\n?/);
  if(!m||W.slug(m[2])!==W.slug(title)) return md;
  const rest=md.slice(m[0].length);
  return headLevels(rest).some(l=>l<=m[1].length)?md:rest;
}
// One heading of a tab and everything under it, up to the next heading at the same level or higher.
function sectionOf(tab,name){
  const lines=tab.md.split('\n'),want=W.slug(name);
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^(#{1,6})\s+(.*)$/);
    if(!m||W.slug(m[2])!==want) continue;
    let j=i+1;
    while(j<lines.length){const h=lines[j].match(/^(#{1,6})\s/);if(h&&h[1].length<=m[1].length) break;j++;}
    return {title:m[2],md:lines.slice(i+1,j).join('\n')};
  }
  return null;
}

let LORE=null;
async function loadLore(){
  if(LORE) return LORE;
  const story=await load();
  let layout=null;
  try{const r=await fetch('data/lore-layout.json',{cache:'no-cache'});if(r.ok) layout=await r.json();}catch(e){}
  layout=layout||{groups:[]};
  // Teams and civilian groups come ready-made from people.json (built from the characters doc).
  const tidyGroups=list=>(list||[]).map(t=>({...t,intro:t.intro||'',members:t.members||[]}));
  const dirs={teams:tidyGroups(story.teams),civilians:tidyGroups(story.civilians)};
  const teams=dirs.teams;
  const usedTabs=new Set();
  const articles=[],bySlug=new Map(),fromTab=new Map();

  const build=(a,group)=>{
    const parts=[];let special='';
    for(const p of a.parts||[]){
      if(dirs[p.special]){
        // Directory pages; this text is only used by the Lore search.
        special=p.special;
        const pre=special==='teams'?'Luma ':'';
        parts.push({title:'',md:dirs[special].map(g=>`## ${g.name}\n\n${g.base?'Based in '+g.base+'.\n\n':''}${g.intro.trim()}${g.members.length?`\n\nMembers: ${g.members.map(n=>pre+n).join(', ')}`:''}`).join('\n\n')});
        continue;
      }
      const tab=story.byTitle.get(String(p.tab||'').toLowerCase());if(!tab) continue;
      usedTabs.add(tab.title.toLowerCase());
      if(!fromTab.has(tab.slug)) fromTab.set(tab.slug,a.slug);
      const sec=p.section?sectionOf(tab,p.section):{title:p.title||tab.title,md:dropTitle(tab.md,tab.title)};
      if(sec&&sec.md.trim()) parts.push({title:p.title||sec.title,md:sec.md.trim()});
    }
    if(!parts.length) return;
    const md=special||parts.length===1?shiftTo(dropTitle(parts[0].md,a.title),2)
      :parts.map(p=>`## ${p.title}\n\n${shiftTo(p.md,3)}`).join('\n\n');
    const art={slug:a.slug||W.slug(a.title),title:a.title,group,md,special};
    articles.push(art);bySlug.set(art.slug,art);group.articles.push(art);
  };

  const groups=[];
  for(const g of layout.groups||[]){
    const group={title:g.title,blurb:g.blurb||'',articles:[]};
    for(const a of g.articles||[]) build(a,group);
    if(group.articles.length) groups.push(group);
  }
  // Doc tabs nobody placed yet, so a new tab in the doc still shows up.
  const rest={title:'More from the story',blurb:'Other parts of the story.',articles:[]};
  for(const t of story.tabs) if(!usedTabs.has(t.title.toLowerCase())) build({slug:t.slug,title:t.title,parts:[{tab:t.title}]},rest);
  if(rest.articles.length) groups.push(rest);
  // Old links (lore.html?tab=characters) land on the team directory.
  if(bySlug.has('teams')) for(const t of layout.characterTabs||[]) fromTab.set(W.slug(t),'teams');

  LORE={story,groups,articles,bySlug,fromTab,teams,dirs};
  return LORE;
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

window.Story={load,loadLore,render,libs,cleanHeading};
})();
