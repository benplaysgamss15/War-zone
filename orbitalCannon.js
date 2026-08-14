/* =========================================================================
   ORBITAL CANNON & SPACE CUTSCENE MODULE (orbitalCannon.js)
   Frame-driven 2-phase cutscene with zero-hang guarantees.
   ========================================================================= */

const OrbitalCannonModule = (() => {
    const spaceOrigin = new THREE.Vector3(0, 800, 0);
    const spaceGroup = new THREE.Group();
    spaceGroup.position.copy(spaceOrigin);

    let satCore, satCoreGlow, satRing1, satRing2, satRing3, satBarrel, satChargeLight;
    const shootingStars = [];
    const chargingParticles = [];

    // Frame-driven cutscene state
    let isCutsceneActive = false;
    let cutsceneTime = 0;
    let targetGroundPos = new THREE.Vector3();
    let currentBeamMesh = null;
    let cutsceneCallbacks = null;
    let impactFired = false;

    function init(scene) {
        scene.add(spaceGroup);

        // 1. Bright Space Lighting
        const spaceLight = new THREE.DirectionalLight(0xffffff, 3.0);
        spaceLight.position.set(spaceOrigin.x + 90, spaceOrigin.y + 70, spaceOrigin.z + 100);
        scene.add(spaceLight);

        const earthRimLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
        earthRimLight.position.set(spaceOrigin.x - 70, spaceOrigin.y - 30, spaceOrigin.z - 80);
        scene.add(earthRimLight);

        const spaceAmbient = new THREE.AmbientLight(0x334155, 1.8);
        spaceGroup.add(spaceAmbient);

        satChargeLight = new THREE.PointLight(0x38bdf8, 0, 80);
        satChargeLight.position.set(0, -8.5, 0);
        spaceGroup.add(satChargeLight);

        // 2. Earth Horizon
        const earthHorizonGeo = new THREE.SphereGeometry(220, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const earthHorizonMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.BackSide, transparent: true, opacity: 0.9 });
        const earthHorizon = new THREE.Mesh(earthHorizonGeo, earthHorizonMat);
        earthHorizon.position.set(0, -240, 0);
        spaceGroup.add(earthHorizon);

        // 3. Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = 700;
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            starPos[i] = (Math.random() - 0.5) * 450;
            starPos[i + 1] = (Math.random() - 0.5) * 450;
            starPos[i + 2] = (Math.random() - 0.5) * 450;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8 }));
        spaceGroup.add(stars);

        // 4. Shooting Stars
        for (let i = 0; i < 5; i++) {
            const streakGeo = new THREE.CylinderGeometry(0.08, 0.4, 18, 6);
            streakGeo.rotateZ(Math.PI / 3);
            const streakMat = new THREE.MeshBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.0 });
            const streak = new THREE.Mesh(streakGeo, streakMat);
            spaceGroup.add(streak);

            shootingStars.push({
                mesh: streak,
                speed: 130 + Math.random() * 60,
                active: false,
                timer: Math.random() * 2.5
            });
        }

        // 5. In-Flow Charging Particle Swarm
        for (let i = 0; i < 40; i++) {
            const pMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.0 })
            );
            spaceGroup.add(pMesh);
            chargingParticles.push({
                mesh: pMesh,
                angle: Math.random() * Math.PI * 2,
                dist: 12 + Math.random() * 14,
                speed: 8 + Math.random() * 10
            });
        }

        // 6. Massive Heavy Superstructure
        const satHub = new THREE.Mesh(
            new THREE.CylinderGeometry(5.0, 6.5, 14.0, 16),
            new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 })
        );
        spaceGroup.add(satHub);

        const truss = new THREE.Mesh(
            new THREE.BoxGeometry(4.0, 22.0, 4.0),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })
        );
        spaceGroup.add(truss);

        // Solar Arrays
        const solarWingGeo = new THREE.BoxGeometry(28.0, 0.2, 7.0);
        const solarWingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.95, roughness: 0.1 });
        const wing1 = new THREE.Mesh(solarWingGeo, solarWingMat); wing1.position.set(20.0, 2.0, 0);
        const wing2 = new THREE.Mesh(solarWingGeo, solarWingMat); wing2.position.set(-20.0, 2.0, 0);
        spaceGroup.add(wing1, wing2);

        // 3 Kinetic Induction Rings
        const ringMatOuter = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.2, emissive: 0x0284c7, emissiveIntensity: 0.6 });
        const ringMatInner = new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.9, roughness: 0.2, emissive: 0x38bdf8, emissiveIntensity: 0.9 });

        satRing1 = new THREE.Mesh(new THREE.TorusGeometry(9.0, 0.55, 12, 36), ringMatOuter);
        satRing1.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing1);

        satRing2 = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.45, 12, 36), ringMatInner);
        satRing2.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing2);

        satRing3 = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.4, 12, 36), ringMatOuter);
        satRing3.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing3);

        satBarrel = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 3.5, 6.0, 16),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 })
        );
        satBarrel.position.y = -8.5;
        spaceGroup.add(satBarrel);

        satCore = new THREE.Mesh(
            new THREE.SphereGeometry(3.2, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 })
        );
        satCore.position.y = -8.5;
        spaceGroup.add(satCore);

        satCoreGlow = new THREE.Mesh(
            new THREE.SphereGeometry(5.0, 24, 24),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0 })
        );
        satCoreGlow.position.y = -8.5;
        spaceGroup.add(satCoreGlow);
    }

    function triggerCutscene(targetPos, camera, scene, callbacks) {
        targetGroundPos.copy(targetPos);
        cutsceneCallbacks = callbacks;
        isCutsceneActive = true;
        cutsceneTime = 0;
        impactFired = false;

        satCore.material.opacity = 0.3;
        satCoreGlow.material.opacity = 0.2;
        satCore.scale.set(0.1, 0.1, 0.1);
        satCoreGlow.scale.set(0.1, 0.1, 0.1);
    }

    function update(delta, inCutscene, cutsceneTimer, camera, scene) {
        // 1. Animate Background Shooting Stars
        shootingStars.forEach(star => {
            star.timer -= delta;
            if (star.timer <= 0 && !star.active) {
                star.active = true;
                star.mesh.material.opacity = 0.95;
                star.mesh.position.set(120 + Math.random() * 80, 60 + Math.random() * 40, (Math.random() - 0.5) * 160);
            }
            if (star.active) {
                star.mesh.position.x -= star.speed * delta;
                star.mesh.position.y -= (star.speed * 0.45) * delta;
                star.mesh.position.z -= (star.speed * 0.35) * delta;
                star.mesh.material.opacity -= 0.65 * delta;
                if (star.mesh.material.opacity <= 0) {
                    star.active = false;
                    star.timer = 1.5 + Math.random() * 3.0;
                }
            }
        });

        // 2. Automated Frame-Driven Cutscene Pipeline
        if (isCutsceneActive) {
            cutsceneTime += delta;

            // Phase 1: Space Orbit & Charging (0.0s to 3.1s)
            if (cutsceneTime < 3.1) {
                satRing1.rotation.z += 6.0 * delta;
                satRing2.rotation.z -= 8.5 * delta;
                satRing3.rotation.z += 12.0 * delta;

                const progress = Math.min(1.0, cutsceneTime / 3.0);
                satCore.material.opacity = 0.4 + progress * 0.6;
                satCoreGlow.material.opacity = 0.2 + progress * 0.5;
                satCore.scale.setScalar(0.2 + progress * 1.3);
                satCoreGlow.scale.setScalar(0.2 + progress * 1.5 + Math.sin(Date.now() * 0.03) * 0.1);
                satChargeLight.intensity = progress * 6.0;

                chargingParticles.forEach(p => {
                    p.mesh.material.opacity = 0.9;
                    p.dist -= p.speed * delta;
                    if (p.dist <= 0.8) p.dist = 14 + Math.random() * 8;
                    p.angle += 3.0 * delta;
                    p.mesh.position.set(
                        Math.cos(p.angle) * p.dist,
                        -8.5 + (Math.random() - 0.5) * 2.0,
                        Math.sin(p.angle) * p.dist
                    );
                });

                // Orbit Camera
                const camOrbitRadius = 42.0;
                const camAngle = cutsceneTime * 0.65;
                camera.position.set(
                    spaceOrigin.x + Math.sin(camAngle) * camOrbitRadius,
                    spaceOrigin.y + 10.0 + Math.sin(cutsceneTime * 0.8) * 3.5,
                    spaceOrigin.z + Math.cos(camAngle) * camOrbitRadius
                );
                camera.lookAt(spaceOrigin.x, spaceOrigin.y - 3.0, spaceOrigin.z);

            } 
            // Phase 2: Ground Impact & Beam Strike (3.1s to 4.3s)
            else if (cutsceneTime < 4.3) {
                // One-time impact explosion trigger
                if (!impactFired) {
                    impactFired = true;

                    // Ground Beam
                    currentBeamMesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(1.6, 1.6, 450, 24),
                        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
                    );
                    currentBeamMesh.position.set(targetGroundPos.x, 225, targetGroundPos.z);
                    scene.add(currentBeamMesh);

                    if (cutsceneCallbacks && cutsceneCallbacks.onImpact) {
                        cutsceneCallbacks.onImpact(currentBeamMesh);
                    }
                }

                // Dynamic Ground Camera with Subtle Blast Shake
                const shakeX = (Math.random() - 0.5) * 0.4;
                const shakeY = (Math.random() - 0.5) * 0.4;
                camera.position.set(targetGroundPos.x + 18 + shakeX, 30 + shakeY, targetGroundPos.z + 26);
                camera.lookAt(targetGroundPos.x, 0, targetGroundPos.z);
            } 
            // Phase 3: Seamless Auto-Release (4.3s+) - NEVER GETS STUCK
            else {
                isCutsceneActive = false;
                impactFired = false;

                satCore.material.opacity = 0.0;
                satCoreGlow.material.opacity = 0.0;
                satChargeLight.intensity = 0;
                chargingParticles.forEach(p => p.mesh.material.opacity = 0.0);

                if (cutsceneCallbacks && cutsceneCallbacks.onComplete) {
                    cutsceneCallbacks.onComplete();
                }
            }
        } else {
            // Idle ambient rotation
            satRing1.rotation.z += 0.8 * delta;
            satRing2.rotation.z -= 1.2 * delta;
            satRing3.rotation.z += 1.6 * delta;

            satCore.material.opacity = 0.0;
            satCoreGlow.material.opacity = 0.0;
            satChargeLight.intensity = 0;
            chargingParticles.forEach(p => p.mesh.material.opacity = 0.0);
        }
    }

    return {
        init,
        update,
        triggerCutscene
    };
})();
