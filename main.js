import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
// VignettePass doesn't exist in Three.js, we'll create a custom vignette effect
import { io } from 'socket.io-client';

// Socket.io connection
// Allow server URL to be configured via environment variable or use default
// For Netlify deployment, set VITE_SERVER_URL in Netlify environment variables
// Example: https://your-server.herokuapp.com or https://your-server.render.com
const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

// Game state
let scene, camera, renderer, composer;
let localPlayer, remotePlayer;
let players = new Map();
let bullets = new Map();
let gameStarted = false;
let gameOver = false;
let myPlayerId = null;
let myLobbyId = null;
let myPlayerName = '';

// Controls
const keys = {
    w: false, a: false, s: false, d: false
};

const mouse = { x: 0, y: 0 };
let mouseLocked = false;
let cameraRotation = { x: 0, y: 0 }; // Pitch and yaw for first-person camera

// Constants
const PLAYER_SPEED = 0.15;
const ARENA_SIZE = 18;

// Initialize game
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a3a); // Brighter background
    scene.fog = new THREE.Fog(0x3a3a4a, 30, 80); // Lighter fog, further distance

    // Camera - will be attached to player for first-person view
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    // Camera position will be set when player spawns

    // Renderer
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Post-processing
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom effect for neon glow
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,
        0.4,
        0.85
    );
    composer.addPass(bloomPass);

    // Film grain effect
    const filmPass = new FilmPass(0.35, 0.025, 648, false);
    composer.addPass(filmPass);

    // Vignette effect (custom shader - VignettePass doesn't exist in Three.js)
    // We'll apply vignette via CSS instead for simplicity

    // Create arena
    createArena();

    // Lighting
    setupLighting();

    // Setup UI
    setupUI();

    // Setup socket events
    setupSocketEvents();

    // Event listeners
    setupEventListeners();

    // Initialize connection status
    updateConnectionStatus(socket.connected);
    if (!socket.connected) {
        showConnectionError('Connecting to server...');
    }

    // Show server URL if configured, or show help message if not
    const hint = document.getElementById('server-config-hint');
    const urlDisplay = document.getElementById('server-url-display');
    if (hint && urlDisplay) {
        if (import.meta.env.VITE_SERVER_URL) {
            hint.classList.remove('hidden');
            urlDisplay.textContent = import.meta.env.VITE_SERVER_URL;
        } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // Show help message on production if server URL not configured
            hint.classList.remove('hidden');
            urlDisplay.textContent = 'Not configured';
            const hintText = hint.querySelector('.hint-text');
            if (hintText) {
                hintText.textContent = 'Server URL not configured. Set VITE_SERVER_URL environment variable in Netlify. See DEPLOYMENT.md for details.';
                hintText.style.color = '#ff6600';
            }
        }
    }

    // Start game loop
    animate();
}

function createArena() {
    // Ground - brighter desert sand
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x6d5a47, // Brighter sand color
        roughness: 0.8,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ground pattern - brighter
    const patternGeometry = new THREE.PlaneGeometry(40, 40, 20, 20);
    const patternMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a4a3a, // Brighter pattern
        roughness: 0.9,
        metalness: 0.05
    });
    const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
    pattern.rotation.x = -Math.PI / 2;
    pattern.position.y = 0.01;
    scene.add(pattern);

    // Buildings
    const buildings = [
        { x: -15, z: -15, width: 8, height: 6 },
        { x: 15, z: -15, width: 8, height: 6 },
        { x: -15, z: 15, width: 8, height: 6 },
        { x: 15, z: 15, width: 8, height: 6 },
    ];

    buildings.forEach(building => {
        const buildingGeometry = new THREE.BoxGeometry(building.width, building.height, building.width);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.7,
            metalness: 0.3
        });
        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingMesh.position.set(building.x, building.height / 2, building.z);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        scene.add(buildingMesh);

        // Neon signs
        const neonGeometry = new THREE.BoxGeometry(building.width * 0.8, 0.3, 0.1);
        const neonMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 2
        });
        const neon = new THREE.Mesh(neonGeometry, neonMaterial);
        neon.position.set(building.x, building.height - 0.5, building.z);
        scene.add(neon);
    });

    // Cacti
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 12 + Math.random() * 3;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const cactusGroup = new THREE.Group();
        
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d5016,
            roughness: 0.9
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        cactusGroup.add(body);

        const armGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.5, 8);
        const arm1 = new THREE.Mesh(armGeometry, bodyMaterial);
        arm1.position.set(0.5, 1.5, 0);
        arm1.rotation.z = Math.PI / 4;
        arm1.castShadow = true;
        cactusGroup.add(arm1);

        const arm2 = new THREE.Mesh(armGeometry, bodyMaterial);
        arm2.position.set(-0.5, 1.2, 0);
        arm2.rotation.z = -Math.PI / 4;
        arm2.castShadow = true;
        cactusGroup.add(arm2);

        const neonAccent = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.5, 0.1),
            new THREE.MeshStandardMaterial({
                color: 0xff00ff,
                emissive: 0xff00ff,
                emissiveIntensity: 1.5
            })
        );
        neonAccent.position.set(0, 1.5, 0.3);
        cactusGroup.add(neonAccent);

        cactusGroup.position.set(x, 0, z);
        scene.add(cactusGroup);
    }

    // Arena walls
    const wallHeight = 3;
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.8,
        metalness: 0.2
    });

    const walls = [
        { geometry: new THREE.BoxGeometry(40, wallHeight, 1), position: [0, wallHeight / 2, -20] },
        { geometry: new THREE.BoxGeometry(40, wallHeight, 1), position: [0, wallHeight / 2, 20] },
        { geometry: new THREE.BoxGeometry(1, wallHeight, 40), position: [20, wallHeight / 2, 0] },
        { geometry: new THREE.BoxGeometry(1, wallHeight, 40), position: [-20, wallHeight / 2, 0] }
    ];

    walls.forEach(wall => {
        const wallMesh = new THREE.Mesh(wall.geometry, wallMaterial);
        wallMesh.position.set(...wall.position);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        scene.add(wallMesh);
    });

    // Neon grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x00ff00, 0x003300);
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

function createPlayer(playerId, playerName, position, isLocal) {
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: isLocal ? 0x0066ff : 0xff0066,
        emissive: isLocal ? 0x003366 : 0x660033,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
    });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(position.x, position.y, position.z);
    player.castShadow = true;
    player.userData = { id: playerId, name: playerName, isLocal };
    scene.add(player);

    // Weapon
    const weapon = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 1),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    weapon.position.set(isLocal ? 0.5 : -0.5, 0.5, 0.5);
    player.add(weapon);

    players.set(playerId, player);
    return player;
}

function setupLighting() {
    // Much brighter ambient light
    const ambientLight = new THREE.AmbientLight(0x808080, 1.2);
    scene.add(ambientLight);

    // Brighter directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    scene.add(directionalLight);

    // Brighter neon lights
    const neonLights = [
        { color: 0x00ff00, position: [-15, 5, -15], intensity: 5 },
        { color: 0xff00ff, position: [15, 5, -15], intensity: 5 },
        { color: 0x00ffff, position: [-15, 5, 15], intensity: 5 },
        { color: 0xffff00, position: [15, 5, 15], intensity: 5 },
    ];

    neonLights.forEach(light => {
        const pointLight = new THREE.PointLight(light.color, light.intensity, 30);
        pointLight.position.set(...light.position);
        pointLight.castShadow = true;
        scene.add(pointLight);
    });
}

function setupUI() {
    // Create lobby button
    document.getElementById('create-lobby-button').addEventListener('click', () => {
        if (!socket.connected) {
            showConnectionError('Not connected to server. Please wait for connection...');
            return;
        }
        const playerName = document.getElementById('player-name').value || 'Player';
        myPlayerName = playerName;
        socket.emit('create-lobby', playerName);
    });

    // Join lobby button
    document.getElementById('join-lobby-button').addEventListener('click', () => {
        if (!socket.connected) {
            showConnectionError('Not connected to server. Please wait for connection...');
            return;
        }
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('join-screen').classList.remove('hidden');
        socket.emit('list-lobbies');
    });

    // Refresh lobbies
    document.getElementById('refresh-lobbies-button').addEventListener('click', () => {
        socket.emit('list-lobbies');
    });

    // Back button
    document.getElementById('back-button').addEventListener('click', () => {
        document.getElementById('join-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    });

    // Ready button
    document.getElementById('ready-button').addEventListener('click', () => {
        socket.emit('player-ready');
    });

    // Leave lobby
    document.getElementById('leave-lobby-button').addEventListener('click', () => {
        socket.emit('leave-lobby');
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
        resetGame();
    });
}

function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('Connected to server');
        myPlayerId = socket.id;
        hideConnectionError();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showConnectionError('Failed to connect to game server. Please check if the server is running.');
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        if (reason === 'io server disconnect') {
            showConnectionError('Disconnected from server. Please refresh the page.');
        }
    });

    socket.on('lobby-created', (data) => {
        myLobbyId = data.lobbyId;
        document.getElementById('lobby-id-display').textContent = data.lobbyId;
        updatePlayersList(data.players);
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('join-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
    });

    socket.on('lobby-joined', (data) => {
        myLobbyId = data.lobbyId;
        document.getElementById('lobby-id-display').textContent = data.lobbyId;
        updatePlayersList(data.players);
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('join-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
    });

    socket.on('player-joined', (data) => {
        updatePlayersList(data.players);
    });

    socket.on('player-left', (data) => {
        updatePlayersList(data.players);
        if (data.players.length === 0) {
            document.getElementById('lobby-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        }
    });

    socket.on('lobbies-list', (lobbies) => {
        const listContainer = document.getElementById('lobbies-list');
        listContainer.innerHTML = '';
        
        if (lobbies.length === 0) {
            listContainer.innerHTML = '<p style="color: #aaa; text-align: center; margin: 20px;">No available lobbies</p>';
            return;
        }

        lobbies.forEach(lobby => {
            const lobbyItem = document.createElement('div');
            lobbyItem.className = 'lobby-item';
            lobbyItem.innerHTML = `
                <div class="lobby-info">
                    <span class="lobby-id">${lobby.id}</span>
                    <span class="lobby-host">Host: ${lobby.host}</span>
                    <span class="lobby-players">${lobby.players}/${lobby.maxPlayers}</span>
                </div>
                <button class="join-lobby-btn" data-lobby-id="${lobby.id}">JOIN</button>
            `;
            listContainer.appendChild(lobbyItem);

            lobbyItem.querySelector('.join-lobby-btn').addEventListener('click', () => {
                const playerName = document.getElementById('player-name').value || 'Player';
                myPlayerName = playerName;
                socket.emit('join-lobby', { lobbyId: lobby.id, playerName });
            });
        });
    });

    socket.on('lobby-error', (data) => {
        alert(data.message);
    });

    socket.on('player-ready-updated', (data) => {
        updatePlayersList(data.players);
    });

    socket.on('game-started', (data) => {
        gameStarted = true;
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('instructions').style.display = 'none';

        // Create players based on server data
        Object.entries(data.players).forEach(([playerId, playerData]) => {
            const isLocal = playerId === myPlayerId;
            createPlayer(playerId, playerData.name, playerData.position, isLocal);
            if (isLocal) {
                localPlayer = players.get(playerId);
                // Set up first-person camera
                setupFirstPersonCamera();
                // Request pointer lock for mouse look
                requestPointerLock();
            } else {
                remotePlayer = players.get(playerId);
            }
        });

        updateHealthUI(data.players);
    });

    socket.on('player-moved', (data) => {
        const player = players.get(data.playerId);
        if (player && !player.userData.isLocal) {
            player.position.set(data.position.x, data.position.y, data.position.z);
            player.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        }
    });

    socket.on('bullet-shot', (bullet) => {
        createBullet(bullet);
    });

    socket.on('player-hit', (data) => {
        const player = players.get(data.playerId);
        if (player) {
            // Visual feedback
            player.material.emissive.setHex(0xff0000);
            setTimeout(() => {
                player.material.emissive.setHex(player.userData.isLocal ? 0x003366 : 0x660033);
            }, 200);
        }
    });

    socket.on('game-state-update', (data) => {
        // Update remote players
        Object.entries(data.players).forEach(([playerId, playerData]) => {
            if (playerId !== myPlayerId) {
                const player = players.get(playerId);
                if (player) {
                    player.position.set(
                        playerData.position.x,
                        playerData.position.y,
                        playerData.position.z
                    );
                }
            }
        });

        // Update bullets
        const serverBulletIds = new Set(data.bullets.map(b => b.id));
        
        // Remove bullets not on server
        bullets.forEach((bullet, bulletId) => {
            if (!serverBulletIds.has(bulletId)) {
                scene.remove(bullet);
                bullets.delete(bulletId);
            }
        });

        // Update existing bullets or create new ones
        data.bullets.forEach(bulletData => {
            if (!bullets.has(bulletData.id)) {
                createBullet(bulletData);
            } else {
                const bullet = bullets.get(bulletData.id);
                bullet.position.set(bulletData.position.x, bulletData.position.y, bulletData.position.z);
            }
        });

        updateHealthUI(data.players);
    });

    socket.on('game-ended', (data) => {
        gameOver = true;
        const announcement = document.getElementById('winner-announcement');
        announcement.textContent = `${data.winner} WINS!`;
        announcement.classList.remove('hidden');
        
        setTimeout(() => {
            resetGame();
            location.reload();
        }, 5000);
    });
}

function updatePlayersList(playersList) {
    const listContainer = document.getElementById('players-list');
    listContainer.innerHTML = '';
    
    playersList.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span>${player.name}</span>
            <span class="ready-status">${player.ready ? '✓ READY' : 'NOT READY'}</span>
        `;
        listContainer.appendChild(playerItem);
    });
}

function createBullet(bulletData) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const isMyBullet = bulletData.shooterId === myPlayerId;
    const bulletMaterial = new THREE.MeshStandardMaterial({
        color: isMyBullet ? 0x0066ff : 0xff0066,
        emissive: isMyBullet ? 0x0066ff : 0xff0066,
        emissiveIntensity: 2
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(bulletData.position.x, bulletData.position.y, bulletData.position.z);
    bullet.userData = { id: bulletData.id, shooterId: bulletData.shooterId };
    scene.add(bullet);
    bullets.set(bulletData.id, bullet);
}

function setupEventListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = true; break;
            case 'KeyA': keys.a = true; break;
            case 'KeyS': keys.s = true; break;
            case 'KeyD': keys.d = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = false; break;
            case 'KeyA': keys.a = false; break;
            case 'KeyS': keys.s = false; break;
            case 'KeyD': keys.d = false; break;
        }
    });

    // Mouse movement for first-person camera
    document.addEventListener('mousemove', (e) => {
        if (mouseLocked && gameStarted) {
            const sensitivity = 0.002;
            cameraRotation.y -= e.movementX * sensitivity; // Yaw (left/right)
            cameraRotation.x -= e.movementY * sensitivity; // Pitch (up/down)
            
            // Limit pitch to prevent flipping
            cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
        }
    });

    window.addEventListener('mousedown', (e) => {
        if (!gameStarted || gameOver) return;
        
        // Request pointer lock when clicking in game
        if (!mouseLocked && gameStarted) {
            requestPointerLock();
        }
        
        if (e.button === 0 && localPlayer) { // Left click
            shoot();
        }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Pointer lock events
    document.addEventListener('pointerlockchange', () => {
        mouseLocked = document.pointerLockElement === renderer.domElement;
    });
    
    document.addEventListener('pointerlockerror', () => {
        console.log('Pointer lock failed');
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}

function setupFirstPersonCamera() {
    if (!localPlayer) return;
    // Camera will be positioned at player's eye level
    updateCameraPosition();
}

function requestPointerLock() {
    const canvas = renderer.domElement;
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
    if (canvas.requestPointerLock) {
        canvas.requestPointerLock();
    }
}

function updateCameraPosition() {
    if (!localPlayer) return;
    
    // Position camera at player's eye level (about 1.6 units up from player center)
    const eyeHeight = 1.6;
    camera.position.set(
        localPlayer.position.x,
        localPlayer.position.y + eyeHeight,
        localPlayer.position.z
    );
    
    // Apply camera rotation (yaw and pitch)
    const euler = new THREE.Euler(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
}

function updateLocalPlayer() {
    if (!gameStarted || gameOver || !localPlayer) return;

    // Movement relative to camera direction (first-person style)
    const moveDirection = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Create a flat forward vector (ignore pitch for ground movement)
    const flatForward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    const flatRight = new THREE.Vector3(-flatForward.z, 0, flatForward.x).normalize();
    
    // Calculate movement based on camera direction
    if (keys.w) moveDirection.add(flatForward);
    if (keys.s) moveDirection.sub(flatForward);
    if (keys.a) moveDirection.sub(flatRight);
    if (keys.d) moveDirection.add(flatRight);
    
    moveDirection.normalize();
    moveDirection.multiplyScalar(PLAYER_SPEED);
    
    localPlayer.position.add(moveDirection);
    localPlayer.position.x = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, localPlayer.position.x));
    localPlayer.position.z = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, localPlayer.position.z));
    
    // Update player rotation to match camera yaw
    localPlayer.rotation.y = cameraRotation.y;

    // Update camera position
    updateCameraPosition();

    // Send position to server
    socket.emit('player-move', {
        position: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
        },
        rotation: {
            x: localPlayer.rotation.x,
            y: localPlayer.rotation.y,
            z: localPlayer.rotation.z
        }
    });
}

function shoot() {
    if (!localPlayer) return;

    // Shoot in the direction the camera is facing
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    socket.emit('player-shoot', {
        position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        },
        direction: {
            x: direction.x,
            y: direction.y,
            z: direction.z
        }
    });
}

function updateHealthUI(playersData) {
    if (!playersData) return;

    Object.entries(playersData).forEach(([playerId, playerData]) => {
        const isLocal = playerId === myPlayerId;
        const healthPercent = (playerData.health / playerData.maxHealth) * 100;
        
        if (isLocal) {
            document.getElementById('p1-health').style.width = healthPercent + '%';
            document.querySelector('.player-1-ui .player-name').textContent = playerData.name.toUpperCase();
        } else {
            document.getElementById('p2-health').style.width = healthPercent + '%';
            document.querySelector('.player-2-ui .player-name').textContent = playerData.name.toUpperCase();
        }
    });
}

function resetGame() {
    gameStarted = false;
    gameOver = false;
    players.forEach(player => scene.remove(player));
    bullets.forEach(bullet => scene.remove(bullet));
    players.clear();
    bullets.clear();
    localPlayer = null;
    remotePlayer = null;
}

function showConnectionError(message) {
    const errorDiv = document.getElementById('connection-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
    updateConnectionStatus(false);
}

function hideConnectionError() {
    const errorDiv = document.getElementById('connection-error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
    updateConnectionStatus(true);
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    
    if (indicator && text) {
        if (connected) {
            indicator.className = 'connected';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'disconnected';
            text.textContent = 'Disconnected';
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (gameStarted && !gameOver) {
        updateLocalPlayer();
        // Ensure camera is always updated (even when not moving)
        if (localPlayer) {
            updateCameraPosition();
        }
    }
    
    // Rotate neon elements
    scene.children.forEach(child => {
        if (child.material && child.material.emissive) {
            child.rotation.y += 0.01;
        }
    });
    
    composer.render();
}

// Initialize
init();
