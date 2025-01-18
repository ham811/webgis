// Initialize the map
const map = L.map('map').setView([51.5167, 9.9167], 6); // Default center: London

// Add a tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Create a feature group to store drawn items
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Add Leaflet Draw control to the map
const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems, // Allow editing of drawn items
    },
    draw: {
        polyline: true,   // Allow drawing of lines
        polygon: true,    // Allow drawing of polygons
        circle: false,    // Disable circle drawing
        rectangle: false, // Disable rectangle drawing
        marker: true      // Allow drawing of points
    }
});
map.addControl(drawControl);

// Handle the creation of new shapes
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer); // Add the drawn layer to the feature group

    // Optionally bind a popup to the new shape
    const shapeType = event.layerType;
    const message = shapeType === 'marker' ? 'You drew a point!' :
                    shapeType === 'polyline' ? 'You drew a line!' :
                    shapeType === 'polygon' ? 'You drew a polygon!' : 'Shape added!';
    layer.bindPopup(message).openPopup(); // Automatically open the popup
});

// KML Export for Drawn Features
document.getElementById('exportKML').addEventListener('click', function () {
    const geojson = drawnItems.toGeoJSON(); // Convert the drawn items to GeoJSON
    const kmlData = geoJsonToKml(geojson); // Convert GeoJSON to KML

    // Trigger a download
    const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawn_features.kml';
    a.click();

    URL.revokeObjectURL(url);
});

// KML Export for Search Results
document.getElementById('exportKMLSearch').addEventListener('click', function () {
    const query = document.getElementById('searchInput').value;

    if (query) {
        // Fetch the search result from Nominatim
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&polygon_geojson=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Create GeoJSON for the location and boundary (if available)
                    const geojson = {
                        type: "FeatureCollection",
                        features: [{
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [lon, lat]
                            },
                            properties: {
                                name: result.display_name
                            }
                        }]
                    };

                    if (result.geojson) {
                        geojson.features.push({
                            type: "Feature",
                            geometry: result.geojson,
                            properties: {
                                name: `${result.display_name} Boundary`
                            }
                        });
                    }

                    const kmlData = geoJsonToKml(geojson);

                    // Trigger a download
                    const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${query}_search_result.kml`;
                    a.click();

                    URL.revokeObjectURL(url);
                } else {
                    alert("No results found to export.");
                }
            })
            .catch(error => {
                console.error("Error fetching search results:", error);
                alert("Failed to export the searched location.");
            });
    } else {
        alert("Please enter a search query.");
    }
});

// Buffer Analysis
document.getElementById('applyBuffer').addEventListener('click', function () {
    const xCoord = parseFloat(document.getElementById('xCoord').value);
    const yCoord = parseFloat(document.getElementById('yCoord').value);
    const bufferDistance = parseFloat(document.getElementById('bufferDistance').value);

    if (!xCoord || !yCoord || !bufferDistance) {
        alert("Please enter valid X, Y coordinates and buffer distance.");
        return;
    }

    const point = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [xCoord, yCoord]
        }
    };

    const buffered = turf.buffer(point, bufferDistance, { units: 'meters' });

    const bufferLayer = L.geoJSON(buffered, {
        style: { color: 'red', weight: 1, fillOpacity: 0.4 }
    }).addTo(map);

    map.fitBounds(bufferLayer.getBounds());
});

// Search Functionality
document.getElementById('searchInput').addEventListener('input', function (e) {
    const query = e.target.value;

    if (query.length > 2) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&polygon_geojson=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    map.setView([lat, lon], 12);
                    const marker = L.marker([lat, lon]).addTo(map).bindPopup(result.display_name).openPopup();

                    if (result.geojson) {
                        const boundaryLayer = L.geoJSON(result.geojson, {
                            style: { color: 'blue', weight: 2, fillOpacity: 0.2 }
                        }).addTo(map);
                        map.fitBounds(boundaryLayer.getBounds());
                    }
                }
            });
    }
});

// GeoJSON to KML Converter
function geoJsonToKml(geojson) {
    let kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>';

    geojson.features.forEach(feature => {
        kml += '<Placemark>';
        kml += `<name>${feature.properties.name || 'Unnamed'}</name>`;

        if (feature.geometry.type === 'Point') {
            kml += `<Point><coordinates>${feature.geometry.coordinates.join(',')}</coordinates></Point>`;
        } else if (feature.geometry.type === 'Polygon') {
            kml += '<Polygon><outerBoundaryIs><LinearRing><coordinates>';
            feature.geometry.coordinates[0].forEach(coord => {
                kml += `${coord.join(',')} `;
            });
            kml += '</coordinates></LinearRing></outerBoundaryIs></Polygon>';
        } else if (feature.geometry.type === 'LineString') {
            kml += '<LineString><coordinates>';
            feature.geometry.coordinates.forEach(coord => {
                kml += `${coord.join(',')} `;
            });
            kml += '</coordinates></LineString>';
        }

        kml += '</Placemark>';
    });

    return `${kml}</Document></kml>`;
}

// Toggle Sidebar Sections
document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => toggleSection(header));
});

function toggleSection(headerElement) {
    const content = headerElement.nextElementSibling;
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
}
// WMS Layers for Germany (German sources)
const wmsLayers = {
    // Nature Layer: OpenStreetMap WMS
    nature: L.tileLayer.wms("https://ows.terrestris.de/osm/service?", {
        layers: "OSM-WMS",
        format: "image/png",
        transparent: true,
        attribution: "OpenStreetMap WMS"
    }),

    // Topographic Layer: Germany Topographic WMS
    topographic: L.tileLayer.wms("https://geoserver.someservice.com/wms", {
        layers: "germany_topographic",
        format: "image/png",
        transparent: true,
        attribution: "Topographic WMS"
    }),

    // Borders Layer: Demis WMS for Borders
    borders: L.tileLayer.wms("https://www.demis.nl/wms/wms.aspx", {
        layers: "borders",
        format: "image/png",
        transparent: true,
        attribution: "Demis WMS"
    })
};

// Map initialization (Assuming you have a map object in your script)

// Add the base layer (example: OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Function to toggle WMS layers
function toggleWmsLayer(id, layer) {
    const checkbox = document.getElementById(id);
    
    if (checkbox.checked) {
        layer.addTo(map);
    } else {
        map.removeLayer(layer);
    }
}



// Sidebar Page Switching Logic
const page1Btn = document.getElementById("page1-btn");
const page2Btn = document.getElementById("page2-btn");
const page3Btn = document.getElementById("page3-btn");
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");
const page3 = document.getElementById("page3");

page1Btn.addEventListener("click", () => switchPage(page1Btn, page1));
page2Btn.addEventListener("click", () => switchPage(page2Btn, page2));
page3Btn.addEventListener("click", () => switchPage(page3Btn, page3));

function switchPage(button, page) {
    // Reset all buttons and pages
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".sidebar-page").forEach(pg => pg.classList.remove("active"));

    // Activate current button and page
    button.classList.add("active");
    page.classList.add("active");
}

// Advanced Search Export and Search Buttons
const exportAdvancedKML = document.getElementById("exportAdvancedKML");
const performAdvancedSearch = document.getElementById("performAdvancedSearch");

exportAdvancedKML.addEventListener("click", () => {
    alert("Exporting Advanced Search data as KML...");
});

performAdvancedSearch.addEventListener("click", () => {
    const param1 = document.getElementById("searchInput1").value;
    const param2 = document.getElementById("searchInput2").value;
    const param3 = document.getElementById("searchInput3").value;

    alert(`Performing search with:\n- Parameter 1: ${param1}\n- Parameter 2: ${param2}\n- Parameter 3: ${param3}`);
});

