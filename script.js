// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13); // Default center: London

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
    if (event.layerType === 'marker') {
        layer.bindPopup('You drew a point!');
    } else if (event.layerType === 'polyline') {
        layer.bindPopup('You drew a line!');
    } else if (event.layerType === 'polygon') {
        layer.bindPopup('You drew a polygon!');
    }

    layer.openPopup(); // Automatically open the popup
});
// Handle the KML export button for the search result
document.getElementById('exportKMLSearch').addEventListener('click', function () {
    const query = document.getElementById('searchInput').value;

    if (query) {
        // Fetch the search result from Nominatim
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&polygon_geojson=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0]; // First search result
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Create GeoJSON for the location and boundary (if available)
                    const geojson = {
                        type: "FeatureCollection",
                        features: []
                    };

                    // Add the point of the search result
                    geojson.features.push({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [lon, lat] // Longitude, Latitude
                        },
                        properties: {
                            name: result.display_name
                        }
                    });

                    // Add the boundary (if available)
                    if (result.geojson) {
                        geojson.features.push({
                            type: "Feature",
                            geometry: result.geojson, // Use the GeoJSON boundary directly
                            properties: {
                                name: `${result.display_name} Boundary`
                            }
                        });
                    }

                    // Convert GeoJSON to KML
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

// Function to convert GeoJSON to KML
function geoJsonToKml(geojson) {
    let kml = '<?xml version="1.0" encoding="UTF-8"?>';
    kml += '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>';

    geojson.features.forEach(function (feature) {
        kml += '<Placemark>';
        kml += '<name>' + (feature.properties.name || 'Unnamed') + '</name>';

        if (feature.geometry.type === 'Point') {
            kml += '<Point><coordinates>' + feature.geometry.coordinates.join(',') + '</coordinates></Point>';
        } else if (feature.geometry.type === 'Polygon') {
            kml += '<Polygon><outerBoundaryIs><LinearRing><coordinates>';
            feature.geometry.coordinates[0].forEach(function (coord) {
                kml += coord.join(',') + ' ';
            });
            kml += '</coordinates></LinearRing></outerBoundaryIs></Polygon>';
        } else if (feature.geometry.type === 'LineString') {
            kml += '<LineString><coordinates>';
            feature.geometry.coordinates.forEach(function (coord) {
                kml += coord.join(',') + ' ';
            });
            kml += '</coordinates></LineString>';
        }

        kml += '</Placemark>';
    });

    kml += '</Document></kml>';
    return kml;
}

// Handle the KML export button for drawn features
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

// Handle the Search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    const query = e.target.value;
    if (query.length > 2) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&polygon_geojson=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0]; // First search result
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Center the map and add a marker
                    map.setView([lat, lon], 12);
                    const marker = L.marker([lat, lon]).addTo(map).bindPopup(result.display_name).openPopup();

                    // Draw boundary polygon if available
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

// Handle the Buffer functionality
document.getElementById('applyBuffer').addEventListener('click', function () {
    const xCoord = parseFloat(document.getElementById('xCoord').value);
    const yCoord = parseFloat(document.getElementById('yCoord').value);
    const bufferDistance = parseFloat(document.getElementById('bufferDistance').value);

    if (!xCoord || !yCoord || !bufferDistance) {
        alert("Please enter valid X, Y coordinates and buffer distance.");
        return;
    }

    // Create a GeoJSON point
    const point = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [xCoord, yCoord]
        }
    };

    // Buffer the point (buffer is in meters)
    const buffered = turf.buffer(point, bufferDistance, { units: 'meters' });

    // Add the buffered area to the map
    const bufferLayer = L.geoJSON(buffered, {
        style: { color: 'red', weight: 1, fillOpacity: 0.4 }
    }).addTo(map);

    // Adjust the map view to fit the buffer
    map.fitBounds(bufferLayer.getBounds());
});
