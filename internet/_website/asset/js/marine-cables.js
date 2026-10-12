(() => {
  'use strict';
  const canvas = document.getElementById('marine-map');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('map-status');
  const yearFilter = document.getElementById('year-filter');
  const yearValue = document.getElementById('year-value');
  let lastYear = 0;
  function serviceYear(p) {
    const year = Number(p.year);
    return Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null;
  }
  const statusFilter = document.getElementById('status-filter');
  const ownerInputs = [...document.querySelectorAll('input[name="big-tech"]')];
  const colors = {'Google':'#ff00ff','Meta':'#0000ff','Microsoft':'#00ffff','Amazon':'#ffff00'};
  let features = [], records = [], visible = [], projected = [], selected = null;
  let selectedCompanies = [];
  let width = 0, height = 0;
  function lines(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'LineString') return [geometry.coordinates];
    if (geometry.type === 'MultiLineString') return geometry.coordinates;
    if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(lines);
    return [];
  }
  function details(feature) {
    const p = feature?.properties;
    document.getElementById('cable-year').textContent = p ? `Recorded service year: ${serviceYear(p) ?? 'Unknown'}${p.status === 'Planned' ? ' · Scheduled' : ''}` : 'Hover or tap a route to inspect its recorded details.';
    for (const key of ['name','status','owners','ownership','length']) {
      document.getElementById(`cable-${key}`).textContent = p ? (key === 'owners' ? p.owners.join(', ') : p[key]) || '—' : '—';
    }
  }
  function path(points) {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  }
  function stroke(points, color, dash, offset, alpha, lineWidth) {
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash); ctx.lineDashOffset = offset; path(points); ctx.stroke();
  }
  // Line patterns describe ownership only, independent of operational status.
  function ownershipDash(p) {
    if (!p.owners.length) return [1, 3];
    return p.owners.length > 1 ? [4, 2] : [];
  }
  function draw() {
    ctx.clearRect(0,0,width,height);
    for (const route of projected) {
      const p = route.feature.properties;
      const palette = selectedCompanies.length
        ? p.companies.filter(c=>selectedCompanies.includes(c)).map(c=>colors[c])
        : ['#ffffff'];
      const dash = ownershipDash(p);
      for (const points of route.lines) {
        palette.forEach((color,i) => {
          // Alternate the selected company colors along shared, dashed routes.
          const pattern = palette.length > 1 ? [4, 6*palette.length-4] : dash;
          stroke(points,color,pattern,-i*6,.08,1);
          stroke(points,color,pattern,-i*6,p.owners.length ? .85 : .4,.35);
        });
      }
    }
    if (selected) {
      const route = projected.find(r=>r.feature === selected);
      if (route) for (const points of route.lines) stroke(points,selectedCompanies.length ? '#ffffff' : '#ff00ff',ownershipDash(selected.properties),0,1,1.2);
    }
    ctx.globalAlpha=1; ctx.setLineDash([]);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width=rect.width; height=rect.height;
    const ratio=window.devicePixelRatio || 1;
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
    const scale=Math.min(Math.max(0,width-8)/360,Math.max(0,height-8)/180);
    const x0=(width-360*scale)/2, y0=(height-180*scale)/2;
    projected=visible.map(feature=>({feature,lines:lines(feature.geometry).flatMap(line=>{
      // Split dateline crossings instead of drawing a line across the world.
      const parts=[]; let part=[], last=null;
      for (const coord of line) {
        if (!Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) continue;
        if (last && Math.abs(coord[0]-last[0])>180) {if(part.length>1)parts.push(part);part=[];}
        part.push([x0+(coord[0]+180)*scale,y0+(90-coord[1])*scale]);last=coord;
      }
      if(part.length>1)parts.push(part);return parts;
    })}));
    draw();
  }
  function filter() {
    selectedCompanies = ownerInputs.filter(input=>input.checked).map(input=>input.value);
    const cutoff = Number(yearFilter.value);
    const allYears = cutoff > lastYear;
    yearValue.textContent = allYears ? 'All years' : `≤ ${cutoff}`;
    yearFilter.setAttribute('aria-valuetext',allYears ? 'All years, including undated cables' : `Recorded service year up to ${cutoff}`);
    const matchesFilters = f => (statusFilter.value === 'all' || f.properties.status === statusFilter.value)
      && (!selectedCompanies.length || f.properties.companies.some(c=>selectedCompanies.includes(c)));
    const inTime = p => allYears || (serviceYear(p) !== null && serviceYear(p) <= cutoff);
    const matching = features.filter(matchesFilters);
    const undated = matching.filter(f=>serviceYear(f.properties) === null).length;
    visible=matching.filter(f=>inTime(f.properties));
    const missing = records.filter(p=>p.matched && !p.has_route && matchesFilters({properties:p}) && inTime(p));
    selected=null;details(null);resize();
    const unknownOwners = visible.filter(f=>!f.properties.owners.length).length;
    status.textContent=`${visible.length} mapped cables · ${missing.length} without routes · ${unknownOwners} mapped with unknown ownership`;
    document.getElementById('timeline-note').textContent = `${allYears ? 'All dated cables' : 'Cumulative recorded years'} · ${undated} undated ${allYears ? 'included' : 'excluded'}`;
    const summary = document.getElementById('coverage-summary');
    summary.textContent = `${missing.length} dataset cables without routes`;
    const list = document.getElementById('unmapped-cables');
    list.replaceChildren();
    for (const p of missing.sort((a,b)=>a.name.localeCompare(b.name))) {
      const item = document.createElement('li');
      const name = document.createElement('strong');name.textContent=p.name;
      const meta = document.createElement('span');
      const ownership = !p.owners.length ? 'Unknown ownership' : p.owners.length === 1 ? 'Single owner' : 'Multiple owners';
      meta.textContent=`${p.owners.join(', ') || 'Owners unavailable'} · ${ownership} · ${p.status} · ${serviceYear(p) ?? 'Year unknown'}`;
      item.append(name,meta);list.append(item);
    }
    if (!missing.length) {
      const item = document.createElement('li');item.textContent='All matching cables have a route in this dataset.';list.append(item);
    }
  }
  function distance(x,y,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
  }
  function inspect(event) {
    const rect=canvas.getBoundingClientRect();const x=event.clientX-rect.left,y=event.clientY-rect.top;
    let best=6,found=null;
    for(const route of projected) for(const line of route.lines) for(let i=1;i<line.length;i++) {
      const d=distance(x,y,line[i-1],line[i]);if(d<best){best=d;found=route.feature;}
    }
    if(found!==selected){selected=found;details(found);draw();}
    canvas.style.cursor=found?'pointer':'default';
  }
  canvas.addEventListener('pointermove',inspect);
  canvas.addEventListener('click',inspect);
  canvas.addEventListener('pointerleave',()=>{selected=null;details(null);draw();});
  yearFilter.addEventListener('input',filter);
  statusFilter.addEventListener('change',filter);
  ownerInputs.forEach(input=>input.addEventListener('change',filter));
  new ResizeObserver(resize).observe(canvas.parentElement);
  try {
    if(!window.marineCablesData?.features?.length)throw new Error('Missing cable data');
    features=window.marineCablesData.features;
    records=window.marineCablesData.records;
    const years = records.map(p=>serviceYear(p)).filter(year=>year !== null);
    if (years.length) {
      lastYear = Math.max(...years);
      yearFilter.min = String(Math.min(...years));
      yearFilter.max = String(lastYear + 1);
      yearFilter.value = yearFilter.max;
      yearFilter.disabled = false;
    }
    filter();
  } catch(error) {
    status.textContent='Unable to load cable data. Check that marine-cables-data.js is available.';
    yearFilter.disabled=true;statusFilter.disabled=true;ownerInputs.forEach(input=>input.disabled=true);console.error(error);
  }
})();
