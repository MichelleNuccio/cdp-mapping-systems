//BLOCK 1 - STRICT MODE
// helps detect mistakes, such as using undeclared variables
'use strict';

// BLOCK 2 - PAGE ELEMENTS
// These IDs match the IDs in the HTML file.
const mapStatus = document.getElementById('map-status');
const lengthFilter = document.getElementById('length-filter');
const colorToggle = document.getElementById('color-toggle');

// BLOCK — CANVAS ELEMENTS
// Get the drawing surface and its two-dimensional drawing tools.
const canvas = document.getElementById("map-canvas");
const context = canvas.getContext("2d");

// BLOCK 3 - DATA STORAGE
// This empty arrays will hold the feature loaded from each GeoJSON file
let cableFeatures = [];
let landingPointFeatures = [];

// Store each cable and its associated route segments and landing points.
// Keys are cable IDs converted to strings.
const cablesById = new Map();

// BLOCK 4 - GEOJSON LOADING FUNCTION
// This reusable funtion loads a file and returns its feautures.
// async allow us to use await whilw waiting for the response.
async function loadGeoJSON(url) {

    //request the file from the server
    const response = await fetch(url);

    //check for HTTP errors, such a missing file (404).
    if (!response.ok) {
        throw new Error(
            `Unable to load ${url}: HTTP ${response.status}`
        );
    }
    
    // Convert the JSON response into a JavaScript object.
    const data = await response.json();

    //Check that the file contains the expected GeoJSON structure.
    if (
        data.type !== 'FeatureCollection' || 
        !Array.isArray(data.features)
    ) {
        throw new Error(`Invalid GeoJSON structure in ${url}`);
    }

    // Return the array of features extracted from the GeoJSON file.
    return data.features;
}

// BLOCK 5 - CONNECT CABLES AND LANDING POINTS
// Group route segments and landing points by their shared cable_id.
function connectCablesAndLandings() {
    // Remove previous entries in case the data is loaded again.
    cablesById.clear();

    // Group all route segments belonging to the same cable.
    for (const feature of cableFeatures) {
        const properties = feature.properties;
        const rawId = properties?.cable_id;

        // Skip features that do not identify a cable.
        if (rawId === undefined || rawId === null || rawId === "") {
            continue;
        }

        // Cable IDs are numbers in the route dataset and strings
        // in the landing dataset. Use strings for both.
        const cableId = String(rawId);

        // Create one entry when this cable is encountered for the first time.
        if (!cablesById.has(cableId)) {
            cablesById.set(cableId, {
                id: cableId,
                name: properties.name,
                length: properties.length,
                owners: properties.owners,
                segments: [],
                landingPoints: []
            });
        }

        // Add this route segment to the corresponding cable.
        const cable = cablesById.get(cableId);
        cable.segments.push(feature);
    }

    // Count landing records whose cable has no route in this dataset.
    let unmatchedLandings = 0;

    // Associate each landing point with its cable.
    for (const feature of landingPointFeatures) {
        const rawId = feature.properties?.cable_id;

        // Look up the cable using the same string format.
        const cable = rawId === undefined || rawId === null
            ? undefined
            : cablesById.get(String(rawId));

        // Keep track of missing matches without inventing a route.
        if (!cable) {
            unmatchedLandings += 1;
            continue;
        }

        // Store the landing feature, including its geographic coordinates.
        cable.landingPoints.push(feature);
    }

    // Show the grouped data and unmatched record count for inspection.
    console.log("Cables with associated landing points:", cablesById);
    console.log("Landing records without a matching route:", unmatchedLandings);
}

// BLOCK — DRAW THE MAP
// Resize the canvas and draw geographic features using a simple
// equirectangular projection: longitude becomes x, latitude becomes y.
function drawMap() {
    // Read the canvas dimensions defined by CSS.
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Skip drawing if the canvas has no visible area.
    if (width === 0 || height === 0) {
        return;
    }

    // Increase the drawing resolution on high-density screens.
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    // Keep drawing coordinates expressed in CSS pixels.
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    // Fit the world into the available area without stretching it.
    // Longitude covers 360 degrees; latitude covers 180 degrees.
    const padding = 8;
    const scale = Math.max(
        0,
        Math.min(
            (width - padding * 2) / 360,
            (height - padding * 2) / 180
        )
    );

    // Center the projected world inside the canvas.
    const offsetX = (width - 360 * scale) / 2;
    const offsetY = (height - 180 * scale) / 2;

    // Convert a GeoJSON coordinate [longitude, latitude] into [x, y].
    // Screen y increases downward, so latitude must be inverted.
    function project(coordinate) {
        const [longitude, latitude] = coordinate;

        return [
            offsetX + (longitude + 180) * scale,
            offsetY + (90 - latitude) * scale
        ];
    }

    // Draw cable routes as thin white lines.
    context.strokeStyle = "rgba(255, 255, 255)";
    context.lineWidth = 0.35;

    for (const feature of cableFeatures) {
        const geometry = feature.geometry;

        // The current dataset stores cable segments as LineStrings.
        if (!geometry || geometry.type !== "LineString") {
            continue;
        }

        context.beginPath();
        let previousLongitude = null;

        for (const coordinate of geometry.coordinates) {
            const [longitude, latitude] = coordinate;

            // Break the path if a coordinate is invalid.
            if (
                !Number.isFinite(longitude) ||
                !Number.isFinite(latitude)
            ) {
                previousLongitude = null;
                continue;
            }

            const [x, y] = project(coordinate);

            // Start a new path at the first point or a dateline crossing.
            // This avoids drawing a line across the entire world.
            if (
                previousLongitude === null ||
                Math.abs(longitude - previousLongitude) > 180
            ) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }

            previousLongitude = longitude;
        }

        context.stroke();
    }

    // Draw landing points as white crosses above the cable routes.
  context.strokeStyle = "#0000ff";
  context.lineWidth = 0.5;

// Define the distance from the center to each end of the cross.
const crossSize = 2.5;

    for (const feature of landingPointFeatures) {
        const geometry = feature.geometry;

        // Landing locations must be Point geometries.
        if (!geometry || geometry.type !== "Point") {
            continue;
        }

        const [longitude, latitude] = geometry.coordinates;

        // Ignore coordinates that cannot be projected.
        if (
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude)
        ) {
            continue;
        }

        const [x, y] = project(geometry.coordinates);

        // Draw a small cross centered on the landing location.
        context.beginPath();
        context.moveTo(x - crossSize, y);
        context.lineTo(x + crossSize, y);
        context.moveTo(x, y - crossSize);
        context.lineTo(x, y + crossSize);
        context.stroke();
    }
}

// BLOCK 6 - INITIALIZATION
// Load both datasets and display a summary in the page footer.
async function initializeMap() {

    //Keep the controls disabled until their behavior is implemented.
    lengthFilter.disabled = true;
    colorToggle.disabled = true;

    mapStatus.textContent = 'Loading cable routes and landing points...';

    try {
        //load both file concurrently
        // Paths are relative to the HTML page, not to this JavaScript file.
        const results = await Promise.all([
            loadGeoJSON('../data/submarine_cables.geojson'),
            loadGeoJSON('../data/landing_points.geojson')
        ]);

        // Results follow the same ordere as the requests above.
        cableFeatures = results[0];
        landingPointFeatures = results[1];

        // Build the associations after both datasets have loaded.
        connectCablesAndLandings();

        // Draw the routes and landing points after loading the data.
        drawMap();

        // Collect unique cable IDs: several route segments may share an ID
        // Convert IDs to strings to make numeric and text IDs comparable.
        // A set keeps each ID only once.
        const cableIds = new Set(
            cableFeatures
            .map(feature => feature.properties?.cable_id)
            .filter(id => id !== undefined && id !== null && id !=="")
            .map(id => String(id))
        );

        // Display separate counts for cables, segments, and landing records.
        mapStatus.textContent =
            `${cableIds.size} cables · ` +
            `${cableFeatures.length} route segments · ` +
            `${landingPointFeatures.length} landing point records loaded`;

        // Inspect one feature from each dataset in the browser console.
        console.log("First cable segment:", cableFeatures[0]);
        console.log("First landing point:", landingPointFeatures[0]);

     } catch (error) {
        // Display a readable message if either file fails to load.
        mapStatus.textContent =
            "Unable to load map data. See the browser console."

         // Keep the technical error available for debugging.
        console.error("Data loading failed:", error);
    }
}

// Redraw whenever the map container changes size.
// This also handles layout changes that affect the canvas dimensions.
const mapResizeObserver = new ResizeObserver(drawMap);
mapResizeObserver.observe(canvas.parentElement);

// BLOCK 7 - START
// Call the initialization function.
// The defer attribute in the HTML ensures the page elements already exist.
initializeMap();