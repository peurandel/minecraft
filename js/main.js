// js/main.js
console.log("Minecraft 3D Project Initialized! (Refactored)");

// --- Three.js Modules (Ensure these are accessible, e.g., via CDN imports in HTML) ---
// Assuming THREE is available globally from a CDN script in your HTML
// import * as THREE from 'three'; // If using modules and a bundler

// --- Global Variables and Constants ---
let scene, camera, renderer; // OrbitControls is not used actively
const sceneContainer = document.getElementById('scene-container');

// Camera control variables
let isLeftDragging = false;
let isRightDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Camera's spherical coordinates relative to cameraTarget
let cameraOrbitRadius = 20; // Distance from target
let cameraRotation = { x: Math.PI / 4, y: Math.PI / 4 }; // Pitch (X-axis rotation), Yaw (Y-axis rotation)
let targetCameraRotation = { x: Math.PI / 4, y: Math.PI / 4 };

// The point the camera orbits around and looks at
let cameraTarget = new THREE.Vector3(5, 2, 5); // Initial target position

const cameraMoveSpeed = 0.15;
const cameraRotateSpeed = 0.007;
const cameraPanSpeed = 0.03;
const cameraZoomSpeed = 0.5;

// Game state
let selectedTool = null;
let worldBlocks = []; // Stores { x, y, z, type, id, mesh }
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(); // Normalized device coordinates for raycasting

const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
let highlightedBlockInfo = null; // { mesh: THREE.Mesh, outlineMesh: THREE.LineSegments }

// Texture and Material Cache
const textureLoader = new THREE.TextureLoader();
const materialCache = {}; // Stores materials by block type

// Keyboard state
const keysPressed = {
    w: false, a: false, s: false, d: false,
    shift: false, space: false
};

// --- Block Data Management ---
class Block {
    static blockTypes = {}; // Stores definitions from blocks.json
    static defaultTexturePath = 'textures/missing_texture.png'; // Fallback texture

    static async initializeBlockTypes(filePath = 'data/blocks.json') {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
            }
            const data = await response.json();
            this.blockTypes = data.blockTypes;
            console.log("Block types loaded:", this.blockTypes);

            // Pre-cache materials for each block type
            for (const type in this.blockTypes) {
                this.getBlockMaterial(type); // This will load textures and create/cache materials
            }
            return true;
        } catch (error) {
            console.error("블록 데이터를 불러오는데 실패했습니다:", error);
            displayGlobalError(`블록 데이터 로드 실패: ${error.message}. 기본 블록만 사용될 수 있습니다.`);
            // Provide some very basic fallback block types if loading fails
            this.blockTypes = {
                "fallback_stone": {
                    "id": "fallback_stone", "displayName": "Fallback Stone",
                    "texture": { "top": this.defaultTexturePath, "side": this.defaultTexturePath, "bottom": this.defaultTexturePath },
                    "color": "0x808080"
                }
            };
            this.getBlockMaterial("fallback_stone");
            return false;
        }
    }

    static getBlockDefinition(type) {
        return this.blockTypes[type] || this.blockTypes["fallback_stone"];
    }

    static getBlockMaterial(type) {
        if (materialCache[type]) {
            return materialCache[type];
        }

        const blockDef = this.getBlockDefinition(type);
        if (!blockDef) {
            console.warn(`No definition for block type: ${type}. Using fallback.`);
            return this.getBlockMaterial("fallback_stone"); // Fallback
        }

        const loadTexture = (path) => {
            if (!path) return textureLoader.load(this.defaultTexturePath);
            const texture = textureLoader.load(path, undefined, undefined, (err) => {
                console.warn(`Failed to load texture: ${path}. Using default. Error: ${err.message || err}`);
                // If specific texture fails, we might want a per-face fallback, but for now, this re-loads default.
                // This error callback in textureLoader.load might not directly replace the texture object
                // if it's already been used. A more robust fallback is having default textures applied if path is undefined.
            });
            texture.magFilter = THREE.NearestFilter; // Pixelated look
            texture.minFilter = THREE.NearestFilter;
            return texture;
        };
        
        const textures = blockDef.texture || {};
        const materialArray = [
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.side || textures.all || this.defaultTexturePath), name: `${type}_side_R` }), // right
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.side || textures.all || this.defaultTexturePath), name: `${type}_side_L` }), // left
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.top || textures.all || this.defaultTexturePath), name: `${type}_top` }),   // top
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.bottom || textures.all || this.defaultTexturePath), name: `${type}_bottom` }),// bottom
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.side || textures.all || this.defaultTexturePath), name: `${type}_side_F` }), // front
            new THREE.MeshStandardMaterial({ map: loadTexture(textures.side || textures.all || this.defaultTexturePath), name: `${type}_side_B` })  // back
        ];

        materialCache[type] = materialArray;
        return materialArray;
    }
}

// --- Initialization Function ---
async function init() {
    try {
        const blockDataLoaded = await Block.initializeBlockTypes();
        // Proceed even if block data fails, with fallback blocks.

        // 1. Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // 기본 검정색 배경
        scene.fog = new THREE.Fog(0x87CEEB, cameraOrbitRadius * 1.5, cameraOrbitRadius * 4);
            // 사이키델릭 배경 효과를 위한 셰이더 설정


        // 2. Camera
        const aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        // Initial camera position is set in animate() based on target and orbit

        // 3. Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        sceneContainer.appendChild(renderer.domElement);


        // 셰이더를 넣을까 했지만, 너무 렉걸리니 제거
        //addPsychedelicBackground();

        // 4. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
    scene.background = new THREE.Color(0x000000); // 기본 검정색 배경

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(15, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; // Increased for better shadow quality
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 60; // Adjust to encompass typical scene depth
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        scene.add(directionalLight);
        // const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
        // scene.add(shadowHelper);


        // 5. Create the initial world blocks
        createWorldFromData();

        // 6. Setup UI and Event Listeners
        setupToolbar();
        setupEventListeners();
        
        updateCameraPosition(); // Initial camera position set
        animate(); // Start animation loop

    } catch (error) {
        console.error("An error occurred during initialization:", error);
        displayGlobalError(`초기화 중 오류 발생: ${error.message}`);
    }
}

// 사이키델릭 배경 효과 추가 함수
function addPsychedelicBackground() {
  // 셰이더 코드
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    uniform float time;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      vec3 color = vec3(0.0);
      float t = time * 0.2;
      
      // 사이키델릭 패턴 생성
      float x = uv.x * 2.0 - 1.0;
      float y = uv.y * 2.0 - 1.0;
      
      for(int i = 1; i < 5; i++) {
        float i_float = float(i);
        x += 0.3 / i_float * sin(y * i_float * 3.0 + t);
        y += 0.3 / i_float * cos(x * i_float * 3.0 + t);
      }
      
      // 색상 생성
      color.r = 0.5 + 0.5 * sin(x * 2.0);
      color.g = 0.5 + 0.5 * sin(y * 2.0 + t * 1.5);
      color.b = 0.5 + 0.5 * sin(x * y + t);
      
      gl_FragColor = vec4(color, 0.8); // 약간의 투명도 추가
    }
  `;
  
  // 배경 씬 및 카메라 설정
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  
  // 셰이더 재질 생성
  const bgUniforms = {
    time: { value: 0.0 }
  };
  
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true
  });
  
  // 배경 메쉬 생성
  const bgGeometry = new THREE.PlaneGeometry(2, 2);
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
  bgScene.add(bgMesh);
  
  // 애니메이션 함수 수정
  const originalAnimate = window.animate || function() {};
  
  window.animate = function() {
    // 기존 애니메이션 함수 호출
    originalAnimate();
    
    // 시간 업데이트
    bgUniforms.time.value = performance.now() / 1000;
    
    // 배경 렌더링
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(bgScene, bgCamera);
    
    // 메인 씬은 기존 렌더링 코드에서 처리됨
    
    requestAnimationFrame(window.animate);
  };
  
  // 첫 애니메이션 프레임 시작
  if (!window.animationStarted) {
    window.animationStarted = true;
    window.animate();
  }
}

// --- Toolbar Setup ---
function setupToolbar() {
    const icons = document.querySelectorAll('.tool-icon');
    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            const toolType = icon.dataset.tool;
            const blockType = icon.dataset.blocktype;

            if (icon.classList.contains('selected')) {
                icon.classList.remove('selected');
                selectedTool = null;
                unhighlightBlock();
            } else {
                icons.forEach(i => i.classList.remove('selected'));
                icon.classList.add('selected');
                if (toolType === 'pickaxe') {
                    selectedTool = { type: 'pickaxe' };
                } else if (toolType === 'place' && Block.getBlockDefinition(blockType)) {
                    selectedTool = { type: 'place', blockType: blockType };
                } else {
                    selectedTool = null; // Invalid blocktype or tool
                }
                // console.log("Selected tool:", selectedTool);
            }
        });
    });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove); // Use window for dragging outside canvas
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onMouseWheel, { passive: false });

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

// --- World Creation and Block Management ---
function createWorldFromData() {
    worldBlocks.forEach(blockData => {
        if (blockData.mesh) {
            scene.remove(blockData.mesh);
            // Materials are cached, geometries can be disposed if not shared
            if (blockData.mesh.geometry) blockData.mesh.geometry.dispose();
        }
        if (blockData.outlineMesh) { // Also remove outline if any
             scene.remove(blockData.outlineMesh);
             if (blockData.outlineMesh.geometry) blockData.outlineMesh.geometry.dispose();
        }
    });
    worldBlocks = [];
    unhighlightBlock();

    const worldSize = 10;
    const groundLevel = 0;

    for (let x = -Math.floor(worldSize/2); x < Math.ceil(worldSize/2); x++) {
        for (let z = -Math.floor(worldSize/2); z < Math.ceil(worldSize/2); z++) {
            addBlockToWorld(x, groundLevel, z, 'grass');
            addBlockToWorld(x, groundLevel - 1, z, 'dirt');
            addBlockToWorld(x, groundLevel - 2, z, 'stone');
        }
    }
    // Set camera target to roughly the center of the generated world
    cameraTarget.set(0, groundLevel + 2, 0);
}

function addBlockToWorld(x, y, z, type) {
    const blockDef = Block.getBlockDefinition(type);
    if (!blockDef) {
        console.warn(`Cannot add block: Type "${type}" is undefined.`);
        return null;
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = Block.getBlockMaterial(type); // Get cached materials
    
    const blockMesh = new THREE.Mesh(geometry, materials);
    blockMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;

    const blockId = `${x}_${y}_${z}`;
    blockMesh.userData = { x, y, z, type, id: blockId }; // Store basic info for raycasting
    scene.add(blockMesh);

    const blockInstance = { x, y, z, type, id: blockId, mesh: blockMesh };
    worldBlocks.push(blockInstance);
    return blockInstance;
}

function removeBlockFromWorld(targetBlockInstance) {
    if (!targetBlockInstance || !targetBlockInstance.mesh) return;

    scene.remove(targetBlockInstance.mesh);
    // Geometry might be shared if BoxGeometry(1,1,1) is cached, but typically it's not.
    if (targetBlockInstance.mesh.geometry) targetBlockInstance.mesh.geometry.dispose();
    // Materials are cached, so DO NOT dispose them here.

    worldBlocks = worldBlocks.filter(block => block.id !== targetBlockInstance.id);

    if (highlightedBlockInfo && highlightedBlockInfo.mesh === targetBlockInstance.mesh) {
        unhighlightBlock();
    }
    // console.log("Removed block:", targetBlockInstance.id);
}

// --- Mouse Event Handlers ---
function onMouseDown(event) {
    previousMousePosition = { x: event.clientX, y: event.clientY };

    if (event.button === 0) { // Left click
        isLeftDragging = true;
        // Raycasting for block interaction (place/remove)
        if (selectedTool) {
            handleBlockInteraction(event);
        }
    } else if (event.button === 2) { // Right click
        isRightDragging = true;
    }
}

function onMouseMove(event) {
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };

    if (isLeftDragging) { // Camera Orbit
        targetCameraRotation.y += deltaMove.x * cameraRotateSpeed;
        targetCameraRotation.x += deltaMove.y * cameraRotateSpeed;
        // Clamp pitch (x-rotation) to avoid flipping
        targetCameraRotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, targetCameraRotation.x));
    }

    if (isRightDragging) { // Camera Pan
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
        
        cameraTarget.addScaledVector(right, deltaMove.x * cameraPanSpeed);
        
        // For Y panning (vertical), we use a world up vector if camera can't roll.
        // If camera could roll, we'd use camera.up.
        // Here, we pan along the world's Y axis, but relative to view plane movement.
        const panUp = new THREE.Vector3(0, 1, 0); // Assuming camera doesn't roll significantly
        cameraTarget.addScaledVector(panUp, -deltaMove.y * cameraPanSpeed);
    }

    previousMousePosition = { x: event.clientX, y: event.clientY };

    // Block highlighting (only if a tool is selected that interacts with blocks)
    if (selectedTool && (selectedTool.type === 'pickaxe' || selectedTool.type === 'place')) {
        updateBlockHighlight(event);
    } else {
        unhighlightBlock();
    }
}

function onMouseUp(event) {
    if (event.button === 0) isLeftDragging = false;
    if (event.button === 2) isRightDragging = false;
}

function onMouseWheel(event) {
    event.preventDefault(); // Prevent page scrolling
    cameraOrbitRadius += event.deltaY * 0.01 * cameraZoomSpeed;
    cameraOrbitRadius = Math.max(2, Math.min(50, cameraOrbitRadius)); // Clamp zoom
}

function handleBlockInteraction(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const blockMeshes = worldBlocks.map(b => b.mesh).filter(mesh => mesh);
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectionData = intersects[0];
        const clickedMesh = intersectionData.object;
        // Find the block instance from our worldBlocks array
        const clickedBlockInstance = worldBlocks.find(b => b.mesh === clickedMesh);

        if (!clickedBlockInstance) {
            console.warn("Clicked mesh not found in worldBlocks array.");
            return;
        }

        if (selectedTool.type === 'pickaxe') {
            removeBlockFromWorld(clickedBlockInstance);
        } else if (selectedTool.type === 'place' && selectedTool.blockType) {
            const faceNormal = intersectionData.face.normal.clone();
            // Transform normal to world space (if mesh is rotated, though blocks usually aren't)
            // For simple axis-aligned blocks, mesh.getWorldDirection(faceNormal.clone()) on faceNormal is not needed.
            // faceNormal is already in world space for non-rotated objects if raycaster is from camera.
            // To be absolutely sure with potential parent rotations:
            const worldNormal = faceNormal.transformDirection(clickedMesh.matrixWorld).round();


            const newBlockPos = {
                x: clickedBlockInstance.x + worldNormal.x,
                y: clickedBlockInstance.y + worldNormal.y,
                z: clickedBlockInstance.z + worldNormal.z
            };

            const existingBlockAtPlacement = worldBlocks.find(b => b.x === newBlockPos.x && b.y === newBlockPos.y && b.z === newBlockPos.z);
            
            // Player collision check (simple bounding box)
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(0.8, 1.8, 0.8) // Player dimensions
            );
            const newBlockBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(newBlockPos.x + 0.5, newBlockPos.y + 0.5, newBlockPos.z + 0.5),
                new THREE.Vector3(1, 1, 1)
            );

            if (!existingBlockAtPlacement && !playerBox.intersectsBox(newBlockBox)) {
                addBlockToWorld(newBlockPos.x, newBlockPos.y, newBlockPos.z, selectedTool.blockType);
            } else if (existingBlockAtPlacement) {
                console.log("Cannot place block: Position occupied.");
            } else {
                console.log("Cannot place block: Too close to player.");
            }
        }
    }
}

function updateBlockHighlight(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const blockMeshes = worldBlocks.map(b => b.mesh).filter(mesh => mesh);
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        if (highlightedBlockInfo && highlightedBlockInfo.mesh === intersectedMesh) {
            return; // Already highlighting this block
        }
        unhighlightBlock();

        const edges = new THREE.EdgesGeometry(intersectedMesh.geometry);
        const outline = new THREE.LineSegments(edges, outlineMaterial);
        outline.position.copy(intersectedMesh.position);
        outline.rotation.copy(intersectedMesh.rotation);
        outline.scale.copy(intersectedMesh.scale);
        scene.add(outline);

        highlightedBlockInfo = { mesh: intersectedMesh, outlineMesh: outline };
        edges.dispose(); // Dispose EdgesGeometry as it's now in LineSegments

    } else {
        unhighlightBlock();
    }
}

function unhighlightBlock() {
    if (highlightedBlockInfo && highlightedBlockInfo.outlineMesh) {
        scene.remove(highlightedBlockInfo.outlineMesh);
        if (highlightedBlockInfo.outlineMesh.geometry) highlightedBlockInfo.outlineMesh.geometry.dispose();
        // outlineMaterial is shared, so don't dispose it
        highlightedBlockInfo = null;
    }
}

// --- Window and Keyboard Event Handlers ---
function onWindowResize() {
    if (camera && renderer && sceneContainer) {
        camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    }
}

function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (keysPressed.hasOwnProperty(key)) {
        keysPressed[key] = true;
        if (key === ' ' || key === 'shift') event.preventDefault(); // Prevent page scroll
    }
}

function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (keysPressed.hasOwnProperty(key)) {
        keysPressed[key] = false;
    }
}

// --- Camera Update Functions ---
function updateCameraPosition() {
    if (!camera) return;

    // Lerp for smooth rotation
    cameraRotation.x += (targetCameraRotation.x - cameraRotation.x) * 0.1;
    cameraRotation.y += (targetCameraRotation.y - cameraRotation.y) * 0.1;

    // Calculate camera position based on spherical coordinates from cameraTarget
    const offsetX = cameraOrbitRadius * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
    const offsetY = cameraOrbitRadius * Math.sin(cameraRotation.x);
    const offsetZ = cameraOrbitRadius * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);

    camera.position.set(
        cameraTarget.x + offsetX,
        cameraTarget.y + offsetY,
        cameraTarget.z + offsetZ
    );
    camera.lookAt(cameraTarget);
}

function updateKeyboardCameraMovement() {
    if (!camera) return;

    const actualMoveSpeed = cameraMoveSpeed * (keysPressed.control ? 2.5 : 1); // Example: Ctrl for sprint

    // Get camera's current forward and right vectors (horizontal plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Project onto XZ plane
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize(); // Use world UP for right vector

    let moved = false;
    if (keysPressed.w) { cameraTarget.addScaledVector(forward, actualMoveSpeed); moved = true; }
    if (keysPressed.s) { cameraTarget.addScaledVector(forward, -actualMoveSpeed); moved = true; }
    if (keysPressed.a) { cameraTarget.addScaledVector(right, actualMoveSpeed); moved = true; } // Moving "camera left" means target moves "camera right" from pov
    if (keysPressed.d) { cameraTarget.addScaledVector(right, -actualMoveSpeed); moved = true; }

    // Vertical movement affects cameraTarget's Y
    if (keysPressed.space) { cameraTarget.y += actualMoveSpeed; moved = true;}
    if (keysPressed.shift) { cameraTarget.y -= actualMoveSpeed; moved = true;}
    
    // If cameraTarget moved, the camera position will be updated in updateCameraPosition()
    // to maintain its orbit around the new target.
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (!renderer || !scene || !camera) {
        // console.warn("animate() called before full initialization.");
        return;
    }
        
    // 배경 셰이더 시간 업데이트 (전역 변수 접근)
    if (window.bgUniforms) {
        window.bgUniforms.time.value = performance.now() / 1000;
    }
    
    // 렌더링 순서 수정
    renderer.autoClear = false;
    renderer.clear();
    
    // 배경 렌더링 (backgroundScene이 정의된 경우)
    if (typeof backgroundScene !== 'undefined' && typeof backgroundCamera !== 'undefined') {
        renderer.render(backgroundScene, backgroundCamera);
    }
    updateKeyboardCameraMovement(); // Handle WASD, Space, Shift for cameraTarget
    updateCameraPosition();       // Update camera's actual position based on orbit and target

    renderer.render(scene, camera);
}

// --- Global Error Display ---
function displayGlobalError(message) {
    let errorDiv = document.getElementById('global-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'global-error-message';
        errorDiv.style.cssText = `
            position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
            padding: 15px; background-color: #ffdddd; border: 1px solid #ff8888;
            color: #d8000c; border-radius: 5px; z-index: 10000; font-family: sans-serif;
            text-align: center; box-shadow: 0 0 10px rgba(0,0,0,0.5); max-width: 80%;
        `;
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    console.error("Global Error Displayed:", message);
}


// --- Start the Application ---
init().catch(err => { // Catch any unhandled promise rejections from init
    console.error("Unhandled error during async init:", err);
    displayGlobalError(`심각한 초기화 오류: ${err.message}. 페이지를 새로고침 해주세요.`);
});

