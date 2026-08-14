/* =========================================================================
   ORBITAL CANNON & SPACE CUTSCENE MODULE (orbitalCannon.js)
   Handles the 3D Satellite Platform, Space Environment, Shooting Stars,
   and the Cinematic Charge-Up & Firing Sequence.
   ========================================================================= */

const OrbitalCannonModule = (() => {
    const spaceOrigin = new THREE.Vector3(0, 800, 0);
    const spaceGroup = new THREE.Group();
    spaceGroup.position.copy(spaceOrigin);

    let satCore, satRing1, satRing2, satRing3, satBarrel;
    const shootingStars = [];

    function init(scene) {
        scene.add(spaceGroup);

        // 1. Enhanced Bright Space Lighting
        const spaceLight = new THREE.DirectionalLight(0xffffff, 2.8);
        spaceLight.position.set(spaceOrigin.x + 90, spaceOrigin.y + 70, spaceOrigin.z + 100);
        scene.add(spaceLight);

        const earthRimLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
        earthRimLight.position.set(spaceOrigin.x - 70, spaceOrigin.y - 30, spaceOrigin.z - 80);
        scene.add(earthRimLight);

        const spaceAmbient = new THREE.AmbientLight(0x1e293b, 1.2);
        spaceGroup.add(spaceAmbient);

        // 2. Earth Curve Atmosphere Horizon
        const earthHorizonGeo = new THREE.SphereGeometry(200, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const earthHorizonMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.BackSide, transparent: true, opacity: 0.85 });
        const earthHorizon = new THREE.Mesh(earthHorizonGeo, earthHorizonMat);
        earthHorizon.position.set(0, -230, 0);
        spaceGroup.add(earthHorizon);

        // 3. Dense Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = 600;
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            starPos[i] = (Math.random() - 0.5) * 400;
            starPos[i + 1] = (Math.random() - 0.5) * 400;
            starPos[i + 2] = (Math.random() - 0.5) * 400;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6 }));
        spaceGroup.add(stars);

        // 4. Shooting Stars System
        for (let i = 0; i < 4; i++) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(-14, -7, -10)
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.0 });
            const streak = new THREE.Line(lineGeo, lineMat);
            streak.position.set((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200);
            spaceGroup.add(streak);

            shootingStars.push({
                mesh: streak,
                speed: 120 + Math.random() * 80,
                active: false,
                timer: Math.random() * 3
            });
        }

        // 5. Massive Heavy Superstructure Chassis
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
        const ringMatOuter = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.2, emissive: 0x0284c7, emissiveIntensity: 0.5 });
        const ringMatInner = new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.9, roughness: 0.2, emissive: 0x38bdf8, emissiveIntensity: 0.7 });

        satRing1 = new THREE.Mesh(new THREE.TorusGeometry(9.0, 0.5, 12, 36), ringMatOuter);
        satRing1.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing1);

        satRing2 = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.4, 12, 36), ringMatInner);
        satRing2.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing2);

        satRing3 = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.35, 12, 36), ringMatOuter);
        satRing3.rotation.x = Math.PI / 2;
        spaceGroup.add(satRing3);

        // Magnetic Emitter Barrel (scaled realistically)
        satBarrel = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 3.5, 6.0, 16),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 })
        );
        satBarrel.position.y = -8.5;
        spaceGroup.add(satBarrel);

        // Plasma Core Charge Orb (proportionally sized)
        satCore = new THREE.Mesh(
            new THREE.SphereGeometry(1.6, 24, 24),
            new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.0 })
        );
        satCore.position.y = -8.5;
        spaceGroup.add(satCore);
    }

    function update(delta, inCutscene, cutsceneTimer, camera) {
        // 1. Animate Shooting Stars
        shootingStars.forEach(star => {
            star.timer -= delta;
            if (star.timer <= 0) {
                star.active = true;
                star.mesh.material.opacity = 0.9;
                star.mesh.position.set(60 + Math.random() * 80, 40 + Math.random() * 40, (Math.random() - 0.5) * 160);
                star.timer = 2.5 + Math.random() * 3.5;
            }
            if (star.active) {
                star.mesh.position.x -= star.speed * delta;
                star.mesh.position.y -= (star.speed * 0.5) * delta;
                star.mesh.position.z -= (star.speed * 0.6) * delta;
                star.mesh.material.opacity -= 0.8 * delta;
                if (star.mesh.material.opacity <= 0) star.active = false;
            }
        });

        // 2. Animate Satellite & Camera Orbit
        if (inCutscene) {
            satRing1.rotation.z += 4.5 * delta;
            satRing2.rotation.z -= 6.0 * delta;
            satRing3.rotation.z += 8.5 * delta;

            // Slower, controlled plasma growth
            if (satCore.scale.x < 1.4) {
                satCore.scale.addScalar(0.4 * delta);
            }

            // Smooth orbiting camera pan in space
            const camOrbitRadius = 40.0;
            const camAngle = cutsceneTimer * 0.65;
            camera.position.set(
                spaceOrigin.x + Math.sin(camAngle) * camOrbitRadius,
                spaceOrigin.y + 10.0 + Math.sin(cutsceneTimer * 0.8) * 3.0,
                spaceOrigin.z + Math.cos(camAngle) * camOrbitRadius
            );
            camera.lookAt(spaceOrigin.x, spaceOrigin.y - 2.0, spaceOrigin.z);
        } else {
            // Idle ambient rotation
            satRing1.rotation.z += 0.8 * delta;
            satRing2.rotation.z -= 1.2 * delta;
            satRing3.rotation.z += 1.6 * delta;
        }
    }

    function triggerCutscene(targetPos, camera, scene, callbacks) {
        satCore.material.opacity = 1.0;
        satCore.scale.set(0.1, 0.1, 0.1);

        // Timeline: 3.4 seconds of space charging before ground impact
        setTimeout(() => {
            // 1. Cut Camera to Ground Target View
            camera.position.set(targetPos.x + 18, 30, targetPos.z + 26);
            camera.lookAt(targetPos.x, 0, targetPos.z);

            // 2. Realistic Proportional Kinetic Beam (Radius = 1.5)
            const beamMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.5, 450, 24),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
            );
            beamMesh.position.set(targetPos.x, 225, targetPos.z);
            scene.add(beamMesh);

            // 3. Trigger Perfectly Synchronized Impact Sound & Ground Blast
            if (callbacks.onImpact) {
                callbacks.onImpact(beamMesh);
            }

            // 4. Conclude Cutscene & Restore View
            setTimeout(() => {
                satCore.material.opacity = 0.0;
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
