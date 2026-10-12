"""Build auditable website data from ownership CSV and route GeoJSON. No external data."""
import argparse,csv,json,re,unicodedata,collections
from pathlib import Path

def normalized(value):
 return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().casefold())

def build(csv_path,geo_path,website):
 rows=list(csv.DictReader(csv_path.open(encoding='utf-8-sig')))
 lookup={r['id'].strip():r for r in rows}
 assert len(lookup)==len(rows),'Duplicate ownership IDs'
 names=collections.defaultdict(list)
 for r in rows:names[normalized(r['name'])].append(r)
 aliases={'google':'Google','meta':'Meta','facebook':'Meta','microsoft':'Microsoft','amazon':'Amazon','amazon web services':'Amazon','aws':'Amazon'}
 def props(r,id,name):
  owners=[]
  for value in r.get('owners','').split(','):
   value=value.strip();value=aliases.get(value.casefold(),value)
   if value and value.casefold() not in [x.casefold() for x in owners]:owners.append(value)
  companies=[v for v in owners if v in set(aliases.values())]
  if r:
   for c in ['Google','Meta','Microsoft','Amazon']:
    assert (c in companies)==(r['has_'+c.lower()].strip().lower()=='true'),(id,c,'flag mismatch')
  year=r.get('rfs_year','').strip()
  if year:
   assert float(year).is_integer() and 1800<=float(year)<=2200,(id,year)
   year=str(int(float(year)))
  status=r.get('status','').strip()
  assert not status or status in ['In service','Planned','Projected'],(id,status)
  return {'id':id,'name':r.get('name') or name,'status':'Planned' if status=='Projected' else status or 'Unknown','source_status':status,'owners':owners,'companies':companies,'hybrid':bool(companies) and len(owners)>1,'ownership':'Unknown' if not owners else 'Telco / consortium' if not companies else 'Big tech only' if len(owners)==1 else 'Hybrid','length':r.get('length',''),'year':year,'ownership_known':bool(owners),'matched':bool(r),'has_route':False}
 source=json.loads(geo_path.read_text());groups={};recovered=[];unmatched=[];geom_count=0;point_count=0
 def route_lines(g):
  if g['type']=='LineString':return [g['coordinates']]
  if g['type']=='MultiLineString':return g['coordinates']
  if g['type']=='GeometryCollection':return [line for part in g['geometries'] for line in route_lines(part)]
  raise ValueError('Unexpected geometry: '+g['type'])
 for f in source['features']:
  p=f['properties'];rid=p['id'].strip();row=lookup.get(rid);method='id'
  if row is None:
   candidates=names[normalized(p['name'])]
   if len(candidates)==1:
    row=candidates[0];method='unique_normalized_name';recovered.append({'route_id':rid,'ownership_id':row['id'],'route_name':p['name'],'ownership_name':row['name']})
   else:method='unmatched';unmatched.append({'id':rid,'name':p['name']})
  id=row['id'].strip() if row else rid
  if id not in groups:groups[id]={'type':'Feature','properties':props(row or {},id,p['name']),'geometry':{'type':'MultiLineString','coordinates':[]}}
  target=groups[id];target['properties']['has_route']=True
  target['properties'].setdefault('source_route_ids',[])
  if rid not in target['properties']['source_route_ids']:target['properties']['source_route_ids'].append(rid)
  target['properties'].setdefault('source_feature_ids',[]).append(p.get('feature_id',rid))
  target['properties']['match_method']=method
  for line in route_lines(f['geometry']):
   assert len(line)>=2,(id,'short line')
   for coord in line:
    assert len(coord)>=2 and isinstance(coord[0],(int,float)) and isinstance(coord[1],(int,float)) and -180<=coord[0]<=180 and -90<=coord[1]<=90,(id,coord)
    point_count+=1
   # Preserve distinct branches but avoid drawing exact repeated line components.
   if line not in target['geometry']['coordinates']:target['geometry']['coordinates'].append(line)
   geom_count+=1
 records=[props(row,row['id'].strip(),row['name']) for row in rows]
 for p in records:p['has_route']=p['id'] in groups
 unmatched_records=[f['properties'] for f in groups.values() if not f['properties']['matched']]
 all_records=records+unmatched_records
 missing=[p for p in records if not p['has_route']]
 summary={'ownership_records':len(rows),'source_route_features':len(source['features']),'mapped_cables':len(groups),'mapped_with_ownership':sum(f['properties']['matched'] for f in groups.values()),'routes_without_ownership':len(unmatched_records),'ownership_without_routes':len(missing),'recovered_matches':len(recovered),'source_line_components':geom_count,'validated_coordinates':point_count,'mapped_undated':sum(not f['properties']['year'] for f in groups.values()),'csv_undated':sum(not p['year'] for p in records)}
 company_summary={}
 for c in ['Google','Meta','Microsoft','Amazon']:
  a=[p for p in records if c in p['companies']];m=[p for p in a if p['has_route']]
  company_summary[c]={'csv_cables':len(a),'mapped_cables':len(m),'without_route':len(a)-len(m),'sole_owner_csv':[p['name'] for p in a if len(p['owners'])==1],'sole_owner_mapped':[p['name'] for p in m if len(p['owners'])==1]}
 audit={'summary':summary,'company_summary':company_summary,'recovered_matches':recovered,'routes_without_ownership':unmatched,'ownership_without_routes':missing,'multi_feature_cables':[{'id':f['properties']['id'],'features':f['properties']['source_feature_ids']} for f in groups.values() if len(f['properties']['source_feature_ids'])>1]}
 data={'type':'FeatureCollection','features':list(groups.values()),'records':all_records,'audit':{'summary':summary,'company_summary':company_summary,'recovered_matches':recovered}}
 (website/'data/marine-cables.json').write_text(json.dumps(data,separators=(',',':')))
 (website/'asset/js/marine-cables-data.js').write_text('window.marineCablesData = '+json.dumps(data,separators=(',',':'))+';\n')
 (website/'data/marine-cables-audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False))
 print(json.dumps({'summary':summary,'companies':company_summary},indent=2))
 return audit
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('ownership',type=Path);parser.add_argument('routes',type=Path);parser.add_argument('website',type=Path);args=parser.parse_args();build(args.ownership,args.routes,args.website)
