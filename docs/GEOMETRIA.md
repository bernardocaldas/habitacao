# Lisbon map geometry: sources, licences and processing

Built 10 October 2026. Three GeoJSON layers in EPSG:4326 (lon/lat), coordinates rounded to
5 decimals, exterior rings clockwise and holes counter-clockwise (the d3-geo convention, which
the site's existing `population-geography` files also use).

| File | Content | Properties | Size |
|---|---|---|---|
| `lisboa-freguesias.json` | Lisbon's 24 parishes (CAOP 2021), clipped to land | `code` (DICOFRE), `name` | 79.5 KB |
| `terra.json` | Land inside lon −9.32..−8.95, lat 38.62..38.84 (one MultiPolygon, 15 parts) | none | 31.9 KB |
| `vizinhos.json` | The 15 other municipalities with land in that bbox, clipped to land and to the bbox | `code` (DICO), `name` | 54.3 KB |
| `preview.png` | Check image: land, water, neighbours, parishes | | |

## Sources

### 1. Administrative boundaries: CAOP 2021, Continente (DGT)

- Dataset: Carta Administrativa Oficial de Portugal, versão 2021, Continente, "Área
  Administrativa (Polígonos)", shapefile.
- Publisher: Direção-Geral do Território (DGT).
- Page: https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop (section "2021").
- File: https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/Cont_AAD_CAOP2021.zip
  (32 187 312 bytes, HTTP Last-Modified 19 Jan 2023, SHA-256
  `85c3617a602a7c90129f25bf944437bdd41e17857ce68b93050cc695e45bbf80`). Inside:
  `Cont_AAD_CAOP2021.shp` (layer created 5 Jan 2022, DBF updated 20 Jan 2022), 3 223 polygons,
  CRS ETRS89 / PT-TM06 (EPSG:3763), fields Dicofre, Freguesia, Concelho, Distrito, TAA, areas.
- The 24 Lisbon parishes are each one "ÁREA PRINCIPAL" polygon with 132 to 556 vertices
  (the site's current file has 11 to 39). Codes and names match the expected list exactly.
- Licence: **CC BY 4.0**. DGT publishes the CAOP on dados.gov.pt under licence id `cc-by`,
  which the portal defines as "Creative Commons Attribution 4.0 - CC BY 4.0"
  (https://creativecommons.org/licenses/by/4.0/; checked on the current CAOP2025 Continente,
  RAA and RAM listings). The 2021 download page itself has no licence text. No CAOP 2021
  dataset entry turned up on dados.gov.pt, so the CC BY 4.0 reading for 2021 relies on DGT's
  general practice and on the site's existing treatment of CAOP 2021.

### 2. Shoreline: OpenStreetMap land polygons (osmdata.openstreetmap.de)

- Dataset: "Land polygons", WGS84, large polygons split ("land-polygons-split-4326"),
  derived from OSM ways tagged `natural=coastline`.
- Page: https://osmdata.openstreetmap.de/data/land-polygons.html
- File: https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip
  (927 993 315 bytes, Last-Modified 10 Oct 2026 03:41:47 GMT, SHA-256
  `d04d70002a8fd88b71c5d0eebda78c8c0ec197a09fc00067ee411f8da8890075`). The package README
  gives the OSM data date as **2026-10-10T00:00:00Z**. 115 polygons read in the window
  lon −9.40..−8.85, lat 38.55..38.92.
- Licence: **Open Database License (ODbL) 1.0**. The README says: "This data is Copyright 2026
  OpenStreetMap contributors. It is available under the Open Database License (ODbL)."
  See https://www.openstreetmap.org/copyright.

Câmara Municipal de Lisboa open data was not needed: the CAOP gives full-resolution
parish boundaries, and its licence is clearer.

## Attribution to show

Wherever the map is shown (map footer or DataCard source line):

- PT: `Limites: CAOP 2021, DGT (CC BY 4.0), modificados por estimador.pt · Linha de costa: © OpenStreetMap contributors (ODbL)`
- EN: `Boundaries: CAOP 2021, DGT (CC BY 4.0), modified by estimador.pt · Shoreline: © OpenStreetMap contributors (ODbL)`

"© OpenStreetMap contributors" should link to https://www.openstreetmap.org/copyright.
OSM's guidelines accept this exact English wording on a page in any language.

**ODbL share-alike: this is a decision for the owner.** `terra.json` and the shoreline edges
of the other two files come from OSM. Serving these JSON files publicly (the browser fetches
them) means distributing a Derivative Database. Under ODbL §4.4, that database must itself be
offered under the ODbL, with the attribution above. So these three files must **not** be
labelled CC BY-NC 4.0 like estimador.pt's own data. Label them "ODbL 1.0 (shoreline © OpenStreetMap contributors); boundaries
CAOP 2021, DGT, CC BY 4.0". A rendered map image is a Produced Work and needs only the
attribution. If the share-alike is unwanted, rebuild the land mask from an official source
instead (DGT's COS 2018, CC BY 4.0, water classes, 1 ha minimum mapping unit; or Copernicus
EU-Hydro coastline). That rebuild was not done here.

## Processing

Scripts are in the session scratchpad, `geoscripts/` (`run.sh` runs the whole chain).
They use Python 3.13 with shapely 2.2, pyproj 3.8, pyogrio 0.13 / GDAL 3.12 and geopandas,
plus mapshaper 0.6.102.

1. CAOP read in EPSG:3763 and reprojected to EPSG:4326 with pyproj, so ETRS89 is treated as
   WGS84 (sub-metre). Check: the inland vertices of the site's current Lisbon file lie on the
   new boundaries (median 0 m, max 7.7 m).
2. Units: the 24 Lisbon parishes, plus the municipalities of every other parish touching the
   bbox, dissolved by DICO (Oeiras, Amadora, Odivelas, Loures, Almada, Seixal and Barreiro as
   asked, plus Sintra, Cascais, Vila Franca de Xira, Benavente, Alcochete, Montijo, Moita and
   Palmela, so that all land in the bbox belongs to a unit).
3. Land mask: union of the OSM land polygons, then a morphological opening in metres (8 m
   round buffer in and out), which removes piers, jetties and groynes narrower than about
   16 m. Then a closing (10 m), which fills water slits narrower than about 20 m. Enclosed
   water under 5 000 m² was filled. One water hole is left, a 5.4 ha basin in Barreiro.
   Then clipped to the bbox.
4. Planar arrangement: every unit boundary, the land boundary, the bbox frame and a "detail
   zone" frame (lon −9.25..−9.065, lat 38.675..38.812) are noded together (snapped to a 1e-7°
   grid) and polygonised. Each land face takes the unit containing it. This guarantees shared,
   identical edges between parishes, between parishes and neighbours, and between all of
   them and `terra`.
5. OSM land outside every CAOP polygon (0.34 km², mainly beaches and harbour works on the
   open coast) went to the unit it shares the longest edge with. Shares: Almada 0.16 km²,
   Oeiras 0.09, Barreiro 0.04, Seixal 0.02, Montijo 0.002. None went to a Lisbon parish. One
   isolated 0.5 ha islet off Trafaria (−9.2367, 38.676) touches no unit and stays in
   `terra.json` only.
6. Isolated land bits were dropped: under 2 500 m² inside the detail zone, under 20 000 m²
   outside it (salt-marsh islets, the Bugio fort). Inside Lisbon this removed only slivers of
   ≤ 0.1 ha (Alcântara 907 m², Parque das Nações 494 m², Marvila 455 m²). Every parish is a
   single Polygon.
7. Simplification: mapshaper `-simplify variable keep-shapes` (weighted Visvalingam) on the
   shared arcs of the arrangement, so neighbours keep identical borders. Intervals: parishes
   3 m (Avenidas Novas 0.4 m, Benfica 3.5 m, Carnide, Lumiar and Santa Clara 4 m, Belém 5 m);
   neighbours 12 m inside the detail zone and 80 m outside it. A shared arc takes the finest
   interval of the faces it borders. The faces were then dissolved into the three layers,
   rounded to 5 decimals on the shared arcs, and rewound.

## Validation (all passed)

- `lisboa-freguesias.json`: 24 features, all 24 codes and names as expected, none empty,
  all valid, all single Polygons. Pairwise overlap 0 m², 54 adjacent pairs sharing a border.
  The union is one polygon with no holes and no gap narrower than 5 m (closing test: 0 m²).
- Vertices per parish: min 95 (Avenidas Novas), median 137.5, max 244 (Belém), 3 847 in total.
- Cross-layer: parishes outside `terra` 0 m², neighbours outside `terra` 0 m², parish ∩
  neighbour 0 m². Land in `terra` that is in neither layer: 4 546 m², the islet in step 5.
- Lisbon land area 86.15 km², against 99.94 km² for the CAOP polygons, which extend into the Tejo.
- Sizes: parishes 79.5 KB (≤ 120), terra 31.9 KB (≤ 80), vizinhos 54.3 KB (≤ 60). At most 5
  decimals everywhere.
