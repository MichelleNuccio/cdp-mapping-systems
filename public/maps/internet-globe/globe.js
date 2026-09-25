/* Data and styling originate in 01-SubmarinesCables.ipynb, cell 15. */
const status = document.querySelector('#status');
try {
  if (!window.maplibregl || !window.GLOBE_DATA) throw new Error('Libreria o dati non disponibili. Verifica la connessione e ricarica.');
  const data = window.GLOBE_DATA;
  const map = new maplibregl.Map({container:'map',center:[-25,20],zoom:1.65, minZoom:0,maxZoom:8,
    style:{version:8,projection:{type:'globe'},sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#090A18'}}]},attributionControl:false});
  window.globeMap = map;
  map.addControl(new maplibregl.NavigationControl(),'top-right');
  map.addControl(new maplibregl.FullscreenControl(),'top-right');
  map.addControl(new maplibregl.AttributionControl({customAttribution:'TeleGeography · GMRT v4.5',compact:true}));
  map.on('error', e => {status.textContent='Errore di rendering: '+e.error.message;});
  let rotating=false, flat=false, last=0, planned=true;
  const groups=new Set(Object.keys(data.palette));
  const layers=[];
  function filters(){for(const {id,group,isPlanned} of layers)map.setLayoutProperty(id,'visibility',groups.has(group)&&(!isPlanned||planned)?'visible':'none');}
  function button(label,color,action){const b=document.createElement('button');b.setAttribute('aria-pressed','true');const swatch=document.createElement('i');swatch.style.setProperty('--color',color);b.append(swatch,document.createTextNode(label));b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));action(on);};document.querySelector('#legend').append(b);return b;}
  map.on('load',()=>{
    for(const name of ['bathymetry','cables','landing']) map.addSource(name,{type:'geojson',data:data[name],tolerance:name==='bathymetry'?0.5:0.05,attribution:name==='bathymetry'?'GMRT':'TeleGeography'});
    map.addLayer({id:'bathymetry',type:'line',source:'bathymetry',paint:{'line-color':'#30344F','line-width':0.5,'line-opacity':0.75}});
    for(const group of ['Telco / consortium','Unknown','Amazon','Microsoft','Meta','Google','Multiple big tech']){
      for(const isPlanned of [false,true]){
        const id='route-'+layers.length;const context=['Telco / consortium','Unknown'].includes(group);
        const paint={'line-color':data.palette[group],'line-width':context?1.2:isPlanned?0.9:0.7,'line-opacity':context?(isPlanned?0.45:0.35):(isPlanned?0.95:0.92)};
        if(isPlanned)paint['line-dasharray']=[3,2];
        map.addLayer({id,type:'line',source:'cables',filter:['all',['==',['get','group'],group],['==',['get','planned'],isPlanned]],paint});
        layers.push({id,group,isPlanned});
      }
    }
    const size=12, pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x>=5&&x<=6)||(y>=5&&y<=6)){const i=(y*size+x)*4;pixels.set([255,255,255,242],i);}
    map.addImage('cross',{width:size,height:size,data:pixels},{pixelRatio:2});
    map.addLayer({id:'landing',type:'symbol',source:'landing',layout:{'icon-image':'cross','icon-size':0.4,'icon-allow-overlap':true,'icon-ignore-placement':true}});
    for(const [group,color] of Object.entries(data.palette)){
      if(!data.cables.features.some(f=>f.properties.group===group))continue;
      button(group,color,on=>{on?groups.add(group):groups.delete(group);filters();});
    }
    button('+ Landing point','#FFFFFF',on=>map.setLayoutProperty('landing','visibility',on?'visible':'none'));
    const b=button('Planned route','#B7F4E8',on=>{planned=on;filters();});b.querySelector('i').style.borderTopStyle='dashed';
    status.textContent=`${data.cables.features.length} rotte · ${data.landing.features.length} approdi · Dati della mappa originale`;
    map.on('click',e=>{
      const nearby=map.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]],{layers:layers.map(l=>l.id).concat('landing')});
      if(!nearby.length)return;
      const p=nearby[0].properties, el=document.createElement('div'), title=document.createElement('strong');title.textContent=p.name;title.style.color=p.color||'#fff';el.append(title);
      for(const text of p.group?[p.group,p.owners,p.planned?'Planned route':'In service',p.rfs?`RFS ${p.rfs}`:'',p.length||'']:['Landing point'])if(text){const row=document.createElement('div');row.textContent=text;el.append(row);}
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(el).addTo(map);
    });
  });
  const rotation=document.querySelector('#rotate');
  function stop(){rotating=false;rotation.setAttribute('aria-pressed','false');}
  map.on('dragstart',stop);map.on('zoomstart',e=>{if(e.originalEvent)stop();});
  rotation.onclick=()=>{rotating=!rotating;rotation.setAttribute('aria-pressed',String(rotating));};
  document.querySelector('#reset').onclick=()=>{stop();map.flyTo({center:[-25,20],zoom:1.65,bearing:0,pitch:0});};
  document.querySelector('#flat').onclick=e=>{flat=!flat;map.setProjection({type:flat?'mercator':'globe'});e.target.setAttribute('aria-pressed',String(flat));};
  function frame(t){if(rotating&&!document.hidden){const c=map.getCenter();map.jumpTo({center:[c.lng+Math.min(t-last,50)*0.003,c.lat]});}last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
} catch(error){status.textContent=error.message;}
