
document.addEventListener('DOMContentLoaded', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000);
    document.body.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 20;

    camera.position.z = 10;

    const ships = [];
    let currentShipIndex = 0;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00aaff, 0.7, 100);
    pointLight.position.set(-5, -5, -5);
    scene.add(pointLight);

    // --- Ship Creation Functions ---

    function createScout() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.4 }));
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00aaff }));
        cockpit.position.z = 0.4;
        const wing1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.4 }));
        wing1.position.x = 0.8;
        const wing2 = wing1.clone();
        wing2.position.x = -0.8;
        ship.add(body, cockpit, wing1, wing2);
        return ship;
    }

    function createInterceptor() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 2, 8), new THREE.MeshStandardMaterial({ color: 0x00ff00, metalness: 0.7, roughness: 0.5 }));
        body.rotation.x = Math.PI / 2;
        const wing1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x00aa00, metalness: 0.7, roughness: 0.5 }));
        wing1.position.y = 0.5;
        wing1.rotation.z = -Math.PI / 4;
        const wing2 = wing1.clone();
        wing2.position.y = -0.5;
        wing2.rotation.z = Math.PI / 4;
        ship.add(body, wing1, wing2);
        return ship;
    }

    function createBomber() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.6, roughness: 0.6 }));
        const bomb1 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 }));
        bomb1.position.y = -0.7;
        bomb1.position.x = 0.5;
        const bomb2 = bomb1.clone();
        bomb2.position.x = -0.5;
        ship.add(body, bomb1, bomb2);
        return ship;
    }

    function createDestroyer() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 16), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.3 }));
        body.rotation.x = Math.PI / 2;
        const turret1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.2 }));
        turret1.position.z = 1;
        const turret2 = turret1.clone();
        turret2.position.z = -1;
        ship.add(body, turret1, turret2);
        return ship;
    }

    function createCruiser() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x00aaff, metalness: 0.7, roughness: 0.4 }));
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x0077cc, metalness: 0.7, roughness: 0.4 }));
        bridge.position.y = 0.4;
        ship.add(body, bridge);
        return ship;
    }

    function createDreadnought() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2), new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.8, roughness: 0.5 }));
        const cannon1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.2 }));
        cannon1.position.z = 1.5;
        cannon1.rotation.x = Math.PI / 2;
        const cannon2 = cannon1.clone();
        cannon2.position.x = 0.5;
        const cannon3 = cannon1.clone();
        cannon3.position.x = -0.5;
        ship.add(body, cannon1, cannon2, cannon3);
        return ship;
    }

    function createStealth() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 }));
        ship.add(body);
        return ship;
    }

    function createFlagship() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 6), new THREE.MeshStandardMaterial({ color: 0xffff00, metalness: 0.8, roughness: 0.4 }));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.4 }));
        ring.rotation.x = Math.PI / 2;
        ship.add(body, ring);
        return ship;
    }

    function createCarrier() {
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 2), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.4 }));
        const landingStrip = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x555555 }));
        landingStrip.position.y = 0.28;
        ship.add(body, landingStrip);
        return ship;
    }

    function createMothership() {
        const ship = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.8, roughness: 0.3 }));
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.2, 16, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.3 }));
        ring1.rotation.x = Math.PI / 2;
        const ring2 = ring1.clone();
        ring2.rotation.y = Math.PI / 2;
        ship.add(core, ring1, ring2);
        return ship;
    }

    function init() {
        ships.push(createScout());
        ships.push(createInterceptor());
        ships.push(createBomber());
        ships.push(createDestroyer());
        ships.push(createCruiser());
        ships.push(createDreadnought());
        ships.push(createStealth());
        ships.push(createFlagship());
        ships.push(createCarrier());
        ships.push(createMothership());

        ships.forEach(ship => {
            ship.visible = false;
            scene.add(ship);
        });

        ships[currentShipIndex].visible = true;
        document.getElementById('loading').style.display = 'none';
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        if (ships.length > 0) {
            ships[currentShipIndex].rotation.y += 0.005;
            ships[currentShipIndex].rotation.x += 0.001;
        }

        renderer.render(scene, camera);
    }

    document.querySelectorAll('.ship-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const newIndex = parseInt(e.target.dataset.ship);
            if (newIndex !== currentShipIndex) {
                ships[currentShipIndex].visible = false;
                currentShipIndex = newIndex;
                ships[currentShipIndex].visible = true;
            }
        });
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    init();
    animate();
});
