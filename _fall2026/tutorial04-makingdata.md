# Tutorial 04 — Making Data

## Dataset documentation: submarine cable histories and geographies

This document describes the data stored in [Assignment 02 Making Data + Narrative Building/data](<Assignments/Assignment 02 Making Data + Narrative Building/data>): their formats, sources, documented acquisition and processing methods, and contribution to [Tutorial 04 — Making Data](https://designpractices.org/tutorials/04-making-data/) and [Assignment 02 — Making Data + Narrative Building](https://designpractices.org/assignments/02-making-data/).

The project investigates how the history of submarine telecommunications can be translated into geographic information. The main data gap is that historical cable chronologies describe connections through dates and place names rather than providing ready-to-map coordinates and geometries. The folder combines two ways of addressing this gap: converting textual records into geocoded points and tracing a cable route from an archival image. Existing cable geometry, land, bathymetry, and coordinate grids provide context.

Provenance below is based on the local README files, source snapshots, database tables, and accompanying notebook. These distinguish documented processing from acquisition details that have not been preserved. File counts were checked on October 30, 2026; source consultation dates are those recorded in the local documentation.

## 1. Data inventory

All paths in this table are relative to the assignment's `data` folder.

| File or folder | Data type and contents | Origin and role |
| --- | --- | --- |
| `historical/worldwide/` | GeoPackage point layers and attribute tables; JSON source extraction; CSV catalogue; QGIS project and layer configurations | Derived worldwide cable chronology dataset, created by extracting text, normalizing records, and geocoding named places. |
| `historical/atlantic/` | GeoPackage point layers and relational tables; normalized CSV; QGIS project, styles, layer definitions, and preview | Derived Atlantic-focused chronology dataset documenting places associated with cable records. |
| `archival/images/` | Historical TIFF image and auxiliary XML metadata | Archival raster used as the source for the 1858 route digitization exercise. |
| `archival/digitized_routes/` | PolyLine Shapefile and companion files | Digitized 1858 Atlantic cable route, stored in geographic WGS 84 coordinates. |
| `reference/cable_network/cable-geo.json` | GeoJSON FeatureCollection containing 527 MultiLineString features | Existing submarine cable geometry used for network context; exact acquisition provenance is not recorded locally. |
| `reference/land/ne_10m_land/` | Polygon Shapefile, metadata, and version file | Natural Earth land outlines at 1:10 million scale. |
| `reference/bathymetry/ne_10m_bathymetry_all/` | Twelve polygon Shapefiles, metadata, and version files | Natural Earth ocean depth classes from 0 to 10,000 metres, used for physical context. |
| `reference/graticules/ne_10m_graticules_all/` | Line Shapefiles for coordinate grids and a polygon bounding box | Natural Earth graticules at 1°, 5°, 10°, 15°, 20°, and 30° intervals. |

The `10m` in Natural Earth filenames means a cartographic scale of 1:10 million, rather than a ground resolution of ten metres. Bathymetry is stored here as vector polygons; the notebook draws their boundaries to depict depth contours.

## 2. Creating geographic data from worldwide historical text

### Sources and acquisition

The [worldwide dataset README](<Assignments/Assignment 02 Making Data + Narrative Building/data/historical/worldwide/README.md>) records the extraction of 2,309 entries from four cable chronologies by Bill Glover on Atlantic-Cable.com, consulted on October 9, 2026:

- [Chronology beginning in the nineteenth century](https://atlantic-cable.com/Cables/CableTimeLine/index1850.htm).
- [Chronology beginning in 1901](https://atlantic-cable.com/Cables/CableTimeLine/index1901.htm).
- [Chronology beginning in 1951](https://atlantic-cable.com/Cables/CableTimeLine/index1951.htm).
- [Chronology beginning in 2001](https://atlantic-cable.com/Cables/CableTimeLine/index2001.htm).

`source_records.json` preserves extracted table cells and their source URLs. It is a structured extraction, rather than a complete copy of the original web pages. `complete_catalogue.csv` preserves the normalized records, including year, route, status, mapped point count, unresolved text, and source. The notebook reads this saved extraction and catalogue instead of downloading the chronologies again.

### Transformation into spatial data

The documented process separates place names from route descriptions, normalizes historical names, and matches them against GeoNames, Photon/OpenStreetMap, and TeleGeography landing-point data. Examples of name normalization include Pernambuco to Recife and Bombay to Mumbai. Coordinates are stored alongside provenance in `coord_source`; they represent localities and do not automatically identify historical cable stations.

Project-specific cable IDs connect the place records to their source entries. These IDs are not official cable identifiers. Some explicitly named systems are grouped across entries, so an ID may represent an aggregate system rather than one physical cable.

The GeoPackage `worldwide_cables.gpkg` contains:

| Layer or table | Records | Meaning |
| --- | ---: | --- |
| `localita_mondiali_tutti_gli_anni` | 1,521 | Unique mapped localities, with cable IDs, years, labels, coordinate provenance, and precision information. |
| `localita_mondiali_1858_1900` | 339 | Localities associated with the historical subset. |
| `punti_per_cavo` | 4,288 | Point records expressing cable–place associations; a locality can appear more than once. |
| `catalogo_tutte_le_voci` | 2,309 | All normalized source entries, including entries without mapped locations. |
| `catalogo_id_cavi` | 2,220 | Catalogue of project-generated cable/system IDs. |
| `parti_da_verificare` | 2,075 | Unresolved source fragments requiring review; these are not necessarily distinct place names. |

Spatial layers use EPSG:4326. Of the 2,309 source entries, 507 have no mapped points; others are only partially resolved. Keeping these records makes missing coverage visible instead of silently removing it.

The notebook reconstructs point geometry from saved longitude and latitude, retains the cable relationships, and classifies localities by their earliest recorded connection before 1988 or from 1988 onward. That classification describes the records available in this dataset; it does not establish the first connection in a locality's complete history.

## 3. Creating geographic data from the Atlantic chronology

The [Atlantic dataset README](<Assignments/Assignment 02 Making Data + Narrative Building/data/historical/atlantic/README.md>) identifies [Bill Glover's Atlantic Cables chronology](https://atlantic-cable.com/Cables/CableTimeLine/atlantic.htm), consulted October 9, 2026, as its source.

Its documented workflow normalizes 117 source rows into 103 cable/system IDs, extracts named localities, and obtains representative coordinates through Photon/OpenStreetMap. Query URLs and methods are preserved in the point attributes. The CSV `normalized_source_records.csv` records normalized years, systems, and locality lists.

`atlantic_cables.gpkg` contains 118 points in `citta_tutte_le_rotte`, 28 in the historical `citta_1858_1900` subset, and 271 cable–place point records in `punti_per_cavo`. It also contains a 103-record cable catalogue, 312 relationship records, 24 unresolved locality records, and a separate 22-point layer for projects and attempts. Spatial layers use EPSG:4326.

These are points associated with historical records, not underwater route geometries. Proposed or attempted connections are separated from the main mapped records. Names such as Bay Bull Arm and Frederiksdal have been normalized to modern localities; this supports approximate mapping without proving the positions of historical facilities.

The Atlantic and worldwide packages have different identifier schemes. Their IDs should not be joined directly. They are related compilations from historical sources, rather than independent observations that should be added together to count cables.

## 4. Creating a vector route from an archival image

`archival/images/1858 - Atlantic Cable Route.tif` is the historical raster associated with `archival/digitized_routes/1858 - Atlantic Cable.shp`. The accompanying notebook identifies the vector as a separately digitized cable and includes a workflow to display it over the image in the image's coordinate system.

The intended data-making sequence is to obtain an archival map, georeference it against recognizable locations, and trace the cable route into a vector line. This converts information embedded in pixels into a separate geographic feature that can be styled and compared with other layers.

The Shapefile header identifies PolyLine geometry, its DBF contains one record, and its `.prj` declares geographic WGS 84. The `.shx` stores the geometry index, `.dbf` stores attributes, and `.prj` describes the coordinate reference system. These companion files must remain together.

The local evidence does not establish the original archive, image download URL, map author, acquisition date, georeferencing control points, transformation settings, or positional error. Those details must be supplied from the original work record. The filename alone is insufficient to attribute the image to Atlantic-Cable.com or another archive. Visual alignment and georeferencing accuracy have not been independently verified in this documentation review.

The `.aux.xml` files store auxiliary raster metadata. A JPG auxiliary file is present without its corresponding JPG; it is not another historical image.

## 5. Existing spatial data used for context

### Cable network geometry

`cable-geo.json` contains 527 MultiLineString features, with properties including `id`, `name`, `color`, and `feature_id`. Its coordinate reference metadata declares CRS84, using longitude–latitude coordinates. The notebook uses these lines as the existing cable network behind the historically derived point data.

The local credits mention TeleGeography, but the file does not preserve a definitive source URL, retrieval date, or export procedure. TeleGeography is documented as a coordinate source within the derived worldwide point dataset; that does not by itself establish the provenance of this separate line file. Its supplier, snapshot date, and reuse terms should therefore be confirmed before a final source statement is made.

The geometry has its own cable identifiers. It must not be assumed to join directly to the IDs created for the historical catalogues or to represent a verified current operational network.

### Natural Earth reference layers

The Natural Earth folders contain distributed Shapefiles with provider README pages and version files, consistent with downloaded and unpacked reference datasets. The exact download dates are not recorded. The relevant provider pages are:

- [Land polygons](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/), used for coastline and continental context.
- [Bathymetry](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/), used to show broad ocean-depth structure.
- [Graticules](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-graticules/), used to communicate geographic position and orientation.

The shared reference folder also includes a coarser `reference/land/ne_110m_land/ne_110m_land.shp` land layer at 1:110 million scale. These layers provide cartographic context; they are not newly collected or digitized project data. Natural Earth is credited as public domain in the local package documentation.

QGIS `.qgz` projects, `.qml` styles, and `.qlr` layer definitions organize the display and loading of these datasets. They are configuration files rather than additional geographic observations. CSV files hold tabular records; GeoPackages combine spatial layers and relational tables; the raw extraction JSON preserves textual source material; GeoJSON stores explicit geometry. `.DS_Store` files are operating-system metadata.

## 6. How the data respond to Tutorial 04

[Tutorial 04](https://designpractices.org/tutorials/04-making-data/) asks students to complete one of three approaches: archival georeferencing and digitization, field observations, or geocoding text and addresses.

The archival image and digitized 1858 route directly support **Option 1 — Making Data from Archives**. The specified deliverable is a map composition showing digitized features overlaid on the archival map. A world map displaying the traced line alone does not demonstrate that overlay; the archival image must also be visible in the tutorial composition.

The historical point datasets also demonstrate the broader method of making spatial data from text: extracting place names, resolving them to coordinates, and preserving links to the original descriptions. This is conceptually related to Option 3, but it uses historical cable localities and different reference services. It should not be described as completion of the tutorial's specific NYC cellular-antenna geocoding exercise. No field-survey dataset is documented in this folder.

## 7. How the data respond to Assignment 02

[Assignment 02](https://designpractices.org/assignments/02-making-data/) asks students to identify incomplete or missing data related to their project, create a dataset using observation, georeferencing, digitization, and/or geocoding, and design a map that develops a geographic narrative. Existing data may be added for context.

| Assignment element | Response supported by this folder |
| --- | --- |
| Identify missing data | Historical chronologies describe connections but lack directly usable geographic coordinates; the archival route is embedded in an image. |
| Create spatial data | Normalize and geocode historical place references; trace the 1858 cable into vector geometry. |
| Preserve evidence and limitations | Retain source URLs, extracted text, coordinate provenance, relationship tables, and unresolved records. |
| Build a geographic narrative | Compare historical localities and a digitized route with broader cable geometry and ocean geography. |
| Use existing contextual data | Add cable lines, land polygons, bathymetry, and graticules. |

The proposed narrative concerns the geography of connections across time, rather than a complete inventory of operating internet infrastructure. The source chronologies include telegraph and telephone cables, repairs, renewals, experiments, and proposals. Dates do not consistently mean entry into service, and representative locality coordinates do not establish exact landings.

An accompanying paragraph suitable for adaptation to the final map is:

> This map explores the geography of submarine telecommunications through historical cable connections and existing network geometry. Textual chronologies were converted into geographic data by normalizing place names, geocoding localities, and linking them to cable records. A separately digitized 1858 Atlantic route connects the archival map exercise to the wider narrative. Land, ocean-depth polygons, and graticules provide context. The resulting geography is partial: some source references remain unresolved, and mapped localities represent approximate places rather than verified historical landing stations.

The assignment additionally requires one printed map, also posted on Canvas, with a suggested size of 11 × 17 inches, a title, legend, scale bar / north arrow, data attribution, and a short explanatory paragraph. This data documentation supports those requirements; it does not verify the final map's design or submission.

## 8. Attribution, limitations, and reproducibility

The package READMEs credit Bill Glover / Atlantic-Cable.com for historical records; GeoNames, OpenStreetMap contributors via Photon, and TeleGeography for coordinate references; and Natural Earth for base geography. The worldwide README records GeoNames under CC BY 4.0, OpenStreetMap under ODbL, and reused TeleGeography data under CC BY-NC-SA 3.0. Preserve those attributions and consult the applicable source terms for redistribution. The archival image citation and separate cable-line provenance remain incomplete.

The data are organized into `historical/`, `archival/`, and `reference/` groups. Notebook input paths and QGIS data sources were updated to match this structure. Shapefile companion files remain together, and GeoPackage table and layer names remain unchanged to preserve compatibility. Original Italian package notes are retained as `source_notes_it.md`, alongside English README files. The saved source extraction and geocoding results allow the notebook to work from local data, but the full original extraction and geocoding procedure is not reproduced there.

Documentation prepared with OpenAI Codex assistance from local files and the two course briefs. Dataset creation methods are reported from the available project evidence; unrecorded acquisition details have not been inferred as facts.
