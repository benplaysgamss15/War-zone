/* =========================================================================
   FIRST-PERSON INFANTRY WEAPONS MODULE (weapons.js)
   Features 3D Gun Viewmodels, Recoil, AK-47 Fire, Physics Hand Grenades,
   and RPG Rocket Projectiles for First-Person View.
   ========================================================================= */

const WeaponsModule = (() => {
    let activeWeapon = 'AK47'; // 'AK47' | 'GRENADE' | 'RPG'
    let gunGroup = null;
    let muzzleFlash = null;
    let muzzleLight = null;

    const projectiles = []; // Thrown grenades & RPG rockets
    const tracers = [];     // High-speed bullet tracers
    const sparks = [];      // Impact spark particles

    let recoilZ = 0;
    let recoilPitch = 0;
    let swayTime = 0;
    let fireCooldown = 0;

    // --- PROCEDURAL WEAPON SOUNDS ---
    function playGunshotAudio(audioCtx) {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const bufferSize = audioCtx.sampleRate * 0.15;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.03));

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, now);
            filter.Q.setValueAtTime(1.5, now);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(1.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start(now);
        } catch(e) {}
    }

    function playGrenadeThrowAudio(audioCtx) {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch(e) {}
    }

    // --- 3D AK-47 GUN VIEWMODEL ---
    function init(scene, camera) {
        gunGroup = new THREE.Group();

        const receiverMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.15 });

        // Receiver Body
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), receiverMat);
        receiver.position.set(0, 0, 0);
        gunGroup.add(receiver);

        // Barrel & Gas Tube
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.035, -0.45);
        const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 8), metalMat);
        muzzleTip.rotation.x = Math.PI / 2;
        muzzleTip.position.set(0, 0.035, -0.72);
        gunGroup.add(barrel, muzzleTip);

        // Wooden Stock
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), woodMat);
        stock.position.set(0, -0.04, 0.42);
        gunGroup.add(stock);

        // Wooden Handguard
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.1, 0.28), woodMat);
        handguard.position.set(0, 0.02, -0.32);
        gunGroup.add(handguard);

        // Curved Magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.12), woodMat);
        mag.position.set(0, -0.18, -0.08);
        mag.rotation.x = -0.35;
        gunGroup.add(mag);

        // Pistol Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), woodMat);
        grip.position.set(0, -0.12, 0.18);
        grip.rotation.x = 0.4;
        gunGroup.add(grip);

        // Muzzle Flash Effect (Hidden by default)
        const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.0 });
        muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        muzzleFlash.position.set(0, 0.035, -0.78);
        gunGroup.add(muzzleFlash);

        muzzleLight = new THREE.PointLight(0xfacc15, 0, 8);
        muzzleLight.position.set(0, 0.035, -0.8);
        gunGroup.add(muzzleLight);

        // Position gun in front of First-Person Camera
        gunGroup.position.set(0.28, -0.26, -0.6);
        gunGroup.rotation.y = 0.04;
        camera.add(gunGroup);
        scene.add(camera);
    }

    // --- WEAPON FIRING HANDLER ---
    function fire(player, camera, scene, audioCtx, callbacks) {
        if (fireCooldown > 0) return;

        if (activeWeapon === 'AK47') {
            fireCooldown = 0.11; // High rate of automatic fire
            playGunshotAudio(audioCtx);

            // Muzzle flash burst
            muzzleFlash.material.opacity = 0.95;
            muzzleFlash.scale.setScalar(1.0 + Math.random() * 0.8);
            muzzleLight.intensity = 3.5;

            // Recoil kick
            recoilZ = 0.1;
            recoilPitch = 0.035;

            // Raycast forward from camera center
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

            // Fetch shootable objects
            const shootableTargets = [];
            if (callbacks.getShootables) {
                shootableTargets.push(...callbacks.getShootables());
            }

            const hits = raycaster.intersectObjects(shootableTargets, true);
            let hitPoint = null;
            let hitNormal = new THREE.Vector3(0, 1, 0);

            if (hits.length > 0) {
                hitPoint = hits[0].point;
                if (hits[0].face) hitNormal.copy(hits[0].face.normal);
            } else {
                hitPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(150));
            }

            // Bullet Tracer Line
            const originWorld = new THREE.Vector3();
            muzzleFlash.getWorldPosition(originWorld);

            const tracerGeo = new THREE.BufferGeometry().setFromPoints([originWorld, hitPoint]);
            const tracerMat = new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.9 });
            const tracer = new THREE.Line(tracerGeo, tracerMat);
            scene.add(tracer);
            tracers.push({ mesh: tracer, life: 0.08 });

            // Bullet Impact Sparks
            if (hits.length > 0) {
                for (let i = 0; i < 5; i++) {
                    const sparkMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.06, 0.06, 0.06),
                        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
                    );
                    sparkMesh.position.copy(hitPoint);
                    scene.add(sparkMesh);

                    sparks.push({
                        mesh: sparkMesh,
                        vx: (hitNormal.x + (Math.random() - 0.5) * 1.5) * 6,
                        vy: (hitNormal.y + (Math.random() - 0.5) * 1.5) * 6 + 2,
                        vz: (hitNormal.z + (Math.random() - 0.5) * 1.5) * 6,
                        life: 0.25
                    });
                }

                // Deliver Damage Callback
                if (callbacks.onBulletHit) {
                    callbacks.onBulletHit(hitPoint, hits[0]);
                }
            }
        } 
        else if (activeWeapon === 'GRENADE') {
            fireCooldown = 0.65;
            playGrenadeThrowAudio(audioCtx);

            // Spawn 3D Frag Grenade
            const nadeGroup = new THREE.Group();
            const nadeBody = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.5 })
            );
            const nadeCap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8),
                new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
            );
            nadeCap.position.y = 0.14;
            nadeGroup.add(nadeBody, nadeCap);

            // Launch from player position in look direction
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);

            nadeGroup.position.set(player.x, 1.6, player.z).add(forward.clone().multiplyScalar(0.8));
            scene.add(nadeGroup);

            projectiles.push({
                type: 'GRENADE',
                mesh: nadeGroup,
                vx: forward.x * 24,
                vy: forward.y * 24 + 4.5,
                vz: forward.z * 24,
                rx: (Math.random() - 0.5) * 12,
                ry: (Math.random() - 0.5) * 12,
                fuse: 2.2, // 2.2 second fuse
                radius: 12,
                damage: 130
            });
        } 
        else if (activeWeapon === 'RPG') {
            fireCooldown = 1.1;
            playGrenadeThrowAudio(audioCtx);

            // Shoulder Rocket Projectile
            const rocketGroup = new THREE.Group();
            const rocketBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8),
                new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 })
            );
            rocketBody.rotation.x = Math.PI / 2;
            const nose = new THREE.Mesh(
                new THREE.ConeGeometry(0.12, 0.3, 8),
                new THREE.MeshStandardMaterial({ color: 0xef4444 })
            );
            nose.position.z = 0.5;
            nose.rotation.x = Math.PI / 2;
            rocketGroup.add(rocketBody, nose);

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            rocketGroup.position.set(player.x, 1.5, player.z).add(forward.clone().multiplyScalar(0.8));
            rocketGroup.lookAt(rocketGroup.position.clone().add(forward));
            scene.add(rocketGroup);

            projectiles.push({
                type: 'RPG',
                mesh: rocketGroup,
                vx: forward.x * 55,
                vy: forward.y * 55,
                vz: forward.z * 55,
                fuse: 4.0,
                radius: 16,
                damage: 190
            });
        }
    }

    // --- ANIMATION & PHYSICS TICK ---
    function update(delta, camera, isFPV, scene, isMoving, callbacks) {
        if (fireCooldown > 0) fireCooldown -= delta;

        // Viewmodel Sway & Recoil Recovery
        if (gunGroup) {
            gunGroup.visible = isFPV && (activeWeapon === 'AK47');

            if (isFPV && activeWeapon === 'AK47') {
                if (isMoving) {
                    swayTime += delta * 10.0;
                }
                const swayX = Math.sin(swayTime) * 0.015;
                const swayY = Math.abs(Math.cos(swayTime)) * 0.015;

                // Recover recoil smoothly
                recoilZ = THREE.MathUtils.lerp(recoilZ, 0, delta * 18);
                recoilPitch = THREE.MathUtils.lerp(recoilPitch, 0, delta * 18);

                gunGroup.position.set(0.28 + swayX, -0.26 + swayY, -0.6 + recoilZ);
                gunGroup.rotation.x = recoilPitch;

                // Fade muzzle flash
                if (muzzleFlash.material.opacity > 0) {
                    muzzleFlash.material.opacity -= delta * 25.0;
                    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 40.0);
                }
            }
        }

        // Update Bullet Tracers
        for (let i = tracers.length - 1; i >= 0; i--) {
            const tr = tracers[i];
            tr.life -= delta;
            tr.mesh.material.opacity -= delta * 12.0;
            if (tr.life <= 0 || tr.mesh.material.opacity <= 0) {
                scene.remove(tr.mesh);
                tracers.splice(i, 1);
            }
        }

        // Update Impact Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
            const sp = sparks[i];
            sp.vy -= 25 * delta;
            sp.mesh.position.x += sp.vx * delta;
            sp.mesh.position.y += sp.vy * delta;
            sp.mesh.position.z += sp.vz * delta;
            sp.life -= delta;
            if (sp.life <= 0) {
                scene.remove(sp.mesh);
                sparks.splice(i, 1);
            }
        }

        // Update Thrown Grenades & Flying RPG Rockets
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.fuse -= delta;

            if (p.type === 'GRENADE') {
                p.vy -= 22 * delta; // Gravity
                p.mesh.position.x += p.vx * delta;
                p.mesh.position.y += p.vy * delta;
                p.mesh.position.z += p.vz * delta;

                p.mesh.rotation.x += p.rx * delta;
                p.mesh.rotation.y += p.ry * delta;

                // Ground Bounce & Friction
                if (p.mesh.position.y <= 0.25) {
                    p.mesh.position.y = 0.25;
                    p.vy = -p.vy * 0.45;
                    p.vx *= 0.75;
                    p.vz *= 0.75;
                }

                // Explode when fuse ends
                if (p.fuse <= 0) {
                    if (callbacks.onExplode) {
                        callbacks.onExplode(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.radius, p.damage);
                    }
                    scene.remove(p.mesh);
                    projectiles.splice(i, 1);
                }
            } 
            else if (p.type === 'RPG') {
                p.mesh.position.x += p.vx * delta;
                p.mesh.position.y += p.vy * delta;
                p.mesh.position.z += p.vz * delta;

                // Contact explosion (ground or fuse)
                if (p.mesh.position.y <= 0.3 || p.fuse <= 0) {
                    if (callbacks.onExplode) {
                        callbacks.onExplode(p.mesh.position.x, Math.max(0.5, p.mesh.position.y), p.mesh.position.z, p.radius, p.damage);
                    }
                    scene.remove(p.mesh);
                    projectiles.splice(i, 1);
                }
            }
        }
    }

    function setWeapon(type) {
        activeWeapon = type;
    }

    function getActiveWeapon() {
        return activeWeapon;
    }

    return {
        init,
        fire,
        update,
        setWeapon,
        getActiveWeapon
    };
})();
