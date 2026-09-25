"""Export the ownership map (notebook cell 15) without refreshing its source data.
Requires numpy, scipy, contourpy. Run from any directory.
"""
import json
from pathlib import Path
import numpy as np
from scipy.io import netcdf_file
import contourpy
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'content/Assignments/01-Data/marine-cables'
OUT = ROOT / 'public/maps/internet-globe'
OUT.mkdir(parents=True, exist_ok=True)
notebook = json.loads((ROOT / 'content/Assignments/Assignement completed/01-SubmarinesCables.ipynb').read_text())
source = ''.join(notebook['cells'][15]['source'])
# Reuse the original palette and classifier, not an approximation of the screenshot.
class PandasCompat:
    @staticmethod
    def isna(value): return value != value
scope = {'pd': PandasCompat}
exec(source[source.index('neon_palette ='):source.index('ownership_meta =')], scope)
meta = {r['id']:r for r in json.loads((DATA/'cable-metadata.json').read_text())['records']}
cables = json.loads((DATA/'cable-geo.json').read_text())
for feature in cables['features']:
    p = feature['properties']; m = meta.get(p['id'], {})
    group = scope['ownership_group'](m.get('owners'))
    p.update(group=group, color=scope['ownership_colors'][group], planned=m.get('is_planned') is True, owners=m.get('owners') or 'Unknown', rfs=m.get('rfs_year'), length=m.get('length'))
with netcdf_file(DATA/'gmrt_global_topography.nc', mmap=False) as nc:
    w,h = nc.variables['dimension'][:].astype(int)
    x = np.linspace(*nc.variables['x_range'][:], w)
    y = np.linspace(*nc.variables['y_range'][:][::-1], h)
    z = nc.variables['z'][:].copy().reshape(h,w)
z = np.where(z < 0, z, np.nan)
contours = contourpy.contour_generator(x=x, y=y[::-1], z=z[::-1])
features=[]
for depth in [-8000,-7000,-6000,-5000,-4000,-3000,-2000,-1000,-900,-800,-700,-600,-500,-400,-300,-200,-100]:
    for line in contours.lines(depth):
        features.append({'type':'Feature','properties':{'depth':depth},'geometry':{'type':'LineString','coordinates':np.round(line,5).tolist()}})
payload = {'palette':scope['ownership_colors'], 'cables':cables,'landing':json.loads((DATA/'landing-point-geo.json').read_text()),'bathymetry':{'type':'FeatureCollection','features':features}}
(OUT/'data.js').write_text('window.GLOBE_DATA='+json.dumps(payload,separators=(',',':'))+';\n')
print(f"Exported {len(cables['features'])} routes, {len(payload['landing']['features'])} landing points, {len(features)} contours")
