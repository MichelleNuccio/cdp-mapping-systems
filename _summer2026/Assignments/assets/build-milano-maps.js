import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assignmentDir = path.resolve(__dirname, '..');
const dataDir = path.join(assignmentDir, '02-Data');
const output = process.argv[2];
if (!output) throw new Error('Usage: node build-milano-maps.js <output.html>');

const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const personal = read('michelle-milano-affettiva.geojson');
const roundCoord = c => [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))];
const thinRing = (ring, step) => ring.filter((_, i) => i % step === 0 || i === ring.length - 1).map(roundCoord).reverse();
const simplify = (collection, step) => ({
  ...collection,
  features: collection.features.map(feature => {
    const geometry = feature.geometry;
    let coordinates = geometry.coordinates;
    if (geometry.type === 'Polygon') coordinates = coordinates.map(r => thinRing(r, step));
    if (geometry.type === 'MultiPolygon') coordinates = coordinates.map(p => p.map(r => thinRing(r, step)));
    if (geometry.type === 'LineString') coordinates = thinRing(coordinates, step);
    if (geometry.type === 'MultiLineString') coordinates = coordinates.map(r => thinRing(r, step));
    return { ...feature, geometry: { ...geometry, coordinates } };
  })
});
const nil = simplify(read('milano-nil.geojson'), 5);
const stations = read('atm-metro-fermate.geojson');
const routes = simplify(read('atm-metro-percorsi.geojson'), 4);
const payload = JSON.stringify({ personal, nil, stations, routes });

const fragment = String.raw`
<div id="milano-psychogeography">
  <h2>My Affective Milan</h2>
  <div class="viz-controls" role="group" aria-label="Choose a map">
    <button class="btn btn-primary" type="button" data-view="memory" aria-pressed="true">Everyday monuments</button>
    <button class="btn" type="button" data-view="metro" aria-pressed="false">Relationship with the metro</button>
  </div>
  <div class="map-wrap">
    <svg role="img" aria-labelledby="milan-map-title milan-map-desc"></svg>
  </div>
  <div class="legend viz-row" aria-label="Legend"></div>
  <div class="card detail" aria-live="polite"><span class="text-muted">Select a place on the map.</span></div>
</div>
<style>
  #milano-psychogeography { width:100%; color:var(--foreground); }
  #milano-psychogeography h2 { margin:0 0 10px; font-weight:500; }
  #milano-psychogeography .viz-controls { margin-bottom:10px; }
  #milano-psychogeography .map-wrap { width:100%; min-height:520px; }
  #milano-psychogeography svg { width:100%; height:auto; display:block; }
  #milano-psychogeography .district { fill:var(--muted); fill-opacity:.28; stroke:var(--border); stroke-width:.7; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .district-label { fill:var(--muted-foreground); font-size:10px; text-anchor:middle; pointer-events:none; }
  #milano-psychogeography .memory-link { stroke:var(--viz-series-1); stroke-opacity:.15; stroke-width:1; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .route-personal { fill:none; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .route-official { fill:none; stroke:var(--muted-foreground); stroke-opacity:.38; stroke-width:1.5; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .station { fill:var(--background); stroke:var(--foreground); stroke-width:1; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .place { stroke:var(--background); stroke-width:1.5; cursor:pointer; vector-effect:non-scaling-stroke; }
  #milano-psychogeography .place:focus { outline:none; stroke:var(--foreground); stroke-width:3; }
  #milano-psychogeography .home { fill:var(--viz-series-1); }
  #milano-psychogeography .friends { fill:var(--viz-series-2); }
  #milano-psychogeography .heart { fill:var(--viz-series-3); }
  #milano-psychogeography .near { fill:var(--viz-series-4); }
  #milano-psychogeography .far { fill:var(--viz-series-5); }
  #milano-psychogeography .legend { margin-top:8px; gap:14px; }
  #milano-psychogeography .legend-item { display:inline-flex; align-items:center; gap:6px; }
  #milano-psychogeography .swatch { width:10px; height:10px; border-radius:50%; background:var(--swatch); }
  #milano-psychogeography .detail { margin-top:10px; padding:12px; }
  @media (max-width:520px) { #milano-psychogeography .map-wrap { min-height:390px; } }
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script>
(() => {
  const root = document.getElementById('milano-psychogeography');
  const data = ${payload};
  const svg = d3.select(root.querySelector('svg'));
  const wrap = root.querySelector('.map-wrap');
  const detail = root.querySelector('.detail');
  const legend = root.querySelector('.legend');
  let view = 'memory';

  const points = data.personal.features.filter(d => d.geometry.type === 'Point');
  const personalRoutes = data.personal.features.filter(d => d.geometry.type === 'LineString');
  const home = points.find(d => d.properties.category === 'casa_riferimento');
  const publicPoints = points.filter(d => d.properties.category === 'posto_del_cuore');
  const stationPoints = data.stations.features;

  function haversine(a,b){
    const r=6371000, rad=Math.PI/180;
    const p1=a[1]*rad,p2=b[1]*rad,dp=(b[1]-a[1])*rad,dl=(b[0]-a[0])*rad;
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*r*Math.asin(Math.sqrt(h));
  }
  publicPoints.forEach(p => {
    let best={distance:Infinity,name:''};
    stationPoints.forEach(s => { const d=haversine(p.geometry.coordinates,s.geometry.coordinates); if(d<best.distance) best={distance:d,name:s.properties.nome}; });
    p._nearest=best;
  });

  function categoryClass(d){
    const c=d.properties.category;
    if(c==='casa_riferimento') return 'home';
    if(c==='casa_amici') return 'friends';
    return 'heart';
  }
  function showDetail(d){
    const p=d.properties;
    if(view==='metro' && d._nearest){
      detail.innerHTML='<strong>'+p.name+'</strong> · '+Math.round(d._nearest.distance)+' m from '+d._nearest.name+' station';
    } else {
      const labels={bar:'bar',parco:'park',musica_e_socialità:'music and social life',ex_luogo_di_lavoro:'former workplace',università:'university',musica:'music',ristorante:'restaurant',mobilità:'mobility',spazio_pubblico:'public space',caffè_panetteria:'café and bakery',cultura:'culture',luogo_personale:'personal place'};
      const label=p.subcategory ? (labels[p.subcategory]||p.subcategory.replaceAll('_',' ')) : (p.category==='casa_riferimento'?'relational origin':'affective network');
      detail.innerHTML='<strong>'+p.name+'</strong> · '+label+(p.privacy?' · anonymized location':'');
    }
  }
  function setLegend(items){
    legend.innerHTML=items.map(i=>'<span class="legend-item text-small"><span class="swatch" style="--swatch:'+i.color+'"></span>'+i.label+'</span>').join('');
  }
  function draw(){
    const width=Math.max(320,wrap.clientWidth), height=width<520?390:520;
    svg.attr('viewBox','0 0 '+width+' '+height).html('');
    svg.append('title').attr('id','milan-map-title').text(view==='memory'?'Everyday monuments of Milan':'Affective places and the metro');
    svg.append('desc').attr('id','milan-map-desc').text('Personal places in Milan displayed over the official NIL neighborhood boundaries.');
    const projection=d3.geoMercator().fitExtent([[18,18],[width-18,height-18]],data.nil);
    const path=d3.geoPath(projection);
    const g=svg.append('g');
    g.selectAll('path.district').data(data.nil.features).join('path').attr('class','district').attr('d',path);
    if(width>560){
      const named=new Set(['CITTA STUDI','BUENOS AIRES - PORTA VENEZIA - PORTA MONFORTE','DUOMO','LAMBRATE - ORTICA','PARCO SEMPIONE','STAZIONE CENTRALE - PONTE SEVESO']);
      g.selectAll('text.district-label').data(data.nil.features.filter(d=>named.has(d.properties.NIL))).join('text').attr('class','district-label').attr('transform',d=>'translate('+path.centroid(d)+')').text(d=>d.properties.NIL.split(' - ')[0]);
    }
    if(view==='memory'){
      g.selectAll('line.memory-link').data(publicPoints).join('line').attr('class','memory-link').attr('x1',projection(home.geometry.coordinates)[0]).attr('y1',projection(home.geometry.coordinates)[1]).attr('x2',d=>projection(d.geometry.coordinates)[0]).attr('y2',d=>projection(d.geometry.coordinates)[1]);
      g.selectAll('path.route-personal').data(personalRoutes).join('path').attr('class','route-personal').attr('stroke',d=>d.properties.line==='M1'?'var(--viz-series-5)':'var(--viz-series-4)').attr('d',path);
      setLegend([{label:'Home / origin',color:'var(--viz-series-1)'},{label:"Friends’ homes",color:'var(--viz-series-2)'},{label:'Favorite places',color:'var(--viz-series-3)'},{label:'Preferred routes',color:'var(--viz-series-4)'}]);
    } else {
      g.selectAll('path.route-official').data(data.routes.features).join('path').attr('class','route-official').attr('d',path);
      g.selectAll('circle.station').data(stationPoints).join('circle').attr('class','station').attr('cx',d=>projection(d.geometry.coordinates)[0]).attr('cy',d=>projection(d.geometry.coordinates)[1]).attr('r',width<520?1.4:2);
      setLegend([{label:'Within 500 m of the metro',color:'var(--viz-series-4)'},{label:'More than 500 m away',color:'var(--viz-series-5)'}]);
    }
    const shown=view==='memory'?points:publicPoints;
    g.selectAll('circle.place').data(shown).join('circle')
      .attr('class',d=>'place '+(view==='metro'?(d._nearest.distance<=500?'near':'far'):categoryClass(d)))
      .attr('cx',d=>projection(d.geometry.coordinates)[0]).attr('cy',d=>projection(d.geometry.coordinates)[1])
      .attr('r',d=>d.properties.category==='casa_riferimento'?7:(view==='metro'?5:4.5))
      .attr('tabindex',0).attr('role','button').attr('aria-label',d=>d.properties.name)
      .on('click',(event,d)=>showDetail(d)).on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showDetail(d);}});
  }
  root.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{
    view=btn.dataset.view;
    root.querySelectorAll('[data-view]').forEach(b=>{const active=b===btn;b.setAttribute('aria-pressed',active);b.classList.toggle('btn-primary',active);});
    detail.innerHTML='<span class="text-muted">Select a place on the map.</span>';
    draw();
  }));
  new ResizeObserver(draw).observe(wrap);
  draw();
})();
</script>
`;

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(path.resolve(output), fragment, 'utf8');
