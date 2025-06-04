// js/main.js
console.log("CSS Minecraft 3D Project Initialized!");

document.addEventListener('DOMContentLoaded', () => {
    const world = document.querySelector('.world');


    // 예시: 간단한 마우스 드래그로 월드 회전 (옵션)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let currentRotation = { x: 60, y: 0, z: 45 }; // 초기 CSS와 동일하게 설정

    // 현재 transform 값을 파싱하여 초기 회전 값을 가져오는 더 견고한 방법이 필요할 수 있습니다.
    // 여기서는 CSS에 정의된 초기 값을 사용합니다.

    document.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Y축 회전 (마우스 좌우) / X축 회전 (마우스 상하)
        currentRotation.y += deltaX * 0.5; // 회전 감도 조절
        currentRotation.x -= deltaY * 0.5; // Y축 움직임에 따라 X축 회전 (반대로 하려면 +)

        // X축 회전 범위 제한 (예: -90도 ~ 90도)
        currentRotation.x = Math.max(-89, Math.min(89, currentRotation.x));


        world.style.transform = `rotateX(${currentRotation.x}deg) rotateY(${currentRotation.y}deg) rotateZ(${currentRotation.z}deg) translateX(0px) translateY(-150px) translateZ(-200px)`; // 기존 transform 값 유지

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener('mouseleave', () => { // 창 밖으로 나가도 드래그 중지
        isDragging = false;
    });


    // (추후) 여기에 블록 생성 및 관리, 사용자 입력 처리 등의 로직을 추가합니다.
    // 예: createBlock(x, y, z, type);
});
// --- Global Variables and Constants ---
let scene, camera, renderer, controls;
const sceneContainer = document.getElementById('scene-container');

// Block type definitions (colors, names, etc.)
const blockTypes = {
    grass: { color: 0x559955, name: 'Grass' },
    dirt: { color: 0x8B4513, name: 'Dirt' },
    stone: { color: 0x808080, name: 'Stone' }
    // Add more types if needed, e.g., wood: { color: 0x966F33, name: 'Wood' }
};

// Keyboard state for movement
const keysPressed = {
    w: false, a: false, s: false, d: false,
    shift: false, // For moving down
    space: false  // For moving up
};
const cameraMoveSpeed = 0.2; // Adjust for desired speed

let selectedTool = null;
let worldBlocks = [];
let raycaster;
let mouse = new THREE.Vector2();

// REMOVE or COMMENT OUT: const highlightMaterial = new THREE.MeshBasicMaterial(...);
const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 }); // 검은색 외곽선, linewidth는 일부 환경에서 1보다 크게 적용 안 될 수 있음
// 또는 노란색 외곽선: const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });

let highlightedBlockInfo = null; // 변경: { mesh: THREE.Mesh, outlineMesh: THREE.LineSegments }
// --- Initialization Function ---
function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    // 2. Camera
    const aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(5, 8, 15); // Adjusted initial camera position

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    sceneContainer.appendChild(renderer.domElement);

    
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);

    // 4. Controls (OrbitControls)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // controls.target.set(5, 0, 5); // Will be updated by createWorldFromData

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Brighter ambient
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(15, 20, 10); // Adjusted light position
    directionalLight.castShadow = true;
    // Configure shadow properties for better quality
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    // Helper to visualize the directional light's shadow camera
    //const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
    //scene.add(shadowHelper);

    // 6. Initialize Raycaster for mouse interaction
    raycaster = new THREE.Raycaster();

    // 7. Create the initial world blocks
    createWorldFromData(); // This will populate worldBlocks and set controls.target

    // 8. Setup UI Event Listeners
    setupToolbar();
    // 브라우저 기본 컨텍스트 메뉴 방지
    renderer.domElement.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    }, false);



    // 9. Setup Keyboard and Window Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

// --- Toolbar Setup Function ---
function setupToolbar() {
    const icons = document.querySelectorAll('.tool-icon');
    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            const toolType = icon.dataset.tool;
            const blockType = icon.dataset.blocktype; // Will be undefined for pickaxe

            if (icon.classList.contains('selected')) {
                // Clicked already selected icon: deselect
                icon.classList.remove('selected');
                selectedTool = null;
                unhighlightBlock(); // Clear highlight when deselecting tool
            } else {
                // Deselect any other selected icon
                icons.forEach(i => i.classList.remove('selected'));
                // Select this one
                icon.classList.add('selected');
                if (toolType === 'pickaxe') {
                    selectedTool = { type: 'pickaxe' };
                } else if (toolType === 'place' && blockTypes[blockType]) {
                    selectedTool = { type: 'place', blockType: blockType };
                }
                // console.log("Selected tool:", selectedTool);
            }
        });
    });
}

// --- World Creation and Block Management ---
function createWorldFromData() {
    // Clear existing blocks from scene and array (if any, for potential regeneration)
    worldBlocks.forEach(blockData => {
        if (blockData.mesh) {
            scene.remove(blockData.mesh);
            if (blockData.mesh.geometry) blockData.mesh.geometry.dispose();
            if (blockData.mesh.material) blockData.mesh.material.dispose();
        }
    });
    worldBlocks = [];
    unhighlightBlock(); // Clear any highlight

    const tempData = { blocks: [] }; // Simulating loaded data
    const worldSize = 10; // Width and depth of the world
    const groundLevel = 0; // Y-level for the top grass layer

    for (let x = 0; x < worldSize; x++) {
        for (let z = 0; z < worldSize; z++) {
            // Surface is grass
            tempData.blocks.push({ x: x, y: groundLevel, z: z, type: 'grass' });
            // One layer of dirt below grass
            tempData.blocks.push({ x: x, y: groundLevel - 1, z: z, type: 'dirt' });
             // One layer of stone below dirt
            tempData.blocks.push({ x: x, y: groundLevel - 2, z: z, type: 'stone' });
        }
    }

    tempData.blocks.forEach(blockData => {
        addBlockToWorld(blockData.x, blockData.y, blockData.z, blockData.type);
    });

    // Update controls target to the center of the generated world
    if (controls) {
        controls.target.set(worldSize / 2 - 0.5, 0, worldSize / 2 - 0.5);
        camera.lookAt(controls.target);
        controls.update(); // Important after changing target
    }
}

function addBlockToWorld(x, y, z, type) {
    const blockInfo = blockTypes[type] || blockTypes.stone; // Default to stone if type is unknown
    // For performance, you'd share geometries and materials for same-type blocks
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: blockInfo.color });

    const blockMesh = new THREE.Mesh(geometry, material);
    blockMesh.position.set(x + 0.5, y + 0.5, z + 0.5); // Center the block on the grid coordinate
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;

    // Store block data on the mesh for easy identification during raycasting
    const blockId = `${x}_${y}_${z}`;
    blockMesh.userData = { x, y, z, type, id: blockId };

    scene.add(blockMesh);

    const blockData = { x, y, z, type, mesh: blockMesh, id: blockId };
    worldBlocks.push(blockData);
    return blockData;
}

function removeBlockFromWorld(targetBlockData) {
    if (!targetBlockData || !targetBlockData.mesh) return;

    scene.remove(targetBlockData.mesh);

    // Dispose of geometry and material to free up memory
    if (targetBlockData.mesh.geometry) targetBlockData.mesh.geometry.dispose();
    if (targetBlockData.mesh.material) targetBlockData.mesh.material.dispose();

    worldBlocks = worldBlocks.filter(block => block.id !== targetBlockData.id);

    if (highlightedBlock && highlightedBlock.mesh === targetBlockData.mesh) {
        unhighlightBlock(); // Ensure the highlight is removed
    }
    // console.log("Removed block:", targetBlockData.id);
}

// 마우스 움직일 때마다 실행하는 함수
function onMouseMove(event) {
    if (!selectedTool || (selectedTool.type !== 'pickaxe' && selectedTool.type !== 'place')) {
        unhighlightBlock();
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const blockMeshes = worldBlocks.map(b => b.mesh).filter(mesh => mesh);
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;

        // 이미 이 블록이 하이라이트되어 있고 외곽선이 있다면 변경 없음
        if (highlightedBlockInfo && highlightedBlockInfo.mesh === intersectedMesh) {
            return;
        }

        unhighlightBlock(); // 이전 하이라이트(외곽선) 제거

        // 새 외곽선 생성
        const edges = new THREE.EdgesGeometry(intersectedMesh.geometry);
        const outline = new THREE.LineSegments(edges, outlineMaterial);

        // 외곽선의 위치와 회전을 원본 메쉬와 동일하게 설정
        outline.position.copy(intersectedMesh.position);
        outline.rotation.copy(intersectedMesh.rotation);
        outline.scale.copy(intersectedMesh.scale); // 스케일도 복사 (필요한 경우)

        scene.add(outline); // 씬에 외곽선 추가

        highlightedBlockInfo = {
            mesh: intersectedMesh,
            outlineMesh: outline // 생성된 외곽선 메쉬 저장
        };

    } else {
        unhighlightBlock();
    }
}


// 하일라이트 제거하는 함수

function unhighlightBlock() {
    if (highlightedBlockInfo && highlightedBlockInfo.outlineMesh) {
        scene.remove(highlightedBlockInfo.outlineMesh); // 씬에서 외곽선 제거
        highlightedBlockInfo.outlineMesh.geometry.dispose(); // 지오메트리 해제
        // 참고: outlineMaterial은 공유되므로 여기서 dispose하지 않습니다.
        // 만약 LineSegments마다 고유한 material을 생성했다면 여기서 material도 dispose합니다.
        highlightedBlockInfo = null;
    }
}

// 마우스 클릭할때 쓰는 함수
function onMouseDown(event) {
    console.log("ANG!");
    // Prevent interaction if mouse is not over the canvas (e.g., over UI)
    if (event.target !== renderer.domElement) return;

    const rect = renderer.domElement.getBoundingClientRect(); // 정확한 좌표 계산을 위해 추가
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;


    raycaster.setFromCamera(mouse, camera);

    const blockMeshes = worldBlocks.map(b => b.mesh).filter(mesh => mesh); // 활성화된 메쉬만 가져옴
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectionData = intersects[0]; // 첫 번째로 교차된 객체의 정보
        const clickedMesh = intersectionData.object; // 클릭된 메쉬
        const clickedBlockDataFromWorld = worldBlocks.find(b => b.mesh === clickedMesh); // worldBlocks에서 해당 블록 정보 찾기

        if (!clickedBlockDataFromWorld) {
            console.warn("Clicked mesh not found in worldBlocks array.");
            return;
        }

        // --- 사용자 요청: 블록 정보 및 클릭된 면 정보 로깅 ---
        const blockCoords = clickedBlockDataFromWorld.userData; // { x, y, z, type, id }
        const faceNormal = intersectionData.face.normal.clone(); // 클릭된 면의 법선 벡터 (월드 좌표계 기준)

        console.log("--- Block Interaction Info ---");
        console.log("Clicked Block Coords (from userData):", { x: blockCoords.x, y: blockCoords.y, z: blockCoords.z });
        console.log("Clicked Block Type:", blockCoords.type);
        console.log("Intersected Face Normal:", { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z });
        // 법선 벡터는 일반적으로 (1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1) 중 하나가 됩니다.
        // 예를 들어, (0,1,0)은 블록의 윗면을 클릭했음을 의미합니다.
        console.log("-----------------------------");
        // --- 로깅 끝 ---


        // 이제 실제 도구 선택에 따른 로직 수행
        if (!selectedTool) {
            console.log("No tool selected, but block info logged.");
            return;
        }

        if (selectedTool.type === 'pickaxe') {
            removeBlockFromWorld(clickedBlockDataFromWorld);
        } else if (selectedTool.type === 'place' && selectedTool.blockType) {
            // Determine placement position based on the clicked face normal
            // faceNormal은 이미 위에서 계산되었습니다.
            const newBlockX = clickedBlockDataFromWorld.x + faceNormal.x;
            const newBlockY = clickedBlockDataFromWorld.y + faceNormal.y;
            const newBlockZ = clickedBlockDataFromWorld.z + faceNormal.z;

            // Check if a block already exists at the new position
            const existingBlockAtPlacement = worldBlocks.find(b => b.x === newBlockX && b.y === newBlockY && b.z === newBlockZ);
            if (!existingBlockAtPlacement) {
                // Check if placing block would intersect with camera (player)
                const playerPos = camera.position;
                // Simple check: is the new block's center too close to the player's feet/center?
                // This is a very basic check and might need refinement.
                const newBlockCenterY = newBlockY + 0.5;
                if (Math.abs(playerPos.x - (newBlockX + 0.5)) < 0.9 &&
                    Math.abs(playerPos.z - (newBlockZ + 0.5)) < 0.9 &&
                    (playerPos.y >= newBlockCenterY - 1 && playerPos.y <= newBlockCenterY + 1) // Check Y overlap, considering player height
                ) {
                    console.log("Cannot place block: Too close to player.");
                } else {
                    addBlockToWorld(newBlockX, newBlockY, newBlockZ, selectedTool.blockType);
                }
            } else {
                console.log("Cannot place block: Position occupied.");
            }
        }
    } else {
        // 만약 raycast가 아무것도 맞추지 못했다면 (허공 클릭)
        if (selectedTool) {
            console.log("Clicked on empty space. No action taken with tool:", selectedTool);
        }
    }
}


// --- Event Handlers for Window and Keyboard ---
function onWindowResize() {
    if (camera && renderer && sceneContainer) {
        camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    }
}

function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keysPressed.w = true; break;
        case 'a': keysPressed.a = true; break;
        case 's': keysPressed.s = true; break;
        case 'd': keysPressed.d = true; break;
        case ' ': event.preventDefault(); keysPressed.space = true; break; // Space for Up
        case 'shift': event.preventDefault(); keysPressed.shift = true; break; // Shift for Down
    }
}

function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keysPressed.w = false; break;
        case 'a': keysPressed.a = false; break;
        case 's': keysPressed.s = false; break;
        case 'd': keysPressed.d = false; break;
        case ' ': keysPressed.space = false; break;
        case 'shift': keysPressed.shift = false; break;
    }
}

// --- Camera Movement Function ---
function updateCameraMovement() {
    if (!camera || !controls) return;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal for forward/backward
    forward.normalize();

    // Calculate right vector relative to the camera's current orientation (respecting its 'up' vector)
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
    // If camera can tilt, camera.up might not be (0,1,0). For FPS, often camera.up is fixed.
    // If using OrbitControls, it handles camera.up. For pure FPS, you might manage pitch/yaw manually.

    const moveDirection = new THREE.Vector3();
    let moved = false;

    if (keysPressed.w) { moveDirection.add(forward); moved = true; }
    if (keysPressed.s) { moveDirection.sub(forward); moved = true; } // moveDirection is forward - forward = 0. Should be addScaledVector(forward, -1) or sub.
    if (keysPressed.a) { moveDirection.add(right); moved = true; }
    if (keysPressed.d) { moveDirection.sub(right); moved = true; }

    if (moved) { // Only update if there was horizontal movement input
        moveDirection.normalize().multiplyScalar(cameraMoveSpeed);
        camera.position.add(moveDirection);
        controls.target.add(moveDirection); // Move OrbitControls target with the camera
    }
    
    // Vertical movement (independent of view direction)
    let verticalMove = 0;
    if (keysPressed.space) { verticalMove += cameraMoveSpeed; moved = true; }
    if (keysPressed.shift) { verticalMove -= cameraMoveSpeed; moved = true; }

    if (verticalMove !== 0) {
        camera.position.y += verticalMove;
        controls.target.y += verticalMove;
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    updateCameraMovement(); // Handle WASD and space/shift movement

    if (controls) {
        controls.update(); // Update OrbitControls (handles damping, etc.)
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera); // Render the scene
    }
}

// --- Start the Application ---
try {
    init();
    animate();
} catch (error) {
    console.error("An error occurred during initialization or animation:", error);
    const errorDiv = document.createElement('div');
    errorDiv.textContent = '오류가 발생했습니다. 콘솔을 확인해주세요. (An error occurred. Please check the console.)';
    errorDiv.style.cssText = `
        color: red; position: absolute; top: 10px; left: 10px;
        padding: 10px; background-color: white; border: 1px solid red;
        z-index: 10000; font-family: sans-serif;`;
    if (sceneContainer) {
        sceneContainer.appendChild(errorDiv);
    } else {
        document.body.appendChild(errorDiv);
    }
}