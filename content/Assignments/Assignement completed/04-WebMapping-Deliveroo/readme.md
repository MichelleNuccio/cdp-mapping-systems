# Assignment 04 — Web Mapping (Deliveroo Milano)

HAR capture and MapLibre web map for the Deliveroo Italian takeaway page in Milano.

## Source page
https://deliveroo.it/en/cuisines/italian-takeaway/milano

## Folder contents
- `inputs/deliveroo_milan.har` — captured request log
- `outputs/ip_locations.geojson` — geolocated server IPs
- `outputs/ip_map.html` — Folium preview from the course script
- `scrape_har_locations.py` — geolocation script
- `webmap/` — **MapLibre web map** (HTML / CSS / JS)

## Run the web map
1. Open the `webmap` folder in VS Code / Cursor
2. Right-click `webmap/index.html` → **Open with Live Server**  
   (or serve the parent `04-WebMapping-Deliveroo` folder so `../outputs/` resolves)

You should see request server locations on a dark basemap; click a point for IP + URL.
