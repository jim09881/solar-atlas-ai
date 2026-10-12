// 3D Sun Position Visualization with Three.js

let scene, camera, renderer;
let building, panels, sunLight, sunSphere;
let animationId;

function initializeSun3D(containerId, zenithAngle, azimuthAngle, noonZenith, noonAzimuth, noonElevation) {
    // Initialize Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Set up camera
    const width = document.getElementById(containerId)?.clientWidth || 600;
    const height = document.getElementById(containerId)?.clientHeight || 500;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(15, 15, 20);
    camera.lookAt(0, 0, 0);
    
    // Set up renderer
    const canvas = document.getElementById(containerId);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Calculate sun position from angles
    const radZenith = THREE.MathUtils.degToRad(noonZenith);
    const radAzimuth = THREE.MathUtils.degToRad(noonAzimuth);
    
    const sunDistance = 50;
    const sunX = sunDistance * Math.sin(radZenith) * Math.sin(radAzimuth);
    const sunY = sunDistance * Math.cos(radZenith);
    const sunZ = sunDistance * Math.sin(radZenith) * Math.cos(radAzimuth);
    
    // Sun light
    sunLight = new THREE.DirectionalLight(0xffff88, 1);
    sunLight.position.set(sunX, sunY, sunZ);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    // Create sun sphere
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    sunSphere.position.set(sunX, sunY, sunZ);
    scene.add(sunSphere);
    
    // Add sun glow
    const glowGeometry = new THREE.SphereGeometry(2.5, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(sunSphere.position);
    scene.add(glow);
    
    // Create building (simple cube)
    const buildingGeometry = new THREE.BoxGeometry(8, 8, 8);
    const buildingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        shininess: 50
    });
    building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.castShadow = true;
    building.receiveShadow = true;
    building.position.y = 4; // Raise by half height
    scene.add(building);
    
    // Create solar panels on roof
    createSolarPanels();
    
    // Add ground
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x90ee90,
        shininess: 10
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(40, 10, 0x888888, 0xcccccc);
    scene.add(gridHelper);
    
    // Add coordinate axes
    const axesHelper = new THREE.AxesHelper(15);
    scene.add(axesHelper);
    
    // Add sun path line (ecliptic)
    drawSunPath(noonAzimuth, noonZenith);
    
    // Add text labels
    addLabels(sunX, sunY, sunZ, noonZenith, noonAzimuth, noonElevation);
    
    // Start animation
    animate();
    
    // Handle window resize
    window.addEventListener('resize', () => onWindowResize(containerId));
}

function createSolarPanels() {
    const panelWidth = 2;
    const panelHeight = 1.5;
    const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a3a52,
        shininess: 100,
        side: THREE.DoubleSide
    });
    
    panels = new THREE.Group();
    
    // Arrange panels on roof (2 rows, 3 columns)
    const spacing = 0.2;
    const startX = -2.5;
    const startZ = -2.5;
    
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) {
            const panel = new THREE.Mesh(panelGeometry, panelMaterial.clone());
            panel.position.set(
                startX + j * (panelWidth + spacing),
                8.1, // Slightly above roof
                startZ + i * (panelHeight + spacing)
            );
            panel.rotation.x = Math.PI / 12; // 15-degree tilt
            panel.castShadow = true;
            panel.receiveShadow = true;
            panels.add(panel);
        }
    }
    
    scene.add(panels);
}

function drawSunPath(azimuth, zenith) {
    // Draw a curved path showing sun position throughout the day
    const curve = new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
            50 * Math.sin(THREE.MathUtils.degToRad(zenith)) * Math.sin(THREE.MathUtils.degToRad(azimuth)),
            50 * Math.cos(THREE.MathUtils.degToRad(zenith)),
            50 * Math.sin(THREE.MathUtils.degToRad(zenith)) * Math.cos(THREE.MathUtils.degToRad(azimuth))
        )
    );
    
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
    const sunPath = new THREE.Line(geometry, material);
    scene.add(sunPath);
}

function addLabels(sunX, sunY, sunZ, zenith, azimuth, elevation) {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 40px Arial';
    ctx.textAlign = 'center';
    
    // Draw sun info
    ctx.fillText('☀ SUN POSITION', 256, 100);
    ctx.font = '30px Arial';
    ctx.fillText(`Zenith: ${zenith.toFixed(1)}°`, 256, 180);
    ctx.fillText(`Azimuth: ${azimuth.toFixed(1)}°`, 256, 240);
    ctx.fillText(`Elevation: ${elevation.toFixed(1)}°`, 256, 300);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(15, 15, 1);
    sprite.position.set(0, 25, 0);
    scene.add(sprite);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    
    // Rotate sun sphere for visual effect
    if (sunSphere) {
        sunSphere.rotation.y += 0.01;
    }
    
    // Rotate building slowly
    if (building) {
        building.rotation.y += 0.001;
    }
    
    renderer.render(scene, camera);
}

function onWindowResize(containerId) {
    const width = document.getElementById(containerId)?.clientWidth || 600;
    const height = document.getElementById(containerId)?.clientHeight || 500;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function dispose3D() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (renderer) {
        renderer.dispose();
    }
}
