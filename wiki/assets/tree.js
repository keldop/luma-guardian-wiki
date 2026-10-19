/* Branch tree: draws the Element > Branch > Sub-branch diagrams from data/branches.json. Colours live in tree-colors.css. */
// ==CORE==
const ELEMENTS=['Fire','Earth','Water','Air'];
const LABELS={'guardian name':'name','original guardian name':'name','evolved guardian name':'evolved','original element':'origEl','inherited element':'inhEl','branch theme':'branch','guardian rank':'rank','mentor':'mentor','primary role':'role','team':'team','guild':'guild','zodiac':'zodiac','disciple':'disciples','disciples':'disciples','based at':'base','base':'base','stationed at':'base','status':'status'};
const BLANK='Unknown';
const FULL_LABELS=new Map(['Age','Gender','Sexuality','Home Country','Hometown','Languages','Education','Appearance','Signature Ability','Weapon','Strengths','Weaknesses','Fear','Likes','Dislikes','Hobbies','MBTI','Catchphrase','Rivals','Theme Song','Zodiac','Ethnicity','Nickname','Awakening Type','Original Element','Inherited Element','Branch Theme','Transformation Item','Guardian Rank','Primary Role','Likely Primary Role','Possible Future Role','Passed Tests','Power Color','Artefact','Artefact (Planned)','Team','Guild','Awakened Date','Awakened By','Full-Fledged Date','Relationship','Family','Close bonds','Personality','Spirit Animal','Civilian Occupation','Civilian Occupation (To be)','Quotes','Date of Birth','Civilian Name','Height','Weight','Breast Size','Ding Dong Size','Blood Type'].map(x=>[x.toLowerCase(),x]));
const DEFAULT_HIDDEN=['Breast Size','Ding Dong Size'];
let HIDDEN=new Set(DEFAULT_HIDDEN.map(x=>x.toLowerCase()));
function setHidden(list){HIDDEN=new Set((list||[]).map(x=>String(x).toLowerCase()));}
const FALLBACK_CONFIG={hiddenFields:DEFAULT_HIDDEN,guardians:[],overrides:['Earth-Soil-Verdant => Earth-Life-Verdant'],zodiacRoots:{},branches:[]};
function norm(s){return s.replace(/[\u2013\u2014\u2212\u2010\u2011]/g,'-').replace(/\u00a0/g,' ').replace(/\\(.)/g,'$1').replace(/\*/g,'').replace(/~~/g,'').trim();}
function capEl(s){if(!s)return null;return ELEMENTS.find(x=>x.toLowerCase()===s.trim().toLowerCase())||null;}
function segs(s){return s.split('-').map(x=>x.trim()).filter(Boolean);}
function stripLuma(n){n=(n||'').replace(/^luma\s*/i,'').trim();return n||'(unnamed)';}
function parseEntries(text){
  const recs=[];let cur=null,pendCiv='',pendNick='',pendOpen=false;
  for(const raw of text.split(/\r?\n/)){
    const l=norm(raw).replace(/^[-\u2022]\s+/,'');
    const m=l.match(/^([A-Za-z][A-Za-z ]{2,28}?)\s*:\s*(.*)$/);
    if(!m)continue;
    const lc=m[1].trim().toLowerCase();
    const key=LABELS[lc],canon=FULL_LABELS.get(lc==='awakened by'?'awakened by':lc);
    if(!key&&!canon)continue;
    const val=m[2].trim();
    if(canon==='Civilian Name'){pendCiv=(val&&!/^-+$/.test(val))?val.slice(0,200):'';pendNick='';pendOpen=true;continue;}
    if(canon==='Nickname'&&pendOpen){pendNick=(val&&!/^-+$/.test(val))?val.slice(0,700):'';continue;}
    if(key==='name'){cur={names:[val],f:{},info:{}};if(pendCiv)cur.info['Civilian Name']=pendCiv;if(pendNick)cur.info['Nickname']=pendNick;pendCiv='';pendNick='';pendOpen=false;recs.push(cur);continue;}
    if(key==='evolved'){if(cur)cur.names.push(val);continue;}
    if(key&&cur&&!(key in cur.f))cur.f[key]=val;
    if(canon&&cur&&val&&!/^-+$/.test(val)&&!HIDDEN.has(canon.toLowerCase())&&!(canon in cur.info))cur.info[canon]=val.slice(0,700);
  }
  const out=[],seen=new Set();
  for(const r of recs){
    let braw=(r.f.branch||'').trim();
    const dash=/^-+$/.test(braw);
    if(dash)braw='';
    const orig=(r.f.origEl||'').trim();
    let reason='';
    if(!braw){
      if(orig.includes('-'))braw=orig;
      else reason=dash?'Branch listed as a dash':'Branch left blank';
    }
    const parts=braw?braw.split('/').map(x=>x.trim()):[];
    const p0=parts.length?segs(parts[0]):[];
    const origEl=capEl(segs(orig)[0]||'');
    r.names.forEach((nm,i)=>{
      let path=p0;
      if(i>0&&parts[i])path=parts[i].includes('-')?segs(parts[i]):p0.slice(0,-1).concat(parts[i]);
      path=path.slice();
      const pathEl=path.length?capEl(path[0]):null;
      let kind='branch',element=pathEl||origEl;
      if(!path.length){kind='none';}
      else if(!pathEl){kind='none';reason='Unrecognised element "'+path[0]+'"';element=origEl;path=[];}
      else{path[0]=pathEl;if(path.length===1)kind='root';}
      let name=stripLuma(nm);
      if(name==='(unnamed)'&&kind==='branch'&&/-\s*$/.test(braw)){name='Unnamed';path=path.concat('Unnamed');}
      const key=name.toLowerCase()+'|'+path.join('-').toLowerCase();
      if(seen.has(key)&&name!=='(unnamed)')return;
      seen.add(key);
      const dis=[];
      const noDisc=!!(r.f.disciples&&/\b(no|none|n\/a|nil|not)\b/i.test(r.f.disciples)&&!/Luma\s+[A-Za-z]/.test(r.f.disciples));
      if(r.f.disciples){for(const t of r.f.disciples.split(/[,;]/)){const mm=t.trim().match(/^Luma\s+([A-Za-z]+)$/);if(mm)dis.push(mm[1]);}}
      out.push({name,names:r.names.map(stripLuma),path,kind,element,origEl,reason:kind==='none'?(reason||'Branch left blank'):'',
        rank:r.f.rank||'',sameAs:r.names.length>1?stripLuma(i===0?r.names[1]:r.names[0]):'',form:r.names.length>1?(i===0?'original':'evolved'):'',mentor:r.f.mentor||'',role:r.f.role||'',team:r.f.team||'',guild:r.f.guild||'',zodiac:r.f.zodiac||'',base:r.f.base||'',status:statusOf(r.f.status),info:Object.assign({},r.info),discRaw:r.f.disciples||'',noDisc,disciples:dis});
    });
  }
  return out;
}
function statusOf(v){const m=String(v||'').match(/\b(retired|deceased)\b/i);return m?m[1].toLowerCase():'';}
function applyStatus(entries){
  const by=new Map(entries.map(e=>[e.name.toLowerCase(),e]));
  const re=/Luma\s+([A-Za-z]+)\s*\(\s*(deceased|retired)\s*\)/gi;
  for(const e of entries)for(const txt of [e.mentor,e.discRaw]){
    if(!txt)continue;
    for(const m of String(txt).matchAll(re)){const t=by.get(m[1].toLowerCase());if(t&&!t.status)t.status=m[2].toLowerCase();}
  }
}
function parseAll(files){
  const out=[],seen=new Set();
  for(const f of files){
    for(const e of parseEntries(f.text)){
      const k=e.name.toLowerCase()+'|'+e.path.join('-').toLowerCase();
      if(seen.has(k)&&e.name!=='(unnamed)')continue;
      seen.add(k);e.source=f.name;out.push(e);
    }
  }
  return out;
}
function entriesFromConfig(list){
  const out=[];
  for(const g of (list||[])){
    if(!g||!g.name)continue;
    let path=g.path?segs(norm(String(g.path))):[];
    const oe=capEl(String(g.element||''));
    let kind='none',reason=g.reason||'Branch left blank',pe=null;
    if(path.length){
      pe=capEl(path[0]);
      if(pe){path[0]=pe;kind=path.length===1?'root':'branch';reason='';}
      else{reason='Unrecognised element "'+path[0]+'"';path=[];}
    }
    out.push({name:String(g.name),names:[String(g.name)],path,kind,element:pe||oe,origEl:oe,reason,
      rank:g.rank||'',sameAs:g.sameAs||'',form:g.form||'',mentor:g.mentor||'',role:g.role||'',team:g.team||'',guild:g.guild||'',zodiac:g.zodiac||'',
      base:g.base||'',status:statusOf(g.status),info:Object.fromEntries(Object.entries(g.info||{}).filter(([k])=>!HIDDEN.has(k.toLowerCase()))),discRaw:'',noDisc:!!g.noDisc,disciples:Array.isArray(g.disciples)?g.disciples.map(String):[],source:'branches.json'});
  }
  return out;
}
function mergeEntries(base,imported){
  const have=new Set(imported.filter(e=>e.name!=='(unnamed)').map(e=>e.name.toLowerCase()));
  const old=new Map(base.map(e=>[e.name.toLowerCase(),e]));
  imported.forEach(e=>{const o=old.get(e.name.toLowerCase());if(o){if(!e.status&&o.status)e.status=o.status;if(!e.base&&o.base)e.base=o.base;}});
  return base.filter(e=>!have.has(e.name.toLowerCase())).concat(imported);
}
function exportConfig(entries,roots,cfg){
  const paths=[];
  ELEMENTS.forEach(el=>{(function w(n,top){if(!top&&!n.inferred)paths.push(n.path.join('-'));n.kids.forEach(k=>w(k,false));})(roots[el],true);});
  const zod={};
  ELEMENTS.forEach(el=>{const r=roots[el],names=r.z.map(z=>z.name).concat(r.zg),fi=n=>{const i=r.kids.findIndex(k=>(r.zmap&&r.zmap.get(k.label.toLowerCase()))===n);return i<0?1e6:i;};const o=names.map((n,i)=>[n,fi(n)*1000+i]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);if(o.length)zod[el]=o;});
  const g=entries.filter(e=>e.name!=='(unnamed)').map(e=>{
    const o={name:e.name,path:e.path.join('-')};
    if(e.kind==='none'){o.element=e.element||'';o.reason=e.reason;}
    ['rank','mentor','role','team','guild','zodiac','base','status','sameAs','form','noDisc'].forEach(k=>{if(e[k])o[k]=e[k];});
    if(e.info&&Object.keys(e.info).length)o.info=e.info;
    if(e.disciples&&e.disciples.length)o.disciples=e.disciples;
    return o;
  });
  const help=cfg._help||'Edit this file to keep branches and Guardians. branches: one Element-Branch-Subbranch path per line. guardians: profiles, filed by path. The order of first-level branches sets their shade slot in tree-colors.css.';
  return '{\n  "_help": '+JSON.stringify(help)+',\n  "hiddenFields": '+JSON.stringify(cfg.hiddenFields||DEFAULT_HIDDEN)+',\n  "overrides": [\n'+(cfg.overrides||[]).map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ],\n  "zodiacRoots": '+JSON.stringify(zod)+',\n  "branches": [\n'+paths.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ],\n  "guardians": [\n'+g.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ]\n}\n';
}
function parseOverrides(text){
  const rules=[];
  for(const line of (text||'').split(/\r?\n/)){
    const l=norm(line);
    if(!l||l.startsWith('#'))continue;
    const m=l.split(/=>|->/);
    if(m.length!==2)continue;
    const a=segs(m[0]),b=segs(m[1]);
    if(a.length&&b.length)rules.push({a,b});
  }
  return rules;
}
function applyOverrides(entries,rules){
  for(const e of entries){
    if(e.kind!=='branch')continue;
    for(const r of rules){
      if(r.a.length<=e.path.length&&r.a.every((s,i)=>s.toLowerCase()===e.path[i].toLowerCase())){
        e.path=r.b.concat(e.path.slice(r.a.length));
        const el=capEl(e.path[0]);if(el){e.path[0]=el;e.element=el;}
        break;
      }
    }
  }
  return entries;
}
function mk(label,path){return{label,path:path||[label],kids:[],map:new Map(),g:[],inferred:false,z:[],zg:[]};}
let SEQ=0;
function child(n,label,inferred){
  const k=label.toLowerCase();let c=n.map.get(k);
  if(!c){c=mk(label,n.path.concat(label));c.inferred=!!inferred;c.seq=SEQ++;n.map.set(k,c);n.kids.push(c);}
  return c;
}
function buildTrees(entries,opts){
  opts=opts||{};
  const roots={};ELEMENTS.forEach(e=>roots[e]=mk(e));
  const rank=new Map();
  (opts.branches||[]).forEach(pth=>{
    const sg=segs(norm(String(pth)));const el=capEl(sg[0]);
    if(!el||sg.length<2)return;
    let n=roots[el];for(const x of sg.slice(1))n=child(n,x);
    const k=el+'|'+sg[1].toLowerCase();if(!rank.has(k))rank.set(k,rank.size);
  });
  const noBranch=[],names=new Set();
  entries.forEach(e=>names.add(e.name.toLowerCase()));
  for(const e of entries){
    if(e.kind==='root')roots[e.element].z.push(e);
    else if(e.kind==='branch'){
      let n=roots[e.element];
      for(const s of e.path.slice(1))n=child(n,s);
      n.g.push(e);e.node=n;
    }else noBranch.push(e);
  }
  ELEMENTS.forEach(el=>{
    const have=new Set(roots[el].z.map(z=>z.name.toLowerCase()));
    roots[el].zorder=((opts.zodiac&&opts.zodiac[el])||[]).map(n=>String(n).toLowerCase());
    roots[el].zg=((opts.zodiac&&opts.zodiac[el])||[]).filter(n=>!have.has(String(n).toLowerCase()));
  });
  if(opts.infer){
    for(const e of entries){
      if(e.kind!=='branch'||!e.node)continue;
      for(const d of e.disciples){
        if(names.has(d.toLowerCase()))continue;
        if(!e.node.map.has(d.toLowerCase()))child(e.node,d,true);
      }
    }
  }
  const zodNames=new Map();
  ELEMENTS.forEach(el=>{roots[el].z.forEach(z=>zodNames.set(z.name.toLowerCase(),z.name));((opts.zodiac&&opts.zodiac[el])||[]).forEach(n=>zodNames.set(String(n).toLowerCase(),String(n)));});
  ELEMENTS.forEach(el=>{
    const zm=new Map();
    roots[el].kids.forEach(k=>{
      const g=k.g[0];if(!g||!g.mentor)return;
      const names=(g.mentor.match(/Luma\s+([A-Za-z]+)/g)||[]).map(x=>x.replace(/^Luma\s+/,''));
      const hit=names.find(n=>zodNames.has(n.toLowerCase()));
      if(hit)zm.set(k.label.toLowerCase(),zodNames.get(hit.toLowerCase()));
    });
    roots[el].zmap=zm;
  });
  ELEMENTS.forEach(ez=>roots[ez].z.forEach(z=>(z.disciples||[]).forEach(d=>{
    ELEMENTS.forEach(el=>{if(roots[el].map.has(d.toLowerCase())&&!roots[el].zmap.has(d.toLowerCase()))roots[el].zmap.set(d.toLowerCase(),z.name);});
  })));
  const size=n=>{n.size=1+n.kids.reduce((s,k)=>s+size(k),0);return n.size;};
  const sortk=n=>{n.kids.sort((a,b)=>a.seq-b.seq);n.kids.forEach(sortk);};
  ELEMENTS.forEach(e=>{
    size(roots[e]);sortk(roots[e]);
    const r=x=>rank.has(e+'|'+x.label.toLowerCase())?rank.get(e+'|'+x.label.toLowerCase()):1e6;
    roots[e].kids.sort((a,b)=>r(a)-r(b)||b.size-a.size);
  });
  ELEMENTS.forEach(e=>{
    const r=roots[e],order=[],groups=new Map();
    r.kids.forEach(k=>{const z=r.zmap.get(k.label.toLowerCase())||'~'+k.label;if(!groups.has(z)){groups.set(z,[]);order.push(z);}groups.get(z).push(k);});
    r.kids=order.reduce((o,z)=>o.concat(groups.get(z)),[]);
  });
  return{roots,noBranch};
}
function collectWarnings(entries,roots,noBranch){
  const w=[],labels=new Map();
  for(const el of ELEMENTS){
    (function walk(n,top){
      if(!top){const k=n.label.toLowerCase();if(!labels.has(k))labels.set(k,new Set());labels.get(k).add(n.path.join('-'));}
      n.kids.forEach(c=>walk(c,false));
    })(roots[el],true);
  }
  for(const [k,set] of labels){if(set.size>1)w.push('The branch name "'+[...set][0].split('-').pop()+'" appears in more than one place: '+[...set].join('  |  ')+'. If these are the same branch, add an override.');}
  for(const e of entries){
    if(e.kind==='branch'&&e.path[e.path.length-1].toLowerCase()!==e.name.toLowerCase())w.push(e.name+' is filed under '+e.path.join('-')+', but the last branch name is "'+e.path[e.path.length-1]+'".');
    if(e.kind!=='none'&&e.origEl&&e.element&&e.origEl!==e.element)w.push(e.name+': Original Element says '+e.origEl+', but the Branch Theme starts with '+e.element+'.');
  }
  const byName=new Map();
  for(const e of entries){if(e.name==='(unnamed)'||e.kind==='none')continue;const k=e.name.toLowerCase();if(!byName.has(k))byName.set(k,[]);byName.get(k).push(e);}
  for(const [k,list] of byName){const ps=[...new Set(list.map(e=>e.path.join('-')))];if(ps.length>1)w.push(list[0].name+' has different branches in different places: '+list.map(e=>e.path.join('-')+(e.source?' ('+e.source+')':'')).join('  |  ')+'. Both are drawn.');}
  for(const e of noBranch)if(/^Unrecognised/.test(e.reason))w.push(e.name+': '+e.reason+'.');
  return w;
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const slug=x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function renderTree(root,el){
  const BW=116,BH=28,GAP=18,PITCH=BW+GAP,ROWH=36,PAD=20,MAXSLOT=7;
  const zs=root.z.map(e=>({name:e.name,g:[e]})).concat((root.zg||[]).map(n=>({name:n,none:true})));
  {const fi=n=>{const i=root.kids.findIndex(k=>(root.zmap&&root.zmap.get(k.label.toLowerCase()))===n);return i<0?1e6:i;};
   const zo=n=>{const i=(root.zorder||[]).indexOf(n.toLowerCase());return i<0?1e6:i;};
   zs.forEach((z,i)=>{z.o=zo(z.name)*1e9+fi(z.name)*1000+i;});zs.sort((a,b)=>a.o-b.o);}
  const elc='el-'+el.toLowerCase();
  // The Zodiacs sit in the tree itself, between the element and the branches of their disciples:
  // Fire > Leo > Lumen > Moon. Branches with no Zodiac mentor stay directly under the element.
  const first=root.kids.slice();
  first.forEach((k,i)=>{k.slot=i;});
  const zodNodes=zs.map(z=>({label:z.name,zodiac:z,g:[],path:[el,z.name],
    kids:first.filter(k=>root.zmap&&root.zmap.get(k.label.toLowerCase())===z.name)}));
  const tree={label:el,g:root.g||[],path:[el],kids:zodNodes.concat(first.filter(k=>!zodNodes.some(z=>z.kids.includes(k))))};
  let row=0,maxD=0;
  const all=[];
  (function walk(n,d,sh,par){
    n.d=d;n.par=par||null;maxD=Math.max(maxD,d);all.push(n);
    // A branch's shade comes from its first-level branch (n.slot), whatever the depth.
    n.sh=n.slot!==undefined?n.slot:sh;
    if(!n.kids.length){n.row=row++;}
    else{n.kids.forEach(k=>walk(k,d+1,n.sh,n));n.row=(n.kids[0].row+n.kids[n.kids.length-1].row)/2;}
  })(tree,0,-1);
  const minRow=Math.min(...all.map(n=>n.row));
  const maxRow=Math.max(...all.map(n=>n.row));
  const X=d=>PAD+d*PITCH,Y=r=>PAD+(r-minRow)*ROWH;
  const W=PAD*2+(maxD+1)*PITCH-GAP,H=PAD*2+(maxRow-minRow)*ROWH+BH;
  const details={},nb=root.kids.length;
  let links='',nodes='',id=0;
  // Age from the profile's "Age" line: its first number, e.g. "1000; physically appears around 45" -> 1000.
  const ageOf=g=>{const i=(g&&g.info)||{},k=Object.keys(i).find(k=>/^age\b/i.test(k)),m=k&&String(i[k]).match(/\d+/);return m?m[0]:'';};
  function box(x,y,label,cls,key,title,status,age){
    const long=(label.length+(age?age.length+3:0))>13?' textLength="'+(BW-16)+'" lengthAdjust="spacingAndGlyphs"':'';
    const mark=status?'<circle class="markbg" cx="'+(x+BW-3)+'" cy="'+(y+3)+'" r="8"/><text class="mark" x="'+(x+BW-3)+'" y="'+(y+3.5)+'" text-anchor="middle" dominant-baseline="central">'+(status==='deceased'?'\u2020':'R')+'</text>':'';
    return '<g class="node '+cls+'" data-k="'+key+'" tabindex="0" role="button" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title><rect x="'+x+'" y="'+y+'" width="'+BW+'" height="'+BH+'" rx="6"/><text x="'+(x+BW/2)+'" y="'+(y+BH/2)+'" text-anchor="middle" dominant-baseline="central"'+long+'>'+esc(label)+(age?'<tspan class="age"> ('+age+')</tspan>':'')+'</text>'+mark+'</g>';
  }
  const unk=v=>{v=String(v==null?'':v).replace(/\bLuma\s+/g,'').replace(/[;,\s]+$/,'').trim();return(!v||/^-+$/.test(v))?BLANK:v;};
  function cardFor(g,n,zroot){
    const dis=g.disciples&&g.disciples.length?g.disciples.join(', '):(n&&n.kids.length?n.kids.map(k=>k.label).join(', '):'');
    return{name:g.name+(g.sameAs?(g.form==='evolved'?' (evolved form of '+g.sameAs+')':' (evolves into '+g.sameAs+')'):''),
      branch:zroot?el+' (Zodiac)':(g.path&&g.path.length?g.path.join(' \u203a '):unk('')),
      civ:unk(g.info&&g.info['Civilian Name']),rank:unk(g.rank),role:unk(g.role),base:unk(g.base),mentor:zroot?'N.A.':unk(g.mentor&&!/^-+$/.test(g.mentor.trim())?g.mentor:((n&&n.par&&n.par.d>0)?(n.par.g.length?n.par.g[0].name:n.par.label):(n&&n.d===1?zodOf(n):'')||'')),disciples:(/disciple/i.test(g.rank||'')&&!/full/i.test(g.rank||''))?'N.A.':((dis||!g.noDisc)?unk(dis):'None'),status:g.status||''};
  }
  const zodOf=n=>{const top=n.sh>=0?first[n.sh]:null;return top&&root.zmap?root.zmap.get(top.label.toLowerCase()):null;};
  function descGuardians(n){const out=[];(function w(m){m.g.forEach(g=>out.push(g.name));m.kids.forEach(w);})(n);return out;}
  all.forEach(n=>{
    const key=el+':'+(id++);
    const x=X(n.d),y=Y(n.row);
    if(n.d===0){
      details[key]={title:el,sub:'Element root',rows:[['Branches',String(root.kids.length)],['Zodiacs',zs.map(z=>z.name).join(', ')||'none']]};
      nodes+=box(x,y,el,'root '+elc,key,el);
    }else if(n.zodiac){
      const z=n.zodiac,zst=z.g?(z.g[0].status||''):'';
      details[key]=z.none?{title:z.name,sub:'Zodiac of '+el,none:true,zodiac:true,by:[],cards:[{name:z.name,branch:el+' (Zodiac)',civ:BLANK,rank:BLANK,role:BLANK,base:BLANK,mentor:'N.A.',disciples:unk(n.kids.map(k=>k.label).join(', ')),status:''}]}:{title:z.name,sub:'Zodiac of '+el,g:z.g,cards:z.g.map(q=>cardFor(q,n,true))};
      nodes+=box(x,y,z.name,'root '+elc+' z-'+slug(z.name)+(zst?' st-'+zst:'')+(z.none?' gray':''),key,z.name+' (Zodiac)'+(z.none?' (no profile yet)':'')+(zst?' ('+zst+')':''),zst,z.g?ageOf(z.g[0]):'');
    }else{
      const has=n.g.length>0,top=first[n.sh];
      const zn=zodOf(n),st=has?(n.g.find(q=>q.status)||{}).status||'':'';
      if(has)details[key]={title:n.g.map(q=>q.name).join(' / '),sub:n.path.join(' > '),g:n.g,cards:n.g.map(q=>cardFor(q,n,false))};
      else{
        const pm=n.par&&n.par.d>0?(n.par.g.length?n.par.g.map(q=>q.name).join(' / '):n.par.label):'';
        details[key]={title:n.label,sub:n.path.join(' > '),none:true,inferred:n.inferred,by:descGuardians(n),
          cards:[{name:n.label,branch:n.path.join(' \u203a '),civ:BLANK,rank:BLANK,role:BLANK,base:BLANK,mentor:unk(pm),disciples:unk(n.kids.map(k=>k.label).join(', ')),status:''}]};
      }
      nodes+=box(x,y,n.label,elc+' shade-'+(nb<2?0:Math.round(n.sh*MAXSLOT/(nb-1)))+' b-'+slug(top.label)+(zn?' z-'+slug(zn):'')+(zn&&n.d>=3?' gen-'+Math.min(n.d-1,5):'')+(st?' st-'+st:'')+(has?'':' gray'),key,n.label+(has?'':' (no profile yet)')+(st?' ('+st+')':''),st,has?ageOf(n.g[0]):'');
    }
    if(n.kids.length){
      const sx=x+BW,mid=sx+GAP/2,sy=Y(n.row)+BH/2;
      const ys=n.kids.map(k=>Y(k.row)+BH/2);
      links+='<path class="link" d="M'+sx+' '+sy+' H'+mid+' M'+mid+' '+Math.min(...ys,sy)+' V'+Math.max(...ys,sy)+n.kids.map((k,i)=>' M'+mid+' '+ys[i]+' H'+X(k.d)).join('')+'"/>';
    }
  });
  const byName=new Map();
  all.forEach(n=>n.g.forEach(g=>byName.set(g.name.toLowerCase(),n)));
  let alias='',hasAlias=false;
  all.forEach(n=>n.g.forEach(g=>{
    if(g.form!=='evolved'||!g.sameAs)return;
    const o=byName.get(g.sameAs.toLowerCase());
    if(!o||o===n||o.d!==n.d)return;
    const a=o.row<n.row?o:n,b=a===o?n:o;
    const cx=X(a.d)+BW/2,y1=Y(a.row)+BH,y2=Y(b.row);
    if(y2<=y1)return;
    hasAlias=true;
    alias+='<path class="alias" d="M'+cx+' '+y1+' V'+y2+'"/>';
    if(y2-y1>=22)alias+='<text class="aliaslabel" x="'+(cx+8)+'" y="'+((y1+y2)/2)+'" dominant-baseline="central">same person</text>';
  }));
  const svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="'+el+' branch tree">'+links+alias+nodes+'</svg>';
  return{svg,details,hasAlias};
}
// ==UI==
const $=id=>document.getElementById(id);
const COLORS={All:'var(--ink)',Fire:'var(--fire)',Earth:'var(--earth)',Water:'var(--water)',Air:'var(--air)','No branch yet':'var(--none)','Check':'var(--warn-ink)'};
let CFG=FALLBACK_CONFIG;
let S={files:[],entries:[],roots:null,noBranch:[],warnings:[],tab:'All',details:{}};
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function setStatus(t,err){const s=$('status');if(!s)return;s.textContent=t;s.className='status'+(err?' err':'');}
function hasCfgBranches(){return !!(CFG.branches&&CFG.branches.length)||!!(CFG.guardians&&CFG.guardians.length)||!!Object.values(CFG.zodiacRoots||{}).some(a=>a&&a.length);}
function sortAll(silent){
  setHidden(CFG.hiddenFields);
  const imported=[];
  const entries=mergeEntries(entriesFromConfig(CFG.guardians),imported);
  applyStatus(entries);
  if(!entries.length&&!hasCfgBranches()){setStatus(S.files.length?'No Guardian profiles found. Each profile needs a "Guardian Name:" line.':'',!!S.files.length);S.roots=null;renderTabs();renderPanel();return false;}
  const rules=parseOverrides((CFG.overrides||[]).join('\n'));
  applyOverrides(entries,rules);
  const t=buildTrees(entries,{infer:$('infer').checked,branches:CFG.branches,zodiac:CFG.zodiacRoots});
  S.multiSrc=new Set(entries.map(e=>e.source)).size>1;S.entries=entries;S.roots=t.roots;S.noBranch=t.noBranch;S.warnings=collectWarnings(entries,t.roots,t.noBranch);
  if(!silent)setStatus(imported.length?'Sorted '+entries.length+' Guardians: branches.json plus '+S.files.length+' imported file'+(S.files.length===1?'':'s')+'.':entries.length?'Showing '+entries.length+' Guardians from branches.json.':'Showing the branches in branches.json. Import your doc to light them up.');
  lsSet('luma.infer.v1',$('infer').checked?'1':'0');
  renderTabs();renderPanel();return true;
}
async function loadConfig(){
  const note={};
  try{
    const r=await fetch('data/branches.json',{cache:'no-cache'});
    if(!r.ok)throw new Error(r.status);
    const j=await r.json();
    CFG={_help:j._help,hiddenFields:Array.isArray(j.hiddenFields)?j.hiddenFields:DEFAULT_HIDDEN,overrides:Array.isArray(j.overrides)?j.overrides:[],zodiacRoots:j.zodiacRoots||{},branches:Array.isArray(j.branches)?j.branches:[],guardians:Array.isArray(j.guardians)?j.guardians:[]};
    note.textContent='Loaded branches.json: '+CFG.guardians.length+' Guardians, '+CFG.branches.length+' branches, '+CFG.overrides.length+' override rules.';
  }catch(e){
    CFG=FALLBACK_CONFIG;
    note.textContent='branches.json was not found, so built-in defaults are used. Open the page from your GitHub site (or a local web server) to load it.';
  }
}
function renderTabs(){
  const names=['All',...ELEMENTS,'No branch yet','Check'];
  $('tabs').innerHTML=names.map(n=>{
    let c='';
    if(S.roots){
      if(n==='All')c=S.entries.filter(e=>e.kind!=='none').length;
      else if(ELEMENTS.includes(n))c=S.entries.filter(e=>e.element===n&&e.kind!=='none').length;
      else if(n==='No branch yet')c=S.noBranch.length;
      else c=S.warnings.length;
    }
    return '<button class="tab" role="tab" type="button" data-tab="'+n+'" aria-selected="'+(S.tab===n)+'" style="--c:'+COLORS[n]+'"><span class="dot"></span>'+n+(c!==''?' <span class="n">'+c+'</span>':'')+'</button>';
  }).join('');
}
// A row value can be {html: '...'} for ready-made markup (like the linked Branch line).
function dl(rows){return '<dl class="std">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd'+(r[1]===BLANK?' class="unk"':'')+'>'+(r[1]&&r[1].html!==undefined?r[1].html:esc(r[1]))+'</dd>').join('')+'</dl>';}
// The wiki's character list, so names in the Branch line can link to profiles.
let WIKI=null;
if(window.Wiki) Wiki.load().then(d=>{WIKI=d;}).catch(()=>{});
// "Fire › Lumen › Moon › Blossom": the element opens the Characters list, each name its wiki profile (when it has one).
function branchLinks(text){
  if(!text||text===BLANK) return text;
  return {html:String(text).split(' › ').map(seg=>{
    const s=seg.trim(),k=s.toLowerCase();
    if(ELEMENTS.includes(s)) return '<a href="characters.html?element='+encodeURIComponent(s)+'">'+esc(s)+'</a>';
    const g=WIKI&&WIKI.byName.get(k);
    if(g) return '<a href="'+Wiki.charUrl(g)+'">'+esc(s)+'</a>';
    if(WIKI&&WIKI.profiles.has(k)) return '<a href="character.html?name='+encodeURIComponent(s)+'">'+esc(s)+'</a>';
    return esc(s);
  }).join(' › ')};
}
function stdCard(c,hasG,k,i){
  const badge=c.status?'<span class="badge st-'+c.status+'">'+(c.status==='deceased'?'\u2020 Deceased':'R Retired')+'</span>':'';
  return '<div class="stdcard"><div class="sh"><h3>'+esc(c.name)+'</h3>'+badge+'</div>'+
    dl([['Guardian Name',c.name.replace(/\s*\(.*\)$/,'')],['Branch',branchLinks(c.branch)],['Rank',c.rank||BLANK],['Role',c.role||BLANK],['Stationed at',c.base],['Mentor',c.mentor],['Disciples',c.disciples]])+
    (c.name.includes('(')?'<p class="same">'+esc(c.name.replace(/^.*\((.*)\)$/,'$1'))+'</p>':'')+
    wikiButton(c.name.replace(/\s*\(.*\)$/,''),hasG)+'</div>';
}
// The card's button opens the Guardian's wiki profile, when they have one.
function wikiButton(name,hasG){
  const has=hasG||(WIKI&&(WIKI.byName.has(name.toLowerCase())||WIKI.profiles.has(name.toLowerCase())));
  return has?'<a class="btn primary wikilink" href="character.html?name='+encodeURIComponent(name)+'">Open wiki page →</a>':'<p class="hint">No profile yet.</p>';
}
function detailHtml(d,k){
  if(!d)return '<span class="hint">Select a box to see the profile.</span>';
  if(d.rows)return '<h3>'+esc(d.title)+'</h3><div class="hint">'+esc(d.sub)+'</div>'+dl(d.rows);
  const note=d.none&&!d.zodiac?(d.inferred?'Named as a disciple, but no profile in the doc yet.':'This branch is known, but no imported profile belongs to it yet.'):'';
  return (d.cards||[]).map((c,i)=>stdCard(c,!!(d.g&&d.g[i]),k,i)).join('')+(note?'<p class="hint">'+esc(note)+'</p>':'');
}
// The Zodiacs are drawn in the tree itself, so the key only explains status and gray boxes.
function legendHtml(extra){
  return '<div class="legend"><span><b class="agekey">Name (age)</b> = age counted as of 2025</span><span><i class="sw has st-retired"></i>Retired (R)</span><span><i class="sw has st-deceased"></i>Deceased (\u2020)</span><span><i class="sw none"></i>Known branch, no profile yet</span>'+extra+'</div>';
}
function renderPanel(){
  const p=$('panel');
  if(!S.roots){p.innerHTML='<div class="card empty">branches.json could not be loaded.</div>';return;}
  const t=S.tab;
  if(t==='All'){
    const det={};let blocks='',alias=false;
    ELEMENTS.forEach(el=>{
      const root=S.roots[el];
      if(!root.kids.length&&!root.z.length&&!root.zg.length)return;
      const r=renderTree(root,el);Object.assign(det,r.details);alias=alias||r.hasAlias;
      blocks+='<section class="elblock"><h2 class="elh" style="--c:'+COLORS[el]+'"><span class="dot"></span>'+el+'</h2><div class="card diagram">'+r.svg+'</div></section>';
    });
    S.details=det;
    p.innerHTML=legendHtml(alias?'<span><i class="sw alias-sw"></i>Dashed line = same person</span>':'')+'<div class="detail sticky" id="detail">'+detailHtml(null)+'</div>'+(blocks||'<div class="card empty">No Guardians with a branch were found.</div>');
    return;
  }
  if(ELEMENTS.includes(t)){
    const root=S.roots[t];
    if(!root.kids.length&&!root.z.length&&!root.zg.length){p.innerHTML='<div class="card empty">No '+t+' Guardians with a branch were found.</div>';return;}
    const r=renderTree(root,t);S.details=r.details;
    p.innerHTML=legendHtml(r.hasAlias?'<span><i class="sw alias-sw"></i>Dashed line = same person</span>':'')+'<div class="detail sticky" id="detail">'+detailHtml(null)+'</div><div class="card diagram">'+r.svg+'</div>';
  }else if(t==='No branch yet'){
    const groups=[...ELEMENTS,'No element set'].map(g=>({g,items:S.noBranch.filter(e=>(e.element||'No element set')===g)})).filter(x=>x.items.length);
    if(!groups.length){p.innerHTML='<div class="card empty">Every Guardian has a branch.</div>';return;}
    p.innerHTML='<p class="note">These profiles have no usable Branch Theme yet. Add one in the doc, then ask Claude to update branches.json.</p><div class="groups">'+groups.map(x=>'<div class="group"><h3 style="--c:'+(COLORS[x.g]||'var(--none)')+'"><span class="dot"></span>'+x.g+'</h3>'+x.items.map(e=>'<div class="chip"><span>'+esc(e.name)+'</span><small>'+esc(e.reason)+'</small></div>').join('')+'</div>').join('')+'</div>';
  }else{
    p.innerHTML=S.warnings.length?'<p class="note">These are places where the doc disagrees with itself. Nothing is changed automatically beyond your overrides.</p><ul class="warns">'+S.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':'<div class="card empty">No conflicts found.</div>';
  }
}
$('infer').addEventListener('change',()=>sortAll(true));
$('tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;S.tab=b.dataset.tab;renderTabs();renderPanel();});
function pick(g){
  if(!g)return;
  const was=g.classList.contains('sel');
  document.querySelectorAll('.node.sel').forEach(n=>n.classList.remove('sel'));
  if(was){const d0=$('detail');if(d0)d0.innerHTML=detailHtml(null);return;}
  g.classList.add('sel');
  const d=$('detail');if(d)d.innerHTML=detailHtml(S.details[g.dataset.k],g.dataset.k);
}
$('panel').addEventListener('click',e=>{pick(e.target.closest('.node'));});
$('panel').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest&&e.target.closest('.node');if(g){e.preventDefault();pick(g);}}});
(async function init(){
  {const v=lsGet('luma.infer.v1');$('infer').checked=v===null||v===undefined||v===''?true:v==='1';}
  renderTabs();renderPanel();
  await loadConfig();
  if(!hasCfgBranches()){$('panel').innerHTML='<div class="card empty">branches.json was not found. Open this page from your GitHub site (or a local web server) so it can load branches.json.</div>';return;}
  sortAll(true);
})();
