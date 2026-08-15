/* =========================================================================
   DESTRUCTIBLE BUILDINGS & INTERIORS MODULE (buildings.js)
   Features enterable buildings with doors, hollow rooms, stairs, windows, 
   corner support pillars, and dynamic structural leaning/toppling physics.
   ========================================================================= */

const BuildingsModule = (() => {
    const buildings = [];
    const interiorObstacles = [];
    let bldgTexture = null;

    function createBuildingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 128, 128);
        for (let y = 8; y < 120; y += 22) {
            for (let x = 8; x < 120; x += 18) {
                ctx.fillStyle = (Math.random() > 0.35) ? (Math.random() > 0.7 ? '#fef08a' : '#38bdf8') : '#0f172a';
                ctx.fillRect(x, y, 10, 14);
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    function init(scene, cityGridSize = 6, blockSpacing = 22, halfSize = 66) {
        bldgTexture = createBuildingTexture();

        const wallMat = new THREE.MeshStandardMaterial({ map: bldgTexture, roughness: 0.6, metalness: 0.2 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
        const stairMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });

        for (let gx = 0; gx < cityGridSize; gx++) {
            for (let gz = 0; gz < cityGridSize; gz++) {
                const posX = (gx * blockSpacing) - halfSize + blockSpacing / 2;
                const posZ = (gz * blockSpacing) - halfSize + blockSpacing / 2;

                const floorCount = 3 + Math.floor(Math.random() * 4); // 3 to 6 floors
                const floorHeight = 4.0;
                const width = 12.0;
                const depth = 12.0;

                const buildingGroup = new THREE.Group();
                buildingGroup.position.set(posX, 0.25, posZ);
                scene.add(buildingGroup);

                const buildingObj = {
                    group: buildingGroup,
                    x: posX,
                    z: posZ,
                    width: width,
                    depth: depth,
                    alive: true,
                    totalHeight: floorCount * floorHeight,
                    floorCount: floorCount,
                    // Leaning & structural physics
                    leanX: 0,
                    leanZ: 0,
                    targetLeanX: 0,
                    targetLeanZ: 0,
                    structuralIntegrity: 100,
                    collapsed: false,
                    floors: [],
                    pillars: [],
                    stairs: []
                };

                // Build each floor with enterable interior
                for (let f = 0; f < floorCount; f++) {
                    const floorY = f * floorHeight;
                    const floorData = {
                        index: f,
                        y: floorY,
                        health: 120,
                        alive: true,
                        parts: []
                    };

                    // 1. Floor Slab
                    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), floorMat);
                    slab.position.set(0, floorY + 0.15, 0);
                    slab.receiveShadow = true;
                    slab.castShadow = true;
                    buildingGroup.add(slab);
                    floorData.parts.push(slab);

                    // 2. Corner Support Pillars (Damage to pillars causes leaning!)
                    const pillarOffsets = [
                        { x: -5.4, z: -5.4, name: 'NW' },
                        { x: 5.4, z: -5.4, name: 'NE' },
                        { x: -5.4, z: 5.4, name: 'SW' },
                        { x: 5.4, z: 5.4, name: 'SE' }
                    ];

                    pillarOffsets.forEach(po => {
                        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, floorHeight, 0.8), pillarMat);
                        pil.position.set(po.x, floorY + floorHeight / 2, po.z);
                        pil.castShadow = true;
                        buildingGroup.add(pil);
                        floorData.parts.push(pil);

                        buildingObj.pillars.push({
                            mesh: pil,
                            floor: f,
                            xOffset: po.x,
                            zOffset: po.z,
                            worldX: posX + po.x,
                            worldY: floorY + floorHeight / 2,
                            worldZ: posZ + po.z,
                            alive: true,
                            health: 45
                        });
                    });

                    // 3. Walls with Doorway (Ground floor) & Windows (Upper floors)
                    if (f === 0) {
                        // Front Wall with Doorway opening
                        const wallL = new THREE.Mesh(new THREE.BoxGeometry(4.5, floorHeight, 0.4), wallMat);
                        wallL.position.set(-3.75, floorY + floorHeight / 2, 5.8);
                        const wallR = new THREE.Mesh(new THREE.BoxGeometry(4.5, floorHeight, 0.4), wallMat);
                        wallR.position.set(3.75, floorY + floorHeight / 2, 5.8);
                        const doorTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 0.4), wallMat);
                        doorTop.position.set(0, floorY + floorHeight - 0.6, 5.8);
                        buildingGroup.add(wallL, wallR, doorTop);
                        floorData.parts.push(wallL, wallR, doorTop);
                    } else {
                        // Upper Front Wall with Window
                        const wallFront = new THREE.Mesh(new THREE.BoxGeometry(width, floorHeight, 0.4), wallMat);
                        wallFront.position.set(0, floorY + floorHeight / 2, 5.8);
                        buildingGroup.add(wallFront);
                        floorData.parts.push(wallFront);
                    }

                    // Side & Back Walls
                    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(width, floorHeight, 0.4), wallMat);
                    wallBack.position.set(0, floorY + floorHeight / 2, -5.8);
                    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, floorHeight, depth), wallMat);
                    wallLeft.position.set(-5.8, floorY + floorHeight / 2, 0);
                    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, floorHeight, depth), wallMat);
                    wallRight.position.set(5.8, floorY + floorHeight / 2, 0);

                    buildingGroup.add(wallBack, wallLeft, wallRight);
                    floorData.parts.push(wallBack, wallLeft, wallRight);

                    // 4. Interior Staircase connecting to next floor
                    if (f < floorCount - 1) {
                        const stairRamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 5.5), stairMat);
                        stairRamp.position.set(3.8, floorY + floorHeight / 2, -1.5);
                        stairRamp.rotation.x = Math.PI / 6; // Angle for climbing
                        stairRamp.castShadow = true;
                        buildingGroup.add(stairRamp);
                        floorData.parts.push(stairRamp);

                        buildingObj.stairs.push({
                            floor: f,
                            bottomY: floorY,
                            topY: floorY + floorHeight,
                            worldX: posX + 3.8,
                            worldZ: posZ - 1.5
                        });
                    }

                    buildingObj.floors.push(floorData);
                }

                buildings.push(buildingObj);
            }
        }
    }

    // Apply Explosive / Gunfire Damage to Building & Calculate Leaning Physics
    function damageBuildingAt(x, y, z, radius, damage, physicsDebrisList, onCollapseCallback) {
        buildings.forEach(b => {
            if (!b.alive) return;
            const distToBuilding = Math.hypot(b.x - x, b.z - z);
            if (distToBuilding > radius + b.width / 2 + 2) return;

            let damagedPillarCount = 0;
            let destroyedPillars = { NW: false, NE: false, SW: false, SE: false };

            // Check corner pillar damage
            b.pillars.forEach(p => {
                if (!p.alive) return;
                const pDist = Math.hypot(p.worldX - x, p.worldZ - z, p.worldY - y);
                if (pDist < radius + 1.2) {
                    p.health -= damage;
                    if (p.health <= 0) {
                        p.alive = false;
                        p.mesh.visible = false;

                        // Spawn flying broken pillar chunk
                        const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), new THREE.MeshStandardMaterial({ color: 0x475569 }));
                        chunk.position.set(p.worldX, p.worldY, p.worldZ);
                        b.group.parent.add(chunk);

                        physicsDebrisList.push({
                            mesh: chunk,
                            vx: (p.worldX - x) * 2 + (Math.random() - 0.5) * 6,
                            vy: 6 + Math.random() * 8,
                            vz: (p.worldZ - z) * 2 + (Math.random() - 0.5) * 6,
                            rx: (Math.random() - 0.5) * 6,
                            ry: (Math.random() - 0.5) * 6,
                            rz: (Math.random() - 0.5) * 6,
                            life: 4.0
                        });
                    }
                }
            });

            // Calculate support distribution and resulting Lean Angle
            let nwDead = b.pillars.filter(p => !p.alive && p.xOffset < 0 && p.zOffset < 0).length;
            let neDead = b.pillars.filter(p => !p.alive && p.xOffset > 0 && p.zOffset < 0).length;
            let swDead = b.pillars.filter(p => !p.alive && p.xOffset < 0 && p.zOffset > 0).length;
            let seDead = b.pillars.filter(p => !p.alive && p.xOffset > 0 && p.zOffset > 0).length;

            // Tilt toward damaged sides
            const leanFactor = 0.08;
            b.targetLeanX = ((swDead + seDead) - (nwDead + neDead)) * leanFactor;
            b.targetLeanZ = ((nwDead + swDead) - (neDead + seDead)) * leanFactor;

            const totalDeadPillars = nwDead + neDead + swDead + seDead;
            b.structuralIntegrity = Math.max(0, 100 - (totalDeadPillars / b.pillars.length) * 100);

            // Critical failure: if tilted over 22 degrees or over 60% pillars destroyed, topple & collapse!
            if (!b.collapsed && (Math.abs(b.leanX) > 0.38 || Math.abs(b.leanZ) > 0.38 || b.structuralIntegrity < 30)) {
                b.collapsed = true;
                b.alive = false;

                if (onCollapseCallback) onCollapseCallback(b);

                // Scatter physical crumbling floors
                b.floors.forEach(fl => {
                    fl.parts.forEach(meshPart => {
                        meshPart.visible = false;
                        const rubble = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 3.5), new THREE.MeshStandardMaterial({ color: 0x334155 }));
                        rubble.position.set(b.x + (Math.random() - 0.5) * b.width, fl.y + 2, b.z + (Math.random() - 0.5) * b.depth);
                        b.group.parent.add(rubble);

                        physicsDebrisList.push({
                            mesh: rubble,
                            vx: b.leanZ * 20 + (Math.random() - 0.5) * 10,
                            vy: 4 + Math.random() * 8,
                            vz: b.leanX * 20 + (Math.random() - 0.5) * 10,
                            rx: (Math.random() - 0.5) * 4,
                            ry: (Math.random() - 0.5) * 4,
                            rz: (Math.random() - 0.5) * 4,
                            life: 5.0
                        });
                    });
                });
            }
        });
    }

    // Smooth Leaning Physics Interpolation
    function update(delta) {
        buildings.forEach(b => {
            if (!b.alive || b.collapsed) return;

            // Interpolate toward target lean tilt
            b.leanX += (b.targetLeanX - b.leanX) * 3.0 * delta;
            b.leanZ += (b.targetLeanZ - b.leanZ) * 3.0 * delta;

            b.group.rotation.x = b.leanX;
            b.group.rotation.z = b.leanZ;
        });
    }

    // Doorway & Interior Staircase Navigation for FPV Player & NPCs
    function checkPlayerInterior(playerX, playerZ, currentY) {
        let insideBuilding = null;
        let groundHeight = 0;

        for (let b of buildings) {
            if (!b.alive || b.collapsed) continue;
            const halfW = b.width / 2;
            const halfD = b.depth / 2;

            if (Math.abs(playerX - b.x) < halfW - 0.4 && Math.abs(playerZ - b.z) < halfD - 0.4) {
                insideBuilding = b;

                // Check interior stairs climbing
                b.stairs.forEach(st => {
                    const distToStair = Math.hypot(playerX - st.worldX, playerZ - st.worldZ);
                    if (distToStair < 2.2) {
                        const progress = Math.max(0, Math.min(1, (playerZ - (st.worldZ - 2.5)) / 5.0));
                        groundHeight = Math.max(groundHeight, st.bottomY + progress * (st.topY - st.bottomY));
                    }
                });

                // Floor level elevation
                const floorIndex = Math.floor(currentY / 4.0);
                if (floorIndex > 0) {
                    groundHeight = Math.max(groundHeight, floorIndex * 4.0);
                }
                break;
            }
        }

        return { insideBuilding, groundHeight };
    }

    function getBuildingList() {
        return buildings;
    }

    function getActiveCount() {
        return buildings.filter(b => b.alive).length;
    }

    return {
        init,
        update,
        damageBuildingAt,
        checkPlayerInterior,
        getBuildingList,
        getActiveCount
    };
})();
