// Get the canvas, drawing context, and status element
const canvas = document.getElementById("ip-map");
const context = canvas.getContext("2d");
const mapStatus = document.getElementById("map-status");

// Get the compact city detail fields
const fields = {
  city: document.getElementById("city-name"),
  region: document.getElementById("city-region"),
  country: document.getElementById("city-country"),
  ipCount: document.getElementById("city-ip-count"),
  matchCount: document.getElementById("city-match-count")
};

// Get the color toggle, legend, and slider
const colorToggle = document.getElementById("color-toggle");
const legendGradient = document.getElementById("legend-gradient");
const legendMin = document.getElementById("legend-min");
const legendMax = document.getElementById("legend-max");
const ipFilter = document.getElementById("ip-filter");
const filterValue = document.getElementById("filter-value");

// Preserve current point sizes and hover distance
const numberFormat = new Intl.NumberFormat("en-US");
const pointRadius = 0.5;
const highlightRadius = 0.75;
const hoverDistance = 6;

// Preserve the current palette
const colors = [
  "#ff00ffFF", // Magenta
  "#0000ff",   // Blue
  "#00ffff",   // Turquoise
  "#00ff00",   // Green
  "#ffff00"    // Yellow
];

// Convert the palette to RGB for color interpolation
const rgbStops = colors.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
]);

// Display the same palette in the legend
legendGradient.style.background =
  `linear-gradient(to right, ${colors.join(", ")})`;

// Store city data and exact IP-count groups
let cities = [];
let points = [];
const groups = new Map();

// Store interaction and filter state
let hoveredCity = null;
let colorMode = false;
let minimumIpCount = 0;
let smallestIpCount = 0;
let largestIpCount = 0;
let minLogCount = 0;
let maxLogCount = 1;

// Store canvas dimensions and the fitted map rectangle
let width = 0;
let height = 0;
let mapWidth = 0;
let mapHeight = 0;
let offsetX = 0;
let offsetY = 0;

// Cache group colors because the color scale stays fixed
const groupColors = new Map();

// Calculate a fully opaque color using a logarithmic scale
function getPointColor(ipCount) {
  const range = maxLogCount - minLogCount;

  const value = range > 0
    ? (Math.log10(ipCount) - minLogCount) / range
    : 0.5;

  const position =
    Math.max(0, Math.min(1, value)) * (rgbStops.length - 1);

  const index = Math.min(
    Math.floor(position),
    rgbStops.length - 2
  );

  const fraction = position - index;

  // Interpolate between neighboring palette colors
  const rgb = rgbStops[index].map((channel, channelIndex) =>
    Math.round(
      channel +
      (rgbStops[index + 1][channelIndex] - channel) * fraction
    )
  );

  return `rgb(${rgb.join(",")})`;
}

// Project coordinates into the centered map rectangle
function project(city) {
  return {
    x: offsetX + ((city.longitude + 180) / 360) * mapWidth,
    y: offsetY + ((90 - city.latitude) / 180) * mapHeight,
    city
  };
}

// Draw one point while preserving the current semicircle shape
function addPoint(point, radius) {
  context.moveTo(point.x + radius, point.y);
  context.arc(
    point.x,
    point.y,
    radius,
    0,
    Math.PI * 1
  );
}

// Draw visible groups and the hover highlight
function draw() {
  if (!width || !height) return;

  context.clearRect(0, 0, width, height);

  // Draw all groups above the minimum IP-count threshold
  for (const [ipCount, groupPoints] of groups) {
    if (ipCount < minimumIpCount) continue;

    context.fillStyle = colorMode
      ? groupColors.get(ipCount)
      : "#ffffff";

    context.beginPath();

    for (const point of groupPoints) {
      addPoint(point, pointRadius);
    }

    context.fill();
  }

  // Highlight matching cities only while hovering
  if (!hoveredCity || hoveredCity.ip_count < minimumIpCount) {
    return;
  }

  context.fillStyle = colorMode ? "#ffffff" : "#ff00ff";
  context.beginPath();

  for (const point of groups.get(hoveredCity.ip_count) || []) {
    addPoint(point, highlightRadius);
  }

  context.fill();
}

// Update the compact city details
function updatePanel(city) {
  fields.city.textContent = city ? city.city : "—";
  fields.region.textContent = city ? city.region : "—";
  fields.country.textContent = city ? city.country : "—";

  fields.ipCount.textContent = city
    ? numberFormat.format(city.ip_count)
    : "—";

  fields.matchCount.textContent = city
    ? numberFormat.format(groups.get(city.ip_count)?.length || 0)
    : "—";
}

// Display the number of cities remaining after filtering
function updateMapStatus() {
  let visibleCount = 0;

  for (const [ipCount, groupPoints] of groups) {
    if (ipCount >= minimumIpCount) {
      visibleCount += groupPoints.length;
    }
  }

  mapStatus.textContent =
    `${numberFormat.format(visibleCount)} of ` +
    `${numberFormat.format(cities.length)} cities visible. ` +
    "Hover to compare IP counts.";
}

// Apply a logarithmic minimum IP-count filter
function updateFilter() {
  if (!cities.length) return;

  const sliderMin = Number(ipFilter.min);
  const sliderMax = Number(ipFilter.max);

  const fraction = Math.max(
    0,
    Math.min(
      1,
      (Number(ipFilter.value) - sliderMin) /
      (sliderMax - sliderMin)
    )
  );

  // Preserve exact values at both slider endpoints
  if (fraction === 0) {
    minimumIpCount = smallestIpCount;
  } else if (fraction === 1) {
    minimumIpCount = largestIpCount;
  } else {
    minimumIpCount = Math.round(
      10 ** (
        minLogCount +
        fraction * (maxLogCount - minLogCount)
      )
    );
  }

  // Update the visible and accessible slider values
  filterValue.textContent = numberFormat.format(minimumIpCount);

  ipFilter.setAttribute(
    "aria-valuetext",
    `Minimum ${numberFormat.format(minimumIpCount)} IP addresses`
  );

  // Clear hover state when the filter changes
  hoveredCity = null;
  canvas.style.cursor = "default";

  updatePanel(null);
  updateMapStatus();
  draw();
}

// Fit the complete world inside the available canvas
function resizeMap() {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  width = bounds.width;
  height = bounds.height;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  // Preserve the 2:1 world proportions without cropping
  const padding = 4;
  const availableWidth = Math.max(0, width - padding * 2);
  const availableHeight = Math.max(0, height - padding * 2);

  mapWidth = Math.min(availableWidth, availableHeight * 2);
  mapHeight = mapWidth / 2;

  offsetX = (width - mapWidth) / 2;
  offsetY = (height - mapHeight) / 2;

  // Rebuild projected points and groups after resizing
  points = cities.map(project);
  groups.clear();

  for (const point of points) {
    const ipCount = point.city.ip_count;

    if (!groups.has(ipCount)) {
      groups.set(ipCount, []);
    }

    groups.get(ipCount).push(point);
  }

  draw();
}

// Switch between white and colored map modes
colorToggle.addEventListener("click", () => {
  colorMode = !colorMode;

  colorToggle.setAttribute("aria-pressed", String(colorMode));
  colorToggle.textContent = colorMode ? "White map" : "Color map";

  draw();
});

// Apply filtering continuously while dragging
ipFilter.addEventListener("input", updateFilter);

// Find the closest visible city to the pointer
canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - bounds.left;
  const mouseY = event.clientY - bounds.top;

  let nearestCity = null;
  let nearestDistance = hoverDistance ** 2;

  for (const point of points) {
    if (point.city.ip_count < minimumIpCount) continue;

    const distance =
      (point.x - mouseX) ** 2 +
      (point.y - mouseY) ** 2;

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCity = point.city;
    }
  }

  // Redraw only when the hovered city changes
  if (nearestCity !== hoveredCity) {
    hoveredCity = nearestCity;
    canvas.style.cursor = hoveredCity ? "pointer" : "default";

    updatePanel(hoveredCity);
    draw();
  }
});

// Clear highlighting when the pointer leaves the map
canvas.addEventListener("pointerleave", () => {
  hoveredCity = null;
  canvas.style.cursor = "default";

  updatePanel(null);
  draw();
});

// Load and validate the city data exported from Python
async function loadCities() {
  try {
    const response = await fetch(
      new URL("../data/cities.json", document.baseURI)
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("cities.json must contain an array.");
    }

    // Keep records with valid coordinates and positive IP counts
    cities = data.filter((city) =>
      city !== null &&
      typeof city === "object" &&
      typeof city.city === "string" &&
      typeof city.region === "string" &&
      typeof city.country === "string" &&
      Number.isFinite(city.latitude) &&
      Number.isFinite(city.longitude) &&
      Math.abs(city.latitude) <= 90 &&
      Math.abs(city.longitude) <= 180 &&
      Number.isSafeInteger(city.ip_count) &&
      city.ip_count > 0
    );

    if (!cities.length) {
      throw new Error("No valid cities found.");
    }

    // Calculate the fixed global color scale limits
    smallestIpCount = Infinity;
    largestIpCount = -Infinity;

    for (const city of cities) {
      smallestIpCount = Math.min(smallestIpCount, city.ip_count);
      largestIpCount = Math.max(largestIpCount, city.ip_count);
    }

    minLogCount = Math.log10(smallestIpCount);
    maxLogCount = Math.log10(largestIpCount);

    // Cache colors for each distinct IP count
    groupColors.clear();

    for (const city of cities) {
      if (!groupColors.has(city.ip_count)) {
        groupColors.set(
          city.ip_count,
          getPointColor(city.ip_count)
        );
      }
    }

    // Populate the legend and enable the filter
    legendMin.textContent = numberFormat.format(smallestIpCount);
    legendMax.textContent = numberFormat.format(largestIpCount);

    ipFilter.disabled = false;

    // Fit the map and apply the initial filter
    resizeMap();
    updateFilter();

  } catch (error) {
    mapStatus.textContent =
      `Unable to load the map: ${error.message} ` +
      "Check cities.json and open the page with Live Server.";

    console.error(error);
  }
}

// Keep the full map visible when the viewport changes
const resizeObserver = new ResizeObserver(resizeMap);
resizeObserver.observe(canvas);

// Start the application
loadCities();