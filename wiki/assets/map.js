/* Interactive map: Guardian bases, guilds, LumaSoft branches and crystal sites from data/locations.json.
   Uses the real world map by default, or your own image when locations.json sets mode "image". */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('map');
const L=window.L;
const loc=data.locations||{};
const layers=loc.layers&&loc.layers.length?loc.layers:[{id:'bases',name:'Places',color:'#7F77DD'}];
const layerBy=new Map(layers.map(l=>[l.id,l]));
const places=(loc.places||[]).filter(p=>layerBy.has(p.layer||layers[0].id)).map(p=>({...p,layer:p.layer||layers[0].id}));
const imageMode=loc.mode==='image'&&loc.image;

function guardiansAt(p){
  const m=(p.match||[]).map(s=>s.toLowerCase());
  const gk=p.guild&&p.guild.toLowerCase();
  return data.guardians.filter(g=>(m.length&&m.includes(g.base.toLowerCase()))||(gk&&W.groupKey(g.guild).toLowerCase().startsWith(gk)));
}
for(const p of places) p.people=guardiansAt(p);
// Guardians whose base matches no place, so they can be listed rather than silently missing.
const placed=new Set(places.flatMap(p=>p.people));
const unplaced=data.guardians.filter(g=>g.base&&!places.some(p=>(p.match||[]).some(m=>m.toLowerCase()===g.base.toLowerCase())));

const params=W.params();
const on=new Set((params.get('layers')||layers.map(l=>l.id).join(',')).split(',').filter(id=>layerBy.has(id)));

const main=document.getElementById('main');
main.innerHTML=`
<div class="crumbs"><a href="index.html">Home</a><span class="sep">›</span><span>Map</span></div>
<h1 style="font-size:30px;margin-bottom:6px">World map</h1>
<p class="muted" style="margin:0 0 14px">Tap a marker to see who is stationed there and what the story says about it.</p>
<div class="chips" role="group" aria-label="Map layers">${layers.map(l=>`<button type="button" class="chipbtn" data-layer="${esc(l.id)}" style="--c:${esc(l.color)}" aria-pressed="${on.has(l.id)}"><span class="dot"></span>${esc(l.name)} <span class="n">${places.filter(p=>p.layer===l.id).length}</span></button>`).join('')}</div>
<div class="mapwrap">
  <div id="map" role="application" aria-label="Map of Luma Guardian locations"></div>
  <aside class="panel" id="panel" aria-live="polite"></aside>
</div>`;

if(!L){document.getElementById('map').innerHTML='<div class="empty">The map library could not load. Check your connection and reload.</div>';return;}

let map,tiles;
if(imageMode){
  const [w,h]=loc.size||[2000,1400];
  map=L.map('map',{crs:L.CRS.Simple,minZoom:-3,maxZoom:2,zoomSnap:0.25});
  const bounds=[[0,0],[h,w]];
  L.imageOverlay(loc.image.startsWith('http')?loc.image:'data/'+loc.image.replace(/^data\//,''),bounds).addTo(map);
  map.fitBounds(bounds);
}else{
  map=L.map('map',{worldCopyJump:true,minZoom:2,zoomSnap:0.5}).setView([22,40],2);
  // OpenFreeMap Positron: OpenStreetMap streets and place names without shop and business icons, zooms to building level.
  // Falls back to Esri Light Gray Canvas (zooms less far) if MapLibre did not load.
  // Dark mode recolours either map with a CSS filter (see .leaflet-tile-pane in wiki.css).
  if(L.maplibreGL&&window.maplibregl){
    map.setMaxZoom(19);
    tiles=L.maplibreGL({style:'https://tiles.openfreemap.org/styles/positron',attribution:'<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  }else{
    const esri='https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_';
    tiles=L.tileLayer(esri+'Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'}).addTo(map);
    L.tileLayer(esri+'Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:16}).addTo(map);
  }
}
const at=p=>imageMode?[(loc.size||[0,1400])[1]-p.y,p.x]:[p.lat,p.lng];

const markers=new Map();
let current=null;
function icon(p,sel){
  const c=layerBy.get(p.layer).color;
  const big=p.layer==='bases'||p.people.length;
  const label=p.people.length?p.people.length:'';
  const s=big?36:24;
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s],popupAnchor:[0,-s],
    html:`<div class="pin${sel?' sel':''}" style="--c:${esc(c)};width:${s}px;height:${s}px"><span>${label}</span></div>`});
}
for(const p of places){
  if(imageMode?(p.x==null||p.y==null):(p.lat==null||p.lng==null)) continue;
  const m=L.marker(at(p),{icon:icon(p),title:p.name,keyboard:true,riseOnHover:true});
  m.on('click',()=>select(p,false));
  markers.set(p.id,m);
}
function syncLayers(){
  for(const p of places){const m=markers.get(p.id);if(!m) continue;on.has(p.layer)?m.addTo(map):m.remove();}
}

const card=g=>`<li><a href="${W.charUrl(g)}">${W.avatar(g,34)}<span><b>${esc(g.name)}</b><small>${esc(W.subtitle(g))}</small></span></a></li>`;
function list(){
  current=null;
  const panel=document.getElementById('panel');
  const groups=layers.filter(l=>on.has(l.id)).map(l=>{
    const ps=places.filter(p=>p.layer===l.id);
    return ps.length?`<h2 style="font-size:15px;margin:14px 0 6px;display:flex;gap:8px;align-items:center"><span class="dot" style="--c:${esc(l.color)}"></span>${esc(l.name)}</h2><ul class="placelist">${ps.map(p=>`<li><button type="button" data-id="${esc(p.id)}"><span>${esc(p.name)}</span>${p.people.length?`<small>${p.people.length} Guardian${p.people.length>1?'s':''}</small>`:''}</button></li>`).join('')}</ul>`:'';
  }).join('');
  panel.innerHTML=`<h2>Locations</h2><p class="muted" style="margin:0;font-size:14px">${places.length} places · ${placed.size} Guardians placed</p>${groups||'<div class="empty">Turn on a layer above.</div>'}
    ${unplaced.length?`<p class="muted" style="font-size:13px;margin-top:14px">Not on the map yet: ${unplaced.map(g=>`<a href="${W.charUrl(g)}">${esc(g.name)}</a> (${esc(g.base)})`).join(', ')}</p>`:''}`;
  panel.querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click',()=>select(places.find(p=>p.id===b.dataset.id),true)));
}
function select(p,fly){
  if(current&&markers.get(current.id)) markers.get(current.id).setIcon(icon(current,false));
  current=p;
  const m=markers.get(p.id);
  if(m){m.setIcon(icon(p,true));if(!on.has(p.layer)){on.add(p.layer);syncLayers();document.querySelector(`.chipbtn[data-layer="${p.layer}"]`).setAttribute('aria-pressed','true');}}
  if(fly&&m) map.flyTo(at(p),p.zoom!=null?p.zoom:Math.max(map.getZoom(),imageMode?0:p.layer==='bases'?5:10),{duration:.8});
  const l=layerBy.get(p.layer);
  const u=new URLSearchParams(location.search);u.set('place',p.id);history.replaceState(null,'','?'+u);
  document.getElementById('panel').innerHTML=`
    <button type="button" class="btn" id="back" style="min-height:34px;padding:5px 12px;margin-bottom:10px">← All locations</button>
    <h2>${esc(p.name)}</h2>
    <span class="pill" style="--c:${esc(l.color)}"><span class="dot"></span>${esc(l.name)}</span>
    ${p.text?`<p style="margin:10px 0">${W.linkify(p.text,data)}</p>`:''}
    ${p.lore?`<p style="margin:0 0 10px"><a href="lore.html?a=${encodeURIComponent(p.lore.article)}${p.lore.anchor?'#'+encodeURIComponent(p.lore.anchor):''}">Read more in the lore →</a></p>`:''}
    ${p.people.length?`<h3 style="font-size:15px;margin-top:14px">Guardians here (${p.people.length})</h3><ul class="mini">${p.people.map(card).join('')}</ul>`:''}`;
  document.getElementById('back').addEventListener('click',()=>{if(current&&markers.get(current.id)) markers.get(current.id).setIcon(icon(current,false));const u=new URLSearchParams(location.search);u.delete('place');history.replaceState(null,'',location.pathname+(u.toString()?'?'+u:''));list();});
  if(window.matchMedia('(max-width:900px)').matches&&!fly) document.getElementById('panel').scrollIntoView({behavior:'smooth',block:'start'});
}

main.querySelectorAll('.chipbtn').forEach(b=>b.addEventListener('click',()=>{
  const id=b.dataset.layer;on.has(id)?on.delete(id):on.add(id);b.setAttribute('aria-pressed',on.has(id));
  syncLayers();
  const u=new URLSearchParams(location.search);on.size===layers.length?u.delete('layers'):u.set('layers',[...on].join(','));history.replaceState(null,'',location.pathname+(u.toString()?'?'+u:''));
  if(!current) list();
}));

syncLayers();
const want=(params.get('place')||'').toLowerCase();
const start=want&&(places.find(p=>p.id===want)||places.find(p=>(p.match||[]).some(m=>m.toLowerCase()===want))||places.find(p=>p.name.toLowerCase()===want));
if(start) select(start,true); else list();
setTimeout(()=>map.invalidateSize(),200);
})();
