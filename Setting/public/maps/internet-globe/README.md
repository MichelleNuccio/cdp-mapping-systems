# Internet ownership globe

Source: screenshot of page 5 of **Mapping Systems 2026 Presentation.pdf**.
The matching ownership map is generated in `content/Assignments/Assignement completed/01-SubmarinesCables.ipynb`, cell index 15 (the 16th cell), starting with “Ownership-coloured copy of the 3B landing-point map”. The PDF itself is not present in this repository.

The globe reuses the cached TeleGeography cable geometry, metadata and landing points, plus GMRT bathymetry. The exporter reads the palette and exact ownership classifier from that notebook. All 718 route features and 1,922 landing points are retained. Planned routes remain dashed; the same 17 bathymetric levels are converted to vector contours (coordinates rounded to five decimals).

Open `index.html` in a browser with internet access for MapLibre GL JS 5.6.2, or serve `public` and visit `/maps/internet-globe/`. No API key is required. This is an interactive companion to the deck; it does not modify the PDF.

Regenerate data from the repository root:

```sh
python -m pip install numpy scipy contourpy
python scripts/build-internet-globe.py
```

Drag/zoom to explore. Click routes for metadata; legend buttons toggle owners, landing points and planned routes. Rotation is opt-in and stops when dragging. “Mappa piana” switches projection.
