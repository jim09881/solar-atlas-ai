// Leaflet Map initialization (OpenStreetMap - ERIS)
let map;
let marker;

function initMap() {
    console.log('initMap called');
    
    // ตรวจสอบว่า Leaflet โหลดแล้วหรือไม่
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        return;
    }
    
    // ค่าเริ่มต้น - กรุงเทพ
    const defaultLocation = [13.7563, 100.4925]; // [latitude, longitude]
    
    try {
        // ตรวจสอบ element
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map container not found');
            return;
        }
        
        console.log('Creating map...');
        
        // สร้าง map พื้นฐาน
        map = L.map('map', {
            center: defaultLocation,
            zoom: 18,
            layers: [
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors',
                    className: 'map-tiles'
                })
            ]
        });

        console.log('Map created successfully');

        // เพิ่ม marker ที่ตำแหน่งเริ่มต้น
        marker = L.marker(defaultLocation, {
            draggable: true,
            title: 'ตำแหน่งของคุณ'
        }).addTo(map);

        console.log('Marker added');

        // Popup สำหรับ marker
        updateMarkerPopup(defaultLocation);

        // Event listener สำหรับการลาก marker
        marker.on('dragend', function() {
            const position = marker.getLatLng();
            document.getElementById('latitude').value = position.lat.toFixed(4);
            document.getElementById('longitude').value = position.lng.toFixed(4);
            updateMarkerPopup([position.lat, position.lng]);
        });

        // Event listener สำหรับคลิกบนแผนที่
        map.on('click', function(event) {
            const position = event.latlng;
            marker.setLatLng([position.lat, position.lng]);
            document.getElementById('latitude').value = position.lat.toFixed(4);
            document.getElementById('longitude').value = position.lng.toFixed(4);
            updateMarkerPopup([position.lat, position.lng]);
        });

        // Event listener สำหรับการเปลี่ยนแปลง latitude/longitude
        document.getElementById('latitude').addEventListener('change', updateMarkerFromInput);
        document.getElementById('longitude').addEventListener('change', updateMarkerFromInput);

        // แสดง popup เริ่มต้น
        marker.openPopup();

    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// อัปเดต marker popup
function updateMarkerPopup(latLng) {
    const content = `
        <div style="font-family: Arial; font-size: 12px;">
            <strong>📍 ตำแหน่ง</strong><br>
            ละติจูด: ${latLng[0].toFixed(4)}<br>
            ลองติจูด: ${latLng[1].toFixed(4)}
        </div>
    `;
    marker.bindPopup(content).openPopup();
}

// อัปเดต marker จากค่า input
function updateMarkerFromInput() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        if (map && marker) {
            marker.setLatLng([lat, lng]);
            map.setView([lat, lng], 15);
            updateMarkerPopup([lat, lng]);
        }
    }
}

// เมื่อโหลด page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    // ดีเลย์เล็กน้อยให้ DOM พร้อม
    setTimeout(function() {
        console.log('Calling initMap from DOMContentLoaded');
        initMap();
    }, 500);
});

// เมื่อวินโดว์โหลดเสร็จ
window.addEventListener('load', function() {
    console.log('Window load event fired');
    setTimeout(function() {
        if (map && typeof map.invalidateSize === 'function') {
            console.log('Invalidating map size');
            map.invalidateSize();
        }
    }, 100);
});
    
    // ตรวจสอบว่า Google Maps โหลดแล้วหรือไม่
    if (typeof google === 'undefined' || !google.maps) {
        console.log('Google Maps API not loaded. Using fallback mode.');
        setupFallbackMode();
        return;
    }
    
    try {
        // สร้าง map
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 18,
            center: defaultLocation,
            mapTypeControl: true,
            mapTypeControlOptions: {
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
            },
            streetViewControl: true,
            fullscreenControl: true,
            styles: [
                {
                    "featureType": "water",
                    "elementType": "geometry",
                    "stylers": [{"color": "#87CEEB"}]
                },
                {
                    "featureType": "landscape",
                    "elementType": "geometry",
                    "stylers": [{"color": "#f0f8ff"}]
                }
            ]
        });

        // สร้าง InfoWindow
        infoWindow = new google.maps.InfoWindow();

        // เพิ่ม marker ที่ตำแหน่งเริ่มต้น
        marker = new google.maps.Marker({
            map: map,
            position: defaultLocation,
            draggable: true,
            icon: createCustomMarker(),
            title: 'ตำแหน่งของคุณ'
        });

        // Event listener สำหรับการลาก marker
        marker.addListener('dragend', function() {
            const position = marker.getPosition();
            document.getElementById('latitude').value = position.lat().toFixed(4);
            document.getElementById('longitude').value = position.lng().toFixed(4);
            updateMapInfo(position);
        });

        // Event listener สำหรับคลิกบนแผนที่
        map.addListener('click', function(event) {
            const position = event.latLng;
            marker.setPosition(position);
            document.getElementById('latitude').value = position.lat().toFixed(4);
            document.getElementById('longitude').value = position.lng().toFixed(4);
            updateMapInfo(position);
        });

        // Event listener สำหรับการเปลี่ยนแปลง latitude/longitude
        document.getElementById('latitude').addEventListener('change', updateMarkerFromInput);
        document.getElementById('longitude').addEventListener('change', updateMarkerFromInput);

        // อัปเดตข้อมูล
        updateMapInfo(defaultLocation);
    } catch (error) {
        console.error('Error initializing map:', error);
        setupFallbackMode();
    }
}

// Setup fallback mode when Google Maps fails
function setupFallbackMode() {
    const mapElement = document.getElementById('map');
    mapElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 100%); color: #0066cc; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">📍</div>
                <div style="font-size: 16px; font-weight: bold;">แผนที่อยู่ในโหมดปลอด</div>
                <div style="font-size: 12px; color: #666; margin-top: 10px;">กรอกละติจูด/ลองติจูดด้วยตัวเองได้</div>
            </div>
        </div>
    `;
}

// สร้าง Custom Marker
function createCustomMarker() {
    return {
        path: "M0,-28c-7.732,0 -14,6.268 -14,14c0,10.017 14,28 14,28c0,0 14,-17.983 14,-28c0,-7.732 -6.268,-14 -14,-14z",
        fillColor: "#0066cc",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 1.5
    };
}

// อัปเดต marker จากค่า input
function updateMarkerFromInput() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);

    if (!isNaN(lat) && !isNaN(lng) && typeof map !== 'undefined' && map && typeof marker !== 'undefined' && marker) {
        const position = new google.maps.LatLng(lat, lng);
        marker.setPosition(position);
        map.setCenter(position);
        updateMapInfo(position);
    }
}

// อัปเดตข้อมูลบนแผนที่
function updateMapInfo(position) {
    if (typeof infoWindow !== 'undefined' && infoWindow && typeof marker !== 'undefined' && marker) {
        const content = `
            <div style="padding: 10px; font-family: Arial; font-size: 12px;">
                <strong>ตำแหน่ง:</strong><br>
                ละติจูด: ${position.lat().toFixed(4)}<br>
                ลองติจูด: ${position.lng().toFixed(4)}
            </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
    }
}

// เมื่อโหลด page
document.addEventListener('DOMContentLoaded', function() {
    // รอให้ Google Maps โหลด
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        // ดีเลย์เล็กน้อยให้ Google Maps มีเวลาโหลด
        setTimeout(initMap, 500);
    }
});

// ปรับปรุง window.addEventListener สำหรับกรณี Google Maps load success
window.addEventListener('load', function() {
    if (typeof google !== 'undefined' && !map) {
        initMap();
    }
});
