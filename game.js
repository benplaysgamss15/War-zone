/* =========================================================================
   CITY COMMANDER: MAIN GAME CONTROLLER (game.js)
   Binds together orbitalCannon.js, buildings.js, weapons.js, and Three.js.
   ========================================================================= */

// Prevent default mobile browser pull/overscroll gestures
document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

/* --- START BUTTON & MODAL INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', initModal);
initModal();

function initModal() {
    const btn = document.getElementById('btn-accept');
    const modal = document.getElementById('warning-modal');
    if (btn && modal) {
        btn.onclick = () => {
            initAudio();
            modal.style.display = 'none';
        };
    }
}

/* --- 1. PROCEDURAL SOUND SYNTHESIZER --- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playExplosionSound(scale = 1.0) {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.9;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(360 * scale, now);
        filter.frequency.exponentialRampToValueAtTime(25, now + 0.9);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.0 * scale, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
    } catch(e) {}
}

function playOrbitalChargeSound() {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;

        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.exponentialRampToValueAtTime(1900, now + 3.1);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.linearRampToValueAtTime(0.7, now + 2.8);
        gain1.gain.linearRampToValueAtTime(0.01, now + 3.2);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 3.2);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.exponentialRampToValueAtTime(3200, now + 3.1);
        gain2.gain.setValueAtTime(0.1, now);
        gain2.gain.linearRampToValueAtTime(0.5, now + 2.9);
        gain2.gain.linearRampToValueAtTime(0.01, now + 3.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now);
        osc2.stop(now + 3.2);
    } catch(e) {}
}

function playLaserSound() {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.8);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
    } catch(e) {}
}

function playLaunchSound() {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.linearRampToValueAtTime(700, now + 0.65);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
    } catch(e) {}
}

/* --- 2. THREE.JS ENGINE INITIALIZATION --- */
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080e18);
scene.fog = new THREE.FogExp2(0x080e18, 0.014);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (container) container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x64748b, 1.0);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
sunLight.position.set(70, 110, 45);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 280;
sunLight.shadow.camera.left = -110;
sunLight.shadow.camera.right = 110;
sunLight.shadow.camera.top = 110;
sunLight.shadow.camera.bottom = -110;
scene.add(sunLight);

// Initialize External Modules
if (typeof OrbitalCannonModule !== 'undefined') OrbitalCannonModule.init(scene);
if (typeof BuildingsModule !== 'undefined') BuildingsModule.init(scene, 6, 22, 66);
if (typeof WeaponsModule !== 'undefined') WeaponsModule.init(scene, camera);

/* --- 3. GLOBAL GAME STATE --- */
let isFPV = false;
let selectedWeaponCmd = 'CRUISE';
let selectedWeaponFpv = 'AK47';
let collateralDamageMillions = 0;
let aliveCivilians = 0;
let inCutscene = false;

const npcs = [];
const cars = [];
const shelters = [];
const missiles = [];
const particles = [];
const physicsBlocks = [];

// FPV Camera Player
const player = {
    x: 0,
    y: 0,
    z: 40,
    yaw: 0,
    pitch: 0,
    speed: 16
};

// Tactical Drone Camera
const commanderCam = {
    x: 0,
    y: 72,
    z: 72,
    targetX: 0,
    targetZ: 0
};

/* --- 4. ENVIRONMENT: ASPHALT ROADS & SIDEWALKS --- */
const groundGeo = new THREE.PlaneGeometry(240, 240);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cityGridSize = 6;
const blockSpacing = 22;
const halfSize = (cityGridSize * blockSpacing) / 2; // 66

// Elevated Concrete Sidewalks
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
for (let gx = 0; gx < cityGridSize; gx++) {
    for (let gz = 0; gz < cityGridSize; gz++) {
        const posX = (gx * blockSpacing) - halfSize + blockSpacing / 2;
        const posZ = (gz * blockSpacing) - halfSize + blockSpacing / 2;

        const sidewalkMesh = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.25, 16.5), sidewalkMat);
        sidewalkMesh.position.set(posX, 0.125, posZ);
        sidewalkMesh.receiveShadow = true;
        scene.add(sidewalkMesh);
    }
}

// Road Divider Stripes
const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const roadAvenues = [-44, -22, 0, 22, 44];

roadAvenues.forEach(avenue => {
    const lineNS = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 140), roadLineMat);
    lineNS.rotation.x = -Math.PI / 2;
    lineNS.position.set(avenue, 0.02, 0);
    scene.add(lineNS);

    const lineEW = new THREE.Mesh(new THREE.PlaneGeometry(140, 0.3), roadLineMat);
    lineEW.rotation.x = -Math.PI / 2;
    lineEW.position.set(0, 0.02, avenue);
    scene.add(lineEW);
});

/* --- 5. STABLE TARGETING BEACON --- */
const targetGroup = new THREE.Group();
const targetMarkerGeo = new THREE.RingGeometry(2.0, 2.7, 32);
const targetMarkerMat = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
const targetRing = new THREE.Mesh(targetMarkerGeo, targetMarkerMat);
targetRing.rotation.x = -Math.PI / 2;
targetGroup.add(targetRing);

const targetDot = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
targetDot.rotation.x = -Math.PI / 2;
targetGroup.add(targetDot);

const beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 120, 8), new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.45 }));
beaconBeam.position.y = 60;
targetGroup.add(beaconBeam);

targetGroup.position.set(0, 0.1, 0);
scene.add(targetGroup);

/* --- 6. DESTRUCTIBLE SIDEWALK STALLS & SHELTERS --- */
function createStreetShelter(x, z, angle = 0) {
    const group = new THREE.Group();
    
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), pillarMat); p1.position.set(-1.4, 1.3, -0.8);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), pillarMat); p2.position.set(1.4, 1.3, -0.8);
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), pillarMat); p3.position.set(-1.4, 1.3, 0.8);
    const p4 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), pillarMat); p4.position.set(1.4, 1.3, 0.8);
    group.add(p1, p2, p3, p4);

    const roofGeo = new THREE.BoxGeometry(3.2, 0.35, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0xef4444 : 0x0284c7 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 2.6, 0);
    group.add(roof);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
    bench.position.set(0, 0.35, 0);
    group.add(bench);

    group.position.set(x, 0.25, z);
    group.rotation.y = angle;
    scene.add(group);

    shelters.push({ x: x, z: z, group: group, alive: true });
}

for (let gx = 0; gx < cityGridSize; gx++) {
    for (let gz = 0; gz < cityGridSize; gz++) {
        if ((gx + gz) % 2 === 0) {
            const blockCenterX = (gx * blockSpacing) - halfSize + blockSpacing / 2;
            const blockCenterZ = (gz * blockSpacing) - halfSize + blockSpacing / 2;
            const sx = blockCenterX + (gx < cityGridSize / 2 ? 7.2 : -7.2);
            const sz = blockCenterZ;
            createStreetShelter(sx, sz, 0);
        }
    }
}

/* --- 7. DEDICATED LANE CIVILIAN CARS --- */
const carColors = [0xef4444, 0x38bdf8, 0xfacc15, 0xf8fafc, 0x10b981];

function createCarMesh(color) {
    const group = new THREE.Group();
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 3.6), new THREE.MeshStandardMaterial({ color: color }));
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.9), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 }));
    cabin.position.set(0, 1.1, -0.2);
    group.add(cabin);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12);
    wGeo.rotateZ(Math.PI / 2);

    const wFL = new THREE.Mesh(wGeo, wheelMat); wFL.position.set(-0.95, 0.32, 1.0);
    const wFR = new THREE.Mesh(wGeo, wheelMat); wFR.position.set(0.95, 0.32, 1.0);
    const wBL = new THREE.Mesh(wGeo, wheelMat); wBL.position.set(-0.95, 0.32, -1.0);
    const wBR = new THREE.Mesh(wGeo, wheelMat); wBR.position.set(0.95, 0.32, -1.0);
    group.add(wFL, wFR, wBL, wBR);

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.1), lightMat); hl1.position.set(-0.55, 0.55, 1.85);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.1), lightMat); hl2.position.set(0.55, 0.55, 1.85);
    group.add(hl1, hl2);

    return group;
}

let carId = 0;
roadAvenues.forEach((avenuePos) => {
    [-1.8, 1.8].forEach((laneOffset, idx) => {
        const dir = laneOffset > 0 ? 1 : -1;
        const startZ = (idx === 0 ? -40 : 40) + (Math.random() - 0.5) * 10;
        const carGroup = createCarMesh(carColors[carId % carColors.length]);
        carId++;

        const carObj = {
            id: carId,
            group: carGroup,
            isNorthSouth: true,
            fixedRoadPos: avenuePos + laneOffset,
            x: avenuePos + laneOffset,
            z: startZ,
            dir: dir,
            baseSpeed: 10.0 + Math.random() * 3.0,
            currentSpeed: 10.0,
            alive: true
        };
        carGroup.position.set(carObj.x, 0, carObj.z);
        carGroup.rotation.y = dir > 0 ? 0 : Math.PI;
        scene.add(carGroup);
        cars.push(carObj);
    });

    [-1.8, 1.8].forEach((laneOffset, idx) => {
        const dir = laneOffset > 0 ? 1 : -1;
        const startX = (idx === 0 ? -40 : 40) + (Math.random() - 0.5) * 10;
        const carGroup = createCarMesh(carColors[carId % carColors.length]);
        carId++;

        const carObj = {
            id: carId,
            group: carGroup,
            isNorthSouth: false,
            fixedRoadPos: avenuePos + laneOffset,
            x: startX,
            z: avenuePos + laneOffset,
            dir: dir,
            baseSpeed: 10.0 + Math.random() * 3.0,
            currentSpeed: 10.0,
            alive: true
        };
        carGroup.position.set(carObj.x, 0, carObj.z);
        carGroup.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        scene.add(carGroup);
        cars.push(carObj);
    });
});

/* --- 8. BLOCKY 3D SMART NPCS --- */
const shirtColors = [0x38bdf8, 0xef4444, 0x10b981, 0xf59e0b, 0xa855f7];

function createBlockyNPCMesh(shirtColor) {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd1a4 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), eyeMat); leftEye.position.set(-0.1, 1.38, 0.19);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), eyeMat); rightEye.position.set(0.1, 1.38, 0.19);
    group.add(leftEye, rightEye);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.26), shirtMat);
    torso.position.y = 0.9;
    torso.castShadow = true;
    group.add(torso);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), shirtMat); leftArm.position.set(-0.32, 0.9, 0); leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), shirtMat); rightArm.position.set(0.32, 0.9, 0); rightArm.castShadow = true;
    group.add(leftArm, rightArm);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), pantsMat); leftLeg.position.set(-0.13, 0.3, 0); leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), pantsMat); rightLeg.position.set(0.13, 0.3, 0); rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);

    return { group, leftLeg, rightLeg, leftArm, rightArm, shirtMat };
}

for (let i = 0; i < 45; i++) {
    const shirtCol = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    const npcData = createBlockyNPCMesh(shirtCol);

    let spawnX, spawnZ;
    if (Math.random() > 0.5) {
        const col = Math.floor(Math.random() * (cityGridSize + 1));
        spawnX = (col * blockSpacing) - halfSize + 4.2;
        spawnZ = (Math.random() - 0.5) * (cityGridSize * blockSpacing);
    } else {
        const row = Math.floor(Math.random() * (cityGridSize + 1));
        spawnZ = (row * blockSpacing) - halfSize + 4.2;
        spawnX = (Math.random() - 0.5) * (cityGridSize * blockSpacing);
    }

    npcData.group.position.set(spawnX, 0.25, spawnZ);
    scene.add(npcData.group);

    const angle = Math.floor(Math.random() * 4) * (Math.PI / 2);
    npcs.push({
        ...npcData,
        x: spawnX,
        z: spawnZ,
        angle: angle,
        targetAngle: angle,
        speed: 2.5,
        alive: true,
        state: 'WANDER',
        panicTimer: 0,
        targetShelter: null,
        animWalk: Math.random() * 10
    });
}
aliveCivilians = npcs.length;
updateHUD();

/* --- 9. EXPLOSION & DESTRUCTION PIPELINE --- */
function triggerExplosion(x, y, z, radius = 14, damage = 100) {
    playExplosionSound(radius > 16 ? 1.6 : 1.1);

    const blastMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 })
    );
    blastMesh.position.set(x, Math.max(y, 1), z);
    scene.add(blastMesh);
    particles.push({ mesh: blastMesh, scaleSpeed: 26, fadeSpeed: 3.2, maxScale: radius * 1.5 });

    // Apply destruction and structural leaning physics to buildings
    if (typeof BuildingsModule !== 'undefined') {
        BuildingsModule.damageBuildingAt(x, y, z, radius, damage, physicsBlocks, (collapsedBuilding) => {
            collateralDamageMillions += Math.floor(collapsedBuilding.totalHeight * 2.5);
            updateHUD();
        });
    }

    // Destroy Sidewalk Stalls
    shelters.forEach(sh => {
        if (!sh.alive) return;
        const dist = Math.hypot(sh.x - x, sh.z - z);
        if (dist < radius + 2.5) {
            sh.alive = false;
            scene.remove(sh.group);
            collateralDamageMillions += 1;
            updateHUD();

            const canopyDebris = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 2.0), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
            canopyDebris.position.set(sh.x, 2.5, sh.z);
            scene.add(canopyDebris);
            physicsBlocks.push({ mesh: canopyDebris, vx: (Math.random() - 0.5) * 15, vy: 14, vz: (Math.random() - 0.5) * 15, rx: 3, ry: 3, rz: 3, life: 4.0 });

            npcs.forEach(npc => {
                if (npc.targetShelter === sh) {
                    npc.state = 'PANIC';
                    npc.targetShelter = null;
                    npc.panicTimer = 10.0;
                }
            });
        }
    });

    // Destroy Civilian Cars
    cars.forEach(car => {
        if (!car.alive) return;
        const dist = Math.hypot(car.x - x, car.z - z);
        if (dist < radius) {
            car.alive = false;
            collateralDamageMillions += 2;
            updateHUD();

            physicsBlocks.push({
                mesh: car.group,
                vx: (car.x - x) * 2.5 + (Math.random() - 0.5) * 10,
                vy: 14 + Math.random() * 12,
                vz: (car.z - z) * 2.5 + (Math.random() - 0.5) * 10,
                rx: (Math.random() - 0.5) * 8,
                ry: (Math.random() - 0.5) * 8,
                rz: (Math.random() - 0.5) * 8,
                life: 4.5
            });
        }
    });

    // Panic & Casualty handling for NPCs
    npcs.forEach(npc => {
        if (!npc.alive) return;
        const dist = Math.hypot(npc.x - x, npc.z - z);

        if (dist < radius) {
            npc.alive = false;
            npc.group.rotation.x = Math.PI / 2;
            npc.group.position.y = 0.2;
            npc.shirtMat.color.setHex(0xef4444);
            aliveCivilians = Math.max(0, aliveCivilians - 1);
            collateralDamageMillions += 5;
            updateHUD();
        } else {
            npc.state = 'PANIC';
            npc.panicTimer = 12.0;

            let nearestShelter = null;
            let minDist = 45;
            shelters.forEach(sh => {
                if (!sh.alive) return;
                const d = Math.hypot(npc.x - sh.x, npc.z - sh.z);
                if (d < minDist) {
                    minDist = d;
                    nearestShelter = sh;
                }
            });

            if (nearestShelter) {
                npc.targetShelter = nearestShelter;
                npc.targetAngle = Math.atan2(nearestShelter.x - npc.x, nearestShelter.z - npc.z);
            } else {
                npc.targetAngle = Math.atan2(npc.x - x, npc.z - z);
            }
        }
    });
}

function updateHUD() {
    const cEl = document.getElementById('hud-civilians');
    const bEl = document.getElementById('hud-buildings');
    const clEl = document.getElementById('hud-collateral');
    if (cEl) cEl.innerText = aliveCivilians;
    if (bEl && typeof BuildingsModule !== 'undefined') bEl.innerText = BuildingsModule.getActiveCount();
    if (clEl) clEl.innerText = `$${collateralDamageMillions}M`;
}

/* --- 10. WEAPON LAUNCHERS & FIRING PIPELINE --- */
function launchCommanderStrike(targetPos) {
    initAudio();

    if (selectedWeaponCmd === 'CRUISE') {
        playLaunchSound();
        const missile = createCruiseMissileModule();
        missile.position.set(targetPos.x + 25, 95, targetPos.z + 25);
        missile.lookAt(targetPos.x, 0, targetPos.z);
        scene.add(missile);

        missiles.push({
            mesh: missile,
            target: new THREE.Vector3(targetPos.x, 0, targetPos.z),
            speed: 80,
            radius: 22,
            damage: 180
        });
    } 
    else if (selectedWeaponCmd === 'CLUSTER') {
        playLaunchSound();
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetZ = (Math.random() - 0.5) * 20;
                const pod = createClusterDispenserModule();
                pod.position.set(targetPos.x + offsetX, 75, targetPos.z + offsetZ);
                pod.lookAt(targetPos.x + offsetX, 0, targetPos.z + offsetZ);
                scene.add(pod);

                missiles.push({
                    mesh: pod,
                    target: new THREE.Vector3(targetPos.x + offsetX, 0, targetPos.z + offsetZ),
                    speed: 65,
                    radius: 12,
                    damage: 90
                });
            }, i * 140);
        }
    } 
    else if (selectedWeaponCmd === 'LASER') {
        playOrbitalChargeSound();
        inCutscene = true;

        if (typeof OrbitalCannonModule !== 'undefined') {
            OrbitalCannonModule.triggerCutscene(targetPos, camera, scene, {
                onImpact: (beamMesh) => {
                    playLaserSound();
                    triggerExplosion(targetPos.x, 0, targetPos.z, 28, 280);

                    particles.push({
                        mesh: beamMesh,
                        scaleSpeed: 2,
                        fadeSpeed: 1.6,
                        maxScale: 1.5
                    });
                },
                onComplete: () => {
                    inCutscene = false;
                }
            });
        }
    }
}

function createCruiseMissileModule() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.6, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.3 }));
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 }));
    nose.position.z = 2.4;
    nose.rotation.x = Math.PI / 2;
    group.add(nose);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const wings = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.8), wingMat); wings.position.z = 0.2;
    group.add(wings);

    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.5), wingMat); fin1.position.z = -1.5;
    const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.5), wingMat); fin2.position.z = -1.5;
    group.add(fin1, fin2);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flame.position.z = -2.2;
    flame.rotation.x = -Math.PI / 2;
    group.add(flame);

    return group;
}

function createClusterDispenserModule() {
    const group = new THREE.Group();
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 }));
    pod.rotation.x = Math.PI / 2;
    group.add(pod);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    nose.position.z = 1.1;
    group.add(nose);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    fin.position.z = -1.0;
    group.add(fin);

    return group;
}

/* --- 11. RAYCASTING & INPUT DISPATCH --- */
const raycaster = new THREE.Raycaster();
const mousePos = new THREE.Vector2();
let targetAimPoint = new THREE.Vector3(0, 0, 0);

function updateRaycastToPoint(screenX, screenY) {
    if (inCutscene) return;
    mousePos.x = (screenX / window.innerWidth) * 2 - 1;
    mousePos.y = -(screenY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mousePos, camera);
    
    const intersects = raycaster.intersectObject(ground);
    if (intersects.length > 0) {
        targetAimPoint.copy(intersects[0].point);
        targetGroup.position.set(targetAimPoint.x, 0.1, targetAimPoint.z);
    }
}

window.addEventListener('mousemove', (e) => {
    if (inCutscene) return;
    if (isFPV) {
        player.yaw -= e.movementX * 0.0028;
        player.pitch -= e.movementY * 0.0028;
        player.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, player.pitch));
    }
});

window.addEventListener('click', (e) => {
    if (inCutscene || e.target.closest('#warning-modal') || e.target.closest('#hud')) return;

    if (isFPV) {
        if (document.pointerLockElement !== document.body && !('ontouchstart' in window)) {
            document.body.requestPointerLock();
        }

        // Fire First-Person Infantry Weapon (AK-47 / Grenade / RPG)
        if (typeof WeaponsModule !== 'undefined') {
            WeaponsModule.fire(player, camera, scene, audioCtx, {
                getShootables: () => [ground, ...cars.map(c => c.group), ...npcs.map(n => n.group), ...scene.children],
                onBulletHit: (hitPos, hitObj) => {
                    // Check if bullet struck building support or NPC
                    if (typeof BuildingsModule !== 'undefined') {
                        BuildingsModule.damageBuildingAt(hitPos.x, hitPos.y, hitPos.z, 2.5, 35, physicsBlocks, (collapsed) => {
                            collateralDamageMillions += Math.floor(collapsed.totalHeight * 2.5);
                            updateHUD();
                        });
                    }
                }
            });
        }
    } else {
        updateRaycastToPoint(e.clientX, e.clientY);
        launchCommanderStrike(targetAimPoint);
    }
});

/* --- 12. DYNAMIC HUD & WEAPON TOGGLE --- */
const keys = {};
window.addEventListener('keydown', (e) => {
    if (inCutscene) return;
    keys[e.code] = true;
    if (e.code === 'Digit1') setWeaponSlot(1);
    if (e.code === 'Digit2') setWeaponSlot(2);
    if (e.code === 'Digit3') setWeaponSlot(3);
    if (e.code === 'Tab') {
        e.preventDefault();
        toggleCameraMode();
    }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function setWeaponSlot(slotIndex) {
    document.querySelectorAll('.weap-btn').forEach((btn, idx) => {
        const isActive = (idx + 1 === slotIndex);
        btn.classList.toggle('active', isActive);
        if (isActive) {
            if (isFPV) {
                selectedWeaponFpv = btn.dataset.fpv;
                if (typeof WeaponsModule !== 'undefined') WeaponsModule.setWeapon(selectedWeaponFpv);
            } else {
                selectedWeaponCmd = btn.dataset.cmd;
            }
        }
    });
}

function updateHUDWeaponLabels() {
    const b1 = document.getElementById('btn-w1');
    const b2 = document.getElementById('btn-w2');
    const b3 = document.getElementById('btn-w3');

    if (isFPV) {
        if (b1) b1.innerText = '1: AK-47 RIFLE';
        if (b2) b2.innerText = '2: FRAG GRENADE';
        if (b3) b3.innerText = '3: RPG ROCKET';
        if (typeof WeaponsModule !== 'undefined') WeaponsModule.setWeapon(selectedWeaponFpv);
    } else {
        if (b1) b1.innerText = '1: CRUISE MISSILE';
        if (b2) b2.innerText = '2: CLUSTER BARRAGE';
        if (b3) b3.innerText = '3: ORBITAL BEAM';
    }
}

document.querySelectorAll('.weap-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => setWeaponSlot(idx + 1));
});

function toggleCameraMode() {
    if (inCutscene) return;
    isFPV = !isFPV;
    const modeEl = document.getElementById('hud-cam-mode');
    const toggleEl = document.getElementById('btn-toggle-cam');
    const reticleEl = document.getElementById('reticle');
    
    if (modeEl) modeEl.innerText = isFPV ? 'FIRST PERSON' : 'COMMANDER';
    if (toggleEl) toggleEl.innerText = isFPV ? 'SWITCH TO DRONE [TAB]' : 'SWITCH TO FPV [TAB]';
    if (reticleEl) reticleEl.style.display = isFPV ? 'block' : 'none';

    updateHUDWeaponLabels();

    if (isFPV && !('ontouchstart' in window)) {
        document.body.requestPointerLock();
    } else {
        document.exitPointerLock?.();
    }
}

const camBtn = document.getElementById('btn-toggle-cam');
if (camBtn) camBtn.addEventListener('click', toggleCameraMode);

/* --- 13. MOBILE TOUCH CONTROLS --- */
const joystick = { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0 };
const joystickZone = document.getElementById('joystick-container');
const joystickKnob = document.getElementById('joystick-knob');
let touchLookId = null;
let lastTouchX = 0;
let lastTouchY = 0;

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const mobControls = document.getElementById('mobile-controls');
    if (mobControls) mobControls.style.display = 'flex';

    window.addEventListener('touchstart', (e) => {
        if (inCutscene) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            if (touch.clientX < window.innerWidth / 2 && !joystick.active && joystickZone) {
                const rect = joystickZone.getBoundingClientRect();
                joystick.active = true;
                joystick.startX = rect.left + rect.width / 2;
                joystick.startY = rect.top + rect.height / 2;
            } else if (touch.clientX >= window.innerWidth / 2) {
                if (!e.target.closest('#btn-mobile-fire') && !e.target.closest('#hud')) {
                    if (isFPV) {
                        touchLookId = touch.identifier;
                        lastTouchX = touch.clientX;
                        lastTouchY = touch.clientY;
                    } else {
                        updateRaycastToPoint(touch.clientX, touch.clientY);
                    }
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (inCutscene) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (joystick.active && touch.clientX < window.innerWidth / 2 && joystickKnob) {
                const dx = touch.clientX - joystick.startX;
                const dy = touch.clientY - joystick.startY;
                const dist = Math.min(45, Math.hypot(dx, dy));
                const angle = Math.atan2(dy, dx);
                joystick.moveX = (Math.cos(angle) * dist) / 45;
                joystick.moveY = (Math.sin(angle) * dist) / 45;
                joystickKnob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
            }

            if (isFPV && touch.identifier === touchLookId) {
                const dx = touch.clientX - lastTouchX;
                const dy = touch.clientY - lastTouchY;
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;

                player.yaw -= dx * 0.0055;
                player.pitch -= dy * 0.0055;
                player.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, player.pitch));
            }
        }
    }, { passive: false });

    const handleTouchEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.clientX < window.innerWidth / 2) {
                joystick.active = false;
                joystick.moveX = 0;
                joystick.moveY = 0;
                if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
            }
            if (touch.identifier === touchLookId) {
                touchLookId = null;
            }
        }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    const mobFire = document.getElementById('btn-mobile-fire');
    if (mobFire) {
        mobFire.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (inCutscene) return;
            if (isFPV) {
                if (typeof WeaponsModule !== 'undefined') {
                    WeaponsModule.fire(player, camera, scene, audioCtx, {
                        getShootables: () => [ground, ...cars.map(c => c.group), ...npcs.map(n => n.group), ...scene.children],
                        onBulletHit: (hitPos) => {
                            if (typeof BuildingsModule !== 'undefined') {
                                BuildingsModule.damageBuildingAt(hitPos.x, hitPos.y, hitPos.z, 2.5, 35, physicsBlocks, (collapsed) => {
                                    collateralDamageMillions += Math.floor(collapsed.totalHeight * 2.5);
                                    updateHUD();
                                });
                            }
                        }
                    });
                }
            } else {
                launchCommanderStrike(targetAimPoint);
            }
        });
    }
}

/* --- 14. MAIN SIMULATION & ANIMATION LOOP --- */
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    targetRing.scale.setScalar(1 + Math.sin(Date.now() * 0.008) * 0.12);

    // 1. Update Space Sector via orbitalCannon.js
    if (typeof OrbitalCannonModule !== 'undefined') {
        OrbitalCannonModule.update(delta, inCutscene, 0, camera, scene);
    }

    // 2. Update Leaning Buildings & Physics via buildings.js
    if (typeof BuildingsModule !== 'undefined') {
        BuildingsModule.update(delta);
    }

    // 3. Update FPV Weapons & Projectiles via weapons.js
    let isMoving = (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || joystick.active);
    if (typeof WeaponsModule !== 'undefined') {
        WeaponsModule.update(delta, camera, isFPV, scene, isMoving, {
            onExplode: (x, y, z, radius, damage) => {
                triggerExplosion(x, y, z, radius, damage);
            }
        });
    }

    // 4. Update Commander Missiles
    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        const dir = new THREE.Vector3().subVectors(m.target, m.mesh.position);
        const dist = dir.length();
        if (dist < 2.0 || m.mesh.position.y <= 0.2) {
            triggerExplosion(m.target.x, 0, m.target.z, m.radius, m.damage);
            scene.remove(m.mesh);
            missiles.splice(i, 1);
        } else {
            dir.normalize();
            m.mesh.position.addScaledVector(dir, m.speed * delta);
        }
    }

    // 5. Update Particle Bursts
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.scale.addScalar(p.scaleSpeed * delta);
        p.mesh.material.opacity -= p.fadeSpeed * delta;
        if (p.mesh.material.opacity <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }

    // 6. Update Structural Physics Debris
    for (let i = physicsBlocks.length - 1; i >= 0; i--) {
        const d = physicsBlocks[i];
        d.vy -= 26 * delta;
        d.mesh.position.x += d.vx * delta;
        d.mesh.position.y += d.vy * delta;
        d.mesh.position.z += d.vz * delta;

        d.mesh.rotation.x += d.rx * delta;
        d.mesh.rotation.y += d.ry * delta;
        d.mesh.rotation.z += d.rz * delta;

        d.life -= delta;

        if (d.mesh.position.y < 1.0) {
            d.mesh.position.y = 1.0;
            d.vy = -d.vy * 0.3;
            d.vx *= 0.8;
            d.vz *= 0.8;
        }

        if (d.life <= 0) {
            scene.remove(d.mesh);
            physicsBlocks.splice(i, 1);
        }
    }

    // 7. Update Dedicated Lane Traffic
    cars.forEach(car => {
        if (!car.alive) return;

        let carAheadDistance = 999;
        cars.forEach(otherCar => {
            if (otherCar.id === car.id || !otherCar.alive) return;
            if (otherCar.isNorthSouth === car.isNorthSouth && Math.abs(otherCar.fixedRoadPos - car.fixedRoadPos) < 1.0) {
                if (car.isNorthSouth) {
                    const diff = (otherCar.z - car.z) * car.dir;
                    if (diff > 0 && diff < carAheadDistance) carAheadDistance = diff;
                } else {
                    const diff = (otherCar.x - car.x) * car.dir;
                    if (diff > 0 && diff < carAheadDistance) carAheadDistance = diff;
                }
            }
        });

        if (carAheadDistance < 6.0) {
            car.currentSpeed = Math.max(0, car.currentSpeed - 20 * delta);
        } else {
            car.currentSpeed = Math.min(car.baseSpeed, car.currentSpeed + 10 * delta);
        }

        if (car.isNorthSouth) {
            car.z += car.dir * car.currentSpeed * delta;
            car.x = car.fixedRoadPos;
            if (car.z > 58 && car.dir > 0) car.z = -58;
            if (car.z < -58 && car.dir < 0) car.z = 58;
        } else {
            car.x += car.dir * car.currentSpeed * delta;
            car.z = car.fixedRoadPos;
            if (car.x > 58 && car.dir > 0) car.x = -58;
            if (car.x < -58 && car.dir < 0) car.x = 58;
        }

        car.group.position.set(car.x, 0, car.z);
    });

    // 8. Update Smart NPCs
    npcs.forEach(npc => {
        if (!npc.alive) return;

        if (npc.state === 'PANIC') {
            npc.panicTimer -= delta;
            npc.speed = 6.5;

            if (npc.targetShelter) {
                const distToShelter = Math.hypot(npc.x - npc.targetShelter.x, npc.z - npc.targetShelter.z);
                if (distToShelter < 1.5) {
                    npc.state = 'HIDING';
                    npc.speed = 0;
                }
            }

            if (npc.panicTimer <= 0) {
                npc.state = 'WANDER';
                npc.speed = 2.5;
                npc.targetShelter = null;
            }
        }

        let angleDiff = npc.targetAngle - npc.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        npc.angle += angleDiff * 6.0 * delta;

        const forwardProbeX = npc.x + Math.sin(npc.angle) * 3.0;
        const forwardProbeZ = npc.z + Math.cos(npc.angle) * 3.0;

        let obstacleAhead = false;
        if (Math.abs(forwardProbeX) > 62 || Math.abs(forwardProbeZ) > 62) {
            obstacleAhead = true;
        }

        if (obstacleAhead && npc.state !== 'HIDING') {
            npc.targetAngle += (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
        }

        if (npc.state !== 'HIDING') {
            npc.x += Math.sin(npc.angle) * npc.speed * delta;
            npc.z += Math.cos(npc.angle) * npc.speed * delta;
        }

        npc.group.position.x = npc.x;
        npc.group.position.z = npc.z;
        npc.group.rotation.y = npc.angle;

        npc.animWalk += delta * (npc.state === 'PANIC' ? 18 : 8);
        const swing = Math.sin(npc.animWalk) * 0.45;

        if (npc.state === 'PANIC') {
            npc.leftArm.rotation.x = Math.PI - swing;
            npc.rightArm.rotation.x = Math.PI + swing;
        } else if (npc.state === 'HIDING') {
            npc.leftArm.rotation.x = 0.5;
            npc.rightArm.rotation.x = 0.5;
            npc.group.scale.set(0.9, 0.7, 0.9);
        } else {
            npc.group.scale.set(1.0, 1.0, 1.0);
            npc.leftLeg.rotation.x = swing;
            npc.rightLeg.rotation.x = -swing;
            npc.leftArm.rotation.x = -swing;
            npc.rightArm.rotation.x = swing;
        }
    });

    // 9. Camera Navigation, FPV Interior Climbing & Movement
    if (!inCutscene) {
        if (isFPV) {
            if (keys['ArrowLeft']) player.yaw += 2.0 * delta;
            if (keys['ArrowRight']) player.yaw -= 2.0 * delta;
            if (keys['ArrowUp']) player.pitch = Math.min(Math.PI / 2.5, player.pitch + 1.5 * delta);
            if (keys['ArrowDown']) player.pitch = Math.max(-Math.PI / 2.5, player.pitch - 1.5 * delta);

            let moveX = 0;
            let moveZ = 0;

            if (keys['KeyW']) moveZ -= 1;
            if (keys['KeyS']) moveZ += 1;
            if (keys['KeyA']) moveX -= 1;
            if (keys['KeyD']) moveX += 1;

            if (joystick.active) {
                moveX += joystick.moveX;
                moveZ += joystick.moveY;
            }

            const forwardX = -Math.sin(player.yaw);
            const forwardZ = -Math.cos(player.yaw);
            const sideX = Math.cos(player.yaw);
            const sideZ = -Math.sin(player.yaw);

            player.x += (forwardX * -moveZ + sideX * moveX) * player.speed * delta;
            player.z += (forwardZ * -moveZ + sideZ * moveX) * player.speed * delta;

            // Check if player is inside a building or climbing stairs
            let targetY = 0;
            if (typeof BuildingsModule !== 'undefined') {
                const interiorCheck = BuildingsModule.checkPlayerInterior(player.x, player.z, player.y);
                targetY = interiorCheck.groundHeight;
            }
            player.y = THREE.MathUtils.lerp(player.y, targetY, delta * 12);

            camera.position.set(player.x, 1.8 + player.y, player.z);
            const lookTarget = new THREE.Vector3(
                player.x - Math.sin(player.yaw) * Math.cos(player.pitch),
                1.8 + player.y + Math.sin(player.pitch),
                player.z - Math.cos(player.yaw) * Math.cos(player.pitch)
            );
            camera.lookAt(lookTarget);

            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObject(ground);
            if (intersects.length > 0) {
                targetAimPoint.copy(intersects[0].point);
                targetGroup.position.set(targetAimPoint.x, 0.1, targetAimPoint.z);
            }
        } else {
            if (keys['KeyW'] || keys['ArrowUp']) commanderCam.targetZ -= 40 * delta;
            if (keys['KeyS'] || keys['ArrowDown']) commanderCam.targetZ += 40 * delta;
            if (keys['KeyA'] || keys['ArrowLeft']) commanderCam.targetX -= 40 * delta;
            if (keys['KeyD'] || keys['ArrowRight']) commanderCam.targetX += 40 * delta;

            if (joystick.active) {
                commanderCam.targetX += joystick.moveX * 40 * delta;
                commanderCam.targetZ += joystick.moveY * 40 * delta;
            }

            commanderCam.x += (commanderCam.targetX - commanderCam.x) * 0.1;
            commanderCam.z += (commanderCam.targetZ + 72 - commanderCam.z) * 0.1;

            camera.position.set(commanderCam.x, commanderCam.y, commanderCam.z);
            camera.lookAt(commanderCam.x, 0, commanderCam.z - 72);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Launch loop
animate();
