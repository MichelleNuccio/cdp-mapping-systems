const GEOJSON_URL = "data/ip_locations.geojson";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [0, 30],
  zoom: 1.4,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

map.on("load", () => {
  fetch(GEOJSON_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load GeoJSON (${response.status})`);
      }
      return response.json();
    })
    .then((data) => {
      map.addSource("har-ips", {
        type: "geojson",
        data,
      });

      map.addLayer({
        id: "har-ips-halo",
        type: "circle",
        source: "har-ips",
        paint: {
          "circle-radius": 12,
          "circle-color": "#ff9fff",
          "circle-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "har-ips-points",
        type: "circle",
        source: "har-ips",
        paint: {
          "circle-radius": 6,
          "circle-color": "#675dff",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Fit map to features
      const bounds = new maplibregl.LngLatBounds();
      data.features.forEach((f) => {
        bounds.extend(f.geometry.coordinates);
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 5, duration: 800 });
      }

      map.on("mouseenter", "har-ips-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "har-ips-points", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "har-ips-points", (e) => {
        const feature = e.features[0];
        const { ip, url } = feature.properties;
        const [lon, lat] = feature.geometry.coordinates;

        new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat([lon, lat])
          .setHTML(
            `<strong>IP</strong> ${ip}<br/>` +
              `<strong>URL</strong> <a href="${url}" target="_blank" rel="noopener" style="color:#ff9fff;word-break:break-all;">${url}</a><br/>` +
              `<strong>Lon/Lat</strong> ${lon.toFixed(4)}, ${lat.toFixed(4)}`
          )
          .addTo(map);
      });
    })
    .catch((err) => {
      console.error(err);
      alert("Failed to load GeoJSON. Open this folder with Live Server.");
    });
});
