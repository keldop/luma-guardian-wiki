/* Create a character: pick Guardian or Civilian, fill in the template (data/templates.json),
   then Generate shows the character file (JSON) and a doc copy side by side, ready to copy.
   The form is saved in this browser as a draft. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('create');
const main=document.getElementById('main');
const templates=await W.getJSON('data/templates.json',null);
if(!templates){main.innerHTML='<div class="err"><b>data/templates.json could not be loaded.</b></div>';return;}

const TYPES=['guardian','civilian'].filter(t=>templates[t]);
const DRAFT='luma.create.draft.v1';
let draft={};
try{draft=JSON.parse(W.lsGet(DRAFT)||'{}')||{};}catch(e){draft={};}
let type=TYPES.includes(W.params().get('type'))?W.params().get('type'):(draft.type&&TYPES.includes(draft.type)?draft.type:'');
let generated=false;

const fid=label=>'f-'+W.slug(label);
// "options" is either a list, or the name of a shared list in templates.json ("countries").
const optionsOf=f=>Array.isArray(f.options)?f.options:(typeof f.options==='string'&&templates.lists&&templates.lists[f.options])||[];
const T=()=>templates[type];
const values=()=>((draft.values=draft.values||{})[type]=draft.values[type]||{});
const save=()=>{draft.type=type;W.lsSet(DRAFT,JSON.stringify(draft));};

/* ---------- page ---------- */
main.innerHTML=`
<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><span>Create a character</span></div>
<h1 style="font-size:30px;margin-bottom:6px">Create a character</h1>
<p class="muted" style="margin:0 0 18px;max-width:70ch">Fill in the profile template, then press <b>Generate</b>. You get the character file for the wiki and a copy laid out like the story doc, side by side. Your answers are kept in this browser until you clear them.</p>
<h2 class="cr-step"><span>1</span> What kind of character?</h2>
<div class="cr-types" role="radiogroup" aria-label="Character type">${TYPES.map(t=>`
  <label class="cr-type"><input type="radio" name="ctype" value="${t}"${t===type?' checked':''}>
    <b>${esc(templates[t].title)}</b><span>${esc(templates[t].description||'')}</span></label>`).join('')}
</div>
<div id="formwrap"></div>
<div id="outwrap"></div>`;

main.querySelectorAll('input[name=ctype]').forEach(r=>r.addEventListener('change',()=>{type=r.value;generated=false;save();renderForm();document.getElementById('outwrap').innerHTML='';}));

/* ---------- form ---------- */
function fieldHtml(f){
  const v=values()[f.label];
  const id=fid(f.label);
  const priv=f.private?' <span class="pill cr-priv" title="Shown in the doc copy only, never in the public JSON">Private</span>':'';
  const hint=f.hint?`<small class="cr-hint">${esc(f.hint)}</small>`:'';
  let input;
  if(f.type==='long'){
    input=`<textarea id="${id}" data-label="${esc(f.label)}" rows="4">${esc(v===undefined?(f.default||''):v)}</textarea>`;
  }else if(f.type==='multi'){
    const set=new Set(Array.isArray(v)?v:[]);
    input=`<div class="cr-checks" id="${id}" data-label="${esc(f.label)}" data-kind="multi">${optionsOf(f).map(o=>`<label><input type="checkbox" value="${esc(o)}"${set.has(o)?' checked':''}> ${esc(o)}</label>`).join('')}</div>`;
  }else if(f.type==='select'){
    // Fixed choices only: nothing outside the list can be entered.
    input=`<select id="${id}" data-label="${esc(f.label)}"><option value="">Choose…</option>${optionsOf(f).map(o=>`<option${o===v?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
  }else if(f.type==='date'){
    // Day, month and year dropdowns. Years run from minYear (1990) to maxYear or this year, newest first.
    const p=parseDate(v),max=f.maxYear||new Date().getFullYear(),min=f.minYear||1900;
    const years=[];for(let y=max;y>=min;y--) years.push(y);
    const sel=(part,label,opts)=>`<select${part==='d'?` id="${id}"`:''} data-part="${part}" aria-label="${label}"><option value="">${label}</option>${opts.map(([val,txt])=>`<option value="${val}"${String(p[part])===String(val)?' selected':''}>${txt}</option>`).join('')}</select>`;
    input=`<div class="cr-date" data-label="${esc(f.label)}" data-kind="date">
      ${sel('d','Day',Array.from({length:31},(_,i)=>[i+1,i+1]))}
      ${sel('m','Month',MONTHS.map((m,i)=>[i+1,m]))}
      ${sel('y','Year',years.map(y=>[y,y]))}</div>`;
  }else if(f.type==='list'){
    const items=Array.isArray(v)&&v.length?v:[''];
    input=`<div class="cr-list" id="${id}" data-label="${esc(f.label)}" data-kind="list">${items.map(x=>listRow(x)).join('')}<button type="button" class="btn cr-add">+ Add another</button></div>`;
  }else{
    const dl=optionsOf(f).length?`<datalist id="${id}-o">${optionsOf(f).map(o=>`<option value="${esc(o)}">`).join('')}</datalist>`:'';
    const pre=v===undefined&&f.label===T().nameField?T().namePrefix:(v||'');
    input=`<input type="text" id="${id}" data-label="${esc(f.label)}" value="${esc(pre)}"${dl?` list="${id}-o"`:''} autocomplete="off">${dl}`;
  }
  return `<div class="cr-field${f.type==='long'||f.type==='list'||f.type==='multi'?' wide':''}"><label for="${id}">${esc(f.label)}${priv}</label>${input}${hint}</div>`;
}
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
// "30 November 2000" (or "November 2000", or "2000") -> {d:30, m:11, y:2000}
function parseDate(s){
  const out={d:'',m:'',y:''};
  for(const w of String(s||'').trim().split(/\s+/)){
    const mi=MONTHS.findIndex(m=>m.toLowerCase().startsWith(w.toLowerCase().slice(0,3))&&w.length>=3);
    if(mi>=0) out.m=mi+1; else if(/^\d{4}$/.test(w)) out.y=+w; else if(/^\d{1,2}$/.test(w)) out.d=+w;
  }
  return out;
}
// Days that do not exist in the chosen month (31 April, 29 February outside leap years) are turned off.
function fixDays(box){
  const d=box.querySelector('[data-part=d]'),m=+box.querySelector('[data-part=m]').value,y=+box.querySelector('[data-part=y]').value||2000;
  const last=m?new Date(y,m,0).getDate():31;
  [...d.options].forEach(o=>{if(o.value) o.disabled=+o.value>last;});
  // Remember the day that was picked, so 30 January -> February (28) -> November gives 30 November again.
  const want=+(box.dataset.want||d.value)||0;
  if(want>last){box.dataset.want=want;d.value=String(last);}
  else{if(want) d.value=String(want);delete box.dataset.want;}
}
const listRow=x=>`<div class="cr-row"><input type="text" value="${esc(x)}" aria-label="Item"><button type="button" class="cr-del" aria-label="Remove item">×</button></div>`;

function renderForm(){
  const wrap=document.getElementById('formwrap');
  if(!type){wrap.innerHTML='';return;}
  const sections=[];
  for(const f of T().fields){let s=sections.find(x=>x.name===f.section);if(!s) sections.push(s={name:f.section||'Details',fields:[]});s.fields.push(f);}
  wrap.innerHTML=`<h2 class="cr-step"><span>2</span> Fill in the ${esc(T().title.toLowerCase())} profile</h2>
    <p class="muted" style="margin:-4px 0 14px">Leave anything you have not decided yet empty. Only <b>${esc(T().nameField)}</b> is needed.</p>
    <form id="crform" autocomplete="off">${sections.map((s,i)=>`
      <details class="cr-sec"${i<2||s.fields.some(f=>has(values()[f.label]))?' open':''}><summary>${esc(s.name)} <small>${s.fields.length} field${s.fields.length>1?'s':''}</small></summary>
        <div class="cr-grid">${s.fields.map(fieldHtml).join('')}</div>
      </details>`).join('')}
      <div class="cr-bar">
        <button type="submit" class="btn primary">Generate</button>
        <button type="button" class="btn" id="crclear">Clear this form</button>
        <span class="cr-msg" id="crmsg" role="status"></span>
      </div>
    </form>`;
  const form=document.getElementById('crform');
  // Picking a day by hand replaces any remembered day.
  form.querySelectorAll('.cr-date [data-part=d]').forEach(s=>s.addEventListener('change',()=>delete s.parentElement.dataset.want));
  form.querySelectorAll('.cr-date').forEach(fixDays);
  form.addEventListener('input',()=>{read();if(generated) renderOut();});
  form.addEventListener('change',()=>{read();if(generated) renderOut();});
  form.addEventListener('click',e=>{
    if(e.target.classList.contains('cr-add')){e.target.insertAdjacentHTML('beforebegin',listRow(''));e.target.previousElementSibling.querySelector('input').focus();}
    if(e.target.classList.contains('cr-del')){const list=e.target.closest('.cr-list');e.target.parentElement.remove();if(!list.querySelector('.cr-row')) list.querySelector('.cr-add').insertAdjacentHTML('beforebegin',listRow(''));read();if(generated) renderOut();}
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();read();
    const name=nameOf();
    const msg=document.getElementById('crmsg');
    if(!name){msg.textContent=`Add a ${T().nameField} first.`;document.getElementById(fid(T().nameField)).focus();return;}
    msg.textContent='';generated=true;renderOut();
    document.getElementById('outwrap').scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.getElementById('crclear').addEventListener('click',()=>{
    if(!confirm(`Clear every field of this ${T().title.toLowerCase()} form?`)) return;
    draft.values[type]={};save();generated=false;renderForm();document.getElementById('outwrap').innerHTML='';
  });
}

function read(){
  const v=values();
  document.querySelectorAll('#crform [data-label]').forEach(el=>{
    const k=el.dataset.label;
    if(el.dataset.kind==='multi') v[k]=[...el.querySelectorAll('input:checked')].map(x=>x.value);
    else if(el.dataset.kind==='list') v[k]=[...el.querySelectorAll('.cr-row input')].map(x=>x.value);
    else if(el.dataset.kind==='date'){
      fixDays(el);
      const g=p=>el.querySelector(`[data-part=${p}]`).value;
      v[k]=[g('d'),g('m')?MONTHS[g('m')-1]:'',g('y')].filter(Boolean).join(' ');
    }
    else v[k]=el.value;
  });
  save();
}
const has=v=>Array.isArray(v)?v.some(x=>String(x).trim()):!!String(v||'').trim();
const val=(f)=>{const v=values()[f.label];if(f.type==='list') return (Array.isArray(v)?v:[]).map(x=>x.trim()).filter(Boolean);if(f.type==='multi') return Array.isArray(v)?v:[];
  // "<Guardian Name> Star Power—" becomes "Blossom Star Power—" once a name is filled in.
  const s=String(v||'').trim();return f.label===T().nameField||!nameOf()?s:s.replace(/<Guardian Name>/g,nameOf());};
function nameOf(){
  const raw=String(values()[T().nameField]||'').trim();
  const pre=T().namePrefix.trim();
  const n=pre&&raw.toLowerCase().startsWith(pre.toLowerCase())?raw.slice(pre.length).trim():raw;
  return n;
}

/* ---------- output ---------- */
function buildJson(){
  const t=T(),name=nameOf();
  const profile={};
  for(const f of t.fields){
    if(f.private) continue;
    const v=val(f);
    profile[f.label]=f.type==='list'?v:f.type==='multi'?v.join(', '):(f.label===t.nameField&&t.namePrefix&&v&&!v.toLowerCase().startsWith(t.namePrefix.trim().toLowerCase())?t.namePrefix+v:v);
  }
  const evolved=String(profile['Evolved Guardian Name']||'').replace(/^Luma\s+/i,'').trim();
  return {
    name,names:evolved?[name,evolved]:[name],type,
    group:profile.Team||'',base:profile['Stationed at']||'',tab:type==='civilian'?'Civilians':'',
    profile,other:{},image:'',gallery:[]
  };
}
// The doc copy: same order and labels as the template, ready to paste into the story doc.
function docParts(includeEmpty){
  const t=T(),out=[];
  for(const f of t.fields){
    const v=val(f);
    if(!has(v)&&!includeEmpty) continue;
    if(f.type==='list') out.push({label:f.label,list:v});
    else if(f.type==='long') out.push({label:f.label,block:v});
    else out.push({label:f.label,text:f.type==='multi'?v.join(', '):(f.label===t.nameField&&t.namePrefix&&v&&!v.toLowerCase().startsWith(t.namePrefix.trim().toLowerCase())?t.namePrefix+v:v)});
  }
  return out;
}
function docHeading(){const t=T();return (t.namePrefix||'')+nameOf();}
function docHtml(includeEmpty){
  const p=docParts(includeEmpty);
  return `<h2><b>${esc(docHeading())}</b></h2>`+p.map(x=>{
    if(x.list) return `<p><b>${esc(x.label)}:</b></p>${x.list.length?`<ul>${x.list.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}`;
    if(x.block!==undefined) return `<p><b>${esc(x.label)}:</b></p>${x.block.split(/\n+/).filter(s=>s.trim()).map(s=>`<p>${esc(s)}</p>`).join('')}`;
    return `<p><b>${esc(x.label)}:</b> ${esc(x.text)}</p>`;
  }).join('');
}
function docText(includeEmpty){
  const p=docParts(includeEmpty);
  return docHeading()+'\n\n'+p.map(x=>{
    if(x.list) return `${x.label}:\n`+x.list.map(i=>'- '+i).join('\n');
    if(x.block!==undefined) return `${x.label}:\n`+x.block.split(/\n+/).filter(s=>s.trim()).join('\n\n');
    return `${x.label}: ${x.text}`;
  }).join('\n\n')+'\n';
}

function renderOut(){
  const wrap=document.getElementById('outwrap');
  const includeEmpty=!!draft.includeEmpty;
  const j=buildJson();
  const json=JSON.stringify(j,null,1);
  const file=W.slug(j.name)+'.json';
  const priv=T().fields.filter(f=>f.private).map(f=>f.label);
  wrap.innerHTML=`<h2 class="cr-step"><span>3</span> Copy your character</h2>
  <label class="cr-opt"><input type="checkbox" id="cremp"${includeEmpty?' checked':''}> Include empty fields in the doc copy (matches the template exactly)</label>
  <div class="cr-out">
    <section class="cr-pane">
      <header><h3>JSON</h3><div><button type="button" class="btn" id="cpjson">Copy</button><button type="button" class="btn" id="dljson">Download</button></div></header>
      <p class="muted cr-note">Save as <code>wiki/data/characters/${esc(file)}</code>.${priv.length?` ${esc(priv.join(', '))} ${priv.length>1?'are':'is'} left out because the wiki is public.`:''}</p>
      <pre class="cr-code" tabindex="0"><code>${esc(json)}</code></pre>
    </section>
    <section class="cr-pane">
      <header><h3>Doc</h3><div><button type="button" class="btn" id="cpdoc">Copy for Google Docs</button><button type="button" class="btn" id="cptxt">Copy as text</button></div></header>
      <p class="muted cr-note">Paste under the right team heading in the story doc. Bold labels are kept when pasting into Google Docs.</p>
      <div class="cr-doc prose" tabindex="0">${docHtml(includeEmpty)}</div>
    </section>
  </div>`;
  document.getElementById('cremp').addEventListener('change',e=>{draft.includeEmpty=e.target.checked;save();renderOut();});
  const done=(b,ok)=>{const t=b.textContent;b.textContent=ok?'Copied':'Copy failed';setTimeout(()=>b.textContent=t,1500);};
  document.getElementById('cpjson').onclick=e=>copy(json).then(ok=>done(e.target,ok));
  document.getElementById('cptxt').onclick=e=>copy(docText(!!draft.includeEmpty)).then(ok=>done(e.target,ok));
  document.getElementById('cpdoc').onclick=e=>copy(docText(!!draft.includeEmpty),docHtml(!!draft.includeEmpty)).then(ok=>done(e.target,ok));
  document.getElementById('dljson').onclick=()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'}));
    a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
}

// Copy plain text, plus formatted HTML when given (so Google Docs keeps the bold labels).
async function copy(text,html){
  try{
    if(html&&window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
      await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);
      return true;
    }
    await navigator.clipboard.writeText(text);return true;
  }catch(e){
    // Older browsers: select a hidden copy and use the old copy command.
    const box=document.createElement(html?'div':'textarea');
    if(html){box.innerHTML=html;box.contentEditable='true';}else box.value=text;
    box.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(box);
    const r=document.createRange();
    if(html){r.selectNodeContents(box);const s=getSelection();s.removeAllRanges();s.addRange(r);}else box.select();
    let ok=false;try{ok=document.execCommand('copy');}catch(_){}
    box.remove();return ok;
  }
}

renderForm();
})();
