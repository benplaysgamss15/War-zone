/* =========================================================================
   ORBITAL CANNON & SPACE CUTSCENE MODULE (orbitalCannon.js)
   Handles the 3D Satellite Platform, Space Environment, Shooting Stars,
   and the 2-Phase Cinematic Cutscene (Space Charge -> Ground Impact -> Return).
   ========================================================================= */

const OrbitalCannonModule = (() => {
    const spaceOrigin = new THREE.Vector3(0, 800, 0);
    const spaceGroup = new THREE.Group();
    spaceGroup.position.copy(spaceOrigin);

    let satCore, satCoreGlow, satRing1, satRing2, satRing3, satBarrel;
    let satChargeLight;
    const shootingStars = [];
    const chargingParticles = [];

    // Cutscene Phase State: 'IDLE' | 'SPACE_CHARGE' | 'GROUND_IMPACT'
    let cutscenePhase = 'IDLE';

    function init(scene) {
        scene.add(spaceGroup);

        // 1. High-Intensity Space Lighting
        const spaceLight = new THREE.DirectionalLight(0xffffff, 3.0);
        spaceLight.position.set(spaceOrigin.x + 90, spaceOrigin.y + 70, spaceOrigin.z + 100);
        scene.add(spaceLight);

        const earthRimLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
        earthRimLight.position.set(spaceOrigin.x - 70, spaceOrigin.y - 30, spaceOrigin.z - 80);
        scene.add(earthRimLight);

        const spaceAmbient = new THREE.AmbientLight(0x334155, 1.8);
        spaceGroup.add(spaceAmbient);

        // Dynamic core charge point light
        satChargeLight = new THREE.PointLight(0x38bdf8, 0, 80);
        satChargeLight.position.set(0, -8.5, 0);
        spaceGroup.add(satChargeLight);

        // 2. Earth Horizon Glow
        const earthHorizonGeo = new THREE.SphereGeometry(220, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const earthHorizonMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.BackSide, transparent: true, opacity: 0.9 });
        const earthHorizon = new THREE.Mesh(earthHorizonGeo, earthHorizonMat);
        earthHorizon.position.set(0, -240, 0);
        spaceGroup.add(earthHorizon);

        // 3. Dense Starfield
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

        // 4. Smooth Shooting Stars
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

        // 5. Converging In-Flow Charging Particle Swarm
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

        // 6. Massive Heavy Superstructure Chassis
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

        // Magnetic Barrel
        satBarrel = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 3.5, 6.0, 16),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 })
        );
        satBarrel.position.y = -8.5;
        spaceGroup.add(satBarrel);

        // Massive Radiant Plasma Core Orb
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

    function update(delta, inCutscene, cutsceneTimer, camera) {
        // 1. Animate Shooting Stars
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

        // 2. Animate Satellite & Camera based on Phase
        if (cutscenePhase === 'SPACE_CHARGE') {
            satRing1.rotation.z += 6.0 * delta;
            satRing2.rotation.z -= 8.5 * delta;
            satRing3.rotation.z += 12.0 * delta;

            const progress = Math.min(1.0, cutsceneTimer / 3.2);
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

            // Space Orbit Camera
            const camOrbitRadius = 42.0;
            const camAngle = cutsceneTimer * 0.65;
            camera.position.set(
                spaceOrigin.x + Math.sin(camAngle) * camOrbitRadius,
                spaceOrigin.y + 10.0 + Math.sin(cutsceneTimer * 0.8) * 3.5,
                spaceOrigin.z + Math.cos(camAngle) * camOrbitRadius
            );
            camera.lookAt(spaceOrigin.x, spaceOrigin.y - 3.0, spaceOrigin.z);

        } else if (cutscenePhase === 'GROUND_IMPACT') {
            // Ground Impact Phase: Let ground camera view play out undisturbed!
            satCore.material.opacity = 0.0;
            satCoreGlow.material.opacity = 0.0;
            satChargeLight.intensity = 0;
            chargingParticles.forEach(p => p.mesh.material.opacity = 0.0);

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

    function triggerCutscene(targetPos, camera, scene, callbacks) {
        cutscenePhase = 'SPACE_CHARGE';
        satCore.material.opacity = 0.3;
        satCoreGlow.material.opacity = 0.2;
        satCore.scale.set(0.1, 0.1, 0.1);
        satCoreGlow.scale.set(0.1, 0.1, 0.1);

        // Phase 1: 3.4 seconds of charging in space
        setTimeout(() => {
            cutscenePhase = 'GROUND_IMPACT';

            // Cut Camera down to the city ground strike target
            camera.position.set(targetPos.x + 18, 30, targetPos.z + 26);
            camera.lookAt(targetPos.x, 0, targetPos.z);

            // Kinetic Ground Beam
            const beamMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(1.6, 1.6, 450, 24),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
            );
            beamMesh.position.set(targetPos.x, 225, targetPos.z);
            scene.add(beamMesh);

            // Trigger ground explosion & sound
            if (callbacks.onImpact) {
                callbacks.onImpact(beamMesh);
            }

            // Phase 2: After 1.4s of ground impact, conclude and return control
            setTimeout(() => {
                cutscenePhase = 'IDLE';
                if (callbacks.onComplete) {
                    callbacks.onComplete();
                }
            }, 1400);

        }, 3400);
    }

    return {
        init,
        update,
        triggerCutscene
    };
})();
