/* Home page: hero, stats, element portals, featured Guardian, teams, map teaser. */
(async function(){
const W=window.Wiki,{esc}=W;
const data=await W.boot('home');
const cfg=data.config,G=data.guardians;

const count=(arr,key)=>{const m=new Map();for(const g of arr){const k=key(g);if(k)m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));};
const teams=count(G,g=>W.groupKey(g.team));
const bases=count(G,g=>g.base);
const byEl=Object.fromEntries(W.ELEMENTS.map(e=>[e,G.filter(g=>g.element===e).length]));

const featured=(cfg.featured&&data.byName.get(String(cfg.featured).toLowerCase()))
  ||W.pickDaily(G.filter(g=>g.path&&Object.keys(g.info).length>6))||G[0];
const featText=featured.lore.summary||featured.info['Personality']||
  `${featured.name} is a ${featured.rank||'Guardian'} of the ${featured.element} element${featured.path?`, in the ${featured.segs.slice(1).join(' › ')} branch`:''}.`;

const recentlyAdded=G.slice(-8).reverse();

document.getElementById('main').innerHTML=`
<section class="hero">
  <h1>${esc(cfg.title||'Luma Guardian Wiki')}</h1>
  <p>${esc(cfg.tagline||'The encyclopedia of the Luma Guardians: every Guardian, branch, team and stronghold across Fire, Earth, Water and Air.')}</p>
  <div class="row">
    <a class="btn primary" href="characters.html">Browse Guardians</a>
    <a class="btn" href="map.html">Open the map</a>
    <button class="btn" id="random" type="button">Random Guardian</button>
  </div>
</section>

<div class="stats">
  <div class="stat"><b>${G.length}</b><span>Guardians</span></div>
  <div class="stat"><b>${data.raw.branches?data.raw.branches.length:0}</b><span>Branches</span></div>
  <div class="stat"><b>${teams.length}</b><span>Teams</span></div>
  <div class="stat"><b>${bases.length}</b><span>Locations</span></div>
</div>

<div class="sec-h"><h2>The four elements</h2><a href="tree.html">See the branch tree →</a></div>
<div class="portals">
${W.ELEMENTS.map(e=>`<a class="portal el-${e}" href="characters.html?element=${e}"><span class="glyph">${W.glyph(e)}</span><b>${e}</b><span>${byEl[e]} Guardians · ${esc((data.raw.branches||[]).map(b=>b.split('-')).filter(s=>s.length===2&&s[0]===e).map(s=>s[1]).join(', '))}</span></a>`).join('')}
</div>

<div class="split">
  <section>
    <div class="sec-h"><h2>Featured Guardian</h2><a href="${W.charUrl(featured)}">Read profile →</a></div>
    <div class="card feat el-${featured.element}">
      ${W.avatar(featured,96)}
      <div>
        <h3><a href="${W.charUrl(featured)}">${esc(featured.name)}</a></h3>
        <div class="muted">${esc(W.subtitle(featured))}</div>
        <p>${W.linkify(featText.length>320?featText.slice(0,317)+'…':featText,data,featured)}</p>
        <span class="pill el-${featured.element}"><span class="dot"></span>${featured.element}</span>
        ${featured.zodiac?`<span class="pill">${esc(featured.zodiac)}</span>`:''}
      </div>
    </div>
  </section>
  <section>
    <div class="sec-h"><h2>World map</h2><a href="map.html">Explore →</a></div>
    <div class="card">
      <p style="margin-top:0">Guardians are stationed across ${bases.length} locations.</p>
      <div class="teams">${bases.map(([b,n])=>`<a href="map.html?place=${encodeURIComponent(b)}">${esc(b)} <small>${n}</small></a>`).join('')}</div>
    </div>
  </section>
</div>

<div id="lorebox"></div>

<div class="sec-h"><h2>Teams</h2><a href="characters.html">All Guardians →</a></div>
<div class="teams">${teams.map(([t,n])=>`<a href="characters.html?team=${encodeURIComponent(t)}">${esc(t)} <small>${n}</small></a>`).join('')}</div>

<div class="sec-h"><h2>Latest entries</h2></div>
<div class="grid">${recentlyAdded.map(W.card).join('')}</div>
`;

document.getElementById('random').addEventListener('click',()=>{location.href=W.charUrl(G[Math.floor(Math.random()*G.length)]);});

if(window.Story){
  try{
    const lore=await Story.loadLore();
    document.getElementById('lorebox').innerHTML=`<div class="sec-h"><h2>Explore the lore</h2><a href="lore.html">All articles →</a></div>
      <div class="lore-cards">${lore.groups.map(g=>`<div class="lore-card"><b>${esc(g.title)}</b><span>${g.articles.map(a=>`<a href="lore.html?a=${a.slug}">${esc(a.title)}</a>`).join(' · ')}</span></div>`).join('')}</div>`;
  }catch(e){/* no story.md yet */}
}
})();
