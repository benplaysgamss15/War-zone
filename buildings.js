/* =========================================================================
   DESTRUCTIBLE MODULAR BUILDINGS & INTERIORS (buildings.js)
   Features 100% destructible pieces (walls, pillars, floors, stairs),
   dynamic structural leaning/toppling physics, and smooth stair climbing.
   ========================================================================= */

const BuildingsModule = (() => {
    const buildings = [];
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
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
        const stairMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });

        for (let gx = 0; gx < cityGridSize; gx++) {
            for (let gz = 0; gz < cityGridSize; gz++) {
                const posX = (gx * blockSpacing) - halfSize + blockSpacing / 2;
                const posZ = (gz * blockSpacing) - halfSize + blockSpacing / 2;

                const floorCount = 3 + Math.floor(Math.random() * 4); // 3 to 6 floors
                const floorHeight = 4.2;
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
                    // Dynamic leaning torque
                    leanX: 0,
                    leanZ: 0,
                    targetLeanX: 0,
                    targetLeanZ: 0,
                    angularVelocityX: 0,
                    angularVelocityZ: 0,
                    collapsed: false,
                    pieces: [],  // Every piece is fully destructible
                    stairs: []
                };

                // Build each floor piece-by-piece
                for (let f = 0; f < floorCount; f++) {
                    const floorY = f * floorHeight;

                    // Helper to register destructible piece
                    const addPiece = (mesh, health, isPillar = false, pillarCorner = '') => {
                        buildingGroup.add(mesh);
                        buildingObj.pieces.push({
                            mesh: mesh,
                            floor: f,
                            health: health,
                            maxHealth: health,
                            alive: true,
                            isPillar: isPillar,
                            pillarCorner: pillarCorner, // 'NW','NE','SW','SE'
                            localPos: mesh.position.clone()
                        });
                    };

                    // 1. Floor Slab
                    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.35, depth), floorMat);
                    slab.position.set(0, floorY + 0.175, 0);
                    slab.receiveShadow = true;
                    slab.castShadow = true;
                    addPiece(slab, 90);

                    // 2. Corner Pillars (Structural supports)
                    const pillarPositions = [
                        { x: -5.4, z: -5.4, corner: 'NW' },
                        { x: 5.4, z: -5.4, corner: 'NE' },
                        { x: -5.4, z: 5.4, corner: 'SW' },
                        { x: 5.4, z: 5.4, corner: 'SE' }
                    ];

                    pillarPositions.forEach(p => {
                        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, floorHeight, 0.9), pillarMat);
                        pil.position.set(p.x, floorY + floorHeight / 2, p.z);
                        pil.castShadow = true;
                        addPiece(pil, 60, true, p.corner);
                    });

                    // 3. Walls with Doorway (Ground Floor) & Windows (Upper Floors)
                    if (f === 0) {
                        // Front Wall Left
                        const wFL = new THREE.Mesh(new THREE.BoxGeometry(4.2, floorHeight, 0.45), wallMat);
                        wFL.position.set(-3.9, floorY + floorHeight / 2, 5.78);
                        addPiece(wFL, 50);

                        // Front Wall Right
                        const wFR = new THREE.Mesh(new THREE.BoxGeometry(4.2, floorHeight, 0.45), wallMat);
                        wFR.position.set(3.9, floorY + floorHeight / 2, 5.78);
                        addPiece(wFR, 50);

                        // Door Header
                        const doorTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.45), wallMat);
                        doorTop.position.set(0, floorY + floorHeight - 0.6, 5.78);
                        addPiece(doorTop, 40);
                    } else {
                        // Upper Front Wall with Window Cutout
                        const wF1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, floorHeight, 0.45), wallMat);
                        wF1.position.set(-3.75, floorY + floorHeight / 2, 5.78);
                        const wF2 = new THREE.Mesh(new THREE.BoxGeometry(4.5, floorHeight, 0.45), wallMat);
                        wF2.position.set(3.75, floorY + floorHeight / 2, 5.78);
                        const wF3 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 0.45), wallMat);
                        wF3.position.set(0, floorY + floorHeight - 0.7, 5.78);
                        addPiece(wF1, 45);
                        addPiece(wF2, 45);
                        addPiece(wF3, 35);
                    }

                    // Back Wall
                    const wBack = new THREE.Mesh(new THREE.BoxGeometry(width - 1.2, floorHeight, 0.45), wallMat);
                    wBack.position.set(0, floorY + floorHeight / 2, -5.78);
                    addPiece(wBack, 55);

                    // Left Wall
                    const wLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, floorHeight, depth - 1.2), wallMat);
                    wLeft.position.set(-5.78, floorY + floorHeight / 2, 0);
                    addPiece(wLeft, 55);

                    // Right Wall
                    const wRight = new THREE.Mesh(new THREE.BoxGeometry(0.45, floorHeight, depth - 1.2), wallMat);
                    wRight.position.set(5.78, floorY + floorHeight / 2, 0);
                    addPiece(wRight, 55);

                    // 4. Smooth Walk-Up Staircase connecting floors
                    if (f < floorCount - 1) {
                        const stairGroup = new THREE.Group();
                        const stepCount = 10;
                        const stepHeight = floorHeight / stepCount;
                        const stepDepth = 0.55;
                        const stairWidth = 2.8;

                        for (let s = 0; s < stepCount; s++) {
                            const stepMesh = new THREE.Mesh(
                                new THREE.BoxGeometry(stairWidth, stepHeight, stepDepth),
                                stairMat
                            );
                            stepMesh.position.set(0, (s * stepHeight) + stepHeight / 2, (s * stepDepth));
                            stepMesh.receiveShadow = true;
                            stepMesh.castShadow = true;
                            stairGroup.add(stepMesh);
                        }

                        stairGroup.position.set(3.2, floorY, -3.2);
                        buildingGroup.add(stairGroup);

                        buildingObj.stairs.push({
                            floor: f,
                            bottomY: floorY,
                            topY: floorY + floorHeight,
                            minX: posX + 3.2 - (stairWidth / 2) - 0.4,
                            maxX: posX + 3.2 + (stairWidth / 2) + 0.4,
                            minZ: posZ - 3.2 - 0.4,
                            maxZ: posZ - 3.2 + (stepCount * stepDepth) + 0.4,
                            totalZLength: stepCount * stepDepth,
                            stairGroup: stairGroup
                        });
                    }
                }

                buildings.push(buildingObj);
            }
        }
    }

    // Granular Full-Destruction Pipeline with Physical Debris & Lean Calculation
    function damageBuildingAt(x, y, z, radius, damage, physicsDebrisList, onCollapseCallback) {
        buildings.forEach(b => {
            if (!b.alive) return;
            const distToBldg = Math.hypot(b.x - x, b.z - z);
            if (distToBldg > radius + b.width / 2 + 2) return;

            let structuralDamaged = false;

            // Test damage against every individual piece
            b.pieces.forEach(p => {
                if (!p.alive) return;

                // World position of the individual component
                const worldPos = new THREE.Vector3();
                p.mesh.getWorldPosition(worldPos);

                const dist = worldPos.distanceTo(new THREE.Vector3(x, y, z));
                if (dist < radius + 1.2) {
                    p.health -= damage;

                    if (p.health <= 0) {
                        p.alive = false;
                        p.mesh.visible = false;
                        structuralDamaged = true;

                        // Spawn physical flying broken chunk
                        const boxSize = new THREE.Vector3();
                        new THREE.Box3().setFromObject(p.mesh).getSize(boxSize);

                        const chunk = new THREE.Mesh(
                            new THREE.BoxGeometry(Math.max(0.6, boxSize.x * 0.8), Math.max(0.6, boxSize.y * 0.8), Math.max(0.6, boxSize.z * 0.8)),
                            p.mesh.material
                        );
                        chunk.position.copy(worldPos);
                        b.group.parent.add(chunk);

                        const blastDir = new THREE.Vector3().subVectors(worldPos, new THREE.Vector3(x, y, z)).normalize();
                        const blastForce = (1.0 - (dist / (radius + 2))) * 22;

                        physicsDebrisList.push({
                            mesh: chunk,
                            vx: blastDir.x * blastForce + (Math.random() - 0.5) * 6,
                            vy: Math.max(4, blastDir.y * blastForce + 8 + Math.random() * 8),
                            vz: blastDir.z * blastForce + (Math.random() - 0.5) * 6,
                            rx: (Math.random() - 0.5) * 6,
                            ry: (Math.random() - 0.5) * 6,
                            rz: (Math.random() - 0.5) * 6,
                            life: 4.5
                        });
                    }
                }
            });

            // Calculate support balance across the 4 corners
            if (structuralDamaged) {
                const pillars = b.pieces.filter(p => p.isPillar);
                const nwDead = pillars.filter(p => !p.alive && p.pillarCorner === 'NW').length;
                const neDead = pillars.filter(p => !p.alive && p.pillarCorner === 'NE').length;
                const swDead = pillars.filter(p => !p.alive && p.pillarCorner === 'SW').length;
                const seDead = pillars.filter(p => !p.alive && p.pillarCorner === 'SE').length;

                // Dynamic Lean Angles based on missing supports
                const leanScale = 0.09;
                b.targetLeanX = ((swDead + seDead) - (nwDead + neDead)) * leanScale;
                b.targetLeanZ = ((nwDead + swDead) - (neDead + seDead)) * leanScale;

                const alivePillars = pillars.filter(p => p.alive).length;
                const pillarRatio = alivePillars / Math.max(1, pillars.length);

                // If tilted over 22 degrees or over 65% of structural pillars are gone, trigger catastrophic topple & collapse!
                if (!b.collapsed && (Math.abs(b.leanX) > 0.38 || Math.abs(b.leanZ) > 0.38 || pillarRatio < 0.35)) {
                    b.collapsed = true;
                    b.alive = false;

                    if (onCollapseCallback) onCollapseCallback(b);

                    // Scatter all remaining pieces into tumbling physics rubble
                    b.pieces.forEach(p => {
                        if (p.alive) {
                            p.alive = false;
                            p.mesh.visible = false;

                            const worldPos = new THREE.Vector3();
                            p.mesh.getWorldPosition(worldPos);

                            const rubble = new THREE.Mesh(
                                new THREE.BoxGeometry(2.5, 1.2, 2.5),
                                p.mesh.material
                            );
                            rubble.position.copy(worldPos);
                            b.group.parent.add(rubble);

                            physicsDebrisList.push({
                                mesh: rubble,
                                vx: b.leanZ * 22 + (Math.random() - 0.5) * 10,
                                vy: 4 + Math.random() * 8,
                                vz: b.leanX * 22 + (Math.random() - 0.5) * 10,
                                rx: (Math.random() - 0.5) * 5,
                                ry: (Math.random() - 0.5) * 5,
                                rz: (Math.random() - 0.5) * 5,
                                life: 5.0
                            });
                        }
                    });
                }
            }
        });
    }

    // Leaning Physics Simulation
    function update(delta) {
        buildings.forEach(b => {
            if (!b.alive || b.collapsed) return;

            // Spring-damper leaning torque
            const forceX = (b.targetLeanX - b.leanX) * 15.0;
            const forceZ = (b.targetLeanZ - b.leanZ) * 15.0;

            b.angularVelocityX = (b.angularVelocityX + forceX * delta) * 0.88;
            b.angularVelocityZ = (b.angularVelocityZ + forceZ * delta) * 0.88;

            b.leanX += b.angularVelocityX * delta;
            b.leanZ += b.angularVelocityZ * delta;

            b.group.rotation.x = b.leanX;
            b.group.rotation.z = b.leanZ;
        });
    }

    // Smooth & Responsive Interior Stair Climbing and Floor Elevation
    function checkPlayerInterior(playerX, playerZ, currentY) {
        let insideBuilding = null;
        let groundHeight = 0;

        for (let b of buildings) {
            if (!b.alive || b.collapsed) continue;
            const halfW = b.width / 2;
            const halfD = b.depth / 2;

            if (Math.abs(playerX - b.x) < halfW - 0.3 && Math.abs(playerZ - b.z) < halfD - 0.3) {
                insideBuilding = b;

                // Check Stair Climbing
                for (let st of b.stairs) {
                    if (playerX >= st.minX && playerX <= st.maxX && playerZ >= st.minZ && playerZ <= st.maxZ) {
                        const progress = Math.max(0, Math.min(1, (playerZ - st.minZ) / st.totalZLength));
                        const stairElevation = st.bottomY + progress * (st.topY - st.bottomY);
                        groundHeight = Math.max(groundHeight, stairElevation);
                    }
                }

                // If not on stairs, snap to current floor slab level
                if (groundHeight === 0) {
                    const floorIdx = Math.floor((currentY + 0.5) / 4.2);
                    if (floorIdx > 0 && floorIdx < b.floorCount) {
                        groundHeight = floorIdx * 4.2;
                    }
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
